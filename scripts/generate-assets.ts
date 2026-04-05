import { createKieTask, recoverImageTask } from '../src/services/kie';
import { generateVoice } from '../src/services/elevenlabs';
import { currentVideo } from '../src/data/current-video';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(process.cwd(), '.env') });

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');
const STATE_FILE = path.join(process.cwd(), 'public', 'assets', 'generation-state.json');

if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// State Management
interface GenerationState {
    [key: string]: string; // sceneId -> taskId
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

const main = async () => {
    const { projectId, scenes } = currentVideo;
    console.log(`Starting Smart Asset Generation for: ${projectId}`);

    // Load existing state
    const state = loadState();

    // Process in batches
    const BATCH_SIZE = 5;

    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        console.log(`\n=== Processing Batch ${Math.floor(i / BATCH_SIZE) + 1} (Scenes ${batch[0].id}-${batch[batch.length - 1].id}) ===`);

        // PHASE 1: Voice Generation (Sequential is fine for TTS usually, or parallel)
        // We'll keep TTS simple/sequential for now as it's usually fast/sync-ish
        for (const scene of batch) {
            const audioFilename = `${projectId}-scene-${scene.id}-voice.mp3`;
            const audioPath = path.join(ASSETS_DIR, audioFilename);

            if (!fs.existsSync(audioPath) && scene.voiceText && scene.voiceText.length > 5) {
                console.log(`[TTS] Generating voice for Scene ${scene.id}...`);
                await generateVoice(scene.voiceText, audioPath);
            }
        }

        // PHASE 2: Image Task Creation (Parallel)
        const creationPromises = batch.map(async (scene) => {
            const imageFilename = `${projectId}-scene-${scene.id}-image.jpg`;
            const imagePath = path.join(ASSETS_DIR, imageFilename);
            const stateKey = `${projectId}-scene-${scene.id}`;

            // Check if file exists
            if (fs.existsSync(imagePath)) {
                console.log(`[SKIP] Image exists for Scene ${scene.id}`);
                return;
            }

            // Check if we already have a task ID
            if (state[stateKey]) {
                console.log(`[RESUME] Found existing task for Scene ${scene.id}: ${state[stateKey]}`);
                return;
            }

            if (!scene.imagePrompt) return;

            // Create new task
            console.log(`[NEW] Creating task for Scene ${scene.id}...`);
            const taskId = await createKieTask(scene.imagePrompt);
            if (taskId) {
                state[stateKey] = taskId;
                saveState(state); // Save immediately
                console.log(`[SAVED] Task ID ${taskId} saved for Scene ${scene.id}`);
            }
        });

        await Promise.all(creationPromises);

        // PHASE 3: Wait & Download (Parallel Recovery)
        console.log(`\n[BATCH] Waiting for batch completion & downloading...`);

        const downloadPromises = batch.map(async (scene) => {
            const imageFilename = `${projectId}-scene-${scene.id}-image.jpg`;
            const imagePath = path.join(ASSETS_DIR, imageFilename);
            const stateKey = `${projectId}-scene-${scene.id}`;

            if (fs.existsSync(imagePath)) return; // Already done

            const taskId = state[stateKey];
            if (!taskId) {
                console.log(`[WARN] No task ID for Scene ${scene.id} (Maybe prompt missing?)`);
                return;
            }

            // Improve reliability by trying to recover/download
            const success = await recoverImageTask(taskId, imagePath);
            if (!success) {
                console.error(`[FAIL] Could not retrieve image for Scene ${scene.id} (Task: ${taskId})`);
                // Optional: Delete from state to retry next time? 
                // delete state[stateKey]; saveState(state);
                // Better to keep it and let user manually inspect or handle 'failed' state in kie.ts
            }
        });

        await Promise.all(downloadPromises);

        // Optional delay between batches to be nice to API
        if (i + BATCH_SIZE < scenes.length) {
            console.log("Waiting 5s before next batch...");
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    console.log("\nAsset generation process completed.");
};

main();
