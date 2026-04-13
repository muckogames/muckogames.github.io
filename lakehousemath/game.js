'use strict';

const W = 800;
const H = 560;
const TAU = Math.PI * 2;
const PLAYER_SPEED = 140;
const NPC_SPEED = 24;
const INTERACT_DIST = 56;
const canvas = document.getElementById('game');
const ctx = MuckoEngine.initCanvas(canvas, W, H);
ctx.lineJoin = 'round';
ctx.lineCap = 'round';

const { K, JP, eat, held } = MuckoEngine.makeInput();
const { beep, chime } = MuckoEngine.makeAudio();
const bestStore = MuckoEngine.makeStore('mucko_lakehousemath_scores');
const TOUCH_UI = MuckoEngine.TOUCH_UI();
const DIALOG = window.LAKEHOUSE_DIALOG;

let mx = W / 2;
let my = H / 2;
let mclk = false;
let touchSuppressUntil = 0;
const touchState = { dirs: new Set(), buttons: new Set() };

const CHARACTERS = {
  samster: { name: 'Samster', color: '#dfc18e', accent: '#8d5f35', outline: '#4f311d', speakerColor: '#ffe0b2', sprite: 'hamster' },
  duck: { name: 'Duck Dieb', color: '#f3f1eb', accent: '#161616', outline: '#2a2217', speakerColor: '#fff4cf', sprite: 'duck' },
  hippo: { name: 'Hippo', color: '#8f7ea8', accent: '#63557b', outline: '#40324c', speakerColor: '#ead9ff', sprite: 'hippo' },
  nik: { name: 'Nik', color: '#83c7e3', accent: '#3f7da0', outline: '#24506d', speakerColor: '#d6f6ff', sprite: 'seal' },
  lekan: { name: 'Lekan', color: '#f4f4f4', accent: '#242424', outline: '#202020', speakerColor: '#ffffff', sprite: 'panda' },
  basil: { name: 'Basil', color: '#d1b48d', accent: '#48683c', outline: '#4d3726', speakerColor: '#f6edd8', sprite: 'keeper' },
  mucko: { name: 'Captain Mucko', color: '#d8a95a', accent: '#8f2f2f', outline: '#5f3914', speakerColor: '#ffd46b', sprite: 'captain' },
  rocket: { name: 'Saturn V', color: '#ededed', accent: '#d76039', outline: '#373737', speakerColor: '#f5f5f5', sprite: 'rocket' },
};

const QUESTS = [
  {
    id: 'berry',
    areaId: 'porch',
    name: 'Berry Gate',
    gateType: 'path',
    pairPool: [[6, 5], [7, 4], [8, 3], [9, 2]],
    prompt: 'How many berries go into the picnic basket?',
    sumLabel: 'berries',
    theme: 'berries',
    success: 'The berry gate swings open and the clover path is clear.',
    sideA: { char: 'samster', item: 'blueberries' },
    sideB: { char: 'duck', item: 'raspberries' },
  },
  {
    id: 'pond',
    areaId: 'meadow',
    name: 'Bridge Bell',
    gateType: 'path',
    pairPool: [[8, 4], [9, 3], [7, 5], [6, 6]],
    prompt: 'How many lily pads and pebbles did the meadow crew count?',
    sumLabel: 'pond clues',
    theme: 'pond',
    success: 'The bridge settles into place with a friendly wooden thunk.',
    sideA: { char: 'hippo', item: 'lily pads' },
    sideB: { char: 'nik', item: 'pebbles' },
  },
  {
    id: 'dock',
    areaId: 'dock',
    name: 'Dock Winch',
    gateType: 'path',
    pairPool: [[7, 6], [8, 5], [9, 4], [10, 3]],
    prompt: 'How many lanterns and rope loops are ready for the skiff?',
    sumLabel: 'dock supplies',
    theme: 'dock',
    success: 'The dock winch clanks and the skiff slides over to the picnic shore.',
    sideA: { char: 'lekan', item: 'lanterns' },
    sideB: { char: 'basil', item: 'rope loops' },
  },
  {
    id: 'picnic',
    areaId: 'picnic',
    name: 'Picnic Chest',
    gateType: 'final',
    pairPool: [[9, 8], [10, 7], [11, 6], [12, 5]],
    prompt: 'How many flags and lantern stars should hang over the picnic blanket?',
    sumLabel: 'party decorations',
    theme: 'party',
    success: 'The picnic chest pops open and the whole crew cheers.',
    sideA: { char: 'mucko', item: 'party flags' },
    sideB: { char: 'rocket', item: 'lantern stars' },
  },
];

const AREA_DEFS = [
  {
    id: 'porch',
    name: 'Cabin Porch',
    questIndex: 0,
    leftExit: null,
    rightExit: { target: 1, y1: 180, y2: 380 },
    gateRect: { x: 724, y: 205, w: 40, h: 150 },
    entry: { left: { x: 92, y: 292 }, right: { x: 680, y: 292 } },
    blockers: [
      { x: 28, y: 60, w: 248, h: 164 },
      { x: 284, y: 78, w: 84, h: 74 },
      { x: 502, y: 90, w: 90, h: 74 },
    ],
    npcs: [
      { id: 'samster', char: 'samster', x: 214, y: 272, roam: { x: 170, y: 212, w: 120, h: 120 }, questIndex: 0, clueIndex: 0 },
      { id: 'duck', char: 'duck', x: 498, y: 338, roam: { x: 418, y: 280, w: 160, h: 110 }, questIndex: 0, clueIndex: 1 },
    ],
  },
  {
    id: 'meadow',
    name: 'Clover Meadow',
    questIndex: 1,
    leftExit: { target: 0, y1: 170, y2: 390 },
    rightExit: { target: 2, y1: 170, y2: 390 },
    gateRect: { x: 724, y: 198, w: 42, h: 158 },
    entry: { left: { x: 92, y: 294 }, right: { x: 680, y: 294 } },
    blockers: [
      { x: 130, y: 300, w: 220, h: 162 },
      { x: 432, y: 82, w: 82, h: 86 },
      { x: 540, y: 354, w: 92, h: 88 },
    ],
    npcs: [
      { id: 'hippo', char: 'hippo', x: 236, y: 190, roam: { x: 156, y: 140, w: 166, h: 116 }, questIndex: 1, clueIndex: 0 },
      { id: 'nik', char: 'nik', x: 504, y: 240, roam: { x: 452, y: 190, w: 132, h: 116 }, questIndex: 1, clueIndex: 1 },
    ],
  },
  {
    id: 'dock',
    name: 'Dockside',
    questIndex: 2,
    leftExit: { target: 1, y1: 170, y2: 390 },
    rightExit: { target: 3, y1: 170, y2: 390 },
    gateRect: { x: 724, y: 202, w: 42, h: 150 },
    entry: { left: { x: 92, y: 294 }, right: { x: 680, y: 294 } },
    blockers: [
      { x: 40, y: 94, w: 230, h: 154 },
      { x: 0, y: 430, w: 800, h: 130 },
      { x: 522, y: 90, w: 88, h: 82 },
    ],
    npcs: [
      { id: 'lekan', char: 'lekan', x: 324, y: 208, roam: { x: 270, y: 150, w: 130, h: 120 }, questIndex: 2, clueIndex: 0 },
      { id: 'basil', char: 'basil', x: 566, y: 286, roam: { x: 512, y: 226, w: 132, h: 128 }, questIndex: 2, clueIndex: 1 },
    ],
  },
  {
    id: 'picnic',
    name: 'Picnic Point',
    questIndex: 3,
    leftExit: { target: 2, y1: 170, y2: 390 },
    rightExit: null,
    gateRect: { x: 348, y: 218, w: 108, h: 86 },
    entry: { left: { x: 110, y: 294 }, right: { x: 680, y: 294 } },
    blockers: [
      { x: 96, y: 84, w: 120, h: 96 },
      { x: 566, y: 88, w: 122, h: 102 },
      { x: 308, y: 372, w: 180, h: 72 },
    ],
    npcs: [
      { id: 'mucko', char: 'mucko', x: 232, y: 262, roam: { x: 180, y: 210, w: 118, h: 118 }, questIndex: 3, clueIndex: 0 },
      { id: 'rocket', char: 'rocket', x: 562, y: 232, roam: { x: 504, y: 182, w: 120, h: 116 }, questIndex: 3, clueIndex: 1 },
    ],
  },
];

