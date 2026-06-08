const test = require('node:test');
const assert = require('node:assert/strict');
const audioEvents = require('../public/src/audio-events.js');

test('chess sound event ignores the initial board state', () => {
  assert.equal(audioEvents.chessSoundEvent(0, { moveHistory: [] }), null);
});

test('chess sound event returns move for a non-capturing new move', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 }, piece: { color: 'red', type: 'soldier' }, captured: null }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'move');
});

test('chess sound event returns capture for a capturing small piece move', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 1 }, to: { x: 0, y: 5 }, piece: { color: 'black', type: 'rook' }, captured: { color: 'red', type: 'soldier' } }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'capture');
});

test('chess sound event returns bigCapture for horse cannon and rook captures', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 1 }, to: { x: 0, y: 5 }, piece: { color: 'black', type: 'rook' }, captured: { color: 'red', type: 'horse' } }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'bigCapture');
});

test('chess sound event returns check for a checking move', () => {
  const state = {
    status: 'check',
    moveHistory: [
      { from: { x: 0, y: 1 }, to: { x: 0, y: 5 }, piece: { color: 'black', type: 'rook' }, captured: null }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'check');
});

test('chess sound event returns checkmate before other move sounds', () => {
  const state = {
    winner: 'red',
    status: 'checkmate',
    moveHistory: [
      { from: { x: 4, y: 2 }, to: { x: 4, y: 0 }, piece: { color: 'red', type: 'rook' }, captured: { color: 'black', type: 'advisor' } }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(0, state), 'checkmate');
});

test('chess sound event ignores already-seen moves', () => {
  const state = {
    moveHistory: [
      { from: { x: 0, y: 6 }, to: { x: 0, y: 5 }, piece: { color: 'red', type: 'soldier' }, captured: null }
    ]
  };

  assert.equal(audioEvents.chessSoundEvent(1, state), null);
});

test('chess voice text keeps normal move announcements short', () => {
  assert.equal(
    audioEvents.chessVoiceText('move', '最近一步：阿强走了红方兵从1路7线走到1路6线，轮到黑方'),
    '阿强，红方兵'
  );
  assert.equal(
    audioEvents.chessVoiceText('move', '最近一步：AI走了黑方炮从2路3线走到2路10线，吃掉红方马，轮到红方'),
    'AI，黑方炮'
  );
});

test('chess voice text uses short tactical phrases', () => {
  assert.equal(audioEvents.chessVoiceText('capture', '最近一步：阿强走了红方兵，吃掉黑方卒'), '吃子');
  assert.equal(audioEvents.chessVoiceText('bigCapture', '最近一步：阿强走了红方车，吃掉黑方马'), '漂亮，吃大子');
  assert.equal(audioEvents.chessVoiceText('check', '最近一步：阿强走了红方车，黑方被将军'), '将军');
  assert.equal(audioEvents.chessVoiceText('checkmate', '红方胜，将死'), '将死');
  assert.equal(audioEvents.chessVoiceText('resign', ''), '认输');
});

test('selects the softest available Chinese female voice', () => {
  const voices = [
    { name: 'Microsoft Yunxi Online', lang: 'zh-CN' },
    { name: 'Microsoft Xiaoxiao Online Natural', lang: 'zh-CN' },
    { name: 'Google US English', lang: 'en-US' }
  ];

  assert.equal(audioEvents.selectChineseVoice(voices).name, 'Microsoft Xiaoxiao Online Natural');
});
