# Rocket Trail — Playtest Notes

## Simulated playthroughs (6-year-old perspective)

### Run 1 — Mercury, tablet
- Title: tap the rocket button immediately. Cool!
- Pad: three colored buttons. Green = Mercury. Press it. Press LAUNCH.
- Launch: 3… 2… 1… BOOM! Amazing. Stage separates — whoa!
- (waiting while rocket climbs) …(waiting) …(still waiting) where's the button?
- Travel: "DAY 1 — TRANS LUNAR INJECTION" — what does that mean?? Press CONTINUE.
- Sleep: zzz. WAKE CREW button — okay!
- Event: "Micrometeorite shower" — I don't know what to pick. Press the first one.
- Mining: SHOOT THE ROCKS! This is the best part! I keep tapping everywhere!
  - Gold asteroid appears — ooh shiny! I try to hit it. Missed. Sad.
  - Timer runs out before I notice. Mining ends.
- Moon landing: lander falling. Push THRUST but my thumb is between two buttons.
  - Going sideways too fast. Can't correct. CRASH. No score.
- Moon ascent: scripted. Okay.
- Re-entry: dodge rockets! Fun! Hit by three in a row. All shields gone.
- Parachute: the altimeter bar is on the RIGHT side. I'm looking left. Press too early.
- Victory: 1 star. Score 105. Want to play again immediately.

### Run 2 — Mercury, tablet
- Launch: skip. Travel: skip through.
- Event this time: "Strange signal from the lunar surface!" Cool! I pick Investigate.
- Mining: GOLD ASTEROID! I hit it! +8 minerals! YES! Radio message is satisfying.
- Moon landing: try again. Going too slow this time. Drifting sideways off screen.
  - The LEM wraps around — confusing, didn't realize that was happening.
  - Finally land — off pad, but safe! Animation walks out — plants flag! COOL!
  - But the walk goes too fast to really appreciate it.
- Re-entry: more fun this time. All rockets look exactly the same though.
- Parachute: better. Still not sure when to press.
- Victory: 2 stars! 

### Run 3 — Apollo, phone (smaller screen)
- Apollo difficulty. Harder.
- Launch: fast and dramatic. Love the stage separation messages.
- Mining: SO FAST. Hard to hit anything. But the gold asteroid is exciting.
- Moon landing: gravity is brutal. Crash almost instantly. Frustrating.
  - No feedback on HOW fast I was going when I crashed. Just: CRASH. Why??
- Re-entry: rockets spawn so fast. All look identical, hard to read the danger.
- Parachute: nail it (lucky). 200 points!
- Victory: 1 star. Feels unfair since I did great on parachute.

---

## Kid ↔ Expert Game Dev conversation

**Kid:** The shooting part is the BEST! I love the gold rocks!

**Dev:** Nice! What made the gold ones feel special?

**Kid:** They glow and they give you EIGHT minerals! And Houston says "outstanding!" I want MORE gold rocks!

**Dev:** What parts were boring or confusing?

**Kid:** After the rocket goes up... I had to just WATCH for a really long time. And the moon lander is SO HARD. My thumbs keep going to the wrong button.

**Dev:** Yeah — on a phone the three buttons in a row are close together. Your thumb hits two at once. What did you do when you crashed?

**Kid:** I got really mad! And it doesn't TELL you why you crashed! It just says CRASH! I want it to say "TOO FAST" or "TOO SIDEWAYS" or something!

**Dev:** Good note. What about the travel screen? The day panels?

**Kid:** It says "Trans Lunar Injection." What's that? I just pressed CONTINUE because I didn't know.

**Dev:** That's real NASA terminology — it means the burn that sends you toward the Moon. Should it explain that?

**Kid:** Yeah, or just say "Going to the Moon!" or something funny.

**Dev:** What about the re-entry phase? Dodging rockets?

**Kid:** Fun! But they're all THE SAME. I want BIG ones and TINY ones and ones that go side-to-side! And sometimes they sneaked up too fast and I couldn't even see them coming.

**Dev:** Good — enemy variety makes dodge games much more readable. Anything you wish you could DO more of?

**Kid:** I wanted to plant the flag MYSELF! The astronaut just did it and I was watching. Can I press a button to plant it?

**Dev:** Sure, that's an easy win. What about the end screen? The victory?

**Kid:** It needs FIREWORKS! Or CONFETTI! When I got 2 stars there was nothing exploding!

**Dev:** [laughs] Agreed. What would make you want to play again right away?

**Kid:** Make the moon lander have a BIGGER button for thrust. And tell me when I'm going too fast so I can fix it. And I want a button to skip the boring waiting parts faster.

**Dev:** Those are all very reasonable asks. Here's my read on the priority list...

---

## Expert dev plan

### Priority 1 — Playability blockers

**A. Moon lander control overhaul (mobile)**
The three-button row (LEFT / THRUST / RIGHT) is too cramped on a phone.
Plan: Move THRUST to a large center-bottom zone, LEFT/RIGHT to the outer sides.
Also add a large tap-anywhere-upper-half = thrust option as a fallback.
Add pulsing red "TOO FAST ▼" text + warning beep when vy > 60% of maxSafe,
and a "CRASH — TOO FAST!" vs "CRASH — OFF COURSE!" result message.

**B. Faster skip everywhere**
Currently launch can't be skipped until t>5. Any tap after liftoff should offer skip.
Travel sleep cycles auto-advance — fine. The "CONTINUE" button on wake panels should
also be triggerable by tapping anywhere on the non-button area (quality of life).

**C. Simpler travel text**
Replace NASA jargon with short kid-friendly blurbs:
- "DAY 1 — TRANS LUNAR INJECTION" → "DAY 1 — HEADING TO THE MOON! 🌕"
- "DAY 1 — TRANS EARTH INJECTION" → "DAY 1 — HEADING HOME! 🌍"
- The event text is fine; keep it playful.

### Priority 2 — Fun improvements

**D. Re-entry rocket variety**
Three types of enemy rockets (weighted random):
- Standard (60%): current behavior
- Big & slow (20%): wider (w=22), slower (×0.65 speed), worth dodging early
- Fast & small (20%): narrow (w=8), fast (×1.6 speed), more dangerous

**E. Interactive flag plant**
After safe landing + result overlay fades, show a "TAP TO PLANT FLAG 🚩" button.
Player taps → astronaut walks out and plants flag. If player doesn't tap within 3s,
it auto-triggers. This gives ownership of the most memorable moment.

**F. Victory fireworks / confetti**
On victory entry, spawn ~60 confetti particles in random colors, launching upward
from the bottom of the screen, tumbling with rotation, fading out over 3 seconds.
Simple rectangles rotating — cheap to render, visually jubilant.

### Priority 3 — Polish

**G. Crash reason text**
"CRASH! — descended too fast" vs "CRASH! — rolled too far" based on vy vs |vx|.

**H. Mining time bonus**
If you hit 15+ minerals, show "+5 SEC BONUS" and extend the timer. Rewards skill.

**I. Low-fuel warning in moon lander**
When fuel < 15%, flash the fuel bar red and add a warning beep every second.
