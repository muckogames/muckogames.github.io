'use strict';

// ── Seeded RNG (consistent star positions) ────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

// ── Game State ────────────────────────────────────────────────────────────
let gs;
function resetGS() {
  gs = {
    names: ['','','','',''],
    health: [100,100,100,100,100],
    alive: [true,true,true,true,true],
    shipClass: 2,
    food: 0, coal: 0, medicine: 0, money: 0, lifeboats: 0,
    progress: 0, dayNum: 0,
    speed: 2, rations: 2,
    visitedCherbourg: false, visitedQueenstown: false,
    receivedIceWarning: false, slowedForIce: false, coalCrisisShown: false,
    icebergHits: 0, mineHits: 0, sank: false, britannicSank: false,
    lastFishDay: -10,
    log: [],
    init() {
      const cls = this.shipClass;
      if      (cls===1) { this.food=400; this.coal=700; this.medicine=8; this.money=400; this.lifeboats=8; }
      else if (cls===2) { this.food=260; this.coal=600; this.medicine=5; this.money=150; this.lifeboats=5; }
      else              { this.food=150; this.coal=500; this.medicine=2; this.money=60;  this.lifeboats=3; }
      this.log = [
        'April 10, 1912 — Southampton, England',
        'The RMS Titanic departs on her maiden voyage to New York City.',
        'She is the largest ship ever built. Good luck.',
      ];
    },
    aliveCount() { return this.alive.filter(Boolean).length; },
    dateStr()    { return `April ${10 + this.dayNum}, 1912`; },
    locationName() {
      if (this.progress <  8)  return 'English Channel';
      if (this.progress < 16)  return 'Near Cherbourg, France';
      if (this.progress < 30)  return 'Near Queenstown, Ireland';
      if (this.progress < 60)  return 'North Atlantic';
      if (this.progress < 88)  return 'Grand Banks — Iceberg Alley Ahead';
      return 'Iceberg Alley';
    },
    addLog(msg, cls='') { this.log.push({ msg, cls }); },
  };
}

// ── Local high-score helpers ──────────────────────────────────────────────
function getHS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveHS(key, entry, limit = 10) {
  const sc = getHS(key);
  sc.push(entry);
  sc.sort((a, b) => b.score - a.score);
  const trimmed = sc.slice(0, limit);
  localStorage.setItem(key, JSON.stringify(trimmed));
  return trimmed.findIndex(e => e === trimmed.find(x => x.score === entry.score && x.date === entry.date)) + 1;
}

// ── Screen management ─────────────────────────────────────────────────────
let _cleanup = null;
function goTo(buildFn) {
  if (_cleanup) { _cleanup(); _cleanup = null; }
  const app = document.getElementById('app');
  app.innerHTML = '';
  _cleanup = buildFn(app) || null;
}

