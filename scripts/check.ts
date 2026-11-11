/**
 * Free consistency check — run it before generating anything.
 *
 *   npm run check -- <series>                 series only (codex, voices, reference files)
 *   npm run check -- <series>/<NN>            series + episode
 *   npm run check -- <series>/<NN> --prompts  also print the exact image prompts
 *
 * Writes out/<series>[-<NN>]-bible.md: codex + script in one document, to review,
 * paste into NovelCrafter, or give to Claude for a continuity check.
 */

import fs from 'fs';
import path from 'path';
import { buildImageRequest, entriesInImage, resolveSpeaker } from '../src/series/codex';
import { checkEpisode, checkSeries } from '../src/series/check';
import { formatEpisodeRef } from '../src/series/paths';
import type { Episode, Series } from '../src/series/schema';
import { ESTIMATED_CHARS_PER_SEC } from '../src/config';
import { checkReferenceFiles, hasFlag, loadEpisode, loadSeries, positionalArgs, printIssues, run } from './lib/episode';

const TYPE_TITLES = { character: 'Karakterler', location: 'Mekânlar', object: 'Nesneler', lore: 'Bilgi' } as const;

const bible = (series: Series, episode?: Episode) => {
    let md = `# ${series.title}${episode ? ` — Bölüm ${episode.number}: ${episode.title}` : ''}\n`;
    if (series.premise) md += `\n${series.premise}\n`;
    for (const type of Object.keys(TYPE_TITLES) as (keyof typeof TYPE_TITLES)[]) {
        const entries = series.codex.filter((e) => e.type === type);
        if (!entries.length) continue;
        md += `\n## ${TYPE_TITLES[type]}\n`;
        for (const e of entries) {
            md += `\n### ${e.name} (\`${e.id}\`)\n`;
            if (e.aliases.length) md += `- **Diğer adlar:** ${e.aliases.join(', ')}\n`;
            if (e.visual) md += `- **Görünüm:** ${e.visual}\n`;
            for (const p of e.progressions) md += `- **Görünüm (bölüm ${p.fromEpisode}${p.fromScene ? `, sahne ${p.fromScene}` : ''}+):** ${p.visual}\n`;
            if (e.voice) md += `- **Ses:** ${e.voice.kie ?? e.voice.elevenLabsId}\n`;
            if (e.notes) md += `- **Notlar:** ${e.notes}\n`;
        }
    }
    if (episode) {
        if (episode.summary) md += `\n## Özet\n\n${episode.summary}\n`;
        md += `\n## Senaryo\n`;
        for (const scene of episode.scenes) {
            md += `\n### Sahne ${scene.id}${scene.description ? ` — ${scene.description}` : ''}\n`;
            const cast = entriesInImage(scene, series.codex).map((e) => e.name);
            if (cast.length) md += `_Görselde: ${cast.join(', ')}_\n\n`;
            for (const line of scene.lines) {
                const speaker = resolveSpeaker(series, line.speaker);
                md += `- **${speaker?.name ?? line.speaker}:** ${line.text}\n`;
            }
        }
    }
    return md;
};

run(async () => {
    const arg = positionalArgs()[0];
    if (!arg) throw new Error('Kullanım: npm run check -- <dizi-id>[/<bölüm>]');

    let series: Series;
    let episode: Episode | undefined;
    let outName: string;

    if (arg.includes('/')) {
        const loaded = await loadEpisode(arg);
        ({ series, episode } = loaded);
        outName = formatEpisodeRef(loaded.ref).replace('/', '-');
    } else {
        series = await loadSeries(arg);
        outName = series.id;
    }

    console.log(`\n${series.title}: ${series.codex.length} codex kaydı`);

    if (episode) {
        let totalSec = 0;
        console.log(`Bölüm ${episode.number}: ${episode.title} — ${episode.scenes.length} sahne\n`);
        for (const scene of episode.scenes) {
            const chars = scene.lines.reduce((n, l) => n + l.text.length, 0);
            const sec = Math.max(scene.minDuration, chars / ESTIMATED_CHARS_PER_SEC + scene.lines.length * 0.4);
            totalSec += sec;
            const cast = entriesInImage(scene, series.codex).map((e) => e.name);
            console.log(`Sahne ${String(scene.id).padStart(2)}  ~${sec.toFixed(0)}s  görsel: ${cast.join(', ') || '—'}  satır: ${scene.lines.length}`);
            if (hasFlag('--prompts')) {
                const req = buildImageRequest(series, episode.number, scene);
                console.log(`          referanslar: ${req.references.map((r) => r.ref.path).join(', ') || '—'}`);
                console.log(`          prompt: ${req.prompt}\n`);
            }
        }
        console.log(`\nTahmini süre: ~${Math.round(totalSec / 60)} dk ${Math.round(totalSec % 60)} sn (sesler üretilince kesinleşir)`);
    }

    const issues = [...checkSeries(series), ...checkReferenceFiles(series), ...(episode ? checkEpisode(series, episode) : [])];
    console.log(issues.length ? '\nKontroller:' : '\nKontroller: sorun yok.');
    printIssues(issues);

    const outFile = path.join(process.cwd(), 'out', `${outName}-bible.md`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, bible(series, episode));
    console.log(`\nHikâye defteri: ${path.relative(process.cwd(), outFile)}`);

    if (issues.some((i) => i.level === 'error')) process.exitCode = 1;
});
