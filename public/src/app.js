const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const pieceNames = {
  red: { king: '帅', advisor: '仕', elephant: '相', horse: '马', rook: '车', cannon: '炮', soldier: '兵' },
  black: { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '炮', soldier: '卒' }
};
const typeOrder = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'soldier'];
function getDeviceId() {
  const key = 'h5-games-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
const sideNames = { player: '闲', banker: '庄', tie: '和' };
const SESSION_KEY = 'h5-games-last-session';

function getSavedAdviceLevel() {
  return localStorage.getItem('h5-games-chess-advice-level') || 'city';
}

function getSavedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

let ws = null;
let reconnectTimer = null;
let audioContext = null;
const savedSession = getSavedSession();
let model = {
  joined: false,
  connected: false,
  you: null,
  state: null,
  lastName: savedSession.name || '',
  lastRoomCode: savedSession.roomCode || '',
  reconnecting: false,
  manualClose: false,
  lastChessMoveCount: 0,
  soundUnlocked: false,
  tab: 'chess',
  selected: null,
  legalMoves: [],
  chessAdvice: null,
  chessAdviceLevel: getSavedAdviceLevel(),
  chessAdviceThinking: false,
  error: '',
  chessHint: '',
  dragFrom: null,
  slotSpinning: false,
  slotStartedAt: 0,
  celebrationSlotKey: '',
  skippedCelebrationKey: '',
  slotBet: 10,
  baccaratAmount: 20,
  deviceId: getDeviceId(),
  adminPin: '',
  adminAmount: 100
};

function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function connect(name = model.lastName, roomCode = model.lastRoomCode, { reconnect = false } = {}) {
  if (!name || !roomCode) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
  clearTimeout(reconnectTimer);
  model.lastName = String(name);
  model.lastRoomCode = String(roomCode);
  model.reconnecting = reconnect;
  model.manualClose = false;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ name: model.lastName, roomCode: model.lastRoomCode }));
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}`);
  ws = socket;
  socket.addEventListener('open', () => {
    model.connected = true;
    model.reconnecting = false;
    send({ type: 'join', name: model.lastName, roomCode: model.lastRoomCode, deviceId: model.deviceId });
    render();
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'state') {
      maybePlayChessMoveSound(message.state.chess?.state, message.state.chess?.notice);
      model.joined = true;
      model.you = message.you;
      model.state = message.state;
      model.error = '';
      model.chessHint = '';
      model.selected = null;
      model.legalMoves = [];
      model.chessAdvice = null;
      model.chessAdviceThinking = false;
    }
    if (message.type === 'error') {
      model.error = message.message;
      model.chessHint = ChessHints.errorHint(message.message);
    }
    if (message.type === 'adminStatus') {
      model.error = message.ok ? '' : message.message;
      if (model.you) model.you.isAdmin = !!message.isAdmin;
      if (message.ok) model.chessHint = message.message;
    }
    if (message.type === 'chessVoice') {
      playChessAnnouncement(AudioEvents.chessVoiceText(message.event, ''));
    }
    if (message.type === 'chessAdvice') {
      model.chessAdviceThinking = false;
      if (!message.ok || !message.advice) {
        model.chessAdvice = null;
        model.chessHint = message.message || '当前没有找到可走提示';
      } else {
        applyChessAdvice(message.advice);
      }
    }
    render();
  });
  socket.addEventListener('close', () => {
    if (socket !== ws) return;
    model.connected = false;
    if (!model.manualClose && model.lastName && model.lastRoomCode) {
      model.reconnecting = true;
      model.error = '连接断开，正在自动重连...';
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => connect(model.lastName, model.lastRoomCode, { reconnect: true }), 1500);
    } else {
      model.error = '连接已断开，请重新进入房间';
    }
    render();
  });
}

function unlockSound() {
  if (model.soundUnlocked) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume?.();
    model.soundUnlocked = true;
  } catch {
    model.soundUnlocked = false;
  }
}

function playTone({ type = 'triangle', start = 0, duration = 0.1, from = 520, to = 240, volume = 0.2 }) {
  const now = audioContext.currentTime + start;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playChessSound(kind) {
  try {
    unlockSound();
    if (!audioContext || !model.soundUnlocked) return;
    if (kind === 'checkmate') {
      playTone({ type: 'square', start: 0, duration: 0.11, from: 180, to: 70, volume: 0.25 });
      playTone({ type: 'sawtooth', start: 0.1, duration: 0.22, from: 110, to: 46, volume: 0.18 });
      return;
    }
    if (kind === 'check') {
      playTone({ type: 'triangle', start: 0, duration: 0.1, from: 760, to: 980, volume: 0.2 });
      playTone({ type: 'triangle', start: 0.08, duration: 0.12, from: 980, to: 620, volume: 0.16 });
      return;
    }
    if (kind === 'bigCapture' || kind === 'capture') {
      playTone({ type: 'square', start: 0, duration: 0.07, from: 920, to: 360, volume: 0.24 });
      playTone({ type: 'sawtooth', start: 0.015, duration: 0.18, from: 150, to: 62, volume: 0.18 });
      playTone({ type: 'triangle', start: 0.08, duration: 0.09, from: 680, to: 220, volume: 0.2 });
      return;
    }
    playTone({ type: 'triangle', start: 0, duration: 0.075, from: 760, to: 420, volume: 0.18 });
    playTone({ type: 'sine', start: 0.055, duration: 0.085, from: 520, to: 260, volume: 0.12 });
  } catch {}
}

function maybePlayChessMoveSound(chessState, notice = '') {
  const event = AudioEvents.chessSoundEvent(model.lastChessMoveCount, chessState);
  if (model.joined && event) {
    playChessSound(event);
    playChessAnnouncement(AudioEvents.chessVoiceText(event, notice));
  }
  model.lastChessMoveCount = chessState?.moveHistory?.length || 0;
}

function playChessAnnouncement(text) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.95;
    utterance.pitch = 1.18;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((item) => /female|xiaoxiao|huihui|tingting|hanhan|yaoyao|女|普通话|zh/i.test(`${item.name} ${item.lang}`) && /zh|cn|mandarin|普通话/i.test(`${item.name} ${item.lang}`))
      || voices.find((item) => /zh|cn|mandarin|普通话/i.test(`${item.name} ${item.lang}`));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {}
}

function enableVoice() {
  unlockSound();
  try {
    window.speechSynthesis?.getVoices();
    playChessAnnouncement('语音已开启');
  } catch {}
  model.soundUnlocked = true;
  render();
}

function pageShell(content) {
  app.innerHTML = `
    <div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-black tracking-normal text-stone-900 sm:text-3xl">同事娱乐房</h1>
          <p class="text-sm text-stone-600">H5 联机象棋 · 虚拟筹码娱乐 · 房间聊天</p>
        </div>
        ${model.you ? `<div class="rounded-md border border-stone-300 bg-white/70 px-3 py-2 text-sm">
          <b>${escapeHtml(model.you.name)}</b> · ${roleLabel(model.you.role)} · ${model.you.chips} 筹码
        </div>` : ''}
      </header>
      ${model.error ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(model.error)}</div>` : ''}
      ${content}
    </div>
  `;
}