// ── Modal (replaces JOptionPane) ──────────────────────────────────────────
function showModal(title, bodyText, buttons) {
  return new Promise(resolve => {
    // Parse leading emoji from title for big icon badge
    const tEm = title.match(/^\s*(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
    const titleEl = document.getElementById('modal-title');
    titleEl.innerHTML = '';
    if (tEm) {
      const big = document.createElement('span');
      big.className = 'ev-big'; big.textContent = tEm[1];
      titleEl.appendChild(big);
      titleEl.appendChild(document.createTextNode(title.slice(tEm[0].length).trim()));
    } else {
      titleEl.textContent = title;
    }
    document.getElementById('modal-body').textContent  = bodyText;
    const btnsDiv = document.getElementById('modal-btns');
    btnsDiv.innerHTML = '';
    buttons.forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = b.cls || '';
      // Parse leading emoji from label
      const lEm = b.label.match(/^\s*(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
      if (b.icon || lEm) {
        const ic = document.createElement('span');
        ic.className = 'ch-icon';
        ic.textContent = b.icon || lEm[1];
        const tx = document.createElement('span');
        tx.className = 'ch-txt';
        tx.textContent = lEm ? b.label.slice(lEm[0].length).trim() : b.label;
        btn.appendChild(ic); btn.appendChild(tx);
      } else {
        btn.textContent = b.label;
      }
      btn.onclick = () => {
        document.getElementById('modal-overlay').classList.add('hidden');
        resolve(i);
      };
      btnsDiv.appendChild(btn);
    });
    document.getElementById('modal-overlay').classList.remove('hidden');
  });
}
const showAlert = (title, body) => showModal(title, body, [{ label: 'OK', cls: 'btn-green' }]);

// ── Ship drawing (shared between title & map) ─────────────────────────────
function drawShip(ctx, cx, baseY, len) {
  ctx.fillStyle = '#0f0f23';
  ctx.beginPath();
  ctx.moveTo(cx - len/2,      baseY + 8);
  ctx.lineTo(cx - len/2 + 15, baseY + 18);
  ctx.lineTo(cx + len/2 - 30, baseY + 18);
  ctx.lineTo(cx + len/2 + 5,  baseY + 5);
  ctx.lineTo(cx + len/2 - 5,  baseY - 3);
  ctx.lineTo(cx - len/2 + 5,  baseY - 3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(220,210,190,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - len/2 + 18, baseY + 4); ctx.lineTo(cx + len/2 - 5, baseY + 4); ctx.stroke();
  ctx.fillStyle = '#c8c3b2';
  ctx.fillRect(cx - len/4 - 20, baseY - 28, len/2 + 20, 25);
  const fPos = [cx-90, cx-40, cx+10, cx+60];
  const fCol = ['#b43c14','#b43c14','#b43c14','#505050'];
  fPos.forEach((fx, i) => {
    ctx.fillStyle = '#0f0f23'; ctx.fillRect(fx-8, baseY-58, 16, 32);
    ctx.fillStyle = fCol[i];   ctx.fillRect(fx-7, baseY-60, 14, 8);
    ctx.fillStyle = 'rgba(80,80,90,0.35)';
    ctx.beginPath(); ctx.ellipse(fx, baseY-72, 6, 12, 0, 0, Math.PI*2); ctx.fill();
  });
  ctx.strokeStyle = '#0f0f23'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - len/2 + 40, baseY-3); ctx.lineTo(cx - len/2 + 40, baseY-75); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 30, baseY-28); ctx.lineTo(cx + 30, baseY-75); ctx.stroke();
}

// ═════════════════════════════════════════════════════════════════════════════
// TITLE SCREEN
// ═════════════════════════════════════════════════════════════════════════════
function buildHighScores(app) {
  const hsAll = getHS('mucko_hs_ttrail');
  let tableHtml;
  if (hsAll.length === 0) {
    tableHtml = '<p style="color:#aaa;text-align:center;padding:20px">No crossings recorded yet.</p>';
  } else {
    tableHtml = `<table class="ending-hs-table">
      <tr class="ending-hs-header"><th>#</th><th>Score</th><th>Rating</th><th>Outcome</th><th>Date</th></tr>
      ${hsAll.slice(0,8).map((e,i) => `<tr>
        <td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
        <td>${e.score.toLocaleString()}</td>
        <td>${e.rating}</td>
        <td>${e.sank ? '💀 Sank' : '⚓ Safe'}</td>
        <td>${e.date}</td>
      </tr>`).join('')}
    </table>`;
  }
  const div = document.createElement('div');
  div.id = 'ending-screen';
  div.innerHTML = `
    <div class="ending-title safe">🏆 Best Crossings — This Device</div>
    <div class="ending-hs">${tableHtml}</div>
    <div class="ending-btns">
      <button id="hs-back" class="btn-green btn-large">← Back to Title</button>
    </div>`;
  app.appendChild(div);
  div.querySelector('#hs-back').addEventListener('click', () => goTo(buildTitle));
}

function buildTitle(app) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:820px;height:620px;';
  const canvas = document.createElement('canvas');
  canvas.width = 820; canvas.height = 620;
  canvas.style.cssText = 'display:block;cursor:pointer;width:100%;height:100%;';
  wrap.appendChild(canvas);

  const hsBtn = document.createElement('button');
  hsBtn.textContent = '🏆 High Scores';
  hsBtn.style.cssText = [
    'position:absolute', 'bottom:36px', 'right:20px',
    'background:rgba(15,10,25,0.78)', 'color:#d4af37',
    'border:1px solid #d4af37', 'border-radius:6px',
    'padding:7px 16px', 'font:bold 13px Georgia,serif',
    'cursor:pointer',
  ].join(';');
  hsBtn.addEventListener('click', e => { e.stopPropagation(); cancelAnimationFrame(raf); goTo(buildHighScores); });
  wrap.appendChild(hsBtn);
  app.appendChild(wrap);
  const ctx = canvas.getContext('2d');

  const rng = seededRng(777);
  const stars = Array.from({length: 120}, () => ({
    x: rng() * 820, y: rng() * (620*2/3 - 40),
    r: rng() > 0.7 ? 2 : 1, ph: rng() * Math.PI * 2,
  }));

  let blink = 0, raf;
  function draw() {
    const w = 820, h = 620;
    // Sky
    const sky = ctx.createLinearGradient(0,0,0,h*2/3);
    sky.addColorStop(0,'#05051e'); sky.addColorStop(1,'#051941');
    ctx.fillStyle = sky; ctx.fillRect(0,0,w,h*2/3);
    // Ocean
    const sea = ctx.createLinearGradient(0,h*2/3,0,h);
    sea.addColorStop(0,'#051941'); sea.addColorStop(1,'#0a3778');
    ctx.fillStyle = sea; ctx.fillRect(0,h*2/3,w,h/3);
    // Stars
    stars.forEach(s => {
      const a = (0.4 + 0.6 * Math.abs(Math.sin(blink + s.ph))).toFixed(2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });
    // Moon
    ctx.fillStyle = 'rgba(255,250,200,0.8)';
    ctx.beginPath(); ctx.arc(730,60,30,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#05051e';
    ctx.beginPath(); ctx.arc(742,56,30,0,Math.PI*2); ctx.fill();
    // Ship
    drawShip(ctx, w/2, h*2/3 - 5, 500);
    // Water shimmer
    ctx.fillStyle = 'rgba(30,80,160,0.3)';  ctx.fillRect(0, h*2/3+17, w, 12);
    ctx.fillStyle = 'rgba(10,50,120,0.25)'; ctx.fillRect(0, h*2/3+29, w, 8);
    // Title shadow
    ctx.font = 'bold 68px Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText('TITANIC TRAIL', w/2+3, 108);
    ctx.fillStyle = '#d4af37';           ctx.fillText('TITANIC TRAIL', w/2, 105);
    // Subtitle
    ctx.font = 'italic 19px Georgia,serif'; ctx.fillStyle = '#fff8d7';
    ctx.fillText('A Maiden Voyage \u2014 April 1912', w/2, 138);
    // Divider
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w/2-190,148); ctx.lineTo(w/2+190,148); ctx.stroke();
    // Blinking prompt
    const a2 = (0.4 + 0.6 * Math.abs(Math.sin(blink * 1.5))).toFixed(2);
    ctx.font = '16px Georgia,serif';
    ctx.fillStyle = `rgba(220,210,180,${a2})`;
    ctx.fillText('Click anywhere to begin your voyage', w/2, h - 28);
    // Credit
    ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(160,150,130,0.65)';
    ctx.fillText('In memory of the 1,517 souls lost on April 15, 1912', w/2, h - 8);
    blink += 0.06;
    raf = requestAnimationFrame(draw);
  }
  draw();
  canvas.addEventListener('click', () => goTo(buildSetup));
  return () => cancelAnimationFrame(raf);
}

// ═════════════════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ═════════════════════════════════════════════════════════════════════════════
function buildSetup(app) {
  resetGS();
  const classes = [
    { id:1, name:'First Class',          nameCol:'#d4af37', tone:'green',  big:'👑', stars:'⭐',
      lines:['Luxury cabins on upper decks.','Plentiful food, coal & medicine.','Lifeboat access: Excellent (8 seats)','Cost: £870 per berth'] },
    { id:2, name:'Second Class',         nameCol:'#fff8d7', tone:'yellow', big:'🎩', stars:'⭐⭐',
      lines:['Comfortable mid-ship cabins.','Adequate resources for the voyage.','Lifeboat access: Good (5 seats)','Cost: £12 per berth'] },
    { id:3, name:'Third Class (Steerage)',nameCol:'#8c8472', tone:'red',    big:'⚙️', stars:'⭐⭐⭐',
      lines:['Below-deck shared quarters.','Limited resources — manage carefully!','Lifeboat access: Limited (3 seats)','Cost: £3 per berth'] },
  ];
  const defaults = ['John','Mary','Thomas','Alice','Robert'];

  const div = document.createElement('div');
  div.id = 'setup-screen';
  div.innerHTML = `
    <div class="setup-title">Passenger Manifest \u2014 RMS Titanic</div>
    <div class="setup-cols">
      <div class="setup-col" id="class-col">
        <div class="section-label">Choose Your Class:</div>
        ${classes.map(c => `
          <div class="class-card cls-${c.id} tone-${c.tone}" id="card-${c.id}" data-cls="${c.id}">
            <label>
              <input type="radio" name="shipclass" value="${c.id}" ${c.id===2?'checked':''}>
              <div class="class-row-inner">
                <div class="class-big" aria-hidden="true">${c.big}</div>
                <div class="class-mid">
                  <div class="class-stars" aria-hidden="true">${c.stars}</div>
                  <span class="class-name" style="color:${c.nameCol}">${c.name}</span>
                  <div class="class-detail">${c.lines.join('<br>')}</div>
                </div>
              </div>
            </label>
          </div>`).join('')}
      </div>
      <div class="setup-col">
        <div class="section-label">Enter Passenger Names:</div>
        <div class="hint">(5 passengers \u2014 first is the leader)</div>
        ${defaults.map((d,i) => `
          <div class="name-row">
            <label class="${i===0?'leader':''}">${i===0?'Leader:':'Person '+(i+1)+':'}</label>
            <input type="text" id="name-${i}" value="${d}" maxlength="20">
          </div>`).join('')}
        <div class="hist-note">Historical note: The Titanic carried<br>2,224 passengers and crew on her only voyage.</div>
      </div>
    </div>
    <div class="setup-bottom">
      <button id="board-btn" class="btn-green btn-large">&nbsp;&nbsp;Board the Titanic&nbsp;&nbsp;</button>
    </div>`;
  app.appendChild(div);

  // Class card click highlighting
  div.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => {
      card.querySelector('input[type=radio]').checked = true;
      div.querySelectorAll('.class-card').forEach(c =>
        c.classList.toggle('selected', c === card));
    });
  });
  div.querySelector('#card-2').classList.add('selected');

  div.querySelector('#board-btn').addEventListener('click', () => {
    const cls = parseInt(div.querySelector('input[name=shipclass]:checked').value);
    gs.shipClass = cls;
    for (let i = 0; i < 5; i++) {
      const v = div.querySelector(`#name-${i}`).value.trim();
      gs.names[i] = v || `Passenger ${i+1}`;
    }
    gs.init();
    goTo(buildVoyage);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// VOYAGE SCREEN
// ═════════════════════════════════════════════════════════════════════════════
let vBusy = false; // prevent button spam during async events

function buildVoyage(app) {
  vBusy = false;
  const div = document.createElement('div');
  div.id = 'voyage-screen';
  div.innerHTML = `
    <canvas id="map-strip" width="820" height="75"></canvas>
    <canvas id="sail-canvas" width="820" height="80"></canvas>
    <div id="voyage-main">
      <div id="log-panel"></div>
      <div id="status-panel"></div>
    </div>
    <div id="voyage-btns">
      <button id="btn-continue" class="btn-green">▶ Continue Voyage</button>
      <button id="btn-rest"     class="btn-teal">💤 Rest for the Day</button>
      <button id="btn-speed"    class="btn-amber">⚙️ Change Speed</button>
      <button id="btn-rations"  class="btn-amber">🍽️ Change Rations</button>
      <button id="btn-status">📋 Full Status</button>
      <button id="btn-fish"     class="btn-teal" disabled>🎣 Go Fishing</button>
    </div>`;
  app.appendChild(div);

  renderMapStrip();
  refreshLog();
  refreshStatus();

  div.querySelector('#btn-continue').addEventListener('click', () => doAdvance(false));
  div.querySelector('#btn-rest').addEventListener('click',     () => doAdvance(true));
  div.querySelector('#btn-speed').addEventListener('click',   () => doChangeSpeed());
  div.querySelector('#btn-rations').addEventListener('click', () => doChangeRations());
  div.querySelector('#btn-status').addEventListener('click',  () => doFullStatus());
  div.querySelector('#btn-fish').addEventListener('click',    () => doFishing());

  return startSailAnim(div.querySelector('#sail-canvas'));
}

function startSailAnim(canvas) {
  const ctx = canvas.getContext('2d');
  const W = 820, H = 80;
  let t = 0, rafId;

  const rng = seededRng(42);
  const stars = Array.from({length: 55}, () => ({
    x: rng() * W, y: rng() * H * 0.48,
    r: rng() * 1.1 + 0.3, twinkle: rng() * Math.PI * 2,
  }));

  function draw() {
    t++;
    ctx.clearRect(0, 0, W, H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#010818'); sky.addColorStop(1, '#051540');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.62);

    // Stars
    stars.forEach(s => {
      const a = 0.45 + 0.45 * Math.sin(s.twinkle + t * 0.02);
      ctx.fillStyle = `rgba(255,255,235,${a.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // Moon
    ctx.fillStyle = 'rgba(255,253,215,0.92)';
    ctx.beginPath(); ctx.arc(772, 13, 9, 0, Math.PI * 2); ctx.fill();
    // Moonlight shimmer on sea
    ctx.fillStyle = 'rgba(255,250,180,0.06)';
    ctx.fillRect(730, H * 0.58, 84, H * 0.42);

    // Ocean
    const seaY = H * 0.6;
    const sea = ctx.createLinearGradient(0, seaY, 0, H);
    sea.addColorStop(0, '#061c42'); sea.addColorStop(1, '#030e22');
    ctx.fillStyle = sea; ctx.fillRect(0, seaY, W, H - seaY);

    // Waves
    for (let i = 0; i < 5; i++) {
      const wy = seaY + 3 + i * 4;
      const speed = 0.014 + i * 0.004;
      ctx.strokeStyle = `rgba(100,150,220,${0.22 - i * 0.03})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 5) {
        const y = wy + Math.sin(x * 0.018 + t * speed) * (1.8 - i * 0.2);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Ship — same drawShip as title screen, scaled to fit the 80-px canvas
    const bob  = Math.sin(t * 0.022) * 1.4;
    const shipCX  = 300;
    const shipBaseY = seaY + bob;
    const sc = 0.5;   // scale factor so the 75-px-tall ship fits above seaY

    ctx.save();
    ctx.translate(shipCX, shipBaseY);
    ctx.scale(sc, sc);
    drawShip(ctx, 0, 0, 280);
    ctx.restore();

    // Animated smoke rising from the first three funnels
    // Funnel local-x positions inside drawShip: -90, -40, +10, +60
    [-90, -40, 10].forEach((lx, i) => {
      const fx = shipCX + lx * sc;
      const fTopY = shipBaseY - 72 * sc;  // top of funnel in screen coords
      for (let p = 0; p < 5; p++) {
        const pf = ((t * 0.012) + p * 0.28 + i * 0.6) % 1;
        const px = fx + Math.sin(pf * 5) * 2.5;
        const py = fTopY - pf * 16;
        const pr = 1.2 + pf * 4.5;
        ctx.fillStyle = `rgba(72,72,88,${(0.36 * (1 - pf)).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      }
    });

    rafId = requestAnimationFrame(draw);
  }

  draw();
  return () => cancelAnimationFrame(rafId);
}


function setBusy(b) {
  vBusy = b;
  ['btn-continue','btn-rest','btn-speed','btn-rations','btn-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = b;
  });
  // Fish button has its own availability logic — only enable when not busy AND conditions met
  const fishEl = document.getElementById('btn-fish');
  if (fishEl && b) fishEl.disabled = true;
  // (re-enabling happens in refreshStatus)
}

function renderMapStrip() {
  const canvas = document.getElementById('map-strip');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = 820, h = 75;
  // Background
  const bg = ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#05051e'); bg.addColorStop(1,'#0a1e4a');
  ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
  ctx.strokeRect(0,0,w,h);

  const y = h/2 + 8;
  // Dashed route line
  ctx.setLineDash([6,4]); ctx.strokeStyle = 'rgba(100,130,200,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(w-30,y); ctx.stroke();
  ctx.setLineDash([]);

  // Waypoints
  const waypoints = [
    {prog:0,  name:'Southampton'},
    {prog:8,  name:'Cherbourg'},
    {prog:16, name:'Queenstown'},
    {prog:50, name:'Open Atlantic'},
    {prog:80, name:'Grand Banks'},
    {prog:100,name:'New York'},
  ];
  ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  waypoints.forEach((wp, i) => {
    const x = 30 + (w-60) * wp.prog / 100;
    const passed = gs.progress >= wp.prog;
    ctx.fillStyle = passed ? '#d4af37' : '#5a5444';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = passed ? '#d4af37' : '#5a5444';
    ctx.fillText(wp.name, x, i%2===0 ? y-10 : y+18);
  });

  // Ship icon
  const sx = 30 + (w-60) * gs.progress / 100;
  ctx.fillStyle = '#c8c3b2';
  ctx.beginPath();
  ctx.moveTo(sx-12,y+6); ctx.lineTo(sx-10,y+12); ctx.lineTo(sx+12,y+12);
  ctx.lineTo(sx+14,y+4); ctx.lineTo(sx+10,y+2); ctx.lineTo(sx-10,y+2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3c3c50';
  ctx.fillRect(sx-6,y-4,12,6);
  ctx.fillStyle = '#b43c14'; ctx.fillRect(sx-5,y-10,5,7); ctx.fillRect(sx+1,y-10,5,7);

  // Header text
  ctx.font = 'bold 13px Georgia,serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#d4af37';
  ctx.fillText(`VOYAGE PROGRESS: ${gs.progress}%  |  ${gs.dateStr()}`, 10, 14);
}

function refreshLog() {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  panel.innerHTML = '';
  const start = Math.max(0, gs.log.length - 40);
  for (let i = start; i < gs.log.length; i++) {
    const entry = gs.log[i];
    const p = document.createElement('p');
    if (typeof entry === 'string') { p.textContent = entry; }
    else { p.textContent = entry.msg; if (entry.cls) p.className = entry.cls; }
    panel.appendChild(p);
  }
  panel.scrollTop = panel.scrollHeight;
}

function refreshStatus() {
  const panel = document.getElementById('status-panel');
  if (!panel) return;
  const hc = v => v < 50 ? 'bad' : v < 100 ? 'warn' : 'ok';
  panel.innerHTML = `
    <div class="status-date">${gs.dateStr()}</div>
    <div class="status-loc">${gs.locationName()}</div>
    <div class="status-sep">— RESOURCES —</div>
    <div class="status-row"><span>Food</span>     <span class="val ${gs.food<50?'bad':'ok'}">${gs.food} lbs</span></div>
    <div class="status-row"><span>Coal</span>     <span class="val ${gs.coal<80?'bad':'ok'}">${gs.coal} tons</span></div>
    <div class="status-row"><span>Medicine</span> <span class="val">${gs.medicine} doses</span></div>
    <div class="status-row"><span>Money</span>    <span class="val">${gs.money} sh.</span></div>
    <div class="status-row"><span>Lifeboats</span><span class="val bad">${gs.lifeboats} seats</span></div>
    <div class="status-sep">— PASSENGERS —</div>
    ${gs.names.map((n,i) => {
      if (!gs.alive[i]) return `<div class="pax-row dead">${n.slice(0,12)}: ✝</div>`;
      const h = gs.health[i];
      const hcls = h>=70?'ok':h>=35?'warn':'bad';
      return `<div class="pax-row"><span style="color:var(--c-${hcls},#ddd)">${n.slice(0,12)}: ${h}%</span></div>`;
    }).join('')}
    <div class="status-sep">— SETTINGS —</div>
    <div class="settings-val">Speed: ${['','Slow','Moderate','Full Steam'][gs.speed]}</div>
    <div class="settings-val">Rations: ${['','Meager','Normal','Filling'][gs.rations]}</div>`;
  const fishEl = document.getElementById('btn-fish');
  if (fishEl) {
    const canFish = gs.progress >= 16 && gs.progress < 80 && gs.dayNum - gs.lastFishDay >= 3;
    fishEl.disabled = vBusy || !canFish;
  }
}

// ── Voyage advance ────────────────────────────────────────────────────────
async function doAdvance(resting) {
  if (vBusy) return;
  setBusy(true);

  if (gs.aliveCount() === 0) { goTo(buildEnding); return; }
  if (gs.progress >= 88)     { goTo(buildIceberg); return; }

  // Consume resources
  gs.food = Math.max(0, gs.food - gs.rations * 6);
  gs.coal = Math.max(0, gs.coal - gs.speed * 25);

  if (gs.food === 0) {
    gs.addLog('!! No food remaining! Passengers grow weak!', 'alert');
    for (let i=0;i<5;i++) if (gs.alive[i]) gs.health[i] = Math.max(0, gs.health[i]-8);
  }

  // Coal crisis: first time coal runs out
  if (gs.coal === 0 && !gs.coalCrisisShown) {
    gs.coalCrisisShown = true;
    gs.addLog('!! COAL EXHAUSTED — The engines fall silent. The ship drifts.', 'alert');
    const cr = await showModal('⚫ Coal Crisis!',
      'The coal bunkers are empty.\nThe engines have stopped and the ship is adrift.\n\nThe chief engineer proposes burning wooden furniture and fixtures as emergency fuel.',
      [{label:'🔥 Burn the Furniture (+50 coal, crew morale -10)', cls:'btn-amber'}, {label:'🙏 Drift and Hope'}]);
    if (cr === 0) {
      gs.coal = 50;
      for (let i=0;i<5;i++) if (gs.alive[i]) gs.health[i] = Math.max(5, gs.health[i]-10);
      gs.addLog('» Crew strips the lounges. Crude fuel buys a few more hours of steam.', 'good');
    } else {
      gs.addLog('» The ship drifts at the mercy of the current. Progress will be agonisingly slow.', 'alert');
    }
  }

  // Progress
  let prog = gs.coal > 0 ? gs.speed * 4 : 1;
  if (gs.slowedForIce) prog = Math.max(1, prog - 2);
  gs.progress = Math.min(100, gs.progress + prog);
  gs.dayNum++;

  // Health
  for (let i=0;i<5;i++) {
    if (!gs.alive[i]) continue;
    if (resting)          gs.health[i] = Math.min(100, gs.health[i]+12);
    else if (gs.rations===1) gs.health[i] = Math.max(0, gs.health[i]-6);
    else if (gs.rations===3) gs.health[i] = Math.min(100, gs.health[i]+2);
    if (gs.health[i]===0 && gs.alive[i]) {
      gs.alive[i] = false;
      gs.addLog(`!! ${gs.names[i]} has died!`, 'alert');
    }
  }

  gs.addLog(`${gs.dateStr()} — Day ${gs.dayNum}. Progress: ${gs.progress}% — ${gs.locationName()}`);
  if (resting) gs.addLog('The ship rests at reduced speed. Passengers recover.', 'good');

  // Waypoints
  let gotoStore = null;
  if (!gs.visitedCherbourg && gs.progress >= 8) {
    gs.visitedCherbourg = true;
    gotoStore = 'Cherbourg, France';
    gs.addLog('Approaching Cherbourg, France. The ship slows to take on passengers.', 'gold');
  } else if (!gs.visitedQueenstown && gs.progress >= 16) {
    gs.visitedQueenstown = true;
    gotoStore = 'Queenstown, Ireland';
    gs.addLog('Approaching Queenstown — the last port before the open Atlantic.', 'gold');
  } else if (!gs.receivedIceWarning && gs.progress >= 60) {
    gs.receivedIceWarning = true;
    await doIceWarning();
  } else {
    if (Math.random() < 0.35) await fireRandomEvent();
  }

  if (gs.progress >= 88) {
    gs.addLog('=== April 14, 1912 — 11:40 PM ===', 'alert');
    gs.addLog('LOOKOUT FLEET RINGS THE BELL: "ICEBERG, RIGHT AHEAD!"', 'alert');
    gs.addLog('The officer orders: Hard to Starboard!', 'alert');
  }

  renderMapStrip(); refreshLog(); refreshStatus();

  if (gotoStore) { goTo(app => buildStore(app, gotoStore)); return; }

  if (gs.progress >= 88) {
    await showAlert('🧊 ICEBERG AHEAD!',
      `The night of April 14th has come.\nIcebergs have been spotted dead ahead!\n\n` +
      `Navigate through Iceberg Alley with the LEFT and RIGHT arrow keys.\n` +
      `Avoid the icebergs — or face the consequences!\n\n` +
      `(${gs.aliveCount()} passengers, ${gs.lifeboats} lifeboat seats)`);
    goTo(buildIceberg);
    return;
  }

  setBusy(false);
}

async function doIceWarning() {
  gs.addLog('— Wireless: URGENT ice warnings from multiple ships —', 'alert');
  gs.addLog('SS Californian, SS Baltic, SS Mesaba all report large icebergs ahead.', 'alert');
  const r = await showModal('🧊 Ice Warning Received',
    'WIRELESS WARNING:\n\nMultiple ships report icebergs and\nice fields along our planned route.\n\nSlowing down will reduce speed for the rest of the voyage but give the crew time to watch for ice. Maintaining speed risks entering iceberg alley with a stressed hull.',
    [{label:'🐢 Slow Down (safer)', cls:'btn-teal'}, {label:'💨 Maintain Speed (faster)', cls:'btn-amber'}]);
  if (r === 0) {
    gs.slowedForIce = true;
    gs.addLog('Captain orders reduced speed through the ice field. The crew keeps a careful watch.', 'good');
  } else {
    gs.addLog('The Captain maintains full speed. (Historically, Captain Smith did the same.)', 'warn');
  }
}

async function doChangeSpeed() {
  if (vBusy) return;
  const opts = ['Slow (conserve coal, safer)', 'Moderate', 'Full Steam Ahead (risky)'];
  const r = await showModal('⚙️ Change Speed', 'Select engine speed:', opts.map((l,i) => ({label:l, cls: i===gs.speed-1?'btn-green':''})));
  gs.speed = r + 1;
  gs.addLog(`Speed changed to: ${opts[r]}`);
  refreshLog(); refreshStatus();
}

async function doChangeRations() {
  if (vBusy) return;
  const opts = ['Meager (save food, lose health)', 'Normal', 'Filling (use more food)'];
  const r = await showModal('🍽️ Change Rations', 'Set daily rations:', opts.map((l,i) => ({label:l, cls: i===gs.rations-1?'btn-green':''})));
  gs.rations = r + 1;
  gs.addLog(`Rations changed to: ${opts[r]}`);
  refreshLog(); refreshStatus();
}

async function doFullStatus() {
  if (vBusy) return;
  setBusy(true);
  const bars = i => {
    if (!gs.alive[i]) return '✝ deceased';
    const filled = Math.round(gs.health[i]/10);
    return '█'.repeat(filled) + '░'.repeat(10-filled) + ` ${gs.health[i]}%`;
  };
  const paxLines = gs.names.map((n,i) => `${n}: ${bars(i)}`).join('\n');
  await showAlert('📋 Full Status Report',
    `PASSENGERS:\n${paxLines}\n\nRESOURCES:\nFood: ${gs.food} lbs\nCoal: ${gs.coal} tons\nMedicine: ${gs.medicine} doses\nMoney: ${gs.money} shillings\nLifeboat seats: ${gs.lifeboats}`);
  setBusy(false);
}

function doFishing() {
  if (vBusy) return;
  gs.addLog('» The engines slow. Fishing lines are cast off the stern deck.', 'good');
  goTo(buildFishing);
}

// ── Random Events ─────────────────────────────────────────────────────────
function alivePax() {
  const live = gs.alive.map((a,i)=>a?i:-1).filter(i=>i>=0);
  return live[Math.floor(Math.random() * live.length)];
}

async function fireRandomEvent() {
  const n = Math.floor(Math.random() * 24);
  switch(n) {
    case 0:  evSeasick();       break;
    case 1:  await evIllness(); break;
    case 2:  evStorm();         break;
    case 3:  evCalm();          break;
    case 4:  evBoiler();        break;
    case 5:  evFoodSpoil();     break;
    case 6:  await evManOverboard(); break;
    case 7:  evDinner();        break;
    case 8:  await evStowaway(); break;
    case 9:  evFog();           break;
    case 10: evWhale();         break;
    case 11: await evCardGame(); break;
    case 12: evTelegram();      break;
    case 13: evInjury();        break;
    case 14: evMedicineFound(); break;
    case 15: evFire();          break;
    case 16: evRecovery();      break;
    case 17: evGoodFood();      break;
    case 18: evSisterShip();    break;
    case 19: evColdSnap();           break;
    case 20: evIcebergNearby();      break;
    case 21: await evDistressCall(); break;
    case 22: evDeckEntertainment();  break;
    case 23: evSweepstakes();        break;
  }
}

function evSeasick()     { const p=alivePax(); gs.health[p]=Math.max(5,gs.health[p]-12); gs.addLog(`» ${gs.names[p]} is terribly seasick. Loses appetite.`); }
function evStorm()       { gs.coal=Math.max(0,gs.coal-40); for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.max(5,gs.health[i]-10); gs.addLog('» A fierce Atlantic storm! All passengers confined to cabins. Extra coal burned.','alert'); }
function evCalm()        { gs.progress=Math.min(100,gs.progress+2); gs.addLog('» Calm seas and a brilliant sky. Excellent sailing conditions!','good'); }
function evBoiler()      { gs.coal=Math.max(0,gs.coal-60); gs.addLog('» A boiler overheats in the engine room. Engineers work through the night.','alert'); }
function evFoodSpoil()   { const pct=0.20+Math.random()*0.20; const l=Math.min(80,Math.max(10,Math.round(gs.food*pct))); gs.food=Math.max(0,gs.food-l); gs.addLog(`» ${l} lbs of food found spoiled in the larder. Discarded.`,'alert'); }
function evFog()         { gs.progress=Math.max(0,gs.progress-2); gs.addLog('» Dense fog rolls in. Captain orders the foghorn and reduced speed.'); }
function evWhale()       { gs.addLog('» A pod of blue whales spotted off the starboard bow! Passengers rush to the railing.','good'); }
function evTelegram()    {
  const msgs=['» Wireless: Message from home — all is well.','» Wireless: SS Amerika reports large icebergs in Lat 41°27\'N.','» Wireless: Congratulations on the Titanic\'s splendid speed! — Olympic','» Wireless: SS Mesaba: Heavy pack ice and a great number of icebergs reported.','» Wireless: A stock market update for First Class investors. Mixed results.'];
  gs.addLog(msgs[Math.floor(Math.random()*msgs.length)]);
}
function evInjury()      { const p=alivePax(); gs.health[p]=Math.max(5,gs.health[p]-15); gs.addLog(`» ${gs.names[p]} slips on the wet deck and injures an ankle.`); }
function evMedicineFound(){ gs.medicine++; gs.addLog('» The ship\'s doctor shares a spare dose of medicine with your party.','good'); }
function evFire()        { gs.coal=Math.max(0,gs.coal-50); gs.addLog('» A small fire breaks out in Coal Bunker #6! Quickly controlled. 50 tons of coal lost.','alert'); }
function evRecovery()    { const p=alivePax(); gs.health[p]=Math.min(100,gs.health[p]+18); gs.addLog(`» ${gs.names[p]} has been resting and feels much better today.`,'good'); }
function evGoodFood()    { for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+6); gs.addLog('» The galley produces an especially fine meal. Spirits rise.','good'); }
function evSisterShip()  { gs.addLog('» The RMS Olympic — Titanic\'s sister ship — is spotted on the horizon! Wireless operators exchange messages.','good'); }
function evColdSnap()    {
  gs.addLog('» Temperatures plunge far below freezing. An eerie chill settles on deck.');
  if(gs.rations===1) { for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.max(5,gs.health[i]-8); gs.addLog('  Meager rations give little warmth. Everyone suffers.','alert'); }
  else gs.addLog('  You huddle together and manage to stay warm.');
}
function evIcebergNearby() {
  gs.progress = Math.max(0, gs.progress - 2);
  gs.addLog('» Iceberg spotted to port! The helmsman steers wide. Two miles lost on the detour.', 'alert');
}
async function evDistressCall() {
  gs.addLog('» Wireless crackles: a nearby vessel is in distress.', 'alert');
  const r = await showModal('📻 Distress Call',
    'A ship is transmitting a distress signal nearby.\n\nAlter course to assist? It will cost time.',
    [{label:'🆘 Alter Course to Help (-3 progress)', cls:'btn-teal'}, {label:'📝 Log the Position and Continue', cls:'btn-amber'}]);
  if (r === 0) {
    gs.progress = Math.max(0, gs.progress - 3);
    gs.addLog('  You divert course. The other ship is safely assisted. The crew\'s spirits are high.', 'good');
    for (let i=0;i<5;i++) if (gs.alive[i]) gs.health[i] = Math.min(100, gs.health[i]+5);
  } else {
    gs.addLog('  The position is logged and relayed to the Marconi office. Voyage continues.', 'good');
  }
}
function evDeckEntertainment() {
  const bonus = gs.shipClass===1 ? 8 : gs.shipClass===2 ? 5 : 4;
  const desc = gs.shipClass===1 ? 'The ship\'s orchestra performs a concert on the promenade deck.' : gs.shipClass===2 ? 'Passengers gather for a lively sing-along in the saloon.' : 'Steerage passengers dance reels and jigs late into the night.';
  for (let i=0;i<5;i++) if (gs.alive[i]) gs.health[i] = Math.min(100, gs.health[i]+bonus);
  gs.addLog(`» ${desc} Spirits are lifted.`, 'good');
}
function evSweepstakes() {
  const prize = 10 + Math.floor(Math.random()*20);
  gs.money += prize;
  gs.addLog(`» A shipboard sweepstakes on tomorrow\'s daily mileage! Your ticket wins ${prize} shillings.`, 'good');
}

function evDinner() {
  if(gs.shipClass===1){ for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+10); gs.addLog('» Captain Smith hosts an elegant dinner in First Class. Fine food and wine lift everyone\'s spirits.','good'); }
  else if(gs.shipClass===2){ for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+5); gs.addLog('» A pleasant evening meal in the Second Class dining room.','good'); }
  else { for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+3); gs.addLog('» The steerage passengers share a hearty meal and traditional music.','good'); }
}

async function evIllness() {
  const p = alivePax();
  if (gs.medicine > 0) {
    const r = await showModal('🤒 Illness', `${gs.names[p]} has fallen ill with a fever.\n\nUse 1 dose of medicine?`,
      [{label:'💊 Use Medicine', cls:'btn-green'}, {label:'🙏 Hope for Recovery', cls:'btn-amber'}]);
    if (r === 0) { gs.medicine--; gs.addLog(`» ${gs.names[p]} treated with medicine. Feeling better.`,'good'); }
    else {
      if (Math.random() < 0.5) gs.addLog(`» ${gs.names[p]} recovers on their own.`,'good');
      else { gs.health[p]=Math.max(5,gs.health[p]-25); gs.addLog(`» ${gs.names[p]}'s condition worsens. Health declines.`,'alert'); }
    }
  } else {
    gs.health[p]=Math.max(5,gs.health[p]-25);
    gs.addLog(`» ${gs.names[p]} is ill — no medicine available. Health declines.`,'alert');
  }
}

async function evManOverboard() {
  const p = alivePax();
  gs.addLog(`» ALARM! ${gs.names[p]} has gone overboard! The water is near freezing.`,'alert');
  const r = await showModal('🌊 Man Overboard!',
    `${gs.names[p]} has fallen overboard!\nThe water is near freezing.\n\nThrow a life ring immediately? (Better odds than waiting for the bridge.)`,
    [{label:'🛟 Throw Life Ring (80% chance)', cls:'btn-green'}, {label:'📯 Signal the Bridge (40% chance)', cls:'btn-amber'}]);
  if (Math.random() < (r===0 ? 0.8 : 0.4)) {
    gs.health[p]=Math.max(10,gs.health[p]-35);
    gs.addLog(`  ${gs.names[p]} is rescued! Severely hypothermic but alive.`,'good');
  } else {
    gs.alive[p]=false; gs.health[p]=0;
    gs.addLog(`  Despite all efforts, ${gs.names[p]} could not be saved.`,'alert');
  }
}

async function evStowaway() {
  const r = await showModal('🕵️ Stowaway Found!',
    'A young stowaway has been discovered hiding in a lifeboat!\n\nWhat do you do?',
    [{label:'👮 Report to Officers', cls:'btn-amber'}, {label:'🤫 Keep the Secret', cls:'btn-teal'}]);
  if (r===0) gs.addLog('» Stowaway reported. Escorted to steerage to work their passage.');
  else { gs.food=Math.max(0,gs.food-20); for(let i=0;i<5;i++) if(gs.alive[i]) gs.health[i]=Math.min(100,gs.health[i]+4); gs.addLog('» You sneak the stowaway extra food. They are very grateful.','good'); }
}

async function evCardGame() {
  if (gs.money < 20) { gs.addLog('» A card game is underway, but you lack the funds to participate.'); return; }
  const r = await showModal('🃏 Card Game',
    'A high-stakes card game is underway in the smoking room.\n\nJoin in?',
    [{label:'🎲 Join the Game', cls:'btn-green'}, {label:'👎 Decline', cls:'btn-amber'}]);
  if (r===0) {
    if (Math.random()<0.5) { const w=20+Math.floor(Math.random()*40); gs.money+=w; gs.addLog(`» Luck is on your side! You win ${w} shillings.`,'good'); }
    else { const l=20+Math.floor(Math.random()*30); gs.money=Math.max(0,gs.money-l); gs.addLog(`» The cards turn against you. You lose ${l} shillings.`,'alert'); }
  } else gs.addLog('» You watch from the doorway. Probably wise.');
}

// ═════════════════════════════════════════════════════════════════════════════
// STORE SCREEN
// ═════════════════════════════════════════════════════════════════════════════
function buildStore(app, portName) {
  const items = [
    {label:'Food (50 lbs)',     cost:20, key:'food',     amt:50},
    {label:'Food (100 lbs)',    cost:35, key:'food',     amt:100},
    {label:'Coal (100 tons)',   cost:30, key:'coal',     amt:100},
    {label:'Coal (200 tons)',   cost:55, key:'coal',     amt:200},
    {label:'Medicine (2 doses)',cost:25, key:'medicine', amt:2},
    {label:'Lifeboat seat',     cost:45, key:'lifeboats',amt:1},
  ];

  const div = document.createElement('div');
  div.id = 'store-screen';
  div.innerHTML = `
    <div class="store-title">Port of ${portName}</div>
    <div class="store-cols">
      <div class="store-col">
        <div class="store-col-title">Dock Market</div>
        ${items.map((it,i)=>`
          <div class="store-item">
            <button class="buy-btn" data-i="${i}">Buy</button>
            <span class="store-item-label">${it.label}</span>
            <span class="price">— ${it.cost} shillings</span>
          </div>`).join('')}
      </div>
      <div class="store-col">
        <div class="store-col-title">Current Stores</div>
        <div id="store-money" class="store-money">Money: ${gs.money} shillings</div>
        <div class="store-stat">Food:     <b>${gs.food}</b> lbs</div>
        <div class="store-stat">Coal:     <b>${gs.coal}</b> tons</div>
        <div class="store-stat">Medicine: <b>${gs.medicine}</b> doses</div>
        <div class="store-stat">Lifeboats:<b>${gs.lifeboats}</b> seats</div>
        <div class="store-note">${portName.includes('Queenstown')
          ? 'This is the last port before the open North Atlantic. Stock up wisely!'
          : 'Next stop: Queenstown, Ireland — the last port before the open ocean.'}</div>
      </div>
    </div>
    <div class="store-bottom">
      <button id="depart-btn" class="btn-amber btn-large">Depart Port</button>
    </div>`;
  app.appendChild(div);

  div.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const it = items[parseInt(btn.dataset.i)];
      if (gs.money < it.cost) { showAlert('💸 Insufficient Funds','You cannot afford that.'); return; }
      gs.money -= it.cost;
      gs.addLog(`Purchased: ${it.amt} ${it.key} for ${it.cost} shillings.`,'good');
      if (it.key==='food')      gs.food      += it.amt;
      if (it.key==='coal')      gs.coal      += it.amt;
      if (it.key==='medicine')  gs.medicine  += it.amt;
      if (it.key==='lifeboats') gs.lifeboats += it.amt;
      document.getElementById('store-money').textContent = `Money: ${gs.money} shillings`;
    });
  });

  div.querySelector('#depart-btn').addEventListener('click', () => {
    gs.addLog(`Departing ${portName}. The voyage continues.`);
    goTo(buildVoyage);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// FISHING MINI-GAME
// ═════════════════════════════════════════════════════════════════════════════
function buildFishing(app) {
  const canvas = document.createElement('canvas');
  canvas.width = 820; canvas.height = 620;
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;';
  canvas.tabIndex = 0;
  app.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.focus();

  const W = 820, H = 620, WATER_Y = 130, HOOK_R = 9;
  let hookX = W / 2, hookY = WATER_Y + (H - WATER_Y) * 0.55;
  let timeLeft = 45, tick = 0, wavePhase = 0;
  let gameOver = false, resultShown = false;
  let fishFood = 0, coalBonus = 0, catchCount = 0;

  // swimmers: {x, y, w, h, dx, type}  type: 0=sardine 1=cod 2=tuna 3=barrel
  const swimmers = [];
  const flashes  = [];   // {x, y, label, ttl}
  const bubbles  = [];   // {x, y}

  const keys = {};
  const onKey = e => { keys[e.key] = e.type === 'keydown'; e.preventDefault(); };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup',   onKey);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup',   onKey);

  // Touch: D-pad in bottom-left corner
  const DPAD_CX = 85, DPAD_CY = H - 85, DPAD_R = 38;
  const touchDirs = new Set();
  const updateTouchKeys = () => {
    keys['ArrowLeft']  = touchDirs.has('left');
    keys['ArrowRight'] = touchDirs.has('right');
    keys['ArrowUp']    = touchDirs.has('up');
    keys['ArrowDown']  = touchDirs.has('down');
  };
  const getDpadDir = (tx, ty) => {
    const dx = tx - DPAD_CX, dy = ty - DPAD_CY;
    if (Math.sqrt(dx*dx+dy*dy) > DPAD_R*2.2) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  };
  const onTouch = e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = W / rect.width, sy = H / rect.height;
    touchDirs.clear();
    Array.from(e.touches).forEach(t => {
      const dir = getDpadDir((t.clientX - rect.left)*sx, (t.clientY - rect.top)*sy);
      if (dir) touchDirs.add(dir);
    });
    updateTouchKeys();
    if ((e.type === 'touchend' || e.type === 'touchcancel') && gameOver && !resultShown) {
      resultShown = true;
      showFishResults();
    }
  };
  canvas.addEventListener('touchstart',  onTouch, {passive: false});
  canvas.addEventListener('touchmove',   onTouch, {passive: false});
  canvas.addEventListener('touchend',    onTouch, {passive: false});
  canvas.addEventListener('touchcancel', onTouch, {passive: false});

  function spawnFish() {
    const r = Math.random();
    const type = r < 0.5 ? 0 : r < 0.8 ? 1 : 2;
    const sizes = [[28,11],[44,17],[58,21]], speeds = [5,3,2];
    const [fw,fh] = sizes[type], spd = speeds[type];
    const fy = WATER_Y + 25 + Math.random() * (H - fh - 50 - WATER_Y);
    if (Math.random() < 0.5) swimmers.push({x:-fw,y:fy,w:fw,h:fh,dx:spd,type});
    else                      swimmers.push({x:W,  y:fy,w:fw,h:fh,dx:-spd,type});
  }

  function spawnBarrel() {
    const bw=26, bh=22, by=WATER_Y+7;
    const spd = 8 + (Math.random()*3|0);
    if (Math.random() < 0.5) swimmers.push({x:-bw,y:by,w:bw,h:bh,dx:spd, type:3});
    else                      swimmers.push({x:W,  y:by,w:bw,h:bh,dx:-spd,type:3});
  }

  async function showFishResults() {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
    gs.food = Math.max(0, gs.food + fishFood);
    gs.coal = Math.max(0, gs.coal + coalBonus - 10);
    gs.lastFishDay = gs.dayNum;
    gs.dayNum++;
    const caughtStr = catchCount === 1 ? '1 fish' : `${catchCount} fish`;
    gs.addLog('» The crew spent the afternoon fishing off the stern.', 'good');
    gs.addLog(`  Caught ${caughtStr} — ${fishFood} lbs of fresh fish added to stores.`, 'good');
    if (coalBonus > 0) gs.addLog(`  Also hauled in a floating coal barrel! +${coalBonus} tons.`, 'good');
    await showAlert('🎣 Fishing Complete!',
      `Fish caught:  ${catchCount}\nFood gained: +${fishFood} lbs` +
      (coalBonus > 0 ? `\nCoal bonus:  +${coalBonus} tons` : '') +
      '\n\nThe cook is delighted with the fresh Atlantic catch!');
    goTo(buildVoyage);
  }

  let raf;
  function frame() {
    tick++;
    wavePhase += 0.06;

    if (!gameOver) {
      const spd = 6;
      if (keys['ArrowLeft']  || keys['a']) hookX = Math.max(HOOK_R+5, hookX-spd);
      if (keys['ArrowRight'] || keys['d']) hookX = Math.min(W-HOOK_R-5, hookX+spd);
      if (keys['ArrowUp']    || keys['w']) hookY = Math.max(WATER_Y+HOOK_R+5, hookY-spd);
      if (keys['ArrowDown']  || keys['s']) hookY = Math.min(H-HOOK_R-5, hookY+spd);

      if (tick % 120 === 0) spawnFish();
      if (tick === 180 || (tick > 180 && tick % 480 === 0 && Math.random() < 0.7)) spawnBarrel();

      if (tick % 30 === 0) bubbles.push({x: hookX+Math.random()*16-8, y: hookY+8});
      for (let i=bubbles.length-1; i>=0; i--) { bubbles[i].y -= 1.5; if (bubbles[i].y < WATER_Y) bubbles.splice(i,1); }
      for (let i=flashes.length-1; i>=0; i--) { flashes[i].y -= 2; if (--flashes[i].ttl <= 0) flashes.splice(i,1); }

      for (let i=swimmers.length-1; i>=0; i--) {
        const s = swimmers[i];
        s.x += s.dx;
        if (s.x < -s.w-40 || s.x > W+40) { swimmers.splice(i,1); continue; }
        const fcx=s.x+s.w/2, fcy=s.y+s.h/2, ddx=fcx-hookX, ddy=fcy-hookY;
        const cr = s.w/2 + HOOK_R;
        if (ddx*ddx + ddy*ddy < cr*cr) {
          if (s.type === 3) { coalBonus += 50; flashes.push({x:hookX,y:hookY,label:'+50 COAL!',ttl:70}); }
          else { const fv=[20,35,50]; fishFood+=fv[s.type]; catchCount++; flashes.push({x:hookX,y:hookY,label:`+${fv[s.type]} lbs`,ttl:55}); }
          swimmers.splice(i,1);
        }
      }

      if (tick % 60 === 0 && --timeLeft <= 0) {
        gameOver = true;
        if (!resultShown) { resultShown = true; showFishResults(); }
      }
    }

    // Draw scene
    // Sky
    const sky = ctx.createLinearGradient(0,0,0,WATER_Y);
    sky.addColorStop(0,'#64a4dc'); sky.addColorStop(1,'#aad7f5');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,WATER_Y);

    // Clouds
    ctx.fillStyle='rgba(255,255,255,0.78)';
    fishCloud(ctx,(tick*0.4+50)%(W+180)-90|0,18,80);
    fishCloud(ctx,(tick*0.25+320)%(W+180)-90|0,38,55);
    fishCloud(ctx,(tick*0.35+650)%(W+180)-90|0,22,65);

    // Deck railing
    ctx.fillStyle='#372818'; ctx.fillRect(0,WATER_Y-20,W,9);
    ctx.fillStyle='#503a24';
    for (let px=8;px<W;px+=44) ctx.fillRect(px,WATER_Y-34,5,22);
    ctx.fillStyle='#5f4830'; ctx.fillRect(0,WATER_Y-36,W,4);

    // Fishing pole
    const [poleBX,poleBY,poleTX,poleTY] = [W/2-90,WATER_Y-28,W/2-18,WATER_Y-82];
    ctx.strokeStyle='#693e1c'; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(poleBX,poleBY); ctx.lineTo(poleTX,poleTY); ctx.stroke();
    // Fishing line
    ctx.strokeStyle='rgba(220,210,190,0.85)'; ctx.lineWidth=1; ctx.lineCap='butt';
    ctx.beginPath(); ctx.moveTo(poleTX,poleTY); ctx.lineTo(hookX,WATER_Y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hookX,WATER_Y); ctx.lineTo(hookX,hookY); ctx.stroke();

    // Water
    const water=ctx.createLinearGradient(0,WATER_Y,0,H);
    water.addColorStop(0,'#0f55a0'); water.addColorStop(1,'#03163c');
    ctx.fillStyle=water; ctx.fillRect(0,WATER_Y,W,H-WATER_Y);

    // Surface shimmer
    for (let wx=-20;wx<W+20;wx+=38) {
      const wo=Math.sin(wavePhase+wx*0.08)*6|0;
      ctx.fillStyle='rgba(180,225,255,0.07)';
      ctx.beginPath(); ctx.ellipse(wx+15,WATER_Y-5+wo,15,5,0,0,Math.PI*2); ctx.fill();
    }

    // God rays
    ctx.fillStyle='rgba(200,235,255,0.03)';
    for (let rx=60;rx<W;rx+=130) {
      ctx.beginPath(); ctx.moveTo(rx,WATER_Y); ctx.lineTo(rx+25,WATER_Y);
      ctx.lineTo(rx+75,H); ctx.lineTo(rx+50,H); ctx.fill();
    }

    // Seaweed
    for (let sx=20;sx<W;sx+=55) {
      const swH=20+(sx%45);
      for (let sy=H-swH;sy<H;sy+=5) {
        const swx=sx+(Math.sin(wavePhase+sy*0.12+sx*0.05)*7|0);
        ctx.fillStyle='rgba(18,95,45,0.55)';
        ctx.beginPath(); ctx.arc(swx,sy,2.5,0,Math.PI*2); ctx.fill();
      }
    }

    // Bubbles
    ctx.strokeStyle='rgba(200,235,255,0.5)'; ctx.lineWidth=1;
    bubbles.forEach(b => { ctx.beginPath(); ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.stroke(); });

    // Swimmers
    swimmers.forEach(s => fishDrawSwimmer(ctx,s));

    // Hook
    fishDrawHook(ctx, hookX, hookY);

    // Catch flashes
    flashes.forEach(fl => {
      const alpha = Math.min(1, fl.ttl/20);
      ctx.font='bold 13px sans-serif'; ctx.textAlign='left';
      ctx.fillStyle = fl.label.includes('COAL') ? `rgba(212,175,55,${alpha})` : `rgba(80,220,80,${alpha})`;
      ctx.fillText(fl.label, fl.x+10, fl.y);
    });

    // HUD
    fishHUD(ctx, W, timeLeft, catchCount, fishFood, coalBonus);

    // Touch D-pad
    fishDpad(ctx, DPAD_CX, DPAD_CY, DPAD_R, keys);

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
  };
}

function fishCloud(ctx, x, y, size) {
  ctx.beginPath(); ctx.ellipse(x+size/2, y+size/4, size/2, size/4, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+size/3, y+size/4, size/3, size/3, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+size*2/3, y+size/4, size/4, size*0.2, 0, 0, Math.PI*2); ctx.fill();
}

function fishDrawSwimmer(ctx, s) {
  const {x,y,w,h,dx,type} = s;
  const right = dx > 0;
  if (type === 3) {
    // Coal barrel — fast, near surface
    const bg = ctx.createLinearGradient(x,y,x+w,y+h);
    bg.addColorStop(0,'#55381e'); bg.addColorStop(1,'#2a190a');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.roundRect(x,y,w,h,4); ctx.fill();
    ctx.strokeStyle='#b09450'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.roundRect(x,y,w,h,4); ctx.stroke();
    ctx.strokeStyle='#341f0e'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x,y+h/3);   ctx.lineTo(x+w,y+h/3);   ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y+h*2/3); ctx.lineTo(x+w,y+h*2/3); ctx.stroke();
    ctx.font='bold 7px sans-serif'; ctx.fillStyle='#d4af37'; ctx.textAlign='left';
    ctx.fillText('COAL',x+3,y+h/2+3);
    // Speed trail
    ctx.fillStyle='rgba(200,200,100,0.22)';
    ctx.fillRect(right?x-14:x+w, y+3, 14, h-6);
    return;
  }
  // Fish
  const cols=['#aad3f5','#a3804a','#1c6e37'];
  ctx.fillStyle=cols[type];
  ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w/4,h/3,0,0,Math.PI*2); ctx.fill();
  // Tail
  const tailX=right?x:x+w, td=right?-1:1;
  ctx.fillStyle=cols[type];
  ctx.beginPath(); ctx.moveTo(tailX,y+h/2); ctx.lineTo(tailX+td*w/4,y+2); ctx.lineTo(tailX+td*w/4,y+h-2); ctx.closePath(); ctx.fill();
  // Dorsal fin
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.moveTo(x+w*2/5,y); ctx.lineTo(x+w/2,y-h*0.4); ctx.lineTo(x+w*3/5,y); ctx.closePath(); ctx.fill();
  // Eye
  const eyeX=right?x+w*0.75-2:x+w*0.25-3;
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(eyeX,y+h/2-1,2.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(eyeX+0.5,y+h/2-1.5,1,0,Math.PI*2); ctx.fill();
}

