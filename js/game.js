/**
 * 德州扑克核心逻辑：牌组、牌型评估、底池赔率、建议、局内流程、AI
 */

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // J=11 Q=12 K=13 A=14
const SUITS = ['s', 'h', 'd', 'c'];

function createDeck() {
  const cards = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      cards.push({ suit: s, rank: r });
    }
  }
  return cards;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function combinations(arr, k) {
  if (k === 1) return arr.map((x) => [x]);
  if (k === arr.length) return [arr];
  const out = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const c of combinations(arr.slice(i + 1), k - 1)) {
      out.push([arr[i], ...c]);
    }
  }
  return out;
}

// 牌型常量
const HandRank = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR: 7,
  STRAIGHT_FLUSH: 8,
};

function evaluateFive(cards) {
  if (cards.length !== 5) return null;
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = new Set(suits).size === 1;
  const rankCounts = {};
  ranks.forEach((r) => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const set = new Set(ranks);

  let hasStraight = false;
  let straightHigh = null;
  if ([10, 11, 12, 13, 14].every((x) => set.has(x))) {
    hasStraight = true;
    straightHigh = 14;
  } else {
    for (let h = 13; h >= 5; h--) {
      const need = [];
      for (let i = 0; i < 5; i++) need.push(h - i);
      if (need.every((x) => set.has(x))) {
        hasStraight = true;
        straightHigh = h;
        break;
      }
    }
    if (!hasStraight && [2, 3, 4, 5].every((x) => set.has(x)) && set.has(14)) {
      hasStraight = true;
      straightHigh = 5;
    }
  }

  if (isFlush && hasStraight && straightHigh != null) {
    return { rank: HandRank.STRAIGHT_FLUSH, tieBreaker: [straightHigh] };
  }
  const fourR = Object.entries(rankCounts).find(([, n]) => n === 4);
  if (fourR) {
    const kicker = Math.max(...Object.keys(rankCounts).filter((r) => +r !== fourR[0]).map(Number));
    return { rank: HandRank.FOUR, tieBreaker: [+fourR[0], kicker] };
  }
  const threeR = Object.entries(rankCounts).find(([, n]) => n === 3);
  const twoR = threeR ? Object.entries(rankCounts).find(([r, n]) => n >= 2 && Number(r) !== Number(threeR[0])) : null;
  if (threeR && twoR) {
    return { rank: HandRank.FULL_HOUSE, tieBreaker: [+threeR[0], +twoR[0]] };
  }
  if (isFlush) return { rank: HandRank.FLUSH, tieBreaker: [...ranks] };
  if (hasStraight && straightHigh != null) return { rank: HandRank.STRAIGHT, tieBreaker: [straightHigh] };
  if (threeR) {
    const kickers = Object.keys(rankCounts).filter((r) => +r !== +threeR[0]).map(Number).sort((a, b) => b - a).slice(0, 2);
    return { rank: HandRank.THREE, tieBreaker: [+threeR[0], ...kickers] };
  }
  const pairs = Object.entries(rankCounts).filter(([, n]) => n === 2).map(([r]) => +r).sort((a, b) => b - a);
  if (pairs.length >= 2) {
    const kicker = Math.max(...Object.keys(rankCounts).filter((r) => !pairs.slice(0, 2).includes(+r)).map(Number));
    return { rank: HandRank.TWO_PAIR, tieBreaker: [pairs[0], pairs[1], kicker] };
  }
  if (pairs.length === 1) {
    const kickers = Object.keys(rankCounts).filter((r) => +r !== pairs[0]).map(Number).sort((a, b) => b - a).slice(0, 3);
    return { rank: HandRank.PAIR, tieBreaker: [pairs[0], ...kickers] };
  }
  return { rank: HandRank.HIGH_CARD, tieBreaker: [...ranks] };
}

function handRankDisplayName(rank) {
  const names = { 0: 'HIGH CARD', 1: 'ONE PAIR', 2: 'TWO PAIR', 3: 'THREE OF A KIND', 4: 'STRAIGHT', 5: 'FLUSH', 6: 'FULL HOUSE', 7: 'FOUR OF A KIND', 8: 'STRAIGHT FLUSH' };
  return names[rank] || '';
}

var HAND_RANK_ZH = { 0: '高牌', 1: '一对', 2: '两对', 3: '三条', 4: '顺子', 5: '同花', 6: '葫芦', 7: '四条', 8: '同花顺' };
var RANK_ZH = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
var SUIT_ZH = { s: '♠', h: '♥', d: '♦', c: '♣' };
function cardToStr(c) {
  if (!c) return '';
  var r = RANK_ZH[c.rank] || String(c.rank);
  return r + (SUIT_ZH[c.suit] || c.suit);
}
function handToStr(hand) {
  return (hand || []).map(cardToStr).join(' ');
}
function _normalizeAction(a) {
  if (a === '加注' || a === 'raise' || a === 'bet' || a === '下注') return 'raise';
  if (a === '跟注' || a === 'call') return 'call';
  if (a === '弃牌' || a === 'fold') return 'fold';
  return 'check';
}

function _analyzeDecision(d) {
  var actual = _normalizeAction(d.action);
  var ideal = d.recommended ? _normalizeAction(d.recommended) : 'check';
  var streetLabel = d.streetName;
  var ACTION_ZH_MAP = { raise: '加注', call: '跟注', fold: '弃牌', check: '过牌' };
  var actualZh = ACTION_ZH_MAP[actual] || d.action;
  var idealZh = ACTION_ZH_MAP[ideal] || d.recommended;
  var wpPct = Math.round((d.winProbability || 0) * 100);
  var potOddsPct = Math.round((d.requiredEquity || 0) * 100);
  var ehsPct = d.ehs != null ? Math.round(d.ehs) : null;
  var isPreflop = d.street === 0;
  var handStrPct = d.handStrength != null ? Math.round(d.handStrength * 100) : null;

  var rating = 'good';
  var ratingIcon = '✓';
  var ratingLabel = '合理';
  var analysis = '';
  var suggestion = '';

  var preflopFreeCheck = isPreflop && d.toCall === 0 && actual === 'check';
  if (actual === ideal) {
    rating = 'good';
    ratingIcon = '✓';
    ratingLabel = '合理';
  } else if (preflopFreeCheck) {
    rating = 'good';
    ratingIcon = '✓';
    ratingLabel = '合理';
  } else if (
    (actual === 'call' && ideal === 'raise') ||
    (actual === 'raise' && ideal === 'call') ||
    (actual === 'check' && ideal === 'call' && d.toCall === 0)
  ) {
    rating = 'good';
    ratingIcon = '✓';
    ratingLabel = '合理';
  } else {
    rating = 'mistake';
    ratingIcon = '✗';
    ratingLabel = '失误';
  }

  if (isPreflop) {
    if (actual === 'fold' && ideal === 'fold') {
      analysis = d.handDesc + ' 在' + d.position + '弃牌是正确的。手牌强度 ' + (handStrPct || wpPct) + '% 不足以入池，及时弃牌避免不必要的亏损。';
      analysis += ' 好的玩家懂得 Hand Selection（起手牌筛选），只在有优势时参与底池。';
    } else if (actual === 'fold' && ideal !== 'fold') {
      analysis = d.handDesc + ' 在' + d.position + '有可玩性（胜率 ' + wpPct + '%），弃牌过于保守。';
      suggestion = '建议 ' + idealZh + (d.recommendedAmount ? ' $' + d.recommendedAmount : '') + '。在有利位置多参与一些边缘牌，可以增加赢利机会。';
    } else if (actual === 'call' && ideal === 'raise') {
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）只跟注有些被动。强牌跟注（Slow Play）在翻前通常不如加注有利——加注可以隔离对手、建立底池，也让你在翻后拿到主动权（Initiative）。';
      suggestion = '建议加注至 $' + (d.recommendedAmount || '?') + '。翻前用强牌加注是基本功。';
    } else if (actual === 'raise' && ideal === 'call') {
      rating = 'good'; ratingIcon = '✓'; ratingLabel = '合理';
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）加注有一定道理，但手牌中等强度时跟注风险更小。过度加注可能在被 3-Bet 时陷入困境。';
      suggestion = '在中等牌力时考虑跟注观察翻牌（Set Mining/看牌策略），控制底池大小。';
    } else if (actual === 'raise' && ideal === 'raise') {
      analysis = d.handDesc + ' 在' + d.position + '加注' + (d.amount ? ' $' + d.amount : '') + '，这是标准的 Open Raise（开注），通过加注获取底池主动权。胜率 ' + wpPct + '%，手牌质量支撑加注。';
    } else if (actual === 'call' && ideal === 'call') {
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）跟注入池，' + (potOddsPct > 0 ? 'Pot Odds（底池赔率）' + potOddsPct + '% ' : '') + '赔率合适。翻后根据公共牌再做判断。';
    } else if (actual === 'call' && ideal === 'fold') {
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）跟注入池，但手牌强度不足以支撑长期获利。';
      suggestion = '这类 Marginal Hand（边缘牌）跟注看似便宜，但翻后经常面临"中了却不敢打"的尴尬局面。建议弃牌等待更好机会。';
    } else if (actual === 'raise' && ideal === 'fold') {
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）在' + d.position + '加注，但手牌太弱不适合主动投入筹码。';
      suggestion = '弱牌加注（Bluff Raise）在翻前对新手来说风险很高——建议只在有强牌或足够位置优势时加注。';
    } else if (actual === 'check' && ideal !== 'check' && d.toCall === 0) {
      analysis = d.handDesc + ' 在' + d.position + '过牌看翻牌（Free Flop），零成本看牌没有损失。';
      if (ideal === 'raise') suggestion = '不过这手牌有加注价值——通过加注可以隔离对手、夺取主动权。但过牌也不算错。';
    } else if (actual === 'check' && ideal !== 'check') {
      analysis = d.handDesc + ' 在' + d.position + '选择过牌。' + (ideal === 'raise' ? '这手牌有足够的强度加注入池。' : '');
      suggestion = '建议 ' + idealZh + '。过于被动会错失赢利机会。';
    } else {
      analysis = d.handDesc + '（胜率 ' + wpPct + '%）' + actualZh + '。';
    }
  } else {
    var madeInfo = d.madeHand ? d.madeHand : '高牌';
    var drawNote = d.drawInfo ? '你有 ' + d.drawInfo + '。' : '';
    var ehsNote = ehsPct != null ? 'EHS（有效手牌强度） ' + ehsPct + '%' : '胜率 ' + wpPct + '%';

    if (actual === 'fold' && ideal === 'fold') {
      analysis = madeInfo + '，' + ehsNote + '，弃牌正确。' + (potOddsPct > 0 ? '底池赔率需要 ' + potOddsPct + '% 的胜率才能跟注，你的牌力不够。' : '');
      analysis += ' 及时 Fold 止损是成熟玩家的标志——不要因为已经投入的筹码而继续（Sunk Cost 沉没成本谬误）。';
    } else if (actual === 'fold' && (ideal === 'call' || ideal === 'raise')) {
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + '弃牌过于保守。';
      if (potOddsPct > 0 && ehsPct != null && ehsPct >= potOddsPct) {
        suggestion = ehsNote + ' 高于底池赔率所需的 ' + potOddsPct + '%，跟注是 +EV（正期望值）的。不要害怕对手的下注——学会用数学做决策。';
      } else if (d.drawInfo) {
        suggestion = drawNote + '有足够的 Outs（出路），加上 Implied Odds（隐含赔率），跟注是有利的。';
      } else {
        suggestion = '建议 ' + idealZh + '，你的牌力足够继续。';
      }
    } else if (actual === 'call' && ideal === 'raise') {
      rating = 'good'; ratingIcon = '✓'; ratingLabel = '合理';
      analysis = madeInfo + '，' + ehsNote + '，' + (d.toCall > 0 ? '跟注 $' + d.toCall : '跟注') + '。' + drawNote;
      analysis += '牌力很强时只跟注属于 Slow Play（慢打），可能错失 Value（价值）。';
      suggestion = '强牌要主动 Raise 做大底池（Build the Pot），对手可能有中等牌力愿意跟注。如果你不加注，等于帮对手免费看牌。';
    } else if (actual === 'call' && ideal === 'fold') {
      analysis = madeInfo + '，' + ehsNote + (potOddsPct > 0 ? '，底池赔率需要 ' + potOddsPct + '%' : '') + '。' + drawNote;
      analysis += '跟注 $' + d.toCall + ' 属于亏损跟注（-EV Call）。';
      suggestion = '当 EHS 低于 Pot Odds 所需胜率时，跟注长期是亏钱的。克服"想看牌"的冲动，果断弃牌保留筹码用于更好的机会。';
    } else if (actual === 'call' && ideal === 'call') {
      analysis = madeInfo + '，' + ehsNote + (potOddsPct > 0 ? '，高于底池赔率所需 ' + potOddsPct + '%' : '') + '。' + drawNote + '跟注是合理的。';
      if (d.drawInfo) analysis += '有听牌在手，跟注争取成牌后翻盘。';
    } else if (actual === 'raise' && ideal === 'raise') {
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + (d.amount ? '加注至 $' + d.amount : '加注') + ' 是正确的 Value Bet（价值下注）' + (d.drawInfo ? '或 Semi-Bluff（半诈唬）' : '') + '。强牌主动下注，最大化赢利。';
    } else if (actual === 'raise' && ideal === 'call') {
      rating = 'good'; ratingIcon = '✓'; ratingLabel = '合理';
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + '加注有一定道理，但中等牌力过度激进可能被更强牌 Re-Raise（再加注）。';
      suggestion = '考虑 Pot Control（控制底池），用跟注代替加注，减少面对强手时的损失。';
    } else if (actual === 'raise' && ideal === 'fold') {
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + '在牌力不足的情况下加注属于纯诈唬（Pure Bluff）。';
      suggestion = '诈唬需要对手有较高的弃牌概率（Fold Equity）。在对手已经表现出强度时诈唬，成功率很低。建议弃牌。';
    } else if (actual === 'check' && ideal === 'raise') {
      var strengthWord = ehsPct != null && ehsPct >= 65 ? '牌力很强' : '牌力不错';
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + '你选择了过牌，但你的' + strengthWord + '。';
      suggestion = '这是一个 Missed Value（错失价值）——过牌让对手免费看牌，可能反超你。建议下注 $' + (d.recommendedAmount || '?') + ' 榨取价值。顶对以上的强牌在大多数牌面上都应该主动下注。';
    } else if (actual === 'check' && (ideal === 'check' || (ideal === 'call' && d.toCall === 0))) {
      analysis = madeInfo + '，' + ehsNote + '。' + drawNote + '过牌是合理的 Pot Control（底池控制），避免用弱牌膨胀底池。';
    } else if (actual === 'check' && ideal === 'fold') {
      rating = 'good'; ratingIcon = '✓'; ratingLabel = '合理';
      analysis = madeInfo + '，过牌观望。没有面对下注时过牌是零成本的选择。';
    } else {
      analysis = madeInfo + '，' + actualZh + '。' + ehsNote + '。';
    }
  }

  return {
    street: d.street,
    streetName: streetLabel,
    actual: actualZh,
    ideal: idealZh,
    rating: rating,
    ratingIcon: ratingIcon,
    ratingLabel: ratingLabel,
    analysis: analysis,
    suggestion: suggestion,
  };
}

function getHandRecap(state) {
  var s = state;
  var decisions = s.heroDecisions || [];
  var heroWon = s.winnerIndices && s.winnerIndices.indexOf(0) >= 0;
  var heroFolded = s.players[0].isFolded;

  var analyzed = [];
  for (var i = 0; i < decisions.length; i++) {
    analyzed.push(_analyzeDecision(decisions[i]));
  }

  var goodCount = 0, mistakeCount = 0;
  for (var j = 0; j < analyzed.length; j++) {
    if (analyzed[j].rating === 'good') goodCount++;
    else mistakeCount++;
  }

  var grade, gradeEmoji, summaryLine;
  if (analyzed.length === 0) {
    grade = '-'; gradeEmoji = '🎲';
    summaryLine = heroFolded
      ? '本局未参与行动。'
      : (heroWon ? '对手弃牌，你自动获胜！' : '本局无需做决策。');
  } else {
    var total = analyzed.length;
    var score = goodCount / total;
    if (score >= 0.95) { grade = 'S'; gradeEmoji = '🏆'; }
    else if (score >= 0.8) { grade = 'A'; gradeEmoji = '⭐'; }
    else if (score >= 0.6) { grade = 'B'; gradeEmoji = '👍'; }
    else if (score >= 0.4) { grade = 'C'; gradeEmoji = '📝'; }
    else { grade = 'D'; gradeEmoji = '💪'; }

    if (mistakeCount === 0) {
      summaryLine = '本局所有决策都很合理，继续保持！' + (heroWon ? '' : '虽然结果不理想，但打法没问题——短期输赢是正常波动（Variance），好的决策长期必然获利。');
    } else if (mistakeCount === 1) {
      summaryLine = '有 1 个关键失误需要注意。' + (heroWon ? '虽然赢了但不要忽视——赢钱的坏习惯比输钱更危险。' : '识别失误是进步的第一步，下次注意规避。');
    } else {
      summaryLine = '有 ' + mistakeCount + ' 个失误，建议重点学习相关概念。不要气馁——每一手牌都是学习机会。';
    }
  }

  var chipDiff = 0, chipStr = '';
  if (s.startingChips) {
    var heroStart = s.startingChips[0] || 0;
    var heroEnd = s.players[0].chips;
    chipDiff = heroEnd - heroStart;
    chipStr = chipDiff >= 0 ? '+$' + chipDiff : '-$' + Math.abs(chipDiff);
  }

  var showdownSummary = '';
  var active = s.players.filter(function (p) { return !p.isFolded; });
  if (active.length <= 1) {
    var winner = s.winnerIndices && s.winnerIndices.length ? s.players[s.winnerIndices[0]] : null;
    showdownSummary = winner ? winner.name + ' 获胜——其他玩家全部弃牌，无需亮牌。' : '';
  } else if (s.communityCards && s.communityCards.length >= 3) {
    var boardStr = s.communityCards.map(cardToStr).join(' ');
    showdownSummary = '【公共牌】' + boardStr + '\n';
    var playerResults = [];
    for (var pi = 0; pi < s.players.length; pi++) {
      var pp = s.players[pi];
      if (pp.isFolded) continue;
      var hand = pp.hand;
      if (!hand || hand.length < 2) continue;
      var ev = bestHand(hand.concat(s.communityCards));
      var rankName = ev && HAND_RANK_ZH[ev.rank] ? HAND_RANK_ZH[ev.rank] : '高牌';
      var isWinner = s.winnerIndices && s.winnerIndices.indexOf(pi) >= 0;
      playerResults.push({
        name: pp.name,
        handStr: handToStr(hand),
        rankName: rankName,
        rankVal: ev ? ev.rank : -1,
        isWinner: isWinner,
      });
    }
    playerResults.sort(function (a, b) { return b.rankVal - a.rankVal; });
    for (var ri = 0; ri < playerResults.length; ri++) {
      var pr = playerResults[ri];
      showdownSummary += (pr.isWinner ? '🏆 ' : '   ') + pr.name + '：' + pr.handStr + ' → ' + pr.rankName + (pr.isWinner ? '（获胜）' : '') + '\n';
    }
    if (playerResults.length >= 2) {
      var winnerR = playerResults.filter(function (x) { return x.isWinner; });
      var loserR = playerResults.filter(function (x) { return !x.isWinner; });
      if (winnerR.length > 0 && loserR.length > 0) {
        if (winnerR[0].rankVal > loserR[0].rankVal) {
          showdownSummary += '\n' + winnerR[0].name + ' 的 ' + winnerR[0].rankName + ' 大于 ' + loserR[0].name + ' 的 ' + loserR[0].rankName + '，牌型更强所以获胜。';
        } else {
          showdownSummary += '\n两者都是 ' + winnerR[0].rankName + '，但 ' + winnerR[0].name + ' 的关键牌更大（踢脚牌 Kicker 更高），所以获胜。';
        }
      }
    }
  }

  return {
    grade: grade,
    gradeEmoji: gradeEmoji,
    summaryLine: summaryLine,
    decisions: analyzed,
    heroWon: heroWon,
    heroFolded: heroFolded,
    chipChange: chipStr,
    chipDiff: chipDiff,
    showdownSummary: showdownSummary,
  };
}

function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tieBreaker.length, b.tieBreaker.length); i++) {
    const x = a.tieBreaker[i] || 0, y = b.tieBreaker[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function bestHand(cards) {
  if (cards.length < 5) return null;
  if (cards.length === 5) return evaluateFive(cards);
  let best = null;
  for (const combo of combinations(cards, 5)) {
    const e = evaluateFive(combo);
    if (!e) continue;
    if (!best || compareEval(best, e) < 0) best = e;
  }
  return best;
}

function requiredEquity(pot, toCall) {
  if (toCall < 0 || pot + toCall <= 0) return 0;
  return toCall / (pot + toCall);
}

const MONTE_CARLO = 800;

function winProbability(myHand, communityCards, opponentHand) {
  const need = 5 - communityCards.length;
  if (need <= 0) {
    const myAll = [...myHand, ...communityCards];
    const oppAll = opponentHand ? [...opponentHand, ...communityCards] : null;
    const myE = bestHand(myAll);
    if (!myE) return 0.5;
    if (!oppAll) return 0.5;
    const oppE = bestHand(oppAll);
    if (!oppE) return 0.5;
    const c = compareEval(myE, oppE);
    if (c > 0) return 1;
    if (c < 0) return 0;
    return 0.5;
  }
  const used = new Set();
  myHand.forEach((c) => used.add(c.suit + c.rank));
  communityCards.forEach((c) => used.add(c.suit + c.rank));
  const remaining = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      if (!used.has(s + r)) remaining.push({ suit: s, rank: r });
    }
  }
  let wins = 0;
  for (let i = 0; i < MONTE_CARLO; i++) {
    const shuf = shuffle(remaining);
    const extra = shuf.slice(0, need);
    const fullComm = [...communityCards, ...extra];
    const opp = opponentHand && opponentHand.length === 2
      ? opponentHand
      : shuf.slice(need, need + 2);
    const myAll = [...myHand, ...fullComm];
    const oppAll = [...opp, ...fullComm];
    const myE = bestHand(myAll);
    const oppE = bestHand(oppAll);
    if (!myE || !oppE) { wins += 0.5; continue; }
    const c = compareEval(myE, oppE);
    if (c > 0) wins += 1;
    else if (c === 0) wins += 0.5;
  }
  return wins / MONTE_CARLO;
}

