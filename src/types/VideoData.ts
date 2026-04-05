import type { AnimationType } from '../components/Scene';

export interface SceneData {
    id: number;
    duration: number; // seconds
    imagePrompt: string;
    voiceText: string;
    description: string; // Internal note
    subtitle?: string; // Optional subtitle text if different from voice
    animation?: AnimationType; // Camera animation for this scene
    // Image-to-Video (Hailuo 2.3)
    videoPrompt?: string; // Motion/animation prompt for image-to-video
    videoDuration?: '6' | '10'; // Clip duration in seconds
    useVideo?: boolean; // false = use static image + Ken Burns (free), true = generate video clip
}

// Style preset applied to ALL image prompts for consistency
export interface StylePreset {
    suffix: string;      // Appended to every image prompt
    negativeHint?: string; // Style to avoid
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
