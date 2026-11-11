import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { SceneOverlay } from './SceneOverlay';
import type { AnimationType } from '../series/schema';
import type { ResolvedLine } from '../types/props';

interface SceneProps {
    imageSrc: string | null; // null = asset missing, show a placeholder
    lines: ResolvedLine[];
    title?: string;
    animation?: AnimationType;
    placeholderLabel?: string;
}

/** Still image with a Ken Burns style camera move. */
export const Scene: React.FC<SceneProps> = ({
    imageSrc,
    lines,
    title,
    animation = 'static',
    placeholderLabel,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    let scale = 1;
    let translateX = 0;

    switch (animation) {
        case 'slowZoomIn':
            scale = interpolate(frame, [0, durationInFrames], [1, 1.15]);
            break;
        case 'slowZoomOut':
            scale = interpolate(frame, [0, durationInFrames], [1.15, 1]);
            break;
        case 'panRight':
            scale = 1.1; // Need some room to pan
            translateX = interpolate(frame, [0, durationInFrames], [0, -75]); // Move image left = camera pans right
            break;
        case 'panLeft':
            scale = 1.1;
            translateX = interpolate(frame, [0, durationInFrames], [-75, 0]);
            break;
        case 'breathing':
            scale = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [1, 1.05, 1]);
            break;
        case 'static':
        default:
            break;
    }

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {imageSrc ? (
                    <Img
                        src={staticFile(imageSrc)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${scale}) translateX(${translateX}px)`,
                        }}
                    />
                ) : (
                    <AbsoluteFill
                        style={{
                            background: 'linear-gradient(135deg, #1b1b1f, #3a2a1a)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: 'rgba(255,255,255,0.5)',
                            fontFamily: 'sans-serif',
                            fontSize: 40,
                        }}
                    >
                        {placeholderLabel ?? 'Görsel eksik'}
                    </AbsoluteFill>
                )}
            </AbsoluteFill>

            <SceneOverlay lines={lines} title={title} />
        </AbsoluteFill>
    );
};
