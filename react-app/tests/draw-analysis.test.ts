import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawAnalysis,explainDraws} from '../src/engine/drawAnalysis.js';
import {PokerGame,bestHand,getHandRecap} from '../src/engine/game.js';
const c=(rank:number,suit:string)=>({rank,suit});
const hero=[c(8,'c'),c(5,'h')],board=[c(7,'s'),c(10,'s'),c(7,'d')];
test('screenshot: three backdoor straight paths, 48/1081, no one-card outs or flush draw',()=>{
  const d=drawAnalysis(hero,board);assert.equal(d.straight.outs,0);assert.equal(d.straight.nextProbability,0);assert.equal(d.straight.runouts,48);assert.equal(d.straight.totalRunouts,1081);assert.equal(d.straight.riverProbability,48/1081);assert.equal(d.straight.backdoor,true);
  assert.deepEqual(d.straight.paths.sort(),['4+6','6+9','9+11']);assert.equal(d.flush,null);
  assert.equal(drawAnalysis(hero,[...board,c(6,'c')]).straight.outs,8);assert.equal(drawAnalysis(hero,[...board,c(6,'c')]).straight.riverProbability,8/46);
  const seen=new Set([...hero,...board].map(c=>c.rank+c.suit)),deck=['s','h','d','c'].flatMap(suit=>Array.from({length:13},(_,i)=>c(i+2,suit))).filter(c=>!seen.has(c.rank+c.suit));let oracle=0;
  for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)if(bestHand([...hero,...board,deck[i],deck[j]]).rank===4)oracle++;assert.equal(oracle,48);
  assert.match(explainDraws(hero,board),/4\.4%/);assert.match(explainDraws(hero,board),/免费过牌/);assert.match(explainDraws(hero,board),/葫芦、四条/);
});
test('open-ended turn odds and two-card odds are distinct and exact',()=>{
  const h=[c(8,'c'),c(9,'h')],b=[c(6,'s'),c(7,'d'),c(13,'s')],d=drawAnalysis(h,b);
  assert.equal(d.straight.outs,8);assert.equal(d.straight.nextProbability,8/47);assert.equal(d.straight.riverProbability,340/1081);assert.equal(d.straight.backdoor,false);
  assert.equal(drawAnalysis(h,[...b,c(2,'d')]).straight.riverProbability,8/46);
});
test('flush and straight outs are deduplicated instead of added',()=>{
  const d=drawAnalysis([c(8,'s'),c(9,'s')],[c(6,'s'),c(7,'s'),c(13,'d')]);
  assert.equal(d.straight.outs,8);assert.equal(d.flush.outs,9);assert.equal(d.combined.outs,15);assert.ok(d.combined.riverProbability<d.straight.riverProbability+d.flush.riverProbability);
});
test('wheel and board-only straights are handled without inventing private draws',()=>{
  const d=drawAnalysis([c(2,'c'),c(3,'d')],[c(4,'s'),c(9,'h'),c(13,'h')]);assert.deepEqual(d.straight.paths.sort(),['5+14','5+6']);assert.equal(d.straight.runouts,32);
  assert.equal(drawAnalysis([c(2,'c'),c(3,'d')],[c(9,'s'),c(10,'h'),c(11,'c'),c(12,'d')]).straight,null);
  assert.equal(drawAnalysis(hero,[...board,c(6,'c'),c(9,'d')]).straight,null);
});
test('backdoor explanation addresses cost and does not promise two cards for one call',()=>{
  const text=explainDraws(hero,board,{cost:40});assert.match(text,/当前需付 40/);assert.match(text,/仅凭这项后门机会不支持跟注/);assert.match(text,/不保证免费看到河牌/);assert.match(text,/不是获胜率/);
  assert.doesNotMatch(explainDraws(hero,board,{cost:40,allIn:true}),/不保证免费看到河牌/);
});
test('coach and recap surface the actual backdoor judgment from decision time',()=>{
  const g=new PokerGame(5,10,1000,3,{coaching:true});g.startNewHand();const s=g.getState();s.street=1;s.currentPlayerIndex=0;s.currentBet=0;s.communityCards=board;s.players[0].hand=hero;
  for(const p of s.players){p.currentBet=0;p.actedThisStreet=false;}const a=g.getAdvice();assert.ok(a.analysisParts.find(p=>p.title==='听牌与追牌判断'&&p.body.includes('4.4%')));
  assert.equal(a.action,'过牌');g.act('check');s.communityCards.push(c(2,'c'));assert.deepEqual(getHandRecap(s).decisions[0].analysisParts,a.analysisParts);
});
