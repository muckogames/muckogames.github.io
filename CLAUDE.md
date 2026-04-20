# Mucko's Games — Reference Guide

## Preface

Mucko's Games is a personal family game collection — twelve browser games built and
iterated over time, all playable from a single PIN-gated homepage (`index.html`). The
games are made to be played on an old iPad by kids and adults alike, mostly in the
evenings or on road trips. The "Mucko" brand is a family nickname; several games star
family members (Pflueger) or recurring invented characters (Samster, Lekan, Duck Dieb).

Every game is a self-contained static HTML/JS/CSS file — no build step, no server, no
dependencies. You open the file in a browser and the game runs. This is an intentional
constraint: it keeps deployment trivial and means anyone can read (and edit) the whole
game in one file.

**The audience for this document** is primarily a coding agent or developer who will work
on one or more of these games. Read the technical sections carefully — the iOS 12 Safari
target has sharp edges. The game descriptions and character guide are also here to give
you enough context to make creative decisions that fit the existing universe.

---

## The Games

There are two architectural families: **canvas games** (a fixed logical resolution scaled
via CSS transform to fit the viewport) and **DOM-Trail games** (HTML layout with a
transform-scaled container). Knowing which type a game is matters before editing.

### Trail Series (Oregon Trail–style resource management)

These share a structure: choose difficulty → manage resources across a journey → make
choices at events/stops → reach the destination. Each has at least one original minigame.
Most are **DOM-based** (HTML + CSS for the main screens, canvas only for specific
minigames or animations).

---

#### Airplane Trail (`airplanetrail.html`) — ~1,600 lines  · **DOM + canvas animations**

Fly the **R.M.A.S. Mucko**, a steampunk brass airship, across the Atlantic from
Southampton to New York. Manage fuel, food, hull, and crew health over several days.
Three difficulty tiers: First Class, Second Class, Steerage (affects starting supplies and
gold multiplier). A throttle control (Economy / Cruising / Full Throttle) trades fuel
burn for speed. Wireless telegraph messages add flavor (sky-whales, ice warnings from
other ships). Includes an animated arrival canvas (Manhattan skyline, Statue of Liberty,
confetti) and a flying-plane animation during transit.

**Resources:** fuel, food, hull, crew morale  
**Special mechanic:** throttle; wireless telegrams as event flavor

---

#### Titanic Trail (`ttrail/onlineGame/`) — ~820px container  · **DOM**

Oregon Trail on the Titanic's Atlantic crossing. The oldest game in the repo. Has a
Java server file (`TitanicTrail.java`, ~2,000 lines) from a planned multiplayer version;
the HTML client runs fully standalone. Includes a sailing canvas animation during the
voyage screen and a high scores table.

**Note:** This game predates the shared conventions. It does not follow the `visualViewport`
resize pattern or use `mucko-engine.js`. The Java file is legacy and unused.

---

#### Train Trail (`traintrail/index.html`) — ~1,700 lines  · **DOM + canvas animations**

Drive a steam locomotive across the impossible **Trans-Atlantic Bridge** from Boston
to Leipzig, Germany. Oregon Trail events, but many are nautical (the bridge crosses open
ocean). Includes a **steam-repair QTE minigame**: a gasket blows and you must tap the
correct gasket before pressure drops too low. Events include Gerald the giant squid,
a shark toll collector, and a kraken. The title screen has an animated steam locomotive
canvas.

**Resources:** coal, food, water, hull integrity  
**Special mechanic:** steam-repair QTE

---

#### Car Trail (`cartrail/index.html`) — ~1,250 lines  · **DOM + canvas minigame**

Family road trip in a Ford Escape: **Basel → Matterhorn → Milan → Budapest → Vienna →
Munich → Leipzig**. The most grounded Trail game. Events include traffic jams, toll
booths, bathroom emergencies, and a "Duck Dieb Attacks!" crossover. Three stops include
a **wildlife photography minigame**: tap animals as they dash across a canvas scene. Has
a bladder meter for comedic urgency.

**Resources:** euros, gas, snacks, bladder  
**Special mechanic:** wildlife photography minigame; bladder urgency system

---

#### Contraband Trail (`contraband/index.html`) — ~900 lines  · **DOM + canvas stealth**