let areaBackdrops = [];
let state = null;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function roundRectPath(cx, x, y, w, h, r) {
  const rr = Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2);
  cx.beginPath();
  if (typeof cx.roundRect === 'function') {
    cx.roundRect(x, y, w, h, rr);
    return;
  }
  cx.moveTo(x + rr, y);
  cx.lineTo(x + w - rr, y);
  cx.arcTo(x + w, y, x + w, y + rr, rr);
  cx.lineTo(x + w, y + h - rr);
  cx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  cx.lineTo(x + rr, y + h);
  cx.arcTo(x, y + h, x, y + h - rr, rr);
  cx.lineTo(x, y + rr);
  cx.arcTo(x, y, x + rr, y, rr);
  cx.closePath();
}

function fillRoundRect(cx, x, y, w, h, r, fill, stroke, sw) {
  roundRectPath(cx, x, y, w, h, r);
  if (fill) {
    cx.fillStyle = fill;
    cx.fill();
  }
  if (stroke) {
    cx.strokeStyle = stroke;
    cx.lineWidth = sw || 2;
    cx.stroke();
  }
}

function drawLine(cx, x1, y1, x2, y2, color, width) {
  cx.strokeStyle = color;
  cx.lineWidth = width || 2;
  cx.beginPath();
  cx.moveTo(x1, y1);
  cx.lineTo(x2, y2);
  cx.stroke();
}

function drawText(cx, text, x, y, color, size, align, font, baseline) {
  cx.fillStyle = color;
  cx.font = (font || 'bold') + ' ' + (size || 16) + 'px Georgia,serif';
  cx.textAlign = align || 'left';
  cx.textBaseline = baseline || 'alphabetic';
  cx.fillText(text, x, y);
}

function drawCircle(cx, x, y, r, fill, stroke, sw) {
  cx.beginPath();
  cx.arc(x, y, r, 0, TAU);
  if (fill) {
    cx.fillStyle = fill;
    cx.fill();
  }
  if (stroke) {
    cx.strokeStyle = stroke;
    cx.lineWidth = sw || 2;
    cx.stroke();
  }
}

function drawEllipse(cx, x, y, rx, ry, fill, stroke, sw, rot) {
  cx.beginPath();
  cx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  if (fill) {
    cx.fillStyle = fill;
    cx.fill();
  }
  if (stroke) {
    cx.strokeStyle = stroke;
    cx.lineWidth = sw || 2;
    cx.stroke();
  }
}

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, function(_, key) {
    return values[key] != null ? values[key] : '';
  });
}

function questionLayout() {
  return {
    panel: { x: 94, y: 54, w: 612, h: 452 },
    cardA: { x: 132, y: 136, w: 220, h: 122 },
    cardB: { x: 448, y: 136, w: 220, h: 122 },
    eqY: 304,
    optionRects: [
      { x: 138, y: 356, w: 154, h: 74 },
      { x: 323, y: 356, w: 154, h: 74 },
      { x: 508, y: 356, w: 154, h: 74 },
    ],
    hintRect: { x: 238, y: 446, w: 324, h: 40 },
  };
}

function fireActionButton() {
  JP.Space = true;
  JP.Enter = true;
  JP.KeyE = true;
}

function setPointerFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  mx = (e.clientX - r.left) * (W / r.width);
  my = (e.clientY - r.top) * (H / r.height);
}

canvas.addEventListener('mousemove', function(e) {
  setPointerFromEvent(e);
});

canvas.addEventListener('click', function(e) {
  if (performance.now() < touchSuppressUntil) return;
  setPointerFromEvent(e);
  mclk = true;
});

function mobileControlsOn() {
  return TOUCH_UI && state && state.phase === 'explore';
}

function mobileLayout() {
  return {
    dpad: { cx: 96, cy: H - 94, r: 38 },
    action: { cx: W - 92, cy: H - 94, r: 40 },
  };
}

