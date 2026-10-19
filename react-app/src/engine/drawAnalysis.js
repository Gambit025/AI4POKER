// Public-card completion odds, independent of hidden hands and weighted showdown equity.
const suits=['s','h','d','c'];
const key=c=>c.rank+c.suit;
function straightHigh(cards){
  const ranks=new Set(cards.map(c=>c.rank));if(ranks.has(14))ranks.add(1);
  for(let high=14;high>=5;high--)if([0,1,2,3,4].every(d=>ranks.has(high-d)))return high;
  return 0;
}
function flushRanks(cards){
  return suits.map(suit=>cards.filter(c=>c.suit===suit).map(c=>c.rank).sort((a,b)=>b-a).slice(0,5)).filter(r=>r.length===5);
}
function privateFlush(hand,board){
  const all=flushRanks([...hand,...board]),shared=flushRanks(board);
  return all.some(r=>!shared.length||r.some((v,i)=>v!==shared[0][i]&&r.slice(0,i).every((p,j)=>p===shared[0][j])&&v>shared[0][i]));
}
export function drawAnalysis(hand,board){
  const empty={cardsToCome:Math.max(0,5-board.length),straight:null,flush:null,combined:null};
  if(hand.length!==2||board.length<3||board.length>=5)return empty;
  const known=new Set([...hand,...board].map(key));
  const deck=suits.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit}))).filter(c=>!known.has(key(c)));
  const madeStraight=straightHigh([...hand,...board])>0,madeFlush=flushRanks([...hand,...board]).length>0;
  const qualifies=extra=>{
    const b=[...board,...extra],all=[...hand,...b];
    return {straight:!madeStraight&&straightHigh(all)>straightHigh(b),flush:!madeFlush&&privateFlush(hand,b)};
  };
  const next=deck.map(c=>({card:c,...qualifies([c])}));
  const counts={straight:0,flush:0,combined:0},paths=new Set();let total=0;
  const record=extra=>{const q=qualifies(extra);total++;if(q.straight){counts.straight++;if(board.length===3)paths.add(extra.map(c=>c.rank).sort((a,b)=>a-b).join('+'));}if(q.flush)counts.flush++;if(q.straight||q.flush)counts.combined++;};
  if(board.length===3){for(let i=0;i<deck.length;i++)for(let j=i+1;j<deck.length;j++)record([deck[i],deck[j]]);}else for(const c of deck)record([c]);
  const result={cardsToCome:5-board.length};
  for(const kind of ['straight','flush','combined']){
    const outs=next.filter(q=>kind==='combined'?q.straight||q.flush:q[kind]).map(q=>q.card);
    result[kind]=counts[kind]?{outs:outs.length,nextProbability:outs.length/deck.length,riverProbability:counts[kind]/total,runouts:counts[kind],totalRunouts:total,backdoor:outs.length===0,ranks:[...new Set(outs.map(c=>c.rank))].sort((a,b)=>a-b),paths:kind==='straight'&&outs.length===0?[...paths]:[]}:null;
  }
  return result;
}
export function explainDraws(hand,board,{cost=0,allIn=false}={}){
  const d=drawAnalysis(hand,board),pct=n=>(n*100).toFixed(1)+'%',rank=n=>({11:'J',12:'Q',13:'K',14:'A'})[n]??String(n);
  if(board.length<3)return null;
  if(board.length===5)return '河牌已发完，没有后续牌可追；按当前成牌与对手范围决定。';
  const parts=[];
  for(const [kind,label] of [['straight','顺子'],['flush','同花']]){
    const v=d[kind];if(!v)continue;
    if(v.backdoor){
      const paths=kind==='straight'?`，需要转牌、河牌补出 ${v.paths.map(p=>p.split('+').map(n=>rank(Number(n))).join(' 和 ')).join(' / ')}（顺序不限）`:'';
      parts.push(`后门${label}${paths}：下一张不能直接成牌；若看到河牌，能组成${label}的概率约 ${pct(v.riverProbability)}。`);
    }else parts.push(`${label}听牌：${v.outs} 张潜在成牌张${kind==='straight'?`（${v.ranks.map(rank).join('、')}）`:''}；下一张成牌约 ${pct(v.nextProbability)}${board.length===3?`，看到河牌约 ${pct(v.riverProbability)}`:''}。`);
  }
  if(!parts.length)parts.push('目前没有需要补牌才完成的自有顺子或同花听牌；其他改善需按当前牌型判断。');
  if(d.straight&&d.flush)parts.push(`顺子/同花有重叠，不能相加；至少形成其中一种的河牌概率约 ${pct(d.combined.riverProbability)}。`);
  if(d.flush){
    const suit=suits.find(s=>board.filter(c=>c.suit===s).length>=3&&hand.filter(c=>c.suit===s).length===1);
    if(suit){const h=hand.find(c=>c.suit===suit),name=({s:'黑桃',h:'红桃',d:'方块',c:'梅花'})[suit];parts.push(`你仅持一张${name} ${rank(h.rank)} 来听花。${h.rank===14?'补成后是 A 高同花，但仍需防同花顺及配对牌面的葫芦、四条。':'这是单张手牌听花；对手若持更高的同花色牌，成花也可能输，不能把全部成牌张都算作胜出张。'}`);}
  }
  if(d.combined){
    parts.push('这是仅按手牌与公共牌、未知牌等可能计算的成牌率，不是获胜率；未按对手范围调整剩余牌分布。');
    if(new Set(board.map(c=>c.rank)).size<board.length)parts.push('牌面已配对，成顺或成同花仍可能输给葫芦、四条；成牌张不能全算作胜出张。');
    else parts.push('成牌后仍可能被更大顺子、同花或更强牌击败，需结合对手范围。');
    if(board.length===3&&!allIn)parts.push('河牌概率以能看到两张牌为前提；本轮跟注不保证免费看到河牌。');
    if(!cost)parts.push('现在可以免费过牌看下一张，无需为了追牌主动扩大底池。');
    else if(d.combined.backdoor)parts.push(`当前需付 ${cost}；仅凭这项后门机会不支持跟注，是否继续还需整体底池份额与赔率依据。`);
    else parts.push(`当前需付 ${cost}；结合整体底池份额与跟注门槛判断，不能只因为有听牌就跟注。`);
  }
  return parts.join(' ');
}