Rhine River, 1922. Pilot a barge from **Basel → Strasbourg → Mainz → Cologne →
Rotterdam**, smuggling banned books, jazz records, and stolen art through Weimar Germany.
Manages heat (police suspicion), coal, bribe money, and cargo condition. At each port
a **top-down canvas minigame** plays out customs inspection — decide what to declare,
what to hide, who to bribe. Random river events: fog, engine trouble, rival smugglers.
Uses `mucko-engine.js`. 

This game was proposed in `JOHN_CARMERO_REVIEW.md` as the "cover game" merging the
Trail resource structure with Duck Dieb stealth mechanics.

**Resources:** coal, bribe fund, heat (suspicion), cargo condition  
**Special mechanic:** port customs top-down canvas minigame

---

### Heist & Adventure Games (canvas, full-screen)

These are canvas games with a player avatar walking around environments, talking to
characters, and completing objectives. They use a **dual-canvas rendering pattern** (a
background layer `bgc` and a foreground layer `gc`) and a **backdrop caching system**
(see Canvas Architecture section).

---

#### Samster Diebs from the Diebs (`samster/index.html`) — ~1,770 lines  ★ Reference

**Samster** the hamster escapes his cage, sneaks past Pflueger, and infiltrates the
Diebs' hideout to steal back what was stolen. Phases:

1. **Cage** — simple introductory screen
2. **Stealth** — top-down grid map, dodge Pflueger's patrol; raccoon allies can cut power
   to disable laser tripwires
3. **Hideout** — explore the Diebs' lair, search crates
4. **Cart ride** — time your braking before a wall (QTE)
5. **Baby silencing** — brake the cart → blanket the baby (O key) → complete a button
   sequence before the baby screams and wakes the Diebs

Has a `dialog-data.js` (`window.SAMSTER_DIALOG`) for all cutscene dialog.

**This is the reference implementation** for canvas layout, dual-canvas, backdrop
caching, the `mclk`/`mx`/`my` input pattern, and touch controls. See it first.

---

#### Pflueger and the Hippo (`hippo/index.html`) — ~3,360 lines (largest game)  · Canvas

A JRPG-style adventure based on a book. A hippo walks into Pflueger's life; Pflueger
helps him escape back to the zoo where Lekan the panda has a plan. Phases:

1. **Story panels** — illustrated dialog scenes with narrator text
2. **Stealth** — Pflueger (player) sneaks through zoo zones past keepers; use Nik the
   seal once per zone to freeze all keepers temporarily
3. **PB&J minigame** — QTE sequence for making a sandwich while keeping Hippo quiet
4. **Closet minigame** — hide evidence; timed object-sorting puzzle
5. **Epilogue/credits**

**Cheat codes** (type in-game at any time, no Enter):
- `LEKAN` — skip to escape sequence
- `MARGARITAVILLE` — skip to epilogue
- `CLOSETLIFE` — skip to closet minigame
- `PBANDJ` — skip to PB&J minigame
- `NIKNIK` — all keepers freeze permanently
- `BASIL` — player becomes invisible to keepers
- `PRASTHEKOALA` — keepers slow to 20% speed
- `SKREEEEM` — instantly activate Nik

Entering 3+ cheats in one session reveals a hidden **cheat scroll** room. The cheat list
is in `hippo/cheats.txt` (not shown in-game, use for reference). Has a `dialog-data.js`
(`window.HIPPO_DIALOG`). Has `?harness` URL param for dialog debugging.

---

#### Duck Dieb (`duckdieb/index.html`) — ~1,560 lines  · Canvas

Play as **Duck Dieb**, a masked mallard thief. Top-down, single-session heist. Phases:
`title → alley → house → jackpot → chase → escape/jail → victory`. Guards use
line-of-sight detection. Has **easy mode** (slower guards, visible keypad hints, owners-
return countdown). High score board stored in `localStorage`.

---

### Arcade / Action (canvas, full-screen)

#### Rocket Trail (`rockettrail/index.html`) — ~2,720 lines  · Canvas

Multi-phase Saturn V space mission. Choose difficulty/destination: Mercury, Gemini (Moon),
or Apollo (Mars). Standard path: launch pad → launch sequence (animated Saturn V, stage
separations) → transit (day panels, events) → asteroid mining (tap asteroids; gold
asteroids earn +8 and a Houston "outstanding!") → moon landing (real gravity physics,
crash gives a reason) → re-entry (dodge three rocket types: standard, big/slow,
fast/small) → parachute (deploy at the right altitude) → splashdown/victory (confetti,
star rating). Web Audio rocket sounds.

