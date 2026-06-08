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

  function shortMoveText(notice = '') {
    const text = String(notice || '').replace(/^最近一步：/, '').trim();
    const match = text.match(/^(.+?)走了(红方|黑方)(帅|将|仕|士|相|象|马|车|炮|兵|卒)/);
    if (match) return `${match[1]}，${match[2]}${match[3]}`;
    return text
      .replace(/从.+$/, '')
      .replace(/，轮到.+$/, '')
      .replace(/，吃掉.+$/, '')
      .slice(0, 12)
      .trim();
  }

  function chessVoiceText(event, notice = '') {
    const special = {
      capture: '吃子',
      bigCapture: '漂亮，吃大子',
      check: '将军',
      checkmate: '将死',
      resign: '认输'
    };
    if (special[event]) return special[event];
    if (event !== 'move') return '';
    return shortMoveText(notice);
  }

  function selectChineseVoice(voices = []) {
    const list = Array.from(voices || []);
    if (!list.length) return null;
    const scored = list.map((voice) => {
      const haystack = `${voice.name || ''} ${voice.lang || ''}`.toLowerCase();
      let score = /zh|cn|chinese|mandarin|普通话|中文/.test(haystack) ? 10 : 0;
      if (/xiaoxiao|xiaoyi|xiaohan|xiaomeng|huihui|tingting|yaoyao|female|woman|girl|女/.test(haystack)) score += 8;
      if (/natural|online|neural|premium/.test(haystack)) score += 5;
      if (/yunxi|yunjian|male|man|男/.test(haystack)) score -= 5;
      return { voice, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].score > 0 ? scored[0].voice : list[0];
  }

  return {
    chessSoundEvent,
    chessVoiceText,
    selectChineseVoice
  };
});
