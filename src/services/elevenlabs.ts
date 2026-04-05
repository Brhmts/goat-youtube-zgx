import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { https } from 'follow-redirects';

config({ path: path.join(process.cwd(), '.env') });

// Use Kie.ai as proxy for ElevenLabs TTS
const KIE_API_KEY = process.env.KIE_AI_API_KEY;
const KIE_BASE_URL = process.env.KIE_AI_BASE_URL || 'https://api.kie.ai';

// Fallback: direct ElevenLabs if separate key exists
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Kie.ai uses voice names (e.g. "Aria", "Daniel") not ElevenLabs voice IDs
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_NAME || 'Daniel';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Kie.ai proxy TTS ────────────────────────────────────────────
const generateVoiceViaKie = async (text: string, outputPath: string, voiceId: string): Promise<boolean> => {
    if (!KIE_API_KEY) return false;

    console.log(`[TTS/Kie] Creating task for ${text.length} chars...`);

    const body = JSON.stringify({
        model: 'elevenlabs/text-to-speech-multilingual-v2',
        input: {
            text,
            voice: voiceId,
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
        },
    });

    const urlObj = new URL(`${KIE_BASE_URL}/api/v1/jobs/createTask`);
    const options = {
        method: 'POST',
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Length': Buffer.byteLength(body),
        },
        maxRedirects: 5,
    };

    // Create task
    const taskId = await new Promise<string | null>((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const resp = JSON.parse(data);
                    const id = resp.data?.taskId || resp.data?.id;
                    if (resp.code === 200 && id) {
                        resolve(id);
                    } else {
                        console.error('[TTS/Kie] Create task error:', resp);
                        resolve(null);
                    }
                } catch (e) {
                    console.error('[TTS/Kie] Parse error:', data.substring(0, 200));
                    resolve(null);
                }
            });
        });
        req.on('error', (err) => { console.error('[TTS/Kie] Request error:', err); resolve(null); });
        req.write(body);
        req.end();
    });

    if (!taskId) return false;
    console.log(`[TTS/Kie] Task ${taskId} created. Polling...`);

    // Poll for result
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
        const statusUrl = new URL(`${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${taskId}`);
        const statusRes = await new Promise<any>((resolve) => {
            const req = https.request({
                method: 'GET',
                hostname: statusUrl.hostname,
                path: `${statusUrl.pathname}?taskId=${taskId}`,
                headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
                maxRedirects: 5,
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.end();
        });

        if (statusRes?.code === 200 && statusRes.data) {
            const state = statusRes.data.state;

            if (state === 'success' && statusRes.data.resultJson) {
                const result = JSON.parse(statusRes.data.resultJson);
                const audioUrl = result.resultUrls?.[0];
                if (audioUrl) {
                    await downloadFile(audioUrl, outputPath);
                    console.log(`[TTS/Kie] Audio saved to ${outputPath}`);
                    return true;
                }
            } else if (state === 'fail' || state === 'failed') {
                console.error('[TTS/Kie] Failed:', statusRes.data.failMsg);
                return false;
            } else {
                console.log(`[TTS/Kie] [${attempts + 1}/${maxAttempts}] State: ${state}...`);
            }
        }

        await sleep(2000);
        attempts++;
    }

    console.error('[TTS/Kie] Timed out.');
    return false;
};

// ── Direct ElevenLabs TTS (fallback) ────────────────────────────
const generateVoiceDirect = async (text: string, outputPath: string, voiceId: string): Promise<boolean> => {
    if (!ELEVENLABS_API_KEY) return false;

    console.log(`[TTS/Direct] Generating for ${text.length} chars...`);

    const data = JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    });

    const urlObj = new URL(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`);
    const options = {
        method: 'POST',
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Length': Buffer.byteLength(data),
        },
        maxRedirects: 5,
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                let errorBody = '';
                res.on('data', (chunk) => { errorBody += chunk; });
                res.on('end', () => { console.error(`[TTS/Direct] Error ${res.statusCode}:`, errorBody); resolve(false); });
                return;
            }
            const file = fs.createWriteStream(outputPath);
            res.pipe(file);
            file.on('finish', () => { file.close(); console.log(`[TTS/Direct] Audio saved to ${outputPath}`); resolve(true); });
        });
        req.on('error', (err) => { console.error('[TTS/Direct] Error:', err); resolve(false); });
        req.write(data);
        req.end();
    });
};

// ── Download helper ─────────────────────────────────────────────
const downloadFile = async (url: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            maxRedirects: 5,
        }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(outputPath);
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        });
        req.on('error', (err) => { fs.unlink(outputPath, () => {}); reject(err); });
        req.end();
    });
};

// ── Public API ──────────────────────────────────────────────────
export const generateVoice = async (text: string, outputPath: string, voiceId: string = DEFAULT_VOICE): Promise<boolean> => {
    // Try Kie.ai proxy first (uses KIE_AI_API_KEY)
    if (KIE_API_KEY) {
        return generateVoiceViaKie(text, outputPath, voiceId);
    }

    // Fallback to direct ElevenLabs
    if (ELEVENLABS_API_KEY) {
        return generateVoiceDirect(text, outputPath, voiceId);
    }

    console.error('[TTS] No API key available. Set KIE_AI_API_KEY or ELEVENLABS_API_KEY in .env');
    return false;
};
