'use client';

import { useEffect, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import type { KeybindingMode } from '@/features/editor/store/settings.store';

export interface UseEditorVimOptions {
  editor: editor.IStandaloneCodeEditor | null;
  keybinding: KeybindingMode;
  statusNodeRef: React.RefObject<HTMLDivElement | null>;
  onSave?: () => void;
}

export function useEditorVim({
  editor,
  keybinding,
  statusNodeRef,
  onSave,
}: UseEditorVimOptions) {
  const [isVimActive, setIsVimActive] = useState(false);
  const vimAdapterRef = useRef<any>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    // If not in vim mode or editor/statusNode not ready, dispose existing adapter
    if (keybinding !== 'vim' || !editor || !statusNodeRef.current) {
      if (vimAdapterRef.current) {
        try {
          vimAdapterRef.current.dispose();
        } catch (err) {
          console.warn('[VimMode] Error disposing vim adapter:', err);
        }
        vimAdapterRef.current = null;
      }
      if (statusNodeRef.current) {
        statusNodeRef.current.innerHTML = '';
      }
      setIsVimActive(false);
      return;
    }

    let isCancelled = false;

    // Dynamically initialize monaco-vim
    async function setupVim() {
      try {
        const { initVimMode, VimMode } = await import('monaco-vim');

        if (isCancelled || !editor || !statusNodeRef.current) return;

        // Clean up previous instance if any
        if (vimAdapterRef.current) {
          try {
            vimAdapterRef.current.dispose();
          } catch {
            // ignore
          }
          vimAdapterRef.current = null;
        }

        // Initialize Vim mode with attached status node
        const adapter = initVimMode(editor, statusNodeRef.current);
        vimAdapterRef.current = adapter;
        setIsVimActive(true);

        // Register custom :w and :write Ex commands to trigger project compilation & save
        if ((VimMode as any)?.Vim?.defineEx) {
          try {
            (VimMode as any).Vim.defineEx('write', 'w', () => {
              if (onSaveRef.current) {
                onSaveRef.current();
              }
            });
          } catch {
            // defineEx may throw if already defined in the shared Vim namespace
          }
        }
      } catch (err) {
        console.error('[VimMode] Failed to initialize monaco-vim:', err);
        setIsVimActive(false);
      }
    }

    setupVim();

    return () => {
      isCancelled = true;
      if (vimAdapterRef.current) {
        try {
          vimAdapterRef.current.dispose();
        } catch (err) {
          console.warn('[VimMode] Error disposing vim adapter on cleanup:', err);
        }
        vimAdapterRef.current = null;
      }
      if (statusNodeRef.current) {
        statusNodeRef.current.innerHTML = '';
      }
      setIsVimActive(false);
    };
  }, [editor, keybinding, statusNodeRef]);

  return { isVimActive };
}
