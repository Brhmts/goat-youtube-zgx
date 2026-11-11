/**
 * Split-Render Script
 *
 * 1. Bundles the project and resolves the "Video" composition — this runs
 *    calculateMetadata, so scene lengths already include the real voice-over durations.
 * 2. Splits the video into parts of at most MAX_PART_SEC, cutting only at scene boundaries.
 * 3. Renders each part with Remotion and stitches them together with ffmpeg.
 *
 * Usage: npm run render -- <series>/<NN>          e.g. npm run render -- moskova-kedileri/01
 *        MAX_PART_SEC=120 npm run render -- ...   to change the part size
 */

import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { enableTailwind } from '@remotion/tailwind-v4';
import ffmpeg from 'ffmpeg-static';
import { formatEpisodeRef, parseEpisodeRef } from '../src/series/paths';
import type { VideoProps } from '../src/types/props';
import { positionalArgs } from './lib/episode';

const MAX_PART_SEC = Number(process.env.MAX_PART_SEC) || 60;
const CONCURRENCY = Number(process.env.RENDER_CONCURRENCY) || 2;
// Optional: use an already installed Chrome/Chromium instead of Remotion's download
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const OUTPUT_DIR = path.join(process.cwd(), 'out');
const PARTS_DIR = path.join(OUTPUT_DIR, 'parts');

interface RenderPart {
    index: number;
    startFrame: number;
    endFrame: number; // inclusive
    filename: string;
}

/** Greedily packs whole scenes into parts of at most maxFrames (a single longer scene gets its own part). */
const splitIntoParts = (sceneFrames: number[], maxFrames: number): RenderPart[] => {
    const parts: RenderPart[] = [];
    let start = 0;
    let length = 0;

    const flush = () => {
        const index = parts.length + 1;
        parts.push({
            index,
            startFrame: start,
            endFrame: start + length - 1,
            filename: `part_${index.toString().padStart(3, '0')}.mp4`,
        });
        start += length;
        length = 0;
    };

    for (const frames of sceneFrames) {
        if (length > 0 && length + frames > maxFrames) flush();
        length += frames;
    }
    if (length > 0) flush();
    return parts;
};

const main = async () => {
    if (!ffmpeg) throw new Error('ffmpeg-static binary not found for this platform');
    const arg = positionalArgs()[0];
    if (!arg) throw new Error('Kullanım: npm run render -- <dizi-id>/<bölüm>, örn. moskova-kedileri/01');
    const episodeRef = formatEpisodeRef(parseEpisodeRef(arg));
    const inputProps: VideoProps = { episode: episodeRef };
    fs.mkdirSync(PARTS_DIR, { recursive: true });

    console.log('Bundling project...');
    const serveUrl = await bundle({
        entryPoint: path.join(process.cwd(), 'src', 'index.ts'),
        // remotion.config.ts is not applied when using the Node APIs, so repeat its settings here
        webpackOverride: (config) => enableTailwind(config),
    });

    const composition = await selectComposition({ serveUrl, id: 'Video', inputProps, browserExecutable });
    const resolvedScenes = (composition.props as VideoProps).resolvedScenes ?? [];
    const fps = composition.fps;

    console.log(
        `${episodeRef}: ${resolvedScenes.length} scenes, ${(composition.durationInFrames / fps).toFixed(1)}s, ` +
        `${composition.width}x${composition.height}@${fps}fps`,
    );

    const parts = splitIntoParts(resolvedScenes.map((s) => s.durationInFrames), MAX_PART_SEC * fps);
    for (const part of parts) {
        const sec = (part.endFrame - part.startFrame + 1) / fps;
        console.log(`Part ${part.index}: frames ${part.startFrame}-${part.endFrame} (~${sec.toFixed(1)}s)`);
    }

    for (const part of parts) {
        const outputLocation = path.join(PARTS_DIR, part.filename);
        console.log(`\nRendering part ${part.index}/${parts.length} → ${outputLocation}`);
        let lastPct = -1;
        await renderMedia({
            composition,
            serveUrl,
            codec: 'h264',
            outputLocation,
            inputProps: composition.props,
            frameRange: [part.startFrame, part.endFrame],
            imageFormat: 'jpeg',
            concurrency: CONCURRENCY,
            overwrite: true,
            chromiumOptions: { gl: 'angle' },
            browserExecutable,
            onProgress: ({ progress }) => {
                const pct = Math.floor(progress * 10) * 10;
                if (pct !== lastPct) {
                    lastPct = pct;
                    console.log(`  ${pct}%`);
                }
            },
        });
        console.log(`✔ Part ${part.index} complete.`);
    }

    const finalPath = path.join(OUTPUT_DIR, `${episodeRef.replace('/', '-')}.mp4`);

    if (parts.length === 1) {
        fs.copyFileSync(path.join(PARTS_DIR, parts[0].filename), finalPath);
    } else {
        console.log(`\nStitching ${parts.length} parts...`);
        const listFile = path.join(PARTS_DIR, 'ffmpeg_list.txt');
        fs.writeFileSync(listFile, parts.map((p) => `file '${p.filename}'`).join('\n'));
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', finalPath], {
            stdio: 'inherit',
        });
    }

    console.log(`\nSUCCESS! Video created at:\n${finalPath}`);
};

main().catch((err) => {
    console.error('❌ Render failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
