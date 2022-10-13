import BaseMap from './baseMap';
import { Feature, Map, MapBrowserEvent, Overlay, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { Point } from 'ol/geom';
import { Icon, Stroke, Style } from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { degToRad } from '../lib/utils';
import LineString from 'ol/geom/LineString';
import { XYZ } from 'ol/source';
import LayerSwitcher from 'ol-layerswitcher';
import 'ol/ol.css';
import 'ol-layerswitcher/dist/ol-layerswitcher.css';
import LayerGroup from 'ol/layer/Group';
import { ScaleLine } from 'ol/control';

export default class OpenStreetMap extends BaseMap {
    map!: Map;
    planeMarker!: Feature<Point>;
    planeStyle!: Style;
    airportsLayer!: VectorLayer<VectorSource<Point>>;
    routeLayer!: VectorLayer<VectorSource<LineString>>;
    lastSegmentPoints!: number;
    prevFeature!: Feature<LineString>;
    popup!: Overlay;
    hitTolerance: number = 7;

    constructor(followOn: boolean, showRouteOn: boolean) {
        super(followOn, showRouteOn);

        this.createMap();
        this.createRouteLayer();
        this.createAirportsLayer();
        this.createMarker();
        this.createPopup();

        this.map.on('pointerdrag', () => {
            this.pauseFollow();
        });

        this.map.on('click', (e) => this.displayPopup(e));
        this.map.on('pointermove', (e) => this.onPointerMove(e));

        this.updateIntervalID = window.setInterval(() => this.updateRoute(), 1000);
    }

    createAirportsLayer() {
        this.airportsLayer = new VectorLayer({
            source: new VectorSource(),
        });
        this.map.addLayer(this.airportsLayer);
    }

    createRouteLayer() {
        this.routeLayer = new VectorLayer({
            source: new VectorSource(),
        });

        this.lastSegmentPoints = 0;

        this.map.addLayer(this.routeLayer);
    }

    createMap() {
        const baseLayers = new LayerGroup({
            properties: {
                title: 'Base maps'
            },
            layers: [
                new TileLayer({
                    properties: {
                        title: 'OpenStreetMap',
                        type: 'base'
                    },
                    source: new OSM(),
                }), new TileLayer({
                    properties: {
                        title: 'Stadia Outdoors',
                        type: 'base'
                    },
                    source: new XYZ({
                        url: 'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}@2x.png',
                        attributions: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                            '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
                            '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
                        tilePixelRatio: 2,
                        maxZoom: 20
                    }),
                    visible: false
                }),
                new TileLayer({
                    properties: {
                        title: 'OpenTopoMap',
                        type: 'base'
                    },
                    source: new XYZ({
                        url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                        attributions: 'Kartendaten: © OpenStreetMap-Mitwirkende, SRTM ' +
                            '| Kartendarstellung: © OpenTopoMap (CC-BY-SA)',
                        maxZoom: 17,
                    }),
                    visible: false,
                }),
                new TileLayer({
                    properties: {
                        title: 'Swisstopo (Switzerland only)',
                        type: 'base'
                    },
                    source: new XYZ({
                        url: `https://wmts{0-9}.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg`,
                        attributions: 'Map data: &copy; <a href="https://www.geo.admin.ch/en/geo-services/geo-services/terms-of-use.html">Swisstopo</a>',
                    }),
                    visible: false,
                }),
            ]
        });

        this.map = new Map({
            target: 'map',
            layers: baseLayers,
            view: new View({
                center: [0, 0],
                zoom: 12,
            }),
        });

        const layerSwitcher = new LayerSwitcher({
            reverse: false,
            groupSelectStyle: 'group'
        });
        this.map.addControl(layerSwitcher);

        this.map.addControl(new ScaleLine())
    }

    createPopup() {
        if (!document.getElementById('OSM-popup')) {
            const el = document.createElement('div');
            el.id = 'OSM-popup';
            document.getElementById('map')!.appendChild(el);
        }
        this.popup = new Overlay({
            element: document.getElementById('OSM-popup')!,
            positioning: 'bottom-center',
            stopEvent: false,
        });
        this.map.addOverlay(this.popup);
    }

    createMarker() {
        this.planeMarker = new Feature({
            geometry: new Point(fromLonLat([0, 0])),
        });

        this.planeStyle = new Style({
            image: new Icon({
                scale: 0.2,
                src: '/images/plane.png',
                rotateWithView: true,
            }),
        });

        this.planeMarker.setStyle(this.planeStyle);

        const vectorSource = new VectorSource({
            features: [this.planeMarker],
        });

        const vectorLayer = new VectorLayer({
            source: vectorSource,
        });

        this.map.addLayer(vectorLayer);
    }

    markAirports(radius: number) {
        this.clearAirports();
        this.getAirports(this.position.lat, this.position.lon, radius, (airports) => {
            airports.forEach((airport) => {
                const marker = new Feature({
                    geometry: new Point(fromLonLat([airport.longitude_deg, airport.latitude_deg])),
                    name: `<div><h2>${airport.name}</h2><b>type: ${airport.type.replace('_', ' ')}</div>`,
                });
                const markerStyle = new Style({
                    image: new Icon({
                        scale: 0.7,
                        src: `/images/${airport.type}.png`,
                    }),
                });
                marker.setStyle(markerStyle);

                this.airportsLayer.getSource()?.addFeature(marker);
            });
        });
    }

    clearAirports() {
        this.airportsLayer.getSource()?.forEachFeature((f) => {
            this.airportsLayer.getSource()?.removeFeature(f);
        });
        this.popup.getElement()!.style.display = 'none';
    }

    displayPopup(e: MapBrowserEvent<any>) {
        const feature = this.map.forEachFeatureAtPixel(e.pixel, (f) => f, {
            hitTolerance: this.hitTolerance,
        });
        if (feature && feature.getGeometry()?.getType() === 'Point') {
            this.popup.setPosition((feature.getGeometry() as Point).getCoordinates());
            this.popup.getElement()!.innerHTML = feature.getProperties().name ? feature.getProperties().name : '';
            this.popup.getElement()!.style.display = feature.getProperties().name ? '' : 'none';
        } else {
            this.popup.getElement()!.style.display = 'none';
        }
    }

    onPointerMove(e: MapBrowserEvent<any>) {
        const feature = this.map.forEachFeatureAtPixel(e.pixel, (f) => f, {
            hitTolerance: this.hitTolerance,
        });
        document.getElementById('map')!.style.cursor = feature?.getProperties().name ? 'pointer' : '';
    }

    updatePosition() {
        if (typeof this.route.at(-1) !== 'undefined') {
            this.position = this.route.at(-1)!;

            this.planeMarker.getGeometry()?.setCoordinates(fromLonLat([this.position.lon, this.position.lat]));
            this.planeStyle.getImage().setRotation(degToRad(this.position.hdg));

            if (this.followOn && !this.followPaused) {
                this.map.getView().setCenter(fromLonLat([this.position.lon, this.position.lat]));
            }
        }
    }

    clearRoute() {
        this.route = [];
        this.routeLayer.getSource()?.forEachFeature((f) => {
            this.routeLayer.getSource()?.removeFeature(f);
        });
    }

    updateVisualRoute() {
        let current = this.route.at(-1)!;
        let routeStyle: any;

        if (this.route.length === 1) {
            this.lastSegmentPoints = 1;
            routeStyle = new Style({
                stroke: new Stroke({
                    width: 5,
                    color: this.getColor(current.alt),
                }),
            });
        } else {
            let previous = this.route.at(-2)!;

            if (Math.floor(previous.alt / this.colorBreakDiff) === Math.floor(current.alt / this.colorBreakDiff)) {
                this.lastSegmentPoints += 1;
                routeStyle = this.prevFeature.getStyle();
                this.routeLayer.getSource()?.removeFeature(this.prevFeature);
            } else {
                this.lastSegmentPoints = 2;
                routeStyle = new Style({
                    stroke: new Stroke({
                        width: 5,
                        color: this.getColor(current.alt),
                    }),
                });
            }
        }

        let path = this.route.slice(-this.lastSegmentPoints).map((el) => [el.lon, el.lat]);
        let polyline = new LineString(path);
        polyline.transform('EPSG:4326', 'EPSG:3857');
        let feature = new Feature(polyline);
        feature.setStyle(routeStyle);
        this.prevFeature = feature;
        this.routeLayer.getSource()?.addFeature(feature);
    }

    toggleRoute() {
        this.routeLayer.setVisible(this.showRouteOn);
    }
}
