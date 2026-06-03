const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const engineAdvisor = require('../engine-advisor.js');
const chess = require('../public/src/chess.js');

test('parses UCI bestmove output into a legal board move', () => {
  const move = engineAdvisor.parseBestMove('info depth 12 score cp 42\nbestmove b2b9 ponder h9g7');

  assert.deepEqual(move, { from: { x: 1, y: 7 }, to: { x: 1, y: 0 }, uci: 'b2b9' });
});

test('falls back to local advisor when no engine executable is configured', async () => {
  const state = chess.createInitialState();
  const advice = await engineAdvisor.getEngineAdvice(state, 'red', {
    enginePath: '',
    fallback: () => ({ from: { x: 1, y: 7 }, to: { x: 1, y: 0 }, uci: 'b2b9' })
  });

  assert.equal(advice.source, 'local-depth');
  assert.equal(advice.engineAvailable, false);
  assert.deepEqual(advice.from, { x: 1, y: 7 });
  assert.deepEqual(advice.to, { x: 1, y: 0 });
});

test('asks an external UCI engine for bestmove when configured', async () => {
  const state = chess.createInitialState();
  const advice = await engineAdvisor.getEngineAdvice(state, 'red', {
    enginePath: process.execPath,
    engineArgs: [path.join(__dirname, 'fixtures', 'fake-uci-engine.js')],
    movetime: 120,
    fallback: () => null
  });

  assert.equal(advice.source, 'pikafish');
  assert.equal(advice.engineAvailable, true);
  assert.equal(advice.uci, 'b2b9');
  assert.deepEqual(advice.from, { x: 1, y: 7 });
  assert.deepEqual(advice.to, { x: 1, y: 0 });
  assert.equal(advice.fen, chess.toFen(state));
});

test('resolves engine path from generated setup file when env is empty', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pikafish-path-'));
  const engineDir = path.join(root, '.engine');
  fs.mkdirSync(engineDir);
  fs.writeFileSync(path.join(engineDir, 'pikafish-path.txt'), '.engine/pikafish');

  assert.equal(
    engineAdvisor.resolveEnginePath({ root, env: {} }),
    path.join(root, '.engine', 'pikafish')
  );
});
