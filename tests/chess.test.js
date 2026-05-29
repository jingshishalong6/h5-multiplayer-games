const test = require('node:test');
const assert = require('node:assert/strict');
const chess = require('../public/src/chess.js');

test('horse cannot move when its leg is blocked', () => {
  const state = chess.createInitialState();

  const blocked = chess.movePiece(state, { x: 1, y: 9 }, { x: 3, y: 8 });

  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /illegal/i);
});

test('cannon capture requires exactly one screen piece', () => {
  const state = chess.createInitialState();

  const capture = chess.movePiece(state, { x: 1, y: 7 }, { x: 1, y: 0 });
  assert.equal(capture.ok, true);
  assert.equal(capture.state.board[0][1].type, 'cannon');

  const noScreen = chess.createEmptyState('red');
  noScreen.board[7][1] = chess.makePiece('red', 'cannon');
  noScreen.board[0][1] = chess.makePiece('black', 'horse');
  const invalid = chess.movePiece(noScreen, { x: 1, y: 7 }, { x: 1, y: 0 });
  assert.equal(invalid.ok, false);
});

test('flying general rule prevents exposed kings', () => {
  const state = chess.createEmptyState('red');
  state.board[9][4] = chess.makePiece('red', 'king');
  state.board[0][4] = chess.makePiece('black', 'king');
  state.board[5][4] = chess.makePiece('red', 'rook');

  const result = chess.movePiece(state, { x: 4, y: 5 }, { x: 5, y: 5 });

  assert.equal(result.ok, false);
});

test('checkmate is detected when the checked king has no escape', () => {
  const state = chess.createEmptyState('black');
  state.board[0][4] = chess.makePiece('black', 'king');
  state.board[2][4] = chess.makePiece('red', 'rook');
  state.board[0][3] = chess.makePiece('red', 'rook');
  state.board[0][5] = chess.makePiece('red', 'rook');
  state.board[9][4] = chess.makePiece('red', 'king');

  assert.equal(chess.isInCheck(state, 'black'), true);
  assert.equal(chess.isCheckmate(state, 'black'), true);
});