/**
 * 多人底池胜率：需同时击败 numOpponents 个对手的随机手牌（每人 2 张，从剩余牌堆发）。
 * 用于 AI 在 3+ 人时的决策，避免用单挑胜率高估自己。
 */
function winProbabilityMultiway(myHand, communityCards, numOpponents) {
  if (numOpponents <= 0) return 1;
  if (numOpponents === 1) return winProbability(myHand, communityCards, null);
  var need = 5 - communityCards.length;
  var used = new Set();
  myHand.forEach(function (c) { used.add(c.suit + c.rank); });
  communityCards.forEach(function (c) { used.add(c.suit + c.rank); });
  var remaining = [];
  for (var si = 0; si < SUITS.length; si++) {
    for (var ri = 0; ri < RANKS.length; ri++) {
      var key = SUITS[si] + RANKS[ri];
      if (!used.has(key)) remaining.push({ suit: SUITS[si], rank: RANKS[ri] });
    }
  }
  var wins = 0;
  for (var i = 0; i < MONTE_CARLO; i++) {
    var shuf = shuffle(remaining);
    var extra = shuf.slice(0, need);
    var fullComm = communityCards.concat(extra);
    var myAll = myHand.concat(fullComm);
    var myE = bestHand(myAll);
    if (!myE) { wins += 1 / (numOpponents + 1); continue; }
    var dominated = false;
    var tiedCount = 1;
    for (var o = 0; o < numOpponents; o++) {
      var oHand = shuf.slice(need + o * 2, need + o * 2 + 2);
      var oAll = oHand.concat(fullComm);
      var oE = bestHand(oAll);
      if (!oE) continue;
      var cmp = compareEval(myE, oE);
      if (cmp < 0) { dominated = true; break; }
      if (cmp === 0) tiedCount++;
    }
    if (!dominated) wins += 1 / tiedCount;
  }
  return wins / MONTE_CARLO;
}

