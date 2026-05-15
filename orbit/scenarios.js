// Orbital mechanics — mission registry.
// UMD: window.OrbitMissions / module.exports. ES5 only.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./physics.js'));
  else root.OrbitMissions = factory(root.OrbitPhysics);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Phys) {
  'use strict';

  var GM_E   = Phys.GM_E;
  var MOON_W = Phys.MOON_W;

  // ── Pre-computed start velocities (analytical) ───────────────────────────────
  var R_LEO       = 0.12;
  var V_LEO       = Math.sqrt(GM_E / R_LEO);                           // ≈ 18.138

  // LEO-sub-circular start for "Stable LEO" tutorial. Spacecraft begins at
  // apoapsis of a sub-circular ellipse (peri 0.108, apo 0.13). One prograde
  // burn at apoapsis circularizes the orbit at 0.13 DU. ΔV = V_circ(0.13) -
  // V_apo_start ≈ 17.43 - 16.58 = 0.85 DU/TU. Total ΔV used ~ 0.9 ⇒ stars
  // for efficient solo flight.
  var R_LEO_START   = 0.13;
  var V_CIRC_START  = Math.sqrt(GM_E / R_LEO_START);                   // ≈ 17.43
  var V_LEO_START   = V_CIRC_START * 0.951;                            // ≈ 16.58 (slightly sub-circular at apo)
  var LEO_CIRC_DV   = V_CIRC_START - V_LEO_START;                      // ≈ 0.86

  // Hohmann to a 0.55 DU circle.
  var R_HOH_APO = 0.55;
  var A_HOH     = (R_LEO + R_HOH_APO) / 2;
  var V_HOH     = Math.sqrt(GM_E * (2 / R_LEO   - 1 / A_HOH));         // ≈ 23.24
  var V_HOH_APO = Math.sqrt(GM_E * (2 / R_HOH_APO - 1 / A_HOH));       // ≈ 5.07
  var V_CIRC_HOH= Math.sqrt(GM_E / R_HOH_APO);                         // ≈ 8.47
  var HOHMANN_DV1 = V_HOH      - V_LEO;                                // ≈ 5.10
  var HOHMANN_DV2 = V_CIRC_HOH - V_HOH_APO;                            // ≈ 3.40

  // Trans-Lunar Injection (LEO → Moon's orbit radius).
  var V_TLI = Math.sqrt(GM_E * (2 / R_LEO - 1 / ((R_LEO + 1.0) / 2))); // ≈ 24.24
  var TLI_DV = V_TLI - V_LEO;                                          // ≈ 6.10

  // Free Return ellipse apo 0.96 DU.
  var V_FR  = Math.sqrt(GM_E * (2 / R_LEO - 1 / ((R_LEO + 0.96) / 2)));
  var FR_DV = V_FR - V_LEO;                                            // ≈ 5.96

  // Gravity-Assist ellipse apo 0.90 DU.
  var V_GA  = Math.sqrt(GM_E * (2 / R_LEO - 1 / ((R_LEO + 0.90) / 2)));
  var GA_DV = V_GA - V_LEO;                                            // ≈ 5.85

  // Figure-8 retrograde free-return ellipse (peri 0.12, apo 1.10).
  var V_F8 = Math.sqrt(GM_E * (2 / R_LEO - 1 / ((R_LEO + 1.10) / 2))); // ≈ 24.36

  // Match-plane mission: TLI to apo 1.0 DU, but the Moon is mis-phased so
  // a naive t=0 burn lands the spacecraft at apoapsis far from the Moon.
  // The player must coast EXACTLY one LEO orbital period (≈ 0.0416 TU =
  // 1.14 days) before burning. That brings the spacecraft back to its
  // starting position with the Moon advanced into alignment.
  //
  // Math: spacecraft apoapsis ends up at angle (θ_b + π) where θ_b is
  // the angle at burn time. We design moonAngle0 so that when t_b is one
  // full LEO period (θ_b = 0), the Moon arrives at angle (π - 0.10),
  // i.e. ~0.10 DU behind apoapsis.
  //
  // For a naive t=0 burn (θ_b = 0 too, but Moon hasn't had time to
  // advance), apoapsis arrival at t = 0.210 TU finds the Moon ~0.40 rad
  // off (~0.40 DU separation) — too far for the goal's 0.22 DU tolerance.
  // So the player must coast.
  var LEO_PERIOD     = 2 * Math.PI * Math.sqrt(R_LEO * R_LEO * R_LEO / GM_E);   // ≈ 0.0416
  var TLI_TOF        = Math.PI * Math.sqrt(((R_LEO + 1.0) / 2) * ((R_LEO + 1.0) / 2) * ((R_LEO + 1.0) / 2) / GM_E);  // ≈ 0.210
  var MATCH_BURN_T   = LEO_PERIOD;                                              // one LEO orbit of coasting
  var MATCH_MOON_LEAD = -0.10;                                                  // Moon arrives behind apoapsis
  var MATCH_PLANE_MOON_ANGLE0 = Math.PI + MATCH_MOON_LEAD - MOON_W * (MATCH_BURN_T + TLI_TOF);  // ≈ 1.46 rad

  // ── Mission list ─────────────────────────────────────────────────────────────
  var MISSIONS = [
    {
      id:        'leo_stable',
      name:      'Stable Low Earth Orbit',
      blurb:     'Burn just enough to lock in a steady circle around Earth.',
      teaches:   'Circular orbital velocity. Prograde fires accelerate; retrograde slows you down.',
      difficulty: 1,
      color:     '#4af',
      trailRGB:  [68, 170, 255],
      storyChar: 'samster',
      story:     "Samster: 'Round and round! Just a tiny push and the math holds you up.'",

      start: {
        x: R_LEO_START, y: 0,
        vx: 0, vy: V_LEO_START,           // sub-circular by ~1.5 DU/TU
        moonAngle0: 0,
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: 0.001, dir: 'prograde', dv: LEO_CIRC_DV,
            label: 'Single prograde nudge → circular orbit',
            hint: 'Hold SPACE for ~0.2 s.' }
        ],
        expectedDuration: 0.40
      },

      goal: {
        kind: 'circular_orbit_earth',
        params: { rMin: 0.115, rMax: 0.16, eMax: 0.08, dwellTime: 0.08 },
        hudLabel: 'Hold orbit 44,000–61,000 km, eccentricity < 0.08'
      },

      fail: { escape: true },
      view: { preset: 'earth_close', zoomLevel: 0 },
      achievements: ['first_orbit']
    },

    {
      id:        'hohmann_xfer',
      name:      'Hohmann Transfer',
      blurb:     'Two prograde burns lift you from LEO to a higher circle.',
      teaches:   'Two-burn transfer: raise apoapsis, then circularize at apoapsis.',
      difficulty: 2,
      color:     '#9ff',
      trailRGB:  [150, 240, 255],
      storyChar: 'lekan',
      story:     "Lekan: 'Two burns. Raise the apoapsis, then circularize. Minimum fuel, maximum elegance.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: V_LEO,
        moonAngle0: 0,
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: 0.001, dir: 'prograde', dv: HOHMANN_DV1,
            label: 'BURN 1 — Raise apoapsis to 0.55 DU',
            hint: 'Burn prograde at start, ~5.1 DU/TU.' },
          { trigger: 'apoapsis_earth',  dir: 'prograde', dv: HOHMANN_DV2,
            label: 'BURN 2 — Circularize at apoapsis',
            hint: 'At apoapsis, prograde burn ~3.4 DU/TU.' }
        ],
        expectedDuration: 0.45
      },

      goal: {
        kind: 'circular_orbit_earth',
        params: { rMin: 0.48, rMax: 0.62, eMax: 0.12, dwellTime: 0.18 },
        hudLabel: 'Lock circular orbit 184,000–238,000 km, eccentricity < 0.12'
      },

      fail: { escape: true },
      view: { preset: 'earth_med', zoomLevel: 1 },
      achievements: ['hohmann_ace']
    },

    {
      id:        'match_plane',
      name:      'Match Plane with Moon',
      blurb:     'The Moon is in the wrong spot. Coast first, burn second.',
      teaches:   'When you burn matters as much as how hard. Wait for the alignment.',
      difficulty: 3,
      color:     '#cf6',
      trailRGB:  [200, 255, 110],
      storyChar: 'lekan',
      story:     "Lekan: 'A perfect burn at the wrong time is a wasted burn. Watch the Moon. Patience.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: V_LEO,
        moonAngle0: MATCH_PLANE_MOON_ANGLE0,
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: MATCH_BURN_T, dir: 'prograde', dv: TLI_DV,
            label: 'TLI — fires once the Moon is aligned',
            hint: 'Coast one full LEO orbit (~1.1 days). When you return to your starting position, burn prograde.' }
        ],
        expectedDuration: 0.45
      },

      goal: {
        kind: 'apo_meets_moon',
        params: { maxMoonDist: 0.22, apoMin: 0.85, apoMax: 1.10 },
        hudLabel: 'Reach apoapsis with the Moon within 85,000 km'
      },

      fail: { escape: true },
      view: { preset: 'earth_moon', zoomLevel: 2 },
      achievements: ['phasing_master']
    },

    {
      id:        'free_return',
      name:      'Free Return',
      blurb:     'One burn out, swing past the Moon, gravity drops you home.',
      teaches:   'Apollo-13 safety geometry: a flyby that bends the trajectory back to Earth.',
      difficulty: 3,
      color:     '#f8a',
      trailRGB:  [255, 136, 170],
      storyChar: 'lekan',
      story:     "Lekan: 'One burn. If anything goes wrong, gravity brings you home. That is the beauty of the free return.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: V_LEO,
        moonAngle0: 'computed:hohmannMoonPhase(0.12, 0.96, 0.55)',
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: 0.001, dir: 'prograde', dv: FR_DV,
            label: 'TLI — single burn, coast home',
            hint: 'Burn prograde once. Do not touch anything else.' }
        ],
        expectedDuration: 0.55
      },

      goal: {
        kind: 'free_return',
        params: { returnRadius: 0.30, maxFlybyDist: 0.22, maxTime: 1.20 },
        hudLabel: 'Skim the Moon, fall back inside 115,000 km of Earth without re-firing'
      },

      fail: { escape: true, refireAfter: 0.05 },
      view: { preset: 'earth_moon', zoomLevel: 2 },
      achievements: ['fig8_flyer']
    },

    {
      id:        'moon_insertion',
      name:      'Lunar Orbit Insertion',
      blurb:     'TLI burn, half-TU coast, then capture into a Moon orbit.',
      teaches:   'Patched conics: when you cross the Moon\'s SOI, the Moon becomes your primary.',
      difficulty: 4,
      color:     '#fe8',
      trailRGB:  [255, 230, 140],
      storyChar: 'samster',
      story:     "Samster: 'The Moon! Lekan says there is cheese up there. I have decided to believe him.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: V_LEO,
        moonAngle0: 'computed:hohmannMoonPhase(0.12, 1.0, -0.13)',
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: 0.001, dir: 'prograde', dv: TLI_DV,
            label: 'TLI — Trans-Lunar Injection',
            hint: 'Prograde at start, ~6.1 DU/TU.' },
          { trigger: 'periapsis_moon', mode: 'circularize_moon',
            label: 'LOI — Lunar Orbit Insertion',
            hint: 'At Moon-periapsis: retrograde burn until Moon-circular.' }
        ],
        expectedDuration: 0.55
      },

      goal: {
        kind: 'circular_orbit_moon',
        params: { rMin: 0.020, rMax: 0.10, eMax: 0.40, dwellTime: 0.06, mustBeBound: true },
        hudLabel: 'Capture Moon-orbit 7,700–38,400 km altitude, bound to Moon'
      },

      fail: { escape: true },
      view: { preset: 'earth_moon', zoomLevel: 2 },
      achievements: ['moon_walker', 'fast_insertion']
    },

    {
      id:        'gravity_assist',
      name:      'Gravity Assist',
      blurb:     'The Moon pumps energy into your orbit. No second burn.',
      teaches:   'A close prograde flyby steals momentum from the Moon — free ΔV.',
      difficulty: 4,
      color:     '#af8',
      trailRGB:  [170, 255, 136],
      storyChar: 'lekan',
      story:     "Lekan: 'No second burn. The Moon does the work. Let gravity be your engine.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: V_LEO,
        moonAngle0: 'computed:hohmannMoonPhase(0.12, 0.90, 0.15)',
        heading: Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'impulsive_program',
        burns: [
          { trigger: 'time', t: 0.001, dir: 'prograde', dv: GA_DV,
            label: 'Transfer burn — Moon does the rest',
            hint: 'One prograde burn. Then hands off.' }
        ],
        expectedDuration: 0.60
      },

      goal: {
        kind: 'gravity_assisted_apoapsis',
        params: { apoMin: 1.15, noBurnAfter: 0.05, maxTime: 0.85 },
        hudLabel: 'Slingshot to apoapsis > 442,000 km without firing after the transfer burn'
      },

      fail: { escape: true, refireAfter: 0.05 },
      view: { preset: 'earth_moon', zoomLevel: 2 },
      achievements: ['gravity_artist']
    },

    {
      id:        'figure_8',
      name:      'Figure-8 Free Return',
      blurb:     'Apollo 8 retrograde free-return. Watch the rotating-frame magic.',
      teaches:   'In the Earth–Moon rotating frame, a retrograde free return traces a figure-8.',
      difficulty: 5,
      color:     '#fa4',
      trailRGB:  [255, 170, 68],
      storyChar: 'lekan',
      story:     "Lekan: 'Now watch the camera follow the Moon. The path is a figure-eight. Hold on tight.'",

      start: {
        x: R_LEO, y: 0,
        vx: 0, vy: -V_F8,                              // retrograde!
        moonAngle0: 'computed:hohmannMoonPhase(0.12, 1.10, 0.20)',  // figure-8 phasing
        heading: -Math.PI / 2,
        dvBudget: 18
      },

      solution: {
        type: 'coast',
        burns: [],
        expectedDuration: 0.55
      },

      goal: {
        kind: 'figure_8',
        params: { maxFlybyDist: 0.15, returnRadius: 0.18, maxTime: 0.80 },
        hudLabel: 'Loop the Moon, return inside 69,000 km of Earth without firing'
      },

      fail: { escape: true, refireAfter: 0.0 },
      view: { preset: 'rotating_moon', zoomLevel: 3 },
      achievements: ['apollo_8', 'fig8_flyer']
    }
  ];

  // Sandbox is a separate entry point on the title screen, not in MISSIONS.
  // It uses the existing drag-to-aim flow and keeps mass multipliers fully available.
  var SANDBOX = {
    id:        'sandbox',
    name:      'Sandbox',
    blurb:     'Tap to place your spacecraft, drag to set velocity. Free play, all physics knobs unlocked.',
    color:     '#d9f',
    trailRGB:  [220, 170, 255],
    custom:    true,
    start:     { x: 0, y: 0, vx: 0, vy: 0, moonAngle0: 0, heading: 0, dvBudget: 18 },
    view:      { preset: 'earth_moon', zoomLevel: 2 }
  };

  // ── Resolve any 'computed:...' fields in start states ────────────────────────
  function resolveMission(m) {
    if (!m || !m.start) return m;
    var s = m.start;
    var resolvedStart = {
      x:  Phys.resolveComputed(s.x),
      y:  Phys.resolveComputed(s.y),
      vx: Phys.resolveComputed(s.vx),
      vy: Phys.resolveComputed(s.vy),
      moonAngle0: Phys.resolveComputed(s.moonAngle0),
      heading: Phys.resolveComputed(s.heading),
      dvBudget: s.dvBudget
    };
    var copy = {};
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) copy[k] = m[k];
    copy.start = resolvedStart;
    return copy;
  }
  for (var i = 0; i < MISSIONS.length; i++) MISSIONS[i] = resolveMission(MISSIONS[i]);

  // ── Goal evaluator ───────────────────────────────────────────────────────────
  // ctx: { state, opts, dwellAccum, dvBudgetUsed, simT, postSolveFire, minMoonDistSoFar }
  // returns { status: 'wip'|'success'|'failed', dwell: number, reason?: string }
  function evaluateGoal(goal, ctx) {
    var state = ctx.state;
    var opts  = ctx.opts;
    var p     = goal.params;
    var dwell = ctx.dwellAccum;
    var inSpec = false;

    if (goal.kind === 'circular_orbit_earth') {
      var oe = Phys.orbitalElements(state, Phys.GM_E * (opts.gmEMul || 1),
                                    { x: 0, y: 0, vx: 0, vy: 0 });
      inSpec = (oe.r >= p.rMin && oe.r <= p.rMax && oe.e < p.eMax && oe.energy < 0);
    } else if (goal.kind === 'circular_orbit_moon') {
      var mp = Phys.moonPos(state.t, opts.moonAngle0);
      var mv = Phys.moonVel(state.t, opts.moonAngle0);
      var oem = Phys.orbitalElements(state, Phys.GM_M * (opts.gmMMul || 1),
                                     { x: mp.x, y: mp.y, vx: mv.x, vy: mv.y });
      inSpec = (oem.r >= p.rMin && oem.r <= p.rMax && oem.e < p.eMax);
      if (p.mustBeBound && oem.energy >= 0) inSpec = false;
    } else if (goal.kind === 'apo_meets_moon') {
      // Only checked when ship reaches its first true (high) apoapsis after
      // burning. The caller flags this with ctx.atApoapsisEarth, but we also
      // require r > 0.5 DU so a momentary edge-crossing during circular LEO
      // doesn't false-trigger.
      var r2 = Math.sqrt(state.x * state.x + state.y * state.y);
      if (ctx.atApoapsisEarth && r2 > 0.5) {
        var mp2 = Phys.moonPos(state.t, opts.moonAngle0);
        var dist = Math.sqrt((state.x - mp2.x) * (state.x - mp2.x) + (state.y - mp2.y) * (state.y - mp2.y));
        if (dist <= p.maxMoonDist && r2 >= p.apoMin && r2 <= p.apoMax) {
          return { status: 'success', dwell: dwell };
        }
        return { status: 'failed', dwell: dwell, reason: 'Missed alignment — Moon was ' + Math.round(dist * Phys.DU_TO_KM) + ' km away' };
      }
    } else if (goal.kind === 'free_return') {
      // Success: after a real close flyby of the Moon, drop back inside
      // returnRadius of Earth without re-firing. Uses ctx.minEarthPost
      // which tracks the minimum Earth distance *after* the flyby was
      // detected (so initial LEO doesn't count as "returning").
      if (ctx.passedMoon && ctx.minMoonDistSoFar < p.maxFlybyDist &&
          ctx.minEarthPost != null && ctx.minEarthPost <= p.returnRadius) {
        return { status: 'success', dwell: dwell };
      }
      if (state.t > p.maxTime) return { status: 'failed', dwell: dwell, reason: 'Timed out before returning' };
    } else if (goal.kind === 'gravity_assisted_apoapsis') {
      if (ctx.postSolveFire && state.t > p.noBurnAfter) {
        return { status: 'failed', dwell: dwell, reason: 'Cheated — fired after transfer burn' };
      }
      // Success: after the Moon flyby, peak Earth distance exceeded apoMin.
      // maxRsoFar tracks the highest Earth-radius the spacecraft achieved.
      if (ctx.passedMoon && ctx.maxRsoFar >= p.apoMin) {
        return { status: 'success', dwell: dwell };
      }
      if (state.t > p.maxTime) return { status: 'failed', dwell: dwell, reason: 'Slingshot too weak — peak r=' + (ctx.maxRsoFar != null ? ctx.maxRsoFar.toFixed(2) : '?') + ' DU' };
    } else if (goal.kind === 'figure_8') {
      if (ctx.postSolveFire) return { status: 'failed', dwell: dwell, reason: 'No burns allowed' };
      if (ctx.passedMoon && ctx.minMoonDistSoFar < p.maxFlybyDist &&
          ctx.minEarthPost != null && ctx.minEarthPost <= p.returnRadius) {
        return { status: 'success', dwell: dwell };
      }
      if (state.t > p.maxTime) return { status: 'failed', dwell: dwell, reason: 'Did not return home' };
    }

    if (inSpec) {
      dwell += ctx.dt;
      if (dwell >= goal.params.dwellTime) return { status: 'success', dwell: dwell };
    } else {
      dwell = 0;
    }
    return { status: 'wip', dwell: dwell };
  }

  return {
    MISSIONS: MISSIONS,
    SANDBOX:  SANDBOX,
    evaluateGoal: evaluateGoal,
    // Hand-derived constants the UI may want to display:
    constants: {
      R_LEO: R_LEO, V_LEO: V_LEO,
      HOHMANN_DV1: HOHMANN_DV1, HOHMANN_DV2: HOHMANN_DV2,
      TLI_DV: TLI_DV, FR_DV: FR_DV, GA_DV: GA_DV
    }
  };
}));