function fishDrawHook(ctx, x, y) {
  ctx.strokeStyle='rgba(210,210,225,0.85)'; ctx.lineWidth=2.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(x-3,y-1,8,0.2,Math.PI*1.3,true); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+5,y-9); ctx.lineTo(x+5,y+5); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x-6,y-2); ctx.lineTo(x-3,y+3); ctx.stroke();
}

function fishHUD(ctx, W, timeLeft, catchCount, fishFood, coalBonus) {
  ctx.textAlign='center'; ctx.font='bold 15px Georgia,serif'; ctx.fillStyle='#d4af37';
  ctx.fillText('NORTH ATLANTIC FISHING  —  April 1912', W/2, 18);
  ctx.font='10px sans-serif'; ctx.fillStyle='rgba(180,170,150,0.9)';
  ctx.fillText('Arrow keys / WASD: move hook  |  Intercept fish to catch  |  Fast barrels near surface = bonus coal!', W/2, 31);
  ctx.textAlign='right'; ctx.font='bold 13px sans-serif';
  ctx.fillStyle = timeLeft <= 10 ? '#be2828' : '#ffffff';
  ctx.fillText(`TIME: ${timeLeft}s`, W-10, 18);
  ctx.textAlign='left'; ctx.font='bold 12px sans-serif'; ctx.fillStyle='#28a046';
  ctx.fillText(`Fish: ${catchCount}   Food: +${fishFood} lbs`, 10, 18);
  if (coalBonus > 0) { ctx.fillStyle='#d4af37'; ctx.fillText(`Coal bonus: +${coalBonus} tons!`, 10, 33); }
}

