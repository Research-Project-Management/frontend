'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  editorCommandBus,
  useDocumentCollaborationStore,
  usePageStore,
  useSettingsStore,
} from '@/features/editor/core';
import { useActiveDocument } from '@/features/editor/core/queries/useActiveDocument';
import { filesQuery } from '@/features/editor/core/queries/document.queries';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ProjectService } from '@/features/projects/shell/services/project.service';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { jumpToEditorLine } from '@/features/editor/subsystems/navigation';
import { reviewCoordinator } from '../../coordinator/review.coordinator';
import type { ReviewScope } from '../subcomponents/Nav';
import { usePageComments } from './useComments';
import {
  useAcceptAllSuggestions,
  useAcceptSuggestion,
  usePageSuggestions,
  useRejectAllSuggestions,
  useRejectSuggestion,
} from './useSuggestions';

export type { ReviewPendingCountResult } from './usePendingCount';
export { useReviewPendingCount } from './usePendingCount';
export type { ReviewScope };

const EMPTY_ARRAY: never[] = [];

function scrollToReviewItem(
  targetId: string,
  prefix: 'comment' | 'suggestion' = 'comment',
  timerRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
): void {
  requestAnimationFrame(() => {
    const el = document.getElementById(`${prefix}-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      if (timerRef?.current) clearTimeout(timerRef.current);
      const timer = setTimeout(() => {
        if (timerRef) timerRef.current = null;
        document.getElementById(`${prefix}-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      if (timerRef) timerRef.current = timer;
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
  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageTitle = usePageStore((s) => s.currentPage?.title);
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage));
  const rootPageId = routePageId || storeParentPageId || currentPageId;
  const pageId = storeActivePageId || currentPageId || rootPageId;
  const storeProjectId = usePageStore((s) => s.spaceId || s.projectId);
  const projectId = routeProjectId || storeProjectId || currentPageProjectId || '';

  const { user } = useAuth();
  const { selectFile } = useActiveDocument();

  const [scope, setScope] = useState<ReviewScope>('current');
  const [showResolved, setShowResolved] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [overviewResolvedCount, setOverviewResolvedCount] = useState(0);

  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);
  const [commentLine, setCommentLine] = useState<number | null>(null);
  const [commentLineEnd, setCommentLineEnd] = useState<number | null>(null);

  const pendingComment = useDocumentCollaborationStore((s) => s.pendingComment);
  const clearPendingComment = useDocumentCollaborationStore((s) => s.clearPendingComment);

  const { data: projectMembersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'personal') return [];
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
    enabled: Boolean(projectId && projectId !== 'personal' && projectId !== pageId),
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

  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navLineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scrollRetryTimer = scrollRetryTimerRef;
    const navLineTimer = navLineTimerRef;
    return () => {
      if (scrollRetryTimer.current) clearTimeout(scrollRetryTimer.current);
      if (navLineTimer.current) clearTimeout(navLineTimer.current);
    };
  }, []);

  useEffect(() => {
    const unsub = editorCommandBus.subscribe('sidebar:open-panel', (cmd) => {
      setScope('current');
      if (cmd.commentId) {
        setHighlightId(cmd.commentId);
        scrollToReviewItem(cmd.commentId, 'comment', scrollRetryTimerRef);
      } else if (cmd.suggestionId) {
        setHighlightId(cmd.suggestionId);
        scrollToReviewItem(cmd.suggestionId, 'suggestion', scrollRetryTimerRef);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!pendingComment) return;
    setCommentLine(pendingComment.startLine ?? null);
    setCommentLineEnd(pendingComment.endLine ?? null);
    setPendingQuote(pendingComment.selectedText || null);
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment, clearPendingComment]);

  const {
    data: commentsData,
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    error: commentsError,
  } = usePageComments(pageId ?? null);
  const comments = commentsData ?? EMPTY_ARRAY;

  const {
    data: serverSuggestionsData,
    isLoading: isSuggestionsLoading,
    isError: isSuggestionsError,
    error: suggestionsError,
  } = usePageSuggestions(pageId ?? null);
  const serverSuggestions = serverSuggestionsData ?? EMPTY_ARRAY;

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

  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();
  const acceptAllMutation = useAcceptAllSuggestions();
  const rejectAllMutation = useRejectAllSuggestions();

  const { data: projectFilesData } = useQuery(filesQuery(rootPageId || pageId || ''));
  const projectFiles = projectFilesData ?? EMPTY_ARRAY;
  const allProjectFiles = useMemo<Array<{ id: string; title: string }>>(() => {
    const list: Array<{ id: string; title: string }> = (projectFiles || []).map((f) => ({
      id: f.id,
      title: f.title,
    }));
    const targetRoot = rootPageId || pageId;
    if (targetRoot && !list.some((f) => f.id === targetRoot)) {
      list.unshift({ id: targetRoot, title: currentPageTitle || 'main.tex' });
    }
    return list;
  }, [projectFiles, rootPageId, pageId, currentPageTitle]);

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted' || s.status === 'rejected'),
    [suggestions],
  );

  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);

  useEffect(() => {
    reviewCoordinator.syncEditorDecorations(
      null,
      suggestions,
      comments,
      trackChangesViewMode,
      Boolean(reviewMode),
      pageId,
    );
  }, [suggestions, comments, trackChangesViewMode, reviewMode, pageId]);

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

  const handleNavigateToFileAndLine = useCallback(
    (targetFileId: string, line?: number) => {
      selectFile(targetFileId);
      if (line != null) {
        if (navLineTimerRef.current) clearTimeout(navLineTimerRef.current);
        navLineTimerRef.current = setTimeout(() => {
          navLineTimerRef.current = null;
          jumpToEditorLine(line);
        }, 100);
      }
    },
    [selectFile],
  );

  const handleAcceptSuggestion = useCallback(
    (suggestionId: string) => {
      if (pageId) {
        if (suggestionId.startsWith('sug-local-')) {
          void reviewCoordinator.acceptSuggestion(pageId, suggestionId);
          setLocalRev((r) => r + 1);
          return;
        }
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
