window.LAKEHOUSE_DIALOG = {
  title: {
    title: 'Lake House Math Mystery',
    subtitle: 'A clue-walk addition adventure for the weekend crew.',
    start: 'Press Space, Enter, or tap to start.',
    controls: 'Move with arrows or WASD. On touch screens, use the on-screen pad.',
    hint: 'Each firefly lights a counting frame. Use them when you need a careful look.',
  },
  intro: [
    {
      speaker: 'Captain Mucko',
      speakerColor: '#ffd46b',
      text: 'Weekend directive: build the finest lake house picnic in the history of Mucko.'
    },
    {
      speaker: 'Captain Mucko',
      speakerColor: '#ffd46b',
      text: 'Samster, Hippo, Duck Dieb, and the rest wandered off with clue cards. Every path opens when you add the two clues in that area.'
    },
    {
      speaker: 'Captain Mucko',
      speakerColor: '#ffd46b',
      text: 'Talk to the walkers, gather both clues, and solve the total. If you get stuck, spend a firefly for a counting frame.'
    }
  ],
  ending: [
    {
      speaker: 'Captain Mucko',
      speakerColor: '#ffd46b',
      text: 'Picnic chest open. Weekend saved. Arithmetic approved.'
    },
    {
      speaker: 'Hippo',
      speakerColor: '#e7d4ff',
      text: 'A very elegant operation. We should perhaps celebrate by eating everything.'
    },
    {
      speaker: 'Saturn V',
      speakerColor: '#f2f2f2',
      text: 'Mission status: successful. Snacks are go for launch.'
    }
  ],
  areaIntro: {
    porch: 'Cabin Porch: Samster and Duck Dieb are prowling for berry clues.',
    meadow: 'Clover Meadow: Hippo and Nik counted things by the pond.',
    dock: 'Dockside: Lekan and Basil checked the supplies by the skiff.',
    picnic: 'Picnic Point: Captain Mucko and Saturn V are waiting by the chest.'
  },
  gateNeedClues: 'I only open for detectives who found both clue cards.',
  gateSolved: 'This one is already solved. Go enjoy the path.',
  hintReady: 'Spend 1 firefly to light up the counting frame.',
  hintEmpty: 'No fireflies left. You can still count it out slowly.',
  perfectBonus: 'Clean solve. A firefly flutters back into your jar.',
  npcs: {
    samster: {
      clue: 'I found {n} {item} near the porch steps. That is a very Samster clue.',
      repeat: 'My clue is still {n} {item}. Add it to {other}.',
      after: 'Open path. Good. More space to sprint.'
    },
    duck: {
      clue: 'Mask on, clue delivered: {n} {item}. I absolutely did not steal them.',
      repeat: 'You want the same clue? Fine. {n} {item}. Add my stash to {other}.',
      after: 'The latch opened. Pure professional work.'
    },
    hippo: {
      clue: 'I found {n} {item} by the pond. I counted twice because I am careful.',
      repeat: 'My number is {n}. Add it to {other} and the bridge should behave.',
      after: 'Lovely. An open path feels civilized.'
    },
    nik: {
      clue: 'SKREEE! I found {n} {item}! That means I win counting.',
      repeat: 'Still {n}! Add it with {other}!',
      after: 'SKREEE! The bridge likes math!'
    },
    lekan: {
      clue: 'I checked the dock supplies. There are {n} {item}. Neat, tidy, useful.',
      repeat: 'My clue has not moved: {n} {item}. Add it to {other}.',
      after: 'Excellent. The dock winch respects preparation.'
    },
    basil: {
      clue: 'I counted {n} {item} and wrote it down before anyone misplaced them.',
      repeat: 'The number is {n}. Add it to {other} and I suspect the winch will cooperate.',
      after: 'That worked with remarkably little drama.'
    },
    mucko: {
      clue: 'Captain\'s log: I found {n} {item} for the picnic line.',
      repeat: 'My count is {n}. Add it to {other} and open the chest.',
      after: 'A clean total. Just how I like a weekend operation.'
    },
    rocket: {
      clue: 'Checklist complete. I found {n} {item}. Numbers are stable.',
      repeat: 'Still {n} {item}. Combine them with {other}.',
      after: 'Launch conditions are green. Also picnic conditions.'
    }
  }
};
