const test = require('node:test');
const assert = require('node:assert/strict');
const audioEvents = require('../public/src/audio-events.js');

test('chess sound event ignores the initial board state', () => {
  assert.equal(audioEvents.chessSoundEvent(0, { moveHistory: [] }), null);
});

test('chess sound event returns move for a non-capturing new move', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 }, piece: { color: 'red', type: 'soldier' }, captured: null }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'move');
});

test('chess sound event returns capture for a capturing new move', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 1 }, to: { x: 0, y: 5 }, piece: { color: 'black', type: 'rook' }, captured: { color: 'red', type: 'horse' } }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'capture');
});

test('chess sound event ignores already-seen moves', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 }, piece: { color: 'red', type: 'soldier' }, captured: null }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(1, state), null);
}
);