function getMobileDpadDir(px, py, dpad) {
  const dx = px - dpad.cx;
  const dy = py - dpad.cy;
  if (Math.hypot(dx, dy) > dpad.r * 2.4) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function hitMobileControl(px, py) {
  if (!mobileControlsOn()) return null;
  const layout = mobileLayout();
  if (Math.hypot(px - layout.action.cx, py - layout.action.cy) <= layout.action.r) {
    return { kind: 'action' };
  }
  const dir = getMobileDpadDir(px, py, layout.dpad);
  if (dir) return { kind: 'dpad', dir: dir };
  return null;
}

function applyTouchDirs(dirs) {
  touchState.dirs = dirs;
  K.ArrowLeft = dirs.has('left');
  K.ArrowRight = dirs.has('right');
  K.ArrowUp = dirs.has('up');
  K.ArrowDown = dirs.has('down');
}

function syncTouchControls(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = W / rect.width;
  const sy = H / rect.height;
  const dirs = new Set();
  const buttons = new Set();
  Array.from(e.touches).forEach(function(tch) {
    const px = (tch.clientX - rect.left) * sx;
    const py = (tch.clientY - rect.top) * sy;
    const hit = hitMobileControl(px, py);
    if (!hit) return;
    if (hit.kind === 'dpad') dirs.add(hit.dir);
    if (hit.kind === 'action') buttons.add('action');
  });
  buttons.forEach(function(id) {
    if (!touchState.buttons.has(id)) fireActionButton();
  });
  touchState.buttons = buttons;
  applyTouchDirs(dirs);
}

canvas.addEventListener('touchstart', function(e) {
  touchSuppressUntil = performance.now() + 500;
  const rect = canvas.getBoundingClientRect();
  const sx = W / rect.width;
  const sy = H / rect.height;
  Array.from(e.changedTouches).forEach(function(tch) {
    const px = (tch.clientX - rect.left) * sx;
    const py = (tch.clientY - rect.top) * sy;
    const hit = hitMobileControl(px, py);
    if (!hit && !mclk) {
      mx = px;
      my = py;
      mclk = true;
    }
  });
  syncTouchControls(e);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
  syncTouchControls(e);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  syncTouchControls(e);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchcancel', function(e) {
  syncTouchControls(e);
  e.preventDefault();
}, { passive: false });

window.addEventListener('blur', function() {
  touchState.buttons.clear();
  applyTouchDirs(new Set());
});

function buildQuestState(template) {
  const pair = pick(template.pairPool);
  return {
    solved: false,
    pair: [pair[0], pair[1]],
    cluesFound: [false, false],
    hintUsed: false,
    wrongGuesses: 0,
  };
}

function cloneAreaNpcs(area) {
  return area.npcs.map(function(npc) {
    return {
      id: npc.id,
      char: npc.char,
      x: npc.x,
      y: npc.y,
      homeX: npc.x,
      homeY: npc.y,
      tx: npc.x,
      ty: npc.y,
      roam: Object.assign({}, npc.roam),
      wait: rand(0.2, 1.2),
      face: 'right',
      bob: rand(0, TAU),
      questIndex: npc.questIndex,
      clueIndex: npc.clueIndex,
    };
  });
}

function freshState() {
  return {
    phase: 'title',
    phaseTime: 0,
    areaIndex: 0,
    visited: [false, false, false, false],
    player: { x: 92, y: 292, r: 15, facing: 'right', bob: 0 },
    quests: QUESTS.map(buildQuestState),
    areaNpcs: AREA_DEFS.map(cloneAreaNpcs),
    dialog: null,
    quiz: null,
    fireflies: 2,
    maxFireflies: 3,
    stickers: 0,
    elapsed: 0,
    toast: null,
    celebrationTime: 0,
    celebrationGuests: [],
    best: bestStore.get()[0] || null,
  };
}

function resetToTitle() {
  state = freshState();
}

function currentArea() {
  return AREA_DEFS[state.areaIndex];
}

function currentQuest() {
  return QUESTS[currentArea().questIndex];
}

function currentQuestState() {
  return state.quests[currentArea().questIndex];
}

function currentAreaNpcs() {
  return state.areaNpcs[state.areaIndex];
}

function showToast(text, seconds) {
  state.toast = { text: text, time: seconds || 2.6 };
}

function startAdventure() {
  const next = freshState();
  next.phase = 'dialog';
  next.visited[0] = true;
  next.player.x = AREA_DEFS[0].entry.left.x;
  next.player.y = AREA_DEFS[0].entry.left.y;
  next.dialog = {
    lines: DIALOG.intro.slice(),
    index: 0,
    nextPhase: 'explore',
    onClose: function() {
      showToast(DIALOG.areaIntro.porch, 3.2);
    },
  };
  state = next;
}

function moveToArea(index, entrySide) {
  state.areaIndex = index;
  const area = AREA_DEFS[index];
  const spawn = area.entry[entrySide === 'right' ? 'right' : 'left'];
  state.player.x = spawn.x;
  state.player.y = spawn.y;
  state.player.facing = entrySide === 'right' ? 'left' : 'right';
  if (!state.visited[index]) {
    state.visited[index] = true;
    showToast(DIALOG.areaIntro[area.id], 3);
  } else {
    showToast(area.name, 1.5);
  }
}

function openDialog(lines, nextPhase, onClose) {
  state.phase = 'dialog';
  state.dialog = {
    lines: lines,
    index: 0,
    nextPhase: nextPhase || 'explore',
    onClose: onClose || null,
  };
}

function closeDialog() {
  if (!state.dialog) return;
  const dlg = state.dialog;
  state.dialog = null;
  state.phase = dlg.nextPhase || 'explore';
  if (dlg.onClose) dlg.onClose();
}

function advanceDialog() {
  if (!state.dialog) return;
  state.dialog.index += 1;
  if (state.dialog.index >= state.dialog.lines.length) {
    closeDialog();
  }
}

function choiceOptions(answer) {
  const set = new Set([answer]);
  const deltas = [1, -1, 2, -2, 3, -3];
  while (set.size < 3) {
    const candidate = clamp(answer + deltas[Math.floor(Math.random() * deltas.length)], 0, 20);
    if (candidate !== answer) set.add(candidate);
  }
  return shuffle(Array.from(set));
}

function startQuiz(questIndex) {
  const q = state.quests[questIndex];
  const answer = q.pair[0] + q.pair[1];
  state.phase = 'quiz';
  state.quiz = {
    questIndex: questIndex,
    options: choiceOptions(answer),
    selected: 0,
    feedback: '',
    hintShown: false,
    answer: answer,
  };
}

function awardBestIfNeeded() {
  const score = state.stickers * 100 + state.fireflies * 10 + Math.max(0, 999 - Math.floor(state.elapsed));
  const entry = {
    score: score,
    fireflies: state.fireflies,
    stickers: state.stickers,
    seconds: Math.floor(state.elapsed),
  };
  const saved = bestStore.save(entry);
  state.best = saved[0] || entry;
}

function startEnding() {
  awardBestIfNeeded();
  state.phase = 'ending';
  state.celebrationTime = 0;
  state.celebrationGuests = [
    { char: 'samster', x: 156, y: 438, drift: rand(0, TAU) },
    { char: 'duck', x: 224, y: 410, drift: rand(0, TAU) },
    { char: 'hippo', x: 300, y: 430, drift: rand(0, TAU) },
    { char: 'nik', x: 382, y: 406, drift: rand(0, TAU) },
    { char: 'lekan', x: 478, y: 430, drift: rand(0, TAU) },
    { char: 'basil', x: 560, y: 410, drift: rand(0, TAU) },
    { char: 'mucko', x: 640, y: 432, drift: rand(0, TAU) },
    { char: 'rocket', x: 712, y: 404, drift: rand(0, TAU) },
  ];
  openDialog(DIALOG.ending.slice(), 'ending');
}

function getQuestSideInfo(questIndex, clueIndex) {
  const quest = QUESTS[questIndex];
  const side = clueIndex === 0 ? quest.sideA : quest.sideB;
  const qState = state.quests[questIndex];
  return {
    number: qState.pair[clueIndex],
    item: side.item,
    charId: side.char,
    charName: CHARACTERS[side.char].name,
    otherCharName: CHARACTERS[clueIndex === 0 ? quest.sideB.char : quest.sideA.char].name,
  };
}

function npcDialog(npc) {
  const info = getQuestSideInfo(npc.questIndex, npc.clueIndex);
  const qState = state.quests[npc.questIndex];
  const textSet = DIALOG.npcs[npc.char];
  const values = {
    n: info.number,
    item: info.item,
    other: info.otherCharName,
  };
  if (!qState.cluesFound[npc.clueIndex]) {
    qState.cluesFound[npc.clueIndex] = true;
    beep(610, 0.1, 0.12, 'triangle');
    return [
      {
        speaker: CHARACTERS[npc.char].name,
        speakerColor: CHARACTERS[npc.char].speakerColor,
        text: fillTemplate(textSet.clue, values),
      },
      {
        speaker: 'Clue Book',
        speakerColor: '#ffeaa1',
        text: 'Clue saved. Now find the second clue card.',
      },
    ];
  }
  if (qState.solved) {
    return [{
      speaker: CHARACTERS[npc.char].name,
      speakerColor: CHARACTERS[npc.char].speakerColor,
      text: textSet.after,
    }];
  }
  return [{
    speaker: CHARACTERS[npc.char].name,
    speakerColor: CHARACTERS[npc.char].speakerColor,
    text: fillTemplate(textSet.repeat, values),
  }];
}

function gateDialog(area, quest, qState) {
  if (qState.solved) {
    showToast(DIALOG.gateSolved, 1.4);
    return [];
  }
  if (!qState.cluesFound[0] || !qState.cluesFound[1]) {
    return [{
      speaker: quest.name,
      speakerColor: '#ffeaa1',
      text: DIALOG.gateNeedClues,
    }];
  }
  return null;
}

function chooseQuizAnswer(value) {
  const quiz = state.quiz;
  const qState = state.quests[quiz.questIndex];
  const quest = QUESTS[quiz.questIndex];
  if (value === quiz.answer) {
    qState.solved = true;
    qState.hintUsed = quiz.hintShown;
    state.stickers += 1;
    const lines = [
      {
        speaker: quest.name,
        speakerColor: '#ffeaa1',
        text: qState.pair[0] + ' + ' + qState.pair[1] + ' = ' + quiz.answer + '. ' + quest.success,
      },
    ];
    if (!quiz.hintShown && state.fireflies < state.maxFireflies) {
      state.fireflies += 1;
      lines.push({
        speaker: 'Firefly Jar',
        speakerColor: '#ffeaa1',
        text: DIALOG.perfectBonus,
      });
    }
    chime();
    state.quiz = null;
    state.phase = 'explore';
    openDialog(lines, 'explore', function() {
      if (quest.gateType === 'final') startEnding();
    });
    return;
  }
  qState.wrongGuesses += 1;
  quiz.feedback = 'Not yet. Try again, or use a firefly for the counting frame.';
  beep(220, 0.14, 0.2, 'square');
}

function quizHitTest() {
  const layout = questionLayout();
  if (rectContains(layout.hintRect, mx, my)) return { type: 'hint' };
  for (let i = 0; i < layout.optionRects.length; i++) {
    if (rectContains(layout.optionRects[i], mx, my)) return { type: 'option', index: i };
  }
  return null;
}

function useQuizHint() {
  if (!state.quiz) return;
  if (state.quiz.hintShown) {
    state.quiz.feedback = 'Counting frame already on. Count the gold ones, then the blue ones.';
    return;
  }
  if (state.fireflies <= 0) {
    state.quiz.feedback = DIALOG.hintEmpty;
    beep(180, 0.1, 0.15, 'square');
    return;
  }
  state.fireflies -= 1;
  state.quiz.hintShown = true;
  state.quiz.feedback = 'Count the lit boxes: first gold, then blue.';
  beep(520, 0.08, 0.14, 'sine');
}

function updateNpc(npc, dt) {
  npc.bob += dt * 5;
  if (npc.wait > 0) {
    npc.wait -= dt;
    if (npc.wait <= 0) {
      npc.tx = rand(npc.roam.x, npc.roam.x + npc.roam.w);
      npc.ty = rand(npc.roam.y, npc.roam.y + npc.roam.h);
    }
    return;
  }
  const dx = npc.tx - npc.x;
  const dy = npc.ty - npc.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    npc.wait = rand(0.8, 1.8);
    return;
  }
  npc.x += dx / d * NPC_SPEED * dt;
  npc.y += dy / d * NPC_SPEED * dt;
  if (Math.abs(dx) > Math.abs(dy)) npc.face = dx < 0 ? 'left' : 'right';
}

