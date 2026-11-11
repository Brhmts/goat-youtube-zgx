import { ALL_FORMATS, Input, UrlSource } from 'mediabunny';
import { staticFile, type CalculateMetadataFunction } from 'remotion';
import {
    AUDIO_TAIL_SEC,
    DEFAULT_EPISODE,
    DEFAULT_LINE_PAUSE_SEC,
    ESTIMATED_CHARS_PER_SEC,
    FPS,
    LINE_LEAD_IN_SEC,
} from './config';
import { resolveSpeaker } from './series/codex';
import { parseSeriesAndEpisode } from './series/load';
import { formatEpisodeRef, lineVoicePath, parseEpisodeRef, sceneImagePath, sceneVideoPath } from './series/paths';
import type { ResolvedLine, ResolvedScene, VideoProps } from './types/props';

/** Duration of a media file in seconds, or null if it is missing or unreadable. */
const probeDuration = async (src: string): Promise<number | null> => {
    const input = new Input({
        formats: ALL_FORMATS,
        source: new UrlSource(src, { getRetryDelay: () => null }),
    });
    try {
        const seconds = await input.computeDuration();
        return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    } catch {
        return null;
    } finally {
        input.dispose();
    }
};

/** True if the static file exists and really is an image (not the dev server's HTML fallback). */
const imageExists = async (src: string, signal: AbortSignal): Promise<boolean> => {
    try {
        const res = await fetch(src, { method: 'HEAD', signal });
        return (
            res.ok &&
            (res.headers.get('content-type') ?? '').startsWith('image/') &&
            res.headers.get('content-length') !== '0'
        );
    } catch {
        return false;
    }
};

const sec = (s: number) => Math.round(s * FPS);

/**
 * Loads the episode, checks which generated assets exist and times the dialogue:
 *  - lines play one after another, each with its own recording,
 *  - a scene is as long as its dialogue (at least minDuration),
 *  - lines without a recording yet are timed from their length (preview without TTS),
 *  - a failed video clip falls back to the still image, a missing image to a placeholder.
 */
export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> = async ({ props, abortSignal }) => {
    const ref = parseEpisodeRef(props.episode || DEFAULT_EPISODE);
    const { series, episode } = await parseSeriesAndEpisode(ref, async (publicPath) => {
        const res = await fetch(staticFile(publicPath), { signal: abortSignal });
        if (!res.ok) throw new Error(`${publicPath} bulunamadı (HTTP ${res.status}).`);
        return res.text();
    });

    const resolvedScenes: ResolvedScene[] = await Promise.all(
        episode.scenes.map(async (scene) => {
            const imagePath = sceneImagePath(ref, scene.id);
            const videoPath = sceneVideoPath(ref, scene.id);
            const wantsVideo = Boolean(series.generation.videoClips && scene.videoPrompt && scene.useVideo !== false);

            const [hasImage, videoDurationSec, lineDurations] = await Promise.all([
                imageExists(staticFile(imagePath), abortSignal),
                wantsVideo ? probeDuration(staticFile(videoPath)) : Promise.resolve(null),
                Promise.all(
                    scene.lines.map((line, i) => {
                        const voice = resolveSpeaker(series, line.speaker)?.voice;
                        const audioPath = lineVoicePath(ref, scene.id, i, line.text, voice);
                        return probeDuration(staticFile(audioPath)).then((d) => ({ audioPath, d }));
                    }),
                ),
            ]);

            let cursor = sec(LINE_LEAD_IN_SEC);
            const lines: ResolvedLine[] = scene.lines.map((line, i) => {
                const speaker = resolveSpeaker(series, line.speaker);
                const { audioPath, d } = lineDurations[i];
                const spoken = d ?? Math.max(1.2, line.text.length / ESTIMATED_CHARS_PER_SEC);
                const resolved: ResolvedLine = {
                    speakerName: speaker && !speaker.isNarrator ? speaker.name : null,
                    color: speaker?.color ?? null,
                    text: line.subtitle ?? line.text,
                    audioSrc: d === null ? null : audioPath,
                    from: cursor,
                    durationInFrames: Math.max(1, sec(spoken)),
                };
                cursor += resolved.durationInFrames + (i < scene.lines.length - 1 ? sec(line.pauseAfter ?? DEFAULT_LINE_PAUSE_SEC) : 0);
                return resolved;
            });

            const missingVoices = lines.filter((l) => !l.audioSrc).length;
            if (missingVoices > 0) console.warn(`[Video] Sahne ${scene.id}: ${missingVoices} satırın sesi yok (süre tahmini).`);
            if (wantsVideo && videoDurationSec === null) console.warn(`[Video] Sahne ${scene.id}: video klibi yok, görsel kullanılıyor.`);
            if (!hasImage && videoDurationSec === null) console.warn(`[Video] Sahne ${scene.id}: görsel yok, yer tutucu gösterilecek.`);

            const dialogueEnd = lines.length > 0 ? cursor + sec(AUDIO_TAIL_SEC) : 0;

            return {
                id: scene.id,
                durationInFrames: Math.max(sec(scene.minDuration), dialogueEnd),
                title: scene.title,
                animation: scene.animation ?? 'slowZoomIn',
                imageSrc: hasImage ? imagePath : null,
                videoSrc: videoDurationSec !== null ? videoPath : null,
                videoDurationSec,
                lines,
            };
        }),
    );

    return {
        durationInFrames: Math.max(1, resolvedScenes.reduce((sum, s) => sum + s.durationInFrames, 0)),
        props: { ...props, resolvedScenes },
        defaultOutName: `${formatEpisodeRef(ref).replace('/', '-')}.mp4`,
    };
};
