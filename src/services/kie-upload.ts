import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Kie.ai File Upload API (base64). Image models take reference images as URLs,
 * so committed reference sheets are uploaded on demand.
 *
 * Kie deletes uploaded files after ~3 days, so the URL is cached together with
 * the file's hash and re-uploaded when it expires or the file changes.
 */

const uploadBaseUrl = () => process.env.KIE_UPLOAD_BASE_URL || 'https://kieai.redpandaai.co';

/** Treat a cached URL as expired this long before its real expiry. */
const SAFETY_MARGIN_MS = 6 * 60 * 60 * 1000;
/** Used when the API does not say when the file expires. */
const ASSUMED_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;

interface CacheEntry {
    url: string;
    sha1: string;
    expiresAt: number; // epoch ms
}

type Cache = Record<string, CacheEntry>;

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export const sha1OfFile = (filePath: string) => crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');

export class ReferenceUploader {
    private cache: Cache;
    /** Scenes generated in parallel share one upload of the same file. */
    private inFlight = new Map<string, Promise<string | null>>();

    constructor(private cacheFile: string) {
        try {
            this.cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        } catch {
            this.cache = {};
        }
    }

    /** A URL the image model can download, for a local reference image. Null on failure. */
    urlFor(localPath: string): Promise<string | null> {
        let pending = this.inFlight.get(localPath);
        if (!pending) {
            pending = this.resolveUrl(localPath).finally(() => this.inFlight.delete(localPath));
            this.inFlight.set(localPath, pending);
        }
        return pending;
    }

    private async resolveUrl(localPath: string): Promise<string | null> {
        if (!fs.existsSync(localPath)) {
            console.error(`[REF] Referans görsel bulunamadı: ${localPath}`);
            return null;
        }
        const sha1 = sha1OfFile(localPath);
        const cached = this.cache[localPath];
        if (cached && cached.sha1 === sha1 && cached.expiresAt - SAFETY_MARGIN_MS > Date.now()) return cached.url;

        const uploaded = await this.upload(localPath);
        if (!uploaded) return null;
        this.cache[localPath] = { ...uploaded, sha1 };
        fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
        fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
        return uploaded.url;
    }

    private async upload(localPath: string): Promise<{ url: string; expiresAt: number } | null> {
        const mime = MIME[path.extname(localPath).toLowerCase()] ?? 'application/octet-stream';
        const base64Data = `data:${mime};base64,${fs.readFileSync(localPath).toString('base64')}`;
        console.log(`[REF] Yükleniyor: ${path.basename(localPath)}`);

        try {
            const res = await fetch(`${uploadBaseUrl()}/api/file-base64-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.KIE_AI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Data, uploadPath: 'goat-youtube/refs', fileName: path.basename(localPath) }),
            });
            const text = await res.text();
            let json: { success?: boolean; code?: number; msg?: string; data?: { downloadUrl?: string; fileUrl?: string; expiresAt?: string } };
            try {
                json = JSON.parse(text);
            } catch {
                console.error(`[REF] Yükleme yanıtı okunamadı (HTTP ${res.status}):`, text.substring(0, 200));
                return null;
            }
            const url = json.data?.downloadUrl ?? json.data?.fileUrl;
            if (!res.ok || !url) {
                console.error('[REF] Yükleme başarısız:', json.msg ?? json);
                return null;
            }
            const expiresAt = json.data?.expiresAt ? Date.parse(json.data.expiresAt) : NaN;
            return { url, expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + ASSUMED_LIFETIME_MS };
        } catch (err) {
            console.error('[REF] Yükleme hatası:', err);
            return null;
        }
    }
}
