import { useState, useRef, useEffect } from 'react';
import { PokerGame, bestHand, getHandRecap, HAND_RANK_ZH, handRankDisplayName } from '../engine/game.js';
import type { GameState, Advice, HandRecap, GameConfig, Card } from '../engine/types';
import { PokerAudio, readSoundPreferences, saveSoundPreferences } from '../audio/pokerAudio';
import { soundEvents, type SoundSnapshot } from '../audio/soundEvents';

const SUITS: Record<string, string> = { s:'♠', h:'♥', d:'♦', c:'♣' };
const RANKS: Record<number, string> = { 11:'J', 12:'Q', 13:'K', 14:'A' };
export function cardDisplay(card: Card) {
  return { rank:RANKS[card.rank] || String(card.rank), suit:SUITS[card.suit] || card.suit, isRed:card.suit === 'h' || card.suit === 'd' };
}
export function usePokerGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [handRecap, setHandRecap] = useState<HandRecap | null>(null);
  const [handId, setHandId] = useState(0);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [volume, setVolumeState] = useState(() => readSoundPreferences().volume);
  const [actionError,setActionError]=useState('');
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [config, setConfig] = useState<GameConfig>({ playerCount:6, sb:5, bb:10, speed:'正常', aiAssist:true, sound:readSoundPreferences().enabled });
  const configRef = useRef(config);
  const volumeRef = useRef(volume);
  const gameRef = useRef<PokerGame | null>(null);
  const audioRef = useRef<PokerAudio | null>(null);
  const soundSnapshotRef = useRef<SoundSnapshot | null>(null);
  const pausedRef = useRef(false);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (aiTimerRef.current !== null) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = null;
  }
  function audio() {
    if (!audioRef.current) audioRef.current = new PokerAudio();
    return audioRef.current;
  }
  function configureAudio() {
    audio().configure({ enabled:configRef.current.sound, volume:volumeRef.current });
  }
  function unlockAudio() {
    if (!configRef.current.sound) return;
    configureAudio();
    void audio().unlock().then(ok => setAudioUnavailable(!ok));
  }
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameRef.current) {
        pausedRef.current = true; setIsPaused(true); setIsAIRunning(false);
        clearTimer(); audioRef.current?.stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimer(); 
      void audioRef.current?.dispose(); audioRef.current = null;
    };
  }, []);

  function syncState(newHand = false) {
    if (!gameRef.current) return null;
    // Copy engine state: the engine mutates players and logs in place between actions.
    const state = structuredClone(gameRef.current.getState());
    const snapshot: SoundSnapshot = {
      actions:state.actionLog.map(entry => ({action:entry.action})), boardCount:state.communityCards.length,
      handOver:state.handOver, heroTurn:state.currentPlayerIndex === 0 && !state.handOver && !state.players[0].isFolded && state.players[0].hand.length === 2,
      heroWon:state.handOver && state.players[0].chips > (state.startingChips?.[0] ?? state.players[0].chips),
    };
    for (const event of soundEvents(soundSnapshotRef.current, snapshot, newHand)) audioRef.current?.play(event.kind, event.delay);
    soundSnapshotRef.current = snapshot;
    setGameState(state);
    return state;
  }
  function updateAdvice() {
     
    const next = gameRef.current?.getAdvice() ?? null;
    setAdvice(next);
  }

  function runAITurns(state: GameState) {
    clearTimer();
    if (!gameRef.current) return;
    if (state.handOver) {
      setHandRecap(getHandRecap(state)); setIsAIRunning(false); return;
    }
    if (pausedRef.current) { setIsAIRunning(false); return; }
    if (state.players[state.currentPlayerIndex]?.isHuman) {
      if (configRef.current.aiAssist) updateAdvice();
      setIsAIRunning(false); return;
    }
    setIsAIRunning(true);
    const delay = configRef.current.speed === '快' ? 1000 : configRef.current.speed === '慢' ? 3200 : 2000;
    aiTimerRef.current = setTimeout(() => {
      aiTimerRef.current = null;
      if (!gameRef.current || pausedRef.current) return;
      gameRef.current.runAI();
      const next = syncState();
      if (next) runAITurns(next);
    }, delay);
  }
  function createGame(nextConfig: GameConfig) {
    clearTimer();  audioRef.current?.stop(); soundSnapshotRef.current = null;
    pausedRef.current = false; setIsPaused(false); setIsAIRunning(false);
    configRef.current = nextConfig; setConfig(nextConfig);
    gameRef.current = new PokerGame(nextConfig.sb, nextConfig.bb, (nextConfig.startingBB ?? 100) * nextConfig.bb, nextConfig.playerCount);
    setActionError('');setHandId(0); setHandRecap(null); setAdvice(null); 
    saveSoundPreferences({enabled:nextConfig.sound, volume:volumeRef.current});
    unlockAudio(); syncState();
  }
  function leaveGame() {
    clearTimer();  audioRef.current?.stop();
    soundSnapshotRef.current = null; gameRef.current = null;
    setIsAIRunning(false); setAdvice(null); 
  }
  function startNewHand() {
    if (!gameRef.current || pausedRef.current) return;
    const old = gameRef.current.getState();
    if (old.players[0].hand.length === 2 && !old.handOver) return;
    clearTimer();  audioRef.current?.stop(); unlockAudio();
    setActionError('');setHandRecap(null); setAdvice(null); 
    if (!gameRef.current.startNewHand()) return;
    const state = syncState(true);
    setHandId(prev => prev + 1);
    if (state) runAITurns(state);
  }
  function act(action: string, amount?: number) {
    if (!gameRef.current || pausedRef.current) return;
    const state = gameRef.current.getState();
    if (state.handOver || state.currentPlayerIndex !== 0 || state.players[0].hand.length !== 2 || state.players[0].isFolded) return;
    unlockAudio(); if (!gameRef.current.act(action, amount)) {setActionError(gameRef.current.lastError);return;}
    setActionError('');setAdvice(null);
    const next = syncState(); if (next) runAITurns(next);
  }
  function togglePause() {
    if (!gameRef.current) return;
    pausedRef.current = !pausedRef.current; setIsPaused(pausedRef.current);
    clearTimer(); audioRef.current?.stop(); setIsAIRunning(false);
    if (!pausedRef.current) { unlockAudio(); runAITurns(gameRef.current.getState()); }
  }
  function toggleSound() {
    const next = {...configRef.current, sound:!configRef.current.sound};
    configRef.current = next; setConfig(next); configureAudio();
    saveSoundPreferences({enabled:next.sound, volume:volumeRef.current});
    if (next.sound) void audio().unlock().then(ok => {
      setAudioUnavailable(!ok);
      if (ok && gameRef.current && configRef.current.sound && !pausedRef.current) audio().play('turn');
    });
  }
  function previewSound() {
    if (!configRef.current.sound) return;
    configureAudio();
    void audio().unlock().then(ok => {
      setAudioUnavailable(!ok);
      if (ok && gameRef.current) { audio().play('check'); audio().play('call',0.2); }
    });
  }
  function setVolume(value: number) {
    const next = Number.isFinite(value) ? Math.min(1,Math.max(0,value)) : 0.4;
    volumeRef.current = next; setVolumeState(next); configureAudio();
    saveSoundPreferences({enabled:configRef.current.sound, volume:next});
  }
  function setSpeed(speed: string) {
    if (!['慢','正常','快'].includes(speed)) return;
    const next = {...configRef.current, speed}; configRef.current = next; setConfig(next);
    if (gameRef.current && gameRef.current.getState().players[0].hand.length === 2) runAITurns(gameRef.current.getState());
  }
  function getPlayerHandRank(index: number) {
    const player = gameState?.players[index];
    if (!gameState?.handOver || !player || player.isFolded || player.hand.length < 2 || gameState.communityCards.length < 3) return null;
    const evaluated = bestHand(player.hand.concat(gameState.communityCards));
    return evaluated ? HAND_RANK_ZH[evaluated.rank] || handRankDisplayName(evaluated.rank) : null;
  }
  return {
    gameState, advice, actionError, handRecap, handId, isAIRunning, isPaused, config, volume, audioUnavailable,
    createGame, leaveGame, startNewHand, act, togglePause, toggleSound, previewSound, setVolume, setSpeed,
    fold:() => act('fold'), check:() => act('check'), call:() => act('call'), raise:(amount:number) => act('raise',amount),
    getLegalActions:() => gameRef.current?.getLegalActions() ?? null,
    getToCall:() => gameRef.current?.getToCall() ?? 0,
    getMaxBet:() => gameState ? Math.max(...gameState.players.map(p => p.currentBet)) : 0,
    getPlayerHandRank, cardDisplay,
  };
}
