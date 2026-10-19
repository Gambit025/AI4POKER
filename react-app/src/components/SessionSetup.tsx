import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, Layers3, Spade, Users } from 'lucide-react';
import { readSoundPreferences } from '../audio/pokerAudio';
import type { GameConfig } from '../engine/types';

export function SessionSetup({ onStart, initialScreen='cover', initialConfig }: { onStart: (config: GameConfig, tutorial?: boolean) => void; initialScreen?: 'cover'|'settings'; initialConfig?: GameConfig }) {
  const [screen,setScreen]=useState<'cover'|'settings'>(initialScreen);
  const settingsHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{window.scrollTo({top:0});if(screen==='settings')settingsHeading.current?.focus();},[screen]);
  const [players, setPlayers] = useState(initialConfig?.playerCount??6);
  const [speed, setSpeed] = useState(initialConfig?.speed??'正常');
  const [blinds, setBlinds] = useState(initialConfig?`${initialConfig.sb}/${initialConfig.bb}`:'5/10');
  const [startingBB,setStartingBB]=useState(initialConfig?.startingBB??100);
  const [assist, setAssist] = useState(initialConfig?.aiAssist??true);
  const [sound] = useState(() => readSoundPreferences().enabled);
  const start = () => {
    const [sb, bb] = blinds.split('/').map(Number);
    onStart({ playerCount: players, sb, bb, speed, aiAssist: assist, sound, startingBB });
  };
  return <main className={`session-page cover-page ${screen==='cover'?'home-cover':'settings-page'}`}>
    <header className="session-header">
      <a className="brand" href="./" onClick={e=>{e.preventDefault();setScreen('cover');}} aria-label="AI4POKER 首页"><span className="brand-mark"><Spade size={20} fill="currentColor" /></span><span>AI 4 <span className="brand-light">POKER</span></span></a>
      {screen==='settings'?<button className="back-to-cover" onClick={()=>setScreen('cover')}><ArrowLeft size={14}/>返回首页</button>:<span className="header-note"><span className="status-dot" /> 德州扑克学习与练习</span>}
    </header>
    {screen==='cover'?<div className="session-grid landing-grid">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <h1 id="welcome-title" className="slogan-title" aria-label="Learn how to play with AI, then play your opponents.">
          <span className="slogan-first">Learn how to<br/>play with <em>AI</em>,</span>
          <span className="slogan-interlude" aria-hidden="true">
            <span className="slogan-cards"><span className="slogan-card slogan-card-dark"><span>K</span><Spade fill="currentColor"/></span><span className="slogan-card slogan-card-light"><span>A</span><Spade fill="currentColor"/></span><span className="slogan-token">4</span></span>
          </span>
          <span className="slogan-last">then play<br/>your opponents.</span>
        </h1>
        <button className="landing-start" onClick={()=>setScreen('settings')}>start playing<ArrowUpRight size={18}/></button>
      </section>
    </div>:<div className="session-grid settings-grid">
      <section className="settings-introduction" aria-labelledby="settings-intro-title">
        <span className="settings-eyebrow">YOUR TABLE, YOUR PACE.</span>
        <h1 id="settings-intro-title">Set your table.<br/>Find your game.</h1>
        <p>选好牌桌，开始下一手。<br/>从一局练习，建立自己的判断。</p>
        <button className="primary-button tutorial-button" onClick={() => onStart({ playerCount: 4, sb: 5, bb: 10, speed: '慢', aiAssist: true, sound }, true)}><BookOpen size={18} /><span>开始新手第一局</span><ArrowUpRight size={19} /></button>
        <p className="welcome-footnote">4 人慢速桌 · 全程操作讲解 · 可随时跳过</p>
      </section>
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="setup-heading"><div><h2 id="setup-title" ref={settingsHeading} tabIndex={-1}>按你的节奏练习</h2><p>已经了解规则？自定义牌桌，直接开始。</p></div><span className="setup-symbol"><Layers3 size={22} /></span></div>
        <fieldset className="setup-field"><legend><Users size={16} />牌桌人数<span>含你在内</span></legend><div className="segmented player-options">{[2,3,4,5,6,7,8].map(n => <button key={n} aria-pressed={players === n} onClick={() => setPlayers(n)}>{n}<span className="sr-only"> 人</span></button>)}</div></fieldset>
        <fieldset className="setup-field"><legend><Clock3 size={16} />对局速度</legend><div className="segmented">{['慢','正常','快'].map(s => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}{speed === s && <Check size={13} aria-hidden="true" />}</button>)}</div><p className="field-note">{speed === '慢' ? '每次行动间隔 3.2 秒，留出观察时间。' : speed === '快' ? '每次行动间隔 1 秒，适合熟练后的连续练习。' : '每次行动间隔 2 秒，看清动作后再继续。'}</p></fieldset>
        <fieldset className="setup-field"><legend><Layers3 size={16} />盲注大小<span>小盲 / 大盲</span></legend><div className="segmented">{['1/2','5/10','50/100'].map(b => <button key={b} aria-pressed={blinds === b} onClick={() => setBlinds(b)}>{b}</button>)}</div></fieldset>
        <fieldset className="setup-field"><legend><Layers3 size={16}/>初始筹码<span>大盲数</span></legend><div className="segmented">{[20,50,100].map(n=><button key={n} aria-pressed={startingBB===n} onClick={()=>setStartingBB(n)}>{n} BB</button>)}</div></fieldset>
        <div className="assist-setting"><div><h3>教练辅助</h3><p>在行动时结合位置、筹码和下注行为解释选择</p></div><button className="setting-switch" role="switch" aria-label="教练辅助" aria-checked={assist} onClick={() => setAssist(!assist)}><span /></button></div>
        <div className="session-summary"><span>{players} 人牌桌</span><span>{blinds} 盲注</span><span>{assist ? '教练已开启' : '自主练习'}</span></div>
        <button className="secondary-button" onClick={start}>进入自由练习<ArrowRight size={18} /></button>
        <p className="setup-footnote">初始筹码 {startingBB} 个大盲 · 用尽后可重新开始 · 虚拟练习</p>
      </section>
    </div>}
    <footer className="session-footer"><span>AI 4 POKER</span><p>made by <strong>秦睿涵Ryan</strong></p><span>PLAY. THINK. REPEAT.</span></footer>
  </main>;
}
