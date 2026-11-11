import { z } from 'zod';

/**
 * File formats of a series. These JSON files are the single source of truth:
 * people, Claude and n8n write them; the generator, the checker and Remotion read them.
 *
 *   public/series/<seriesId>/series.json              → Series
 *   public/series/<seriesId>/episodes/<NN>/episode.json → Episode
 *
 * See docs/series-format.md for a full example.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'küçük harf, rakam ve tire kullanın (örn. "kedi-1")');

export const NARRATOR = 'narrator';

export const voiceSchema = z.object({
    /** ElevenLabs voice NAME used through Kie.ai, e.g. "Aria", "Daniel". */
    kie: z.string().min(1).optional(),
    /** ElevenLabs voice ID for the direct API (fallback). */
    elevenLabsId: z.string().min(1).optional(),
    /** 0.7–1.2, default 1. */
    speed: z.number().min(0.7).max(1.2).optional(),
    /** 0–1. Lower = more expressive, higher = more stable. Default 0.5. */
    stability: z.number().min(0).max(1).optional(),
});

export const referenceSchema = z.object({
    /** Image file relative to the series folder, e.g. "refs/kedi-1.jpg". Committed to git. */
    path: z.string().min(1),
    /** Optional permanent public URL of the same image. If missing, the file is uploaded to Kie.ai when needed. */
    url: z.string().url().optional(),
});

export const codexEntrySchema = z.object({
    id: slug,
    type: z.enum(['character', 'location', 'object', 'lore']),
    name: z.string().min(1),
    /** Other names that count as a mention (English prompt and Turkish dialogue forms). */
    aliases: z.array(z.string().min(1)).default([]),
    /** English visual description added to every image that shows this entry. */
    visual: z.string().optional(),
    /** Approved model sheets / reference images, sent to the image model with every scene that shows this entry. */
    references: z.array(referenceSchema).default([]),
    /** Appearance changes later in the series (e.g. a scar from episode 3 on). */
    progressions: z
        .array(
            z.object({
                fromEpisode: z.number().int().min(1),
                fromScene: z.number().int().min(1).optional(),
                visual: z.string().min(1),
            }),
        )
        .default([]),
    /** Characters who speak need a voice. */
    voice: voiceSchema.optional(),
    /** Subtitle colour of the speaker name, e.g. "#ffb347". */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    /** Personality, backstory, relations, facts. Never sent to the image model; used for writing and consistency checks. */
    notes: z.string().optional(),
});

export const seriesSchema = z.object({
    id: slug,
    title: z.string().min(1),
    language: z.string().default('tr'),
    /** One-paragraph premise, given to Claude when it writes or checks episodes. */
    premise: z.string().optional(),
    style: z.object({
        /** Appended to every image prompt. */
        suffix: z.string().min(1),
        negativeHint: z.string().optional(),
        /** Style frames sent as reference images with every scene. */
        references: z.array(referenceSchema).default([]),
    }),
    narrator: z
        .object({
            name: z.string().default('Anlatıcı'),
            voice: voiceSchema,
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        })
        .optional(),
    codex: z.array(codexEntrySchema).default([]),
    generation: z
        .object({
            /** budget = 1K image + Hailuo standard 768P, standard = 2K + standard 768P, premium = 2K + Hailuo Pro 1080P */
            costMode: z.enum(['budget', 'standard', 'premium']).default('standard'),
            /** Generate image-to-video clips for scenes that have a videoPrompt. */
            videoClips: z.boolean().default(false),
        })
        .default({}),
});

export const lineSchema = z.object({
    /** "narrator" or the codex id of a character. */
    speaker: z.string().min(1),
    text: z.string().min(1),
    /** Subtitle text if it should differ from the spoken text. */
    subtitle: z.string().optional(),
    /** Silence after this line in seconds (default 0.35). */
    pauseAfter: z.number().min(0).max(5).optional(),
});

export const sceneSchema = z.object({
    id: z.number().int().min(1),
    /** Internal note: what happens in this scene. */
    description: z.string().optional(),
    imagePrompt: z.string().min(1),
    /** Codex ids of the characters VISIBLE in the image (their references are sent to the image model). */
    cast: z.array(z.string()).default([]),
    /** Codex id of the location, if it has an entry. */
    location: z.string().optional(),
    animation: z.enum(['slowZoomIn', 'slowZoomOut', 'panRight', 'panLeft', 'static', 'breathing']).optional(),
    videoPrompt: z.string().optional(),
    videoDuration: z.enum(['6', '10']).optional(),
    useVideo: z.boolean().optional(),
    /** On-screen title / lower third. */
    title: z.string().optional(),
    /** Minimum scene length in seconds; the dialogue makes it longer when needed. */
    minDuration: z.number().min(0.5).default(3),
    lines: z.array(lineSchema).default([]),
});

export const episodeSchema = z.object({
    number: z.number().int().min(1),
    title: z.string().min(1),
    /** Short summary, used for continuity checks of later episodes. */
    summary: z.string().optional(),
    scenes: z.array(sceneSchema).min(1),
});

export type Voice = z.infer<typeof voiceSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type CodexEntry = z.infer<typeof codexEntrySchema>;
export type Series = z.infer<typeof seriesSchema>;
export type Line = z.infer<typeof lineSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type AnimationType = NonNullable<Scene['animation']>;

/** Readable zod errors: "scenes.2.lines.0.speaker: Required". */
export const formatZodError = (file: string, error: z.ZodError) =>
    `${file} geçersiz:\n` + error.issues.map((i) => `  - ${i.path.join('.') || '(kök)'}: ${i.message}`).join('\n');
