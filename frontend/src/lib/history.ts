import { historyItemSchema, type HistoryItem } from './schema';
export const HISTORY_KEY = 'qa-assistant.reports.v1';
export function readHistory(): { items: HistoryItem[]; warning?: string } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) throw new Error('Invalid history');
    const items = raw
      .flatMap((item: unknown) => {
        const parsed = historyItemSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
      .slice(0, 10);
    return {
      items,
      warning:
        items.length !== Math.min(raw.length, 10)
          ? 'Some unreadable reports could not be restored.'
          : undefined,
    };
  } catch {
    return { items: [], warning: 'Local history is unavailable. Reports can still be exported.' };
  }
}
export function writeHistory(items: HistoryItem[]): boolean {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
    return true;
  } catch {
    return false;
  }
}
export function upsertReport(items: HistoryItem[], item: HistoryItem): HistoryItem[] {
  return [item, ...items.filter((entry) => entry.id !== item.id)].slice(0, 10);
}