function render() {
  if (!model.joined) {
    pageShell(`
      <section class="paper-panel mx-auto mt-8 w-full max-w-md rounded-lg p-5">
        <div class="mb-5">
          <h2 class="text-xl font-bold">进入房间</h2>
          <p class="mt-1 text-sm text-stone-600">部署到 Render/Railway 后，大家打开同一个网址，输入相同房间号即可进入。</p>
        </div>
        <form id="joinForm" class="space-y-4">
          <label class="block text-sm font-semibold">昵称
            <input name="name" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-3 outline-none focus:border-red-700" placeholder="例如：阿强" value="${escapeHtml(model.lastName)}" required />
          </label>
          <label class="block text-sm font-semibold">房间号
            <input name="room" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-3 outline-none focus:border-red-700" placeholder="例如：8888" value="${escapeHtml(model.lastRoomCode)}" required />
          </label>
          <button class="w-full rounded-md bg-stone-900 px-4 py-3 font-bold text-white" type="submit">${model.connected ? '进入中...' : '进入房间'}</button>
        </form>
      </section>
    `);
    $('#joinForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      connect(data.get('name'), data.get('room'));
    });
    return;
  }

  pageShell(`
    <nav class="grid grid-cols-3 gap-2 rounded-lg bg-white/70 p-1 text-sm font-bold sm:max-w-md">
      ${tabButton('chess', '象棋')}
      ${tabButton('casino', '娱乐桌')}
      ${tabButton('poker', '德州')}
      ${tabButton('gomoku', '五子棋')}
      ${tabButton('chat', '聊天')}
    </nav>
    <section class="app-grid grid gap-4 lg:items-start">
      <div>${model.tab === 'chess' ? renderChess() : model.tab === 'casino' ? renderCasino() : model.tab === 'poker' ? renderPoker() : model.tab === 'gomoku' ? renderGomoku() : renderChat()}</div>
      <aside class="paper-panel rounded-lg p-4">${renderSidePanel()}</aside>
    </section>
    ${renderWinCelebration()}
  `);
  bindCommon();
  if (model.tab === 'chess') bindChess();
  if (model.tab === 'casino') bindCasino();
  if (model.tab === 'poker') bindPoker();
  if (model.tab === 'gomoku') bindGomoku();
  if (model.tab === 'chat') bindChat();
  bindCelebration();
}

function tabButton(tab, label) {
  return `<button data-tab="${tab}" class="rounded-md px-4 py-2 ${model.tab === tab ? 'tab-active' : 'text-stone-700'}">${label}</button>`;
}

function adviceLevelOption(value, label) {
  return `<option value="${value}" ${model.chessAdviceLevel === value ? 'selected' : ''}>${label}</option>`;
}

function bindCommon() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      model.tab = button.dataset.tab;
      render();
    });
  });
  bindAdminPanel();
}

function roleLabel(role) {
  return { red: '红方', black: '黑方', spectator: '观战' }[role] || role;
}

