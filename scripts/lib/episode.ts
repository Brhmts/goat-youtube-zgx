import fs from 'fs';
import path from 'path';
import { checkEpisode, checkSeries, type Issue } from '../../src/series/check';
import { parseSeries, parseSeriesAndEpisode } from '../../src/series/load';
import { parseEpisodeRef, seriesAsset, type EpisodeRef } from '../../src/series/paths';
import type { Episode, Series } from '../../src/series/schema';

export const PUBLIC_DIR = path.join(process.cwd(), 'public');

/** Path relative to /public → absolute path on disk. */
export const abs = (publicPath: string) => path.join(PUBLIC_DIR, publicPath);

const readPublic = async (publicPath: string) => {
    const file = abs(publicPath);
    if (!fs.existsSync(file)) throw new Error(`${path.relative(process.cwd(), file)} bulunamadı.`);
    return fs.readFileSync(file, 'utf-8');
};

export const loadSeries = (seriesId: string): Promise<Series> => parseSeries(seriesId, readPublic);

export const loadEpisode = async (refArg: string | undefined): Promise<{ ref: EpisodeRef; series: Series; episode: Episode }> => {
    if (!refArg) throw new Error('Bölüm belirtin, örn: npm run <komut> -- moskova-kedileri/01');
    const ref = parseEpisodeRef(refArg);
    const { series, episode } = await parseSeriesAndEpisode(ref, readPublic);
    return { ref, series, episode };
};

/** Checks that need the file system: do the referenced images exist? */
export const checkReferenceFiles = (series: Series): Issue[] => {
    const refs = [
        ...series.style.references.map((r) => ({ owner: 'stil', ref: r })),
        ...series.codex.flatMap((e) => e.references.map((r) => ({ owner: e.name, ref: r }))),
    ];
    return refs
        .filter(({ ref }) => !ref.url && !fs.existsSync(abs(seriesAsset(series.id, ref.path))))
        .map(({ owner, ref }) => ({ level: 'error' as const, message: `${owner}: referans dosyası yok (${ref.path}).` }));
};

export const allIssues = (series: Series, episode: Episode): Issue[] => [
    ...checkSeries(series),
    ...checkReferenceFiles(series),
    ...checkEpisode(series, episode),
];

const ICON = { error: '✖', warning: '⚠', info: 'ℹ' } as const;
export const printIssues = (issues: Issue[]) => {
    for (const issue of issues) console.log(`  ${ICON[issue.level]} ${issue.message}`);
};

/** First positional argument (skips --flags). */
export const positionalArgs = () => process.argv.slice(2).filter((a) => !a.startsWith('--'));
export const hasFlag = (flag: string) => process.argv.includes(flag);

/** Runs a script's main(), printing errors (e.g. invalid JSON) without a stack trace. */
export const run = (main: () => Promise<void>) => {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
};
