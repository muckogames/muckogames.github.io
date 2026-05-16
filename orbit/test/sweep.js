#!/usr/bin/env node
// Phase-angle sweep tool. For each lunar mission, simulates the canonical
// solution at many candidate leadAngleRad values and reports which leads
// achieve the goal. Tracks the post-flyby minimum Earth distance separately
// so we can detect "true return home" trajectories.

'use strict';

var Phys = require('../physics.js');
var SIM_DT = 1 / 3600;

function simulate(setup) {
  var moonAngle0 = setup.computeMoonAngle(setup.leadAngle);
  var state = { x: setup.x0, y: setup.y0, vx: setup.vx0, vy: setup.vy0, t: 0 };
  var opts = { moonAngle0: moonAngle0, gmEMul: 1, gmMMul: 1, thrust: null };
  var prog = Phys.makeImpulsiveProgram(setup.burns);
  var dvUsed = 0;
  var minMoon = Infinity;
  var minEarthPre = Infinity, minEarthPost = Infinity;
  var apoR = -Infinity;
  var collision = null;
  var passedMoon = false;          // true once we've reached closest-approach
  var prevDrM = null;
  while (state.t < setup.tmax && !collision) {
    var fired = prog.tick(state, opts);
    if (fired) dvUsed += fired.magnitude;
    var step = Phys.stepPhysics(state, SIM_DT, opts);
    state.x = step.x; state.y = step.y; state.vx = step.vx; state.vy = step.vy; state.t = step.t;
    collision = step.collision;

    var rE = Math.sqrt(state.x * state.x + state.y * state.y);
    if (rE > apoR) apoR = rE;
    var mp = Phys.moonPos(state.t, opts.moonAngle0);
    var mv = Phys.moonVel(state.t, opts.moonAngle0);
    var dMx = state.x - mp.x, dMy = state.y - mp.y;
    var rM = Math.sqrt(dMx * dMx + dMy * dMy);
    var rvx = state.vx - mv.x, rvy = state.vy - mv.y;
    var drM = dMx * rvx + dMy * rvy;
    if (rM < minMoon) minMoon = rM;

    // Detect moon-flyby closest-approach (drM zero-crossing) once.
    if (!passedMoon && prevDrM !== null && prevDrM < 0 && drM >= 0 && rM < 0.20) passedMoon = true;
    prevDrM = drM;

    if (passedMoon) { if (rE < minEarthPost) minEarthPost = rE; }
    else            { if (rE < minEarthPre)  minEarthPre  = rE; }
  }
  return {
    leadAngle: setup.leadAngle,
    moonAngle0: moonAngle0,
    minMoon: minMoon,
    minEarthPre: minEarthPre,
    minEarthPost: minEarthPost,
    apoR: apoR,
    collision: collision,
    passedMoon: passedMoon,
    endT: state.t,
    dvUsed: dvUsed
  };
}

function sweep(name, setup, leads, evaluate) {
  console.log('\n=== ' + name + ' ===');
  console.log('lead   moonAng0 minMoon  minEpost  apoR    col      note');
  var bestLead = null, bestScore = -Infinity;
  for (var i = 0; i < leads.length; i++) {
    setup.leadAngle = leads[i];
    var r = simulate(setup);
    var note = evaluate(r);
    var line = pad(r.leadAngle.toFixed(2), 6) + pad(r.moonAngle0.toFixed(3), 9) +
               pad(r.minMoon.toFixed(4), 9) +
               pad((r.minEarthPost === Infinity ? '   - ' : r.minEarthPost.toFixed(3)), 10) +
               pad(r.apoR.toFixed(3), 8) +
               pad(r.collision || '-', 9) + note.text;
    console.log(line);
    if (note.score > bestScore) { bestScore = note.score; bestLead = r.leadAngle; }
  }
  if (bestLead !== null && bestScore > -Infinity)
    console.log('Best ' + name + ': lead = ' + bestLead.toFixed(3) + ' (score ' + bestScore.toFixed(3) + ')');
}

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function range(a, b, step) { var o = []; for (var v = a; v <= b + 1e-9; v += step) o.push(v); return o; }

