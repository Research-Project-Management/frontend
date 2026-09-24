/**
 * features/inbox/types/inbox.types.ts
 * Type definitions for Inbox notifications & categories (All, Project, Pages).
 */

export type NotificationType =
  | 'mention'
  | 'comment_reply'
  | 'thread_resolved'
  | 'project_invite'
  | 'review_request'
  | 'system';

export type InboxCategory = 'all' | 'project' | 'pages';

export interface NotificationMessageOpts {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  projectId?: string;
  projectName?: string;
  docId?: string;
  docName?: string;
  threadId?: string;
  commentId?: string;
  snippet?: string;
  quote?: string;
  handle?: string;
  token?: string;
  role?: string;
  inviterName?: string;
  inviterEmail?: string;
  actionUrl?: string;
  [key: string]: any;
}

export interface NotificationItem {
  id: string;
  userId: string;
  key: string | null;
  templateKey: string;
  type: NotificationType;
  projectId: string | null;
  docId: string | null;
  actorId: string | null;
  messageOpts: NotificationMessageOpts;
  isRead: boolean;
  expiresAt: string | null;
  createdAt: string;
  readAt: string | null;
}

/**
 * Determines whether a notification belongs to 'project' or 'pages' category.
 */
export function getNotificationCategory(item: NotificationItem): 'project' | 'pages' {
  if (
    item.type === 'project_invite' ||
    item.templateKey === 'project_invite' ||
    item.templateKey.startsWith('project_')
  ) {
    return 'project';
  }

  if (
    item.docId ||
    item.type === 'mention' ||
    item.type === 'comment_reply' ||
    item.type === 'thread_resolved' ||
    item.type === 'review_request' ||
    item.templateKey.includes('comment') ||
    item.templateKey.includes('mention')
  ) {
    return 'pages';
  }

  if (item.projectId && !item.docId) {
    return 'project';
  }

  return 'pages';
}
