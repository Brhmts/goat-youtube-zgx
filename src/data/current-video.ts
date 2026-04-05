import { VideoData } from '../types/VideoData';
import { osmanliScenes, OSMANLI_STYLE } from './osmanli-data';

// This file is the SINGLE SOURCE OF TRUTH for the current video project.
// To switch projects, simply overwrite this file or change the export.

export const currentVideo: VideoData = {
    projectId: 'osmanli-v2',
    title: "Osmanlı'nın Yükselişi",
    scenes: osmanliScenes,
    useVideoClips: true,
    style: OSMANLI_STYLE,
    costMode: 'budget',
    hasVoice: true, // TTS via Kie.ai (ElevenLabs proxy)
};
