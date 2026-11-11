import { entriesInImage, mentionedIn, namesOf, normalize, resolveSpeaker } from './codex';
import { NARRATOR, type Episode, type Series } from './schema';

export interface Issue {
    level: 'error' | 'warning' | 'info';
    message: string;
}

/** Subtitles longer than this get hard to read on one screen. */
const MAX_LINE_CHARS = 220;

/** Checks the series itself (codex, voices). Errors block generation. */
export const checkSeries = (series: Series): Issue[] => {
    const issues: Issue[] = [];
    const ids = new Set<string>();

    for (const entry of series.codex) {
        if (ids.has(entry.id)) issues.push({ level: 'error', message: `Codex: "${entry.id}" id'si birden fazla kez tanımlı.` });
        ids.add(entry.id);
        if (entry.id === NARRATOR) issues.push({ level: 'error', message: `Codex: "${NARRATOR}" id'si anlatıcıya ayrılmıştır.` });

        if (entry.type === 'character') {
            if (!entry.visual) issues.push({ level: 'warning', message: `${entry.name}: "visual" tarifi yok.` });
            if (entry.references.length === 0) {
                issues.push({
                    level: 'warning',
                    message: `${entry.name}: onaylı model sheet yok, görünümü sahneden sahneye değişebilir. (npm run model-sheet -- ${series.id} ${entry.id})`,
                });
            }
        }
    }

    // The same name for two entries makes mention detection ambiguous
    const owners = new Map<string, string>();
    for (const entry of series.codex) {
        for (const name of namesOf(entry)) {
            const owner = owners.get(normalize(name));
            if (owner && owner !== entry.id) {
                issues.push({ level: 'error', message: `Codex: "${name}" adı hem "${owner}" hem "${entry.id}" için kullanılıyor.` });
            }
            owners.set(normalize(name), entry.id);
        }
    }

    // Each speaking character should sound different
    const voiceOwners = new Map<string, string>();
    const speakers = [
        ...(series.narrator ? [{ name: series.narrator.name, voice: series.narrator.voice }] : []),
        ...series.codex.filter((e) => e.voice),
    ];
    for (const { name, voice } of speakers) {
        const key = voice?.kie ?? voice?.elevenLabsId;
        if (!key) continue;
        const owner = voiceOwners.get(key);
        if (owner) issues.push({ level: 'warning', message: `"${owner}" ve "${name}" aynı sesi (${key}) kullanıyor.` });
        else voiceOwners.set(key, name);
    }

    return issues;
};

/** Checks one episode against its series. Errors block generation. */
export const checkEpisode = (series: Series, episode: Episode): Issue[] => {
    const issues: Issue[] = [];
    const codexIds = new Set(series.codex.map((e) => e.id));
    const sceneIds = new Set<number>();

    for (const scene of episode.scenes) {
        const where = `Sahne ${scene.id}`;
        if (sceneIds.has(scene.id)) issues.push({ level: 'error', message: `${where}: sahne id'si tekrar ediyor.` });
        sceneIds.add(scene.id);

        for (const id of [...scene.cast, ...(scene.location ? [scene.location] : [])]) {
            if (!codexIds.has(id)) issues.push({ level: 'error', message: `${where}: codex'te olmayan "${id}" kullanılmış.` });
        }

        const visible = new Set(entriesInImage(scene, series.codex).map((e) => e.id));

        scene.lines.forEach((line, i) => {
            const at = `${where}, satır ${i + 1}`;
            const speaker = resolveSpeaker(series, line.speaker);
            if (!speaker) {
                issues.push({
                    level: 'error',
                    message:
                        line.speaker === NARRATOR
                            ? `${at}: anlatıcı satırı var ama series.json'da "narrator" tanımlı değil.`
                            : `${at}: konuşan "${line.speaker}" codex'te yok.`,
                });
                return;
            }
            if (!speaker.voice?.kie && !speaker.voice?.elevenLabsId) {
                issues.push({ level: 'error', message: `${at}: ${speaker.name} için ses (voice) tanımlı değil.` });
            }
            if ((line.subtitle ?? line.text).length > MAX_LINE_CHARS) {
                issues.push({ level: 'warning', message: `${at}: altyazı ${MAX_LINE_CHARS} karakterden uzun, satırı bölün.` });
            }
            if (!speaker.isNarrator && !visible.has(speaker.id)) {
                issues.push({ level: 'info', message: `${at}: ${speaker.name} konuşuyor ama görselde yok (cast). Ekranda değilse sorun yok.` });
            }
        });

        for (const entry of mentionedIn(scene.imagePrompt, series.codex)) {
            if (entry.type === 'character' && !scene.cast.includes(entry.id)) {
                issues.push({ level: 'info', message: `${where}: imagePrompt'ta ${entry.name} geçiyor; cast'e eklemek daha açık olur.` });
            }
        }
    }

    return issues;
};
