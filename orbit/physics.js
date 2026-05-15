// Orbital mechanics — pure-function physics module.
// UMD: exposes window.OrbitPhysics in the browser, module.exports in Node.
// ES5 only — must run on iOS 12 Safari. No ??, no ?., no .at, no template literals.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbitPhysics = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── Dimensionless units ─────────────────────────────────────────────────────
  // DU = Earth–Moon distance (384,400 km).  TU = Moon orbital period (27.32 d).
  // Kepler's 3rd law (a=1, T=1) ⇒ GM_E = 4π².
  var PI2  = 2 * Math.PI;
  var GM_E = 4 * Math.PI * Math.PI;
  var MU   = 0.01230;           // Moon/Earth mass ratio
  var GM_M = GM_E * MU;

  var MOON_R = 1.0;
  var MOON_W = PI2;             // rad/TU — circular Moon at radius 1 DU

  // Body radii in DU (proper collision, not the legacy 0.001 clamp).
  var R_EARTH_DU = 6371   / 384400;   // ≈ 0.01657
  var R_MOON_DU  = 1737.4 / 384400;   // ≈ 0.00452
  var SOI_MOON_DU = 0.172;            // Hill-sphere-ish radius

  // Unit conversions for the HUD / tests.
  var DU_TO_KM        = 384400;
  var TU_TO_DAYS      = 27.32;
  var TU_TO_SEC       = 27.32 * 86400;
  var DU_PER_TU_TO_KMPS = DU_TO_KM / TU_TO_SEC;  // ≈ 0.1629

  // Adaptive substepping kicks in inside this Moon radius.
  var CLOSE_RM = 0.02;
  var SUBSTEP_FACTOR = 4;

  // ── Moon (analytical circular orbit) ─────────────────────────────────────────
  function moonPos(t, moonAngle0) {
    var a = moonAngle0 + MOON_W * t;
    return { x: MOON_R * Math.cos(a), y: MOON_R * Math.sin(a) };
  }

  function moonVel(t, moonAngle0) {
    var a = moonAngle0 + MOON_W * t;
    return { x: -MOON_R * MOON_W * Math.sin(a),
             y:  MOON_R * MOON_W * Math.cos(a) };
  }

  // ── Acceleration at a point (Earth + Moon + optional thrust) ─────────────────
  // opts: { moonAngle0, gmEMul, gmMMul, thrust:{fwd,scAngle,mag}|null }
  function accelAt(x, y, t, opts) {
    var gmE = GM_E * (opts.gmEMul != null ? opts.gmEMul : 1);
    var gmM = GM_M * (opts.gmMMul != null ? opts.gmMMul : 1);
    var m   = moonPos(t, opts.moonAngle0);

    var dex = x,       dey = y;
    var dmx = x - m.x, dmy = y - m.y;
    var re  = Math.sqrt(dex * dex + dey * dey);
    var rm  = Math.sqrt(dmx * dmx + dmy * dmy);
    // Soft singularity guard. Real collisions are detected separately in stepPhysics.
    if (re < 1e-4) re = 1e-4;
    if (rm < 1e-4) rm = 1e-4;
    var re3 = re * re * re;
    var rm3 = rm * rm * rm;

    var ax = -gmE * dex / re3 - gmM * dmx / rm3;
    var ay = -gmE * dey / re3 - gmM * dmy / rm3;

    var th = opts.thrust;
    if (th && th.fwd !== 0 && th.mag > 0) {
      ax += th.fwd * th.mag * Math.cos(th.scAngle);
      ay += th.fwd * th.mag * Math.sin(th.scAngle);
    }
    return { ax: ax, ay: ay, rm: rm, re: re };
  }

  // ── One integrator step (symplectic Euler) ───────────────────────────────────
  // state IN : { x, y, vx, vy, t }                — read-only
  // returns  : { x, y, vx, vy, t, dvSpent, collision: null|'earth'|'moon' }
  // opts     : as accelAt + { dvBudget } so we can clamp thrust when ΔV runs out
  // Adaptive: if rm < CLOSE_RM, internally subdivides dt by SUBSTEP_FACTOR.
  function stepPhysics(state, dt, opts) {
    var x  = state.x,  y  = state.y;
    var vx = state.vx, vy = state.vy;
    var t  = state.t;
    var dvBudget = opts.dvBudget != null ? opts.dvBudget : Infinity;
    var dvSpent = 0;
    var collision = null;

    // Detect close encounter and subdivide. One probe call, no thrust, just for rm.
    var a0 = accelAt(x, y, t, opts);
    var nSteps = 1;
    if (a0.rm < CLOSE_RM) nSteps = SUBSTEP_FACTOR;
    var h = dt / nSteps;

    for (var i = 0; i < nSteps && !collision; i++) {
      // Thrust gate: if budget would be exhausted, scale the impulse for this sub-step.
      var th = opts.thrust;
      var effThrust = null;
      if (th && th.fwd !== 0 && th.mag > 0 && dvBudget > 0) {
        var cost = Math.abs(th.fwd) * th.mag * h;
        if (cost <= dvBudget) {
          effThrust = th;
          dvBudget -= cost;
          dvSpent  += cost;
        } else {
          // Partial sub-step — thrust scaled to whatever budget remains.
          var scaleP = dvBudget / cost;
          effThrust = { fwd: th.fwd, scAngle: th.scAngle, mag: th.mag * scaleP };
          dvSpent  += dvBudget;
          dvBudget  = 0;
        }
      }

      var subOpts = {
        moonAngle0: opts.moonAngle0,
        gmEMul:     opts.gmEMul,
        gmMMul:     opts.gmMMul,
        thrust:     effThrust
      };
      var a = accelAt(x, y, t, subOpts);
      vx += a.ax * h;
      vy += a.ay * h;
      x  += vx * h;
      y  += vy * h;
      t  += h;

      // Collision check — after position update.
      var reNow = Math.sqrt(x * x + y * y);
      if (reNow < R_EARTH_DU) { collision = 'earth'; break; }
      var mn  = moonPos(t, opts.moonAngle0);
      var rmx = x - mn.x, rmy = y - mn.y;
      var rmNow = Math.sqrt(rmx * rmx + rmy * rmy);
      if (rmNow < R_MOON_DU) { collision = 'moon'; break; }
    }

    return {
      x: x, y: y, vx: vx, vy: vy, t: t,
      dvSpent: dvSpent,
      collision: collision
    };
  }

  // ── Forward simulation — used by predictor, demo ghost, and tests ────────────
  // Returns { samples, markers, end, collision, minRearth, minRmoon }.
  // `thrust`/`gmEMul`/`gmMMul` stay constant over the whole sweep (caller's job
  // to update opts if it wants thrust to change). `abortOnCollision` stops the
  // sweep at first impact and reports it; otherwise the sweep continues.
  function simulate(state, opts, totalT, steps, sampleEvery, abortOnCollision) {
    var dt = totalT / steps;
    var s  = { x: state.x, y: state.y, vx: state.vx, vy: state.vy, t: state.t };
    var samples = [];
    var markers = [];
    var collision = null;
    var minRearth = Infinity;
    var minRmoon  = Infinity;

    // For apo/peri edge-detection.
    var prevDrE = s.x * s.vx + s.y * s.vy;
    var nApoE = 0, nPeriE = 0;
    var prevDrM = null;
    var nApoM = 0, nPeriM = 0;

    samples.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, t: s.t, f: 0 });

    for (var i = 1; i <= steps; i++) {
      // Disable internal adaptive substepping for the predictor — the predictor
      // already uses a small dt and the caller controls accuracy via `steps`.
      // Use a single Euler sub-step inline (not stepPhysics) so the predictor
      // is fast and deterministic.
      var a = accelAt(s.x, s.y, s.t, opts);
      s.vx += a.ax * dt;
      s.vy += a.ay * dt;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.t  += dt;

      var re = Math.sqrt(s.x * s.x + s.y * s.y);
      if (re < minRearth) minRearth = re;
      if (re < R_EARTH_DU) {
        collision = 'earth';
        if (abortOnCollision) break;
      }
      var mn = moonPos(s.t, opts.moonAngle0);
      var rmx = s.x - mn.x, rmy = s.y - mn.y;
      var rm = Math.sqrt(rmx * rmx + rmy * rmy);
      if (rm < minRmoon) minRmoon = rm;
      if (rm < R_MOON_DU) {
        collision = 'moon';
        if (abortOnCollision) break;
      }

      // Earth-relative apo/peri edge-detect (limit 2 of each).
      var drE = s.x * s.vx + s.y * s.vy;
      if (nApoE  < 2 && prevDrE > 0 && drE <= 0) { markers.push({ x: s.x, y: s.y, t: s.t, type: 'apo_earth'  }); nApoE++;  }
      if (nPeriE < 2 && prevDrE < 0 && drE >= 0) { markers.push({ x: s.x, y: s.y, t: s.t, type: 'peri_earth' }); nPeriE++; }
      prevDrE = drE;

      // Moon-relative apo/peri edge-detect (only when reasonably close).
      var mv = moonVel(s.t, opts.moonAngle0);
      var rvx = s.vx - mv.x, rvy = s.vy - mv.y;
      var drM = rmx * rvx + rmy * rvy;
      if (prevDrM !== null && rm < 0.18) {
        if (nApoM  < 2 && prevDrM > 0 && drM <= 0) { markers.push({ x: s.x, y: s.y, t: s.t, type: 'apo_moon'  }); nApoM++;  }
        if (nPeriM < 2 && prevDrM < 0 && drM >= 0) { markers.push({ x: s.x, y: s.y, t: s.t, type: 'peri_moon' }); nPeriM++; }
      }
      prevDrM = drM;

      if (i % sampleEvery === 0) {
        samples.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, t: s.t, f: i / steps });
      }
    }

    return {
      samples:   samples,
      markers:   markers,
      end:       s,
      collision: collision,
      minRearth: minRearth,
      minRmoon:  minRmoon
    };
  }

  // ── Orbital elements (analytical, in the primary's frame) ────────────────────
  // primary = { x, y, vx, vy } — Earth = origin/zero; for Moon pass moonPos+moonVel.
  // Returns NaNs cleanly for unbound (e ≥ 1) cases: peri remains finite, apo = Infinity.
  function orbitalElements(state, gm, primary) {
    var rx = state.x - primary.x;
    var ry = state.y - primary.y;
    var vx = state.vx - primary.vx;
    var vy = state.vy - primary.vy;
    var r  = Math.sqrt(rx * rx + ry * ry);
    var v2 = vx * vx + vy * vy;
    if (r < 1e-9) r = 1e-9;
    var energy = 0.5 * v2 - gm / r;
    var h = rx * vy - ry * vx;                                 // specific ang momentum (z)
    // Eccentricity vector e = (v×h)/μ − r/|r|, in 2D h is scalar so e_x = (vy*h)/μ − rx/r etc.
    var ex = (vy * h) / gm - rx / r;
    var ey = (-vx * h) / gm - ry / r;
    var e  = Math.sqrt(ex * ex + ey * ey);
    var a, peri, apo, period;
    if (Math.abs(energy) < 1e-9 || energy >= 0) {
      // Parabolic or hyperbolic — no bounded apo, infinite period.
      a = Infinity;
      peri = (h * h) / (gm * (1 + e));
      apo  = Infinity;
      period = Infinity;
    } else {
      a    = -gm / (2 * energy);
      peri = a * (1 - e);
      apo  = a * (1 + e);
      period = PI2 * Math.sqrt(a * a * a / gm);
    }
    return { a: a, e: e, peri: peri, apo: apo, period: period, energy: energy, h: h, r: r, v: Math.sqrt(v2) };
  }

  // ── Phasing math — replaces the magic +0.07/+0.12/+0.66/+0.20 fudge factors ─
  // Returns moonAngle0 such that the Moon arrives at angular position
  //   π + leadAngleRad
  // at time t = TOF, where TOF is the half-period of the Hohmann transfer
  // ellipse from rPeri to rApo around Earth. Spacecraft starts at (+rPeri, 0)
  // going prograde (CCW); apoapsis is at angular position π. leadAngleRad > 0
  // ⇒ Moon arrives slightly past apoapsis (trailing approach for slingshots /
  // free returns); leadAngleRad < 0 ⇒ Moon arrives slightly before (good for
  // LOI capture from behind).
  function hohmannMoonPhase(rPeri, rApo, leadAngleRad) {
    var a   = (rPeri + rApo) / 2;
    var tof = Math.PI * Math.sqrt(a * a * a / GM_E);   // half period
    return Math.PI + leadAngleRad - MOON_W * tof;
  }

  // ── Impulsive burn ───────────────────────────────────────────────────────────
  // Mutates state.vx/vy. Returns the magnitude actually applied.
  // dir: 'prograde' | 'retrograde' | 'prograde_moon' | 'retrograde_moon'
  // mode: 'circularize_moon' (computes the dv needed to circularize around Moon)
  //  - in that case `dv` argument is ignored and the function picks its own
  //    magnitude based on current state. Returns the actual magnitude spent.
  function applyImpulse(state, burn, opts) {
    var dvMag = burn.dv != null ? burn.dv : 0;
    var dx = 0, dy = 0;

    if (burn.mode === 'circularize_moon') {
      var gmM = GM_M * (opts.gmMMul != null ? opts.gmMMul : 1);
      var mp = moonPos(state.t, opts.moonAngle0);
      var mv = moonVel(state.t, opts.moonAngle0);
      var mdx = state.x - mp.x, mdy = state.y - mp.y;
      var rvx = state.vx - mv.x, rvy = state.vy - mv.y;
      var rm = Math.sqrt(mdx * mdx + mdy * mdy);
      var vr = Math.sqrt(rvx * rvx + rvy * rvy);
      if (rm < 0.005) rm = 0.005;
      if (vr < 1e-4) return 0;
      var vcirc = Math.sqrt(gmM / rm);
      dvMag = vr - vcirc;          // positive ⇒ retrograde slowdown
      dx = -rvx / vr; dy = -rvy / vr;
    } else if (burn.dir === 'prograde' || burn.dir === 'retrograde') {
      var vl = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      if (vl < 1e-4) return 0;
      var sgn = burn.dir === 'prograde' ? 1 : -1;
      dx = sgn * state.vx / vl;
      dy = sgn * state.vy / vl;
    } else if (burn.dir === 'prograde_moon' || burn.dir === 'retrograde_moon') {
      var mv2 = moonVel(state.t, opts.moonAngle0);
      var rvx2 = state.vx - mv2.x, rvy2 = state.vy - mv2.y;
      var rl = Math.sqrt(rvx2 * rvx2 + rvy2 * rvy2);
      if (rl < 1e-4) return 0;
      var s2 = burn.dir === 'prograde_moon' ? 1 : -1;
      dx = s2 * rvx2 / rl;
      dy = s2 * rvy2 / rl;
    }

    state.vx += dx * dvMag;
    state.vy += dy * dvMag;
    return Math.abs(dvMag);
  }

  // ── Trigger checks for impulsive-burn programs (demo autopilot) ──────────────
  // Stateful: keeps a "previous dr" history. Caller constructs one per program.
  function makeImpulsiveProgram(burns) {
    var idx = 0;
    var prevDrE = null;
    var prevDrM = null;
    var lastAnnouncement = null;
    return {
      done: function () { return idx >= burns.length; },
      currentBurn: function () { return idx < burns.length ? burns[idx] : null; },
      // Returns the burn object if it fired this tick, else null.
      tick: function (state, opts) {
        if (idx >= burns.length) return null;
        var burn = burns[idx];

        var drE = state.x * state.vx + state.y * state.vy;
        var mp  = moonPos(state.t, opts.moonAngle0);
        var mv  = moonVel(state.t, opts.moonAngle0);
        var mdx = state.x - mp.x, mdy = state.y - mp.y;
        var rmx = state.vx - mv.x, rmy = state.vy - mv.y;
        var drM = mdx * rmx + mdy * rmy;

        var fire = false;
        if (burn.trigger === 'time') {
          if (state.t >= burn.t) fire = true;
        } else if (burn.trigger === 'apoapsis_earth') {
          if (prevDrE !== null && prevDrE > 0 && drE <= 0) fire = true;
        } else if (burn.trigger === 'periapsis_moon') {
          var rm = Math.sqrt(mdx * mdx + mdy * mdy);
          if (prevDrM !== null && prevDrM < 0 && drM >= 0 && rm < 0.15) fire = true;
        }
        prevDrE = drE;
        prevDrM = drM;

        if (fire) {
          var mag = applyImpulse(state, burn, opts);
          idx++;
          prevDrE = null;
          prevDrM = null;
          lastAnnouncement = burn;
          return { burn: burn, magnitude: mag };
        }
        return null;
      },
      reset: function () {
        idx = 0;
        prevDrE = null;
        prevDrM = null;
        lastAnnouncement = null;
      },
      progress: function () { return idx; }
    };
  }

  // ── Resolver for "computed:..." string sigils in scenario start states ──────
  // Lets scenarios.js declare:  moonAngle0: 'computed:hohmannMoonPhase(0.12, 1.0, -0.07)'
  // and have it resolved analytically at boot. Keeps the data file readable.
  function resolveComputed(expr) {
    if (typeof expr !== 'string') return expr;
    if (expr.indexOf('computed:') !== 0) return expr;
    var body = expr.substring(9).trim();
    var openP = body.indexOf('(');
    if (openP < 0) return NaN;
    var fnName = body.substring(0, openP).trim();
    var argsStr = body.substring(openP + 1, body.lastIndexOf(')'));
    var args = argsStr.split(',').map(function (s) { return parseFloat(s.trim()); });
    if (fnName === 'hohmannMoonPhase') return hohmannMoonPhase(args[0], args[1], args[2]);
    if (fnName === 'circularLEO')     return Math.sqrt(GM_E / args[0]);  // returns velocity
    return NaN;
  }

  // ── Public ──────────────────────────────────────────────────────────────────
  return {
    // constants
    PI2:        PI2,
    GM_E:       GM_E,
    MU:         MU,
    GM_M:       GM_M,
    MOON_R:     MOON_R,
    MOON_W:     MOON_W,
    R_EARTH_DU: R_EARTH_DU,
    R_MOON_DU:  R_MOON_DU,
    SOI_MOON_DU: SOI_MOON_DU,
    DU_TO_KM:   DU_TO_KM,
    TU_TO_DAYS: TU_TO_DAYS,
    TU_TO_SEC:  TU_TO_SEC,
    DU_PER_TU_TO_KMPS: DU_PER_TU_TO_KMPS,

    // pure
    moonPos:           moonPos,
    moonVel:           moonVel,
    accelAt:           accelAt,
    stepPhysics:       stepPhysics,
    simulate:          simulate,
    orbitalElements:   orbitalElements,
    hohmannMoonPhase:  hohmannMoonPhase,

    // stateful helpers
    applyImpulse:        applyImpulse,
    makeImpulsiveProgram: makeImpulsiveProgram,
    resolveComputed:     resolveComputed
  };
}));
