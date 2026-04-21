# Mucko's Games — Punchlist

Bugs and improvements queued for agent or developer work. Items are grouped by priority,
then by game. Each item is self-contained enough to hand to an agent.

---

## Priority 1 — Compat Bugs (iOS 12 / Safari 12 breakage)

### `ttrail/onlineGame/index.html` — no `visualViewport` in resize

The Titanic Trail resize function uses `window.innerWidth / window.innerHeight`. On iOS
Safari, `window.innerHeight` includes the browser chrome (address bar), so the bottom
of the game is clipped. This is the same issue already fixed in Rocket Trail, Car Trail,
Train Trail, and Duck Dieb.

**Fix:** Add `viewW()`/`viewH()` helpers using `visualViewport` (same pattern as the
other Trail games after their fix). Also add a `window.visualViewport.addEventListener`
call.

---

### `airplanetrail.html` — no `visualViewport` in resize

Airplane Trail uses HTML DOM layout (`#app { width: min(780px, 100%) }`) which is
partially responsive on its own, but it doesn't explicitly account for the iOS browser
chrome height. Worth auditing whether the bottom is clipped.

**Fix:** Audit and apply `visualViewport`-aware resize if the layout truncates on iPad.
The game is DOM-based so the fix may differ from the canvas games.

---

### All canvas games — `??` / `?.` / `Array.prototype.at()` audit

Run a regex scan over all game files for `\?\?`, `\?\.`, and `\.at\(` to confirm none
have crept in. Currently passing but worth automating as a pre-push check.

---

## Priority 2 — Functional Bugs (things that break gameplay)

### `contraband/index.html` — flex `gap` in HTML screens

Contraband Trail's HTML screens use CSS flex with `gap:` in several places
(`.btn-row`, `.sbar`, `.rstop`, `.ev-choices`, `.page`). On Safari 12, these have no
spacing between items. The game still functions but buttons and resources overlap or
look wrong.

**Fix:** Add `> * + *` margin fallbacks for each flex gap usage in the file. The DJ
Mixer (`dj/index.html`) is a good reference — it has this pattern done correctly
throughout, with comments marking each `gap:` as `/* Safari 14.1+ */`.

---

### `tictactoe/index.html` — `backdrop-filter: blur()` on result overlay

The `#result-overlay` uses `backdrop-filter: blur(5px)`. This is not supported in
Safari < 9 and requires `-webkit-backdrop-filter` as a fallback in some older versions.
More importantly, on low-power devices it can cause significant frame drops during the
fade-in animation.

**Fix:** Remove `backdrop-filter` from the result overlay (the dark `rgba` background
is sufficient) or add `-webkit-backdrop-filter` prefix.

---

### `rockettrail/index.html` — no `visualViewport.scroll` listener

The resize function now listens to `visualViewport.resize` but not `scroll`. On iOS,
when the virtual keyboard appears (not applicable here, but the scroll event is how
`visualViewport` position updates propagate on some iOS builds). Low risk for a game
without text input, but the Samster pattern includes it.

**Fix:** Add `window.visualViewport.addEventListener('scroll', resize)` alongside the
`resize` listener.

---

## Priority 3 — Gameplay Improvements

### `rockettrail/index.html` — moon lander controls cramped on phone

The three-button row (LEFT / THRUST / RIGHT) is close together on small screens. From
`PLAYTESTING.md`: thumbs hit two at once. The playtesting notes already contain the full
fix plan:

**Fix (from PLAYTESTING.md, Priority 1A):**
- Move THRUST to a large center-bottom zone; LEFT/RIGHT to outer sides
- Add "tap anywhere in upper half = thrust" as fallback
- Add pulsing red "TOO FAST ▼" text + beep when `vy > 60%` of `maxSafe`
- Add distinct "CRASH — TOO FAST" vs "CRASH — OFF COURSE" result message

---

### `rockettrail/index.html` — re-entry only has one rocket type

All enemy rockets look identical. From `PLAYTESTING.md` Priority 2D:

**Fix:** Three types (weighted random):
- Standard (60%): current behavior
- Big & slow (20%): `w=22`, `×0.65` speed
- Fast & small (20%): `w=8`, `×1.6` speed

---

### `rockettrail/index.html` — no interactive flag plant after landing

After a safe moon landing the astronaut auto-plants the flag. From `PLAYTESTING.md`
Priority 2E: "I wanted to plant the flag MYSELF!"

**Fix:** After the result overlay fades, show "TAP TO PLANT FLAG 🚩" button. Player taps
→ astronaut walks and plants. Auto-triggers after 3s if no tap.

---

### `duckdieb/index.html` — high score table not accessible from victory screen

