import { useState } from 'react';
import type { LegalActions } from '../engine/types';

interface Props { legal:LegalActions; bb:number; pot:number; onFold:()=>void; onCheck:()=>void; onCall:()=>void; onRaise:(target:number)=>void; onAllIn:()=>void }
export function BetControls({legal:l,bb,pot,onFold,onCheck,onCall,onRaise,onAllIn}:Props) {
  const [draft,setDraft] = useState(String(Math.min(l.maxRaiseTo,Math.max(l.minRaiseTo,bb*3))));
  const amount=Number(draft),valid=l.canFullRaise&&draft.trim()!==''&&Number.isSafeInteger(amount)&&amount>=l.minRaiseTo&&amount<=l.maxRaiseTo;
  const update=(value:number)=>setDraft(String(Math.min(l.maxRaiseTo,Math.max(l.minRaiseTo,value))));
  return <section className="action-controls w-full max-w-[640px] mx-auto flex flex-col shrink-0 z-50" aria-label="你的操作">
    {l.canFullRaise&&<><p className="bet-caption">{l.currentBet?'加注至 · 本轮总额':'下注金额'}<span>可用总额 {l.maxRaiseTo} · 最低 {l.minRaiseTo}</span></p>
      <div className="bet-controls flex items-center">
        <div className="flex gap-1">{[{label:'最小',value:l.minRaiseTo},{label:'半池',value:l.currentBet+Math.max(bb,Math.floor((pot+l.callAmount)/2))},{label:'一池',value:l.currentBet+Math.max(bb,pot+l.callAmount)}].map(button=><button key={button.label} onClick={()=>update(button.value)}>{button.label}</button>)}</div>
        <input type="range" aria-label="下注总额滑块" min={l.minRaiseTo} max={l.maxRaiseTo} step={1} value={valid?amount:l.minRaiseTo} onChange={e=>update(Number(e.target.value))} className="flex-1 min-w-0"/>
        <input type="number" inputMode="numeric" aria-label="下注总额" aria-invalid={!valid} aria-describedby="bet-feedback" min={l.minRaiseTo} max={l.maxRaiseTo} step={1} value={draft} onChange={e=>setDraft(e.target.value)}/>
      </div><p id="bet-feedback" className={valid?'sr-only':'bet-error'} role={valid?undefined:'status'}>请输入 {l.minRaiseTo}–{l.maxRaiseTo} 之间的整数总额。</p></>}
    {!l.raiseReopened&&<p className="bet-caption">不足额全下尚未重开你的加注权，只能跟注或弃牌。</p>}
    {l.shortAllIn&&<p className="bet-caption">筹码不足以完整加注，可以全下至 {l.maxRaiseTo}。该短加注不一定重开他人的加注权。</p>}
    <div className="action-buttons flex">
      <button data-action={l.toCall?'fold':'check'} onClick={l.toCall?onFold:onCheck}>{l.toCall?'弃牌':'过牌'}</button>
      {l.toCall>0&&<button data-action="call" onClick={onCall}>{l.callAmount<l.toCall?'全下跟注':'跟注'} <span>{l.callAmount}</span></button>}
      {l.canFullRaise&&<button data-action="raise" disabled={!valid} onClick={()=>{if(valid)onRaise(amount);}}>{l.currentBet?'加注至':'下注'} <span>{valid?amount:'—'}</span></button>}
      {l.canAllIn&&!l.allInIsCall&&<button data-action="allin" onClick={onAllIn}>全下 <span>至 {l.maxRaiseTo}</span></button>}
    </div>
    {l.callAmount<l.toCall&&<p className="bet-caption">原需补 {l.toCall}，你只投入剩余 {l.callAmount}，仅可争夺自己覆盖的底池。</p>}
  </section>;
}
