'use client';

import { useState, useRef, useEffect } from 'react';
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
  const { compileRef } = usePageStore();
  const { markDirty, clearDirty } = useCompileStore();
  const { autoCompile } = useSettingsStore();
  const { updateContent: updateMutation } = usePageActions();

  const pageRef = useRef(page);
  pageRef.current = page;
  const activePageIdRef = useRef(page.id);
  const pendingCompileRef = useRef(false);

  const [contentPayload, setContentPayload] = useState<{
    pageId: string;
    text: string;
  }>({
    pageId: page.id,
    text: extractStringContent(page.content),
  });

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

  // Switch document/page reset
  useEffect(() => {
    activePageIdRef.current = page.id;
    pendingCompileRef.current = false;
    setContentPayload({
      pageId: page.id,
      text: extractStringContent(page.content),
    });
  }, [page.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = (value: string | undefined) => {
    const text = value || '';
    setContentPayload({
      pageId: pageRef.current.id,
      text,
    });
    markDirty(pageRef.current.id, text);
  };

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