// =====================================================================
// AI STRATEGY MODULE — GTO preflop ranges, EHS, draw detection,
// position awareness, semi-bluff, check-raise, action mixing
// =====================================================================

/**
 * GTO-inspired preflop hand ranking (0-1).
 * Based on Sklansky-Chubukov rankings mapped to a normalized 0-1 scale.
 * Covers all 169 distinct starting hands (pair, suited, offsuit).
 */
var PREFLOP_SCORES = {};
(function buildPreflopScores() {
  var pairScores = {14:0.98,13:0.96,12:0.94,11:0.91,10:0.87,9:0.78,8:0.73,7:0.68,6:0.63,5:0.58,4:0.54,3:0.50,2:0.46};
  var suitedScores = {
    '14_13':0.93,'14_12':0.90,'14_11':0.88,'14_10':0.86,'14_9':0.80,'14_8':0.78,'14_7':0.76,'14_6':0.74,'14_5':0.74,'14_4':0.72,'14_3':0.71,'14_2':0.70,
    '13_12':0.85,'13_11':0.83,'13_10':0.81,'13_9':0.74,'13_8':0.70,'13_7':0.66,'13_6':0.64,'13_5':0.63,'13_4':0.61,'13_3':0.60,'13_2':0.58,
    '12_11':0.79,'12_10':0.77,'12_9':0.70,'12_8':0.64,'12_7':0.60,'12_6':0.57,'12_5':0.55,'12_4':0.53,'12_3':0.52,'12_2':0.50,
    '11_10':0.75,'11_9':0.68,'11_8':0.62,'11_7':0.57,'11_6':0.52,'11_5':0.49,'11_4':0.47,'11_3':0.45,'11_2':0.44,
    '10_9':0.66,'10_8':0.60,'10_7':0.55,'10_6':0.50,'10_5':0.46,'10_4':0.43,'10_3':0.41,'10_2':0.40,
    '9_8':0.58,'9_7':0.53,'9_6':0.47,'9_5':0.43,'9_4':0.39,'9_3':0.37,'9_2':0.35,
    '8_7':0.53,'8_6':0.47,'8_5':0.42,'8_4':0.37,'8_3':0.34,'8_2':0.32,
    '7_6':0.48,'7_5':0.43,'7_4':0.37,'7_3':0.33,'7_2':0.30,
    '6_5':0.44,'6_4':0.38,'6_3':0.33,'6_2':0.29,
    '5_4':0.40,'5_3':0.35,'5_2':0.30,
    '4_3':0.33,'4_2':0.28,
    '3_2':0.29
  };
  for (var r in pairScores) PREFLOP_SCORES['P_' + r] = pairScores[r];
  for (var k in suitedScores) {
    PREFLOP_SCORES['S_' + k] = suitedScores[k];
    PREFLOP_SCORES['O_' + k] = Math.max(0, suitedScores[k] - 0.06);
  }
})();

function preflopHandStrength(hand) {
  if (!hand || hand.length !== 2) return 0.5;
  var r1 = hand[0].rank, r2 = hand[1].rank;
  var high = Math.max(r1, r2), low = Math.min(r1, r2);
  var suited = hand[0].suit === hand[1].suit;
  if (high === low) return PREFLOP_SCORES['P_' + high] || 0.45;
  var key = (suited ? 'S_' : 'O_') + high + '_' + low;
  return PREFLOP_SCORES[key] || 0.25;
}

/**
 * Position classification: returns 'EP', 'MP', 'LP', 'SB', or 'BB'.
 */
function getPosition(playerIndex, state) {
  var n = state.players.length;
  var btn = state.dealerButtonIndex != null ? state.dealerButtonIndex : 0;
  var sbPos = (btn + 1) % n;
  var bbPos = (btn + 2) % n;
  if (n === 2) {
    return playerIndex === sbPos ? 'SB' : 'BB';
  }
  if (playerIndex === sbPos) return 'SB';
  if (playerIndex === bbPos) return 'BB';
  if (playerIndex === btn) return 'LP';
  var seat = (playerIndex - bbPos + n) % n;
  var remaining = n - 3;
  if (remaining <= 0) return 'LP';
  if (seat <= Math.ceil(remaining / 3)) return 'EP';
  if (seat <= Math.ceil(remaining * 2 / 3)) return 'MP';
  return 'LP';
}

var POSITION_OPEN_THRESHOLD = { EP: 0.48, MP: 0.40, LP: 0.28, SB: 0.36, BB: 0.22 };

/**
 * 按位置和活跃玩家数动态调整开注阈值。
 * 人越多 EP/MP 需要越强的牌；LP 变化较小。
 */
function getOpenThreshold(position, numActivePlayers) {
  var base = POSITION_OPEN_THRESHOLD[position] || 0.40;
  if (!numActivePlayers || numActivePlayers <= 2) return base;
  var perPlayer = { EP: 0.022, MP: 0.018, LP: 0.008, SB: 0.014, BB: 0.008 };
  var inc = (perPlayer[position] || 0.015) * (numActivePlayers - 2);
  return Math.min(0.82, base + inc);
}

/**
 * Detect draws in hand + community cards.
 * Returns { flushDraw, oesd, gutshot, comboDraw, outs, drawStrength }.
 */
function detectDraws(hand, communityCards) {
  var result = { flushDraw: false, oesd: false, gutshot: false, comboDraw: false, outs: 0, drawStrength: 0 };
  if (!communityCards || communityCards.length < 3) return result;
  var all = hand.concat(communityCards);
  var suitCounts = {};
  for (var i = 0; i < all.length; i++) {
    suitCounts[all[i].suit] = (suitCounts[all[i].suit] || 0) + 1;
  }
  var flushSuit = null;
  for (var s in suitCounts) {
    if (suitCounts[s] === 4) {
      var handHasSuit = hand[0].suit === s || hand[1].suit === s;
      if (handHasSuit) { result.flushDraw = true; flushSuit = s; }
    }
  }
  var ranks = [];
  for (var j = 0; j < all.length; j++) ranks.push(all[j].rank);
  var unique = Array.from(new Set(ranks)).sort(function(a, b) { return a - b; });
  if (unique.indexOf(14) >= 0) unique.unshift(1);
  var maxRun = 0, bestGap = 99;
  for (var start = 0; start <= unique.length - 4; start++) {
    var window5 = [];
    for (var w = start; w < Math.min(start + 5, unique.length); w++) window5.push(unique[w]);
    if (window5.length < 4) continue;
    var span = window5[window5.length - 1] - window5[0];
    if (span <= 4) {
      var missing = 5 - window5.length;
      var handContributes = false;
      for (var h = 0; h < hand.length; h++) {
        var hr = hand[h].rank;
        if (hr === 14 && window5[0] === 1) hr = 1;
        if (window5.indexOf(hr) >= 0) { handContributes = true; break; }
      }
      if (handContributes) {
        if (window5.length >= 4 && span === 3 && missing === 1) {
          result.oesd = true;
        } else if (window5.length >= 4 && missing === 1) {
          result.gutshot = true;
        }
        if (window5.length > maxRun) maxRun = window5.length;
      }
    }
  }
  var straightOuts = 0;
  if (result.oesd) straightOuts = 8;
  else if (result.gutshot) straightOuts = 4;
  var flushOuts = result.flushDraw ? 9 : 0;
  if (result.flushDraw && straightOuts > 0) {
    result.comboDraw = true;
    result.outs = flushOuts + straightOuts - 2;
  } else {
    result.outs = flushOuts + straightOuts;
  }
  var cardsToGo = (communityCards.length === 3) ? 2 : 1;
  if (cardsToGo === 2) {
    result.drawStrength = 1 - Math.pow((46 - result.outs) / 46, 2);
  } else {
    result.drawStrength = result.outs / 46;
  }
  return result;
}