function renderChess() {
  const game = model.state.chess.state;
  const status = game.winner ? `${roleLabel(game.winner)}胜，将死` : game.status === 'check' ? `${roleLabel(game.turn)}被将军` : `轮到${roleLabel(game.turn)}`;
  const notice = model.state.chess.notice || '';
  const hint = model.chessHint || ChessHints.turnHint(game, model.you.role);
  const engineControls = model.you.isAdmin ? `
          <select id="adviceLevel" class="rounded-md border border-amber-300 bg-white px-2 py-2 text-sm font-bold text-stone-900">
            ${adviceLevelOption('amateur', '业余高手')}
            ${adviceLevelOption('city', '市级棋手')}
            ${adviceLevelOption('top', '软件顶尖')}
          </select>
          <button data-action="advice" class="rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-sm font-bold text-stone-900">${model.chessAdviceThinking ? '引擎思考中' : '引擎提示'}</button>` : '';
  return `
    <section class="paper-panel rounded-lg p-3 sm:p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-black">中国象棋</h2>
          <p class="text-sm text-stone-600">${status} · 你是${roleLabel(model.you.role)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${engineControls}
          <button data-action="voice" class="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">${model.soundUnlocked ? '语音已开启' : '开启语音'}</button>
          <button data-action="undo" class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold">悔棋</button>
          <button data-action="reset" class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold">重置</button>
          <button data-action="resign" class="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">认输</button>
        </div>
      </div>
      ${notice ? `<div class="chess-notice mb-3" role="status">${escapeHtml(notice)}</div>` : ''}
      ${renderPending()}
      <div class="flex justify-center">${renderBoard(game)}</div>
      <div class="chess-hint mt-3" role="status">${escapeHtml(hint)}</div>
    </section>
  `;
}

function renderPending() {
  const pendingUndo = model.state.chess.pendingUndo;
  const pendingReset = model.state.chess.pendingReset;
  const pending = pendingUndo || pendingReset;
  if (!pending || pending.from === model.you.role) return '';
  const type = pendingUndo ? '悔棋' : '重置棋局';
  const acceptType = pendingUndo ? 'undoResponse' : 'resetResponse';
  return `
    <div class="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
      ${escapeHtml(pending.name)} 申请${type}
      <button data-response="${acceptType}" data-accept="true" class="ml-2 rounded bg-stone-900 px-2 py-1 text-white">同意</button>
      <button data-response="${acceptType}" data-accept="false" class="ml-1 rounded border border-stone-300 bg-white px-2 py-1">拒绝</button>
    </div>
  `;
}

function renderBoard(game) {
  const viewRole = model.you.role === 'black' ? 'black' : 'red';
  const lines = [];
  for (let i = 0; i < 10; i += 1) lines.push(`<span class="board-line-h" style="top:${(i / 9) * 100}%"></span>`);
  for (let i = 0; i < 9; i += 1) lines.push(`<span class="board-line-v" style="left:${(i / 8) * 100}%"></span>`);
  const pieces = [];
  game.board.forEach((row, y) => row.forEach((piece, x) => {
    if (!piece) return;
    const view = BoardView.toView({ x, y }, viewRole);
    const selected = model.selected && model.selected.x === x && model.selected.y === y;
    pieces.push(`<button class="piece ${piece.color} ${selected ? 'selected' : ''}" draggable="true" data-x="${x}" data-y="${y}" style="left:${posX(view.x)}%;top:${posY(view.y)}%">${pieceNames[piece.color][piece.type]}</button>`);
  }));
  const dots = model.legalMoves.map((pos) => {
    const view = BoardView.toView(pos, viewRole);
    return `<button class="dot" data-to-x="${pos.x}" data-to-y="${pos.y}" style="left:${posX(view.x)}%;top:${posY(view.y)}%"></button>`;
  });
  const adviceMarkers = [];
  const lastMove = game.moveHistory?.[game.moveHistory.length - 1];
  if (lastMove) {
    const from = BoardView.toView(lastMove.from, viewRole);
    const to = BoardView.toView(lastMove.to, viewRole);
    adviceMarkers.push(`<span class="last-move-marker last-from" style="left:${posX(from.x)}%;top:${posY(from.y)}%"></span>`);
    adviceMarkers.push(`<span class="last-move-marker last-to" style="left:${posX(to.x)}%;top:${posY(to.y)}%"></span>`);
  }
  if (model.chessAdvice) {
    const from = BoardView.toView(model.chessAdvice.from, viewRole);
    const to = BoardView.toView(model.chessAdvice.to, viewRole);
    adviceMarkers.push(`<span class="advice-marker advice-from" style="left:${posX(from.x)}%;top:${posY(from.y)}%"></span>`);
    adviceMarkers.push(`<span class="advice-marker advice-to" style="left:${posX(to.x)}%;top:${posY(to.y)}%"></span>`);
  }
  return `
    <div id="board" class="board-wrap">
      <div class="board-lines">${lines.join('')}</div>
      <div class="river"><span>楚河</span><span>汉界</span></div>
      ${dots.join('')}
      ${adviceMarkers.join('')}
      ${pieces.join('')}
    </div>
  `;
}

function posX(x) {
  return 6.25 + (x / 8) * 87.5;
}

function posY(y) {
  return 5 + (y / 9) * 90;
}

