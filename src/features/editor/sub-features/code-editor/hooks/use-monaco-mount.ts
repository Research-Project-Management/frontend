'use client';

/**
 * use-monaco-mount.ts
 *
 * Dedicated hook configuring Monaco editor instance upon mount (Overleaf parity):
 * - Keybindings & commands (Ctrl+Enter, F2, Ctrl+Shift+F, Ctrl+Shift+K, Ctrl+K, Ctrl+Alt+J, etc.)
 * - SyncTeX forward & backward hooks
 * - Decoration and cursor presence listeners
 * - Track changes (Review Mode) keystroke interceptor
 * - Floating selection action bar & Context menu trigger
 */

import { useRef, useEffect } from 'react';
import type { OnMount } from '@monaco-editor/react';
import type * as monacoType from 'monaco-editor';
import { toast } from 'sonner';
import { useSettingsStore, useActionsStore } from '../../../store';
import { EditorEventBus } from '../../../utils/editor.util';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import {
  registerLatexSnippets,
  registerLatexLinkedEditing,
} from '../../../components/editor/latex-snippets.provider';
import { registerLatexLinter } from '../../../components/editor/latex-linter.provider';
import { registerMathHoverPreview } from '../../../components/editor/math-hover.provider';
import { registerLabelCompletion } from '../../../components/editor/label-completion.provider';
import { registerFilePathCompletion } from '../../../components/editor/file-completion.provider';

export interface UseMonacoMountOptions {
  editorRef: React.MutableRefObject<monacoType.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<typeof monacoType | null>;
  setEditorMounted: (mounted: boolean) => void;
  pageFilesRef: React.MutableRefObject<any[]>;
  registerCitationProvider: (monaco: typeof monacoType) => monacoType.IDisposable;
  bindDecorationListeners: (editor: monacoType.editor.IStandaloneCodeEditor, monaco: typeof monacoType) => monacoType.IDisposable;
  bindMonacoCursorListeners: (editor: monacoType.editor.IStandaloneCodeEditor) => monacoType.IDisposable;
  handleSaveAndCompile: () => void;
  openRenameDialogLatestRef: React.MutableRefObject<() => void>;
  setCtxStartLine: (line: number | null) => void;
  setCtxEndLine: (line: number | null) => void;
  setCtxSelText: (text: string) => void;
  setCtxPos: (pos: { x: number; y: number } | null) => void;
  setCtxMenu: (menu: { x: number; y: number } | null) => void;
  setSelFloating: (sel: any) => void;
  setAiAssistState: (state: any) => void;
  setSuggestModal: (modal: any) => void;
  createSuggestionMutation: any;
  rejectSuggestionMutation: any;
  pageId: string;
}

