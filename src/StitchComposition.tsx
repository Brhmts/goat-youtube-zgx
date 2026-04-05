import { Series, Video, staticFile } from 'remotion';

export const StitchComposition: React.FC = () => {
    return (
        <Series>
            <Series.Sequence durationInFrames={4000}>
                <Video src={staticFile("part1.mp4")} />
            </Series.Sequence>
            <Series.Sequence durationInFrames={2000}>
                <Video src={staticFile("part2a.mp4")} />
            </Series.Sequence>
            <Series.Sequence durationInFrames={1600}>
                <Video src={staticFile("part2b.mp4")} />
            </Series.Sequence>
        </Series>
    );
};
