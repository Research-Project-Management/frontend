'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Page, PageFile } from '@/features/editor/types';
import { useCompileStore, useSettingsStore, usePageStore } from '@/features/editor/store';
import { useDebounce } from '@/shared/hooks';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

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
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setCurrentPage = usePageStore((s) => s.setCurrentPage);

  const pageRef = useRef(page);
  pageRef.current = page;
  const activePageIdRef = useRef(page.id);

  const [contentPayload, setContentPayload] = useState<{
    pageId: string;
    text: string;
  }>({
    pageId: page.id,
    text: extractStringContent(page.content),
  });

  const latestPayloadRef = useRef(contentPayload);
  latestPayloadRef.current = contentPayload;

  const debouncedPayload = useDebounce(contentPayload, 800);

  // Sync to local page store when content settles
  useEffect(() => {
    const currentPage = pageRef.current;
    if (debouncedPayload.pageId !== activePageIdRef.current) return;
    if (debouncedPayload.pageId !== currentPage.id) return;

    const currentSavedText = extractStringContent(currentPage.content);
    if (debouncedPayload.text !== currentSavedText) {
      if (typeof setCurrentPage === 'function') {
        setCurrentPage({
          ...currentPage,
          content: debouncedPayload.text,
        });
      }
      clearDirty(currentPage.id);
    }
  }, [debouncedPayload, clearDirty, setCurrentPage]);

  // Auto-Compile on Typing with 2.5s Idle Debounce
  const AUTO_COMPILE_IDLE_DELAY = 2500;
  const debouncedAutoCompileText = useDebounce(contentPayload.text, AUTO_COMPILE_IDLE_DELAY);
  const lastCompiledContentRef = useRef<string>(contentPayload.text);

  useEffect(() => {
    lastCompiledContentRef.current = extractStringContent(page.content);
  }, [page.id]);

  useEffect(() => {
    return EditorEventBus.on('flux:compile-started', () => {
      lastCompiledContentRef.current = latestPayloadRef.current.text;
    });
  }, []);

  useEffect(() => {
    if (!autoCompile) return;
    if (debouncedAutoCompileText === lastCompiledContentRef.current) return;

    const { compileStatus, setPendingCompile } = useCompileStore.getState();
    const isBusy =
      compileStatus === 'compiling' ||
      compileStatus === 'flushing' ||
      compileStatus === 'syncing';

    if (isBusy) {
      setPendingCompile(true);
      return;
    }

    lastCompiledContentRef.current = debouncedAutoCompileText;
    editorCommandBus.dispatch({ type: 'compiler:trigger' });
  }, [debouncedAutoCompileText, autoCompile]);

  // Page switch handler
  useEffect(() => {
    activePageIdRef.current = page.id;
    useCompileStore.getState().setPendingCompile(false);
    const pageText = extractStringContent(page.content);
    lastCompiledContentRef.current = pageText;
    setContentPayload({
      pageId: page.id,
      text: pageText,
    });
  }, [page.id, page.content]);

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

  const mockUpdateMutation = {
    mutate: (_params: any, opts?: any) => {
      opts?.onSuccess?.();
    },
    isLoading: false,
  };

  return {
    contentPayload,
    setContentPayload,
    currentContent,
    handleContentChange,
    updateMutation: mockUpdateMutation as any,
  };
}
