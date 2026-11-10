import type { AnimationType } from '../components/Scene';

export interface SceneData {
    id: number;
    /**
     * Minimum sahne süresi (saniye). Seslendirme bundan uzunsa sahne,
     * ses süresi + AUDIO_TAIL_SEC kadar otomatik uzatılır.
     */
    duration: number;
    imagePrompt: string;
    voiceText: string;
    description: string; // Internal note
    subtitle?: string; // Optional subtitle text if different from voice
    title?: string; // Optional lower-third title
    animation?: AnimationType; // Camera animation for this scene
    // Image-to-Video (Hailuo 2.3)
    videoPrompt?: string; // Motion/animation prompt for image-to-video
    videoDuration?: '6' | '10'; // Clip duration in seconds
    useVideo?: boolean; // false = use static image + Ken Burns (free), true = generate video clip
}

// Style preset applied to ALL image prompts for consistency
export interface StylePreset {
    suffix: string;      // Appended to every image prompt
    negativeHint?: string; // Style to avoid (appended as "Avoid: ...")
}

export interface VideoData {
    projectId: string; // e.g., 'istanbul-fethi'
    title: string;
    scenes: SceneData[];
    musicPrompt?: string; // Optional music prompt
    useVideoClips?: boolean; // true = generate video clips from images (image-to-video pipeline)
    style?: StylePreset; // Consistent style across all scenes
    costMode?: 'budget' | 'standard' | 'premium'; // budget=1K+standard, standard=2K+standard, premium=2K+pro
    hasVoice?: boolean; // true = voice files generated, render with audio
}

/** A scene after calculateMetadata has checked which assets exist and measured them. */
export type ResolvedScene = {
    id: number;
    durationInFrames: number;
    subtitle?: string;
    title?: string;
    animation: AnimationType;
    imageSrc: string | null;
    videoSrc: string | null;
    videoDurationSec: number | null;
    audioSrc: string | null;
};

export type VideoProps = {
    resolvedScenes: ResolvedScene[];
};
