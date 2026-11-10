import { ALL_FORMATS, Input, UrlSource } from 'mediabunny';
import { staticFile, type CalculateMetadataFunction } from 'remotion';
import { currentVideo } from './data/current-video';
import { sceneAssetPaths, sceneDurationInFrames } from './lib/assets';
import type { ResolvedScene, VideoProps } from './types/VideoData';

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

/**
 * Looks at which generated assets actually exist and how long the narration is,
 * so that:
 *  - every scene is at least as long as its voice-over (no cut-off sentences),
 *  - a scene whose video clip failed falls back to the still image (Ken Burns),
 *  - a scene with no image at all renders a placeholder instead of crashing.
 */
export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> = async ({ abortSignal }) => {
    const { projectId, scenes, useVideoClips, hasVoice } = currentVideo;

    const resolvedScenes: ResolvedScene[] = await Promise.all(
        scenes.map(async (scene) => {
            const paths = sceneAssetPaths(projectId, scene.id);
            const image = staticFile(paths.image);
            const video = staticFile(paths.video);
            const voice = staticFile(paths.voice);

            const wantsVideo = Boolean(useVideoClips && scene.videoPrompt && scene.useVideo !== false);

            const [hasImage, videoDurationSec, audioDurationSec] = await Promise.all([
                imageExists(image, abortSignal),
                wantsVideo ? probeDuration(video) : Promise.resolve(null),
                hasVoice ? probeDuration(voice) : Promise.resolve(null),
            ]);

            if (wantsVideo && videoDurationSec === null) {
                console.warn(`[Video] Sahne ${scene.id}: video klibi yok, görsel kullanılıyor.`);
            }
            if (hasVoice && audioDurationSec === null) {
                console.warn(`[Video] Sahne ${scene.id}: seslendirme dosyası yok.`);
            }
            if (!hasImage && videoDurationSec === null) {
                console.warn(`[Video] Sahne ${scene.id}: görsel de yok, yer tutucu gösterilecek.`);
            }

            return {
                id: scene.id,
                durationInFrames: sceneDurationInFrames(scene, audioDurationSec),
                subtitle: scene.subtitle || scene.voiceText,
                title: scene.title,
                animation: scene.animation || 'slowZoomIn',
                imageSrc: hasImage ? paths.image : null,
                videoSrc: videoDurationSec !== null ? paths.video : null,
                videoDurationSec,
                audioSrc: audioDurationSec !== null ? paths.voice : null,
            };
        }),
    );

    return {
        durationInFrames: resolvedScenes.reduce((sum, s) => sum + s.durationInFrames, 0),
        props: { resolvedScenes },
        defaultOutName: `${projectId}.mp4`,
    };
};
