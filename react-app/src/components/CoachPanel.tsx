import type { Advice, HandRecap, OpponentRangeSummary } from '../engine/types';
import {playerName} from './actionLabels';
function RangeList({ranges}:{ranges:OpponentRangeSummary[]}) {
  return <div className="range-list">{ranges.map(range=><details key={range.player}><summary>{playerName(range.name)} · {({EP:'前位',MP:'中位',LP:'后位',SB:'小盲',BB:'大盲'} as Record<string,string>)[range.position]??range.position} · {range.depth} BB</summary><p>{range.evidence}</p><p>{range.explanation}</p>{range.informed&&<p>组合示例：{range.examples.join(' / ')}，不代表仅有这些牌。</p>}</details>)}</div>;
}
export function CoachPanel({advice:a}:{advice:Advice|null}) {
  if(!a)return <p className="info-empty">轮到你时，查看一个建议与关键原因。</p>;
  const informed=a.ranges.some(r=>r.informed);
  return <section className="coach-content concise-coach" aria-label="AI 教练分析">
    <div className="coach-lead"><span>教练参考</span><strong>{a.action.replace('评估','考虑')}{a.betAmount?`至 ${a.betAmount}`:''}</strong></div>
    <p className="coach-summary">{a.summary}</p>
    <div className="coach-metrics"><div><span>跟注门槛</span><strong>{(a.requiredEquity*100).toFixed(1)}%</strong></div><div><span>估计份额</span><strong>{Math.round(a.winProbability*100)}%</strong></div><div><span>后手深度</span><strong>{Math.round(a.details.remainingBB)}<small> BB</small></strong></div></div>
    {a.pricing?.cost>0&&<div className="coach-call-price"><div><span>本次跟注</span><strong>{a.pricing.cost}<small> 筹码</small></strong></div><div><span>{a.pricing.complex?'全下 / 分池':'静态盈亏平衡价'}</span><strong>{a.pricing.complex?'按各池分析':`${a.pricing.low}–${a.pricing.high}`}</strong></div><p>{a.pricing.complex?'见下方各池期望与资格分析':a.pricing.verdict==='expensive'?'当前价格偏贵':a.pricing.verdict==='supported'?'静态赔率支持考虑跟注':'接近范围情景边界'}{!a.pricing.complex&&' · 固定当前局面，不含后续下注'}</p></div>}
    {a.risk&&<p className="coach-risk">{a.risk}</p>}
    <section className="coach-reasoning" aria-label="判断依据"><h3>为什么这样选</h3><div className="analysis-parts">{(a.analysisParts??[]).map(part=><div key={part.title}><h4>{part.title}</h4><p>{part.body}</p></div>)}</div></section><details className="coach-explanation"><summary>对手范围与其他选择</summary>{informed&&<p>范围与行动情景：{Math.round(a.sensitivity.low*100)}–{Math.round(a.sensitivity.high*100)}%（情景变化，不是置信区间）。</p>}<RangeList ranges={a.ranges}/><div className="choice-reasons">{a.alternatives.map(choice=><details key={choice.action}><summary>{choice.action}</summary><p>{choice.reason}</p></details>)}</div><p className="model-note">{a.cautions} · {a.details.exact?'枚举':'抽样'} {a.details.samples} 组。</p></details>
    <p className="model-note model-caption">基于公开行为估算，非确定答案。</p>
  </section>;
}
export function RecapPanel({recap}:{recap:HandRecap}) {
  return <section id="hand-recap" className="coach-content concise-recap" aria-label="本手决策复盘"><div className="recap-heading"><span>本手净变化</span><strong>{recap.chipChange}</strong></div><p className="model-note">看当时的信息，不用输赢倒推对错。</p>
    {recap.decisions.map((d,i)=><article className="recap-step" key={i}><header><span>{d.streetName}</span><strong>{d.actual}</strong></header><p>{d.takeaway??d.chosenReason}</p>{d.risk&&<p className="coach-risk">{d.risk}</p>}<p className="recap-context">{d.analysis}</p><details className="coach-explanation"><summary>其他选择与完整依据</summary><p>{d.chosenReason}</p><div className="analysis-parts">{d.analysisParts?.map((part:{title:string;body:string})=><div key={part.title}><h4>{part.title}</h4><p>{part.body}</p></div>)}</div><ul className="coach-reasons">{d.reasons.map((reason:string,j:number)=><li key={j}>{reason}</li>)}</ul>{d.alternatives.map((choice:{action:string;reason:string})=><p key={choice.action}><strong>{choice.action}：</strong>{choice.reason}</p>)}<RangeList ranges={d.ranges}/><p className="model-note">{d.suggestion}</p></details></article>)}
    <details className="coach-explanation"><summary>底池结算</summary><p className="settlement-text">{recap.showdownSummary}</p></details>
  </section>;
}
