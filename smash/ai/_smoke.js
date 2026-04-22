#!/usr/bin/env node
// Smoke test: random-weights neural policy vs Hard heuristic.
// Verifies policy.js plumbing end-to-end via sim.js's existing 'scripted' hook.
// Not a benchmark; purpose is "does a match complete without throwing?".

var Sim = require('../sim.js');
var Policy = require('./policy.js');

console.log('policy OBS_DIM =', Policy.OBS_DIM, '(expected 59)');
console.log('policy OUT_DIM =', Policy.OUT_DIM, '(expected 5)');

var model = Policy.randomModel([64, 64], 42);
Policy.validateModel(model);
console.log('random model validated. layers:',
  model.layers.map(function (L) { return L.in + '->' + L.out + '/' + L.activation; }).join(' | '));

// Opponent: Hard-tier heuristic using the genome shipped in sim.js.
var hardGenome = Sim.HARD_MODE_GENOME;

function run(seed, nnLeft) {
  var nnSlot = {
    charId: 'samster',
    controller: {
      type: 'scripted',
      getInput: function (match, entity, dt) {
        return Policy.neuralDecide(match, entity, dt, model);
      }
    }
  };
  var hardSlot = {
    charId: 'samster',
    controller: { type: 'heuristic', genome: hardGenome }
  };
  var roster = nnLeft ? [nnSlot, hardSlot] : [hardSlot, nnSlot];

  var result = Sim.runMatch({
    seed: seed,
    arenaSeed: seed ^ 0x1234,
    stocks: 3,
    roster: roster,
    maxSteps: 60 * 90
  });
  return result.summary;
}

var seeds = [1, 2, 3, 4, 5, 6, 7, 8];
var nnWins = 0;
var nnLosses = 0;
var draws = 0;
var totalFrames = 0;
var nnSideKOs = 0;
var nnSideSelfKOs = 0;

for (var s = 0; s < seeds.length; s++) {
  var seed = seeds[s];
  for (var side = 0; side < 2; side++) {
    var nnLeft = side === 0;
    var summary = run(seed, nnLeft);
    var nnId = nnLeft ? 0 : 1;
    var nnPlayer = summary.players[nnId];
    var oppPlayer = summary.players[1 - nnId];

    totalFrames += summary.stepCount;
    nnSideKOs += nnPlayer.stats.kos;
    nnSideSelfKOs += nnPlayer.stats.selfKos;

    var outcome;
    if (summary.winnerId === nnPlayer.id) { nnWins++; outcome = 'WIN '; }
    else if (summary.winnerId === oppPlayer.id) { nnLosses++; outcome = 'LOSE'; }
    else { draws++; outcome = 'DRAW'; }

    console.log(
      'seed=' + seed + ' side=' + (nnLeft ? 'L' : 'R') +
      ' ' + outcome +
      ' frames=' + summary.stepCount +
      ' reason=' + summary.resultReason +
      ' nn(stk=' + nnPlayer.stocks + ' dmg=' + nnPlayer.damage.toFixed(1) +
      ' dealt=' + nnPlayer.stats.damageDealt.toFixed(1) +
      ' kos=' + nnPlayer.stats.kos + ' deaths=' + nnPlayer.stats.deaths +
      ' selfKos=' + nnPlayer.stats.selfKos + ')' +
      ' opp(stk=' + oppPlayer.stocks + ' dmg=' + oppPlayer.damage.toFixed(1) + ')'
    );
  }
}

var total = seeds.length * 2;
console.log('\n=== summary ===');
console.log('matches run:   ', total);
console.log('nn wins:       ', nnWins, '(' + (100 * nnWins / total).toFixed(1) + '%)');
console.log('nn losses:     ', nnLosses, '(' + (100 * nnLosses / total).toFixed(1) + '%)');
console.log('draws:         ', draws);
console.log('avg frames:    ', (totalFrames / total).toFixed(0));
console.log('nn total KOs:  ', nnSideKOs);
console.log('nn self-KOs:   ', nnSideSelfKOs);
console.log('pass criteria: every match completed, no exceptions.');
