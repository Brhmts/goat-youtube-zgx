import { NARRATOR, type CodexEntry, type Reference, type Scene, type Series, type Voice } from './schema';

const LOCALE = 'tr-TR';

/**
 * Lower-cases and folds Turkish letters so English prompts and Turkish dialogue match:
 * "İstanbul" = "Istanbul", "Ertuğrul" = "Ertugrul", "Süleyman" = "Suleyman".
 */
export const normalize = (s: string) =>
    s
        .toLocaleLowerCase(LOCALE)
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/\p{M}/gu, '');

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const namesOf = (entry: CodexEntry) => [entry.name, ...entry.aliases];

/**
 * True if `name` occurs in `text` as a whole word. A following apostrophe is fine
 * (Turkish suffixes: "Mehmed'in"), a following letter is not ("Osman" ≠ "Osmanlı").
 */
export const mentions = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalize(name))}(?![\\p{L}\\p{N}])`, 'u');
    return pattern.test(normalize(text));
};

export const mentionedIn = (text: string, codex: CodexEntry[]) =>
    codex.filter((entry) => namesOf(entry).some((name) => mentions(text, name)));

/** Entries visible in the scene's image: cast + location + anything named in imagePrompt. */
export const entriesInImage = (scene: Scene, codex: CodexEntry[]): CodexEntry[] => {
    const explicit = new Set([...scene.cast, ...(scene.location ? [scene.location] : [])]);
    const named = new Set(mentionedIn(scene.imagePrompt, codex).map((e) => e.id));
    return codex.filter((entry) => explicit.has(entry.id) || named.has(entry.id));
};

/** The visual description that applies at this point of the series (latest progression wins). */
export const visualAt = (entry: CodexEntry, episode: number, sceneId: number): string | undefined => {
    const applies = (p: CodexEntry['progressions'][number]) =>
        p.fromEpisode < episode || (p.fromEpisode === episode && (p.fromScene ?? 1) <= sceneId);
    const latest = entry.progressions
        .filter(applies)
        .sort((a, b) => a.fromEpisode - b.fromEpisode || (a.fromScene ?? 1) - (b.fromScene ?? 1))
        .pop();
    return latest?.visual ?? entry.visual;
};

export interface Speaker {
    id: string;
    name: string;
    voice?: Voice;
    color?: string;
    isNarrator: boolean;
}

export const resolveSpeaker = (series: Series, speakerId: string): Speaker | null => {
    if (speakerId === NARRATOR) {
        return series.narrator
            ? { id: NARRATOR, name: series.narrator.name, voice: series.narrator.voice, color: series.narrator.color, isNarrator: true }
            : null;
    }
    const entry = series.codex.find((e) => e.id === speakerId);
    return entry ? { id: entry.id, name: entry.name, voice: entry.voice, color: entry.color, isNarrator: false } : null;
};

/** Max reference images nano-banana-2 accepts per request. */
export const MAX_REFERENCE_IMAGES = 14;

export interface ImageRequest {
    prompt: string;
    /** Reference images in the order they are sent; the prompt names them by index. */
    references: { label: string; ref: Reference }[];
}

/**
 * Builds the image request for a scene:
 * scene prompt + "image N = <character>" reference guide + fixed codex descriptions + style.
 */
export const buildImageRequest = (series: Series, episode: number, scene: Scene): ImageRequest => {
    const entries = entriesInImage(scene, series.codex);

    const references: ImageRequest['references'] = [];
    for (const entry of entries) {
        const first = entry.references[0]; // one sheet per entry keeps the budget for multi-character scenes
        if (first && references.length < MAX_REFERENCE_IMAGES) references.push({ label: entry.name, ref: first });
    }
    for (const ref of series.style.references) {
        if (references.length < MAX_REFERENCE_IMAGES) references.push({ label: 'art style', ref });
    }

    let prompt = scene.imagePrompt.trim();

    if (references.length > 0) {
        const guide = references.map((r, i) => `image ${i + 1} = ${r.label}`).join(', ');
        prompt +=
            `. Reference images: ${guide}. Draw every character exactly as in their reference sheet ` +
            `(same colours, markings, proportions and accessories); use the reference only for design, not for pose or background`;
    }

    const details = entries
        .map((entry) => {
            const visual = visualAt(entry, episode, scene.id);
            return visual ? `${entry.name}: ${visual}` : null;
        })
        .filter(Boolean);
    if (details.length > 0) prompt += `. Consistent details — ${details.join('; ')}`;

    prompt += `, ${series.style.suffix}`;
    if (series.style.negativeHint) prompt += `. Avoid: ${series.style.negativeHint}`;

    return { prompt, references };
};