function inputX() {
  let x = 0;
  if (held('ArrowLeft') || held('KeyA') || touchState.dirs.has('left')) x -= 1;
  if (held('ArrowRight') || held('KeyD') || touchState.dirs.has('right')) x += 1;
  return x;
}

function inputY() {
  let y = 0;
  if (held('ArrowUp') || held('KeyW') || touchState.dirs.has('up')) y -= 1;
  if (held('ArrowDown') || held('KeyS') || touchState.dirs.has('down')) y += 1;
  return y;
}

function playerHitsArea(px, py, area) {
  const r = state.player.r;
  if (px < r + 10 || px > W - r - 10 || py < r + 42 || py > H - r - 14) return true;
  for (let i = 0; i < area.blockers.length; i++) {
    const b = area.blockers[i];
    if (px + r > b.x && px - r < b.x + b.w && py + r > b.y && py - r < b.y + b.h) return true;
  }
  const qState = currentQuestState();
  const gate = area.gateRect;
  if (!qState.solved && area.id !== 'picnic') {
    if (px + r > gate.x && py + r > area.rightExit.y1 && py - r < area.rightExit.y2) return true;
  } else if (!qState.solved && area.id === 'picnic') {
    if (px + r > gate.x && px - r < gate.x + gate.w && py + r > gate.y && py - r < gate.y + gate.h) return true;
  }
  return false;
}

function movePlayer(dt) {
  const dx = inputX();
  const dy = inputY();
  const len = Math.hypot(dx, dy) || 1;
  const stepX = dx / len * PLAYER_SPEED * dt;
  const stepY = dy / len * PLAYER_SPEED * dt;
  const area = currentArea();
  if (dx !== 0) state.player.facing = dx < 0 ? 'left' : 'right';
  if (!playerHitsArea(state.player.x + stepX, state.player.y, area)) state.player.x += stepX;
  if (!playerHitsArea(state.player.x, state.player.y + stepY, area)) state.player.y += stepY;
  if (dx || dy) state.player.bob += dt * 8;

  if (area.rightExit && currentQuestState().solved && state.player.x > W - state.player.r - 14 && state.player.y >= area.rightExit.y1 && state.player.y <= area.rightExit.y2) {
    moveToArea(area.rightExit.target, 'left');
  }
  if (area.leftExit && state.player.x < state.player.r + 14 && state.player.y >= area.leftExit.y1 && state.player.y <= area.leftExit.y2) {
    moveToArea(area.leftExit.target, 'right');
  }
}

function clickedWorldInteractable() {
  const area = currentArea();
  const gateRect = area.gateRect;
  if (rectContains(gateRect, mx, my)) return { type: 'gate' };
  const npcs = currentAreaNpcs();
  for (let i = 0; i < npcs.length; i++) {
    if (dist(mx, my, npcs[i].x, npcs[i].y) <= 26) return { type: 'npc', npc: npcs[i] };
  }
  return null;
}

function nearbyInteractable() {
  const area = currentArea();
  let best = null;
  let bestDist = 999;
  const npcs = currentAreaNpcs();
  for (let i = 0; i < npcs.length; i++) {
    const d = dist(state.player.x, state.player.y, npcs[i].x, npcs[i].y);
    if (d < INTERACT_DIST && d < bestDist) {
      best = { type: 'npc', npc: npcs[i], x: npcs[i].x, y: npcs[i].y };
      bestDist = d;
    }
  }
  const gateX = area.id === 'picnic' ? area.gateRect.x + area.gateRect.w / 2 : area.gateRect.x + 10;
  const gateY = area.gateRect.y + area.gateRect.h / 2;
  const gateD = dist(state.player.x, state.player.y, gateX, gateY);
  if (gateD < INTERACT_DIST && gateD < bestDist) {
    best = { type: 'gate', x: gateX, y: gateY };
  }
  return best;
}

function interact(target) {
  if (!target) return;
  if (target.type === 'npc') {
    openDialog(npcDialog(target.npc), 'explore');
    return;
  }
  if (target.type === 'gate') {
    const questIndex = currentArea().questIndex;
    const qState = state.quests[questIndex];
    if (qState.solved) {
      showToast(DIALOG.gateSolved, 1.4);
      return;
    }
    const gateLines = gateDialog(currentArea(), QUESTS[questIndex], qState);
    if (gateLines) {
      openDialog(gateLines, 'explore');
    } else {
      startQuiz(questIndex);
    }
  }
}

function objectiveText() {
  const area = currentArea();
  const quest = QUESTS[area.questIndex];
  const qState = state.quests[area.questIndex];
  const found = (qState.cluesFound[0] ? 1 : 0) + (qState.cluesFound[1] ? 1 : 0);
  if (!qState.solved) {
    if (found === 0) return 'Talk to ' + CHARACTERS[quest.sideA.char].name + ' and ' + CHARACTERS[quest.sideB.char].name + ' for clue cards.';
    if (found === 1) return 'One clue found. Track down the second clue card.';
    return 'Both clues are ready. Walk to ' + quest.name + ' and solve the total.';
  }
  if (area.id === 'picnic') return 'The picnic chest is open. Enjoy the celebration.';
  return 'Path open. Walk onward to the next lake house area.';
}

function updateTitle() {
  if (eat('Space') || eat('Enter') || mclk) startAdventure();
}

function updateDialogPhase() {
  if (eat('Space') || eat('Enter') || eat('KeyE') || mclk) advanceDialog();
}

function updateExplore(dt) {
  state.elapsed += dt;
  const npcs = currentAreaNpcs();
  for (let i = 0; i < npcs.length; i++) updateNpc(npcs[i], dt);
  movePlayer(dt);
  const clicked = mclk ? clickedWorldInteractable() : null;
  const nearby = nearbyInteractable();
  if (clicked && dist(state.player.x, state.player.y, clicked.type === 'npc' ? clicked.npc.x : currentArea().gateRect.x + currentArea().gateRect.w / 2, clicked.type === 'npc' ? clicked.npc.y : currentArea().gateRect.y + currentArea().gateRect.h / 2) < INTERACT_DIST + 14) {
    interact(clicked);
    return;
  }
  if (nearby && (eat('Space') || eat('Enter') || eat('KeyE'))) {
    interact(nearby);
  }
}

function updateQuizPhase() {
  const quiz = state.quiz;
  if (!quiz) return;
  if (eat('ArrowLeft') || eat('KeyA')) quiz.selected = (quiz.selected + quiz.options.length - 1) % quiz.options.length;
  if (eat('ArrowRight') || eat('KeyD')) quiz.selected = (quiz.selected + 1) % quiz.options.length;
  if (eat('ArrowUp')) quiz.selected = (quiz.selected + quiz.options.length - 1) % quiz.options.length;
  if (eat('ArrowDown')) quiz.selected = (quiz.selected + 1) % quiz.options.length;
  if (eat('KeyH')) useQuizHint();
  if (mclk) {
    const hit = quizHitTest();
    if (hit && hit.type === 'hint') useQuizHint();
    if (hit && hit.type === 'option') chooseQuizAnswer(quiz.options[hit.index]);
  }
  if (eat('Space') || eat('Enter') || eat('KeyE')) chooseQuizAnswer(quiz.options[quiz.selected]);
}