function boardDrawiness(communityCards) {
  if (!communityCards || communityCards.length < 3) return 0;
  var suits = {};
  var ranks = [];
  for (var i = 0; i < communityCards.length; i++) {
    var c = communityCards[i];
    suits[c.suit] = (suits[c.suit] || 0) + 1;
    ranks.push(c.rank);
  }
  var maxSuit = Math.max.apply(null, Object.values(suits));
  ranks.sort(function (a, b) { return a - b; });
  var gaps = 0;
  for (var j = 1; j < ranks.length; j++) gaps += Math.min(2, ranks[j] - ranks[j - 1]);
  var flushDraw = maxSuit >= 3 ? 0.5 : (maxSuit >= 2 ? 0.3 : 0);
  var straightDraw = gaps <= 3 ? 0.35 : (gaps <= 5 ? 0.2 : 0);
  var hasPair = new Set(ranks).size < ranks.length ? 0.1 : 0;
  return Math.min(1, flushDraw + straightDraw + hasPair);
}

// === ADVICE HELPER FUNCTIONS ===

var STREET_NAME_ZH = { 0: '翻前', 1: '翻牌', 2: '转牌', 3: '河牌' };
var RANK_CHAR = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'T',11:'J',12:'Q',13:'K',14:'A'};

function describeHand(hand) {
  if (!hand || hand.length !== 2) return '';
  var r1 = hand[0].rank, r2 = hand[1].rank;
  var high = Math.max(r1, r2), low = Math.min(r1, r2);
  var suited = hand[0].suit === hand[1].suit;
  var h = RANK_CHAR[high] || String(high);
  var l = RANK_CHAR[low] || String(low);
  if (high === low) return h + l;
  return h + l + (suited ? 's' : 'o');
}

function describePosition(pos) {
  var map = { EP: '前位', MP: '中位', LP: '后位(BTN)', SB: '小盲', BB: '大盲' };
  return map[pos] || pos;
}

function describeBoard(communityCards) {
  if (!communityCards || communityCards.length < 3) return null;
  var d = boardDrawiness(communityCards);
  if (d >= 0.7) return '非常湿润';
  if (d >= 0.5) return '湿润';
  if (d >= 0.3) return '半干燥';
  return '干燥';
}

function countAggressors(state) {
  var count = 0;
  for (var i = 0; i < state.players.length; i++) {
    if (i === 0) continue;
    var p = state.players[i];
    if (p.isFolded) continue;
    if (p.lastAction && (p.lastAction.type === 'bet' || p.lastAction.type === 'raise')) count++;
  }
  return count;
}

function calcAdviceBetSize(state, ehs, isBluff) {
  var s = state;
  var human = s.players[0];
  var toCall = getToCall(s);
  var maxBet = Math.max.apply(null, s.players.map(function(p) { return p.currentBet; }));
  if (s.street === 0) {
    var raiseTo = Math.max(Math.floor(maxBet * 2.5), maxBet + s.minRaise);
    var pfMin = maxBet + s.minRaise;
    if (raiseTo < pfMin) raiseTo = pfMin;
    return raiseTo;
  }
  var potAfterCall = s.pot + toCall;
  var raiseAdd = Math.max(s.minRaise, Math.floor(potAfterCall * (isBluff ? 0.55 : (ehs >= 0.7 ? 0.75 : 0.6))));
  var target = maxBet + raiseAdd;
  var minTarget = maxBet + s.minRaise;
  if (target < minTarget) target = minTarget;
  return target;
}

/**
 * EHS-enhanced Monte Carlo: returns { hs, ppot, npot, ehs }.
 * Computes hand strength, positive/negative potential, and effective hand strength
 * in a single simulation pass for efficiency.
 */
function computeEHS(myHand, communityCards, numSimulations, numOpponents) {
  numSimulations = numSimulations || 300;
  numOpponents = Math.max(1, Math.min(numOpponents || 1, 6)); // 最多6个对手避免牌不够
  var need = 5 - communityCards.length;
  if (need <= 0) {
    var hs = winProbabilityMultiway(myHand, communityCards, numOpponents);
    return { hs: hs, ppot: 0, npot: 0, ehs: hs };
  }
  var used = new Set();
  myHand.forEach(function(c) { used.add(c.suit + c.rank); });
  communityCards.forEach(function(c) { used.add(c.suit + c.rank); });
  var remaining = [];
  for (var si = 0; si < SUITS.length; si++) {
    for (var ri = 0; ri < RANKS.length; ri++) {
      var key = SUITS[si] + RANKS[ri];
      if (!used.has(key)) remaining.push({ suit: SUITS[si], rank: RANKS[ri] });
    }
  }
  var aheadNow = 0, behindNow = 0, tiedNow = 0;
  var aheadToBehind = 0, behindToAhead = 0;
  var aheadTotal = 0, behindTotal = 0;
  for (var i = 0; i < numSimulations; i++) {
    var shuf = shuffle(remaining);
    // 依次抽 numOpponents 个对手的手牌，再抽公牌
    var oppHands = [];
    for (var o = 0; o < numOpponents; o++) {
      oppHands.push(shuf.slice(o * 2, o * 2 + 2));
    }
    var futureCards = shuf.slice(numOpponents * 2, numOpponents * 2 + need);
    var fullComm = communityCards.concat(futureCards);

    // 当前局面：和所有对手比较
    var myAllNow = myHand.concat(communityCards);
    var myENow = myAllNow.length >= 5 ? bestHand(myAllNow) : null;
    var currentResult = 1; // 1=领先 0=平局 -1=落后
    for (var o2 = 0; o2 < oppHands.length; o2++) {
      var oppNow = oppHands[o2].concat(communityCards);
      if (oppNow.length < 5) continue;
      var oppENow = bestHand(oppNow);
      if (!oppENow) continue;
      var cmp = myENow ? compareEval(myENow, oppENow) : -1;
      if (cmp < 0) { currentResult = -1; break; }
      if (cmp === 0) currentResult = Math.min(currentResult, 0);
    }

    // 未来局面：和所有对手比较
    var myFuture = bestHand(myHand.concat(fullComm));
    var futureResult = 1;
    for (var o3 = 0; o3 < oppHands.length; o3++) {
      var oppFuture = bestHand(oppHands[o3].concat(fullComm));
      if (!oppFuture) continue;
      var cmp2 = myFuture ? compareEval(myFuture, oppFuture) : -1;
      if (cmp2 < 0) { futureResult = -1; break; }
      if (cmp2 === 0) futureResult = Math.min(futureResult, 0);
    }

    if (currentResult > 0) {
      aheadNow++; aheadTotal++;
      if (futureResult < 0) aheadToBehind++;
    } else if (currentResult < 0) {
      behindNow++; behindTotal++;
      if (futureResult > 0) behindToAhead++;
    } else {
      tiedNow++;
      aheadTotal += 0.5; behindTotal += 0.5;
      if (futureResult > 0) behindToAhead += 0.5;
      if (futureResult < 0) aheadToBehind += 0.5;
    }
  }
  var hs = (aheadNow + tiedNow * 0.5) / numSimulations;
  var ppot = behindTotal > 0 ? behindToAhead / behindTotal : 0;
  var npot = aheadTotal > 0 ? aheadToBehind / aheadTotal : 0;
  var ehs = hs * (1 - npot) + (1 - hs) * ppot;
  return { hs: hs, ppot: ppot, npot: npot, ehs: ehs };
}

/**
 * Mixing helper: returns true with the given probability (0-1).
 */
function mixedAction(probability) {
  return Math.random() < probability;
}

/**
 * SPR-aware bet sizing for AI.
 * Lower SPR → more willing to commit; higher SPR → more cautious sizing.
 * Bluffs use ~60-75% pot; value bets vary by strength and board.
 */
function aiBetSize(pot, toCall, minRaise, ehs, aiCurrentBet, aiChips, communityCards, isBluff, bb) {
  return humanizedBetSize(pot, toCall, minRaise, ehs, aiCurrentBet, aiChips, communityCards, isBluff, bb, 1.0, isBluff ? 'bluff' : 'value');
}

function recommend(hand, state) {
  var s = state;
  var toCall = getToCall(s);
  var position = getPosition(0, s);
  var posDesc = describePosition(position);
  var handDesc = describeHand(hand);
  var isPreflop = s.street === 0;
  var streetName = STREET_NAME_ZH[s.street] || '翻前';
  var aggressors = countAggressors(s);
  var activeOpponents = 0;
  for (var i = 0; i < s.players.length; i++) {
    if (i !== 0 && !s.players[i].isFolded) activeOpponents++;
  }
  var potOdds = toCall > 0 ? requiredEquity(s.pot, toCall) : 0;
  var human = s.players[0];
  var spr = s.pot > 0 ? human.chips / s.pot : 99;
  var result = {
    action: '过牌',
    betAmount: null,
    coach: '',
    winProbability: 0,
    tier: '',
    requiredEquity: potOdds,
    details: {
      street: isPreflop ? 'preflop' : (['', 'flop', 'turn', 'river'][s.street] || 'flop'),
      streetName: streetName,
      handDesc: handDesc,
      handStrength: null,
      position: position,
      positionDesc: posDesc,
      drawInfo: null,
      drawIcon: '',
      ehs: null,
      potOdds: potOdds,
      spr: Math.round(spr * 10) / 10,
      opponentsBetting: aggressors,
    }
  };
  if (isPreflop) return recommendPreflop(hand, s, result, toCall, position);
  return recommendPostflop(hand, s, result, toCall, position);
}

function winTier(wp) {
  if (wp >= 0.65) return { label: '强牌', cls: 'strong' };
  if (wp >= 0.45) return { label: '中强', cls: 'good' };
  if (wp >= 0.30) return { label: '边缘', cls: 'marginal' };
  return { label: '弱牌', cls: 'weak' };
}

function positionAdvantageNote(position) {
  if (position === 'LP') return '你在后位（Late Position），拥有位置优势，可以观察对手行动后再做决策。';
  if (position === 'MP') return '你在中位（Middle Position），需要比后位更谨慎选择起手牌。';
  if (position === 'EP') return '你在前位（Early Position），行动最早，需用更强的牌进入底池。';
  if (position === 'SB') return '你在小盲（Small Blind），翻后处于不利位置，需要手牌补偿位置劣势。';
  if (position === 'BB') return '你在大盲（Big Blind），翻前有折扣，但翻后位置不利。';
  return '';
}

