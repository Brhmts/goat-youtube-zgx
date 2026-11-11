import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { FADE_FRAMES } from '../config';
import type { ResolvedLine } from '../types/props';

interface SceneOverlayProps {
    lines: ResolvedLine[];
    title?: string;
}

/** Dialogue (one recording + subtitle per line), lower-third title and the fade in/out shared by every scene type. */
export const SceneOverlay: React.FC<SceneOverlayProps> = ({ lines, title }) => {
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
            {lines.map((line, i) => (
                <Sequence key={i} from={line.from} durationInFrames={line.durationInFrames} layout="none">
                    {line.audioSrc && <Audio src={staticFile(line.audioSrc)} />}
                    <Subtitle line={line} opacity={opacity} />
                </Sequence>
            ))}

            {title && (
                <AbsoluteFill style={{ justifyContent: 'flex-start', padding: 60 }}>
                    <div
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            padding: '24px 28px',
                            borderRadius: '14px',
                            borderLeft: '7px solid #d4af37',
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

            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity }} />
        </>
    );
};

const Subtitle: React.FC<{ line: ResolvedLine; opacity: number }> = ({ line, opacity }) => (
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
                backgroundColor: 'rgba(0,0,0,0.55)',
                padding: '14px 28px',
                borderRadius: '12px',
                fontStyle: line.speakerName ? 'normal' : 'italic', // narrator = italic, no name
                opacity,
            }}
        >
            {line.speakerName && (
                <span style={{ color: line.color ?? '#ffd166', fontWeight: 'bold', marginRight: 14 }}>{line.speakerName}:</span>
            )}
            {line.text}
        </div>
    </AbsoluteFill>
);
