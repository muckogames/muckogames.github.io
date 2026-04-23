#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var Sim = require('./sim');

var TRAIN_DIR = path.join(__dirname, 'training');

function parseArgs(argv) {
  var out = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var part = argv[i];
    if (part.slice(0, 2) === '--') {
      var key = part.slice(2);
      var next = argv[i + 1];
      if (next != null && next.slice(0, 2) !== '--') {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else out._.push(part);
  }
  return out;
}

function intArg(args, key, fallback) {
  if (args[key] == null) return fallback;
  var n = parseInt(args[key], 10);
  return isFinite(n) ? n : fallback;
}

function numArg(args, key, fallback) {
  if (args[key] == null) return fallback;
  var n = parseFloat(args[key]);
  return isFinite(n) ? n : fallback;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function saveJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractGenome(payload) {
  if (!payload) return null;
  if (payload.bestGenome) return payload.bestGenome;
  if (payload.genome) return payload.genome;
  if (payload.population && payload.population.length) return payload.population[0].genome;
  return null;
}

function scorePlayer(summary, playerId) {
  var p = summary.players[playerId];
  var winnerBonus = summary.winnerId === playerId ? 140 : 0;
  var timeoutPenalty = summary.resultReason === 'timeout' && summary.winnerId !== playerId ? 25 : 0;
  return winnerBonus
    + p.stats.kos * 55
    + p.stats.damageDealt * 1.35
    + p.stocks * 26
    - p.stats.damageTaken * 1.05
    - p.stats.deaths * 42
    - p.stats.selfKos * 55
    - p.damage * 0.18
    - timeoutPenalty;
}

function runDuel(genomeA, genomeB, opts, seed, swapSides) {
  var roster = [
    { charId: opts.charA, controller: { type: 'heuristic', genome: genomeA } },
    { charId: opts.charB, controller: { type: 'heuristic', genome: genomeB } }
  ];
  if (swapSides) roster.reverse();
  var result = Sim.runMatch({
    seed: seed,
    arenaSeed: seed ^ 0x9e3779b9,
    stocks: opts.stocks,
    roster: roster,
    stepDt: Sim.constants.FIXED_STEP,
    maxSteps: opts.maxSteps
  });
  var summary = result.summary;
  var aId = swapSides ? 1 : 0;
  var bId = swapSides ? 0 : 1;
  return {
    summary: summary,
    scoreA: scorePlayer(summary, aId),
    scoreB: scorePlayer(summary, bId),
    replay: {
      seed: seed,
      arenaSeed: seed ^ 0x9e3779b9,
      stocks: opts.stocks,
      roster: [
        { charId: opts.charA, genome: genomeA },
        { charId: opts.charB, genome: genomeB }
      ],
      swapped: !!swapSides,
      summary: summary
    }
  };
}

function evaluatePopulation(population, opts, rng, generation) {
  for (var i = 0; i < population.length; i++) {
    var genomeEntry = population[i];
    genomeEntry.fitness = 0;
    genomeEntry.matches = 0;
    genomeEntry.bestReplay = null;
    for (var r = 0; r < opts.roundsPerGenome; r++) {
      var oppIndex = (i + 1 + Math.floor(rng() * (population.length - 1))) % population.length;
      if (oppIndex === i) oppIndex = (oppIndex + 1) % population.length;
      var opponent = population[oppIndex];
      var seed = ((generation + 1) * 1000003 + i * 911 + r * 31337) >>> 0;
      for (var side = 0; side < 2; side++) {
        var duel = runDuel(genomeEntry.genome, opponent.genome, opts, seed + side, side === 1);
        genomeEntry.fitness += duel.scoreA;
        genomeEntry.matches++;
        if (!genomeEntry.bestReplay || duel.scoreA > genomeEntry.bestReplay.score) {
          genomeEntry.bestReplay = { score: duel.scoreA, data: duel.replay };
        }
      }
    }
    genomeEntry.fitness /= Math.max(1, genomeEntry.matches);
  }
  population.sort(function(a, b) { return b.fitness - a.fitness; });
}

function initialPopulation(size, rng, seedFile) {
  var population = [];
  var loaded = null;
  if (seedFile) {
    loaded = loadJson(seedFile);
    if (loaded.population && loaded.population.length) {
      for (var i = 0; i < loaded.population.length && population.length < size; i++) {
        population.push({ genome: Sim.normalizeGenome(loaded.population[i].genome) });
      }
    } else if (extractGenome(loaded)) {
      population.push({ genome: Sim.normalizeGenome(extractGenome(loaded)) });
    }
  }
  while (population.length < size) {
    population.push({ genome: Sim.randomGenome(rng) });
  }
  return population;
}

function nextGeneration(population, opts, rng) {
  var next = [];
  for (var i = 0; i < opts.elites && i < population.length; i++) {
    next.push({ genome: clone(population[i].genome) });
  }
  while (next.length < opts.population) {
    var parentA = population[Math.floor(rng() * opts.parentPool)];
    var parentB = population[Math.floor(rng() * opts.parentPool)];
    var child = Sim.crossoverGenomes(parentA.genome, parentB.genome, rng);
    child = Sim.mutateGenome(child, rng, opts.mutationRate, opts.mutationScale);
    next.push({ genome: child });
  }
  return next;
}

function printGeneration(population, generation) {
  var top = population[0];
  var avg = 0;
  for (var i = 0; i < population.length; i++) avg += population[i].fitness;
  avg /= Math.max(1, population.length);
  console.log(
    'gen', generation,
    'best', top.fitness.toFixed(2),
    'avg', avg.toFixed(2),
    'dashChance', top.genome.dashChance.toFixed(3),
    'jumpChance', top.genome.jumpChance.toFixed(3),
    'aggression', top.genome.aggression.toFixed(3)
  );
}

function saveCheckpoint(population, generation, opts) {
  ensureDir(TRAIN_DIR);
  var best = population[0];
  var payload = {
    generation: generation,
    options: opts,
    bestGenome: best.genome,
    bestFitness: best.fitness,
    bestReplay: best.bestReplay ? best.bestReplay.data : null,
    population: population.map(function(entry) {
      return { fitness: entry.fitness, genome: entry.genome };
    })
  };
  saveJson(path.join(TRAIN_DIR, 'latest.json'), payload);
  saveJson(path.join(TRAIN_DIR, 'generation-' + String(generation).padStart(3, '0') + '.json'), payload);
  if (best.bestReplay) saveJson(path.join(TRAIN_DIR, 'best-replay.json'), best.bestReplay.data);
}

function train(args) {
  var populationSize = intArg(args, 'population', 24);
  var generations = intArg(args, 'generations', 12);
  var roundsPerGenome = intArg(args, 'rounds', 6);
  var stocks = intArg(args, 'stocks', 3);
  var seconds = intArg(args, 'seconds', 60);
  var seed = intArg(args, 'seed', 1337) >>> 0;
  var elites = intArg(args, 'elites', 4);
  var parentPool = intArg(args, 'parents', Math.max(6, elites * 2));
  var rng = Sim.seededRng(seed);
  var opts = {
    population: populationSize,
    generations: generations,
    roundsPerGenome: roundsPerGenome,
    stocks: stocks,
    maxSteps: seconds * 60,
    elites: elites,
    parentPool: Math.min(parentPool, populationSize),
    mutationRate: numArg(args, 'mutation-rate', 0.28),
    mutationScale: numArg(args, 'mutation-scale', 0.18),
    charA: args['char-a'] || 'samster',
    charB: args['char-b'] || 'samster'
  };

  var population = initialPopulation(populationSize, rng, args.resume);
  for (var generation = 0; generation < generations; generation++) {
    evaluatePopulation(population, opts, rng, generation);
    printGeneration(population, generation);
    saveCheckpoint(population, generation, opts);
    if (generation < generations - 1) population = nextGeneration(population, opts, rng);
  }
}

function evaluate(args) {
  var file = args.file || args._[1];
  if (!file) throw new Error('Missing checkpoint file for eval');
  var payload = loadJson(file);
  var best = extractGenome(payload);
  if (!best) throw new Error('No genome found in checkpoint');
  var opponentPayload = args.opponent ? loadJson(args.opponent) : null;
  var opponent = Sim.normalizeGenome(extractGenome(opponentPayload) || Sim.HEURISTIC_DEFAULTS);
  var opts = {
    charA: args['char-a'] || 'samster',
    charB: args['char-b'] || 'samster',
    stocks: intArg(args, 'stocks', 3),
    maxSteps: intArg(args, 'seconds', 60) * 60
  };
  var total = 0;
  var games = intArg(args, 'games', 8);
  for (var i = 0; i < games; i++) {
    var duel = runDuel(best, opponent, opts, ((payload.generation || 0) * 4099 + i) >>> 0, i % 2 === 1);
    total += duel.scoreA;
    console.log('game', i, 'winner', duel.summary.winnerId, 'reason', duel.summary.resultReason, 'score', duel.scoreA.toFixed(2));
  }
  console.log('avg score', (total / Math.max(1, games)).toFixed(2));
}

function replay(args) {
  var file = args.file || args._[1] || path.join(TRAIN_DIR, 'best-replay.json');
  var payload = loadJson(file);
  console.log(JSON.stringify(payload, null, 2));
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  var cmd = args._[0] || 'train';
  if (cmd === 'train') train(args);
  else if (cmd === 'eval') evaluate(args);
  else if (cmd === 'replay') replay(args);
  else {
    console.error('usage: node smash/train.js [train|eval|replay] [--population N] [--generations N]');
    process.exit(1);
  }
}

main();
