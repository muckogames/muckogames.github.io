#!/usr/bin/env node
// Headless validator. Runs each MISSIONS[i].solution through physics.js and
// asserts the success-criteria fire. Catches drift after physics changes.
//
// Usage:
//   node test/run.js              run, exit non-zero on any failure
//   node test/run.js --record     write expected.json from current run
//   node test/run.js --verbose    print per-step diagnostics

'use strict';

var Phys = require('../physics.js');
var SC   = require('../scenarios.js');

var RECORD  = process.argv.indexOf('--record') >= 0;
var VERBOSE = process.argv.indexOf('--verbose') >= 0;
var FILTER  = null;
var filterIdx = process.argv.indexOf('--only');
if (filterIdx >= 0) FILTER = process.argv[filterIdx + 1];

var fs = require('fs');
var path = require('path');
var EXPECTED_PATH = path.join(__dirname, 'expected.json');
var EXPECTED = {};
if (!RECORD) {
  try { EXPECTED = JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf8')); }
  catch (e) { EXPECTED = {}; }
}

var SIM_DT = 1 / 3600;  // matches game.

// ── Per-mission runner ─────────────────────────────────────────────────────────
function runMission(m) {
  var state = {
    x:  m.start.x,
    y:  m.start.y,
    vx: m.start.vx,
    vy: m.start.vy,
    t:  0
  };
  var opts = {
    moonAngle0: m.start.moonAngle0,
    gmEMul:     1.0,
    gmMMul:     1.0,
    thrust:     null
  };
  var dvBudget = m.start.dvBudget;
  var dvUsed   = 0;
  var prog = Phys.makeImpulsiveProgram(m.solution.burns || []);

  var TMAX = m.solution.expectedDuration * 2.0;
  var dt = SIM_DT;
  var status = 'wip';
  var dwellAccum = 0;
  var minMoonDist = Infinity;
  var minEarthDist = Infinity;
  var minEarthPost = Infinity;       // after Moon flyby
  var maxR        = -Infinity;
  var collision = null;
  var firstApoAfterBurn = null;
  var prevDrE = state.x * state.vx + state.y * state.vy;
  var prevDrM = null;
  var passedMoon = false;
  var hadAnyBurn = false;
  var postSolveFire = false;     // any impulsive after solution completes
  var reason = '';

  while (state.t < TMAX && status === 'wip' && !collision) {
    // 1. Trigger any impulsive burn whose time has come.
    var fired = prog.tick(state, opts);
    if (fired) {
      dvUsed += fired.magnitude;
      dvBudget -= fired.magnitude;
      hadAnyBurn = true;
      if (VERBOSE) console.log('    [' + m.id + '] t=' + state.t.toFixed(3) + '  BURN ' + fired.burn.label + '  ΔV=' + fired.magnitude.toFixed(3));
      // Reset apoapsis tracker post-burn.
      prevDrE = state.x * state.vx + state.y * state.vy;
    }

    // 2. Physics step (no continuous thrust in headless DEMO — the program is impulsive only).
    var step = Phys.stepPhysics(state, dt, {
      moonAngle0: opts.moonAngle0,
      gmEMul: opts.gmEMul,
      gmMMul: opts.gmMMul,
      thrust: null,
      dvBudget: dvBudget
    });
    state.x = step.x; state.y = step.y;
    state.vx = step.vx; state.vy = step.vy;
    state.t = step.t;
    collision = step.collision;

    // 3. Track minima/maxima and apoapsis-after-burn.
    var rE = Math.sqrt(state.x * state.x + state.y * state.y);
    if (rE < minEarthDist) minEarthDist = rE;
    if (rE > maxR) maxR = rE;
    var mp = Phys.moonPos(state.t, opts.moonAngle0);
    var mv = Phys.moonVel(state.t, opts.moonAngle0);
    var dMx = state.x - mp.x, dMy = state.y - mp.y;
    var rM = Math.sqrt(dMx * dMx + dMy * dMy);
    if (rM < minMoonDist) minMoonDist = rM;

    // Detect Moon flyby (drM zero crossing inside SOI) once.
    var rvx = state.vx - mv.x, rvy = state.vy - mv.y;
    var drM = dMx * rvx + dMy * rvy;
    if (!passedMoon && prevDrM !== null && prevDrM < 0 && drM >= 0 && rM < 0.20) passedMoon = true;
    prevDrM = drM;
    if (passedMoon && rE < minEarthPost) minEarthPost = rE;

    var drE = state.x * state.vx + state.y * state.vy;
    // Require r > 0.4 DU so a noise crossing in LEO doesn't false-trigger.
    var atApo = (prevDrE > 0 && drE <= 0 && rE > 0.4);
    if (atApo && hadAnyBurn && !firstApoAfterBurn) {
      firstApoAfterBurn = { x: state.x, y: state.y, r: rE, t: state.t };
    }
    prevDrE = drE;

    // 4. Evaluate goal.
    var ge = SC.evaluateGoal(m.goal, {
      state: state,
      opts: opts,
      dwellAccum: dwellAccum,
      dvBudgetUsed: dvUsed,
      simT: state.t,
      minMoonDistSoFar: minMoonDist,
      minEarthPost: isFinite(minEarthPost) ? minEarthPost : null,
      maxRsoFar: isFinite(maxR) ? maxR : null,
      passedMoon: passedMoon,
      atApoapsisEarth: atApo,
      firstApoAfterBurn: firstApoAfterBurn,
      postSolveFire: postSolveFire,
      dt: dt
    });
    dwellAccum = ge.dwell;
    if (ge.status !== 'wip') {
      status = ge.status;
      reason = ge.reason || '';
      break;
    }
  }

  if (collision) {
    status = 'failed';
    reason = 'collision:' + collision;
  } else if (status === 'wip') {
    status = 'failed';
    reason = 'timed out at t=' + state.t.toFixed(3);
  }

  return {
    id: m.id,
    status: status,
    reason: reason,
    endTime: state.t,
    dvUsed: dvUsed,
    dvBudgetLeft: dvBudget,
    minMoonDist: minMoonDist,
    minEarthDist: minEarthDist,
    collision: collision,
    burnsFired: prog.progress(),
    burnsExpected: (m.solution.burns || []).length
  };
}

// ── Energy-drift sanity test (no mission, just LEO coast) ──────────────────────
function energyDriftTest() {
  var R = 0.12;
  var V = Math.sqrt(Phys.GM_E / R);
  var state = { x: R, y: 0, vx: 0, vy: V, t: 0 };
  var opts = { moonAngle0: 0, gmEMul: 1, gmMMul: 1, thrust: null };
  function energy(s) {
    var r = Math.sqrt(s.x * s.x + s.y * s.y);
    var v2 = s.vx * s.vx + s.vy * s.vy;
    return 0.5 * v2 - Phys.GM_E / r;
  }
  var e0 = energy(state);
  for (var i = 0; i < 3600 * 1; i++) {
    var step = Phys.stepPhysics(state, SIM_DT, opts);
    state.x = step.x; state.y = step.y; state.vx = step.vx; state.vy = step.vy; state.t = step.t;
  }
  var e1 = energy(state);
  var drift = Math.abs((e1 - e0) / e0);
  return { e0: e0, e1: e1, drift: drift };
}

// ── Phasing math sanity test ────────────────────────────────────────────────────
function phasingTest() {
  // After hohmannMoonPhase(0.12, 1.0, 0), the Moon should be exactly at apoapsis
  // (angle π) at time = TOF, with lead = 0.
  var rPeri = 0.12, rApo = 1.0;
  var a = (rPeri + rApo) / 2;
  var tof = Math.PI * Math.sqrt(a * a * a / Phys.GM_E);
  var ang0 = Phys.hohmannMoonPhase(rPeri, rApo, 0);
  var moonAng = ang0 + Phys.MOON_W * tof;
  // Normalize to [-π, π]
  while (moonAng >  Math.PI) moonAng -= 2 * Math.PI;
  while (moonAng < -Math.PI) moonAng += 2 * Math.PI;
  return { moonAngAtApo: moonAng, expected: Math.PI < Math.PI ? Math.PI : (moonAng < 0 ? -Math.PI : Math.PI), err: Math.abs(Math.abs(moonAng) - Math.PI) };
}

// ── Main ───────────────────────────────────────────────────────────────────────
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function num(v, d) { return (v).toFixed(d != null ? d : 3); }

console.log('Orbit validator');
console.log('===============');

var anyFailed = false;
var recorded = {};

// Sanity tests first.
var ed = energyDriftTest();
var edPass = ed.drift < 0.02;
console.log((edPass ? 'PASS ' : 'FAIL ') + pad('energy_drift_1tu_LEO', 30) +
            ' drift=' + (ed.drift * 100).toFixed(3) + '%');
if (!edPass) anyFailed = true;

var ph = phasingTest();
var phPass = ph.err < 1e-6;
console.log((phPass ? 'PASS ' : 'FAIL ') + pad('hohmann_phase_identity', 30) +
            ' err=' + ph.err.toExponential(2));
if (!phPass) anyFailed = true;

console.log('');

// Per-mission.
var summary = [];
for (var i = 0; i < SC.MISSIONS.length; i++) {
  var m = SC.MISSIONS[i];
  if (FILTER && m.id !== FILTER) continue;
  var r = runMission(m);
  summary.push(r);
  recorded[m.id] = {
    endTime: r.endTime,
    dvUsed: r.dvUsed,
    minMoonDist: isFinite(r.minMoonDist) ? r.minMoonDist : null,
    minEarthDist: r.minEarthDist
  };

  var tag = (r.status === 'success') ? 'PASS ' : 'FAIL ';
  var line = tag + pad(m.id, 18) +
    ' t=' + num(r.endTime, 3) +
    '  dvUsed=' + num(r.dvUsed, 2) +
    '  minMoon=' + (isFinite(r.minMoonDist) ? num(r.minMoonDist, 3) : '   - ') +
    '  burns=' + r.burnsFired + '/' + r.burnsExpected;
  if (r.status !== 'success') line += '  reason=' + r.reason;
  console.log(line);

  if (r.status !== 'success') anyFailed = true;

  // Drift sentinel vs expected.json — only if expected has the entry.
  if (!RECORD && EXPECTED[m.id]) {
    var ex = EXPECTED[m.id];
    var dvErr = Math.abs(r.dvUsed - ex.dvUsed);
    var rmErr = (ex.minMoonDist != null && isFinite(r.minMoonDist))
      ? Math.abs(r.minMoonDist - ex.minMoonDist) : 0;
    if (dvErr > 0.5) {
      console.log('       ↑ DRIFT: dvUsed shifted by ' + dvErr.toFixed(3) + ' (expected ' + ex.dvUsed.toFixed(3) + ')');
      anyFailed = true;
    }
    if (rmErr > 0.04) {
      console.log('       ↑ DRIFT: minMoonDist shifted by ' + rmErr.toFixed(3) + ' (expected ' + (ex.minMoonDist).toFixed(3) + ')');
      anyFailed = true;
    }
  }
}

if (RECORD) {
  fs.writeFileSync(EXPECTED_PATH, JSON.stringify(recorded, null, 2));
  console.log('\nRecorded ' + Object.keys(recorded).length + ' missions → expected.json');
}

console.log('');
if (anyFailed) {
  console.log('FAILED');
  process.exit(1);
}
console.log('All green.');
process.exit(0);
