import { AbsoluteFill, Loop, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import React from 'react';
import { MIN_VIDEO_PLAYBACK_RATE, VIDEO_TAIL_TRIM_SEC } from '../config';
import { SceneOverlay } from './SceneOverlay';
import type { ResolvedLine } from '../types/props';

interface VideoSceneProps {
    videoSrc: string;       // Path to video clip (from image-to-video)
    videoDurationSec: number; // Measured length of the clip
    lines: ResolvedLine[];
    title?: string;
}

/**
 * Plays an image-to-video clip for the whole scene.
 * The frozen last second of the clip is never shown. If the scene is longer
 * than the usable part, the clip is slowed down (down to MIN_VIDEO_PLAYBACK_RATE)
 * and, if that is still not enough, looped.
 */
export const VideoScene: React.FC<VideoSceneProps> = ({
    videoSrc,
    videoDurationSec,
    lines,
    title,
}) => {
    const { fps, durationInFrames } = useVideoConfig();

    const usableSec = Math.max(videoDurationSec - VIDEO_TAIL_TRIM_SEC, 1);
    const sceneSec = durationInFrames / fps;
    const playbackRate = sceneSec <= usableSec ? 1 : Math.max(usableSec / sceneSec, MIN_VIDEO_PLAYBACK_RATE);
    // How many output frames one pass over the usable part of the clip lasts
    const passFrames = Math.floor((usableSec / playbackRate) * fps);

    const video = (
        <OffthreadVideo
            src={staticFile(videoSrc)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            playbackRate={playbackRate}
        />
    );

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {passFrames < durationInFrames ? <Loop durationInFrames={passFrames}>{video}</Loop> : video}
            </AbsoluteFill>

            <SceneOverlay lines={lines} title={title} />
        </AbsoluteFill>
    );
};
