# Orbital Mechanics Simulator — Feature Roadmap

## Where We Are (Phases 1 & 2 — Implemented)

`orbit/index.html` is a self-contained browser game (no build step, iOS 12 Safari compatible).

### What's Working
- **Earth** fixed at canvas center (blue gradient circle, 24px display radius)
- **Moon** on analytical circular orbit — `pos = (cos(ω*t), sin(ω*t))` where ω = 2π rad/TU. Not simulated, not affected by spacecraft. Orbits counterclockwise.
- **Spacecraft** integrates using symplectic Euler (energy-conserving) in true 3-body gravity from Earth + Moon
- **Dimensionless units**: DU = Earth-Moon distance, TU = Moon orbital period. `GM_E = 4π²`, `GM_M = GM_E * 0.01230`. Eliminates floating-point scale issues.
- **SCALE = 310 px/DU** — Moon orbit = 310px from center on 800×800 canvas
- **Three preset orbits** (each has per-orbit speed multiplier and trail sampling rate):
  1. **Low Earth Orbit** — circular at r=0.12 DU, period ~6.6s at 1× speed
  2. **Figure-8 Encounter** — retrograde orbit at r=0.63 DU (period = exactly 0.5 TU = half Moon period); encounters Moon 3× per lunar month (every 1/3 TU); creates a 3-petal figure-8 pattern in the inertial frame
  3. **Hohmann Ellipse** — periapsis 0.12 DU, apoapsis 0.55 DU; demonstrates Kepler's 2nd law (spacecraft visibly faster at periapsis)
- **Fading orbital trail** (TRAIL_MAX = 2000 points, per-orbit sampling to cover full trajectories)
- **Time multiplier** (1×/2×/5×/10×, T key or on-screen button)
- **Phase state machine**: `select` → `sim` (R key or Back button to return)
- **iOS 12 compatible**: no `??`, `?.`, `.at()`, no CSS `inset`/`gap`/`aspect-ratio`; `roundRect` polyfill; `visualViewport` resize handler; DPR capped at 1.5

### Phase 2 additions (burn engine + free placement)
- **Thrust integration** in `stepPhysics`: prograde/retro along velocity (±THRUST_MAG = 3 DU/TU²), lateral perpendicular (±STEER_MAG = 1 DU/TU²). ΔV budget drains per sub-step proportional to applied thrust; engine cuts off at zero budget.
- **Starting ΔV** = 18 DU/TU ≈ 2.9 km/s (constant `DV_START`). Conversion factor `DU_PER_TU_TO_KMPS = 0.1629`.
- **Flame / puff particles** (`flameParts` array, capped at 200): emit in real time from the spacecraft tail for prograde, nose for retrograde, side opposite push for lateral. Updated by real elapsed seconds so the visual rate is independent of the time multiplier.
- **Keyboard**: Space / Arrow-Up = prograde, Arrow-Down = retrograde, Arrow-Left/Right = lateral steer.
- **Touch**: four on-canvas circular buttons during `sim` — BURN, RETRO, ◀, ▶ — driven by a new multi-touch `activeTouches` map. Buttons glow when held, dim when ΔV=0.
- **HUD**: top-center ΔV meter (color-graded green → amber → red) with km/s readout; km/s speed strip at bottom-center.
- **Free placement** phase: new `phase = 'place'` triggered by the "Custom Orbit" entry on the select screen. Tap outside Earth to place; drag ship-to-pointer arrow sets velocity (`PLACE_VEL_SCALE = 0.05 DU/TU per screen pixel`); LAUNCH commits. Reset clears placement.
- **Unified pointer state** (`pointerDown / pointerJust / pointerUp`) drives the drag gesture across both mouse and touch.

### Key File Structure
```
orbit/index.html     — entire game, self-contained
orbit/PLAN.md        — this file
```

