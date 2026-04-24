# Mucko's Games — Punchlist

Bugs and improvements queued for agent or developer work. Items are grouped by priority,
then by game. Each item is self-contained enough to hand to an agent.

---

## Priority 1 — Compat Bugs (iOS 12 / Safari 12 breakage)

### Ongoing: `??` / `?.` / `Array.prototype.at()` audit

After any PR that touches canvas game JS, run:
```sh
grep -rn '\?\?\|\?\.\|\.at(' samster/ hippo/ duckdieb/ rockettrail/ orbit/ smash/ tictactoe/ contraband/ airplanetrail.html
```
Audited clean as of 2026-04-24.

---

## Priority 2 — Functional Bugs (things that break gameplay)

*(All known P2 items fixed as of 2026-04-24.)*

---

## Priority 3 — Gameplay Improvements

### `orbit/index.html` — Phase 3: scripted "Flight Programs"

Phases 1, 2, 4, and 4.5/5/6 are shipped (free flight + burn engine + options
panel + narration + achievements). The big pending feature is **scripted
flight programs** — guided missions that fire burns at specific
times/conditions and play out as mission replays with on-screen annotations.

**Program data shape:**
```js
{ name, desc, color, trailRGB,
  sx, sy, vx, vy, moonAngle0,   // initial state (same as orbit preset)
  speed, trailEvery,
  burns: [
    { triggerType: 'time',      triggerVal: 0.0, direction: 'prograde', dv: 5.2 },
    { triggerType: 'apoapsis',                   direction: 'prograde', dv: 3.1 }
  ]
}
```
The sim loop checks each burn's trigger per physics step and applies `dv`
in the specified direction.

**Proposed programs:**
- **Hohmann Transfer** — LEO → circular high orbit via two prograde burns
  (one at periapsis, one at apoapsis).
- **Trans-Lunar Injection + Lunar Orbit Insertion** — the headline
  program. TLI timed so Moon is at apoapsis of transfer ellipse, then LOI
  retrograde burn at closest approach to Moon. LOI needs periapsis
  detection: `d(rm)/dt` sign change. LOI ΔV ≈
  `v_∞ * (sqrt(1 + 2·GM_M/(r_peri·v_∞²)) - 1)`.
- **Free Return (Apollo-13 style)** — TLI aimed for just-barely-reach-Moon
  trajectory; no LOI; swing around Moon back to Earth.
- **Gravity Assist** — start with sub-escape energy; timed close flyby of
  Moon to gain energy for a higher orbit or escape.

**Periapsis detection utility:**
```js
var prevRm = Infinity;
// in stepPhysics, after computing rm:
if (rm > prevRm && prevRm < LOI_THRESHOLD) { /* just passed periapsis */ }
prevRm = rm;
```
`ENCOUNTER_DIST` ≈ 0.15 DU (just inside Moon's SOI of 0.167 DU).

Current `SIM_DT = 1/3600 TU` is fine for the shipped orbits but may need
dropping to `1/7200` for very close Moon flybys during Phase 3 programs.

---

### `orbit/index.html` — Phase 6 Muckoification follow-ups

All landed as part of the OPT panel + narration + achievements. Remaining
ideas if we want another pass:

- **More skins:** Samster's Rocket (hamster silhouette), Duck Dieb's
  Escape Pod.
- **More narration events:** first figure-8 Moon encounter, Hohmann
  circularization complete, full orbit of Moon.
- **Mission flavor text per flight program:** "Samster needs to reach the
  Moon to recover the stolen cheese."
- **Extra achievements:** fastest Moon insertion, smallest-ΔV Hohmann,
  most figure-8 loops without crashing.

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

### `lakehousemath/` — no high score display in-game

The game stores a best score in localStorage but never shows it to the player. Adding a
"Personal Best" display on the victory screen would give replayability.

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