function bindChess() {
  document.querySelectorAll('.piece').forEach((piece) => {
    piece.addEventListener('click', () => selectPiece(Number(piece.dataset.x), Number(piece.dataset.y)));
    piece.addEventListener('dragstart', (event) => {
      model.dragFrom = { x: Number(piece.dataset.x), y: Number(piece.dataset.y) };
      event.dataTransfer.setData('text/plain', JSON.stringify(model.dragFrom));
    });
  });
  document.querySelectorAll('.dot').forEach((dot) => {
    dot.addEventListener('click', () => sendMove({ x: Number(dot.dataset.toX), y: Number(dot.dataset.toY) }));
  });
  const board = $('#board');
  board.addEventListener('dragover', (event) => event.preventDefault());
  board.addEventListener('drop', (event) => {
    event.preventDefault();
    const rect = board.getBoundingClientRect();
    const viewRole = model.you.role === 'black' ? 'black' : 'red';
    const to = BoardView.fromView(boardPoint(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height), viewRole);
    if (model.dragFrom) {
      send({ type: 'chessMove', from: model.dragFrom, to });
      model.dragFrom = null;
    }
  });
  const levelSelect = $('#adviceLevel');
  if (levelSelect) {
    levelSelect.addEventListener('change', () => {
      model.chessAdviceLevel = levelSelect.value;
      localStorage.setItem('h5-games-chess-advice-level', model.chessAdviceLevel);
      model.chessAdvice = null;
      model.chessHint = '已切换高手提示档位';
      render();
    });
  }
  const adviceButton = document.querySelector('[data-action="advice"]');
  if (adviceButton) adviceButton.addEventListener('click', showChessAdvice);
  document.querySelector('[data-action="voice"]').addEventListener('click', enableVoice);
  document.querySelector('[data-action="undo"]').addEventListener('click', () => send({ type: 'undoRequest' }));
  document.querySelector('[data-action="reset"]').addEventListener('click', () => send({ type: 'resetRequest' }));
  document.querySelector('[data-action="resign"]').addEventListener('click', () => send({ type: 'chessResign' }));
  document.querySelectorAll('[data-response]').forEach((button) => {
    button.addEventListener('click', () => send({ type: button.dataset.response, accept: button.dataset.accept === 'true' }));
  });
}

function showChessAdvice() {
  const game = model.state.chess.state;
  if (!model.you.isAdmin) {
    model.chessAdvice = null;
    model.chessHint = '只有管理员可以使用真引擎提示';
    render();
    return;
  }
  if (model.you.role !== game.turn) {
    model.chessAdvice = null;
    model.chessHint = '还没轮到你，提示会在你走棋时可用';
    render();
    return;
  }
  model.chessAdvice = null;
  model.chessAdviceThinking = true;
  model.chessHint = `${adviceLevelName(model.chessAdviceLevel)}引擎思考中...`;
  render();
  send({ type: 'chessEngineAdvice', level: model.chessAdviceLevel, pin: model.adminPin });
}

function adviceLevelName(level) {
  return { amateur: '业余高手', city: '市级棋手', top: '软件顶尖' }[level] || '市级棋手';
}

function applyChessAdvice(advice) {
  model.selected = advice.from;
  model.legalMoves = [advice.to];
  model.chessAdvice = advice;
  const source = advice.source === 'pikafish' ? '皮卡鱼引擎' : '普通本地提示';
  const note = advice.engineAvailable ? '真引擎' : '未检测到Pikafish，已回退';
  model.chessHint = `${source}：${advice.uci || ''}（${note}），选中高亮棋子，走到金色圆点位置`;
}

function selectPiece(x, y) {
  const game = model.state.chess.state;
  const piece = game.board[y][x];
  model.chessAdvice = null;
  if (model.selected && model.legalMoves.some((move) => move.x === x && move.y === y)) {
    sendMove({ x, y });
    return;
  }
  if (!piece) {
    model.chessHint = '请点击自己的棋子开始走棋';
    render();
    return;
  }
  if (piece.color !== model.you.role) {
    model.chessHint = `这是${roleLabel(piece.color)}棋子，请选择自己的棋子`;
    render();
    return;
  }
  if (piece.color !== game.turn) {
    model.chessHint = ChessHints.turnHint(game, model.you.role);
    render();
    return;
  }
  model.selected = { x, y };
  model.legalMoves = ChessCore.getLegalMoves(game, model.selected);
  model.chessHint = ChessHints.selectionHint(model.legalMoves.length);
  render();
}

function sendMove(to) {
  if (!model.selected) return;
  send({ type: 'chessMove', from: model.selected, to });
}

function boardPoint(px, py, width, height) {
  const innerX = Math.min(Math.max((px / width - 0.0625) / 0.875, 0), 1);
  const innerY = Math.min(Math.max((py / height - 0.05) / 0.9, 0), 1);
  return { x: Math.round(innerX * 8), y: Math.round(innerY * 9) };
}

function renderCasino() {
  const round = model.state.baccarat.lastRound;
  return `
    <section class="grid gap-4">
      ${renderSlotMachine()}
      ${renderCasinoLogPanel()}
      <div class="paper-panel rounded-lg p-4">
        <h2 class="mb-3 text-lg font-black">虚拟百家乐</h2>
        <div class="mb-3 grid grid-cols-3 gap-2">
          ${['player', 'banker', 'tie'].map((side) => `<button data-baccarat="${side}" class="rounded-md border border-stone-300 bg-white px-3 py-3 font-bold">${sideNames[side]}</button>`).join('')}
        </div>
        <div class="mb-3 flex gap-2">
          <input id="baccaratAmount" type="number" min="1" max="200" value="${model.baccaratAmount}" class="w-28 rounded-md border border-stone-300 px-3 py-2" />
          <button id="baccaratDeal" class="rounded-md bg-red-800 px-4 py-2 font-bold text-white">开牌</button>
        </div>
        ${round ? renderBaccaratRound(round) : '<p class="text-sm text-stone-600">下注后点击开牌，全部为虚拟筹码娱乐。</p>'}
      </div>
    </section>
  `;
}

