/**
 * Web Worker for Monte Carlo poker simulations.
 * Offloads winProbability and computeEHS from the main thread.
 */

var RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
var SUITS = ['s', 'h', 'd', 'c'];

function createDeck() {
  var cards = [];
  for (var si = 0; si < SUITS.length; si++)
    for (var ri = 0; ri < RANKS.length; ri++)
      cards.push({ suit: SUITS[si], rank: RANKS[ri] });
  return cards;
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function combinations(arr, k) {
  if (k === 1) return arr.map(function (x) { return [x]; });
  if (k === arr.length) return [arr];
  var out = [];
  for (var i = 0; i <= arr.length - k; i++) {
    var rest = combinations(arr.slice(i + 1), k - 1);
    for (var j = 0; j < rest.length; j++) out.push([arr[i]].concat(rest[j]));
  }
  return out;
}

var HandRank = { HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR: 7, STRAIGHT_FLUSH: 8 };

function evaluateFive(cards) {
  if (cards.length !== 5) return null;
  var ranks = cards.map(function (c) { return c.rank; }).sort(function (a, b) { return b - a; });
  var suits = cards.map(function (c) { return c.suit; });
  var isFlush = new Set(suits).size === 1;
  var rankCounts = {};
  ranks.forEach(function (r) { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  var set = new Set(ranks);
  var hasStraight = false, straightHigh = null;
  if ([10, 11, 12, 13, 14].every(function (x) { return set.has(x); })) { hasStraight = true; straightHigh = 14; }
  else {
    for (var h = 13; h >= 5; h--) {
      var ok = true;
      for (var ii = 0; ii < 5; ii++) if (!set.has(h - ii)) { ok = false; break; }
      if (ok) { hasStraight = true; straightHigh = h; break; }
    }
    if (!hasStraight && [2, 3, 4, 5].every(function (x) { return set.has(x); }) && set.has(14)) { hasStraight = true; straightHigh = 5; }
  }
  if (isFlush && hasStraight) return { rank: HandRank.STRAIGHT_FLUSH, kickers: [straightHigh] };
  var counts = Object.keys(rankCounts).map(function (r) { return { r: +r, c: rankCounts[r] }; });
  counts.sort(function (a, b) { return b.c - a.c || b.r - a.r; });
  if (counts[0].c === 4) return { rank: HandRank.FOUR, kickers: [counts[0].r, counts[1].r] };
  if (counts[0].c === 3 && counts[1].c === 2) return { rank: HandRank.FULL_HOUSE, kickers: [counts[0].r, counts[1].r] };
  if (isFlush) return { rank: HandRank.FLUSH, kickers: ranks };
  if (hasStraight) return { rank: HandRank.STRAIGHT, kickers: [straightHigh] };
  if (counts[0].c === 3) return { rank: HandRank.THREE, kickers: [counts[0].r, counts[1].r, counts[2].r] };
  if (counts[0].c === 2 && counts[1].c === 2) { var p = [counts[0].r, counts[1].r].sort(function (a, b) { return b - a; }); return { rank: HandRank.TWO_PAIR, kickers: [p[0], p[1], counts[2].r] }; }
  if (counts[0].c === 2) return { rank: HandRank.PAIR, kickers: [counts[0].r].concat(counts.slice(1).map(function (x) { return x.r; }).sort(function (a, b) { return b - a; })) };
  return { rank: HandRank.HIGH_CARD, kickers: ranks };
}

function bestHand(cards) {
  if (!cards || cards.length < 5) return null;
  var combos = combinations(cards, 5);
  var best = null;
  for (var i = 0; i < combos.length; i++) {
    var e = evaluateFive(combos[i]);
    if (!e) continue;
    if (!best || compareEval(best, e) < 0) best = e;
  }
  return best;
}

function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (var i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

function getRemaining(myHand, communityCards) {
  var used = new Set();
  myHand.forEach(function (c) { used.add(c.suit + c.rank); });
  communityCards.forEach(function (c) { used.add(c.suit + c.rank); });
  var remaining = [];
  for (var si = 0; si < SUITS.length; si++)
    for (var ri = 0; ri < RANKS.length; ri++) {
      var key = SUITS[si] + RANKS[ri];
      if (!used.has(key)) remaining.push({ suit: SUITS[si], rank: RANKS[ri] });
    }
  return remaining;
}

function winProbability(myHand, communityCards, numSims) {
  var need = 5 - communityCards.length;
  var remaining = getRemaining(myHand, communityCards);
  var wins = 0;
  for (var i = 0; i < numSims; i++) {
    var shuf = shuffle(remaining);
    var extra = shuf.slice(0, need);
    var fullComm = communityCards.concat(extra);
    var opp = shuf.slice(need, need + 2);
    var myE = bestHand(myHand.concat(fullComm));
    var oppE = bestHand(opp.concat(fullComm));
    if (!myE || !oppE) { wins += 0.5; continue; }
    var c = compareEval(myE, oppE);
    if (c > 0) wins += 1;
    else if (c === 0) wins += 0.5;
  }
  return wins / numSims;
}

function computeEHS(myHand, communityCards, numSims) {
  var need = 5 - communityCards.length;
  if (need <= 0) {
    var hs = winProbability(myHand, communityCards, numSims);
    return { hs: hs, ppot: 0, npot: 0, ehs: hs };
  }
  var remaining = getRemaining(myHand, communityCards);
  var aheadNow = 0, behindNow = 0, tiedNow = 0;
  var aheadToBehind = 0, behindToAhead = 0;
  var aheadTotal = 0, behindTotal = 0;
  for (var i = 0; i < numSims; i++) {
    var shuf = shuffle(remaining);
    var oppHand = shuf.slice(0, 2);
    var myAll = myHand.concat(communityCards);
    var oppAll = oppHand.concat(communityCards);
    var myE = bestHand(myAll.length >= 5 ? myAll : null);
    var oppE = bestHand(oppAll.length >= 5 ? oppAll : null);
    var currentResult;
    if (!myE || !oppE) currentResult = 0;
    else { var cmp = compareEval(myE, oppE); currentResult = cmp > 0 ? 1 : (cmp < 0 ? -1 : 0); }
    var futureCards = shuf.slice(2, 2 + need);
    var fullComm = communityCards.concat(futureCards);
    var myFuture = bestHand(myHand.concat(fullComm));
    var oppFuture = bestHand(oppHand.concat(fullComm));
    var futureResult;
    if (!myFuture || !oppFuture) futureResult = 0;
    else { var cmp2 = compareEval(myFuture, oppFuture); futureResult = cmp2 > 0 ? 1 : (cmp2 < 0 ? -1 : 0); }
    if (currentResult > 0) { aheadNow++; aheadTotal++; if (futureResult < 0) aheadToBehind++; }
    else if (currentResult < 0) { behindNow++; behindTotal++; if (futureResult > 0) behindToAhead++; }
    else { tiedNow++; aheadTotal += 0.5; behindTotal += 0.5; if (futureResult > 0) behindToAhead += 0.5; if (futureResult < 0) aheadToBehind += 0.5; }
  }
  var hs = (aheadNow + tiedNow * 0.5) / numSims;
  var ppot = behindTotal > 0 ? behindToAhead / behindTotal : 0;
  var npot = aheadTotal > 0 ? aheadToBehind / aheadTotal : 0;
  var ehs = hs * (1 - npot) + (1 - hs) * ppot;
  return { hs: hs, ppot: ppot, npot: npot, ehs: ehs };
}

self.onmessage = function (e) {
  var d = e.data;
  if (d.type === 'winProbability') {
    var wp = winProbability(d.hand, d.community, d.sims || 500);
    self.postMessage({ id: d.id, type: 'winProbability', result: wp });
  } else if (d.type === 'computeEHS') {
    var ehs = computeEHS(d.hand, d.community, d.sims || 400);
    self.postMessage({ id: d.id, type: 'computeEHS', result: ehs });
  }
};
