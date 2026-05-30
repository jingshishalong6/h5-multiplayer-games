(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessHints = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const COLOR_NAMES = { red: '红方', black: '黑方' };

  function turnHint(game, role) {
    if (game.winner) return `${COLOR_NAMES[game.winner]}胜出，棋局结束`;
    if (!['red', 'black'].includes(role)) return `观战中，当前轮到${COLOR_NAMES[game.turn]}`;
    if (game.turn === role) return `轮到你走棋，点一个${COLOR_NAMES[role]}棋子`;
    return `等待${COLOR_NAMES[game.turn]}落子`;
  }

  function selectionHint(moveCount) {
    if (moveCount <= 0) return '这个棋子暂时没有可走位置，换一个棋子试试';
    return `已选中棋子，请选择绿色圆点落子（${moveCount} 个可走位置）`;
  }

  function errorHint(reason) {
    const messages = {
      'not your turn': '还没轮到你落子',
      'illegal move': '这个位置不能走，请选择绿色圆点',
      'illegal self check': '不能这样走，会让自己的将帅被将军',
      'out of bounds': '落点不在棋盘内',
      'game over': '棋局已经结束',
      '这个位置不能走': '这个位置不能走，请选择绿色圆点',
      '不能这样走，会让自己的将帅被将军': '不能这样走，会让自己的将帅被将军',
      '落点不在棋盘内': '落点不在棋盘内',
      '棋局已经结束': '棋局已经结束',
      '还没轮到你落子': '还没轮到你落子'
    };
    return messages[reason] || reason || '不能这样走';
  }

  return { turnHint, selectionHint, errorHint };
});
