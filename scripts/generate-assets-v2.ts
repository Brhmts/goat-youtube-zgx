/**
 * Asset Generation Pipeline v2
 *
 * Supports the full image-to-video pipeline:
 * 1. TTS voice generation (ElevenLabs)
 * 2. Image generation (nano-banana-2 via Kie.ai)
 * 3. Image-to-Video generation (Hailuo 2.3 Pro via Kie.ai)
 *
 * Flow: Scene Data → Image → Video Clip → Voice → Ready for Remotion
 */

import {
    createImageTask,
    createVideoTask,
    recoverImageTask,
    recoverVideoTask,
    getKieTaskStatus,
    MODELS
} from '../src/services/kie';
import { generateVoice } from '../src/services/elevenlabs';
import { currentVideo } from '../src/data/current-video';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env') });

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');
const STATE_FILE = path.join(ASSETS_DIR, 'generation-state-v2.json');

if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// ── State Management ─────────────────────────────────────────────
interface TaskState {
    imageTaskId?: string;
    videoTaskId?: string;
    imageUrl?: string; // Kie.ai result URL (needed for image-to-video input)
    imageReady?: boolean;
    videoReady?: boolean;
    voiceReady?: boolean;
}

interface GenerationState {
    [sceneKey: string]: TaskState;
}

const loadState = (): GenerationState => {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    return {};
};

