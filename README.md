# WAVE75 & WIN60HE WebHID LED Studio

WebHID RGB lighting controller suite for **PMO WAVE75 / Womier RD75** and **AULA WIN 60 HE** mechanical keyboards — built with React 18, TypeScript, Vite, Tailwind CSS, and Zustand.

## Projects Included

### 1. `wave75-led-studio/` — PMO WAVE75 & Womier RD75 Studio
- **Anime Crimson-Sakura UI/UX** with 5 selectable anime companions (**Elaina**, **The Quintessential Quintuplets**, **Nino**, **Miku**, **Mirai**), dynamic per-character color themes, custom SVG Anime Cursor, 2.5D Live2D motion editor, and GPU-composited transitions.
- **42 Built-in Animated GIFs** (including **8 Red Case Edition** effects & **6 Heart/Love** effects) + custom GIF/image upload.
- **LED Text Marquee & 16×6 Pixel Art Designer** (scrolling text, live LED clock, 8 built-in pixel arts, freehand canvas).
- **Playable Interactive LED Snake Game** directly across 60 physical keycaps (`Arrow keys` / `WASD`, normal & golden bonus fruit, AI auto-play, 4 skins).
- **Beginner-Friendly Per-Key Editor** (click/drag brush, right-click erase, 1-click zones, 8 designer palettes, 2-color gradient, 5 onboard Flash slots).
- **Real CNC Wave Logo LED Control** (`funcInfo[11..19]`) + **1-Click Persistent Windows Auto-Start Driver** (runs independently via Windows WMI & primes Flash Slot 1).

```bash
cd wave75-led-studio
npm install
npm run dev
```

### 2. Root (`./`) — AULA WIN 60 HE LED Studio
- WebHID `0xFF1B` lighting controller with smooth ACK-paced RGB streaming, 2D procedural effects, GIF matrix playback, and per-key editing.

```bash
npm install
npm run dev
```
