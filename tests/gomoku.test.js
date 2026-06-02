const test = require('node:test');
const assert = require('node:assert/strict');
const gomoku = require('../public/src/gomoku.js');

test('initial gomoku state is 15x15 and black moves first', () => {
  const state = gomoku.createInitialState();

  assert.equal(state.board.length, 15);
  assert.equal(state.board[0].length, 15);
  assert.equal(state.turn, 'black');
  assert.equal(state.winner, null);
});

test('places stones and rejects occupied points', () => {
  const state = gomoku.createInitialState();
  const first = gomoku.placeStone(state, 7, 7, 'black');
  const duplicate = gomoku.placeStone(first.state, 7, 7, 'white');

  assert.equal(first.ok, true);
  assert.equal(first.state.board[7][7], 'black');
  assert.equal(first.state.turn, 'white');
  assert.equal(duplicate.ok, false);
});

test('detects horizontal vertical and diagonal wins', () => {
  const horizontal = gomoku.createInitialState();
  const vertical = gomoku.createInitialState();
  const diagonal = gomoku.createInitialState();
  vertical.turn = 'white';
  for (let i = 0; i < 4; i += 1) {
    horizontal.board[7][i] = 'black';
    vertical.board[i][7] = 'white';
    diagonal.board[i][i] = 'black';
  }

  assert.equal(gomoku.placeStone(horizontal, 4, 7, 'black').state.winner, 'black');
  assert.equal(gomoku.placeStone(vertical, 7, 4, 'white').state.winner, 'white');
  assert.equal(gomoku.placeStone(diagonal, 4, 4, 'black').state.winner, 'black');
});

test('reset creates a fresh gomoku state', () => {
  const state = gomoku.placeStone(gomoku.createInitialState(), 7, 7, 'black').state;
  const reset = gomoku.createInitialState();

  assert.equal(state.board[7][7], 'black');
  assert.equal(reset.board[7][7], null);
  assert.equal(reset.turn, 'black');
});