**Apollo 13 alternate path:** during the transit "Stir the O2 tanks?" event, choosing
YES triggers the Apollo 13 sequence — O2 explosion → comms failure dialog → slingshot
around the moon → re-entry (skipping mining and landing). Ends as a rescue victory.

Has `PLAYTESTING.md` with notes from a 6-year-old playtester —
**read it before touching difficulty or controls**.

---

#### Mucko Tac Toe (`tictactoe/index.html`) — ~1,900 lines  · Canvas + DOM overlay

Tic-tac-toe with substantial depth: configurable 3×3–8×8 board; **torus mode** (wraps
edges); **gravity mode** (pieces fall); **minimax AI** with adjustable difficulty;
**emoji symbol picker** (Samster, Hippo, Saturn V, etc.); **tournament mode** (3-game
series with a championship burst). Setup screen is HTML DOM; game board is canvas.

---

### Educational

#### Lake House Math Mystery (`lakehousemath/`) — Canvas  · uses `mucko-engine.js`

Math game for young players (addition facts up to 20). Walk around a lake house talking
to NPC characters. Each NPC gives a clue card; once you have both clues for a quest,
solve an addition problem to unlock a picnic chest item. Four areas with 1–2 NPCs each:
Samster & Duck Dieb → Hippo & Nik → Lekan & Basil → Captain Mucko & Saturn V.

This is the **only game currently using `mucko-engine.js`**. Its logic is split into a
separate `game.js` — also unusual in this codebase.

---

### Simulation / Toy

#### DJ Mixer (`dj/index.html`) — ~1,340 lines  · **CSS/DOM + Web Audio**

Pioneer XDJ-style two-deck DJ mixer. All audio synthesized in real time via Web Audio
API — no samples. Deck A: house beat (4-on-the-floor kicks, offbeat hats, claps on 2/4,
bass line). Deck B: techno pattern. Controls: jog wheel (nudges tempo), 3-band EQ, pitch
fader, channel fader, crossfader. Beat-sync lights flash on the downbeat.

**This is a CSS/DOM layout game** (no canvas). Needs different compat care (see
CSS-Only Layout section). All flex `gap:` are commented with Safari 14.1+ warnings and
have `> * + *` margin fallbacks.

---

## Characters

This universe has a consistent cast. When writing dialog, naming an NPC, or designing a
new game, try to fit these characters before inventing new ones.

### Core Cast

**Mucko** — The family nickname/brand. Not a character per se, but a mascot. Appears as
the airship name (*R.M.A.S. Mucko*) and as "Captain Mucko" (a sea-captain figure) in
Lake House Math.

**Samster** — A hamster, protagonist of *Samster Diebs from the Diebs*. Brave, small.
Tan/brown coloring. Roams the lake house in Lake House Math.

**Duck Dieb** — A masked mallard duck thief. Protagonist of *Duck Dieb*. Cameo villain
in Car Trail ("Duck Dieb Attacks!"). NPC in Lake House Math. "Dieb" is German for
"thief."

**The Diebs** — Raccoon thieves, Samster's antagonists. A separate use of the "Dieb"
motif from Duck Dieb.

