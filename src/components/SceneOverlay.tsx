import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { FADE_FRAMES } from '../config';

interface SceneOverlayProps {
    audioSrc?: string | null;
    subtitle?: string;
    title?: string;
}

/** Narration, lower-third title, subtitles and the fade in/out shared by every scene type. */
export const SceneOverlay: React.FC<SceneOverlayProps> = ({ audioSrc, subtitle, title }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    const fade = Math.min(FADE_FRAMES, Math.floor(durationInFrames / 2));
    const opacity = interpolate(
        frame,
        [0, fade, durationInFrames - fade, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    return (
        <>
            {audioSrc && <Audio src={staticFile(audioSrc)} />}

            {title && (
                <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 60, paddingBottom: 160 }}>
                    <div
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            padding: '28px',
                            borderRadius: '14px',
                            borderLeft: '7px solid #d4af37', // Gold accent
                            color: 'white',
                            fontFamily: 'sans-serif',
                            width: 'fit-content',
                            maxWidth: '60%',
                            fontSize: 36,
                            fontWeight: 'bold',
                            opacity,
                        }}
                    >
                        {title}
                    </div>
                </AbsoluteFill>
            )}

            {subtitle && (
                <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
                    <div
                        style={{
                            fontFamily: 'sans-serif',
                            fontSize: 46,
                            lineHeight: 1.3,
                            color: 'white',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            textAlign: 'center',
                            maxWidth: '80%',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            padding: '14px 28px',
                            borderRadius: '12px',
                            opacity,
                        }}
                    >
                        {subtitle}
                    </div>
                </AbsoluteFill>
            )}

            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity }} />
        </>
    );
};
