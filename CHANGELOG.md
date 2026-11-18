# Changelog

## 0.3.0 — Scene Panel sync and new scenes

- **Scene Panel integration.** Magic Aura reads `chat_metadata.scene_panel` (weather, place,
  timeOfDay, mood) and picks the atmosphere itself: weather drives particles, place drives the look,
  time of day drives the sky, mood adjusts the shade. Read-only — nothing is written into Scene
  Panel. Manual scene choice turns the sync off; the “Sync with Scene Panel” checkbox turns it back on.
- **New scenes (22 total):** `cloudy`, `sunny` (light shafts through a mask), `hail`, `blizzard`,
  and `birthday` — candles and cake, added as a gift.
- **New effects:** `ash` (slow grey flakes), `groundm` (dense low mist along the bottom),
  `hail` (fast, with bounces and impact rings).
- **Wind gusts** for snow, leaves, ash and low mist — falling particles now move in waves instead of
  drifting in a straight line.
- Sky layers support an optional CSS mask — used for the light shafts fading downwards.

## 0.2.1 — mobile and resize fixes

- **Layer no longer stops above the message input on phones.** Mobile webviews under-report the
  viewport (after the keyboard opens `visualViewport`/`innerHeight` stay small); the layer now takes
  the maximum of all size sources, re-measures its own box and has a `100dvh` floor in CSS.
- **No floating button on phones/tablets.** Below 1000 px wide the corner button and its popover are
  hidden — it covered the send button. Scenes live in the extension settings drawer, like other
  extensions. Desktop keeps the button.
- **Magic trails can no longer streak across the screen** after a resize, rotation or address-bar
  collapse: trail particles are re-seeded instead of keeping points in the old coordinate space.
- Settings panel: mobile hint in the drawer, desktop-only controls hidden on phones.

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
