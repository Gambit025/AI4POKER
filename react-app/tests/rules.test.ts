import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PokerGame, bestHand, estimateEquity, buildPots, callPotContext, evaluateFive, compareEval, getHandRecap} from '../src/engine/game.js';
const card=(rank:number,suit:string)=>({rank,suit});
const deck=()=>['s','h','d','c'].flatMap(suit=>Array.from({length:13},(_,i)=>card(i+2,suit)));
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function street(stacks:number[],board=[card(2,'c'),card(7,'d'),card(9,'h')]) {
  const game=new PokerGame(5,10,1000,stacks.length,{initialStacks:stacks,coaching:false,random:seeded(42)});game.startNewHand();
  const s=game.getState();Object.assign(s,{handOver:false,settledPots:[],refunds:[],street:1,currentPlayerIndex:0,currentBet:0,minRaise:10,pot:0,actionLog:[],communityCards:board});
  const used=new Set(board.map(c=>c.rank+c.suit)),remaining=deck().filter(c=>!used.has(c.rank+c.suit));
  s.players.forEach((p,i)=>Object.assign(p,{chips:stacks[i],currentBet:0,totalBetThisHand:0,isAllIn:false,isFolded:false,actedThisStreet:false,lastActedBet:0,raiseThreshold:10,hand:[remaining.pop(),remaining.pop()]}));
  s.deck=remaining;return game;
}
function done(game:PokerGame){let turns=0;while(!game.getState().handOver){assert.ok(++turns<100);assert.equal(game.act('call'),true);}return game.getState();}
test('short call caps payment and returns the unmatched part; no negative chips',()=>{
  const g=street([50,100,200]);g.getState().currentPlayerIndex=2;assert.ok(g.act('allin'));assert.ok(g.act('call'));assert.ok(g.act('call'));
  const s=g.getState();assert.ok(s.handOver);assert.deepEqual(s.settledPots.map(p=>p.amount),[150,100]);assert.deepEqual(s.refunds,[{player:2,amount:100}]);assert.equal(s.players.reduce((n,p)=>n+p.chips,0),350);
});
test('separate main/side pots award only eligible hands',()=>{
  const g=street([50,100,200],[card(2,'c'),card(3,'d'),card(7,'h')]),s=g.getState();
  s.players[0].hand=[card(14,'s'),card(14,'h')];s.players[1].hand=[card(13,'s'),card(13,'h')];s.players[2].hand=[card(12,'s'),card(12,'h')];
  s.deck=[card(9,'d'),card(8,'c'),card(10,'d'),card(8,'d')];
  s.currentPlayerIndex=2;g.act('allin');g.act('call');g.act('call');
  assert.deepEqual(s.settledPots.map(p=>p.winnerIndices),[[0],[1]]);assert.deepEqual(s.players.map(p=>p.chips),[150,100,100]);
});
test('short BB remains nominal bring-in, and big blind retains its option',()=>{
  const g=new PokerGame(5,10,100,3,{initialStacks:[100,100,3],coaching:false});g.startNewHand();assert.equal(g.getToCall(),10);g.act('call');assert.equal(g.getToCall(),5);g.act('call');assert.equal(g.getState().street,1);
  const h=new PokerGame(5,10,100,2,{coaching:false});h.startNewHand();h.act('call');assert.equal(h.getState().street,0);assert.ok(h.getLegalActions().canRaise);h.act('check');assert.equal(h.getState().street,1);
});
test('short blind heads-up permits no dry side bet and refunds forced excess',()=>{
  const g=new PokerGame(5,10,100,2,{initialStacks:[3,100],coaching:false});g.startNewHand();const s=g.getState();assert.ok(s.handOver);assert.equal(s.communityCards.length,5);assert.deepEqual(s.refunds,[{player:1,amount:7}]);assert.deepEqual(s.settledPots.map(p=>p.amount),[6]);
});
test('under-minimum non-all-in raises, overdrafts and invalid actions are atomic rejections',()=>{
  const g=street([100,100]);for(const [action,amount] of [['raise',5],['raise',101],['raise',NaN],['dance',0]] as const){const before=JSON.stringify(g.getState());assert.equal(g.act(action,amount),false);assert.equal(JSON.stringify(g.getState()),before);}
  assert.ok(g.act('raise',40));const before=JSON.stringify(g.getState());assert.equal(g.act('check'),false);assert.equal(JSON.stringify(g.getState()),before);
});
test('one short all-in does not reopen an acted player; cumulative full increment does',()=>{
  const g=street([1000,150,1000]);g.act('raise',100);g.act('allin');g.act('call');assert.equal(g.getLegalActions().canRaise,false);assert.equal(g.getLegalActions().minRaiseTo,250);assert.equal(g.act('allin'),false);g.act('call');
  const h=street([1000,150,200,1000]);h.act('raise',100);h.act('allin');h.act('allin');h.act('call');assert.equal(h.getLegalActions().canRaise,true);assert.equal(h.getLegalActions().minRaiseTo,300);
});
test('reopening is player-specific after calling a previous short raise',()=>{
  const g=street([1000,150,1000,200]);g.act('raise',100);g.act('allin');g.act('call');g.act('allin');assert.ok(g.getLegalActions().canRaise);g.act('call');assert.equal(g.getState().currentPlayerIndex,2);assert.equal(g.getLegalActions().canRaise,false);
});
test('checking before a short all-in does not reopen; an unacted player may raise',()=>{
  const g=street([100,5,100]);g.act('check');g.act('allin');assert.ok(g.getLegalActions().canRaise);assert.equal(g.getLegalActions().minRaiseTo,15);g.act('call');assert.equal(g.getLegalActions().canRaise,false);
});
test('folded chips count in pots, but folded hands never win',()=>{
  const g=street([100,100,100]);g.act('raise',20);g.act('call');g.act('raise',40);g.act('fold');g.act('call');const s=done(g);assert.ok(s.settledPots.every(p=>!p.winnerIndices?.includes(0)));assert.equal(s.settledPots.reduce((n,p)=>n+p.amount,0),100);
});
test('odd chips go clockwise left of the button, separately per pot',()=>{
  for(const button of [0,1,2]){const g=street([10,10,10],[card(14,'s'),card(13,'s'),card(12,'s'),card(11,'s'),card(10,'s')]),s=g.getState();s.street=3;s.dealerButtonIndex=button;
    // Three chips from each player, third player folds: 9 split 5/4.
    for(const p of s.players){p.chips-=3;p.currentBet=3;p.totalBetThisHand=3;}s.pot=9;s.currentBet=3;s.players[2].isFolded=true;
    done(g);const first=button===0?1:0;assert.equal(s.settledPots[0].awards.find(a=>a.player===first)?.amount,5);}
});
test('pot odds exclude unreachable side pots and use actual short-call cost',()=>{
  const g=street([50,500,500]),s=g.getState();s.players[1].chips=300;s.players[1].totalBetThisHand=200;s.players[1].currentBet=200;s.players[2].chips=300;s.players[2].totalBetThisHand=200;s.players[2].currentBet=200;s.pot=400;s.currentBet=200;
  const c=callPotContext(s);assert.equal(c.cost,50);assert.equal(c.contestable,150);assert.equal(c.requiredEquity,1/3);assert.equal(buildPots(s.players).length,1);
});
test('all-in equity splits ties correctly and river nuts are not forced to 50%',()=>{
  const royal=[card(14,'s'),card(13,'s'),card(12,'s'),card(11,'s'),card(10,'s')];
  for(const opponents of [1,2,7])assert.ok(Math.abs(estimateEquity([card(2,'d'),card(3,'d')],royal,{opponents,random:seeded(1)}).equity-1/(opponents+1))<1e-12);
  const nuts=estimateEquity([card(14,'s'),card(13,'s')],[card(12,'s'),card(11,'s'),card(10,'s'),card(2,'c'),card(3,'d')]);assert.equal(nuts.equity,1);assert.equal(nuts.exact,true);assert.equal(nuts.samples,990);
  assert.throws(()=>estimateEquity([card(14,'s'),card(14,'s')],[]));
});
test('7-card evaluator agrees with independent 21-combination 5-card evaluator',()=>{
  const random=seeded(12),d=deck();for(let n=0;n<4000;n++){const pool=[...d],cards=[];for(let j=0;j<7;j++)cards.push(pool.splice(Math.floor(random()*pool.length),1)[0]);let oracle=null;for(let a=0;a<7;a++)for(let b=a+1;b<7;b++){const value=evaluateFive(cards.filter((_,i)=>i!==a&&i!==b));if(!oracle||compareEval(value,oracle)>0)oracle=value;}assert.deepEqual(bestHand(cards),oracle);}
});
test('finite-stack randomized play conserves chips and terminates for 2–8 players',()=>{
  for(let n=2;n<=8;n++)for(let seed=1;seed<=60;seed++){
    const random=seeded(seed*7919+n),stacks=Array.from({length:n},()=>1+Math.floor(random()*200));
    const g=new PokerGame(5,10,100,n,{initialStacks:stacks,random,coaching:false});assert.ok(g.startNewHand());let actions=0;
    while(!g.getState().handOver){const l=g.getLegalActions();assert.ok(l.canAct);assert.ok(++actions<500);const roll=random();let accepted;
      if(l.canAllIn&&roll<0.18)accepted=g.act('allin');else if(l.canFullRaise&&roll<0.4)accepted=g.act('raise',Math.min(l.maxRaiseTo,l.minRaiseTo+Math.floor(random()*30)));else accepted=g.act(l.canCheck?'check':roll<0.55?'fold':'call');
      assert.ok(accepted);const s=g.getState();const visible=[...s.players.flatMap(p=>p.hand),...s.communityCards,...s.deck];assert.equal(new Set(visible.map(c=>c.suit+c.rank)).size,visible.length);assert.ok(s.players.every(p=>p.chips>=0&&Number.isInteger(p.chips)));assert.equal(s.players.reduce((n,p)=>n+p.chips,0)+s.pot,stacks.reduce((a,b)=>a+b,0));
      if(!s.handOver)assert.equal(s.pot,s.players.reduce((n,p)=>n+p.totalBetThisHand,0));
    }
    const state=g.getState();assert.equal(state.communityCards.length===5||state.players.filter(p=>!p.isFolded&&p.inHand).length===1,true);
    const snapshot=JSON.stringify(state);if(state.players[0].chips===0||state.players.filter(p=>p.chips>0).length===1){assert.equal(g.startNewHand(),false);assert.equal(JSON.stringify(state),snapshot);}
  }
});
test('new hands never silently refill stacks or interrupt an unfinished hand',()=>{
  const g=new PokerGame(5,10,20,3,{coaching:false});g.startNewHand();const before=JSON.stringify(g.getState());assert.equal(g.startNewHand(),false);assert.equal(JSON.stringify(g.getState()),before);done(g);const oldBB=g.getState().bbPosition;assert.ok(g.startNewHand());assert.notEqual(g.getState().bbPosition,oldBB);
});
test('recap does not label model disagreement as a proven mistake',()=>{const g=new PokerGame();g.startNewHand();g.act('fold');const recap=getHandRecap(g.getState());assert.equal(recap.grade,'回顾');assert.ok(recap.decisions.every(d=>d.ratingLabel==='决策记录'));});
test('unacted player can short-shove, and sole remaining stack cannot bet a dry side pot',()=>{
  const g=street([50,100,200]);g.act('allin');g.act('allin');assert.equal(g.getLegalActions().canRaise,false);assert.equal(g.getLegalActions().canAllIn,false);assert.equal(g.getLegalActions().callAmount,100);assert.ok(g.act('call'));assert.ok(g.getState().handOver);
  const h=street([15,100,100]);h.act('allin');assert.equal(h.getLegalActions().minRaiseTo,30);assert.ok(h.getLegalActions().canRaise);
});
test('heads-up dealer is first preflop and last postflop, including a transition after elimination',()=>{
  const g=new PokerGame(5,10,100,3,{coaching:false});g.startNewHand();const s=g.getState();done(g);
  // A valid next-hand stack distribution after seat 1 is eliminated.
  s.players[0].chips=150;s.players[1].chips=0;s.players[2].chips=150;
  assert.equal(s.bbPosition,2);assert.ok(g.startNewHand());assert.equal(s.bbPosition,0);assert.equal(s.sbPosition,2);assert.equal(s.dealerButtonIndex,2);assert.equal(s.currentPlayerIndex,2);assert.equal(s.players[1].hand.length,0);g.act('call');g.act('check');assert.equal(s.currentPlayerIndex,0);assert.equal(s.street,1);
});
test('dead button and dead small blind handle consecutive eliminated seats',()=>{
  const g=new PokerGame(5,10,100,6,{coaching:false});g.startNewHand();const s=g.getState();done(g);
  s.players.forEach((p,i)=>p.chips=[200,200,0,0,0,200][i]);
  assert.ok(g.startNewHand());assert.equal(s.bbPosition,5);assert.equal(s.sbPosition,-1);assert.equal(s.dealerButtonIndex,3);assert.equal(s.currentPlayerIndex,0);assert.equal(s.players.filter(p=>p.hand.length===2).length,3);
  done(g);assert.ok(g.startNewHand());assert.equal(s.bbPosition,0);assert.equal(s.sbPosition,5);assert.equal(s.dealerButtonIndex,1);
});
test('AI stays legal with unequal finite stacks through complete sessions',()=>{
  for(let count=2;count<=8;count++){
    const random=seeded(count*123),g=new PokerGame(5,10,100,count,{initialStacks:Array.from({length:count},(_,i)=>15+i*13),coaching:false,random});
    for(let hand=0;hand<8&&g.startNewHand();hand++){
      let steps=0;while(!g.getState().handOver){assert.ok(++steps<500);const s=g.getState(),l=g.getLegalActions();assert.ok(l.canAct);assert.ok(s.currentPlayerIndex===0?g.act(l.canCheck?'check':random()<0.5?'call':'fold'):g.runAI());}
    }
  }
});
test('draw detection respects wheel endpoints, overlapping outs and made hands',()=>{
  // Imported dynamically below so test remains explicit about the feature under test.
  const wheel=draws([card(14,'s'),card(2,'d')],[card(3,'c'),card(4,'h'),card(9,'s')]);assert.equal(wheel.outs,4);assert.equal(wheel.gutshot,true);assert.equal(wheel.oesd,false);
  const combo=draws([card(8,'s'),card(9,'s')],[card(6,'s'),card(7,'d'),card(13,'s')]);assert.equal(combo.outs,15);assert.equal(combo.comboDraw,true);
  const made=draws([card(8,'s'),card(9,'d')],[card(6,'c'),card(7,'h'),card(10,'s')]);assert.equal(made.outs,0);
});
import {detectDraws as draws} from '../src/engine/game.js';
import {recommend} from '../src/engine/game.js';
test('coach ignores actual hidden opponent cards and never suggests a forbidden raise',()=>{
  const g=street([1000,150,1000]);g.act('raise',100);g.act('allin');g.act('call');const s=g.getState();
  const first=recommend(s.players[0].hand,s,{random:seeded(99)});s.players[1].hand=[card(14,'h'),card(14,'d')];s.players[2].hand=[card(2,'s'),card(3,'s')];
  const second=recommend(s.players[0].hand,s,{random:seeded(99)});assert.equal(first.winProbability,second.winProbability);assert.equal(first.betAmount,null);assert.equal(second.betAmount,null);assert.match(first.coach,/尚未/);
});
test('known opponent blockers and exact win/tie/loss shares are consistent',()=>{
  const board=[card(2,'c'),card(3,'d'),card(7,'h'),card(9,'s'),card(10,'d')];
  const win=estimateEquity([card(14,'s'),card(14,'h')],board,{knownHands:[[card(13,'s'),card(13,'h')]]});assert.equal(win.win,1);assert.equal(win.tie,0);assert.equal(win.lose,0);assert.equal(win.samples,1);
  const loss=estimateEquity([card(13,'s'),card(13,'h')],board,{knownHands:[[card(14,'s'),card(14,'h')]]});assert.equal(loss.equity,0);assert.equal(loss.lose,1);
  const sampled=estimateEquity([card(14,'s'),card(13,'s')],board.slice(0,3),{opponents:5,random:seeded(102),simulations:1000});assert.ok(Math.abs(sampled.win+sampled.tie+sampled.lose-1)<1e-12);assert.ok(sampled.equity>=sampled.win&&sampled.equity<=sampled.win+sampled.tie);
});
test('AI can make a legal short all-in opening instead of trying to overdraw',()=>{
  const g=street([5,100]),s=g.getState();s.players[0].isHuman=false;s.players[0].hand=[card(14,'s'),card(14,'h')];g.random=()=>0.01;
  assert.ok(g.getLegalActions().shortAllIn);assert.ok(g.runAI());assert.equal(s.actionLog[0].allIn,true);assert.equal(s.actionLog[0].fullRaise,false);assert.equal(s.players[0].chips,0);assert.equal(s.actionLog[0].amount,5);
});
test('folded dead-money layers with identical eligibility merge before odd-chip splitting',()=>{
  const g=street([100,100,100,100,100],[card(14,'s'),card(13,'s'),card(12,'s'),card(11,'s'),card(10,'s')]),s=g.getState();s.street=3;
  const contributions=[10,10,1,2,3];s.players.forEach((p,i)=>{p.chips=100-contributions[i];p.currentBet=contributions[i];p.totalBetThisHand=contributions[i];p.isFolded=i>=2;});s.pot=26;s.currentBet=10;
  done(g);assert.equal(s.settledPots.length,1);assert.equal(s.settledPots[0].amount,26);assert.deepEqual(s.settledPots[0].awards.map(a=>a.amount),[13,13]);
});
