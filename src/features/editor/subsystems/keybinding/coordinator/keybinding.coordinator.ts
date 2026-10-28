/**
 * keybinding.coordinator.ts
 *
 * Centralized Keyboard Shortcut Router & Scope Manager (Coordinators Layer).
 * Location: `features/editor/subsystems/keybinding/coordinator/keybinding.coordinator.ts`
 *
 * Capabilities:
 * - Single source of truth for global & scoped IDE shortcuts (VS Code style).
 * - Context scope detection: `any`, `editorTextFocus`, `viewerFocus`, `modalOpen`.
 * - Prevents conflicting event listeners across components.
 * - Platform awareness (Mac Cmd vs Windows/Linux Ctrl).
 */

import {
  editorCommandBus,
  getActiveEditorEngine,
  sessionCoordinator,
  useWorkspaceStore,
  useSettingsStore,
  isPrimaryModKey,
} from '@/features/editor/core';
import { gotoLine } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';

export type KeybindingScope = 'any' | 'editorTextFocus' | 'viewerFocus';

export interface ShortcutDefinition {
  id: string;
  key: string; // e.g. 'Mod-Enter', 'Mod-p', 'F5', 'F8', 'Shift-F8'
  description: string;
  scope?: KeybindingScope;
  handler: (e: KeyboardEvent) => void;
}

export class KeybindingCoordinatorRegistry {
  private shortcuts: ShortcutDefinition[] = [];
  private initialized = false;

  constructor() {
    this.registerDefaultShortcuts();
  }

  public init(): () => void {
    if (typeof window === 'undefined' || this.initialized) {
      return () => {};
    }
    this.initialized = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      this.handleGlobalKeyDown(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      this.initialized = false;
    };
  }

  private registerDefaultShortcuts(): void {
    // 1. Recompile (Mod-Enter)
    this.register({
      id: 'compiler.recompile',
      key: 'Mod-Enter',
      description: 'Recompile LaTeX document',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
      },
    });

    // 2. Save & Recompile (Mod-s, Overleaf parity)
    this.register({
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
    });

