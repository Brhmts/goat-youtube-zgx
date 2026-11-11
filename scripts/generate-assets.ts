/**
 * Asset Generation Pipeline
 *
 * 1. TTS voice generation (ElevenLabs via Kie.ai, or direct)
 * 2. Image generation (nano-banana-2 via Kie.ai)
 * 3. Image-to-Video generation (Hailuo 2.3 via Kie.ai)
 *
 * Flow: Scene Data → Voice → Image → Video Clip → Ready for Remotion
 *
 * Safe to re-run: finished files are skipped, pending Kie.ai tasks are resumed,
 * failed steps are retried. Exits with code 1 if anything is still missing.
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import {
    completeImageTask,
    completeVideoTask,
    createImageTask,
    createVideoTask,
    MODELS,
} from '../src/services/kie';
import { generateVoice } from '../src/services/elevenlabs';
import { isNonEmptyFile, isUrlReachable, sleep } from '../src/services/http';
import { currentVideo } from '../src/data/current-video';
import { sceneAssetPaths } from '../src/lib/assets';
import { buildImagePrompt, checkCodex } from '../src/lib/codex';
import type { SceneData } from '../src/types/VideoData';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const STATE_FILE = path.join(ASSETS_DIR, `generation-state-${currentVideo.projectId}.json`);
const BATCH_SIZE = 3; // Small batches — the video pipeline is API-intensive

fs.mkdirSync(ASSETS_DIR, { recursive: true });

// ── State Management ─────────────────────────────────────────────
interface TaskState {
    imageTaskId?: string;
    videoTaskId?: string;
    imageUrl?: string; // Kie.ai result URL (input for image-to-video). Temporary — may expire.
}

type GenerationState = Record<string, TaskState>;

// State file of the previous script version (same keys, so pending tasks can be resumed)
const LEGACY_STATE_FILE = path.join(ASSETS_DIR, 'generation-state-v2.json');

const loadState = (): GenerationState => {
    const file = fs.existsSync(STATE_FILE) ? STATE_FILE : LEGACY_STATE_FILE;
    if (!fs.existsSync(file)) return {};
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        console.warn(`[STATE] ${STATE_FILE} is corrupt, starting fresh.`);
        return {};
    }
};

const state = loadState();
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const sceneKey = (scene: SceneData) => `${currentVideo.projectId}-scene-${scene.id}`;
const absPaths = (scene: SceneData) => {
    const rel = sceneAssetPaths(currentVideo.projectId, scene.id);
    return {
        image: path.join(PUBLIC_DIR, rel.image),
        video: path.join(PUBLIC_DIR, rel.video),
        voice: path.join(PUBLIC_DIR, rel.voice),
    };
};
const wantsVideo = (scene: SceneData) =>
    Boolean(currentVideo.useVideoClips && scene.videoPrompt && scene.useVideo !== false);

// ── Settings ─────────────────────────────────────────────────────
const { projectId, scenes, useVideoClips, costMode = 'budget', style, hasVoice, codex = [] } = currentVideo;

// Cost mode determines resolution & model
const IMAGE_RESOLUTION: '1K' | '2K' = costMode === 'budget' ? '1K' : '2K';
const VIDEO_MODEL = costMode === 'premium' ? MODELS.VIDEO : MODELS.VIDEO_STANDARD;
const VIDEO_RESOLUTION: '768P' | '1080P' = costMode === 'premium' ? '1080P' : '768P';

const videoDurationFor = (scene: SceneData): '6' | '10' => {
    const requested = scene.videoDuration ?? '6';
    // Hailuo 2.3 only offers 10s clips at 768P
    if (requested === '10' && VIDEO_RESOLUTION === '1080P') {
        console.warn(`[VIDEO] Scene ${scene.id}: 10s is not available at 1080P, using 6s.`);
        return '6';
    }
    return requested;
};

// ── Steps ────────────────────────────────────────────────────────
const generateSceneVoice = async (scene: SceneData) => {
    const { voice } = absPaths(scene);
    if (isNonEmptyFile(voice)) return;
    if (!scene.voiceText || scene.voiceText.trim().length <= 5) return;

    console.log(`[TTS] Scene ${scene.id}: generating voice...`);
    const ok = await generateVoice(scene.voiceText, voice);
    if (!ok) console.error(`[TTS] Scene ${scene.id}: voice generation FAILED (will retry on next run)`);
};

const generateSceneImage = async (scene: SceneData) => {
    const key = sceneKey(scene);
    const { image } = absPaths(scene);
    state[key] ??= {};

    if (isNonEmptyFile(image)) {
        console.log(`[IMAGE] Scene ${scene.id}: exists, skipping`);
        return;
    }
    if (!scene.imagePrompt) return;

    if (!state[key].imageTaskId) {
        console.log(`[IMAGE] Scene ${scene.id}: creating task...`);
        const taskId = await createImageTask({
            prompt: buildImagePrompt(scene, codex, style),
            aspectRatio: '16:9',
            resolution: IMAGE_RESOLUTION,
        });
        if (!taskId) {
            console.error(`[IMAGE] Scene ${scene.id}: could not create task`);
            return;
        }
        state[key].imageTaskId = taskId;
        delete state[key].imageUrl;
        delete state[key].videoTaskId; // a new image needs a new video
        saveState();
    } else {
        console.log(`[IMAGE] Scene ${scene.id}: resuming task ${state[key].imageTaskId}`);
    }

    const url = await completeImageTask(state[key].imageTaskId!, image);
    if (url) {
        state[key].imageUrl = url;
    } else {
        // Failed or expired task: forget it so the next run creates a fresh one
        delete state[key].imageTaskId;
        console.error(`[IMAGE] Scene ${scene.id}: FAILED (will retry on next run)`);
    }
    saveState();
};

const generateSceneVideo = async (scene: SceneData) => {
    if (!wantsVideo(scene)) return;

    const key = sceneKey(scene);
    const { video, image } = absPaths(scene);
    state[key] ??= {};

    if (isNonEmptyFile(video)) {
        console.log(`[VIDEO] Scene ${scene.id}: exists, skipping`);
        return;
    }

    if (!state[key].videoTaskId) {
        const imageUrl = state[key].imageUrl;
        if (!isNonEmptyFile(image) || !imageUrl) {
            console.warn(
                `[VIDEO] Scene ${scene.id}: no image URL available, skipping video. ` +
                `Delete ${path.relative(process.cwd(), image)} and re-run to regenerate the image.`,
            );
            return;
        }
        if (!(await isUrlReachable(imageUrl))) {
            console.warn(
                `[VIDEO] Scene ${scene.id}: the Kie.ai image URL has expired. ` +
                `Delete ${path.relative(process.cwd(), image)} and re-run to regenerate it.`,
            );
            return;
        }

        console.log(`[VIDEO] Scene ${scene.id}: creating image-to-video task...`);
        const taskId = await createVideoTask({
            prompt: scene.videoPrompt!,
            imageUrl,
            duration: videoDurationFor(scene),
            resolution: VIDEO_RESOLUTION,
            promptOptimizer: true,
            model: VIDEO_MODEL,
        });
        if (!taskId) {
            console.error(`[VIDEO] Scene ${scene.id}: could not create task`);
            return;
        }
        state[key].videoTaskId = taskId;
        saveState();
    } else {
        console.log(`[VIDEO] Scene ${scene.id}: resuming task ${state[key].videoTaskId}`);
    }

    const url = await completeVideoTask(state[key].videoTaskId!, video);
    if (!url) {
        delete state[key].videoTaskId;
        console.error(`[VIDEO] Scene ${scene.id}: FAILED (will retry on next run; the image is used meanwhile)`);
    }
    saveState();
};

// ── Main Pipeline ────────────────────────────────────────────────
const main = async () => {
    if (!process.env.KIE_AI_API_KEY) {
        console.error('KIE_AI_API_KEY is not set. Copy .env.example to .env and fill it in.');
        process.exit(1);
    }

    const codexErrors = checkCodex(scenes, codex).filter((i) => i.level === 'error');
    if (codexErrors.length > 0) {
        codexErrors.forEach((i) => console.error(`[CODEX] ${i.message}`));
        console.error('Codex hatalarını düzeltin (npm run codex) ve tekrar deneyin.');
        process.exit(1);
    }

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Asset Generation — ${projectId}`);
    console.log(`║  Scenes: ${scenes.length} | Video Clips: ${useVideoClips ? 'YES' : 'NO'} | Voice: ${hasVoice ? 'YES' : 'NO'}`);
    console.log(`║  Cost Mode: ${costMode.toUpperCase()}`);
    console.log(`║  Image: ${MODELS.IMAGE} @ ${IMAGE_RESOLUTION}`);
    if (useVideoClips) console.log(`║  Video: ${VIDEO_MODEL} @ ${VIDEO_RESOLUTION}`);
    if (style) console.log(`║  Style: ${style.suffix.substring(0, 40)}...`);
    if (codex.length) console.log(`║  Codex: ${codex.length} entries`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        console.log(`\n━━━ Batch ${Math.floor(i / BATCH_SIZE) + 1} (Scenes ${batch[0].id}–${batch[batch.length - 1].id}) ━━━`);

        if (hasVoice) {
            for (const scene of batch) await generateSceneVoice(scene);
        }
        await Promise.all(batch.map(generateSceneImage));
        if (useVideoClips) await Promise.all(batch.map(generateSceneVideo));

        if (i + BATCH_SIZE < scenes.length) {
            console.log(`\nWaiting 3s before next batch...`);
            await sleep(3000);
        }
    }

    // ── Summary (based on the files actually on disk) ────────────
    const missing: string[] = [];
    let imagesOk = 0, videosOk = 0, voicesOk = 0;
    for (const scene of scenes) {
        const p = absPaths(scene);
        if (isNonEmptyFile(p.image)) imagesOk++; else missing.push(`scene ${scene.id} image`);
        if (wantsVideo(scene)) {
            if (isNonEmptyFile(p.video)) videosOk++; else missing.push(`scene ${scene.id} video`);
        }
        if (hasVoice) {
            if (isNonEmptyFile(p.voice)) voicesOk++; else missing.push(`scene ${scene.id} voice`);
        }
    }

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Generation Complete`);
    console.log(`║  Images: ${imagesOk}/${scenes.length}`);
    if (useVideoClips) console.log(`║  Videos: ${videosOk}/${scenes.filter(wantsVideo).length}`);
    if (hasVoice) console.log(`║  Voices: ${voicesOk}/${scenes.length}`);
    console.log(`╚══════════════════════════════════════════════╝`);

    if (missing.length > 0) {
        console.error(`\nMissing: ${missing.join(', ')}\nRe-run the script to retry.`);
        process.exitCode = 1;
    }
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
