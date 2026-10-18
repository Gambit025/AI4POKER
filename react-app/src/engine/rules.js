/** Digital no-limit Hold'em betting rules. Amounts are integer chips; raise amounts are round totals. */
export function inHand(player) { return !player.isEliminated && player.inHand !== false && player.hand?.length === 2; }
export function livePlayers(state) { return state.players.map((p, i) => ({ p, i })).filter(({ p }) => inHand(p) && !p.isFolded); }
export function betToMatch(state) {
    const live = livePlayers(state);
    const actual = Math.max(0, ...state.players.map(p => p.currentBet));
    // No player can bet into a dry side pot. With a sole remaining stack, only actual live wagers need matching.
    if (live.filter(({ p }) => p.chips > 0).length <= 1)
        return Math.max(0, ...live.map(({ p }) => p.currentBet));
    return Math.max(actual, state.currentBet ?? actual);
}
export function legalActions(state, index = state.currentPlayerIndex) {
    const p = state.players[index];
    const active = !!p && !state.handOver && index === state.currentPlayerIndex && inHand(p) && !p.isFolded && p.chips > 0;
    const currentBet = betToMatch(state), toCall = p ? Math.max(0, currentBet - p.currentBet) : 0;
    const callAmount = p ? Math.min(p.chips, toCall) : 0;
    const maxRaiseTo = p ? p.currentBet + p.chips : 0;
    const minRaiseTo = currentBet + state.minRaise;
    const reopened = !!p && (!p.actedThisStreet || currentBet - (p.lastActedBet ?? 0) >= (p.raiseThreshold ?? state.minRaise));
    const hasOpponent = livePlayers(state).some(({ p: other, i }) => i !== index && other.chips > 0);
    const canRaise = active && reopened && hasOpponent && maxRaiseTo > currentBet;
    return { canAct: active, currentBet, toCall, callAmount, canFold: active, canCheck: active && toCall === 0, canCall: active && toCall > 0,
        canRaise, raiseReopened: reopened, minRaiseTo, maxRaiseTo, canFullRaise: canRaise && maxRaiseTo >= minRaiseTo,
        canAllIn: active && (maxRaiseTo <= currentBet || canRaise), allInIsCall: maxRaiseTo <= currentBet,
        shortAllIn: canRaise && maxRaiseTo < minRaiseTo };
}
export function buildPots(players) {
    const levels = [...new Set(players.map(p => p.totalBetThisHand).filter(n => n > 0))].sort((a, b) => a - b);
    let previous = 0;
    return levels.map(level => {
        const contributors = players.map((p, i) => ({ p, i })).filter(({ p }) => p.totalBetThisHand >= level);
        const pot = { amount: (level - previous) * contributors.length, cap: level,
            eligible: contributors.filter(({ p }) => !p.isFolded && !p.isEliminated && p.inHand !== false).map(({ i }) => i),
            contributors: contributors.map(({ i }) => i), uncalled: contributors.length === 1 };
        previous = level;
        return pot;
    });
}
export function callPotContext(state, index = state.currentPlayerIndex) {
    const legal = legalActions(state, index);
    const after = state.players.map((p, i) => ({ ...p, totalBetThisHand: p.totalBetThisHand + (i === index ? legal.callAmount : 0) }));
    // Keep the hero's actual call cap. For other funded players, conservatively assume they continue
    // up to levels they can cover; their future added chips are deliberately not counted in pot value.
    // An unacted blind is not an all-in player and must not be excluded merely by its current post.
    const pots = buildPots(after).filter(p => p.eligible.includes(index) && !p.uncalled).map(pot=>({...pot,
        eligible:after.flatMap((player,i)=>i===index?[index]:inHand(player)&&!player.isFolded&&player.totalBetThisHand+player.chips>=pot.cap?[i]:[])}));
    const contestable = pots.reduce((sum, p) => sum + p.amount, 0);
    return { cost: legal.callAmount, contestable, pots, requiredEquity: contestable > 0 ? legal.callAmount / contestable : 0 };
}
export function clockwise(indices, button, seats) {
    return [...indices].sort((a, b) => ((a - button - 1 + seats) % seats) - ((b - button - 1 + seats) % seats));
}

// Folded dead money can create contribution levels without creating a distinct side pot.
// Merge equal eligibility BEFORE splitting, otherwise separate odd chips can change the result.
export function mergeEquivalentPots(pots) {
  const merged=[];
  for(const pot of pots){
    const previous=merged.at(-1);
    if(previous&&!pot.uncalled&&!previous.uncalled&&previous.eligible.join(',')===pot.eligible.join(',')){
      previous.amount+=pot.amount;previous.cap=pot.cap;
      previous.contributors=[...new Set([...previous.contributors,...pot.contributors])];
    }else merged.push({...pot,eligible:[...pot.eligible],contributors:[...pot.contributors]});
  }
  return merged;
}
