import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Card } from '../engine/types';
import { cardDisplay } from '../hooks/usePokerGame';

export function PlayingCard({card}:{card:Card}) {
  const d=cardDisplay(card);
  return <span className="table-card" data-red={d.isRed} role="img" aria-label={`${d.rank}${d.suit}`}><strong>{d.rank}</strong><span>{d.suit}</span></span>;
}
function CardBack() {
  return <span className="card-back" role="img" aria-label="暗牌，未公开"><svg viewBox="0 0 28 40" aria-hidden="true"><path d="M-20 0 28 48M-12 0 28 40M-4 0 28 32M4 0 28 24M12 0 28 16M20 0 28 8M0 8 28 36M0 16 24 40M0 24 16 40M0 32 8 40M48 0 0 48M40 0 0 40M32 0 0 32M24 0 0 24M16 0 0 16M8 0 0 8M28 8 0 36M28 16 4 40M28 24 12 40M28 32 20 40" fill="none" stroke="currentColor" strokeWidth=".7"/></svg></span>;
}
export function SeatCards({cards,sequence,interval}:{cards?:Card[];sequence:number;interval:number}) {
  const reduced=useReducedMotion();
  const ref=useRef<HTMLDivElement>(null);
  const [origin,setOrigin]=useState<{x:number;y:number;step:number}|null>(null);
  useLayoutEffect(()=>{
    const hand=ref.current,table=hand?.closest('.poker-table');if(!hand||!table)return;
    const h=hand.getBoundingClientRect(),t=table.getBoundingClientRect();
    const gap=parseFloat(getComputedStyle(hand).gap)||0,step=(h.width+gap)/2;
    setOrigin({x:t.left+t.width/2-(h.left+(h.width-gap)/4),y:t.top+t.height/2-(h.top+h.height/2),step});
  },[]);
  return <div ref={ref} className="seat-cards" aria-label={cards?'两张明牌':'两张暗牌'}>{(origin||reduced)&&[0,1].map(j=><motion.span className="dealt-card" key={j}
    initial={reduced?false:{opacity:0,x:(origin?.x??0)-j*(origin?.step??0),y:origin?.y??0,rotate:-20,scale:.65}}
    animate={{opacity:1,x:0,y:0,rotate:0,scale:1}}
    transition={{duration:reduced?0:.18,delay:reduced?0:(sequence+j*interval)/1000,ease:'easeOut'}}>
      {cards?.[j]?<PlayingCard card={cards[j]}/>:<CardBack/>}
    </motion.span>)}</div>;
}
