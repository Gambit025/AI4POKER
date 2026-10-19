import type { GameState } from '../engine/types.ts';

export function dealPlan(state: GameState, speed: string) {
  const order: number[] = [];
  for (let offset=1;offset<=state.players.length;offset++) {
    const i=(state.dealerButtonIndex+offset)%state.players.length;
    if(state.players[i].hand.length===2&&!state.players[i].isEliminated)order.push(i);
  }
  const interval=speed==='快'?40:speed==='慢'?95:65;
  return {order,interval,duration:order.length?((order.length*2-1)*interval+200):0};
}
export function isShowdown(state: GameState) {
  return state.handOver&&state.communityCards.length===5&&state.players.filter(p=>p.hand.length===2&&!p.isFolded).length>1;
}
