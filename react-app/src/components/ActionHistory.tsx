import { History } from 'lucide-react';
import type { ActionLogEntry } from '../engine/types';

import { STREETS, actionText, playerName } from './actionLabels';

export function ActionHistory({ entries }: { entries: ActionLogEntry[] }) {
  const latest = entries.slice(-4).reverse();
  const rows = (items: ActionLogEntry[]) => items.map((e,i) => <li key={`${e.street}-${e.player}-${i}`}><span className="history-street">{STREETS[e.street]}</span><span className="history-player">{playerName(e.name)}</span><span className="history-action" data-kind={e.action}>{actionText(e)}</span></li>);
  return <section className="action-history" aria-label="牌局行动记录">
    <h3><History size={15} /> 行动记录 <span>{entries.length} 次行动</span></h3>
    {latest.length ? <ol>{rows(latest)}</ol> : <p className="history-empty">发牌后，所有玩家的行动会记录在这里。</p>}
    {entries.length > 4 && <details><summary>查看本手全部行动</summary><ol>{rows(entries)}</ol></details>}
  </section>;
}
