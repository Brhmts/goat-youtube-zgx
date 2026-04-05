import { AbsoluteFill, Series } from 'remotion';
import { Scene } from './components/Scene';
import { aiWarsScenes } from './data/ai-wars-data';

export const AiWarsComposition = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <Series>
                {aiWarsScenes.map((scene) => {
                    // Construct asset paths
                    const imagePath = `/assets/aiwars-scene-${scene.id}-image.jpg`;
                    const audioPath = `/assets/aiwars-scene-${scene.id}-voice.mp3`;

                    // If we want to use placeholders if assets differ, we could, but let's assume assets exist.
                    // Or we can use the create-svg-placeholders logic again for this new prefix.

                    return (
                        <Series.Sequence key={scene.id} durationInFrames={scene.duration * 30}>
                            <Scene
                                imageSrc={imagePath}
                                audioSrc={audioPath}
                                subtitle={scene.voiceText}
                                animation="slowZoomIn" // Default animation, could be randomized or specified in data
                                transition="fade"
                            />
                        </Series.Sequence>
                    );
                })}
            </Series>
        </AbsoluteFill>
    );
};
