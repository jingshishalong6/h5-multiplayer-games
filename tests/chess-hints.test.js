const test = require('node:test');
const assert = require('node:assert/strict');
const hints = require('../public/src/chess-hints.js');

test('turn hint tells the player to move on their turn', () => {
  assert.equal(hints.turnHint({ turn: 'black' }, 'black'), '轮到你走棋，点一个黑方棋子');
});

test('turn hint tells the player to wait when it is the opponent turn', () => {
  assert.equal(hints.turnHint({ turn: 'red' }, 'black'), '等待红方落子');
});

test('selection hint tells the player how many moves are available', () => {
  assert.equal(hints.selectionHint(3), '已选中棋子，请选择绿色圆点落子（3 个可走位置）');
});

test('selection hint explains when a piece has no legal moves', () => {
  assert.equal(hints.selectionHint(0), '这个棋子暂时没有可走位置，换一个棋子试试');
});

test('error hint translates chess move errors', () => {
  assert.equal(hints.errorHint('illegal self check'), '不能这样走，会让自己的将帅被将军');
  assert.equal(hints.errorHint('not your turn'), '还没轮到你落子');
});
