if (Test-Path -path dist) {
    rmdir -r dist
}

mkdir dist

cd server
cargo build --release
cd ..

cp server/target/release/maps-server.exe dist/
cp server/SimConnect.dll dist/
cp -r server/assets dist/assets

cd front
npm i
npm run build
cd ..

cp -r front/dist/ dist/front

New-Item -Path "dist" -Name "api_key.txt"
