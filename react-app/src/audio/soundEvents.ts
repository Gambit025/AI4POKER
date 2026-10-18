import type { SoundKind } from './pokerAudio.ts';
interface Action { action: string }
export interface SoundSnapshot {
  actions: Action[]; boardCount: number; handOver: boolean; heroTurn: boolean; heroWon: boolean;
}
export interface SoundEvent { kind: SoundKind; delay: number }
export function soundEvents(previous: SoundSnapshot | null, next: SoundSnapshot, newHand = false): SoundEvent[] {
  if (newHand) return [ { kind:'deal', delay:0 }, { kind:'deal', delay:0.12 }, ...(next.heroTurn ? [{kind:'turn' as const, delay:0.3}] : []) ];
  if (!previous) return [];
  const result: SoundEvent[] = [];
  const kinds: Record<string, SoundKind> = { call:'call', bet:'raise', raise:'raise', fold:'fold', check:'check' };
  for (const entry of next.actions.slice(previous.actions.length)) {
    if (kinds[entry.action]) result.push({ kind:kinds[entry.action], delay:result.length * 0.08 });
  }
  const offset = result.length ? 0.13 : 0;
  for (let i = previous.boardCount; i < next.boardCount; i++) result.push({kind:'flip', delay:offset + (i - previous.boardCount) * 0.1});
  const afterEffects = Math.max(0.15, ...result.map(event => event.delay + 0.16));
  if (next.handOver && !previous.handOver) result.push({kind:next.heroWon ? 'win' : 'end', delay:afterEffects});
  else if (next.heroTurn && !previous.heroTurn) result.push({kind:'turn', delay:result.length ? afterEffects : 0});
  return result;
}
