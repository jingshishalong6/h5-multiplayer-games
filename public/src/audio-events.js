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

  function chessVoiceText(event, notice = '') {
    const special = {
      capture: '吃',
      bigCapture: '卧槽，吃',
      check: '将军',
      checkmate: '死棋',
      resign: '认输'
    };
    if (special[event]) return special[event];
    if (event !== 'move') return '';
    return String(notice || '')
      .replace(/^最近一步：/, '')
      .replace(/，轮到.*$/, '')
      .trim();
  }

  return {
    chessSoundEvent,
    chessVoiceText
  };
});
