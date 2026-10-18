import assert from 'node:assert/strict';
import {bestHand,evaluateFive} from '../src/engine/game.js';
const deck=['s','h','d','c'].flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit})));
const counts=Array(9).fill(0);
for(let a=0;a<48;a++)for(let b=a+1;b<49;b++)for(let c=b+1;c<50;c++)for(let d=c+1;d<51;d++)for(let e=d+1;e<52;e++){
  const cards=[deck[a],deck[b],deck[c],deck[d],deck[e]],actual=bestHand(cards),oracle=evaluateFive(cards);
  counts[actual.rank]++;
  if(actual.rank!==oracle.rank||actual.tieBreaker.length!==oracle.tieBreaker.length||actual.tieBreaker.some((v,i)=>v!==oracle.tieBreaker[i]))assert.deepEqual(actual,oracle,JSON.stringify(cards));
}
assert.deepEqual(counts,[1302540,1098240,123552,54912,10200,5108,3744,624,40]);
console.log('PASS: all 2,598,960 five-card hands match independent evaluator and category counts.',counts);
