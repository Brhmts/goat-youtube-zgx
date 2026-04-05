import type { SceneData } from '../types/VideoData';

/**
 * Osmanlı'nın Yükselişi — 14 sahne x 5s = 70 saniyelik belgesel
 *
 * Stil: Sinematik oil painting, tutarlı palet (altın, koyu kırmızı, sıcak tonlar)
 * Hybrid: Kilit sahneler video klip, geçiş sahneleri Ken Burns animasyonu
 * Budget mode: 1K görsel + standard video model
 */

// Style suffix — tüm image prompt'lara eklenir, tutarlılık sağlar
export const OSMANLI_STYLE = {
    suffix: 'classical oil painting style, warm golden and deep crimson palette, dramatic chiaroscuro lighting, museum quality masterpiece, consistent painterly aesthetic',
    negativeHint: 'no photorealistic, no cartoon, no anime, no 3D render',
};

export const osmanliScenes: SceneData[] = [
    // ═══ GİRİŞ ═══
    {
        id: 1,
        duration: 5,
        description: "Hook: Osmanlı tuğrası",
        imagePrompt: "Majestic Ottoman tughra calligraphy glowing with golden light on aged dark parchment, ornate Islamic geometric patterns surrounding it, dust particles floating in dramatic volumetric light rays",
        videoPrompt: "Slow cinematic dolly zoom into the golden calligraphy, dust particles drifting gently through light rays, subtle golden light pulsing, atmospheric and mysterious",
        voiceText: "Bir çadırdan doğdu. Üç kıtaya yayıldı. Altı yüz yıl boyunca tarihin akışını değiştirdi. Bu, Osmanlı'nın hikâyesi.",
        useVideo: true,
        animation: 'slowZoomIn',
    },
    {
        id: 2,
        duration: 5,
        description: "Anadolu bozkırı, 13. yüzyıl",
        imagePrompt: "Vast Anatolian steppe at golden hour, nomadic Turkish horsemen silhouettes riding across the plains, distant mountains, dramatic clouds, epic landscape",
        videoPrompt: "Gentle camera pan right following the horsemen, grass swaying in wind, horse manes flowing, clouds drifting slowly, dust trail behind riders",
        voiceText: "13. yüzyıl. Moğol istilası Anadolu'yu alt üst etmiş, Selçuklu Devleti çökmekteydi. Kaos içinde küçük Türkmen boyları hayatta kalmaya çalışıyordu.",
        useVideo: true,
        animation: 'panRight',
    },

    // ═══ KURULUŞ ═══
    {
        id: 3,
        duration: 5,
        description: "Ertuğrul Gazi",
        imagePrompt: "Portrait of a noble Turkish tribal leader on horseback, weathered face with wise eyes, wearing simple but dignified armor, holding a sword, Anatolian highlands behind him, dramatic rim lighting",
        videoPrompt: "Very subtle camera drift forward, horse breathing and shifting weight, leader's cloak moving slightly in wind, atmospheric haze in background slowly shifting",
        voiceText: "Ertuğrul Gazi, Kayı boyunun başındaki bir savaşçıydı. Bizans sınırında küçük bir uç beyliği kurdu. Kimse bilmiyordu ki bu mütevazı başlangıç, tarihin en büyük imparatorluklarından birine dönüşecek.",
        useVideo: false, // Ken Burns — budget
        animation: 'slowZoomIn',
    },
    {
        id: 4,
        duration: 5,
        description: "Osman Bey — Kurucu",
        imagePrompt: "Young Ottoman warrior Osman standing on a hilltop overlooking a fortified Byzantine town, dawn breaking behind him casting long shadows, his hand resting on sword hilt, determined expression, epic composition",
        videoPrompt: "Slow crane up revealing the landscape below, dawn light gradually intensifying, wind moving his cloak, birds flying in distant sky",
        voiceText: "Oğlu Osman, babasının mirasını bir devlete dönüştürdü. Rüyasında gördüğü çınar ağacı gibi, küçük beylik köklendi ve dallanmaya başladı. Tarih onu Osmanlı Devleti'nin kurucusu olarak yazacaktı.",
        useVideo: true,
        animation: 'slowZoomOut',
    },
    {
        id: 5,
        duration: 5,
        description: "İlk fetihler — Bursa",
        imagePrompt: "Panoramic view of ancient Bursa city with Ottoman army approaching its gates, green mountains behind, Ottoman banners waving, siege towers and soldiers in formation, dramatic sky",
        videoPrompt: "Slow dramatic push forward toward the city gates, Ottoman banners rippling in wind, soldiers marching, dust rising from army movement",
        voiceText: "1326'da Bursa fethedildi ve ilk başkent oldu. Osmanlılar artık sadece bir boy değil, bir devletti. Ve bu devletin gözü çok daha büyük hedeflerdeydi.",
        useVideo: false, // Ken Burns
        animation: 'slowZoomIn',
    },

    // ═══ YÜKSELİŞ ═══
    {
        id: 6,
        duration: 5,
        description: "Rumeli'ye geçiş",
        imagePrompt: "Ottoman warships crossing the Dardanelles strait at night, torches illuminating wooden ships, moonlight reflecting on dark waters, soldiers silhouettes on deck, dramatic and tense atmosphere",
        videoPrompt: "Gentle forward drift on water surface, torchlight flickering and reflecting on waves, ships rocking subtly, smoke wisps rising from torches",
        voiceText: "Orhan Gazi'nin oğulları denizi aştı. Osmanlılar Avrupa'ya adım attı. Rumeli fethedildikçe, küçük beylik artık iki kıtaya hükmeden bir güce dönüşüyordu.",
        useVideo: true,
        animation: 'panRight',
    },
    {
        id: 7,
        duration: 5,
        description: "Kosova Savaşı 1389",
        imagePrompt: "Epic battlefield scene of the Battle of Kosovo 1389, thousands of Ottoman and Serbian soldiers clashing, dramatic dust clouds, arrows filling the sky, Sultan Murad I commanding from horseback, blood-red sunset",
        videoPrompt: "Slow dramatic zoom in through the chaos, dust and smoke swirling, arrows arcing through sky in slow motion, banners whipping violently",
        voiceText: "1389, Kosova Ovası. Sultan Birinci Murad, Balkan ittifakını büyük bir meydan savaşında yendi. Zafer kazanıldı, ama Sultan savaş meydanında şehit düştü. Osmanlı, kanla büyüyordu.",
        useVideo: true,
        animation: 'breathing',
    },
    {
        id: 8,
        duration: 5,
        description: "Yıldırım Bayezid",
        imagePrompt: "Powerful Ottoman Sultan Bayezid I on a throne, surrounded by war trophies and maps, intense fierce expression, ornate palace interior with Islamic architectural details, candlelight creating dramatic shadows",
        videoPrompt: "Very slow dolly in toward the sultan's face, candlelight flames flickering and dancing, shadows shifting on walls, subtle smoke from incense drifting",
        voiceText: "Yıldırım lakaplı Bayezid, ordularını şimşek hızıyla hareket ettirdi. Anadolu beylikleri tek tek boyun eğdi. Ama Timur'la karşılaşmak, imparatorluğu duraklama noktasına getirecekti.",
        useVideo: false, // Ken Burns
        animation: 'slowZoomIn',
    },

    // ═══ ZİRVE ═══
    {
        id: 9,
        duration: 5,
        description: "Fatih — Genç komutan",
        imagePrompt: "Young Sultan Mehmed II at age 21, standing before massive military maps and siege plans, intense calculating eyes, wearing ornate Ottoman royal armor, war council room lit by oil lamps",
        videoPrompt: "Slow orbit camera movement around the young sultan, oil lamp flames flickering, map scrolls rustling slightly, shadows rotating on stone walls",
        voiceText: "Ve sonra, yirmi bir yaşında bir genç tahta çıktı. Herkes onu küçümsedi. Ama Sultan İkinci Mehmed'in aklında tek bir şey vardı: bin yıllık Konstantinopolis'i almak.",
        useVideo: true,
        animation: 'slowZoomIn',
    },
    {
        id: 10,
        duration: 5,
        description: "İstanbul'un Fethi 1453",
        imagePrompt: "Epic scene of the Fall of Constantinople 1453, massive Ottoman cannons firing at Theodosian walls, explosions and smoke, thousands of soldiers storming breaches, Ottoman ships in Golden Horn, most epic moment in history, fire and smoke",
        videoPrompt: "Dramatic slow push through smoke and chaos, cannon fire flashes illuminating the scene, debris falling in slow motion, smoke billowing, ground shaking atmosphere, absolutely epic and cinematic",
        voiceText: "29 Mayıs 1453. Toplar gürledi, surlar çatırdadı. Bin yıldır düşmemiş şehir, Osmanlı'nın önünde diz çöktü. Konstantinopolis artık İstanbul'du. Ve dünya artık eskisi gibi olmayacaktı.",
        useVideo: true,
        animation: 'breathing',
    },
    {
        id: 11,
        duration: 5,
        description: "Ayasofya'da ilk namaz",
        imagePrompt: "Interior of Hagia Sophia transformed into a mosque, golden light streaming through windows, Sultan Mehmed II standing in prayer, massive dome above, dust particles in light beams, sacred and triumphant atmosphere",
        videoPrompt: "Slow majestic crane up revealing the enormous dome, golden light beams slowly shifting angle, dust particles floating serenely, peaceful and awe-inspiring",
        voiceText: "Fatih, Ayasofya'ya girdiğinde secdeye kapandı. Bir çağ kapanmış, yeni bir çağ başlamıştı. Osmanlı artık bir cihan devletiydi.",
        useVideo: true,
        animation: 'slowZoomOut',
    },

    // ═══ ALTIN ÇAĞ ═══
    {
        id: 12,
        duration: 5,
        description: "Kanuni Sultan Süleyman",
        imagePrompt: "Sultan Suleiman the Magnificent in full royal regalia, sitting on golden throne in Topkapi Palace throne room, magnificent jeweled crown, wise powerful expression, courtiers bowing, opulent Islamic interior architecture",
        videoPrompt: "Very slow dolly zoom in toward the sultan on throne, jewels and gold surfaces catching light with subtle gleams, courtiers making small gestures, incense smoke drifting",
        voiceText: "Kanuni Sultan Süleyman döneminde Osmanlı zirveye ulaştı. Viyana kapılarından Bağdat'a, Kuzey Afrika'dan Kırım'a. Hukuku, sanatı ve ordusuyla dünyanın en güçlü devletiydi.",
        useVideo: false, // Ken Burns
        animation: 'slowZoomIn',
    },
    {
        id: 13,
        duration: 5,
        description: "İmparatorluk haritası",
        imagePrompt: "Ornate antique Ottoman map showing the empire at its peak spanning three continents, decorated with golden Islamic calligraphy borders, compass rose, illustrated ships on seas, territories highlighted in crimson and gold, aged parchment texture",
        videoPrompt: "Slow smooth pan across the map from west to east, revealing territory by territory, parchment texture visible, golden calligraphy elements subtly gleaming",
        voiceText: "Üç kıta, yirmi dokuz eyalet, sayısız millet. Osmanlı, farklı dinleri ve kültürleri bir arada tutan eşsiz bir sistem kurmuştu. Bu düzen yüzyıllarca ayakta kalacaktı.",
        useVideo: false, // Ken Burns
        animation: 'panRight',
    },

    // ═══ KAPANIŞ ═══
    {
        id: 14,
        duration: 5,
        description: "Miras — Kapanış",
        imagePrompt: "Stunning Istanbul skyline at golden sunset, silhouette of Blue Mosque and Hagia Sophia minarets against dramatic orange sky, Bosphorus reflecting golden light, birds flying, timeless and eternal atmosphere",
        videoPrompt: "Slow gentle crane up over the Bosphorus, golden sunset light slowly intensifying, mosque silhouettes becoming more dramatic, birds gliding gracefully, water reflecting light, serene and eternal closing shot",
        voiceText: "Bir çadırdan başlayan yolculuk, altı asırlık bir imparatorluğa dönüştü. Osmanlı yıkıldı ama mirası yaşıyor. Bu topraklarda, bu taşlarda, bu hafızada. Tarih unutmaz.",
        useVideo: true,
        animation: 'slowZoomOut',
    },
];
