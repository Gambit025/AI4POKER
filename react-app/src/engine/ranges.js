/** Public-information range model. Likelihoods are explicit teaching heuristics, not calibrated solver ranges. */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const sigmoid=n=>1/(1+Math.exp(-n));
const streets=['翻前','翻牌','转牌','河牌'];

// Reconstruct context as it was when each action happened, never using a later street's board.
export function publicActions(state) {
  let street=-1,pot=0,invested=Array(state.players.length).fill(0),aggressions=0;
  return state.actionLog.map(entry=>{
    if(entry.street!==street){street=entry.street;invested.fill(0);aggressions=0;}
    const match=Math.max(street===0?(state.bb??10):0,...invested),toCall=Math.max(0,match-invested[entry.player]);
    const aggressive=entry.action==='raise'||entry.action==='bet';
    const target=aggressive?(entry.totalBet??entry.amount):invested[entry.player]+entry.amount;
    const added=entry.action==='return'?-entry.amount:entry.action==='fold'||entry.action==='check'?0:aggressive?(entry.addedAmount??target-invested[entry.player]):entry.amount;
    const context={...entry,potBefore:pot,toCall,aggressions,ratio:aggressive?(target-match)/Math.max(state.bb??10,pot+toCall):toCall/Math.max(state.bb??10,pot+toCall)};
    invested[entry.player]+=added;pot+=added;if(aggressive)aggressions++;
    return context;
  });
}

function textureStrength(hand,board,helpers) {
  const ev=helpers.bestHand([...hand,...board]);
  const counts=new Map();for(const c of board)counts.set(c.rank,(counts.get(c.rank)??0)+1);
  const high=Math.max(...board.map(c=>c.rank)), ranks=hand.map(c=>c.rank),pair=ranks[0]===ranks[1];
  let made=[0.12,0.35,0.76,0.87,0.91,0.94,0.97,0.99,1][ev.rank];
  if(ev.rank===0)made=0.12+Math.max(...ranks)/100;
  if(ev.rank===1){const value=ev.tieBreaker[0];made=pair&&value>high?0.78:ranks.includes(value)&&counts.get(value)===1?(value===high?0.69:0.43):0.22+Math.max(...ranks)/140;}
  if(ev.rank===2&&[...counts.values()].some(n=>n>=2))made=ranks.some(r=>(counts.get(r)??0)>0)?0.69:0.4;
  if(ev.rank===3&&(counts.get(ev.tieBreaker[0])??0)>=3)made=0.36+Math.max(...ranks)/100;
  if(board.length===5){const common=helpers.bestHand(board);if(helpers.compareEval(common,ev)===0)made=0.22;}
  const draw=helpers.detectDraws(hand,board);
  return {made,draw:Math.min(1,draw.outs/15)};
}

