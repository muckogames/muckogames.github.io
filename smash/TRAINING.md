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
`champion-samster-mirror.json`.

## Evaluate

```bash
node smash/train.js eval smash/training/latest.json --games 8
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
- `smash/training/champion-samster-mirror.json` is a curated evolved genome from a
  resumed Samster mirror-match training run, with an evaluation summary against the
  built-in heuristic defaults.
