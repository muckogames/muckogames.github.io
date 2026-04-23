# Mucko Smash — Expert CPU Training Runbook

Step-by-step instructions to train, evaluate, and ship the Expert-tier
neural-network CPU from any machine. For the reference docs on what the
trainer is actually doing, see [`TRAINING_NN.md`](TRAINING_NN.md).

---

## Prereqs

- Node.js ≥ 12 (check: `node --version`)
- Git
- ~500 MB free disk (training checkpoints are ~265 KB each and you'll
  accumulate several; all are git-ignored)
- A few hours of laptop time — ES training is CPU-bound but easily paused
  and resumed

No `npm install`. No Python. No GPU. The harness uses only Node's standard
library + the repo's own `smash/sim.js` and `smash/ai/policy.js`.

---

## 1. Get the repo on your machine

```bash
git clone https://github.com/muckogames/muckogames.github.io.git
cd muckogames.github.io
git checkout claude/mucko-smash-game-2uiqx   # or main, once this is merged
git pull
```

Or if you already have it:

```bash
cd muckogames.github.io
git fetch
git checkout claude/mucko-smash-game-2uiqx
git pull
```

---

## 2. Smoke-test the setup (30 seconds)

Before committing to a long training run, confirm everything works:

```bash
node smash/ai/_smoke.js
```

You should see 16 matches run, all ending with `reason=last-entity`, and
the final line `pass criteria: every match completed, no exceptions.` A
random-weights NN won't win any, but the match loop has to complete
cleanly. If it doesn't, stop and debug before training.

---

## 3. Start training

The main training command:

```bash
node smash/train-nn.js train \
  --generations 1000 \
  --pop 40 \
  --sigma 0.08 \
  --lr 0.03 \
  --matches-per-opp 2 \
  --seconds 30
```

**What to expect on output:**

```
hidden: 64x64  params: 8325  pairs: 20  sigma: 0.08  lr: 0.03
starting fresh
gen 0 mean -201.44 best -23.15 holdout -187.03 wr 0.050 selfKos 38  easy:0.08 medium:0.00 hard:0.00 (9821ms)
gen 1 mean -193.22 best  -3.88 holdout -172.10 wr 0.075 selfKos 34  easy:0.16 medium:0.08 hard:0.00 (9634ms)
gen 2 ...
```

Watch for:

- **`selfKos`** dropping over time — a random net falls off the stage
  constantly; the first thing the NN should learn is "don't step off."
  If self-KOs aren't decreasing after ~50 generations, something's off.
- **`wr` (holdout winrate)** trending upward — starts near 0, should
  climb past 0.3 by gen ~100, past 0.5 by gen ~300, toward 0.7+ by the
  end.
- **`easy/medium/hard`** per-opponent winrates — Easy should climb first,
  then Medium, then Hard.
- **Wall time per generation** — ~10 seconds with these settings is
  typical. Faster = shorter matches (fewer stocks or `--seconds`
  lower); slower = more matches per opponent or bigger hidden layers.

### Stop safely

**Ctrl-C at any time.** `latest.json` is written every generation, so
you lose at most the in-progress generation. Training resumes from
`latest.json` by default when you re-run `train`.

### Resume

```bash
node smash/train-nn.js train --generations 500
```

No `--fresh` flag → resumes from `smash/ai/models/latest.json`. The
`gen` counter in the log continues from where it stopped.

### Start over

```bash
node smash/train-nn.js train --fresh --generations 1000
```

`--fresh` ignores `latest.json` but keeps `best.json` (so your historical
best is never lost). Wipe everything with `rm -r smash/ai/models` first
if you really want a clean slate.

### Tune it (optional)

| Flag | Default | Effect |
|---|---|---|
| `--pop N` | 40 | 20 antithetic pairs → 40 matches per gen just for ES |
| `--matches-per-opp N` | 2 | More = lower noise, slower gens |
| `--seconds N` | 30 | Match-length cap; shorter = faster but noisier |
| `--sigma s` | 0.08 | Noise scale; 0.05–0.15 is sane |
| `--lr r` | 0.03 | Adam LR; halve it if fitness oscillates |
| `--hidden 64,64` | 64,64 | Network shape. `128,128` = 4× params, ~2× slower |

---

## 4. Monitor progress

Two artifacts help you watch the run:

