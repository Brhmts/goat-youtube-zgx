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
    /**
     * Codex entry ids shown in this scene's image, in addition to the ones found
     * automatically in imagePrompt. Use it when the prompt describes someone
     * without naming them (e.g. "a tribal leader" = Ertuğrul).
     */
    codex?: string[];
}

/**
 * Story bible entry (the same idea as NovelCrafter's Codex): one fixed description
 * per character/place/object, injected into every image prompt that shows it,
 * so the same person looks the same across scenes and videos.
 */
export interface CodexEntry {
    id: string; // stable, e.g. 'mehmed-2'
    type: 'character' | 'location' | 'object' | 'lore';
    name: string;
    /** Names that count as a mention (English prompt + Turkish narration forms). */
    aliases?: string[];
    /** English visual description added to image prompts. Keep it short and concrete. */
    visual?: string;
    /** Appearance changes over time: from scene `fromScene` on, this visual is used instead. */
    progressions?: { fromScene: number; visual: string }[];
    /** Facts for keeping scripts consistent (dates, relations). Never sent to the image model. */
    notes?: string;
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
    codex?: CodexEntry[]; // Characters/places that must look the same in every scene
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
