// A frozen-pot benchmark. Not a bet-sizing recommendation or a solved call policy.
export function callPrice({cost,contestable,equityLow,equityBase,equityHigh,stack,complex=false}){
  if(!cost)return {cost:0,required:0,low:0,base:0,high:0,complex,verdict:'free'};
  const before=Math.max(0,contestable-cost),cap=e=>Math.min(stack,e>=1?stack:Math.floor(before*Math.max(0,e)/Math.max(1e-9,1-e)+1e-9));
  return {cost,required:contestable>0?cost/contestable:1,low:complex?null:cap(equityLow),base:complex?null:cap(equityBase),high:complex?null:cap(equityHigh),complex,verdict:complex?'pool-specific':cost>cap(equityHigh)+Math.max(2,cost*.05)?'expensive':cost+Math.max(2,cost*.05)<cap(equityLow)?'supported':'borderline'};
}
export function explainCallPrice(p,{future=true,street=1,evLow=0,evHigh=0}={}){
  if(!p.cost)return street===3?'当前跟注成本为 0，可以过牌进入摊牌；没有后续牌可追。':`当前跟注成本为 0，直接过牌即可免费${street===0?'看翻牌':'看下一张'}；面对新下注时再重新计算价格。`;
  if(p.complex)return `实际只能补 ${p.cost}；此处有全下或分池资格限制，不给一个会误导的单一跟注上限。按各池资格加权，当前跟注模型净期望约 ${Math.round(evLow)} 至 ${Math.round(evHigh)} 筹码。`;
  return `当前只能跟注 ${p.cost}，需至少 ${(p.required*100).toFixed(1)}% 的底池份额。固定当前对手投入、底池资格且没有后续下注时，范围情景下的盈亏平衡跟注价格约 ${p.low}–${p.high} 筹码（基准 ${p.base}，已限于后手）。${p.verdict==='expensive'?'当前价格高于这些情景的盈亏平衡价，静态模型净值偏负。':p.verdict==='supported'?'当前价格低于或等于这些情景的上限，静态赔率支持考虑跟注。':'当前价格落在情景边界附近，范围一变结论就会改变。'}${future?'后面仍可能要付钱，这个价格不是安全额度，不能直接据此跟注到河牌。':street===3?'河牌已发完，这里只比较当前摊牌的底池份额与成本；仍依赖对手范围假设。':'本次投入后可看完剩余牌，但仍依赖对手范围假设。'}这不是加注尺寸，也不能套用于对手改变下注金额后的新局面。成牌率不能直接代替底池份额。`;
}