**Pflueger** — A family member's name used as an in-game character. Appears as:
- The human helper in *Pflueger and the Hippo* (protagonist's guardian)
- The owner Samster sneaks past in *Samster*
- Referenced in Train Trail

**Hippo** — The unnamed hippo from *Pflueger and the Hippo*. A zoo escapee who just
wants a PB&J and a good night's sleep. Purple-grey coloring. NPC in Lake House Math.

**Lekan** — A panda; the mastermind who orchestrated the zoo escape. Patient, strategic,
"surprisingly chill once you meet him." Difficulty label "Panda Mastermind" in Hippo
refers to him. NPC in Lake House Math.

**Nik** — A brown monkey; Lekan's distraction agent. In Hippo, using Nik causes a
deafening yell that freezes all keepers in a zone temporarily. NPC in Lake House Math.
(Was drawn as a seal in earlier games; canon is now brown monkey.)

**Basil** — An otter, reluctant and bookish ("would rather be reading"). Cheat `BASIL`
makes him unable to see the player. NPC in Lake House Math. (Was drawn as a human
zookeeper in earlier games; canon is now otter.)

**Digory** — A black-and-white fox terrier. Mostly white, with a big black spot on
one side and a smaller black spot (the kids call it his "on/off button"); a black
rump patch extends up the tail which ends in a white tip; his face is black with
triangle upright ears and a bit of brown around the muzzle. Usually wears a gray
collar with a silver tag. Appears in *Pflueger and the Hippo*.

**Pras the Koala** — Referenced in Hippo's dialog as always being asleep. Immortalized
by cheat code `PRASTHEKOALA` which slows keepers "having an epic dream."

**Saturn V** — The rocket from Rocket Trail. Appears as a full character NPC in Lake
House Math, listed alongside organic beings. Played completely straight.

### Minor / Background

**Gerald** — A giant squid who hosts dinner in Train Trail. Event NPC.

**Mandy Mouse** — A mouse NPC in Hippo Zone 3 who gives keeper patrol timing tips.

**J. Long (the Giraffe)** — Giraffe NPC in Hippo who peers over a fence with patrol
hints.

**Lisa** — Friend of Pflueger who discovers the hippo is a zoo escapee (dialog reference).

**Capt. Smith / Rose** — Captain and co-pilot of the R.M.A.S. Mucko in Airplane Trail.

---

## The iOS App

`samster-ios/` is an Xcode project wrapping the Samster web game in a WKWebView.
The web assets live inside the Xcode bundle and must be synced before building:

```sh
./sync-ios.sh   # copies samster/index.html + samster/dialog-data.js → samster-ios/
```

**Run this before every iOS build.** If you update `samster/index.html` without running
it first, the iOS app will be out of date.

---

## `mucko-engine.js` — Shared Library

A shared engine library (~240 lines). Currently only used by Lake House Math and
Contraband Trail, but intended as the foundation for future games. Philosophy: it's a
*library*, not a framework — you call it, it doesn't call you.

**Exports:**
- `MuckoEngine.initCanvas(canvasEl, W, H)` — sets up DPR scaling, stage positioning,
  `visualViewport`-aware resize handler. Uses `position: fixed` + `transform: scale()`
  (different from the Samster/Hippo `position: absolute` + explicit sizing pattern — both
  work, but don't mix them in the same game)
- `MuckoEngine.makeInput()` — returns `{ K, JP, eat, held }` (see Input Pattern below)
- `MuckoEngine.makeAudio()` — returns `{ beep(freq,vol,dur,type), chime(), boom(vol,dur) }`
- `MuckoEngine.makeStore(key)` — localStorage high-score list: `{ get, save, clear }`
- `MuckoEngine.makeLoop(updateFn, drawFn, targetFps)` — game loop with dt capped at 0.05s
- `MuckoEngine.makeDrawHelpers(ctx)` — returns `{ rnd, txt, ln, circ }` (rounded rect,
  text, line, circle)
- `MuckoEngine.renderDialog(ctx, opts)` — word-wrapped dialog box renderer
- `MuckoEngine.TOUCH_UI()` — returns true if touch device

---

## Core Code Patterns

These patterns appear in almost every canvas game. A new agent reading one game for the
first time will encounter all of these. Know them before editing.

### The Phase State Machine

Every canvas game has a top-level `phase` variable (a string) that drives both
`update`/`draw` routing and which mobile buttons to show:

```js
let phase = 'title';

function stepSimulation(dt) {
  switch (phase) {
    case 'stealth': updateStealth(dt); break;
    case 'cart':    updateCart(dt);    break;
    // ...
  }
}

function renderPhase() {
  switch (phase) {
    case 'title':   drawTitle();   break;
    case 'stealth': drawStealth(); break;
    // ...
  }
}
```

To transition: just set `phase = 'newphase'`. Any setup needed first goes in a
`startPhase()` or `init*()` helper. There is no dispatcher or event system.

### The Game Loop (Samster pattern — fixed timestep)

Samster (and games derived from it) uses a **fixed-timestep simulation** with a debt
accumulator, then a separate render pass:

```js
const SIM_STEP = 1/60;
let simDebt = 0, lastTs = 0;

function loop(ts) {
  const elapsed = Math.min((ts - lastTs) / 1000, SIM_STEP * 6);
  lastTs = ts;
  simDebt += elapsed;
  while (simDebt >= SIM_STEP) { stepSimulation(SIM_STEP); simDebt -= SIM_STEP; }

  // render at targetFps (30 in LOW_FPS_PHASES, 60 otherwise)
  ctx.clearRect(0, 0, W, H);
  renderPhase();
  drawMobileControls();
  mclk = false;                         // consume click at end of frame
  Object.keys(JP).forEach(k => JP[k] = false);  // consume just-pressed
  requestAnimationFrame(loop);
}
```

Key: **`mclk` and `JP` are reset at the end of the frame**, not at the top. This means
if two systems both check `mclk` in the same frame, only the first one sees it. Design
click handlers to consume `mclk` explicitly: `if (hover && mclk) { mclk = false; ... }`.

### Mouse / Touch Input (`mclk` / `mx` / `my`)

All canvas games have these three globals:

```js
let mx = W/2, my = H/2;  // last known cursor position (canvas-space)
let mclk = false;         // true for one frame when a click/tap occurred

canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  mx = (e.clientX - r.left) * (W / r.width);
  my = (e.clientY - r.top)  * (H / r.height);
  mclk = true;
});
// touchstart/touchmove also update mx/my (for hover detection on mobile)
// touchstart also calls synthesized button handlers for D-pad/action buttons
```

For hit detection: `mx >= bx && mx <= bx+bw && my >= by && my <= by+bh` everywhere.
No dedicated hit-test library.

### Mobile Buttons

Touch games render a D-pad and action buttons directly on the canvas via
`drawMobileControls()`. Touch events are routed through a `makeTouchButtons()` / button
array pattern: each button has `{id, cx, cy, r, label}` and touch events check
`Math.hypot(tx-cx, ty-cy) < r` to detect presses. The button state is fed back into the
same `K` dict as keyboard input so the rest of the game code is input-agnostic.

### The Keyboard / `K` / `JP` / `eat()` Pattern

```js
const K  = {};  // held: K['ArrowLeft'] === true while key is held
const JP = {};  // just-pressed: true for exactly one frame on keydown

document.addEventListener('keydown', e => { if (!K[e.code]) JP[e.code] = true; K[e.code] = true; });
document.addEventListener('keyup',   e => { K[e.code] = false; });

function eat(code) {
  if (JP[code]) { JP[code] = false; return true; }
  return false;
}
```

`eat()` consumes a just-pressed event — use it for single-action triggers (menu confirm,
jump, etc.). `K[code]` is for held input (movement). `JP` is reset at the end of each
frame.

### Difficulty Object

Games with difficulty levels define them as named objects with gameplay parameters:

```js
const DIFFS = [
  { id: 'easy',   label: 'Easy',   spd: 1.0, vis: 100, nikDur: 5.0, ... },
  { id: 'medium', label: 'Medium', spd: 1.4, vis: 130, nikDur: 3.5, ... },
  { id: 'hard',   label: 'Hard',   spd: 1.9, vis: 155, nikDur: 3.0, ... },
];
let diff = DIFFS[1]; // selected on the difficulty screen
```

All gameplay code reads from `diff.someParam` — never hardcodes difficulty-dependent
numbers. This makes it trivially easy to tune.

### DPR Cap

Samster and Hippo cap the device pixel ratio at 1.5 (`MAX_RENDER_DPR = 1.5`) to
control canvas memory usage on iPad. The old iPad's GPU can struggle with a full 2×
canvas at 800×560. Do not raise this cap.

### LOW_FPS_PHASES

Samster and Hippo throttle to 30 fps during non-interactive phases (`title`, `diff`,
`cutscene`, `highscores`). This saves battery on the old iPad during menus. New games
should adopt this pattern:

```js
const LOW_FPS_PHASES = new Set(['title', 'diff', 'credits']);
function targetFps() { return LOW_FPS_PHASES.has(phase) ? 30 : 60; }
```

---

## Viewport & Layout Patterns

### Canvas Games: `position: absolute` + explicit left/top

Used by **Samster** (reference), **Hippo**, **Duck Dieb**, **Rocket Trail**:

```css
html, body { width: 100%; height: 100%; overflow: hidden; }
#stage { position: absolute; } /* width/height/left/top set by JS */
```

```js
function safeViewH() { var vv = window.visualViewport; return vv ? vv.height : window.innerHeight; }
function safeViewW() { var vv = window.visualViewport; return vv ? vv.width  : window.innerWidth;  }
function resize() {
  var vw = safeViewW(), vh = safeViewH();
  var s = Math.min(vw / (W + 6), (vh - 6) / (H + 6));
  stage.style.width  = Math.round(W * s) + 'px';
  stage.style.height = Math.round(H * s) + 'px';
  stage.style.left   = Math.round((vw - W*s) / 2) + 'px';
  stage.style.top    = Math.round((vh - H*s) / 2) + 'px';
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
```

### Canvas Games: `position: absolute` + `transform: scale()` (origin top-left)

Used by **Rocket Trail**, **Duck Dieb**, **Contraband Trail** (canvas stealth layer):

```js
function resize() {
  var vw = viewW(), vh = viewH();
  var s = Math.min(vw / W, vh / H);
  stage.style.transform = 'scale(' + s + ')';
  stage.style.left = Math.round((vw - W*s) / 2) + 'px';
  stage.style.top  = Math.round((vh - H*s) / 2) + 'px';
}
```

**Why not `position: fixed`?** `fixed` + `transform` causes clipping bugs in Safari.
Use `position: absolute` for the stage.

**Why not `100vh`?** On iOS Safari, `100vh` includes the address bar, clipping the
bottom. `visualViewport.height` gives the true visible area.

### DOM Trail Games: `position: absolute` + `transform: scale()` on `#app`

Used by **Train Trail**, **Car Trail**, **Titanic Trail**:

```js
// #app { position: absolute; width: W; height: H; overflow: hidden; transform-origin: 0 0; }
function scaleToViewport() {
  var vw = viewW(), vh = viewH();
  var s = Math.min(vw / W, vh / H);
  app.style.transform = 'scale(' + s + ')';
  app.style.left = Math.round((vw - W*s) / 2) + 'px';
  app.style.top  = Math.round((vh - H*s) / 2) + 'px';
}
```

---

## Canvas Architecture (Samster/Hippo dual-canvas)

The large canvas games use two stacked canvases inside `#stage`:

- **`#bgc`** — background layer (`pointer-events: none`). Static backdrops are rendered
  here once and cached.
- **`#gc`** — foreground layer (interactive). Animated content, characters, UI.

Backdrops are cached to offscreen canvases via `drawCachedBackdrop(key, drawFn)`:
the first call draws to `#gc`, snapshots it, stores in a `Map`, then subsequent frames
just blit the snapshot to `#bgc`. This avoids redrawing complex room geometry every
frame. **Call `clearBackdropCache()` after any resize** — cached canvases are at the old
DPR and must be rebuilt.

---

## ctx.roundRect() Polyfill

Add this before any canvas drawing code in games that need rounded rects:

```js
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);    this.quadraticCurveTo(x + w, y,     x + w, y + r);
    this.lineTo(x + w, y + h - r); this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);    this.quadraticCurveTo(x,     y + h, x,     y + h - r);
    this.lineTo(x, y + r);        this.quadraticCurveTo(x,     y,     x + r, y);
    this.closePath();
  };
}
```

---

## CSS-Only Layout Games (no canvas scaling)

The DJ Mixer uses pure CSS/DOM. Needs different compat care:

- Use `height: 100vh` (not `svh`/`dvh`) for body/page height
- Replace `inset` shorthand with explicit `top/right/bottom/left`
- Replace `aspect-ratio` with the `::before { padding-top: N% }` trick
- Replace flex `gap` with `> * + *` margin selectors (or annotate with `/* Safari 14.1+ */`)

---

## iOS 12 Compatibility Rules

**Primary target:** an old iPad running **iOS 12.5.8 / Safari 12**.

Do not use:
- `??` (nullish coalescing) — requires iOS 13.4+
- `?.` (optional chaining) — requires iOS 13.4+
- `Array.prototype.at()` — requires iOS 15.4+
- CSS `inset` shorthand — requires Safari 14.1; use `top/right/bottom/left` explicitly
- CSS `gap` in **flex** containers — requires Safari 14.1; use `> * + *` margins as fallback
  (CSS Grid `gap` is fine — supported from Safari 10.1)
- CSS `aspect-ratio` — requires Safari 15
- CSS `100svh` / `100dvh` — use `100vh`
- `ctx.roundRect()` — requires Safari 15.4; use the polyfill above

**Quick self-check for any new code:** search for `inset:`, `gap:` (in flex contexts),
`?.`, `??`, `.at(`. Each is a Safari 12 failure.

---

## Web Audio on iOS

iOS Safari suspends `AudioContext` until a user gesture. Best practices:

```js
const actx = new (window.AudioContext || window.webkitAudioContext)();

// Unlock on every gesture — no { once: true } — handles re-suspends
function unlockAudio() { if (actx.state !== 'running') actx.resume(); }
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('touchend',   unlockAudio);
document.addEventListener('click',      unlockAudio);

// resume() is async — await before calling .start()
actx.resume().then(function() { source.start(); });
```

`ctx.createBuffer()` at load time is safe — the Web Audio buffer is computed in JS.
Use `setTargetAtTime` for smooth parameter changes (avoids audio clicks on iOS 12).

---

## High Score System

Each game with high scores uses `localStorage` keyed by game name
(e.g., `duckdieb_hs`, `mucko_lakehousemath_scores`). Scores are stored as JSON arrays
of `{ score, ... }` objects, sorted descending, capped at 10 entries.

The PIN gate on `index.html` restricts access to the whole collection.
- PIN hash (SHA-256) and length are stored in `localStorage`
- `sessionStorage` flag `mgs_unlocked = '1'` skips the gate for the current session
- `nopin/index.html` sets that flag then redirects to `index.html` (debug bypass)
- URL params `?gtia` (go to index always) and `?gtmi` (go to main index) are additional
  debug cheats in individual games

---

## Other Files

- `JOHN_CARMERO_REVIEW.md` — A fictional 1992 game magazine review in the voice of
  Carmack and Romero. Doubles as a creative direction document: it names the design
  weaknesses, proposes improvements, and several suggestions have shipped (tournament
  mode, `mucko-engine.js`, `sync-ios.sh`, Contraband Trail). Read for design philosophy.

- `PLAN.md` — Documents a completed Airplane Trail feature pass (status: COMPLETE ✅).
  Safe to ignore; kept for reference.

- `local/` — Contains the source PDF for the Hippo book. Not used by any game.

- `-r/`, `cp/` — Empty directories. Likely created by accidental `cp -r` invocations.
  Safe to delete.

- `nopin/index.html` — PIN bypass page (sets `sessionStorage` flag, redirects to
  `index.html`). Used during development. Navigating to `nopin/` skips the PIN gate.

---

## Mobile Touch Best Practices

- All tap targets should be at least 44×44px on the logical canvas
- Prefer on-screen D-pad + action buttons over swipe gestures for kids
- `touch-action: none` on draggable/interactive canvas elements
- `touch-action: manipulation` on HTML buttons (removes 300ms delay)
- `-webkit-tap-highlight-color: transparent` on interactive elements
- For QTE sequences: always provide tappable on-screen buttons in addition to keys

---

## Common Gotchas

- **`inset` shorthand**: not supported in Safari 12 (requires 14.1). Use
  `top/right/bottom/left` individually for all overlays, modals, and full-cover elements.
  `box-shadow: ... inset ...` is a different thing and fine everywhere.

- **Flex `gap`**: not supported in Safari 12. Use `> * + * { margin-left: Xpx; }` (or
  `margin-top` for column flex). Grid `gap` is fine (supported from Safari 10.1).

- **Emoji sprites**: emoji rendering varies by device. Replace with canvas-drawn sprites
  for canvas games (see commit `8b49c9c`).

- **`Math.random()` in deterministic contexts**: don't use it for things that should be
  stable frame-to-frame (e.g., window flicker on a title screen) — use a seeded hash.

- **Backdrop cache invalidation**: call `clearBackdropCache()` after a resize event.
  Cached canvases are at the old DPR and will render blurry if reused.

- **`mclk` / `JP` consumption order**: both are reset at the end of the game loop.
  If two UI elements both check `mclk` in the same frame, the first one to match wins.
  Always set `mclk = false` after consuming a click.

- **iOS app sync**: after editing `samster/index.html` or `samster/dialog-data.js`,
  run `./sync-ios.sh` before building the Xcode project.