var GM_E = Phys.GM_E;
var R = 0.12, V_LEO = Math.sqrt(GM_E / R);
var V_TLI = function (apo) { return Math.sqrt(GM_E * (2 / R - 1 / ((R + apo) / 2))); };

sweep('free_return', {
  x0: R, y0: 0, vx0: 0, vy0: V_LEO,
  computeMoonAngle: function (l) { return Phys.hohmannMoonPhase(0.12, 0.96, l); },
  burns: [{ trigger: 'time', t: 0.001, dir: 'prograde', dv: V_TLI(0.96) - V_LEO }],
  tmax: 2.00
}, range(0.40, 0.70, 0.02), function (r) {
  // Want: passed Moon at 0.02–0.10 DU, post-flyby minEarth < 0.20.
  var ok = r.passedMoon && !r.collision && r.minMoon > 0.02 && r.minMoon < 0.12 && r.minEarthPost < 0.20;
  return { score: ok ? -Math.abs(r.minMoon - 0.07) : -10 - (r.collision ? 5 : 0),
           text: ok ? '✓ return!' :
                 (r.collision ? 'collide' :
                  (!r.passedMoon ? 'no-flyby' :
                   (r.minMoon < 0.02 ? 'too-close' :
                    (r.minEarthPost > 0.20 ? 'no-return(' + r.minEarthPost.toFixed(2) + ')' : 'far')))) };
});

sweep('moon_insertion', {
  x0: R, y0: 0, vx0: 0, vy0: V_LEO,
  computeMoonAngle: function (l) { return Phys.hohmannMoonPhase(0.12, 1.0, l); },
  burns: [
    { trigger: 'time', t: 0.001, dir: 'prograde', dv: V_TLI(1.0) - V_LEO },
    { trigger: 'periapsis_moon', mode: 'circularize_moon' }
  ],
  tmax: 0.50
}, range(-0.30, 0.30, 0.025), function (r) {
  var ok = !r.collision && r.minMoon > 0.015 && r.minMoon < 0.10;
  return { score: ok ? -Math.abs(r.minMoon - 0.05) : -10,
           text: ok ? '✓' : (r.collision ? 'collide' : (r.minMoon < 0.015 ? 'too-close' : 'far')) };
});

sweep('gravity_assist', {
  x0: R, y0: 0, vx0: 0, vy0: V_LEO,
  computeMoonAngle: function (l) { return Phys.hohmannMoonPhase(0.12, 0.90, l); },
  burns: [{ trigger: 'time', t: 0.001, dir: 'prograde', dv: V_TLI(0.90) - V_LEO }],
  tmax: 1.20
}, range(0.00, 0.55, 0.025), function (r) {
  var ok = !r.collision && r.apoR > 1.15 && r.minMoon > 0.025 && r.passedMoon;
  return { score: ok ? r.apoR : -10,
           text: ok ? '✓ apo=' + r.apoR.toFixed(2) :
                 (r.collision ? 'collide' :
                  (!r.passedMoon ? 'no-flyby' :
                   (r.apoR < 1.15 ? 'no-boost' : 'too-close'))) };
});

var V_F8 = Math.sqrt(GM_E * (2/0.12 - 1/((0.12+1.10)/2)));
sweep('figure_8', {
  x0: R, y0: 0, vx0: 0, vy0: -V_F8,
  computeMoonAngle: function (l) { return Phys.hohmannMoonPhase(0.12, 1.10, l); },
  burns: [],
  tmax: 0.80
}, range(-0.40, 0.60, 0.05), function (r) {
  var ok = !r.collision && r.minMoon < 0.15 && r.minMoon > 0.03 && r.minEarthPost < 0.25;
  return { score: ok ? -Math.abs(r.minMoon - 0.08) : -10,
           text: ok ? '✓ Eback=' + r.minEarthPost.toFixed(2) :
                 (r.collision ? 'collide' :
                  (!r.passedMoon ? 'no-flyby' :
                   (r.minMoon < 0.03 ? 'too-close' :
                    (r.minEarthPost > 0.25 ? 'no-return(' + r.minEarthPost.toFixed(2) + ')' : 'far')))) };
});
