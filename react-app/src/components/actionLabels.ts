import type { ActionLogEntry } from '../engine/types';

export const ACTION_NAMES: Record<string,string> = { sb:'小盲', bb:'大盲', fold:'弃牌', check:'过牌', call:'跟注', bet:'下注', raise:'加注', return:'退回' };
export const STREETS = ['翻前','翻牌','转牌','河牌','摊牌'];
export function actionText(entry: ActionLogEntry) {
  const label = (entry.allIn ? '全下 · ' : '')+(ACTION_NAMES[entry.action] || entry.action);
  const note=entry.allIn&&entry.fullRaise===false&&(entry.action==='raise'||entry.action==='bet')?'（不足额）':'';
  if (entry.action === 'raise') return `${label}至 ${entry.totalBet ?? entry.amount}${note}`;
  return entry.amount > 0 ? `${label} ${entry.amount}` : label;
}
export function playerName(name: string) { return name.replace('Robot ', '对手 '); }