function updateEnding(dt) {
  state.celebrationTime += dt;
  state.elapsed += dt;
  if (eat('Space') || eat('Enter') || mclk) resetToTitle();
}

function update(dt) {
  if (state.toast) {
    state.toast.time -= dt;
    if (state.toast.time <= 0) state.toast = null;
  }
  state.phaseTime += dt;
  switch (state.phase) {
    case 'title':
      updateTitle();
      break;
    case 'dialog':
      updateDialogPhase();
      break;
    case 'explore':
      updateExplore(dt);
      break;
    case 'quiz':
      updateQuizPhase();
      break;
    case 'ending':
      updateEnding(dt);
      break;
  }
  mclk = false;
}

function drawTree(cx, x, y, scale, leaf) {
  cx.save();
  cx.translate(x, y);
  cx.scale(scale, scale);
  fillRoundRect(cx, -10, 14, 20, 42, 8, '#715231');
  drawCircle(cx, 0, 0, 26, leaf || '#5f9b4d');
  drawCircle(cx, -18, 8, 18, leaf || '#5f9b4d');
  drawCircle(cx, 16, 6, 16, leaf || '#5f9b4d');
  cx.restore();
}

function drawBush(cx, x, y, color) {
  drawCircle(cx, x - 18, y + 4, 18, color || '#6aa64e');
  drawCircle(cx, x, y - 6, 22, color || '#6aa64e');
  drawCircle(cx, x + 20, y + 4, 18, color || '#6aa64e');
}

function drawCabin(cx, x, y) {
  fillRoundRect(cx, x, y, 220, 142, 10, '#d8b27f', '#8a6033', 3);
  cx.fillStyle = '#8e5f34';
  cx.beginPath();
  cx.moveTo(x - 12, y + 18);
  cx.lineTo(x + 110, y - 42);
  cx.lineTo(x + 232, y + 18);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = '#693f21';
  cx.lineWidth = 3;
  cx.stroke();
  fillRoundRect(cx, x + 90, y + 70, 42, 72, 8, '#8e6036', '#6e451f', 2);
  fillRoundRect(cx, x + 28, y + 44, 42, 34, 6, '#f1e2b4', '#8a6033', 2);
  fillRoundRect(cx, x + 152, y + 44, 42, 34, 6, '#f1e2b4', '#8a6033', 2);
}

function drawPond(cx, x, y, w, h) {
  cx.save();
  cx.translate(x, y);
  drawEllipse(cx, 0, 0, w, h, '#84cdeb', '#4a8fb0', 3);
  drawEllipse(cx, -w * 0.18, -h * 0.1, w * 0.28, h * 0.24, 'rgba(255,255,255,.18)');
  drawEllipse(cx, w * 0.22, h * 0.12, w * 0.22, h * 0.16, 'rgba(255,255,255,.12)');
  cx.restore();
}

function drawDockHouse(cx, x, y) {
  fillRoundRect(cx, x, y, 208, 126, 10, '#b98d63', '#73512a', 3);
  fillRoundRect(cx, x + 76, y + 42, 56, 84, 8, '#704b2b', '#4c2f17', 2);
  cx.fillStyle = '#89613d';
  cx.beginPath();
  cx.moveTo(x - 10, y + 14);
  cx.lineTo(x + 104, y - 48);
  cx.lineTo(x + 218, y + 14);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = '#5f3d1d';
  cx.lineWidth = 3;
  cx.stroke();
}

function drawPicnicBlanket(cx, x, y) {
  fillRoundRect(cx, x, y, 180, 94, 18, '#efefe2', '#a34d47', 3);
  for (let i = 1; i < 4; i++) {
    drawLine(cx, x + i * 36, y, x + i * 36, y + 94, '#d75e54', 2);
  }
  for (let i = 1; i < 3; i++) {
    drawLine(cx, x, y + i * 31, x + 180, y + i * 31, '#d75e54', 2);
  }
}

function buildAreaBackdrop(area, index) {
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const cx = off.getContext('2d');
  cx.lineJoin = 'round';
  cx.lineCap = 'round';

  const sky = cx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#dff4ff');
  sky.addColorStop(0.48, '#cde9f7');
  sky.addColorStop(0.49, '#9fcf77');
  sky.addColorStop(1, area.id === 'dock' ? '#7fb063' : '#8ec66e');
  cx.fillStyle = sky;
  cx.fillRect(0, 0, W, H);

  if (area.id === 'porch') {
    cx.fillStyle = '#d2bc82';
    cx.fillRect(0, 220, W, 54);
    cx.fillStyle = '#be9e64';
    cx.fillRect(0, 270, W, 24);
    drawCabin(cx, 40, 74);
    drawBush(cx, 360, 120, '#72af55');
    drawBush(cx, 540, 138, '#6da752');
    drawBush(cx, 670, 360, '#6ea74d');
    drawTree(cx, 690, 140, 1.1, '#61954a');
    drawTree(cx, 106, 382, 1.1, '#5d9448');
    drawText(cx, 'Berry Path', 672, 196, '#6f5225', 18, 'center', 'bold');
  }

  if (area.id === 'meadow') {
    drawPond(cx, 236, 380, 138, 82);
    drawTree(cx, 118, 116, 1.06, '#5e9647');
    drawTree(cx, 472, 110, 0.94, '#679d4c');
    drawTree(cx, 596, 398, 1.08, '#5c9445');
    drawBush(cx, 548, 154, '#75af54');
    drawBush(cx, 692, 246, '#68a04f');
    for (let i = 0; i < 12; i++) {
      drawCircle(cx, 78 + i * 54, 472 + Math.sin(i) * 8, 3, i % 2 ? '#ffd96a' : '#ffffff');
    }
    drawText(cx, 'Bridge Bell', 674, 196, '#6d5323', 18, 'center', 'bold');
  }

  if (area.id === 'dock') {
    cx.fillStyle = '#72c1df';
    cx.fillRect(0, 406, W, 154);
    cx.fillStyle = 'rgba(255,255,255,.16)';
    for (let i = 0; i < 8; i++) {
      drawLine(cx, 22 + i * 104, 442 + (i % 2) * 12, 88 + i * 104, 456 + (i % 2) * 12, 'rgba(255,255,255,.32)', 3);
    }
    drawDockHouse(cx, 44, 100);
    cx.fillStyle = '#8d6742';
    cx.fillRect(286, 356, 208, 26);
    cx.fillRect(458, 248, 208, 20);
    for (let i = 0; i < 12; i++) {
      cx.fillRect(296 + i * 16, 382, 8, 52);
    }
    drawTree(cx, 570, 120, 1.02, '#5d9448');
    drawTree(cx, 704, 132, 0.98, '#5a8f44');
    drawText(cx, 'Skiff Launch', 676, 194, '#664d23', 18, 'center', 'bold');
  }

  if (area.id === 'picnic') {
    cx.fillStyle = '#7ac2dc';
    cx.fillRect(0, 0, W, 136);
    cx.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 6; i++) drawLine(cx, 40 + i * 130, 88 + (i % 2) * 14, 122 + i * 130, 104 + (i % 2) * 14, 'rgba(255,255,255,.26)', 3);
    drawTree(cx, 122, 126, 1.04, '#5c9346');
    drawTree(cx, 654, 128, 1.04, '#5c9346');
    drawPicnicBlanket(cx, 308, 374);
    drawBush(cx, 214, 118, '#79b557');
    drawBush(cx, 590, 118, '#79b557');
    drawText(cx, 'Picnic Point', 398, 180, '#6a4c22', 22, 'center', 'bold');
  }

  return off;
}

