# Digory Alignment Plan

This file records a privacy-safe adaptation plan for bringing the public Mucko Games repo
closer to the Digory-story tone and visual canon described in the local private dossier.
It intentionally avoids copying real family names from that source material.

## Canon Summary

The strongest reusable story pattern is:

1. A real dog wakes somewhere surprising.
2. Food appears early and often.
3. An absurd but concrete problem interrupts the day.
4. Animal allies solve it through heists, crow tech, submarines, or improvised logistics.
5. The danger stays silly, not traumatic.
6. The story ends with warmth, sleep, and usually a yellow blanket.

The style target is:

- bedtime-story friendly
- sincere rather than ironic
- child-logical but operationally specific
- bright, readable, cartooned, and low-clutter
- repetitive in a charming way
- full of cozy reset beats after chaos

The most important visual rules are:

- Digory is a real black-white-brown terrier, not a fox and never smoking
- Digory's small on/off spot should stay consistent when shown
- the Don can be comic, fiery, cigar-heavy, and panicky, but not genuinely frightening
- Louette should read as a black cat stealth specialist
- underwater locations should visibly look underwater
- home/sleep endings should lean yellow-blanket cozy instead of abstract score-only finales

## Top Priorities

### 1. Privacy scrub

The highest non-design priority is a repo-wide tracked-content scrub for real names and
legacy surname references. This pass cleaned the tracked docs, but public game content and
asset labels still contain legacy human-name usage. That should be handled as its own
deliberate rename/content pass.

### 2. Story alignment where the canon is already strong

The strongest existing fit is the Digory / Samster / Duck Dieb / Don material. That lane
should get the first polish because it already shares the dossier's tone:

- heists
- animal competence
- absurd logistics
- recurring villains
- cozy endings

### 3. Keep adjacent canons adjacent

Not every game should be forcibly rewritten into Digory canon. Hippo, Lake House Math,
Captain Mucko host material, and some educational toys should stay adjacent rather than
fully merged.

## Existing Game Tuning Plan

### Highest-value alignment targets

#### `don/`

This should become the clearest public Digory-story expression in the repo.

Recommended tuning:

- make Digory's real-dog physicality and yellow-blanket/home rhythm more explicit
- keep the Don comic and logistically dangerous rather than menacing
- add more food, sleep, and domestic reset beats between action scenes
- make crow-tech explanations the default answer for anachronistic devices
- keep underwater, balloon, and city-travel set pieces bright and legible

#### `samster/index.html`

This already fits the canon well because Samster is an escape specialist.

Recommended tuning:

- push the bedtime-story framing harder in intro/outro copy
- make the sleeping-owner setup more playful and less generic stealth
- add a stronger "return to safety" ending beat
- seed more reusable Digory-world props, such as Deeb Bag, crow-tech labels, food rewards, or blanket imagery

#### `duckdieb/index.html` and `duckdieb2/`

Duck Dieb is one of the strongest canon-compatible characters.

Recommended tuning:

- emphasize planning, clues, codes, and comic contraband over pure score chasing
- use more public-facing "deeb" vocabulary and Don-adjacent theft recovery framing
- add more specific funny loot categories instead of generic treasure piles
- make success screens feel like story beats rather than arcade abstractions

#### `smash/`

Smash should stay mechanically broad, but its presentation can better match the story bible.

Recommended tuning:

- favor roster blurbs, stage flavor, and win text that reflect character-specific absurd logistics
- keep Digory's look faithful if he appears more centrally later
- use the Don, Johnny Mackerel, Firelight Guy, and Louette as future roster/stage candidates before inventing looser additions
- lean into comic special-move labels and crowd-readable silhouettes

### Medium-priority alignment targets

#### `rockettrail/`

This is not Digory canon, but it already shares the earnest-absurd child tone.

Recommended tuning:

- keep mission failures funny and explanatory rather than severe
- add more family-story-style domestic interruptions during epic travel
- strengthen destination arrival coziness and celebration

#### `traintrail/`, `contraband/`, `cartrail/`

These can absorb Digory-story tone without needing direct canon conversion.

Recommended tuning:

- more concrete comic logistics in event writing
- more named recurring animal/faction cameos
- more food/rest punctuation
- more crow-tech framing where impossible mechanics need justification

### Lower-priority or adjacent-only

#### `hippo/`

This should remain its own adjacent storybook lane. Align visual warmth and child readability,
but do not force it to become a Digory game.

#### `lakehousemath/`, `tictactoe/`, `orbit/`, `dj/`

These are best treated as Mucko-world adjacent. Borrow roster consistency and playful labels,
but not full Digory plot structure.

## Cross-Repo Tone and Visual Pass

A future polish pass across multiple games should standardize:

- thicker outlines and cleaner silhouettes for child readability
- stronger end-of-level cozy beats
- more food- and sleep-based score text
- more specific prop naming: Deeb Bag, crow tech, steak bonus, blanket bonus
- comic peril wording instead of generic "game over" language where appropriate
- recurring newspaper, contraband, balloon, and submarine motifs

## Recommended New Games

### 1. Deeb From the Don

Best next full game pitch.

Why it fits:

- centers Digory without making him too human
- gives Samster a natural escape/mechanical niche
- gives Duck Dieb a clue/code/heist-planning niche
- uses the Don, the strongest recurring villain
- naturally supports a cozy yellow-blanket ending

Recommended structure:

1. dungeon wake-up
2. Samster wheel-jam escape
3. Digory stealth/food bonus segment
4. Duck Dieb code-and-contraband recovery
5. balloon/cigar chase
6. home return and blanket ending

### 2. Firelight Guy at the Zoo

Best next compact arcade game.

Why it fits:

- very clear objective
- strong visual identity
- absurd logistics handled sincerely
- comic danger with low emotional intensity

Recommended loop:

1. mark which structures are already empty
2. burn only approved targets
3. keep flames away from animals and bystanders
4. survive Don balloon interference
5. end with a silly newspaper-style wrap-up

### 3. Crow Tech Lab

Best next toy/puzzle hybrid.

Why it fits:

- lets the repo explain impossible technology inside canon
- supports short playful sessions
- can cameo many existing characters without heavy lore burden

Recommended loop:

- combine absurd parts
- build impossible devices
- test them in short micro-scenarios
- unlock labels, blueprints, and comic failures

## CLAUDE / Agent Guidance Implications

Shared repo guidance should assume:

- private `dsref/` canon, when present, outranks stale public summaries
- tracked files must stay privacy-safe
- Digory alignment is strongest in the heist / Don / submarine lane
- adjacent games should preserve the established Mucko feel without forced canon collapse

## Suggested Execution Order

1. Complete a repo-wide public-name scrub in shipped content.
2. Polish `don/` into the clearest Digory-story flagship.
3. Add Digory-tone outro and prop polish to `samster/` and `duckdieb/`.
4. Add small story-flavor upgrades to `smash/`, `traintrail/`, `contraband/`, and `rockettrail/`.
5. Prototype `Deeb From the Don`.