export function useMonacoMount({
  editorRef,
  monacoRef,
  setEditorMounted,
  pageFilesRef,
  registerCitationProvider,
  bindDecorationListeners,
  bindMonacoCursorListeners,
  handleSaveAndCompile,
  openRenameDialogLatestRef,
  setCtxStartLine,
  setCtxEndLine,
  setCtxSelText,
  setCtxPos,
  setCtxMenu,
  setSelFloating,
  setAiAssistState,
  setSuggestModal,
  createSuggestionMutation,
  rejectSuggestionMutation,
  pageId,
}: UseMonacoMountOptions) {
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const domCleanupRef = useRef<(() => void) | null>(null);

  // Cleanup disposables on unmount
  useEffect(() => {
    return () => {
      domCleanupRef.current?.();
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMounted(true);

    // Show scrollbar on interaction/scroll then hide after idle
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const scrollDisposable = editor.onDidScrollChange(() => {
      const domNode = editor.getDomNode();
      if (domNode) {
        domNode.classList.add('editor-scrolling');
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          domNode.classList.remove('editor-scrolling');
        }, 1000);
      }
    });
    disposablesRef.current.push(scrollDisposable);

    // Double-click jumps to PDF (SyncTeX)
    const domNode = editor.getDomNode();
    if (domNode) {
      const dblClickHandler = () => {
        const pos = editor.getPosition();
        if (pos) {
          editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line: pos.lineNumber });
        }
      };
      domNode.addEventListener('dblclick', dblClickHandler);
      domCleanupRef.current = () =>
        domNode.removeEventListener('dblclick', dblClickHandler);
    }

    // Overleaf 1:1 Keybindings directly inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      const sel = editor.getSelection();
      let query: string | undefined;
      if (sel && !sel.isEmpty()) {
        query = editor.getModel()?.getValueInRange(sel) || undefined;
      } else {
        const pos = editor.getPosition();
        if (pos) {
          const word = editor.getModel()?.getWordAtPosition(pos);
          if (word) query = word.word;
        }
      }
      EditorEventBus.emit('flux:open-panel', { panel: 'Search', query });
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      EditorEventBus.emit('flux:open-citation-picker');
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleSaveAndCompile();
    });

    // Register completions & snippets
    disposablesRef.current.push(registerCitationProvider(monaco));
    disposablesRef.current.push(
      registerLabelCompletion(monaco, () => pageFilesRef.current),
    );
    disposablesRef.current.push(
      registerFilePathCompletion(monaco, () => pageFilesRef.current),
    );
    disposablesRef.current.push(registerLatexSnippets(monaco));
    disposablesRef.current.push(registerLatexLinkedEditing(monaco));

    const getRetractedItemsMap = () => new Map<string, any>();
    disposablesRef.current.push(
      registerLatexLinter(editor, monaco, getRetractedItemsMap),
    );
    disposablesRef.current.push(registerMathHoverPreview(monaco));

    // Register decoration listeners
    disposablesRef.current.push(bindDecorationListeners(editor, monaco));
    disposablesRef.current.push(bindMonacoCursorListeners(editor));

    // Right-click context menu
    disposablesRef.current.push(
      editor.onContextMenu((e) => {
        e.event.preventDefault();
        e.event.stopPropagation();
        const pos = e.target.position;
        const sel = editor.getSelection();
        const hasSel = sel && !sel.isEmpty();
        const sLine = hasSel ? sel.startLineNumber : (pos?.lineNumber ?? null);
        const eLine = hasSel ? sel.endLineNumber : (pos?.lineNumber ?? null);
        const selTxt = hasSel
          ? editor.getModel()?.getValueInRange(sel) ?? ''
          : '';

        setCtxStartLine(sLine);
        setCtxEndLine(eLine);
        setCtxSelText(selTxt);
        setCtxPos(null);
        setCtxMenu({ x: e.event.posx, y: e.event.posy });
      }),
    );

    // Keyboard commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleSaveAndCompile();
    });

    editor.addCommand(monaco.KeyCode.F2, () => {
      openRenameDialogLatestRef.current();
    });

    // Project-Wide Search (Ctrl+Shift+F / Cmd+Shift+F)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        EditorEventBus.emit('flux:open-panel', 'Search');
      },
    );

    // Toggle Source / Visual Editor (Ctrl+Shift+V / Cmd+Shift+V)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
      () => {
        const current = useSettingsStore.getState().editorMode;
        const next = current === 'code' ? 'visual' : 'code';
        useSettingsStore.getState().setEditorMode(next);
        toast.info(
          next === 'visual'
            ? 'Switched to Visual (Rich Text) mode'
            : 'Switched to Source (Code) mode',
          { duration: 1500 },
        );
      },
    );

    // Add Review Comment command (Ctrl+Alt+M / Cmd+Option+M or Ctrl+Alt+C)
    const handleTriggerAddComment = () => {
      const sel = editor.getSelection();
      const hasSel = sel && !sel.isEmpty();
      const startL = hasSel ? sel.startLineNumber : (editor.getPosition()?.lineNumber ?? 1);
      const endL = hasSel ? sel.endLineNumber : startL;
      const text = hasSel ? (editor.getModel()?.getValueInRange(sel) ?? '') : '';

      useActionsStore.getState().setPendingComment({
        startLine: startL,
        endLine: endL,
        selectedText: text,
      });
      EditorEventBus.emit('flux:open-panel', 'Review');
    };

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyM,
      handleTriggerAddComment,
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyC,
      handleTriggerAddComment,
    );

    // Overleaf AI Assist shortcut (Ctrl+K / Cmd+K)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      const sel = editor.getSelection();
      if (!sel || sel.isEmpty()) {
        toast.info('Select some text first to ask AI Assist');
        return;
      }
      const text = editor.getModel()?.getValueInRange(sel) ?? '';
      const visiblePos = editor.getScrolledVisiblePosition(sel.getEndPosition());
      const edDom = editor.getDomNode();
      const rect = edDom ? edDom.getBoundingClientRect() : { left: 100, top: 100 };
      const x = visiblePos ? rect.left + visiblePos.left : rect.left + 50;
      const y = visiblePos ? rect.top + visiblePos.top + 20 : rect.top + 50;

      setAiAssistState({
        isOpen: true,
        selectedText: text,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        position: { x, y },
      });
    });

    // SyncTeX Forward jump to PDF (Ctrl+Alt+J / Cmd+Option+J — official Overleaf shortcut)
    const handleTriggerSyncTeXForward = () => {
      const pos = editor.getPosition();
      const line = pos?.lineNumber ?? editor.getVisibleRanges()?.[0]?.startLineNumber ?? 1;
      editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
    };

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyJ,
      handleTriggerSyncTeXForward,
    );

    editor.addAction({
      id: 'flux.synctex.forward',
      label: 'Go to line in PDF (SyncTeX)',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyJ,
      ],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const pos = ed.getPosition();
        const line = pos?.lineNumber ?? ed.getVisibleRanges()?.[0]?.startLineNumber ?? 1;
        editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
      },
    });

    // Track Changes (Review Mode) keyboard interceptor
    disposablesRef.current.push(
      editor.onKeyDown((e) => {
        if (!useSettingsStore.getState().reviewMode) return;

        const sel = editor.getSelection();
        if (!sel || sel.isEmpty()) return;

        if (e.keyCode === monaco.KeyCode.Backspace || e.keyCode === monaco.KeyCode.Delete) {
          e.preventDefault();
          e.stopPropagation();

          const model = editor.getModel();
          const originalText = model ? model.getValueInRange(sel) : '';
          if (!originalText) return;

          createSuggestionMutation.mutate(
            {
              pageId,
              type: 'delete',
              originalText,
              suggestedText: '',
              fromLine: sel.startLineNumber,
              fromColumn: sel.startColumn,
              toLine: sel.endLineNumber,
              toColumn: sel.endColumn,
              description: 'Proposed deletion',
            },
            {
              onSuccess: (created: any) => {
                toast.success('Proposed deletion for review', {
                  action: {
                    label: 'Undo',
                    onClick: () => {
                      if (created?.id) {
                        rejectSuggestionMutation.mutate({
                          pageId,
                          suggestionId: created.id,
                        });
                      }
                    },
                  },
                });
              },
              onError: () => {
                toast.error('Failed to propose deletion');
              },
            },
          );
          return;
        }

        const isModifier = e.ctrlKey || e.metaKey || e.altKey;
        if (!isModifier && e.browserEvent.key && e.browserEvent.key.length === 1) {
          e.preventDefault();
          e.stopPropagation();

          const model = editor.getModel();
          const originalText = model ? model.getValueInRange(sel) : '';

          setSuggestModal({
            originalText,
            suggestedText: e.browserEvent.key,
            fromLine: sel.startLineNumber,
            toLine: sel.endLineNumber,
            type: 'replace',
            description: 'Proposed replacement',
          });
        }
      }),
    );

    // Floating selection toolbar
    disposablesRef.current.push(
      editor.onDidChangeCursorSelection((e) => {
        const sel = e.selection;
        if (sel.isEmpty()) {
          setSelFloating(null);
        } else {
          const model = editor.getModel();
          const text = model ? model.getValueInRange(sel) : '';
          if (text.trim().length > 0) {
            const endPos = {
              lineNumber: sel.endLineNumber,
              column: sel.endColumn,
            };
            const coords = editor.getScrolledVisiblePosition(endPos);
            const editorDom = editor.getDomNode();
            if (coords && editorDom) {
              const rect = editorDom.getBoundingClientRect();
              setSelFloating({
                x: Math.min(rect.left + coords.left + 8, window.innerWidth - 180),
                y: Math.max(rect.top + coords.top + coords.height + 4, 8),
                startLine: sel.startLineNumber,
                endLine: sel.endLineNumber,
                text,
              });
            }
          } else {
            setSelFloating(null);
          }
        }
      }),
    );
  };

  return {
    handleEditorMount,
  };
}
