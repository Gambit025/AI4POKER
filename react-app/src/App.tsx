import { useState, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, Spade, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { usePokerGame, cardDisplay } from './hooks/usePokerGame';
import { ActionHistory } from './components/ActionHistory';
import { actionText, playerName, STREETS } from './components/actionLabels';
import { PotSummary } from './components/PotSummary';
import { BetControls } from './components/BetControls';
import { SessionSetup } from './components/SessionSetup';
import { FirstHandGuide } from './components/FirstHandGuide';
import { CoachPanel, RecapPanel } from './components/CoachPanel';
import type { GameConfig, Card, GameState } from './engine/types';

export default function App() {
  const [guided,setGuided]=useState(false),[view,setView]=useState<'settings'|'game'>('settings');
  const game=usePokerGame();
  useEffect(()=>{window.scrollTo({top:0});},[view]);
  function start(config:GameConfig,tutorial=false){setGuided(tutorial);game.createGame(config);setView('game');}
  return view==='settings'?<SessionSetup onStart={start}/>:<GameView game={game} guided={guided} onGuideChange={setGuided} onBack={()=>{game.leaveGame();setView('settings');}}/>;
}
type Panel='coach'|'history'|'rules'|'guide';
const panelNames:Record<Panel,string>={coach:'教练',history:'记录',rules:'规则',guide:'教学'};
function InformationDialog({children,onClose}:{children:ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="information-dialog" aria-label="牌局信息" onClose={onClose}><div className="dialog-heading"><strong>牌局信息</strong><button autoFocus onClick={()=>ref.current?.close()} aria-label="关闭信息面板"><X size={20}/></button></div>{children}</dialog>;
}
function GameView({game,guided,onGuideChange,onBack}:{game:ReturnType<typeof usePokerGame>;guided:boolean;onGuideChange:(value:boolean)=>void;onBack:()=>void}) {
  const [started,setStarted]=useState(false),[panel,setPanel]=useState<Panel>(guided?'guide':'coach'),[dialog,setDialog]=useState(false);
  const resumeAfterPanel=useRef(false),s=game.gameState,legal=game.getLegalActions();
  const heroTurn=!!s&&!s.handOver&&s.currentPlayerIndex===0&&!game.isAIRunning&&!game.isPaused&&!!legal?.canAct;
  const latest=s?.actionLog.at(-1),sessionDone=!!s?.handOver&&(s.players[0].chips===0||s.players.filter(p=>p.chips>0).length<2);
  function next(){if(sessionDone)game.createGame(game.config);game.startNewHand();setStarted(true);}
  function openInfo(value:Panel){setPanel(value);if(!game.isPaused&&!s?.handOver&&started){resumeAfterPanel.current=true;game.togglePause();}setDialog(true);}
  function closeInfo(){setDialog(false);if(resumeAfterPanel.current){resumeAfterPanel.current=false;game.togglePause();}}
  const info=<><nav className="info-tabs" aria-label="牌局信息分类">{(Object.keys(panelNames) as Panel[]).map(value=><button key={value} aria-pressed={panel===value} onClick={()=>setPanel(value)}>{panelNames[value]}</button>)}</nav><div className="info-body">
    {panel==='coach'?(s?.handOver&&game.handRecap?<RecapPanel recap={game.handRecap}/>:game.config.aiAssist?<CoachPanel advice={game.advice}/>:<p className="info-empty">教练辅助已关闭。你仍可查看行动记录和规则。</p>):panel==='history'?<ActionHistory entries={s?.actionLog??[]}/>:panel==='guide'?<FirstHandGuide state={s} started={started} thinking={game.isAIRunning} toCall={game.getToCall()} onClose={()=>{onGuideChange(false);setPanel('coach');}}/>:<><h3>下注与结算</h3><p>加注至 = 本轮总额；本次投入包含跟注差额。本轮与本手累计投入分别显示在席位下方。</p><p>短筹码只投入剩余筹码；不足额全下不自动重开加注权。未获跟注的超额部分返还，主池和各边池独立结算。</p>{s&&<PotSummary state={s}/>}</>}
  </div></>;
  return <main className="game-layout" data-players={s?.players.length??6}>
    <header className="game-header"><button onClick={onBack}><ArrowLeft size={16}/><span>返回设置</span></button><span className="table-brand"><Spade size={16} fill="currentColor"/> AI4POKER</span><span className="table-meta">{game.config.sb}/{game.config.bb} · {s?.handOver?'已结束':STREETS[s?.street??0]}</span></header>
    <section className="table-column" aria-label="德州扑克练习牌桌">
      <div className="playback-toolbar"><span className="session-hand">第 {Math.max(1,game.handId)} 手</span><div className="playback-options"><label><span className="sr-only">对局速度</span><select aria-label="对局速度" value={game.config.speed} onChange={e=>game.setSpeed(e.target.value)}><option value="慢">慢速 · 3.2秒</option><option value="正常">正常 · 2秒</option><option value="快">快速 · 1秒</option></select></label><button aria-label={game.isPaused?'继续对局':'暂停对局'} onClick={game.togglePause}>{game.isPaused?<Play size={16}/>:<Pause size={16}/>}</button><button aria-label={game.config.sound?'关闭音效':'开启音效'} onClick={game.toggleSound}>{game.config.sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button><details className="sound-options"><summary>音量</summary><div><label>音效音量 {Math.round(game.volume*100)}%<input aria-label="音效音量" type="range" min="0" max="100" value={Math.round(game.volume*100)} onChange={e=>game.setVolume(Number(e.target.value)/100)}/></label><button onClick={game.previewSound} disabled={!game.config.sound}>试听音效</button><p>{game.audioUnavailable?'音频不可用，练习可继续。':'音效仅作辅助，动作以席位文字为准。'}</p></div></details></div></div>
      <div className="table-status" role="status" aria-live="polite"><strong>{game.isPaused?'已暂停':!started?'准备发牌':s?.handOver?'本手结束':heroTurn?'轮到你':`${playerName(s?.players[s.currentPlayerIndex]?.name??'对手')} 思考中`}</strong><span>{latest?`${playerName(latest.name)} · ${actionText(latest)}`:'仅使用虚拟筹码'}</span></div>
      <div className="table-stage"><div className="poker-table"><div className="community-area"><div className="pot-total">底池 <strong>{s?.pot.toLocaleString()??0}</strong></div><div className="community-cards">{Array.from({length:5},(_,i)=><div className="community-slot" key={i}>{s?.communityCards[i]?<PlayingCard card={s.communityCards[i]}/>:<span aria-label="尚未发出的公共牌">♠</span>}</div>)}</div></div>{s&&<Players state={s} paused={game.isPaused} rank={game.getPlayerHandRank}/>}</div></div>
      <footer className="table-dock">
        {!started?<button className="deal-button" onClick={next}>开始发牌</button>:s?.handOver?<div className="compact-result"><div><strong>{sessionDone?'本次练习结束':'本手已结算'}</strong><span>净变化 {game.handRecap?.chipChange??'0'}</span></div><button onClick={()=>openInfo('coach')}>查看原因</button><button className="deal-button" onClick={next}>{sessionDone?'重新练习':'下一手'}</button></div>:heroTurn&&legal?<BetControls key={`${game.handId}-${s?.actionLog.length}`} legal={legal} bb={game.config.bb} pot={s?.pot??0} onFold={game.fold} onCall={game.call} onCheck={game.check} onRaise={n=>game.act('raise',n)} onAllIn={()=>game.act('allin')}/>:<div className="waiting-dock">{game.isPaused?<><span>已暂停，可以查看席位和记录</span><button onClick={game.togglePause}>继续对局</button></>:<span>观察对手的动作，轮到你时操作区会出现。</span>}</div>}
        {game.actionError&&<p role="alert" className="bet-error">{game.actionError}</p>}
        <nav className="mobile-info-actions" aria-label="查看牌局信息">{(['coach','history','rules','guide'] as Panel[]).map(value=><button key={value} onClick={()=>openInfo(value)}>{value==='guide'&&guided?'● ':''}{panelNames[value]}</button>)}</nav>
      </footer>
    </section>
    <aside className="analysis-column" aria-label="教练与复盘">{info}</aside>
    {dialog&&<InformationDialog onClose={closeInfo}>{info}</InformationDialog>}
  </main>;
}
const seatLayouts:Record<number,number[][]>={
  2:[[50,88],[50,12]],3:[[50,88],[82,18],[18,18]],4:[[50,88],[86,48],[50,12],[14,48]],
  5:[[50,88],[86,65],[78,15],[22,15],[14,65]],6:[[50,88],[86,66],[86,22],[50,12],[14,22],[14,66]],
  7:[[50,90],[86,76],[86,45],[70,12],[30,12],[14,45],[14,76]],8:[[50,90],[86,76],[86,46],[86,16],[50,16],[14,16],[14,46],[14,76]]
};
function Players({state:s,paused,rank}:{state:GameState;paused:boolean;rank:(index:number)=>string|null}) {
  const showdown=s.handOver&&s.communityCards.length===5;
  return s.players.map((player,i)=>{
    const entry=s.actionLog.filter(e=>e.player===i).at(-1),active=!paused&&!s.handOver&&s.currentPlayerIndex===i&&player.chips>0&&player.hand.length===2;
    const [x,y]=seatLayouts[s.players.length][i],kind=entry?.action??'waiting';
    const wager=entry&&!player.isEliminated&&['raise','bet','call','sb','bb','return'].includes(entry.action)&&entry.amount>0?{amount:entry.action==='raise'?(entry.totalBet??entry.amount):entry.amount,label:entry.action==='raise'?(entry.allIn?'全下至':'加注至'):entry.action==='call'&&entry.allIn?'全下跟注':entry.allIn?'全下下注':({bet:'下注',call:'跟注',sb:'小盲',bb:'大盲',return:'退回'} as Record<string,string>)[entry.action],prefix:entry.action==='call'?'+':''}:null;
    const label=player.isEliminated?'已出局':entry?.allIn&&(entry.action==='raise'||entry.action==='bet')?`全下至 ${entry.totalBet??entry.amount}`:entry?.allIn&&entry.action==='call'?`全下跟注 ${entry.amount}`:entry?actionText(entry):player.hand.length===2?'待行动':'等待发牌';
    return <article className="player-seat" data-hero={i===0} data-active={active} data-folded={player.isFolded} data-showdown={showdown&&!player.isFolded} data-kind={kind} key={i} style={{'--seat-x':`${x}%`,'--seat-y':`${y}%` } as CSSProperties} aria-label={`${playerName(player.name)}，${label}，本轮投入 ${player.currentBet}，本手累计投入 ${player.totalBetThisHand}`}>
      {(i===0||showdown&&!player.isFolded)&&player.hand.length===2&&<div className="seat-cards">{player.hand.map((card,j)=><PlayingCard key={j} card={card}/>)}</div>}
      <div className="seat-heading"><strong>{playerName(player.name)}</strong>{s.dealerButtonIndex===i&&<span title="庄家">D</span>}<span>{`余 ${player.chips}`}</span></div>
      <div className="seat-decision"><span className="decision-street">{entry&&entry.street!==s.street?`${STREETS[entry.street]} · `:''}</span><span className="seat-action-line"><strong>{wager?.label??label}</strong>{wager&&<span className="seat-wager" aria-label={`${wager.label} ${wager.amount}`}><i aria-hidden="true"/>{wager.prefix}{wager.amount.toLocaleString()}</span>}</span></div>
      <div className="seat-totals"><span>本轮<b>{player.currentBet}</b></span><span>累计<b>{player.totalBetThisHand}</b></span></div>
      {showdown&&!player.isFolded&&<span className="seat-rank">{rank(i)}</span>}
    </article>;
  });
}
function PlayingCard({card}:{card:Card}){const d=cardDisplay(card);return <span className="table-card" data-red={d.isRed} role="img" aria-label={`${d.rank}${d.suit}`}><strong>{d.rank}</strong><span>{d.suit}</span></span>;}