### Physics Architecture (important for future changes)
- `stepPhysics(dt)` — one symplectic Euler step in TU
- `moonPos(simT)` — analytical Moon position, no physics
- Earth gravity: vector from Earth to spacecraft, normalized, scaled by GM_E/r²
- Moon gravity: same but GM_M/r²
- Guard: `if (re < 0.001) re = 0.001` — prevents singularity if craft hits body center
- SIM_DT = 1/3600 TU per integration step; multiple steps per animation frame via nSteps

---

## Phase 2 — Spacecraft Controls (COMPLETE ✅)

Implemented as described below. Commit history on branch `claude/orbital-sim-next-phase-uRrqr`:
1. Keyboard burn engine + ΔV meter + flame particles
2. On-screen touch burn buttons (BURN, RETRO, ◀, ▶)
3. Free-placement "Custom Orbit" phase with drag-to-aim

Possible follow-ups for the burn system if desired later:
- Refillable ΔV (fuel pickup mini-game or timed replenishment)
- Numeric initial-velocity panel on the place screen for precision missions
- Tap-and-hold on the ship in sim to see an auto-paused velocity vector
- **Hidable "engine boost" control menu**: toggled from a gear/settings icon,
  with a slider or preset buttons to juice up THRUST_MAG / STEER_MAG beyond
  the safe tuned values. Alternative framing: an "ascent stage" mode with
  ~10× thrust for a limited ΔV window (the tuned base thrust remains the
  default so the free-placement and program trajectories stay physically
  reasonable).

---

## Phase 3 — "Flight Programs" (Scripted Missions)

This is the key educational feature. Instead of free-flight presets, these are *guided scenarios* that execute specific burns at specific times/conditions.

### Concept
A flight program is an orbit preset that automatically fires burns at certain triggers:
- **Time trigger**: burn at t = T_burn for duration T_dur
- **Condition trigger**: burn when altitude = target_alt or when velocity angle = θ

Each program plays out like a mission replay with on-screen annotations.

### Proposed Flight Programs

#### Program 1: Hohmann Transfer (Earth → Circular High Orbit)
Steps:
1. Start in circular LEO (r = 0.12 DU)
2. At t=0, prograde burn → transfer ellipse (apoapsis at ~0.45 DU)
3. At apoapsis, second prograde burn → circularize
Annotation: show ΔV arrow at each burn point; display orbit shape before/after

#### Program 2: Trans-Lunar Injection + Lunar Orbit Insertion
The big one the user described:
1. Start in LEO (r = 0.12 DU)
2. **TLI burn** at periapsis → transfer ellipse reaching Moon's orbit
   - V_TLI = sqrt(GM_E*(2/0.12 - 1/A_TLI)) ≈ 17.5 DU/TU (from r=0.12)
   - Need to TIME the TLI so Moon is at apoapsis position at transfer time
3. **LOI burn** at closest approach to Moon → lunar orbit (retrograde or prograde around Moon)
   - This is the hardest: need to compute Moon-centered hyperbolic approach and time the burn
   - In Moon's frame: spacecraft arrives with v_∞, fire retrograde burn to slow below escape velocity
4. **Orbit the Moon** for a few cycles — show lunar orbit (small ellipse around Moon)
5. **Trans-Earth Injection** — burn from Moon orbit back toward Earth
6. Repeat (infinite loop)

Implementation notes for LOI:
- Need to detect when spacecraft is at periapsis of Moon flyby
- Trigger condition: `d(rm)/dt` changes sign (spacecraft distance from Moon reaches minimum)
- At periapsis: fire retrograde burn relative to Moon for duration to achieve circular orbit

This requires a "periapsis detection" utility in the physics loop:
```js
var prevRm = Infinity;
// in stepPhysics, after computing rm:
if (rm > prevRm && prevRm < LOI_THRESHOLD) {
  // just passed periapsis — fire LOI burn
}
prevRm = rm;
```

LOI ΔV ≈ v_∞ * (sqrt(1 + 2*GM_M/(r_periapsis*v_∞²)) - 1) (hyperbolic excess minus circular at periapsis)

