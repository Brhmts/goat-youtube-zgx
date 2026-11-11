/**
 * Asset generation for one episode.
 *
 *   npm run generate-assets -- <series>/<NN>                    e.g. moskova-kedileri/01
 *   npm run generate-assets -- <series>/<NN> --regenerate-stale re-make images whose prompt/references changed
 *
 * 1. Dialogue: one recording per line, in the speaker's own voice
 * 2. Images: nano-banana-2 with the codex descriptions + reference sheets of everyone in the shot
 * 3. Video clips (optional): Hailuo 2.3 image-to-video
 *
 * Safe to re-run: finished files are skipped, pending Kie.ai tasks are resumed, failed steps
 * are retried. Exits with code 1 if anything is still missing.
 */

import 'dotenv/config';
import fs from 'fs';
import { buildImageRequest, resolveSpeaker } from '../src/series/codex';
import {
    episodeAssetsDir,
    formatEpisodeRef,
    lineVoicePath,
    sceneImagePath,
    sceneVideoPath,
    seriesAsset,
    seriesDir,
    shortHash,
    type EpisodeRef,
} from '../src/series/paths';
import type { Episode, Scene, Series } from '../src/series/schema';
import { generateVoice } from '../src/services/elevenlabs';
import { isNonEmptyFile, isUrlReachable, sleep } from '../src/services/http';
import { completeImageTask, completeVideoTask, createImageTask, createVideoTask, MODELS } from '../src/services/kie';
import { ReferenceUploader, sha1OfFile } from '../src/services/kie-upload';
import { abs, allIssues, hasFlag, loadEpisode, positionalArgs, printIssues, run } from './lib/episode';

const BATCH_SIZE = 3; // Small batches — image/video generation is API-intensive

// ── State ────────────────────────────────────────────────────────
interface SceneState {
    imageTaskId?: string;
    /** Hash of the prompt + references the current image was made from. */
    imageHash?: string;
    /** Hash of the request of the running image task. */
    pendingImageHash?: string;
    imageUrl?: string; // Kie.ai result URL (temporary)
    videoTaskId?: string;
}

class StateFile {
    private data: { scenes: Record<string, SceneState> };

    constructor(private file: string) {
        try {
            this.data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch {
            this.data = { scenes: {} };
        }
    }

    scene(id: number): SceneState {
        return (this.data.scenes[id] ??= {});
    }

    save() {
        fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    }
}

// ── Pipeline ─────────────────────────────────────────────────────
class EpisodeGenerator {
    private state: StateFile;
    private uploader: ReferenceUploader;
    private imageResolution: '1K' | '2K';
    private videoModel: string;
    private videoResolution: '768P' | '1080P';
    readonly stale: Scene[] = [];

    constructor(
        private ref: EpisodeRef,
        private series: Series,
        private episode: Episode,
    ) {
        fs.mkdirSync(abs(episodeAssetsDir(ref)), { recursive: true });
        this.state = new StateFile(abs(`${episodeAssetsDir(ref)}/generation-state.json`));
        this.uploader = new ReferenceUploader(abs(`${seriesDir(ref.seriesId)}/.ref-cache.json`));

        const { costMode } = series.generation;
        this.imageResolution = costMode === 'budget' ? '1K' : '2K';
        this.videoModel = costMode === 'premium' ? MODELS.VIDEO : MODELS.VIDEO_STANDARD;
        this.videoResolution = costMode === 'premium' ? '1080P' : '768P';
    }

    private wantsVideo = (scene: Scene) =>
        Boolean(this.series.generation.videoClips && scene.videoPrompt && scene.useVideo !== false);

    /** The image request and a hash of everything that determines the picture. */
    private imageRequestFor(scene: Scene) {
        const request = buildImageRequest(this.series, this.episode.number, scene);
        const refFingerprint = request.references.map(({ ref }) => {
            const file = abs(seriesAsset(this.ref.seriesId, ref.path));
            return fs.existsSync(file) ? sha1OfFile(file) : `missing:${ref.path}`;
        });
        return { ...request, hash: shortHash(JSON.stringify([request.prompt, refFingerprint, this.imageResolution])) };
    }

