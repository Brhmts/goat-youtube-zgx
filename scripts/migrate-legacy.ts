/**
 * Moves assets made by the old single-video pipeline (public/assets/<prefix>-scene-N-*)
 * into an episode folder, so already-paid-for images, clips and narration are reused.
 *
 *   npm run migrate-legacy -- osmanli-v2 osmanli/01
 *   npm run migrate-legacy -- aiwars ai-wars/01
 *
 * Narration is moved only for scenes with exactly one line (the old format).
 */

import fs from 'fs';
import path from 'path';
import { resolveSpeaker } from '../src/series/codex';
import { episodeAssetsDir, lineVoicePath, sceneImagePath, sceneVideoPath } from '../src/series/paths';
import { isNonEmptyFile } from '../src/services/http';
import { abs, loadEpisode, PUBLIC_DIR, positionalArgs, run } from './lib/episode';

run(async () => {
    const [prefix, episodeArg] = positionalArgs();
    if (!prefix || !episodeArg) throw new Error('Kullanım: npm run migrate-legacy -- <eski-projectId> <dizi>/<bölüm>');
    const { ref, series, episode } = await loadEpisode(episodeArg);
    const legacyDir = path.join(PUBLIC_DIR, 'assets');
    fs.mkdirSync(abs(episodeAssetsDir(ref)), { recursive: true });

    let moved = 0;
    const move = (from: string, to: string) => {
        if (!isNonEmptyFile(from)) return;
        if (fs.existsSync(to)) {
            console.log(`  atlandı (hedef var): ${path.relative(process.cwd(), to)}`);
            return;
        }
        fs.renameSync(from, to);
        moved++;
        console.log(`  ${path.relative(process.cwd(), from)} → ${path.relative(process.cwd(), to)}`);
    };

    for (const scene of episode.scenes) {
        const legacy = (kind: string) => path.join(legacyDir, `${prefix}-scene-${scene.id}-${kind}`);
        move(legacy('image.jpg'), abs(sceneImagePath(ref, scene.id)));
        move(legacy('video.mp4'), abs(sceneVideoPath(ref, scene.id)));
        if (scene.lines.length === 1) {
            const line = scene.lines[0];
            const voice = resolveSpeaker(series, line.speaker)?.voice;
            move(legacy('voice.mp3'), abs(lineVoicePath(ref, scene.id, 0, line.text, voice)));
        }
    }
    console.log(`\n${moved} dosya taşındı.`);
});
