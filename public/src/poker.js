(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PokerCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SUITS = ['s', 'h', 'd', 'c'];
  const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const HAND_NAMES = {
    9: '皇家同花顺',
    8: '同花顺',
    7: '四条',
    6: '葫芦',
    5: '同花',
    4: '顺子',
    3: '三条',
    2: '两对',
    1: '一对',
    0: '高牌'
  };

  function makeDeck() {
    return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
  }

  function shuffle(deck, random = Math.random) {
    const next = deck.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function cardLabel(card) {
    const labels = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' };
    const suits = { s: '黑桃', h: '红桃', d: '方片', c: '梅花' };
    return `${suits[card.suit] || card.suit}${labels[card.rank] || card.rank}`;
  }

  function compareValues(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function compareHands(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    return compareValues(a.values, b.values);
  }

  function straightHigh(ranks) {
    const unique = [...new Set(ranks)].sort((a, b) => b - a);
    if (unique.includes(14)) unique.push(1);
    for (let i = 0; i <= unique.length - 5; i += 1) {
      const slice = unique.slice(i, i + 5);
      if (slice.every((rank, index) => index === 0 || rank === slice[index - 1] - 1)) return slice[0] === 1 ? 5 : slice[0];
    }
    return null;
  }

  function byRank(cards) {
    return cards.reduce((map, card) => {
      map[card.rank] = map[card.rank] || [];
      map[card.rank].push(card);
      return map;
    }, {});
  }

  function topRanks(ranks, count, excluded = []) {
    return ranks.filter((rank) => !excluded.includes(rank)).sort((a, b) => b - a).slice(0, count);
  }

  function evaluateBestHand(cards) {
    if (!cards || cards.length < 5) throw new Error('Need at least five cards');
    const ranks = cards.map((card) => card.rank);
    const rankGroups = byRank(cards);
    const groupRanks = Object.keys(rankGroups).map(Number);
    const sortedGroups = groupRanks
      .map((rank) => ({ rank, count: rankGroups[rank].length }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);

    const suitGroups = SUITS.map((suit) => cards.filter((card) => card.suit === suit)).filter((group) => group.length >= 5);
    let bestStraightFlush = null;
    suitGroups.forEach((group) => {
      const high = straightHigh(group.map((card) => card.rank));
      if (high && (!bestStraightFlush || high > bestStraightFlush)) bestStraightFlush = high;
    });
    if (bestStraightFlush) {
      const royal = bestStraightFlush === 14;
      return { category: royal ? 9 : 8, name: royal ? HAND_NAMES[9] : HAND_NAMES[8], values: [bestStraightFlush] };
    }

    const quads = sortedGroups.find((group) => group.count === 4);
    if (quads) return { category: 7, name: HAND_NAMES[7], values: [quads.rank, ...topRanks(groupRanks, 1, [quads.rank])] };

    const trips = sortedGroups.filter((group) => group.count === 3);
    const pairs = sortedGroups.filter((group) => group.count >= 2);
    if (trips.length && (pairs.some((group) => group.rank !== trips[0].rank) || trips.length > 1)) {
      const trip = trips[0].rank;
      const pair = pairs.find((group) => group.rank !== trip).rank;
      return { category: 6, name: HAND_NAMES[6], values: [trip, pair] };
    }

    if (suitGroups.length) {
      const flushRanks = suitGroups
        .map((group) => group.map((card) => card.rank).sort((a, b) => b - a).slice(0, 5))
        .sort((a, b) => compareValues(b, a))[0];
      return { category: 5, name: HAND_NAMES[5], values: flushRanks };
    }

    const straight = straightHigh(ranks);
    if (straight) return { category: 4, name: HAND_NAMES[4], values: [straight] };

    if (trips.length) {
      const trip = trips[0].rank;
      return { category: 3, name: HAND_NAMES[3], values: [trip, ...topRanks(groupRanks, 2, [trip])] };
    }

    const exactPairs = sortedGroups.filter((group) => group.count === 2);
    if (exactPairs.length >= 2) {
      const pairRanks = exactPairs.map((group) => group.rank).sort((a, b) => b - a).slice(0, 2);
      return { category: 2, name: HAND_NAMES[2], values: [...pairRanks, ...topRanks(groupRanks, 1, pairRanks)] };
    }

    if (exactPairs.length === 1) {
      const pair = exactPairs[0].rank;
      return { category: 1, name: HAND_NAMES[1], values: [pair, ...topRanks(groupRanks, 3, [pair])] };
    }

    return { category: 0, name: HAND_NAMES[0], values: topRanks(groupRanks, 5) };
  }

  function cloneTable(table) {
    return JSON.parse(JSON.stringify(table));
  }

  function createHoldemTable({ players = [], botCount = 5, smallBlind = 5, bigBlind = 10, random = Math.random } = {}) {
    const realSeats = players.slice(0, 6).map((player, index) => ({
      id: player.id,
      name: player.name || `玩家${index + 1}`,
      chips: Number(player.chips || 1000),
      bot: Boolean(player.bot),
      cards: [],
      folded: false,
      allIn: false,
      committed: 0,
      roundBet: 0,
      acted: false
    }));
    const neededBots = Math.max(0, Math.min(6 - realSeats.length, Number(botCount || 0)));
    const bots = Array.from({ length: neededBots }, (_, index) => ({
      id: `bot-${index + 1}`,
      name: `机器人${index + 1}`,
      chips: 1000,
      bot: true,
      cards: [],
      folded: false,
      allIn: false,
      committed: 0,
      roundBet: 0,
      acted: false
    }));
    return {
      smallBlind,
      bigBlind,
      button: 0,
      seats: realSeats.concat(bots),
      deck: [],
      community: [],
      burn: [],
      pot: 0,
      currentBet: 0,
      activeSeatId: null,
      stage: 'waiting',
      lastResult: null,
      random
    };
  }

  function postBlind(seat, amount) {
    const paid = Math.min(seat.chips, amount);
    seat.chips -= paid;
    seat.committed += paid;
    seat.roundBet += paid;
    if (seat.chips === 0) seat.allIn = true;
    return paid;
  }

  function activeSeats(table) {
    return table.seats.filter((seat) => !seat.folded && (seat.cards || []).length);
  }

  function nextSeatId(table, startIndex = -1) {
    if (!activeSeats(table).length) return null;
    for (let offset = 1; offset <= table.seats.length; offset += 1) {
      const seat = table.seats[(startIndex + offset + table.seats.length) % table.seats.length];
      if (!seat.folded && !seat.allIn && seat.cards.length) return seat.id;
    }
    return null;
  }

  function indexOfSeat(table, seatId) {
    return table.seats.findIndex((seat) => seat.id === seatId);
  }

  function startHand(table) {
    const next = cloneTable(table);
    next.stage = 'preflop';
    next.community = [];
    next.burn = [];
    next.pot = 0;
    next.currentBet = next.bigBlind;
    next.lastResult = null;
    next.deck = shuffle(makeDeck(), next.random || Math.random);
    next.seats.forEach((seat) => {
      seat.cards = [];
      seat.folded = false;
      seat.allIn = false;
      seat.committed = 0;
      seat.roundBet = 0;
      seat.acted = false;
    });
    for (let card = 0; card < 2; card += 1) {
      next.seats.forEach((seat) => seat.cards.push(next.deck.shift()));
    }
    const sb = next.seats[0];
    const bb = next.seats[1 % next.seats.length];
    next.pot += postBlind(sb, next.smallBlind);
    next.pot += postBlind(bb, next.bigBlind);
    bb.acted = true;
    const firstIndex = next.seats.length === 2 ? 1 : 1;
    next.activeSeatId = nextSeatId(next, firstIndex);
    return next;
  }

  function payToCall(table, seat) {
    return Math.max(0, table.currentBet - seat.roundBet);
  }

  function betChips(table, seat, amount) {
    const paid = Math.min(seat.chips, Math.max(0, amount));
    seat.chips -= paid;
    seat.committed += paid;
    seat.roundBet += paid;
    table.pot += paid;
    if (seat.chips === 0) seat.allIn = true;
    return paid;
  }

  function shouldAdvanceRound(table) {
    const contenders = activeSeats(table).filter((seat) => !seat.allIn);
    if (contenders.length <= 1) return true;
    return contenders.every((seat) => seat.acted && seat.roundBet === table.currentBet);
  }

  function resetRound(table) {
    table.currentBet = 0;
    table.seats.forEach((seat) => {
      seat.roundBet = 0;
      seat.acted = false;
    });
    table.activeSeatId = nextSeatId(table, -1);
  }

  function dealNextStreet(table) {
    if (activeSeats(table).length <= 1) return settleByFold(table);
    if (table.stage === 'preflop') {
      table.burn.push(table.deck.shift());
      table.community.push(table.deck.shift(), table.deck.shift(), table.deck.shift());
      table.stage = 'flop';
      resetRound(table);
      return table;
    }
    if (table.stage === 'flop') {
      table.burn.push(table.deck.shift());
      table.community.push(table.deck.shift());
      table.stage = 'turn';
      resetRound(table);
      return table;
    }
    if (table.stage === 'turn') {
      table.burn.push(table.deck.shift());
      table.community.push(table.deck.shift());
      table.stage = 'river';
      resetRound(table);
      return table;
    }
    if (table.stage === 'river') return settleShowdown(table);
    return table;
  }

  function settleByFold(table) {
    const winner = activeSeats(table)[0];
    if (winner) winner.chips += table.pot;
    table.lastResult = {
      reason: 'fold',
      pot: table.pot,
      winners: winner ? [{ id: winner.id, name: winner.name, amount: table.pot, handName: '弃牌获胜' }] : []
    };
    table.pot = 0;
    table.stage = 'showdown';
    table.activeSeatId = null;
    return table;
  }

  function settleShowdown(table) {
    const contenders = activeSeats(table);
    const ranked = contenders.map((seat) => ({ seat, hand: evaluateBestHand(seat.cards.concat(table.community)) }));
    ranked.sort((a, b) => compareHands(b.hand, a.hand));
    const best = ranked[0]?.hand;
    const winners = ranked.filter((item) => compareHands(item.hand, best) === 0);
    const share = winners.length ? Math.floor(table.pot / winners.length) : 0;
    winners.forEach((item) => {
      item.seat.chips += share;
    });
    table.lastResult = {
      reason: 'showdown',
      pot: table.pot,
      winners: winners.map((item) => ({ id: item.seat.id, name: item.seat.name, amount: share, handName: item.hand.name }))
    };
    table.pot = 0;
    table.stage = 'showdown';
    table.activeSeatId = null;
    return table;
  }

  function applyAction(table, seatId, action) {
    const next = cloneTable(table);
    if (!next.activeSeatId || next.activeSeatId !== seatId || next.stage === 'showdown') return next;
    const seat = next.seats.find((item) => item.id === seatId);
    if (!seat || seat.folded || seat.allIn) return next;
    if (action.type === 'fold') {
      seat.folded = true;
      seat.acted = true;
      if (activeSeats(next).length === 1) return settleByFold(next);
    } else if (action.type === 'allIn') {
      betChips(next, seat, seat.chips);
      next.currentBet = Math.max(next.currentBet, seat.roundBet);
      seat.acted = true;
    } else if (action.type === 'raise') {
      const raiseTo = Math.max(next.currentBet + next.bigBlind, Number(action.amount || 0));
      betChips(next, seat, raiseTo - seat.roundBet);
      next.currentBet = Math.max(next.currentBet, seat.roundBet);
      next.seats.forEach((item) => {
        if (!item.folded && !item.allIn && item.id !== seat.id) item.acted = false;
      });
      seat.acted = true;
    } else {
      betChips(next, seat, payToCall(next, seat));
      seat.acted = true;
    }
    if (shouldAdvanceRound(next)) return dealNextStreet(next);
    next.activeSeatId = nextSeatId(next, indexOfSeat(next, seatId));
    return next;
  }

  function botAction(table, seat) {
    const toCall = payToCall(table, seat);
    const highCard = Math.max(...seat.cards.map((card) => card.rank));
    const paired = seat.cards.length === 2 && seat.cards[0].rank === seat.cards[1].rank;
    const hand = table.community.length >= 3 ? evaluateBestHand(seat.cards.concat(table.community)) : null;
    if (toCall > 0 && !paired && highCard < 11 && (!hand || hand.category === 0)) return { type: 'fold' };
    return { type: 'call' };
  }

  function runBots(table, limit = 30) {
    let next = cloneTable(table);
    let guard = 0;
    while (guard < limit && next.activeSeatId) {
      const seat = next.seats.find((item) => item.id === next.activeSeatId);
      if (!seat || !seat.bot) break;
      next = applyAction(next, seat.id, botAction(next, seat));
      guard += 1;
    }
    return next;
  }

  function publicHoldemState(table, viewerId) {
    if (!table) return null;
    return {
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      stage: table.stage,
      community: table.community,
      pot: table.pot,
      currentBet: table.currentBet,
      activeSeatId: table.activeSeatId,
      lastResult: table.lastResult,
      seats: table.seats.map((seat) => ({
        id: seat.id,
        name: seat.name,
        chips: seat.chips,
        bot: seat.bot,
        folded: seat.folded,
        allIn: seat.allIn,
        committed: seat.committed,
        roundBet: seat.roundBet,
        cards: seat.id === viewerId || table.stage === 'showdown' ? seat.cards : seat.cards.map(() => null)
      }))
    };
  }

  return {
    SUITS,
    RANKS,
    HAND_NAMES,
    makeDeck,
    shuffle,
    cardLabel,
    evaluateBestHand,
    compareHands,
    createHoldemTable,
    startHand,
    applyAction,
    runBots,
    publicHoldemState
  };
});
