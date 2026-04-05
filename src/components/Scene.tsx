import { AbsoluteFill, Img, Audio, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import React from 'react';

export type AnimationType =
    | 'slowZoomIn'
    | 'slowZoomOut'
    | 'panRight'
    | 'panLeft'
    | 'static'
    | 'breathing';

export type TransitionType = 'fade' | 'none';

interface SceneProps {
    imageSrc: string;
    audioSrc?: string;
    subtitle?: string;
    title?: string; // For lower third or info box
    animation?: AnimationType;
    transition?: TransitionType;
}

export const Scene: React.FC<SceneProps> = ({
    imageSrc,
    audioSrc,
    subtitle,
    title,
    animation = 'static',
    transition = 'fade'
}) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    // Animation Logic
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    switch (animation) {
        case 'slowZoomIn':
            scale = interpolate(frame, [0, durationInFrames], [1, 1.15]);
            break;
        case 'slowZoomOut':
            scale = interpolate(frame, [0, durationInFrames], [1.15, 1]);
            break;
        case 'panRight':
            scale = 1.1; // Need some room to pan
            translateX = interpolate(frame, [0, durationInFrames], [0, -50]); // Move image left to simulate camera panning right
            break;
        case 'panLeft':
            scale = 1.1;
            translateX = interpolate(frame, [0, durationInFrames], [-50, 0]);
            break;
        case 'breathing':
            scale = interpolate(frame, [0, durationInFrames / 2, durationInFrames], [1, 1.05, 1]);
            break;
        case 'static':
        default:
            scale = 1;
            break;
    }

    // Transition Logic (Fade In/Out) - simplistic implementation
    const FADE_DURATION = 15;
    const opacity = interpolate(
        frame,
        [0, FADE_DURATION, durationInFrames - FADE_DURATION, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                <Img
                    src={staticFile(imageSrc)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                    }}
                />
            </AbsoluteFill>

            {/* Audio Layer */}
            {audioSrc && <Audio src={staticFile(audioSrc)} />}

            {/* Dynamic Overlay Elements */}
            {title && (
                <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 40, paddingBottom: 100 }}>
                    <div style={{
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: '20px',
                        borderRadius: '10px',
                        borderLeft: '5px solid #d4af37', // Gold accent
                        color: 'white',
                        fontFamily: 'sans-serif',
                        width: 'fit-content',
                        maxWidth: '60%',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        opacity: opacity
                    }}>
                        {title}
                    </div>
                </AbsoluteFill>
            )}

            {/* Subtitles (Centered at bottom) */}
            {subtitle && (
                <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 }}>
                    <div style={{
                        fontFamily: 'sans-serif',
                        fontSize: 32,
                        color: 'white',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        textAlign: 'center',
                        maxWidth: '80%',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        opacity: opacity
                    }}>
                        {subtitle}
                    </div>
                </AbsoluteFill>
            )}

            {/* Global Transition Overlay (Simple Fade) if 'fade' is requested */}
            {transition === 'fade' && (
                <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity }} />
            )}
        </AbsoluteFill>
    );
};
