'use client';

/**
 * useReviewSync.ts
 *
 * Single authoritative hook synchronizing TanStack review queries -> CodeMirror decorations
 * and invalidating targeted query keys on `editor:review-event`.
 */

import { useContext, useEffect, useMemo } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { EditorView } from '@codemirror/view';
import { editorCommandBus, useSettingsStore } from '@/features/editor/core';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import type { QueryClient } from '@tanstack/react-query';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import { reviewCoordinator } from '../coordinator/review.coordinator';
import { usePageComments } from './useComments';
import { usePageSuggestions } from './useSuggestions';

const EMPTY_SUGGESTIONS: never[] = [];
const EMPTY_COMMENTS: never[] = [];

interface CommentEventPayload {
  comment?: PageComment;
  commentId?: string;
}

interface SuggestionEventPayload {
  suggestion?: PageSuggestion;
  change?: PageSuggestion;
  changeIds?: string[];
  action?: SuggestionStatus;
}

interface CommentPage {
  comments: PageComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface InfiniteCommentPages {
  pages: CommentPage[];
  pageParams: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isInfiniteCommentsData(value: unknown): value is InfiniteCommentPages {
  const rec = asRecord(value);
  return Boolean(rec && Array.isArray(rec.pages) && Array.isArray(rec.pageParams));
}

function patchInfiniteCommentPages(
  data: InfiniteCommentPages,
  statusFilter: string | undefined,
  action: { type: 'delete'; id: string } | { type: 'upsert'; comment: PageComment },
): InfiniteCommentPages {
  if (action.type === 'delete') {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        comments: page.comments.filter((c) => c.id !== action.id),
      })),
    };
  }

  const { comment } = action;
  const matchesFilter = !statusFilter || comment.status === statusFilter;
  if (!matchesFilter) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        comments: page.comments.filter((c) => c.id !== comment.id),
      })),
    };
  }

  let found = false;
  const updatedPages = data.pages.map((page) => {
    if (!page.comments.some((c) => c.id === comment.id)) return page;
    found = true;
    return {
      ...page,
      comments: page.comments.map((c) => (c.id === comment.id ? comment : c)),
    };
  });

  if (found || updatedPages.length === 0) {
    return { ...data, pages: updatedPages };
  }

  // Prepend newly matching comment (e.g., newly resolved) to the first page
  const [firstPage, ...restPages] = updatedPages;
  return {
    ...data,
    pages: [
      { ...firstPage, comments: [comment, ...firstPage.comments] },
      ...restPages,
    ],
  };
}

function applyCommentDelta(
  client: QueryClient,
  docId: string,
  event: string,
  rawPayload: unknown,
): boolean {
  const payload = asRecord(rawPayload) as CommentEventPayload | null;
  if (!payload) return false;

  const queries = client.getQueriesData<unknown>({ queryKey: ['page-comments', docId] });
  if (queries.length === 0) return false;

  if (event === 'comment:deleted' && typeof payload.commentId === 'string') {
    const targetId = payload.commentId;
    for (const [queryKey, old] of queries) {
      if (Array.isArray(old)) {
        client.setQueryData<PageComment[]>(
          queryKey,
          old.filter((c: PageComment) => c.id !== targetId),
        );
      } else if (isInfiniteCommentsData(old)) {
        client.setQueryData<InfiniteCommentPages>(
          queryKey,
          patchInfiniteCommentPages(old, queryKey[2] as string | undefined, {
            type: 'delete',
            id: targetId,
          }),
        );
      }
    }
    return true;
  }

  const incoming = payload.comment;
  if (!incoming || typeof incoming.id !== 'string') return false;

  for (const [queryKey, old] of queries) {
    const statusFilter = queryKey[2] as string | undefined;
    if (Array.isArray(old)) {
      const list = old as PageComment[];
      const matchesFilter = !statusFilter || incoming.status === statusFilter;
      const exists = list.some((c) => c.id === incoming.id);

      let next: PageComment[];
      if (!matchesFilter) {
        next = list.filter((c) => c.id !== incoming.id);
      } else if (exists) {
        next = list.map((c) => (c.id === incoming.id ? incoming : c));
      } else {
        next = [...list, incoming];
      }
      client.setQueryData(queryKey, next);
    } else if (isInfiniteCommentsData(old)) {
      client.setQueryData<InfiniteCommentPages>(
        queryKey,
        patchInfiniteCommentPages(old, statusFilter, {
          type: 'upsert',
          comment: incoming,
        }),
      );
    }
  }
  return true;
}