function drawQuestIcon(cx, x, y, quest, clueIndex, size) {
  const s = size || 10;
  const theme = quest.theme;
  const main = clueIndex === 0 ? '#e6b44a' : '#5fb8df';
  const alt = clueIndex === 0 ? '#a56f1c' : '#2b6885';
  cx.save();
  cx.translate(x, y);
  if (theme === 'berries') {
    drawCircle(cx, 0, 0, s * 0.6, main, '#6b4520', 1.6);
    drawCircle(cx, s * 0.65, -s * 0.25, s * 0.48, main, '#6b4520', 1.6);
    cx.strokeStyle = '#5d8c3f';
    cx.lineWidth = 1.5;
    cx.beginPath();
    cx.moveTo(s * 0.28, -s * 0.56);
    cx.lineTo(s * 0.46, -s * 0.95);
    cx.stroke();
  } else if (theme === 'pond') {
    if (clueIndex === 0) {
      drawCircle(cx, 0, 0, s * 0.72, '#7ac867', '#386f34', 1.4);
      cx.fillStyle = '#8fcf74';
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.lineTo(s * 0.92, -s * 0.12);
      cx.lineTo(s * 0.24, s * 0.36);
      cx.closePath();
      cx.fill();
    } else {
      drawEllipse(cx, 0, 0, s * 0.72, s * 0.5, '#c7c7d1', '#72727d', 1.4);
    }
  } else if (theme === 'dock') {
    if (clueIndex === 0) {
      fillRoundRect(cx, -s * 0.45, -s * 0.15, s * 0.9, s * 1.1, 4, '#ffd66f', '#8a6521', 1.5);
      drawLine(cx, 0, -s * 0.7, 0, -s * 0.2, '#8a6521', 1.4);
      drawLine(cx, -s * 0.28, -s * 0.62, s * 0.28, -s * 0.62, '#8a6521', 1.4);
    } else {
      drawCircle(cx, 0, 0, s * 0.62, null, '#9d7a42', 3);
      drawCircle(cx, 0, 0, s * 0.18, '#f8ecd2');
    }
  } else if (theme === 'party') {
    if (clueIndex === 0) {
      cx.fillStyle = main;
      cx.beginPath();
      cx.moveTo(-s * 0.4, -s * 0.55);
      cx.lineTo(s * 0.62, -s * 0.2);
      cx.lineTo(-s * 0.4, s * 0.22);
      cx.closePath();
      cx.fill();
      drawLine(cx, -s * 0.44, -s * 0.72, -s * 0.44, s * 0.55, '#7b5130', 1.5);
    } else {
      const spikes = 5;
      cx.fillStyle = main;
      cx.strokeStyle = alt;
      cx.lineWidth = 1.4;
      cx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / spikes;
        const rad = i % 2 === 0 ? s * 0.7 : s * 0.32;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) cx.moveTo(px, py);
        else cx.lineTo(px, py);
      }
      cx.closePath();
      cx.fill();
      cx.stroke();
    }
  }
  cx.restore();
}

function drawCountDots(cx, x, y, quest, clueIndex, count) {
  const perRow = 5;
  const gap = 18;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    drawQuestIcon(cx, x + col * gap, y + row * 22, quest, clueIndex, 10);
  }
}

function drawTenFrame(cx, x, y, quest, a, b) {
  const total = a + b;
  for (let i = 0; i < 20; i++) {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const rx = x + col * 24;
    const ry = y + row * 24;
    let fill = '#f7f1df';
    if (i < a) fill = '#f2c85a';
    else if (i < total) fill = '#77cbe7';
    fillRoundRect(cx, rx, ry, 18, 18, 5, fill, 'rgba(88,64,28,.35)', 1.5);
  }
  drawText(cx, 'gold first, blue next', x + 108, y + 58, '#77582b', 14, 'center', 'bold');
}

function drawCharacter(cx, id, x, y, facing, bob, shadowScale) {
  const ch = CHARACTERS[id];
  const bounce = Math.sin(bob || 0) * 1.5;
  cx.save();
  cx.translate(x, y + bounce);
  if (facing === 'left') cx.scale(-1, 1);
  drawEllipse(cx, 0, 18, 16 * (shadowScale || 1), 6 * (shadowScale || 1), 'rgba(0,0,0,.16)');
  if (ch.sprite === 'hamster') {
    drawEllipse(cx, 0, 2, 16, 14, ch.color, ch.outline, 2);
    drawCircle(cx, -8, -10, 6, ch.color, ch.outline, 2);
    drawCircle(cx, 8, -10, 6, ch.color, ch.outline, 2);
    drawCircle(cx, 0, -2, 11, '#f5ddbc');
    drawCircle(cx, -4, -4, 2, '#35231b');
    drawCircle(cx, 4, -4, 2, '#35231b');
    drawCircle(cx, 0, 1, 2.2, '#c56f62');
  } else if (ch.sprite === 'duck') {
    drawEllipse(cx, -2, 4, 16, 12, '#f2f0eb', ch.outline, 2);
    drawEllipse(cx, 10, -6, 10, 9, '#f2f0eb', ch.outline, 2);
    fillRoundRect(cx, 4, -10, 14, 6, 3, ch.accent);
    drawCircle(cx, 9, -8, 1.8, '#f2f0eb');
    drawEllipse(cx, 20, -2, 7, 4, '#e8a34a', '#9c5e1d', 1.4);
    cx.fillStyle = '#202020';
    cx.beginPath();
    cx.moveTo(-12, 2);
    cx.lineTo(-22, 16);
    cx.lineTo(-6, 12);
    cx.closePath();
    cx.fill();
  } else if (ch.sprite === 'hippo') {
    drawEllipse(cx, 0, 5, 20, 15, ch.color, ch.outline, 2);
    drawCircle(cx, -9, -7, 5, ch.color, ch.outline, 2);
    drawCircle(cx, 9, -7, 5, ch.color, ch.outline, 2);
    drawEllipse(cx, 0, 0, 12, 9, '#b8a7d4');
    drawCircle(cx, -4, -2, 1.8, '#2e2338');
    drawCircle(cx, 4, -2, 1.8, '#2e2338');
    drawCircle(cx, -3, 4, 1.6, '#6f5b88');
    drawCircle(cx, 3, 4, 1.6, '#6f5b88');
  } else if (ch.sprite === 'seal') {
    drawEllipse(cx, 0, 5, 18, 12, ch.color, ch.outline, 2);
    drawCircle(cx, 10, -3, 9, ch.color, ch.outline, 2);
    cx.fillStyle = ch.color;
    cx.beginPath();
    cx.moveTo(-16, 6);
    cx.lineTo(-26, -1);
    cx.lineTo(-26, 13);
    cx.closePath();
    cx.fill();
    drawCircle(cx, 12, -5, 1.8, '#1f3444');
    drawCircle(cx, 7, 2, 1.4, '#1f3444');
  } else if (ch.sprite === 'panda') {
    drawEllipse(cx, 0, 5, 17, 13, '#f4f4f4', ch.outline, 2);
    drawCircle(cx, -8, -9, 5, '#1c1c1c');
    drawCircle(cx, 8, -9, 5, '#1c1c1c');
    drawCircle(cx, 0, -2, 10, '#f4f4f4', ch.outline, 2);
    drawEllipse(cx, -4, -3, 3, 4, '#1c1c1c');
    drawEllipse(cx, 4, -3, 3, 4, '#1c1c1c');
    drawCircle(cx, -4, -3, 1.4, '#fff');
    drawCircle(cx, 4, -3, 1.4, '#fff');
    drawCircle(cx, 0, 2, 2, '#1c1c1c');
  } else if (ch.sprite === 'keeper') {
    drawCircle(cx, 0, -4, 10, '#f2d6b0', '#69492b', 2);
    fillRoundRect(cx, -6, -18, 20, 8, 4, ch.accent, '#2d4927', 1.4);
    fillRoundRect(cx, -12, 6, 24, 22, 8, '#7f5d3e', '#4d3726', 2);
    drawLine(cx, -8, 12, -16, 26, '#4d3726', 3);
    drawLine(cx, 8, 12, 16, 26, '#4d3726', 3);
  } else if (ch.sprite === 'captain') {
    drawCircle(cx, 0, -4, 10, '#f3d7ae', '#744b23', 2);
    fillRoundRect(cx, -10, -18, 22, 8, 4, '#ffffff', '#8f2f2f', 1.6);
    fillRoundRect(cx, -14, 6, 28, 24, 8, '#d8a95a', '#744b23', 2);
    drawLine(cx, -10, 12, -16, 28, '#744b23', 3);
    drawLine(cx, 10, 12, 16, 28, '#744b23', 3);
  } else if (ch.sprite === 'rocket') {
    fillRoundRect(cx, -9, -16, 18, 40, 9, '#f0f0f0', '#464646', 2);
    cx.fillStyle = '#d76039';
    cx.beginPath();
    cx.moveTo(-9, 14);
    cx.lineTo(-18, 24);
    cx.lineTo(-6, 20);
    cx.closePath();
    cx.fill();
    cx.beginPath();
    cx.moveTo(9, 14);
    cx.lineTo(18, 24);
    cx.lineTo(6, 20);
    cx.closePath();
    cx.fill();
    cx.fillStyle = '#d76039';
    cx.beginPath();
    cx.moveTo(0, -28);
    cx.lineTo(-10, -12);
    cx.lineTo(10, -12);
    cx.closePath();
    cx.fill();
    drawCircle(cx, 0, -2, 4, '#84cbe8', '#3f7e9a', 1.4);
    drawLine(cx, -4, 24, -8, 32, '#444', 3);
    drawLine(cx, 4, 24, 8, 32, '#444', 3);
  }
  cx.restore();
}

