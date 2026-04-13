/**
 * mucko-engine.js — Shared game engine library for Mucko Games
 * Under 200 lines. A library — you call it, it doesn't call you.
 *
 * Usage:
 *   <script src="../mucko-engine.js"></script>
 *
 * Then call MuckoEngine.init(canvas, width, height) to set up.
 * All helpers are also available as globals after calling exposeGlobals().
 */

(function(global) {
'use strict';

/* ── CANVAS SETUP ─────────────────────────────────────────────────────────── */
function initCanvas(canvasEl, W, H) {
  const stage = canvasEl.parentElement;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width  = W * DPR;
  canvasEl.height = H * DPR;
  canvasEl.style.width  = W + 'px';
  canvasEl.style.height = H + 'px';
  const ctx = canvasEl.getContext('2d');
  ctx.scale(DPR, DPR);

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = 'scale(' + s + ')';
    stage.style.transformOrigin = 'top center';
    stage.style.width  = W + 'px';
    stage.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
  return ctx;
}

/* ── INPUT ───────────────────────────────────────────────────────────────── */
function makeInput() {
  const K = {};   // held keys
  const JP = {};  // just-pressed (consumed by eat())
  document.addEventListener('keydown', function(e) {
    if (!K[e.code]) JP[e.code] = true;
    K[e.code] = true;
  });
  document.addEventListener('keyup', function(e) {
    K[e.code] = false;
  });
  function eat(code) {
    if (JP[code]) { JP[code] = false; return true; }
    return false;
  }
  function held(code) { return !!K[code]; }
  return { K, JP, eat, held };
}

/* ── AUDIO (Web Audio API) ──────────────────────────────────────────────── */
function makeAudio() {
  var actx = null;
  function ctx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return actx;
  }
  function beep(freq, vol, dur, type) {
    try {
      var c = ctx(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (dur || 0.2));
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime); o.stop(c.currentTime + (dur || 0.2));
    } catch(e) {}
  }
  function chime() {
    [523, 659, 784, 1047].forEach(function(f, i) {
      setTimeout(function() { beep(f, 0.18, 0.22); }, i * 110);
    });
  }
  function boom(vol, dur) {
    try {
      var c = ctx(); if (!c) return;
      var buf = c.createBuffer(1, Math.ceil(c.sampleRate * (dur || 0.3)), c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      var src = c.createBufferSource(), g = c.createGain();
      g.gain.value = vol || 0.4;
      src.buffer = buf; src.connect(g); g.connect(c.destination); src.start();
    } catch(e) {}
  }
  return { beep, chime, boom };
}

/* ── PERSISTENCE (localStorage) ────────────────────────────────────────── */
function makeStore(key) {
  function get() {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; }
  }
  function save(entry) {
    var list = [...get(), entry].sort(function(a, b) { return b.score - a.score; }).slice(0, 10);
    try { localStorage.setItem(key, JSON.stringify(list)); } catch(e) {}
    return list;
  }
  function clear() { try { localStorage.removeItem(key); } catch(e) {} }
  return { get, save, clear };
}

/* ── PHASE STATE MACHINE ────────────────────────────────────────────────── */
function makeLoop(updateFn, drawFn, targetFps) {
  var lastTs = 0;
  var fps = targetFps || 60;
  var minFrameMs = 1000 / fps;
  function tick(ts) {
    requestAnimationFrame(tick);
    if (ts - lastTs < minFrameMs) return;
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    updateFn(dt);
    drawFn();
  }
  requestAnimationFrame(tick);
}

/* ── CANVAS DRAWING HELPERS ─────────────────────────────────────────────── */
function makeDrawHelpers(ctx) {
  const TAU = Math.PI * 2;
  function rnd(x, y, w, h, r, fill, stroke, sw) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r || 0);
    } else {
      var rr = Math.min(r || 0, w / 2, h / 2);
      ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
      ctx.arcTo(x + w, y, x + w, y + rr, rr); ctx.lineTo(x + w, y + h - rr);
      ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr); ctx.lineTo(x + rr, y + h);
      ctx.arcTo(x, y + h, x, y + h - rr, rr); ctx.lineTo(x, y + rr);
      ctx.arcTo(x, y, x + rr, y, rr); ctx.closePath();
    }
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 2; ctx.stroke(); }
  }
  function txt(s, x, y, col, size, align, font) {
    ctx.fillStyle = col || '#fff';
    ctx.font = (font || ('bold ' + (size || 14) + 'px Georgia,serif'));
    if (size && !/px/.test(font || '')) ctx.font = (font ? font.replace(/\d+px/, size + 'px') : (size + 'px Georgia,serif'));
    ctx.textAlign = align || 'left';
    ctx.fillText(s, x, y);
  }
  function ln(x1, y1, x2, y2, col, w) {
    ctx.strokeStyle = col || '#fff'; ctx.lineWidth = w || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circ(x, y, r, fill, stroke, sw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 2; ctx.stroke(); }
  }
  return { rnd, txt, ln, circ };
}

/* ── TOUCH DETECTION ────────────────────────────────────────────────────── */
var TOUCH_UI = (function() {
  try { document.createEvent('TouchEvent'); return true; } catch(e) { return false; }
})() || navigator.maxTouchPoints > 0;

/* ── DIALOG RENDERER ────────────────────────────────────────────────────── */
// Renders a dialog box on a canvas context.
// opts: { x, y, w, h, speaker, text, color, fontSize }
function renderDialog(ctx, opts) {
  var x = opts.x || 40, y = opts.y || 300, w = opts.w || 640, h = opts.h || 100;
  var col = opts.color || '#111c2e', border = opts.border || 'rgba(200,220,255,0.5)';
  // Box
  ctx.save();
  ctx.fillStyle = col; ctx.strokeStyle = border; ctx.lineWidth = 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, 10);
  ctx.fill(); ctx.stroke();
  // Speaker name
  if (opts.speaker) {
    ctx.font = 'bold 13px Georgia,serif';
    ctx.fillStyle = opts.speakerColor || '#aaddff';
    ctx.textAlign = 'left';
    ctx.fillText(opts.speaker, x + 16, y + 18);
  }
  // Body text (word-wrapped)
  var lines = wrapDialogText(ctx, opts.text || '', w - 32, opts.fontSize || 14);
  ctx.font = (opts.fontSize || 14) + 'px Georgia,serif';
  ctx.fillStyle = opts.textColor || '#e8e8f0';
  var lineY = y + (opts.speaker ? 36 : 22);
  lines.forEach(function(l) { ctx.fillText(l, x + 16, lineY); lineY += (opts.fontSize || 14) + 4; });
  ctx.restore();
}
function wrapDialogText(ctx, text, maxW, size) {
  ctx.font = size + 'px Georgia,serif';
  var words = text.split(' '), line = '', lines = [];
  for (var i = 0; i < words.length; i++) {
    var test = line + (line ? ' ' : '') + words[i];
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
    else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

/* ── PUBLIC API ─────────────────────────────────────────────────────────── */
var MuckoEngine = {
  initCanvas,
  makeInput,
  makeAudio,
  makeStore,
  makeLoop,
  makeDrawHelpers,
  renderDialog,
  TOUCH_UI: function() { return TOUCH_UI; },
};
global.MuckoEngine = MuckoEngine;

})(window);