function applySuggestionDelta(
  client: QueryClient,
  docId: string,
  event: string,
  rawPayload: unknown,
): boolean {
  const payload = asRecord(rawPayload) as SuggestionEventPayload | null;
  if (!payload) return false;

  const queries = client.getQueriesData<PageSuggestion[]>({ queryKey: ['page-suggestions', docId] });
  if (queries.length === 0) return false;

  if (
    (event === 'track-changes:created' || event === 'suggestion:created') &&
    payload.suggestion &&
    typeof payload.suggestion.id === 'string'
  ) {
    const incoming = payload.suggestion;
    for (const [queryKey, old] of queries) {
      if (!old) continue;
      const statusFilter = queryKey[2] as string | undefined;
      if (statusFilter && incoming.status !== statusFilter) continue;
      const exists = old.some((s) => s.id === incoming.id);
      const next = exists
        ? old.map((s) => (s.id === incoming.id ? incoming : s))
        : [...old, incoming];
      client.setQueryData(queryKey, next);
    }
    return true;
  }

  if (event === 'track-changes:resolved' || event === 'suggestion:resolved') {
    const resolvedIds = new Set<string>();
    if (Array.isArray(payload.changeIds)) {
      for (const id of payload.changeIds) {
        if (typeof id === 'string') resolvedIds.add(id);
      }
    }
    if (payload.change && typeof payload.change.id === 'string') {
      resolvedIds.add(payload.change.id);
    }
    const nextStatus = payload.action ?? payload.change?.status;
    if (resolvedIds.size === 0 || !nextStatus) return false;

    for (const [queryKey, old] of queries) {
      if (!old) continue;
      const statusFilter = queryKey[2] as string | undefined;
      const updated = old.map((s) =>
        resolvedIds.has(s.id)
          ? payload.change && payload.change.id === s.id
            ? payload.change
            : { ...s, status: nextStatus }
          : s,
      );
      const next = statusFilter ? updated.filter((s) => s.status === statusFilter) : updated;
      client.setQueryData(queryKey, next);
    }
    return true;
  }

  return false;
}

export function useReviewSync(
  docId: string | null | undefined,
  view: EditorView | null,
): void {
  const contextClient = useContext(QueryClientContext);
  const effectiveClient = useSafeQueryClient();

  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const activeDraftComment = useDocumentCollaborationStore((s) => s.activeDraftComment);

  const { data: suggestionsData } = usePageSuggestions(docId ?? null, undefined, effectiveClient);
  const { data: commentsData } = usePageComments(docId ?? null, undefined, effectiveClient);
  const suggestions = suggestionsData ?? EMPTY_SUGGESTIONS;
  const comments = commentsData ?? EMPTY_COMMENTS;

  const effectiveComments = useMemo<PageComment[]>(() => {
    if (!docId || !activeDraftComment) return comments;
    const draftComment: PageComment = {
      id: '__draft-comment__',
      page: docId,
      projectPageId: docId,
      author: { id: '', name: '' },
      content: '',
      status: 'open',
      line: activeDraftComment.startLine,
      lineEnd: activeDraftComment.endLine,
      replies: [],
      createdAt: '',
      updatedAt: '',
    };
    return [...comments, draftComment];
  }, [comments, docId, activeDraftComment]);

  useEffect(() => {
    if (!docId || !view) return;
    reviewCoordinator.syncEditorDecorations(
      view,
      suggestions,
      effectiveComments,
      trackChangesViewMode,
      Boolean(reviewMode),
      docId,
    );
  }, [docId, view, suggestions, effectiveComments, trackChangesViewMode, reviewMode]);

  useEffect(() => {
    if (!docId || !contextClient) return;

    const unsub = editorCommandBus.subscribe(
      'editor:review-event',
      ({ pageId: evtDocId, event, payload }) => {
        if (event === 'suggestion:local-recorded') return;
        if (evtDocId && evtDocId !== docId) return;

        if (event.startsWith('comment:') || event.startsWith('comments:')) {
          const patched = applyCommentDelta(contextClient, docId, event, payload);
          if (!patched) {
            void contextClient.invalidateQueries({ queryKey: ['page-comments', docId] });
          }
          void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        } else if (
          event.startsWith('suggestion:') ||
          event.startsWith('suggestions:') ||
          event.startsWith('track-changes:')
        ) {
          const patched = applySuggestionDelta(contextClient, docId, event, payload);
          if (!patched) {
            void contextClient.invalidateQueries({ queryKey: ['page-suggestions', docId] });
            void contextClient.invalidateQueries({ queryKey: ['pages', 'detail', docId] });
          }
          void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        } else if (event === 'review:status-changed') {
          void contextClient.invalidateQueries({ queryKey: ['manuscript-review-status'] });
          void contextClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        }
      },
    );

    return () => unsub();
  }, [docId, contextClient]);
}

export default useReviewSync;
