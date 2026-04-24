(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MuckoSmashPolicy = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Feature schema versioning. Bump OBS_VERSION whenever the observation
  // layout changes so old model files are refused by validateModel().
  var OBS_VERSION = 1;

  // World constants. These mirror sim.js / index.html. Kept local so this
  // module has no dependencies beyond the match + entity objects passed in.
  var W = 800;
  var H = 560;
  var STAGE_LEFT_EDGE = 120;
  var STAGE_RIGHT_EDGE = 680;
  var START_STOCKS = 3;
  var DASH_DURATION = 0.18;
  var DASH_COOLDOWN = 0.35;
  var JUMP_THRESHOLD = 0.5;
  var SPECIAL_THRESHOLD = 0.5;
  var DASH_THRESHOLD = 0.5;
  var MOVE_THRESHOLD = 0.5;

  // Canonical character ID order. MUST match sim.js CHAR_IDS (line 77) and
  // index.html CHAR_IDS. If roster order changes, OBS_VERSION bumps too.
  var CHAR_IDS = [
    'samster', 'duck', 'hippo', 'nik', 'lekan', 'basil',
    'mandy', 'rocket', 'digory', 'jlong', 'pras', 'natasha'
  ];
  var CHAR_INDEX = {};
  for (var ci = 0; ci < CHAR_IDS.length; ci++) CHAR_INDEX[CHAR_IDS[ci]] = ci;
  var NUM_CHARS = CHAR_IDS.length;

  // Feature layout. Order is frozen for OBS_VERSION = 1.
  //
  //   self-state          13
  //   target-state        10
  //   arena (edges+3 plats) 3 + 9 = 12
  //   self char one-hot   NUM_CHARS (12)
  //   target char one-hot NUM_CHARS (12)
  //                        -----
  //                        59
  var FEATURE_NAMES = [
    // self (13)
    'self_x', 'self_y', 'self_vx', 'self_vy',
    'self_damage', 'self_stocks', 'self_onGround', 'self_facing',
    'self_invuln', 'self_dashT', 'self_dashCd', 'self_specialCd', 'self_specialActive',
    // target (10)
    'tgt_dx', 'tgt_dy', 'tgt_vx', 'tgt_vy',
    'tgt_damage', 'tgt_stocks', 'tgt_onGround', 'tgt_facing',
    'tgt_invuln', 'tgt_specialActive',
    // arena (12)
    'edge_left_dist', 'edge_right_dist', 'height_above_bottom',
    'plat0_dx', 'plat0_dy', 'plat0_w',
    'plat1_dx', 'plat1_dy', 'plat1_w',
    'plat2_dx', 'plat2_dy', 'plat2_w'
  ];
  for (var ci2 = 0; ci2 < NUM_CHARS; ci2++) {
    FEATURE_NAMES.push('self_char_' + CHAR_IDS[ci2]);
  }
  for (var ci3 = 0; ci3 < NUM_CHARS; ci3++) {
    FEATURE_NAMES.push('tgt_char_' + CHAR_IDS[ci3]);
  }
  var OBS_DIM = FEATURE_NAMES.length;

  // Output layout. Five channels drive the sim.js 7-field input struct.
  //
  //   logits[0] -> left   (threshold)
  //   logits[1] -> right  (threshold; if both, pick larger)
  //   logits[2] -> jump   (rising-edge => jumpPressed; above => jumpHeld)
  //   logits[3] -> dash   (rising-edge only)
  //   logits[4] -> special(rising-edge => specialPressed; above => specialHeld)
  var OUT_DIM = 5;

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function tanh(x) {
    // JS Math.tanh is ES2015; polyfill for Safari 12.
    if (x > 20) return 1;
    if (x < -20) return -1;
    var e2x = Math.exp(2 * x);
    return (e2x - 1) / (e2x + 1);
  }

  function sigmoid(x) {
    if (x >= 0) {
      var ez = Math.exp(-x);
      return 1 / (1 + ez);
    }
    var ep = Math.exp(x);
    return ep / (1 + ep);
  }

  function findNearestOpponent(match, entity) {
    var best = null;
    var bestDist = Infinity;
    var ents = match.entities;
    for (var i = 0; i < ents.length; i++) {
      var other = ents[i];
      if (other === entity || other.ko) continue;
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

  // Build a length-OBS_DIM observation vector (plain Array of numbers).
  // No RNG, no side effects. Safe to call every frame for every fighter.
  function buildObservation(match, entity) {
    var obs = new Array(OBS_DIM);
    for (var z = 0; z < OBS_DIM; z++) obs[z] = 0;

    var idx = 0;

    // --- self (13) ---
    obs[idx++] = (entity.x - W / 2) / (W / 2);
    obs[idx++] = (entity.y - H / 2) / (H / 2);
    obs[idx++] = clamp(entity.vx / 600, -2, 2);
    obs[idx++] = clamp(entity.vy / 900, -2, 2);
    obs[idx++] = clamp(entity.damage / 150, 0, 2);
    obs[idx++] = (entity.stocks || 0) / START_STOCKS;
    obs[idx++] = entity.onGround ? 1 : 0;
    obs[idx++] = entity.facing === 'right' ? 1 : -1;
    obs[idx++] = clamp((entity.invulnFrames || 0) / 60, 0, 2);
    obs[idx++] = clamp((entity.dashT || 0) / DASH_DURATION, 0, 1);
    obs[idx++] = clamp((entity.dashCooldown || 0) / (DASH_DURATION + DASH_COOLDOWN), 0, 1);
    obs[idx++] = clamp((entity.specialCooldown || 0) / 2, 0, 1);
    obs[idx++] = entity.specialActive ? 1 : 0;

    // --- target (10) ---
    var target = findNearestOpponent(match, entity);
    if (target) {
      obs[idx++] = clamp((target.x - entity.x) / W, -1.5, 1.5);
      obs[idx++] = clamp((target.y - entity.y) / H, -1.5, 1.5);
      obs[idx++] = clamp(target.vx / 600, -2, 2);
      obs[idx++] = clamp(target.vy / 900, -2, 2);
      obs[idx++] = clamp(target.damage / 150, 0, 2);
      obs[idx++] = (target.stocks || 0) / START_STOCKS;
      obs[idx++] = target.onGround ? 1 : 0;
      obs[idx++] = target.facing === 'right' ? 1 : -1;
      obs[idx++] = clamp((target.invulnFrames || 0) / 60, 0, 2);
      obs[idx++] = target.specialActive ? 1 : 0;
    } else {
      // No live opponent: leave zeros (already filled). Jump past 10 slots.
      idx += 10;
    }

    // --- arena edges + height (3) ---
    obs[idx++] = clamp((entity.x - STAGE_LEFT_EDGE) / W, -0.5, 1.5);
    obs[idx++] = clamp((STAGE_RIGHT_EDGE - entity.x) / W, -0.5, 1.5);
    obs[idx++] = clamp((H - entity.y) / H, -0.5, 1.5);

    // --- 3 nearest platforms (9) ---
    var plats = match.platforms || [];
    // Compute distances; pack into a tmp array we can sort without mutating match.
    var rated = [];
    for (var pi = 0; pi < plats.length; pi++) {
      var p = plats[pi];
      var pcx = p.x + p.w / 2;
      var pcy = p.y;
      var ddx = pcx - entity.x;
      var ddy = pcy - entity.y;
      var d = Math.abs(ddx) + Math.abs(ddy) * 0.6;
      rated.push({ d: d, dx: ddx, dy: ddy, w: p.w });
    }
    rated.sort(function (a, b) { return a.d - b.d; });
    for (var pk = 0; pk < 3; pk++) {
      if (pk < rated.length) {
        obs[idx++] = clamp(rated[pk].dx / W, -1.5, 1.5);
        obs[idx++] = clamp(rated[pk].dy / H, -1.5, 1.5);
        obs[idx++] = clamp(rated[pk].w / W, 0, 1);
      } else {
        obs[idx++] = 0;
        obs[idx++] = 0;
        obs[idx++] = 0;
      }
    }

    // --- self char one-hot ---
    var selfCharIdx = CHAR_INDEX[entity.charId];
    if (selfCharIdx != null) obs[idx + selfCharIdx] = 1;
    idx += NUM_CHARS;

    // --- target char one-hot ---
    if (target) {
      var tgtCharIdx = CHAR_INDEX[target.charId];
      if (tgtCharIdx != null) obs[idx + tgtCharIdx] = 1;
    }
    idx += NUM_CHARS;

    return obs;
  }

  // Forward pass storing all intermediate activations. Used by the RL
  // trainer for backprop. Returns { logits, acts } where acts[l] is the
  // output of layer l (acts[0] = input obs).
  function policyForwardFull(model, obs) {
    var x = obs;
    var layers = model.layers;
    var acts = new Array(layers.length + 1);
    acts[0] = obs;
    for (var l = 0; l < layers.length; l++) {
      var layer = layers[l];
      var y = new Array(layer.out);
      for (var o = 0; o < layer.out; o++) {
        var sum = layer.b[o];
        var row = layer.W[o];
        for (var k = 0; k < layer.in; k++) sum += row[k] * x[k];
        y[o] = (layer.activation === 'tanh') ? tanh(sum) : sum;
      }
      acts[l + 1] = y;
      x = y;
    }
    return { logits: x, acts: acts };
  }

  // Forward pass through an MLP. model.layers is an array of
  //   { in, out, activation: 'tanh'|'linear', W: [out][in], b: [out] }
  // Returns a plain Array of OUT_DIM logits.
  function policyForward(model, obs) {
    var x = obs;
    var layers = model.layers;
    for (var l = 0; l < layers.length; l++) {
      var layer = layers[l];
      var Wm = layer.W;
      var b = layer.b;
      var outN = layer.out;
      var inN = layer.in;
      var y = new Array(outN);
      for (var o = 0; o < outN; o++) {
        var sum = b[o];
        var row = Wm[o];
        for (var k = 0; k < inN; k++) sum += row[k] * x[k];
        if (layer.activation === 'tanh') y[o] = tanh(sum);
        else y[o] = sum;
      }
      x = y;
    }
    return x;
  }

  // Map 5 sigmoid probabilities -> sim.js input struct. Uses the entity's
  // persistent ai.nnState to edge-trigger the pressed bits.
  function actionsToInput(probs, entity) {
    if (!entity.ai) entity.ai = {};
    if (!entity.ai.nnState) {
      entity.ai.nnState = { prevJump: 0, prevDash: 0, prevSpecial: 0 };
    }
    var st = entity.ai.nnState;

    var pLeft = probs[0];
    var pRight = probs[1];
    var pJump = probs[2];
    var pDash = probs[3];
    var pSpecial = probs[4];

    // left/right mutually exclusive: the larger one wins if both pass threshold
    var left = false;
    var right = false;
    if (pLeft >= MOVE_THRESHOLD || pRight >= MOVE_THRESHOLD) {
      if (pRight >= pLeft) right = true;
      else left = true;
    }

    var jumpHeld = pJump >= JUMP_THRESHOLD;
    var jumpPressed = jumpHeld && st.prevJump < JUMP_THRESHOLD;

    var dashPressed = pDash >= DASH_THRESHOLD && st.prevDash < DASH_THRESHOLD;

    var specialHeld = pSpecial >= SPECIAL_THRESHOLD;
    var specialPressed = specialHeld && st.prevSpecial < SPECIAL_THRESHOLD;

    st.prevJump = pJump;
    st.prevDash = pDash;
    st.prevSpecial = pSpecial;

    return {
      left: left,
      right: right,
      jumpPressed: jumpPressed,
      jumpHeld: jumpHeld,
      dashPressed: dashPressed,
      specialPressed: specialPressed,
      specialHeld: specialHeld
    };
  }

  // Full decision: obs -> forward -> sigmoid -> input struct.
  function neuralDecide(match, entity, dt, model) {
    var obs = buildObservation(match, entity);
    var logits = policyForward(model, obs);
    var probs = new Array(OUT_DIM);
    for (var i = 0; i < OUT_DIM; i++) probs[i] = sigmoid(logits[i]);
    return actionsToInput(probs, entity);
  }

  // Throw (or return false with opts.silent) if the model cannot run under
  // this runtime. Doesn't validate weight shapes beyond header sanity.
  function validateModel(model, opts) {
    var silent = opts && opts.silent;
    function bad(msg) {
      if (silent) return false;
      throw new Error('policy.js: invalid model — ' + msg);
    }
    if (!model || typeof model !== 'object') return bad('not an object');
    if (model.schemaVersion !== 1) return bad('schemaVersion != 1 (got ' + model.schemaVersion + ')');
    if (model.obsVersion !== OBS_VERSION) return bad('obsVersion mismatch (model=' + model.obsVersion + ', runtime=' + OBS_VERSION + ')');
    if (model.arch !== 'mlp') return bad('arch != "mlp"');
    if (model.inDim !== OBS_DIM) return bad('inDim mismatch (model=' + model.inDim + ', runtime=' + OBS_DIM + ')');
    if (model.outDim !== OUT_DIM) return bad('outDim mismatch (model=' + model.outDim + ', runtime=' + OUT_DIM + ')');
    if (!model.layers || !model.layers.length) return bad('no layers');
    var prevOut = model.inDim;
    for (var i = 0; i < model.layers.length; i++) {
      var L = model.layers[i];
      if (L.in !== prevOut) return bad('layer ' + i + ' in=' + L.in + ' != prev out=' + prevOut);
      if (!L.W || L.W.length !== L.out) return bad('layer ' + i + ' W length');
      if (!L.b || L.b.length !== L.out) return bad('layer ' + i + ' b length');
      if (L.W[0].length !== L.in) return bad('layer ' + i + ' W row length');
      prevOut = L.out;
    }
    if (prevOut !== model.outDim) return bad('final out != outDim');
    return true;
  }

  // Convenience: build a fresh random-weights model matching this runtime,
  // for smoke-testing the plumbing before real training exists. Uses a
  // seeded RNG so output is reproducible. He-init on weights.
  function randomModel(hidden, seed) {
    hidden = hidden || [64, 64];
    var s = (seed || 1) >>> 0;
    function rng() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    }
    function gauss() {
      // Box-Muller.
      var u1 = rng();
      if (u1 < 1e-9) u1 = 1e-9;
      var u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    var sizes = [OBS_DIM].concat(hidden).concat([OUT_DIM]);
    var layers = [];
    for (var i = 0; i < sizes.length - 1; i++) {
      var inN = sizes[i];
      var outN = sizes[i + 1];
      var scale = Math.sqrt(2 / inN); // He init for tanh is ~gain/sqrt(in)
      var row;
      var Wm = new Array(outN);
      for (var o = 0; o < outN; o++) {
        row = new Array(inN);
        for (var k = 0; k < inN; k++) row[k] = gauss() * scale;
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
      obsVersion: OBS_VERSION,
      arch: 'mlp',
      inDim: OBS_DIM,
      outDim: OUT_DIM,
      layers: layers,
      meta: {
        random: true,
        seed: seed || 1,
        hidden: hidden
      }
    };
  }

  return {
    OBS_VERSION: OBS_VERSION,
    OBS_DIM: OBS_DIM,
    OUT_DIM: OUT_DIM,
    FEATURE_NAMES: FEATURE_NAMES,
    CHAR_IDS: CHAR_IDS,
    buildObservation: buildObservation,
    policyForward: policyForward,
    policyForwardFull: policyForwardFull,
    actionsToInput: actionsToInput,
    neuralDecide: neuralDecide,
    validateModel: validateModel,
    randomModel: randomModel
  };
}));
