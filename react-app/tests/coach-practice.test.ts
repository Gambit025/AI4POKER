import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PokerGame,recommend,hasPrivateValue,getHandRecap,describePosition} from '../src/engine/game.js';
const c=(rank:number,suit:string)=>({rank,suit});
const rng=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function table(stacks=[1000,1000,1000,1000]){const g=new PokerGame(5,10,1000,stacks.length,{initialStacks:stacks,coaching:true,random:rng(198)});g.startNewHand();const s=g.getState();s.currentPlayerIndex=0;return {g,s};}
test('a shared board pair or board-only straight does not justify automatic value betting',()=>{
  assert.equal(hasPrivateValue([c(14,'s'),c(12,'d')],[c(13,'h'),c(13,'c'),c(2,'s')]),false);
  assert.equal(hasPrivateValue([c(14,'s'),c(14,'d')],[c(13,'h'),c(13,'c'),c(2,'s')]),true);
  assert.equal(hasPrivateValue([c(14,'s'),c(3,'d')],[c(5,'h'),c(6,'c'),c(7,'s'),c(8,'h'),c(9,'d')]),false);
});
test('multiple limpers increase isolation size and are explicitly explained',()=>{
  const a=table().s;a.players[0].hand=[c(14,'s'),c(14,'h')];
  const open=recommend(a.players[0].hand,a,{random:rng(1)});
  a.actionLog.push({street:0,player:1,name:'A',action:'call',amount:5},{street:0,player:3,name:'C',action:'call',amount:10});
  const isolate=recommend(a.players[0].hand,a,{random:rng(1)});
  assert.ok(isolate.betAmount!>open.betAmount!);assert.match(isolate.summary,/2 人跟入/);assert.equal(isolate.details.limpers,2);
});
test('short all-in call warning uses the actual capped cost and is retained in recap',()=>{
  const {g,s}=table([100,1000,1000,1000]);s.players[0].hand=[c(14,'s'),c(13,'h')];
  s.players[1].currentBet=300;s.players[1].totalBetThisHand+=295;s.players[1].chips-=295;s.pot+=295;s.currentBet=300;
  const advice=g.getAdvice()!;assert.equal(advice.details.callCost,100);assert.match(advice.risk,/全部剩余 100/);g.act('call');
  const recap=getHandRecap(g.getState());assert.equal(recap.decisions[0].risk,advice.risk);assert.ok(recap.decisions[0].takeaway);
});
test('covering an all-in opponent does not report the hero as having zero chips behind',()=>{
  const {s}=table();s.players[1].chips=0;s.players[1].currentBet=100;s.players[1].totalBetThisHand=100;s.players[2].isFolded=true;s.players[3].isFolded=true;s.currentBet=100;
  const advice=recommend(s.players[0].hand,s,{random:rng(1)});assert.equal(advice.details.remainingBB,100);assert.equal(advice.details.callCost,100);assert.doesNotMatch(advice.risk,/后手较短/);
});
test('weak hand facing a large preflop raise explains the cost instead of encouraging commitment',()=>{
  const {s}=table();s.players[0].hand=[c(5,'s'),c(2,'d')];s.players[1].chips-=295;s.players[1].currentBet=300;s.players[1].totalBetThisHand=300;s.pot+=295;s.currentBet=300;
  s.actionLog.push({street:0,player:1,name:'A',action:'raise',amount:300,totalBet:300,addedAmount:295});
  const advice=recommend(s.players[0].hand,s,{random:rng(1)});assert.equal(advice.action,'优先弃牌');assert.match(advice.summary,/大额加注/);assert.equal(advice.betAmount,null);
});

test('pending seats are not certain callers when advising AJ against one opener',()=>{
  const {s}=table([200,200,200,200,200,200,200,200]);s.players[0].hand=[c(14,'s'),c(11,'c')];
  s.players[7].chips=178;s.players[7].currentBet=22;s.players[7].totalBetThisHand=22;s.players[7].actedThisStreet=true;s.currentBet=22;s.pot+=22;
  for(const i of [3,4,5,6])s.players[i].isFolded=true;
  s.actionLog.push({street:0,player:7,name:'G',action:'raise',amount:22,totalBet:22,addedAmount:22});
  const advice=recommend(s.players[0].hand,s,{random:rng(9),simulations:1500});
  assert.notEqual(advice.action,'优先弃牌');assert.ok(advice.sensitivity.evHigh>0);assert.match(advice.cautions,/尚未行动玩家弃牌/);
});

test('seeded practice also seeds bot styles and dealing',()=>{
  const a=table().g,b=table().g;assert.deepEqual(a.getState(),b.getState());
});

test('late position description does not mislabel the cutoff as the button',()=>{assert.equal(describePosition('LP'),'后位');});
