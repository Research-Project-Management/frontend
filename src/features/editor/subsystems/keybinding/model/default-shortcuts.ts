/**
 * default-shortcuts.ts
 * Declarative registry of built-in IDE keyboard shortcuts.
 */

import { gotoLine } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import {
  editorCommandBus,
  getActiveEditorEngine,
  sessionCoordinator,
  useWorkspaceStore,
  useSettingsStore,
} from '@/features/editor/core';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';

export type KeybindingScope = 'any' | 'editorTextFocus' | 'viewerFocus';

export interface ShortcutDefinition {
  id: string;
  key: string;
  description: string;
  scope?: KeybindingScope;
  handler: (e: KeyboardEvent) => void;
}

function getSelectedSnippet(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const sel = window.getSelection()?.toString();
  return sel && sel.trim().length > 0 && sel.length < 200 ? sel.trim() : undefined;
}

export function createDefaultShortcuts(isEditorFocused: () => boolean): ShortcutDefinition[] {
  return [
    {
      id: 'compiler.recompile',
      key: 'Mod-Enter',
      description: 'Recompile LaTeX document',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
      },
    },
    {
      id: 'workbench.save',
      key: 'Mod-s',
      description: 'Save all dirty files and trigger recompile',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        void sessionCoordinator.flushAllPending().then(() => {
          editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
        });
      },
    },
    {
      id: 'workbench.quickOpen',
      key: 'Mod-p',
      description: 'Quick Open file palette',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'quick-open' });
      },
    },
    {
      id: 'editor.insertCitation',
      key: 'Mod-Shift-k',
      description: 'Open Citation Picker',
      scope: 'editorTextFocus',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      },
    },
    {
      id: 'navigation.nextError',
      key: 'F8',
      description: 'Jump to next diagnostic error',
      scope: 'any',
      handler: (e) => {
        if (!e.shiftKey) {
          e.preventDefault();
          editorCommandBus.dispatch({ type: 'navigation:next-error' });
        }
      },
    },
    {
      id: 'navigation.prevError',
      key: 'Shift-F8',
      description: 'Jump to previous diagnostic error',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'navigation:prev-error' });
      },
    },
    {
      id: 'workbench.toggleSidebar',
      key: 'Mod-b',
      description: 'Toggle Primary Sidebar',
      scope: 'any',
      handler: (e) => {
        if (isEditorFocused()) return;
        e.preventDefault();
        useWorkspaceStore.getState().toggleSidebarLeft();
      },
    },
    {
      id: 'workbench.toggleAiPanel',
      key: 'Mod-j',
      description: 'Toggle AI Assistant Panel (Ctrl+J)',
      scope: 'any',
      handler: (e) => {
        if (!useSettingsStore.getState().aiAssistEnabled) return;
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });
      },
    },
    {
      id: 'workbench.findInFiles',
      key: 'Mod-Shift-f',
      description: 'Search across all files (Ctrl+Shift+F)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        useWorkspaceStore.getState().setSidebarLeftOpen(true);
        useWorkspaceStore.getState().setActiveSidebarTab('search');
        editorCommandBus.dispatch({
          type: 'sidebar:open-panel',
          panel: 'Search',
          query: getSelectedSnippet(),
        });
      },
    },
    {
      id: 'workbench.replaceInFiles',
      key: 'Mod-Shift-h',
      description: 'Search & Replace across all files (Ctrl+Shift+H)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        useWorkspaceStore.getState().setSidebarLeftOpen(true);
        useWorkspaceStore.getState().setActiveSidebarTab('search');
        editorCommandBus.dispatch({
          type: 'sidebar:open-panel',
          panel: 'Search',
          query: getSelectedSnippet(),
          showReplace: true,
        });
      },
    },
    {
      id: 'workbench.shortcutsHelpF1',
      key: 'F1',
      description: 'Open Keyboard Shortcuts Reference',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
      },
    },
    {
      id: 'workbench.shortcutsHelpSlash',
      key: 'Mod-/',
      description: 'Open Keyboard Shortcuts Reference',
      scope: 'any',
      handler: (e) => {
        if (isEditorFocused()) return;
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
      },
    },
    {
      id: 'workbench.addComment',
      key: 'Mod-Alt-m',
      description: 'Add Review Comment to Selected Text',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'review:create-comment' });
      },
    },
    {
      id: 'workbench.jumpToLine',
      key: 'Mod-g',
      description: 'Jump to Line in Editor (Ctrl+G)',
      scope: 'any',
      handler: (e) => {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        if (!activeEl?.closest('.cm-editor')) {
          e.preventDefault();
          const engine = getActiveEditorEngine();
          if (engine && typeof engine.focus === 'function') engine.focus();
          const view = engine?.getView?.() as EditorView | undefined;
          if (view) gotoLine(view);
        }
      },
    },
    {
      id: 'editor.insertTable',
      key: 'Mod-Shift-t',
      description: 'Open Table & Matrix Wizard (Ctrl+Shift+T)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
      },
    },
    {
      id: 'workbench.toggleEditorMode',
      key: 'Mod-Shift-v',
      description: 'Toggle Source / Visual Mode (Ctrl+Shift+V)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        useSettingsStore.getState().toggleEditorMode();
      },
    },
    {
      id: 'workbench.wordCount',
      key: 'Mod-Shift-w',
      description: 'Open Word Count Dialog (Ctrl+Shift+W)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
      },
    },
    {
      id: 'navigation.nextTab',
      key: 'Alt-]',
      description: 'Switch to Next Open Tab (Alt+])',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        navigationCoordinator.activateAdjacentTab(1);
      },
    },
    {
      id: 'navigation.nextTabPageDown',
      key: 'Ctrl-PageDown',
      description: 'Switch to Next Open Tab (Ctrl+PageDown)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        navigationCoordinator.activateAdjacentTab(1);
      },
    },
    {
      id: 'navigation.prevTab',
      key: 'Alt-[',
      description: 'Switch to Previous Open Tab (Alt+[)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        navigationCoordinator.activateAdjacentTab(-1);
      },
    },
    {
      id: 'navigation.prevTabPageUp',
      key: 'Ctrl-PageUp',
      description: 'Switch to Previous Open Tab (Ctrl+PageUp)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        navigationCoordinator.activateAdjacentTab(-1);
      },
    },
    {
      id: 'navigation.closeActiveTab',
      key: 'Alt-w',
      description: 'Close Active Editor Tab (Alt+W)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        navigationCoordinator.closeActiveDocument();
      },
    },
  ];
}
