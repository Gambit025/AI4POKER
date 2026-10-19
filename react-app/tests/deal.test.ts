import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PokerGame} from '../src/engine/game.js';
import {dealPlan,isShowdown} from '../src/presentation/deal.ts';

test('dealing is two clockwise rounds, skipping eliminated seats',()=>{
  const g=new PokerGame(5,10,1000,6,{initialStacks:[1000,0,1000,1000,0,1000]});g.startNewHand();
  const s=g.getState(),p=dealPlan(s,'正常');
  assert.deepEqual(p.order,[2,3,5,0]);
  const times=p.order.flatMap((seat,i)=>[0,1].map(round=>({seat,round,time:(i+round*p.order.length)*p.interval}))).sort((a,b)=>a.time-b.time);
  assert.deepEqual(times.map(t=>t.seat),[2,3,5,0,2,3,5,0]);
  assert.ok(p.duration>=times.at(-1)!.time+180);
});
test('all speed presets finish dealing before the next action',()=>{
  const g=new PokerGame(5,10,1000,8);g.startNewHand();
  const s=g.getState(),fast=dealPlan(s,'快'),normal=dealPlan(s,'正常'),slow=dealPlan(s,'慢');
  assert.ok(fast.duration<normal.duration&&normal.duration<slow.duration);
  assert.equal(normal.order.length,8);assert.equal(normal.duration,15*65+200);
});
test('winning by folds on the river is not a showdown',()=>{
  const g=new PokerGame(5,10,1000,3);g.startNewHand();const s=g.getState();
  s.handOver=true;s.communityCards=[{rank:2,suit:'s'},{rank:3,suit:'s'},{rank:4,suit:'s'},{rank:5,suit:'s'},{rank:6,suit:'s'}];
  assert.equal(isShowdown(s),true);
  s.players[1].isFolded=true;s.players[2].isFolded=true;assert.equal(isShowdown(s),false);
  s.players[1].isFolded=false;s.handOver=false;assert.equal(isShowdown(s),false);
});
