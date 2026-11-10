import { AbsoluteFill, Series } from "remotion";
import { Scene } from "./components/Scene";
import { VideoScene } from "./components/VideoScene";
import type { VideoProps } from "./types/VideoData";

// Scenes are resolved in calculate-metadata.ts (asset checks + durations).
export const VideoComposition: React.FC<VideoProps> = ({ resolvedScenes }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            <Series>
                {resolvedScenes.map((scene) => (
                    <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
                        {scene.videoSrc && scene.videoDurationSec ? (
                            <VideoScene
                                videoSrc={scene.videoSrc}
                                videoDurationSec={scene.videoDurationSec}
                                audioSrc={scene.audioSrc}
                                subtitle={scene.subtitle}
                                title={scene.title}
                            />
                        ) : (
                            <Scene
                                imageSrc={scene.imageSrc}
                                audioSrc={scene.audioSrc}
                                subtitle={scene.subtitle}
                                title={scene.title}
                                animation={scene.animation}
                                placeholderLabel={`Sahne ${scene.id}: görsel eksik`}
                            />
                        )}
                    </Series.Sequence>
                ))}
            </Series>
        </AbsoluteFill>
    );
};
