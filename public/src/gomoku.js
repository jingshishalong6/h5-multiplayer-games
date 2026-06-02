(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GomokuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SIZE = 15;
  const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  function other(color) {
    return color === 'black' ? 'white' : 'black';
  }

  function createInitialState() {
    return {
      size: SIZE,
      turn: 'black',
      winner: null,
      lastMove: null,
      moves: [],
      board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
    };
  }

  function cloneState(state) {
    return {
      size: state.size || SIZE,
      turn: state.turn,
      winner: state.winner || null,
      lastMove: state.lastMove ? { ...state.lastMove } : null,
      moves: (state.moves || []).map((move) => ({ ...move })),
      board: state.board.map((row) => row.slice())
    };
  }

  function inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  function countLine(board, x, y, color, dx, dy) {
    let count = 1;
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny) && board[ny][nx] === color) {
      count += 1;
      nx += dx;
      ny += dy;
    }
    nx = x - dx;
    ny = y - dy;
    while (inBounds(nx, ny) && board[ny][nx] === color) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }
    return count;
  }

  function hasFive(board, x, y, color) {
    return DIRECTIONS.some(([dx, dy]) => countLine(board, x, y, color, dx, dy) >= 5);
  }

  function placeStone(state, x, y, color = state.turn) {
    if (!inBounds(x, y)) return { ok: false, reason: 'out of bounds' };
    if (state.winner) return { ok: false, reason: 'game over' };
    if (color !== state.turn) return { ok: false, reason: 'not your turn' };
    if (state.board[y][x]) return { ok: false, reason: 'occupied' };
    const next = cloneState(state);
    next.board[y][x] = color;
    next.lastMove = { x, y, color };
    next.moves.push(next.lastMove);
    if (hasFive(next.board, x, y, color)) next.winner = color;
    else next.turn = other(color);
    return { ok: true, state: next };
  }

  return {
    SIZE,
    createInitialState,
    cloneState,
    placeStone,
    hasFive,
    other
  };
});