function fishDpad(ctx, cx, cy, r, keys) {
  const dirs = [
    {key:'ArrowUp',dx:0,dy:-1,label:'▲'},{key:'ArrowDown', dx:0, dy:1,label:'▼'},
    {key:'ArrowLeft',dx:-1,dy:0,label:'◄'},{key:'ArrowRight',dx:1,dy:0,label:'►'},
  ];
  dirs.forEach(d => {
    const bx=cx+d.dx*(r+6), by=cy+d.dy*(r+6), active=keys[d.key];
    ctx.fillStyle   = active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = active ? 'rgba(255,255,255,0.5)'  : 'rgba(255,255,255,0.15)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.roundRect(bx-r+6,by-r+6,r*2-12,r*2-12,6); ctx.fill(); ctx.stroke();
    ctx.font=`bold ${active?22:18}px sans-serif`;
    ctx.fillStyle = active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
    ctx.textAlign='center'; ctx.fillText(d.label, bx, by+7);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ICEBERG MINI-GAME
// ═════════════════════════════════════════════════════════════════════════════
function buildIceberg(app) {
  const canvas = document.createElement('canvas');
  canvas.width = 820; canvas.height = 620;
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;';
  canvas.tabIndex = 0;
  app.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.focus();

  const W = 820, H = 620;
  const SHIP_W = 36, SHIP_H = 64;
  const shipY = H - 90;

  let shipX = W / 2;
  let shipLean = 0; // -1 = hard left turn, +1 = hard right
  // If the player received an ice warning but chose to maintain speed, the hull
  // is stressed from high-speed navigation — start damaged.
  let hull = (gs.receivedIceWarning && !gs.slowedForIce) ? 80 : 100;
  let timeLeft = 60;    // one minute (wall-clock countdown)
  let gameElapsed = 0;  // seconds elapsed in 'playing' phase
  let spawnAccum  = 0;  // spawn timing accumulator (seconds)
  let lastTs = 0;       // previous RAF timestamp (ms)
  let animTick = 0;
  // phases: 'playing', 'sinking', 'arriving'
  let phase = 'playing';
  let clickReady = false;
  let hitFlash = 0;
  const keys = {};
  const icebergs = [];
  const iceParticles = [];  // ice-crunch debris on collision

  const rng = seededRng(42);
  const stars = Array.from({length:150}, () => ({
    x: rng()*W, y: rng()*(H*3/5),
    r: rng()>0.8?2:1, ph: rng()*Math.PI*2,
  }));

  // Cache static night background once — sky gradient + moon crescent
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W; bgCanvas.height = H;
  const bgCtx = bgCanvas.getContext('2d');
  const _bgSky = bgCtx.createLinearGradient(0,0,0,H*3/5);
  _bgSky.addColorStop(0,'#02020f'); _bgSky.addColorStop(1,'#051432');
  bgCtx.fillStyle = _bgSky; bgCtx.fillRect(0,0,W,H*3/5);
  const _bgSea = bgCtx.createLinearGradient(0,H*3/5,0,H);
  _bgSea.addColorStop(0,'#051432'); _bgSea.addColorStop(1,'#000a22');
  bgCtx.fillStyle = _bgSea; bgCtx.fillRect(0,H*3/5,W,H*2/5);
  bgCtx.fillStyle='rgba(255,248,200,0.75)'; bgCtx.beginPath(); bgCtx.arc(W-75,55,28,0,Math.PI*2); bgCtx.fill();
  bgCtx.fillStyle='#02020f';                bgCtx.beginPath(); bgCtx.arc(W-62,51,28,0,Math.PI*2); bgCtx.fill();
  bgCtx.fillStyle='rgba(255,248,150,0.06)'; bgCtx.fillRect(W-90,H*3/5,30,H);

  const onKey = e => { keys[e.key] = e.type === 'keydown'; e.preventDefault(); };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup',   onKey);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup',   onKey);

  // Touch controls: left half of canvas = steer left, right half = steer right
  const touchSides = new Map(); // touchId → 'left'|'right'
  const updateTouchKeys = () => {
    const vals = [...touchSides.values()];
    keys['ArrowLeft']  = vals.includes('left');
    keys['ArrowRight'] = vals.includes('right');
  };
  const onTouch = e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    Array.from(e.changedTouches).forEach(t => {
      if (e.type === 'touchend' || e.type === 'touchcancel') {
        touchSides.delete(t.identifier);
        if (e.type === 'touchend' && clickReady) {
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          goTo(buildMineField);
        }
      } else {
        touchSides.set(t.identifier, t.clientX < midX ? 'left' : 'right');
      }
    });
    updateTouchKeys();
  };
  canvas.addEventListener('touchstart',  onTouch, {passive: false});
  canvas.addEventListener('touchmove',   onTouch, {passive: false});
  canvas.addEventListener('touchend',    onTouch, {passive: false});
  canvas.addEventListener('touchcancel', onTouch, {passive: false});

  canvas.addEventListener('click', () => {
    if (!clickReady) return;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
    goTo(buildMineField);
  });

  let raf;
  function frame(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
    lastTs = ts;
    if (phase !== 'playing') animTick++;

    // ── Gameplay logic ───────────────────────────────────────────────────
    if (phase === 'playing') {
      gameElapsed += dt;
      timeLeft = Math.max(0, 60 - gameElapsed);

      const movL = keys['ArrowLeft']  || keys['a'];
      const movR = keys['ArrowRight'] || keys['d'];
      const mv = 6 * dt * 60;
      if (movL) { shipX = Math.max(SHIP_W/2+5, shipX-mv); shipLean = Math.max(-1, shipLean-0.15); }
      if (movR) { shipX = Math.min(W-SHIP_W/2-5, shipX+mv); shipLean = Math.min(1, shipLean+0.15); }
      if (!movL && !movR) shipLean *= Math.pow(0.82, dt * 60);

      // Spawn icebergs using time accumulator instead of frame counter
      spawnAccum += dt;
      const spawnInterval = Math.max(13, 50 - Math.floor(gameElapsed / 3)) / 60;
      while (spawnAccum >= spawnInterval) {
        spawnAccum -= spawnInterval;
        icebergs.push({ x:Math.random()*(W-80)+5, y:-60,
          w:30+Math.random()*60, h:25+Math.random()*35, dx:(Math.random()*4-2) });
      }

      const iceSpeed = (3 + Math.floor(gameElapsed / 10)) * dt * 60;
      for (let i = icebergs.length-1; i >= 0; i--) {
        const ice = icebergs[i];
        ice.y += iceSpeed; ice.x += ice.dx * dt * 60;
        if (ice.x < 0) { ice.x=0; ice.dx*=-1; }
        if (ice.x+ice.w > W) { ice.x=W-ice.w; ice.dx*=-1; }
        if (ice.y > H) { icebergs.splice(i,1); continue; }
        if (ice.y+ice.h >= shipY && ice.y <= shipY+SHIP_H) {
          if (ice.x+ice.w > shipX-SHIP_W/2 && ice.x < shipX+SHIP_W/2) {
            icebergs.splice(i,1);
            hull = Math.max(0, hull-30);
            gs.icebergHits++;
            hitFlash = 8;
            // Spawn ice-chunk particles at collision point
            const icx = ice.x + ice.w/2, icy = ice.y + ice.h/2;
            for (let p = 0; p < 14; p++) {
              const ang = Math.random()*Math.PI*2, spd = 2.5 + Math.random()*5;
              const life = 24 + Math.floor(Math.random()*14);
              iceParticles.push({ x: icx+(Math.random()-0.5)*ice.w*0.5,
                y: icy+(Math.random()-0.5)*ice.h*0.5,
                vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 1.5,
                life, maxLife: life, sz: 3+Math.random()*5,
                rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.35,
                col: Math.random()>0.45 ? '#dceeff' : '#a8d8f0' });
            }
            if (hull <= 0) { phase='sinking'; gs.sank=true; }
          }
        }
      }
      if (timeLeft <= 0) { phase='arriving'; gs.sank=false; }
      for (let i = iceParticles.length-1; i >= 0; i--) {
        const p = iceParticles[i];
        p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
        p.vy += 0.28 * dt * 60; p.rot += p.rotV * dt * 60;
        p.life -= dt * 60;
        if (p.life <= 0) iceParticles.splice(i, 1);
      }
      if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 60);
    }

    // ── Draw ─────────────────────────────────────────────────────────────
    if (phase === 'arriving') {
      drawArrivalScene(ctx, W, H, animTick);
      if (animTick > 200) {
        clickReady = true;
        // prompt drawn inside drawArrivalScene
      }
    } else {
      // Blit cached static background (sky gradient + moon crescent)
      ctx.drawImage(bgCanvas, 0, 0);
      // Stars: twinkling via wall-clock time (ts in ms; 0.0015 ≈ 0.025 rad/frame @60 fps)
      stars.forEach(s => {
        const a = (0.3+0.7*Math.abs(Math.sin(ts*0.0015+s.ph))).toFixed(2);
        ctx.fillStyle=`rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      });

      if (phase === 'playing') {
        icebergs.forEach(ice => drawIceberg(ctx, ice.x, ice.y, ice.w, ice.h));
        // Ice-crunch particles
        iceParticles.forEach(p => {
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = p.col;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.sz/2, -p.sz/2, p.sz, p.sz);
          ctx.restore();
        });
        ctx.globalAlpha = 1;
        // Bow wave just ahead of the bow
        ctx.fillStyle = 'rgba(160,215,255,0.22)';
        ctx.beginPath(); ctx.ellipse(shipX, shipY - 4, SHIP_W / 2 + 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        drawMiniShip(ctx, shipX, shipY, shipLean);
        // V-shaped wake spreading aft (below stern)
        for (let i = 1; i <= 5; i++) {
          const spread = i * 6;
          ctx.fillStyle = `rgba(100,160,255,${(0.17 - i * 0.025).toFixed(2)})`;
          ctx.fillRect(shipX - SHIP_W/2 - spread, shipY + SHIP_H + i * 5 - 4, SHIP_W + spread * 2, 3);
        }
        if (hitFlash > 0) {
          ctx.fillStyle=`rgba(200,0,0,${(hitFlash/8*0.25).toFixed(2)})`;
          ctx.fillRect(0,0,W,H);
        }
        drawIcebergHUD(ctx, W, H, hull, Math.ceil(timeLeft));
        drawTouchHints(ctx, W, H, keys);
      } else {
        // Sinking animation
        drawSinkingAnimation(ctx, W, H, animTick);
        if (animTick > 580) {
          clickReady = true;
          const a = Math.abs(Math.sin(animTick * 0.07)).toFixed(2);
          ctx.textAlign='center'; ctx.font='14px Georgia,serif';
          ctx.fillStyle=`rgba(180,170,150,${a})`;
          ctx.fillText('Click to continue...', W/2, H-20);
        }
      }
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MINE FIELD  — HMHS Britannic, November 21, 1916, Aegean Sea
// ─────────────────────────────────────────────────────────────────────────────
function buildMineField(app) {
  const canvas = document.createElement('canvas');
  canvas.width = 820; canvas.height = 620;
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline:none;';
  canvas.tabIndex = 0;
  app.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.focus();

  const W = 820, H = 620;
  const SHIP_W = 36, SHIP_H = 64;
  const shipY = H - 90;

  let shipX = W / 2;
  let shipLean = 0;
  let hull = 100;
  let timeLeft = 45;    // wall-clock countdown
  let gameElapsed = 0;  // seconds elapsed in 'playing' phase
  let spawnAccum  = 0;  // spawn timing accumulator (seconds)
  let lastTs = 0;       // previous RAF timestamp (ms)
  let animTick = 0;
  // phases: 'intro', 'playing', 'clear', 'sinking'
  let phase = 'intro';
  let clickReady = false;
  let hitFlash = 0;
  const keys = {};
  const mines = [];
  const explosions = [];  // mine-hit explosion effects

  // Cache static Aegean sky+sea gradient (clouds/waves still drawn per-frame)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = W; bgCanvas.height = H;
  const bgCtx = bgCanvas.getContext('2d');
  const _bgSky = bgCtx.createLinearGradient(0, 0, 0, H*0.55);
  _bgSky.addColorStop(0, '#1a4a8a'); _bgSky.addColorStop(1, '#5aa0e8');
  bgCtx.fillStyle = _bgSky; bgCtx.fillRect(0, 0, W, H*0.55);
  const _bgSea = bgCtx.createLinearGradient(0, H*0.55, 0, H);
  _bgSea.addColorStop(0, '#1a78c8'); _bgSea.addColorStop(1, '#0a3a6a');
  bgCtx.fillStyle = _bgSea; bgCtx.fillRect(0, H*0.55, W, H*0.45);

  const onKey = e => { keys[e.key] = e.type === 'keydown'; e.preventDefault(); };
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('keyup',   onKey);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup',   onKey);

  const touchSides = new Map();
  const updateTouchKeys = () => {
    const vals = [...touchSides.values()];
    keys['ArrowLeft']  = vals.includes('left');
    keys['ArrowRight'] = vals.includes('right');
  };
  const onTouch = e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    Array.from(e.changedTouches).forEach(t => {
      if (e.type === 'touchend' || e.type === 'touchcancel') {
        touchSides.delete(t.identifier);
        if (e.type === 'touchend' && clickReady) {
          if (phase === 'intro') { phase = 'playing'; animTick = 0; tick = 0; clickReady = false; return; }
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          goTo(buildEnding);
        }
      } else {
        touchSides.set(t.identifier, t.clientX < midX ? 'left' : 'right');
      }
    });
    updateTouchKeys();
  };
  canvas.addEventListener('touchstart',  onTouch, {passive: false});
  canvas.addEventListener('touchmove',   onTouch, {passive: false});
  canvas.addEventListener('touchend',    onTouch, {passive: false});
  canvas.addEventListener('touchcancel', onTouch, {passive: false});

  canvas.addEventListener('click', () => {
    if (!clickReady) return;
    if (phase === 'intro') { phase = 'playing'; animTick = 0; tick = 0; clickReady = false; return; }
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
    goTo(buildEnding);
  });

  let raf;
  function frame(ts) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
    lastTs = ts;
    if (phase !== 'playing') animTick++;

    if (phase === 'intro') {
      if (animTick >= 300) { phase = 'playing'; animTick = 0; gameElapsed = 0; spawnAccum = 0; }
      else clickReady = animTick > 60;
    } else if (phase === 'playing') {
      gameElapsed += dt;
      timeLeft = Math.max(0, 45 - gameElapsed);

      const movL = keys['ArrowLeft']  || keys['a'];
      const movR = keys['ArrowRight'] || keys['d'];
      const mv = 6 * dt * 60;
      if (movL) { shipX = Math.max(SHIP_W/2+5, shipX-mv); shipLean = Math.max(-1, shipLean-0.15); }
      if (movR) { shipX = Math.min(W-SHIP_W/2-5, shipX+mv); shipLean = Math.min(1, shipLean+0.15); }
      if (!movL && !movR) shipLean *= Math.pow(0.82, dt * 60);

      // Spawn mines using time accumulator instead of frame counter
      spawnAccum += dt;
      const spawnInterval = Math.max(18, 55 - Math.floor(gameElapsed / 2)) / 60;
      while (spawnAccum >= spawnInterval) {
        spawnAccum -= spawnInterval;
        const r = 15 + Math.random() * 13;
        mines.push({ x: Math.random()*(W - r*2) + r, y: -r - 20, r,
          dx: Math.random()*2 - 1, bobPhase: Math.random()*Math.PI*2 });
      }

      for (let i = mines.length-1; i >= 0; i--) {
        const mine = mines[i];
        mine.y += (2 + Math.floor(gameElapsed / 12)) * dt * 60;
        mine.x += (mine.dx + Math.sin(ts * 0.00004 * 60 + mine.bobPhase) * 0.5) * dt * 60;
        if (mine.x < mine.r)   { mine.x = mine.r;   mine.dx *= -1; }
        if (mine.x+mine.r > W) { mine.x = W-mine.r; mine.dx *= -1; }
        if (mine.y > H + mine.r) { mines.splice(i, 1); continue; }
        // Circle-AABB collision with ship rectangle
        const nearX = Math.max(shipX - SHIP_W/2, Math.min(shipX + SHIP_W/2, mine.x));
        const nearY = Math.max(shipY, Math.min(shipY + SHIP_H, mine.y));
        const dx = mine.x - nearX, dy = mine.y - nearY;
        if (dx*dx + dy*dy < mine.r * mine.r) {
          mines.splice(i, 1);
          hull = Math.max(0, hull - 25);
          gs.mineHits++;
          hitFlash = 8;
          // Spawn explosion at mine centre
          const sparks = [];
          const sparkColors = ['#ff8800','#ffcc00','#ff4400','#ffffff','#ffaa22'];
          for (let p = 0; p < 20; p++) {
            const ang = Math.random()*Math.PI*2, spd = 3 + Math.random()*7;
            const life = 22 + Math.floor(Math.random()*20);
            sparks.push({ x: mine.x, y: mine.y,
              vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 1,
              life, maxLife: life, sz: 2 + Math.random()*3,
              col: sparkColors[Math.floor(Math.random()*sparkColors.length)] });
          }
          explosions.push({ x: mine.x, y: mine.y, r: mine.r, life: 45, maxLife: 45, sparks });
          if (hull <= 0) { phase = 'sinking'; gs.britannicSank = true; }
        }
      }

      if (timeLeft <= 0) { phase = 'clear'; }
      for (let i = explosions.length-1; i >= 0; i--) {
        const ex = explosions[i];
        ex.life -= dt * 60;
        for (let j = ex.sparks.length-1; j >= 0; j--) {
          const s = ex.sparks[j];
          s.x += s.vx * dt * 60; s.y += s.vy * dt * 60;
          s.vy += 0.18 * dt * 60; s.life -= dt * 60;
          if (s.life <= 0) ex.sparks.splice(j, 1);
        }
        if (ex.life <= 0) explosions.splice(i, 1);
      }
      if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 60);
    }

    // ── Draw ─────────────────────────────────────────────────────────────
    if (phase === 'intro') {
      drawMineIntro(ctx, W, H, animTick);
    } else if (phase === 'clear') {
      drawMineClearScene(ctx, W, H, animTick);
      if (animTick > 180) clickReady = true;
    } else {
      // Blit cached static background, then draw animated clouds+waves on top
      ctx.drawImage(bgCanvas, 0, 0);
      drawAegeanAnimated(ctx, W, H, ts);
      if (phase === 'playing') {
        mines.forEach(m => drawMine(ctx, m.x, m.y, m.r));
        // Mine explosion effects
        explosions.forEach(ex => {
          const prog = 1 - ex.life / ex.maxLife;
          // Expanding ring
          const ringR = ex.r + prog * 50;
          const ringA = Math.max(0, 0.75 * (1 - prog * 1.6));
          ctx.strokeStyle = `rgba(255,140,30,${ringA.toFixed(2)})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(ex.x, ex.y, ringR, 0, Math.PI*2); ctx.stroke();
          // Second, slightly delayed ring
          if (prog > 0.12) {
            const r2 = ex.r + (prog - 0.12) * 70, a2 = Math.max(0, 0.5*(1-(prog-0.12)*2));
            ctx.strokeStyle = `rgba(255,210,80,${a2.toFixed(2)})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ex.x, ex.y, r2, 0, Math.PI*2); ctx.stroke();
          }
          // Central fireball
          if (prog < 0.45) {
            const fbA = (0.45 - prog) / 0.45;
            const fbR = ex.r * (0.8 + prog * 1.4);
            const fg = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, fbR);
            fg.addColorStop(0,   `rgba(255,255,200,${fbA.toFixed(2)})`);
            fg.addColorStop(0.45, `rgba(255,150,30,${(fbA*0.7).toFixed(2)})`);
            fg.addColorStop(1,   'rgba(255,60,0,0)');
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(ex.x, ex.y, fbR, 0, Math.PI*2); ctx.fill();
          }
          // Sparks
          ex.sparks.forEach(s => {
            ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
            ctx.fillStyle = s.col;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, Math.PI*2); ctx.fill();
          });
          ctx.globalAlpha = 1;
        });
        ctx.fillStyle = 'rgba(160,220,255,0.25)';
        ctx.beginPath(); ctx.ellipse(shipX, shipY - 4, SHIP_W/2+4, 6, 0, 0, Math.PI*2); ctx.fill();
        drawMiniShip(ctx, shipX, shipY, shipLean);
        for (let i = 1; i <= 5; i++) {
          const spread = i * 6;
          ctx.fillStyle = `rgba(100,180,255,${(0.17 - i * 0.025).toFixed(2)})`;
          ctx.fillRect(shipX - SHIP_W/2 - spread, shipY + SHIP_H + i*5 - 4, SHIP_W + spread*2, 3);
        }
        if (hitFlash > 0) {
          ctx.fillStyle = `rgba(200,0,0,${(hitFlash/8*0.25).toFixed(2)})`;
          ctx.fillRect(0, 0, W, H);
        }
        drawMineHUD(ctx, W, H, hull, Math.ceil(timeLeft));
        drawTouchHints(ctx, W, H, keys);
      } else {
        // Sinking animation (hull = 0 from mine)
        drawSinkingAnimation(ctx, W, H, animTick);
        if (animTick > 580) {
          clickReady = true;
          const a = Math.abs(Math.sin(animTick * 0.07)).toFixed(2);
          ctx.textAlign = 'center'; ctx.font = '14px Georgia,serif';
          ctx.fillStyle = `rgba(180,170,150,${a})`;
          ctx.fillText('Click to continue...', W/2, H-20);
        }
      }
    }

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup',   onKey);
  };
}

function drawMineIntro(ctx, W, H, animTick) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1428'); bg.addColorStop(1, '#1a2840');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = Math.min(animTick / 60, 1);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 15;

  ctx.font = 'bold 30px Georgia,serif'; ctx.fillStyle = '#d4af37';
  ctx.fillText('HMHS BRITANNIC — November 21, 1916', W/2, H * 0.22);

  ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W*0.15, H*0.27); ctx.lineTo(W*0.85, H*0.27); ctx.stroke();

  ctx.font = '17px Georgia,serif'; ctx.fillStyle = '#dcd2b4'; ctx.shadowBlur = 6;
  const lines = [
    "The Titanic's sister ship, HMHS Britannic, was converted",
    'into a hospital ship during the First World War.',
    '',
    'On the morning of November 21, 1916, while sailing',
    'through the Aegean Sea near the Greek island of Kea,',
    'she struck a German naval mine.',
    '',
    'Now you must steer the Britannic safely',
    'through the minefield before it is too late!',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W/2, H*0.36 + i*28));

  ctx.shadowBlur = 0;
  if (animTick > 60) {
    const blink = Math.abs(Math.sin(animTick * 0.07)).toFixed(2);
    ctx.font = 'bold 15px Georgia,serif';
    ctx.fillStyle = `rgba(212,175,55,${blink})`;
    ctx.fillText('Click to begin — or wait 5 seconds', W/2, H - 25);
  }
  ctx.globalAlpha = 1;
}

function drawMineClearScene(ctx, W, H, animTick) {
  const progress = Math.min(animTick / 180, 1);

  const sky = ctx.createLinearGradient(0, 0, 0, H*0.55);
  sky.addColorStop(0, '#1a5aa0'); sky.addColorStop(1, '#5ab0f0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H*0.55);

  const sea = ctx.createLinearGradient(0, H*0.55, 0, H);
  sea.addColorStop(0, '#1a78c8'); sea.addColorStop(1, '#0a3a6a');
  ctx.fillStyle = sea; ctx.fillRect(0, H*0.55, W, H*0.45);

  const sunX = W*0.8, sunY = H*0.14;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90);
  glow.addColorStop(0, 'rgba(255,220,100,0.5)'); glow.addColorStop(1, 'rgba(255,160,30,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,230,100,0.95)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI*2); ctx.fill();

  // Ship sailing toward port
  const shipStartX = W + 220, shipEndX = W*0.35;
  const shipCX = shipStartX + (shipEndX - shipStartX) * easeOut(progress);
  const sY = H*0.55 - 32;
  ctx.save(); ctx.scale(-1, 1);
  drawShip(ctx, -shipCX, sY, 260);
  ctx.restore();
  ctx.fillStyle = 'rgba(100,200,255,0.18)';
  for (let i = 1; i <= 5; i++) ctx.fillRect(shipCX, sY+18+i, i*24, 3);

  if (progress > 0.4) {
    const ta = Math.min((progress - 0.4) / 0.25, 1).toFixed(2);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
    ctx.font = 'bold 38px Georgia,serif'; ctx.fillStyle = `rgba(212,175,55,${ta})`;
    ctx.fillText('SAFE PASSAGE!', W/2, H*0.38);
    ctx.font = '16px Georgia,serif'; ctx.fillStyle = `rgba(220,210,180,${ta})`;
    ctx.fillText('The Britannic cleared the minefield — the wounded will reach port safely.', W/2, H*0.38 + 34);
    ctx.shadowBlur = 0;
  }

  if (progress > 0.88) {
    const ca = Math.abs(Math.sin(animTick * 0.07)).toFixed(2);
    ctx.font = '14px Georgia,serif'; ctx.fillStyle = `rgba(180,170,150,${ca})`;
    ctx.textAlign = 'center';
    ctx.fillText('Click to continue...', W/2, H - 18);
  }
}

// Draws only the animated parts of the Aegean scene (clouds + waves).
// The static sky/sea gradient is pre-blit'd from bgCanvas by the caller.
function drawAegeanAnimated(ctx, W, H, ts) {
  // ts is the RAF wall-clock timestamp in ms
  // Clouds drift slowly (0.004 rad/frame @60fps = 0.24 rad/s)
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  [[0.13,0.10,85,22],[0.42,0.07,110,27],[0.70,0.14,72,18],[0.87,0.09,92,24]].forEach(([fx, fy, cw, ch]) => {
    const cx = (fx*W + Math.sin(ts * 0.00024 + fx*10)*8);
    ctx.beginPath(); ctx.ellipse(cx, fy*H, cw, ch, 0, 0, Math.PI*2); ctx.fill();
  });

  // Animated wave lines (0.04 rad/frame @60fps = 2.4 rad/s)
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
  for (let row = 0; row < 8; row++) {
    const wy = H*0.55 + row*25;
    ctx.beginPath();
    for (let wx = 0; wx <= W; wx += 5) {
      const y = wy + Math.sin(wx*0.04 + ts * 0.0024 + row) * 2;
      wx === 0 ? ctx.moveTo(wx, y) : ctx.lineTo(wx, y);
    }
    ctx.stroke();
  }
}

function drawMine(ctx, mx, my, r) {
  // Anchor chain
  ctx.strokeStyle = 'rgba(80,60,40,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx, my + r);
  ctx.lineTo(mx + Math.sin(my * 0.05) * 4, my + r + 18);
  ctx.stroke();

  // Main sphere
  const g = ctx.createRadialGradient(mx - r*0.3, my - r*0.3, r*0.1, mx, my, r);
  g.addColorStop(0, '#5a5a6a'); g.addColorStop(0.6, '#2a2a38'); g.addColorStop(1, '#111118');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI*2); ctx.fill();

  // Rust patches
  ctx.fillStyle = 'rgba(120,55,20,0.35)';
  ctx.beginPath(); ctx.ellipse(mx + r*0.2, my - r*0.1, r*0.25, r*0.2,  0.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx - r*0.3, my + r*0.2, r*0.18, r*0.15, -0.3, 0, Math.PI*2); ctx.fill();

  // Contact horns (6 spikes)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const hx1 = mx + Math.cos(angle) * r,      hy1 = my + Math.sin(angle) * r;
    const hx2 = mx + Math.cos(angle) * (r + r*0.55), hy2 = my + Math.sin(angle) * (r + r*0.55);
    ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
    ctx.fillStyle = '#555566';
    ctx.beginPath(); ctx.arc(hx2, hy2, 3, 0, Math.PI*2); ctx.fill();
  }

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(mx - r*0.28, my - r*0.28, r*0.35, 0, Math.PI*2); ctx.fill();
}

function drawMineHUD(ctx, W, H, hull, timeLeft) {
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText('HULL INTEGRITY', 10, 20);
  ctx.fillStyle = '#222'; ctx.fillRect(10, 24, 200, 16);
  ctx.fillStyle = hull > 60 ? '#28a046' : hull > 30 ? '#d4af37' : '#be2828';
  ctx.fillRect(10, 24, hull*2, 16);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(10, 24, 200, 16);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`${hull}%`, 218, 37);

  ctx.textAlign = 'right'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`TIME: ${timeLeft}s`, W-10, 20);

  ctx.textAlign = 'center'; ctx.font = 'bold 15px Georgia,serif'; ctx.fillStyle = '#d4af37';
  ctx.fillText('AEGEAN SEA  —  November 21, 1916  —  HMHS BRITANNIC', W/2, 18);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(180,170,150,0.9)';
  ctx.fillText('Arrow keys / WASD: steer  |  Avoid the mines!  |  Survive 45 seconds', W/2, 34);

  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#be2828';
  ctx.fillText(`Mine Hits: ${gs.mineHits}`, 10, 55);
}

function drawIceberg(ctx, x, y, w, h) {
  // Underwater mass
  ctx.fillStyle='rgba(20,60,110,0.5)';
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h*0.8, w*0.7, h*0.6, 0, 0, Math.PI*2); ctx.fill();
  // Body
  const g = ctx.createLinearGradient(x, y, x+w, y+h);
  g.addColorStop(0,'#dceeff'); g.addColorStop(1,'#a0d0f0');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(x+w*0.25, y);
  ctx.lineTo(x,         y+h*0.5);
  ctx.lineTo(x+w*0.15,  y+h);
  ctx.lineTo(x+w*0.85,  y+h);
  ctx.lineTo(x+w,       y+h*0.5);
  ctx.lineTo(x+w*0.75,  y);
  ctx.closePath(); ctx.fill();
  // Highlight
  ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(x+w*0.25,y); ctx.lineTo(x+w*0.15,y+h*0.4); ctx.stroke();
}

function drawMiniShip(ctx, cx, topY, lean) {
  // Overhead top-down view. Bow points UP toward icebergs (direction of travel).
  // Funnels run bow-to-stern along the centreline. lean: –1=left turn, +1=right.
  const SW = 36;   // beam (width)
  const SL = 64;   // length (bow to stern)
  const midY = topY + SL / 2;

  ctx.save();
  ctx.translate(cx, midY);
  ctx.rotate(lean * 0.13);  // bow swings toward direction of movement

  // ── Hull ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0e0e20';
  ctx.beginPath();
  ctx.moveTo(  0,          -SL/2);        // bow tip
  ctx.lineTo(  SW/2 - 3,  -SL/2 + 15);   // bow-right flare
  ctx.lineTo(  SW/2 + 1,  -SL/2 + 28);   // max beam starboard
  ctx.lineTo(  SW/2,       SL/2 - 10);   // stern-right quarter
  ctx.lineTo(  SW/2 - 6,   SL/2);        // stern-right corner
  ctx.lineTo( -SW/2 + 6,   SL/2);        // stern-left corner
  ctx.lineTo( -SW/2,       SL/2 - 10);   // stern-left quarter
  ctx.lineTo( -SW/2 - 1,  -SL/2 + 28);  // max beam port
  ctx.lineTo( -SW/2 + 3,  -SL/2 + 15);  // bow-left flare
  ctx.closePath();
  ctx.fill();

  // Subtle hull edge
  ctx.strokeStyle = 'rgba(50,65,105,0.65)'; ctx.lineWidth = 1;
  ctx.stroke();

  // Waterline stripes along each side
  ctx.strokeStyle = 'rgba(200,190,162,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo( SW/2 - 4,  -SL/2 + 17); ctx.lineTo( SW/2 - 2,   SL/2 - 13);
  ctx.moveTo(-SW/2 + 4,  -SL/2 + 17); ctx.lineTo(-SW/2 + 2,   SL/2 - 13);
  ctx.stroke();

  // ── Superstructure ────────────────────────────────────────────────────────
  ctx.fillStyle = '#b5b09e';
  ctx.fillRect(-SW/2 + 5, -SL/2 + 14, SW - 10, SL * 0.52);

  // ── Funnels (2, arranged bow → stern along centreline) ────────────────────
  const funnelYs = [-SL/2 + 23, -SL/2 + 41];
  funnelYs.forEach(fy => {
    // Funnel body
    ctx.fillStyle = '#1c1a2c';
    ctx.beginPath(); ctx.ellipse(0, fy, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // Titanic red-and-black livery ring
    ctx.strokeStyle = '#b43c14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, fy, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
    // Smoke drifts aft (downward, trailing behind direction of travel)
    ctx.fillStyle = 'rgba(80,80,112,0.46)';
    ctx.beginPath(); ctx.ellipse(0, fy + 8,  3.5, 5.0, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(80,80,112,0.22)';
    ctx.beginPath(); ctx.ellipse(0, fy + 16, 2.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

function drawIcebergHUD(ctx, W, H, hull, timeLeft) {
  ctx.textAlign='left'; ctx.font='bold 13px sans-serif'; ctx.fillStyle='#ffffff';
  ctx.fillText('HULL INTEGRITY', 10, 20);
  ctx.fillStyle='#222'; ctx.fillRect(10,24,200,16);
  ctx.fillStyle = hull>60?'#28a046':hull>30?'#d4af37':'#be2828';
  ctx.fillRect(10,24,hull*2,16);
  ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.strokeRect(10,24,200,16);
  ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
  ctx.fillText(`${hull}%`,218,37);

  ctx.textAlign='right'; ctx.font='bold 13px sans-serif'; ctx.fillStyle='#ffffff';
  ctx.fillText(`TIME: ${timeLeft}s`, W-10, 20);

  ctx.textAlign='center'; ctx.font='bold 16px Georgia,serif'; ctx.fillStyle='#d4af37';
  ctx.fillText('ICEBERG ALLEY  —  April 14, 1912  —  11:40 PM', W/2, 18);
  ctx.font='11px sans-serif'; ctx.fillStyle='rgba(180,170,150,0.9)';
  ctx.fillText('Arrow keys / WASD: steer  |  Avoid the icebergs!  |  Survive 60 seconds', W/2, 34);

  ctx.textAlign='left'; ctx.font='bold 12px sans-serif'; ctx.fillStyle='#be2828';
  ctx.fillText(`Hits: ${gs.icebergHits}`, 10, 55);
}

// ── Touch hint arrows (shown during iceberg gameplay) ─────────────────────
function drawTouchHints(ctx, W, H, keys) {
  const lActive = keys['ArrowLeft'];
  const rActive = keys['ArrowRight'];
  const btnW = 110, btnH = 60, btnY = H - 75, r = 12;

  const drawRounded = (x, y, w, h) => {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.arcTo(x+w,y, x+w,y+r, r); ctx.lineTo(x+w,y+h-r);
    ctx.arcTo(x+w,y+h, x+w-r,y+h, r); ctx.lineTo(x+r,y+h);
    ctx.arcTo(x,y+h, x,y+h-r, r); ctx.lineTo(x,y+r);
    ctx.arcTo(x,y, x+r,y, r); ctx.closePath();
  };

  // Left button
  ctx.fillStyle = lActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
  drawRounded(14, btnY, btnW, btnH); ctx.fill();
  ctx.strokeStyle = lActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5; drawRounded(14, btnY, btnW, btnH); ctx.stroke();
  ctx.font = `bold ${lActive?32:28}px sans-serif`;
  ctx.fillStyle = lActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.fillText('◄', 14 + btnW/2, btnY + btnH/2 + 11);

  // Right button
  ctx.fillStyle = rActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
  drawRounded(W - 14 - btnW, btnY, btnW, btnH); ctx.fill();
  ctx.strokeStyle = rActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
  drawRounded(W - 14 - btnW, btnY, btnW, btnH); ctx.stroke();
  ctx.font = `bold ${rActive?32:28}px sans-serif`;
  ctx.fillStyle = rActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
  ctx.fillText('►', W - 14 - btnW/2, btnY + btnH/2 + 11);
}

// ── Easing helpers ────────────────────────────────────────────────────────
const easeIn  = t => t * t;
const easeOut = t => 1 - (1-t)*(1-t);

// ─────────────────────────────────────────────────────────────────────────────
// SINKING ANIMATION  — full 4-funnel Titanic sinking sequence
// ─────────────────────────────────────────────────────────────────────────────
function drawSinkingAnimation(ctx, W, H, animTick) {
  // Timeline (frames ≈ 60 fps):
  //   0  – 120 : whole ship tilts bow-down to 34° (MAX_TILT)
  //  100 – 155 : break crack flash at amidships
  //  155 – 290 : bow half sinks steeply; stern half falls back to horizontal
  //  290 – 430 : stern half rises from horizontal to vertical
  //  430 – 560 : stern sinks straight down

  const T_TILT_END  = 120;
  const T_BREAK_S   = 100;
  const T_BREAK_E   = 155;
  const T_FALL_END  = 290;
  const T_RISE_END  = 430;
  const T_SINK_END  = 560;
  const MAX_TILT    = 0.60;   // ~34° in radians
  const SLEN        = 280;
  // Break is at local x = –55 (≈ 2/3 from bow, matching historical break point)
  const BRK = -55;

  const t = Math.min(animTick, T_SINK_END);
  const waterX = W / 2 - 20;
  const waterY = H * 3 / 5;

  // Given an angle and the desired screen-Y of the break pivot, return the
  // ctx translation so that drawShip(ctx,0,–8,SLEN) has its break-point there.
  // Break at local (BRK, 0); waterline passes through hull centre (baseY=–8 → hull centre at y≈0).
  const anchor = (angle, pivotY) => ({
    cx: waterX - BRK * Math.cos(angle),   // BRK negative, so –BRK is positive
    cy: pivotY  - BRK * Math.sin(angle),
  });

  // ── Header ────────────────────────────────────────────────────────────────
  if (t < T_SINK_END - 40) {
    ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
    ctx.font = 'bold 28px Georgia,serif'; ctx.fillStyle = 'rgba(195,38,38,0.95)';
    ctx.fillText('THE TITANIC IS SINKING', W / 2, 54);
    ctx.font = '14px Georgia,serif'; ctx.fillStyle = 'rgba(220,210,178,0.80)';
    ctx.fillText('2:20 AM — April 15, 1912', W / 2, 78);
    ctx.shadowBlur = 0;
  }

  // ── Phase 1: whole ship tilting ───────────────────────────────────────────
  if (t <= T_BREAK_E) {
    const angle = easeIn(Math.min(t / T_TILT_END, 1)) * MAX_TILT;
    const {cx, cy} = anchor(angle, waterY);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    drawShip(ctx, 0, -8, SLEN);
    ctx.restore();

    // Break crack flash
    if (t >= T_BREAK_S) {
      const prog  = (t - T_BREAK_S) / (T_BREAK_E - T_BREAK_S);
      const alpha = Math.sin(prog * Math.PI);
      const {cx: bx, cy: by} = anchor(angle, waterY);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(angle);
      ctx.fillStyle = `rgba(255,145,30,${(alpha * 0.95).toFixed(2)})`;
      ctx.fillRect(BRK - 4, -32, 8, 50);
      if (alpha > 0.25) {
        for (let i = 0; i < 7; i++) {
          const sx = Math.sin(t * 0.55 + i * 1.1) * 22;
          const sy = Math.cos(t * 0.55 + i * 0.9) * 16 - 16;
          ctx.fillStyle = `rgba(255,${175 + i * 11},50,${(alpha * 0.75).toFixed(2)})`;
          ctx.beginPath(); ctx.arc(BRK + sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ── Phases 2 +: two independent halves ────────────────────────────────────
  if (t > T_BREAK_E) {
    const ph = t - T_BREAK_E;

    // BOW half (right of break) — steepens and sinks
    const bowDur   = T_RISE_END - T_BREAK_E;
    const bowT     = Math.min(ph / bowDur, 1);
    const bowAngle = MAX_TILT + easeIn(bowT) * 0.92;
    const bowSinkY = waterY + easeIn(bowT) * 260;
    const {cx: bcx, cy: bcy} = anchor(bowAngle, bowSinkY);
    ctx.save(); ctx.translate(bcx, bcy); ctx.rotate(bowAngle);
    ctx.beginPath(); ctx.rect(BRK - 1, -300, 600, 600); ctx.clip();
    drawShip(ctx, 0, -8, SLEN);
    ctx.restore();

    // STERN half (left of break) — falls to horizontal, then rises to vertical, then sinks
    let sternAngle, sternPivotY = waterY;

    if (t <= T_FALL_END) {
      // Falls back toward horizontal
      const fallT = (t - T_BREAK_E) / (T_FALL_END - T_BREAK_E);
      sternAngle = MAX_TILT * (1 - easeOut(fallT));
    } else if (t <= T_RISE_END) {
      // Rises from horizontal to vertical (positive clockwise → left/stern end goes UP)
      const riseT = (t - T_FALL_END) / (T_RISE_END - T_FALL_END);
      sternAngle = easeIn(riseT) * (Math.PI / 2);
    } else {
      // Sinks vertically
      sternAngle = Math.PI / 2;
      const sinkT = (t - T_RISE_END) / (T_SINK_END - T_RISE_END);
      sternPivotY = waterY + easeIn(sinkT) * 340;
    }

    const {cx: scx, cy: scy} = anchor(sternAngle, sternPivotY);
    ctx.save(); ctx.translate(scx, scy); ctx.rotate(sternAngle);
    ctx.beginPath(); ctx.rect(-600, -300, 600 + BRK + 1, 600); ctx.clip();
    drawShip(ctx, 0, -8, SLEN);
    ctx.restore();
  }

  // ── Water overlay (hides submerged sections) ──────────────────────────────
  const seaGrad = ctx.createLinearGradient(0, waterY, 0, H);
  seaGrad.addColorStop(0, 'rgba(5,18,48,0.97)');
  seaGrad.addColorStop(1, 'rgba(0,8,28,0.99)');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, waterY, W, H - waterY);

  // Animated wave at waterline
  ctx.strokeStyle = 'rgba(80,135,205,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let wx = 0; wx <= W; wx += 5) {
    const wy = waterY + Math.sin(wx * 0.036 + animTick * 0.055) * 3;
    wx === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
  }
  ctx.stroke();

  // ── Bubbles ───────────────────────────────────────────────────────────────
  const bubbleCount = Math.min(24, Math.floor(Math.max(0, t - 60) / 4));
  for (let i = 0; i < bubbleCount; i++) {
    const bx = waterX + Math.sin(animTick * 0.07 + i * 2.1) * 95 + Math.cos(i * 1.7) * 38;
    const rise = ((animTick * 1.3 + i * 47) % 130) / 130;
    const by = waterY - 8 - rise * 90;
    const ba = Math.max(0, 0.7 - rise * 0.75);
    ctx.fillStyle = `rgba(150,205,255,${ba.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(bx, by, 1.5 + (i % 3) * 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // ── Debris ────────────────────────────────────────────────────────────────
  if (t > 155) {
    const debrisAlpha = Math.max(0, 0.65 - (t / T_SINK_END) * 0.45);
    for (let i = 0; i < 14; i++) {
      const dx = waterX + Math.cos(i * 1.3 + t * 0.004) * (18 + i * 16);
      const dy = waterY - 5 + Math.sin(i * 2.1) * 9;
      ctx.fillStyle = `rgba(105,82,58,${debrisAlpha.toFixed(2)})`;
      ctx.fillRect(dx, dy, 4 + i % 4, 2);
    }
  }

  // ── Expanding ripples ─────────────────────────────────────────────────────
  [[40,0.55],[110,0.42],[210,0.28]].forEach(([start, alpha]) => {
    if (t <= start) return;
    const r = Math.min((t - start) * 2.4, 290);
    const a = Math.max(0, alpha * (1 - r / 290));
    ctx.strokeStyle = `rgba(100,160,220,${a.toFixed(2)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(waterX, waterY, r, r * 0.20, 0, 0, Math.PI * 2); ctx.stroke();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ARRIVAL ANIMATION  (ship sails past Statue of Liberty at dawn)
// ─────────────────────────────────────────────────────────────────────────────
function drawArrivalScene(ctx, W, H, animTick) {
  const DURATION = 220;
  const progress = Math.min(animTick / DURATION, 1);

  // ── Dawn sky ──────────────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, H * 2/3);
  sky.addColorStop(0, '#0a0520');
  sky.addColorStop(0.45, '#2a1020');
  sky.addColorStop(0.75, '#7a2a18');
  sky.addColorStop(1, '#c84818');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 2/3);

  // ── Sun glow & disc ───────────────────────────────────────────────────
  const sunProg = Math.min(progress * 1.6, 1);
  const sunX = W * 0.62;
  const sunY = H * 2/3 + 15 - sunProg * 75;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 100);
  glow.addColorStop(0, 'rgba(255,190,80,0.55)');
  glow.addColorStop(0.4, 'rgba(255,100,20,0.2)');
  glow.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,200,90,0.95)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 20, 0, Math.PI*2); ctx.fill();

  // Sun rays on water
  ctx.fillStyle = 'rgba(255,140,40,0.07)';
  for (let i = 0; i < 6; i++) {
    const a1 = -0.5 + i * 0.18, a2 = a1 + 0.12;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(a1) * 500, H);
    ctx.lineTo(sunX + Math.cos(a2) * 500, H);
    ctx.closePath(); ctx.fill();
  }

  // ── Harbor water ──────────────────────────────────────────────────────
  const sea = ctx.createLinearGradient(0, H*2/3, 0, H);
  sea.addColorStop(0, '#1a3a5a'); sea.addColorStop(1, '#080f1e');
  ctx.fillStyle = sea; ctx.fillRect(0, H*2/3, W, H/3);

  // Water shimmer
  ctx.strokeStyle = 'rgba(255,170,70,0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const ry = H*2/3 + 12 + i * 8;
    ctx.beginPath();
    ctx.moveTo(W*0.25 + Math.sin(animTick*0.025 + i) * 18, ry);
    ctx.lineTo(W*0.85 + Math.sin(animTick*0.02  + i*1.3) * 14, ry);
    ctx.stroke();
  }

  // ── Manhattan skyline silhouette ──────────────────────────────────────
  ctx.fillStyle = 'rgba(15,10,25,0.92)';
  const bldgs = [
    [0,55],[50,80],[75,65],[100,100],[118,88],[140,120],[158,78],
    [178,95],[200,115],[218,72],[240,130],[258,85],[278,105],[300,70],
    [320,90],[345,60],[370,80],[400,55],[430,70],[460,50],
  ];
  bldgs.forEach(([bx, bh]) => ctx.fillRect(bx, H*2/3 - bh, 28, bh));

  // ── Statue of Liberty ─────────────────────────────────────────────────
  const libX = W - 155, libGY = H*2/3 + 18;
  const libFade = Math.min(progress * 3, 1);
  ctx.globalAlpha = libFade;
  drawStatueOfLiberty(ctx, libX, libGY);
  ctx.globalAlpha = 1;

  // ── Titanic entering from right, sailing left ─────────────────────────
  const shipStartX = W + 260;
  const shipEndX   = W * 0.32;
  const shipCX = shipStartX + (shipEndX - shipStartX) * easeOut(progress);
  const shipY  = H*2/3 - 32;
  ctx.save();
  ctx.scale(-1, 1);
  drawShip(ctx, -shipCX, shipY, 280);
  ctx.restore();
  // Ship wake
  ctx.fillStyle = 'rgba(100,160,220,0.18)';
  for (let i = 1; i <= 5; i++) ctx.fillRect(shipCX, shipY+18+i, i*28, 3);

  // ── Seagulls ──────────────────────────────────────────────────────────
  if (progress > 0.28) {
    ctx.strokeStyle = 'rgba(220,210,185,0.7)'; ctx.lineWidth = 1.5;
    [{x:0.22,y:0.22,ph:0},{x:0.38,y:0.18,ph:1.6},{x:0.15,y:0.31,ph:3.1},{x:0.5,y:0.25,ph:2}].forEach(g => {
      const gx = g.x*W + Math.sin(animTick*0.035+g.ph)*16;
      const gy = g.y*H + Math.sin(animTick*0.05+g.ph)*7;
      ctx.beginPath();
      ctx.moveTo(gx-9,gy); ctx.quadraticCurveTo(gx-4,gy-6,gx,gy);
      ctx.moveTo(gx,  gy); ctx.quadraticCurveTo(gx+4,gy-6,gx+9,gy);
      ctx.stroke();
    });
  }

  // ── "NEW YORK CITY!" text ─────────────────────────────────────────────
  if (progress > 0.52) {
    const ta = Math.min((progress - 0.52) / 0.22, 1);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 12;
    ctx.font = 'bold 42px Georgia,serif';
    ctx.fillStyle = `rgba(212,175,55,${ta})`;
    ctx.fillText('NEW YORK CITY!', W/2, H/2 - 12);
    ctx.font = '17px Georgia,serif';
    ctx.fillStyle = `rgba(220,210,180,${ta})`;
    ctx.fillText('April 17, 1912 — The Titanic arrives safely.', W/2, H/2 + 20);
    ctx.shadowBlur = 0;
  }

  // ── "Click to continue" prompt ────────────────────────────────────────
  if (progress > 0.88) {
    const ca = Math.abs(Math.sin(animTick * 0.07)).toFixed(2);
    ctx.font = '14px Georgia,serif'; ctx.fillStyle = `rgba(180,170,150,${ca})`;
    ctx.textAlign = 'center';
    ctx.fillText('Click to continue...', W/2, H - 18);
  }
}

// ── Statue of Liberty silhouette ──────────────────────────────────────────
function drawStatueOfLiberty(ctx, cx, groundY) {
  ctx.fillStyle = '#0e0c1e';

  // Island base
  ctx.beginPath(); ctx.ellipse(cx, groundY+6, 52, 10, 0, 0, Math.PI*2); ctx.fill();

  // Pedestal (star-fort base, simplified as trapezoid)
  ctx.beginPath();
  ctx.moveTo(cx-32, groundY);    ctx.lineTo(cx-24, groundY-68);
  ctx.lineTo(cx+24, groundY-68); ctx.lineTo(cx+32, groundY);
  ctx.closePath(); ctx.fill();

  // Statue robe
  ctx.beginPath();
  ctx.moveTo(cx-16, groundY-68);  ctx.lineTo(cx-9,  groundY-168);
  ctx.lineTo(cx+9,  groundY-168); ctx.lineTo(cx+16, groundY-68);
  ctx.closePath(); ctx.fill();

  // Head
  ctx.beginPath(); ctx.ellipse(cx, groundY-181, 9, 11, 0, 0, Math.PI*2); ctx.fill();

  // Crown — 7 rays
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI/2 + (i-3) * (Math.PI/9);
    const r1 = 11, r2 = 24;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a-0.09)*r1, groundY-181 + Math.sin(a-0.09)*r1);
    ctx.lineTo(cx + Math.cos(a)*r2,      groundY-181 + Math.sin(a)*r2);
    ctx.lineTo(cx + Math.cos(a+0.09)*r1, groundY-181 + Math.sin(a+0.09)*r1);
    ctx.closePath(); ctx.fill();
  }

  // Raised right arm (torch arm, extends upper-right)
  ctx.beginPath();
  ctx.moveTo(cx+6,  groundY-155); ctx.lineTo(cx+36, groundY-218);
  ctx.lineTo(cx+42, groundY-215); ctx.lineTo(cx+14, groundY-151);
  ctx.closePath(); ctx.fill();

  // Torch shaft
  ctx.fillRect(cx+34, groundY-238, 9, 22);

  // Torch flame (warm orange)
  ctx.fillStyle = 'rgba(255,175,45,0.92)';
  ctx.beginPath(); ctx.ellipse(cx+38, groundY-246, 5, 9, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#0e0c1e';

  // Tablet (left arm, lower)
  ctx.fillRect(cx-20, groundY-130, 13, 20);
}

// ── Scoring ───────────────────────────────────────────────────────────────
function calculateScore() {
  const survived  = !gs.sank;
  const alive     = gs.aliveCount();
  const boatSurvivors = Math.min(alive, gs.lifeboats);

  // Average health of survivors
  let avgH = 0, n = 0;
  for (let i = 0; i < 5; i++) if (gs.alive[i]) { avgH += gs.health[i]; n++; }
  avgH = n > 0 ? Math.round(avgH / n) : 0;

  const rows = [];   // { label, pts, cls }
  let total  = 0;

  const add = (label, pts, cls) => { rows.push({label, pts, cls}); total += pts; };

  // ── Main components ────────────────────────────────────────────────────
  if (survived) {
    add('Safe Arrival Bonus', 5000, 'pos');
  } else if (boatSurvivors > 0) {
    add(`Lifeboat Survivors (${boatSurvivors} rescued)`, boatSurvivors * 350, 'pos');
  }

  add(`Passengers Alive (${alive} / 5)`, alive * 400, 'pos');
  add(`Crew Health (avg ${avgH}%)`,        Math.round(avgH * 4), 'pos');
  add(`Lifeboat Preparedness (${gs.lifeboats} seats)`, gs.lifeboats * 70, 'pos');

  // Speed bonus: reward finishing fast, but only meaningful if survived
  if (survived && gs.dayNum > 0) {
    const dayBonus = Math.max(0, (17 - gs.dayNum) * 55);
    if (dayBonus > 0) add(`Swift Voyage (${gs.dayNum} days)`, dayBonus, 'pos');
  }

  // Penalties
  if (gs.icebergHits > 0) add(`Iceberg Collisions (${gs.icebergHits})`, -(gs.icebergHits * 260), 'neg');
  if (gs.mineHits > 0)    add(`Mine Collisions — Britannic (${gs.mineHits})`, -(gs.mineHits * 150), 'neg');

  // ── Class hardship multiplier ─────────────────────────────────────────
  // Steerage has fewest resources and lifeboats — harder, so worth more
  const multMap  = {1: 1.0, 2: 1.15, 3: 1.35};
  const multLabel = {1: 'First Class (×1.0)', 2: 'Second Class Bonus (×1.15)', 3: 'Steerage Hardship Bonus (×1.35)'};
  const mult = multMap[gs.shipClass];

  const preMultTotal = Math.max(0, total);
  const final = Math.round(preMultTotal * mult);
  if (mult > 1.0) add(multLabel[gs.shipClass], final - preMultTotal, 'mult');
  total = Math.max(0, final);

  // ── Rating ────────────────────────────────────────────────────────────
  const ratings = [
    [12000, 'S  — Legendary Captain'],
    [ 9500, 'A  — Distinguished Service'],
    [ 7000, 'B  — Competent Officer'],
    [ 4500, 'C  — Adequate Passage'],
    [ 2000, 'D  — Troubled Voyage'],
    [    0, 'F  — A Tragedy at Sea'],
  ];
  const rating = ratings.find(([min]) => total >= min)[1];

  return { total, rows, rating };
}

// ═════════════════════════════════════════════════════════════════════════════
// ENDING SCREEN
// ═════════════════════════════════════════════════════════════════════════════
var _endActx=null;
function playEndSting(kind){
  try{
    if(!_endActx) _endActx = new (window.AudioContext||window.webkitAudioContext)();
    var actx=_endActx; if(actx.state!=='running') actx.resume();
    var t0=actx.currentTime;
    var notes = kind==='win' ? [[523,0],[659,0.12],[784,0.24],[1047,0.36]] : [[392,0],[330,0.12],[262,0.24],[196,0.36]];
    notes.forEach(function(n){
      var o=actx.createOscillator(), g=actx.createGain();
      o.type = kind==='win' ? 'triangle' : 'sine';
      o.frequency.value = n[0];
      g.gain.setValueAtTime(0.0001, t0+n[1]);
      g.gain.exponentialRampToValueAtTime(0.22, t0+n[1]+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+n[1]+0.36);
      o.connect(g); g.connect(actx.destination);
      o.start(t0+n[1]); o.stop(t0+n[1]+0.4);
    });
  }catch(e){}
}

function buildEnding(app) {
  const survived  = !gs.sank;
  playEndSting(survived ? 'win' : 'lose');
  const alive     = gs.aliveCount();
  const survivors = Math.min(alive, gs.lifeboats);
  const { total, rows, rating } = calculateScore();

  // Save this run and get its rank
  const hsEntry = { score: total, rating: rating.slice(0,1), sank: gs.sank,
                    date: new Date().toLocaleDateString() };
  const hsRank  = saveHS('mucko_hs_ttrail', hsEntry);
  const hsAll   = getHS('mucko_hs_ttrail');

  let narrative;
  if (survived) {
    if (alive===5) narrative = 'Against all odds, the Titanic navigated safely through the iceberg field. Your entire party arrived in New York healthy and in good spirits. Crowds cheered as the great ship docked at Pier 59.';
    else if (alive>=3) narrative = `Your party made it through Iceberg Alley, though the voyage claimed some lives. ${alive} of your companions stepped off the gangway onto American soil.`;
    else narrative = `Only ${alive} of your party survived the crossing. The voyage was harrowing, but at last you arrived in New York.`;
  } else {
    if (survivors===0) narrative = 'The Titanic struck an iceberg and sank into the North Atlantic. With no lifeboat seats available, all members of your party perished in the freezing waters. Their names are among the 1,517 lost.';
    else if (survivors===alive) narrative = `The Titanic struck an iceberg and sank in two hours and forty minutes. Thanks to your lifeboat preparations, all ${alive} surviving passengers secured seats and were rescued at dawn by the RMS Carpathia.`;
    else narrative = `The Titanic struck an iceberg and sank. In the chaos, only ${survivors} of your ${alive} remaining passengers found lifeboat seats. They were rescued by the Carpathia. ${alive-survivors} soul${alive-survivors>1?'s':''} were lost to the icy sea.`;
  }

  const clsName = ['','First Class','Second Class','Third Class (Steerage)'][gs.shipClass];

  const scoreRows = rows.map(r =>
    `<tr><td>${r.label}</td><td class="${r.cls}">${r.pts >= 0 ? '+' : ''}${r.pts.toLocaleString()}</td></tr>`
  ).join('');

  const div = document.createElement('div');
  div.id = 'ending-screen';
  div.innerHTML = `
    <div class="ending-big">${survived?'🏆 🎉':'😵 🚢'}</div>
    <div class="ending-title ${survived?'safe':'sunk'}">${survived?'New York City — April 17, 1912':'The Titanic Has Sunk'}</div>
    <div class="ending-narrative">${narrative}</div>

    <div class="score-panel">
      <div class="score-number">${total.toLocaleString()}</div>
      <div class="score-rating">${rating}</div>
      <hr class="score-divider">
      <table class="score-breakdown">
        ${scoreRows}
        <tr class="total-row"><td>FINAL SCORE</td><td>${total.toLocaleString()}</td></tr>
      </table>
    </div>

    <div class="ending-stats">
      <table>
        <tr><td>Voyage Class</td><td>${clsName}</td></tr>
        <tr><td>Days at Sea</td><td>${gs.dayNum}</td></tr>
        <tr><td>Passengers Alive</td><td>${alive} / 5</td></tr>
        <tr><td>Iceberg Hits</td><td>${gs.icebergHits}</td></tr>
        <tr><td>Mine Hits (Britannic)</td><td>${gs.mineHits}</td></tr>
        <tr><td>Lifeboat Seats</td><td>${gs.lifeboats}</td></tr>
        <tr><td>Titanic Outcome</td><td style="color:${survived?'#28a046':'#be2828'};font-weight:bold">${survived?'SAFE ARRIVAL':'SUNK'}</td></tr>
        <tr><td>Britannic Outcome</td><td style="color:${!gs.britannicSank?'#28a046':'#be2828'};font-weight:bold">${!gs.britannicSank?'SAFE PASSAGE':'SUNK'}</td></tr>
      </table>
    </div>

    <div class="ending-hist">Historical note: On April 15, 1912, the real RMS Titanic sank after striking an iceberg at 11:40 PM the previous night. Of the 2,224 people aboard, 1,517 perished — largely due to a shortage of lifeboats. She carried only 20 lifeboats, enough for 1,178 people. Her wreck was discovered in 1985 at a depth of 12,500 feet.</div>
    <div class="ending-hist">The Titanic's sister ship, HMHS Britannic, was converted into a hospital ship during World War I. On November 21, 1916, she struck a German naval mine in the Aegean Sea near the Greek island of Kea and sank in just 55 minutes — faster than the Titanic. Thanks to the daylight and calmer seas, most of her 1,066 crew and medical staff survived. She remains the largest ocean liner ever sunk.</div>
    <div class="ending-hs">
      <div class="ending-hs-title">🏆 Best Crossings — This Device</div>
      ${hsAll.length === 0 ? '' : `<table class="ending-hs-table">
        <tr class="ending-hs-header"><th>#</th><th>Score</th><th>Rating</th><th>Outcome</th><th>Date</th></tr>
        ${hsAll.slice(0,8).map((e,i) => `<tr class="${i === hsRank-1 ? 'ending-hs-new' : ''}">
          <td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
          <td>${e.score.toLocaleString()}</td>
          <td>${e.rating}</td>
          <td>${e.sank ? '💀 Sank' : '⚓ Safe'}</td>
          <td>${e.date}</td>
        </tr>`).join('')}
      </table>`}
      ${hsRank <= 3 ? `<div class="ending-hs-new-msg">🌟 New personal best — #${hsRank}!</div>` : ''}
    </div>

    <div class="ending-btns">
      <button id="play-again" class="btn-green btn-large">🔄 Play Again</button>
    </div>`;
  app.appendChild(div);
  div.querySelector('#play-again').addEventListener('click', () => goTo(buildTitle));
}

// ── Viewport scaling (makes game fit any screen size) ─────────────────────
function scaleToViewport() {
  const app = document.getElementById('app');
  if (!app) return;
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const scale = Math.min(vw / 820, vh / 620);
  const ox = (vw - 820 * scale) / 2;
  const oy = (vh - 620 * scale) / 2;
  app.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
}
window.addEventListener('resize', scaleToViewport);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scaleToViewport);
  window.visualViewport.addEventListener('scroll', scaleToViewport);
}
scaleToViewport();

// ── Cheat code: type "gtia" anywhere to jump to the iceberg mini-game ────
(function() {
  const SEQ = 'gtia';
  let buf = '';
  window.addEventListener('keydown', e => {
    if (e.key.length !== 1) return;
    buf = (buf + e.key).slice(-SEQ.length);
    if (buf === SEQ) { buf = ''; gs.init(); goTo(buildIceberg); }
  });
})();

// ── Cheat code: type "gtmi" anywhere to jump to the mine-field mini-game ──
(function() {
  const SEQ = 'gtmi';
  let buf = '';
  window.addEventListener('keydown', e => {
    if (e.key.length !== 1) return;
    buf = (buf + e.key).slice(-SEQ.length);
    if (buf === SEQ) { buf = ''; gs.init(); goTo(buildMineField); }
  });
})();

// ── URL param cheats: ?gtia or ?gtmi (mobile-friendly equivalents) ────────
(function() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('gtia')) { gs.init(); goTo(buildIceberg); }
  else if (p.has('gtmi')) { gs.init(); goTo(buildMineField); }
})();

// ── Dev skip buttons (visible only when ?dev is in the URL) ───────────────
// Useful on mobile where keyboard cheats aren't available.
// Access via: index.html?dev
(function() {
  if (!new URLSearchParams(window.location.search).has('dev')) return;
  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed', 'bottom:8px', 'left:50%', 'transform:translateX(-50%)',
    'display:flex', 'gap:10px', 'z-index:9999', 'pointer-events:auto',
  ].join(';');
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'background:rgba(20,20,40,0.82)', 'color:#d4af37',
      'border:1px solid #d4af37', 'border-radius:6px',
      'padding:6px 14px', 'font:bold 13px Georgia,serif',
      'cursor:pointer', 'opacity:0.85',
    ].join(';');
    b.addEventListener('click', fn);
    return b;
  };
  bar.appendChild(mkBtn('⚓ Skip → Icebergs', () => { gs.init(); goTo(buildIceberg); }));
  bar.appendChild(mkBtn('💣 Skip → Mines',    () => { gs.init(); goTo(buildMineField); }));
  document.body.appendChild(bar);
})();

// ── Start the game ────────────────────────────────────────────────────────
goTo(buildTitle);