#### Program 3: Free Return (like Apollo 13)
1. Start in LEO
2. TLI burn → free-return trajectory (just enough energy to reach Moon and come back)
3. No LOI — just swing around Moon and return
4. Annotation: "If engine fails here, spacecraft returns to Earth automatically"

For this, the TLI must be aimed specifically for the free-return (lower energy than full LOI).
The "good" initial conditions for a free-return from r=0.12 DU:
- V_TLI such that apoapsis just barely reaches Moon's orbit
- Moon phased so it deflects spacecraft back toward Earth

#### Program 4: Gravity Assist
1. Start in LEO with insufficient energy to escape
2. Time a close flyby of the Moon to gain energy
3. After the flyby, spacecraft has enough energy to reach higher orbit or escape

---

## Phase 4 — Visual Polish

### Earth
- Draw continents with canvas paths (simplified outlines)
- Rotate Earth at correct rate: 1 Earth day = 1/(27.32) TU ≈ 0.0366 TU → visually fast, maybe throttle to 1/10 speed for aesthetics
- Or: use a simple texture-like pattern (blue oceans, green/brown land patches drawn as circles/ellipses)

### Moon
- Draw Moon phases: based on angle between Moon-Earth-Sun (assume Sun in fixed direction, e.g., +x)
- Phase = angle of illumination → draw illuminated hemisphere as white arc

### Spacecraft
- More detailed SVG-like canvas drawing: capsule shape, solar panels
- Burn flame already planned (Phase 2b)
- Thruster puffs already planned (Phase 2b)

### Background
- More realistic star field (varied sizes, slight twinkle via alpha oscillation)
- Optional: very faint Milky Way band

### UI Polish
- Speed indicator showing spacecraft velocity in km/s
- Orbit predictor: draw the next N seconds of trajectory as a dashed line (requires copying state, running physics forward without committing, then drawing)
- Apoapsis/periapsis markers on the predicted trajectory

---

## Phase 4 predictor + Phases 4.5 / 5 / 6 — COMPLETE ✅

### Orbit Predictor (Phase 4 follow-up)
- `computePredictor()` runs 500 coast-only physics steps (0.20 TU ahead) every frame
- Draws ~125 fading white dots and APO/PER markers (amber/blue circles with labels)
- `predPts` / `predMkrs` arrays; uses same `EARTH_MASS_STEPS` / `MOON_MASS_STEPS` multipliers

### Options Panel (Phase 4.5 + 5 + 6 combined)
- OPT button (top-right HUD), also toggled with O key; `showOpts` flag
- **Auto-Orient**: when on, BURN/RETRO auto-rotates toward prograde/retrograde before firing
  (emits RCS puffs during rotation); overrides manual rotation key while aligning
- **Trajectory**: show/hide the orbit predictor projection (ON by default)
- **Earth mass** multiplier: 0.5× / 1× / 2× / 4× (default 1×)
- **Moon mass** multiplier: 0 / 0.5× / 1× / 2× / 4× (default 1×)
- **Thrust** multiplier: 0.5× / 1× / 2× / 4× (default 1×)
- **Spacecraft skin**: Capsule (white triangle) / Saturn V (tapered body + brass engine bell + stage band) / Duck Dieb (yellow body + mallard head + bandit mask)
- `handleOptsClick()` cycles each row on tap; `drawOptionsPanel()` renders the overlay

### Narration (Phase 6)
- `NARRATION_EVENTS` array checked once per sim batch: Moon SOI entry, escape velocity, dangerously close to Earth, close Moon encounter, high speed
- "Orbit stabilized" fires when `stepAutopilot` shuts off naturally
- Toast overlay at y=90 fades in/out; `narrated` dict prevents re-trigger per session
- Story flavor text per flight program shown as narration toast at program launch

### Achievements (Phase 6)
- Stored in `localStorage` key `orbit_ach`; unlocked once per install
- Gold achievement toast at bottom-center (fades in/out, 3.5s)
- `unlockAch(id, label)` — idempotent, persists to localStorage
- Achievements: First Burn, Lunar Tourist (Moon SOI), Escape Artist (escape velocity), Smooth Operator (autopilot stabilize), Moon Walker (circularize around Moon)

