// Global render settings — single place to change fps/resolution/timing.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Episode opened in Remotion Studio when no props are given. */
export const DEFAULT_EPISODE = 'osmanli/01';

/** Silence before the first line of a scene (seconds). */
export const LINE_LEAD_IN_SEC = 0.3;

/** Default silence after each line (seconds); per line: pauseAfter. */
export const DEFAULT_LINE_PAUSE_SEC = 0.35;

/** Silence kept after the last line before the scene cuts (seconds). */
export const AUDIO_TAIL_SEC = 0.6;

/** Used to time subtitles when a line has no recording yet (preview without TTS). */
export const ESTIMATED_CHARS_PER_SEC = 14;

/** Hailuo clips tend to freeze on the last second; that part is never shown. */
export const VIDEO_TAIL_TRIM_SEC = 1;

/** A clip shorter than the scene is slowed down to at most this rate, then looped. */
export const MIN_VIDEO_PLAYBACK_RATE = 0.6;

/** Cross-fade length at scene start/end (frames). */
export const FADE_FRAMES = 15;
