'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { fluxTransport, normalizeSpaceId } from '../transport/flux';
import {
  deleteSession,
  fetchSessions,
  renameSession,
} from '../transport/sessions';
import {
  deleteDocument,
  fetchDocumentContent,
  fetchDocuments,
} from '../transport/docs';
import type { ChatSession, DocumentItem } from '../types/session';

const DEFAULT_SCOPE = 'personal';

function keyScope(spaceId?: string | null): string {
  return normalizeSpaceId(spaceId) ?? DEFAULT_SCOPE;
}

export const aiKeys = {
  all: ['ai'] as const,
  sessions: (spaceId?: string | null) =>
    [...aiKeys.all, 'sessions', keyScope(spaceId)] as const,
  session: (chatId: string) => [...aiKeys.all, 'session', chatId] as const,
  pageChat: (pageId: string) => [...aiKeys.all, 'page-chat', pageId] as const,
  documents: (spaceId?: string | null) =>
    [...aiKeys.all, 'documents', keyScope(spaceId)] as const,
  documentContent: (docId: string, spaceId?: string | null) =>
    [...aiKeys.documents(spaceId), 'content', docId] as const,
};

export function invalidateAiSessions(
  queryClient: QueryClient,
  spaceId?: string | null,
): void {
  void queryClient.invalidateQueries({ queryKey: [...aiKeys.all, 'sessions'] });
  if (spaceId) {
    void queryClient.invalidateQueries({
      queryKey: aiKeys.sessions(spaceId),
    });
  }
}

export function useAiSessions(spaceId?: string | null) {
  const normalized = normalizeSpaceId(spaceId) ?? null;
  return useQuery<ChatSession[]>({
    queryKey: aiKeys.sessions(normalized),
    queryFn: () => fetchSessions(normalized),
    staleTime: 30_000,
  });
}

export function useRenameAiSession(spaceId?: string | null) {
  const queryClient = useQueryClient();
  const normalized = normalizeSpaceId(spaceId) ?? null;

  return useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
      renameSession(chatId, title),
    onSuccess: (updated, vars) => {
      queryClient.setQueryData<ChatSession[]>(
        aiKeys.sessions(normalized),
        (prev) =>
          prev
            ? prev.map((c) =>
                c.id === vars.chatId
                  ? { ...c, title: updated.title || vars.title }
                  : c,
              )
            : prev,
      );
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.all, 'sessions'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to rename chat');
    },
  });
}

export function useDeleteAiSession(spaceId?: string | null) {
  const queryClient = useQueryClient();
  const normalized = normalizeSpaceId(spaceId) ?? null;

  return useMutation({
    mutationFn: (chatId: string) => deleteSession(chatId),
    onSuccess: (_res, chatId) => {
      queryClient.setQueryData<ChatSession[]>(
        aiKeys.sessions(normalized),
        (prev) => (prev ? prev.filter((c) => c.id !== chatId) : prev),
      );
      void queryClient.invalidateQueries({ queryKey: [...aiKeys.all, 'sessions'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete chat');
    },
  });
}

export function useAiDocuments(spaceId?: string | null, enabled = true) {
  const normalized = normalizeSpaceId(spaceId) ?? null;
  return useQuery<DocumentItem[]>({
    queryKey: aiKeys.documents(normalized),
    queryFn: () => fetchDocuments(normalized ?? undefined),
    enabled,
    staleTime: 30_000,
  });
}

export function useAiDocumentContent(
  docId: string | null,
  spaceId?: string | null,
) {
  const normalized = normalizeSpaceId(spaceId) ?? null;
  return useQuery<{ text: string }>({
    queryKey: aiKeys.documentContent(docId ?? '', normalized),
    queryFn: () => {
      if (!docId) {
        return Promise.resolve({ text: '' });
      }
      return fetchDocumentContent(docId, normalized);
    },
    enabled: Boolean(docId),
    staleTime: 5 * 60_000,
  });
}

export function useDeleteAiDocument(spaceId?: string | null) {
  const queryClient = useQueryClient();
  const normalized = normalizeSpaceId(spaceId) ?? null;

  return useMutation({
    mutationFn: (docId: string) => deleteDocument(docId, normalized),
    onSuccess: (_res, docId) => {
      queryClient.setQueryData<DocumentItem[]>(
        aiKeys.documents(normalized),
        (prev) => (prev ? prev.filter((d) => d.id !== docId) : prev),
      );
      void queryClient.invalidateQueries({
        queryKey: aiKeys.documents(normalized),
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete document',
      );
    },
  });
}

/** Revert all reversible AI mutations recorded for a specific turn trace ID. */
export async function revertAiTurn(traceId: string, spaceId?: string | null) {
  return fluxTransport.revertTurn(traceId, normalizeSpaceId(spaceId) ?? undefined);
}
