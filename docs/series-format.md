# Dizi ve bölüm formatı

Her dizi `public/series/<dizi-id>/` altında yaşar. JSON dosyaları **tek doğruluk kaynağıdır**:
insanlar, Claude veya n8n bunları yazar; `check`, `generate-assets`, Remotion ve `render` bunları okur.
Şema: [`src/series/schema.ts`](../src/series/schema.ts) (hatalı bir alan, hangi satırda olduğu söylenerek reddedilir).

```
public/series/<dizi-id>/
├── series.json                 dizi: stil, anlatıcı, codex (karakterler, mekânlar)
├── refs/                       ONAYLI model sheet'ler ve stil kareleri (git'e eklenir)
│   └── _candidates/            model-sheet adayları (git'e eklenmez)
└── episodes/
    └── 01/
        ├── episode.json        bölüm: sahneler ve diyalog
        └── assets/             üretilen görsel/ses/video (git'e eklenmez)
```

## İş akışı

1. **Codex'i yazın** (`series.json`): her karakter için `visual` (İngilizce, kısa ve somut: renk, desen, aksesuar), `voice`, `color`, `notes`.
2. **Model sheet üretin ve onaylayın:**
   `npm run model-sheet -- <dizi> <karakter-id>` → 3 aday → beğendiğinizi `--approve <n>` ile onaylayın.
   Onaylanan görsel `refs/<id>.jpg` olur ve o karakterin göründüğü **her sahnede** görsel modele referans olarak gönderilir.
   Tutarlılığın asıl kaynağı budur — tüm ana karakterler için bölüm üretmeden önce yapın.
3. **Bölümü yazın** (`episodes/NN/episode.json`).
4. **Kontrol edin (ücretsiz):** `npm run check -- <dizi>/<NN>` (`--prompts` ile görsel modele gidecek prompt'ları da görün).
5. **Üretin:** `npm run generate-assets -- <dizi>/<NN>`
6. **Önizleyin:** `npm run dev` → Props panelinde `{ "episode": "<dizi>/<NN>" }`
7. **Render:** `npm run render -- <dizi>/<NN>` → `out/<dizi>-<NN>.mp4`

## series.json

| Alan | Açıklama |
|---|---|
| `id` | Klasör adıyla aynı (`küçük-harf-ve-tire`). |
| `title`, `premise` | Dizinin adı ve bir paragraflık konusu (Claude bölüm yazarken/kontrol ederken kullanır). |
| `style.suffix` | Her görsel prompt'unun sonuna eklenir. Diziyi bir kez kilitleyin, sonra değiştirmeyin. |
| `style.negativeHint` | İstenmeyenler (`Avoid: ...` olarak eklenir). |
| `style.references` | Stil kareleri: her sahneye referans olarak gönderilir. |
| `narrator` | Anlatıcı (isteğe bağlı): `{ "name", "voice", "color" }`. Satırlarda `"speaker": "narrator"`. |
| `codex[]` | Karakterler, mekânlar, nesneler (aşağıda). |
| `generation.costMode` | `budget` (1K görsel), `standard` (2K), `premium` (2K + Hailuo Pro 1080P video). |
| `generation.videoClips` | `true` ise `videoPrompt`'u olan sahneler için görselden video klip üretilir. |

### Codex kaydı

| Alan | Açıklama |
|---|---|
| `id` | Kalıcı kimlik (`kedi-1`). Bölümlerde `cast` ve `speaker` bununla yazılır. Sonradan değiştirmeyin. |
| `type` | `character`, `location`, `object`, `lore`. |
| `name`, `aliases` | Ekranda görünen ad ve diğer adlar. `imagePrompt`'ta geçen adlar otomatik eşleşir (Türkçe harfler normalize edilir, `Mehmed'in` eşleşir, `Osman` ≠ `Osmanlı`). |
| `visual` | İngilizce görünüm tarifi; karakterin göründüğü her prompt'a eklenir. |
| `references` | Onaylı model sheet(ler): `[{ "path": "refs/kedi-1.jpg" }]`. İsteğe bağlı kalıcı `url`. |
| `progressions` | Görünüm değişimi: `[{ "fromEpisode": 3, "visual": "... with a bandaged paw" }]`. |
| `voice` | `{ "kie": "Charlie" }` (Kie.ai üzerinden ElevenLabs ses ADI), isteğe bağlı `elevenLabsId`, `speed` (0.7–1.2), `stability` (0–1). Her karakterin sesi farklı olmalı. |
| `color` | Altyazıdaki isim rengi (`#ffb347`). |
| `notes` | Kişilik, geçmiş, ilişkiler. Görsel modele **gönderilmez**; senaryo ve süreklilik içindir. |

## episode.json

```json
{
  "number": 1,
  "title": "Bölüm adı",
  "summary": "Sonraki bölümlerin süreklilik kontrolü için kısa özet.",
  "scenes": [
    {
      "id": 1,
      "description": "Ne oluyor (iç not)",
      "imagePrompt": "Five street cats huddled around a smartphone in a snowy Moscow alley at dusk ...",
      "cast": ["kedi-1", "kedi-2"],
      "location": "moskova-sokak",
      "animation": "slowZoomIn",
      "minDuration": 3,
      "lines": [
        { "speaker": "narrator", "text": "Moskova. Eksi yirmi derece." },
        { "speaker": "kedi-1", "text": "Şuna bakın!", "pauseAfter": 0.8 }
      ]
    }
  ]
}
```

| Sahne alanı | Açıklama |
|---|---|
| `imagePrompt` | İngilizce sahne tarifi: kompozisyon, eylem, ortam, ışık. Karakterlerin görünümünü yazmayın — codex ekler. |
| `cast` | Görselde **görünen** karakterlerin id'leri. Referansları buna göre gönderilir. |
| `location` | Mekânın codex id'si (varsa). |
| `animation` | `slowZoomIn`, `slowZoomOut`, `panRight`, `panLeft`, `breathing`, `static`. |
| `videoPrompt`, `videoDuration`, `useVideo` | Görselden video (`generation.videoClips: true` iken). |
| `title` | Ekranda başlık. |
| `minDuration` | En kısa süre (sn). Diyalog uzunsa sahne kendiliğinden uzar. |
| `lines[]` | `speaker` (`narrator` veya karakter id), `text` (seslendirilen), isteğe bağlı `subtitle`, `pauseAfter` (sn). |

## Tutarlılık kuralları (kısaca)

- Satır metni veya karakter sesi değişince yalnızca o satırın sesi yeniden üretilir (dosya adı metin + ses hash'idir).
- Codex, stil veya referans değişince etkilenen görseller **eski** olarak raporlanır;
  `npm run generate-assets -- <dizi>/<NN> --regenerate-stale` ile yalnızca onlar yeniden üretilir.
- `generate-assets`, `check` hatası varsa (olmayan karakter, sesi olmayan konuşan, eksik referans dosyası) kredi harcamadan durur.
- Kie.ai'ye yüklenen referanslar ~3 gün sonra silinir; script süresi dolanı otomatik yeniden yükler.
