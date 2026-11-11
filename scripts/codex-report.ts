/**
 * Codex consistency report — run before generating assets (it costs nothing).
 *
 *   npm run codex              → which scene shows/mentions which entry + warnings
 *   npm run codex -- --prompts → also print the exact image prompts that will be sent
 *
 * Also writes out/<projectId>-codex.md: the story bible as Markdown, to review,
 * paste into NovelCrafter, or give to Claude for a fact check of the script.
 */

import fs from 'fs';
import path from 'path';
import { currentVideo } from '../src/data/current-video';
import { buildImagePrompt, checkCodex, entriesInImage, entriesInNarration, visualAt } from '../src/lib/codex';

const { projectId, title, scenes, style, codex = [] } = currentVideo;
const showPrompts = process.argv.includes('--prompts');

console.log(`\nCodex — ${title} (${codex.length} entries, ${scenes.length} scenes)\n`);

for (const scene of scenes) {
    const image = entriesInImage(scene, codex).map((e) => e.name);
    const narration = entriesInNarration(scene, codex).map((e) => e.name);
    console.log(`Sahne ${String(scene.id).padStart(2)}  görsel: ${image.join(', ') || '—'}`);
    if (narration.length) console.log(`          anlatım: ${narration.join(', ')}`);
    if (showPrompts) console.log(`          prompt: ${buildImagePrompt(scene, codex, style)}\n`);
}

const issues = checkCodex(scenes, codex);
const icon = { error: '✖', warning: '⚠', info: 'ℹ' } as const;
console.log(issues.length ? '\nKontroller:' : '\nKontroller: sorun yok.');
for (const issue of issues) console.log(`  ${icon[issue.level]} ${issue.message}`);

// ── Story bible as Markdown ──────────────────────────────────────
const typeTitles = { character: 'Karakterler', location: 'Mekânlar', object: 'Nesneler', lore: 'Bilgi' } as const;
let md = `# ${title} — Codex\n`;
for (const type of Object.keys(typeTitles) as (keyof typeof typeTitles)[]) {
    const entries = codex.filter((e) => e.type === type);
    if (!entries.length) continue;
    md += `\n## ${typeTitles[type]}\n`;
    for (const entry of entries) {
        const sceneIds = scenes
            .filter((s) => entriesInImage(s, codex).includes(entry) || entriesInNarration(s, codex).includes(entry))
            .map((s) => s.id);
        md += `\n### ${entry.name}\n`;
        if (entry.aliases?.length) md += `- **Diğer adlar:** ${entry.aliases.join(', ')}\n`;
        if (entry.visual) md += `- **Görünüm:** ${entry.visual}\n`;
        for (const p of entry.progressions ?? []) md += `- **Görünüm (sahne ${p.fromScene}+):** ${visualAt(entry, p.fromScene)}\n`;
        if (entry.notes) md += `- **Notlar:** ${entry.notes}\n`;
        md += `- **Sahneler:** ${sceneIds.join(', ') || '—'}\n`;
    }
}
md += `\n## Senaryo\n\n${scenes.map((s) => `${s.id}. ${s.voiceText}`).join('\n')}\n`;

const outDir = path.join(process.cwd(), 'out');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${projectId}-codex.md`);
fs.writeFileSync(outFile, md);
console.log(`\nCodex dosyası: ${path.relative(process.cwd(), outFile)}`);

if (issues.some((i) => i.level === 'error')) process.exitCode = 1;
