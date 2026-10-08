/**
 * keybinding.coordinator.ts
 *
 * Centralized Keyboard Shortcut Router & Scope Manager (Coordinators Layer).
 * Location: `features/editor/coordinators/keybinding.coordinator.ts`
 *
 * Capabilities:
 * - Single source of truth for global & scoped IDE shortcuts (VS Code style).
 * - Context scope detection: `any`, `editorTextFocus`, `viewerFocus`, `modalOpen`.
 * - Prevents conflicting event listeners across components.
 * - Platform awareness (Mac Cmd vs Windows/Linux Ctrl).
 */

import { editorCommandBus } from './command-bus';
import { sessionCoordinator } from './session.coordinator';
import { useLayoutStore } from '../store/layout.store';

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
        editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' } as any);
      },
    });

    // 2. Force Save (Mod-s)
    this.register({
      id: 'workbench.save',
      key: 'Mod-s',
      description: 'Save all dirty files',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        void sessionCoordinator.flushAllPending();
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
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'quick-open' as any });
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
        e.preventDefault();
        useLayoutStore.getState().toggleSidebarLeft();
      },
    });

    // 8. Toggle Bottom Panel (Mod-j)
    this.register({
      id: 'workbench.toggleBottomPanel',
      key: 'Mod-j',
      description: 'Toggle Bottom Dock Panel (Problems & Logs)',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        useLayoutStore.getState().toggleBottomPanel();
      },
    });

    // 9. Toggle AI Research Assistant (Mod-i)
    this.register({
      id: 'workbench.toggleAiPanel',
      key: 'Mod-i',
      description: 'Toggle AI Research Assistant Panel',
      scope: 'any',
      handler: (e) => {
        e.preventDefault();
        editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });
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
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const shift = e.shiftKey;
    const keyLower = e.key.toLowerCase();

    for (const shortcut of this.shortcuts) {
      if (this.matchesKey(shortcut.key, keyLower, mod, shift, e.key)) {
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
    rawKey: string
  ): boolean {
    const parts = pattern.split('-');
    const targetKey = parts[parts.length - 1].toLowerCase();
    const needsMod = parts.includes('Mod');
    const needsShift = parts.includes('Shift');

    if (needsMod !== mod) return false;
    if (needsShift !== shift) return false;

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
}

export const keybindingCoordinator = new KeybindingCoordinatorRegistry();
