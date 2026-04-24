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

### `orbit/index.html` — Phase 6 Muckoification follow-ups

Phase 3 (all 4 scripted programs) is fully shipped: Hohmann Transfer, Moon
Insertion (TLI + LOI), Free Return, and Gravity Assist. Duck Dieb's Escape Pod
skin, per-program story narration, and 5 narration events also done.

**Remaining items (Phase 6 second pass):**

- **Samster's Rocket skin** (hamster silhouette, skinIdx 3). Duck Dieb skin is
  already in (skinIdx 2). Add a fourth skin toggled from the OPT panel.
- **3 more narration events:**
  - `figure8_moon`: first Figure-8 close Moon encounter (check Moon-relative
    distance < 0.10 DU when in figure-8 preset)
  - `hohmann_done`: Hohmann circularization burn fires (announce via existing
    programAnnounce — could just be the announce text, no separate event needed)
  - `moon_orbit`: full orbit of Moon completed (track Moon-relative angle
    wrapped, fire when it exceeds 2π from start of lunar orbit)
- **3 more achievements:**
  - `fast_insertion`: Moon Insertion program completes with simT < some threshold
  - `low_dv_hohmann`: Hohmann Transfer completes with remaining ΔV budget above
    a threshold (efficient burn)
  - `figure8_loops`: complete N figure-8 loops without crashing (track figure-8
    loop count via Earth-crossing direction changes)

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
