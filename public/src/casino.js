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

  function resolveSlotSpin({ chips, bet, symbols }) {
    const safeBet = Math.max(1, Math.min(Number(bet || 1), chips));
    const result = symbols || Array.from({ length: 3 }, () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
    let multiplier = 0;
    if (result[0] === result[1] && result[1] === result[2]) multiplier = result[0] === '龙' ? 20 : 10;
    else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) multiplier = 2;
    const payout = safeBet * multiplier;
    return {
      symbols: result,
      bet: safeBet,
      multiplier,
      payout,
      chips: Math.max(0, chips - safeBet + payout)
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
