const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const chess = require('./public/src/chess.js');
const casino = require('./public/src/casino.js');
const poker = require('./public/src/poker.js');

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
    chess: chess.createInitialState(),
    chessNotice: null,
    pendingUndo: null,
    pendingReset: null,
    chat: [],
    casinoLog: [],
    lastSlot: null,
    baccarat: { betsOpen: true, bets: {}, lastRound: null },
    poker: null,
    pokerBotCount: 5
  };
}

function getRoom(code) {
  const key = normalizeRoomCode(code);
  if (!rooms.has(key)) rooms.set(key, createRoom(key));
  return rooms.get(key);
}

function assignSeats(room) {
  const clients = [...room.clients.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  clients.forEach((client, index) => {
    client.role = index === 0 ? 'red' : index === 1 ? 'black' : 'spectator';
  });
}

function publicClient(client) {
  return {
    id: client.id,
    name: client.name,
    role: client.role,
    chips: client.chips,
    bonusSpins: client.bonusSpins || 0,
    bonusTotal: client.bonusTotal || 0
  };
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
    poker: poker.publicHoldemState(room.poker, viewerId)
  };
}

function broadcast(room) {
  room.clients.forEach((client) => {
    const state = publicState(room, client.id);
    send(client.ws, { type: 'state', you: publicClient(client), state });
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

function handleJoin(ws, payload) {
  const room = getRoom(payload.roomCode);
  const client = {
    id: Math.random().toString(36).slice(2, 10),
    ws,
    room,
    name: normalizeName(payload.name),
    role: 'spectator',
    chips: 1000,
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
    chips: 1000,
    bot: false
  }));
}

function handlePokerStart(client, payload) {
  const room = client.room;
  room.pokerBotCount = Math.max(0, Math.min(5, Number(payload.botCount ?? room.pokerBotCount ?? 5)));
  room.poker = poker.createHoldemTable({
    players: roomPokerPlayers(room),
    botCount: room.pokerBotCount,
    smallBlind: 5,
    bigBlind: 10
  });
  room.poker = poker.runBots(poker.startHand(room.poker));
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
  broadcast(room);
}

function handleMessage(ws, raw) {
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
    undoRequest: () => handleUndoRequest(client),
    undoResponse: () => handleUndoResponse(client, payload),
    resetRequest: () => handleResetRequest(client),
    resetResponse: () => handleResetResponse(client, payload),
    slotSpin: () => handleSlot(client, payload),
    baccaratBet: () => handleBaccaratBet(client, payload),
    baccaratDeal: () => handleBaccaratDeal(client),
    pokerStart: () => handlePokerStart(client, payload),
    pokerAction: () => handlePokerAction(client, payload)
  };
  if (handlers[payload.type]) handlers[payload.type]();
}

function removeClient(ws) {
  const client = ws.clientInfo;
  if (!client) return;
  const room = client.room;
  room.clients.delete(client.id);
  assignSeats(room);
  if (room.clients.size === 0) rooms.delete(room.code);
  else systemMessage(room, `${client.name} 离开房间`);
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
  ws.on('message', (raw) => handleMessage(ws, raw));
  ws.on('close', () => removeClient(ws));
});

server.listen(PORT, () => {
  console.log(`H5 multiplayer games running on http://localhost:${PORT}`);
});