const saveState = (state: GenerationState) => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Main Pipeline ────────────────────────────────────────────────
const main = async () => {
    const { projectId, scenes, useVideoClips, costMode = 'budget', style } = currentVideo;
    const state = loadState();

    // Cost mode determines resolution & model
    const IMAGE_RESOLUTION = costMode === 'premium' ? '2K' : costMode === 'standard' ? '2K' : '1K';
    const VIDEO_MODEL = costMode === 'premium' ? MODELS.VIDEO : MODELS.VIDEO_STANDARD;
    const VIDEO_RESOLUTION = costMode === 'premium' ? '1080P' : '768P';

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Asset Generation v2 — ${projectId}`);
    console.log(`║  Scenes: ${scenes.length} | Video Clips: ${useVideoClips ? 'YES' : 'NO'}`);
    console.log(`║  Cost Mode: ${costMode.toUpperCase()}`);
    console.log(`║  Image: ${MODELS.IMAGE} @ ${IMAGE_RESOLUTION}`);
    if (useVideoClips) console.log(`║  Video: ${VIDEO_MODEL} @ ${VIDEO_RESOLUTION}`);
    if (style) console.log(`║  Style: ${style.suffix.substring(0, 40)}...`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    const BATCH_SIZE = 3; // Smaller batches for video pipeline (more API-intensive)

    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        console.log(`\n━━━ Batch ${Math.floor(i / BATCH_SIZE) + 1} (Scenes ${batch[0].id}–${batch[batch.length - 1].id}) ━━━`);

        // ── PHASE 1: Voice Generation ─────────────────────────────
        const hasTTSKey = !!(process.env.KIE_AI_API_KEY || process.env.ELEVENLABS_API_KEY);
        if (hasTTSKey) {
            for (const scene of batch) {
                const key = `${projectId}-scene-${scene.id}`;
                const audioPath = path.join(ASSETS_DIR, `${key}-voice.mp3`);

                if (fs.existsSync(audioPath)) {
                    state[key] = { ...state[key], voiceReady: true };
                    continue;
                }

                if (scene.voiceText && scene.voiceText.length > 5) {
                    console.log(`[TTS] Scene ${scene.id}: generating voice...`);
                    await generateVoice(scene.voiceText, audioPath);
                    state[key] = { ...state[key], voiceReady: true };
                    saveState(state);
                }
            }
        } else {
            console.log(`[TTS] Skipped (no ELEVENLABS_API_KEY)`);
        }

        // ── PHASE 2: Image Generation (nano-banana-2) ────────────
        const imagePromises = batch.map(async (scene) => {
            const key = `${projectId}-scene-${scene.id}`;
            const imagePath = path.join(ASSETS_DIR, `${key}-image.jpg`);

            if (!state[key]) state[key] = {};

            if (fs.existsSync(imagePath)) {
                state[key].imageReady = true;
                console.log(`[IMAGE] Scene ${scene.id}: exists, skipping`);
                return;
            }

            // Resume existing task
            if (state[key].imageTaskId) {
                console.log(`[IMAGE] Scene ${scene.id}: resuming task ${state[key].imageTaskId}`);
                const success = await recoverImageTask(state[key].imageTaskId!, imagePath);
                if (success) {
                    state[key].imageReady = true;
                    // Get the result URL for video generation
                    const status = await getKieTaskStatus(state[key].imageTaskId!);
                    if (status?.data?.resultJson) {
                        const result = JSON.parse(status.data.resultJson);
                        state[key].imageUrl = result.resultUrls?.[0];
                    }
                    saveState(state);
                }
                return;
            }

            if (!scene.imagePrompt) return;

            // Apply style suffix for consistency
            const finalPrompt = style
                ? `${scene.imagePrompt}, ${style.suffix}`
                : scene.imagePrompt;

            console.log(`[IMAGE] Scene ${scene.id}: creating task...`);
            const taskId = await createImageTask({
                prompt: finalPrompt,
                aspectRatio: '16:9',
                resolution: IMAGE_RESOLUTION as '1K' | '2K' | '4K',
            });

            if (taskId) {
                state[key].imageTaskId = taskId;
                saveState(state);
                console.log(`[IMAGE] Scene ${scene.id}: task ${taskId} created`);
            }
        });

        await Promise.all(imagePromises);

        // ── PHASE 2b: Poll images & collect URLs ─────────────────
        console.log(`\n[IMAGE] Polling batch results...`);
        for (const scene of batch) {
            const key = `${projectId}-scene-${scene.id}`;
            const imagePath = path.join(ASSETS_DIR, `${key}-image.jpg`);

            if (state[key]?.imageReady || fs.existsSync(imagePath)) continue;

            const taskId = state[key]?.imageTaskId;
            if (!taskId) continue;

            const success = await recoverImageTask(taskId, imagePath);
            if (success) {
                state[key].imageReady = true;
                // Grab the result URL for image-to-video
                const status = await getKieTaskStatus(taskId);
                if (status?.data?.resultJson) {
                    const result = JSON.parse(status.data.resultJson);
                    state[key].imageUrl = result.resultUrls?.[0];
                }
                saveState(state);
            }
        }

        // ── PHASE 3: Image-to-Video (Hailuo 2.3 Pro) ────────────
        if (useVideoClips) {
            const videoPromises = batch.map(async (scene) => {
                if (!scene.videoPrompt || scene.useVideo === false) return;

                const key = `${projectId}-scene-${scene.id}`;
                const videoPath = path.join(ASSETS_DIR, `${key}-video.mp4`);

                if (fs.existsSync(videoPath)) {
                    state[key] = { ...state[key], videoReady: true };
                    console.log(`[VIDEO] Scene ${scene.id}: exists, skipping`);
                    return;
                }

                // Resume existing task
                if (state[key]?.videoTaskId) {
                    console.log(`[VIDEO] Scene ${scene.id}: resuming task ${state[key].videoTaskId}`);
                    const success = await recoverVideoTask(state[key].videoTaskId!, videoPath);
                    if (success) {
                        state[key].videoReady = true;
                        saveState(state);
                    }
                    return;
                }

                // Need image URL first
                const imageUrl = state[key]?.imageUrl;
                if (!imageUrl) {
                    console.warn(`[VIDEO] Scene ${scene.id}: no image URL available, skipping video`);
                    return;
                }

                console.log(`[VIDEO] Scene ${scene.id}: creating image-to-video task...`);
                const taskId = await createVideoTask({
                    prompt: scene.videoPrompt,
                    imageUrl: imageUrl,
                    duration: '6',
                    resolution: VIDEO_RESOLUTION,
                    promptOptimizer: true,
                    model: VIDEO_MODEL,
                });

                if (taskId) {
                    state[key].videoTaskId = taskId;
                    saveState(state);
                    console.log(`[VIDEO] Scene ${scene.id}: task ${taskId} created`);
                }
            });

            await Promise.all(videoPromises);

            // ── PHASE 3b: Poll video results ─────────────────────
            console.log(`\n[VIDEO] Polling batch results (this may take a while)...`);
            for (const scene of batch) {
                if (!scene.videoPrompt) continue;

                const key = `${projectId}-scene-${scene.id}`;
                const videoPath = path.join(ASSETS_DIR, `${key}-video.mp4`);

                if (state[key]?.videoReady || fs.existsSync(videoPath)) continue;

                const taskId = state[key]?.videoTaskId;
                if (!taskId) continue;

                const success = await recoverVideoTask(taskId, videoPath);
                if (success) {
                    state[key].videoReady = true;
                    saveState(state);
                }
            }
        }

        // Batch delay
        if (i + BATCH_SIZE < scenes.length) {
            console.log(`\nWaiting 3s before next batch...`);
            await sleep(3000);
        }
    }

    // ── Summary ──────────────────────────────────────────────────
    const reloadedState = loadState();
    let imagesOk = 0, videosOk = 0, voicesOk = 0;
    for (const scene of scenes) {
        const key = `${projectId}-scene-${scene.id}`;
        const s = reloadedState[key];
        if (s?.imageReady || fs.existsSync(path.join(ASSETS_DIR, `${key}-image.jpg`))) imagesOk++;
        if (s?.videoReady || fs.existsSync(path.join(ASSETS_DIR, `${key}-video.mp4`))) videosOk++;
        if (s?.voiceReady || fs.existsSync(path.join(ASSETS_DIR, `${key}-voice.mp3`))) voicesOk++;
    }

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Generation Complete`);
    console.log(`║  Images: ${imagesOk}/${scenes.length}`);
    if (useVideoClips) {
        const videoScenes = scenes.filter(s => s.videoPrompt && s.useVideo !== false).length;
        console.log(`║  Videos: ${videosOk}/${videoScenes}`);
    }
    console.log(`║  Voices: ${voicesOk}/${scenes.length}`);
    console.log(`╚══════════════════════════════════════════════╝`);
};

main().catch(console.error);
