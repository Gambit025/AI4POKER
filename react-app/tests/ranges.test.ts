import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PokerGame,opponentRanges,preflopHandStrength,estimateEquity,recommend,getHandRecap} from '../src/engine/game.js';
import {publicActions} from '../src/engine/ranges.js';
const c=(rank:number,suit:string)=>({rank,suit});
const random=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function table(depth=100){const g=new PokerGame(5,10,depth*10,6,{coaching:false,random:random(42)});g.startNewHand();const s=g.getState();s.currentPlayerIndex=0;s.players[0].hand=[c(14,'s'),c(12,'h')];return {g,s};}
const mean=(range:any)=>range.combos.reduce((sum:number,combo:any)=>sum+preflopHandStrength(combo.hand)*combo.weight,0)/range.combos.reduce((sum:number,combo:any)=>sum+combo.weight,0);
const weight=(range:any,hand:any[])=>range.combos.find((combo:any)=>hand.every(card=>combo.hand.some((actual:any)=>actual.suit===card.suit&&actual.rank===card.rank))).weight;
function raise(s:any,player:number,total=30){s.actionLog.push({street:0,player,name:s.players[player].name,action:'raise',amount:total,totalBet:total,addedAmount:total});}
test('unacted players and forced blinds keep an equal prior despite position and depth',()=>{
  const {s}=table();for(const range of opponentRanges(s)){assert.ok(range.combos.every(combo=>combo.weight===1));assert.equal(range.informed,false);}
});
test('an early-position opening range is tighter than a late-position opening with the same size',()=>{
  const early=table().s;raise(early,3);const late=table().s;raise(late,5);
  assert.ok(mean(opponentRanges(early).find(r=>r.player===3))>mean(opponentRanges(late).find(r=>r.player===5)));
});
test('reraise and larger opening sizes shift weight toward stronger hands while preserving bluffs',()=>{
  const small=table().s;raise(small,3,20);const big=table().s;raise(big,3,200);
  assert.ok(mean(opponentRanges(big).find(r=>r.player===3))>mean(opponentRanges(small).find(r=>r.player===3)));
  const reraised=table().s;raise(reraised,4,30);raise(reraised,3,100);
  const range=opponentRanges(reraised).find(r=>r.player===3)!;assert.ok(mean(range)>mean(opponentRanges(small).find(r=>r.player===3)));assert.ok(range.combos.every(combo=>combo.weight>0));
});
test('deep stacks retain more small-pair implied-odds weight than short stacks after voluntary action',()=>{
  const short=table(20).s;raise(short,3);const deep=table(150).s;raise(deep,3);
  const a=opponentRanges(short).find(r=>r.player===3),b=opponentRanges(deep).find(r=>r.player===3);
  const pair=[c(6,'s'),c(6,'d')],kings=[c(13,'s'),c(13,'d')];
  assert.ok(weight(b,pair)/weight(b,kings)>weight(a,pair)/weight(a,kings));
});
test('postflop checks retain strong hands and earlier actions are evaluated against their own board',()=>{
  const {s}=table();s.street=1;s.communityCards=[c(2,'s'),c(7,'d'),c(11,'h')];s.actionLog.push({street:1,player:3,name:'C',action:'check',amount:0});
  const before=opponentRanges(s).find(r=>r.player===3)!;assert.ok(weight(before,[c(11,'s'),c(11,'d')])>0);
  s.street=3;s.communityCards.push(c(13,'c'),c(9,'s'));const after=opponentRanges(s).find(r=>r.player===3)!;
  assert.equal(weight(before,[c(11,'s'),c(11,'d')]),weight(after,[c(11,'s'),c(11,'d')]));
});
test('range inference ignores actual opponent hands, deck order and hidden bot styles',()=>{
  const {s}=table();raise(s,3);const first=opponentRanges(s);
  for(let i=1;i<s.players.length;i++){s.players[i].hand=[c(14,'d'),c(14,'c')];s.players[i].style=null;}s.deck.reverse();
  assert.deepEqual(opponentRanges(s),first);
});
test('range combinations remove all hero/board blockers',()=>{
  const {s}=table();s.street=1;s.communityCards=[c(2,'s'),c(7,'d'),c(11,'h')];const blocked=new Set([...s.players[0].hand,...s.communityCards].map(card=>card.suit+card.rank));
  for(const range of opponentRanges(s)){assert.equal(range.combos.length,1081);assert.ok(range.combos.every(combo=>combo.hand.every(card=>!blocked.has(card.suit+card.rank))));}
});
test('weighted heads-up river enumeration uses weights, not equally likely combinations',()=>{
  const hero=[c(14,'s'),c(14,'h')],board=[c(2,'c'),c(3,'d'),c(7,'h'),c(9,'s'),c(11,'d')];
  const result=estimateEquity(hero,board,{opponentRanges:[{combos:[{hand:[c(13,'s'),c(13,'h')],weight:1},{hand:[c(7,'s'),c(7,'d')],weight:3},{hand:[c(14,'s'),c(13,'d')],weight:1000}]}]});
  assert.equal(result.equity,0.25);assert.equal(result.win,0.25);assert.equal(result.lose,0.75);assert.equal(result.samples,2);assert.equal(result.exact,true);
});
test('multiway range sampling rejects the entire colliding joint sample (no sequential blocker bias)',()=>{
  const hero=[c(14,'s'),c(14,'h')],board=[c(2,'c'),c(3,'d'),c(7,'h'),c(9,'s'),c(11,'d')];
  const ranges=[{combos:[{hand:[c(13,'s'),c(13,'h')],weight:1},{hand:[c(7,'s'),c(7,'d')],weight:1}]},{combos:[{hand:[c(13,'s'),c(12,'h')],weight:1},{hand:[c(12,'s'),c(12,'d')],weight:1}]}];
  const result=estimateEquity(hero,board,{opponents:2,opponentRanges:ranges,simulations:20000,random:random(4)});
  assert.ok(Math.abs(result.equity-1/3)<0.015);assert.equal(result.samples,20000);
});
test('public action sizes reconstruct pot and raise context before each action',()=>{
  const {s}=table();raise(s,3,30);s.actionLog.push({street:0,player:4,name:'D',action:'call',amount:30});raise(s,5,100);
  const events=publicActions(s);assert.equal(events[2].potBefore,15);assert.equal(events[2].toCall,10);assert.equal(events[4].potBefore,75);assert.equal(events[4].aggressions,1);assert.equal(events[4].ratio,70/105);
});
test('coach suggestions and recap retain reasons for all legal alternatives from before the action',()=>{
  const {g,s}=table();g.options.coaching=true;raise(s,3);const advice=g.getAdvice()!;assert.equal(advice.details.model,'行为加权范围');assert.equal(advice.alternatives.length,3);assert.ok(advice.reasons.length>=3);assert.ok(advice.sensitivity.low<=advice.winProbability&&advice.sensitivity.high>=advice.winProbability);
  g.act('fold');s.players[3].chips=1;const decision=getHandRecap(s).decisions[0];assert.deepEqual(decision.reasons,advice.reasons);assert.deepEqual(decision.ranges,advice.ranges);assert.match(decision.chosenReason,/保留/);
});
test('same hero hand receives different weighted estimates after different public betting',()=>{
  const a=table().s,b=table().s;raise(a,3,20);raise(b,3,200);
  const weak=recommend(a.players[0].hand,a,{simulations:1500,random:random(103)}),strong=recommend(b.players[0].hand,b,{simulations:1500,random:random(103)});
  assert.ok(strong.winProbability<weak.winProbability);
});
test('importance sampling corrects sequential blockers rather than silently reverting to random ranges',()=>{
  const hero=[c(14,'s'),c(14,'h')],board=[c(2,'c'),c(3,'d'),c(7,'h'),c(9,'s'),c(11,'d')];
  const ranges=[{combos:[{hand:[c(13,'s'),c(13,'h')],weight:1},{hand:[c(7,'s'),c(7,'d')],weight:1}]},{combos:[{hand:[c(13,'s'),c(12,'h')],weight:1},{hand:[c(12,'s'),c(12,'d')],weight:1}]}];
  const result=estimateEquity(hero,board,{opponents:2,opponentRanges:ranges,sampling:'importance',simulations:12000,random:random(904)});
  assert.ok(Math.abs(result.equity-1/3)<0.02);assert.ok(result.effectiveSamples!>5000);
});
test('invalid or completely blocked ranges fail explicitly instead of producing NaN odds',()=>{
  const hero=[c(14,'s'),c(14,'h')],board=[c(2,'c'),c(3,'d'),c(7,'h'),c(9,'s'),c(11,'d')];
  for(const combo of [{hand:[c(13,'s'),c(13,'h')],weight:NaN},{hand:[c(13,'s'),c(13,'s')],weight:1},{hand:[c(14,'s'),c(13,'h')],weight:1}])assert.throws(()=>estimateEquity(hero,board,{opponentRanges:[{combos:[combo]}]}));
});
test('unacted funded blinds are not incorrectly capped as all-ins in coaching pot eligibility',async()=>{
  const {s}=table();const {callPotContext}=await import('../src/engine/game.js');
  s.players[3].chips-=25;s.players[3].currentBet=25;s.players[3].totalBetThisHand=25;s.pot+=25;s.currentBet=25;
  const context=callPotContext(s);assert.equal(context.cost,25);assert.ok(context.pots.every(p=>p.eligible.includes(1)&&p.eligible.includes(2)));
  s.players[1].chips=0;const capped=callPotContext(s);assert.ok(capped.pots.filter(p=>p.cap>5).every(p=>!p.eligible.includes(1)));
});
