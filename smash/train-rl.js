#!/usr/bin/env node
//
// smash/train-rl.js — REINFORCE with curriculum learning for the Expert CPU.
//
// Three-phase curriculum:
//   Phase 1 (0–33% of epochs):  survive + deal damage. Easy opponent.
//   Phase 2 (33–66%):           add KO/death stakes. Easy + Medium.
//   Phase 3 (66–100%):          add match win/loss. All difficulties.
//
// Commands:
//   node smash/train-rl.js train [--epochs N] [--lr N] [--fresh] [--min-phase N] [--hidden 128,128]
//   node smash/train-rl.js eval <model.json> [--games N]
//
// Checkpoints use the same JSON format as train-nn.js, so the browser
// game can load them identically via the Expert tier loader.
//
'use strict';

var fs   = require('fs');
var path = require('path');
var os     = require('os');
var Sim    = require('./sim');
var Policy = require('./ai/policy');

var workerThreads = null;
try { workerThreads = require('worker_threads'); } catch (e) {}
var isMainThread = !workerThreads || workerThreads.isMainThread;

var AI_DIR   = path.join(__dirname, 'ai');
var CKPT_DIR = path.join(AI_DIR, 'models');

// ─── Helpers ──────────────────────────────────────────────────────────────

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function saveJson(f, v) { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', 'utf8'); }
function loadJson(f)    { return JSON.parse(fs.readFileSync(f, 'utf8')); }

function parseArgs(argv) {
  var out = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a.slice(0, 2) === '--') {
      var key = a.slice(2);
      var nxt = argv[i + 1];
      if (nxt != null && nxt.slice(0, 2) !== '--') { out[key] = nxt; i++; }
      else out[key] = true;
    } else { out._.push(a); }
  }
  return out;
}
function lcgRand(seed) { return ((seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
function intArg(a, k, d) { var n = parseInt(a[k],  10); return isFinite(n) ? n : d; }
function numArg(a, k, d) { var n = parseFloat(a[k]);    return isFinite(n) ? n : d; }
function strArg(a, k, d) { return (a[k] != null && a[k] !== true) ? String(a[k]) : d; }

// ─── Math ─────────────────────────────────────────────────────────────────

function sigmoid(x) {
  if (x >= 0) { var ez = Math.exp(-x); return 1 / (1 + ez); }
  var ep = Math.exp(x); return ep / (1 + ep);
}

// Backprop through the policy network given stored activations from
// policyForwardFull. Computes ∇θ log π(a|s) * advantage per weight.
// actionVec: [0|1, 0|1, 0|1, 0|1, 0|1]  (sampled binary actions)
// Returns array of { dW, db } — one entry per layer.
function policyBackward(model, acts, actionVec, advantage) {
  var logits = acts[acts.length - 1];

  // d(log prob) / d(logit_k) = action_k − sigmoid(logit_k)
  var dX = new Array(Policy.OUT_DIM);
  for (var k = 0; k < Policy.OUT_DIM; k++) {
    dX[k] = (actionVec[k] - sigmoid(logits[k])) * advantage;
  }

  var grads = new Array(model.layers.length);
  for (var l = model.layers.length - 1; l >= 0; l--) {
    var layer = model.layers[l];
    var xIn   = acts[l];
    var xOut  = acts[l + 1];

    // Activation derivative (tanh: 1 − y², linear: 1)
    var dPre = new Array(layer.out);
    for (var o = 0; o < layer.out; o++) {
      dPre[o] = (layer.activation === 'tanh')
        ? dX[o] * (1 - xOut[o] * xOut[o])
        : dX[o];
    }

    // Outer product: dW[o][k] = dPre[o] * xIn[k]
    var dW = new Array(layer.out);
    for (var o2 = 0; o2 < layer.out; o2++) {
      var dpo = dPre[o2];
      var wr  = new Array(layer.in);
      for (var k2 = 0; k2 < layer.in; k2++) wr[k2] = dpo * xIn[k2];
      dW[o2] = wr;
    }
    grads[l] = { dW: dW, db: dPre };

    // Propagate signal to previous layer (skip for l === 0)
    if (l > 0) {
      var dXPrev = new Array(layer.in);
      for (var k3 = 0; k3 < layer.in; k3++) dXPrev[k3] = 0;
      for (var o3 = 0; o3 < layer.out; o3++) {
        var dpo3 = dPre[o3];
        var wrow = layer.W[o3];
        for (var k4 = 0; k4 < layer.in; k4++) dXPrev[k4] += wrow[k4] * dpo3;
      }
      dX = dXPrev;
    }
  }
  return grads;
}

// ─── Adam (gradient ascent — maximise expected return) ────────────────────

function makeAdamState(model) {
  var state = { t: 0, beta1: 0.9, beta2: 0.999, eps: 1e-8, m: [], v: [] };
  for (var l = 0; l < model.layers.length; l++) {
    var layer = model.layers[l];
    var mW = [], vW = [];
    for (var o = 0; o < layer.out; o++) {
      var mr = new Array(layer.in), vr = new Array(layer.in);
      for (var k = 0; k < layer.in; k++) { mr[k] = 0; vr[k] = 0; }
      mW.push(mr); vW.push(vr);
    }
    var mb = new Array(layer.out), vb = new Array(layer.out);
    for (var j = 0; j < layer.out; j++) { mb[j] = 0; vb[j] = 0; }
    state.m.push({ W: mW, b: mb });
    state.v.push({ W: vW, b: vb });
  }
  return state;
}

function applyAdam(model, grads, adam, lr) {
  adam.t++;
  var t = adam.t, b1 = adam.beta1, b2 = adam.beta2, eps = adam.eps;
  var bc1 = 1 - Math.pow(b1, t), bc2 = 1 - Math.pow(b2, t);
  for (var l = 0; l < model.layers.length; l++) {
    var layer = model.layers[l];
    var gl = grads[l], ml = adam.m[l], vl = adam.v[l];
    for (var o = 0; o < layer.out; o++) {
      for (var k = 0; k < layer.in; k++) {
        var g = gl.dW[o][k];
        ml.W[o][k] = b1 * ml.W[o][k] + (1 - b1) * g;
        vl.W[o][k] = b2 * vl.W[o][k] + (1 - b2) * g * g;
        // += for ascent (maximising return)
        layer.W[o][k] += lr * (ml.W[o][k] / bc1) / (Math.sqrt(vl.W[o][k] / bc2) + eps);
      }
      var gb = gl.db[o];
      ml.b[o] = b1 * ml.b[o] + (1 - b1) * gb;
      vl.b[o] = b2 * vl.b[o] + (1 - b2) * gb * gb;
      layer.b[o] += lr * (ml.b[o] / bc1) / (Math.sqrt(vl.b[o] / bc2) + eps);
    }
  }
}

function makeZeroGrads(model) {
  var grads = [];
  for (var l = 0; l < model.layers.length; l++) {
    var layer = model.layers[l];
    var dW = [];
    for (var o = 0; o < layer.out; o++) {
      var row = new Array(layer.in);
      for (var k = 0; k < layer.in; k++) row[k] = 0;
      dW.push(row);
    }
    var db = new Array(layer.out);
    for (var j = 0; j < layer.out; j++) db[j] = 0;
    grads.push({ dW: dW, db: db });
  }
  return grads;
}

function scaleGrads(grads, scale) {
  for (var l = 0; l < grads.length; l++) {
    var gl = grads[l];
    for (var o = 0; o < gl.dW.length; o++) {
      for (var k = 0; k < gl.dW[o].length; k++) gl.dW[o][k] *= scale;
      gl.db[o] *= scale;
    }
  }
}

function clipGradNorm(grads, maxNorm) {
  var norm2 = 0;
  for (var l = 0; l < grads.length; l++) {
    var gl = grads[l];
    for (var o = 0; o < gl.dW.length; o++) {
      for (var k = 0; k < gl.dW[o].length; k++) norm2 += gl.dW[o][k] * gl.dW[o][k];
      norm2 += gl.db[o] * gl.db[o];
    }
  }
  var norm = Math.sqrt(norm2);
  if (norm > maxNorm) {
    var s = maxNorm / norm;
    for (var l2 = 0; l2 < grads.length; l2++) {
      var g2 = grads[l2];
      for (var o2 = 0; o2 < g2.dW.length; o2++) {
        for (var k2 = 0; k2 < g2.dW[o2].length; k2++) g2.dW[o2][k2] *= s;
        g2.db[o2] *= s;
      }
    }
  }
}

// ─── Curriculum ───────────────────────────────────────────────────────────

function getCurriculumPhase(epoch, total) {
  var f = epoch / total;
  return f < 0.33 ? 1 : f < 0.66 ? 2 : 3;
}

function getOpponents(phase) {
  var e = { label: 'easy',   type: 'heuristic', genome: Sim.EASY_MODE_GENOME   };
  var m = { label: 'medium', type: 'heuristic', genome: Sim.MEDIUM_MODE_GENOME };
  var h = { label: 'hard',   type: 'heuristic', genome: Sim.HARD_MODE_GENOME   };
  if (phase === 1) return [e];
  if (phase === 2) return [e, m];
  return [e, m, h];
}

function chooseCharPair(seed) {
  var ids = Sim.CHAR_IDS;
  var n = ids.length;
  var a = Math.floor(lcgRand((seed ^ 0x9e3779b9) >>> 0) * n);
  var b = Math.floor(lcgRand((seed ^ 0x85ebca6b) >>> 0) * n);
  if (n > 1 && a === b && lcgRand((seed ^ 0xc2b2ae35) >>> 0) < 0.85) {
    b = (b + 1 + Math.floor(lcgRand((seed ^ 0x27d4eb2f) >>> 0) * (n - 1))) % n;
  }
  return { nnCharId: ids[a], oppCharId: ids[b] };
}

function findNearestOpponent(match, entity) {
  var best = null;
  var bestDist = Infinity;
  for (var i = 0; i < match.entities.length; i++) {
    var other = match.entities[i];
    if (other.id === entity.id || other.ko) continue;
    var dx = other.x - entity.x;
    var dy = other.y - entity.y;
    var dist = Math.abs(dx) + Math.abs(dy) * 0.6;
    if (dist < bestDist) {
      best = other;
      bestDist = dist;
    }
  }
  return best;
}

function computeUrgencyPenalty(stepCount) {
  var secs = stepCount / 60;
  if (secs < 8) return 0;
  if (secs < 16) return -0.0015;
  return -0.006;
}

// Per-step reward computed AFTER stepMatch runs (events reflect this frame).
// prevStats = { damageDealt, damageTaken } captured before the step.
function computeStepReward(match, events, nnId, nnEntity, prevStats, phase, pressureState) {
  var r = 0.005; // survival: ~+9 over 30-second match at 60 fps
  r += computeUrgencyPenalty(match.stepCount);

  // Smooth edge-proximity penalty. Provides a continuous gradient signal
  // to stay away from the blast zone without the destabilizing spike of a
  // larger discrete self-KO penalty. Stage left edge = 120, right = 680.
  var edgeDist = Math.min(nnEntity.x - 120, 680 - nnEntity.x);
  if (edgeDist < 100) r -= (100 - edgeDist) * 0.0015;

  var ddDealt = nnEntity.stats.damageDealt - prevStats.damageDealt;
  var ddTaken = nnEntity.stats.damageTaken - prevStats.damageTaken;
  r += ddDealt * 0.4;

  if (phase >= 2) {
    r -= ddTaken * 0.2;
  }

  var target = findNearestOpponent(match, nnEntity);
  if (target) {
    var dx = Math.abs(target.x - nnEntity.x);
    var dy = Math.abs(target.y - nnEntity.y);
    var noExchange = ddDealt < 0.001 && ddTaken < 0.001;
    var disengaged = dx > 185 && dy > 75;
    if (noExchange && disengaged) pressureState.disengagedFrames++;
    else pressureState.disengagedFrames = 0;

    if (noExchange && nnEntity.specialActive && dx > 170) pressureState.campingFrames++;
    else pressureState.campingFrames = 0;

    if (pressureState.disengagedFrames > 150) {
      r -= Math.min(0.002, (pressureState.disengagedFrames - 150) * 0.000015);
    }
    if (pressureState.campingFrames > 60) {
      r -= Math.min(0.004, (pressureState.campingFrames - 60) * 0.00005);
    }
  } else {
    pressureState.disengagedFrames = 0;
    pressureState.campingFrames = 0;
  }

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.type === 'stockLost' && ev.entityId === nnId) {
      // Self-KO: penalised in all phases. Knocked off by opponent: phase 2+.
      if (ev.attackerId === nnId || ev.attackerId == null) r -= 50;
      else if (phase >= 2) r -= 15;
    }
    if (ev.type === 'ko' && ev.attackerId === nnId && phase >= 2) r += 35;
  }
  return r;
}

function computeTerminalReward(winnerId, nnId, phase, timedOut) {
  if (phase < 3) return timedOut ? -10 : 0;
  if (timedOut) return winnerId === nnId ? 0 : (winnerId != null ? -35 : -15);
  return winnerId === nnId ? 100 : (winnerId != null ? -50 : 0);
}

// ─── Action helpers ───────────────────────────────────────────────────────

function sampleAction(logits) {
  var action = new Array(Policy.OUT_DIM);
  for (var k = 0; k < Policy.OUT_DIM; k++) {
    action[k] = (Math.random() < sigmoid(logits[k])) ? 1 : 0;
  }
  return action;
}

// Convert sampled binary action vector → sim input struct.
// nnState persists edge-trigger counters across frames (prevJump etc.).
function buildInput(action, logits, nnState) {
  var left  = action[0] === 1;
  var right = action[1] === 1;
  if (left && right) { if (logits[0] >= logits[1]) right = false; else left = false; }

  var jumpHeld     = action[2] === 1;
  var jumpPressed  = jumpHeld && nnState.prevJump < 0.5;
  var dashPressed  = action[3] === 1 && nnState.prevDash < 0.5;
  var specialHeld  = action[4] === 1;
  var specialPressed = specialHeld && nnState.prevSpecial < 0.5;

  nnState.prevJump    = action[2];
  nnState.prevDash    = action[3];
  nnState.prevSpecial = action[4];

  return {
    left: left, right: right,
    jumpPressed: jumpPressed, jumpHeld: jumpHeld,
    dashPressed: dashPressed,
    specialPressed: specialPressed, specialHeld: specialHeld
  };
}

// ─── Episode runner ───────────────────────────────────────────────────────
//
// Runs one match frame-by-frame. On each stepMatch call:
//   1. getInput fires (inside stepMatch) → captures obs/action/acts
//   2. Physics runs, events are emitted
//   3. We read match.events after stepMatch returns → compute reward
//
// This gives the standard RL tuple: action a_t taken in state s_t,
// observing reward r_t from the resulting transition.

// oppSpec: { type: 'heuristic', genome: G } | { type: 'neural', model: M }
function runEpisode(model, oppSpec, phase, seed, maxSeconds, matchup) {
  var nnId = 0;
  var nnState = { prevJump: 0, prevDash: 0, prevSpecial: 0 };
  var pressureState = { disengagedFrames: 0, campingFrames: 0 };

  // Written by getInput, read after stepMatch returns.
  var pendingObs = null, pendingAction = null, pendingActs = null;

  var nnController = {
    type: 'scripted',
    getInput: function (match, entity) {
      if (entity.id !== nnId) return Sim.neutralInput();
      var obs = Policy.buildObservation(match, entity);
      var fwd = Policy.policyForwardFull(model, obs);
      var action = sampleAction(fwd.logits);
      pendingObs    = obs;
      pendingAction = action;
      pendingActs   = fwd.acts;
      return buildInput(action, fwd.logits, nnState);
    }
  };

  var oppController;
  if (oppSpec.type === 'neural') {
    var spState = { prevJump: 0, prevDash: 0, prevSpecial: 0 };
    var spModel = oppSpec.model;
    oppController = {
      type: 'scripted',
      getInput: function (match, entity) {
        if (entity.id === nnId) return Sim.neutralInput();
        var obs    = Policy.buildObservation(match, entity);
        var logits = Policy.policyForward(spModel, obs);
        var probs  = new Array(Policy.OUT_DIM);
        for (var ki = 0; ki < Policy.OUT_DIM; ki++) probs[ki] = sigmoid(logits[ki]);
        return Policy.actionsToInput(probs, entity);
      }
    };
  } else {
    oppController = { type: 'heuristic', genome: oppSpec.genome };
  }

  var match = Sim.createMatch({
    seed: seed,
    roster: [
      { charId: matchup.nnCharId, controller: nnController },
      { charId: matchup.oppCharId, controller: oppController }
    ]
  });

  var nnEntity   = match.entities[nnId];
  var prevStats  = { damageDealt: 0, damageTaken: 0 };
  var maxSteps   = Math.round((maxSeconds || 20) * 60);
  var trajectory = [];

  while (match.status === 'play' && match.stepCount < maxSteps) {
    pendingObs = null;
    Sim.stepMatch(match, Sim.constants.FIXED_STEP);

    // getInput fired during stepMatch; events are now populated for this frame.
    if (pendingObs !== null) {
      var r = computeStepReward(match, match.events, nnId, nnEntity, prevStats, phase, pressureState);
      prevStats.damageDealt = nnEntity.stats.damageDealt;
      prevStats.damageTaken = nnEntity.stats.damageTaken;
      trajectory.push({ obs: pendingObs, action: pendingAction, acts: pendingActs, reward: r });
    }
  }

  var timedOut = match.status === 'play';
  // Determine winner (timeout if match still 'play')
  var winnerId = match.winnerId;
  if (timedOut) {
    var best = null, bestSc = -Infinity;
    for (var i = 0; i < match.entities.length; i++) {
      var e = match.entities[i];
      if (e.ko) continue;
      var sc = e.stocks * 1000 - e.damage;
      if (sc > bestSc) { best = e; bestSc = sc; }
    }
    winnerId = best ? best.id : null;
  }

  if (trajectory.length > 0) {
    trajectory[trajectory.length - 1].reward += computeTerminalReward(winnerId, nnId, phase, timedOut);
  }

  return {
    trajectory: trajectory,
    won: winnerId === nnId,
    nnStats: {
      damageDealt: nnEntity.stats.damageDealt,
      damageTaken: nnEntity.stats.damageTaken,
      kos:         nnEntity.stats.kos,
      deaths:      nnEntity.stats.deaths,
      selfKos:     nnEntity.stats.selfKos
    }
  };
}

// ─── REINFORCE ────────────────────────────────────────────────────────────

function computeReturns(trajectory, gamma) {
  var G = 0;
  var returns = new Array(trajectory.length);
  for (var t = trajectory.length - 1; t >= 0; t--) {
    G = trajectory[t].reward + gamma * G;
    returns[t] = G;
  }
  return returns;
}

// Accumulate normalised-advantage policy gradients from one trajectory into grads.
function accumulateGrads(model, trajectory, returns, grads) {
  if (trajectory.length === 0) return;

  // Compute mean and std of returns for advantage normalisation.
  var sum = 0;
  for (var t = 0; t < returns.length; t++) sum += returns[t];
  var mean = sum / returns.length;
  var sqsum = 0;
  for (var t2 = 0; t2 < returns.length; t2++) {
    var d = returns[t2] - mean; sqsum += d * d;
  }
  var std = Math.sqrt(sqsum / returns.length + 1e-8);

  for (var t3 = 0; t3 < trajectory.length; t3++) {
    var step = trajectory[t3];
    var adv  = (returns[t3] - mean) / std;
    var sg   = policyBackward(model, step.acts, step.action, adv);
    for (var l = 0; l < model.layers.length; l++) {
      var sgl = sg[l], tgl = grads[l];
      for (var o = 0; o < model.layers[l].out; o++) {
        for (var k = 0; k < model.layers[l].in; k++) tgl.dW[o][k] += sgl.dW[o][k];
        tgl.db[o] += sgl.db[o];
      }
    }
  }
}

// ─── Worker pool ─────────────────────────────────────────────────────────

function makeWorkerPool(n) {
  if (!workerThreads || n < 1) return [];
  var pool = [];
  for (var i = 0; i < n; i++) pool.push(new workerThreads.Worker(__filename));
  return pool;
}

function closeWorkerPool(pool) {
  for (var i = 0; i < pool.length; i++) pool[i].terminate();
}

function runTasksParallel(tasks, pool) {
  return new Promise(function (resolve) {
    var results = [], taskIdx = 0, done = 0, total = tasks.length;
    if (total === 0) { resolve([]); return; }
    function assignNext(worker) {
      if (taskIdx >= total) return;
      var task = tasks[taskIdx++];
      worker.once('message', function (res) {
        results.push(res);
        done++;
        if (done === total) resolve(results);
        else assignNext(worker);
      });
      worker.postMessage(task);
    }
    var slots = Math.min(pool.length, total);
    for (var i = 0; i < slots; i++) assignNext(pool[i]);
  });
}

// ─── Training loop ────────────────────────────────────────────────────────

function countParams(model) {
  var n = 0;
  for (var l = 0; l < model.layers.length; l++) {
    n += model.layers[l].out * (model.layers[l].in + 1);
  }
  return n;
}

async function train(args) {
  var totalEpochs       = intArg(args, 'epochs',   1000);
  var episodesPerUpdate = intArg(args, 'episodes',    4);
  var lr                = numArg(args, 'lr',       0.001);
  var gamma             = numArg(args, 'gamma',    0.99);
  var matchSeconds      = intArg(args, 'seconds',    20);
  var minPhase          = intArg(args, 'min-phase',   1);
  var hidden            = strArg(args, 'hidden', '64,64').split(',').map(function(n){ return parseInt(n,10); }).filter(function(n){ return n > 0; });
  if (!hidden.length) hidden = [64, 64];
  var numWorkers        = Math.min(intArg(args, 'workers', os.cpus().length - 1), episodesPerUpdate, 20);
  var fresh             = !!args.fresh;
  var warmstartPath     = args.warmstart || null;
  var selfPlayFrac      = numArg(args, 'self-play-frac', 0.33);
  var selfPlaySnapEvery = intArg(args, 'self-play-snap-every', 200);
  var selfPlayMaxPool   = intArg(args, 'self-play-max-pool', 5);

  ensureDir(CKPT_DIR);
  var latestPath = path.join(CKPT_DIR, 'latest-rl.json');
  var bestPath   = path.join(CKPT_DIR, 'best-rl.json');
  var logPath    = path.join(CKPT_DIR, 'log-rl.csv');

  var model, adamState, startEpoch, bestReturn;

  if (warmstartPath && fs.existsSync(warmstartPath)) {
    // Load weights only — fresh Adam so new reward signal shapes momentum cleanly.
    model       = loadJson(warmstartPath);
    adamState   = makeAdamState(model);
    startEpoch  = 0;
    bestReturn  = -Infinity;
    console.log('warm-starting from', warmstartPath, ' params:', countParams(model));
  } else if (!fresh && fs.existsSync(latestPath)) {
    var ckpt = loadJson(latestPath);
    model       = ckpt.model;
    adamState   = ckpt.adam;
    startEpoch  = ckpt.epoch + 1;
    bestReturn  = ckpt.bestReturn != null ? ckpt.bestReturn : -Infinity;
    console.log('resuming from epoch', startEpoch - 1);
  } else {
    model       = Policy.randomModel(hidden, 42);
    adamState   = makeAdamState(model);
    startEpoch  = 0;
    bestReturn  = -Infinity;
    console.log('starting fresh  hidden:', hidden, ' params:', countParams(model));
  }

  if (fresh || !fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, 'epoch,phase,meanReturn,wins,losses,kos,selfKos,wallMs\n', 'utf8');
  }

  var pool = makeWorkerPool(numWorkers);
  if (pool.length > 0) console.log('workers:', pool.length);

  var selfPlayPool = [];     // rolling window of past model snapshots
  var SP_SNAP_EVERY = selfPlaySnapEvery; // add snapshot every N phase-3 epochs
  var SP_MAX_POOL   = selfPlayMaxPool;   // keep at most this many snapshots
  var SP_FRAC       = Math.max(0, Math.min(1, selfPlayFrac)); // fraction of phase-3 episodes that use self-play

  for (var epoch = startEpoch; epoch < totalEpochs; epoch++) {
    var t0    = Date.now();
    var phase = Math.max(getCurriculumPhase(epoch, totalEpochs), minPhase);
    var phaseLr = phase === 3 ? lr * 0.35 : (phase === 2 ? lr * 0.65 : lr);
    var opps  = getOpponents(phase);

    // Maintain self-play snapshot pool in phase 3.
      if (SP_FRAC > 0 && phase === 3 && epoch % SP_SNAP_EVERY === 0 && epoch > startEpoch) {
        selfPlayPool.push(JSON.parse(JSON.stringify(model)));
        if (selfPlayPool.length > SP_MAX_POOL) selfPlayPool.shift();
        console.log('self-play pool size:', selfPlayPool.length, '(epoch ' + epoch + ')');
    }

    // Build one task per episode.
    var tasks = [];
    for (var ep = 0; ep < episodesPerUpdate; ep++) {
      var opp  = opps[ep % opps.length];
      var seed = (epoch * episodesPerUpdate + ep + 1) >>> 0;
      var matchup = chooseCharPair(seed);
      // In phase 3, occasionally substitute a self-play opponent.
      var oppSpec;
      if (phase === 3 && selfPlayPool.length > 0 && lcgRand(seed) < SP_FRAC) {
        var spIdx = Math.floor(lcgRand(seed + 1) * selfPlayPool.length);
        oppSpec = { type: 'neural', model: selfPlayPool[spIdx] };
      } else {
        oppSpec = { type: 'heuristic', genome: opp.genome };
      }
      tasks.push({ model: model, oppSpec: oppSpec, phase: phase,
                   seed: seed, matchSeconds: matchSeconds, gamma: gamma, matchup: matchup });
    }

    // Run episodes in parallel (workers) or fall back to serial.
    var epResults;
    if (pool.length > 0) {
      epResults = await runTasksParallel(tasks, pool);
    } else {
      epResults = [];
      for (var ep2 = 0; ep2 < tasks.length; ep2++) {
        var tk   = tasks[ep2];
        var eres = runEpisode(tk.model, tk.oppSpec, tk.phase, tk.seed, tk.matchSeconds, tk.matchup);
        var erts = computeReturns(eres.trajectory, tk.gamma);
        var eg   = makeZeroGrads(model);
        accumulateGrads(model, eres.trajectory, erts, eg);
        var er = 0;
        for (var t = 0; t < eres.trajectory.length; t++) er += eres.trajectory[t].reward;
        epResults.push({ grads: eg, epRet: er, steps: eres.trajectory.length,
                         won: eres.won, kos: eres.nnStats.kos, selfKos: eres.nnStats.selfKos });
      }
    }

    // Accumulate gradients and stats from all episodes.
    var totalG = makeZeroGrads(model);
    var totRet = 0, totSteps = 0, wins = 0, losses = 0, totKos = 0, totSelfKos = 0;
    for (var ri = 0; ri < epResults.length; ri++) {
      var rr = epResults[ri];
      for (var l = 0; l < model.layers.length; l++) {
        var rgl = rr.grads[l], tgl = totalG[l];
        for (var o = 0; o < model.layers[l].out; o++) {
          for (var k = 0; k < model.layers[l].in; k++) tgl.dW[o][k] += rgl.dW[o][k];
          tgl.db[o] += rgl.db[o];
        }
      }
      totRet   += rr.epRet;
      totSteps += rr.steps;
      if (rr.won) wins++; else losses++;
      totKos     += rr.kos;
      totSelfKos += rr.selfKos;
    }

    scaleGrads(totalG, 1.0 / Math.max(1, totSteps));
    clipGradNorm(totalG, 0.5);
    applyAdam(model, totalG, adamState, phaseLr);

    var meanReturn = totRet / episodesPerUpdate;
    var wallMs     = Date.now() - t0;

    saveJson(latestPath, { epoch: epoch, model: model, adam: adamState, bestReturn: bestReturn });

    if (meanReturn > bestReturn) {
      bestReturn = meanReturn;
      saveJson(bestPath, model);
    }

    fs.appendFileSync(logPath,
      epoch + ',' + phase + ',' + meanReturn.toFixed(2) + ',' +
      wins + ',' + losses + ',' + totKos + ',' + totSelfKos + ',' + wallMs + '\n');

    if (epoch % 10 === 0) {
      console.log(
        'epoch', epoch, ' phase', phase,
        ' return', meanReturn.toFixed(1),
        ' wr', (wins / episodesPerUpdate).toFixed(2),
        ' selfKos', totSelfKos,
        ' (' + wallMs + 'ms)'
      );
    }

    if (epoch > 0 && epoch % 100 === 0) {
      saveJson(path.join(CKPT_DIR, 'rl-ep' + epoch + '.json'), model);
    }
  }
  closeWorkerPool(pool);
  console.log('training complete.');
}

