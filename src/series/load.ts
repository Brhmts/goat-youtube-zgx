import { episodeFile, seriesFile, type EpisodeRef } from './paths';
import { episodeSchema, formatZodError, seriesSchema, type Episode, type Series } from './schema';

/**
 * Parses series.json + episode.json contents. `read` is fetch() in Remotion
 * and fs.readFileSync() in the scripts, so both sides validate the same way.
 */
export const parseSeriesAndEpisode = async (
    ref: EpisodeRef,
    read: (publicPath: string) => Promise<string>,
): Promise<{ series: Series; episode: Episode }> => {
    const series = parseJson(seriesFile(ref.seriesId), await read(seriesFile(ref.seriesId)), seriesSchema.safeParse);
    const episode = parseJson(episodeFile(ref), await read(episodeFile(ref)), episodeSchema.safeParse);
    if (series.id !== ref.seriesId) throw new Error(`${seriesFile(ref.seriesId)}: "id" klasör adıyla aynı olmalı (${ref.seriesId}).`);
    if (episode.number !== ref.episode) throw new Error(`${episodeFile(ref)}: "number" ${ref.episode} olmalı.`);
    return { series, episode };
};

export const parseSeries = async (seriesId: string, read: (publicPath: string) => Promise<string>): Promise<Series> =>
    parseJson(seriesFile(seriesId), await read(seriesFile(seriesId)), seriesSchema.safeParse);

type SafeParse<T> = (data: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError };

const parseJson = <T>(file: string, text: string, safeParse: SafeParse<T>): T => {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        throw new Error(`${file} geçerli bir JSON değil: ${(err as Error).message}`);
    }
    const result = safeParse(raw);
    if (!result.success) throw new Error(formatZodError(file, result.error));
    return result.data;
};
