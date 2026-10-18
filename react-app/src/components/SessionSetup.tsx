import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, Layers3, Spade, Users, Volume2 } from 'lucide-react';
import { readSoundPreferences, saveSoundPreferences } from '../audio/pokerAudio';
import type { GameConfig } from '../engine/types';

export function SessionSetup({ onStart }: { onStart: (config: GameConfig, tutorial?: boolean) => void }) {
  const [players, setPlayers] = useState(6);
  const [speed, setSpeed] = useState('正常');
  const [blinds, setBlinds] = useState('5/10');
  const [startingBB,setStartingBB]=useState(100);
  const [assist, setAssist] = useState(true);
  const [sound, setSound] = useState(() => readSoundPreferences().enabled);
  const start = () => {
    const [sb, bb] = blinds.split('/').map(Number);
    onStart({ playerCount: players, sb, bb, speed, aiAssist: assist, sound, startingBB });
  };
  return <main className="session-page">
    <header className="session-header">
      <a className="brand" href="./" aria-label="AI4POKER 首页"><span className="brand-mark"><Spade size={20} fill="currentColor" /></span><span>AI4<span className="brand-light">POKER</span></span></a>
      <span className="header-note"><span className="status-dot" /> 德州扑克学习与练习</span>
    </header>
    <div className="session-grid">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <h1 id="welcome-title">每一手牌，<br />都学会一点。</h1>
        <p className="welcome-description">从看懂手牌，到做出自己的选择。<br />在一局有讲解的练习里，迈出第一步。</p>
        <div className="hand-preview" aria-label="手牌示例：黑桃 A 和黑桃 K">
          <div className="preview-caption"><span>你的第一课</span><span>认识手牌</span></div>
          <div className="preview-cards" aria-hidden="true">
            <div className="sample-card sample-ace"><span>A<Spade size={15} fill="currentColor" /></span><Spade className="sample-suit" fill="currentColor" /><span className="card-corner">A</span></div>
            <div className="sample-card sample-king"><span>K<Spade size={15} fill="currentColor" /></span><Spade className="sample-suit" fill="currentColor" /><span className="card-corner">K</span></div>
          </div>
          <div className="preview-description"><span className="lesson-line" /><p>两张手牌，无数种选择。<br /><strong>先看懂，再行动。</strong></p></div>
        </div>
        <div className="learning-path" aria-label="学习路径"><span>认识手牌</span><ArrowRight size={14} /><span>做出选择</span><ArrowRight size={14} /><span>回看决策</span></div>
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
        <div className="assist-setting sound-setting"><div><h3 className="flex items-center gap-2"><Volume2 size={15}/> 牌桌音效</h3><p>轻量操作提示，牌局内可调音量或静音</p></div><button className="setting-switch" role="switch" aria-label="牌桌音效" aria-checked={sound} onClick={() => {const next=!sound; setSound(next); saveSoundPreferences({...readSoundPreferences(),enabled:next});}}><span /></button></div>
        <div className="session-summary"><span>{players} 人牌桌</span><span>{blinds} 盲注</span><span>{assist ? '教练已开启' : '自主练习'}</span></div>
        <button className="secondary-button" onClick={start}>进入自由练习<ArrowRight size={18} /></button>
        <p className="setup-footnote">初始筹码 {startingBB} 个大盲 · 用尽后可重新开始 · 虚拟练习</p>
      </section>
    </div>
    <footer className="session-footer"><span>AI4POKER</span><p>把注意力放在选择上，进步来自每一次思考。</p><span>LEARN BY PLAYING</span></footer>
  </main>;
}
