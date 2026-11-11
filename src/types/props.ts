import type { AnimationType } from '../series/schema';

/** One spoken line, placed on the scene's timeline by calculateMetadata. */
export type ResolvedLine = {
    /** null for the narrator (no name label). */
    speakerName: string | null;
    color: string | null;
    text: string;
    audioSrc: string | null;
    from: number; // frame within the scene
    durationInFrames: number;
};

/** A scene after calculateMetadata has checked its assets and timed its dialogue. */
export type ResolvedScene = {
    id: number;
    durationInFrames: number;
    title?: string;
    animation: AnimationType;
    imageSrc: string | null;
    videoSrc: string | null;
    videoDurationSec: number | null;
    lines: ResolvedLine[];
};

export type VideoProps = {
    /** "<seriesId>/<episode>", e.g. "moskova-kedileri/01". */
    episode: string;
    /** Filled in by calculateMetadata. */
    resolvedScenes?: ResolvedScene[];
};
