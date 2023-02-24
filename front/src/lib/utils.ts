import { API_URL } from './constants';

export function getApiKey() {
    const req = new XMLHttpRequest();
    try {
        req.open('GET', API_URL + '/api_key', false);
        req.send(null);
        if (req.status === 200) {
            return req.responseText;
        } else {
            return '';
        }
    } catch {
        return '';
    }
}

export function shutdown() {
    const req = new XMLHttpRequest();
    try {
        req.open('POST', API_URL + '/management', false);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify({
            command: "Shutdown"
        }));
    } catch {
        /* empty */
    }
}

export function resetRoute() {
    const req = new XMLHttpRequest();
    try {
        req.open('POST', `${API_URL}/management`);
        req.setRequestHeader('Content-Type', 'application/json');
        req.send(JSON.stringify({
            command: "ResetRoute"
        }));
    } catch {
        /* empty */
    }
}

export function lerpColor(a: number, b: number, amount: number) {
    const ar = (a & 0xff0000) >> 16,
        ag = (a & 0x00ff00) >> 8,
        ab = a & 0x0000ff,
        br = (b & 0xff0000) >> 16,
        bg = (b & 0x00ff00) >> 8,
        bb = b & 0x0000ff,
        rr = ar + amount * (br - ar),
        rg = ag + amount * (bg - ag),
        rb = ab + amount * (bb - ab);

    return (rr << 16) + (rg << 8) + (rb | 0);
}

export function hexToColor(a: number) {
    return `#${a.toString(16).padStart(6, '0').slice(-6)}`;
}

export function degToRad(deg: number) {
    return deg * (Math.PI / 180.0);
}

export function createElementWithId<T extends keyof HTMLElementTagNameMap>(type: T, id: string) {
    const el = document.createElement(type);
    el.id = id;
    return el;
}
