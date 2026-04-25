/* mucko-gamepad.js — shared gamepad → keyboard adapter
 *
 * Polls the HTML5 Gamepad API and dispatches synthetic KeyboardEvents
 * (keydown / keyup) so games using the existing K[]/JP[] keyboard
 * pattern work with a controller without per-game changes.
 *
 * Tested with the 8BitDo SN30 Pro in X-input mode (hold Start+X to
 * power on). Standard-gamepad layout assumed:
 *   buttons[0]  bottom face   →  Space    (primary action / GO)
 *   buttons[1]  right face    →  KeyE     (interact / refuel / lock)
 *   buttons[2]  left face     →  KeyA     (sub2 dodge)
 *   buttons[3]  top face      →  KeyC     (sub2 cigar throw)
 *   buttons[4]  L1            →  KeyQ
 *   buttons[5]  R1            →  KeyR
 *   buttons[8]  Select / Back →  Escape
 *   buttons[9]  Start         →  Enter
 *   buttons[12] D-pad up      →  ArrowUp
 *   buttons[13] D-pad down    →  ArrowDown
 *   buttons[14] D-pad left    →  ArrowLeft
 *   buttons[15] D-pad right   →  ArrowRight
 *
 * Left analog stick (axes[0], axes[1]) also drives the arrow keys
 * past a deadzone, so D-pad and stick both work for movement.
 *
 * iOS-12 / Safari-12 safe: only `var`, no optional chaining, no
 * nullish coalescing, no `.at()`, no class fields.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!navigator.getGamepads) return; // No Gamepad API, nothing to do
  if (window.__muckoGamepadInstalled) return; // idempotent
  window.__muckoGamepadInstalled = true;

  var BTN_MAP = {
    0:  'Space',
    1:  'KeyE',
    2:  'KeyA',
    3:  'KeyC',
    4:  'KeyQ',
    5:  'KeyR',
    8:  'Escape',
    9:  'Enter',
    12: 'ArrowUp',
    13: 'ArrowDown',
    14: 'ArrowLeft',
    15: 'ArrowRight'
  };

  var DEADZONE = 0.45;
  var prev = {}; // map of code → was-pressed

  function dispatchKey(type, code) {
    var ev;
    try {
      ev = new KeyboardEvent(type, { code: code, key: code, bubbles: true, cancelable: true });
    } catch (e) {
      // Very old browsers — fall back to a synthetic Event with a code field
      ev = document.createEvent('Event');
      ev.initEvent(type, true, true);
      ev.code = code;
      ev.key = code;
    }
    document.dispatchEvent(ev);
  }

  function setPressed(code, pressed) {
    var was = !!prev[code];
    if (was === pressed) return;
    prev[code] = pressed;
    dispatchKey(pressed ? 'keydown' : 'keyup', code);
  }

  function poll() {
    requestAnimationFrame(poll);
    var pads;
    try { pads = navigator.getGamepads() || []; } catch (e) { pads = []; }

    // Aggregate "currently pressed" codes across all connected pads
    var nowPressed = {};
    for (var pi = 0; pi < pads.length; pi++) {
      var pad = pads[pi];
      if (!pad || !pad.connected) continue;

      // Buttons
      for (var bi = 0; bi < pad.buttons.length; bi++) {
        var code = BTN_MAP[bi];
        if (!code) continue;
        var btn = pad.buttons[bi];
        var down = (typeof btn === 'object') ? btn.pressed : (btn > 0.5);
        if (down) nowPressed[code] = true;
      }

      // Left analog stick → arrow keys (so the stick also works)
      var ax = pad.axes && pad.axes.length > 0 ? pad.axes[0] : 0;
      var ay = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
      if (ax < -DEADZONE) nowPressed['ArrowLeft']  = true;
      if (ax >  DEADZONE) nowPressed['ArrowRight'] = true;
      if (ay < -DEADZONE) nowPressed['ArrowUp']    = true;
      if (ay >  DEADZONE) nowPressed['ArrowDown']  = true;
    }

    // Releases (keys we previously pressed but aren't anymore)
    for (var k in prev) {
      if (prev[k] && !nowPressed[k]) setPressed(k, false);
    }
    // Presses (new edges)
    for (var k2 in nowPressed) {
      if (!prev[k2]) setPressed(k2, true);
    }
  }

  // Start polling. We don't wait for 'gamepadconnected' so a controller
  // already connected at page load gets picked up on the next frame.
  requestAnimationFrame(poll);

  // Optional: a tiny console hint when a pad is detected.
  window.addEventListener('gamepadconnected', function (e) {
    try { console.log('[mucko-gamepad] connected:', e.gamepad.id); } catch (err) {}
  });
})();
