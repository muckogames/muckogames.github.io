/* mucko-grid.js — shared Pokémon-style discrete grid movement
 *
 * Drop this file in via <script src="../mucko-grid.js"></script> and use it
 * from any overhead game. Each game keeps its own tile system and blocking
 * rules; this just owns the state machine + lerp + bump-on-wall feel.
 *
 * Typical usage:
 *
 *   // On phase enter (snap to a tile center):
 *   MuckoGrid.init(player, startCol, startRow, TILE);
 *
 *   // Each frame:
 *   var dir = MuckoGrid.readDir(K, touchDirs); // 'up'|'down'|'left'|'right'|null
 *   var moving = MuckoGrid.update(player, dt, dir, sprintHeld,
 *                                 function(col,row){ return isBlocked(col,row); },
 *                                 TILE);
 *   MuckoGrid.applyBumpRender(player, TILE);
 *
 *   // Then draw the player at (player.x, player.y) — already lerped/nudged.
 *   //  player.facing is 'up'|'down'|'left'|'right'.
 *   //  player.gridCol / player.gridRow are the LOGICAL position
 *   //  (the destination during a lerp; updated at end of step).
 *
 * Default constants (tweak per-game via the optional opts arg):
 *   WALK_DUR       0.18 s per tile
 *   SPRINT_DUR     0.10 s per tile
 *   TURN_TAP_DELAY 0.075 s — hold a direction less than this to only turn
 *   BUMP_DUR       0.16 s — bump-against-wall animation length
 *   BUMP_PX        6      — peak bump nudge in pixels
 *
 * iOS-12 / Safari-12 safe (var, no optional chaining, no class fields).
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var DEFAULTS = {
    walkDur: 0.18,
    sprintDur: 0.10,
    turnTapDelay: 0.075,
    bumpDur: 0.16,
    bumpPx: 6,
    allowDiagonals: false,
    // When false (default), a diagonal step is refused if either of the two
    // cardinal tiles flanking the corner is blocked — i.e. you can't squeeze
    // past a wall corner. Roguelike-strict.
    allowCornerCutting: false
  };

  // Direction encoding: dc/dr offsets, dominant axis for 4-dir sprite facing,
  // and a diag flag so step duration knows to multiply by √2.
  var DIR_VECTORS = {
    up:        { dc:  0, dr: -1, facing: 'up',    diag: false },
    down:      { dc:  0, dr:  1, facing: 'down',  diag: false },
    left:      { dc: -1, dr:  0, facing: 'left',  diag: false },
    right:     { dc:  1, dr:  0, facing: 'right', diag: false },
    upLeft:    { dc: -1, dr: -1, facing: 'up',    diag: true  },
    upRight:   { dc:  1, dr: -1, facing: 'up',    diag: true  },
    downLeft:  { dc: -1, dr:  1, facing: 'down',  diag: true  },
    downRight: { dc:  1, dr:  1, facing: 'down',  diag: true  }
  };

  function getOpt(opts, key) {
    if (opts && opts[key] != null) return opts[key];
    return DEFAULTS[key];
  }

  // originX/Y are an optional pixel offset so games whose tile grid doesn't
  // start at (0,0) (e.g. The Don's Tower heist with H_ROOM_Y=40) can keep
  // using tile coordinates and have the helper handle the pixel translation.
  function init(p, col, row, tile, originX, originY) {
    p.gridCol = col;
    p.gridRow = row;
    p.gridOriginX = originX || 0;
    p.gridOriginY = originY || 0;
    p.x = p.gridOriginX + col * tile + tile / 2;
    p.y = p.gridOriginY + row * tile + tile / 2;
    p.gridMoving = false;
    p.moveT = 0;
    p.moveDur = 0;
    p.fromX = p.x; p.fromY = p.y;
    p.toX   = p.x; p.toY   = p.y;
    p.targetCol = col; p.targetRow = row;
    p.inputDir = null; p.inputT = 0;
    p.bumpT = 0; p.bumpDir = 'down';
    if (!p.facing) p.facing = 'down';
  }

  function tryStartStep(p, dir, sprint, isBlocked, tile, opts) {
    var v = DIR_VECTORS[dir];
    if (!v) return false;
    p.facing = v.facing;
    var nc = p.gridCol + v.dc, nr = p.gridRow + v.dr;
    // Diagonal corner-cutting check: by default a diagonal step requires
    // BOTH flanking cardinal tiles to be open (NetHack-strict). Set
    // allowCornerCutting:true to let the player squeeze past a wall corner.
    if (v.diag && !getOpt(opts, 'allowCornerCutting')) {
      if (isBlocked(p.gridCol + v.dc, p.gridRow) ||
          isBlocked(p.gridCol,        p.gridRow + v.dr)) {
        p.bumpT = getOpt(opts, 'bumpDur');
        p.bumpDir = v.facing;
        return false;
      }
    }
    if (isBlocked(nc, nr)) {
      p.bumpT = getOpt(opts, 'bumpDur');
      p.bumpDir = v.facing;
      return false;
    }
    p.targetCol = nc; p.targetRow = nr;
    var ox = p.gridOriginX || 0, oy = p.gridOriginY || 0;
    p.fromX = ox + p.gridCol * tile + tile / 2;
    p.fromY = oy + p.gridRow * tile + tile / 2;
    p.toX   = ox + nc * tile + tile / 2;
    p.toY   = oy + nr * tile + tile / 2;
    var baseDur = sprint ? getOpt(opts, 'sprintDur') : getOpt(opts, 'walkDur');
    // Diagonal traverses √2 tile-widths in pixel space — same per-pixel pace
    // as a cardinal step, so the lerp duration grows by √2 too.
    p.moveDur = v.diag ? baseDur * Math.SQRT2 : baseDur;
    p.moveT = 0;
    p.gridMoving = true;
    p.sprinting = !!sprint;
    p.lastDir = dir;
    return true;
  }

  // Returns true if a step is in progress this frame (use it for noise/SFX
  // gating — "true" means the player is mid-tile-transition right now).
  function update(p, dt, dir, sprint, isBlocked, tile, opts) {
    if (p.bumpT > 0) p.bumpT = Math.max(0, p.bumpT - dt);

    if (p.gridMoving) {
      p.moveT += dt;
      var t = p.moveT / p.moveDur;
      if (t >= 1) {
        p.gridCol = p.targetCol;
        p.gridRow = p.targetRow;
        p.x = p.toX; p.y = p.toY;
        p.gridMoving = false;
        // Chain into the next step at end-of-step input sample
        if (dir) tryStartStep(p, dir, sprint, isBlocked, tile, opts);
      } else {
        p.x = p.fromX + (p.toX - p.fromX) * t;
        p.y = p.fromY + (p.toY - p.fromY) * t;
      }
      return true;
    }

    if (dir) {
      if (p.inputDir === dir) {
        p.inputT += dt;
      } else {
        p.inputDir = dir;
        p.inputT = dt;
        p.facing = dir; // immediate face turn for feedback
      }
      if (p.inputT >= getOpt(opts, 'turnTapDelay')) {
        // Don't re-bump every frame against a wall — wait for the previous
        // bump to finish before trying again.
        if (p.bumpT <= 0) tryStartStep(p, dir, sprint, isBlocked, tile, opts);
        return p.gridMoving;
      }
    } else {
      p.inputDir = null;
      p.inputT = 0;
    }
    return false;
  }

  // Nudges the rendered position toward the bumped direction (logical
  // position stays at the tile center). Call after update() each frame.
  function applyBumpRender(p, tile, opts) {
    if (p.bumpT <= 0) return;
    var bumpDur = getOpt(opts, 'bumpDur');
    var bumpPx  = getOpt(opts, 'bumpPx');
    var bt = 1 - (p.bumpT / bumpDur);
    var nudge = Math.sin(bt * Math.PI) * bumpPx;
    var dc = p.bumpDir === 'left' ? -1 : p.bumpDir === 'right' ? 1 : 0;
    var dr = p.bumpDir === 'up'   ? -1 : p.bumpDir === 'down'  ? 1 : 0;
    var ox = p.gridOriginX || 0, oy = p.gridOriginY || 0;
    p.x = ox + p.gridCol * tile + tile / 2 + dc * nudge;
    p.y = oy + p.gridRow * tile + tile / 2 + dr * nudge;
  }

  // Read input as a direction. By default 4-direction (no diagonals;
  // vertical wins on ties). Pass { allowDiagonals: true } in opts to get the
  // 8-direction set ('upLeft', 'upRight', 'downLeft', 'downRight' added).
  // K is the game's K[] dict; touch is an optional dict like
  // { up, down, left, right } with truthy values when held.
  function readDir(K, touch, opts) {
    touch = touch || {};
    var u = (K && (K.ArrowUp    || K.KeyW)) || touch.up;
    var d = (K && (K.ArrowDown  || K.KeyS)) || touch.down;
    var l = (K && (K.ArrowLeft  || K.KeyA)) || touch.left;
    var r = (K && (K.ArrowRight || K.KeyD)) || touch.right;
    if (opts && opts.allowDiagonals) {
      var v = u && !d ? -1 : (d && !u ? 1 : 0);
      var h = l && !r ? -1 : (r && !l ? 1 : 0);
      if (v ===  0 && h ===  0) return null;
      if (v === -1 && h === -1) return 'upLeft';
      if (v === -1 && h ===  1) return 'upRight';
      if (v ===  1 && h === -1) return 'downLeft';
      if (v ===  1 && h ===  1) return 'downRight';
      if (v === -1) return 'up';
      if (v ===  1) return 'down';
      if (h === -1) return 'left';
      if (h ===  1) return 'right';
      return null;
    }
    if (u && !d) return 'up';
    if (d && !u) return 'down';
    if (l && !r) return 'left';
    if (r && !l) return 'right';
    return null;
  }

  // Convert 'up'|'down'|'left'|'right' to a number (0..3) for games that
  // store facing as an index (Samster, Hippo).
  var DIR_NUMS = { up: 0, down: 1, left: 2, right: 3 };
  function dirToNum(dir) {
    return DIR_NUMS[dir] != null ? DIR_NUMS[dir] : 1;
  }

  window.MuckoGrid = {
    init: init,
    update: update,
    // Force a step in `dir` immediately (skips the turn-tap delay). Use this
    // for tile effects like conveyors and ice slides — call only when the
    // player is idle (not p.gridMoving) and not bumping.
    startStep: tryStartStep,
    applyBumpRender: applyBumpRender,
    readDir: readDir,
    dirToNum: dirToNum,
    DEFAULTS: DEFAULTS
  };
})();
