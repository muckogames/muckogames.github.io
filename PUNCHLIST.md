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

### Story Alignment & "Sparkle" Pass

These items translate the Digory story bible into concrete, handoff-ready polish
tasks. The goal is to move the repo from "generic animals" to a cohesive world of
absurd logistics, animal competence, and cozy domestic resets.

#### Concrete near-term polish

#### `don/` — The Flagship Heist Engine

As the primary Digory-story expression, `don/` needs to feel like a bedtime adventure.
- **Author Story Rhythm:** Move beyond "collect items" to "complete story beats." Use the `EDITOR_ROADMAP.md` goals: room-entry quips, note copy, and per-room intro/outro flavor.
- **Cozy Reset Beats:** Ensure every level ends with a home/sleep/reset beat. Digory should not just win; he should get food, safety, and sleep.
- **Don Failure Gags:** Add visual gags of the Don accidentally setting himself or his balloon on fire when he loses.
- **Editor-Driven Storying:** Prefer moving flavor into editor-authored mission data over hardcoding more one-off text in the shipped level.
- **Digory Physicality Pass:** Keep Digory reading like a real terrier in motion, scale, and silhouette rather than a generic mascot.

#### `samster/index.html` — Bedtime-Heist Framing

- **Vent Infiltration:** Lean into Samster's "elite vent specialist" canon. Add more vent-crawl sequences or visual cues (dust clouds, metallic echoes).
- **Playful Domesticity:** The "Sleeping Owner" isn't a threat; it's a domestic obstacle. Add specific props: coffee pods (Crow Tech!), Tupperwares, scattered socks, and half-read books.
- **The return-to-safety:** End the game with Samster safely back in his cage (or tucked into a miniature blanket) with a crumb of a "Samster Pie."
- **Household Prop Pass:** Add more environmental storytelling directly into rooms and stealth spaces, not only in dialog.
- **Raccoon Presence:** Make the Diebs feel more present through labels, stash markers, clue notes, and contraband traces.

#### `duckdieb/index.html` and `duckdieb2/` — Planning & Contraband

