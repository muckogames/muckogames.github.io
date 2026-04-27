/* mucko-npcs.js — shared overhead-style NPC sprites for The Don's Tower.
 *
 * Each draw* function takes (ctx, x, y, ...) — pass any 2D context, draw an
 * NPC centered at (x, y). The ported sprite implementations come from the
 * original games and are dependency-free here (helpers + C palette inlined).
 *
 *   MuckoSprites.drawSamster(ctx, x, y, dir, t)
 *   MuckoSprites.drawPflueger(ctx, x, y, dir, t, hasSandwich, moving)
 *   MuckoSprites.drawMom(ctx, x, y, angle, t)
 *   MuckoSprites.drawDuckDieb(ctx, x, y, facing)
 *   MuckoSprites.drawDigoryTD(ctx, x, y, t)
 *
 * dir is 0..3 (0=up,1=down,2=left,3=right) for Samster/Pflueger; 'up'/...
 * for Duck Dieb. angle is radians for Mom (her vision cone rotates with it).
 *
 * After load, this file auto-binds its sprites into window.MUCKO_NPCS using
 * the canvas with id="gc" (the in-game canvas), so The Don's Tower picks
 * them up automatically. The level editor imports MuckoSprites and binds
 * to its own canvas instead.
 *
 * iOS-12 / Safari-12 safe (var, no optional chaining, no nullish coalescing).
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;

  // Helpers reference a thread-local context set at the top of each public
  // draw entry. JS is single-threaded so this is safe.
  var __ctx;
  function ell(x, y, rx, ry, c, rot) {
    __ctx.fillStyle = c; __ctx.beginPath();
    __ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); __ctx.fill();
  }
  function strokeEll(x, y, rx, ry, c, w, rot) {
    __ctx.strokeStyle = c; __ctx.lineWidth = w || 1;
    __ctx.beginPath();
    __ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU); __ctx.stroke();
  }
  function cir(x, y, r, c) {
    __ctx.fillStyle = c; __ctx.beginPath();
    __ctx.arc(x, y, r, 0, TAU); __ctx.fill();
  }
  function strokeCir(x, y, r, c, w) {
    __ctx.strokeStyle = c; __ctx.lineWidth = w || 1;
    __ctx.beginPath(); __ctx.arc(x, y, r, 0, TAU); __ctx.stroke();
  }
  function ln(x1, y1, x2, y2, c, w) {
    __ctx.strokeStyle = c; __ctx.lineWidth = w || 1;
    __ctx.beginPath(); __ctx.moveTo(x1, y1); __ctx.lineTo(x2, y2); __ctx.stroke();
  }
  function fillR(x, y, w, h, c) {
    __ctx.fillStyle = c; __ctx.fillRect(x, y, w, h);
  }
  function rnd(x, y, w, h, r, fill, stroke, sw) {
    __ctx.beginPath();
    if (typeof __ctx.roundRect === 'function') __ctx.roundRect(x, y, w, h, r || 0);
    else {
      var rr = Math.min(r || 0, w / 2, h / 2);
      __ctx.moveTo(x + rr, y); __ctx.lineTo(x + w - rr, y);
      __ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      __ctx.lineTo(x + w, y + h - rr);
      __ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      __ctx.lineTo(x + rr, y + h);
      __ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      __ctx.lineTo(x, y + rr);
      __ctx.quadraticCurveTo(x, y, x + rr, y);
      __ctx.closePath();
    }
    if (fill) { __ctx.fillStyle = fill; __ctx.fill(); }
    if (stroke) { __ctx.strokeStyle = stroke; __ctx.lineWidth = sw || 1; __ctx.stroke(); }
  }
  function topLeftLight(x, y, rx, ry, alpha) {
    __ctx.save();
    __ctx.fillStyle = 'rgba(255,255,255,' + (alpha == null ? 0.16 : alpha) + ')';
    __ctx.beginPath();
    __ctx.ellipse(x - rx * 0.28, y - ry * 0.38, rx * 0.55, ry * 0.45, -0.35, 0, TAU);
    __ctx.fill(); __ctx.restore();
  }
  function walkStride4(anim, speed, moving) {
    if (!moving) return [0, 0, 0];
    var ph = Math.floor(((anim * (speed || 0.12)) % 4 + 4) % 4);
    var lift = [0, 0, 2.4, 0.7];
    return [lift[ph], lift[(ph + 2) % 4], [0.2, 1.1, 0.2, 1.1][ph]];
  }

  // Palette — a merged subset of the source games' color constants.
  var C = {
    ink:        '#1a1a22',
    hamBrown:   '#a87a3e',
    hamBelly:   '#e6c490',
    hamLight:   '#cda472',
    pflShirt:   '#9b8b6f',
    pflOrange:  '#c08252',
    pflBlue:    '#4d5d7a',
    pflHair:    '#3a2614',
    scarf:      '#c0352e',
    skinMd:     '#e8c298',
    momShirt:   '#b06a4a',
    momHair:    '#3a2818',
    tan:        '#e6c298'
  };

  // ── Samster (hamster, top-down) ──────────────────────────────────────────
  // dir: 0=up,1=down,2=left,3=right (mostly aesthetic — mask flips based on dir)
  function drawSamster(ctx, x, y, dir, t) {
    __ctx = ctx;
    dir = dir || 0; t = t || 0;
    var bob = Math.sin(t * 6) * 1.5;
    ctx.save(); ctx.translate(x, y);
    ell(0, 18, 14, 4, 'rgba(0,0,0,0.18)');
    ell(0, 4 + bob, 16, 13, C.hamBrown);
    strokeEll(0, 4 + bob, 16, 13, C.ink, 2);
    ell(0, 8 + bob, 10, 8, C.hamBelly);
    cir(0, -12 + bob, 11, C.hamBrown);
    strokeCir(0, -12 + bob, 11, C.ink, 2);
    ell(-8, -20 + bob, 4, 5, C.hamLight, -0.3);
    strokeEll(-8, -20 + bob, 4, 5, C.ink, 1.5, -0.3);
    ell( 8, -20 + bob, 4, 5, C.hamLight,  0.3);
    strokeEll( 8, -20 + bob, 4, 5, C.ink, 1.5,  0.3);
    ell(-8, -20 + bob, 2.5, 3, C.hamBrown, -0.3);
    ell( 8, -20 + bob, 2.5, 3, C.hamBrown,  0.3);
    ell(-8, -8 + bob, 5, 4, '#f0d0a0');
    ell( 8, -8 + bob, 5, 4, '#f0d0a0');
    cir(-4, -13 + bob, 2, C.ink);
    cir( 4, -13 + bob, 2, C.ink);
    cir(-3.4, -13.6 + bob, 0.6, '#fff');
    cir( 4.6, -13.6 + bob, 0.6, '#fff');
    ell(0, -9 + bob, 2, 1.5, '#ffaaaa');
    ln(-7, -9 + bob, -16, -11 + bob, '#c0a080', 0.8);
    ln(-7, -8 + bob, -16,  -7 + bob, '#c0a080', 0.8);
    ln( 7, -9 + bob,  16, -11 + bob, '#c0a080', 0.8);
    ln( 7, -8 + bob,  16,  -7 + bob, '#c0a080', 0.8);
    ctx.save(); ctx.globalAlpha = 0.7;
    rnd(-8, -16 + bob, 16, 6, 3, '#222');
    ctx.restore();
    ell(-7, 16 + bob, 4, 2.5, C.hamLight);
    ell( 7, 16 + bob, 4, 2.5, C.hamLight);
    ctx.save(); ctx.translate(10, 2 + bob); ctx.rotate(0.2);
    rnd(-5, -6, 10, 12, 3, '#555', '#888', 1);
    ln(0, -6, 0, -10, '#888', 1.5);
    ctx.restore();
    ctx.restore();
  }

  // ── Pflueger (top-down adult human) ──────────────────────────────────────
  // dir: 0=up,1=down,2=left,3=right
  function drawPflueger(ctx, x, y, dir, t, hasSandwich, moving) {
    __ctx = ctx;
    dir = dir || 0; t = t || 0;
    var anim = t * 60;
    var stride = walkStride4(anim, 0.16, moving !== false);
    var leftLeg = -stride[0], rightLeg = -stride[1], bounce = stride[2];
    ctx.save(); ctx.translate(x, y);
    ell(0, 10, 13, 5, 'rgba(0,0,0,0.18)');
    rnd(-10, -3 + bounce, 20, 17, 7, C.pflShirt, C.ink, 2);
    fillR(-10, 1 + bounce, 20, 3, C.pflOrange);
    fillR(-10, 6 + bounce, 20, 3, C.pflOrange);
    topLeftLight(0, 5 + bounce, 10, 8, 0.16);
    ctx.save();
    ctx.fillStyle = C.scarf; ctx.beginPath();
    ctx.moveTo(-4, -2 + bounce);
    ctx.quadraticCurveTo(-9, 3 + bounce, -6, 9 + bounce);
    ctx.quadraticCurveTo(-3, 4 + bounce, -1, -1 + bounce);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    ln(-5, 10 + bounce, -5, 18 + bounce + leftLeg,  C.pflBlue, 4);
    ln( 5, 10 + bounce,  5, 18 + bounce + rightLeg, C.pflBlue, 4);
    ell(-5, 18 + bounce + leftLeg,  5, 2.5, '#8b653f');
    ell( 5, 18 + bounce + rightLeg, 5, 2.5, '#8b653f');
    var ha = [[0, -14], [0, 13], [-14, 0], [14, 0]];
    var ho = ha[dir] || ha[0], hx = ho[0], hy = ho[1];
    cir(hx, hy, 8, C.skinMd);
    strokeCir(hx, hy, 8, C.ink, 2);
    topLeftLight(hx, hy, 8, 8, 0.16);
    ell(hx, hy - 4, 8, 5, C.pflHair);
    strokeEll(hx, hy - 4, 8, 5, C.ink, 2);
    if (dir === 1) { cir(hx - 2, hy + 1, 1.2, C.ink); cir(hx + 2, hy + 1, 1.2, C.ink); }
    else if (dir === 2 || dir === 3) { cir(hx + (dir === 2 ? -1 : 1), hy, 1.2, C.ink); }
    if (hasSandwich) {
      var soff = [[0, -24], [0, 20], [-22, 0], [22, 0]];
      var so = soff[dir] || soff[0], sx = so[0], sy = so[1];
      rnd(sx - 8, sy - 5, 16, 10, 2, '#f5deb3', '#c8a040', 1.5);
      fillR(sx - 8, sy - 2, 16, 4, '#7ab34f');
    }
    ctx.restore();
  }

  // ── Mom (top-down human with vision cone) ────────────────────────────────
  // angle: radians (where she's facing)
  function drawMom(ctx, x, y, angle, t) {
    __ctx = ctx;
    angle = angle || 0; t = t || 0;
    ctx.save(); ctx.translate(x, y);
    // Vision cone (uses a fixed reach since we have no diff/suspicion here)
    var vis = 110;
    var fl = 1;
    var vg = ctx.createRadialGradient(0, 0, 4, 0, 0, vis);
    vg.addColorStop(0,    'rgba(255,170,90,' + (0.33 * fl) + ')');
    vg.addColorStop(0.55, 'rgba(255,150,70,' + (0.18 * fl) + ')');
    vg.addColorStop(1,    'rgba(255,120,50,0)');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, vis, -Math.PI / 2.5 + angle, Math.PI / 2.5 + angle);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,140,' + (0.4 * fl) + ')';
    ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(Math.cos(-Math.PI / 2.5 + angle) * vis, Math.sin(-Math.PI / 2.5 + angle) * vis);
    ctx.lineTo(0, 0);
    ctx.lineTo(Math.cos( Math.PI / 2.5 + angle) * vis, Math.sin( Math.PI / 2.5 + angle) * vis);
    ctx.stroke();
    // Body
    ell(0, 8, 11, 4, 'rgba(0,0,0,0.2)');
    rnd(-8, -4, 16, 18, 7, C.momShirt, C.ink, 2);
    rnd(-4, 0, 8, 10, 4, '#efe8d5', C.ink, 1.4);
    ln(-4, 11, -4, 18, '#8a7158', 3.2);
    ln( 4, 11,  4, 18, '#8a7158', 3.2);
    cir(0, -12, 6, C.tan);
    strokeCir(0, -12, 6, C.ink, 2);
    ell(0, -16, 8, 5, C.momHair);
    strokeEll(0, -16, 8, 5, C.ink, 2);
    cir(0, -19, 4, C.momHair);
    strokeCir(0, -19, 4, C.ink, 1.5);
    ctx.restore();
  }

  // ── Duck Dieb (top-down mallard thief) ───────────────────────────────────
  // facing: 'up'|'down'|'left'|'right'
  function drawDuckDieb(ctx, x, y, facing) {
    __ctx = ctx;
    facing = facing || 'down';
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = 0.18; ell(3, 6, 14, 8, '#000'); ctx.globalAlpha = 1;
    ell(0, 2, 13, 9, '#8b6030');
    ell(0, 3, 10, 6, '#7a5020');
    var hx = 0, hy = 0;
    if (facing === 'up')        hy = -14;
    else if (facing === 'down') hy =  14;
    else if (facing === 'left') hx = -14;
    else                        hx =  14;
    cir(hx, hy, 8, '#2a7a38');
    ctx.fillStyle = 'rgba(0,200,160,0.28)';
    ctx.beginPath(); ctx.arc(hx - 2, hy - 2, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(hx - 7, hy - 5, 14, 5);
    cir(hx - 3, hy - 2, 1.5, '#fff');
    cir(hx + 3, hy - 2, 1.5, '#fff');
    ctx.fillStyle = '#e8b800';
    if (facing === 'up') {
      ctx.beginPath(); ctx.ellipse(hx, hy - 10, 3, 4, 0, 0, TAU); ctx.fill();
    } else if (facing === 'down') {
      ctx.beginPath(); ctx.ellipse(hx, hy + 10, 3, 4, 0, 0, TAU); ctx.fill();
    } else if (facing === 'left') {
      ctx.beginPath(); ctx.ellipse(hx - 10, hy, 4, 3, 0, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(hx + 10, hy, 4, 3, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Digory (top-down terrier — Hippo's TD variant, more detailed) ────────
  function drawDigoryTD(ctx, x, y, t) {
    __ctx = ctx;
    ctx.save(); ctx.translate(x, y);
    var white = '#f7f5f0', black = '#17181c', tan = '#b8845f', tan2 = '#d1a17a';
    ell(0, 7, 12.2, 4.2, 'rgba(0,0,0,0.16)');
    ln(-5.5, 7.1, -5.9, 15.4, white, 3);
    ln(-1.6, 7.8, -1.1, 16, white, 2.8);
    ln( 2.9, 7.7,  2.6, 15.9, white, 2.8);
    ln( 6.4, 6.7,  7.1, 14.9, white, 2.8);
    ell(0, 1.8, 13.4, 8.6, white); strokeEll(0, 1.8, 13.4, 8.6, C.ink, 2);
    ell( 0.9, -0.6, 6.6, 4.3, black);
    ell( 6.1,  1.2, 3.2, 4.5, black);
    ell( 4.1,  0.4, 1.3, 1.3, white);
    ell(-6.8,  1.7, 1.85, 2.6, black);
    cir(2.15, 4.35, 1.18, black);
    ell(0, 4.9, 8, 2.8, white);
    ell(0, -11.2, 6.4, 6, black); strokeEll(0, -11.2, 6.4, 6, C.ink, 2);
    ell(-5.7, -11.2, 1.65, 3.8, black, -0.92); strokeEll(-5.7, -11.2, 1.65, 3.8, C.ink, 1, -0.92);
    ell( 5.7, -11.2, 1.65, 3.8, black,  0.92); strokeEll( 5.7, -11.2, 1.65, 3.8, C.ink, 1,  0.92);
    ell(0, -7.9, 4.35, 3.05, tan2); strokeEll(0, -7.9, 4.35, 3.05, C.ink, 1);
    ell(-1.5, -8.5, 1.35, 2, tan); ell(1.5, -8.5, 1.35, 2, tan);
    ell(0, -5.5, 2.1, 1.6, '#f0e6db');
    cir(-1.75, -12, 0.72, black); cir(1.75, -12, 0.72, black);
    cir(-1.5, -12.25, 0.18, '#f7f2eb'); cir(2, -12.25, 0.18, '#f7f2eb');
    cir(0, -7.2, 0.8, black);
    ctx.save();
    ctx.translate(11.7, 1.1);
    ctx.rotate(Math.sin(t * 0.12) * 0.2);
    ln(0, 0, 5.6, -4.2, black, 2.2);
    ln(5.6, -4.2, 8.2, -6.3, white, 1.9);
    ctx.restore();
    ctx.restore();
  }

  // ── Public API + auto-bind ───────────────────────────────────────────────
  window.MuckoSprites = {
    drawSamster:   drawSamster,
    drawPflueger:  drawPflueger,
    drawMom:       drawMom,
    drawDuckDieb:  drawDuckDieb,
    drawDigoryTD:  drawDigoryTD,
    // Bind into a MUCKO_NPCS-shape table with a closure-bound ctx. Both
    // The Don's Tower and the editor call this with their own canvas.
    bindToTable: function (ctx, table) {
      table.samster = {
        label: 'Samster',
        draw: function (x, y, dir, t) {
          var d = (dir === 'up' ? 0 : dir === 'down' ? 1 : dir === 'left' ? 2 : dir === 'right' ? 3 : (dir | 0));
          drawSamster(ctx, x, y, d, t);
        }
      };
      table.pflueger = {
        label: 'Pflueger',
        draw: function (x, y, dir, t, n) {
          var d = (dir === 'up' ? 0 : dir === 'down' ? 1 : dir === 'left' ? 2 : dir === 'right' ? 3 : (dir | 0));
          drawPflueger(ctx, x, y, d, t, !!(n && n.hasSandwich), true);
        }
      };
      table.mom = {
        label: 'Mom',
        draw: function (x, y, dir, t) {
          var ang = dir === 'up' ? -Math.PI / 2 : dir === 'left' ? Math.PI : dir === 'right' ? 0 : Math.PI / 2;
          drawMom(ctx, x, y, ang, t);
        }
      };
      table.duckdieb = {
        label: 'Duck Dieb',
        draw: function (x, y, dir) { drawDuckDieb(ctx, x, y, dir || 'down'); }
      };
      table.digoryTD = {
        label: 'Digory (top-down)',
        draw: function (x, y, dir, t) { drawDigoryTD(ctx, x, y, t); }
      };
    }
  };

  // Auto-bind into The Don's Tower's NPC table when loaded into don/index.html.
  // The editor loads this same file with a different canvas id and binds
  // manually to its own context.
  if (typeof window.MUCKO_NPCS === 'object' && document.getElementById('gc')) {
    var c = document.getElementById('gc').getContext('2d');
    window.MuckoSprites.bindToTable(c, window.MUCKO_NPCS);
  }
})();
