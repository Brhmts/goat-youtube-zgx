/**
 * Prompting Guide for Kie.ai Models
 *
 * nano-banana-2 (Image Generation):
 *   - Gemini 3.1 Flash based, excellent text rendering
 *   - Supports up to 4K resolution
 *   - Best with detailed, structured prompts
 *
 * hailuo/2-3-image-to-video-pro (Image-to-Video):
 *   - Creates 6s or 10s video clips from a single image
 *   - Excels at: camera movements, subtle animations, cinematic motion
 *   - Supports: anime, CGI, illustration, watercolor, realistic styles
 *   - Key: describe MOTION, not static content (the image already has the content)
 */

// ── Image Prompt Templates ───────────────────────────────────────
// nano-banana-2 responds best to structured prompts with these elements:
//   [Subject] + [Setting/Environment] + [Lighting] + [Style] + [Technical]

export const IMAGE_PROMPT_PATTERNS = {
    // Product/brand video style — clean, professional
    product: (subject: string, context: string) =>
        `Professional product photography of ${subject}, ${context}, clean studio lighting, soft shadows, gradient background, ultra high detail, 4K commercial quality`,

    // Cinematic documentary style
    cinematic: (subject: string, mood: string) =>
        `Cinematic wide shot of ${subject}, ${mood} atmosphere, volumetric lighting, shallow depth of field, film grain, color graded, 8K quality, movie still`,

    // Tech/corporate style
    tech: (subject: string, detail: string) =>
        `Futuristic visualization of ${subject}, ${detail}, neon blue and purple accents, dark background, holographic elements, clean modern design, 4K render`,

    // Editorial/storytelling
    editorial: (subject: string, emotion: string) =>
        `Editorial photography style, ${subject}, ${emotion} mood, natural lighting, rich colors, storytelling composition, magazine quality`,

    // Abstract/conceptual
    abstract: (concept: string, style: string) =>
        `Abstract conceptual art representing ${concept}, ${style}, bold composition, vibrant colors, artistic interpretation, gallery quality`,
} as const;

// ── Video Prompt Templates ───────────────────────────────────────
// hailuo 2.3 — describe MOTION only, the image provides the content
//
// GOOD: "Slow dolly zoom, smoke rising gently, particles floating"
// BAD:  "A city at night with neon lights" (this describes the image, not motion)
//
// Motion vocabulary that works well:
//   Camera: dolly in/out, pan left/right, tilt up/down, orbit, crane up/down, zoom in/out
//   Subject: breathing, blinking, hair flowing, cloth rippling, walking, turning
//   Environment: clouds drifting, water flowing, leaves falling, smoke rising, light flickering
//   Particles: dust floating, sparks, bokeh shifting, rain, snow

export const VIDEO_PROMPT_PATTERNS = {
    // Product reveal — smooth, professional
    productReveal: (detail: string) =>
        `Slow smooth dolly zoom in, ${detail}, soft focus shifts to sharp, light reflections subtly moving, cinematic product commercial style`,

    // Epic/dramatic — documentary feel
    epicDrama: (action: string) =>
        `Slow dramatic camera push in, ${action}, volumetric light rays shifting, dust particles floating in air, cinematic atmosphere`,

    // Tech/digital — data visualization feel
    techMotion: (element: string) =>
        `Gentle orbit camera movement, ${element}, holographic elements pulsing softly, data streams flowing, subtle digital glitch effects`,

    // Nature/organic — calming motion
    organic: (movement: string) =>
        `Gentle breathing camera movement, ${movement}, natural light slowly changing, atmospheric haze drifting, peaceful ambient motion`,

    // Portrait/character — subtle life
    portrait: (expression: string) =>
        `Very subtle camera drift, ${expression}, natural micro-movements, soft hair movement from gentle breeze, blinking, realistic breathing`,

    // Aerial/establishing — grand scale
    aerial: (direction: string) =>
        `Smooth crane up revealing scale, ${direction}, clouds drifting slowly, atmospheric perspective deepening, golden hour light shifting`,
} as const;

// ── Scene Builder Helper ─────────────────────────────────────────
// Combines image + video prompts for a complete scene definition

export interface ScenePrompts {
    imagePrompt: string;
    videoPrompt: string;
    videoDuration: '6' | '10';
}

export const buildScenePrompts = {
    /**
     * Product showcase scene — clean, premium feel
     */
    productShowcase: (product: string, context: string, motion: string): ScenePrompts => ({
        imagePrompt: IMAGE_PROMPT_PATTERNS.product(product, context),
        videoPrompt: VIDEO_PROMPT_PATTERNS.productReveal(motion),
        videoDuration: '6',
    }),

    /**
     * Documentary/story scene — cinematic, emotional
     */
    documentary: (subject: string, mood: string, action: string): ScenePrompts => ({
        imagePrompt: IMAGE_PROMPT_PATTERNS.cinematic(subject, mood),
        videoPrompt: VIDEO_PROMPT_PATTERNS.epicDrama(action),
        videoDuration: '10',
    }),

    /**
     * Tech explainer scene — futuristic, clean
     */
    techExplainer: (concept: string, detail: string, element: string): ScenePrompts => ({
        imagePrompt: IMAGE_PROMPT_PATTERNS.tech(concept, detail),
        videoPrompt: VIDEO_PROMPT_PATTERNS.techMotion(element),
        videoDuration: '6',
    }),
} as const;
