import { completeTask, createTask, MODELS } from './kie';
import { writeResponseToFile } from './http';
import type { Voice } from '../series/schema';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Kie.ai takes ElevenLabs voice *names* ("Daniel", "Aria"...),
// the direct ElevenLabs API takes voice *IDs*. Both come from series.json (per character).
const DEFAULT_KIE_VOICE = 'Daniel';
const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9'; // "Daniel"

const settingsFor = (voice?: Voice) => ({ stability: voice?.stability ?? 0.5, similarity_boost: 0.75 });

// ── Kie.ai proxy TTS ────────────────────────────────────────────
const generateVoiceViaKie = async (text: string, outputPath: string, voice?: Voice): Promise<boolean> => {
    const name = voice?.kie ?? DEFAULT_KIE_VOICE;
    console.log(`[TTS/Kie] ${name}: ${text.length} chars...`);

    const taskId = await createTask({
        model: MODELS.TTS,
        input: { text, voice: name, ...settingsFor(voice), speed: voice?.speed ?? 1.0 },
    });
    if (!taskId) return false;

    console.log(`[TTS/Kie] Task ${taskId} created. Polling...`);
    const url = await completeTask(taskId, outputPath, 'TTS/Kie', { maxAttempts: 60, pollIntervalMs: 2000 });
    return url !== null;
};

// ── Direct ElevenLabs TTS ───────────────────────────────────────
const generateVoiceDirect = async (text: string, outputPath: string, voice?: Voice): Promise<boolean> => {
    if (voice?.kie && !voice.elevenLabsId) {
        console.warn(`[TTS/Direct] "${voice.kie}" için elevenLabsId yok; doğrudan API varsayılan sesi kullanacak.`);
    }
    console.log(`[TTS/Direct] Generating for ${text.length} chars...`);

    try {
        const res = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voice?.elevenLabsId ?? DEFAULT_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { ...settingsFor(voice), speed: voice?.speed ?? 1.0 },
            }),
        });
        if (!res.ok) {
            console.error(`[TTS/Direct] Error ${res.status}:`, (await res.text()).substring(0, 300));
            return false;
        }
        await writeResponseToFile(res, outputPath);
        console.log(`[TTS/Direct] Audio saved to ${outputPath}`);
        return true;
    } catch (err) {
        console.error('[TTS/Direct] Error:', err);
        return false;
    }
};

// ── Public API ──────────────────────────────────────────────────
/** Generates narration. Tries Kie.ai first, then direct ElevenLabs if that key is set. */
export const generateVoice = async (text: string, outputPath: string, voice?: Voice): Promise<boolean> => {
    const hasKie = Boolean(process.env.KIE_AI_API_KEY);
    const hasDirect = Boolean(process.env.ELEVENLABS_API_KEY);

    if (!hasKie && !hasDirect) {
        console.error('[TTS] No API key available. Set KIE_AI_API_KEY or ELEVENLABS_API_KEY in .env');
        return false;
    }

    if (hasKie && (await generateVoiceViaKie(text, outputPath, voice))) return true;

    if (hasDirect) {
        if (hasKie) console.warn('[TTS] Kie.ai failed, falling back to direct ElevenLabs...');
        return generateVoiceDirect(text, outputPath, voice);
    }

    return false;
};
