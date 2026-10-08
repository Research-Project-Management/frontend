/**
 * notification-digest.util.ts
 *
 * Types and utilities for Overleaf-style 10-minute review notification bundling.
 * Provides client-side aggregation, countdown formatting, and digest helpers.
 */

export type BundledNotificationEventType =
  | 'mention'
  | 'comment'
  | 'reply'
  | 'suggestion';

export interface BundledNotificationItem {
  id: string;
  type: BundledNotificationEventType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  pageId: string;
  pageTitle?: string;
  projectId?: string;
  targetId?: string;
  contentSnippet: string;
  line?: number;
  timestamp: string;
}

export interface NotificationBundle {
  recipientId: string;
  projectId?: string;
  pageId?: string;
  items: BundledNotificationItem[];
  createdAt: string;
  flushAt: string;
}

export interface PendingBundleInfo {
  bundle: NotificationBundle;
  itemCount: number;
  remainingSeconds: number;
}

export interface NotificationDigestAuthorSummary {
  authorId: string;
  authorName: string;
  mentionCount: number;
  commentCount: number;
  replyCount: number;
  suggestionCount: number;
}

export interface NotificationDigest {
  id: string;
  recipientId: string;
  projectId?: string;
  summary: string;
  itemCount: number;
  mentionCount: number;
  commentCount: number;
  replyCount: number;
  suggestionCount: number;
  authorSummaries: NotificationDigestAuthorSummary[];
  items: BundledNotificationItem[];
  createdAt: string;
  windowMinutes: number;
}

export interface NotificationBundlingSettings {
  enabled: boolean;
  windowMinutes: number;
}

export const DEFAULT_BUNDLING_SETTINGS: NotificationBundlingSettings = {
  enabled: true,
  windowMinutes: 10,
};

/**
 * Format remaining seconds into a concise human-readable countdown string.
 * Examples: 600 -> "10m", 125 -> "2m 5s", 45 -> "45s", 0 -> "flushing..."
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'flushing...';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Format digest badge text showing pending review updates and time remaining before flush.
 * Examples: "3 review updates (flushing in 8m)"
 */
export function formatDigestBadgeText(
  itemCount: number,
  remainingSeconds: number,
): string {
  const itemText = itemCount === 1 ? '1 update' : `${itemCount} updates`;
  const timeText = formatRemainingTime(remainingSeconds);
  return `${itemText} (flushing in ${timeText})`;
}