---

## Phase 5 — Customization Panel — COMPLETE ✅ (merged into OPT panel above)

---

## Phase 6 — Muckoification — COMPLETE ✅ (partial; merged into OPT panel + narration above)

Remaining Muckoification ideas for later:
- **More skins**: "Samster's Rocket" (hamster silhouette?), "Duck Dieb's Escape Pod"
- **More narration events**: first figure-8 Moon encounter, Hohmann circularization complete, full orbit of Moon
- **Mission flavor text**: story premise per flight program ("Samster needs to reach the Moon to recover the stolen cheese")
- **Achievement system**: fastest Moon insertion, smallest ΔV Hohmann, most figure-8 loops without crashing

---

## Technical Notes for Next Instance

### iOS 12 Compat Checklist (always apply)
- No `??`, `?.`, `.at()`
- No CSS `inset`, flex `gap`, `aspect-ratio`, `100svh`
- `visualViewport` resize handler (already in place)
- `roundRect` polyfill (already in place)
- DPR capped at 1.5 (already in place)

### Coordinate System Reminder
- Physics coords: x right, y UP. Earth at (0,0).
- Screen coords: x right, y DOWN. Earth at (CX=400, CY=400).
- `sx(x) = CX + x * SCALE`, `sy(y) = CY - y * SCALE`
- Velocity direction for screen: `ndx = vx/|v|`, `ndy = -vy/|v|` (flip y!)

### Symplectic Euler Reminder
- `v += a * dt` THEN `x += v * dt` (order matters! this is the symplectic property)
- If you reverse the order (`x += v*dt` first) it becomes anti-symplectic (energy-increasing, unstable)
- SIM_DT = 1/3600 TU is fine for all three current orbits; may need reduction to 1/7200 for very close Moon flybys in Phase 3

### Moon Encounter Detection (needed for Phase 3 flight programs)
```js
var prevRm = 99;
// inside stepPhysics, after computing rm:
if (rm < ENCOUNTER_DIST && rm < prevRm) {
  // approaching Moon — will trigger LOI if it's a flight program
}
if (rm > prevRm && rm < ENCOUNTER_DIST) {
  // just passed periapsis of Moon encounter
}
prevRm = rm;
```
ENCOUNTER_DIST ≈ 0.15 DU (just inside Moon's SOI of 0.167 DU)

### Adding a New Preset Orbit
Add an entry to the ORBITS array with:
- `name`, `desc`, `color` (CSS hex), `trailRGB` ([r,g,b] array)
- `sx`, `sy`, `vx`, `vy` — initial spacecraft state in DU / DU/TU
- `moonAngle0` — Moon's initial angle in radians (0 = right side)
- `speed` — BASE_SPEED multiplier (1 = 0.01 TU/real-s)
- `trailEvery` — store trail point every N animation frames

### Adding a Flight Program
Flight programs are different from preset orbits — they're scripted sequences. Suggested structure:
```js
var PROGRAMS = [
  {
    name: 'Hohmann Transfer',
    desc: '...',
    // Initial state (same as orbit preset):
    sx: ..., sy: ..., vx: ..., vy: ..., moonAngle0: ...,
    speed: 2, trailEvery: 1,
    color: '#aff',
    // Burn sequence:
    burns: [
      { triggerType: 'time', triggerVal: 0.0, direction: 'prograde', dv: 5.2 },
      { triggerType: 'apoapsis', direction: 'prograde', dv: 3.1 }
    ]
  }
];
```
The game loop checks burn triggers each physics step and applies `dv` in the specified direction.

---

## Commit History Context
- Initial implementation: Phase 1 mechanics, three preset orbits, trail system
- Current state on branch `claude/orbit-sim-*`: all Phase 1 features complete and working

## Branch Strategy
- Work on `main` until Phase 2 is ready for testing
- Create `claude/orbit-phase2-controls` for burn controls
- Create `claude/orbit-phase3-programs` for flight programs
