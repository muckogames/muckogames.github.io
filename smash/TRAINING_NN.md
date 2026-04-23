# Mucko Smash — Neural-Net Training Harness

`smash/train-nn.js` trains a small MLP policy that drives the **Expert** CPU
tier. It's a sibling to `smash/train.js`: the old script evolves a
19-parameter hand-coded heuristic; this one evolves a ~8 k-parameter neural
network via OpenAI-style **Evolution Strategies** (antithetic sampling +
centered ranks + Adam).

Both trainers use `smash/sim.js` as the source of truth — a model is only
"better" if match stats in the headless sim say so.

## Prereqs

Node.js 12+ (ships with every mainstream OS). No `npm install`, no
dependencies. The training script only reads `sim.js` and `ai/policy.js`.

## Train

```bash
node smash/train-nn.js train \
  --generations 500 \
  --pop 40 \
  --sigma 0.08 \
  --lr 0.03 \
  --matches-per-opp 2 \
  --seconds 30
```

Useful flags:

- `--fresh` — ignore `latest.json` and start from a He-init random net.
- `--hidden 64,64` — hidden-layer sizes; comma-separated.
- `--seed 1337` — base RNG seed.
- `--weight-decay 5e-5` — L2 shrinkage on Adam step.
- `--matches-per-opp N` — training-battery matches *per opponent* per side.
  More = lower variance, slower generations.
- `--seconds N` — per-match wall-clock cap (in game-time seconds). Shorter
  matches = faster training but noisier reward.
- `--snapshot-every N` — save `gen-NNN.json` every N generations (default 20).
- `--self-play-every N` — how often to refresh the self-play pool from
  `gen-*.json` snapshots (default 20).

Outputs (under `smash/ai/models/`, git-ignored):

- `latest.json` — most recent θ after each generation. Safe to resume from.
- `gen-NNN.json` — snapshotted periodically for the self-play pool.
- `best.json` — best θ by *holdout* fitness seen so far. Holdout uses a
  different seed sequence than the training battery, so this is the model
  you should actually ship.
- `log.csv` — one row per generation: `gen, meanF, bestF, wins, losses,
  draws, selfKos, winrate, wallMs`.

### What training is actually doing

Each generation:

1. Sample *P*/2 Gaussian noise vectors `ε`.
2. For each, evaluate (θ + σε) and (θ − σε) on a battery of matches (two
   antithetic evaluations per noise vector). Battery = Easy/Medium/Hard
   heuristics plus, once there are snapshots, a rotating self-play pool.
3. Characters are sampled uniformly from `CHAR_IDS` every match.
4. Score via `shapePlayerScore`: +200 win, +50 KO, −80 self-KO, and so on
   (see train-nn.js). Designed to push winrate up, not just damage dealt.
5. Centered-rank-transform the 2*P* fitnesses (outlier-robust).
6. Estimate the gradient as a weighted sum of the noise vectors; apply
   Adam with weight decay.
7. Save `latest.json`, maybe `gen-NNN.json`, maybe `best.json`, append a
   row to `log.csv`.

## Evaluate a single model

```bash
node smash/train-nn.js eval smash/ai/models/best.json --games 40
```

Prints total winrate + per-opponent winrate vs Easy/Medium/Hard. This is
the "is this model ready to ship?" gate. Target for shipping:

- `hard` winrate ≥ 0.65
- `medium` winrate ≥ 0.85
- `easy` winrate ≥ 0.95
- `selfKos` should be a small fraction of `deaths`

## Head-to-head two models

```bash
node smash/train-nn.js duel smash/ai/models/best.json smash/ai/models/latest.json
```

Runs N matches per side, reports A-wins / B-wins / draws. Use this to pick
between two checkpoints that both pass the eval gate.

## Shipping a model

Once you've got a checkpoint you're happy with:

```bash
cp smash/ai/models/best.json smash/ai/expert-v1.json
git add smash/ai/expert-v1.json
git commit -m "Smash: ship Expert v1 neural-net CPU"
```

The browser game fetches `ai/expert-v1.json` at load time. The file has to
live directly under `smash/ai/` (not inside `models/`, which is git-ignored).

## Alignment rule

Whenever you edit knockback / specials / physics / CPU rules in
`smash/sim.js` or `smash/index.html`, check:

1. Both files still mirror each other (existing rule).
2. Any shipped `expert-v*.json` is still valid under `Policy.validateModel`.
   If `OBS_VERSION` bumped in `smash/ai/policy.js`, older models will be
   refused and you need to retrain + ship a new version.

## Quick smoke test (no training)

```bash
node smash/ai/_smoke.js
```

Runs 16 random-weights matches vs the Hard heuristic. Passes when every
match completes without throwing.
