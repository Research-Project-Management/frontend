'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePageStore } from '@/features/editor/core';
import { useDocumentCollaborationStore } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { useActiveDocument } from '@/features/editor/ui/hooks/useActiveDocument';
import { filesQuery } from '@/features/editor/ui/hooks/document.queries';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { usePageComments } from './useComment';
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
} from './useSuggestion';
import { ProjectService } from '@/features/projects/shell/services/project.service';
import { editorCommandBus } from '@/features/editor/core';
import { reviewCoordinator } from '@/features/editor/subsystems/review/coordinator/review.coordinator';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { useReviewRealtimeNotifications } from './useReviewRealtimeNotifications';
import { jumpToEditorLine } from '@/features/editor/subsystems/navigation';

export type { ReviewPendingCountResult } from './useReviewPendingCount';
export { useReviewPendingCount } from './useReviewPendingCount';
export type ReviewScope = 'current' | 'overview' | 'chat';

function scrollToReviewItem(targetId: string, prefix: 'comment' | 'suggestion' = 'comment'): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(`${prefix}-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTimeout(() => {
        const retryEl = document.getElementById(`${prefix}-${targetId}`);
        retryEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
    }
  });
}

interface ProjectMemberItem {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function useReviewState() {
  const { pageId: routePageId, projectId: routeProjectId } = useParams<{ pageId: string; projectId?: string }>();
  const storeActivePageId = usePageStore((s) => s.activePageId);
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const currentPage = usePageStore((s) => s.currentPage);
  const rootPageId = routePageId || storeParentPageId || currentPage?.id;
  const pageId = storeActivePageId || currentPage?.id || rootPageId;
  const storeProjectId = usePageStore((s) => s.projectId);
  const projectId = routeProjectId || storeProjectId || extractProjectId(currentPage) || '';

  const { user } = useAuth();
  const { selectFile } = useActiveDocument();

  // Navigation Scope: 'current' | 'overview'
  const [scope, setScope] = useState<ReviewScope>('current');
  // Resolved comments toggle: default true to display all review items directly
  const [showResolved, setShowResolved] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [overviewResolvedCount, setOverviewResolvedCount] = useState(0);

  // New Comment form visibility and context
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [commentLineEnd, setCommentLineEnd] = useState<number | null>(null);

  const pendingComment = useDocumentCollaborationStore((s) => s.pendingComment);
  const clearPendingComment = useDocumentCollaborationStore((s) => s.clearPendingComment);

  // Fetch project members for author resolution and @mentions with 5-minute cache
  const { data: projectMembersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      try {
        const res = (await ProjectService.getMembers(projectId)) as {
          members?: ProjectMemberItem[];
          data?: { members?: ProjectMemberItem[] };
        } | null;
        return res?.members || res?.data?.members || [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: Boolean(projectId),
  });

  const mentionMembers = useMemo<MentionMember[]>(() => {
    const list: MentionMember[] = [];
    const seen = new Set<string>();

    if (Array.isArray(projectMembersData)) {
      for (const m of projectMembersData as ProjectMemberItem[]) {
        const id = m.userId || m.id || m.user?.id;
        const name = m.user?.name || m.name || m.user?.email?.split('@')[0] || 'Collaborator';
        if (id && !seen.has(id)) {
          seen.add(id);
          list.push({
            id,
            name,
            email: m.user?.email || m.email,
            avatar: m.user?.avatar || m.avatar,
            role: m.role,
          });
        }
      }
    }

    if (user?.id && !seen.has(user.id)) {
      seen.add(user.id);
      list.push({
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'You',
        email: user.email,
        avatar: user.avatar,
        role: 'you',
      });
    }

    return list;
  }, [projectMembersData, user]);

  const membersMap = useMemo(() => {
    const map = new Map<string, MentionMember>();
    for (const m of mentionMembers) {
      map.set(m.id, m);
    }
    return map;
  }, [mentionMembers]);

  // Real-time notifications
  useReviewRealtimeNotifications({ pageId, userId: user?.id });

  // Listen to deep-link events from CodeMirror glyphs
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('sidebar:open-panel', (cmd) => {
      setScope('current');
      if (cmd.commentId) {
        setHighlightId(cmd.commentId);
        scrollToReviewItem(cmd.commentId, 'comment');
      } else if (cmd.suggestionId) {
        setHighlightId(cmd.suggestionId);
        scrollToReviewItem(cmd.suggestionId, 'suggestion');
      }
    });

    return () => unsub();
  }, []);

  // Listen to editor text selection -> comment action
  useEffect(() => {
    if (!pendingComment) return;
    setCommentLine(pendingComment.startLine ?? null);
    setCommentLineEnd(pendingComment.endLine ?? null);
    setPendingQuote(pendingComment.selectedText || null);
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment, clearPendingComment]);

  // Queries for current document
  const {
    data: comments = [],
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    error: commentsError,
  } = usePageComments(pageId ?? null);

  const {
    data: serverSuggestions = [],
    isLoading: isSuggestionsLoading,
    isError: isSuggestionsError,
    error: suggestionsError,
  } = usePageSuggestions(pageId ?? null);

  const [localRev, setLocalRev] = useState(0);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      if (!cmd.pageId || cmd.pageId === pageId) {
        setLocalRev((r) => r + 1);
      }
    });
    return () => unsub();
  }, [pageId]);

  const suggestions = useMemo(() => {
    void localRev;
    const localList = reviewCoordinator.getLocalSuggestions(pageId);
    if (localList.length === 0) return serverSuggestions;
    const map = new Map(serverSuggestions.map((s) => [s.id, s]));
    for (const ls of localList) {
      map.set(ls.id, ls);
    }
    return Array.from(map.values());
  }, [serverSuggestions, pageId, localRev]);

  // Suggestions mutations
  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();
  const acceptAllMutation = useAcceptAllSuggestions();
  const rejectAllMutation = useRejectAllSuggestions();

  // Project files query for Overview tab
  const { data: projectFiles = [] } = useQuery(filesQuery(rootPageId || pageId || ''));
  const allProjectFiles = useMemo<Array<{ id: string; title: string }>>(() => {
    const list: Array<{ id: string; title: string }> = (projectFiles || []).map((f) => ({
      id: f.id,
      title: f.title,
    }));
    const targetRoot = rootPageId || pageId;
    if (targetRoot && !list.some((f) => f.id === targetRoot)) {
      list.unshift({ id: targetRoot, title: currentPage?.title || 'main.tex' });
    }
    return list;
  }, [projectFiles, rootPageId, pageId, currentPage]);

  // Calculations
  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted' || s.status === 'rejected'),
    [suggestions],
  );

  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);

  // Sync active suggestions and comments into CodeMirror editor decorations
  useEffect(() => {
    reviewCoordinator.syncEditorDecorations(
      null,
      suggestions,
      comments,
      trackChangesViewMode,
      Boolean(reviewMode)
    );
  }, [suggestions, comments, trackChangesViewMode, reviewMode]);

  const currentFileResolvedCount = resolvedComments.length + resolvedSuggestions.length;
  const activeResolvedCount = scope === 'current' ? currentFileResolvedCount : overviewResolvedCount;

  const visibleComments = showResolved ? comments : openComments;
  const visibleSuggestions = showResolved ? suggestions : pendingSuggestions;
  const totalVisibleItems = visibleComments.length + visibleSuggestions.length;
  const totalAllItems = comments.length + suggestions.length;

  const handleToggleResolved = useCallback(() => {
    setShowResolved((prev) => !prev);
  }, []);

  const handleNavigateToLine = useCallback((line: number) => {
    jumpToEditorLine(line);
  }, []);

  const handleNavigateToFileAndLine = useCallback((targetFileId: string, line?: number) => {
    selectFile(targetFileId);
    if (line != null) {
      setTimeout(() => {
        jumpToEditorLine(line);
      }, 100);
    }
  }, [selectFile]);

  const handleAcceptSuggestion = useCallback(
    (suggestionId: string) => {
      if (pageId) {
        if (suggestionId.startsWith('sug-local-')) {
          void reviewCoordinator.acceptSuggestion(pageId, suggestionId);
          setLocalRev((r) => r + 1);
          return;
        }
        reviewCoordinator.applySuggestionByIdLocally(suggestionId, 'accept');
        acceptMutation.mutate({ pageId, suggestionId });
      }
    },
    [pageId, acceptMutation],
  );

  const handleRejectSuggestion = useCallback(
    (suggestionId: string) => {
      if (pageId) {
        if (suggestionId.startsWith('sug-local-')) {
          void reviewCoordinator.rejectSuggestion(pageId, suggestionId);
          setLocalRev((r) => r + 1);
          return;
        }
        reviewCoordinator.applySuggestionByIdLocally(suggestionId, 'reject');
        rejectMutation.mutate({ pageId, suggestionId });
      }
    },
    [pageId, rejectMutation],
  );

  return {
    pageId,
    projectId,
    user,
    scope,
    setScope,
    showResolved,
    setShowResolved,
    handleToggleResolved,
    activeResolvedCount,
    currentFileResolvedCount,
    highlightId,
    showAddForm,
    setShowAddForm,
    pendingQuote,
    commentLine,
    commentLineEnd,
    mentionMembers,
    membersMap,
    comments,
    suggestions,
    visibleComments,
    visibleSuggestions,
    pendingSuggestions,
    totalVisibleItems,
    totalAllItems,
    allProjectFiles,
    isCommentsLoading,
    isSuggestionsLoading,
    isCommentsError,
    isSuggestionsError,
    commentsError,
    suggestionsError,
    acceptMutation,
    rejectMutation,
    acceptAllMutation,
    rejectAllMutation,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleNavigateToLine,
    handleNavigateToFileAndLine,
    setOverviewResolvedCount,
  };
}

export default useReviewState;