function renderCasinoLogPanel() {
  const logs = model.state.casinoLog.slice().reverse();
  return `
    <div class="paper-panel rounded-lg p-4">
      <h2 class="mb-3 text-lg font-black">娱乐记录</h2>
      <div class="log-scroll max-h-44 overflow-auto text-sm">${logs.map((item) => `<p class="mb-2 rounded-md bg-white/70 p-2">${escapeHtml(item.text)}</p>`).join('') || '<p class="text-stone-500">暂无记录。</p>'}</div>
    </div>
  `;
}

function renderSlotMachine() {
  const last = model.state.lastSlot;
  const symbols = model.slotSpinning ? ['财', '龙', '福', '喜', '禄'] : last?.symbols || ['福', '禄', '寿', '喜', '财'];
  const isWin = last && last.payout > 0 && !model.slotSpinning;
  const isFiveBlessings = last?.bonusTriggered && !model.slotSpinning;
  const inBonus = (model.you?.bonusSpins || 0) > 0;
  return `
    <div class="slot-cabinet ${model.slotSpinning ? 'is-spinning' : ''} ${isWin ? 'is-win' : ''} ${isFiveBlessings ? 'is-five-blessing' : ''} ${inBonus ? 'bonus-live' : ''}">
      <div class="slot-bulbs">${Array.from({ length: 34 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}</div>
      <div class="slot-top">
        <span class="slot-kicker">VIRTUAL CHIPS ONLY</span>
        <h2>五福金龙机</h2>
        <p>${inBonus ? `福气奖励模式 · 剩余 ${model.you.bonusSpins} 次免费转` : '下注 10 分为一注 · 凑齐五福进奖励模式'}</p>
        <div class="slot-jackpot">福气池 <b>88,888</b></div>
      </div>
      <div class="slot-screen">
        <div class="slot-reels slot-reels-five">
          ${symbols.map((symbol, index) => `
            <div class="slot-reel reel-${index + 1}">
              <div class="slot-strip">
                ${['福', '禄', '寿', '喜', '财', '龙', symbol].map((item) => `<span>${item}</span>`).join('')}
              </div>
              ${symbol === '福' && !model.slotSpinning ? '<em class="blessing-glow"></em>' : ''}
            </div>
          `).join('')}
        </div>
        <div class="slot-payline"></div>
        ${isFiveBlessings ? '<div class="slot-win-burst five">五福临门</div>' : isWin ? '<div class="slot-win-burst">WIN</div>' : ''}
      </div>
      <div class="slot-controls">
        <div class="slot-bet-picks" role="group" aria-label="下注档位">
          ${[10, 20, 50].map((value) => `<button type="button" class="slot-bet-pick ${model.slotBet === value ? 'active' : ''}" data-slot-bet="${value}">${value} 分</button>`).join('')}
        </div>
        <button id="slotSpin" ${model.slotSpinning ? 'disabled' : ''}>${model.slotSpinning ? '滚动中' : inBonus ? '免费转' : '开转'}</button>
      </div>
      <div class="slot-result">
        ${last ? `
          <b>${escapeHtml(last.playerName)}</b> 摇出 ${last.symbols.join(' ')}
          <span>${typeof last.blessingCount === 'number' ? `${last.blessingCount} 个福 · ` : ''}${last.freeSpin ? '奖励免费转' : `下注 ${last.bet} 分`} · 获得 ${last.payout} 分 · 剩余 ${last.chips}${last.bonusSpins ? ` · 免费转 ${last.bonusSpins} 次` : ''}${last.bonusTotal ? ` · 奖励合计 ${last.bonusTotal}` : ''}</span>
        ` : '等待第一局，祝你手气漂亮。'}
      </div>
      <div class="coin-rain">${isWin || isFiveBlessings ? Array.from({ length: isFiveBlessings ? 36 : 18 }, (_, index) => `<i style="--d:${index % 6};--x:${(index * 17) % 100}%"></i>`).join('') : ''}</div>
    </div>
  `;
}

function slotKey(slot) {
  if (!slot) return '';
  return `${slot.playerId}-${slot.symbols.join('')}-${slot.payout}-${slot.chips}-${slot.freeSpin ? 'free' : 'paid'}`;
}

function renderWinCelebration() {
  const slot = model.state?.lastSlot;
  if (!slot || model.tab !== 'casino' || model.slotSpinning || slot.payout <= 0) return '';
  const key = slotKey(slot);
  if (model.skippedCelebrationKey === key) return '';
  const five = slot.bonusTriggered;
  const title = five ? '五福临门' : slot.blessingCount >= 4 ? '大奖降临' : '恭喜中奖';
  return `
    <div class="win-celebration ${five ? 'five-blessing' : ''}" data-celebration-key="${key}">
      <div class="win-stage">
        <div class="win-rays"></div>
        <div class="win-title">${title}</div>
        <div class="win-symbols">${slot.symbols.map((symbol) => `<span>${symbol}</span>`).join('')}</div>
        <div class="win-score">获得 <b>${slot.payout}</b> 虚拟分</div>
        <div class="win-sub">${escapeHtml(slot.playerName)} · ${slot.blessingCount} 个福${five ? ' · 奖励模式开启' : ''}</div>
        <div class="win-confetti">${Array.from({ length: 46 }, (_, index) => `<i style="--x:${(index * 23) % 100}%;--d:${index % 9};--r:${(index * 37) % 180}deg"></i>`).join('')}</div>
      </div>
      <button id="skipCelebration" class="skip-celebration">跳过</button>
    </div>
  `;
}

