import { AbsoluteFill, Series } from "remotion";
import { currentVideo } from "./data/current-video";
import { Scene } from "./components/Scene";
import { VideoScene } from "./components/VideoScene";

export const VideoComposition: React.FC = () => {
    const { scenes, projectId, useVideoClips, hasVoice } = currentVideo;

    return (
        <AbsoluteFill style={{ backgroundColor: "black" }}>
            <Series>
                {scenes.map((scene) => {
                    const imagePath = `/assets/${projectId}-scene-${scene.id}-image.jpg`;
                    const videoPath = `/assets/${projectId}-scene-${scene.id}-video.mp4`;
                    const audioPath = hasVoice
                        ? `/assets/${projectId}-scene-${scene.id}-voice.mp3`
                        : undefined;

                    const hasVideoClip = useVideoClips && scene.videoPrompt && scene.useVideo !== false;

                    return (
                        <Series.Sequence key={scene.id} durationInFrames={Math.ceil(scene.duration * 30)}>
                            {hasVideoClip ? (
                                <VideoScene
                                    videoSrc={videoPath}
                                    audioSrc={audioPath}
                                    subtitle={scene.subtitle || scene.voiceText}
                                />
                            ) : (
                                <Scene
                                    imageSrc={imagePath}
                                    audioSrc={audioPath}
                                    subtitle={scene.subtitle || scene.voiceText}
                                    animation={scene.animation || 'slowZoomIn'}
                                    transition="fade"
                                />
                            )}
                        </Series.Sequence>
                    );
                })}
            </Series>
        </AbsoluteFill>
    );
};