    describe() {
        const { costMode, videoClips } = this.series.generation;
        const lines = this.episode.scenes.reduce((n, s) => n + s.lines.length, 0);
        console.log(`\n╔══════════════════════════════════════════════╗`);
        console.log(`║  ${this.series.title} — Bölüm ${this.episode.number}: ${this.episode.title}`);
        console.log(`║  Sahne: ${this.episode.scenes.length} | Satır: ${lines} | Video klip: ${videoClips ? 'EVET' : 'HAYIR'}`);
        console.log(`║  Maliyet modu: ${costMode.toUpperCase()} | Görsel: ${MODELS.IMAGE} @ ${this.imageResolution}`);
        if (videoClips) console.log(`║  Video: ${this.videoModel} @ ${this.videoResolution}`);
        console.log(`╚══════════════════════════════════════════════╝\n`);
    }

    /** Deletes images (and their clips) whose request changed since they were made. */
    deleteStaleImages() {
        for (const scene of this.episode.scenes) {
            const s = this.state.scene(scene.id);
            const image = abs(sceneImagePath(this.ref, scene.id));
            if (isNonEmptyFile(image) && s.imageHash && s.imageHash !== this.imageRequestFor(scene).hash) {
                console.log(`[IMAGE] Sahne ${scene.id}: prompt/referans değişmiş, görsel yeniden üretilecek.`);
                fs.rmSync(image, { force: true });
                fs.rmSync(abs(sceneVideoPath(this.ref, scene.id)), { force: true });
                delete s.imageTaskId;
                delete s.imageUrl;
                delete s.videoTaskId;
            }
        }
        this.state.save();
    }

    async voices(scene: Scene) {
        for (const [i, line] of scene.lines.entries()) {
            const speaker = resolveSpeaker(this.series, line.speaker);
            const file = abs(lineVoicePath(this.ref, scene.id, i, line.text, speaker?.voice));
            if (isNonEmptyFile(file)) continue;
            console.log(`[TTS] Sahne ${scene.id}, satır ${i + 1} (${speaker?.name ?? line.speaker})`);
            const ok = await generateVoice(line.text, file, speaker?.voice);
            if (!ok) console.error(`[TTS] Sahne ${scene.id}, satır ${i + 1}: BAŞARISIZ (sonraki çalıştırmada tekrar denenecek)`);
        }
    }

    async image(scene: Scene) {
        const s = this.state.scene(scene.id);
        const file = abs(sceneImagePath(this.ref, scene.id));
        const request = this.imageRequestFor(scene);

        if (isNonEmptyFile(file)) {
            if (s.imageHash && s.imageHash !== request.hash) this.stale.push(scene);
            return;
        }

        if (!s.imageTaskId) {
            const imageInput: string[] = [];
            for (const { ref } of request.references) {
                const url = ref.url ?? (await this.uploader.urlFor(abs(seriesAsset(this.ref.seriesId, ref.path))));
                if (!url) {
                    console.error(`[IMAGE] Sahne ${scene.id}: referans "${ref.path}" hazırlanamadı, görsel üretilmedi.`);
                    return;
                }
                imageInput.push(url);
            }

            console.log(`[IMAGE] Sahne ${scene.id}: görev oluşturuluyor...`);
            const taskId = await createImageTask({
                prompt: request.prompt,
                aspectRatio: '16:9',
                resolution: this.imageResolution,
                imageInput,
            });
            if (!taskId) {
                console.error(`[IMAGE] Sahne ${scene.id}: görev oluşturulamadı`);
                return;
            }
            Object.assign(s, { imageTaskId: taskId, pendingImageHash: request.hash });
            delete s.imageUrl;
            delete s.videoTaskId; // a new image needs a new clip
            this.state.save();
        } else {
            console.log(`[IMAGE] Sahne ${scene.id}: görev ${s.imageTaskId} sürdürülüyor`);
        }

        const url = await completeImageTask(s.imageTaskId!, file);
        if (url) {
            Object.assign(s, { imageUrl: url, imageHash: s.pendingImageHash ?? request.hash });
        } else {
            console.error(`[IMAGE] Sahne ${scene.id}: BAŞARISIZ (sonraki çalıştırmada tekrar denenecek)`);
        }
        delete s.imageTaskId;
        delete s.pendingImageHash;
        this.state.save();
    }

