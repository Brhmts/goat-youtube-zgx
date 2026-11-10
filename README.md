# goat-youtube

Yapay zekâ ile kısa belgesel videoları üreten bir [Remotion](https://remotion.dev) projesi.
Her sahne için görsel (nano-banana-2), görselden video (Hailuo 2.3) ve Türkçe seslendirme
(ElevenLabs) [Kie.ai](https://kie.ai) üzerinden üretilir, Remotion ile altyazılı bir videoya dönüştürülür.

## Kurulum

```bash
npm install
cp .env.example .env   # KIE_AI_API_KEY değerini doldurun
```

## Kullanım

1. **Projeyi seçin:** `src/data/current-video.ts` tek doğruluk kaynağıdır. Sahneler
   `src/data/*.ts` dosyalarında tanımlanır (örnek: `osmanli-data.ts`).
2. **Asset üretin:** `npm run generate-assets`
   - Dosyalar `public/assets/<projectId>-scene-<id>-{image.jpg,video.mp4,voice.mp3}` olarak kaydedilir.
   - Tekrar çalıştırmak güvenlidir: hazır dosyalar atlanır, yarım kalan Kie.ai görevleri devam ettirilir,
     başarısız adımlar yeniden denenir. Eksik kalan bir şey varsa script 1 koduyla çıkar.
3. **Önizleyin:** `npm run dev` (Remotion Studio)
4. **Render alın:** `npm run render` → `out/<projectId>-final.mp4`
   - Video en fazla 60 sn'lik parçalar halinde (sahne sınırlarından) render edilip birleştirilir.
     `MAX_PART_SEC=120 npm run render` ile parça süresi değiştirilebilir.

## Nasıl çalışır?

- **Sahne süresi:** `duration` minimum süredir. Seslendirme daha uzunsa sahne otomatik olarak
  ses süresi + 0,6 sn'ye uzatılır (`src/calculate-metadata.ts`). Cümleler kesilmez.
- **Eksik asset'ler:** Video klibi yoksa sahne görselle (Ken Burns animasyonu) gösterilir;
  görsel de yoksa yer tutucu gösterilir ve konsola uyarı yazılır.
- **Video klipleri:** Klibin donan son saniyesi gösterilmez. Sahne klipten uzunsa klip yavaşlatılır,
  yine yetmezse döngüye alınır.
- **Ayarlar:** FPS, çözünürlük (1920×1080) ve zamanlama sabitleri `src/config.ts` içindedir.
- **Maliyet modu** (`costMode`): `budget` = 1K görsel + Hailuo standard 768P,
  `standard` = 2K + standard 768P, `premium` = 2K + Hailuo Pro 1080P.

## Notlar

- Kie.ai'nin sonuç URL'leri geçicidir. Görselden video adımı günler sonra çalıştırılırsa URL'nin süresi
  dolmuş olabilir; script bunu bildirir. Görseli silip yeniden çalıştırmak yeterlidir.
- Seslendirme önce Kie.ai üzerinden denenir (`ELEVENLABS_VOICE_NAME`); `ELEVENLABS_API_KEY` tanımlıysa
  başarısızlıkta doğrudan ElevenLabs'e (`ELEVENLABS_VOICE_ID`) düşer.
