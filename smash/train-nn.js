#!/usr/bin/env node
//
// smash/train-nn.js — Evolution-Strategies trainer for the Expert CPU.
//
// Runs the headless sim.js + policy.js stack on your machine, evolves a small
// MLP policy network via OpenAI-ES (antithetic sampling + centered ranks +
// Adam), and writes JSON model checkpoints that the browser game can load.
//
// Commands:
//   node smash/train-nn.js train [opts]      run the ES loop
//   node smash/train-nn.js eval <model.json> run a holdout battery
//   node smash/train-nn.js duel <A.json> <B.json>
//
// No deps beyond sim.js + policy.js.
//
'use strict';

var fs = require('fs');
var path = require('path');
var Sim = require('./sim');
var Policy = require('./ai/policy');

var AI_DIR = path.join(__dirname, 'ai');
var CKPT_DIR = path.join(AI_DIR, 'models');
var CHAR_IDS = Sim.CHAR_IDS;

// ─── CLI helpers (mirrors train.js style) ───────────────────────────────

function parseArgs(argv) {
  var out = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var part = argv[i];
    if (part.slice(0, 2) === '--') {
      var key = part.slice(2);
      var next = argv[i + 1];
      if (next != null && next.slice(0, 2) !== '--') {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else out._.push(part);
  }
  return out;
}
function intArg(a, k, d) { if (a[k] == null) return d; var n = parseInt(a[k], 10); return isFinite(n) ? n : d; }
function numArg(a, k, d) { if (a[k] == null) return d; var n = parseFloat(a[k]); return isFinite(n) ? n : d; }
function strArg(a, k, d) { return a[k] != null ? String(a[k]) : d; }

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function saveJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function loadJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function pad3(n) { return ('000' + n).slice(-3); }

// ─── RNG (seeded — shared style with sim.js) ─────────────────────────────

function seededRng(seed) {
  var s = seed >>> 0;
  if (s === 0) s = 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function gaussFrom(rng) {
  var u1 = rng(); if (u1 < 1e-9) u1 = 1e-9;
  var u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Model <-> flat-vector conversion ────────────────────────────────────
//
// ES wants a single flat parameter vector so noise/gradient math is trivial.
// We keep a "template" model around (layer shapes + biases layout) and convert
// between the two forms.

function buildBlankModel(hidden) {
  var sizes = [Policy.OBS_DIM].concat(hidden).concat([Policy.OUT_DIM]);
  var layers = [];
  for (var i = 0; i < sizes.length - 1; i++) {
    var inN = sizes[i], outN = sizes[i + 1];
    var Wm = new Array(outN);
    for (var o = 0; o < outN; o++) {
      var row = new Array(inN);
      for (var k = 0; k < inN; k++) row[k] = 0;
      Wm[o] = row;
    }
    var b = new Array(outN);
    for (var j = 0; j < outN; j++) b[j] = 0;
    layers.push({
      type: 'dense',
      in: inN,
      out: outN,
      activation: i === sizes.length - 2 ? 'linear' : 'tanh',
      W: Wm,
      b: b
    });
  }
  return {
    schemaVersion: 1,
    obsVersion: Policy.OBS_VERSION,
    arch: 'mlp',
    inDim: Policy.OBS_DIM,
    outDim: Policy.OUT_DIM,
    layers: layers,
    meta: {}
  };
}

function paramCount(hidden) {
  var sizes = [Policy.OBS_DIM].concat(hidden).concat([Policy.OUT_DIM]);
  var total = 0;
  for (var i = 0; i < sizes.length - 1; i++) total += sizes[i] * sizes[i + 1] + sizes[i + 1];
  return total;
}

// Write flat vector -> nested model in place (reuses the passed model object).
function unflattenInto(flat, model) {
  var idx = 0;
  for (var l = 0; l < model.layers.length; l++) {
    var L = model.layers[l];
    for (var o = 0; o < L.out; o++) {
      var row = L.W[o];
      for (var k = 0; k < L.in; k++) { row[k] = flat[idx++]; }
    }
    for (var j = 0; j < L.out; j++) L.b[j] = flat[idx++];
  }
  return model;
}
function flatten(model) {
  var total = 0;
  for (var l = 0; l < model.layers.length; l++) total += model.layers[l].in * model.layers[l].out + model.layers[l].out;
  var flat = new Float64Array(total);
  var idx = 0;
  for (var m = 0; m < model.layers.length; m++) {
    var L = model.layers[m];
    for (var o = 0; o < L.out; o++) {
      var row = L.W[o];
      for (var k = 0; k < L.in; k++) flat[idx++] = row[k];
    }
    for (var j = 0; j < L.out; j++) flat[idx++] = L.b[j];
  }
  return flat;
}
function heInitFlat(hidden, rng) {
  var sizes = [Policy.OBS_DIM].concat(hidden).concat([Policy.OUT_DIM]);
  var total = paramCount(hidden);
  var flat = new Float64Array(total);
  var idx = 0;
  for (var i = 0; i < sizes.length - 1; i++) {
    var inN = sizes[i], outN = sizes[i + 1];
    var scale = Math.sqrt(2 / inN);
    for (var o = 0; o < outN; o++) {
      for (var k = 0; k < inN; k++) flat[idx++] = gaussFrom(rng) * scale;
    }
    for (var j = 0; j < outN; j++) flat[idx++] = 0;
  }
  return flat;
}

// ─── Fitness: one match + shaped score ──────────────────────────────────

function shapePlayerScore(summary, playerId) {
  var p = summary.players[playerId];
  var winnerBonus = summary.winnerId === playerId ? 200 : 0;
  var timeoutPenalty = summary.resultReason === 'timeout' && summary.winnerId !== playerId ? 30 : 0;
  return winnerBonus
    + p.stats.kos * 50
    + p.stats.damageDealt * 1.0
    + p.stocks * 20
    - p.stats.damageTaken * 1.0
    - p.stats.deaths * 40
    - p.stats.selfKos * 80
    - p.damage * 0.15
    - timeoutPenalty;
}

function makeNeuralSlot(charId, model) {
  return {
    charId: charId,
    controller: {
      type: 'scripted',
      getInput: function (match, entity, dt) {
        return Policy.neuralDecide(match, entity, dt, model);
      }
    }
  };
}
function makeHeuristicSlot(charId, genome) {
  return { charId: charId, controller: { type: 'heuristic', genome: genome } };
}

// `challenger` is a policy.js model. `opponent` is either
//   { kind: 'heuristic', genome } or { kind: 'neural', model }.
function runOneMatch(challenger, opponent, charA, charB, seed, swapSides, opts) {
  var challengerSlot = makeNeuralSlot(charA, challenger);
  var opponentSlot = opponent.kind === 'neural'
    ? makeNeuralSlot(charB, opponent.model)
    : makeHeuristicSlot(charB, opponent.genome);
  var roster = swapSides ? [opponentSlot, challengerSlot] : [challengerSlot, opponentSlot];
  var result = Sim.runMatch({
    seed: seed >>> 0,
    arenaSeed: (seed ^ 0x9e3779b9) >>> 0,
    stocks: opts.stocks,
    roster: roster,
    stepDt: Sim.constants.FIXED_STEP,
    maxSteps: opts.maxSteps
  });
  var summary = result.summary;
  var challengerId = swapSides ? 1 : 0;
  return {
    score: shapePlayerScore(summary, challengerId),
    won: summary.winnerId === challengerId,
    lost: summary.winnerId != null && summary.winnerId !== challengerId,
    summary: summary,
    challengerId: challengerId
  };
}

// Opponent battery: mix of heuristic tiers + optional self-play pool.
function buildBattery(opts, selfPlayPool) {
  var battery = [];
  if (opts.useEasy)   battery.push({ kind: 'heuristic', tag: 'easy',   genome: Sim.EASY_MODE_GENOME });
  if (opts.useMedium) battery.push({ kind: 'heuristic', tag: 'medium', genome: Sim.MEDIUM_MODE_GENOME });
  if (opts.useHard)   battery.push({ kind: 'heuristic', tag: 'hard',   genome: Sim.HARD_MODE_GENOME });
  if (selfPlayPool && selfPlayPool.length) {
    // Sample from the pool: a few slots, not all (to keep fitness cheap).
    var samples = Math.min(opts.selfPlaySamples || 2, selfPlayPool.length);
    for (var i = 0; i < samples; i++) {
      var pick = selfPlayPool[selfPlayPool.length - 1 - i]; // most recent first
      battery.push({ kind: 'neural', tag: 'self-' + pick.gen, model: pick.model });
    }
  }
  if (!battery.length) battery.push({ kind: 'heuristic', tag: 'medium', genome: Sim.MEDIUM_MODE_GENOME });
  return battery;
}

function evaluateFitness(challenger, opts, rng, battery) {
  var total = 0, nMatches = 0;
  var wins = 0, losses = 0, draws = 0;
  var kos = 0, deaths = 0, selfKos = 0, dmgDealt = 0, dmgTaken = 0;
  var perOpp = {};

  for (var bi = 0; bi < battery.length; bi++) {
    var opp = battery[bi];
    if (!perOpp[opp.tag]) perOpp[opp.tag] = { w: 0, l: 0, d: 0 };
    for (var mi = 0; mi < opts.matchesPerOpp; mi++) {
      var seedBase = (opts.matchSeedBase + bi * 7919 + mi * 131) >>> 0;
      var charA = CHAR_IDS[Math.floor(rng() * CHAR_IDS.length)];
      var charB = CHAR_IDS[Math.floor(rng() * CHAR_IDS.length)];
      for (var side = 0; side < 2; side++) {
        var swap = side === 1;
        var res = runOneMatch(challenger, opp, charA, charB, seedBase + side, swap, opts);
        total += res.score;
        nMatches++;
        if (res.won) { wins++; perOpp[opp.tag].w++; }
        else if (res.lost) { losses++; perOpp[opp.tag].l++; }
        else { draws++; perOpp[opp.tag].d++; }
        var p = res.summary.players[res.challengerId];
        kos += p.stats.kos;
        deaths += p.stats.deaths;
        selfKos += p.stats.selfKos;
        dmgDealt += p.stats.damageDealt;
        dmgTaken += p.stats.damageTaken;
      }
    }
  }
  return {
    score: total / Math.max(1, nMatches),
    matches: nMatches,
    wins: wins, losses: losses, draws: draws,
    kos: kos, deaths: deaths, selfKos: selfKos,
    dmgDealt: dmgDealt, dmgTaken: dmgTaken,
    perOpp: perOpp
  };
}

// ─── ES / Adam ──────────────────────────────────────────────────────────

function centeredRanks(values) {
  var n = values.length;
  var sorted = values.map(function (v, i) { return { v: v, i: i }; });
  sorted.sort(function (a, b) { return a.v - b.v; });
  var ranks = new Float64Array(n);
  for (var r = 0; r < n; r++) ranks[sorted[r].i] = r;
  // normalize to [-0.5, 0.5]
  var out = new Float64Array(n);
  for (var i = 0; i < n; i++) out[i] = ranks[i] / (n - 1) - 0.5;
  return out;
}

function makeAdam(size, lr, b1, b2, eps) {
  var m = new Float64Array(size);
  var v = new Float64Array(size);
  var t = 0;
  return function step(theta, grad) {
    t++;
    var bc1 = 1 - Math.pow(b1, t);
    var bc2 = 1 - Math.pow(b2, t);
    for (var i = 0; i < size; i++) {
      m[i] = b1 * m[i] + (1 - b1) * grad[i];
      v[i] = b2 * v[i] + (1 - b2) * grad[i] * grad[i];
      var mh = m[i] / bc1;
      var vh = v[i] / bc2;
      theta[i] += lr * mh / (Math.sqrt(vh) + eps);
    }
  };
}

// ─── Checkpoint management ───────────────────────────────────────────────

function buildModelPayload(flat, scratch, meta) {
  unflattenInto(flat, scratch);
  return {
    schemaVersion: 1,
    obsVersion: Policy.OBS_VERSION,
    arch: 'mlp',
    inDim: Policy.OBS_DIM,
    outDim: Policy.OUT_DIM,
    layers: scratch.layers.map(function (L) {
      return {
        type: 'dense',
        in: L.in,
        out: L.out,
        activation: L.activation,
        W: L.W.map(function (row) { return row.slice(); }),
        b: L.b.slice()
      };
    }),
    meta: meta || {}
  };
}

function saveCheckpoint(flat, scratch, meta, label) {
  ensureDir(CKPT_DIR);
  var model = buildModelPayload(flat, scratch, meta);
  saveJson(path.join(CKPT_DIR, label + '.json'), model);
  return model;
}

function appendLog(row) {
  ensureDir(CKPT_DIR);
  var file = path.join(CKPT_DIR, 'log.csv');
  var header = 'gen,meanFitness,bestFitness,wins,losses,draws,selfKos,winrate,wallMs\n';
  if (!fs.existsSync(file)) fs.writeFileSync(file, header, 'utf8');
  fs.appendFileSync(file, row + '\n', 'utf8');
}

function loadSelfPlayPool(opts) {
  if (!opts.selfPlay) return [];
  if (!fs.existsSync(CKPT_DIR)) return [];
  var files = fs.readdirSync(CKPT_DIR).filter(function (f) { return /^gen-\d+\.json$/.test(f); });
  files.sort();
  var out = [];
  var stride = Math.max(1, Math.floor(files.length / (opts.selfPlayKeep || 6)));
  for (var i = files.length - 1; i >= 0 && out.length < (opts.selfPlayKeep || 6); i -= stride) {
    var m = loadJson(path.join(CKPT_DIR, files[i]));
    var gen = parseInt(files[i].match(/\d+/)[0], 10);
    out.push({ gen: gen, model: m });
  }
  return out;
}

// ─── Train loop ──────────────────────────────────────────────────────────

function train(args) {
  var hidden = (strArg(args, 'hidden', '64,64')).split(',').map(function (n) { return parseInt(n, 10); }).filter(function (n) { return n > 0; });
  if (!hidden.length) hidden = [64, 64];
  var populationPairs = Math.max(2, intArg(args, 'pop', 40) >> 1); // pairs (antithetic); total evals = 2 * pairs
  var generations = intArg(args, 'generations', 500);
  var sigma = numArg(args, 'sigma', 0.08);
  var lr = numArg(args, 'lr', 0.03);
  var weightDecay = numArg(args, 'weight-decay', 5e-5);
  var seed = intArg(args, 'seed', 1337) >>> 0;
  var matchesPerOpp = intArg(args, 'matches-per-opp', 2);
  var stocks = intArg(args, 'stocks', 3);
  var seconds = intArg(args, 'seconds', 30);
  var fresh = !!args.fresh;
  var selfPlayEveryN = intArg(args, 'self-play-every', 20);
  var snapshotEveryN = intArg(args, 'snapshot-every', 20);

  var rng = seededRng(seed);
  var scratch = buildBlankModel(hidden);
  var nParams = paramCount(hidden);
  console.log('hidden:', hidden.join('x'), ' params:', nParams, ' pairs:', populationPairs, ' sigma:', sigma, ' lr:', lr);

  // Resume if latest.json exists (unless --fresh).
  var theta;
  var startGen = 0;
  var latestPath = path.join(CKPT_DIR, 'latest.json');
  if (!fresh && fs.existsSync(latestPath)) {
    var resume = loadJson(latestPath);
    try { Policy.validateModel(resume); } catch (err) {
      console.warn('resume model invalid (' + err.message + '); starting fresh');
      theta = heInitFlat(hidden, rng);
    }
    if (!theta) {
      theta = flatten(resume);
      if (resume.meta && typeof resume.meta.gen === 'number') startGen = resume.meta.gen + 1;
      console.log('resumed from gen', resume.meta && resume.meta.gen, ' lr carry:', (resume.meta && resume.meta.lr) || lr);
    }
  } else {
    if (fresh) console.log('starting fresh');
    theta = heInitFlat(hidden, rng);
  }

  var adam = makeAdam(nParams, lr, 0.9, 0.999, 1e-8);

  var bestHoldoutFitness = -Infinity;
  var bestHoldoutPath = path.join(CKPT_DIR, 'best.json');
  if (fs.existsSync(bestHoldoutPath)) {
    try {
      var prevBest = loadJson(bestHoldoutPath);
      if (prevBest.meta && typeof prevBest.meta.fitness === 'number') bestHoldoutFitness = prevBest.meta.fitness;
    } catch (e) { /* ignore */ }
  }

  var fitnessOpts = {
    useEasy: args['use-easy'] !== 'false',
    useMedium: args['use-medium'] !== 'false',
    useHard: args['use-hard'] !== 'false',
    matchesPerOpp: matchesPerOpp,
    stocks: stocks,
    maxSteps: seconds * 60,
    selfPlaySamples: intArg(args, 'self-play-samples', 2),
    matchSeedBase: 0
  };

  for (var gen = startGen; gen < startGen + generations; gen++) {
    var t0 = Date.now();

    // Self-play pool periodically reloaded
    var pool = (gen % selfPlayEveryN === 0) ? loadSelfPlayPool({ selfPlay: true, selfPlayKeep: 4 }) : [];
    var battery = buildBattery(fitnessOpts, pool);

    // Population: generate P/2 noise vectors, evaluate (+ε, -ε) pairs.
    var P = populationPairs;
    var fitnesses = new Float64Array(P * 2);
    var seeds = [];
    for (var s = 0; s < P; s++) seeds.push(((gen + 1) * 1000003 + s * 911) >>> 0);

    // Build scratch perturbed params (reused).
    var noise = new Array(P);
    var perturbed = new Float64Array(nParams);

    for (var p = 0; p < P; p++) {
      var pRng = seededRng(seeds[p]);
      var eps = new Float64Array(nParams);
      for (var i = 0; i < nParams; i++) eps[i] = gaussFrom(pRng);
      noise[p] = eps;

      // +eps
      for (var i2 = 0; i2 < nParams; i2++) perturbed[i2] = theta[i2] + sigma * eps[i2];
      unflattenInto(perturbed, scratch);
      fitnessOpts.matchSeedBase = (seeds[p] ^ 0xa5a5a5a5) >>> 0;
      fitnesses[p * 2] = evaluateFitness(scratch, fitnessOpts, seededRng(seeds[p] ^ 0x12345), battery).score;

      // -eps
      for (var i3 = 0; i3 < nParams; i3++) perturbed[i3] = theta[i3] - sigma * eps[i3];
      unflattenInto(perturbed, scratch);
      fitnessOpts.matchSeedBase = (seeds[p] ^ 0x5a5a5a5a) >>> 0;
      fitnesses[p * 2 + 1] = evaluateFitness(scratch, fitnessOpts, seededRng(seeds[p] ^ 0x67890), battery).score;
    }

    // Centered rank transform, then gradient estimate.
    var vals = [];
    for (var q = 0; q < fitnesses.length; q++) vals.push(fitnesses[q]);
    var ranks = centeredRanks(vals);
    var grad = new Float64Array(nParams);
    for (var pp = 0; pp < P; pp++) {
      var rPlus = ranks[pp * 2];
      var rMinus = ranks[pp * 2 + 1];
      var w = (rPlus - rMinus);
      var eps2 = noise[pp];
      for (var ii = 0; ii < nParams; ii++) grad[ii] += w * eps2[ii];
    }
    var denom = 2 * P * sigma;
    for (var jj = 0; jj < nParams; jj++) grad[jj] /= denom;
    // weight decay
    for (var jk = 0; jk < nParams; jk++) grad[jk] -= weightDecay * theta[jk];

    adam(theta, grad);

    // Stats + save.
    var meanF = 0, bestF = -Infinity;
    for (var x = 0; x < fitnesses.length; x++) { meanF += fitnesses[x]; if (fitnesses[x] > bestF) bestF = fitnesses[x]; }
    meanF /= fitnesses.length;

    // Holdout: evaluate current theta on a separate battery of seeds.
    unflattenInto(theta, scratch);
    fitnessOpts.matchSeedBase = (gen * 777017) >>> 0;
    var holdout = evaluateFitness(scratch, {
      useEasy: true, useMedium: true, useHard: true,
      matchesPerOpp: Math.max(2, matchesPerOpp),
      stocks: stocks, maxSteps: seconds * 60,
      matchSeedBase: (gen * 777017) >>> 0
    }, seededRng((gen + 1) * 31337), buildBattery(fitnessOpts, []));

    var wallMs = Date.now() - t0;
    var meta = {
      gen: gen,
      hidden: hidden,
      sigma: sigma,
      lr: lr,
      meanFitness: meanF,
      bestPopFitness: bestF,
      holdout: {
        score: holdout.score,
        wins: holdout.wins, losses: holdout.losses, draws: holdout.draws,
        kos: holdout.kos, deaths: holdout.deaths, selfKos: holdout.selfKos,
        winrate: holdout.matches ? holdout.wins / holdout.matches : 0,
        perOpp: holdout.perOpp
      },
      wallMs: wallMs,
      trainedAt: new Date().toISOString()
    };
    saveCheckpoint(theta, scratch, meta, 'latest');
    if (gen % snapshotEveryN === 0) saveCheckpoint(theta, scratch, meta, 'gen-' + pad3(gen));
    if (holdout.score > bestHoldoutFitness) {
      bestHoldoutFitness = holdout.score;
      meta.fitness = bestHoldoutFitness;
      saveCheckpoint(theta, scratch, meta, 'best');
    }
    appendLog([gen, meanF.toFixed(3), bestF.toFixed(3), holdout.wins, holdout.losses, holdout.draws, holdout.selfKos, (holdout.matches ? holdout.wins / holdout.matches : 0).toFixed(3), wallMs].join(','));

    var oppLine = '';
    for (var tag in holdout.perOpp) if (Object.prototype.hasOwnProperty.call(holdout.perOpp, tag)) {
      var r = holdout.perOpp[tag];
      var t = r.w + r.l + r.d;
      oppLine += ' ' + tag + ':' + (t ? (r.w / t).toFixed(2) : '—');
    }
    console.log('gen', gen,
      'mean', meanF.toFixed(2),
      'best', bestF.toFixed(2),
      'holdout', holdout.score.toFixed(2),
      'wr', (holdout.matches ? holdout.wins / holdout.matches : 0).toFixed(3),
      'selfKos', holdout.selfKos,
      oppLine,
      '(' + wallMs + 'ms)'
    );
  }
}

// ─── Eval / Duel commands ────────────────────────────────────────────────

function evalCmd(args) {
  var file = args.file || args._[1];
  if (!file) throw new Error('usage: train-nn.js eval <model.json>');
  var model = loadJson(file);
  Policy.validateModel(model);
  var games = intArg(args, 'games', 40);
  var stocks = intArg(args, 'stocks', 3);
  var seconds = intArg(args, 'seconds', 45);
  var seed = intArg(args, 'seed', 424242);
  var rng = seededRng(seed);
  var battery = [
    { kind: 'heuristic', tag: 'easy',   genome: Sim.EASY_MODE_GENOME },
    { kind: 'heuristic', tag: 'medium', genome: Sim.MEDIUM_MODE_GENOME },
    { kind: 'heuristic', tag: 'hard',   genome: Sim.HARD_MODE_GENOME }
  ];
  var fitOpts = {
    matchesPerOpp: Math.max(1, Math.floor(games / (2 * battery.length))),
    stocks: stocks,
    maxSteps: seconds * 60,
    matchSeedBase: seed
  };
  var res = evaluateFitness(model, fitOpts, rng, battery);
  console.log('matches:', res.matches, 'score:', res.score.toFixed(2));
  console.log('wins/losses/draws:', res.wins + '/' + res.losses + '/' + res.draws, 'winrate:', (res.wins / Math.max(1, res.matches)).toFixed(3));
  console.log('kos:', res.kos, 'deaths:', res.deaths, 'selfKos:', res.selfKos);
  console.log('dmg dealt/taken:', res.dmgDealt.toFixed(1) + '/' + res.dmgTaken.toFixed(1));
  console.log('per-opponent:');
  for (var tag in res.perOpp) if (Object.prototype.hasOwnProperty.call(res.perOpp, tag)) {
    var r = res.perOpp[tag];
    var t = r.w + r.l + r.d;
    console.log('  ' + tag + ':  ' + r.w + 'W ' + r.l + 'L ' + r.d + 'D   winrate=' + (t ? (r.w / t).toFixed(3) : '—'));
  }
}

function duelCmd(args) {
  var a = args._[1], b = args._[2];
  if (!a || !b) throw new Error('usage: train-nn.js duel <A.json> <B.json>');
  var mA = loadJson(a); Policy.validateModel(mA);
  var mB = loadJson(b); Policy.validateModel(mB);
  var games = intArg(args, 'games', 40);
  var stocks = intArg(args, 'stocks', 3);
  var seconds = intArg(args, 'seconds', 45);
  var seed = intArg(args, 'seed', 909090);
  var rng = seededRng(seed);
  var aWins = 0, bWins = 0, draws = 0;
  for (var i = 0; i < games; i++) {
    var charA = CHAR_IDS[Math.floor(rng() * CHAR_IDS.length)];
    var charB = CHAR_IDS[Math.floor(rng() * CHAR_IDS.length)];
    for (var side = 0; side < 2; side++) {
      var swap = side === 1;
      var res = runOneMatch(mA, { kind: 'neural', model: mB }, charA, charB,
        (seed + i * 131 + side) >>> 0, swap, { stocks: stocks, maxSteps: seconds * 60 });
      if (res.won) aWins++;
      else if (res.lost) bWins++;
      else draws++;
    }
  }
  var total = games * 2;
  console.log('A vs B over', total, 'matches:');
  console.log('  A wins:', aWins, '(' + (100 * aWins / total).toFixed(1) + '%)');
  console.log('  B wins:', bWins, '(' + (100 * bWins / total).toFixed(1) + '%)');
  console.log('  draws: ', draws);
}

// ─── Main ────────────────────────────────────────────────────────────────

function main() {
  var args = parseArgs(process.argv.slice(2));
  var cmd = args._[0] || 'train';
  if (cmd === 'train') train(args);
  else if (cmd === 'eval') evalCmd(args);
  else if (cmd === 'duel') duelCmd(args);
  else {
    console.error('usage:');
    console.error('  node smash/train-nn.js train [--pop 40] [--generations 500] [--sigma 0.08] [--lr 0.03]');
    console.error('                              [--hidden 64,64] [--matches-per-opp 2] [--seconds 30]');
    console.error('                              [--fresh] [--seed 1337]');
    console.error('  node smash/train-nn.js eval  <model.json> [--games 40]');
    console.error('  node smash/train-nn.js duel  <A.json> <B.json> [--games 40]');
    process.exit(1);
  }
}

main();