After completing a run, there is no in-game route to the high scores table without
going back to the title screen and pressing the "View High Scores" button. The
transition from victory → high scores should be direct.

**Fix:** Add a "View High Scores" button directly on the victory screen.

---

### `hippo/index.html` — cheat scroll room renders plain text

The cheat scroll easter egg (shown when 3+ cheats are entered) displays flavor text but
is visually bare compared to the rest of the game's illustrated scenes.

**Fix:** Draw the scroll as a proper parchment canvas element with each code listed in
themed handwriting-style text, and add a small character icon (Lekan, Basil, Pras, etc.)
beside each entry's lore blurb.

---

### `contraband/index.html` — port canvas touch controls incomplete

The top-down port canvas minigame has a touch controls overlay for the D-pad + action
button, but the `portTouch` handler only detects taps in the bottom-right area for
the action button. Full D-pad support for the canvas phase is missing.

**Fix:** Add the same D-pad button layout used in Samster to the port canvas minigame.
Reference `samster/index.html`'s `makeTouchButtons()` + `drawMobileControls()`.

---

### `smash/index.html` + `smash/sim.js` — next-pass Smash work

The recent Smash work added trained CPU tiers, roster expansion, portrait/profile sprite
separation, and the first wave of character specials. The main remaining opportunities
are system-balancing and second-pass polish rather than missing scaffolding.

**Likely next tasks:**
- Balance held specials:
  - Hippo's `Margaritaville` shield is intentionally overpowered right now; tune entry
    conditions, cooldown, or vulnerability windows after playtesting.
  - Duck Dieb sustained flight should be tested for ceiling abuse, stalling, and edge
    recovery loops across the full roster.
  - Digory's mass-up bounce stance should be checked for degenerate ledge situations.
- Add more character specials:
  - Natasha and Mandy currently have no special moves.
  - Lekan, Basil, Samster, and Pras are still good candidates for utility or movement
    specials that reinforce character identity.
- Improve training/eval after specials:
  - rerun AI evaluation after major special or physics changes so shipped tiers do not
    drift from the actual game.
  - consider adding cross-character eval suites, not only mirror and baseline checks.
- Add a dedicated Smash roadmap or design note if the feature surface keeps expanding;
  `smash/TRAINING.md` now covers training and maintenance, but not long-form design goals.

---

## Priority 4 — Polish & Nice-to-Have

### All Trail games — "Continue" on driving screens auto-advances

In Car Trail and Train Trail, the driving screen has a "Continue" button that requires
a tap. From Rocket Trail's playtesting notes: players expect tapping anywhere non-UI on
the screen to advance. This is especially jarring during the between-stop driving
animation.

**Fix:** Allow a tap anywhere outside interactive buttons to trigger Continue.

---

### `tictactoe/index.html` — no way to reset PIN

If a user forgets their PIN, there is no in-game way to reset it. They must manually
clear localStorage. A hidden "reset PIN" flow would help.

**Fix:** On the PIN entry screen, if the user enters a deliberately wrong PIN 5 times,
show a "Reset PIN?" confirmation that calls `localStorage.removeItem('mgs_pin_hash')`.

---

### `samster/index.html` + `hippo/index.html` — debug info visible in production

Hippo has a debug overlay that logs canvas CSS dimensions, DPR, and scale at `?debug`
URL param. Samster may also have residual debug flags. Both are fine as-is; just worth
confirming the overlay is fully gated and not visible in normal play.

---

### `lakehousemath/` — no high score display in-game

The game stores a best score in localStorage but never shows it to the player. Adding a
"Personal Best" display on the victory screen would give replayability.

---

### Clean up empty directories

`-r/` and `cp/` at the repo root are empty directories created by accidental shell
command typos. Safe to delete:
```sh
rmdir -- -r cp
```

---

## Architecture / Engine Work

### Apply `mucko-engine.js` to more games

Currently only Lake House Math and Contraband Trail use it. The next candidate is any
new game, or any existing game receiving a substantial rewrite. Priority order:

1. **Duck Dieb** — simplest canvas game, good pilot
2. **Rocket Trail** — would benefit from the shared `makeAudio()` and `makeStore()`
3. **Mucko Tac Toe** — the DOM setup screen already thinks in components

**Note:** `mucko-engine.js` uses `position: fixed` for the stage (via `initCanvas`),
while the existing games use `position: absolute`. Reconcile before migrating — see the
note in CLAUDE.md under `mucko-engine.js`.

---

### Shared `dialog-data.js` format

Samster and Hippo already split dialog into `dialog-data.js`. If a new narrative game
is added, follow the same pattern: `window.GAMENAME_DIALOG = { scene_id: [...lines] }`.
The `mucko-engine.js` `renderDialog()` function can render these with minimal wiring.
