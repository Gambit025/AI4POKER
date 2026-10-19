export interface Card {
  suit: 's' | 'h' | 'd' | 'c';
  rank: number; // 2-14, A=14
}

export interface PlayerAction {
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount?: number;
  allIn?: boolean;
  fullRaise?: boolean;
}

export interface AIStyle {
  label: string;
  weight: number;
  openMod: number;
  aggrMod: number;
  bluffMod: number;
  foldMod: number;
  fearMod: number;
  commitMod: number;
  raiseThr: number;
  sizingMod: number;
}

export interface Player {
  name: string;
  chips: number;
  hand: Card[];
  isFolded: boolean;
  currentBet: number;
  totalBetThisHand: number;
  isHuman: boolean;
  lastAction: PlayerAction | null;
  actedThisStreet: boolean;
  style: AIStyle | null;
  isEliminated?: boolean;
  inHand?: boolean;
  isAllIn?: boolean;
  lastActedBet?: number;
  raiseThreshold?: number;
}

export interface ActionLogEntry {
  street: number;
  player: number;
  name: string;
  action: string;
  amount: number;
  totalBet?: number;
  allIn?: boolean;
  fullRaise?: boolean;
  addedAmount?: number;
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  street: number; // 0=preflop, 1=flop, 2=turn, 3=river, 4=showdown
  currentPlayerIndex: number;
  minRaise: number;
  lastBetAmount: number;
  handOver: boolean;
  winnerIndex: number | null;
  winnerIndices: number[] | null;
  message: string;
  deck: Card[];
  dealerButtonIndex: number;
  firstToActThisStreet: number;
  sbPosition: number;
  bbPosition: number;
  actionLog: ActionLogEntry[];
  heroDecisions?: any[];
  startingChips?: number[];
  raiseCountThisStreet?: number;
  currentBet: number;
  handNumber: number;
  settledPots: PotResult[];
  refunds: {player:number; amount:number}[];
  sb?: number;
  bb?: number;
}

export interface HandEval {
  rank: number;
  tieBreaker: number[];
}

export interface AdviceDetails {
  street: string;
  streetName: string;
  handDesc: string;
  handStrength: number | null;
  position: string;
  positionDesc: string;
  drawInfo: string | null;
  drawIcon: string;
  ehs: number | null;
  potOdds: number;
  spr: number;
  opponentsBetting: number;
  opponents: number;
  samples: number;
  exact: boolean;
  effectiveBB:number;
  remainingBB:number;
  callCost:number;
  limpers:number;
  model:string;
  callEV:number;
}

export interface Advice {
  action: string;
  betAmount: number | null;
  coach: string;
  winProbability: number;
  tier: string;
  requiredEquity: number;
  details: AdviceDetails;
  summary:string;
  risk:string;
  facts:string;
  analysisParts:{title:string;body:string}[];
  reasons:string[];
  alternatives:{action:string;reason:string}[];
  ranges:OpponentRangeSummary[];
  sensitivity:{low:number;high:number;evLow:number;evHigh:number};
  cautions:string;
}

export interface HandRecap {
  grade: string;
  gradeEmoji: string;
  summaryLine: string;
  decisions: any[];
  heroWon: boolean;
  heroFolded: boolean;
  chipChange: string;
  chipDiff: number;
  showdownSummary: string;
}

export interface GameConfig {
  playerCount: number;
  sb: number;
  bb: number;
  speed: string;
  aiAssist: boolean;
  sound: boolean;
  startingBB?: number;
}

export interface LegalActions {
  canAct:boolean; currentBet:number; toCall:number; callAmount:number; canFold:boolean; canCheck:boolean;
  canCall:boolean; canRaise:boolean; raiseReopened:boolean; minRaiseTo:number; maxRaiseTo:number;
  canFullRaise:boolean; canAllIn:boolean; allInIsCall:boolean; shortAllIn:boolean;
}
export interface PotResult {amount:number; cap:number; eligible:number[]; contributors:number[]; uncalled:boolean; winnerIndices?:number[]; awards:{player:number; amount:number}[]}

export interface OpponentRangeSummary {player:number;name:string;position:string;depth:number;examples:string[];evidence:string;explanation:string;informed:boolean}
export interface OpponentRange extends OpponentRangeSummary {combos:{hand:Card[];weight:number}[]}