function recommendPreflop(hand, s, result, toCall, position) {
  var handStr = preflopHandStrength(hand);
  var wp = winProbability(hand, [], null);
  result.winProbability = wp;
  result.details.handStrength = handStr;
  var tier = winTier(wp);
  result.tier = tier.cls;
  var pct = Math.round(wp * 100);
  var handStrPct = Math.round(handStr * 100);
  var openThresh = getOpenThreshold(position, activeOpponents + 1);
  var posInfo = result.details.positionDesc;
  var handInfo = result.details.handDesc;
  var posNote = positionAdvantageNote(position);
  var aggressorCount = result.details.opponentsBetting;

  if (toCall === 0) {
    if (handStr >= 0.80) {
      var betAmt = calcAdviceBetSize(s, 0.85, false);
      result.action = '加注';
      result.betAmount = betAmt;
      result.coach = handInfo + ' 属于翻前顶级起手牌（Premium Hand），胜率 ' + pct + '%。'
        + posNote
        + ' 建议 Open Raise（开注）至 $' + betAmt + '，用强牌主动建立底池、获取价值。';
      return result;
    }
    if (handStr >= openThresh) {
      var betAmt2 = calcAdviceBetSize(s, 0.6, false);
      result.action = '加注';
      result.betAmount = betAmt2;
      result.coach = handInfo + ' 在' + posInfo + '达到 Open Raise（开注）标准，胜率 ' + pct + '%。'
        + posNote
        + ' 建议开注至 $' + betAmt2 + '，争夺盲注并在翻后拿到主动权。';
      return result;
    }
    result.action = '过牌';
    result.coach = handInfo + ' 在' + posInfo + '偏弱（强度 ' + handStrPct + '%），不建议主动 Open。'
      + posNote
      + ' 建议过牌（Check）观望，不要用弱牌打大底池。';
    return result;
  }

  var betPressure = toCall / (s.pot + toCall);
  var BASE_FOLD_THRESH = { EP: 0.45, MP: 0.38, LP: 0.28, SB: 0.35, BB: 0.22 };
  var baseFold = getOpenThreshold(position, activeOpponents + 1) * 0.95;
  var effectiveThresh = baseFold + betPressure * 0.3;
  var potOddsPct = Math.round(result.requiredEquity * 100);
  var oppPressure = aggressorCount > 0 ? '已有 ' + aggressorCount + ' 人加注，对手范围较强，需要更好的牌才能继续。' : '';

  if (handStr >= 0.80) {
    var raiseAmt = calcAdviceBetSize(s, 0.85, false);
    result.action = '加注';
    result.betAmount = raiseAmt;
    result.coach = handInfo + ' 是顶级手牌，胜率 ' + pct + '%。' + oppPressure
      + ' 建议 3-Bet（对加注再加注）至 $' + raiseAmt + '，用强牌打出更大底池以最大化 Value（价值）。';
    return result;
  }
  if (handStr >= effectiveThresh + 0.15 && handStr >= 0.65) {
    var raiseAmt2 = calcAdviceBetSize(s, 0.7, false);
    result.action = '加注';
    result.betAmount = raiseAmt2;
    result.coach = handInfo + ' 强度 ' + handStrPct + '% 明显超过跟注标准。' + oppPressure
      + ' 可以 3-Bet 至 $' + raiseAmt2 + '，通过加注获取 Fold Equity（弃牌权益），让弱牌出局。';
    return result;
  }
  if (handStr >= effectiveThresh) {
    result.action = '跟注';
    result.coach = handInfo + ' 强度足够跟注（Pot Odds 底池赔率 ' + potOddsPct + '%）。' + oppPressure
      + ' 跟注 $' + toCall + ' 观察翻牌（Flop），翻后根据公共牌再做判断。';
    return result;
  }
  if (handStr >= effectiveThresh - 0.08) {
    result.action = '弃牌';
    result.coach = handInfo + ' 处于边缘，强度 ' + handStrPct + '% 略低于跟注线。' + oppPressure
      + ' 边缘牌（Marginal Hand）长期跟注是亏损的，建议 Fold 等待更好机会。';
    return result;
  }
  result.action = '弃牌';
  result.coach = handInfo + ' 偏弱（强度 ' + handStrPct + '%），底池赔率不足以支撑跟注。' + oppPressure
    + ' 弱牌果断 Fold，德扑的核心之一是选择性参与——只在有优势时入池。';
  return result;
}

function recommendPostflop(hand, s, result, toCall, position) {
  var wp = winProbability(hand, s.communityCards, null);
  var ehsData = computeEHS(hand, s.communityCards, 300, activeOpponents);
  var ehs = ehsData.ehs;
  var draws = detectDraws(hand, s.communityCards);
  var human = s.players[0];
  var spr = s.pot > 0 ? human.chips / s.pot : 99;
  result.winProbability = wp;
  result.details.ehs = Math.round(ehs * 100);
  var tier = winTier(ehs);
  result.tier = tier.cls;

  var drawInfoStr = null;
  var drawIcon = '';
  if (draws.flushDraw && draws.oesd) { drawInfoStr = '同花 + 顺子双听（Combo Draw）· ' + draws.outs + ' Outs · 成牌率 ' + Math.round(draws.drawStrength * 100) + '%'; drawIcon = '♠♣'; }
  else if (draws.flushDraw) { drawInfoStr = '同花听牌（Flush Draw）· ' + draws.outs + ' Outs · 成牌率 ' + Math.round(draws.drawStrength * 100) + '%'; drawIcon = '♠'; }
  else if (draws.oesd) { drawInfoStr = '两头顺子听牌（OESD）· ' + draws.outs + ' Outs · 成牌率 ' + Math.round(draws.drawStrength * 100) + '%'; drawIcon = '🔗'; }
  else if (draws.gutshot) { drawInfoStr = '卡顺听牌（Gutshot）· ' + draws.outs + ' Outs · 成牌率 ' + Math.round(draws.drawStrength * 100) + '%'; drawIcon = '🎯'; }
  result.details.drawInfo = drawInfoStr;
  result.details.drawIcon = drawIcon;

  var ehsPct = Math.round(ehs * 100);
  var potOddsPct = Math.round(result.requiredEquity * 100);
  var madeHand = bestHand(hand.concat(s.communityCards));
  var madeHandName = madeHand && HAND_RANK_ZH[madeHand.rank] ? HAND_RANK_ZH[madeHand.rank] : '高牌';
  var impliedOdds = draws.drawStrength > 0.15 ? draws.drawStrength * 0.4 : 0;
  var effectiveEhs = ehs + impliedOdds;
  var aggressorCount = result.details.opponentsBetting;
  var oppNote = aggressorCount > 0 ? '对手有 ' + aggressorCount + ' 人下注表现出强度，' : '';
  var streetLabel = result.details.streetName;
  var drawCoachNote = '';
  if (draws.comboDraw) drawCoachNote = '你持有 Combo Draw（双听牌），有 ' + draws.outs + ' 张 Outs，在后续街中成牌率很高。';
  else if (draws.flushDraw) drawCoachNote = '你有 Flush Draw（同花听牌），' + draws.outs + ' 张 Outs。';
  else if (draws.oesd) drawCoachNote = '你有 OESD（两头顺子听牌），' + draws.outs + ' 张 Outs，成牌概率不错。';
  else if (draws.gutshot) drawCoachNote = '你有 Gutshot（卡顺听牌），仅 ' + draws.outs + ' 张 Outs，成牌率较低。';

  var sprNote = '';
  if (spr <= 2) sprNote = ' SPR（筹码底池比）很低，适合果断 All-in 或弃牌，不适合慢打。';
  else if (spr <= 5) sprNote = ' SPR 中等，大牌可以争取在本街打到全下。';

  if (toCall === 0) {
    if (ehs >= 0.70) {
      var betAmt = calcAdviceBetSize(s, ehs, false);
      result.action = '下注';
      result.betAmount = betAmt;
      result.coach = '你的牌力很强——' + madeHandName + '，EHS（有效手牌强度） ' + ehsPct + '%。'
        + oppNote
        + ' 建议 Value Bet（价值下注）$' + betAmt + '，向对手的中等牌力榨取价值。' + sprNote;
      return result;
    }
    if (ehs >= 0.50) {
      var betAmt2 = calcAdviceBetSize(s, ehs, false);
      result.action = '下注';
      result.betAmount = betAmt2;
      result.coach = madeHandName + '，EHS ' + ehsPct + '% 属于中等偏强。'
        + drawCoachNote
        + ' 建议下注 $' + betAmt2 + ' 争夺底池主动权（Initiative），同时保护你的牌不被免费看牌追上。' + sprNote;
      return result;
    }
    if (draws.outs >= 8) {
      var betAmt3 = calcAdviceBetSize(s, 0.45, true);
      result.action = '下注';
      result.betAmount = betAmt3;
      result.coach = '目前是' + madeHandName + '，牌力一般，但' + drawCoachNote
        + ' 建议 Semi-Bluff（半诈唬）$' + betAmt3 + '——即使对手跟注你仍有成牌机会，对手弃牌你直接赢下底池。这是听牌的标准打法。';
      return result;
    }
    if (draws.outs >= 4 && spr > 3) {
      var betAmt4 = calcAdviceBetSize(s, 0.35, true);
      result.action = '下注';
      result.betAmount = betAmt4;
      result.coach = madeHandName + '。' + drawCoachNote
        + ' 可以用小额 Probe Bet（试探下注）$' + betAmt4 + '，测试对手的牌力。如果被加注，考虑放弃。';
      return result;
    }
    result.action = '过牌';
    result.coach = madeHandName + '，EHS ' + ehsPct + '% 偏弱。' + drawCoachNote
      + ' 建议 Check（过牌），控制底池大小（Pot Control），不要在弱牌时膨胀底池。';
    return result;
  }

  if (ehs >= 0.75) {
    var raiseAmt = calcAdviceBetSize(s, ehs, false);
    result.action = '加注';
    result.betAmount = raiseAmt;
    result.coach = madeHandName + '，EHS ' + ehsPct + '% 非常强！' + oppNote
      + '建议 Raise（加注）至 $' + raiseAmt + ' 打出更大底池。强牌要敢于 Build Pot（做大底池），最大化赢利。' + sprNote;
    return result;
  }
  if (effectiveEhs >= result.requiredEquity + 0.20 && ehs >= 0.60) {
    var raiseAmt2 = calcAdviceBetSize(s, ehs, false);
    result.action = '加注';
    result.betAmount = raiseAmt2;
    result.coach = madeHandName + '，EHS ' + ehsPct + '% 远超跟注所需的 ' + potOddsPct + '%。'
      + drawCoachNote + oppNote
      + ' 可以 Raise 至 $' + raiseAmt2 + '，既榨取价值，也给对手施压获得 Fold Equity（弃牌权益）。';
    return result;
  }
  if (effectiveEhs >= result.requiredEquity + 0.10) {
    result.action = '跟注';
    result.coach = madeHandName + '。' + oppNote + 'EHS ' + ehsPct + '% 高于 Pot Odds（底池赔率）所需的 ' + potOddsPct + '%，跟注 $' + toCall + ' 是 +EV（正期望值）的。'
      + drawCoachNote
      + ' 跟注是合理的，翻后继续观察。';
    return result;
  }
  if (effectiveEhs >= result.requiredEquity) {
    result.action = '跟注';
    result.coach = madeHandName + '。EHS ' + ehsPct + '% 刚好够上 Pot Odds ' + potOddsPct + '%。'
      + drawCoachNote
      + ' 赔率合适，可以 Call $' + toCall + '，但如果后续街对手继续施压，需要重新评估。';
    return result;
  }
  if (draws.outs >= 8 && spr > 3) {
    result.action = '跟注';
    result.coach = madeHandName + '。' + drawCoachNote + oppNote
      + ' 虽然直接赔率（Direct Odds）略差，但 Implied Odds（隐含赔率）好——如果成牌后能从对手那里赢到更多筹码。SPR ' + result.details.spr + '，可以跟注 $' + toCall + '。';
    return result;
  }
  if (effectiveEhs >= result.requiredEquity - 0.05) {
    result.action = '跟注';
    result.coach = madeHandName + '。EHS ' + ehsPct + '% 接近所需 ' + potOddsPct + '%，属于边缘决策。'
      + drawCoachNote
      + ' 勉强可跟 $' + toCall + '，但注意这类 Marginal Call 长期是微利的，控制好心态。';
    return result;
  }
  result.action = '弃牌';
  result.coach = madeHandName + '。EHS ' + ehsPct + '% 低于所需 ' + potOddsPct + '%，跟注是 -EV（负期望值）的。'
    + drawCoachNote + oppNote
    + ' 果断 Fold——及时止损比死守弱牌更重要。';
  return result;
}

