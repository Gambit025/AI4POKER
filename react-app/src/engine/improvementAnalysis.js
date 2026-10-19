const suits=['s','h','d','c'];
const rank=n=>({11:'J',12:'Q',13:'K',14:'A'})[n]??String(n);
const count=(cards,r)=>cards.filter(c=>c.rank===r).length;
const pct=n=>(100*n).toFixed(1)+'%';
const choose=(n,k)=>{let v=1;for(let i=0;i<k;i++)v=v*(n-i)/(i+1);return v;};
export function describeMade(hand,board,evaluate){
  if(board.length<3)return '';
  const value=evaluate([...hand,...board]),r=value.tieBreaker[0],ownPair=hand[0].rank===hand[1].rank;
  if(value.rank===0)return `当前只有高牌，还没有对子；手牌 ${hand.map(c=>rank(c.rank)).join('、')}。`;
  if(value.rank===1){
    if(ownPair&&hand[0].rank===r)return `${rank(r)} 口袋对子，${r>Math.max(...board.map(c=>c.rank))?'高于所有公共牌（超对）':'牌面有更高点数，不能当作顶对以上的强度'}。`;
    if(count(board,r)>=2)return `当前的一对 ${rank(r)} 来自公共牌，你还没配中手牌。`;
    const order=[...new Set(board.map(c=>c.rank))].sort((a,b)=>b-a).indexOf(r);
    return `${rank(r)} ${order===0?'顶对':order===1&&new Set(board.map(c=>c.rank)).size>2?'中对':'底对'}；手牌另一张是 ${rank(hand.find(c=>c.rank!==r).rank)}，还要比较踢脚和对手的更强牌。`;
  }
  if(value.rank===2)return `当前两对 ${value.tieBreaker.slice(0,2).map(rank).join('、')}。${board.some(c=>count(board,c.rank)>=2)?'其中包含公共对子，不能按两张手牌都配中的两对来理解。':''}`;
  if(value.rank===3)return `${ownPair&&hand[0].rank===r?'暗三条':'三条'} ${rank(r)}；${ownPair?'两张手牌与一张公共牌配成。':'若公共牌已有两张同点数，对手也可能拿到三条，需比较踢脚。'}`;
  if(value.rank===4)return `${rank(r)} 高顺子；需留意更大顺子及同花。`;
  if(value.rank===5)return `${rank(r)} 高同花；低张同花仍会输给更大的同花，配对牌面还要防葫芦。`;
  if(value.rank===6)return `葫芦：三张 ${rank(r)} 带一对 ${rank(value.tieBreaker[1])}，需比较三条点数。`;
  return value.rank===7?`四条 ${rank(r)}。`:`${rank(r)} 高同花顺。`;
}
export function improvementAnalysis(hand,board,evaluate){
  if(hand.length!==2||board.length<3||board.length>=5)return null;
  const known=new Set([...hand,...board].map(c=>c.rank+c.suit)),deck=suits.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit}))).filter(c=>!known.has(c.rank+c.suit));
  const base=evaluate([...hand,...board]),ownPair=hand[0].rank===hand[1].rank;
  let label,test;
  if(base.rank<=1){
    const targets=hand.filter((c,i)=>hand.findIndex(h=>h.rank===c.rank)===i).map(c=>({r:c.rank,need:Math.max(2,count([...hand,...board],c.rank)+1)}));
    label=ownPair?`再出现 ${rank(hand[0].rank)}，配成三条或更强组合`:`再配中手牌点数 ${targets.map(t=>rank(t.r)).join('、')}，形成自己的对子、两对或三条`;
    test=b=>targets.some(t=>count([...hand,...b],t.r)>=t.need);
  }else if(base.rank===2||base.rank===3){label='升级为葫芦、四条或同花顺';test=b=>evaluate([...hand,...b]).rank>=6;}
  else if(base.rank===4||base.rank===5){label='升级为更高牌型（同花、葫芦、四条或同花顺中高于当前牌型者）';test=b=>evaluate([...hand,...b]).rank>base.rank;}
  else if(base.rank===6){label='升级为四条';test=b=>evaluate([...hand,...b]).rank===7;}
  else return null;
  // Exclude improvements supplied entirely by the board for category upgrades.
  const qualifies=extra=>{const b=[...board,...extra];if(!test(b))return false;if(base.rank<=1)return true;if(b.length<5)return true;const a=evaluate([...hand,...b]),v=evaluate(b);return a.rank>v.rank||(a.rank===v.rank&&a.tieBreaker.some((n,i)=>n!==v.tieBreaker[i]&&a.tieBreaker.slice(0,i).every((x,j)=>x===v.tieBreaker[j])&&n>v.tieBreaker[i]));};
  const outs=deck.filter(c=>qualifies([c]));let total=0,hits=0;
  if(board.length===3){for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++){total++;if(qualifies([deck[i],deck[j]]))hits++;}}
  else{total=deck.length;hits=outs.length;}
  return {label,outs:outs.length,ranks:[...new Set(outs.map(c=>c.rank))].sort((a,b)=>a-b),nextProbability:outs.length/deck.length,riverProbability:hits/total,hits,total};
}
export function explainImprovement(hand,board,evaluate){
  if(!board.length){const pair=hand[0].rank===hand[1].rank,available=pair?2:6,p=1-choose(50-available,3)/choose(50,3);return `${pair?`口袋 ${rank(hand[0].rank)}${rank(hand[0].rank)}：翻牌至少补中一张 ${rank(hand[0].rank)}（至少三条，可能更强）`:`翻牌至少配到手牌 ${hand.map(c=>rank(c.rank)).join('、')} 中一个点数`}的概率约 ${pct(p)}。这是配中点数的概率，不是胜率，也不是靠未来成牌就能跟注的理由。`;}
  if(board.length===5)return null;
  const d=improvementAnalysis(hand,board,evaluate);if(!d)return null;
  return `${d.label}：下一张有 ${d.outs} 张潜在改善牌${d.ranks.length?`（${d.ranks.map(rank).join('、')}）`:''}，概率 ${pct(d.nextProbability)}${board.length===3?`；若看到河牌约 ${pct(d.riverProbability)}`:''}。这些是点数/牌型改善事件，与顺子、同花可能重叠，不能相加；改善后仍可能落后。${board.length===3?'河牌数字假设能看完两张，不代表一轮跟注可以买到两张牌。':''}`;
}
