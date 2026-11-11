import type { Voice } from './schema';

/**
 * Where everything lives, relative to /public (works with staticFile() in Remotion
 * and with path.join('public', ...) in the Node scripts).
 *
 *   series/<s>/series.json
 *   series/<s>/refs/...                      approved model sheets (committed)
 *   series/<s>/episodes/<NN>/episode.json
 *   series/<s>/episodes/<NN>/assets/...      generated files (git-ignored)
 */

export interface EpisodeRef {
    seriesId: string;
    episode: number;
}

/** "kedi-dizisi/1" or "kedi-dizisi/01" → { seriesId, episode } */
export const parseEpisodeRef = (ref: string): EpisodeRef => {
    const match = /^([a-z0-9-]+)\/(\d{1,3})$/.exec(ref.trim());
    if (!match) throw new Error(`Bölüm "${ref}" anlaşılamadı. Biçim: <dizi-id>/<bölüm-no>, örn. moskova-kedileri/01`);
    return { seriesId: match[1], episode: Number(match[2]) };
};

export const formatEpisodeRef = ({ seriesId, episode }: EpisodeRef) => `${seriesId}/${pad2(episode)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');

export const seriesDir = (seriesId: string) => `series/${seriesId}`;
export const seriesFile = (seriesId: string) => `${seriesDir(seriesId)}/series.json`;
/** A reference path from series.json ("refs/kedi-1.jpg") → path relative to /public. */
export const seriesAsset = (seriesId: string, relPath: string) => `${seriesDir(seriesId)}/${relPath}`;

export const episodeDir = (ref: EpisodeRef) => `${seriesDir(ref.seriesId)}/episodes/${pad2(ref.episode)}`;
export const episodeFile = (ref: EpisodeRef) => `${episodeDir(ref)}/episode.json`;
export const episodeAssetsDir = (ref: EpisodeRef) => `${episodeDir(ref)}/assets`;

export const sceneImagePath = (ref: EpisodeRef, sceneId: number) => `${episodeAssetsDir(ref)}/scene-${sceneId}-image.jpg`;
export const sceneVideoPath = (ref: EpisodeRef, sceneId: number) => `${episodeAssetsDir(ref)}/scene-${sceneId}-video.mp4`;

/**
 * The voice file name contains a hash of the text and the voice, so editing a line
 * or changing a character's voice automatically produces a new recording.
 */
export const lineVoicePath = (ref: EpisodeRef, sceneId: number, lineIndex: number, text: string, voice: Voice | undefined) =>
    `${episodeAssetsDir(ref)}/scene-${sceneId}-line-${lineIndex + 1}-${shortHash(JSON.stringify([text, voice ?? null]))}.mp3`;

/** FNV-1a, 32 bit → 8 hex chars. Same result in the browser and in Node. */
export const shortHash = (input: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};
