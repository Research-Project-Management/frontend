/**
 * history.util.ts
 *
 * Formatting and helper utilities for project revision history & snapshots.
 * Location: `features/editor/ui/modals/project-history/history.util.ts`
 */

export function formatVersionTime(dateStr?: string | null): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Recently';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return 'Recently';
  }
}
