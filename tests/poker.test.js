const test = require('node:test');
const assert = require('node:assert/strict');
const poker = require('../public/src/poker.js');

const c = (rank, suit = 's') => ({ rank, suit });

test('evaluates royal flush above lower straight flush', () => {
  const royal = poker.evaluateBestHand([c(14), c(13), c(12), c(11), c(10), c(2, 'h'), c(3, 'd')]);
  const straightFlush = poker.evaluateBestHand([c(9), c(8), c(7), c(6), c(5), c(14, 'h'), c(2, 'd')]);

  assert.equal(royal.name, '皇家同花顺');
  assert.equal(straightFlush.name, '同花顺');
  assert.equal(poker.compareHands(royal, straightFlush) > 0, true);
});

test('evaluates ace-low wheel straight', () => {
  const hand = poker.evaluateBestHand([c(14), c(2, 'h'), c(3, 'd'), c(4, 'c'), c(5, 's'), c(9, 'h'), c(11, 'd')]);

  assert.equal(hand.name, '顺子');
  assert.deepEqual(hand.values, [5]);
});

test('four of a kind beats full house', () => {
  const quads = poker.evaluateBestHand([c(9), c(9, 'h'), c(9, 'd'), c(9, 'c'), c(2), c(3), c(4)]);
  const fullHouse = poker.evaluateBestHand([c(14), c(14, 'h'), c(14, 'd'), c(13), c(13, 'h'), c(2), c(3)]);

  assert.equal(quads.name, '四条');
  assert.equal(fullHouse.name, '葫芦');
  assert.equal(poker.compareHands(quads, fullHouse) > 0, true);
});

test('pair kicker decides winner', () => {
  const first = poker.evaluateBestHand([c(14), c(14, 'h'), c(13, 'd'), c(9, 'c'), c(6), c(4, 'h'), c(2, 'd')]);
  const second = poker.evaluateBestHand([c(14), c(14, 'h'), c(12, 'd'), c(11, 'c'), c(6), c(4, 'h'), c(2, 'd')]);

  assert.equal(first.name, '一对');
  assert.equal(poker.compareHands(first, second) > 0, true);
});

test('equal best hands compare as split pot', () => {
  const first = poker.evaluateBestHand([c(14), c(13), c(12), c(11), c(9), c(8), c(2)]);
  const second = poker.evaluateBestHand([c(14, 'h'), c(13, 'h'), c(12, 'h'), c(11, 'h'), c(9, 'h'), c(8, 'd'), c(2, 'd')]);

  assert.equal(poker.compareHands(first, second), 0);
});

test('starts a mixed holdem hand with bots, blinds, and private cards', () => {
  const table = poker.createHoldemTable({
    players: [{ id: 'u1', name: '我', chips: 1000, bot: false }],
    botCount: 5,
    random: () => 0
  });
  const hand = poker.startHand(table);

  assert.equal(hand.seats.length, 6);
  assert.equal(hand.stage, 'preflop');
  assert.equal(hand.pot, 15);
  assert.equal(hand.currentBet, 10);
  assert.equal(hand.seats.every((seat) => seat.cards.length === 2), true);
  assert.equal(hand.seats.filter((seat) => seat.bot).length, 5);
  assert.ok(hand.activeSeatId);
});

test('call actions advance streets and showdown settles chips', () => {
  let table = poker.createHoldemTable({
    players: [
      { id: 'u1', name: '甲', chips: 1000, bot: false },
      { id: 'u2', name: '乙', chips: 1000, bot: false }
    ],
    botCount: 0,
    random: () => 0
  });
  table = poker.startHand(table);

  for (let i = 0; i < 8 && table.stage !== 'showdown'; i += 1) {
    table = poker.applyAction(table, table.activeSeatId, { type: 'call' });
  }

  assert.equal(table.stage, 'showdown');
  assert.equal(table.community.length, 5);
  assert.ok(table.lastResult.winners.length >= 1);
  assert.equal(table.seats.reduce((sum, seat) => sum + seat.chips, 0) + table.pot, 2000);
});

test('fold awards pot to the last active player', () => {
  let table = poker.createHoldemTable({
    players: [
      { id: 'u1', name: '甲', chips: 1000, bot: false },
      { id: 'u2', name: '乙', chips: 1000, bot: false }
    ],
    botCount: 0,
    random: () => 0
  });
  table = poker.startHand(table);
  table = poker.applyAction(table, table.activeSeatId, { type: 'fold' });

  assert.equal(table.stage, 'showdown');
  assert.equal(table.lastResult.reason, 'fold');
  assert.equal(table.lastResult.winners.length, 1);
});
