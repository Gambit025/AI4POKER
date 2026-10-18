import type { Advice, Card, GameState, HandEval, HandRecap, LegalActions, Player, PotResult, OpponentRange } from './types';

export class PokerGame {
  constructor(sb?: number, bb?: number, initialChips?: number, playerCount?: number, options?: {initialStacks?:number[]; random?:()=>number; coaching?:boolean});
  getState(): GameState;
  getToCall(): number;
  getAdvice(): Advice | null;
  startNewHand(): boolean;
  getLegalActions(): LegalActions;
  lastError: string;
  act(action: string, amount?: number): boolean;
  runAI(): boolean;
}

export function bestHand(cards: Card[]): HandEval | null;
export function getHandRecap(state: GameState): HandRecap;
export function handRankDisplayName(rank: number): string;
export const HAND_RANK_ZH: Record<number, string>;

export function countAggressors(state: GameState): number;
export function getPosition(index: number, state: GameState): string;

export function detectDraws(hand: Card[], community: Card[]): {flushDraw:boolean; oesd:boolean; gutshot:boolean; comboDraw:boolean; outs:number; drawStrength:number};

export function buildPots(players: Player[]): PotResult[];

export interface EquityOptions {opponents?:number; knownHands?:Card[][]; random?:()=>number; simulations?:number;opponentRanges?:Pick<OpponentRange,'combos'>[];temperature?:number; sampling?:'importance'}
export interface EquityEstimate {equity:number; win:number; tie:number; lose:number; samples:number; exact:boolean;effectiveSamples?:number}
export function estimateEquity(hand:Card[],board:Card[],options?:EquityOptions):EquityEstimate;
export function recommend(hand:Card[],state:GameState,options?:{random?:()=>number;simulations?:number}):Advice;
export function callPotContext(state:GameState,index?:number):{cost:number; contestable:number; pots:PotResult[]; requiredEquity:number};
export function legalActions(state:GameState,index?:number):LegalActions;
export function evaluateFive(cards:Card[]):HandEval | null;
export function compareEval(a:HandEval,b:HandEval):number;

export function opponentRanges(state:GameState,index?:number,hand?:Card[]):OpponentRange[];

export function hasPrivateValue(hand:Card[],board:Card[]):boolean;
