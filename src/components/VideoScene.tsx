import { AbsoluteFill, Audio, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import React from 'react';

interface VideoSceneProps {
    videoSrc: string;       // Path to video clip (from image-to-video)
    audioSrc?: string;      // Path to voice narration (optional)
    subtitle?: string;
    title?: string;
}

export const VideoScene: React.FC<VideoSceneProps> = ({
    videoSrc,
    audioSrc,
    subtitle,
    title,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Fade transition
    const FADE_DURATION = 15;
    const opacity = interpolate(
        frame,
        [0, FADE_DURATION, durationInFrames - FADE_DURATION, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* Video Background — trim last 1s to avoid freeze frame */}
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                <OffthreadVideo
                    src={staticFile(videoSrc)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                    muted
                    endAt={150} // 5 seconds at 30fps — skip last 1s freeze
                />
            </AbsoluteFill>

            {/* Voice Narration (optional) */}
            {audioSrc && <Audio src={staticFile(audioSrc)} />}

            {/* Lower Third Title */}
            {title && (
                <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 40, paddingBottom: 100 }}>
                    <div style={{
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: '20px',
                        borderRadius: '10px',
                        borderLeft: '5px solid #d4af37',
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

            {/* Subtitles */}
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

            {/* Fade Transition */}
            <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - opacity }} />
        </AbsoluteFill>
    );
};
