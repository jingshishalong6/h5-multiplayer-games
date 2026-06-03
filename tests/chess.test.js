const test = require('node:test');
const assert = require('node:assert/strict');
const chess = require('../public/src/chess.js');

test('horse cannot move when its leg is blocked', () => {
  const state = chess.createInitialState();

  const blocked = chess.movePiece(state, { x: 1, y: 9 }, { x: 3, y: 8 });

  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /illegal/i);
});

test('recommend move prefers a checkmating move', () => {
  const state = chess.createEmptyState('red');
  state.board[0][4] = chess.makePiece('black', 'king');
  state.board[9][4] = chess.makePiece('red', 'king');
  state.board[2][4] = chess.makePiece('red', 'rook');
  state.board[1][3] = chess.makePiece('red', 'rook');
  state.board[1][5] = chess.makePiece('red', 'rook');
  state.board[0][3] = chess.makePiece('red', 'soldier');
  state.board[0][5] = chess.makePiece('red', 'soldier');

  const advice = chess.recommendMove(state, 'red');
  const result = chess.movePiece(state, advice.from, advice.to);

  assert.equal(result.ok, true);
  assert.equal(result.state.winner, 'red');
});

test('recommend move prefers capturing a high value piece', () => {
  const state = chess.createEmptyState('red');
  state.board[0][3] = chess.makePiece('black', 'king');
  state.board[9][4] = chess.makePiece('red', 'king');
  state.board[5][0] = chess.makePiece('red', 'rook');
  state.board[4][0] = chess.makePiece('black', 'horse');
  state.board[5][1] = chess.makePiece('black', 'rook');

  const advice = chess.recommendMove(state, 'red');

  assert.deepEqual(advice.from, { x: 0, y: 5 });
  assert.deepEqual(advice.to, { x: 1, y: 5 });
});

test('serializes the initial board as xiangqi engine FEN', () => {
  const state = chess.createInitialState();

  assert.equal(
    chess.toFen(state),
    'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
  );
});

test('converts board moves to and from UCI coordinates', () => {
  const move = { from: { x: 1, y: 7 }, to: { x: 1, y: 0 } };

  assert.equal(chess.moveToUci(move), 'b2b9');
  assert.deepEqual(chess.uciToMove('b2b9'), move);
});

test('expert recommendation returns engine metadata and a legal strong move', () => {
  const state = chess.createEmptyState('red');
  state.board[0][3] = chess.makePiece('black', 'king');
  state.board[9][4] = chess.makePiece('red', 'king');
  state.board[5][0] = chess.makePiece('red', 'rook');
  state.board[4][0] = chess.makePiece('black', 'horse');
  state.board[5][1] = chess.makePiece('black', 'rook');

  const advice = chess.recommendExpertMove(state, 'red', { level: 'city' });
  const result = chess.movePiece(state, advice.from, advice.to);

  assert.equal(advice.engine, 'local-depth');
  assert.equal(advice.level, 'city');
  assert.equal(advice.displayDepth, 20);
  assert.equal(advice.fen, chess.toFen(state));
  assert.equal(advice.uci, 'a4b4');
  assert.deepEqual(advice.from, { x: 0, y: 5 });
  assert.deepEqual(advice.to, { x: 1, y: 5 });
  assert.equal(result.ok, true);
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

test('move prompt announces the side that moved and whose turn is next', () => {
  const state = chess.createInitialState();
  const result = chess.movePiece(state, { x: 0, y: 6 }, { x: 0, y: 5 });

  assert.equal(result.ok, true);
  assert.equal(chess.movePrompt(result.state), '红方走完，轮到黑方');
});

test('move prompt announces captured piece and whose turn is next', () => {
  const state = chess.createEmptyState('black');
  state.board[0][4] = chess.makePiece('black', 'king');
  state.board[9][3] = chess.makePiece('red', 'king');
  state.board[1][0] = chess.makePiece('black', 'rook');
  state.board[5][0] = chess.makePiece('red', 'horse');

  const result = chess.movePiece(state, { x: 0, y: 1 }, { x: 0, y: 5 });

  assert.equal(result.ok, true);
  assert.equal(chess.movePrompt(result.state), '黑方吃掉红方马，轮到红方');
});