function drawPlayer(cx) {
  const bob = Math.sin(state.player.bob) * 1.5;
  cx.save();
  cx.translate(state.player.x, state.player.y + bob);
  if (state.player.facing === 'left') cx.scale(-1, 1);
  drawEllipse(cx, 0, 18, 15, 6, 'rgba(0,0,0,.18)');
  drawCircle(cx, 0, -4, 10, '#f4dcb4', '#6a4923', 2);
  fillRoundRect(cx, -10, -18, 18, 8, 4, '#e8cf65', '#8c7222', 1.4);
  fillRoundRect(cx, -14, 6, 28, 22, 8, '#5f84d0', '#344d84', 2);
  fillRoundRect(cx, 6, 10, 10, 12, 4, '#c68652', '#7a4f2d', 1.4);
  drawLine(cx, -8, 12, -16, 28, '#374e7d', 3);
  drawLine(cx, 8, 12, 16, 28, '#374e7d', 3);
  drawLine(cx, -10, 10, -18, 2, '#374e7d', 3);
  cx.restore();
}

function drawAreaDynamics(area) {
  const qState = currentQuestState();
  if (area.id !== 'picnic') {
    const g = area.gateRect;
    if (qState.solved) {
      drawLine(ctx, g.x + 6, g.y + 18, g.x + 34, g.y + 132, '#7f5a2c', 7);
      drawText(ctx, 'Open', g.x + 20, g.y - 12, '#76531f', 16, 'center', 'bold');
    } else {
      fillRoundRect(ctx, g.x, g.y, g.w, g.h, 10, '#c89f5a', '#7f5a2c', 3);
      drawLine(ctx, g.x + 10, g.y + 20, g.x + 10, g.y + g.h - 20, '#7f5a2c', 4);
      drawLine(ctx, g.x + 30, g.y + 20, g.x + 30, g.y + g.h - 20, '#7f5a2c', 4);
      drawText(ctx, '?', g.x + g.w / 2, g.y + g.h / 2 + 10, '#fff5cb', 30, 'center', 'bold');
    }
  } else {
    const g = area.gateRect;
    if (qState.solved) {
      fillRoundRect(ctx, g.x, g.y + 20, g.w, g.h - 12, 14, '#dba35f', '#8d5e28', 3);
      fillRoundRect(ctx, g.x + 12, g.y - 12, g.w - 24, 38, 12, '#f5d19d', '#8d5e28', 3);
      drawText(ctx, 'Open', g.x + g.w / 2, g.y + 64, '#70481c', 18, 'center', 'bold');
    } else {
      fillRoundRect(ctx, g.x, g.y + 20, g.w, g.h - 12, 14, '#c98e4d', '#7c4f22', 3);
      fillRoundRect(ctx, g.x + 8, g.y, g.w - 16, 40, 12, '#d8a35a', '#7c4f22', 3);
      drawCircle(ctx, g.x + g.w / 2, g.y + 54, 8, '#f7e2b9', '#7c4f22', 2);
    }
  }

  if (area.leftExit) {
    drawText(ctx, '<', 24, 300, 'rgba(119,82,34,.7)', 26, 'center', 'bold');
  }
  if (area.rightExit && currentQuestState().solved) {
    drawText(ctx, '>', 778, 300, 'rgba(119,82,34,.7)', 26, 'center', 'bold');
  }
}

