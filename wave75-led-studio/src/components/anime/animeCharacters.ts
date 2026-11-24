import type { WaveStudioTab } from '../../store/useWaveStore';

export type AnimeCharacterId = 'elaina' | 'quints' | 'nino' | 'miku' | 'mirai';

export interface AnimeCharacterTheme {
  themeNameVi: string;
  themeNameEn: string;
  /** Primary vibrant hex (buttons, active borders, glow) */
  primary: string;
  /** Space-separated or comma RGB for rgba(var(--theme-primary-rgb), alpha) */
  primaryRgb: string;
  /** Soft highlight hex (titles, subtle borders) */
  secondary: string;
  /** Complementary accent hex (gradient end, starlight) */
  accent: string;
  accentRgb: string;
  /** Deep themed canvas background */
  bg: string;
  /** Card glass tint top-left */
  surfaceFrom: string;
  /** Card glass tint bottom-right */
  surfaceTo: string;
  /** Transition shutter middle & bright edge */
  shutterMid: string;
  shutterEnd: string;
  /** Cursor & floating petal canvas colors */
  particleColors: string[];
  /** Ring & cursor glow hex */
  ringHex: string;
}

export interface AnimeCharacterProfile {
  id: AnimeCharacterId;
  name: string;
  shortName: string;
  seriesVi: string;
  seriesEn: string;
  jpTag: string;
  bgImage: string;
  avatarImage: string;
  bgPosition: string;
  accentGradient: string;
  theme: AnimeCharacterTheme;
  welcomeTitleVi: string;
  welcomeTitleEn: string;
  gateIdleVi: string;
  gateIdleEn: string;
  transitionQuoteVi: string;
  transitionQuoteEn: string;
  tabQuotesVi: Record<WaveStudioTab, string>;
  tabQuotesEn: Record<WaveStudioTab, string>;
}

