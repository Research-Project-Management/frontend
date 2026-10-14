import type React from 'react';

export type ActivityEntry = {
  id: string;
  author: string;
  authorInitials: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: string;
  createdAt?: number;
  kind?: 'comment' | 'system' | 'activity';
  reactionEmoji?: string;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};

export type ActivitiesProps = {
  commentText: string;
  setCommentText: (text: string) => void;
  commentTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSaveComment: (content: string) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  attachmentLinks?: Array<{ name: string; url: string }>;
  commentFocusToken?: number;
  commentCaretPosition?: number;
  onCommentCaretChange?: (position: number) => void;
  canComment?: boolean;
  isSavingComment?: boolean;
  isUpdatingComment?: boolean;
  showDetailActivity: boolean;
  setShowDetailActivity: (show: boolean | ((prev: boolean) => boolean)) => void;
  activityLoading?: boolean;
  activityError?: boolean;
  activities: ActivityEntry[];
  isReadOnly?: boolean;
};

export type ActivityTab = 'all' | 'activity' | 'comments' | 'history';
