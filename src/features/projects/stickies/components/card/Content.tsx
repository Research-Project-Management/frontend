'use client';

import React, { useEffect, useRef, memo, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, placeholder as cmPlaceholder, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Sticky } from '@/features/projects/stickies/types/sticky.types';
import { stripHtml } from '@/features/projects/stickies/utils/sticky.utils';
import { cn } from '@/shared/lib/utils';

export interface StickiesEditorHandle {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleTodoList: () => void;
  focus: () => void;
  isBoldActive?: () => boolean;
  isItalicActive?: () => boolean;
  isTodoActive?: () => boolean;
}

interface ContentProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onReady?: (editor: StickiesEditorHandle | null) => void;
  isOverlay?: boolean;
  placeholder?: string;
  editorClassName?: string;
}

export default memo(function Content({
  sticky,
  onUpdate,
  onReady,
  isOverlay,
  placeholder = 'Write something...',
  editorClassName,
}: ContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(sticky.content || '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalize initial content (strip legacy HTML tags if migrated from TipTap)
  const initialText = useMemo(() => {
    const raw = sticky.content || '';
    return raw.includes('<') ? stripHtml(raw) : raw;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const baseTheme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'inherit',
        fontSize: '0.875rem',
      },
      '.cm-content': {
        fontFamily: 'inherit',
        padding: '8px 16px 12px',
        lineHeight: '1.5',
        caretColor: 'currentColor',
        minHeight: '200px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-placeholder': {
        color: 'inherit',
        opacity: '0.55',
        fontStyle: 'normal',
      },
      '.cm-line': {
        padding: '0',
      },
    });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        contentRef.current = text;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          if (text !== sticky.content) {
            onUpdate(sticky.id, { content: text });
          }
        }, 800);
      }
    });

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        EditorView.lineWrapping,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        cmPlaceholder(placeholder),
        baseTheme,
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    const handle: StickiesEditorHandle = {
      toggleBold: () => {
        const sel = view.state.selection.main;
        const { from, to } = sel;
        if (from !== to) {
          const selected = view.state.sliceDoc(from, to);
          if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
            view.dispatch({
              changes: { from, to, insert: selected.slice(2, -2) },
              selection: { anchor: from, head: to - 4 },
            });
          } else {
            view.dispatch({
              changes: { from, to, insert: `**${selected}**` },
              selection: { anchor: from, head: to + 4 },
            });
          }
        } else {
          view.dispatch({
            changes: { from, insert: '****' },
            selection: { anchor: from + 2 },
          });
        }
        view.focus();
      },
      toggleItalic: () => {
        const sel = view.state.selection.main;
        const { from, to } = sel;
        if (from !== to) {
          const selected = view.state.sliceDoc(from, to);
          if (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2) {
            view.dispatch({
              changes: { from, to, insert: selected.slice(1, -1) },
              selection: { anchor: from, head: to - 2 },
            });
          } else {
            view.dispatch({
              changes: { from, to, insert: `*${selected}*` },
              selection: { anchor: from, head: to + 2 },
            });
          }
        } else {
          view.dispatch({
            changes: { from, insert: '**' },
            selection: { anchor: from + 1 },
          });
        }
        view.focus();
      },
      toggleTodoList: () => {
        const sel = view.state.selection.main;
        const line = view.state.doc.lineAt(sel.from);
        const lineText = line.text;

        if (lineText.startsWith('- [ ] ')) {
          view.dispatch({
            changes: { from: line.from, to: line.from + 6, insert: '- [x] ' },
          });
        } else if (lineText.startsWith('- [x] ')) {
          view.dispatch({
            changes: { from: line.from, to: line.from + 6, insert: '' },
          });
        } else if (lineText.startsWith('- ')) {
          view.dispatch({
            changes: { from: line.from, to: line.from + 2, insert: '- [ ] ' },
          });
        } else {
          view.dispatch({
            changes: { from: line.from, insert: '- [ ] ' },
          });
        }
        view.focus();
      },
      focus: () => {
        view.focus();
      },
      isBoldActive: () => {
        const sel = view.state.selection.main;
        if (sel.from === sel.to) return false;
        const text = view.state.sliceDoc(sel.from, sel.to);
        return text.startsWith('**') && text.endsWith('**');
      },
      isItalicActive: () => {
        const sel = view.state.selection.main;
        if (sel.from === sel.to) return false;
        const text = view.state.sliceDoc(sel.from, sel.to);
        return text.startsWith('*') && text.endsWith('*');
      },
      isTodoActive: () => {
        const sel = view.state.selection.main;
        const line = view.state.doc.lineAt(sel.from);
        return line.text.startsWith('- [ ] ') || line.text.startsWith('- [x] ');
      },
    };

    if (onReady) {
      onReady(handle);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (onReady) onReady(null);
      view.destroy();
      viewRef.current = null;
    };
  }, [onReady, placeholder]);

  // Sync external changes when view is not focused
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    const rawExternal = sticky.content || '';
    const incomingText = rawExternal.includes('<') ? stripHtml(rawExternal) : rawExternal;

    if (!view.hasFocus && incomingText !== currentDoc && incomingText !== contentRef.current) {
      contentRef.current = incomingText;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: incomingText },
      });
    }
  }, [sticky.content]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full overflow-y-auto overflow-x-hidden focus:outline-none',
        editorClassName || 'min-h-[220px] max-h-[380px]',
        isOverlay ? 'pointer-events-none' : ''
      )}
      onBlur={() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        const current = contentRef.current;
        if (current !== sticky.content) {
          onUpdate(sticky.id, { content: current });
        }
      }}
    />
  );
});
