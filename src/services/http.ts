import fs from 'fs';

/** Node-side helpers (used only by the scripts in /scripts, never by the Remotion bundle). */

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** True if the file exists and is not empty (a 0-byte file is a failed download). */
export const isNonEmptyFile = (filePath: string): boolean => {
    try {
        return fs.statSync(filePath).size > 0;
    } catch {
        return false;
    }
};

/**
 * Downloads to a temporary file and only renames it into place on success,
 * so a failed or interrupted download never leaves a broken file behind.
 */
export const writeResponseToFile = async (res: Response, outputPath: string): Promise<void> => {
    const tmpPath = `${outputPath}.part`;
    try {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) throw new Error('Empty response body');
        fs.writeFileSync(tmpPath, buffer);
        fs.renameSync(tmpPath, outputPath);
    } catch (err) {
        fs.rmSync(tmpPath, { force: true });
        throw err;
    }
};

export const downloadFile = async (url: string, outputPath: string): Promise<void> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
    await writeResponseToFile(res, outputPath);
};

/** Quick reachability check (e.g. to detect an expired result URL). */
export const isUrlReachable = async (url: string): Promise<boolean> => {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
    } catch {
        return false;
    }
};