    // 3. Quick Open (Mod-p)
    this.register({
      id: 'workbench.quickOpen',
      key: 'Mod-p',
      description: 'Quick Open file palette',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'quick-open' });
      },
    });

    // 4. Citation Picker (Mod-Shift-k)
    this.register({
      id: 'editor.insertCitation',
      key: 'Mod-Shift-k',
      description: 'Open Citation Picker',
      scope: 'editorTextFocus',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      },
    });

    // 5. Next Error (F8)
    this.register({
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
    });

    // 6. Previous Error (Shift-F8)
    this.register({
      id: 'navigation.prevError',
      key: 'Shift-F8',
      description: 'Jump to previous diagnostic error',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'navigation:prev-error' });
      },
    });

    // 7. Toggle Primary Sidebar (Mod-b)
    this.register({
      id: 'workbench.toggleSidebar',
      key: 'Mod-b',
      description: 'Toggle Primary Sidebar',
      scope: 'any',
      handler: (e) => {
        if (this.isEditorFocused()) {
          // Let CodeMirror / Visual editor handle Overleaf bold formatting (\textbf)
          return;
        }
        e.preventDefault();
        useWorkspaceStore.getState().toggleSidebarLeft();
      },
    });

    // 8. Toggle AI Research Assistant (Mod-i)
    this.register({
      id: 'workbench.toggleAiPanel',
      key: 'Mod-i',
      description: 'Toggle AI Research Assistant Panel',
      scope: 'any',
      handler: (e) => {
        if (this.isEditorFocused()) {
          // Let CodeMirror / Visual editor handle Overleaf italic formatting (\textit)
          return;
        }
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });
      },
    });

    // 10. Global Search Across Files (Mod-Shift-f - Overleaf Parity)
    this.register({
      id: 'workbench.findInFiles',
      key: 'Mod-Shift-f',
      description: 'Search across all project files (Ctrl+Shift+F)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        let selectedText: string | undefined;
        if (typeof window !== 'undefined') {
          const sel = window.getSelection()?.toString();
          if (sel && sel.trim().length > 0 && sel.length < 200) {
            selectedText = sel.trim();
          }
        }
        useWorkspaceStore.getState().setSidebarLeftOpen(true);
        useWorkspaceStore.getState().setActiveSidebarTab('search');
        editorCommandBus.dispatch({
          type: 'sidebar:open-panel',
          panel: 'Search',
          query: selectedText,
        });
      },
    });

    // 10b. Global Replace Across Files (Mod-Shift-h - Overleaf Parity)
    this.register({
      id: 'workbench.replaceInFiles',
      key: 'Mod-Shift-h',
      description: 'Search & Replace across all project files (Ctrl+Shift+H)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        let selectedText: string | undefined;
        if (typeof window !== 'undefined') {
          const sel = window.getSelection()?.toString();
          if (sel && sel.trim().length > 0 && sel.length < 200) {
            selectedText = sel.trim();
          }
        }
        useWorkspaceStore.getState().setSidebarLeftOpen(true);
        useWorkspaceStore.getState().setActiveSidebarTab('search');
        editorCommandBus.dispatch({
          type: 'sidebar:open-panel',
          panel: 'Search',
          query: selectedText,
          showReplace: true,
        });
      },
    });

    // 11. Keyboard Shortcuts Help (F1 or Mod-/)
    this.register({
      id: 'workbench.shortcutsHelpF1',
      key: 'F1',
      description: 'Open Keyboard Shortcuts Reference',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
      },
    });

    this.register({
      id: 'workbench.shortcutsHelpSlash',
      key: 'Mod-/',
      description: 'Open Keyboard Shortcuts Reference',
      scope: 'any',
      handler: (e) => {
        if (this.isEditorFocused()) {
          // Let CodeMirror toggle LaTeX comment (%)
          return;
        }
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
      },
    });

    // 12. Add Review Comment (Mod-Alt-m - Overleaf Parity)
    this.register({
      id: 'workbench.addComment',
      key: 'Mod-Alt-m',
      description: 'Add Review Comment to Selected Text',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'review:create-comment' });
      },
    });

    // 13. Jump to Line (Mod-g - Overleaf Parity)
    this.register({
      id: 'workbench.jumpToLine',
      key: 'Mod-g',
      description: 'Jump to Line in Editor (Ctrl+G)',
      scope: 'any',
      handler: (e) => {
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const isEditor = activeEl?.closest('.cm-editor');
        if (!isEditor) {
          e.preventDefault();
          const engine = getActiveEditorEngine();
          if (engine && typeof engine.focus === 'function') {
            engine.focus();
          }
          const view = engine?.getView?.() as EditorView | undefined;
          if (view) {
            gotoLine(view);
          }
        }
      },
    });

    // 14. Table & Matrix Wizard (Mod-Shift-t - Overleaf Parity)
    this.register({
      id: 'editor.insertTable',
      key: 'Mod-Shift-t',
      description: 'Open Table & Matrix Wizard (Ctrl+Shift+T)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
      },
    });

    // 15. Toggle Source / Visual Editor Mode (Mod-Shift-v - Overleaf Parity)
    this.register({
      id: 'workbench.toggleEditorMode',
      key: 'Mod-Shift-v',
      description: 'Toggle Source / Visual Mode (Ctrl+Shift+V)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        useSettingsStore.getState().toggleEditorMode();
      },
    });

    // 16. Word Count & Document Metrics (Mod-Shift-w - Overleaf Parity)
    this.register({
      id: 'workbench.wordCount',
      key: 'Mod-Shift-w',
      description: 'Open Word Count Dialog (Ctrl+Shift+W)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
      },
    });
  }

  public register(shortcut: ShortcutDefinition): () => void {
    this.shortcuts.push(shortcut);
    return () => {
      this.shortcuts = this.shortcuts.filter((s) => s.id !== shortcut.id);
    };
  }

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    const mod = isPrimaryModKey(e);
    const shift = e.shiftKey;
    const alt = e.altKey;
    const keyLower = e.key.toLowerCase();

    for (const shortcut of this.shortcuts) {
      if (this.matchesKey(shortcut.key, keyLower, mod, shift, alt, e.key)) {
        if (this.isScopeActive(shortcut.scope)) {
          shortcut.handler(e);
          return;
        }
      }
    }
  }

  private matchesKey(
    pattern: string,
    keyLower: string,
    mod: boolean,
    shift: boolean,
    alt: boolean,
    rawKey: string
  ): boolean {
    const parts = pattern.split('-');
    const targetKey = parts[parts.length - 1].toLowerCase();
    const needsMod = parts.includes('Mod');
    const needsShift = parts.includes('Shift');
    const needsAlt = parts.includes('Alt');

    if (needsMod !== mod) return false;
    if (needsShift !== shift) return false;
    if (needsAlt !== alt) return false;

    if (targetKey === 'enter' && keyLower === 'enter') return true;
    if (targetKey.startsWith('f') && rawKey.toLowerCase() === targetKey) return true;
    return targetKey === keyLower;
  }

  private isScopeActive(scope?: KeybindingScope): boolean {
    if (!scope || scope === 'any') return true;
    if (typeof document === 'undefined') return true;

    const activeEl = document.activeElement;
    if (!activeEl) return true;

    if (scope === 'editorTextFocus') {
      return activeEl.classList.contains('cm-content') || Boolean(activeEl.closest('.cm-editor'));
    }

    if (scope === 'viewerFocus') {
      return Boolean(activeEl.closest('[role="toolbar"]') || activeEl.closest('.react-pdf__Document'));
    }

    return true;
  }

  private isEditorFocused(): boolean {
    if (typeof document === 'undefined') return false;
    const activeEl = document.activeElement;
    if (!activeEl) return false;
    return (
      activeEl.classList.contains('cm-content') ||
      Boolean(activeEl.closest('.cm-editor')) ||
      Boolean(activeEl.closest('.ProseMirror'))
    );
  }
}

export const keybindingCoordinator = new KeybindingCoordinatorRegistry();