- **`smash/ai/models/log.csv`** — one row per generation. Easy to chart:
  ```bash
  tail -f smash/ai/models/log.csv
  ```
- **`smash/ai/models/latest.json`** — current net, inspectable:
  ```bash
  node -e "var m=require('./smash/ai/models/latest.json'); console.log(JSON.stringify(m.meta, null, 2))"
  ```

---

## 5. Evaluate a checkpoint

When you think a checkpoint is ready:

```bash
node smash/train-nn.js eval smash/ai/models/best.json --games 60
```

You'll see something like:

```
matches: 60 score: 68.41
wins/losses/draws: 42/18/0 winrate: 0.700
kos: 65 deaths: 42 selfKos: 3
dmg dealt/taken: 1832.4/1204.1
per-opponent:
  easy:    19W  1L  0D   winrate=0.950
  medium:  15W  5L  0D   winrate=0.750
  hard:     8W 12L  0D   winrate=0.400
```

**Ship gate (from the plan):**

- `hard` winrate ≥ 0.65 ← hardest to hit; don't ship below this
- `medium` winrate ≥ 0.85
- `easy` winrate ≥ 0.95
- `selfKos` ≤ 5% of `deaths`

If the current `best.json` misses the gate, keep training. If it passes,
move to step 6.

### Pick the better of two checkpoints

```bash
node smash/train-nn.js duel smash/ai/models/best.json smash/ai/models/gen-500.json --games 60
```

A wins > 55% → A is meaningfully better.

---

## 6. Ship the model

Once a checkpoint passes the eval gate:

```bash
cp smash/ai/models/best.json smash/ai/expert-v1.json
git add smash/ai/expert-v1.json
git commit -m "Smash: ship Expert v1 neural-net CPU"
git push
```

For a second or third iteration, bump the filename (`expert-v2.json`
etc.) and update the `fetch()` path at the top of `smash/index.html`
from `ai/expert-v1.json` to `ai/expert-v2.json`.

Note: `smash/ai/models/` is git-ignored. Only the file you explicitly
`cp` into `smash/ai/expert-vN.json` lands in the repo.

---

## 7. Verify in-browser

Open `smash/index.html` locally (file:// works, or serve with
`python -m http.server` from the repo root). On the character-select
screen:

1. Tap a CPU mode pill until it reads **EXPERT** (purple). If it reads
   `EXPERT…` or `EXPERT?`, the model didn't load — check the browser
   console for validation errors.
2. Pick a character and start a match.
3. Watch the Expert CPU play. It should move with intent — approach,
   jump, attack, recover — not walk off the stage.

On iPad (the real target): same, but also watch for frame drops. The
forward pass is tiny (~33 k FLOPs per CPU per frame), so any stutter
is probably unrelated.

---

## Troubleshooting

**`Error: policy.js: invalid model — obsVersion mismatch`**  
You're trying to load a model trained against an older observation
schema. Bump happens when `smash/ai/policy.js` feature list changes.
Fix: retrain from scratch (`--fresh`).

**Fitness plateaus early (winrate stuck near 0.2 for 100+ gens)**  
Try one at a time: (a) halve `--lr` to 0.015, (b) raise `--sigma` to
0.12, (c) raise `--matches-per-opp` to 4 to denoise the gradient.

**Self-KO rate stays high**  
The shape function already penalizes self-KO heavily (−80). If it
persists after ~200 gens, try `--matches-per-opp 4` so the signal
isn't drowned in noise.

**`node --check` complains about syntax**  
You're on a Node version that doesn't support `let`/`const` at top
level (pre-Node 6). `train-nn.js` uses `var` throughout but double-check
your Node version: `node --version` should be ≥ 12.

**Training is too slow**  
Biggest wins: `--seconds 20` (shorter match cap), `--matches-per-opp 1`
(noisier but faster), `--pop 20` (half the ES budget). Generation time
scales roughly linearly with `pop × matches-per-opp × seconds`.

---

## TL;DR

```bash
# train
node smash/train-nn.js train --generations 1000

# periodically:
node smash/train-nn.js eval smash/ai/models/best.json --games 60

# when gate passes:
cp smash/ai/models/best.json smash/ai/expert-v1.json
git add smash/ai/expert-v1.json
git commit -m "Smash: ship Expert v1 neural-net CPU"
git push
```