// ─── Eval (same output format as train-nn.js eval for easy comparison) ────

function evalModel(modelPath, args) {
  var model = loadJson(modelPath);
  Policy.validateModel(model);
  var numGames = intArg(args, 'games', 60);
  var opps = [
    { label: 'easy',   genome: Sim.EASY_MODE_GENOME   },
    { label: 'medium', genome: Sim.MEDIUM_MODE_GENOME },
    { label: 'hard',   genome: Sim.HARD_MODE_GENOME   }
  ];
  var perOpp = {};
  for (var i = 0; i < opps.length; i++) perOpp[opps[i].label] = { w: 0, l: 0, d: 0 };
  var totalKos = 0, totalDeaths = 0, totalSelfKos = 0;
  var totalDmgDealt = 0, totalDmgTaken = 0;
  var wins = 0, losses = 0, draws = 0;
  var gpp = Math.ceil(numGames / opps.length);

  for (var oi = 0; oi < opps.length; oi++) {
    for (var g = 0; g < gpp; g++) {
      var seed    = (oi * 10000 + g + 1) >>> 0;
      var matchup = chooseCharPair(seed);
      var nnId    = 0;
      var nnState = { prevJump: 0, prevDash: 0, prevSpecial: 0 };
      var localOpp = opps[oi]; // capture for closure

      var nnCtrl = (function (capturedNnState) {
        return {
          type: 'scripted',
          getInput: function (match, entity) {
            if (entity.id !== nnId) return Sim.neutralInput();
            var obs    = Policy.buildObservation(match, entity);
            var logits = Policy.policyForward(model, obs);
            var probs  = new Array(Policy.OUT_DIM);
            for (var k = 0; k < Policy.OUT_DIM; k++) probs[k] = sigmoid(logits[k]);
            return Policy.actionsToInput(probs, entity);
          }
        };
      }(nnState));

      var r = Sim.runMatch({
        seed:     seed,
        maxSteps: 60 * 30,
        roster: [
          { charId: matchup.nnCharId, controller: nnCtrl },
          { charId: matchup.oppCharId, controller: { type: 'heuristic', genome: localOpp.genome } }
        ]
      });

      var nn = r.match.entities[nnId];
      totalKos      += nn.stats.kos;
      totalDeaths   += nn.stats.deaths;
      totalSelfKos  += nn.stats.selfKos;
      totalDmgDealt += nn.stats.damageDealt;
      totalDmgTaken += nn.stats.damageTaken;

      if      (r.match.winnerId === nnId)  { wins++;   perOpp[localOpp.label].w++; }
      else if (r.match.winnerId != null)   { losses++; perOpp[localOpp.label].l++; }
      else                                 { draws++;  perOpp[localOpp.label].d++; }
    }
  }

  var total = wins + losses + draws;
  console.log('matches:', total);
  console.log('wins/losses/draws: ' + wins + '/' + losses + '/' + draws +
    '  winrate: ' + (wins / total).toFixed(3));
  console.log('kos:', totalKos, ' deaths:', totalDeaths, ' selfKos:', totalSelfKos);
  console.log('dmg dealt/taken: ' + totalDmgDealt.toFixed(1) + '/' + totalDmgTaken.toFixed(1));
  console.log('per-opponent:');
  for (var pi = 0; pi < opps.length; pi++) {
    var po  = perOpp[opps[pi].label];
    var tot = po.w + po.l + po.d;
    console.log(' ', opps[pi].label + ':', po.w + 'W', po.l + 'L', po.d + 'D',
      ' winrate=' + (tot ? (po.w / tot).toFixed(3) : '0.000'));
  }
}

