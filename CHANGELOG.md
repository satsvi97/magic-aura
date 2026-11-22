# Changelog

## 0.6.1 — quiet sky, lighter engine

**Look**
- **No more glowing ball in «Северное сияние»** — the moon is gone, only the curtains and stars remain;
  the aurora itself drifts slower and smoother.
- **Night moon is now a soft light, not a disc:** no hard sphere, just a faint halo. It still follows
  the hour, just without the “lamp” glare.
- **Sending a message really does tear leaves across the screen now** (they spawn inside the frame,
  not off-screen), and on sky scenes it also sends a shooting star. `window.MagicAura.burst('send')`
  exists for testing.

**Performance**
- **Own frame limiter.** Before, the loop ran at the display rate — 165/240 Hz monitors meant
  165/240 redraws per second. Now 60 fps, 40 on touch screens, 30 in Lite, 20 when the window is not
  focused.
- **Pixel budget for the canvas:** max ~3.2 Mpx, touch DPR capped at 1.25, Lite at 1.0 — 4K screens
  no longer get an 8–18 Mpx buffer.
- **Batched drawing:** stars, snow, rain and dust now draw in 3–4 grouped paths instead of one
  `fill`/`stroke` per particle (200+ calls per frame → handful).
- **No gradients inside the frame:** mist, heat shimmer and ground fog use pre-built sprites;
  the fog veil gradient is cached.
- **Touch screens get Lite-level particle budgets automatically**; weak devices (≤4 cores / ≤3 GB)
  start in Lite on first run.
- **Layers merged.** Tint, shade, vignette and grain were four full-screen divs; now one
  `.atmos-paper` with four background layers. This is what removed most of the compositing cost.
- Layers are isolated with `contain: paint` so the changing canvas no longer repaints the static sky.
- The Shade slider now actually works (before, the overlay had no background and the value went nowhere).

Measured in headless Chrome (software raster, so real GPUs are cheaper). Desktop 1400×900, aurora:
**~5.8% of one core** (1.2% JS) after the changes, versus ~25% before the batching and ~56% before the
layer merge. A 4× CPU-throttled 390×844 session (a stand-in for a weak phone): **~30% of one core**
with aurora, ~27% with rain, ~23% in Lite — previously ~96%. Idle (aura off) is ~0%.

## 0.6.0 — living atmosphere

Everything below is optional and switchable: public extension, so the new effects must never tax a
phone that did not ask for them.

- **Toggle «Параллакс от мыши»** (`parallax`): mist, branches, aurora, crows and dust drift in
  layers with the cursor. Desktop only, off in Lite and on touch devices.
- **Toggle «Реакция на сообщения»** (`interactive`): sending a message throws a gust through leaves
  and snow and pushes rain sideways; receiving one gives a soft warm flash, a burst of embers and a
  flare of dust. Off = zero extra work.
- **Toggle «Сутки по часам сцены»** (`dayCycle`): the sky is tinted by the hour from Scene Panel
  (`sessionHour`, or the time-of-day text as a fallback). Changes slowly, cost is one CSS overlay.
- **New scene «Северное сияние»** with procedural aurora curtains (one offscreen sprite, three
  additive passes).
- **New effect `celestial`:** moon and sun discs on an arc that follows the hour, replacing the flat
  CSS moon in night scenes.
- **New effect `dustlight`:** glowing dust that brightens near the cursor and flashes on a received
  message — in candle rooms, halls, the forest, the garden and sunny days.
- **New effect `crows`:** rare flocks of silhouettes across the frame (forest, autumn, garden).
- Night and Starfall also get occasional shooting stars.

## 0.5.1 — Scene Panel actually reads the open chat

- **Fixed: with Scene Panel sync on, the scene was stuck on «Облачно».** SillyTavern replaces
  `chat_metadata` on every chat load/save, while the extension kept a reference taken at page load.
  It was reading the metadata of a long-gone chat (empty), and the empty state fell back to
  `cloudy`. The engine now reads the live `chat_metadata` binding and refreshes the ST context on
  every chat change.
- **Empty panel state no longer paints the tavern grey:** if nothing in the panel is recognised,
  the current scene stays as it is (no forced cloudy).
- **A manually picked scene is now locked for real:** it disables both Scene Panel sync and the
  “react to text” mode, so the scene no longer drifts away on the next message.
- Per-chat scene memory now saves into the live metadata object instead of a stale one.
- Settings hint explains the case: “Scene Panel: … → не распознано”.

## 0.5.0 - smooth scene changes, smarter Scene Panel picks

- **Scenes now dissolve into each other.** Particles live in two stacked canvases: the new scene is
  built in the second one, CSS fades the old out and the new in (~0.55 s), and the sky gradients
  cross-fade (~0.8 s). No flash, no mist jumping from full to zero.
- **Night no longer turns into a grey day.** Neutral weather (`cloudy`, `clear` / `sunny`) cannot
  override place and time of day any more: night → night sky, dawn → fog, sunset → warm light.
  Storms, rain, snow, hail and blizzard still take the whole picture. Interiors such as
  “башня”, “замок”, “дворец”, “храм”, “комната” now read as a candlelit room instead of falling
  through to overcast.
- **Text matching is scored**, not “first keyword wins”: the scene with the most matching words
  wins, and words near the start of a message weigh a little more. “Night in a tower” stops
  turning into a forest with fireflies just because “forest” was mentioned once.
- With the **Debug** setting on, the console prints the Scene Panel state and the scene chosen
  from it — enough to see why a particular sky won.

## 0.4.0 — two-way link with Scene Panel

- **Scene Panel now talks back.** The panel dispatches `scene-panel:update` after every scene change
  (tag, field edit, reset, chat switch), and Magic Aura applies it immediately instead of waiting for
  its two-second metadata poll. The poll stays as a fallback for older panel versions.
- **Public API `window.MagicAura`:** `getState()`, `sync(force?)`, `setSyncPanel(on)`, `setScene(id)`,
  `open()`, plus the `magic-aura:ready` and `magic-aura:state` events — so other extensions can read
  and drive the atmosphere without touching internals.
- Scene Panel has its own **"✨ scene background (Magic Aura)"** checkbox and a status line
  (“sync on / paused / not installed”); turning it off calls `setSyncPanel(false)`, turning it on
  pulls the current scene at once.
- **New scenes no longer need a mapping edit.** Anything the weather/place maps miss is matched
  against every scene's own `keywords`, so a scene added to `scenes.js` starts working from Scene
  Panel immediately. A scene can also be named outright with the custom field `аура=…` (id, name or
  word: `аура=сакура`, `аура=торт`); re-declaring it re-applies the scene, while a weather/place
  change afterwards takes over again.
- `matchScene` now prefers the longest keyword on a position tie (`звёздопад` beats `звёзд`) and
  treats `ё` and `е` as the same letter.
- Fixed: a place of just “море” (sea) was not recognised and fell through to the default sky.

## 0.3.5 — fewer, smaller branches

- Cut the branches down again: length is now capped at 10% of width / 7.5% of height, strokes are
  thinner, so only short twigs peek from the top corners.

## 0.3.4 — smaller branches

- **Branches are now small twigs in the top corners** instead of half-screen canopies: the length
  is capped against both width and height (13% / 10%) and the stroke is thinner, so they read as a
  hint and never crawl over the chat.
- Length is no longer based on the shorter side alone, so on phones the twigs stay visible while
  staying proportional.

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
