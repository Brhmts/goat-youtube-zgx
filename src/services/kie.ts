import { downloadFile, sleep } from './http';

// Env is read lazily so that scripts can load .env (import 'dotenv/config') first.
const apiKey = () => process.env.KIE_AI_API_KEY;
const baseUrl = () => process.env.KIE_AI_BASE_URL || 'https://api.kie.ai';

// ── Model Constants ──────────────────────────────────────────────
export const MODELS = {
    IMAGE: 'nano-banana-2',           // Gemini 3.1 Flash based, 4K, text rendering
    VIDEO: 'hailuo/2-3-image-to-video-pro',       // Hailuo 2.3 Pro - image to video
    VIDEO_STANDARD: 'hailuo/2-3-image-to-video-standard', // Hailuo 2.3 Standard
    TTS: 'elevenlabs/text-to-speech-multilingual-v2',
} as const;

interface KieTaskResponse {
    code: number;
    msg: string;
    data?: {
        id?: string;
        taskId?: string;
    };
}

interface KieTaskStatusResponse {
    code: number;
    msg: string;
    data?: {
        state: string; // "success", "running", "queue", "waiting", "fail"
        resultJson?: string; // JSON string containing resultUrls
        failMsg?: string;
    };
}

// ── Image Generation Options ─────────────────────────────────────
export interface ImageGenOptions {
    prompt: string;
    aspectRatio?: string;    // 1:1 | 9:16 | 16:9 | 3:2 | 4:3 | 21:9 etc.
    resolution?: '1K' | '2K' | '4K';
    outputFormat?: 'jpg' | 'png';
    model?: string;
}

// ── Video Generation Options ─────────────────────────────────────
export interface VideoGenOptions {
    prompt: string;
    imageUrl: string;        // Source image URL (JPEG/PNG/WEBP, max 10MB)
    duration?: '6' | '10';   // 6 or 10 seconds
    resolution?: '768P' | '1080P';
    promptOptimizer?: boolean;
    model?: string;
}

const authHeaders = () => ({ Authorization: `Bearer ${apiKey()}` });

// ── Generic Task Creator ─────────────────────────────────────────
export const createTask = async (body: Record<string, unknown>): Promise<string | null> => {
    if (!apiKey()) {
        console.error('[Kie] KIE_AI_API_KEY is not set in .env');
        return null;
    }

    try {
        const res = await fetch(`${baseUrl()}/api/v1/jobs/createTask`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let response: KieTaskResponse;
        try {
            response = JSON.parse(text);
        } catch {
            console.error(`[Kie] Create task: unparseable response (HTTP ${res.status}):`, text.substring(0, 200));
            return null;
        }
        const taskId = response.data?.taskId || response.data?.id;
        if (response.code === 200 && taskId) return taskId;
        console.error('[Kie] Create task error:', response);
        return null;
    } catch (err) {
        console.error('[Kie] Create task request error:', err);
        return null;
    }
};

export const getKieTaskStatus = async (taskId: string): Promise<KieTaskStatusResponse | null> => {
    if (!apiKey()) return null;
    try {
        const url = `${baseUrl()}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
        const res = await fetch(url, { headers: authHeaders() });
        return (await res.json()) as KieTaskStatusResponse;
    } catch (err) {
        console.error('[Kie] Status request error:', err);
        return null;
    }
};

// ── Create Image Task (nano-banana-2) ────────────────────────────
export const createImageTask = async (opts: ImageGenOptions): Promise<string | null> => {
    const {
        prompt,
        aspectRatio = '16:9',
        resolution = '2K',
        outputFormat = 'jpg',
        model = MODELS.IMAGE,
    } = opts;

    console.log(`[IMAGE] Creating task with ${model} | ${resolution} | ${aspectRatio}`);

    return createTask({
        model,
        input: {
            prompt,
            aspect_ratio: aspectRatio,
            resolution,
            output_format: outputFormat,
        },
    });
};

// ── Create Video Task (hailuo 2.3) ──────────────────────────────
export const createVideoTask = async (opts: VideoGenOptions): Promise<string | null> => {
    const {
        prompt,
        imageUrl,
        duration = '6',
        resolution = '1080P',
        promptOptimizer = true,
        model = MODELS.VIDEO,
    } = opts;

    console.log(`[VIDEO] Creating task with ${model} | ${duration}s | ${resolution}`);

    return createTask({
        model,
        input: {
            prompt,
            image_url: imageUrl,
            duration,
            resolution,
            prompt_optimizer: promptOptimizer,
        },
    });
};

const PENDING_STATES = new Set(['running', 'queue', 'queuing', 'waiting', 'generating', 'pending']);

/**
 * Polls a task until it finishes, then downloads its first result to outputPath.
 * Works for image, video and TTS tasks, and also to resume a task from an earlier run.
 * Returns the remote result URL on success (needed as image-to-video input), otherwise null.
 */
export const completeTask = async (
    taskId: string,
    outputPath: string,
    label: string,
    { maxAttempts = 120, pollIntervalMs = 3000 }: { maxAttempts?: number; pollIntervalMs?: number } = {},
): Promise<string | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const statusRes = await getKieTaskStatus(taskId);

        if (statusRes?.code === 200 && statusRes.data) {
            const { state, resultJson, failMsg } = statusRes.data;

            if (state === 'success') {
                let resultUrl: string | undefined;
                try {
                    resultUrl = resultJson ? JSON.parse(resultJson).resultUrls?.[0] : undefined;
                } catch (err) {
                    console.error(`[${label}] Failed to parse resultJson`, err);
                }
                if (!resultUrl) {
                    console.error(`[${label}] Task ${taskId} succeeded but returned no result URL.`);
                    return null;
                }
                try {
                    await downloadFile(resultUrl, outputPath);
                    console.log(`[${label}] Saved ${outputPath}`);
                    return resultUrl;
                } catch (err) {
                    console.error(`[${label}] Download failed:`, err);
                    return null;
                }
            }

            if (state === 'fail' || state === 'failed') {
                console.error(`[${label}] Task ${taskId} failed:`, failMsg || statusRes.msg);
                return null;
            }

            if (!PENDING_STATES.has(state)) {
                console.warn(`[${label}] Unknown state "${state}", still waiting...`);
            } else {
                console.log(`[${label}] [${attempt}/${maxAttempts}] State: ${state}...`);
            }
        } else {
            console.warn(`[${label}] [${attempt}/${maxAttempts}] Status check failed`);
        }

        await sleep(pollIntervalMs);
    }

    console.error(`[${label}] Task ${taskId} timed out after ${maxAttempts} attempts.`);
    return null;
};

export const completeImageTask = (taskId: string, outputPath: string) =>
    completeTask(taskId, outputPath, 'IMAGE', { maxAttempts: 120, pollIntervalMs: 3000 });

// Video generation takes longer — poll every 5s, max 15 min
export const completeVideoTask = (taskId: string, outputPath: string) =>
    completeTask(taskId, outputPath, 'VIDEO', { maxAttempts: 180, pollIntervalMs: 5000 });
