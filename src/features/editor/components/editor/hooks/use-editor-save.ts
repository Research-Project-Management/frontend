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
}

export function useEditorSave({ page }: UseEditorSaveOptions) {
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
  }, [debouncedPayload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compile: trigger compile after save mutation succeeds.
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

  // Switch document/page reset & flush unsaved changes for previous page
  useEffect(() => {
    const prevPage = prevPageRef.current;
    if (prevPage && prevPage.id !== page.id) {
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
    prevPageRef.current = page;
    activePageIdRef.current = page.id;
    pendingCompileRef.current = false;
    setContentPayload({
      pageId: page.id,
      text: extractStringContent(page.content),
    });
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush unsaved changes on unmount
  useEffect(() => {
    return () => {
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
  }, []);

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
