'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Page, PageFile } from '@/features/editor/types';
import { useCompileStore, usePageStore, useSettingsStore } from '@/features/editor/store';
import { useDebounce } from '@/shared/hooks';
import { usePageActions } from '@/features/editor/hooks/use-core';

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
  const pendingCompileRef = useRef(false);
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
      if (autoCompile) pendingCompileRef.current = true;
    }
  }, [debouncedPayload, isRealtimeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compile: trigger compile after save mutation succeeds (non-realtime mode).
  useEffect(() => {
    const { compileStatus } = useCompileStore.getState();
    if (!autoCompile || compileStatus !== 'idle') return;
    if (
      updateMutation.isSuccess &&
      !updateMutation.isPending &&
      pendingCompileRef.current
    ) {
      pendingCompileRef.current = false;
      const timer = setTimeout(() => {
        compileRef.current?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [updateMutation.isSuccess, updateMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compile in Realtime CRDT mode (Overleaf-style):
  // Since HTTP PUT is bypassed when isRealtimeActive, trigger auto-compile after 1.5s idle typing
  const debouncedRealtimeContent = useDebounce(contentPayload.text, 1500);
  const lastCompiledContentRef = useRef<string>(contentPayload.text);

  useEffect(() => {
    if (!isRealtimeActive || !autoCompile) return;
    const { compileStatus } = useCompileStore.getState();
    if (compileStatus !== 'idle') return;

    if (debouncedRealtimeContent !== lastCompiledContentRef.current) {
      lastCompiledContentRef.current = debouncedRealtimeContent;
      compileRef.current?.();
    }
  }, [debouncedRealtimeContent, isRealtimeActive, autoCompile]);

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
    pendingCompileRef.current = false;
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