- **Briefing / Case-File Framing:** Add a lightweight pre-level planning beat such as blueprints, case files, or clue cards before the action starts.
- **Specific Funny Loot:** Replace generic treasure with: Floppy Disks (5.25"), Deeb Bags, suspicious cigars (from the Don), clue scraps, and sandwiches.
- **Success Copy:** Use "Shucky Ducky!" for victory and include references to "Deebing from the Diebs."
- **Failure Copy:** Make failures read as comic setbacks or botched plans rather than blank arcade losses.
- **Loot Visual Identity:** Give clue scraps, contraband folders, disks, and cigars clearer visual silhouettes rather than only renaming them in text.

#### `smash/index.html` — Story-World Roster Polish

- **Roster Flavor Pass:** Improve roster blurbs, versus flavor, stage copy, and win text so the cast feels anchored in one story-world.
- **Digory Fidelity:** Keep Digory's art and descriptions faithful to the story canon whenever he is centered.
- **Future Canon Candidates:** Track Louette, Firelight Guy, Johnny Mackerel, and more Don-adjacent material as good future roster or stage candidates.
- **Crow Tech Visuals:** Replace generic tech/explosions with Crow Tech (visible circuit-board patterns, crow-head logos).
- **Move-Name Pass:** Favor comic, character-specific move names over generic fighting-game terminology.

#### `traintrail/index.html` — event-writing pass

- Add more named recurring factions and animal cameos instead of generic obstacles.
- Rewrite events toward concrete comic logistics rather than abstract danger.
- Add more food/rest/reset punctuation between tense beats.
- Use crow-tech or Dieb-planning explanations where impossible mechanics need a story excuse.

#### `cartrail/index.html` — event-writing pass

- Add more specific comic logistics in travel events rather than generic hardship text.
- Give reward and setback text more flavor tied to food, cargo, and named characters.
- Add a stronger ending/debrief beat so the run lands as a story episode.

#### `contraband/index.html` — absurd-logistics pass

- Add more named factions, clue trails, and seized-item specificity rather than generic contraband.
- Emphasize comic stealth logistics over abstract chase energy.
- Use crow-tech or Dieb-planning explanations where impossible mechanics need a story excuse.

#### `rockettrail/` — cozy epic polish

- Keep failures funny and explanatory rather than severe.
- Add more family-story-style interruptions and domestic/logistical jokes during travel.
- Strengthen the arrival/celebration beats so the ending feels cozier and less score-only.
- Keep the tone earnest and child-logical even when the scope is huge.
- Prioritize event-writing and ending polish ahead of any broader HUD reskin.

#### `airplanetrail.html` and `ttrail/onlineGame/` — narrated-travel rewrite pass

- Push travel-chaos narration toward concrete props, silly procedures, snacks, and recurring voices rather than generic journey text.
- Soften failure text and warm up arrival text.
- Add more child-logical specificity to authority figures, delays, and travel rituals.
- Add stronger destination/debrief coziness instead of ending on pure progress accounting.

#### `hippo/index.html` — adjacent-lane warmth pass

- Keep Hippo as its own lane; do not fold it hard into Digory canon.
- Improve warmth, readability, and ending coziness without changing the core book logic.
- Prefer visual/tone polish over lore rewrites.

#### `lakehousemath/`, `tictactoe/index.html`, `orbit/index.html`, `dj/index.html` — adjacent flavor only

- Borrow naming consistency, cameo logic, and playful prop labels where easy.
- Do not force full story structure onto toy/educational games.

#### Maybe mechanics / prototype ideas

#### `don/` — optional canon-mechanic experiments

- **On/Off Button mechanic:** If tested, treat this as a prototype idea rather than a required feature. It could become a stealth gimmick, puzzle switch, or comic hazard.

#### `smash/index.html` — optional mechanic and roster experiments

- **Digory "On/Off Button" special:** Explore only if it produces a fun, readable stance mechanic rather than a lore-first gimmick.
- **Johnny Mackerel hazard/special:** A flood or "Holy Mackerel!" interruption could work as a stage hazard or cameo if it reads clearly in play.
- **Firelight Guy roster slot:** Good future roster candidate if the move kit is legible and not only conceptually funny.

#### `rockettrail/` and `airplanetrail.html` — visual direction ideas

- **Crow Tech HUDs:** Style the UI to look like Crow-built tablets only if that supports readability better than the current HUDs.
- **Steampunk/Crow-Tech Hybrid:** The R.M.A.S. Mucko could lean more brass-and-wood plus crow-tech, but this is lower priority than text and ending polish.

#### Cross-repo tone rules

- **Cozy ending taxonomy:** Not every game needs a yellow blanket, but every fitting game should end in warmth, relief, food, home, sleep, or some comparable reset.
- **Animal competence:** Authority figures and helpers can often be animals in roles of comic competence, but do not force this into every lane.
- **Comic peril copy:** Replace generic "Game Over" language with comic-peril wording where appropriate.
- **Underwater readability:** Ensure Kraken's city and other aquatic spaces read clearly and visibly as underwater environments.
- **Specific vocab as seasoning:** Use "Deeb," "Crow Tech," "Shucky Ducky," and "Holy Mackerel" selectively where they improve scene identity. Do not flatten every game into the same catchphrases.
- **Food specificity:** Replace generic supplies/rewards with specific foods where that strengthens the scene.
- **Digory sprite consistency:** Keep Digory visually consistent as a real black-white-brown terrier with stable spot placement and no smoking.

### Future Prototypes (Story-First Games)

Based on the alignment plan, these are the best candidates for expanding the repo with
native Digory-story content:

#### `Deeb From the Don` — The Ultimate Heist
- **Core Loop:** Dungeon wake-up → Samster wheel-jam escape → Digory stealth/food bonus → Duck Dieb code/contraband recovery → Balloon/Cigar chase → Yellow Blanket ending.
- **Why it fits:** Uses the strongest recurring villain (the Don) and centers the primary animal cast in their logical niches.

#### `Firelight Guy at the Zoo` — Arcade Chaos
- **Core Loop:** Demolish empty buildings (scheduled for demolition!) → Avoid animals/bystanders → Survive Don balloon interference → Newspaper-style wrap-up.
- **Why it fits:** High visual impact, simple "Cowabunga!" energy, and clear story tie-in to the Leipzig Zoo setting.

#### `Crow Tech Lab` — Toy/Puzzle Hybrid
- **Core Loop:** Combine absurd parts to build impossible devices (iAds, coffee pods, drones) → Test them in micro-scenarios → Unlock blueprints and comic failure notes.
- **Why it fits:** Canonical solution for anachronisms; lets the repo embrace its own technical logic.

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
