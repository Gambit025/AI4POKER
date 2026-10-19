import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bestHand,PokerGame,recommend,getHandRecap} from '../src/engine/game.js';
import {improvementAnalysis,explainImprovement,describeMade} from '../src/engine/improvementAnalysis.js';
import {callPrice,explainCallPrice} from '../src/engine/callPrice.js';
import {drawAnalysis} from '../src/engine/drawAnalysis.js';
const c=(rank:number,suit:string)=>({rank,suit});
const calc=(h:any[],b:any[])=>improvementAnalysis(h,b,bestHand);
const cases=[
 {name:'高牌配中手牌，不把公共对子算作自己的对子',h:[c(14,'s'),c(12,'d')],b:[c(2,'c'),c(7,'h'),c(9,'d')],outs:6,hits:261},
 {name:'口袋对子补三条',h:[c(7,'s'),c(7,'d')],b:[c(2,'c'),c(9,'h'),c(13,'d')],outs:2,hits:91},
 {name:'顶对改善为自己的两对或三条',h:[c(14,'s'),c(12,'d')],b:[c(14,'c'),c(7,'h'),c(2,'d')],outs:5,hits:220},
 {name:'两对升级葫芦或四条，包括公共点数跑出三条',h:[c(14,'s'),c(13,'d')],b:[c(14,'c'),c(13,'h'),c(2,'d')],outs:4,hits:181},
 {name:'暗三条补葫芦四条，包含后门公共对子',h:[c(7,'s'),c(7,'d')],b:[c(7,'c'),c(13,'h'),c(2,'d')],outs:7,hits:361},
];
for(const row of cases)test(row.name,()=>{const d=calc(row.h,row.b);assert.equal(d.outs,row.outs);assert.equal(d.nextProbability,row.outs/47);assert.equal(d.hits,row.hits);assert.equal(d.riverProbability,row.hits/1081);assert.equal(calc(row.h,[...row.b,c(3,'c')]).total,46);});
test('paired-board improvement does not pretend shared pairs are private hits',()=>{
 const d=calc([c(8,'c'),c(5,'h')],[c(7,'s'),c(10,'s'),c(7,'d')]);assert.equal(d.outs,6);assert.match(describeMade([c(8,'c'),c(5,'h')],[c(7,'s'),c(10,'s'),c(7,'d')],bestHand),/来自公共牌/);
 assert.match(describeMade([c(14,'s'),c(12,'h')],[c(14,'d'),c(9,'h'),c(2,'s')],bestHand),/顶对/);
 assert.match(describeMade([c(14,'s'),c(14,'h')],[c(13,'d'),c(9,'h'),c(2,'s')],bestHand),/超对/);
});
test('preflop hit rates name the actual event and river has no future improvement',()=>{
 assert.match(explainImprovement([c(7,'s'),c(7,'d')],[],bestHand),/11\.8%/);assert.match(explainImprovement([c(14,'s'),c(13,'d')],[],bestHand),/32\.4%/);
 assert.equal(calc([c(7,'s'),c(7,'d')],[c(2,'c'),c(9,'h'),c(13,'d'),c(4,'s'),c(5,'h')]),null);
});
test('flush, backdoor flush and gutshot include all valid runouts, not just the usual outs shortcut',()=>{
 const h=[c(14,'s'),c(11,'s')],f=drawAnalysis(h,[c(2,'s'),c(7,'s'),c(13,'d')]);assert.equal(f.flush.outs,9);assert.equal(f.flush.riverProbability,378/1081);
 const back=drawAnalysis(h,[c(2,'s'),c(7,'d'),c(13,'h')]);assert.equal(back.flush.outs,0);assert.equal(back.flush.riverProbability,45/1081);
 const gut=drawAnalysis([c(8,'s'),c(9,'d')],[c(6,'c'),c(10,'h'),c(13,'s')]);assert.equal(gut.straight.outs,4);assert.equal(gut.straight.riverProbability,194/1081);
});
test('frozen-pot call price equals break-even math, is stack capped, and does not treat draws as equity',()=>{
 const p=callPrice({cost:50,contestable:200,equityLow:.2,equityBase:.25,equityHigh:.3,stack:500});assert.equal(p.required,.25);assert.equal(p.low,37);assert.equal(p.base,50);assert.equal(p.high,64);assert.equal(p.verdict,'borderline');
 assert.match(explainCallPrice(p),/37–64/);assert.match(explainCallPrice(p),/不是安全额度/);
 assert.equal(callPrice({cost:100,contestable:300,equityLow:.1,equityBase:.15,equityHigh:.2,stack:500}).verdict,'expensive');
 assert.equal(callPrice({cost:10,contestable:100,equityLow:.5,equityBase:.6,equityHigh:1,stack:20}).high,20);
 const complex=callPrice({cost:20,contestable:90,equityLow:.2,equityBase:.3,equityHigh:.4,stack:20,complex:true});assert.equal(complex.base,null);assert.match(explainCallPrice(complex),/分池资格/);
});
test('specific improvement and call price survive in recap with no hidden-card dependency',()=>{
 const g=new PokerGame(5,10,1000,3,{coaching:true}),s=g.getState();g.startNewHand();Object.assign(s,{street:1,currentPlayerIndex:0,currentBet:50,pot:200,communityCards:[c(14,'c'),c(7,'h'),c(2,'d')]});s.players[0].hand=[c(14,'s'),c(12,'d')];for(const p of s.players){p.currentBet=0;p.chips=950;p.totalBetThisHand=50;}s.players[1].currentBet=50;s.players[1].totalBetThisHand=100;s.players[1].chips=900;
 const seeded=()=>{let seed=18;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};};
 const a=recommend(s.players[0].hand,s,{random:seeded()});assert.match(a.analysisParts.find(p=>p.title==='对子与牌型改善').body,/10\.6%/);assert.equal(a.pricing.cost,50);
 s.players[1].hand=[c(3,'h'),c(4,'d')];s.deck.reverse();const b=recommend(s.players[0].hand,s,{random:seeded()});assert.deepEqual(b.analysisParts,a.analysisParts);
 const actual=g.getAdvice();g.act('fold');assert.deepEqual(getHandRecap(s).decisions[0].pricing,actual.pricing);
});

test('short-stack A4o facing all-in is not called borderline when every modeled scenario is materially negative',()=>{
 let n=3*719;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;};const g=new PokerGame(5,10,100,6,{coaching:true,random});g.startNewHand();let turns=0;
 while(!g.state.handOver&&g.state.currentPlayerIndex!==0){assert.ok(++turns<20);const l=g.getLegalActions();if(g.state.street===0&&l.canFullRaise)g.act('raise',Math.min(l.maxRaiseTo,Math.max(l.minRaiseTo,150)));else g.runAI();}
 const a=g.getAdvice();assert.equal(a.details.callCost,100);assert.ok(a.sensitivity.evHigh < -5);assert.equal(a.action,'优先弃牌');
});

test('river pricing never promises a next card or remaining runout',()=>{
 const free=callPrice({cost:0,contestable:50,equityLow:.5,equityBase:.5,equityHigh:.5,stack:50});assert.match(explainCallPrice(free,{street:3}),/过牌进入摊牌/);assert.doesNotMatch(explainCallPrice(free,{street:3}),/免费看下一张/);
 const paid=callPrice({cost:10,contestable:50,equityLow:.2,equityBase:.3,equityHigh:.4,stack:50});assert.match(explainCallPrice(paid,{street:3,future:false}),/河牌已发完/);assert.doesNotMatch(explainCallPrice(paid,{street:3,future:false}),/可看完剩余牌/);
});
