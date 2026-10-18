import { useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import type { GameState } from '../engine/types';

export function FirstHandGuide({ state, started, thinking, toCall, onClose }: {
  state: GameState | null; started: boolean; thinking: boolean; toCall: number; onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [readCards, setReadCards] = useState(false);
  const finished = !!state?.handOver;
  const step = finished ? 3 : !started ? 0 : !readCards ? 1 : 2;
  const street = state?.street ?? 0;
  const titles = ['先认识这一局', '找到你的两张手牌', '做一次有理由的选择', '回看你的决定'];
  return (
    <section className="first-hand-guide" aria-label="新手第一局教学">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><BookOpen size={16} /> 新手第一局 · {step + 1}/4</span>
        <div className="flex"><button className="guide-collapse" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "展开" : "收起"}讲解</button><button className="guide-skip" onClick={onClose}>{finished ? '结束引导' : '跳过引导'}</button></div>
      </div>
      {!collapsed && <><ol className="guide-progress" aria-label="教学进度">
        {titles.map((title, i) => <li key={title} aria-current={i === step ? 'step' : undefined} className={i <= step ? 'reached' : ''}><span className="sr-only">{title}{i < step ? '，已完成' : ''}</span></li>)}
      </ol>
      <h2 className="text-base font-semibold text-white">{titles[step]}</h2>
      {step === 0 && <p>你有 2 张手牌，桌面最多会发出 5 张公共牌。从这 7 张牌中选出最强的 5 张，与对手比大小。现在点击「开始发牌」，边玩边学。</p>}
      {step === 1 && <><p>牌桌下方「你」上面的两张牌就是手牌，只有你能看到。中央空位留给所有人共用的公共牌。底池中的筹码来自盲注，是开局必须投入的筹码。</p><button className="guide-next" onClick={() => setReadCards(true)}>找到手牌了，了解怎么操作 <Chevron /></button></>}
      {step === 2 && <>
        {thinking ? <p>现在轮到对手。观察谁跟注、谁加注；等轮到你时，操作按钮会出现。你不需要抢着点击。</p> : <p>{toCall > 0 ? `你需要再投入 ${toCall} 筹码才能完整跟上；若不足则只投入剩余筹码全下。跟注：补齐差额；加注：提高本轮下注总额；弃牌：退出这一手，已投入的筹码留在底池。` : '目前无需补筹码。过牌：不投入筹码，把行动交给下一位；下注：主动投入筹码。能过牌时，不必为了继续游戏而下注。'}</p>}
        <p className="guide-context">{street === 0 ? '翻前：还没有公共牌。先看手牌，再决定是否参与。' : street === 1 ? '翻牌：一次发出 3 张公共牌。看看它们能否与你的手牌组成一对或更强的牌。' : street === 2 ? '转牌：第 4 张公共牌出现。还有一张牌未发出，重新评估你的选择。' : '河牌：5 张公共牌已发完。最后一轮下注后，仍在局中的玩家比牌。'} 教练建议供参考，随机范围份额不是实际获胜保证。</p>
      </>}
      {step === 3 && <><p>第一手已结束。{state?.players[0].isFolded ? '弃牌也是完整的决策，不需要打到摊牌才算完成练习。' : '输赢只是一手的结果，更值得回看的是当时为什么这样选择。'} 在下方「本局复盘」查看你的操作与建议。</p><button className="guide-next" onClick={onClose}><Check size={16} /> 完成第一局教学</button></>}
      </>}
    </section>
  );
}
function Chevron() { return <span aria-hidden="true">→</span>; }
