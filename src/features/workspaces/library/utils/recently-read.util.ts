import type { Paper, TimeGroupedPapers } from '../types/library.types';

export type { TimeGroupedPapers };

/**
 * Groups recently accessed papers into temporal buckets (Today, Yesterday, This Week, Earlier).
 */
export function groupRecentlyReadByTime(papers: Paper[]): TimeGroupedPapers {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const result: TimeGroupedPapers = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  const getTimestamp = (paper: Paper) => {
    const p = paper as any;
    return new Date(p.accessedAt || p.lastOpenedAt || p.updatedAt || p.createdAt || 0).getTime();
  };

  const sorted = [...papers].sort((a, b) => getTimestamp(b) - getTimestamp(a));

  for (const paper of sorted) {
    const paperTime = getTimestamp(paper);
    if (paperTime >= todayStart) {
      result.today.push(paper);
    } else if (paperTime >= yesterdayStart) {
      result.yesterday.push(paper);
    } else if (paperTime >= weekStart) {
      result.thisWeek.push(paper);
    } else {
      result.earlier.push(paper);
    }
  }

  return result;
}

/**
 * Formats a timestamp into a human-friendly relative reading label.
 */
export function formatReadingSession(dateString?: string | null): string {
  if (!dateString) return 'Not opened yet';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