export function buildOpponentRanges(state,heroIndex,heroHand,helpers) {
  const blocked=new Set([...heroHand,...state.communityCards].map(c=>c.suit+c.rank));
  const deck=['s','h','d','c'].flatMap(suit=>Array.from({length:13},(_,i)=>({suit,rank:i+2}))).filter(c=>!blocked.has(c.suit+c.rank));
  const actions=publicActions(state),bb=state.bb??10;
  const combinations=[];for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)combinations.push([deck[i],deck[j]]);
  // Board features are identical for all opponents, so calculate each combination/street once.
  const features=combinations.map(hand=>({hand,score:helpers.preflopHandStrength(hand),byStreet:new Map()}));
  return state.players.flatMap((player,index)=>{
    if(index===heroIndex||player.isFolded||player.isEliminated||player.inHand===false||player.hand.length!==2)return [];
    const position=helpers.getPosition(index,state),headsUp=state.players.filter(p=>p.inHand!==false&&!p.isEliminated).length===2;
    const depth=Math.min(state.startingChips?.[heroIndex]??state.players[heroIndex].chips+state.players[heroIndex].totalBetThisHand,state.startingChips?.[index]??player.chips+player.totalBetThisHand)/bb;
    const history=actions.filter(e=>e.player===index&&e.street<=state.street&&!['sb','bb','return','fold'].includes(e.action));
    const width=headsUp?0.60:({EP:0.16,MP:0.23,LP:0.40,SB:0.43,BB:0.52}[position]??0.25);
    const combos=features.map(feature=>{
      const {hand,score}=feature;let weight=1;
      for(const event of history){
        let likelihood=1;
        if(event.street===0){
          const aggression=event.action==='raise'||event.action==='bet';
          if(aggression||event.action==='call'){
            const threshold=aggression?(0.88-width*0.55+Math.min(0.17,event.aggressions*0.09)+Math.min(0.12,Math.max(0,event.ratio-0.5)*0.04)):
              event.aggressions?0.64-width*0.26+Math.min(0.18,event.ratio*0.22):0.32;
            const suited=hand[0].suit===hand[1].suit,speculative=(suited&&Math.abs(hand[0].rank-hand[1].rank)<=2)||(hand[0].rank===hand[1].rank&&hand[0].rank<10);
            const adjusted=score+(speculative?(depth>=100?0.035:depth<=25?-0.07:0):0);
            likelihood=0.002+0.996*sigmoid((adjusted-threshold)*13);
          }
        }else{
          if(!feature.byStreet.has(event.street))feature.byStreet.set(event.street,textureStrength(hand,state.communityCards.slice(0,event.street+2),helpers));
          const {made,draw}=feature.byStreet.get(event.street);
          const pressure=clamp(event.ratio,0,2),valueThreshold=0.49+pressure*0.14;
          if(event.action==='bet'||event.action==='raise'){
            const value=sigmoid((made-valueThreshold)*11),semiBluff=draw*0.32;
            // Retain nonzero air and check-raise/trap possibilities; never equate aggression with the nuts.
            likelihood=clamp(0.06+0.75*value+semiBluff,0.04,0.96);
            if(event.aggressions>0)likelihood*=0.4+0.6*sigmoid((made-0.7)*10)+draw*0.1;
          }else if(event.action==='call')likelihood=clamp(0.06+0.79*sigmoid((made-(0.30+pressure*0.20))*10)+draw*(depth>20?0.30:0.12),0.04,0.97);
          else if(event.action==='check')likelihood=0.75+0.20*(1-made); // A check is weak evidence, not proof of weakness.
        }
        weight*=likelihood;
      }
      return {hand,weight:Math.max(1e-12,weight)};
    });
    const descriptions=history.map(e=>`${streets[e.street]}${({call:'跟注',check:'过牌',raise:'加注至',bet:'下注'})[e.action]}${e.amount?` ${e.amount}`:''}${e.allIn?'（全下）':''}`);
    const classes=new Map();for(const combo of combos){const key=helpers.describeHand(combo.hand),group=classes.get(key)??{sum:0,n:0};group.sum+=combo.weight;group.n++;classes.set(key,group);}
    const examples=[...classes].sort((a,b)=>b[1].sum/b[1].n-a[1].sum/a[1].n).slice(0,4).map(([name])=>name);
    return [{player:index,name:player.name,position,depth:Math.round(depth),combos,examples,
      evidence:descriptions.length?descriptions.join(' → '):'仅有强制盲注或尚未行动，保留全部未知组合',
      explanation:history.some(e=>e.action==='raise'||e.action==='bet')?'位置与下注尺度调整强牌、听牌和诈唬权重；大额及多次加注通常收紧范围。':history.some(e=>e.action==='call')?'跟注尺度与筹码深度影响可继续的对子、高张和投机牌；过牌只提供弱证据。':'位置不会改变发到的牌；只有可观察的自愿行动才开始收窄范围。',
      informed:history.some(e=>e.action!=='check')}];
  });
}

export function makeRangeSampler(ranges,blocked,temperature=1) {
  return ranges.map(range=>{
    const combos=validRangeCombos(range,blocked,temperature);
    if(!combos.length)throw new Error('No valid combinations in opponent range');
    let total=0;const cdf=combos.map(c=>total+=c.weight);
    return random=>{const value=random()*total;let lo=0,hi=cdf.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(value<cdf[mid])hi=mid;else lo=mid+1;}return combos[lo].hand;};
  });
}

// Importance correction prevents sequential blocker filtering from changing the intended joint distribution.
export function makeImportanceSampler(ranges,blocked,temperature=1) {
  const prepared=ranges.map(range=>{
    const combos=validRangeCombos(range,blocked,temperature);
    return {combos,total:combos.reduce((sum,c)=>sum+c.weight,0)};
  });
  return random=>{
    const occupied=new Set(blocked),hands=[];let weight=1;
    for(const range of prepared){
      const available=range.combos.filter(c=>c.hand.every(card=>!occupied.has(card.suit+card.rank)));
      const total=available.reduce((sum,c)=>sum+c.weight,0);if(!total)return null;
      weight*=total/range.total;
      let roll=random()*total,selected=available.at(-1);
      for(const combo of available){roll-=combo.weight;if(roll<0){selected=combo;break;}}
      hands.push(selected.hand);for(const card of selected.hand)occupied.add(card.suit+card.rank);
    }
    return {hands,weight};
  };
}
export function validRangeCombos(range,blocked,temperature=1){
  if(!Number.isFinite(temperature)||temperature<=0)throw new Error('Invalid range temperature');
  const combos=[];
  for(const combo of range.combos){
    if(combo.hand.length!==2||new Set(combo.hand.map(c=>c.suit+c.rank)).size!==2||combo.hand.some(c=>!['s','h','d','c'].includes(c.suit)||!Number.isInteger(c.rank)||c.rank<2||c.rank>14)||!Number.isFinite(combo.weight)||combo.weight<0)throw new Error('Invalid range combination');
    if(combo.weight===0||combo.hand.some(card=>blocked.has(card.suit+card.rank)))continue;
    const weight=combo.weight**temperature;if(!Number.isFinite(weight)||weight<=0)throw new Error('Invalid tempered weight');
    combos.push({hand:combo.hand,weight});
  }
  if(!combos.length)throw new Error('No valid combinations in opponent range');
  return combos;
}
