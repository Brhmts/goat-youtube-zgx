/**
 * Smart Split-Render Script
 * 
 * This script automates the rendering process by:
 * 1. Reading the current video configuration (src/data/current-video.ts)
 * 2. Calculating optimal split points (every ~60s, at scene boundaries)
 * 3. Rendering each part using Remotion CLI
 * 4. Stitching parts together using ffmpeg-static
 */

import { currentVideo } from '../src/data/current-video';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'ffmpeg-static';

const MAX_PART_DURATION_SEC = 60; // Max duration per part in seconds
const FPS = 30;

const OUTPUT_DIR = path.join(process.cwd(), 'out');
const PUBLIC_DIR = path.join(process.cwd(), 'public'); // Final output goes here? Or just use out.

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Calculate Split Points
interface RenderPart {
    index: number;
    startFrame: number;
    endFrame: number;
    filename: string;
}

const parts: RenderPart[] = [];
let currentStartFrame = 0;
let currentDurationSec = 0;
let partIndex = 1;

console.log(`Analyzing ${currentVideo.scenes.length} scenes for split points...`);

for (let i = 0; i < currentVideo.scenes.length; i++) {
    const scene = currentVideo.scenes[i];
    const sceneFrames = Math.ceil(scene.duration * FPS);

    // Check if adding this scene exceeds calculation, OR if it's the last scene
    const isLastScene = i === currentVideo.scenes.length - 1;

    // Tentative new duration
    if ((currentDurationSec + scene.duration > MAX_PART_DURATION_SEC) && currentDurationSec > 0) {
        // Current part is full, push it WITHOUT this scene
        const endFrame = currentStartFrame + Math.ceil(currentDurationSec * FPS) - 1;
        parts.push({
            index: partIndex,
            startFrame: currentStartFrame,
            endFrame: endFrame,
            filename: `part_${partIndex.toString().padStart(3, '0')}.mp4`
        });

        console.log(`Part ${partIndex}: Frames ${currentStartFrame}-${endFrame} (~${currentDurationSec.toFixed(1)}s)`);

        // Reset for next part, starting with THIS scene
        partIndex++;
        currentStartFrame = endFrame + 1;
        currentDurationSec = scene.duration;
    } else {
        // Add scene to current part
        currentDurationSec += scene.duration;
    }

    // Handle very last scene flush
    if (isLastScene) {
        const endFrame = currentStartFrame + Math.ceil(currentDurationSec * FPS) - 1;
        parts.push({
            index: partIndex,
            startFrame: currentStartFrame,
            endFrame: endFrame,
            filename: `part_${partIndex.toString().padStart(3, '0')}.mp4`
        });
        console.log(`Part ${partIndex}: Frames ${currentStartFrame}-${endFrame} (~${currentDurationSec.toFixed(1)}s)`);
    }
}

// 2. Render Parts
console.log(`\nStarting render of ${parts.length} parts...`);

for (const part of parts) {
    const outputFile = path.join(OUTPUT_DIR, part.filename);
    console.log(`\nRendering Part ${part.index}/${parts.length}: ${outputFile}`);
    console.log(`Frames: ${part.startFrame} - ${part.endFrame}`);

    try {
        // npx remotion render Video out/filename --frames=START-END
        const cmd = `npx remotion render Video ${outputFile} --frames=${part.startFrame}-${part.endFrame} --concurrency=2 --gl=angle`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`✔ Part ${part.index} complete.`);
    } catch (e) {
        console.error(`❌ Failed to render Part ${part.index}`);
        process.exit(1);
    }
}

// 3. Stitch Parts
console.log(`\nStitching parts...`);
const listFile = path.join(OUTPUT_DIR, 'ffmpeg_list.txt');
const fileContent = parts.map(p => `file '${p.filename}'`).join('\n');
fs.writeFileSync(listFile, fileContent);

const finalFilename = `${currentVideo.projectId}-final.mp4`;
const finalPath = path.join(OUTPUT_DIR, finalFilename);

// Delete existing final file
if (fs.existsSync(finalPath)) {
    fs.unlinkSync(finalPath);
}

try {
    // ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
    if (!ffmpeg) throw new Error("ffmpeg-static not found");

    const cmd = `"${ffmpeg}" -f concat -safe 0 -i "${listFile}" -c copy "${finalPath}"`;
    execSync(cmd, { stdio: 'inherit' });

    console.log(`\nSUCCESS! Video created at:\n${finalPath}`);
} catch (e) {
    console.error(`❌ Stitching failed:`, e);
    process.exit(1);
}
