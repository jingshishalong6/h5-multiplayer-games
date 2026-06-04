const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chess = require('./public/src/chess.js');
const casino = require('./public/src/casino.js');
const poker = require('./public/src/poker.js');
const accounts = require('./public/src/accounts.js');
const gomoku = require('./public/src/gomoku.js');
const engineAdvisor = require('./engine-advisor.js');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const rooms = new Map();
const accountStore = accounts.createAccountStore({ adminPin: process.env.ADMIN_PIN || '1234' });
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function normalizeRoomCode(code) {
  return String(code || '大厅').trim().slice(0, 20) || '大厅';
}

function normalizeName(name) {
  return String(name || '同事').trim().slice(0, 16) || '同事';
}

function createRoom(code) {
  return {
    code,
    clients: new Map(),
    seatOrder: [],
    chess: chess.createInitialState(),
    chessNotice: null,
    pendingUndo: null,
    pendingReset: null,
    chat: [],
    casinoLog: [],
    lastSlot: null,
    baccarat: { betsOpen: true, bets: {}, lastRound: null },
    poker: null,
    pokerBotCount: 5,
    gomoku: gomoku.createInitialState(),
    gomokuPendingUndo: null,
    gomokuPendingReset: null
  };
}

function getRoom(code) {
  const key = normalizeRoomCode(code);
  if (!rooms.has(key)) rooms.set(key, createRoom(key));
  const room = rooms.get(key);
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
  return room;
}

