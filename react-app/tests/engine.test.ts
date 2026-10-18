import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokerGame, getPosition, countAggressors, detectDraws } from '../src/engine/game.js';

for (const count of [2,3,4,6,8]) {
  test(`${count}-player blind positions match coach position labels for every dealer seat`, () => {
    for(let dealer=0;dealer<count;dealer++) {
      const game = new PokerGame(5,10,1000,count);
      const state = game.getState();state.dealerButtonIndex=dealer;game.startNewHand();
      assert.equal(getPosition(state.sbPosition,state),'SB');
      assert.equal(getPosition(state.bbPosition,state),'BB');
    }
  });
}
test('blinds, calls, hero raises and old streets do not inflate opponent aggression', () => {
  const game = new PokerGame(5,10,1000,4);game.startNewHand();const state=game.getState();
  assert.equal(countAggressors(state),0);
  state.actionLog.push({street:0,player:1,name:'A',action:'call',amount:5});
  state.actionLog.push({street:0,player:0,name:'你',action:'raise',amount:30});
  assert.equal(countAggressors(state),0);
  state.actionLog.push({street:0,player:2,name:'B',action:'raise',amount:60});
  state.actionLog.push({street:0,player:2,name:'B',action:'raise',amount:120});
  assert.equal(countAggressors(state),1);
  state.street=1;assert.equal(countAggressors(state),0);
  state.actionLog.push({street:1,player:2,name:'B',action:'bet',amount:60});
  assert.equal(countAggressors(state),1);
  state.players[2].isFolded=true;assert.equal(countAggressors(state),0);
});
test('invalid check and non-finite wager leave chips, logs and recap decisions untouched', () => {
  const game = new PokerGame(5,10,1000,2);game.startNewHand();const state=game.getState();
  const before=JSON.stringify(state);
  game.act('check');game.act('raise',NaN);game.act('raise',Infinity);game.act('bet',-1);
  assert.equal(JSON.stringify(state),before);
});
test('opening a street is logged as a bet; a free call is a check', () => {
  const game = new PokerGame(5,10,1000,2);game.startNewHand();
  game.act('call'); // Small blind completes; big blind can check.
  game.act('call'); // A zero-cost call should be a check, then deal the flop.
  const state=game.getState();
  assert.equal(state.actionLog.at(-1)?.action,'check');assert.equal(state.street,1);
  game.act('raise',20);assert.equal(state.actionLog.at(-1)?.action,'bet');
  assert.equal(state.actionLog.at(-1)?.amount,20);
});

test('river cards cannot retain future draws or outs', () => {
  const hand=[{rank:14,suit:'s'},{rank:13,suit:'s'}];
  const flop=[{rank:12,suit:'s'},{rank:11,suit:'s'},{rank:2,suit:'d'}];
  assert.ok(detectDraws(hand,flop).outs>0);
  const river=detectDraws(hand,[...flop,{rank:3,suit:'h'},{rank:4,suit:'c'}]);
  assert.equal(river.outs,0);assert.equal(river.drawStrength,0);assert.equal(river.flushDraw,false);assert.equal(river.oesd,false);
});
test('recap snapshots use the same advice the hero actually saw', () => {
  const game=new PokerGame(5,10,1000,2);game.startNewHand();
  const advice=game.getAdvice();assert.ok(advice);
  assert.equal(game.getAdvice(),advice);
  game.act('fold');const decision=game.getState().heroDecisions?.[0];
  assert.equal(decision.recommended,advice.action);
  assert.equal(decision.winProbability,advice.winProbability);
  assert.equal(decision.recommendedAmount,advice.betAmount);
});
