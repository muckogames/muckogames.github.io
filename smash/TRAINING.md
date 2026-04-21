# Mucko Smash Training Harness

`smash/train.js` runs a headless match simulator backed by `smash/sim.js`.

## Train

```bash
node smash/train.js train --generations 12 --population 24 --rounds 6 --seconds 60 --seed 1337
```

Outputs:

- `smash/training/latest.json`
- `smash/training/generation-XXX.json`
- `smash/training/best-replay.json`

`latest.json` is overwritten by each training run. If you want a stable checkpoint to
copy to another machine, use one of the named snapshots in `smash/training/`, such as
`easy-current.json`, `medium-current.json`, `hard-current.json`, or
`champion-samster-mirror.json`.

## Evaluate

```bash
node smash/train.js eval smash/training/latest.json --games 8
```

You can also evaluate against a curated shipped tier:

```bash
node smash/train.js eval smash/training/hard-current.json --opponent smash/training/medium-current.json --games 8
```

## Replay Data

```bash
node smash/train.js replay smash/training/best-replay.json
```

The replay file stores:

- match seed
- arena seed
- stocks
- both genomes
- whether the roster was side-swapped
- final match summary

## Notes

- The harness is graphics-free and audio-free.
- Matches use deterministic seeded RNG.
- The first AI implementation evolves heuristic controller weights, not neural networks.
- Timeout winner selection falls back to `stocks * 1000 - damage`.
- `smash/training/easy-current.json` is the current kid-friendly shipped easy bot.
- `smash/training/medium-current.json` is the current shipped medium bot for adults.
- `smash/training/hard-current.json` is the current shipped hard bot.
- `smash/training/champion-samster-mirror.json` is the detailed hard-mode evolution
  record from the long mirror-match training run.

## Current Game State

- The live game is in `smash/index.html`; the simulator is in `smash/sim.js`.
- They are intentionally mirrored for gameplay rules. If you touch physics, CPU
  behavior, specials, or hit resolution in one file, update the other in the same pass.
- The live game now includes:
  - curated `Easy / Medium / Hard` CPU tiers backed by heuristic genomes
  - per-slot lives, restart-from-same-config, and per-slot random character selection
  - side-view sprites plus separate portrait usage in menus/results
  - active roster of 12 characters including Mandy Mouse and Natasha
  - special abilities for Duck Dieb, Saturn V, J. Long, Hippo, and Digory

## Retrospective Notes

- Knockback preservation was fixed at the movement layer, not by tuning specific moves.
  Externally applied overspeed now decays naturally instead of being clamped back to walk
  speed on the next frame.
- CPU behavior was reworked into a proper `Easy / Medium / Hard` ladder and trained with
  the simulator. `Hard` is the strongest evolved shipped bot; `Easy` and `Medium` are
  separate curated tiers, not just weaker random walkers.
- Medium was upgraded (2026-04-21) via a 150-gen run (pop=40, rounds=10, sec=75) warm-started
  from the previous population. The new medium genome has a distinct high-jump-pressure
  playstyle (jumpChance ~0.74, chaseBias ~1.39, low retreatBias) and sits cleanly between
  old medium (62.5% win rate vs it) and hard (43.75% win rate vs it).
- Character presentation now distinguishes portrait and side-view rendering. In-match
  sprites are profile-oriented for readability, while menus/results can stay portrait-led.
- The current specials system supports both tap-triggered moves and held-state moves.
  Held-state specials now affect gameplay state, rendering, and simulation, so they are
  no longer cosmetic one-offs.

## Maintenance Guidelines

- When adding a new special:
  - define it in both `smash/index.html` and `smash/sim.js`
  - update CPU heuristics if the move should be used by bots
  - update hit resolution if the move changes collision rules or mass behavior
- When changing roster order:
  - keep `CHAR_IDS` aligned with the select-screen thumbnail grid assumptions
  - keep simulator roster data in sync so eval/training matches the shipped game
- When training AI after gameplay changes:
  - rerun at least a small eval matrix (`Easy vs Medium`, `Medium vs Hard`, and one
    baseline check) before promoting a new genome snapshot
