'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Page, PageFile } from '@/features/editor/types';
import { useCompileStore, useSettingsStore, usePageStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

import { manuscriptService } from '@/features/editor/services/manuscript.service';

export const extractStringContent = (c: any): string =>
  typeof c === 'string'
    ? c
    : c && typeof c === 'object'
      ? (c.source || c.text || c.content || '')
      : '';

export interface UseEditorSaveOptions {
  page: Page | PageFile;
  isRealtimeActive?: boolean;
}

export function useEditorSave({ page }: UseEditorSaveOptions) {
  const markDirty = useCompileStore((s) => s.markDirty);
  const clearDirty = useCompileStore((s) => s.clearDirty);
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);

  const pageRef = useRef(page);
  pageRef.current = page;
  const activePageIdRef = useRef(page.id);

  const initialText = extractStringContent(page.content);
  const [currentContent, setCurrentContent] = useState<string>(initialText);

  const latestTextRef = useRef<string>(initialText);
  const isDirtyRef = useRef(false);
  const lastCompiledContentRef = useRef<string>(initialText);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const compileTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Flush pending save immediately to store and backend
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const currentPage = pageRef.current;
    const targetText = latestTextRef.current;
    const savedText = extractStringContent(currentPage.content);
    if (targetText !== savedText) {
      if (typeof setCurrentPage === 'function') {
        setCurrentPage({
          ...currentPage,
          content: targetText,
        });
      }
      clearDirty(currentPage.id);
      isDirtyRef.current = false;
      manuscriptService.docs
        .updateContent(currentPage.id, targetText)
        .catch((err) => {
          console.error('[useEditorSave] Flush-save failed:', err);
        });
    }
  }, [clearDirty, setCurrentPage]);

  // Synchronous compile listener: flushes pending text before compilation starts
  useEffect(() => {
    return EditorEventBus.on('flux:compile-started', () => {
      flushSave();
      lastCompiledContentRef.current = latestTextRef.current;
    });
  }, [flushSave]);

  // Page switch & external doc synchronization
  useEffect(() => {
    if (activePageIdRef.current !== page.id) {
      flushSave();
      if (compileTimerRef.current) {
        clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
      activePageIdRef.current = page.id;
      const pageText = extractStringContent(page.content);
      latestTextRef.current = pageText;
      lastCompiledContentRef.current = pageText;
      isDirtyRef.current = false;
      setCurrentContent(pageText);
      useCompileStore.getState().setPendingCompile(false);
    } else {
      // Same page: external content update (e.g. data reloaded)
      const pageText = extractStringContent(page.content);
      if (!isDirtyRef.current && pageText !== latestTextRef.current) {
        latestTextRef.current = pageText;
        lastCompiledContentRef.current = pageText;
        setCurrentContent(pageText);
      }
    }
  }, [page.id, page.content, flushSave]);

  // Real-time remote document updates from collaborating peers
  useEffect(() => {
    const handleRemoteUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (!detail || detail.docId !== page.id) return;

      const currentPage = pageRef.current;
      const currentSavedText = extractStringContent(currentPage.content);
      const isLocallyDirty = isDirtyRef.current || (latestTextRef.current !== currentSavedText);

      // If local user has no unsaved keystrokes, update safely to collaborator's version
      if (!isLocallyDirty && typeof detail.content === 'string') {
        latestTextRef.current = detail.content;
        lastCompiledContentRef.current = detail.content;
        setCurrentContent(detail.content);
        if (typeof setCurrentPage === 'function') {
          setCurrentPage({
            ...currentPage,
            content: detail.content,
          });
        }
      } else if (isLocallyDirty && detail.content && detail.content !== latestTextRef.current) {
        // Broadcast non-destructive collision alert so user can choose to merge or overwrite
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('flux:document-conflict', {
              detail: {
                docId: page.id,
                remoteContent: detail.content,
                localContent: latestTextRef.current,
              },
            }),
          );
        }
      }
    };

    window.addEventListener('flux:doc-content-updated', handleRemoteUpdate);
    return () => {
      window.removeEventListener('flux:doc-content-updated', handleRemoteUpdate);
    };
  }, [page.id, setCurrentPage]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (compileTimerRef.current) {
        clearTimeout(compileTimerRef.current);
        compileTimerRef.current = null;
      }
    };
  }, []);

  // Per-keystroke handler: 0ms main thread delay, NO React re-renders during typing
  const handleContentChange = useCallback((value: string | undefined) => {
    const text = value || '';
    latestTextRef.current = text;
    isDirtyRef.current = true;
    markDirty(pageRef.current.id, text);

    // 1. Debounced Auto-save (800ms idle)
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const currentPage = pageRef.current;
      const targetText = latestTextRef.current;
      const savedText = extractStringContent(currentPage.content);
      if (targetText !== savedText) {
        if (typeof setCurrentPage === 'function') {
          setCurrentPage({
            ...currentPage,
            content: targetText,
          });
        }
        clearDirty(currentPage.id);
        isDirtyRef.current = false;
        manuscriptService.docs
          .updateContent(currentPage.id, targetText)
          .catch((err) => {
            console.error('[useEditorSave] Auto-save failed:', err);
          });
      } else {
        clearDirty(currentPage.id);
        isDirtyRef.current = false;
      }
    }, 800);

    // 2. Debounced Auto-compile (2500ms idle, Overleaf pattern)
    if (compileTimerRef.current) {
      clearTimeout(compileTimerRef.current);
    }
    compileTimerRef.current = setTimeout(() => {
      compileTimerRef.current = null;
      if (!useSettingsStore.getState().autoCompile) return;
      const targetText = latestTextRef.current;
      if (targetText === lastCompiledContentRef.current) return;

      const { compileStatus, setPendingCompile } = useCompileStore.getState();
      const isBusy =
        compileStatus === 'compiling' ||
        compileStatus === 'flushing' ||
        compileStatus === 'syncing';

      if (isBusy) {
        setPendingCompile(true);
        return;
      }

      lastCompiledContentRef.current = targetText;
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
    }, 2500);
  }, [markDirty, clearDirty, setCurrentPage]);

  const contentPayload = useMemo(
    () => ({
      pageId: page.id,
      text: currentContent,
    }),
    [page.id, currentContent]
  );

  const updateMutation = {
    mutate: (params: { pageId?: string; content: string }, opts?: any) => {
      const targetId = params?.pageId || pageRef.current.id;
      manuscriptService.docs
        .updateContent(targetId, params.content)
        .then((res) => opts?.onSuccess?.(res))
        .catch((err) => opts?.onError?.(err));
    },
    mutateAsync: async (params: { pageId?: string; content: string }) => {
      const targetId = params?.pageId || pageRef.current.id;
      return await manuscriptService.docs.updateContent(targetId, params.content);
    },
    isLoading: false,
    isPending: false,
  };

  return {
    contentPayload,
    setContentPayload: () => {},
    currentContent,
    handleContentChange,
    flushSave,
    updateMutation: updateMutation as any,
  };
}
