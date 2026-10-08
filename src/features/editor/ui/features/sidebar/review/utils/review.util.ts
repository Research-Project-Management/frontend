/**
 * review.util.ts
 *
 * Utility helpers for Review sidebar:
 * - Overleaf date and relative time formatting
 * - Author display resolution (name, avatar, color)
 * - Editor & viewer line navigation
 * - DOM scroll helpers
 */

import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Format ISO timestamp to standard Overleaf display: "6 October, 7:15 pm"
 */
export function formatOverleafDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);

    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()] || '';
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;

    return `${day} ${month}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return String(iso);
  }
}

/**
 * Format relative time (e.g. "just now", "10m ago", "2h ago", "1d ago")
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const timestamp = new Date(iso).getTime();
  if (isNaN(timestamp)) return '';

  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export interface AuthorDisplayInfo {
  name: string;
  email?: string;
  avatar?: string | null;
  color: string;
}

const AUTHOR_COLORS = [
  '#0284c7', // Sky
  '#16a34a', // Emerald
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#db2777', // Pink
  '#0d9488', // Teal
  '#ca8a04', // Amber
  '#4f46e5', // Indigo
];

function getHashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

/**
 * Normalize and resolve author info from comment/suggestion and member directory
 */
export function resolveAuthorDisplay(
  rawAuthor?: { id?: string; name?: string; email?: string; avatar?: string | null; color?: string } | null,
  membersMap?: Map<string, MentionMember>,
  fallbackId?: string,
): AuthorDisplayInfo {
  const authorId = rawAuthor?.id || fallbackId;
  const matched = authorId ? membersMap?.get(authorId) : undefined;

  const name =
    matched?.name ||
    (rawAuthor?.name && rawAuthor.name !== 'Collaborator' ? rawAuthor.name : undefined) ||
    matched?.email?.split('@')[0] ||
    rawAuthor?.email?.split('@')[0] ||
    rawAuthor?.name ||
    'Collaborator';

  const avatar = matched?.avatar ?? rawAuthor?.avatar ?? null;
  const color = rawAuthor?.color || (authorId ? getHashColor(authorId) : '#0ea5e9');

  return {
    name,
    email: matched?.email || rawAuthor?.email,
    avatar,
    color,
  };
}

/**
 * Dispatches jump-to-line commands to CodeMirror editor and PDF viewer
 */
export function jumpToEditorLine(line: number): void {
  if (line <= 0) return;
  editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
  editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
}

/**
 * Robust DOM scrolling to review comment or suggestion card
 */
export function scrollToReviewItem(targetId: string, prefix: 'comment' | 'suggestion' = 'comment'): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(`${prefix}-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Retry once after a tick in case the item is still rendering
      setTimeout(() => {
        const retryEl = document.getElementById(`${prefix}-${targetId}`);
        retryEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  });
}
