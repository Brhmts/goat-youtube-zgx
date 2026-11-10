import { AUDIO_TAIL_SEC, FPS } from '../config';
import type { SceneData } from '../types/VideoData';

/**
 * File names of a scene's generated assets, relative to /public.
 * Shared by the generation script and the composition so they never drift apart.
 */
export const sceneAssetPaths = (projectId: string, sceneId: number) => {
    const base = `assets/${projectId}-scene-${sceneId}`;
    return {
        image: `${base}-image.jpg`,
        video: `${base}-video.mp4`,
        voice: `${base}-voice.mp3`,
    };
};

/** Scene length: the configured duration, or longer if the narration needs it. */
export const sceneDurationInFrames = (scene: Pick<SceneData, 'duration'>, audioDurationSec: number | null): number => {
    const neededSec = audioDurationSec === null ? 0 : audioDurationSec + AUDIO_TAIL_SEC;
    return Math.ceil(Math.max(scene.duration, neededSec) * FPS);
};
