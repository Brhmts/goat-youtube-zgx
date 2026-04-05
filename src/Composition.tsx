import { AbsoluteFill, Series } from 'remotion';
import { Scene } from './components/Scene';

export const MyComposition = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <Series>
        {/* SCENE 1: Intro - Walls (Audio ~6s -> 8s total) */}
        <Series.Sequence durationInFrames={240}>
          <Scene
            imageSrc="/assets/scene-1-walls.jpg"
            audioSrc="/assets/scene-1-voice.mp3"
            subtitle="1453... Dünya tarihinin en güçlü surları karşısında herkes 'imkansız' diyordu."
            animation="slowZoomOut"
            transition="fade"
          />
        </Series.Sequence>

        {/* SCENE 2: Fatih (Audio ~4s -> 6s total) */}
        <Series.Sequence durationInFrames={180}>
          <Scene
            imageSrc="/assets/scene-2-fatih.jpg"
            audioSrc="/assets/scene-2-voice.mp3"
            subtitle="Ama 21 yaşındaki bir genç, kaderi değiştirmeye kararlıydı."
            title="II. Mehmet (Fatih) - 21 Yaşında"
            animation="slowZoomIn"
            transition="fade"
          />
        </Series.Sequence>

        {/* SCENE 3: Cannons (Audio ~4.5s -> 7s total) */}
        <Series.Sequence durationInFrames={210}>
          <Scene
            imageSrc="/assets/scene-3-cannons.jpg"
            audioSrc="/assets/scene-3-voice.mp3"
            subtitle="Şahi topları surları döverken, Haliç'e çekilen zincir umutları kırıyordu."
            animation="breathing"
            transition="fade"
          />
        </Series.Sequence>

        {/* SCENE 4: Ships (Audio ~5.6s -> 8s total) */}
        <Series.Sequence durationInFrames={240}>
          <Scene
            imageSrc="/assets/scene-4-ships.jpg"
            audioSrc="/assets/scene-4-voice.mp3"
            subtitle="Ve o efsanevi hamle geldi. Gemiler bir gecede karadan yürütüldü."
            title="Bir Gecede 72 Gemi - Haliç'e İndirildi"
            animation="panRight"
            transition="fade"
          />
        </Series.Sequence>

        {/* SCENE 5: Quote (Audio ~2.5s -> 5s total) */}
        <Series.Sequence durationInFrames={150}>
          <Scene
            imageSrc="/assets/scene-5-flag.jpg"
            audioSrc="/assets/scene-5-voice.mp3"
            subtitle="'Ya ben İstanbul'u alırım, ya da İstanbul beni!'"
            animation="static"
            transition="fade"
          />
        </Series.Sequence>

        {/* SCENE 6: End Card (Audio ~5.4s -> 8s total) */}
        <Series.Sequence durationInFrames={240}>
          <Scene
            imageSrc="/assets/scene-6-mosque.jpg"
            audioSrc="/assets/scene-6-voice.mp3"
            subtitle="29 Mayıs sabahı yeni bir çağ başladı. İstanbul, artık İslam'ın şehriydi."
            animation="slowZoomIn"
            transition="fade"
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
