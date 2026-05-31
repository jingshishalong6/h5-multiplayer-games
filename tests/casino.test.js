const test = require('node:test');
const assert = require('node:assert/strict');
const casino = require('../public/src/casino.js');

test('three reel slot payout applies virtual chip winnings', () => {
  const result = casino.resolveSlotSpin({
    chips: 1000,
    bet: 20,
    symbols: ['福', '福', '福']
  });

  assert.equal(result.payout, 200);
  assert.equal(result.chips, 1180);
});

test('five reel slot pays base five blessings and triggers bonus', () => {
  const result = casino.resolveSlotSpin({
    chips: 1000,
    bet: 10,
    reelCount: 5,
    symbols: ['福', '福', '福', '福', '福']
  });

  assert.deepEqual(result.symbols, ['福', '福', '福', '福', '福']);
  assert.equal(result.reelCount, 5);
  assert.equal(result.blessingCount, 5);
  assert.equal(result.payout, 400);
  assert.equal(result.chips, 1390);
  assert.equal(result.bonusTriggered, true);
});

test('free slot spin does not deduct the bet', () => {
  const result = casino.resolveSlotSpin({
    chips: 1000,
    bet: 20,
    reelCount: 5,
    freeSpin: true,
    symbols: ['福', '禄', '寿', '喜', '财']
  });

  assert.equal(result.payout, 0);
  assert.equal(result.chips, 1000);
  assert.equal(result.freeSpin, true);
});

test('five reel slot does not pay for only non-blessing matches', () => {
  const result = casino.resolveSlotSpin({
    chips: 1000,
    bet: 20,
    reelCount: 5,
    symbols: ['禄', '禄', '寿', '喜', '财']
  });

  assert.equal(result.blessingCount, 0);
  assert.equal(result.payout, 0);
  assert.equal(result.chips, 980);
});

test('five reel slot base payouts use 10 point tier', () => {
  const two = casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, symbols: ['福', '福', '禄', '寿', '财'] });
  const three = casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, symbols: ['福', '福', '福', '寿', '财'] });
  const four = casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, symbols: ['福', '福', '福', '福', '财'] });
  const five = casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, symbols: ['福', '福', '福', '福', '福'] });

  assert.equal(two.payout, 3.5);
  assert.equal(three.payout, 10);
  assert.equal(four.payout, 50);
  assert.equal(five.payout, 400);
});

test('five reel slot scales payouts by bet tier', () => {
  const bet20Two = casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, symbols: ['福', '福', '禄', '寿', '财'] });
  const bet20Three = casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, symbols: ['福', '福', '福', '寿', '财'] });
  const bet20Four = casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, symbols: ['福', '福', '福', '福', '财'] });
  const bet20Five = casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, symbols: ['福', '福', '福', '福', '福'] });
  const bet50Two = casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, symbols: ['福', '福', '禄', '寿', '财'] });
  const bet50Three = casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, symbols: ['福', '福', '福', '寿', '财'] });
  const bet50Four = casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, symbols: ['福', '福', '福', '福', '财'] });
  const bet50Five = casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, symbols: ['福', '福', '福', '福', '福'] });

  assert.equal(bet20Two.payout, 7);
  assert.equal(bet20Three.payout, 20);
  assert.equal(bet20Four.payout, 100);
  assert.equal(bet20Five.payout, 800);
  assert.equal(bet50Two.payout, 17.5);
  assert.equal(bet50Three.payout, 50);
  assert.equal(bet50Four.payout, 250);
  assert.equal(bet50Five.payout, 2000);
});

test('five reel slot uses lower odds for 10 point bets', () => {
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.37 }).blessingCount, 0);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.38 }).blessingCount, 1);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.74 }).blessingCount, 2);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.90 }).blessingCount, 3);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.975 }).blessingCount, 4);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 10, reelCount: 5, random: () => 0.995 }).blessingCount, 5);
});

test('five reel slot uses medium odds for 20 point bets', () => {
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.33 }).blessingCount, 0);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.34 }).blessingCount, 1);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.68 }).blessingCount, 2);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.88 }).blessingCount, 3);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.96 }).blessingCount, 4);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 20, reelCount: 5, random: () => 0.99 }).blessingCount, 5);
});

test('five reel slot uses higher odds for 50 point bets', () => {
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.29 }).blessingCount, 0);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.30 }).blessingCount, 1);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.60 }).blessingCount, 2);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.83 }).blessingCount, 3);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.94 }).blessingCount, 4);
  assert.equal(casino.resolveSlotSpin({ chips: 1000, bet: 50, reelCount: 5, random: () => 0.985 }).blessingCount, 5);
});

test('baccarat deals third card for player total 5 and banker total 6 stands against player third card 8', () => {
  const deck = [
    casino.card('heart', 2),
    casino.card('club', 3),
    casino.card('spade', 3),
    casino.card('diamond', 3),
    casino.card('heart', 8)
  ];

  const round = casino.resolveBaccaratRound(deck);

  assert.equal(round.player.cards.length, 3);
  assert.equal(round.banker.cards.length, 2);
  assert.equal(round.winner, 'banker');
});

test('baccarat virtual bet settlement pays banker at 0.95 to 1', () => {
  const settled = casino.settleBaccaratBets({
    chips: 1000,
    bets: { banker: 100 },
    winner: 'banker'
  });

  assert.equal(settled.chips, 1095);
  assert.equal(settled.payout, 195);
});