// ---------- 游戏状态与轮次 ----------
const STREET = { PREFLOP: 0, FLOP: 1, TURN: 2, RIVER: 3, SHOWDOWN: 4 };

function createPlayer(name, chips, isHuman, style) {
  if (isHuman == null) isHuman = false;
  return {
    name: name,
    chips: chips,
    hand: [],
    isFolded: false,
    currentBet: 0,
    totalBetThisHand: 0,
    isHuman: isHuman,
    lastAction: null,
    actedThisStreet: false,
    style: style || null,
  };
}

var ROBOT_NAMES = ['Robot A', 'Robot B', 'Robot C', 'Robot D', 'Robot E', 'Robot F', 'Robot G', 'Robot H', 'Robot I'];

var AI_STYLES = [
  { label: 'TAG',     weight: 20,
    openMod: 0.90, aggrMod: 1.30, bluffMod: 0.8,  foldMod: 1.10,
    fearMod: 1.20, commitMod: 0.3, raiseThr: 0.72, sizingMod: 0.85 },
  { label: 'LAG',     weight: 12,
    openMod: 1.20, aggrMod: 1.25, bluffMod: 1.5,  foldMod: 0.80,
    fearMod: 0.70, commitMod: 0.5, raiseThr: 0.58, sizingMod: 1.05 },
  { label: 'TP',      weight: 10,
    openMod: 0.80, aggrMod: 0.70, bluffMod: 0.3,  foldMod: 1.25,
    fearMod: 1.40, commitMod: 0.2, raiseThr: 0.82, sizingMod: 0.70 },
  { label: 'LP',      weight: 8,
    openMod: 1.25, aggrMod: 0.65, bluffMod: 0.5,  foldMod: 0.70,
    fearMod: 0.60, commitMod: 0.8, raiseThr: 0.85, sizingMod: 0.75 },
  { label: 'GTO',     weight: 5,
    openMod: 1.00, aggrMod: 1.00, bluffMod: 1.0,  foldMod: 1.00,
    fearMod: 1.00, commitMod: 0.4, raiseThr: 0.68, sizingMod: 1.00 },
  { label: 'MANIAC',  weight: 3,
    openMod: 1.40, aggrMod: 1.50, bluffMod: 2.0,  foldMod: 0.55,
    fearMod: 0.30, commitMod: 0.9, raiseThr: 0.40, sizingMod: 1.30 },
  { label: 'NIT',     weight: 10,
    openMod: 0.70, aggrMod: 0.80, bluffMod: 0.2,  foldMod: 1.40,
    fearMod: 1.80, commitMod: 0.1, raiseThr: 0.85, sizingMod: 0.65 },
  { label: 'SHARK',   weight: 7,
    openMod: 1.05, aggrMod: 1.15, bluffMod: 1.2,  foldMod: 0.95,
    fearMod: 0.90, commitMod: 0.35, raiseThr: 0.65, sizingMod: 1.00 },
  { label: 'FISH',    weight: 25,
    openMod: 1.30, aggrMod: 0.60, bluffMod: 0.4,  foldMod: 0.65,
    fearMod: 0.50, commitMod: 0.85, raiseThr: 0.90, sizingMod: 0.80 },
];

function pickRandomStyle() {
  var totalWeight = 0;
  for (var i = 0; i < AI_STYLES.length; i++) totalWeight += AI_STYLES[i].weight;
  var roll = Math.random() * totalWeight;
  var cumulative = 0;
  for (var j = 0; j < AI_STYLES.length; j++) {
    cumulative += AI_STYLES[j].weight;
    if (roll < cumulative) return AI_STYLES[j];
  }
  return AI_STYLES[0];
}

// =====================================================================
// 5-LAYER AI DECISION ENGINE
// =====================================================================

function calcFearLevel(toCall, initialStack, street, fearMod, totalBet) {
  if (toCall <= 0) return 0;
  var ratio = toCall / Math.max(1, initialStack);
  var baseFear;
  if (ratio < 0.05)      baseFear = 0.05;
  else if (ratio < 0.10) baseFear = 0.18;
  else if (ratio < 0.20) baseFear = 0.35;
  else if (ratio < 0.35) baseFear = 0.55;
  else if (ratio < 0.50) baseFear = 0.72;
  else                    baseFear = 0.90;
  var alreadyInRatio = (totalBet || 0) / Math.max(1, initialStack);
  if (alreadyInRatio > 0.5) baseFear += 0.15;
  else if (alreadyInRatio > 0.3) baseFear += 0.08;
  var streetMult = street === 0 ? 0.7 : (street === 3 ? 1.25 : 1.0);
  return Math.min(1, baseFear * streetMult * (fearMod || 1.0));
}

function calcCommitPressure(totalBet, initialStack, commitMod) {
  var ratio = totalBet / Math.max(1, initialStack);
  if (ratio < 0.10) return 0;
  if (ratio < 0.25) return 0.15;
  if (ratio < 0.50) return 0.35;
  if (ratio < 0.75) return 0.55;
  return 0.75;
}

function readThreatLevel(state, aiIndex) {
  var log = state.actionLog || [];
  var threat = 0;
  var oppRaises = 0;
  var oppBetsThisStreet = 0;
  for (var i = 0; i < log.length; i++) {
    var entry = log[i];
    if (entry.player === aiIndex) continue;
    if (entry.action === 'raise' || entry.action === 'bet') {
      oppRaises++;
      if (entry.street === state.street) oppBetsThisStreet++;
    }
  }
  threat += Math.min(0.4, oppRaises * 0.12);
  threat += oppBetsThisStreet * 0.15;
  var raiseCount = state.raiseCountThisStreet || 0;
  if (raiseCount >= 3) threat += 0.25;
  else if (raiseCount >= 2) threat += 0.12;
  return Math.min(1, threat);
}

function calcRequiredStrength(baseLine, fear, threat, commitPressure, commitMod) {
  var committed = commitPressure * commitMod;
  return Math.max(0.10, Math.min(0.95,
    baseLine + fear * 0.35 + threat * 0.20 - committed * 0.15
  ));
}

function humanizedBetSize(pot, toCall, minRaise, ehs, aiCurrentBet, aiChips, communityCards, isBluff, bb, sizingMod, intent) {
  var drawiness = boardDrawiness(communityCards || []);
  var initialStack = (aiCurrentBet + aiChips) || (bb ? 100 * bb : 1000);
  var potFraction;

  if (intent === 'value') {
    potFraction = 0.50 + (ehs - 0.5) * 0.5 + drawiness * 0.10;
    potFraction = Math.max(0.40, Math.min(0.85, potFraction));
  } else if (intent === 'bluff') {
    potFraction = 0.38 + drawiness * 0.12;
    potFraction = Math.max(0.33, Math.min(0.65, potFraction));
  } else {
    potFraction = 0.45 + drawiness * 0.08;
  }

  potFraction *= (sizingMod || 1.0);
  potFraction = Math.min(1.0, potFraction);

  var addAmount = Math.max(minRaise, Math.floor(pot * potFraction));
  var targetBet = aiCurrentBet + addAmount;
  if (targetBet <= aiCurrentBet) targetBet = aiCurrentBet + minRaise;

  var hardCap = aiCurrentBet + aiChips;
  if (targetBet > hardCap) targetBet = hardCap;
  if (targetBet <= aiCurrentBet) targetBet = aiCurrentBet + minRaise;

  return targetBet;
}

function createGameState(initialChips, playerCount) {
  if (playerCount == null) playerCount = 2;
  if (initialChips == null) initialChips = 500;
  var players = [createPlayer('你', initialChips, true, null)];
  for (var i = 1; i < playerCount; i++) {
    var style = pickRandomStyle();
    players.push(createPlayer(ROBOT_NAMES[i - 1] || ('Robot ' + i), initialChips, false, style));
  }
  return {
    players: players,
    communityCards: [],
    pot: 0,
    street: STREET.PREFLOP,
    currentPlayerIndex: 0,
    minRaise: 10,
    lastBetAmount: 10,
    handOver: false,
    winnerIndex: null,
    winnerIndices: null,
    message: '',
    deck: [],
    dealerButtonIndex: 0,
    firstToActThisStreet: 0,
    sbPosition: 0,
    bbPosition: 1,
    actionLog: [],
  };
}

