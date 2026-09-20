'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Page, PageFile } from '@/features/editor/types';
import { useCompileStore, usePageStore, useSettingsStore } from '@/features/editor/store';
import { useDebounce } from '@/shared/hooks';
import { usePageActions } from '@/features/editor/hooks/use-core';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

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

export function useEditorSave({ page, isRealtimeActive }: UseEditorSaveOptions) {
  const compileRef = usePageStore((s) => s.compileRef);
  const markDirty = useCompileStore((s) => s.markDirty);
  const clearDirty = useCompileStore((s) => s.clearDirty);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const { updateContent: updateMutation } = usePageActions();

  const pageRef = useRef(page);
  pageRef.current = page;
  const prevPageRef = useRef(page);
  const activePageIdRef = useRef(page.id);
  const updateMutationRef = useRef(updateMutation);
  updateMutationRef.current = updateMutation;

  const [contentPayload, setContentPayload] = useState<{
    pageId: string;
    text: string;
  }>({
    pageId: page.id,
    text: extractStringContent(page.content),
  });

  const latestPayloadRef = useRef(contentPayload);
  latestPayloadRef.current = contentPayload;

  const debouncedPayload = useDebounce(contentPayload, 1000);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    // Overleaf single-source-of-truth guarantee:
    // When realtime collaborative CRDT (Yjs) is active and synced, bypass HTTP PUT
    // autosave to prevent race conditions and overwriting collaborative edits.
    if (isRealtimeActive) return;

    const currentPage = pageRef.current;
    // Strictly verify debounced content matches the active page
    if (debouncedPayload.pageId !== activePageIdRef.current) return;
    if (debouncedPayload.pageId !== currentPage.id) return;

    const currentSavedText = extractStringContent(currentPage.content);
    if (debouncedPayload.text !== currentSavedText) {
      updateMutation.mutate(
        {
          pageId: currentPage.id,
          content: debouncedPayload.text,
        },
        {
          onSuccess: () => {
            const currentDirty = useCompileStore
              .getState()
              .dirtyContentMap.get(currentPage.id);
            if (currentDirty === debouncedPayload.text) {
              clearDirty(currentPage.id);
            }
          },
        },
      );
    }
  }, [debouncedPayload, isRealtimeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-Compile on Typing with 2.5s Idle Debounce (Overleaf Parity) ───────
  // Overleaf standard: 2.5s idle typing debounce before triggering compilation.
  // Unified across both standard and collaborative realtime editing modes.
  const AUTO_COMPILE_IDLE_DELAY = 2500;
  const debouncedAutoCompileText = useDebounce(contentPayload.text, AUTO_COMPILE_IDLE_DELAY);
  const lastCompiledContentRef = useRef<string>(contentPayload.text);

  // Sync lastCompiledContentRef on active page change
  useEffect(() => {
    lastCompiledContentRef.current = extractStringContent(page.content);
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync lastCompiledContentRef whenever a compilation begins anywhere
  useEffect(() => {
    return EditorEventBus.on('flux:compile-started', () => {
      lastCompiledContentRef.current = latestPayloadRef.current.text;
    });
  }, []);

  useEffect(() => {
    if (!autoCompile) return;

    // Avoid redundant compilation if content has not changed since last compile
    if (debouncedAutoCompileText === lastCompiledContentRef.current) return;

    const { compileStatus, setPendingCompile } = useCompileStore.getState();
    const isBusy =
      compileStatus === 'compiling' ||
      compileStatus === 'flushing' ||
      compileStatus === 'syncing';

    if (isBusy) {
      // Compiler is busy; queue compilation to execute once active run completes
      setPendingCompile(true);
      return;
    }

    // Trigger compilation
    lastCompiledContentRef.current = debouncedAutoCompileText;
    compileRef.current?.();
  }, [debouncedAutoCompileText, autoCompile, compileRef]);

  // Switch document/page reset & flush unsaved changes for previous page
  useEffect(() => {
    const prevPage = prevPageRef.current;
    if (prevPage && prevPage.id !== page.id) {
      if (!isRealtimeActive) {
        const latest = latestPayloadRef.current;
        if (latest && latest.pageId === prevPage.id) {
          const prevSavedText = extractStringContent(prevPage.content);
          if (latest.text !== prevSavedText) {
            updateMutationRef.current.mutate(
              {
                pageId: prevPage.id,
                content: latest.text,
              },
              {
                onSuccess: () => {
                  const currentDirty = useCompileStore
                    .getState()
                    .dirtyContentMap.get(prevPage.id);
                  if (currentDirty === latest.text) {
                    clearDirty(prevPage.id);
                  }
                },
              },
            );
          }
        }
      }
    }
    prevPageRef.current = page;
    activePageIdRef.current = page.id;
    useCompileStore.getState().setPendingCompile(false);
    const pageText = extractStringContent(page.content);
    lastCompiledContentRef.current = pageText;
    setContentPayload({
      pageId: page.id,
      text: pageText,
    });
  }, [page.id, isRealtimeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush unsaved changes on unmount (non-realtime only)
  useEffect(() => {
    return () => {
      if (isRealtimeActive) return;
      const latest = latestPayloadRef.current;
      const currentPage = pageRef.current;
      if (latest && currentPage && latest.pageId === currentPage.id) {
        const currentSavedText = extractStringContent(currentPage.content);
        if (latest.text !== currentSavedText) {
          updateMutationRef.current.mutate({
            pageId: latest.pageId,
            content: latest.text,
          });
        }
      }
    };
  }, [isRealtimeActive]);

  const handleContentChange = useCallback((value: string | undefined) => {
    const text = value || '';
    setContentPayload({
      pageId: pageRef.current.id,
      text,
    });
    markDirty(pageRef.current.id, text);
  }, [markDirty]);

  const currentContent =
    contentPayload.pageId === page.id
      ? contentPayload.text
      : extractStringContent(page.content);

  return {
    contentPayload,
    setContentPayload,
    currentContent,
    handleContentChange,
    updateMutation,
  };
}
