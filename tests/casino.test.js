const test = require('node:test');
const assert = require('node:assert/strict');
const casino = require('../public/src/casino.js');

test('slot payout applies virtual chip winnings', () => {
  const result = casino.resolveSlotSpin({
    chips: 1000,
    bet: 20,
    symbols: ['福', '福', '福']
  });

  assert.equal(result.payout, 200);
  assert.equal(result.chips, 1180);
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
