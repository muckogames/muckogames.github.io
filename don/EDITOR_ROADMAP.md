# The Don Editor Roadmap

This is the medium-term roadmap for making `don/editor.html` the strongest handcrafted
content tool in the repo.

## Current Strengths

The editor already has the right base architecture:

- JSON-backed rooms
- room-by-room map editing
- item placement
- NPC placement
- patrol authoring
- direct "play this level" staging into the runtime

That is enough to build levels. What it cannot yet author well is story rhythm.

## Next Editor Priorities

### 1. Room flavor as first-class data

The current shipped game hardcodes a lot of the best story feel in `don/index.html`:

- Digory room-entry quips
- note copy
- completion barks
- some home-phase flavor

The editor should be able to author this directly.

Suggested schema additions:

- `roomIntro`
- `roomBacktrackLine`
- `roomCompleteLine`
- `hintLine`

That turns authored story tone into editable data instead of hardcoded arrays.

### 2. Goal authoring instead of implicit win rules

Right now the shipped heist logic assumes a fixed objective shape: get enough floppies
and containers, then go forward.

The editor should support explicit goals such as:

- collect N floppies
- collect N containers
- find a keycard
- read a note
- reach exit
- lock all doors
- survive for T seconds

This would let the same engine support more bedtime-story mission structures without code forks.

### 3. Script hooks that stay simple

The existing parser already reserves pass-through hooks like `_onEnter`. That is the
right direction, but the scripting model should stay tiny and declarative.

Good target:

- on room enter: show line, unlock tile, start timer
- on item pickup: show line, add score, set flag
- on flag set: open route, spawn NPC, trigger message

Avoid a general-purpose embedded scripting language. The win condition here is a safe,
small story-trigger DSL.

### 4. Better NPC role presets

Right now NPCs are mostly "character + dialog + optional patrol."

The editor should grow presets such as:

- lookout
- sleepy guard
- helper
- food giver
- switch watcher
- comic obstacle

That would keep authors from having to remember implementation conventions for every level.

### 5. Mission-level metadata

The title screen and victory flow in the shipped game are still mostly global.

For the editor to become a true content platform, levels should be able to define:

- mission title
- mission subtitle
- opening checklist
- success epilogue
- cozy ending line
- score bonus labels

That is the bridge from "map editor" to "story mission authoring tool."

## Strategic Recommendation

Do not treat the next editor upgrade as "more tiles."

Treat it as:

1. a room-and-mission authoring tool
2. for short bedtime-story heists
3. with editable flavor text, goals, and tiny triggers

That direction lines up with both the Digory alignment work and the current runtime design.

## Best Near-Term Editor Upgrade

If doing one upgrade next, do this:

- add per-room intro/outro text fields
- add mission title/subtitle fields
- teach the runtime to read those fields from editor-authored levels

That would immediately let new levels feel authored instead of merely arranged.
