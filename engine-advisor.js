const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chess = require('./public/src/chess.js');

const DEFAULT_MOVETIME = 1800;

function parseBestMove(output) {
  const match = String(output || '').match(/\bbestmove\s+([a-i][0-9][a-i][0-9])/i);
  if (!match) return null;
  const move = chess.uciToMove(match[1].toLowerCase());
  if (!move) return null;
  return { ...move, uci: match[1].toLowerCase() };
}

function resolveEnginePath({ root = process.cwd(), env = process.env } = {}) {
  if (env.PIKAFISH_PATH || env.CHESS_ENGINE_PATH) return env.PIKAFISH_PATH || env.CHESS_ENGINE_PATH;
  const generatedPathFile = path.join(root, '.engine', 'pikafish-path.txt');
  try {
    const resolved = fs.readFileSync(generatedPathFile, 'utf8').trim();
    return path.isAbsolute(resolved) ? resolved : path.join(root, resolved);
  } catch {
    return '';
  }
}

function defaultEnginePath() {
  return resolveEnginePath();
}

function configuredEngineArgs() {
  const raw = process.env.PIKAFISH_ARGS || process.env.CHESS_ENGINE_ARGS || '';
  return raw ? raw.split(' ').filter(Boolean) : [];
}

function runUciEngine({ enginePath, engineArgs = [], fen, movetime = DEFAULT_MOVETIME, timeoutMs }) {
  return new Promise((resolve, reject) => {
    if (!enginePath) {
      reject(new Error('engine not configured'));
      return;
    }
    try {
      fs.chmodSync(enginePath, 0o755);
    } catch {
      // If chmod is not supported, spawn will report the real error.
    }

    const child = spawn(enginePath, engineArgs, {
      cwd: path.dirname(enginePath),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
    let output = '';
    let errorOutput = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('engine timeout')), timeoutMs || movetime + 3500);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      if (error) reject(error);
      else resolve(result);
    }

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const best = parseBestMove(output);
      if (best) finish(null, { best, output });
    });
    child.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on('error', finish);
    child.on('exit', () => {
      const best = parseBestMove(output);
      if (best) finish(null, { best, output });
      else finish(new Error(errorOutput || 'engine exited without bestmove'));
    });

    child.stdin.write('uci\n');
    child.stdin.write('isready\n');
    child.stdin.write(`position fen ${fen}\n`);
    child.stdin.write(`go movetime ${Math.max(100, Number(movetime || DEFAULT_MOVETIME))}\n`);
  });
}

function buildFallback(state, color, fallback) {
  const advice = fallback ? fallback() : chess.recommendExpertMove(state, color, { level: 'city' });
  if (!advice) return null;
  return {
    ...advice,
    uci: advice.uci || chess.moveToUci(advice),
    fen: advice.fen || chess.toFen(state),
    source: 'local-depth',
    engineAvailable: false,
    engineName: '普通本地提示'
  };
}

async function getEngineAdvice(state, color = state.turn, options = {}) {
  const fen = chess.toFen(state);
  const enginePath = options.enginePath !== undefined ? options.enginePath : defaultEnginePath();
  const engineArgs = options.engineArgs !== undefined ? options.engineArgs : configuredEngineArgs();
  const fallback = () => buildFallback(state, color, options.fallback);

  try {
    const result = await runUciEngine({
      enginePath,
      engineArgs,
      fen,
      movetime: options.movetime || DEFAULT_MOVETIME,
      timeoutMs: options.timeoutMs
    });
    const moveResult = chess.movePiece(state, result.best.from, result.best.to);
    if (!moveResult.ok) throw new Error(`engine returned illegal move: ${result.best.uci}`);
    return {
      from: result.best.from,
      to: result.best.to,
      uci: result.best.uci,
      fen,
      source: 'pikafish',
      engineAvailable: true,
      engineName: path.basename(enginePath || 'Pikafish'),
      output: result.output.slice(-1000)
    };
  } catch (error) {
    const advice = fallback();
    if (!advice) return null;
    return {
      ...advice,
      engineError: error.message
    };
  }
}

module.exports = {
  DEFAULT_MOVETIME,
  parseBestMove,
  resolveEnginePath,
  runUciEngine,
  getEngineAdvice
};
