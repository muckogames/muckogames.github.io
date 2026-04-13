# JOHN CARMERO'S SOFTDISK REVIEW & BATTLE PLAN
### *Gamer's Edge Disk 47 — Code Review & Development Roadmap*
*Dictated from the lake house. Put on some Pantera first.*

---

## FIRST IMPRESSION

Al called me into the Softdisk office and handed me a zip disk. Said, "some guy's been building games on his own time, we want to put them in the next issue, maybe a few issues — see what you think." So I took the disk home, booted it up on the 486, and I lost three hours.

Not because the code is perfect. It's not. But because the *games* are genuinely fun, which is honestly rarer than people think. Most of what lands on my desk has clean code and dead gameplay. This is the opposite problem. This is a '69 Camaro that needs a tune-up. The engine is good. The soul is there. Let's talk about what we've got.

---

## WHAT'S HERE: THE INVENTORY

### The Trail Series *(Softdisk Gold Tier)*

**Titanic Trail** (Java), **Train Trail**, **Car Trail**, **Airplane Trail** — this developer has built an entire genre. Oregon Trail DNA, but with real warmth and wit. The Airplane Trail one (commanding the R.M.A.S. Mucko across the Atlantic) made me actually laugh at the wireless telegraph messages. The writing voice is consistent and charming across all of them. These are the kind of games that sneak up on you — you think you're doing resource management and then suddenly you care whether your fictional passengers make it to Cherbourg.

*The bad news:* These are structurally brothers but coded like strangers. Same patterns, different files, no shared guts. That's a maintenance bill waiting to come due.

### The Heist/Adventure Games *(Technical Achievement Tier)*

**Samster Diebs from the Diebs**, **Duck Dieb**, **Pflueger and the Hippo** — okay, this is where I got impressed. The Hippo game alone is 3,200 lines and it has a *cheat code system*. A cheat code system! In a web game! The stealth AI in Duck Dieb has line-of-sight detection. Samster has a QTE baby-silencing minigame that made me snort. The canvas backdrop caching in Samster shows someone who thought about performance, not just features.

The dialog system — they split dialogue into `dialog-data.js` files. That's a real architectural instinct. Not fully realized yet, but the instinct is there.

### **Rocket Trail** *(My Personal Favorite)*

This one. Multi-phase space mission. Saturn V launch sequence, asteroid mining, gravity-based moon landing, re-entry heat evasion, parachute timing. Real physics (not fake "game feel" physics — actual thrust/gravity vectors). Web Audio synthesis for the rocket sounds. The dev even kept *playtesting notes from a 6-year-old.* That's game design discipline.

The draw code for the Saturn V is 170 lines of pure ctx calls. It shouldn't work as well as it does. It looks great.

### **Mucko Tac Toe** *(Elegant Little Beast)*

Tic-tac-toe with minimax AI, configurable board sizes up to 8×8, and emoji symbol pickers. Shipped last. Shows maturity — the setup screen is HTML form elements, the game is canvas. Clean handoff. This is the one I'd put on the cover disk with the least prep work.

---

## THE TECHNICAL VERDICT (Carmack Brain Engaging)

The code shares a skeleton that works. Canvas scaling via CSS transform matrix, input as a `K`/`JP` state dictionary, Web Audio API for sound synthesis, localStorage for scores. Every game. Consistently. That's discipline and it means the patterns are debugged.

**What bothers me:**

1. **2,400-line monoliths.** I understand why — one HTML file loads anywhere. But you cannot optimize what you cannot see. The Saturn V draw function is called *every frame*. Pre-render it to an offscreen canvas once and you've cut your draw budget in half for that game. The Hippo stealth sequence probably has the same problem with the keeper sprites.

2. **No shared library.** Copy-paste code is a liability. Every bug fix gets applied once (or forgotten). The canvas resize function alone exists in 9 places. When Safari changes its viewport behavior again — and it will — someone has to fix it 9 times.

3. **Global state everywhere.** No encapsulation. Let/const at module level, phases as loose strings, game state as scattered variables. This works fine until two game features need to share something and you spend an hour untangling naming collisions.

4. **The iOS app is a lie.** It's a WKWebView wrapper around a local HTML file — which is *fine*, actually the right call — but the web assets live in two places with no sync mechanism. The second the web version gets updated, the iOS app is out of date.

**What I respect:**

- The `visualViewport` API usage for iPad keyboard avoidance. That's a real iOS quirk that most devs don't know about. This dev learned it from actual users.
- Graceful audio degradation. The try/catch around AudioContext is correct and thorough.
- The `roundRect` polyfill for Safari. Boring. Necessary. Done correctly.
- The whole philosophy of just shipping games. There's no webpack config, no TypeScript, no build pipeline — and there are *twelve finished games*. The abstraction debt is real but so is the output.

---

## THE ROMERO DESIGN READ (Other Brain Engaging)

The games have personality. That's not a given. Most indie games are technically competent and aesthetically anonymous. These have *names* — Mucko, Samster Diebs, Pflueger, Lekan the panda mastermind. They have recurring characters. The Airplane Trail is the *R.M.A.S. Mucko*. There is a named universe here, even if accidental.

