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

test('undo removes the latest gomoku move and restores the turn', () => {
  let state = gomoku.createInitialState();
  state = gomoku.placeStone(state, 7, 7, 'black').state;
  state = gomoku.placeStone(state, 8, 7, 'white').state;

  const undone = gomoku.undoLastMove(state);

  assert.equal(undone.board[7][8], null);
  assert.equal(undone.board[7][7], 'black');
  assert.equal(undone.turn, 'white');
  assert.equal(undone.moves.length, 1);
  assert.equal(undone.lastMove.x, 7);
});

test('full gomoku board without five in a row is a draw', () => {
  const state = gomoku.createInitialState();
  state.board = Array.from({ length: gomoku.SIZE }, (_, y) => (
    Array.from({ length: gomoku.SIZE }, (_, x) => (x === 14 && y === 14 ? null : ((x + 2 * y) % 5 < 2 ? 'black' : 'white')))
  ));
  state.moves = [];
  for (let y = 0; y < gomoku.SIZE; y += 1) {
    for (let x = 0; x < gomoku.SIZE; x += 1) {
      if (state.board[y][x]) state.moves.push({ x, y, color: state.board[y][x] });
    }
  }
  state.turn = 'white';
  state.lastMove = state.moves[state.moves.length - 1];

  const result = gomoku.placeStone(state, 14, 14, 'white');

  assert.equal(result.ok, true);
  assert.equal(result.state.winner, null);
  assert.equal(result.state.draw, true);
});
