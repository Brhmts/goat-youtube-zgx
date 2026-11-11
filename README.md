# goat-youtube

Yapay zekâ ile **diyaloglu 2D animasyon dizileri** (ve anlatımlı belgeseller) üreten bir
[Remotion](https://remotion.dev) projesi. Sahne görselleri (nano-banana-2), isteğe bağlı görselden video
(Hailuo 2.3) ve her karakter için ayrı ses (ElevenLabs) [Kie.ai](https://kie.ai) üzerinden üretilir;
Remotion bunları konuşan adıyla altyazılı, 1920×1080 bir bölüme dönüştürür.

## Kurulum

```bash
npm install
cp .env.example .env   # KIE_AI_API_KEY değerini doldurun
```

## Kullanım

```bash
npm run check -- moskova-kedileri/01            # ücretsiz tutarlılık kontrolü (+ --prompts)
npm run model-sheet -- moskova-kedileri kedi-1  # karakter model sheet adayları → --approve <n>
npm run generate-assets -- moskova-kedileri/01  # ses + görsel (+ video) üretimi
npm run dev                                      # Remotion Studio önizleme
npm run render -- moskova-kedileri/01           # → out/moskova-kedileri-01.mp4
```

Dizi ve bölüm dosyalarının biçimi, iş akışı ve tutarlılık kuralları: **[docs/series-format.md](docs/series-format.md)**

## Diziler

| Dizi | Durum |
|---|---|
| `moskova-kedileri` | İskelet: 5 kedi için yer tutucu codex + biçim örneği pilot bölüm. Karakter detaylarını `series.json`'a yazın. |
| `osmanli` | Anlatımlı belgesel, bölüm 1 (eski Osmanlı videosu yeni biçime çevrildi). |
| `ai-wars` | Anlatımlı belgesel, bölüm 1 (eski AI Savaşları videosu). |

## Nasıl çalışır?

- **Karakter tutarlılığı:** Her karakterin codex'te sabit bir tarifi ve onaylı bir model sheet'i olur. Bir sahnede
  görünen herkesin model sheet'i görsel modele referans olarak gönderilir (en fazla 14), tarifleri prompt'a eklenir.
- **Diyalog:** Her satır konuşanın kendi sesiyle ayrı kaydedilir, sırayla çalınır; altyazıda konuşanın adı kendi
  renginde görünür. Sahne süresi diyaloğun süresi kadardır (`minDuration`'dan kısa olmaz). Bölüm süresi bu yüzden
  konuya göre kendiliğinden belirlenir.
- **Eksik asset'ler:** Ses yoksa altyazı metin uzunluğuna göre zamanlanır (TTS'siz önizleme); video yoksa görsel,
  görsel yoksa yer tutucu gösterilir.
- **Ayarlar:** FPS, çözünürlük ve zamanlama sabitleri `src/config.ts` içindedir.

## Eski tek videolu düzenden geçiş

Eski `public/assets/<projectId>-scene-N-*` dosyaları varsa (parası ödenmiş görseller/sesler), yeniden üretmeden taşıyın:

```bash
npm run migrate-legacy -- osmanli-v2 osmanli/01
```

## Notlar

- Kie.ai'nin sonuç ve yükleme URL'leri geçicidir (~3 gün); script süresi dolanı yeniden yükler.
- Seslendirme önce Kie.ai üzerinden denenir; `ELEVENLABS_API_KEY` tanımlıysa başarısızlıkta doğrudan ElevenLabs'e düşer
  (bunun için karaktere `elevenLabsId` yazın).
- Render için Chrome'u Remotion indirir; kurulu bir Chrome kullanmak için `REMOTION_BROWSER_EXECUTABLE` ayarlayın.