function drawHud() {
  fillRoundRect(ctx, 18, 18, 764, 68, 18, 'rgba(252,247,233,.88)', 'rgba(119,82,34,.35)', 2);
  drawText(ctx, currentArea().name, 38, 44, '#7d5621', 22, 'left', 'bold');
  drawText(ctx, objectiveText(), 38, 70, '#584020', 14, 'left', 'bold');

  drawText(ctx, 'Fireflies', 612, 40, '#7d5621', 13, 'center', 'bold');
  for (let i = 0; i < state.maxFireflies; i++) {
    const lit = i < state.fireflies;
    drawCircle(ctx, 566 + i * 24, 62, 8, lit ? '#ffd86f' : '#ddd0b0', lit ? '#a87a1e' : '#9b8d6a', 2);
    drawCircle(ctx, 566 + i * 24 - 6, 58, 3, lit ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.25)');
    drawCircle(ctx, 566 + i * 24 + 6, 58, 3, lit ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.25)');
  }

  drawText(ctx, 'Stickers', 718, 40, '#7d5621', 13, 'center', 'bold');
  for (let i = 0; i < 4; i++) {
    const x = 682 + i * 18;
    const y = 62;
    const fill = i < state.stickers ? '#f2c85a' : '#eadbb4';
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#9a7120';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const ang = -Math.PI / 2 + j * Math.PI / 5;
      const rad = j % 2 === 0 ? 8 : 3.5;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawToast() {
  if (!state.toast) return;
  fillRoundRect(ctx, 166, 94, 468, 38, 18, 'rgba(33,56,75,.82)', 'rgba(255,245,210,.45)', 2);
  drawText(ctx, state.toast.text, 400, 118, '#fff4cf', 15, 'center', 'bold');
}

function drawPrompt(target) {
  if (!target || state.phase !== 'explore') return;
  const label = target.type === 'npc' ? 'Talk' : 'Solve';
  const bx = target.x;
  const by = target.y - 42;
  fillRoundRect(ctx, bx - 34, by - 16, 68, 24, 12, 'rgba(30,43,55,.84)', 'rgba(255,239,201,.45)', 2);
  drawText(ctx, label, bx, by + 1, '#fff4cf', 13, 'center', 'bold', 'middle');
}

function drawWorld() {
  const area = currentArea();
  ctx.drawImage(areaBackdrops[state.areaIndex], 0, 0);
  drawAreaDynamics(area);

  const npcs = currentAreaNpcs();
  for (let i = 0; i < npcs.length; i++) {
    drawCharacter(ctx, npcs[i].char, npcs[i].x, npcs[i].y, npcs[i].face, npcs[i].bob, 1);
  }

  if (state.phase === 'ending') {
    for (let i = 0; i < state.celebrationGuests.length; i++) {
      const guest = state.celebrationGuests[i];
      drawCharacter(ctx, guest.char, guest.x, guest.y + Math.sin(state.celebrationTime * 2 + guest.drift) * 4, 'right', state.celebrationTime * 5 + guest.drift, 0.95);
    }
  }

  drawPlayer(ctx);
  drawHud();
  drawToast();
  drawPrompt(nearbyInteractable());
  if (mobileControlsOn()) drawMobileControls();
}

function drawMobileControls() {
  const layout = mobileLayout();
  ctx.save();
  ctx.globalAlpha = 0.92;
  drawCircle(ctx, layout.dpad.cx, layout.dpad.cy, 38, 'rgba(32,46,60,.55)', 'rgba(255,244,207,.34)', 2);
  drawCircle(ctx, layout.action.cx, layout.action.cy, 40, 'rgba(32,46,60,.65)', 'rgba(255,244,207,.42)', 2);
  drawText(ctx, '▲', layout.dpad.cx, layout.dpad.cy - 24, '#fff4cf', 18, 'center', 'bold');
  drawText(ctx, '▼', layout.dpad.cx, layout.dpad.cy + 30, '#fff4cf', 18, 'center', 'bold');
  drawText(ctx, '◀', layout.dpad.cx - 26, layout.dpad.cy + 6, '#fff4cf', 18, 'center', 'bold');
  drawText(ctx, '▶', layout.dpad.cx + 26, layout.dpad.cy + 6, '#fff4cf', 18, 'center', 'bold');
  drawText(ctx, 'A', layout.action.cx, layout.action.cy + 6, '#fff4cf', 22, 'center', 'bold');
  drawText(ctx, 'Talk', layout.action.cx, layout.action.cy + 58, '#fff4cf', 12, 'center', 'bold');
  ctx.restore();
}

function drawTitle() {
  const bg = areaBackdrops[3];
  ctx.drawImage(bg, 0, 0);
  drawCharacter(ctx, 'samster', 156, 424, 'right', state.phaseTime * 5, 1);
  drawCharacter(ctx, 'duck', 228, 404, 'right', state.phaseTime * 5 + 0.7, 1);
  drawCharacter(ctx, 'hippo', 304, 430, 'right', state.phaseTime * 5 + 1.1, 1);
  drawCharacter(ctx, 'rocket', 648, 406, 'right', state.phaseTime * 5 + 1.8, 1);

  fillRoundRect(ctx, 104, 88, 592, 290, 28, 'rgba(27,44,59,.82)', 'rgba(255,239,202,.52)', 2);
  drawText(ctx, DIALOG.title.title, 400, 162, '#fff0b6', 42, 'center', 'bold');
  drawText(ctx, DIALOG.title.subtitle, 400, 204, '#d9e6ef', 18, 'center', 'bold');
  drawText(ctx, DIALOG.title.start, 400, 262, '#fff4cf', 20, 'center', 'bold');
  drawText(ctx, DIALOG.title.controls, 400, 300, '#d9e6ef', 15, 'center', 'bold');
  drawText(ctx, DIALOG.title.hint, 400, 332, '#d9e6ef', 15, 'center', 'bold');

  if (state.best) {
    const bestLine = 'Best run: ' + state.best.stickers + ' stickers, ' + state.best.fireflies + ' fireflies saved, ' + state.best.seconds + 's';
    drawText(ctx, bestLine, 400, 366, '#ffe3a2', 15, 'center', 'bold');
  }
}

function drawDialogPhase() {
  drawWorld();
  const line = state.dialog.lines[state.dialog.index];
  MuckoEngine.renderDialog(ctx, {
    x: 48,
    y: 384,
    w: 704,
    h: 126,
    speaker: line.speaker,
    speakerColor: line.speakerColor || '#ffeaa1',
    text: line.text,
    color: 'rgba(13,27,39,.92)',
    border: 'rgba(255,241,204,.42)',
    fontSize: 15,
  });
  drawText(ctx, 'Tap or press Space to continue', 726, 494, '#cfd9df', 12, 'right', 'bold');
}

function drawClueCard(rect, quest, questState, clueIndex) {
  const info = getQuestSideInfo(currentArea().questIndex, clueIndex);
  const char = CHARACTERS[info.charId];
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, '#f8f1de', '#b58d48', 2);
  drawText(ctx, char.name, rect.x + 20, rect.y + 28, '#7b5621', 18, 'left', 'bold');
  drawText(ctx, info.number + ' ' + info.item, rect.x + 20, rect.y + 52, '#473319', 14, 'left', 'bold');
  drawCountDots(ctx, rect.x + 22, rect.y + 78, quest, clueIndex, questState.pair[clueIndex]);
}

function drawQuizPhase() {
  drawWorld();
  const layout = questionLayout();
  const quest = QUESTS[state.quiz.questIndex];
  const questState = state.quests[state.quiz.questIndex];
  fillRoundRect(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, 26, 'rgba(247,241,225,.96)', 'rgba(130,92,38,.52)', 3);
  drawText(ctx, quest.name, 400, 100, '#815920', 28, 'center', 'bold');
  drawText(ctx, quest.prompt, 400, 122, '#584020', 15, 'center', 'bold');
  drawClueCard(layout.cardA, quest, questState, 0);
  drawClueCard(layout.cardB, quest, questState, 1);
  drawText(ctx, questState.pair[0] + ' + ' + questState.pair[1] + ' = ?', 400, layout.eqY, '#583f19', 38, 'center', 'bold');

  for (let i = 0; i < layout.optionRects.length; i++) {
    const rect = layout.optionRects[i];
    const selected = i === state.quiz.selected;
    const hovered = rectContains(rect, mx, my);
    const fill = selected || hovered ? '#f2d788' : '#fff7e4';
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, fill, selected ? '#b77d1f' : '#bca57a', selected ? 3 : 2);
    drawText(ctx, String(state.quiz.options[i]), rect.x + rect.w / 2, rect.y + 46, '#5a3d16', 34, 'center', 'bold');
  }

  fillRoundRect(ctx, layout.hintRect.x, layout.hintRect.y, layout.hintRect.w, layout.hintRect.h, 14, '#e7f1f5', '#7a96a8', 2);
  drawText(ctx, 'Use 1 firefly for a counting frame', layout.hintRect.x + layout.hintRect.w / 2, layout.hintRect.y + 24, '#39596c', 15, 'center', 'bold');

  if (state.quiz.hintShown) {
    drawTenFrame(ctx, 278, 314, quest, questState.pair[0], questState.pair[1]);
  }
  if (state.quiz.feedback) {
    drawText(ctx, state.quiz.feedback, 400, 436, '#8b4d27', 15, 'center', 'bold');
  } else {
    drawText(ctx, DIALOG.hintReady, 400, 436, '#6d5830', 15, 'center', 'bold');
  }
}

function drawEnding() {
  drawWorld();
  const pulse = 0.5 + 0.5 * Math.sin(state.celebrationTime * 4);
  fillRoundRect(ctx, 148, 110, 504, 198, 28, 'rgba(24,41,57,.78)', 'rgba(255,241,204,.58)', 2);
  drawText(ctx, 'Picnic Complete', 400, 172, '#ffe9aa', 36, 'center', 'bold');
  drawText(ctx, 'You opened all 4 puzzles and saved ' + state.fireflies + ' fireflies.', 400, 214, '#eef7ff', 18, 'center', 'bold');
  drawText(ctx, 'Press Space or tap to play again.', 400, 248, '#ffe9aa', 17 + pulse, 'center', 'bold');
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  switch (state.phase) {
    case 'title':
      drawTitle();
      break;
    case 'dialog':
      drawDialogPhase();
      break;
    case 'explore':
      drawWorld();
      break;
    case 'quiz':
      drawQuizPhase();
      break;
    case 'ending':
      drawEnding();
      break;
  }
}

function init() {
  areaBackdrops = AREA_DEFS.map(buildAreaBackdrop);
  resetToTitle();
  MuckoEngine.makeLoop(update, draw, 60);
}

init();