// ─── Worker entry point ───────────────────────────────────────────────────

if (workerThreads && !isMainThread) {
  workerThreads.parentPort.on('message', function (task) {
    var res     = runEpisode(task.model, task.oppSpec, task.phase, task.seed, task.matchSeconds, task.matchup);
    var returns = computeReturns(res.trajectory, task.gamma);
    var grads   = makeZeroGrads(task.model);
    accumulateGrads(task.model, res.trajectory, returns, grads);
    var epRet = 0;
    for (var t = 0; t < res.trajectory.length; t++) epRet += res.trajectory[t].reward;
    workerThreads.parentPort.postMessage({
      grads:   grads,
      epRet:   epRet,
      steps:   res.trajectory.length,
      won:     res.won,
      kos:     res.nnStats.kos,
      selfKos: res.nnStats.selfKos
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────

if (isMainThread) {
  var args = parseArgs(process.argv.slice(2));
  var cmd  = args._[0] || 'train';
  if (cmd === 'train') {
    train(args).catch(function (e) { console.error(e); process.exit(1); });
  } else if (cmd === 'eval') {
    var mp = args._[1];
    if (!mp) { console.error('usage: eval <model.json>'); process.exit(1); }
    evalModel(mp, args);
  } else {
    console.error('unknown command:', cmd);
    process.exit(1);
  }
}
