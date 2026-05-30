const test = require('node:test');
const assert = require('node:assert/strict');
const boardView = require('../public/src/board-view.js');

test('red view keeps board coordinates unchanged', () => {
  assert.deepEqual(boardView.toView({ x: 0, y: 9 }, 'red'), { x: 0, y: 9 });
  assert.deepEqual(boardView.fromView({ x: 4, y: 6 }, 'red'), { x: 4, y: 6 });
});

test('black view flips board coordinates so black pieces render at the bottom', () => {
  assert.deepEqual(boardView.toView({ x: 4, y: 0 }, 'black'), { x: 4, y: 9 });
  assert.deepEqual(boardView.fromView({ x: 4, y: 9 }, 'black'), { x: 4, y: 0 });
  assert.deepEqual(boardView.toView({ x: 0, y: 9 }, 'black'), { x: 8, y: 0 });
});