function getToCall(state) {
  const cur = state.players[state.currentPlayerIndex];
  if (!cur || cur.isFolded) return 0;
  const maxBet = Math.max(...state.players.map((p) => p.currentBet));
  return Math.max(0, maxBet - cur.currentBet);
}

class PokerGame {
  constructor(sb, bb, initialChips, playerCount) {
    this.sb = sb == null ? 5 : sb;
    this.bb = bb == null ? 10 : bb;
    var n = playerCount == null || playerCount < 2 ? 2 : (playerCount > 8 ? 8 : playerCount);
    this.playerCount = n;
    var stack = initialChips != null ? initialChips : (100 * this.bb);
    this.state = createGameState(stack, n);
    this.deck = [];
  }

  getState() {
    return this.state;
  }

  getToCall() {
    return getToCall(this.state);
  }

  getAdvice() {
    const s = this.state;
    if (s.handOver || s.currentPlayerIndex !== 0) return null;
    const human = s.players[0];
    if (!human || human.isFolded || human.hand.length !== 2) return null;
    return recommend(human.hand, s);
  }

  startNewHand() {
    var s = this.state;
    if (s.players.length < 2) return;
    s.handOver = false;
    s.winnerIndex = null;
    s.winnerIndices = null;
    s.message = '';
    s.communityCards = [];
    s.street = STREET.PREFLOP;
    s.lastBetAmount = this.bb;
    s.minRaise = this.bb;
    s.raiseCountThisStreet = 0;
    var n = s.players.length;
    var btn = s.dealerButtonIndex != null ? s.dealerButtonIndex : 0;
    s.dealerButtonIndex = btn;
    if (n === 2) {
      s.sbPosition = btn;
      s.bbPosition = (btn + 1) % n;
    } else {
      s.sbPosition = (btn + 1) % n;
      s.bbPosition = (btn + 2) % n;
    }
    var sbPos = s.sbPosition;
    var bbPos = s.bbPosition;
    s.players.forEach(function (p) {
      p.hand = [];
      p.isFolded = false;
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.lastAction = null;
      p.actedThisStreet = false;
    });
    this.deck = shuffle(createDeck());
    for (var i = 0; i < n; i++) {
      s.players[i].hand = [this.deck.pop(), this.deck.pop()];
    }
    s.sbPosition = sbPos;
    s.bbPosition = bbPos;
    var sbAmt = this.sb;
    var bbAmt = this.bb;
    s.players[sbPos].chips -= sbAmt;
    s.players[sbPos].currentBet = sbAmt;
    s.players[sbPos].totalBetThisHand = sbAmt;
    s.players[sbPos].lastAction = { type: 'bet', amount: sbAmt };
    s.players[bbPos].chips -= bbAmt;
    s.players[bbPos].currentBet = bbAmt;
    s.players[bbPos].totalBetThisHand = bbAmt;
    s.players[bbPos].lastAction = { type: 'bet', amount: bbAmt };
    s.pot = sbAmt + bbAmt;
    s.sb = this.sb;
    s.bb = this.bb;
    s.actionLog = [
      { street: 0, player: sbPos, name: s.players[sbPos].name, action: 'sb', amount: sbAmt },
      { street: 0, player: bbPos, name: s.players[bbPos].name, action: 'bb', amount: bbAmt }
    ];
    s.heroDecisions = [];
    s.startingChips = s.players.map(function (p) { return p.chips + p.totalBetThisHand; });
    if (n === 2) {
      s.firstToActThisStreet = sbPos;
      s.currentPlayerIndex = sbPos;
    } else {
      s.firstToActThisStreet = (bbPos + 1) % n;
      s.currentPlayerIndex = s.firstToActThisStreet;
    }
    while (s.players[s.currentPlayerIndex].isFolded) this.nextPlayer();
  }

  _snapshotHumanDecision(action, amount) {
    var s = this.state;
    var idx = s.currentPlayerIndex;
    if (idx !== 0) return;
    if (!s.heroDecisions) s.heroDecisions = [];
    var hand = s.players[0].hand;
    if (!hand || hand.length !== 2) return;
    var adv = recommend(hand, s);
    var toCall = getToCall(s);
    var snapshot = {
      street: s.street,
      streetName: STREET_NAME_ZH[s.street] || '翻前',
      action: action,
      amount: amount || 0,
      toCall: toCall,
      pot: s.pot,
      handDesc: describeHand(hand),
      recommended: adv ? adv.action : null,
      recommendedAmount: adv ? adv.betAmount : null,
      winProbability: adv ? adv.winProbability : 0,
      requiredEquity: adv ? adv.requiredEquity : 0,
      ehs: adv && adv.details ? adv.details.ehs : null,
      handStrength: adv && adv.details ? adv.details.handStrength : null,
      position: adv && adv.details ? adv.details.positionDesc : '',
      drawInfo: adv && adv.details ? adv.details.drawInfo : null,
      madeHand: null,
    };
    if (s.street > 0 && s.communityCards.length >= 3) {
      var ev = bestHand(hand.concat(s.communityCards));
      snapshot.madeHand = ev && HAND_RANK_ZH[ev.rank] ? HAND_RANK_ZH[ev.rank] : '高牌';
    }
    s.heroDecisions.push(snapshot);
  }

  act(action, amount) {
    const s = this.state;
    const idx = s.currentPlayerIndex;
    const p = s.players[idx];
    if (!p || p.isFolded) return;
    this._snapshotHumanDecision(action, amount);
    if (action === 'fold') {
      p.lastAction = { type: 'fold' };
      p.isFolded = true;
      p.actedThisStreet = true;
      s.actionLog.push({ street: s.street, player: idx, name: p.name, action: 'fold', amount: 0 });
      var n = s.players.length;
      if (idx === s.firstToActThisStreet) {
        var nextActive = (idx + 1) % n;
        while (s.players[nextActive].isFolded) {
          nextActive = (nextActive + 1) % n;
          if (nextActive === idx) break;
        }
        s.firstToActThisStreet = nextActive;
      }
      this.advance();
      return;
    }
    var toCallCheck = getToCall(s);
    if (action === 'check') {
      if (toCallCheck > 0) {
        return;
      } else {
        p.lastAction = { type: 'check' };
        p.actedThisStreet = true;
        s.actionLog.push({ street: s.street, player: idx, name: p.name, action: 'check', amount: 0 });
        this.advance();
        return;
      }
    }
    const toCall = toCallCheck;
    if (action === 'call') {
      p.chips -= toCall;
      p.currentBet += toCall;
      p.totalBetThisHand += toCall;
      s.pot += toCall;
      p.lastAction = { type: 'call', amount: toCall };
      p.actedThisStreet = true;
      s.actionLog.push({ street: s.street, player: idx, name: p.name, action: 'call', amount: toCall });
      this.advance();
      return;
    }
    if (action === 'bet' || action === 'raise') {
      var maxBet = Math.max.apply(null, s.players.map(function (x) { return x.currentBet; }));
      var targetBet = typeof amount === 'number' ? amount : (p.currentBet + s.pot);
      var minValidRaise = maxBet + s.minRaise;
      if (targetBet < minValidRaise && targetBet > p.currentBet) {
        targetBet = minValidRaise;
      }
      var toAdd = Math.max(0, targetBet - p.currentBet);
      if (toAdd <= 0) return;
      p.chips -= toAdd;
      p.currentBet += toAdd;
      p.totalBetThisHand += toAdd;
      s.pot += toAdd;
      s.lastBetAmount = p.currentBet - maxBet;
      s.minRaise = Math.max(s.minRaise, s.lastBetAmount);
      s.raiseCountThisStreet = (s.raiseCountThisStreet || 0) + 1;
      p.lastAction = { type: action, amount: toAdd };
      p.actedThisStreet = true;
      s.actionLog.push({ street: s.street, player: idx, name: p.name, action: action, amount: p.currentBet, totalBet: p.currentBet });
      this.advance();
    }
  }

  advance() {
    var s = this.state;
    var active = s.players.filter(function (p) { return !p.isFolded; });
    var maxBet = Math.max.apply(null, s.players.map(function (p) { return p.currentBet; }));
    var allMatched = active.every(function (p) { return p.currentBet === maxBet; });
    if (active.length <= 1) {
      this.endHand();
      return;
    }
    if (allMatched) {
      var allActed = active.every(function (p) { return p.actedThisStreet; });
      if (allActed) {
        this._advanceStreet();
        return;
      }
      this.nextPlayer();
      if (s.players[s.currentPlayerIndex] && s.players[s.currentPlayerIndex].actedThisStreet) {
        this._advanceStreet();
      }
      return;
    }
    this.nextPlayer();
  }

  _advanceStreet() {
    var s = this.state;
    s.players.forEach(function (p) { p.currentBet = 0; p.actedThisStreet = false; });
    s.lastBetAmount = 0;
    s.minRaise = this.bb;
    s.raiseCountThisStreet = 0;
    if (s.street === STREET.PREFLOP) {
      s.street = STREET.FLOP;
      this.deck.pop();
      s.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.setFirstToAct();
    } else if (s.street === STREET.FLOP) {
      s.street = STREET.TURN;
      this.deck.pop();
      s.communityCards.push(this.deck.pop());
      this.setFirstToAct();
    } else if (s.street === STREET.TURN) {
      s.street = STREET.RIVER;
      this.deck.pop();
      s.communityCards.push(this.deck.pop());
      this.setFirstToAct();
    } else {
      this.endHand();
    }
  }

  setFirstToAct() {
    var s = this.state;
    var n = s.players.length;
    var btn = s.dealerButtonIndex != null ? s.dealerButtonIndex : 0;
    s.currentPlayerIndex = (btn + 1) % n;
    while (s.players[s.currentPlayerIndex].isFolded) this.nextPlayer();
    s.firstToActThisStreet = s.currentPlayerIndex;
  }

  nextPlayer() {
    var s = this.state;
    var n = s.players.length;
    var next = (s.currentPlayerIndex + 1) % n;
    while (s.players[next].isFolded) {
      next = (next + 1) % n;
      if (next === s.currentPlayerIndex) break;
    }
    s.currentPlayerIndex = next;
  }

