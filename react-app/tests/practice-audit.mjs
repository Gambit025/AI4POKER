// Repeatable public-information coaching audit; not solver validation.
import {PokerGame,getPosition,getHandRecap,describeHand} from '../src/engine/game.js';
const rng=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const rows=[];
for(const depth of [10,20,100])for(let dealer=0;dealer<6;dealer++)for(let seed=1;seed<=3;seed++){
 const g=new PokerGame(5,10,depth*10,6,{random:rng(seed*719+dealer),coaching:true});g.state.dealerButtonIndex=dealer;g.startNewHand();let decisions=0;
 while(!g.state.handOver){
  if(++decisions>180)throw Error('loop');
  const l=g.getLegalActions();
  if(g.state.currentPlayerIndex===0){const a=g.getAdvice();rows.push({depth,position:getPosition(0,g.state),hand:describeHand(g.state.players[0].hand),street:g.state.street,cost:l.callAmount,stack:g.state.players[0].chips,equity:+a.winProbability.toFixed(3),action:a.action,bet:a.betAmount,ev:a.sensitivity});
   if(a.betAmount&&l.canFullRaise)g.act('raise',a.betAmount);else g.act(l.canCheck?'check':a.action==='优先弃牌'?'fold':'call');
  }else if(seed===3&&g.state.street===0&&l.canFullRaise)g.act('raise',Math.min(l.maxRaiseTo,Math.max(l.minRaiseTo,150)));else g.runAI();
 }
 const recap=getHandRecap(g.state);if(recap.decisions.length!==g.state.heroDecisions.length)throw Error('recap mismatch');
 if(g.state.players.reduce((sum,p)=>sum+p.chips,0)!==depth*10*6)throw Error('chip conservation');
 if(recap.decisions.some(d=>!d.takeaway))throw Error('missing decision explanation');
}
console.log(JSON.stringify({hands:54,decisions:rows.length,shortCalls:rows.filter(r=>r.cost===r.stack&&r.cost>0),largeCalls:rows.filter(r=>r.cost>=80).slice(0,12),positions:[...new Set(rows.map(r=>r.position))]},null,2));
