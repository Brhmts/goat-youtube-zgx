import { AbsoluteFill, Series } from "remotion";
import { Scene } from "./components/Scene";
import { VideoScene } from "./components/VideoScene";
import type { VideoProps } from "./types/props";

// Scenes are resolved in calculate-metadata.ts (episode JSON + asset checks + dialogue timing).
export const VideoComposition: React.FC<VideoProps> = ({ resolvedScenes = [] }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            <Series>
                {resolvedScenes.map((scene) => (
                    <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
                        {scene.videoSrc && scene.videoDurationSec ? (
                            <VideoScene
                                videoSrc={scene.videoSrc}
                                videoDurationSec={scene.videoDurationSec}
                                lines={scene.lines}
                                title={scene.title}
                            />
                        ) : (
                            <Scene
                                imageSrc={scene.imageSrc}
                                lines={scene.lines}
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
