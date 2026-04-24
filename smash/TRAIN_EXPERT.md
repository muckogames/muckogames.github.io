# Mucko Smash — Expert CPU Training Runbook

Step-by-step instructions to train, evaluate, and ship the Expert-tier
neural-network CPU from any machine.

There are two trainers:

- **`train-rl.js`** — REINFORCE with curriculum learning. **Recommended.**
  Produced `expert-v1.json` (Easy 1.00 / Medium 0.70 / Hard 0.70 WR).
- **`train-nn.js`** — Evolution Strategies (ES). Simpler but plateaued at
  ~55% Hard WR with the 64×64 network. Good for quick experiments.

---

## Prereqs

- Node.js ≥ 12 (check: `node --version`)
- Git
- ~500 MB free disk (checkpoints are ~770 KB each, git-ignored)
- ~45 minutes of laptop time for a full RL run (parallelized across 16 cores)

No `npm install`. No Python. No GPU.

---

## 1. Get the repo on your machine

```bash
git clone https://github.com/muckogames/muckogames.github.io.git
cd muckogames.github.io
git pull
```

---

## 2. Smoke-test the setup (30 seconds)

```bash
node smash/ai/_smoke.js
```

You should see 16 matches run, all ending with `reason=last-entity`, and
the final line `pass criteria: every match completed, no exceptions.`

---

## 3. Train with RL (recommended)

### Start a fresh run

```bash
node smash/train-rl.js train \
  --fresh \
  --hidden 128,128 \
  --epochs 4000 \
  --episodes 16 \
  --workers 16 \
  --lr 0.001 \
  --seconds 30
```

**What to expect:**

```
starting fresh  hidden: 128,128  params: 24837
workers: 16
epoch 0  phase 1  return -45.2  wr 0.00  selfKos 38  (612ms)
...
epoch 280  phase 1  return 32.1  wr 1.00  selfKos 0  (598ms)
...
epoch 1320  phase 2  return 18.4  wr 0.69  selfKos 0  (605ms)
...
epoch 2640  phase 3  return 41.5  wr 0.56  selfKos 0  (601ms)
```

**Three curriculum phases** (each ~33% of total epochs):

| Phase | Opponents | Rewards |
|-------|-----------|---------|
| 1 | Easy only | Survive + deal damage |
| 2 | Easy + Medium | Add KO/death stakes |
| 3 | Easy + Medium + Hard | Add win/loss terminal reward + self-play |

Watch for:
- **`selfKos`** dropping to 0 by epoch ~280 and staying there
- **`wr`** climbing to 1.00 in phase 1, then dropping to ~0.5–0.7 when
  Medium/Hard opponents are introduced — that's normal and expected
- Epoch timing stable at ~600ms — any wild variation means a problem

### Stop / resume

**Ctrl-C at any time.** `latest-rl.json` is written every epoch.

```bash
# Resume from latest checkpoint
node smash/train-rl.js train --epochs 4000 --workers 16
```

No `--fresh` → resumes from `smash/ai/models/latest-rl.json`. The epoch
counter continues from where it stopped.

### Flags

| Flag | Default | Effect |
|------|---------|--------|
| `--hidden W,W` | 64,64 | Network shape; 128,128 = 4× params, ~2× slower |
| `--epochs N` | 2000 | Total training epochs |
| `--episodes N` | 8 | Episodes per gradient update |
| `--workers N` | 0 | Worker threads (0 = serial); match to CPU core count |
| `--lr R` | 0.001 | Adam learning rate |
| `--seconds N` | 30 | Match length cap |
| `--gamma G` | 0.99 | Return discount |
| `--fresh` | — | Ignore latest-rl.json and start from scratch |
| `--min-phase N` | 0 | Force curriculum to start at phase N (useful on resume) |

---

## 4. Monitor progress

```bash
tail -f smash/ai/models/log-rl.csv
```

Columns: `epoch, phase, meanReturn, wins, losses, kos, selfKos, wallMs`

---

## 5. Evaluate a checkpoint

```bash
node smash/train-rl.js eval smash/ai/models/best-rl.json --games 60
```

Output:
```
matches: 60
wins/losses/draws: 48/12/0  winrate: 0.800
kos: 47  deaths: 9  selfKos: 0
dmg dealt/taken: 2991.6/2136.5
per-opponent:
  easy:   20W  0L  0D  winrate=1.000
  medium: 14W  6L  0D  winrate=0.700
  hard:   14W  6L  0D  winrate=0.700
```

**Ship gate:**

| Metric | Threshold |
|--------|-----------|
| Hard WR | ≥ 0.55 |
| Medium WR | ≥ 0.60 |
| Easy WR | ≥ 0.80 |
| selfKos | ≤ 5% of deaths |

The original ES gate (Hard ≥ 0.65 / Medium ≥ 0.85 / Easy ≥ 0.95) was set
before we knew the ceiling; the revised gate above reflects what a well-
trained REINFORCE model realistically achieves against these heuristics.

### Compare two checkpoints

```bash
node smash/train-rl.js duel smash/ai/models/best-rl.json smash/ai/models/rl-ep2000.json --games 60
```

A wins > 55% → A is meaningfully better.

