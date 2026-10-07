/**
 * useDocumentSession.ts
 *
 * Dedicated React hook bridging components with DocumentSessionCoordinator & DocumentModelManager.
 * Replaces fragmented autosave timers and manual dirty tracking with a unified session lifecycle.
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Page, PageFile } from '@/features/editor/types';
import { usePageStore, useCompileStore } from '@/features/editor/store';
import { documentModelManager } from '../models/document-model-manager';
import {
  documentSessionCoordinator,
  type DraftSnapshot,
} from './document-session-coordinator';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { editorCommandBus } from '../command-bus/editor-command-bus';
import { visibilityHibernationCoordinator } from '../coordinators/visibility-hibernation.coordinator';

export const extractStringContent = (c: any): string =>
  typeof c === 'string'
    ? c
    : c && typeof c === 'object'
      ? (c.source || c.text || c.content || '')
      : '';

export interface UseDocumentSessionOptions {
  page: Page | PageFile;
  isRealtimeActive?: boolean;
}

export function useDocumentSession({ page, isRealtimeActive = false }: UseDocumentSessionOptions) {
  const activePageRef = useRef(page);
  activePageRef.current = page;
  const activePageIdRef = useRef(page.id);

  const setCurrentPage = usePageStore((s: any) => s.setCurrentPage);
  const markDirty = useCompileStore((s: any) => s.markDirty);
  const clearDirty = useCompileStore((s: any) => s.clearDirty);

  const initialServerText = extractStringContent(page.content);
  const [currentContent, setCurrentContent] = useState<string>(initialServerText);
  const latestTextRef = useRef<string>(initialServerText);

  const [recoverableDraft, setRecoverableDraft] = useState<DraftSnapshot | null>(null);

  // 1. Initialize BeforeUnload & Tab Visibility/Hibernation protection
  useEffect(() => {
    visibilityHibernationCoordinator.init();
    return documentSessionCoordinator.initBeforeUnloadProtection();
  }, []);

  // 2. Check for offline/crash draft recovery on mount or page switch (Memory -> LocalStorage -> IndexedDB)
  useEffect(() => {
    let isMounted = true;
    const syncRecovery = documentSessionCoordinator.checkDraftRecovery(page.id, initialServerText);
    if (syncRecovery.hasRecoverableDraft && syncRecovery.draft) {
      setRecoverableDraft(syncRecovery.draft);
      return;
    }

    void documentSessionCoordinator
      .checkDraftRecoveryAsync(page.id, initialServerText)
      .then((asyncRecovery) => {
        if (!isMounted) return;
        if (asyncRecovery.hasRecoverableDraft && asyncRecovery.draft) {
          setRecoverableDraft(asyncRecovery.draft);
        } else {
          setRecoverableDraft(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [page.id, initialServerText]);

  // 3. Register with DocumentModelManager & protect from LRU eviction
  useEffect(() => {
    documentModelManager.setActiveFileId(page.id);
    const rawProjectId = (page as any)?.projectId || usePageStore.getState().projectId || undefined;
    const effectiveProjectId = typeof rawProjectId === 'string' ? rawProjectId : rawProjectId?.id;
    documentModelManager.registerModel(page.id, {
      content: initialServerText,
      filePath: page.title || (page as any).name || page.id,
      projectId: effectiveProjectId,
    });
  }, [page.id, page.title, initialServerText]);

  // 4. Handle Page Switching: flush previous dirty document before switching to new page
  useEffect(() => {
    if (activePageIdRef.current !== page.id) {
      const prevPageId = activePageIdRef.current;
      activePageIdRef.current = page.id;

      // Flush previous file if it was dirty
      if (prevPageId) {
        void documentSessionCoordinator.flushFile(prevPageId);
      }

      // Switch to new page content
      const pageText = extractStringContent(page.content);
      latestTextRef.current = pageText;
      setCurrentContent(pageText);
      useCompileStore.getState().setPendingCompile(false);
    } else {
      // Same page: remote or parent update
      const pageText = extractStringContent(page.content);
      const isDirty = documentModelManager.getModel(page.id)?.isDirty;
      if (!isDirty && pageText !== latestTextRef.current) {
        latestTextRef.current = pageText;
        setCurrentContent(pageText);
      }
    }
  }, [page.id, page.content]);

  // 5. Real-time Remote Collaborator Updates
  useEffect(() => {
    const processRemoteUpdate = (docId: string, remoteContent: string) => {
      if (!docId || docId !== page.id) return;

      const model = documentModelManager.getModel(page.id);
      const isLocallyDirty = model?.isDirty ?? false;

      if (!isLocallyDirty && typeof remoteContent === 'string') {
        latestTextRef.current = remoteContent;
        setCurrentContent(remoteContent);
        documentModelManager.updateContent(page.id, remoteContent, false);
        if (typeof setCurrentPage === 'function') {
          setCurrentPage({
            ...activePageRef.current,
            content: remoteContent,
          });
        }
      } else if (isLocallyDirty && remoteContent && remoteContent !== latestTextRef.current) {
        editorCommandBus.dispatch({
          type: 'document:conflict',
          docId: page.id,
          remoteContent,
          localContent: latestTextRef.current,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('flux:document-conflict', {
              detail: {
                docId: page.id,
                remoteContent,
                localContent: latestTextRef.current,
              },
            })
          );
        }
      }
    };

    const unsubCmd = editorCommandBus.subscribe('document:content-updated', (cmd) => {
      processRemoteUpdate(cmd.docId, cmd.content);
    });

    const handleWindowFallback = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.docId && typeof detail?.content === 'string') {
        processRemoteUpdate(detail.docId, detail.content);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('flux:doc-content-updated', handleWindowFallback);
    }

    return () => {
      unsubCmd();
      if (typeof window !== 'undefined') {
        window.removeEventListener('flux:doc-content-updated', handleWindowFallback);
      }
    };
  }, [page.id, setCurrentPage]);

  // 6. Keystroke Content Change Handler
  const handleContentChange = useCallback(
    (value: string | undefined) => {
      const text = value || '';
      const currentPage = activePageRef.current;
      if (!currentPage || !currentPage.id) return;

      const serverText = extractStringContent(currentPage.content);
      latestTextRef.current = text;

      if (text === serverText) {
        const model = documentModelManager.getModel(currentPage.id);
        if (model?.isDirty) {
          documentModelManager.markClean(currentPage.id);
          clearDirty(currentPage.id);
          documentSessionCoordinator.clearDraftSnapshot(currentPage.id);
        }
        return;
      }

      // Route change through DocumentSessionCoordinator
      documentSessionCoordinator.notifyContentChange(currentPage.id, text, { isRealtimeActive });
    },
    [clearDirty, isRealtimeActive]
  );

  // 7. Manual Flush Action (Ctrl+S / Vim :w / Compile trigger)
  const flushSave = useCallback(async (): Promise<boolean> => {
    const currentPage = activePageRef.current;
    if (!currentPage || !currentPage.id) return true;
    return await documentSessionCoordinator.flushFile(currentPage.id);
  }, []);

  // 8. Draft Recovery Actions
  const recoverDraft = useCallback(() => {
    if (recoverableDraft && recoverableDraft.content) {
      latestTextRef.current = recoverableDraft.content;
      setCurrentContent(recoverableDraft.content);
      handleContentChange(recoverableDraft.content);
      setRecoverableDraft(null);
    }
  }, [recoverableDraft, handleContentChange]);

  const discardDraft = useCallback(() => {
    if (page.id) {
      documentSessionCoordinator.clearDraftSnapshot(page.id);
      setRecoverableDraft(null);
    }
  }, [page.id]);

  // Compatibility mutation object for callers expecting useMutation interface
  const updateMutation = useMemo(
    () => ({
      mutate: (params: { pageId?: string; content: string }, opts?: any) => {
        const targetId = params?.pageId || activePageRef.current.id;
        manuscriptService.docs
          .updateContent(targetId, params.content)
          .then((res) => opts?.onSuccess?.(res))
          .catch((err) => opts?.onError?.(err));
      },
      mutateAsync: async (params: { pageId?: string; content: string }) => {
        const targetId = params?.pageId || activePageRef.current.id;
        return await manuscriptService.docs.updateContent(targetId, params.content);
      },
      isLoading: false,
      isPending: false,
    }),
    []
  );

  const contentPayload = useMemo(
    () => ({
      pageId: page.id,
      text: currentContent,
    }),
    [page.id, currentContent]
  );

  return {
    contentPayload,
    setContentPayload: () => {},
    currentContent,
    handleContentChange,
    flushSave,
    updateMutation: updateMutation as any,
    recoverableDraft,
    recoverDraft,
    discardDraft,
  };
}