function bindCelebration() {
  const button = $('#skipCelebration');
  if (!button) return;
  button.addEventListener('click', () => {
    model.skippedCelebrationKey = button.closest('.win-celebration').dataset.celebrationKey;
    render();
  });
}

function renderBaccaratRound(round) {
  return `
    <div class="grid gap-2 rounded-md bg-white/70 p-3 text-sm">
      <div><b>闲：</b>${round.player.cards.map(CasinoCore.cardLabel).join('、')}，点数 ${round.player.total}</div>
      <div><b>庄：</b>${round.banker.cards.map(CasinoCore.cardLabel).join('、')}，点数 ${round.banker.total}</div>
      <div><b>结果：</b>${sideNames[round.winner]}</div>
    </div>
  `;
}

function bindCasino() {
  document.querySelectorAll('[data-slot-bet]').forEach((button) => {
    button.addEventListener('click', () => {
      model.slotBet = Number(button.dataset.slotBet);
      render();
    });
  });
  $('#slotSpin').addEventListener('click', () => {
    if (model.slotSpinning) return;
    model.slotSpinning = true;
    model.slotStartedAt = Date.now();
    const bet = model.slotBet;
    render();
    setTimeout(() => send({ type: 'slotSpin', bet }), 850);
    setTimeout(() => {
      model.slotSpinning = false;
      render();
    }, 1800);
  });
  document.querySelectorAll('[data-baccarat]').forEach((button) => {
    button.addEventListener('click', () => {
      model.baccaratAmount = Number($('#baccaratAmount').value) || 20;
      send({ type: 'baccaratBet', side: button.dataset.baccarat, amount: model.baccaratAmount });
    });
  });
  $('#baccaratDeal').addEventListener('click', () => send({ type: 'baccaratDeal' }));
}

function renderPoker() {
  const table = model.state.poker;
  const realPlayerCount = (model.state.users || []).length;
  const pureFriendDisabled = realPlayerCount < 2;
  const pureFriendAttrs = pureFriendDisabled ? 'disabled title="等第二个人进房间后可开纯好友局"' : '';
  const pureFriendClass = pureFriendDisabled ? 'opacity-50' : '';
  if (!table) {
    return `
      <section class="poker-table rounded-lg p-4">
        <div class="poker-felt-inner">
          <h2 class="text-xl font-black text-white">德州扑克好友桌</h2>
          <p class="mt-2 text-sm text-emerald-100">两个人进同一房间可开纯好友局，一个人也可以加机器人练习。只使用虚拟分。</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <button data-poker-start data-bot-count="0" ${pureFriendAttrs} class="rounded-md bg-amber-300 px-5 py-3 font-black text-stone-900 ${pureFriendClass}">纯好友局</button>
            <button data-poker-start data-bot-count="5" class="rounded-md border border-emerald-200 bg-emerald-900/70 px-5 py-3 font-black text-white">加机器人</button>
          </div>
        </div>
      </section>
    `;
  }
  const active = table.seats.find((seat) => seat.id === table.activeSeatId);
  const mySeat = table.seats.find((seat) => seat.id === model.you.id);
  const toCall = mySeat ? Math.max(0, table.currentBet - mySeat.roundBet) : 0;
  return `
    <section class="poker-table rounded-lg p-3 sm:p-4">
      <div class="poker-felt-inner">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
          <div>
            <h2 class="text-xl font-black">德州扑克</h2>
            <p class="text-sm text-emerald-100">${pokerStageName(table.stage)} · 底池 ${table.pot} · 当前行动：${active ? escapeHtml(active.name) : '无'}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button data-poker-start data-bot-count="0" ${pureFriendAttrs} class="rounded-md bg-amber-300 px-4 py-2 font-black text-stone-900 ${pureFriendClass}">纯好友局</button>
            <button data-poker-start data-bot-count="5" class="rounded-md border border-emerald-200 bg-emerald-900/70 px-4 py-2 font-black text-white">加机器人</button>
          </div>
        </div>
        <div class="poker-community">${renderPokerCards(table.community)}</div>
        <div class="poker-seats">${table.seats.map(renderPokerSeat).join('')}</div>
        ${table.lastResult ? renderPokerResult(table.lastResult) : ''}
        <div class="poker-actions">
          <button data-poker-action="fold">弃牌</button>
          <button data-poker-action="call">${toCall ? `跟注 ${toCall}` : '看牌'}</button>
          <button data-poker-action="raise" data-amount="${table.currentBet + table.bigBlind}">加注到 ${table.currentBet + table.bigBlind}</button>
          <button data-poker-action="allIn">全下</button>
        </div>
      </div>
    </section>
  `;
}

function pokerStageName(stage) {
  return { waiting: '等待', preflop: '翻牌前', flop: '翻牌圈', turn: '转牌圈', river: '河牌圈', showdown: '摊牌' }[stage] || stage;
}

