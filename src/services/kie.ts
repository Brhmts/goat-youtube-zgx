import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { https } from 'follow-redirects';

// Load environment variables
config({ path: path.join(process.cwd(), '.env') });

const API_KEY = process.env.KIE_AI_API_KEY;
const BASE_URL = process.env.KIE_AI_BASE_URL || 'https://api.kie.ai';

if (!API_KEY) {
    console.error("Error: KIE_AI_API_KEY is not set in .env file");
}

// ── Model Constants ──────────────────────────────────────────────
export const MODELS = {
    IMAGE: 'nano-banana-2',           // Gemini 3.1 Flash based, 4K, text rendering
    IMAGE_LEGACY: 'z-image',          // Legacy image model
    VIDEO: 'hailuo/2-3-image-to-video-pro',       // Hailuo 2.3 Pro - image to video
    VIDEO_STANDARD: 'hailuo/2-3-image-to-video-standard', // Hailuo 2.3 Standard
} as const;

interface KieTaskResponse {
    code: number;
    msg: string;
    data?: {
        id: string;
        taskId?: string;
        [key: string]: any;
    };
}

interface KieTaskStatusResponse {
    code: number;
    msg: string;
    data?: {
        state: string; // "success", "running", "fail"
        resultJson?: string; // JSON string containing resultUrls
        failMsg?: string;
        [key: string]: any;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Generic Task Creator ─────────────────────────────────────────
const createTask = async (body: Record<string, any>): Promise<string | null> => {
    if (!API_KEY) return null;

    const data = JSON.stringify(body);

    const urlObj = new URL(`${BASE_URL}/api/v1/jobs/createTask`);
    const options = {
        method: 'POST',
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Length': Buffer.byteLength(data)
        },
        maxRedirects: 5
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => {
                try {
                    const response: KieTaskResponse = JSON.parse(responseBody);
                    const taskId = response.data?.taskId || response.data?.id;
                    if (response.code === 200 && taskId) {
                        resolve(taskId);
                    } else {
                        console.error("Kie.ai Create Task Error:", response);
                        resolve(null);
                    }
                } catch (e) {
                    console.error("Failed to parse response:", responseBody.substring(0, 200));
                    resolve(null);
                }
            });
        });
        req.on('error', (error) => {
            console.error("Kie.ai Request Error:", error);
            resolve(null);
        });
        req.write(data);
        req.end();
    });
};

// ── Create Image Task (nano-banana-2) ────────────────────────────
export const createImageTask = async (opts: ImageGenOptions): Promise<string | null> => {
    const {
        prompt,
        aspectRatio = '16:9',
        resolution = '2K',
        outputFormat = 'jpg',
        model = MODELS.IMAGE
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
        model = MODELS.VIDEO
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

// ── Legacy wrapper (backwards compatible) ────────────────────────
export const createKieTask = async (prompt: string, aspectRatio: string = "16:9"): Promise<string | null> => {
    return createImageTask({ prompt, aspectRatio });
};

export const getKieTaskStatus = async (taskId: string): Promise<KieTaskStatusResponse | null> => {
    if (!API_KEY) return null;

    const urlObj = new URL(`${BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`);
    const options = {
        method: 'GET',
        hostname: urlObj.hostname,
        path: `${urlObj.pathname}?taskId=${taskId}`,
        headers: {
            'Authorization': `Bearer ${API_KEY}`
        },
        maxRedirects: 5
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                try {
                    const response: KieTaskStatusResponse = JSON.parse(responseBody);
                    resolve(response);
                } catch (e) {
                    console.error("Failed to parse status response", e);
                    resolve(null);
                }
            });
        });

        req.on('error', (error) => {
            console.error("Kie.ai Status Request Error:", error);
            resolve(null);
        });

        req.end();
    });
};

