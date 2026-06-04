(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AudioEvents = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function chessSoundEvent(previousMoveCount, chessState) {
    const history = chessState?.moveHistory || [];
    if (history.length <= previousMoveCount) return null;
    const latest = history[history.length - 1];
    if (chessState?.winner || chessState?.status === 'checkmate') return 'checkmate';
    if (chessState?.status === 'check') return 'check';
    if (latest?.captured) {
      return ['rook', 'cannon', 'horse'].includes(latest.captured.type) ? 'bigCapture' : 'capture';
    }
    return 'move';
  }

  return {
    chessSoundEvent
  };
});