function renderPokerCards(cards) {
  const shown = cards && cards.length ? cards : [null, null, null, null, null];
  return shown.map((card) => `<span class="poker-card ${card ? suitClass(card.suit) : 'empty'}">${card ? pokerCardText(card) : ''}</span>`).join('');
}

function pokerCardText(card) {
  const ranks = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' };
  const suits = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return `${ranks[card.rank] || card.rank}${suits[card.suit] || card.suit}`;
}

function suitClass(suit) {
  return suit === 'h' || suit === 'd' ? 'red-suit' : 'black-suit';
}

function renderPokerSeat(seat) {
  const active = seat.id === model.state.poker.activeSeatId;
  return `
    <div class="poker-seat ${active ? 'active' : ''} ${seat.folded ? 'folded' : ''}">
      <div class="flex items-center justify-between gap-2">
        <b>${escapeHtml(seat.name)}${seat.bot ? ' · 机器人' : ''}</b>
        <span>${seat.chips}</span>
      </div>
      <div class="mt-2 flex gap-1">${renderPokerCards(seat.cards)}</div>
      <div class="mt-2 text-xs text-emerald-100">${seat.folded ? '已弃牌' : seat.allIn ? '全下' : `本轮 ${seat.roundBet}`}</div>
    </div>
  `;
}

function renderPokerResult(result) {
  return `
    <div class="poker-result">
      <b>本局结果：</b>
      ${result.winners.map((winner) => `${escapeHtml(winner.name)} 赢 ${winner.amount}（${winner.handName}）`).join('，')}
    </div>
  `;
}

function bindPoker() {
  document.querySelectorAll('[data-poker-start]').forEach((button) => {
    button.addEventListener('click', () => send({ type: 'pokerStart', botCount: Number(button.dataset.botCount) }));
  });
  document.querySelectorAll('[data-poker-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.pokerAction;
      send({ type: 'pokerAction', action, amount: Number(button.dataset.amount || 0) });
    });
  });
}

function renderGomoku() {
  const game = model.state.gomoku;
  const users = model.state.users || [];
  const black = users[0];
  const white = users[1];
  const myColor = model.you.id === black?.id ? 'black' : model.you.id === white?.id ? 'white' : 'spectator';
  const status = game.winner ? `${gomokuColorName(game.winner)}胜利` : game.draw ? '和棋' : `轮到${gomokuColorName(game.turn)}`;
  const helper = myColor === 'spectator' ? '你正在观战' : game.winner || game.draw ? '本局已结束，可申请重开' : myColor === game.turn ? '轮到你落子' : '等待对方落子';
  return `
    <section class="paper-panel rounded-lg p-3 sm:p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-black">五子棋</h2>
          <p class="text-sm text-stone-600">${status} · 你是${myColor === 'spectator' ? '观战' : gomokuColorName(myColor)}</p>
          <p class="text-xs text-stone-500">黑棋：${escapeHtml(black?.name || '等待')} · 白棋：${escapeHtml(white?.name || '等待')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-gomoku-action="undo" class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold">悔一步</button>
          <button data-gomoku-action="reset" class="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold">重开</button>
        </div>
      </div>
      ${renderGomokuPending(game, myColor)}
      <div class="mb-3 rounded-md bg-white/70 px-3 py-2 text-sm text-stone-700">${escapeHtml(helper)}</div>
      <div class="flex justify-center">${renderGomokuBoard(game, myColor)}</div>
    </section>
  `;
}

function renderGomokuPending(game, myColor) {
  const pendingUndo = game.pendingUndo;
  const pendingReset = game.pendingReset;
  const pending = pendingUndo || pendingReset;
  if (!pending || pending.from === myColor) return '';
  const type = pendingUndo ? '悔棋' : '重开';
  const response = pendingUndo ? 'gomokuUndoResponse' : 'gomokuResetResponse';
  return `
    <div class="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
      ${escapeHtml(pending.name)} 申请五子棋${type}
      <button data-gomoku-response="${response}" data-accept="true" class="ml-2 rounded bg-stone-900 px-2 py-1 text-white">同意</button>
      <button data-gomoku-response="${response}" data-accept="false" class="ml-1 rounded border border-stone-300 bg-white px-2 py-1">拒绝</button>
    </div>
  `;
}

function gomokuColorName(color) {
  return { black: '黑棋', white: '白棋' }[color] || color;
}

function renderGomokuBoard(game, myColor) {
  return `
    <div class="gomoku-board" data-my-color="${myColor}">
      ${game.board.map((row, y) => row.map((stone, x) => `
        <button class="gomoku-point ${stone || ''} ${game.lastMove?.x === x && game.lastMove?.y === y ? 'last' : ''}" data-x="${x}" data-y="${y}" aria-label="${x},${y}">
          ${stone ? '<span></span>' : ''}
        </button>
      `).join('')).join('')}
    </div>
  `;
}

