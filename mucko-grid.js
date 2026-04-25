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
    bumpPx: 6
  };

  function getOpt(opts, key) {
    if (opts && opts[key] != null) return opts[key];
    return DEFAULTS[key];
  }

  function init(p, col, row, tile) {
    p.gridCol = col;
    p.gridRow = row;
    p.x = col * tile + tile / 2;
    p.y = row * tile + tile / 2;
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
    p.facing = dir;
    var dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    var dr = dir === 'up'   ? -1 : dir === 'down'  ? 1 : 0;
    var nc = p.gridCol + dc, nr = p.gridRow + dr;
    if (isBlocked(nc, nr)) {
      p.bumpT = getOpt(opts, 'bumpDur');
      p.bumpDir = dir;
      return false;
    }
    p.targetCol = nc; p.targetRow = nr;
    p.fromX = p.gridCol * tile + tile / 2;
    p.fromY = p.gridRow * tile + tile / 2;
    p.toX   = nc * tile + tile / 2;
    p.toY   = nr * tile + tile / 2;
    p.moveDur = sprint ? getOpt(opts, 'sprintDur') : getOpt(opts, 'walkDur');
    p.moveT = 0;
    p.gridMoving = true;
    p.sprinting = !!sprint;
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
    p.x = p.gridCol * tile + tile / 2 + dc * nudge;
    p.y = p.gridRow * tile + tile / 2 + dr * nudge;
  }

  // 4-direction input read with vertical-wins-on-ties (no diagonals).
  // Pass in the game's K[] dict; touch is an optional dict like
  // { up, down, left, right } with truthy values when held.
  function readDir(K, touch) {
    touch = touch || {};
    var u = (K && (K.ArrowUp    || K.KeyW)) || touch.up;
    var d = (K && (K.ArrowDown  || K.KeyS)) || touch.down;
    var l = (K && (K.ArrowLeft  || K.KeyA)) || touch.left;
    var r = (K && (K.ArrowRight || K.KeyD)) || touch.right;
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
    applyBumpRender: applyBumpRender,
    readDir: readDir,
    dirToNum: dirToNum,
    DEFAULTS: DEFAULTS
  };
})();