    async video(scene: Scene) {
        if (!this.wantsVideo(scene)) return;
        const s = this.state.scene(scene.id);
        const file = abs(sceneVideoPath(this.ref, scene.id));
        const image = abs(sceneImagePath(this.ref, scene.id));
        if (isNonEmptyFile(file) || !isNonEmptyFile(image)) return;

        if (!s.videoTaskId) {
            // Kie result URLs expire; fall back to uploading the local image
            let imageUrl = s.imageUrl && (await isUrlReachable(s.imageUrl)) ? s.imageUrl : null;
            imageUrl ??= await this.uploader.urlFor(image);
            if (!imageUrl) {
                console.error(`[VIDEO] Sahne ${scene.id}: görsel URL'si hazırlanamadı, video atlandı.`);
                return;
            }

            const requested = scene.videoDuration ?? '6';
            const duration = requested === '10' && this.videoResolution === '1080P' ? '6' : requested; // 10s only at 768P
            console.log(`[VIDEO] Sahne ${scene.id}: görev oluşturuluyor...`);
            const taskId = await createVideoTask({
                prompt: scene.videoPrompt!,
                imageUrl,
                duration,
                resolution: this.videoResolution,
                promptOptimizer: true,
                model: this.videoModel,
            });
            if (!taskId) {
                console.error(`[VIDEO] Sahne ${scene.id}: görev oluşturulamadı`);
                return;
            }
            s.videoTaskId = taskId;
            this.state.save();
        } else {
            console.log(`[VIDEO] Sahne ${scene.id}: görev ${s.videoTaskId} sürdürülüyor`);
        }

        const url = await completeVideoTask(s.videoTaskId!, file);
        if (!url) console.error(`[VIDEO] Sahne ${scene.id}: BAŞARISIZ (bu arada görsel kullanılır)`);
        delete s.videoTaskId;
        this.state.save();
    }

    /** Counts what is on disk and lists what is missing. */
    summary(): string[] {
        const missing: string[] = [];
        let images = 0, videos = 0, voices = 0, lines = 0;
        for (const scene of this.episode.scenes) {
            if (isNonEmptyFile(abs(sceneImagePath(this.ref, scene.id)))) images++;
            else missing.push(`sahne ${scene.id} görsel`);
            if (this.wantsVideo(scene)) {
                if (isNonEmptyFile(abs(sceneVideoPath(this.ref, scene.id)))) videos++;
                else missing.push(`sahne ${scene.id} video`);
            }
            scene.lines.forEach((line, i) => {
                lines++;
                const voice = resolveSpeaker(this.series, line.speaker)?.voice;
                if (isNonEmptyFile(abs(lineVoicePath(this.ref, scene.id, i, line.text, voice)))) voices++;
                else missing.push(`sahne ${scene.id} satır ${i + 1} ses`);
            });
        }

        const n = this.episode.scenes.length;
        console.log(`\n╔══════════════════════════════════════════════╗`);
        console.log(`║  Tamamlandı`);
        console.log(`║  Görsel: ${images}/${n}`);
        if (this.series.generation.videoClips) console.log(`║  Video: ${videos}/${this.episode.scenes.filter(this.wantsVideo).length}`);
        console.log(`║  Ses: ${voices}/${lines}`);
        console.log(`╚══════════════════════════════════════════════╝`);

        if (this.stale.length > 0) {
            console.warn(
                `\n⚠ ${this.stale.length} görsel, codex/prompt değişmeden önce üretilmiş (sahne ${this.stale.map((s) => s.id).join(', ')}).` +
                `\n  Güncellemek için: npm run generate-assets -- ${formatEpisodeRef(this.ref)} --regenerate-stale`,
            );
        }
        return missing;
    }
}

run(async () => {
    const { ref, series, episode } = await loadEpisode(positionalArgs()[0]);

    if (!process.env.KIE_AI_API_KEY) {
        console.error('KIE_AI_API_KEY is not set. Copy .env.example to .env and fill it in.');
        process.exit(1);
    }

    // Check the series/episode before spending credits
    const errors = allIssues(series, episode).filter((i) => i.level === 'error');
    if (errors.length > 0) {
        printIssues(errors);
        console.error('\nÖnce bu hataları düzeltin (npm run check -- <bölüm>).');
        process.exit(1);
    }

    const gen = new EpisodeGenerator(ref, series, episode);
    gen.describe();
    if (hasFlag('--regenerate-stale')) gen.deleteStaleImages();

    const scenes = episode.scenes;
    for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        console.log(`\n━━━ Sahne ${batch[0].id}–${batch[batch.length - 1].id} ━━━`);

        for (const scene of batch) await gen.voices(scene);
        await Promise.all(batch.map((s) => gen.image(s)));
        await Promise.all(batch.map((s) => gen.video(s)));

        if (i + BATCH_SIZE < scenes.length) await sleep(3000);
    }

    const missing = gen.summary();
    if (missing.length > 0) {
        console.error(`\nEksik: ${missing.join(', ')}\nTekrar denemek için script'i yeniden çalıştırın.`);
        process.exitCode = 1;
    }
});