function bindGomoku() {
  document.querySelector('[data-gomoku-action="undo"]')?.addEventListener('click', () => send({ type: 'gomokuUndoRequest' }));
  document.querySelector('[data-gomoku-action="reset"]')?.addEventListener('click', () => send({ type: 'gomokuResetRequest' }));
  document.querySelectorAll('[data-gomoku-response]').forEach((button) => {
    button.addEventListener('click', () => send({ type: button.dataset.gomokuResponse, accept: button.dataset.accept === 'true' }));
  });
  document.querySelectorAll('.gomoku-point').forEach((button) => {
    button.addEventListener('click', () => {
      const game = model.state.gomoku;
      const myColor = document.querySelector('.gomoku-board')?.dataset.myColor;
      if (myColor !== game.turn || game.winner || game.draw) return;
      send({ type: 'gomokuPlace', x: Number(button.dataset.x), y: Number(button.dataset.y) });
    });
  });
}

function renderChat() {
  return `
    <section class="paper-panel rounded-lg p-4">
      <h2 class="mb-3 text-lg font-black">房间聊天</h2>
      <div class="log-scroll mb-3 h-[54vh] overflow-auto rounded-md bg-white/70 p-3">${renderMessages()}</div>
      <form id="chatForm" class="flex gap-2">
        <input name="text" class="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-3" placeholder="说点什么..." />
        <button class="rounded-md bg-stone-900 px-4 py-2 font-bold text-white">发送</button>
      </form>
    </section>
  `;
}

function bindChat() {
  $('#chatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.text;
    send({ type: 'chat', text: input.value });
    input.value = '';
  });
}

function renderMessages() {
  return model.state.chat.map((message) => `
    <p class="mb-2 text-sm ${message.system ? 'text-stone-500' : ''}">
      ${message.system ? '' : `<b>${escapeHtml(message.name)}：</b>`}${escapeHtml(message.text)}
      <span class="text-xs text-stone-400">${message.time || ''}</span>
    </p>
  `).join('') || '<p class="text-sm text-stone-500">还没有聊天消息。</p>';
}

function renderSidePanel() {
  const remaining = model.state.chess.remaining;
  return `
    <div class="mb-4">
      <h3 class="mb-2 font-black">房间 ${escapeHtml(model.state.code)}</h3>
      <div class="space-y-2 text-sm">${model.state.users.map((user) => `
        <div class="flex items-center justify-between rounded-md bg-white/70 px-3 py-2">
          <span>${escapeHtml(user.name)} · ${roleLabel(user.role)}</span><b>${user.chips}</b>
        </div>`).join('')}</div>
    </div>
    <div class="mb-4">
      <h3 class="mb-2 font-black">剩余棋子</h3>
      ${['red', 'black'].map((color) => `<div class="mb-2 rounded-md bg-white/70 p-2 text-sm">
        <b>${roleLabel(color)}</b>
        <div class="mt-1 flex flex-wrap gap-1">${typeOrder.map((type) => `<span class="rounded border border-stone-200 px-2 py-1">${pieceNames[color][type]} ${remaining[color][type]}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="rounded-md bg-white/70 p-3 text-sm">
      <h3 class="mb-2 font-black">管理员调分</h3>
      <input id="adminPin" class="mb-2 w-full rounded border border-stone-300 px-2 py-2" type="password" placeholder="管理员密码" value="${escapeHtml(model.adminPin)}" />
      <button data-admin-login class="mb-2 w-full rounded bg-stone-900 px-2 py-2 font-bold text-white">${model.you.isAdmin ? '管理员已登录' : '登录管理员'}</button>
      <p class="mb-2 text-xs ${model.you.isAdmin ? 'text-emerald-700' : 'text-stone-500'}">${model.you.isAdmin ? '真引擎提示仅你可见。' : '登录后才显示象棋真引擎提示。'}</p>
      <select id="adminTarget" class="mb-2 w-full rounded border border-stone-300 px-2 py-2">
        ${model.state.users.map((user) => `<option value="${escapeHtml(user.deviceId)}">${escapeHtml(user.name)} · ${user.chips}</option>`).join('')}
      </select>
      <input id="adminAmount" class="mb-2 w-full rounded border border-stone-300 px-2 py-2" type="number" min="1" value="${model.adminAmount}" />
      <div class="grid grid-cols-2 gap-2">
        <button data-admin-adjust="add" class="rounded bg-emerald-700 px-2 py-2 font-bold text-white">增加</button>
        <button data-admin-adjust="sub" class="rounded bg-red-700 px-2 py-2 font-bold text-white">减少</button>
      </div>
    </div>
  `;
}

function bindAdminPanel() {
  const pinInput = $('#adminPin');
  const amountInput = $('#adminAmount');
  const targetInput = $('#adminTarget');
  if (pinInput) pinInput.addEventListener('input', () => { model.adminPin = pinInput.value; });
  if (amountInput) amountInput.addEventListener('input', () => { model.adminAmount = Number(amountInput.value) || 1; });
  const loginButton = document.querySelector('[data-admin-login]');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      model.adminPin = pinInput?.value || model.adminPin;
      send({ type: 'adminLogin', pin: model.adminPin });
    });
  }
  document.querySelectorAll('[data-admin-adjust]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!targetInput) return;
      const amount = Math.max(1, Number(amountInput.value || model.adminAmount || 1));
      const delta = button.dataset.adminAdjust === 'add' ? amount : -amount;
      model.adminPin = pinInput?.value || model.adminPin;
      model.adminAmount = amount;
      send({ type: 'adminAdjust', pin: model.adminPin, deviceId: targetInput.value, delta });
    });
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

document.addEventListener('pointerdown', unlockSound, { once: true });

render();
