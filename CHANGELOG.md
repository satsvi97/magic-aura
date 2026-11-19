# Changelog

## 0.3.3 — branches for autumn and sakura

- **New effect `branches`:** dark bare-branch silhouettes hanging from the top corners, generated
  procedurally (recursive tree drawn once into an offscreen canvas), so they scale to any screen
  without assets and cost nothing per frame.
- Added to `autumn` and `sakura` scenes; the effect is parameterised (`color`, `alpha`, `depth`,
  `scale`, `sides: left/right/top`) so it can be dropped into any scene.

## 0.3.2 — self-healing layer geometry

- **The layer now corrects its own position.** When SillyTavern moves its panels (mobile drawer,
  sidebar, moving UI) it can leave a `transform` on an ancestor, and a `position: fixed` overlay
  then drifts and gets clipped. The engine measures the layer's real position on every tap, once a
  second and every half second while animating, and compensates with an opposite translation.
- **New button «Починить слой»** in the settings panel — re-measures and redraws the layer instantly,
  without reloading the whole app.
- The compensation accumulates instead of re-measuring from scratch, so it no longer oscillates
  (apply → looks fine → remove → shift back).

## 0.3.1 — mobile compositing fixes

- **Light shafts rebuilt on canvas.** The `sunny` scene used a CSS `mask-image` over a
  `repeating-linear-gradient`; on mobile GPUs that combination produced big rectangular,
  hard-edged colour patches over the chat. Now the beams are drawn once into a canvas and
  composited as a single image — no masks, no repeating gradients.
- **Film grain no longer uses `mix-blend-mode: overlay`.** Blending over the chat's
  `backdrop-filter` was the second suspected source of the same rectangular artifacts.
- The `sunny` sky itself is darker, so it reads as light in the room instead of a bright blob.

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