The weak points are pacing and feedback. In Rocket Trail, if you crash the lander, you don't always know *why*. Came in too fast? Too much lateral drift? The game needs to tell you. Same pattern in Samster — when a guard catches you, the consequence is immediate but the information density is low. "You got caught" is not the same as "you got caught because you moved when the guard was facing north."

The heist games in particular want a *retry loop* with better debrief. Games like this live or die on "one more try" energy. Right now the energy is "well, I guess I'll restart."

---

## WHAT I'D DO: THE BATTLE PLAN

### Immediate (Disk 47 — Ship It)

**1. Rocket Trail: Crash Feedback Pass**
When you die in any phase, show a brief post-mortem screen with the actual cause. "Velocity at impact: 47 m/s (max safe: 15 m/s)." Carmack brain says this is one conditional and a text render. Romero brain says it turns death from punishment into information.

**2. Hippo: Cheat Code Easter Egg Screen**
The cheat codes are already there (LEKAN, NIKNIK, BASIL, PRASTHEKOADA, MARGARITAVILLE). Add a hidden "cheat scroll" that shows as a secret room when you activate three codes in one session. Lean into it. Put flavor text on each code. "MARGARITAVILLE — unlocked by someone who knows what's up." This is free personality.

**3. Mucko Tac Toe: Cover Disk Polish**
Add a "tournament mode" — 3-game series, track wins. Keep the score. This is the one I'd put on the disk first because it needs the least work and will get the most play from Softdisk's core readers.

**4. Samster iOS: Build Sync**
Write a 10-line shell script that copies the web assets from `samster/` into `samster-ios/Samster/`. Run it before any iOS build. Put it in the repo root as `sync-ios.sh`. Now the iOS app is never stale.

---

### Medium Term (Disk 48-49 — The Engine Moment)

**5. Extract `mucko-engine.js`**
Pull the shared skeleton — canvas setup, K/JP input, audio factory, localStorage helper, phase state machine — into a single file. Every future game includes it. Existing games get refactored one at a time as they get updated.

This file should be under 200 lines. Not a framework. A *library*. There's a difference. You call it; it doesn't call you.

**6. Rocket Trail: Full Mission Sequence**
The game already has Mercury/Gemini/Apollo difficulty tied to destination. Extend this: give each destination (Mercury, Moon, Mars) a *unique minigame* in the travel phase. Moon gets the asteroid field. Mercury gets a solar wind dodge sequence (fast, high APM, brutal). Mars gets a longer slower haul with resource management mid-trip. Now difficulty isn't just "harder numbers" — it's structurally different content.

**7. Samster/Hippo: Shared Dialog Engine**
The dialog data format is already standardized across both games. Pull the dialog renderer — the box drawing, the text pagination, the speaker name, the branching — into a reusable function in `mucko-engine.js`. This is the one refactor that unlocks future narrative games without reimplementing from scratch.

---

### The New Game (Disk 50 — *This Is The One*)

The Trail series and the Heist series are the two proven pillars here. I want to merge them.

### ***CONTRABAND TRAIL***

**Concept:** You are a smuggler on the Rhine River, 1922. Moving illegal cargo (banned books, jazz records, art) through Weimar Germany. Part Oregon Trail resource management, part Duck Dieb stealth at each port stop.

**Why it fits:**
- Train Trail already established the Rhine Valley aesthetic and the Basel→Leipzig geography
- Duck Dieb established the top-down stealth mechanics with police AI
- The Samster dialog system handles NPC interactions

**Structure:**
- River travel phase: resource management (fuel, crew health, bribe money, cargo condition)
- Port stops: top-down stealth (the Duck Dieb engine) — decide what to declare at customs, what to hide, who to pay off
- Random events on the river: fog, patrols, rival smugglers
- Endings branch based on how much contraband you actually delivered vs. what you lost/reported

**Tech approach:**
- Build it on `mucko-engine.js` (the new shared library)
- Reuse Duck Dieb's guard AI verbatim — it already works
- Reuse Airplane Trail's resource management UI — it already works
- Deliver a two-phase game (travel + stealth) that *feels* like a new genre because neither half felt like this combination before

This is a Softdisk cover game. Give it six weeks.

---

## IF I HAD THE KEYS FULLY

Longer term — and I know this sounds crazy — there's a universe here. Mucko. The airship. Samster. Pflueger and his hippo. Lekan the panda mastermind. These feel like they could share a world.

Imagine an index page that isn't just a game launcher — it's a *map*. You're in a city. Different neighborhoods unlock different games. You find the zoo (Hippo). You find the docks (Duck Dieb). You find the airfield (Airplane Trail). High scores and progress in one game unlock flavor text or cheats in another.

It's the Softdisk Cinematic Universe. Al would never go for it. That's exactly why we should do it.

---

## SUMMARY ASSESSMENT

This code was written by someone who cares about making games people enjoy. That is rarer than BSP trees. The architecture needs work but the foundation is sound. I'd take this disk, put Mucko Tac Toe on the cover, add Rocket Trail as the featured game with the crash feedback fix, and spend the remaining time building `mucko-engine.js` so that every future game ships twice as fast.

Then I go write Contraband Trail.

*— John Carmero*
*April 1992 (or thereabouts)*
*Lake house, Alexandria, Louisiana*
*Doom is on schedule. Do not ask about Doom.*
