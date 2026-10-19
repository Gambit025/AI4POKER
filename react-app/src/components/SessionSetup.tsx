import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, Layers3, Spade, Users } from 'lucide-react';
import { readSoundPreferences } from '../audio/pokerAudio';
import type { GameConfig } from '../engine/types';

export function SessionSetup({ onStart }: { onStart: (config: GameConfig, tutorial?: boolean) => void }) {
  const [players, setPlayers] = useState(6);
  const [speed, setSpeed] = useState('正常');
  const [blinds, setBlinds] = useState('5/10');
  const [startingBB,setStartingBB]=useState(100);
  const [assist, setAssist] = useState(true);
  const [sound] = useState(() => readSoundPreferences().enabled);
  const start = () => {
    const [sb, bb] = blinds.split('/').map(Number);
    onStart({ playerCount: players, sb, bb, speed, aiAssist: assist, sound, startingBB });
  };
  return <main className="session-page cover-page">
    <header className="session-header">
      <a className="brand" href="./" aria-label="AI4POKER 首页"><span className="brand-mark"><Spade size={20} fill="currentColor" /></span><span>AI 4 <span className="brand-light">POKER</span></span></a>
      <span className="header-note"><span className="status-dot" /> 德州扑克学习与练习</span>
    </header>
    <div className="session-grid">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <div className="cover-kicker"><span>THE ART OF THE NEXT MOVE</span><span>01 / PRACTICE</span></div>
        <h1 id="welcome-title" aria-label="AI 4 POKER"><span>AI <em>4</em></span><span>POKER<span className="cover-title-dot">.</span></span></h1>
        <p className="welcome-description">读懂局面。相信判断。</p>
        <div className="cover-scene" aria-hidden="true">
          <div className="cover-scene-copy"><span className="cover-small-label">YOUR NEXT MOVE</span><p>从第一手牌，<br/>到自己的打法。</p><span className="cover-coordinates">POSITION / RANGE / DECISION</span></div>
          <div className="cover-orbit"/>
          <div className="cover-card cover-card-back"><span>K <Spade size={16} fill="currentColor"/></span><div className="cover-card-monogram">4</div></div>
          <div className="cover-card cover-card-front"><span>A <Spade size={16} fill="currentColor"/></span><Spade className="cover-card-suit" fill="currentColor"/><span className="cover-card-corner">A</span></div>
          <span className="cover-chip">♠</span>
        </div>
        <button className="primary-button tutorial-button" onClick={() => onStart({ playerCount: 4, sb: 5, bb: 10, speed: '慢', aiAssist: true, sound }, true)}><BookOpen size={18} /><span>开始新手第一局</span><ArrowUpRight size={19} /></button>
        <p className="welcome-footnote">4 人慢速桌 · 全程操作讲解 · 可随时跳过</p>
      </section>
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-heading"><div><h2 id="setup-title">按你的节奏练习</h2><p>已经了解规则？自定义牌桌，直接开始。</p></div><span className="setup-symbol"><Layers3 size={22} /></span></div>
        <fieldset className="setup-field"><legend><Users size={16} />牌桌人数<span>含你在内</span></legend><div className="segmented player-options">{[2,3,4,5,6,7,8].map(n => <button key={n} aria-pressed={players === n} onClick={() => setPlayers(n)}>{n}<span className="sr-only"> 人</span></button>)}</div></fieldset>
        <fieldset className="setup-field"><legend><Clock3 size={16} />对局速度</legend><div className="segmented">{['慢','正常','快'].map(s => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}{speed === s && <Check size={13} aria-hidden="true" />}</button>)}</div><p className="field-note">{speed === '慢' ? '每次行动间隔 3.2 秒，留出观察时间。' : speed === '快' ? '每次行动间隔 1 秒，适合熟练后的连续练习。' : '每次行动间隔 2 秒，看清动作后再继续。'}</p></fieldset>
        <fieldset className="setup-field"><legend><Layers3 size={16} />盲注大小<span>小盲 / 大盲</span></legend><div className="segmented">{['1/2','5/10','50/100'].map(b => <button key={b} aria-pressed={blinds === b} onClick={() => setBlinds(b)}>{b}</button>)}</div></fieldset>
        <fieldset className="setup-field"><legend><Layers3 size={16}/>初始筹码<span>大盲数</span></legend><div className="segmented">{[20,50,100].map(n=><button key={n} aria-pressed={startingBB===n} onClick={()=>setStartingBB(n)}>{n} BB</button>)}</div></fieldset>
        <div className="assist-setting"><div><h3>教练辅助</h3><p>在行动时结合位置、筹码和下注行为解释选择</p></div><button className="setting-switch" role="switch" aria-label="教练辅助" aria-checked={assist} onClick={() => setAssist(!assist)}><span /></button></div>
        <div className="session-summary"><span>{players} 人牌桌</span><span>{blinds} 盲注</span><span>{assist ? '教练已开启' : '自主练习'}</span></div>
        <button className="secondary-button" onClick={start}>进入自由练习<ArrowRight size={18} /></button>
        <p className="setup-footnote">初始筹码 {startingBB} 个大盲 · 用尽后可重新开始 · 虚拟练习</p>
      </section>
    </div>
    <footer className="session-footer"><span>AI 4 POKER</span><p>made by <strong>秦睿涵Ryan</strong></p><span>PLAY. THINK. REPEAT.</span></footer>
  </main>;
}
