(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MuckoSmashSim = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  var W = 800;
  var H = 560;
  var TAU = Math.PI * 2;

  var GRAVITY = 1400;
  var MOVE_ACCEL_GROUND = 2000;
  var MOVE_ACCEL_AIR = 1100;
  var MOVE_MAX = 260;
  var GROUND_FRIC = 1700;
  var JUMP_VEL = 760;
  var JUMP_CUT = 340;
  var TERM_VEL = 1000;

  var FEET_OFFSET = 18;
  var HEAD_OFFSET = 28;
  var ENTITY_W = 30;
  var STAGE_LEFT_EDGE = 120;
  var STAGE_RIGHT_EDGE = 680;

  var STOMP_BOUNCE_MULT = 0.85;
  var SIDE_RESTITUTION = 1.0;
  var SQUASH_DURATION = 0.24;

  var DASH_VEL = 540;
  var DASH_DURATION = 0.18;
  var DASH_COOLDOWN = 0.35;

  var START_STOCKS = 3;
  var DAMAGE_PER_STOMP = 9;
  var KB_BASE_X = 220;
  var KB_BASE_Y = 360;
  var KB_SCALE_X = 6;
  var KB_SCALE_Y = 4;
  var KB_POST_INVULN = 30;
  var KB_RATIO_MIN = 0.6;
  var KB_RATIO_MAX = 1.9;

  var SIDE_DAMAGE_SPEED_MIN = 120;
  var SIDE_DAMAGE_SPEED_SCALE = 85;
  var SIDE_DAMAGE_MAX = 12;
  var SIDE_LAUNCH_SPEED_MIN = 320;
  var SIDE_LAUNCH_POP = 135;
  var SIDE_RECOIL_SPEED = 55;
  var SIDE_HIT_COOLDOWN = 0.12;
  var HIT_CREDIT_WINDOW = 2.0;
  var FIXED_STEP = 1 / 60;
  var MAX_FRAME_DT = 0.08;

  var CHARACTERS = {
    samster: { name: 'Samster',        color: '#dfc18e', accent: '#8d5f35', outline: '#4f311d', sprite: 'hamster' },
    duck:    { name: 'Duck Dieb',      color: '#8b6030', accent: '#2a7a38', outline: '#3c2814', sprite: 'duck',
               special: { type: 'airFlap', lift: 2100, maxRise: 280, flapRate: 7.5 } },
    hippo:   { name: 'Hippo',          color: '#8f7ea8', accent: '#63557b', outline: '#40324c', sprite: 'hippo',
               special: { type: 'margaritaville', damage: 11, launchX: 380, launchY: 220 } },
    nik:     { name: 'Nik',            color: '#6b4a2e', accent: '#c9a47a', outline: '#3a2612', sprite: 'monkey' },
    lekan:   { name: 'Lekan',          color: '#f4f4f4', accent: '#242424', outline: '#202020', sprite: 'panda' },
    basil:   { name: 'Basil',          color: '#6b4527', accent: '#d8b985', outline: '#3b2614', sprite: 'otter' },
    mandy:   { name: 'Mandy Mouse',    color: '#d9a0a3', accent: '#b87e80', outline: '#5b3d40', sprite: 'mouse' },
    // Kept defined so he can return to the roster later without rebuilding the art/spec.
    mucko:   { name: 'Captain Mucko',  color: '#d8a95a', accent: '#8f2f2f', outline: '#5f3914', sprite: 'captain' },
    rocket:  { name: 'Saturn V',       color: '#ededed', accent: '#d76039', outline: '#373737', sprite: 'rocket',
               special: { type: 'abortShot', cooldown: 1.0, speed: 430, radius: 10, damage: 8, launchX: 260, launchY: 135, maxAge: 1.1 } },
    digory:  { name: 'Digory',         color: '#f7f5f0', accent: '#18181c', outline: '#3a2c20', sprite: 'digory',
               special: { type: 'bulldogBounce', bounceRate: 8.5, massMul: 2 } },
    jlong:   { name: 'J. Long',        color: '#f0c84d', accent: '#bf8834', outline: '#5a3a14', sprite: 'giraffe',
               special: { type: 'neckHammer', cooldown: 0.75, active: 0.16, range: 50, radius: 18, damage: 10, launchX: 310, launchY: 170 } },
    pras:    { name: 'Pras the Koala', color: '#9aa1a8', accent: '#3a3f48', outline: '#2c2f36', sprite: 'koala',
               moveMul: 0.06, jumpMul: 0.18, dashMul: 0.10 },
    natasha: { name: 'Natasha',        color: '#45b95c', accent: '#ef6944', outline: '#245a2d', sprite: 'parrot' }
  };
  var CHAR_IDS = ['samster', 'duck', 'hippo', 'nik', 'lekan', 'basil', 'mandy', 'rocket', 'digory', 'jlong', 'pras', 'natasha'];

  var HEURISTIC_DEFAULTS = {
    dwellMin: 0.18,
    dwellMax: 0.72,
    idleChance: 0.08,
    jumpChance: 0.22,
    dashChance: 0.18,
    chaseBias: 0.9,
    edgeBuffer: 165,
    airborneCenterBias: 0.8,
    preferredRange: 110,
    rangeSlack: 70,
    jumpRange: 135,
    jumpAboveBias: 30,
    dashRange: 150,
    aggression: 0.85,
    retreatAtDamage: 105,
    retreatBias: 0.45,
    facingStickiness: 0.2,
    pressureBonus: 0.35,
    jumpCooldown: 0.38
  };
  var EASY_MODE_GENOME = {
    dwellMin: 0.45,
    dwellMax: 1.25,
    idleChance: 0.34,
    jumpChance: 0.14,
    dashChance: 0.02,
    chaseBias: 0.55,
    edgeBuffer: 195,
    airborneCenterBias: 0.95,
    preferredRange: 170,
    rangeSlack: 120,
    jumpRange: 105,
    jumpAboveBias: 42,
    dashRange: 80,
    aggression: 0.42,
    retreatAtDamage: 55,
    retreatBias: 0.72,
    facingStickiness: 0.08,
    pressureBonus: 0.08,
    jumpCooldown: 0.62
  };
  var MEDIUM_MODE_GENOME = {
    dwellMin: 0.05,
    dwellMax: 0.08,
    idleChance: 0.15983551355078818,
    jumpChance: 0.7421402223413054,
    dashChance: 0.13672173357219436,
    chaseBias: 1.388805744396081,
    edgeBuffer: 124.77844460663756,
    airborneCenterBias: 1.3200734693212124,
    preferredRange: 30.083746102782413,
    rangeSlack: 23.36706865626981,
    jumpRange: 95.06286608295237,
    jumpAboveBias: 12.428326467531939,
    dashRange: 79.59593540818037,
    aggression: 0.6457442075411541,
    retreatAtDamage: 59.80099607449523,
    retreatBias: 0.09796710119969136,
    facingStickiness: 0.5479203286616439,
    pressureBonus: 1.308869465364689,
    jumpCooldown: 0.27936499439935825
  };
  var HARD_MODE_GENOME = {
    dwellMin: 0.05,
    dwellMax: 0.08023069221970217,
    idleChance: 0.02199617925777858,
    jumpChance: 0.8063033212223671,
    dashChance: 0.09778584812302143,
    chaseBias: 0.8738832561531491,
    edgeBuffer: 125.87408119417375,
    airborneCenterBias: 0.8575250803335437,
    preferredRange: 186.99556485472175,
    rangeSlack: 134.76814607398813,
    jumpRange: 154.17748241605273,
    jumpAboveBias: 62.797452396342806,
    dashRange: 52.56154417705283,
    aggression: 1.2595372460641254,
    retreatAtDamage: 111.5059016952792,
    retreatBias: 0.10517608210496325,
    facingStickiness: 0.6523378568186853,
    pressureBonus: 1.006071435233136,
    jumpCooldown: 0.4708999652252533
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function seededRng(seed) {
    var s = seed >>> 0;
    if (s === 0) s = 1;
    return function() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  function randRange(rng, lo, hi) {
    return lo + (hi - lo) * rng();
  }

  function chance(rng, p) {
    return rng() < p;
  }

  function damageMass(d) {
    return 0.3 + 0.7 / (1 + Math.exp((d - 50) / 15));
  }

  function currentMass(entity) {
    var mass = damageMass(entity.damage);
    var special = CHARACTERS[entity.charId].special;
    if (entity.specialActive && special && special.type === 'bulldogBounce') mass *= special.massMul;
    if (entity.specialActive && special && special.type === 'margaritaville') mass *= 1000;
    return mass;
  }

  function sideExitDamage(vx) {
    return Math.min(SIDE_DAMAGE_MAX,
      Math.max(0, (Math.abs(vx) - SIDE_DAMAGE_SPEED_MIN) / SIDE_DAMAGE_SPEED_SCALE));
  }

  function applySideLaunch(attacker, defender, launchDir, elasticVAttacker, elasticVDefender) {
    var defenderSpeed = Math.max(Math.abs(elasticVDefender), SIDE_LAUNCH_SPEED_MIN);
    defender.vx = launchDir * defenderSpeed;
    defender.vy = Math.min(defender.vy, -SIDE_LAUNCH_POP);
    defender.onGround = false;
    attacker.vx = -launchDir * Math.min(Math.abs(elasticVAttacker), SIDE_RECOIL_SPEED);
  }

  function makeArena(seed) {
    var rng = seededRng(seed);
    var platforms = [];
    platforms.push({ x: 120, y: 470, w: 560, h: 18, isFloor: true });
    var n = 3 + Math.floor(rng() * 3);
    var attempts = 0;
    while (platforms.length - 1 < n && attempts < 40) {
      attempts++;
      var w = 100 + Math.floor(rng() * 80);
      var x = 60 + Math.floor(rng() * (W - 120 - w));
      var y = 280 + Math.floor(rng() * 140);
      var ok = true;
      for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        if (Math.abs(y - p.y) < 60 && x < p.x + p.w + 30 && x + w > p.x - 30) {
          ok = false;
          break;
        }
      }
      if (ok) platforms.push({ x: x, y: y, w: w, h: 12, isFloor: false });
    }
    return platforms;
  }

  function normalizeGenome(genome) {
    var g = {};
    var src = genome || {};
    var keys = Object.keys(HEURISTIC_DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      g[key] = (src[key] != null) ? src[key] : HEURISTIC_DEFAULTS[key];
    }
    g.dwellMin = clamp(g.dwellMin, 0.05, 1.2);
    g.dwellMax = clamp(Math.max(g.dwellMin + 0.02, g.dwellMax), 0.08, 1.6);
    g.idleChance = clamp(g.idleChance, 0, 0.7);
    g.jumpChance = clamp(g.jumpChance, 0, 0.9);
    g.dashChance = clamp(g.dashChance, 0, 0.9);
    g.chaseBias = clamp(g.chaseBias, 0, 2);
    g.edgeBuffer = clamp(g.edgeBuffer, 120, 240);
    g.airborneCenterBias = clamp(g.airborneCenterBias, 0, 2);
    g.preferredRange = clamp(g.preferredRange, 20, 220);
    g.rangeSlack = clamp(g.rangeSlack, 10, 180);
    g.jumpRange = clamp(g.jumpRange, 30, 240);
    g.jumpAboveBias = clamp(g.jumpAboveBias, -80, 120);
    g.dashRange = clamp(g.dashRange, 40, 260);
    g.aggression = clamp(g.aggression, 0, 2);
    g.retreatAtDamage = clamp(g.retreatAtDamage, 20, 220);
    g.retreatBias = clamp(g.retreatBias, 0, 1.2);
    g.facingStickiness = clamp(g.facingStickiness, 0, 1);
    g.pressureBonus = clamp(g.pressureBonus, 0, 1.5);
    g.jumpCooldown = clamp(g.jumpCooldown, 0.12, 1.0);
    return g;
  }

  function randomGenome(rng) {
    return normalizeGenome({
      dwellMin: randRange(rng, 0.08, 0.5),
      dwellMax: randRange(rng, 0.18, 1.0),
      idleChance: randRange(rng, 0.02, 0.28),
      jumpChance: randRange(rng, 0.05, 0.42),
      dashChance: randRange(rng, 0.05, 0.45),
      chaseBias: randRange(rng, 0.4, 1.4),
      edgeBuffer: randRange(rng, 130, 220),
      airborneCenterBias: randRange(rng, 0.2, 1.2),
      preferredRange: randRange(rng, 40, 160),
      rangeSlack: randRange(rng, 25, 120),
      jumpRange: randRange(rng, 40, 170),
      jumpAboveBias: randRange(rng, -20, 70),
      dashRange: randRange(rng, 60, 190),
      aggression: randRange(rng, 0.35, 1.3),
      retreatAtDamage: randRange(rng, 50, 150),
      retreatBias: randRange(rng, 0.05, 0.8),
      facingStickiness: randRange(rng, 0.05, 0.45),
      pressureBonus: randRange(rng, 0.05, 0.7),
      jumpCooldown: randRange(rng, 0.18, 0.6)
    });
  }

  function mutateGenome(genome, rng, rate, scale) {
    var g = normalizeGenome(genome);
    var next = clone(g);
    var r = (rate != null) ? rate : 0.28;
    var s = (scale != null) ? scale : 0.18;
    var keys = Object.keys(next);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!chance(rng, r)) continue;
      var value = next[key];
      var magnitude = Math.max(Math.abs(value), 1);
      next[key] = value + randRange(rng, -magnitude * s, magnitude * s);
    }
    return normalizeGenome(next);
  }

  function crossoverGenomes(a, b, rng) {
    var out = {};
    var keys = Object.keys(HEURISTIC_DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var pick = chance(rng, 0.5) ? a[key] : b[key];
      out[key] = chance(rng, 0.2) ? (a[key] + b[key]) * 0.5 : pick;
    }
    return normalizeGenome(out);
  }

  function makeEntity(id, slot, x, y, stocks) {
    return {
      id: id,
      slotIndex: slot.slotIndex,
      charId: slot.charId,
      controller: slot.controller || { type: 'none' },
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      w: ENTITY_W,
      onGround: false,
      facing: 'right',
      invulnFrames: 0,
      damage: 0,
      stocks: stocks,
      ko: false,
      bob: 0,
      squashT: 0,
      prevFootY: y + FEET_OFFSET,
      dashT: 0,
      dashDir: 1,
      dashCooldown: 0,
      specialUsed: false,
      specialCooldown: 0,
      specialT: 0,
      specialActive: false,
      specialAnimT: 0,
      specialVictims: Object.create(null),
      lastHitBy: null,
      lastHitAge: Infinity,
      stats: {
        damageDealt: 0,
        damageTaken: 0,
        sideDamageDealt: 0,
        stompDamageDealt: 0,
        kos: 0,
        deaths: 0,
        selfKos: 0,
        stocksLost: 0
      },
      ai: {
        state: 'idle',
        timer: 0.3,
        jumpCooldown: 0,
        input: neutralInput(),
        genome: normalizeGenome(slot.controller && slot.controller.genome),
        targetId: null
      }
    };
  }

  function neutralInput() {
    return { left: false, right: false, jumpPressed: false, jumpHeld: false, dashPressed: false, specialPressed: false, specialHeld: false };
  }

  function createMatch(config) {
    var cfg = config || {};
    var seed = (cfg.seed != null ? cfg.seed : 1) >>> 0;
    var stocks = cfg.stocks != null ? cfg.stocks : START_STOCKS;
    var arenaSeed = (cfg.arenaSeed != null ? cfg.arenaSeed : seed) >>> 0;
    var roster = cfg.roster || [];
    var entities = [];
    var n = roster.length;
    for (var i = 0; i < n; i++) {
      var slot = roster[i];
      var sx = (W * (i + 1)) / (n + 1);
      var sy = 80 + (i % 2) * 40;
      entities.push(makeEntity(i, {
        slotIndex: i,
        charId: slot.charId || CHAR_IDS[i % CHAR_IDS.length],
        controller: slot.controller || { type: 'none' }
      }, sx, sy, stocks));
    }
    return {
      width: W,
      height: H,
      seed: seed,
      arenaSeed: arenaSeed,
      time: 0,
      stepCount: 0,
      status: 'play',
      resultReason: null,
      winnerId: null,
      entities: entities,
      platforms: makeArena(arenaSeed),
      projectiles: [],
      respawnFlash: 0,
      events: [],
      pairCooldowns: Object.create(null),
      rng: seededRng(seed)
    };
  }

  function getAliveEntities(match) {
    var out = [];
    for (var i = 0; i < match.entities.length; i++) {
      if (!match.entities[i].ko) out.push(match.entities[i]);
    }
    return out;
  }

  function getOpponentTarget(match, entity) {
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

  function tryUseCharacterAbility(match, entity) {
    var special = CHARACTERS[entity.charId].special;
    if (!special) return false;
    if (special.type === 'neckHammer') {
      if (entity.specialCooldown > 0 || entity.specialT > 0) return false;
      entity.specialCooldown = special.cooldown;
      entity.specialT = special.active;
      entity.specialVictims = Object.create(null);
      emit(match, { type: 'special', entityId: entity.id, specialType: special.type });
      return true;
    }
    if (special.type === 'abortShot') {
      if (entity.specialCooldown > 0) return false;
      entity.specialCooldown = special.cooldown;
      match.projectiles.push({
        ownerId: entity.id,
        ownerCharId: entity.charId,
        x: entity.x + (entity.facing === 'left' ? -24 : 24),
        y: entity.y - 8,
        vx: (entity.facing === 'left' ? -1 : 1) * special.speed,
        radius: special.radius,
        damage: special.damage,
        launchX: special.launchX,
        launchY: special.launchY,
        maxAge: special.maxAge,
        age: 0
      });
      emit(match, { type: 'special', entityId: entity.id, specialType: special.type });
      return true;
    }
    return false;
  }

  function updateHeldSpecial(match, entity, specialHeld, specialPressed, dt) {
    var special = CHARACTERS[entity.charId].special;
    if (!special) return;

    if (special.type === 'airFlap') {
      if (specialHeld && !entity.onGround) {
        if (!entity.specialActive) emit(match, { type: 'special', entityId: entity.id, specialType: special.type });
        entity.specialActive = true;
        entity.specialAnimT += dt;
        entity.vy = Math.max(entity.vy - special.lift * dt, -special.maxRise);
      } else {
        entity.specialActive = false;
        if (entity.onGround) entity.specialAnimT = 0;
      }
      return;
    }

    if (special.type === 'margaritaville') {
      var nextActive = specialHeld && entity.onGround && entity.dashT <= 0 && entity.squashT <= 0;
      if (nextActive && !entity.specialActive) emit(match, { type: 'special', entityId: entity.id, specialType: special.type });
      entity.specialActive = nextActive;
      if (entity.specialActive) {
        entity.specialAnimT += dt;
        entity.vx = 0;
        entity.vy = 0;
      } else {
        entity.specialAnimT = 0;
      }
      return;
    }

    if (special.type === 'bulldogBounce') {
      var active = specialHeld && entity.onGround;
      if (active && !entity.specialActive) emit(match, { type: 'special', entityId: entity.id, specialType: special.type });
      entity.specialActive = active;
      if (entity.specialActive) {
        entity.specialAnimT += dt;
        entity.vx *= Math.max(0, 1 - dt * 12);
      } else {
        entity.specialAnimT = 0;
      }
    }
  }

  function applySpecialHit(match, attacker, defender, spec, dir) {
    if (defender.specialActive && CHARACTERS[defender.charId].special &&
        CHARACTERS[defender.charId].special.type === 'margaritaville') return;
    defender.damage += spec.damage;
    defender.vx = dir * (spec.launchX + defender.damage * 2.2);
    defender.vy = Math.min(defender.vy, -spec.launchY);
    defender.onGround = false;
    defender.invulnFrames = KB_POST_INVULN;
    if (attacker) markHit(attacker, defender, spec.damage);
  }

  function heuristicInput(match, entity, dt) {
    var ai = entity.ai;
    var g = ai.genome;
    var rng = match.rng;
    ai.jumpCooldown = Math.max(0, ai.jumpCooldown - dt);
    ai.timer -= dt;

    var target = getOpponentTarget(match, entity);
    ai.targetId = target ? target.id : null;
    var input = neutralInput();
    var special = CHARACTERS[entity.charId].special;
    var specialReady = special && ((special.type === 'airFlap' || special.type === 'margaritaville' || special.type === 'bulldogBounce')
      ? true : entity.specialCooldown <= 0 && entity.specialT <= 0);

    var edgeBuffer = Math.max(70, g.edgeBuffer * 0.55);
    var panicBuffer = Math.max(42, edgeBuffer * 0.55);
    var nearLeft = entity.x < STAGE_LEFT_EDGE + edgeBuffer;
    var nearRight = entity.x > STAGE_RIGHT_EDGE - edgeBuffer;
    var panicNearLeft = entity.x < STAGE_LEFT_EDGE + panicBuffer;
    var panicNearRight = entity.x > STAGE_RIGHT_EDGE - panicBuffer;

    if (!target) {
      ai.state = 'idle';
      ai.timer = 0.2;
    } else if (entity.onGround && nearLeft) {
      ai.state = 'walk_right';
      ai.timer = Math.max(ai.timer, panicNearLeft ? 0.9 : 0.55);
    } else if (entity.onGround && nearRight) {
      ai.state = 'walk_left';
      ai.timer = Math.max(ai.timer, panicNearRight ? 0.9 : 0.55);
    } else if (ai.timer <= 0) {
      var dx = target.x - entity.x;
      var adx = Math.abs(dx);
      var dy = target.y - entity.y;
      var desiredDir = dx < 0 ? -1 : 1;
      var comfortLow = Math.max(0, g.preferredRange - g.rangeSlack);
      var comfortHigh = g.preferredRange + g.rangeSlack;
      var highDamage = entity.damage >= g.retreatAtDamage;
      var wantingRetreat = highDamage && adx < comfortHigh && chance(rng, g.retreatBias);
      var dashOpen = entity.onGround && entity.dashCooldown <= 0 && adx < g.dashRange;
      var jumpOpen = entity.onGround && ai.jumpCooldown <= 0;
      var jumpValue = (dy < -g.jumpAboveBias ? 0.35 : 0) + (adx < g.jumpRange ? 0.25 : 0) + g.jumpChance;
      var dashValue = dashOpen ? (g.dashChance + g.aggression * 0.2 + (adx < comfortHigh ? g.pressureBonus : 0)) : 0;
      var idleValue = g.idleChance;

      if (chance(rng, idleValue)) {
        ai.state = 'idle';
      } else if (target && specialReady && special.type === 'abortShot' && adx < 240 && Math.abs(dy) < 90) {
        input.specialPressed = true;
        ai.state = desiredDir < 0 ? 'walk_left' : 'walk_right';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
        ai.input = input;
        return input;
      } else if (target && specialReady && special.type === 'neckHammer' && adx < special.range + 8 && Math.abs(dy) < 70) {
        input.specialPressed = true;
        ai.state = 'idle';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
        ai.input = input;
        return input;
      } else if (target && specialReady && special.type === 'margaritaville' && adx < 80 && Math.abs(dy) < 70) {
        input.specialHeld = true;
        ai.state = 'idle';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
        ai.input = input;
        return input;
      } else if (target && specialReady && special.type === 'bulldogBounce' && adx < 70 && Math.abs(dy) < 70) {
        input.specialHeld = true;
        ai.state = 'idle';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
        ai.input = input;
        return input;
      } else if (dashOpen && chance(rng, clamp(dashValue, 0, 0.95))) {
        ai.state = desiredDir < 0 ? 'dash_left' : 'dash_right';
      } else if (jumpOpen && chance(rng, clamp(jumpValue, 0, 0.95))) {
        ai.state = 'jump';
      } else if (wantingRetreat) {
        ai.state = desiredDir < 0 ? 'walk_right' : 'walk_left';
      } else if (adx < comfortLow && chance(rng, clamp(g.facingStickiness, 0, 0.95))) {
        ai.state = entity.facing === 'left' ? 'walk_left' : 'walk_right';
      } else {
        ai.state = desiredDir < 0 ? 'walk_left' : 'walk_right';
      }
      ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
    }

    if (entity.onGround) {
      if (ai.state === 'walk_left') input.left = true;
      else if (ai.state === 'walk_right') input.right = true;
      else if (ai.state === 'dash_left') {
        input.left = true;
        input.dashPressed = true;
        ai.state = 'walk_left';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
      } else if (ai.state === 'dash_right') {
        input.right = true;
        input.dashPressed = true;
        ai.state = 'walk_right';
        ai.timer = randRange(rng, g.dwellMin, g.dwellMax);
      } else if (ai.state === 'jump') {
        if (target) {
          if (target.x < entity.x) input.left = true;
          else input.right = true;
        }
        input.jumpPressed = true;
        input.jumpHeld = true;
        ai.jumpCooldown = g.jumpCooldown;
        ai.state = 'idle';
      }
      if (nearLeft) {
        input.left = false;
        input.right = true;
        input.dashPressed = false;
      } else if (nearRight) {
        input.right = false;
        input.left = true;
        input.dashPressed = false;
      }
    } else {
      var centerBias = (W * 0.5 - entity.x) / (W * 0.5);
      if (target) {
        if (target.x < entity.x - 10) input.left = true;
        if (target.x > entity.x + 10) input.right = true;
      }
      if (nearLeft) {
        input.left = false;
        input.right = true;
      } else if (nearRight) {
        input.right = false;
        input.left = true;
      }
      if (centerBias < -0.08 * g.airborneCenterBias) {
        input.left = true;
        input.right = false;
      } else if (centerBias > 0.08 * g.airborneCenterBias) {
        input.right = true;
        input.left = false;
      }
      if (special && special.type === 'airFlap') {
        var needsLift = entity.vy > 80 || entity.y > 390;
        var wantsChaseLift = target && target.y < entity.y - 18 && Math.abs(target.x - entity.x) < g.jumpRange;
        if (needsLift || wantsChaseLift) input.specialHeld = true;
      }
      input.jumpHeld = true;
    }
    ai.input = input;
    return input;
  }

  function scriptedInput(match, entity, dt) {
    var controller = entity.controller;
    if (controller && typeof controller.getInput === 'function') {
      var next = controller.getInput(match, entity, dt) || {};
      return {
        left: !!next.left,
        right: !!next.right,
        jumpPressed: !!next.jumpPressed,
        jumpHeld: !!next.jumpHeld,
        dashPressed: !!next.dashPressed,
        specialPressed: !!next.specialPressed,
        specialHeld: !!next.specialHeld
      };
    }
    return neutralInput();
  }

  function chooseInput(match, entity, dt) {
    if (entity.ko) return neutralInput();
    var type = entity.controller && entity.controller.type;
    if (type === 'heuristic') return heuristicInput(match, entity, dt);
    if (type === 'scripted') return scriptedInput(match, entity, dt);
    return neutralInput();
  }

  function emit(match, event) {
    match.events.push(event);
  }

  function markHit(attacker, defender, damage) {
    defender.lastHitBy = attacker.id;
    defender.lastHitAge = 0;
    attacker.stats.damageDealt += damage;
    defender.stats.damageTaken += damage;
  }

  function respawn(match, entity) {
    entity.x = W / 2;
    entity.y = 60;
    entity.vx = 0;
    entity.vy = 0;
    entity.damage = 0;
    entity.dashT = 0;
    entity.dashCooldown = 0;
    entity.specialUsed = false;
    entity.specialCooldown = 0;
    entity.specialT = 0;
    entity.specialActive = false;
    entity.specialAnimT = 0;
    entity.specialVictims = Object.create(null);
    entity.squashT = 0;
    entity.invulnFrames = 60;
    entity.facing = 'right';
    entity.onGround = false;
    entity.lastHitBy = null;
    entity.lastHitAge = Infinity;
    match.respawnFlash = 0.4;
    emit(match, { type: 'respawn', entityId: entity.id });
  }

  function getCreditAttacker(match, entity) {
    if (entity.lastHitBy == null || entity.lastHitAge > HIT_CREDIT_WINDOW) return null;
    return match.entities[entity.lastHitBy] || null;
  }

  function checkMatchEnd(match, reason) {
    if (match.status !== 'play') return;
    var alive = getAliveEntities(match);
    if (alive.length <= 1) {
      match.status = 'results';
      match.resultReason = reason || 'last-entity';
      match.winnerId = alive.length === 1 ? alive[0].id : null;
      emit(match, { type: 'matchEnd', winnerId: match.winnerId, reason: match.resultReason });
    }
  }

  function loseStockOrRespawn(match, entity, reason) {
    if (entity.ko) return;
    entity.stats.deaths++;
    entity.stats.stocksLost++;
    entity.stocks--;
    var attacker = getCreditAttacker(match, entity);
    if (attacker && attacker.id !== entity.id) attacker.stats.kos++;
    else entity.stats.selfKos++;
    emit(match, { type: 'stockLost', entityId: entity.id, attackerId: attacker ? attacker.id : null, reason: reason || 'fall' });
    if (entity.stocks <= 0) {
      entity.ko = true;
      entity.x = -9999;
      entity.y = -9999;
      entity.vx = 0;
      entity.vy = 0;
      emit(match, { type: 'ko', entityId: entity.id, attackerId: attacker ? attacker.id : null });
      checkMatchEnd(match, 'last-entity');
      return;
    }
    respawn(match, entity);
  }

  function startDash(match, entity, dir) {
    if (entity.dashT > 0 || entity.dashCooldown > 0 || entity.squashT > 0) return;
    entity.dashDir = dir < 0 ? -1 : 1;
    entity.facing = entity.dashDir < 0 ? 'left' : 'right';
    entity.dashT = DASH_DURATION;
    entity.dashCooldown = DASH_DURATION + DASH_COOLDOWN;
    var dashMul = (CHARACTERS[entity.charId].dashMul != null) ? CHARACTERS[entity.charId].dashMul : 1;
    entity.vx = entity.dashDir * DASH_VEL * dashMul;
    emit(match, { type: 'dash', entityId: entity.id, dir: entity.dashDir });
  }

  function stomp(match, jumper, landee) {
    if (landee.specialActive && CHARACTERS[landee.charId].special &&
        CHARACTERS[landee.charId].special.type === 'margaritaville') {
      var poolSpec = CHARACTERS[landee.charId].special;
      var awayDir = jumper.x >= landee.x ? 1 : -1;
      jumper.damage += poolSpec.damage;
      jumper.vx = awayDir * (poolSpec.launchX + jumper.damage * 2.2);
      jumper.vy = -(poolSpec.launchY + jumper.damage * 1.4);
      jumper.onGround = false;
      jumper.invulnFrames = KB_POST_INVULN;
      emit(match, { type: 'poolBounce', hippoId: landee.id, targetId: jumper.id });
      return;
    }
    jumper.y = landee.y - HEAD_OFFSET - FEET_OFFSET - 2;
    jumper.vy = -JUMP_VEL * STOMP_BOUNCE_MULT;
    jumper.onGround = false;
    landee.squashT = SQUASH_DURATION;
    landee.damage += DAMAGE_PER_STOMP;
    markHit(jumper, landee, DAMAGE_PER_STOMP);
    jumper.stats.stompDamageDealt += DAMAGE_PER_STOMP;
    var dir = landee.x >= jumper.x ? 1 : -1;
    var massRatio = Math.sqrt(currentMass(jumper) / currentMass(landee));
    var ratioMul = Math.min(KB_RATIO_MAX, Math.max(KB_RATIO_MIN, massRatio));
    landee.vx = dir * (KB_BASE_X + landee.damage * KB_SCALE_X) * ratioMul;
    landee.vy = -(KB_BASE_Y + landee.damage * KB_SCALE_Y) * ratioMul;
    landee.onGround = false;
    landee.invulnFrames = KB_POST_INVULN;
    emit(match, { type: 'stomp', attackerId: jumper.id, defenderId: landee.id });
  }

  function pairKey(a, b) {
    return a < b ? a + ':' + b : b + ':' + a;
  }

  function repelFromHippoPool(match, hippo, other) {
    var cooldownKey = pairKey(hippo.id, other.id);
    if (match.pairCooldowns[cooldownKey] > 0) return;
    var poolSpec = CHARACTERS[hippo.charId].special;
    var awayDir = other.x >= hippo.x ? 1 : -1;
    other.damage += poolSpec.damage;
    other.vx = awayDir * (poolSpec.launchX + other.damage * 2.3);
    other.vy = -(poolSpec.launchY + other.damage * 1.2);
    other.onGround = false;
    other.invulnFrames = KB_POST_INVULN;
    markHit(hippo, other, poolSpec.damage);
    match.pairCooldowns[cooldownKey] = SIDE_HIT_COOLDOWN;
    emit(match, { type: 'poolBounce', hippoId: hippo.id, targetId: other.id });
  }

  function decayPairCooldowns(match, dt) {
    var keys = Object.keys(match.pairCooldowns);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var next = match.pairCooldowns[key] - dt;
      if (next <= 0) delete match.pairCooldowns[key];
      else match.pairCooldowns[key] = next;
    }
  }

  function resolveEntityPairs(match) {
    var es = match.entities;
    for (var i = 0; i < es.length; i++) {
      if (es[i].ko) continue;
      for (var j = i + 1; j < es.length; j++) {
        var A = es[i], B = es[j];
        if (B.ko) continue;
        var ax0 = A.x - A.w / 2, ax1 = A.x + A.w / 2;
        var bx0 = B.x - B.w / 2, bx1 = B.x + B.w / 2;
        if (ax1 < bx0 || bx1 < ax0) continue;
        var ay0 = A.y - HEAD_OFFSET, ay1 = A.y + FEET_OFFSET;
        var by0 = B.y - HEAD_OFFSET, by1 = B.y + FEET_OFFSET;
        if (ay1 < by0 || by1 < ay0) continue;

        var aOnTop = (A.y < B.y) && (A.vy > 0) && (A.vy - B.vy > 40);
        var bOnTop = (B.y < A.y) && (B.vy > 0) && (B.vy - A.vy > 40);
        var aPool = A.specialActive && CHARACTERS[A.charId].special &&
          CHARACTERS[A.charId].special.type === 'margaritaville';
        var bPool = B.specialActive && CHARACTERS[B.charId].special &&
          CHARACTERS[B.charId].special.type === 'margaritaville';

        if (aPool && !bPool) {
          repelFromHippoPool(match, A, B);
          continue;
        }
        if (bPool && !aPool) {
          repelFromHippoPool(match, B, A);
          continue;
        }

        if (aOnTop) {
          stomp(match, A, B);
          continue;
        }
        if (bOnTop) {
          stomp(match, B, A);
          continue;
        }

        var overlap = Math.min(ax1, bx1) - Math.max(ax0, bx0);
        if (overlap <= 0) continue;
        var dir = A.x < B.x ? -1 : 1;
        var mA = currentMass(A), mB = currentMass(B);
        var totalMass = mA + mB;
        var aWasDashing = A.dashT > 0;
        var bWasDashing = B.dashT > 0;
        A.x += dir * overlap * (mB / totalMass);
        B.x -= dir * overlap * (mA / totalMass);
        var uA = A.vx, uB = B.vx;
        var relApproach = uA - uB;
        var vA = ((mA - SIDE_RESTITUTION * mB) * uA + (1 + SIDE_RESTITUTION) * mB * uB) / totalMass;
        var vB = ((mB - SIDE_RESTITUTION * mA) * uB + (1 + SIDE_RESTITUTION) * mA * uA) / totalMass;
        A.vx = vA;
        B.vx = vB;
        if (A.dashT > 0) A.dashT = 0;
        if (B.dashT > 0) B.dashT = 0;

        if (Math.abs(relApproach) > SIDE_DAMAGE_SPEED_MIN) {
          var launchDir = relApproach > 0 ? 1 : -1;
          var launchB = aWasDashing && !bWasDashing;
          var launchA = bWasDashing && !aWasDashing;
          if (!launchA && !launchB) {
            launchB = Math.abs(vB) >= Math.abs(vA);
            launchA = !launchB;
          }
          if (launchB) applySideLaunch(A, B, launchDir, vA, vB);
          else applySideLaunch(B, A, -launchDir, vB, vA);
        }

        if (Math.abs(relApproach) <= SIDE_DAMAGE_SPEED_MIN) continue;
        var cooldownKey = pairKey(A.id, B.id);
        if (match.pairCooldowns[cooldownKey] > 0) continue;
        var dmgA = sideExitDamage(vA);
        var dmgB = sideExitDamage(vB);
        if (dmgA > 0) {
          A.damage += dmgA;
          markHit(B, A, dmgA);
          B.stats.sideDamageDealt += dmgA;
        }
        if (dmgB > 0) {
          B.damage += dmgB;
          markHit(A, B, dmgB);
          A.stats.sideDamageDealt += dmgB;
        }
        if (dmgA > 0 || dmgB > 0) {
          match.pairCooldowns[cooldownKey] = SIDE_HIT_COOLDOWN;
          emit(match, { type: 'sideHit', aId: A.id, bId: B.id, damageA: dmgA, damageB: dmgB });
        }
      }
    }
  }

  function updateProjectiles(match, dt) {
    for (var i = match.projectiles.length - 1; i >= 0; i--) {
      var p = match.projectiles[i];
      p.x += p.vx * dt;
      p.age += dt;
      if (p.age >= p.maxAge || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) {
        match.projectiles.splice(i, 1);
      }
    }
  }

  function resolveSpecials(match) {
    for (var i = 0; i < match.entities.length; i++) {
      var attacker = match.entities[i];
      if (attacker.ko) continue;
      var special = CHARACTERS[attacker.charId].special;
      if (special && special.type === 'neckHammer' && attacker.specialT > 0) {
        var dir = attacker.facing === 'left' ? -1 : 1;
        var hx = attacker.x + dir * (special.range - 6);
        var hy = attacker.y + 2;
        for (var j = 0; j < match.entities.length; j++) {
          var defender = match.entities[j];
          if (defender.ko || defender.id === attacker.id || attacker.specialVictims[defender.id]) continue;
          if (Math.abs(defender.x - hx) <= special.radius + defender.w * 0.5 &&
              Math.abs((defender.y - 8) - hy) <= special.radius + HEAD_OFFSET) {
            attacker.specialVictims[defender.id] = true;
            applySpecialHit(match, attacker, defender, special, dir);
          }
        }
      }
    }

    for (var k = match.projectiles.length - 1; k >= 0; k--) {
      var proj = match.projectiles[k];
      var hitSomething = false;
      for (var m = 0; m < match.entities.length; m++) {
        var target = match.entities[m];
        if (target.ko || target.id === proj.ownerId) continue;
        if (Math.abs(target.x - proj.x) <= proj.radius + target.w * 0.5 &&
            Math.abs((target.y - 8) - proj.y) <= proj.radius + HEAD_OFFSET) {
          if (target.specialActive && CHARACTERS[target.charId].special &&
              CHARACTERS[target.charId].special.type === 'margaritaville') {
            hitSomething = true;
            break;
          }
          applySpecialHit(match, null, target, proj, proj.vx < 0 ? -1 : 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) match.projectiles.splice(k, 1);
    }
  }

  function stepEntity(match, entity, input, dt) {
    var pressingLeft = input.left;
    var pressingRight = input.right;
    var jp = input.jumpPressed;
    var jh = input.jumpHeld;
    var dashPressed = input.dashPressed;
    var specialPressed = input.specialPressed;
    var specialHeld = input.specialHeld;

    if (entity.squashT > 0) {
      entity.squashT = Math.max(0, entity.squashT - dt);
      pressingLeft = false;
      pressingRight = false;
      jp = false;
      dashPressed = false;
      specialPressed = false;
      specialHeld = false;
      if (entity.onGround) entity.vx *= Math.pow(0.1, dt * 8);
    }

    if (dashPressed) {
      var dashDir = pressingLeft && !pressingRight ? -1
        : pressingRight && !pressingLeft ? 1
        : (entity.facing === 'left' ? -1 : 1);
      startDash(match, entity, dashDir);
    }

    var ch = CHARACTERS[entity.charId];
    var moveMul = (ch.moveMul != null) ? ch.moveMul : 1;
    var jumpMul = (ch.jumpMul != null) ? ch.jumpMul : 1;
    var dashMul = (ch.dashMul != null) ? ch.dashMul : 1;
    updateHeldSpecial(match, entity, specialHeld, specialPressed, dt);
    if (entity.specialActive && ch.special && ch.special.type === 'margaritaville') {
      pressingLeft = false;
      pressingRight = false;
      jp = false;
      dashPressed = false;
    }
    if (entity.specialActive && ch.special && ch.special.type === 'bulldogBounce') {
      pressingLeft = false;
      pressingRight = false;
      jp = false;
      dashPressed = false;
    }

    if (entity.dashT > 0) {
      entity.dashT = Math.max(0, entity.dashT - dt);
      entity.vx = entity.dashDir * DASH_VEL * dashMul;
    } else {
      var accel = (entity.onGround ? MOVE_ACCEL_GROUND : MOVE_ACCEL_AIR) * moveMul;
      if (pressingLeft && !pressingRight) {
        entity.vx -= accel * dt;
        entity.facing = 'left';
      }
      if (pressingRight && !pressingLeft) {
        entity.vx += accel * dt;
        entity.facing = 'right';
      }
      if (!pressingLeft && !pressingRight && entity.onGround && entity.squashT <= 0) {
        var dec = GROUND_FRIC * dt;
        if (entity.vx > 0) entity.vx = Math.max(0, entity.vx - dec);
        else if (entity.vx < 0) entity.vx = Math.min(0, entity.vx + dec);
      }
      var maxV = MOVE_MAX * moveMul;
      // Preserve externally applied launch momentum until friction/opposite input
      // bleeds it off; only cap deliberate self-propelled movement.
      if (entity.vx > maxV && pressingRight && !pressingLeft) entity.vx = maxV;
      if (entity.vx < -maxV && pressingLeft && !pressingRight) entity.vx = -maxV;
    }

    if (entity.dashCooldown > 0) entity.dashCooldown = Math.max(0, entity.dashCooldown - dt);
    if (entity.specialCooldown > 0) entity.specialCooldown = Math.max(0, entity.specialCooldown - dt);
    if (entity.specialT > 0) entity.specialT = Math.max(0, entity.specialT - dt);

    if (specialPressed) tryUseCharacterAbility(match, entity);

    if (jp && entity.onGround) {
      entity.vy = -JUMP_VEL * jumpMul;
      entity.onGround = false;
      emit(match, { type: 'jump', entityId: entity.id });
    }
    if (!jh && entity.vy < -JUMP_CUT * jumpMul) entity.vy = -JUMP_CUT * jumpMul;

    // Digory's bulldogBounce is a pure render effect — the sim keeps him
    // pinned to the floor so platform collision (which uses prevFootY) stays
    // correct.
    entity.vy += GRAVITY * dt;
    if (entity.vy > TERM_VEL) entity.vy = TERM_VEL;

    var prevFootY = entity.y + FEET_OFFSET;
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    var newFootY = entity.y + FEET_OFFSET;

    entity.onGround = false;
    if (entity.vy >= 0) {
      for (var i = 0; i < match.platforms.length; i++) {
        var p = match.platforms[i];
        var ex0 = entity.x - entity.w / 2, ex1 = entity.x + entity.w / 2;
        if (ex1 < p.x || ex0 > p.x + p.w) continue;
        if (prevFootY <= p.y + 1 && newFootY >= p.y) {
          entity.y = p.y - FEET_OFFSET;
          entity.vy = 0;
          entity.onGround = true;
          entity.specialUsed = false;
          if (ch.special && ch.special.type === 'airFlap') entity.specialActive = false;
          break;
        }
      }
    }

    if (entity.x < -60 || entity.x > W + 60 || entity.y > H + 120) {
      loseStockOrRespawn(match, entity, 'fall');
    }

    if (entity.onGround && Math.abs(entity.vx) > 20) entity.bob += dt * 10;
    else if (!entity.onGround) entity.bob += dt * 2;
    else entity.bob *= 0.88;

    if (entity.invulnFrames > 0) entity.invulnFrames--;
    entity.prevFootY = newFootY;
    entity.lastHitAge += dt;
  }

  function stepMatch(match, dt) {
    if (match.status !== 'play') return match;
    match.events.length = 0;
    if (match.respawnFlash > 0) match.respawnFlash = Math.max(0, match.respawnFlash - dt);

    var frameDt = Math.min(MAX_FRAME_DT, Math.max(0, dt));
    var inputs = new Array(match.entities.length);
    for (var i = 0; i < match.entities.length; i++) {
      inputs[i] = chooseInput(match, match.entities[i], frameDt);
    }

    var remaining = frameDt;
    while (remaining > 0 && match.status === 'play') {
      var dts = Math.min(FIXED_STEP, remaining);
      decayPairCooldowns(match, dts);
      for (var j = 0; j < match.entities.length; j++) {
        if (!match.entities[j].ko) stepEntity(match, match.entities[j], inputs[j], dts);
      }
      updateProjectiles(match, dts);
      resolveEntityPairs(match);
      resolveSpecials(match);
      remaining -= dts;
      match.time += dts;
      match.stepCount++;
      checkMatchEnd(match, 'last-entity');
    }
    return match;
  }

  function finishTimeout(match) {
    if (match.status !== 'play') return;
    var alive = getAliveEntities(match);
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < alive.length; i++) {
      var e = alive[i];
      var score = e.stocks * 1000 - e.damage;
      if (score > bestScore) {
        best = e;
        bestScore = score;
      }
    }
    match.status = 'results';
    match.resultReason = 'timeout';
    match.winnerId = best ? best.id : null;
    emit(match, { type: 'matchEnd', winnerId: match.winnerId, reason: 'timeout' });
  }

  function summarizeMatch(match) {
    var players = [];
    for (var i = 0; i < match.entities.length; i++) {
      var e = match.entities[i];
      players.push({
        id: e.id,
        charId: e.charId,
        name: CHARACTERS[e.charId].name,
        stocks: e.stocks,
        damage: e.damage,
        alive: !e.ko,
        stats: clone(e.stats)
      });
    }
    return {
      seed: match.seed,
      arenaSeed: match.arenaSeed,
      time: match.time,
      stepCount: match.stepCount,
      winnerId: match.winnerId,
      resultReason: match.resultReason,
      players: players
    };
  }

  function runMatch(config) {
    var cfg = config || {};
    var stepDt = cfg.stepDt != null ? cfg.stepDt : FIXED_STEP;
    var maxSteps = cfg.maxSteps != null ? cfg.maxSteps : 60 * 90;
    var match = createMatch(cfg);
    while (match.status === 'play' && match.stepCount < maxSteps) {
      stepMatch(match, stepDt);
    }
    if (match.status === 'play') finishTimeout(match);
    return {
      match: match,
      summary: summarizeMatch(match)
    };
  }

  return {
    constants: {
      W: W,
      H: H,
      START_STOCKS: START_STOCKS,
      FIXED_STEP: FIXED_STEP,
      SIDE_HIT_COOLDOWN: SIDE_HIT_COOLDOWN
    },
    CHARACTERS: CHARACTERS,
    CHAR_IDS: CHAR_IDS,
    HEURISTIC_DEFAULTS: HEURISTIC_DEFAULTS,
    EASY_MODE_GENOME: EASY_MODE_GENOME,
    MEDIUM_MODE_GENOME: MEDIUM_MODE_GENOME,
    HARD_MODE_GENOME: HARD_MODE_GENOME,
    seededRng: seededRng,
    makeArena: makeArena,
    damageMass: damageMass,
    sideExitDamage: sideExitDamage,
    normalizeGenome: normalizeGenome,
    randomGenome: randomGenome,
    mutateGenome: mutateGenome,
    crossoverGenomes: crossoverGenomes,
    neutralInput: neutralInput,
    createMatch: createMatch,
    stepMatch: stepMatch,
    summarizeMatch: summarizeMatch,
    runMatch: runMatch
  };
}));
