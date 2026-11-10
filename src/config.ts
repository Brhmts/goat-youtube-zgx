// Global render settings — single place to change fps/resolution.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Silence kept after the narration ends before the scene cuts (seconds). */
export const AUDIO_TAIL_SEC = 0.6;

/** Hailuo clips tend to freeze on the last second; that part is never shown. */
export const VIDEO_TAIL_TRIM_SEC = 1;

/** A clip shorter than the scene is slowed down to at most this rate, then looped. */
export const MIN_VIDEO_PLAYBACK_RATE = 0.6;

/** Cross-fade length at scene start/end (frames). */
export const FADE_FRAMES = 15;
