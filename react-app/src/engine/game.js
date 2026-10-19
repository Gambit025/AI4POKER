import { buildOpponentRanges, makeRangeSampler, makeImportanceSampler, validRangeCombos } from './ranges.js';
import { inHand, livePlayers, betToMatch, legalActions, buildPots, callPotContext, clockwise, mergeEquivalentPots } from './rules.js';
/**
 * 德州扑克核心逻辑：牌组、牌型评估、底池赔率、建议、局内流程、AI
 */
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // J=11 Q=12 K=13 A=14
const SUITS = ['s', 'h', 'd', 'c'];
const STREET = { PREFLOP: 0, FLOP: 1, TURN: 2, RIVER: 3, SHOWDOWN: 4 };
function createDeck() {
    const cards = [];
    for (const s of SUITS) {
        for (const r of RANKS) {
            cards.push({ suit: s, rank: r });
        }
    }
    return cards;
}
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
    if (cards.length !== 5)
        return null;
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
    }
    else {
        for (let h = 13; h >= 5; h--) {
            const need = [];
            for (let i = 0; i < 5; i++)
                need.push(h - i);
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
        const kicker = Math.max(...Object.keys(rankCounts).filter((r) => +r !== +fourR[0]).map(Number));
        return { rank: HandRank.FOUR, tieBreaker: [+fourR[0], kicker] };
    }
    const threeR = Object.entries(rankCounts).find(([, n]) => n === 3);
    const twoR = threeR ? Object.entries(rankCounts).find(([r, n]) => n >= 2 && Number(r) !== Number(threeR[0])) : null;
    if (threeR && twoR) {
        return { rank: HandRank.FULL_HOUSE, tieBreaker: [+threeR[0], +twoR[0]] };
    }
    if (isFlush)
        return { rank: HandRank.FLUSH, tieBreaker: [...ranks] };
    if (hasStraight && straightHigh != null)
        return { rank: HandRank.STRAIGHT, tieBreaker: [straightHigh] };
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
    if (!c)
        return '';
    var r = RANK_ZH[c.rank] || String(c.rank);
    return r + (SUIT_ZH[c.suit] || c.suit);
}
function handToStr(hand) {
    return (hand || []).map(cardToStr).join(' ');
}
function getHandRecap(s) {
    const chipDiff=s.players[0].chips-(s.startingChips?.[0]??s.players[0].chips);
    const names={fold:'弃牌',call:'跟注',check:'过牌',raise:'加注至',bet:'下注'};
    return {grade:'回顾',gradeEmoji:'♠',heroWon:s.winnerIndices?.includes(0)??false,heroFolded:s.players[0].isFolded,chipDiff,chipChange:`${chipDiff>=0?'+':''}${chipDiff} 筹码`,
      summaryLine:'按当时可见的信息解释选择，不用最终输赢给决策打分。范围与建议均为模型假设。',
      decisions:(s.heroDecisions??[]).map(d=>({streetName:['翻前','翻牌','转牌','河牌'][d.street],actual:`${names[d.action]}${d.actualAmount?` ${d.actualAmount}`:''}${d.allIn?' · 全下':''}`,
        takeaway:d.action==='fold'?(d.advice?.action==='优先弃牌'?d.advice.summary:'放弃底池、保留后手；是否过紧取决于当时的对手范围。'):d.action==='check'?'免费保留参与权，不必为了继续而下注。':d.action==='call'?(d.advice?.action==='优先弃牌'?'当时估算偏向弃牌；继续需有对手范围更宽的依据。':d.advice?.summary):'主动扩大底池；需明确价值目标或弃牌率依据。',risk:d.advice?.risk??'',
        rating:'good',ratingIcon:'·',ratingLabel:'决策记录',analysis:d.advice?.facts??d.coach,
        analysisParts:d.advice?.analysisParts??[],reasons:d.advice?.reasons??[],alternatives:d.advice?.alternatives??[],ranges:d.advice?.ranges??[],sensitivity:d.advice?.sensitivity,
        chosenReason:d.advice?.alternatives.find(a=>a.kind===(d.action==='raise'||d.action==='bet'?'raise':d.action))?.reason??(d.action==='raise'||d.action==='bet'?'主动增加投入。需要思考：哪些更弱的牌会跟注，或哪些更强的牌会弃牌；该模型未证明这一尺寸最优。':''),
        suggestion:`当时参考：${d.recommended}${d.recommendedAmount?`至 ${d.recommendedAmount}`:''}。${d.advice?.cautions??'策略建议并非唯一正确打法。'}`})),
      showdownSummary:[...(s.settledPots??[]).map((pot,i)=>`${i===0?'主池':`边池 ${i}`} ${pot.amount}：${pot.awards.map(a=>`${s.players[a.player].name} 获得 ${a.amount}`).join('；')}`),...(s.refunds??[]).map(r=>`${s.players[r.player].name} 未获跟注的 ${r.amount} 已退回。`)].join('\n')};
}
function compareEval(a, b) {
    if (a.rank !== b.rank)
        return a.rank - b.rank;
    for (let i = 0; i < Math.max(a.tieBreaker.length, b.tieBreaker.length); i++) {
        const x = a.tieBreaker[i] || 0, y = b.tieBreaker[i] || 0;
        if (x !== y)
            return x - y;
    }
    return 0;
}
function bestHand(cards) {
    if (cards.length < 5)
        return null;
    if (cards.length > 7)
        throw new RangeError('Expected at most seven cards');
    const counts = Array(15).fill(0), suits = { s: [], h: [], d: [], c: [] }, masks = { s: 0, h: 0, d: 0, c: 0 };
    for (const c of cards) {
        if (!SUITS.includes(c.suit) || !Number.isInteger(c.rank) || c.rank < 2 || c.rank > 14 || (masks[c.suit] & (1 << c.rank)))
            throw new Error('Invalid or duplicate card');
        masks[c.suit] |= 1 << c.rank;
        counts[c.rank]++;
        suits[c.suit].push(c.rank);
    }
    const straight = values => { const have = new Set(values); if (have.has(14))
        have.add(1); for (let high = 14; high >= 5; high--)
        if ([0, 1, 2, 3, 4].every(d => have.has(high - d)))
            return high; return 0; };
    const ranks = [];
    for (let r = 14; r >= 2; r--)
        if (counts[r])
            ranks.push(r);
    const flush = Object.values(suits).find(a => a.length >= 5);
    if (flush) {
        const high = straight(flush);
        if (high)
            return { rank: 8, tieBreaker: [high] };
    }
    const four = ranks.find(r => counts[r] === 4);
    if (four)
        return { rank: 7, tieBreaker: [four, ranks.find(r => r !== four)] };
    const triples = ranks.filter(r => counts[r] >= 3), pairs = ranks.filter(r => counts[r] >= 2);
    if (triples.length) {
        const pair = pairs.find(r => r !== triples[0]);
        if (pair)
            return { rank: 6, tieBreaker: [triples[0], pair] };
    }
    if (flush)
        return { rank: 5, tieBreaker: [...flush].sort((a, b) => b - a).slice(0, 5) };
    const high = straight(ranks);
    if (high)
        return { rank: 4, tieBreaker: [high] };
    if (triples.length)
        return { rank: 3, tieBreaker: [triples[0], ...ranks.filter(r => r !== triples[0]).slice(0, 2)] };
    if (pairs.length >= 2)
        return { rank: 2, tieBreaker: [pairs[0], pairs[1], ranks.find(r => r !== pairs[0] && r !== pairs[1])] };
    if (pairs.length)
        return { rank: 1, tieBreaker: [pairs[0], ...ranks.filter(r => r !== pairs[0]).slice(0, 3)] };
    return { rank: 0, tieBreaker: ranks.slice(0, 5) };
}
function requiredEquity(pot, toCall) {
    if (toCall < 0 || pot + toCall <= 0)
        return 0;
    return toCall / (pot + toCall);
}
function estimateEquity(hand, board, options = {}) {
    const opponents = options.opponents ?? 1, known = options.knownHands ?? [], random = options.random ?? Math.random;
    if (!Number.isInteger(opponents) || opponents < 0 || opponents > 7 || known.length > opponents || hand.length !== 2 || board.length > 5 || known.some(h => h.length !== 2))
        throw new Error('Invalid equity inputs');
    const cards = [...hand, ...board, ...known.flat()];
    if (cards.some(c => !SUITS.includes(c.suit) || !Number.isInteger(c.rank) || c.rank < 2 || c.rank > 14))
        throw new Error('Invalid card');
    if (!Number.isInteger(options.simulations ?? 400) || (options.simulations ?? 400) < 1)
        throw new Error('Invalid sample count');
    const used = new Set(cards.map(c => c.suit + c.rank));
    if (used.size !== hand.length + board.length + known.length * 2)
        throw new Error('Duplicate known cards');
    const deck = createDeck().filter(c => !used.has(c.suit + c.rank));
    const need = 5 - board.length, unknown = opponents - known.length;
    let wins = 0, ties = 0, shares = 0, samples = 0, totalWeight=0, squaredWeights=0;
    function score(opps, community, weight=1) {
        totalWeight+=weight;squaredWeights+=weight*weight;
        const hero = bestHand(hand.concat(community));
        let tied = 1;
        for (const opp of opps) {
            const cmp = compareEval(hero, bestHand(opp.concat(community)));
            if (cmp < 0) {
                samples++;
                return;
            }
            if (cmp === 0)
                tied++;
        }
        if (tied === 1)
            wins+=weight;
        else
            ties+=weight;
        shares += weight / tied;
        samples++;
    }
    let exact = false;
    if (opponents === 0) {
        return { equity: 1, win: 1, tie: 0, lose: 0, samples: 1, exact: true };
    }
    if (need === 0 && unknown === 0) {
        score(known, board);
        exact = true;
    }
    else if(options.opponentRanges) {
        const ranges=options.opponentRanges,temperature=options.temperature??1;
        if(ranges.length!==unknown)throw new Error('Opponent range count mismatch');
        if(need===0&&unknown===1){
            for(const combo of validRangeCombos(ranges[0],used,temperature)){score([...known,combo.hand],board,combo.weight);}exact=true;
        }else{
            const samplers=makeRangeSampler(ranges,used,temperature),iterations=options.simulations??600;
            let attempts=0;
            while(samples<iterations){
                if(options.sampling==='importance'||++attempts>iterations*50)break;
                const selected=samplers.map(sample=>sample(random)),keys=selected.flat().map(c=>c.suit+c.rank);
                // Reject the WHOLE colliding joint sample. Sequential blocker renormalization would bias ranges.
                if(new Set(keys).size!==keys.length)continue;
                const occupied=new Set(keys),remaining=deck.filter(c=>!occupied.has(c.suit+c.rank));
                for(let j=0;j<need;j++){const k=j+Math.floor(random()*(remaining.length-j));[remaining[j],remaining[k]]=[remaining[k],remaining[j]];}
                score([...known,...selected],board.concat(remaining.slice(0,need)));
            }
            if(samples<iterations){
                wins=0;ties=0;shares=0;samples=0;totalWeight=0;squaredWeights=0;
                const sample=makeImportanceSampler(ranges,used,temperature);let tries=0;
                while(samples<iterations){
                    if(++tries>iterations*100)throw new Error('No compatible joint opponent range');
                    const joint=sample(random);if(!joint)continue;
                    const occupied=new Set(joint.hands.flat().map(c=>c.suit+c.rank)),remaining=deck.filter(c=>!occupied.has(c.suit+c.rank));
                    for(let j=0;j<need;j++){const k=j+Math.floor(random()*(remaining.length-j));[remaining[j],remaining[k]]=[remaining[k],remaining[j]];}
                    score([...known,...joint.hands],board.concat(remaining.slice(0,need)),joint.weight);
                }
            }
        }
    }
    else if (need === 0 && unknown === 1) {
        for (let i = 0; i < deck.length; i++)
            for (let j = i + 1; j < deck.length; j++)
                score([...known, [deck[i], deck[j]]], board);
        exact = true;
    }
    else {
        const iterations = options.simulations ?? 400;
        if (!Number.isSafeInteger(iterations) || iterations < 1)
            throw new Error('Invalid sample count');
        for (let i = 0; i < iterations; i++) {
            const shuffled = [...deck], take = unknown * 2 + need;
            for (let j = 0; j < take; j++) {
                const k = j + Math.floor(random() * (shuffled.length - j));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            const hands = [...known];
            for (let j = 0; j < unknown; j++)
                hands.push(shuffled.slice(j * 2, j * 2 + 2));
            score(hands, board.concat(shuffled.slice(unknown * 2, take)));
        }
    }
    return { equity: shares / totalWeight, win: wins / totalWeight, tie: ties / totalWeight, lose: Math.max(0,totalWeight - wins - ties) / totalWeight, effectiveSamples:totalWeight*totalWeight/squaredWeights, samples, exact };
}
function winProbability(hand, board, opponentHand) { return estimateEquity(hand, board, { knownHands: opponentHand ? [opponentHand] : [] }).equity; }
function winProbabilityMultiway(hand, board, opponents) { return estimateEquity(hand, board, { opponents }).equity; }
// =====================================================================
// Beginner strategy heuristics and board texture helpers.
// =====================================================================
/**
 * Heuristic preflop hand ranking (0-1), not a probability or a solved range.
 * Scores are local teaching heuristics; they are not sourced solver outputs.
 * Covers all 169 distinct starting hands (pair, suited, offsuit).
 */
var PREFLOP_SCORES = {};
(function buildPreflopScores() {
    var pairScores = { 14: 0.98, 13: 0.96, 12: 0.94, 11: 0.91, 10: 0.87, 9: 0.78, 8: 0.73, 7: 0.68, 6: 0.63, 5: 0.58, 4: 0.54, 3: 0.50, 2: 0.46 };
    var suitedScores = {
        '14_13': 0.93, '14_12': 0.90, '14_11': 0.88, '14_10': 0.86, '14_9': 0.80, '14_8': 0.78, '14_7': 0.76, '14_6': 0.74, '14_5': 0.74, '14_4': 0.72, '14_3': 0.71, '14_2': 0.70,
        '13_12': 0.85, '13_11': 0.83, '13_10': 0.81, '13_9': 0.74, '13_8': 0.70, '13_7': 0.66, '13_6': 0.64, '13_5': 0.63, '13_4': 0.61, '13_3': 0.60, '13_2': 0.58,
        '12_11': 0.79, '12_10': 0.77, '12_9': 0.70, '12_8': 0.64, '12_7': 0.60, '12_6': 0.57, '12_5': 0.55, '12_4': 0.53, '12_3': 0.52, '12_2': 0.50,
        '11_10': 0.75, '11_9': 0.68, '11_8': 0.62, '11_7': 0.57, '11_6': 0.52, '11_5': 0.49, '11_4': 0.47, '11_3': 0.45, '11_2': 0.44,
        '10_9': 0.66, '10_8': 0.60, '10_7': 0.55, '10_6': 0.50, '10_5': 0.46, '10_4': 0.43, '10_3': 0.41, '10_2': 0.40,
        '9_8': 0.58, '9_7': 0.53, '9_6': 0.47, '9_5': 0.43, '9_4': 0.39, '9_3': 0.37, '9_2': 0.35,
        '8_7': 0.53, '8_6': 0.47, '8_5': 0.42, '8_4': 0.37, '8_3': 0.34, '8_2': 0.32,
        '7_6': 0.48, '7_5': 0.43, '7_4': 0.37, '7_3': 0.33, '7_2': 0.30,
        '6_5': 0.44, '6_4': 0.38, '6_3': 0.33, '6_2': 0.29,
        '5_4': 0.40, '5_3': 0.35, '5_2': 0.30,
        '4_3': 0.33, '4_2': 0.28,
        '3_2': 0.29
    };
    for (var r in pairScores)
        PREFLOP_SCORES['P_' + r] = pairScores[r];
    for (var k in suitedScores) {
        PREFLOP_SCORES['S_' + k] = suitedScores[k];
        PREFLOP_SCORES['O_' + k] = Math.max(0, suitedScores[k] - 0.06);
    }
})();
function preflopHandStrength(hand) {
    if (!hand || hand.length !== 2)
        return 0.5;
    var r1 = hand[0].rank, r2 = hand[1].rank;
    var high = Math.max(r1, r2), low = Math.min(r1, r2);
    var suited = hand[0].suit === hand[1].suit;
    if (high === low)
        return PREFLOP_SCORES['P_' + high] || 0.45;
    var key = (suited ? 'S_' : 'O_') + high + '_' + low;
    return PREFLOP_SCORES[key] || 0.25;
}
/**
 * Position classification: returns 'EP', 'MP', 'LP', 'SB', or 'BB'.
 */
function getPosition(index, s) {
    if (index === s.sbPosition)
        return 'SB';
    if (index === s.bbPosition)
        return 'BB';
    if (index === s.dealerButtonIndex)
        return 'LP';
    const seats = clockwise(s.players.map((p, i) => ({ p, i })).filter(({ p }) => p.inHand !== false && !p.isEliminated).map(({ i }) => i), s.bbPosition, s.players.length).filter(i => i !== s.sbPosition && i !== s.bbPosition && i !== s.dealerButtonIndex);
    const seat = seats.indexOf(index);
    return seat < Math.ceil(seats.length / 3) ? 'EP' : seat < Math.ceil(seats.length * 2 / 3) ? 'MP' : 'LP';
}
/**
 * Detect draws in hand + community cards.
 * Returns { flushDraw, oesd, gutshot, comboDraw, outs, drawStrength }.
 */
function detectDraws(hand, board) {
    const result = { flushDraw: false, oesd: false, gutshot: false, comboDraw: false, outs: 0, drawStrength: 0 };
    if (board.length < 3 || board.length >= 5)
        return result;
    const all = [...hand, ...board], used = new Set(all.map(c => c.suit + c.rank));
    const straightHigh = cards => { const ranks = new Set(cards.map(c => c.rank)); if (ranks.has(14))
        ranks.add(1); for (let h = 14; h >= 5; h--)
        if ([0, 1, 2, 3, 4].every(d => ranks.has(h - d)))
            return h; return 0; };
    const hasFlush = cards => SUITS.some(suit => cards.filter(c => c.suit === suit).length >= 5);
    const madeStraight = straightHigh(all), madeFlush = hasFlush(all), outs = new Set(), straightRanks = new Set();
    for (const c of createDeck()) {
        if (used.has(c.suit + c.rank))
            continue;
        const flush = !madeFlush && hasFlush([...all, c]) && hand.some(h => h.suit === c.suit);
        const straight = !madeStraight && straightHigh([...all, c]) > straightHigh([...board, c]);
        if (flush) {
            result.flushDraw = true;
            outs.add(c.suit + c.rank);
        }
        if (straight) {
            straightRanks.add(c.rank);
            outs.add(c.suit + c.rank);
        }
    }
    result.oesd = straightRanks.size >= 2;
    result.gutshot = straightRanks.size === 1;
    result.comboDraw = result.flushDraw && straightRanks.size > 0;
    result.outs = outs.size;
    const unseen = 52 - all.length;
    result.drawStrength = board.length === 3 ? 1 - (unseen - outs.size) * (unseen - outs.size - 1) / (unseen * (unseen - 1)) : outs.size / unseen;
    return result;
}
function boardDrawiness(communityCards) {
    if (!communityCards || communityCards.length < 3)
        return 0;
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
    for (var j = 1; j < ranks.length; j++)
        gaps += Math.min(2, ranks[j] - ranks[j - 1]);
    var flushDraw = maxSuit >= 3 ? 0.5 : (maxSuit >= 2 ? 0.3 : 0);
    var straightDraw = gaps <= 3 ? 0.35 : (gaps <= 5 ? 0.2 : 0);
    var hasPair = new Set(ranks).size < ranks.length ? 0.1 : 0;
    return Math.min(1, flushDraw + straightDraw + hasPair);
}
// === ADVICE HELPER FUNCTIONS ===
var STREET_NAME_ZH = { 0: '翻前', 1: '翻牌', 2: '转牌', 3: '河牌' };
var RANK_CHAR = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
function describeHand(hand) {
    if (!hand || hand.length !== 2)
        return '';
    var r1 = hand[0].rank, r2 = hand[1].rank;
    var high = Math.max(r1, r2), low = Math.min(r1, r2);
    var suited = hand[0].suit === hand[1].suit;
    var h = RANK_CHAR[high] || String(high);
    var l = RANK_CHAR[low] || String(low);
    if (high === low)
        return h + l;
    return h + l + (suited ? 's' : 'o');
}
function describePosition(pos) {
    var map = { EP: '前位', MP: '中位', LP: '后位', SB: '小盲', BB: '大盲' };
    return map[pos] || pos;
}
function describeBoard(communityCards) {
    if (!communityCards || communityCards.length < 3)
        return null;
    var d = boardDrawiness(communityCards);
    if (d >= 0.7)
        return '非常湿润';
    if (d >= 0.5)
        return '湿润';
    if (d >= 0.3)
        return '半干燥';
    return '干燥';
}
function countAggressors(state) {
    // Forced blinds and calls are not aggression. Keep actual raisers in this street,
    // even if they later call, but exclude folded opponents and the hero.
    var players = new Set();
    (state.actionLog || []).forEach(function (entry) {
        if (entry.street === state.street && entry.player !== 0 &&
            (entry.action === 'raise' || entry.action === 'bet') &&
            state.players[entry.player] && !state.players[entry.player].isFolded)
            players.add(entry.player);
    });
    return players.size;
}
function opponentRanges(state,index=state.currentPlayerIndex,hand=state.players[index].hand){
    return buildOpponentRanges(state,index,hand,{bestHand,compareEval,preflopHandStrength,detectDraws,getPosition,describeHand});
}
// A board pair or board-only made hand is not, by itself, a private value hand.
function hasPrivateValue(hand,board) {
    const value=bestHand([...hand,...board]);if(!value||value.rank===0)return false;
    const ranks=hand.map(c=>c.rank);
    if([1,2,3,6,7].includes(value.rank))return value.tieBreaker.slice(0,value.rank===2||value.rank===6?2:1).some(r=>ranks.includes(r));
    return board.length<5||compareEval(value,bestHand(board))>0;
}
function recommend(hand,s,options={}) {
    const index=s.currentPlayerIndex,legal=legalActions(s),context=callPotContext(s),ranges=opponentRanges(s,index,hand);
    const estimates=new Map();
    const estimate=(selected,temperature=1)=>{const key=selected.map(r=>r.player).join(',')+':'+temperature;if(!estimates.has(key))estimates.set(key,estimateEquity(hand,s.communityCards,{opponents:selected.length,opponentRanges:selected,simulations:options.simulations??500,temperature,random:options.random}));return estimates.get(key);};
    const model=estimate(ranges),hasEvidence=ranges.some(r=>r.informed),loose=hasEvidence?estimate(ranges,0.65):model,tight=hasEvidence?estimate(ranges,1.35):model;
    let expectedReturn=0,looseReturn=0,tightReturn=0;
    for(const pot of context.pots){
        const selected=ranges.filter(r=>pot.eligible.includes(r.player));
        const same=selected.length===ranges.length;
        expectedReturn+=pot.amount*(same?model.equity:estimate(selected).equity);
        looseReturn+=pot.amount*(same?loose.equity:estimate(selected,0.65).equity);
        tightReturn+=pot.amount*(same?tight.equity:estimate(selected,1.35).equity);
    }
    // Unacted players may fold. Compare that scenario rather than treating every
    // pending seat as a certain caller and turning the multiway share into a fold rule.
    const pending=ranges.filter(r=>!s.players[r.player].actedThisStreet&&!s.players[r.player].isAllIn&&!s.actionLog.some(e=>e.street===s.street&&e.player===r.player&&['raise','bet','call','check'].includes(e.action)));
    const voluntary=s.actionLog.some(e=>e.street===s.street&&e.player!==index&&['raise','bet','call'].includes(e.action));
    const pendingScenario=legal.toCall>0&&voluntary&&pending.length>0;
    const continuing=pendingScenario?ranges.filter(r=>!pending.includes(r)):ranges;
    let pendingReturn=expectedReturn;
    if(pendingScenario){pendingReturn=0;for(const pot of context.pots)pendingReturn+=pot.amount*estimate(continuing.filter(r=>pot.eligible.includes(r.player))).equity;}
    const low=Math.min(model.equity,loose.equity,tight.equity),high=Math.max(model.equity,loose.equity,tight.equity,pendingScenario?estimate(continuing).equity:0);
    const ev=expectedReturn-context.cost,evLow=Math.min(expectedReturn,looseReturn,tightReturn)-context.cost,evHigh=Math.max(expectedReturn,looseReturn,tightReturn,pendingReturn)-context.cost;
    const position=getPosition(index,s),draw=detectDraws(hand,s.communityCards),score=preflopHandStrength(hand);
    const hero=s.players[index],opponentStacks=ranges.map(r=>(s.startingChips?.[r.player]??s.players[r.player].chips+s.players[r.player].totalBetThisHand));
    const effectiveBB=Math.min(hero.chips+hero.totalBetThisHand,Math.max(0,...opponentStacks))/(s.bb??10);
    const remainingEffective=Math.min(hero.chips,Math.max(0,...ranges.map(r=>s.players[r.player].chips)));
    const spr=s.pot>0?Math.max(0,Number.isFinite(remainingEffective)?remainingEffective:hero.chips)/s.pot:0;
    const unopened=s.street===0&&!s.actionLog.some(e=>e.action==='raise'||e.action==='bet');
    const margin=Math.max(2,context.contestable*0.06),close=legal.toCall>0&&evLow<=margin&&evHigh>=-margin;
    let action=legal.toCall?(evLow>margin?'评估跟注':evHigh < -margin?'优先弃牌':'谨慎决策'):'过牌',betAmount=null;
    const limpers=new Set(s.actionLog.filter(e=>e.street===0&&e.action==='call'&&e.player!==index).map(e=>e.player)).size;
    const openingThreshold=Math.min(0.9,(position==='EP'?0.76:position==='MP'?0.69:position==='SB'?0.66:0.61)+Math.max(0,limpers-1)*0.035);
    if(unopened&&legal.canFullRaise&&score>=openingThreshold){action='加注';betAmount=Math.min(legal.maxRaiseTo,Math.max(legal.minRaiseTo,Math.round(((effectiveBB<=25?2.2:2.5)+limpers)*(s.bb??10))));}
    const made=s.communityCards.length>=3?bestHand([...hand,...s.communityCards]):null;
    if(!legal.toCall&&s.street>0&&legal.canFullRaise&&low>0.7&&made?.rank>=1&&hasPrivateValue(hand,s.communityCards)){action='考虑价值下注';betAmount=Math.min(legal.maxRaiseTo,Math.max(legal.minRaiseTo,Math.round(s.pot*0.5)));}
    let facts=legal.toCall?`需补 ${legal.toCall}，实际跟注 ${context.cost}；跟注后可争夺 ${context.contestable}，无后续下注的简化门槛 ${Math.round(context.requiredEquity*100)}%。`:'当前无需补筹码，可以免费过牌。';
    if(legal.toCall)facts+=' 假设其他在局玩家继续，未计其后新增筹码与后续街成本。';
    if(new Set(context.pots.map(p=>p.eligible.join(','))).size>1)facts+=' 分池资格不同，须按各池加权，不能直接用总份额比较门槛。';
    const reasons=[`${describePosition(position)}，最大有效筹码约 ${Math.round(effectiveBB)} BB；当前最大有效 SPR ${spr.toFixed(1)}。`,
        ranges.some(r=>r.informed)?'按各对手的位置、自愿行动和下注尺度更新组合权重；范围中仍包含诈唬与听牌。':'对手尚无足够自愿行动，暂保留宽范围，不能按位置凭空收窄。',
        hero.chips/(s.bb??10)<=20?'短筹码减少投机牌的隐含赔率空间；低 SPR 也不代表必须全下。':'筹码较深，边缘牌需要考虑后续街的成本，不能只比较当前赔率。'];
    const alternatives=[
      {action:'弃牌',kind:'fold',reason:legal.toCall?'保留剩余筹码；若对手比模型更紧、多人下注或跟注需要承担后续成本，弃牌更有吸引力。':'可以免费过牌时，无需为了结束行动而弃牌。'},
      {action:legal.toCall?'跟注':'过牌',kind:legal.toCall?'call':'check',reason:legal.toCall?`范围变化下跟注模型净期望约 ${Math.round(evLow)} 至 ${Math.round(evHigh)}；${close?'跨越或接近盈亏边界，需更多范围信息。':'仍依赖范围假设，正值不保证实际盈利。'}`:'不增加投入，保留较弱对手牌；强牌也可过牌保护过牌范围，不应只凭过牌推断弱牌。'},
      {action:legal.currentBet?'加注':'下注',kind:'raise',reason:!legal.canRaise?'当前加注权或对手筹码不允许加注。':legal.shortAllIn?'仅可不足额全下加注，先确认更差的牌是否会跟注。':'需要明确价值目标或弃牌率依据；当前模型不计算弃牌率和完整下注树，不能断言加注优于跟注或过牌。'}
    ];
    if(!legal.raiseReopened)reasons.push('不足额全下尚未重开你的加注权，只能跟注或弃牌。');
    if(!model.exact&&model.effectiveSamples<100)reasons.push('范围之间的阻断很强，有效样本较少；暂不据此做确定判断。');
    const remainingBB=hero.chips/(s.bb??10),allInCall=legal.toCall>0&&context.cost===hero.chips;
    let summary=action==='优先弃牌'?'当前范围估算不足以覆盖跟注成本。':action==='评估跟注'?'范围估算支持考虑跟注，仍要留意后续下注。':action==='谨慎决策'?'判断接近边界，不宜只凭一个份额数字继续。':action==='加注'?(limpers?`已有 ${limpers} 人跟入，隔离加注需比普通开池更大。`:`${index===s.dealerButtonIndex?'按钮位':describePosition(position)}开池可争取盲注与主动权；被跟注后仍要按牌面判断。`):action==='考虑价值下注'?'考虑让更弱的牌付费；若更弱牌很少跟注，也可以过牌。':'可以免费过牌，无需为了继续而投入筹码。';
    if(pendingScenario&&action==='谨慎决策')summary='身后玩家尚未行动；其跟入或弃牌会改变判断，先考虑范围与位置。';
    if(!legal.raiseReopened)summary='短全下尚未重开加注权，只能跟注或弃牌。';
    if(action==='优先弃牌'&&legal.toCall>=8*(s.bb??10))summary='面对大额加注，当前范围下继续的代价偏高。';
    let risk=allInCall?`跟注将投入全部剩余 ${context.cost}；仅争夺自己覆盖的底池。`:legal.toCall>0&&context.cost>=hero.chips/2?`这次跟注用掉至少一半后手；不能把份额当作盈利保证。`:remainingBB<=20?'短筹码少依赖隐含赔率，无需机械全下。':'';
    if(!legal.toCall&&made?.rank>=1&&!hasPrivateValue(hand,s.communityCards))summary='公共牌已成牌，不能据此认定自己能向弱牌取值；先过牌。';
    const posLabel=index===s.dealerButtonIndex?'按钮位':describePosition(position);
    const ownPair=hand[0].rank===hand[1].rank;
    const handText=s.street===0?`${handToStr(hand)}，${ownPair?'口袋对子':hand[0].suit===hand[1].suit?'同花手牌':'非同花手牌'}。${!ownPair&&Math.max(...hand.map(c=>c.rank))===14&&Math.min(...hand.map(c=>c.rank))<=8?'弱踢脚 A 容易被更好的 A 压制，不能只因为有 A 就继续。':ownPair?'对子也会遇到更高对子；多人底池中，未改善的小对子要控制投入。':'翻前强度不等于翻后一定领先，需要结合位置和进入底池的代价。'}`:
        `${handToStr(hand)}；当前最佳五张为${HAND_RANK_ZH[made.rank]}。${made.rank>=1&&!hasPrivateValue(hand,s.communityCards)?'成牌主要来自公共牌，不能把共享牌型当作自己的价值优势。':'牌型名称只说明绝对强度，是否领先仍取决于对手范围与踢脚。'}${draw.outs?`另有 ${draw.outs} 张潜在顺子/同花成牌张，部分会让对手成更强牌，不能全部当作干净胜出张。`:''}`;
    const pressure=[...s.actionLog].reverse().find(e=>e.street===s.street&&e.player!==index&&ranges.some(r=>r.player===e.player)&&['raise','bet'].includes(e.action));
    const pressureRange=pressure?ranges.find(r=>r.player===pressure.player):null;
    const rangeText=pressure?`${pressureRange.name.replace(/^Robot /,'对手 ')} 本轮${pressure.action==='raise'?'加注至':'下注'} ${pressure.totalBet??pressure.amount}。${pressureRange.evidence} ${pressureRange.explanation}`:
        `${ranges.length} 名对手仍在局。${hasEvidence?'已按各人的公开行动更新范围；过牌仍可能包含强牌。':'尚无足够自愿行动，保留宽范围；不能因为对手还没下注就认定其牌弱。'}`;
    const afterCall=Math.max(0,hero.chips-context.cost);
    const analysisParts=[
      {title:'手牌与牌面',body:handText},
      {title:'位置与对手',body:`你在${posLabel}，最大有效筹码约 ${Math.round(effectiveBB)} BB。${index===s.dealerButtonIndex?'翻后通常最后行动，更容易看到对手选择。':position==='SB'?'翻后通常较早行动，边缘牌更难控制底池。':position==='EP'?'后面仍有多人可行动，进入底池应更谨慎。':'实际行动顺序还取决于盲位和仍在局的玩家。'}${rangeText} 位置改变范围假设，但不能确定对手具体拿什么牌。`},
      {title:'这次投入是否值得',body:`${facts} 模型估计底池份额 ${Math.round(model.equity*100)}%，${hasEvidence?`范围与行动情景下约 ${Math.round(low*100)}–${Math.round(high*100)}%，不是置信区间。`:'目前缺少行动信息，这个数字不能当作精确胜率。'}${legal.toCall?`无后续下注模型的跟注净期望约 ${Math.round(evLow)} 至 ${Math.round(evHigh)} 筹码。`:''}`},
      {title:betAmount?'下注尺度与后续':'后续计划',body:betAmount?`本轮总投入至 ${betAmount}，本次再投入 ${Math.max(0,betAmount-hero.currentBet)}。${s.street===0?(limpers?'跟入者增加，隔离尺寸相应提高；仍需他们愿意用更弱牌继续。':'这是启发式开池尺寸，不能据此认定为最优尺寸。'):'目标是让更弱牌跟注；面对再加注，重新判断范围。'}`:
        `${legal.toCall?`跟注后余 ${afterCall} 筹码（${(afterCall/(s.bb??10)).toFixed(1)} BB）。`: `当前余 ${hero.chips} 筹码。`}${ranges.every(r=>s.players[r.player].isAllIn)?'所有对手已全下，不再有后续下注；按自己有资格争夺的各池计算。':remainingBB<=20?'后手较短，不宜依赖未来赢得大量筹码来补偿差赔率；也不等于必须全下。':'仍可能面临后续下注；边缘牌应预留弃牌空间，不能因已有投入而硬跟。'}`}
    ];
    const cautions='启发式范围模型，未经求解器校准；份额不是盈利概率。敏感性区间包含放宽/收紧范围及尚未行动玩家弃牌的情景，不是置信区间。忽略后续下注和抽水，已有投入为沉没成本。';
    return {action,betAmount,coach:[facts,...reasons,cautions].join(' '),winProbability:model.equity,tier:winTier(model.equity).cls,requiredEquity:context.requiredEquity,
      summary,risk,analysisParts,reasons,alternatives,facts,cautions,ranges:ranges.map(({combos,...range})=>range),sensitivity:{low,high,evLow,evHigh},
      details:{street:String(s.street),streetName:['翻前','翻牌','转牌','河牌'][s.street],handDesc:describeHand(hand),handStrength:null,position,positionDesc:describePosition(position),
        drawInfo:draw.outs?`${draw.outs} 张潜在顺子/同花成牌张，部分可能不是胜出张。`:null,drawIcon:'♠',ehs:null,potOdds:context.requiredEquity,spr,effectiveBB,remainingBB,callCost:context.cost,limpers,opponentsBetting:countAggressors(s),opponents:ranges.length,samples:model.samples,exact:model.exact,model:'行为加权范围',callEV:ev}};
}
function winTier(wp) { return wp >= 0.65 ? { cls: 'strong' } : wp >= 0.45 ? { cls: 'good' } : wp >= 0.3 ? { cls: 'marginal' } : { cls: 'weak' }; }
function createPlayer(name, chips, isHuman, style) {
    if (isHuman == null)
        isHuman = false;
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
    { label: 'TAG', weight: 20,
        openMod: 0.90, aggrMod: 1.30, bluffMod: 0.8, foldMod: 1.10,
        fearMod: 1.20, commitMod: 0.3, raiseThr: 0.72, sizingMod: 0.85 },
    { label: 'LAG', weight: 12,
        openMod: 1.20, aggrMod: 1.25, bluffMod: 1.5, foldMod: 0.80,
        fearMod: 0.70, commitMod: 0.5, raiseThr: 0.58, sizingMod: 1.05 },
    { label: 'TP', weight: 10,
        openMod: 0.80, aggrMod: 0.70, bluffMod: 0.3, foldMod: 1.25,
        fearMod: 1.40, commitMod: 0.2, raiseThr: 0.82, sizingMod: 0.70 },
    { label: 'LP', weight: 8,
        openMod: 1.25, aggrMod: 0.65, bluffMod: 0.5, foldMod: 0.70,
        fearMod: 0.60, commitMod: 0.8, raiseThr: 0.85, sizingMod: 0.75 },
    { label: 'BALANCED', weight: 5,
        openMod: 1.00, aggrMod: 1.00, bluffMod: 1.0, foldMod: 1.00,
        fearMod: 1.00, commitMod: 0.4, raiseThr: 0.68, sizingMod: 1.00 },
    { label: 'MANIAC', weight: 3,
        openMod: 1.40, aggrMod: 1.50, bluffMod: 2.0, foldMod: 0.55,
        fearMod: 0.30, commitMod: 0.9, raiseThr: 0.40, sizingMod: 1.30 },
    { label: 'NIT', weight: 10,
        openMod: 0.70, aggrMod: 0.80, bluffMod: 0.2, foldMod: 1.40,
        fearMod: 1.80, commitMod: 0.1, raiseThr: 0.85, sizingMod: 0.65 },
    { label: 'SHARK', weight: 7,
        openMod: 1.05, aggrMod: 1.15, bluffMod: 1.2, foldMod: 0.95,
        fearMod: 0.90, commitMod: 0.35, raiseThr: 0.65, sizingMod: 1.00 },
    { label: 'FISH', weight: 25,
        openMod: 1.30, aggrMod: 0.60, bluffMod: 0.4, foldMod: 0.65,
        fearMod: 0.50, commitMod: 0.85, raiseThr: 0.90, sizingMod: 0.80 },
];
function pickRandomStyle(random = Math.random) {
    var totalWeight = 0;
    for (var i = 0; i < AI_STYLES.length; i++)
        totalWeight += AI_STYLES[i].weight;
    var roll = random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < AI_STYLES.length; j++) {
        cumulative += AI_STYLES[j].weight;
        if (roll < cumulative)
            return AI_STYLES[j];
    }
    return AI_STYLES[0];
}
function getToCall(state) { return legalActions(state).toCall; }
class PokerGame {
    constructor(sb = 5, bb = 10, initialChips = 100 * bb, playerCount = 2, options = {}) {
        if (![sb, bb, initialChips, playerCount].every(Number.isSafeInteger) || sb <= 0 || bb < sb || initialChips <= 0 || playerCount < 2 || playerCount > 8)
            throw new Error('Invalid table configuration');
        this.sb = sb;
        this.bb = bb;
        this.options = options;
        this.random = options.random ?? Math.random;
        this.lastError = '';
        const stacks = options.initialStacks ?? Array(playerCount).fill(initialChips);
        if (stacks.length !== playerCount || stacks.some(n => !Number.isSafeInteger(n) || n < 0) || !Number.isSafeInteger(stacks.reduce((a, b) => a + b, 0)))
            throw new Error('Invalid stacks');
        this.totalChips = stacks.reduce((a, b) => a + b, 0);
        this.state = { players: stacks.map((n, i) => createPlayer(i ? ROBOT_NAMES[i - 1] : '你', n, i === 0, i ? pickRandomStyle(this.random) : null)),
            communityCards: [], pot: 0, street: 0, currentPlayerIndex: 0, minRaise: bb, currentBet: 0, lastBetAmount: bb,
            handOver: false, winnerIndex: null, winnerIndices: null, message: '', deck: [], dealerButtonIndex: 0, firstToActThisStreet: 0,
            sbPosition: 0, bbPosition: 1, actionLog: [], heroDecisions: [], settledPots: [], refunds: [], handNumber: 0, sb, bb };
    }
    getState() { return this.state; }
    getToCall() { return getToCall(this.state); }
    getLegalActions() { return legalActions(this.state); }
    getAdvice() {
        const s = this.state;
        if (!this.getLegalActions().canAct || s.currentPlayerIndex !== 0)
            return null;
        const key = s.handNumber + ':' + s.actionLog.length;
        if (this.cachedAdvice?.key === key)
            return this.cachedAdvice.value;
        const value = recommend(s.players[0].hand, s, { random: this.random });
        this.cachedAdvice = { key, value };
        return value;
    }
    nextSeat(from, indices) { for (let n = 1; n <= this.state.players.length; n++) {
        const i = (from + n) % this.state.players.length;
        if (indices.includes(i))
            return i;
    } throw new Error('No eligible seat'); }
    startNewHand() {
        const s = this.state, funded = s.players.map((p, i) => p.chips > 0 ? i : -1).filter(i => i >= 0);
        if ((s.handNumber > 0 && !s.handOver) || funded.length < 2 || s.players[0].chips === 0)
            return false;
        if (s.handNumber) {
            const previousBB = s.bbPosition;
            s.bbPosition = this.nextSeat(previousBB, funded);
            if (funded.length === 2) {
                s.dealerButtonIndex = funded.find(i => i !== s.bbPosition);
                s.sbPosition = s.dealerButtonIndex;
            }
            else {
                // Dead-button tournament rotation: the BB always moves to the next funded seat.
                const occupied = s.players.map((p, i) => p.inHand ? i : -1).filter(i => i >= 0);
                const reverse = clockwise(occupied, s.bbPosition, s.players.length).filter(i => i !== s.bbPosition).reverse();
                s.sbPosition = funded.includes(reverse[0]) ? reverse[0] : -1;
                s.dealerButtonIndex = reverse[1];
            }
        }
        else {
            if (!funded.includes(s.dealerButtonIndex))
                s.dealerButtonIndex = funded[0];
            s.sbPosition = funded.length === 2 ? s.dealerButtonIndex : this.nextSeat(s.dealerButtonIndex, funded);
            s.bbPosition = this.nextSeat(s.sbPosition, funded);
        }
        Object.assign(s, { communityCards: [], pot: 0, street: 0, currentBet: this.bb, minRaise: this.bb, lastBetAmount: this.bb, handOver: false,
            winnerIndex: null, winnerIndices: null, message: '', actionLog: [], heroDecisions: [], settledPots: [], refunds: [], startingChips: s.players.map(p => p.chips), handNumber: s.handNumber + 1 });
        this.cachedAdvice = null;
        s.deck = createDeck();
        for (let i = s.deck.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [s.deck[i], s.deck[j]] = [s.deck[j], s.deck[i]];
        }
        for (const p of s.players)
            Object.assign(p, { hand: [], isFolded: p.chips === 0, isEliminated: p.chips === 0, inHand: p.chips > 0, isAllIn: false, currentBet: 0, totalBetThisHand: 0, lastAction: null, actedThisStreet: false, lastActedBet: 0, raiseThreshold: this.bb });
        const order = clockwise(funded, s.dealerButtonIndex, s.players.length);
        for (let round = 0; round < 2; round++)
            for (const i of order)
                s.players[i].hand.push(s.deck.pop());
        for (const [i, blind, action] of [[s.sbPosition, this.sb, 'sb'], [s.bbPosition, this.bb, 'bb']])
            if (i >= 0) {
                const amount = Math.min(blind, s.players[i].chips);
                this.commit(i, amount);
                s.actionLog.push({ street: 0, player: i, name: s.players[i].name, action, amount, allIn: s.players[i].isAllIn });
            }
        this.advance(s.bbPosition);
        return true;
    }
    commit(index, amount) { const s = this.state, p = s.players[index]; if (!Number.isSafeInteger(amount) || amount < 0 || amount > p.chips)
        throw new Error('Invalid commitment'); p.chips -= amount; p.currentBet += amount; p.totalBetThisHand += amount; s.pot += amount; p.isAllIn = p.chips === 0; }
    act(action, amount) {
        const s = this.state, i = s.currentPlayerIndex, p = s.players[i], l = this.getLegalActions();
        const reject = message => { this.lastError = message; return false; };
        if (!l.canAct)
            return reject('当前玩家不能行动');
        if (action === 'allin') {
            if (!l.canAllIn)
                return reject('加注权尚未重开');
            if (l.allInIsCall)
                action = 'call';
            else {
                action = 'raise';
                amount = l.maxRaiseTo;
            }
        }
        if (action === 'call' && !l.toCall)
            action = 'check';
        if (!['fold', 'check', 'call', 'raise', 'bet'].includes(action))
            return reject('未知操作');
        if (action === 'check' && !l.canCheck)
            return reject('面对下注不能过牌');
        if (action === 'raise' || action === 'bet') {
            if (!l.canRaise || !Number.isSafeInteger(amount) || amount > l.maxRaiseTo || amount <= l.currentBet || (amount < l.minRaiseTo && amount !== l.maxRaiseTo))
                return reject('加注金额或加注权不合法');
            action = l.currentBet === 0 ? 'bet' : 'raise';
        }
        const advice = i === 0 && this.options.coaching !== false ? this.getAdvice() : null;
        this.lastError = '';
        let added = 0, fullRaise = false;
        if (action === 'fold')
            p.isFolded = true;
        if (action === 'call') {
            added = l.callAmount;
            this.commit(i, added);
        }
        if (action === 'raise' || action === 'bet') {
            added = amount - p.currentBet;
            this.commit(i, added);
            const increment = amount - l.currentBet;
            fullRaise = increment >= s.minRaise;
            if (fullRaise)
                s.minRaise = increment;
            s.currentBet = amount;
            s.lastBetAmount = amount;
        }
        p.actedThisStreet = true;
        p.lastActedBet = betToMatch(s);
        p.raiseThreshold = s.minRaise;
        p.lastAction = { type: action, amount: (action === 'raise' || action === 'bet') ? amount : added, allIn: p.isAllIn, fullRaise };
        s.actionLog.push({ street: s.street, player: i, name: p.name, action, amount: p.lastAction.amount, totalBet: p.currentBet, addedAmount: added, allIn: p.isAllIn, fullRaise });
        if (advice)
            s.heroDecisions.push({ street: s.street, action, amount, allIn: p.isAllIn, recommended: advice.action, recommendedAmount: advice.betAmount, advice:structuredClone(advice), actualAmount:p.lastAction.amount, addedAmount:added, winProbability: advice.winProbability, requiredEquity: advice.requiredEquity, coach: advice.coach });
        this.advance(i);
        this.assertChips();
        return true;
    }
    returnUncalled() {
        const s = this.state, ordered = s.players.map((p, i) => ({ p, i })).filter(({ p }) => p.currentBet > 0).sort((a, b) => b.p.currentBet - a.p.currentBet);
        if (!ordered.length)
            return;
        const { p, i } = ordered[0], excess = p.currentBet - (ordered[1]?.p.currentBet ?? 0);
        if (excess > 0) {
            p.currentBet -= excess;
            p.totalBetThisHand -= excess;
            p.chips += excess;
            p.isAllIn = p.chips === 0;
            s.pot -= excess;
            s.refunds.push({ player: i, amount: excess });
            s.actionLog.push({ street: s.street, player: i, name: p.name, action: 'return', amount: excess });
        }
    }
    advance(after) {
        const s = this.state;
        while (!s.handOver) {
            const live = livePlayers(s);
            if (live.length === 1) {
                this.returnUncalled();
                this.endHand();
                return;
            }
            const actionable = live.filter(({ p }) => p.chips > 0), match = betToMatch(s);
            const pending = actionable.filter(({ p }) => p.currentBet < match || (actionable.length > 1 && !p.actedThisStreet)).map(({ i }) => i);
            if (pending.length) {
                s.currentPlayerIndex = this.nextSeat(after, pending);
                s.firstToActThisStreet = s.currentPlayerIndex;
                return;
            }
            this.returnUncalled();
            if (s.street === 3) {
                this.endHand();
                return;
            }
            s.street++;
            s.deck.pop();
            for (let n = 0; n < (s.street === 1 ? 3 : 1); n++)
                s.communityCards.push(s.deck.pop());
            s.currentBet = 0;
            s.minRaise = this.bb;
            s.lastBetAmount = this.bb;
            for (const p of s.players) {
                p.currentBet = 0;
                p.actedThisStreet = false;
                p.lastActedBet = 0;
                p.raiseThreshold = this.bb;
            }
            after = s.dealerButtonIndex;
        }
    }
    endHand() {
        const s = this.state, live = livePlayers(s), won = new Set();
        s.settledPots = [];
        for (const pot of mergeEquivalentPots(buildPots(s.players))) {
            if (pot.uncalled)
                throw new Error('Unreturned excess');
            if (!pot.eligible.length)
                throw new Error('Pot has no eligible player');
            let winners = [...pot.eligible];
            if (live.length > 1) {
                if (s.communityCards.length !== 5)
                    throw new Error('Incomplete showdown');
                let best = null;
                winners = [];
                for (const i of pot.eligible) {
                    const value = bestHand([...s.players[i].hand, ...s.communityCards]);
                    const cmp = best ? compareEval(value, best) : 1;
                    if (cmp > 0) {
                        best = value;
                        winners = [i];
                    }
                    else if (cmp === 0)
                        winners.push(i);
                }
            }
            const order = clockwise(winners, s.dealerButtonIndex, s.players.length), share = Math.floor(pot.amount / winners.length), remainder = pot.amount % winners.length;
            const awards = order.map((player, j) => ({ player, amount: share + (j < remainder ? 1 : 0) }));
            for (const award of awards) {
                s.players[award.player].chips += award.amount;
                won.add(award.player);
            }
            s.settledPots.push({ ...pot, winnerIndices: winners, awards });
        }
        s.pot = 0;
        s.handOver = true;
        s.winnerIndices = [...won];
        s.winnerIndex = s.winnerIndices[0] ?? null;
        s.message = '各底池已分别结算';
        this.assertChips();
    }
    assertChips() { const s = this.state; if (s.players.some(p => !Number.isSafeInteger(p.chips) || p.chips < 0) || s.pot < 0 || s.players.reduce((sum, p) => sum + p.chips, 0) + s.pot !== this.totalChips)
        throw new Error('Chip conservation failed'); }
    runAI() {
        const s = this.state, p = s.players[s.currentPlayerIndex], l = this.getLegalActions();
        if (!l.canAct || p.isHuman)
            return false;
        const opponents = livePlayers(s).length - 1, equity = estimateEquity(p.hand, s.communityCards, { opponents, simulations: 120, random: this.random }).equity;
        const context = callPotContext(s);
        let expected = 0;
        for (const pot of context.pots) {
            const n = pot.eligible.length - 1;
            const eq = n === opponents ? equity : estimateEquity(p.hand, s.communityCards, { opponents: n, simulations: 120, random: this.random }).equity;
            expected += eq * pot.amount;
        }
        const strong = s.street === 0 ? preflopHandStrength(p.hand) > 0.72 : equity > 0.7;
        if ((l.canFullRaise || l.shortAllIn) && strong && this.random() < 0.55 * (p.style?.aggrMod ?? 1)) {
            if (l.shortAllIn) return this.act('allin');
            const target = Math.min(l.maxRaiseTo, Math.max(l.minRaiseTo, l.currentBet + Math.max(s.minRaise, Math.round((s.pot + l.callAmount) * 0.6))));
            return this.act('raise', target);
        }
        if (l.canCheck)
            return this.act('check');
        if (expected - context.cost >= 0 || this.random() < 0.06)
            return this.act('call');
        return this.act('fold');
    }
}
export { hasPrivateValue, opponentRanges, PokerGame, estimateEquity, legalActions, buildPots, callPotContext, evaluateFive, compareEval, getToCall, countAggressors, requiredEquity, bestHand, handRankDisplayName, winProbability, winProbabilityMultiway, preflopHandStrength, recommend, getHandRecap, HAND_RANK_ZH, RANKS, SUITS, STREET, detectDraws, getPosition, boardDrawiness, describeHand, describePosition, describeBoard, pickRandomStyle, AI_STYLES, HandRank, cardToStr, handToStr, };