// ── Poll & Download (generic for both image and video) ───────────
const pollAndDownload = async (
    taskId: string,
    outputPath: string,
    label: string,
    maxAttempts: number = 120,
    pollInterval: number = 3000
): Promise<boolean> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
        const statusRes = await getKieTaskStatus(taskId);

        if (statusRes && statusRes.code === 200 && statusRes.data) {
            const state = statusRes.data.state;

            if (state === 'success') {
                console.log(`[${label}] Generated successfully!`);
                if (statusRes.data.resultJson) {
                    try {
                        const resultData = JSON.parse(statusRes.data.resultJson);
                        if (resultData.resultUrls && resultData.resultUrls.length > 0) {
                            await downloadFile(resultData.resultUrls[0], outputPath);
                            return true;
                        }
                    } catch (e) {
                        console.error(`[${label}] Failed to parse resultJson`, e);
                    }
                }
                return false;
            } else if (state === 'fail' || state === 'failed') {
                console.error(`[${label}] Failed:`, statusRes.msg || statusRes.data.failMsg);
                return false;
            } else {
                console.log(`[${label}] [${attempts + 1}/${maxAttempts}] State: ${state}...`);
            }
        } else {
            console.warn(`[${label}] [${attempts + 1}/${maxAttempts}] Status check failed`);
        }

        await sleep(pollInterval);
        attempts++;
    }

    console.error(`[${label}] Timed out after ${maxAttempts} attempts.`);
    return false;
};

// ── Generate Image (full flow: create + poll + download) ─────────
export const generateImage = async (prompt: string, outputPath: string, aspectRatio: string = "16:9"): Promise<boolean> => {
    console.log(`[IMAGE] Starting: "${prompt.substring(0, 60)}..."`);

    const taskId = await createImageTask({ prompt, aspectRatio });
    if (!taskId) {
        console.error("[IMAGE] Failed to create task.");
        return false;
    }

    console.log(`[IMAGE] Task ${taskId} created. Polling...`);
    return pollAndDownload(taskId, outputPath, 'IMAGE', 120, 3000);
};

// ── Generate Video (full flow: create + poll + download) ─────────
export const generateVideo = async (
    prompt: string,
    imageUrl: string,
    outputPath: string,
    opts?: Partial<Pick<VideoGenOptions, 'duration' | 'resolution' | 'model'>>
): Promise<boolean> => {
    console.log(`[VIDEO] Starting: "${prompt.substring(0, 60)}..."`);

    const taskId = await createVideoTask({
        prompt,
        imageUrl,
        duration: opts?.duration || '6',
        resolution: opts?.resolution || '1080P',
        model: opts?.model || MODELS.VIDEO,
    });
    if (!taskId) {
        console.error("[VIDEO] Failed to create task.");
        return false;
    }

    // Video generation takes longer — poll every 5s, max 180 attempts (15 min)
    console.log(`[VIDEO] Task ${taskId} created. Polling (video takes longer)...`);
    return pollAndDownload(taskId, outputPath, 'VIDEO', 180, 5000);
};

const downloadFile = async (url: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            maxRedirects: 5
        };

        const file = fs.createWriteStream(outputPath);

        const req = https.request(options, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`File saved to ${outputPath}`);
                resolve();
            });
        });

        req.on('error', (err) => {
            fs.unlink(outputPath, () => { });
            reject(err);
        });

        req.end();
    });
};

// ── Recovery (works for both image and video tasks) ──────────────
const recoverTask = async (taskId: string, outputPath: string, label: string, maxAttempts: number = 60, pollInterval: number = 3000): Promise<boolean> => {
    console.log(`[${label} RECOVERY] Recovering task ${taskId}...`);

    const statusRes = await getKieTaskStatus(taskId);

    if (statusRes && statusRes.code === 200 && statusRes.data) {
        const state = statusRes.data.state;

        if (state === 'success' && statusRes.data.resultJson) {
            try {
                const resultData = JSON.parse(statusRes.data.resultJson);
                if (resultData.resultUrls && resultData.resultUrls.length > 0) {
                    console.log(`[${label} RECOVERY] Found successful result. Downloading...`);
                    await downloadFile(resultData.resultUrls[0], outputPath);
                    return true;
                }
            } catch (e) {
                console.error(`[${label} RECOVERY] Failed to parse resultJson`, e);
            }
        } else if (state === 'running' || state === 'queue' || state === 'waiting') {
            console.log(`[${label} RECOVERY] Task still in progress (${state}). Polling...`);
            return pollAndDownload(taskId, outputPath, `${label} RECOVERY`, maxAttempts, pollInterval);
        }
    }

    console.log(`[${label} RECOVERY] Could not recover (State: ${statusRes?.data?.state})`);
    return false;
};

export const recoverImageTask = async (taskId: string, outputPath: string): Promise<boolean> => {
    return recoverTask(taskId, outputPath, 'IMAGE', 60, 3000);
};

export const recoverVideoTask = async (taskId: string, outputPath: string): Promise<boolean> => {
    return recoverTask(taskId, outputPath, 'VIDEO', 120, 5000);
};
