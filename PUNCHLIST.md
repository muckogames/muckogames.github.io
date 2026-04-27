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

## Priority 3 — Gameplay Improvements

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
  - Lekan, Basil, Samster, and Pras are still good candidates for utility or movement
    specials that reinforce character identity.
  - `smash/sim.js` still lags the live roster for Mandy and Natasha specials; bring
    simulator parity back before the next training pass.
- Improve training/eval after specials:
  - rerun AI evaluation after major special or physics changes so shipped tiers do not
    drift from the actual game.
  - consider adding cross-character eval suites, not only mirror and baseline checks.

---

### `rockettrail/index.html` — remaining playtest follow-up

Most of the kid-playtest action items are shipped now (simpler travel text, crash
feedback, bigger thrust affordance, re-entry rocket variety, interactive flag plant,
victory confetti). The clearest still-open follow-up is:

- Add the mining time bonus:
  - if the player reaches 15+ minerals in the asteroid phase, show `+5 SEC BONUS`
    and extend the timer to reward accurate tapping.

## Priority 4 — Polish & Nice-to-Have

### `smash/index.html` — Hippo Margaritaville pool drawn in front of character

When Hippo activates his pool special, the kiddy pool is drawn behind him (it's the
first thing painted in the margaritaville pose branch). It should be drawn after the
body so it appears in front, making it clearer Hippo is sitting in it.

**Fix:** in `drawCharacterSidescrollSprite`, move the `fillRoundRect` (pool rim) and
`drawEllipse` (water shimmer) calls to *after* the body, head, ears, and nose draws.
The music note `♪` glyphs should remain on top (drawn last).


## Architecture / Engine Work

### Apply `mucko-engine.js` to more games

Current adopters: Lake House Math, Contraband Trail, Duck Dieb 2, and Smash.
The next candidate is any new game, or any existing game receiving a substantial
rewrite. Priority order:

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