export const ANIME_CHARACTERS: AnimeCharacterProfile[] = [
  {
    id: 'elaina',
    name: 'Elaina',
    shortName: 'Elaina',
    seriesVi: 'Hành trình của Elaina',
    seriesEn: 'Wandering Witch: Elaina',
    jpTag: '魔女の旅々 • 灰の魔女',
    bgImage: '/anime/chars/elaina-bg-opt.jpg',
    avatarImage: '/anime/chars/elaina-avatar.png',
    bgPosition: 'center right',
    accentGradient: 'from-violet-200 via-purple-300 to-amber-200',
    theme: {
      themeNameVi: 'Tím Thạch Anh & Bạc Sao',
      themeNameEn: 'Ashen Amethyst & Starlight',
      primary: '#8b5cf6',
      primaryRgb: '139, 92, 246',
      secondary: '#e9d5ff',
      accent: '#fbbf24',
      accentRgb: '251, 191, 36',
      bg: '#090612',
      surfaceFrom: 'rgba(28, 18, 48, 0.88)',
      surfaceTo: 'rgba(13, 9, 24, 0.93)',
      shutterMid: '#1a1033',
      shutterEnd: '#3b1c6e',
      particleColors: ['#e9d5ff', '#c4b5fd', '#a78bfa', '#fef08a', '#f5f3ff'],
      ringHex: '#a78bfa',
    },
    welcomeTitleVi: 'Hành trình ánh sáng cùng Elaina ✦',
    welcomeTitleEn: 'Journey of Light with Elaina ✦',
    gateIdleVi:
      'Ai là phù thủy tro tàn xinh đẹp nhất ở đây nhỉ? Đúng rồi, là tôi đó~ Cắm cáp USB-C (Fn+5) rồi bấm kết nối để tôi mở phép thuật LED cho phím WAVE75 nào! ✨',
    gateIdleEn:
      'Who is the most charming Ashen Witch here? Yes, it is me~ Plug in USB-C (Fn+5) and connect so I can cast RGB magic on your WAVE75! ✨',
    transitionQuoteVi: 'Phép thuật kết nối hoàn tất! Cùng khám phá Studio nào~ ✨',
    transitionQuoteEn: 'Magic link complete! Let us explore the Studio~ ✨',
    tabQuotesVi: {
      effects: 'Hiệu ứng ánh sáng này đẹp không kém gì phép thuật của tôi đâu nha~ Thử kéo tốc độ xem sao! ✨',
      text: 'Viết tên cậu hay ký tự <3 lên mặt phím đi, giống như viết nhật ký hành trình vậy đó~ 📖',
      gif: 'Mục "🔴 Hợp Phím Đỏ" có 8 mẫu Kiếm Samurai, Hoàng Kim & Trái Tim cực hợp phím Đỏ của cậu đó! ⚔️',
      perkey: 'Tự tay tô màu từng phím như pha chế thuốc phép vậy~ Nhớ lưu vào bộ nhớ phím nhé! 🎨',
      audio: 'Bật giai điệu cậu thích lên nào, cả bàn phím sẽ khiêu vũ theo từng nốt nhạc~ 🎵',
      qmk: 'Đèn Logo CNC trên góc phím chỉnh sang Trắng Tuyết hoặc Vàng 24K sẽ sang trọng cực kỳ luôn! 💎',
      profiles: 'Lưu lại bộ màu yêu thích vào nhật ký hồ sơ để lúc nào cần là đổi ngay trong 1 giây~ 🌸',
    },
    tabQuotesEn: {
      effects: 'These light waves rival my own magic~ Try adjusting speed or crimson-gold hues! ✨',
      text: 'Write your name or <3 on the keys—just like a traveler’s glowing diary~ 📖',
      gif: 'Check "🔴 Red Case Edition"—8 exclusive GIFs tailored for your Red WAVE75! ⚔️',
      perkey: 'Paint each keycap with care, then lock it straight into Flash memory~ 🎨',
      audio: 'Play your favorite music and watch the keyboard dance to the rhythm~ 🎵',
      qmk: 'Tune your physical CNC Logo LED to Snow White or 24K Gold for a classy look! 💎',
      profiles: 'Keep all your favorite lighting recipes saved for 1-click switching~ 🌸',
    },
  },
  {
    id: 'quints',
    name: '5 Chị Em Nakano',
    shortName: '5 Nàng Dâu',
    seriesVi: 'Nhà có 5 nàng dâu',
    seriesEn: 'The Quintessential Quintuplets',
    jpTag: '五等分の花嫁 • 中野家',
    bgImage: '/anime/chars/quints-bg-opt.jpg',
    avatarImage: '/anime/chars/itsuki-avatar.png',
    bgPosition: 'center center',
    accentGradient: 'from-pink-200 via-amber-200 to-rose-300',
    theme: {
      themeNameVi: 'Hồng Hoa Cưới & Vàng Champagne',
      themeNameEn: 'Bridal Sakura & Champagne Gold',
      primary: '#f472b6',
      primaryRgb: '244, 114, 182',
      secondary: '#fbcfe8',
      accent: '#fde047',
      accentRgb: '253, 224, 71',
      bg: '#10070c',
      surfaceFrom: 'rgba(38, 16, 29, 0.88)',
      surfaceTo: 'rgba(18, 8, 14, 0.93)',
      shutterMid: '#2a0e1e',
      shutterEnd: '#5e1a3a',
      particleColors: ['#fbcfe8', '#f9a8d4', '#fde047', '#fff1f2', '#fda4af'],
      ringHex: '#f472b6',
    },
    welcomeTitleVi: 'Nhà có 5 nàng dâu × WAVE75 💐',
    welcomeTitleEn: 'Quintessential Quintuplets × WAVE75 💐',
    gateIdleVi:
      'Cả 5 chị em nhà Nakano (Ichika, Nino, Miku, Yotsuba, Itsuki) đều đang đợi cậu đó! Cắm cáp USB-C (Fn+5) rồi bấm kết nối để mở Studio ngay nhé~ 💖',
    gateIdleEn:
      'All five Nakano sisters are waiting for you! Plug in USB-C (Fn+5) and connect to unlock your WAVE75 Studio~ 💖',
    transitionQuoteVi: 'Hoan hô! Cả 5 chị em chào mừng cậu vào WAVE75 Studio! 💐',
    transitionQuoteEn: 'Yay! All 5 sisters welcome you to WAVE75 Studio! 💐',
    tabQuotesVi: {
      effects: 'Itsuki rất thích tông Đỏ-Vàng ấm áp đó! Cậu thử bật hiệu ứng chảy màu xem bàn phím rực rỡ thế nào nè~ ✨',
      text: 'Viết tên nàng dâu cậu thích nhất lên mặt phím chạy ngang đi nào! (Ví dụ: NINO <3, MIKU <3)~ 💖',
      gif: 'Kho 42 ảnh động có hẳn bộ Trái tim & 🔴 Hợp Phím Đỏ cực lung linh luôn đó cậu ơi! 🎆',
      perkey: 'Cậu có thể tô 5 vùng màu đại diện cho 5 chị em nhà Nakano lên mặt phím luôn đó! 🎨',
      audio: 'Bật OST Nhà có 5 nàng dâu lên để bàn phím nhấp nháy theo nhịp nhạc nha~ 🎵',
      qmk: 'Bật Đèn Logo CNC màu Vàng 24K hoặc Trắng Tuyết sẽ làm nổi bật vỏ Đỏ cực sang luôn! 👑',
      profiles: 'Tạo riêng 5 hồ sơ màu cho 5 chị em rồi đổi qua lại mỗi ngày nhé! 🌸',
    },
    tabQuotesEn: {
      effects: 'Itsuki loves warm Crimson & Gold waves! Try tweaking speed and brightness~ ✨',
      text: 'Scroll your favorite Nakano sister’s name across the keys (e.g. MIKU <3, NINO <3)~ 💖',
      gif: 'Explore 42 animated GIFs including Hearts & the Red Case Edition pack! 🎆',
      perkey: 'Paint 5 color zones representing all 5 Nakano sisters across your keyboard! 🎨',
      audio: 'Play the Quintuplets OST and watch the LEDs pulse to the beat~ 🎵',
      qmk: 'Set the CNC Logo LED to 24K Gold or Snow White to complement the Red case! 👑',
      profiles: 'Save 5 custom profiles—one for each Nakano sister! 🌸',
    },
  },
  {
    id: 'nino',
    name: 'Nino Nakano',
    shortName: 'Nino',
    seriesVi: 'Nhà có 5 nàng dâu',
    seriesEn: 'The Quintessential Quintuplets',
    jpTag: '五等分の花嫁 • 中野二乃',
    bgImage: '/anime/chars/nino-bg-opt.jpg',
    avatarImage: '/anime/chars/nino-avatar.png',
    bgPosition: 'center right',
    accentGradient: 'from-fuchsia-300 via-pink-300 to-sky-300',
    theme: {
      themeNameVi: 'Hồng Cánh Bướm & Xanh Bướm Đêm',
      themeNameEn: 'Ribbon Magenta & Butterfly Cyan',
      primary: '#ec4899',
      primaryRgb: '236, 72, 153',
      secondary: '#f9a8d4',
      accent: '#38bdf8',
      accentRgb: '56, 189, 248',
      bg: '#0d050c',
      surfaceFrom: 'rgba(36, 12, 32, 0.88)',
      surfaceTo: 'rgba(15, 6, 16, 0.93)',
      shutterMid: '#280a24',
      shutterEnd: '#5b1348',
      particleColors: ['#f472b6', '#ec4899', '#38bdf8', '#f9a8d4', '#e879f9'],
      ringHex: '#ec4899',
    },
    welcomeTitleVi: 'Bật LED thật chất cùng Nino 💕',
    welcomeTitleEn: 'Light It Up with Nino Nakano 💕',
    gateIdleVi:
      'Hmph! Đừng có bắt tôi phải chờ lâu đấy nhé! Cắm dây USB-C (Fn+5) rồi bấm kết nối đi, tôi đã chuẩn bị sẵn mấy hiệu ứng cho phím Đỏ cực đẹp cho cậu rồi đây~ 💕',
    gateIdleEn:
      'Hmph! Don’t keep me waiting! Plug in USB-C (Fn+5) and connect—I picked out the best Crimson effects for your Red keyboard~ 💕',
    transitionQuoteVi: 'Cuối cùng cũng chịu kết nối rồi hả! Để tôi chỉ cậu chỉnh cho thật đỉnh~ 💕',
    transitionQuoteEn: 'Finally connected! Now let’s make your keyboard look unstoppable~ 💕',
    tabQuotesVi: {
      effects: 'Phím màu Đỏ thì phải phối ánh sáng thật nổi mới xứng! Thử mấy tông Hồng-Đỏ-Trắng xem nào~ 💕',
      text: 'Gõ chữ "NINO <3" chạy ngang qua bàn phím đi, không là tôi giận thật đó! 🎀',
      gif: 'Mục "🔴 Hợp Phím Đỏ" có Kiếm Samurai Trắng-Đỏ với Trái Tim Kim Cương siêu hợp gu tôi luôn! ♦️',
      perkey: 'Tô màu gọn gàng vào nha, xong rồi bấm "Lưu chạy vĩnh viễn" để bật phím lên là thấy liền! 🚀',
      audio: 'Mở bài nào sôi động lên đi, để đèn phím nhảy cùng tâm trạng của tôi nè~ 🎶',
      qmk: 'Logo CNC mà để màu Hồng Ruby hoặc Trắng tinh là nhìn sang hẳn luôn đó! 💎',
      profiles: 'Lưu cấu hình lại cho đàng hoàng, lần sau đỡ phải chỉnh lại từ đầu nhé~ ✨',
    },
    tabQuotesEn: {
      effects: 'A Red CNC board deserves bold lighting! Try Crimson, Rose & Snow White hues~ 💕',
      text: 'Scroll "NINO <3" across your keys—you better do it! 🎀',
      gif: 'Check "🔴 Red Case Edition"—Crimson Katana & Ruby Diamond Heart are my favorites! ♦️',
      perkey: 'Paint it cleanly, then hit Save Forever so it lights up every time you power on! 🚀',
      audio: 'Put on an upbeat track and watch the RGB dance~ 🎶',
      qmk: 'Ruby Rose or Pure White on the CNC Logo looks super chic on a Red case! 💎',
      profiles: 'Save your best presets so you can swap styles effortlessly~ ✨',
    },
  },
  {
    id: 'miku',
    name: 'Miku Nakano',
    shortName: 'Miku',
    seriesVi: 'Nhà có 5 nàng dâu',
    seriesEn: 'The Quintessential Quintuplets',
    jpTag: '五等分の花嫁 • 中野三玖',
    bgImage: '/anime/chars/miku-bg-opt.jpg',
    avatarImage: '/anime/chars/miku-avatar.png',
    bgPosition: 'center center',
    accentGradient: 'from-sky-200 via-cyan-300 to-indigo-300',
    theme: {
      themeNameVi: 'Xanh Tai Nghe Cobalt & Băng Cyan',
      themeNameEn: 'Headphone Cobalt & Ice Cyan',
      primary: '#38bdf8',
      primaryRgb: '56, 189, 248',
      secondary: '#bae6fd',
      accent: '#818cf8',
      accentRgb: '129, 140, 248',
      bg: '#050a14',
      surfaceFrom: 'rgba(12, 26, 46, 0.88)',
      surfaceTo: 'rgba(7, 14, 28, 0.93)',
      shutterMid: '#0c1c36',
      shutterEnd: '#153b6e',
      particleColors: ['#bae6fd', '#38bdf8', '#67e8f9', '#a5b4fc', '#e0f2fe'],
      ringHex: '#38bdf8',
    },
    welcomeTitleVi: 'Không gian chill cùng Miku 🎧',
    welcomeTitleEn: 'Chill RGB Space with Miku 🎧',
    gateIdleVi:
      'Ưm... cậu cắm dây USB-C vào bàn phím (nhấn Fn+5) rồi bấm nút kết nối bên dưới nhé... mình sẽ ở đây cùng cậu chỉnh màu LED thật đẹp... 🎧✨',
    gateIdleEn:
      'Um... please plug in USB-C (Fn+5) and click connect below... I’ll stay right here and help you tune your LEDs... 🎧✨',
    transitionQuoteVi: 'Kết nối được rồi nè... mình cùng chỉnh đèn bàn phím nhé~ 🎧',
    transitionQuoteEn: 'Connected... let’s customize your keyboard lighting together~ 🎧',
    tabQuotesVi: {
      effects: 'Ánh sáng dịu nhẹ chuyển màu mượt mà nhìn thích mắt lắm đó cậu... 🎧',
      text: 'Cậu thử gõ chữ chạy chậm nhẹ nhàng hoặc bật Đồng hồ LED xem giờ ngay trên phím nè~ 🕒',
      gif: 'Mình thích hiệu ứng Rồng Lửa & Băng với Mưa Trái Tim lắm... cậu bấm thử trong mục Ảnh động GIF xem! 💙❤️',
      perkey: 'Cậu tô màu từng phím theo ý thích đi, mình thấy tông Đỏ pha Xanh băng nhìn độc lạ lắm đó... 🎨',
      audio: 'Mình rất thích nghe nhạc! Bật Nhảy theo nhạc lên để phím rung nhịp cùng tai nghe nhé~ 🎧',
      qmk: 'Đèn Logo CNC để chế độ Nhịp thở chậm (Breathing) nhìn cực kỳ thư giãn luôn~ ✨',
      profiles: 'Lưu lại bộ màu cậu thích nhất nha, lần sau bật lên là có ngay~ 🌸',
    },
    tabQuotesEn: {
      effects: 'Soft, silky flowing lights are so relaxing to watch... 🎧',
      text: 'Try gentle slow scrolling text or the live LED Clock right on your keys~ 🕒',
      gif: 'I really like Fire & Ice Dragon and Floating Hearts in the GIF tab! 💙❤️',
      perkey: 'Paint each key however you like—Red with Ice-Blue accents looks amazing... 🎨',
      audio: 'I love music! Turn on Audio Visualizer so the keys pulse with our playlist~ 🎧',
      qmk: 'Slow Breathing mode on the CNC Logo LED feels super calming~ ✨',
      profiles: 'Save your favorite preset so it is always ready for you~ 🌸',
    },
  },
  {
    id: 'mirai',
    name: 'Mirai Kuriyama',
    shortName: 'Mirai',
    seriesVi: 'Beyond the Boundary (Kyoukai no Kanata)',
    seriesEn: 'Beyond the Boundary',
    jpTag: '境界の彼方 • 栗山未来',
    bgImage: '/anime/chars/mirai-bg-opt.jpg',
    avatarImage: '/anime/chars/mirai-avatar.png',
    bgPosition: 'center center',
    accentGradient: 'from-red-300 via-rose-300 to-amber-200',
    theme: {
      themeNameVi: 'Đỏ Huyết Kiếm & Trắng Tuyết',
      themeNameEn: 'Blood-Blade Crimson & Amber',
      primary: '#ef4444',
      primaryRgb: '239, 68, 68',
      secondary: '#fecaca',
      accent: '#f59e0b',
      accentRgb: '245, 158, 11',
      bg: '#0e0406',
      surfaceFrom: 'rgba(38, 11, 16, 0.88)',
      surfaceTo: 'rgba(18, 5, 8, 0.94)',
      shutterMid: '#2a080d',
      shutterEnd: '#63111c',
      particleColors: ['#fca5a5', '#ef4444', '#f43f5e', '#fde68a', '#fff1f2'],
      ringHex: '#ef4444',
    },
    welcomeTitleVi: 'Huyết Kiếm Đỏ rực cùng Mirai 👓',
    welcomeTitleEn: 'Crimson Blade with Mirai Kuriyama 👓',
    gateIdleVi:
      'Thật bất tiện quá đi mất (Fuyukai desu)! Nhưng mà... bàn phím màu Đỏ của anh hợp với cặp kính đỏ của em lắm luôn đó! Cắm USB-C (Fn+5) rồi kết nối ngay đi nhé~ 👓❤️',
    gateIdleEn:
      'How unpleasant (Fuyukai desu)! Well... actually your Red keyboard matches my red glasses so well! Plug in USB-C (Fn+5) and connect~ 👓❤️',
    transitionQuoteVi: 'Đã kết nối xong! Huyết Kiếm Đỏ sẵn sàng tỏa sáng rồi ạ! ⚔️👓',
    transitionQuoteEn: 'Link established! Crimson Blade is ready to shine! ⚔️👓',
    tabQuotesVi: {
      effects: 'Màu Đỏ Huyết kết hợp tia sáng Trắng nhìn giống thanh kiếm của em quá đi mất! ⚔️',
      text: 'Anh thử gõ "FUYUKAI DESU" hay tên anh chạy ngang mặt phím xem sao nhé~ 👓',
      gif: 'Trong mục "🔴 Hợp Phím Đỏ" có "Kiếm Samurai Trắng-Đỏ" và "Nhật Thực Trăng Máu" chuẩn phong cách Kyoukai no Kanata luôn! 🌑⚔️',
      perkey: 'Em gợi ý tô cụm phím WASD màu Trắng Tuyết trên nền Đỏ Ruby, nhìn cực kỳ nổi bật đó ạ! 🎨',
      audio: 'Bật bài "Daisy" ED của Kyoukai no Kanata lên cho đèn phím nhảy theo nhịp đi anh~ 🎵',
      qmk: 'Đèn Logo CNC để màu Đỏ Ruby hoặc Trắng Tuyết sẽ hợp hoàn hảo với vỏ phím Đỏ của anh! 💎',
      profiles: 'Nhớ bấm "Lưu chạy vĩnh viễn" để lúc nào mở máy bàn phím cũng rực sáng nha~ ✨',
    },
    tabQuotesEn: {
      effects: 'Deep Crimson with sharp White slashes looks just like my blood sword! ⚔️',
      text: 'Try scrolling "FUYUKAI DESU" or your name across the keys~ 👓',
      gif: '"Crimson Katana Slash" & "Blood Moon Eclipse" in Red Edition fit Beyond the Boundary so well! 🌑⚔️',
      perkey: 'Paint WASD Snow White against a Ruby Red base—it pops like crazy! 🎨',
      audio: 'Play "Daisy" from Beyond the Boundary and watch the keys pulse~ 🎵',
      qmk: 'Ruby Red or Snow White on the CNC Logo pairs seamlessly with your Red frame! 💎',
      profiles: 'Hit Save Forever so your custom design boots automatically every time~ ✨',
    },
  },
];

