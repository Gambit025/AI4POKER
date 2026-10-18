import { buildPots } from '../engine/game.js';
import type { GameState } from '../engine/types';
import { playerName } from './actionLabels';
export function PotSummary({state}:{state:GameState}) {
  const pots=state.handOver?state.settledPots:buildPots(state.players);
  if(!state.players.some(p=>p.isAllIn)&&(!state.handOver||pots.length<2))return null;
  return <section className="pot-summary" aria-label="主池与边池"><h3>{state.handOver?'分池结算':'当前筹码分层'}</h3>
    <p>{state.handOver?'每个底池独立比较牌型和平分零头。':'金额随后续行动变化；单人超额部分在本轮结束时退回。'}</p>
    <ol>{pots.map((pot,i)=><li key={i}><strong>{pot.uncalled?'待匹配金额':i===0?'主池':`边池 ${i}`} · {pot.amount}</strong><span>{pot.uncalled?'尚未获得跟注':state.handOver?pot.awards.map(a=>`${playerName(state.players[a.player].name)} 获得 ${a.amount}`).join(' · '):`可争夺：${pot.eligible.map(j=>playerName(state.players[j].name)).join('、')}`}</span></li>)}</ol>
  </section>;
}