function assignSeats(room) {
  const clients = [...room.clients.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  clients.forEach((client) => {
    if (room.seatOrder.includes(client.deviceId)) return;
    const openSeat = [0, 1].find((index) => !room.seatOrder[index]);
    if (typeof openSeat === 'number') room.seatOrder[openSeat] = client.deviceId;
  });
  clients.forEach((client) => {
    const index = room.seatOrder.indexOf(client.deviceId);
    client.role = index === 0 ? 'red' : index === 1 ? 'black' : 'spectator';
  });
}

function publicClient(client, includePrivate = false) {
  const data = {
    id: client.id,
    deviceId: client.deviceId,
    name: client.name,
    role: client.role,
    chips: client.chips,
    bonusSpins: client.bonusSpins || 0,
    bonusTotal: client.bonusTotal || 0
  };
  if (includePrivate) data.isAdmin = !!client.isAdmin;
  return data;
}

function publicState(room, viewerId) {
  return {
    code: room.code,
    users: [...room.clients.values()].map(publicClient),
    chess: {
      state: room.chess,
      remaining: chess.remainingPieces(room.chess),
      notice: room.chessNotice,
      pendingUndo: room.pendingUndo,
      pendingReset: room.pendingReset
    },
    chat: room.chat.slice(-80),
    casinoLog: room.casinoLog.slice(-30),
    lastSlot: room.lastSlot,
    baccarat: room.baccarat,
    poker: poker.publicHoldemState(room.poker, viewerId),
    gomoku: {
      ...room.gomoku,
      pendingUndo: room.gomokuPendingUndo,
      pendingReset: room.gomokuPendingReset
    }
  };
}

function broadcast(room) {
  room.clients.forEach((client) => {
    const state = publicState(room, client.id);
    send(client.ws, { type: 'state', you: publicClient(client, true), state });
  });
}

function systemMessage(room, text) {
  room.chat.push({ id: Date.now() + Math.random(), system: true, text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
  broadcast(room);
}

function chessErrorMessage(reason) {
  return {
    'not your turn': '还没轮到你落子',
    'illegal move': '这个位置不能走',
    'illegal self check': '不能这样走，会让自己的将帅被将军',
    'out of bounds': '落点不在棋盘内',
    'game over': '棋局已经结束'
  }[reason] || reason || '不能这样走';
}

function addCasinoLog(room, text) {
  room.casinoLog.push({ id: Date.now() + Math.random(), text, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
}

function persistClientBalance(client) {
  if (!client || !client.deviceId) return;
  client.account = accountStore.setBalance(client.deviceId, client.chips);
  client.chips = client.account.balance;
}

function syncRoomClientsFromAccounts(room) {
  room.clients.forEach((client) => {
    client.account = accountStore.getOrCreate(client.deviceId, client.name);
    client.chips = client.account.balance;
  });
}

function handleJoin(ws, payload) {
  const room = getRoom(payload.roomCode);
  const deviceId = String(payload.deviceId || `guest-${Math.random().toString(36).slice(2)}`).slice(0, 80);
  const account = accountStore.getOrCreate(deviceId, normalizeName(payload.name));
  room.clients.forEach((existing) => {
    if (existing.deviceId === deviceId && existing.ws !== ws) {
      room.clients.delete(existing.id);
      try { existing.ws.close(); } catch {}
    }
  });
  const client = {
    id: Math.random().toString(36).slice(2, 10),
    deviceId,
    account,
    ws,
    room,
    name: normalizeName(payload.name),
    role: 'spectator',
    chips: account.balance,
    isAdmin: false,
    bonusSpins: 0,
    bonusTotal: 0,
    joinedAt: Date.now() + Math.random()
  };
  ws.clientInfo = client;
  room.clients.set(client.id, client);
  assignSeats(room);
  systemMessage(room, `${client.name} 进入房间`);
  broadcast(room);
}

function requireClient(ws) {
  if (!ws.clientInfo) {
    send(ws, { type: 'error', message: '请先进入房间' });
    return null;
  }
  return ws.clientInfo;
}

function handleMove(client, payload) {
  const room = client.room;
  if (client.role !== room.chess.turn) {
    send(client.ws, { type: 'error', message: '还没轮到你落子' });
    return;
  }
  const result = chess.movePiece(room.chess, payload.from, payload.to);
  if (!result.ok) {
    send(client.ws, { type: 'error', message: chessErrorMessage(result.reason) });
    return;
  }
  room.chess = result.state;
  room.chessNotice = chess.movePrompt(room.chess);
  room.pendingUndo = null;
  room.pendingReset = null;
  broadcast(room);
}

async function handleChessEngineAdvice(client, payload) {
  const room = client.room;
  if (!client.isAdmin && !accountStore.isAdminPin(payload.pin)) {
    send(client.ws, { type: 'chessAdvice', ok: false, message: '只有管理员可以使用真引擎提示' });
    return;
  }
  client.isAdmin = true;
  if (client.role !== room.chess.turn) {
    send(client.ws, { type: 'chessAdvice', ok: false, message: '还没轮到你，不能请求引擎提示' });
    return;
  }
  const state = chess.cloneState(room.chess);
  const level = ['amateur', 'city', 'top'].includes(payload.level) ? payload.level : 'city';
  const movetime = { amateur: 900, city: 1800, top: 3200 }[level];
  const advice = await engineAdvisor.getEngineAdvice(state, client.role, {
    movetime,
    fallback: () => chess.recommendExpertMove(state, client.role, { level })
  });
  if (!advice) {
    send(client.ws, { type: 'chessAdvice', ok: false, message: '当前没有找到可走提示' });
    return;
  }
  send(client.ws, { type: 'chessAdvice', ok: true, advice });
}

function handleAdminLogin(client, payload) {
  client.isAdmin = accountStore.isAdminPin(payload.pin);
  send(client.ws, {
    type: 'adminStatus',
    ok: client.isAdmin,
    isAdmin: client.isAdmin,
    message: client.isAdmin ? '管理员已登录' : '管理员密码不正确'
  });
  broadcast(client.room);
}

function handleChat(client, payload) {
  const text = String(payload.text || '').trim().slice(0, 300);
  if (!text) return;
  client.room.chat.push({
    id: Date.now() + Math.random(),
    userId: client.id,
    name: client.name,
    text,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
  });
  broadcast(client.room);
}

function handleUndoRequest(client) {
  const room = client.room;
  if (!['red', 'black'].includes(client.role)) return;
  room.pendingUndo = { from: client.role, name: client.name };
  systemMessage(room, `${client.name} 申请悔棋`);
}

function handleUndoResponse(client, payload) {
  const room = client.room;
  if (!room.pendingUndo || room.pendingUndo.from === client.role) return;
  if (payload.accept) {
    room.chess = chess.undoLastMove(room.chess);
    room.chessNotice = null;
    systemMessage(room, `${client.name} 同意悔棋`);
  } else {
    systemMessage(room, `${client.name} 拒绝悔棋`);
  }
  room.pendingUndo = null;
  broadcast(room);
}

function handleResetRequest(client) {
  const room = client.room;
  if (!['red', 'black'].includes(client.role)) return;
  room.pendingReset = { from: client.role, name: client.name };
  systemMessage(room, `${client.name} 申请重置棋局`);
}

function handleResetResponse(client, payload) {
  const room = client.room;
  if (!room.pendingReset || room.pendingReset.from === client.role) return;
  if (payload.accept) {
    room.chess = chess.createInitialState();
    room.chessNotice = null;
    systemMessage(room, `${client.name} 同意重置棋局`);
  } else {
    systemMessage(room, `${client.name} 拒绝重置棋局`);
  }
  room.pendingReset = null;
  broadcast(room);
}

function handleSlot(client, payload) {
  const room = client.room;
  const bet = Math.max(1, Math.min(100, Number(payload.bet || 10)));
  const freeSpin = client.bonusSpins > 0;
  const result = casino.resolveSlotSpin({ chips: client.chips, bet, reelCount: 5, freeSpin });
  client.chips = result.chips;
  persistClientBalance(client);
  if (freeSpin) {
    client.bonusSpins -= 1;
    client.bonusTotal += result.payout;
  }
  if (result.bonusTriggered && !freeSpin) {
    client.bonusSpins = 3;
    client.bonusTotal = 0;
  }
  room.lastSlot = {
    playerId: client.id,
    playerName: client.name,
    bonusSpins: client.bonusSpins,
    bonusTotal: client.bonusTotal,
    ...result
  };
  const modeText = freeSpin ? '奖励免费转' : '拉动老虎机';
  const bonusText = result.bonusTriggered ? '，触发五福奖励模式' : '';
  const blessingText = typeof result.blessingCount === 'number' ? `，${result.blessingCount} 个福` : '';
  addCasinoLog(room, `${client.name} ${modeText}：${result.symbols.join(' ')}${blessingText}，${freeSpin ? '免费转' : `下注 ${result.bet} 分`}，获得 ${result.payout} 虚拟分${bonusText}`);
  broadcast(room);
}

function handleBaccaratBet(client, payload) {
  const room = client.room;
  if (!room.baccarat.betsOpen) return;
  const side = ['player', 'banker', 'tie'].includes(payload.side) ? payload.side : 'player';
  const amount = Math.max(1, Math.min(200, Number(payload.amount || 10), client.chips));
  room.baccarat.bets[client.id] = room.baccarat.bets[client.id] || { player: 0, banker: 0, tie: 0 };
  room.baccarat.bets[client.id][side] += amount;
  addCasinoLog(room, `${client.name} 在百家乐下注 ${sideName(side)} ${amount} 虚拟筹码`);
  broadcast(room);
}

function sideName(side) {
  return { player: '闲', banker: '庄', tie: '和' }[side] || side;
}

function handleBaccaratDeal(client) {
  const room = client.room;
  const deck = casino.shuffle(casino.makeDeck());
  const round = casino.resolveBaccaratRound(deck);
  room.clients.forEach((player) => {
    const bets = room.baccarat.bets[player.id] || {};
    if (Object.values(bets).some(Boolean)) {
      const settled = casino.settleBaccaratBets({ chips: player.chips, bets, winner: round.winner });
      player.chips = settled.chips;
      persistClientBalance(player);
    }
  });
  room.baccarat = { betsOpen: true, bets: {}, lastRound: round };
  addCasinoLog(room, `${client.name} 开了一局百家乐，结果：${sideName(round.winner)}`);
  broadcast(room);
}

function roomPokerPlayers(room) {
  return [...room.clients.values()].slice(0, 6).map((client) => ({
    id: client.id,
    name: client.name,
    chips: client.chips,
    bot: false
  }));
}

function syncPokerBalances(room) {
  if (!room.poker) return;
  room.poker.seats.forEach((seat) => {
    if (seat.bot) return;
    const client = room.clients.get(seat.id);
    if (!client) return;
    client.chips = seat.chips;
    persistClientBalance(client);
  });
}

function handlePokerStart(client, payload) {
  const room = client.room;
  const realPlayers = roomPokerPlayers(room);
  const requestedBotCount = payload.botCount ?? poker.defaultBotCount(realPlayers.length);
  const safeBotCount = realPlayers.length < 2 && Number(requestedBotCount) === 0 ? poker.defaultBotCount(realPlayers.length) : requestedBotCount;
  room.pokerBotCount = Math.max(0, Math.min(5, Number(safeBotCount)));
  room.poker = poker.createHoldemTable({
    players: realPlayers,
    botCount: room.pokerBotCount,
    smallBlind: 5,
    bigBlind: 10
  });
  room.poker = poker.runBots(poker.startHand(room.poker));
  syncPokerBalances(room);
  broadcast(room);
}

function handlePokerAction(client, payload) {
  const room = client.room;
  if (!room.poker || room.poker.stage === 'waiting' || room.poker.stage === 'showdown') return;
  room.poker = poker.applyAction(room.poker, client.id, {
    type: payload.action,
    amount: Number(payload.amount || 0)
  });
  room.poker = poker.runBots(room.poker);
  syncPokerBalances(room);
  broadcast(room);
}

function handleAdminAdjust(client, payload) {
  const room = client.room;
  const target = [...room.clients.values()].find((item) => item.deviceId === payload.deviceId || item.id === payload.userId);
  if (!target) {
    send(client.ws, { type: 'error', message: '找不到这个用户' });
    return;
  }
  try {
    if (accountStore.isAdminPin(payload.pin)) client.isAdmin = true;
    const account = accountStore.adjust(target.deviceId, Number(payload.delta || 0), payload.pin);
    target.chips = account.balance;
    target.account = account;
    if (room.poker) {
      const seat = room.poker.seats.find((item) => item.id === target.id && !item.bot);
      if (seat) seat.chips = account.balance;
    }
    systemMessage(room, `管理员调整了 ${target.name} 的虚拟分：${payload.delta > 0 ? '+' : ''}${Number(payload.delta || 0)}，当前 ${account.balance}`);
  } catch {
    send(client.ws, { type: 'error', message: '管理员密码不正确' });
  }
}

function gomokuColorForClient(room, client) {
  const players = [...room.clients.values()].sort((a, b) => a.joinedAt - b.joinedAt).slice(0, 2);
  const index = players.findIndex((item) => item.id === client.id);
  if (index === 0) return 'black';
  if (index === 1) return 'white';
  return 'spectator';
}

function handleGomokuPlace(client, payload) {
  const room = client.room;
  const color = gomokuColorForClient(room, client);
  if (!['black', 'white'].includes(color)) {
    send(client.ws, { type: 'error', message: '你是观战，不能落子' });
    return;
  }
  const result = gomoku.placeStone(room.gomoku, Number(payload.x), Number(payload.y), color);
  if (!result.ok) {
    send(client.ws, { type: 'error', message: result.reason || '不能落在这里' });
    return;
  }
  room.gomoku = result.state;
  room.gomokuPendingUndo = null;
  room.gomokuPendingReset = null;
  broadcast(room);
}

function hasGomokuOpponent(room, client) {
  const color = gomokuColorForClient(room, client);
  return [...room.clients.values()].some((item) => item.id !== client.id && gomokuColorForClient(room, item) !== 'spectator' && gomokuColorForClient(room, item) !== color);
}

function handleGomokuUndoRequest(client) {
  const room = client.room;
  const color = gomokuColorForClient(room, client);
  if (!['black', 'white'].includes(color)) return;
  if (!room.gomoku.moves.length) {
    send(client.ws, { type: 'error', message: '现在还没有可悔的棋' });
    return;
  }
  if (!hasGomokuOpponent(room, client)) {
    room.gomoku = gomoku.undoLastMove(room.gomoku);
    broadcast(room);
    return;
  }
  room.gomokuPendingUndo = { from: color, name: client.name };
  systemMessage(room, `${client.name} 申请五子棋悔棋`);
}

function handleGomokuUndoResponse(client, payload) {
  const room = client.room;
  const color = gomokuColorForClient(room, client);
  if (!room.gomokuPendingUndo || room.gomokuPendingUndo.from === color) return;
  if (payload.accept) {
    room.gomoku = gomoku.undoLastMove(room.gomoku);
    systemMessage(room, `${client.name} 同意五子棋悔棋`);
  } else {
    systemMessage(room, `${client.name} 拒绝五子棋悔棋`);
  }
  room.gomokuPendingUndo = null;
  broadcast(room);
}

function handleGomokuResetRequest(client) {
  const room = client.room;
  const color = gomokuColorForClient(room, client);
  if (!['black', 'white'].includes(color)) return;
  if (!hasGomokuOpponent(room, client)) {
    room.gomoku = gomoku.createInitialState();
    broadcast(room);
    return;
  }
  room.gomokuPendingReset = { from: color, name: client.name };
  systemMessage(room, `${client.name} 申请重开五子棋`);
}

function handleGomokuResetResponse(client, payload) {
  const room = client.room;
  const color = gomokuColorForClient(room, client);
  if (!room.gomokuPendingReset || room.gomokuPendingReset.from === color) return;
  if (payload.accept) {
    room.gomoku = gomoku.createInitialState();
    systemMessage(room, `${client.name} 同意重开五子棋`);
  } else {
    systemMessage(room, `${client.name} 拒绝重开五子棋`);
  }
  room.gomokuPendingReset = null;
  broadcast(room);
}

async function handleMessage(ws, raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    send(ws, { type: 'error', message: '消息格式错误' });
    return;
  }

  if (payload.type === 'join') {
    handleJoin(ws, payload);
    return;
  }

  const client = requireClient(ws);
  if (!client) return;

  const handlers = {
    chat: () => handleChat(client, payload),
    chessMove: () => handleMove(client, payload),
    chessEngineAdvice: () => handleChessEngineAdvice(client, payload),
    undoRequest: () => handleUndoRequest(client),
    undoResponse: () => handleUndoResponse(client, payload),
    resetRequest: () => handleResetRequest(client),
    resetResponse: () => handleResetResponse(client, payload),
    slotSpin: () => handleSlot(client, payload),
    baccaratBet: () => handleBaccaratBet(client, payload),
    baccaratDeal: () => handleBaccaratDeal(client),
    pokerStart: () => handlePokerStart(client, payload),
    pokerAction: () => handlePokerAction(client, payload),
    adminAdjust: () => handleAdminAdjust(client, payload),
    adminLogin: () => handleAdminLogin(client, payload),
    gomokuPlace: () => handleGomokuPlace(client, payload),
    gomokuUndoRequest: () => handleGomokuUndoRequest(client),
    gomokuUndoResponse: () => handleGomokuUndoResponse(client, payload),
    gomokuResetRequest: () => handleGomokuResetRequest(client),
    gomokuResetResponse: () => handleGomokuResetResponse(client, payload)
  };
  if (handlers[payload.type]) await handlers[payload.type]();
}

function removeClient(ws) {
  const client = ws.clientInfo;
  if (!client) return;
  const room = client.room;
  room.clients.delete(client.id);
  assignSeats(room);
  if (room.clients.size === 0) {
    room.emptyTimer = setTimeout(() => {
      if (room.clients.size === 0) rooms.delete(room.code);
    }, EMPTY_ROOM_TTL_MS);
  } else systemMessage(room, `${client.name} 离开房间`);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) filePath = path.join(PUBLIC_DIR, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  send(ws, { type: 'hello' });
  ws.on('message', (raw) => {
    handleMessage(ws, raw).catch((error) => send(ws, { type: 'error', message: error.message || '服务器处理失败' }));
  });
  ws.on('close', () => removeClient(ws));
});

server.listen(PORT, () => {
  console.log(`H5 multiplayer games running on http://localhost:${PORT}`);
});
