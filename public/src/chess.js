(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const WIDTH = 9;
  const HEIGHT = 10;
  const TYPES = {
    king: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    rook: '车',
    cannon: '炮',
    soldier: '兵'
  };
  const COLOR_NAMES = { red: '红方', black: '黑方' };
  const PIECE_NAMES = {
    red: { king: '帅', advisor: '仕', elephant: '相', horse: '马', rook: '车', cannon: '炮', soldier: '兵' },
    black: { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '炮', soldier: '卒' }
  };

  let nextId = 1;

  function other(color) {
    return color === 'red' ? 'black' : 'red';
  }

  function makePiece(color, type) {
    return { id: `${color}-${type}-${nextId++}`, color, type };
  }

  function cloneState(state) {
    return {
      turn: state.turn,
      winner: state.winner || null,
      status: state.status || '',
      moveHistory: (state.moveHistory || []).map((item) => JSON.parse(JSON.stringify(item))),
      board: state.board.map((row) => row.map((piece) => (piece ? { ...piece } : null)))
    };
  }

  function createEmptyState(turn = 'red') {
    return {
      turn,
      winner: null,
      status: '',
      moveHistory: [],
      board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null))
    };
  }

  function createInitialState() {
    const state = createEmptyState('red');
    const b = state.board;
    const back = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'];
    back.forEach((type, x) => {
      b[0][x] = makePiece('black', type);
      b[9][x] = makePiece('red', type);
    });
    b[2][1] = makePiece('black', 'cannon');
    b[2][7] = makePiece('black', 'cannon');
    b[7][1] = makePiece('red', 'cannon');
    b[7][7] = makePiece('red', 'cannon');
    [0, 2, 4, 6, 8].forEach((x) => {
      b[3][x] = makePiece('black', 'soldier');
      b[6][x] = makePiece('red', 'soldier');
    });
    return state;
  }

  function inBounds(pos) {
    return pos && pos.x >= 0 && pos.x < WIDTH && pos.y >= 0 && pos.y < HEIGHT;
  }

  function inPalace(color, pos) {
    const yOk = color === 'red' ? pos.y >= 7 && pos.y <= 9 : pos.y >= 0 && pos.y <= 2;
    return pos.x >= 3 && pos.x <= 5 && yOk;
  }

  function crossedRiver(color, y) {
    return color === 'red' ? y <= 4 : y >= 5;
  }

  function pathCount(board, from, to) {
    let count = 0;
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x + dx;
    let y = from.y + dy;
    while (x !== to.x || y !== to.y) {
      if (board[y][x]) count += 1;
      x += dx;
      y += dy;
    }
    return count;
  }

  function findKing(state, color) {
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const piece = state.board[y][x];
        if (piece && piece.color === color && piece.type === 'king') return { x, y };
      }
    }
    return null;
  }

  function kingsFace(board) {
    let redKing = null;
    let blackKing = null;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const piece = board[y][x];
        if (piece && piece.type === 'king') {
          if (piece.color === 'red') redKing = { x, y };
          else blackKing = { x, y };
        }
      }
    }
    if (!redKing || !blackKing || redKing.x !== blackKing.x) return false;
    return pathCount(board, redKing, blackKing) === 0;
  }

  function canRawMove(state, from, to, attackOnly = false) {
    if (!inBounds(from) || !inBounds(to)) return false;
    const piece = state.board[from.y][from.x];
    if (!piece) return false;
    const target = state.board[to.y][to.x];
    if (!attackOnly && target && target.color === piece.color) return false;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const color = piece.color;
    const forward = color === 'red' ? -1 : 1;

    if (piece.type === 'king') {
      if (target && target.type === 'king' && from.x === to.x) return pathCount(state.board, from, to) === 0;
      return adx + ady === 1 && inPalace(color, to);
    }

    if (piece.type === 'advisor') return adx === 1 && ady === 1 && inPalace(color, to);

    if (piece.type === 'elephant') {
      if (adx !== 2 || ady !== 2) return false;
      if (color === 'red' && to.y < 5) return false;
      if (color === 'black' && to.y > 4) return false;
      return !state.board[from.y + dy / 2][from.x + dx / 2];
    }

    if (piece.type === 'horse') {
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return false;
      const leg = adx === 2 ? { x: from.x + dx / 2, y: from.y } : { x: from.x, y: from.y + dy / 2 };
      return !state.board[leg.y][leg.x];
    }

    if (piece.type === 'rook') {
      if (dx !== 0 && dy !== 0) return false;
      return pathCount(state.board, from, to) === 0;
    }

    if (piece.type === 'cannon') {
      if (dx !== 0 && dy !== 0) return false;
      const screens = pathCount(state.board, from, to);
      return target ? screens === 1 : screens === 0;
    }

    if (piece.type === 'soldier') {
      if (dy === forward && dx === 0) return true;
      return crossedRiver(color, from.y) && dy === 0 && adx === 1;
    }

    return false;
  }

  function applyMove(state, from, to) {
    const next = cloneState(state);
    const piece = next.board[from.y][from.x];
    const captured = next.board[to.y][to.x];
    next.board[to.y][to.x] = piece;
    next.board[from.y][from.x] = null;
    next.moveHistory.push({ from, to, piece: { ...piece }, captured: captured ? { ...captured } : null, turn: state.turn });
    next.turn = other(state.turn);
    return next;
  }

  function movePiece(state, from, to) {
    if (state.winner) return { ok: false, reason: 'game over' };
    if (!inBounds(from) || !inBounds(to)) return { ok: false, reason: 'out of bounds' };
    const piece = state.board[from.y][from.x];
    if (!piece || piece.color !== state.turn) return { ok: false, reason: 'not your turn' };
    if (!canRawMove(state, from, to)) return { ok: false, reason: 'illegal move' };

    const next = applyMove(state, from, to);
    if (kingsFace(next.board) || isInCheck(next, piece.color)) return { ok: false, reason: 'illegal self check' };

    const enemy = other(piece.color);
    if (isCheckmate(next, enemy)) {
      next.winner = piece.color;
      next.status = 'checkmate';
    } else if (isInCheck(next, enemy)) {
      next.status = 'check';
    } else {
      next.status = '';
    }
    return { ok: true, state: next };
  }

  function isInCheck(state, color) {
    const king = findKing(state, color);
    if (!king) return true;
    if (kingsFace(state.board)) return true;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const piece = state.board[y][x];
        if (piece && piece.color !== color && canRawMove(state, { x, y }, king, true)) return true;
      }
    }
    return false;
  }

  function getLegalMoves(state, from) {
    if (!inBounds(from)) return [];
    const piece = state.board[from.y][from.x];
    if (!piece || piece.color !== state.turn) return [];
    const moves = [];
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const result = movePiece(state, from, { x, y });
        if (result.ok) moves.push({ x, y });
      }
    }
    return moves;
  }

  function isCheckmate(state, color) {
    if (!isInCheck(state, color)) return false;
    const probe = cloneState(state);
    probe.turn = color;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const piece = probe.board[y][x];
        if (piece && piece.color === color && getLegalMoves(probe, { x, y }).length > 0) return false;
      }
    }
    return true;
  }

  function remainingPieces(state) {
    const result = { red: {}, black: {} };
    Object.keys(TYPES).forEach((type) => {
      result.red[type] = 0;
      result.black[type] = 0;
    });
    state.board.flat().forEach((piece) => {
      if (piece) result[piece.color][piece.type] += 1;
    });
    return result;
  }

  function movePrompt(state) {
    const mover = other(state.turn);
    const lastMove = state.moveHistory[state.moveHistory.length - 1];
    const captured = lastMove && lastMove.captured;
    const action = captured ? `吃掉${COLOR_NAMES[captured.color]}${PIECE_NAMES[captured.color][captured.type]}` : '走完';
    if (state.winner) return `${COLOR_NAMES[state.winner]}胜，将死`;
    if (state.status === 'check') return `${COLOR_NAMES[mover]}${action}，${COLOR_NAMES[state.turn]}被将军`;
    return `${COLOR_NAMES[mover]}${action}，轮到${COLOR_NAMES[state.turn]}`;
  }

  function undoLastMove(state) {
    if (!state.moveHistory || state.moveHistory.length === 0) return state;
    const next = cloneState(state);
    const last = next.moveHistory.pop();
    next.board[last.from.y][last.from.x] = last.piece;
    next.board[last.to.y][last.to.x] = last.captured;
    next.turn = last.turn;
    next.winner = null;
    next.status = '';
    return next;
  }

  return {
    WIDTH,
    HEIGHT,
    TYPES,
    other,
    makePiece,
    createEmptyState,
    createInitialState,
    cloneState,
    movePiece,
    getLegalMoves,
    isInCheck,
    isCheckmate,
    remainingPieces,
    movePrompt,
    undoLastMove
  };
});
