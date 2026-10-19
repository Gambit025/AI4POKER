import { motion, useReducedMotion } from 'motion/react';
import { Spade } from 'lucide-react';
import type { Card } from '../engine/types';
import { cardDisplay } from '../hooks/usePokerGame';

export function PlayingCard({card}:{card:Card}) {
  const d=cardDisplay(card);
  return <span className="table-card" data-red={d.isRed} role="img" aria-label={`${d.rank}${d.suit}`}><strong>{d.rank}</strong><span>{d.suit}</span></span>;
}
export function SeatCards({cards,sequence,interval,origin}:{cards?:Card[];sequence:number;interval:number;origin:{x:number;y:number}}) {
  const reduced=useReducedMotion();
  return <div className="seat-cards" aria-label={cards?'两张明牌':'两张暗牌'}>{[0,1].map(j=><motion.span className="dealt-card" key={j}
    initial={reduced?false:{opacity:0,x:origin.x-j*18,y:origin.y,rotate:-20,scale:.65}}
    animate={{opacity:1,x:0,y:0,rotate:0,scale:1}}
    transition={{duration:reduced?0:.18,delay:reduced?0:(sequence+j*interval)/1000,ease:'easeOut'}}>
      {cards?.[j]?<PlayingCard card={cards[j]}/>:<span className="card-back" role="img" aria-label="暗牌，未公开"><Spade fill="currentColor" aria-hidden="true"/></span>}
    </motion.span>)}</div>;
}
