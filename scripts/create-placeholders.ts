import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');
const ASSETS = [
    'scene-1-walls.jpg',
    'scene-2-fatih.jpg',
    'scene-3-cannons.jpg',
    'scene-4-ships.jpg',
    'scene-5-flag.jpg',
    'scene-6-mosque.jpg'
];

// Minimal 1x1 pixel black JPEG buffer
const PLACEHOLDER_BUFFER = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

ASSETS.forEach(asset => {
    const filePath = path.join(ASSETS_DIR, asset);
    if (!fs.existsSync(filePath)) {
        console.log(`Creating placeholder for ${asset}`);
        fs.writeFileSync(filePath, PLACEHOLDER_BUFFER);
    }
});
