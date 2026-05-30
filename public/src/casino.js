(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CasinoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SLOT_SYMBOLS = ['福', '禄', '寿', '喜', '财', '龙'];

  function card(suit, rank) {
    return { suit, rank };
  }

  function cardLabel(c) {
    const names = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
    return `${names[c.rank] || c.rank}${{ heart: '红桃', diamond: '方片', club: '梅花', spade: '黑桃' }[c.suit] || c.suit}`;
  }

  function makeDeck() {
    const suits = ['heart', 'diamond', 'club', 'spade'];
    const deck = [];
    for (let pack = 0; pack < 4; pack += 1) {
      suits.forEach((suit) => {
        for (let rank = 1; rank <= 13; rank += 1) deck.push(card(suit, rank));
      });
    }
    return deck;
  }

  function shuffle(deck, random = Math.random) {
    const next = deck.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function baccaratValue(c) {
    if (c.rank >= 10) return 0;
    return c.rank;
  }

  function handTotal(cards) {
    return cards.reduce((sum, c) => sum + baccaratValue(c), 0) % 10;
  }

  function bankerDraws(bankerTotal, playerThirdValue) {
    if (playerThirdValue == null) return bankerTotal <= 5;
    if (bankerTotal <= 2) return true;
    if (bankerTotal === 3) return playerThirdValue !== 8;
    if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7;
    if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7;
    if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7;
    return false;
  }

  function resolveBaccaratRound(deck) {
    const drawDeck = deck.slice();
    const player = { cards: [drawDeck.shift(), drawDeck.shift()] };
    const banker = { cards: [drawDeck.shift(), drawDeck.shift()] };

    let playerTotal = handTotal(player.cards);
    let bankerTotal = handTotal(banker.cards);
    let playerThirdValue = null;

    if (playerTotal < 8 && bankerTotal < 8) {
      if (playerTotal <= 5) {
        const third = drawDeck.shift();
        player.cards.push(third);
        playerThirdValue = baccaratValue(third);
        playerTotal = handTotal(player.cards);
      }
      if (bankerDraws(bankerTotal, playerThirdValue)) banker.cards.push(drawDeck.shift());
    }

    bankerTotal = handTotal(banker.cards);
    const winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';
    return {
      player: { cards: player.cards, total: playerTotal },
      banker: { cards: banker.cards, total: bankerTotal },
      winner,
      remainingDeck: drawDeck
    };
  }

  function settleBaccaratBets({ chips, bets, winner }) {
    const totalBet = Object.values(bets || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    let win = 0;
    if (winner === 'player') win += Number(bets.player || 0) * 2;
    if (winner === 'banker') win += Number(bets.banker || 0) * 1.95;
    if (winner === 'tie') win += Number(bets.tie || 0) * 9;
    return {
      chips: Math.max(0, Math.round(chips - totalBet + win)),
      payout: Math.round(win)
    };
  }

  const FIVE_REEL_PAYOUTS = { 0: 0, 1: 0, 2: 3.5, 3: 10, 4: 50, 5: 400 };
  const FIVE_REEL_BLESSING_TABLES = {
    10: [
      { max: 0.38, count: 0 },
      { max: 0.74, count: 1 },
      { max: 0.90, count: 2 },
      { max: 0.97, count: 3 },
      { max: 0.995, count: 4 },
      { max: 1, count: 5 }
    ],
    20: [
      { max: 0.34, count: 0 },
      { max: 0.68, count: 1 },
      { max: 0.88, count: 2 },
      { max: 0.96, count: 3 },
      { max: 0.99, count: 4 },
      { max: 1, count: 5 }
    ],
    50: [
      { max: 0.30, count: 0 },
      { max: 0.60, count: 1 },
      { max: 0.83, count: 2 },
      { max: 0.94, count: 3 },
      { max: 0.985, count: 4 },
      { max: 1, count: 5 }
    ]
  };

  function slotBetTier(bet) {
    if (Number(bet) >= 50) return 50;
    if (Number(bet) >= 20) return 20;
    return 10;
  }

  function blessingBand(value, bet) {
    const table = FIVE_REEL_BLESSING_TABLES[slotBetTier(bet)];
    return table.find((band) => value < band.max) || table[table.length - 1];
  }

  function makeBlessingSymbols(count, random = Math.random) {
    const fillers = SLOT_SYMBOLS.filter((symbol) => symbol !== '福');
    const result = Array.from({ length: 5 }, (_, index) => (index < count ? '福' : fillers[Math.floor(random() * fillers.length)]));
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function resolveSlotSpin({ chips, bet, symbols, reelCount = 3, freeSpin = false, random = Math.random }) {
    const safeBet = Math.max(1, Math.min(Number(bet || 1), chips));
    const count = Math.max(3, Math.min(5, Number(reelCount || 3)));
    if (count === 5) {
      const band = symbols ? null : blessingBand(random(), safeBet);
      const result = (symbols || makeBlessingSymbols(band.count, random)).slice(0, count);
      const blessingCount = result.filter((symbol) => symbol === '福').length;
      const payout = FIVE_REEL_PAYOUTS[blessingCount] || 0;
      return {
        symbols: result,
        reelCount: count,
        bet: safeBet,
        blessingCount,
        matchCount: blessingCount,
        multiplier: safeBet ? payout / safeBet : 0,
        payout,
        freeSpin: Boolean(freeSpin),
        bonusTriggered: blessingCount === 5,
        chips: Math.max(0, chips - (freeSpin ? 0 : safeBet) + payout)
      };
    }

    const result = (symbols || Array.from({ length: count }, () => SLOT_SYMBOLS[Math.floor(random() * SLOT_SYMBOLS.length)])).slice(0, count);
    const frequencies = result.reduce((map, symbol) => {
      map[symbol] = (map[symbol] || 0) + 1;
      return map;
    }, {});
    const matchCount = Math.max(...Object.values(frequencies));
    const fiveBlessings = count === 5 && frequencies['福'] === 5;
    let multiplier = 0;
    if (matchCount === 3) multiplier = count === 5 ? 8 : result[0] === result[1] && result[1] === result[2] ? 10 : 2;
    if (matchCount === 4) multiplier = 20;
    if (matchCount === 5) multiplier = fiveBlessings ? 50 : 35;
    if (count === 3 && result[0] === result[1] && result[1] === result[2] && result[0] === '龙') multiplier = 20;
    const payout = safeBet * multiplier;
    return {
      symbols: result,
      reelCount: count,
      bet: safeBet,
      matchCount,
      multiplier,
      payout,
      freeSpin: Boolean(freeSpin),
      bonusTriggered: fiveBlessings,
      chips: Math.max(0, chips - (freeSpin ? 0 : safeBet) + payout)
    };
  }

  return {
    SLOT_SYMBOLS,
    card,
    cardLabel,
    makeDeck,
    shuffle,
    baccaratValue,
    handTotal,
    resolveBaccaratRound,
    settleBaccaratBets,
    resolveSlotSpin
  };
});
