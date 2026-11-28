/**
 * keybinding.coordinator.ts
 *
 * Centralized Keyboard Shortcut Router & Scope Manager.
 * Shortcut definitions live in `../model/default-shortcuts.ts`.
 */

import { isPrimaryModKey } from '@/features/editor/core';
import {
  createDefaultShortcuts,
  type KeybindingScope,
  type ShortcutDefinition,
} from '../model/default-shortcuts';

export type { KeybindingScope, ShortcutDefinition };

export class KeybindingCoordinator {
  private shortcuts: ShortcutDefinition[] = [];
  private initialized = false;

  constructor() {
    this.shortcuts = createDefaultShortcuts(() => this.isEditorFocused());
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

  public register(shortcut: ShortcutDefinition): () => void {
    this.shortcuts.push(shortcut);
    return () => {
      this.shortcuts = this.shortcuts.filter((s) => s.id !== shortcut.id);
    };
  }

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    const mod = isPrimaryModKey(e);
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    const keyLower = e.key.toLowerCase();

    for (const shortcut of this.shortcuts) {
      if (this.matchesKey(shortcut.key, keyLower, mod, ctrl, shift, alt, e.key)) {
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
    ctrl: boolean,
    shift: boolean,
    alt: boolean,
    rawKey: string,
  ): boolean {
    const parts = pattern.split('-');
    const targetKey = parts[parts.length - 1].toLowerCase();
    const needsMod = parts.includes('Mod');
    const needsCtrl = parts.includes('Ctrl');
    const needsShift = parts.includes('Shift');
    const needsAlt = parts.includes('Alt');

    if (needsCtrl) {
      if (!ctrl) return false;
    } else if (needsMod !== mod) {
      return false;
    }
    if (needsShift !== shift) return false;
    if (needsAlt !== alt) return false;

    if (targetKey === 'enter' && keyLower === 'enter') return true;
    if (targetKey === 'pagedown' && (keyLower === 'pagedown' || rawKey === 'PageDown')) return true;
    if (targetKey === 'pageup' && (keyLower === 'pageup' || rawKey === 'PageUp')) return true;
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
      return Boolean(
        activeEl.closest('[role="toolbar"]') || activeEl.closest('.react-pdf__Document'),
      );
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

export const keybindingCoordinator = new KeybindingCoordinator();