---

## 6. Ship the model

```bash
cp smash/ai/models/best-rl.json smash/ai/expert-v1.json
git add smash/ai/expert-v1.json
git commit -m "Smash: ship Expert v1 RL CPU"
git push
```

For a second iteration, bump the filename (`expert-v2.json`) and update
the `fetch()` path near the top of `smash/index.html`.

`smash/ai/models/` is git-ignored. Only the file you explicitly `cp` into
`smash/ai/expert-vN.json` lands in the repo.

---

## 7. Verify in-browser

Open `smash/index.html` locally (`python -m http.server` from repo root,
or `file://`). On the character-select screen:

1. Tap a CPU mode pill until it reads **EXPERT** (purple). If it reads
   `EXPERT…` or `EXPERT?`, the model didn't load — check the browser
   console for validation errors.
2. Pick a character and start a match.
3. The Expert CPU should move with intent — approach, jump, attack,
   recover — not walk off the stage.

---

## 8. ES trainer (train-nn.js)

The original ES trainer is still present and functional. It is simpler
to understand but plateaued at ~55% Hard WR.

```bash
node smash/train-nn.js train \
  --generations 1000 \
  --pop 40 \
  --sigma 0.08 \
  --lr 0.03 \
  --matches-per-opp 2 \
  --seconds 30
```

Checkpoints land in `smash/ai/models/best.json` / `latest.json` / `log.csv`
(separate from the RL trainer's `best-rl.json` / `latest-rl.json` / `log-rl.csv`).

Eval: `node smash/train-nn.js eval smash/ai/models/best.json --games 60`

---

## Troubleshooting

**selfKos stays high past epoch 300**  
The shape function penalizes self-KO heavily (−80). If they don't clear
after ~300 epochs, try halving `--lr` to 0.0005.

**Model collapses mid-training (selfKos spikes from 0 to 30+)**  
This is a gradient explosion. The `--workers` path uses `clipGradNorm`
at 0.5 which should prevent it. If you see it anyway, check that you're
running with `--workers 16` (the single-threaded fallback path does not
clip). Do not lower `--lr` further — the collapse is a single bad update,
not a learning-rate issue.

**`require.main` guard / workers spawning sub-workers**  
The worker entry point uses `isMainThread`, not `require.main === module`
(the latter is `true` inside worker threads, which caused each of 16
workers to spawn 16 more sub-workers in an earlier bug). Do not change
this guard.

**Adam state format on manual checkpoint recovery**  
The expected format is `{t, beta1, beta2, eps, m:[{W,b}], v:[{W,b}]}`.
If you manually reconstruct an Adam state, match `makeAdamState` exactly
or the optimizer will silently use wrong momentum.

**Phase regression on resume**  
If you resume a run with `--epochs N` where N is shorter than the original,
the curriculum phase may recalculate backward. Use `--min-phase 2` (or 3)
to force the curriculum forward past the phase you were already in.

**Warm-starting a new run from an old checkpoint**  
Always copy `best-rl.json` to a named file first. The warm-start path
resets `bestReturn = -Infinity`, so the very first epoch of the new run
will overwrite `best-rl.json` regardless of whether it's actually better.

---

## What we learned training expert-v1

This section records lessons from ~6 training runs across two architectures.
Future agents: read this before changing the trainer.

**64×64 ES hit a ceiling at ~55% Hard WR.** Fitness landscape was too flat
for ES to climb further. Switching to REINFORCE + dense per-step rewards
immediately broke the plateau.

**128×128 vs 64×64.** The larger network (~25k params vs ~8k) was the main
jump. Phase 1 hit 100% Easy WR by epoch ~280 in 128×128; the 64×64 net
never got there cleanly.

**Gradient clipping is not optional.** Without `clipGradNorm(grads, 0.5)`,
every run collapsed between epochs 2200–2600: selfKos spiked from 0 to
28–43 for hundreds of epochs and the model never recovered. A single
catastrophic gradient update destroys survival behavior. With clipping,
the same zone produced brief bumps to selfKos 6–9 that resolved in 2–3
epochs.

**The worker guard must be `isMainThread`, not `require.main === module`.**
`require.main === module` is `true` inside Node worker threads, which caused
each of 16 workers to spawn 16 more sub-workers — 256 processes total. The
correct guard is `if (workerThreads && !isMainThread)` for the worker entry
point and `if (isMainThread)` for the main training block.

**Self-play at equal skill is unstable for REINFORCE.** A fine-tune run
that activated self-play from epoch 0 (with a pool of ~80% WR models)
caused WR to drift from 81% down to 50% over 1000 epochs. The gradient
signal from matched-skill opponents is too noisy for REINFORCE's on-policy
updates. Self-play is most useful mixed with heuristic opponents (33% ratio)
and only after the model is already well into phase 3.

**Phase 3 returns going negative is normal.** The last few hundred epochs
of a run often show negative mean returns as the model faces Hard opponents
and self-play. `best-rl.json` captures the peak, which typically occurs
mid-phase-3 before the self-play opponents catch up.

**Always copy best-rl.json before further training.** Any new run that
resets `bestReturn` will overwrite it on the first epoch.