export function getAnimeCharacter(id: string): AnimeCharacterProfile {
  return ANIME_CHARACTERS.find((c) => c.id === id) ?? ANIME_CHARACTERS[0];
}

export type AnimeMotionMode =
  | 'live2d_breathe'
  | 'cinematic_float'
  | 'sakura_wind'
  | 'heartbeat_pulse'
  | 'cyber_hologram'
  | 'still';

export interface AnimeStageSettings {
  motionMode: AnimeMotionMode;
  intensity: number; // 0.4 .. 1.8
  zoom: number; // 100 .. 132 (%)
  studioBackdropOpacity: number; // 10 .. 65 (%)
  customImageUrl: string | null;
}

export const DEFAULT_ANIME_STAGE_SETTINGS: AnimeStageSettings = {
  motionMode: 'live2d_breathe',
  intensity: 1.0,
  zoom: 106,
  studioBackdropOpacity: 28,
  customImageUrl: null,
};

export const ANIME_MOTION_PRESETS: Array<{
  id: AnimeMotionMode;
  nameVi: string;
  nameEn: string;
  icon: string;
}> = [
  { id: 'live2d_breathe', nameVi: 'Thở Live2D 3D', nameEn: 'Live2D 3D Breathe', icon: '✨' },
  { id: 'cinematic_float', nameVi: 'Trôi nổi Điện ảnh', nameEn: 'Cinematic Float', icon: '🎬' },
  { id: 'sakura_wind', nameVi: 'Gió Anh Đào lắc', nameEn: 'Sakura Wind Sway', icon: '🌸' },
  { id: 'heartbeat_pulse', nameVi: 'Nhịp tim Năng lượng', nameEn: 'Heartbeat Pulse', icon: '💓' },
  { id: 'cyber_hologram', nameVi: 'Hologram Quét sáng', nameEn: 'Cyber Hologram', icon: '⚡' },
  { id: 'still', nameVi: 'Tĩnh (Nhẹ nhất)', nameEn: 'Still (Lightest)', icon: '🖼️' },
];

let preloadedOnce = false;
export function preloadAllAnimeAssets(): void {
  if (preloadedOnce || typeof window === 'undefined') return;
  preloadedOnce = true;
  for (const ch of ANIME_CHARACTERS) {
    for (const src of [ch.bgImage, ch.avatarImage]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
    }
  }
}
