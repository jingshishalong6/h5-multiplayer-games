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

test('move prompt announces the moved piece and coordinates', () => {
  const state = chess.createInitialState();
  const result = chess.movePiece(state, { x: 0, y: 6 }, { x: 0, y: 5 });

  assert.equal(result.ok, true);
  assert.equal(chess.movePrompt(result.state), '红方兵从1路7线走到1路6线，轮到黑方');
});

test('move prompt announces captured piece and whose turn is next', () => {
  const state = chess.createEmptyState('black');
  state.board[0][4] = chess.makePiece('black', 'king');
  state.board[9][3] = chess.makePiece('red', 'king');
  state.board[1][0] = chess.makePiece('black', 'rook');
  state.board[5][0] = chess.makePiece('red', 'horse');

  const result = chess.movePiece(state, { x: 0, y: 1 }, { x: 0, y: 5 });

  assert.equal(result.ok, true);
  assert.equal(chess.movePrompt(result.state), '黑方车从1路2线走到1路6线，吃掉红方马，轮到红方');
});

test('move notice includes the player name and moved piece', () => {
  const state = chess.createInitialState();
  const result = chess.movePiece(state, { x: 0, y: 6 }, { x: 0, y: 5 });

  assert.equal(result.ok, true);
  assert.equal(chess.moveNotice('阿强', result.state), '最近一步：阿强走了红方兵从1路7线走到1路6线，轮到黑方');
});

test('lists at least five playable endgame presets', () => {
  const endgames = chess.listEndgames();

  assert.ok(endgames.length >= 5);
  assert.ok(endgames.every((item) => item.id && item.name));
});

test('creates an endgame state with mode metadata and legal kings', () => {
  const preset = chess.listEndgames()[0];
  const state = chess.createEndgameState(preset.id);

  assert.equal(state.mode, 'endgame-ai');
  assert.equal(state.endgameId, preset.id);
  assert.equal(state.endgameName, preset.name);
  assert.equal(state.turn, 'red');
  assert.equal(chess.isInCheck(state, 'red'), false);
  assert.ok(state.board.flat().some((piece) => piece?.color === 'red' && piece.type !== 'king'));
  assert.ok(state.board.flat().some((piece) => piece?.color === 'black' && piece.type === 'king'));
});

test('creates a human-vs-ai chess state and preserves metadata after moves', () => {
  const state = chess.createHumanVsAiState({ humanColor: 'red' });
  const result = chess.movePiece(state, { x: 0, y: 6 }, { x: 0, y: 5 });

  assert.equal(state.mode, 'ai');
  assert.equal(state.humanColor, 'red');
  assert.equal(state.aiColor, 'black');
  assert.equal(result.ok, true);
  assert.equal(result.state.mode, 'ai');
  assert.equal(result.state.humanColor, 'red');
  assert.equal(result.state.aiColor, 'black');
});

test('local AI recommendation is a legal move in endgame mode', () => {
  const state = chess.createEndgameState('rook-cannon-attack');
  const advice = chess.recommendExpertMove(state, state.turn, { level: 'amateur', movetime: 200 });
  const result = chess.movePiece(state, advice.from, advice.to);

  assert.equal(result.ok, true);
});

test('detects AI modes and resets to the current endgame preset', () => {
  const state = chess.createEndgameState('horse-cannon-mate');
  const moved = chess.movePiece(state, { x: 3, y: 2 }, { x: 5, y: 1 }).state;
  const reset = chess.resetModeState(moved);

  assert.equal(chess.isAiMode(state), true);
  assert.equal(reset.mode, 'endgame-ai');
  assert.equal(reset.endgameId, 'horse-cannon-mate');
  assert.equal(reset.moveHistory.length, 0);
});
