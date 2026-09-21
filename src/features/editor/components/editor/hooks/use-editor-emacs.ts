'use client';

import { useEffect, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import type { KeybindingMode } from '@/features/editor/store/settings.store';

export interface UseEditorEmacsOptions {
  editor: editor.IStandaloneCodeEditor | null;
  keybinding: KeybindingMode;
  statusNodeRef?: React.RefObject<HTMLDivElement | null>;
  onSave?: () => void;
}

export function useEditorEmacs({
  editor,
  keybinding,
  statusNodeRef,
  onSave,
}: UseEditorEmacsOptions) {
  const [isEmacsActive, setIsEmacsActive] = useState(false);
  const [emacsStatus, setEmacsStatus] = useState<string>('');
  const emacsExtensionRef = useRef<any>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    // If keybinding is not emacs or editor is not ready, dispose extension
    if (keybinding !== 'emacs' || !editor) {
      if (emacsExtensionRef.current) {
        try {
          emacsExtensionRef.current.dispose();
        } catch (err) {
          console.warn('[EmacsMode] Error disposing emacs adapter:', err);
        }
        emacsExtensionRef.current = null;
      }
      setIsEmacsActive(false);
      setEmacsStatus('');
      return;
    }

    let isCancelled = false;

    async function setupEmacs() {
      try {
        const { EmacsExtension, registerGlobalCommand } = await import(
          /* webpackIgnore: true */ 'monaco-emacs'
        );

        if (isCancelled || !editor) return;

        // Clean up previous instance if any
        if (emacsExtensionRef.current) {
          try {
            emacsExtensionRef.current.dispose();
          } catch {
            // ignore
          }
          emacsExtensionRef.current = null;
        }

        // Register custom C-x C-s command to trigger save & compile
        try {
          registerGlobalCommand('C-x C-s', {
            description: 'Save and compile document',
            run: () => {
              if (onSaveRef.current) {
                onSaveRef.current();
              }
            },
          });
        } catch {
          // ignore if already registered
        }

        const emacs = new EmacsExtension(editor);
        emacs.start();
        emacsExtensionRef.current = emacs;
        setIsEmacsActive(true);
        setEmacsStatus('Emacs mode active');

        // Listen for mark (selection) changes
        emacs.onDidMarkChange((inSelectionMode: boolean) => {
          setEmacsStatus(inSelectionMode ? 'Mark set' : 'Mark deactivated');
        });

        // Listen for multi-key prefix buffer changes (e.g. "C-x")
        emacs.onDidChangeKey((key: string) => {
          if (key) {
            setEmacsStatus(key);
          } else {
            setEmacsStatus('');
          }
        });
      } catch (err) {
        console.error('[EmacsMode] Failed to initialize monaco-emacs:', err);
        setIsEmacsActive(false);
        setEmacsStatus('');
      }
    }

    setupEmacs();

    return () => {
      isCancelled = true;
      if (emacsExtensionRef.current) {
        try {
          emacsExtensionRef.current.dispose();
        } catch (err) {
          console.warn(
            '[EmacsMode] Error disposing emacs adapter on cleanup:',
            err,
          );
        }
        emacsExtensionRef.current = null;
      }
      setIsEmacsActive(false);
      setEmacsStatus('');
    };
  }, [editor, keybinding]);

  return { isEmacsActive, emacsStatus };
}
