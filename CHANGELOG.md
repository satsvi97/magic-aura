# Changelog

## 0.2.0 — first public release

- **17 scenes**: night, storm, rainy, snow, fog, campfire, candle, deep, neon, starfall, forest, desert, desert_night, autumn, garden, sakura, arcane.
- Effects: rain, snow, mist, stars, meteors, lightning, embers, motes, fireflies, bubbles, plankton, dunes, blowing sand, heat shimmer, leaves, petals, magic trails with tails, swirling sparks.
- Scene = sky (CSS) + particles (one canvas) + grade (tint and shade).
- Layer switch: **background only** or **above the chat**.
- Settings drawer in SillyTavern style: collapsible `✦ MAGIC AURA ✦` block with version badge.
- Sliders: density, opacity, speed, particle size, scene background, shade.
- Lite mode, per-chat scene, reaction to message text (20 s cooldown).
- Slash commands: `/aura` (aliases `/atmos`, `/аура`, `/атмос`).
- Diagnostics: «Layer bounds» draws the layer frame and its size.
- Robust sizing through `visualViewport` — overlay always matches the window.
- `prefers-reduced-motion` support, pause on hidden tab, DPR cap 1.5.

## 0.1.0 — internal prototype

- Engine, 11 starting scenes, settings panel, floating button, `/atmos` command.
- Debug pass on headless Chrome: sky weights, ember sprites, panel layout.

## Planned — 0.3.0

- Overlay textures: frost, glass drops, film grain, paper (drawn by Selena's Tavern).
- Ambient sound loops (local files, no CDN).
- Extension icon and floating-button icon.
- More effects: falling ash, hail, petals in wind gusts.
