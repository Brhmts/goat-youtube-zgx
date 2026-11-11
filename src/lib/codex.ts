import type { CodexEntry, SceneData, StylePreset } from '../types/VideoData';

const LOCALE = 'tr-TR';

/**
 * Lower-cases and folds Turkish letters so English prompts and Turkish narration match:
 * "İstanbul" = "Istanbul", "Ertuğrul" = "Ertugrul", "Süleyman" = "Suleyman".
 */
export const normalize = (s: string) =>
    s
        .toLocaleLowerCase(LOCALE)
        .replace(/ı/g, 'i')
        .normalize('NFD')
        .replace(/\p{M}/gu, '');

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const namesOf = (entry: CodexEntry) => [entry.name, ...(entry.aliases ?? [])];

/**
 * True if `name` occurs in `text` as a whole word. A following apostrophe is fine
 * (Turkish suffixes: "Mehmed'in"), a following letter is not ("Osman" ≠ "Osmanlı").
 */
export const mentions = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalize(name))}(?![\\p{L}\\p{N}])`, 'u');
    return pattern.test(normalize(text));
};

const mentionedIn = (text: string, codex: CodexEntry[]) =>
    codex.filter((entry) => namesOf(entry).some((name) => mentions(text, name)));

/** Entries shown in the scene's image: named in imagePrompt, or listed in scene.codex. */
export const entriesInImage = (scene: SceneData, codex: CodexEntry[]): CodexEntry[] => {
    const explicit = new Set(scene.codex ?? []);
    const found = mentionedIn(scene.imagePrompt, codex);
    return codex.filter((entry) => explicit.has(entry.id) || found.includes(entry));
};

/** Entries the narration talks about (used for the consistency report only). */
export const entriesInNarration = (scene: SceneData, codex: CodexEntry[]): CodexEntry[] =>
    mentionedIn(`${scene.voiceText} ${scene.subtitle ?? ''}`, codex);

/** The visual description that applies at this scene (latest matching progression wins). */
export const visualAt = (entry: CodexEntry, sceneId: number): string | undefined => {
    const progression = (entry.progressions ?? [])
        .filter((p) => p.fromScene <= sceneId)
        .sort((a, b) => b.fromScene - a.fromScene)[0];
    return progression?.visual ?? entry.visual;
};

/**
 * Final prompt sent to the image model:
 * scene prompt + fixed codex descriptions + style suffix + negative hint.
 */
export const buildImagePrompt = (scene: SceneData, codex: CodexEntry[] = [], style?: StylePreset): string => {
    let prompt = scene.imagePrompt.trim();

    const details = entriesInImage(scene, codex)
        .map((entry) => {
            const visual = visualAt(entry, scene.id);
            return visual ? `${entry.name}: ${visual}` : null;
        })
        .filter(Boolean);
    if (details.length > 0) prompt += `. Consistent details — ${details.join('; ')}`;

    if (style?.suffix) prompt += `, ${style.suffix}`;
    if (style?.negativeHint) prompt += `. Avoid: ${style.negativeHint}`;
    return prompt;
};

export interface CodexIssue {
    level: 'error' | 'warning' | 'info';
    message: string;
}

/** Problems a human (or Claude) should look at before spending money on generation. */
export const checkCodex = (scenes: SceneData[], codex: CodexEntry[]): CodexIssue[] => {
    const issues: CodexIssue[] = [];
    const ids = new Set<string>();

    for (const entry of codex) {
        if (ids.has(entry.id)) issues.push({ level: 'error', message: `Codex: "${entry.id}" id'si birden fazla kez tanımlı.` });
        ids.add(entry.id);
        if (entry.type !== 'lore' && !entry.visual) {
            issues.push({ level: 'warning', message: `Codex: "${entry.name}" için visual açıklaması yok, görsellere eklenmeyecek.` });
        }
    }

    // The same name used for two entries makes detection ambiguous
    const owners = new Map<string, string>();
    for (const entry of codex) {
        for (const name of namesOf(entry)) {
            const key = normalize(name);
            const owner = owners.get(key);
            if (owner && owner !== entry.id) {
                issues.push({ level: 'error', message: `Codex: "${name}" hem "${owner}" hem "${entry.id}" için kullanılıyor.` });
            }
            owners.set(key, entry.id);
        }
    }

    const used = new Set<string>();
    for (const scene of scenes) {
        for (const id of scene.codex ?? []) {
            if (!ids.has(id)) issues.push({ level: 'error', message: `Sahne ${scene.id}: codex'te olmayan "${id}" kullanılmış.` });
        }

        const inImage = entriesInImage(scene, codex);
        inImage.forEach((e) => used.add(e.id));

        for (const entry of entriesInNarration(scene, codex)) {
            used.add(entry.id);
            if (entry.type === 'character' && !inImage.includes(entry)) {
                issues.push({
                    level: 'info',
                    message:
                        `Sahne ${scene.id}: anlatımda "${entry.name}" geçiyor ama görselde yok. ` +
                        `Görselde o kişi varsa sahneye codex: ['${entry.id}'] ekleyin.`,
                });
            }
        }
    }

    for (const entry of codex) {
        if (!used.has(entry.id)) issues.push({ level: 'info', message: `Codex: "${entry.name}" hiçbir sahnede geçmiyor.` });
    }

    return issues;
};