  endHand() {
    var s = this.state;
    s.street = STREET.SHOWDOWN;
    s.handOver = true;
    var active = s.players.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return !x.p.isFolded; });
    if (active.length === 1) {
      var winIdx = active[0].i;
      s.winnerIndex = winIdx;
      s.winnerIndices = [winIdx];
      s.players[winIdx].chips += s.pot;
      s.pot = 0;
      s.message = s.players[winIdx].name + ' 获胜（对方弃牌）';
      var n = s.players.length;
      s.dealerButtonIndex = (s.dealerButtonIndex + 1) % n;
      return;
    }

    // 计算 side pots
    var allPlayers = s.players.map(function (p, i) {
      return { index: i, totalBet: p.totalBetThisHand || 0, isFolded: p.isFolded };
    });
    var sidePots = (function (players) {
      var levels = [];
      players.forEach(function (p) { if (p.totalBet > 0) levels.push(p.totalBet); });
      levels = levels.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
      levels.sort(function (a, b) { return a - b; });
      var pots = [];
      var prevLevel = 0;
      for (var li = 0; li < levels.length; li++) {
        var level = levels[li];
        var contributors = players.filter(function (p) { return p.totalBet > prevLevel; }).length;
        var potSize = (level - prevLevel) * contributors;
        var eligible = players.filter(function (p) { return !p.isFolded && p.totalBet >= level; })
                               .map(function (p) { return p.index; });
        if (potSize > 0 && eligible.length > 0) pots.push({ amount: potSize, eligible: eligible });
        prevLevel = level;
      }
      return pots;
    })(allPlayers);

    // 如果没有计算出 side pots（数据异常），回退到直接平分
    if (sidePots.length === 0) sidePots = [{ amount: s.pot, eligible: active.map(function (x) { return x.i; }) }];

    var winnerMessages = [];
    var allWinnerIndices = [];
    for (var pi = 0; pi < sidePots.length; pi++) {
      var pot = sidePots[pi];
      var eligible = pot.eligible;
      var bestE = null;
      var bestIdx = [];
      for (var ai = 0; ai < eligible.length; ai++) {
        var idx = eligible[ai];
        var e = bestHand(s.players[idx].hand.concat(s.communityCards));
        if (!e) continue;
        if (!bestE) { bestE = e; bestIdx = [idx]; continue; }
        var cmp = compareEval(bestE, e);
        if (cmp < 0) { bestE = e; bestIdx = [idx]; }
        else if (cmp === 0) bestIdx.push(idx);
      }
      if (bestIdx.length === 0) bestIdx = [eligible[0]];
      var share = Math.floor(pot.amount / bestIdx.length);
      var remainder = pot.amount - share * bestIdx.length;
      for (var wi = 0; wi < bestIdx.length; wi++) {
        s.players[bestIdx[wi]].chips += share + (wi === 0 ? remainder : 0);
      }
      if (bestIdx.length > 1) {
        winnerMessages.push(bestIdx.map(function (i) { return s.players[i].name; }).join('、') + ' 平分$' + pot.amount);
      } else {
        winnerMessages.push(s.players[bestIdx[0]].name + (sidePots.length > 1 ? ' 赢 $' + pot.amount : ' 获胜'));
      }
      bestIdx.forEach(function (wi) { if (allWinnerIndices.indexOf(wi) < 0) allWinnerIndices.push(wi); });
    }
    s.pot = 0;
    s.winnerIndex = allWinnerIndices[0] || active[0].i;
    s.winnerIndices = allWinnerIndices;
    s.message = winnerMessages.join('；');
    var n = s.players.length;
    s.dealerButtonIndex = (s.dealerButtonIndex + 1) % n;
  }

  runAI() {
    var s = this.state;
    if (s.handOver) return;
    var idx = s.currentPlayerIndex;
    var ai = s.players[idx];
    if (!ai || ai.isHuman) return;
    if (ai.isFolded) { this.advance(); return; }

    var st = ai.style || { openMod:1, aggrMod:1, bluffMod:1, foldMod:1,
      fearMod:1, commitMod:0.4, raiseThr:0.68, sizingMod:1 };
    var toCall = getToCall(s);
    var isPreflop = s.street === 0;
    var position = getPosition(idx, s);
    var isInPosition = (position === 'LP' || (position === 'SB' && s.players.length === 2));
    var handStr = preflopHandStrength(ai.hand);
    var MAX_RAISES = 4;
    var raiseCapped = (s.raiseCountThisStreet || 0) >= MAX_RAISES;
    var initialStack = (s.startingChips && s.startingChips[idx]) || (s.bb ? 100 * s.bb : 1000);
    var activeOpponents = 0;
    for (var i = 0; i < s.players.length; i++) {
      if (i !== idx && !s.players[i].isFolded) activeOpponents++;
    }

    var fear = calcFearLevel(toCall, initialStack, s.street, st.fearMod, ai.totalBetThisHand);
    var commit = calcCommitPressure(ai.totalBetThisHand, initialStack, st.commitMod);
    var threat = readThreatLevel(s, idx);

    var self = this;
    function doRaise(intent) {
      if (raiseCapped) {
        if (toCall > 0) self.act('call');
        else self.act('check');
        return;
      }
      var eVal = intent === 'bluff' ? 0.45 : (isPreflop ? handStr : 0.65);
      var raiseTo = humanizedBetSize(s.pot, toCall, s.minRaise, eVal,
        ai.currentBet, ai.chips, s.communityCards, intent === 'bluff',
        s.bb, st.sizingMod, intent);
      var minRaiseTo = ai.currentBet + toCall + s.minRaise;
      if (raiseTo < minRaiseTo) raiseTo = minRaiseTo;
      var hardCap = ai.currentBet + ai.chips;
      if (raiseTo > hardCap) raiseTo = hardCap;
      if (raiseTo <= ai.currentBet + toCall) {
        self.act('call');
      } else {
        self.act('raise', raiseTo);
      }
    }

    // ============ PREFLOP ============
    if (isPreflop) {
      var openThresh = getOpenThreshold(position, activeOpponents + 1) * st.openMod;

      if (toCall === 0) {
        if (!raiseCapped && handStr >= openThresh) {
          if (handStr >= 0.85 && mixedAction(0.12)) {
            this.act('check');
          } else {
            doRaise('value');
          }
        } else {
          this.act('check');
        }
        return;
      }

      var pfRequired = calcRequiredStrength(
        getOpenThreshold(position, activeOpponents + 1) * st.foldMod,
        fear, threat, commit, st.commitMod
      );

      if (handStr < pfRequired) {
        if (handStr > pfRequired - 0.06 && mixedAction(0.18 / st.foldMod)) {
          this.act('call');
        } else {
          this.act('fold');
        }
        return;
      }

      if (!raiseCapped && handStr >= st.raiseThr && fear < 0.50) {
        if (handStr >= 0.92 && mixedAction(0.20)) {
          this.act('call');
        } else {
          doRaise('value');
        }
        return;
      }

      this.act('call');
      return;
    }

    // ============ POSTFLOP ============
    var draws = detectDraws(ai.hand, s.communityCards);
    var ehsData = computeEHS(ai.hand, s.communityCards, 250, activeOpponents);
    var ehs = ehsData.ehs;
    var drawOuts = draws.outs;
    var drawStr = draws.drawStrength;
    var potOdds = requiredEquity(s.pot, toCall);
    var impliedOdds = drawStr > 0.15 ? drawStr * 0.35 : 0;
    var effectiveEhs = ehs + impliedOdds;

    var postflopRequired = calcRequiredStrength(0.35, fear, threat, commit, st.commitMod);

    // --- NO BET TO FACE ---
    if (toCall === 0) {
      if (ehs >= st.raiseThr) {
        if (ehs >= 0.80 && !isInPosition && mixedAction(0.30 * st.aggrMod)) {
          this.act('check');
        } else if (mixedAction(0.75 * st.aggrMod)) {
          doRaise('value');
        } else {
          this.act('check');
        }
        return;
      }

      if (ehs >= 0.45 && ehs < st.raiseThr) {
        if (mixedAction(0.25 * st.aggrMod)) {
          doRaise('value');
        } else {
          this.act('check');
        }
        return;
      }

      if (drawOuts >= 8 && mixedAction(0.50 * st.bluffMod)) {
        doRaise('bluff');
        return;
      }
      if (drawOuts >= 4 && mixedAction(0.20 * st.bluffMod)) {
        doRaise('bluff');
        return;
      }

      if (ehs < 0.30 && isInPosition && mixedAction(0.08 * st.bluffMod)) {
        doRaise('bluff');
        return;
      }

      this.act('check');
      return;
    }

    // --- FACING A BET ---

    if (fear >= 0.60 && ehs < 0.70) {
      if (ehs < postflopRequired) {
        this.act('fold');
        return;
      }
      if (ehs < 0.60 && drawOuts < 8) {
        this.act('fold');
        return;
      }
      this.act('call');
      return;
    }

    if (fear >= 0.35 && ehs < 0.55 && drawOuts < 6) {
      if (effectiveEhs < potOdds) {
        this.act('fold');
        return;
      }
    }

    if (ehs >= 0.80) {
      if (fear < 0.50 && !raiseCapped && mixedAction(0.50 * st.aggrMod)) {
        doRaise('value');
      } else {
        this.act('call');
      }
      return;
    }

    if (ehs >= st.raiseThr) {
      if (fear < 0.35 && !raiseCapped && mixedAction(0.30 * st.aggrMod)) {
        doRaise('value');
      } else {
        this.act('call');
      }
      return;
    }

    if (ehs >= 0.50) {
      if (effectiveEhs >= potOdds) {
        this.act('call');
      } else if (drawOuts >= 8 && mixedAction(0.25 * st.bluffMod)) {
        this.act('call');
      } else {
        if (fear > 0.30) { this.act('fold'); }
        else { this.act('call'); }
      }
      return;
    }

    if (drawOuts >= 8 && effectiveEhs >= potOdds * 0.85) {
      this.act('call');
      return;
    }

    if (effectiveEhs >= potOdds && fear < 0.40) {
      this.act('call');
      return;
    }

    if (commit > 0.50 && (st.commitMod || 0) >= 0.7 && ehs >= 0.30) {
      this.act('call');
      return;
    }

    if (ehs < 0.25 * st.foldMod && mixedAction(0.04 * st.bluffMod)) {
      doRaise('bluff');
      return;
    }

    this.act('fold');
  }
}

// 供 HTML 使用
window.PokerGame = PokerGame;
window.getToCall = getToCall;
window.requiredEquity = requiredEquity;
window.bestHand = bestHand;
window.handRankDisplayName = handRankDisplayName;
window.winProbability = winProbability;
window.winProbabilityMultiway = winProbabilityMultiway;
window.preflopHandStrength = preflopHandStrength;
window.recommend = recommend;
window.getHandRecap = getHandRecap;
window.HAND_RANK_ZH = HAND_RANK_ZH;
window.RANKS = RANKS;
window.SUITS = SUITS;
window.detectDraws = detectDraws;
window.computeEHS = computeEHS;
window.getPosition = getPosition;
window.boardDrawiness = boardDrawiness;
window.describeHand = describeHand;
window.describePosition = describePosition;
window.describeBoard = describeBoard;
window.pickRandomStyle = pickRandomStyle;
window.AI_STYLES = AI_STYLES;