/**
 * Character model sheets — the backbone of visual consistency.
 *
 *   npm run model-sheet -- <series> <codex-id>               3 candidate sheets → refs/_candidates/
 *   npm run model-sheet -- <series> <codex-id> --count 5
 *   npm run model-sheet -- <series> <codex-id> --approve 2   candidate 2 becomes refs/<id>.jpg and is
 *                                                            written into series.json as the reference
 *
 * After approval every scene that shows this character sends the sheet to the image model,
 * so the character looks the same in every scene and every episode.
 * Works for locations too (reference art of a place).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { seriesAsset, seriesDir, seriesFile } from '../src/series/paths';
import type { CodexEntry, Series } from '../src/series/schema';
import { isNonEmptyFile } from '../src/services/http';
import { completeImageTask, createImageTask } from '../src/services/kie';
import { ReferenceUploader } from '../src/services/kie-upload';
import { abs, loadSeries, positionalArgs, run } from './lib/episode';

const flagValue = (flag: string) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? process.argv[i + 1] : undefined;
};

const candidatePath = (seriesId: string, entryId: string, n: number) =>
    seriesAsset(seriesId, `refs/_candidates/${entryId}-${n}.jpg`);

const sheetPrompt = (series: Series, entry: CodexEntry) => {
    const base =
        entry.type === 'character'
            ? `Character model sheet of ${entry.name}: ${entry.visual}. ` +
              `The same character drawn on one sheet: full body front view, three-quarter view, side view and back view, ` +
              `plus a row of four facial expressions (happy, angry, surprised, sad). ` +
              `Plain white background, flat even lighting, consistent proportions and markings in every view, no text, no labels`
            : `Reference concept art of ${entry.name}: ${entry.visual}. Wide establishing view, clear readable shapes, no characters, no text`;
    return `${base}, ${series.style.suffix}${series.style.negativeHint ? `. Avoid: ${series.style.negativeHint}` : ''}`;
};

const generate = async (series: Series, entry: CodexEntry, count: number) => {
    if (!process.env.KIE_AI_API_KEY) throw new Error('KIE_AI_API_KEY is not set in .env');
    if (!entry.visual) throw new Error(`${entry.name} için önce series.json'da "visual" tarifini yazın.`);

    // Style frames keep sheets of different characters in the same art style
    const uploader = new ReferenceUploader(abs(`${seriesDir(series.id)}/.ref-cache.json`));
    const imageInput: string[] = [];
    for (const ref of series.style.references) {
        const url = ref.url ?? (await uploader.urlFor(abs(seriesAsset(series.id, ref.path))));
        if (url) imageInput.push(url);
    }

    const prompt = sheetPrompt(series, entry);
    console.log(`\n${entry.name} için ${count} aday üretiliyor...\nPrompt: ${prompt}\n`);
    fs.mkdirSync(abs(seriesAsset(series.id, 'refs/_candidates')), { recursive: true });

    const results = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
            const out = abs(candidatePath(series.id, entry.id, i + 1));
            const taskId = await createImageTask({ prompt, aspectRatio: '16:9', resolution: '2K', imageInput });
            return taskId ? (await completeImageTask(taskId, out)) !== null : false;
        }),
    );

    const ok = results.filter(Boolean).length;
    console.log(`\n${ok}/${count} aday hazır: ${path.relative(process.cwd(), abs(seriesAsset(series.id, 'refs/_candidates')))}`);
    if (ok > 0) {
        console.log(`Beğendiğinizi onaylayın: npm run model-sheet -- ${series.id} ${entry.id} --approve <numara>`);
    }
    if (ok < count) process.exitCode = 1;
};

const approve = (series: Series, entry: CodexEntry, n: number) => {
    const candidate = abs(candidatePath(series.id, entry.id, n));
    if (!isNonEmptyFile(candidate)) throw new Error(`Aday ${n} bulunamadı: ${path.relative(process.cwd(), candidate)}`);

    const refRel = `refs/${entry.id}.jpg`;
    fs.copyFileSync(candidate, abs(seriesAsset(series.id, refRel)));

    // Edit the raw JSON so fields we do not know about are kept as written
    const file = abs(seriesFile(series.id));
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const rawEntry = raw.codex.find((e: { id: string }) => e.id === entry.id);
    const others = (rawEntry.references ?? []).filter((r: { path: string }) => r.path !== refRel);
    rawEntry.references = [{ path: refRel }, ...others];
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');

    console.log(`✔ ${entry.name}: ${refRel} referans olarak kaydedildi (series.json güncellendi).`);
    console.log('  refs/ klasörünü git\'e ekleyin. Önceden üretilmiş sahneler için: npm run generate-assets -- <bölüm> --regenerate-stale');
};

run(async () => {
    const [seriesId, entryId] = positionalArgs().filter((a) => !/^\d+$/.test(a));
    if (!seriesId || !entryId) throw new Error('Kullanım: npm run model-sheet -- <dizi-id> <codex-id> [--count 3] [--approve N]');

    const series = await loadSeries(seriesId);
    const entry = series.codex.find((e) => e.id === entryId);
    if (!entry) throw new Error(`"${entryId}" codex'te yok. Mevcut: ${series.codex.map((e) => e.id).join(', ')}`);

    const approveN = flagValue('--approve');
    if (approveN) approve(series, entry, Number(approveN));
    else await generate(series, entry, Math.min(Math.max(Number(flagValue('--count') ?? 3), 1), 6));
});
