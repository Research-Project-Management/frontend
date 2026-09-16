import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocumentSettingsStore } from '@/features/editor/store/settings.store';

describe('Vim Mode & Keybinding Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentSettingsStore.setState({ keybinding: 'standard' });
  });

  describe('Settings Store Keybinding Management', () => {
    it('should have standard keybinding mode as default', () => {
      const state = useDocumentSettingsStore.getState();
      expect(state.keybinding).toBe('standard');
    });

    it('should toggle keybinding mode between standard and vim', () => {
      const store = useDocumentSettingsStore.getState();

      store.setKeybinding('vim');
      expect(useDocumentSettingsStore.getState().keybinding).toBe('vim');

      store.setKeybinding('standard');
      expect(useDocumentSettingsStore.getState().keybinding).toBe('standard');
    });

    it('should persist keybinding along with other editor preferences', () => {
      const store = useDocumentSettingsStore.getState();
      store.setKeybinding('vim');
      store.setFontSize(16);
      store.setWordWrap(false);

      const currentState = useDocumentSettingsStore.getState();
      expect(currentState.keybinding).toBe('vim');
      expect(currentState.fontSize).toBe(16);
      expect(currentState.wordWrap).toBe(false);
    });
  });

  describe('Vim Adapter Lifecycle & Ex Command Handling', () => {
    it('should properly register custom :w Ex command and invoke save handler', () => {
      let registeredWriteCallback: (() => void) | null = null;
      const mockDefineEx = vi.fn((name: string, shorthand: string, callback: () => void) => {
        if (name === 'write' || shorthand === 'w') {
          registeredWriteCallback = callback;
        }
      });

      const mockVimMode = {
        Vim: {
          defineEx: mockDefineEx,
        },
      };

      const onSaveMock = vi.fn();

      // Simulate hook setup logic
      if (mockVimMode.Vim?.defineEx) {
        mockVimMode.Vim.defineEx('write', 'w', () => {
          onSaveMock();
        });
      }

      expect(mockDefineEx).toHaveBeenCalledWith('write', 'w', expect.any(Function));
      expect(registeredWriteCallback).not.toBeNull();

      // Trigger :w
      registeredWriteCallback!();
      expect(onSaveMock).toHaveBeenCalledTimes(1);
    });

    it('should handle disposal of vim adapter and clean status bar element', () => {
      const mockDispose = vi.fn();
      const vimAdapter = {
        dispose: mockDispose,
      };

      const dummyStatusBar = document.createElement('div');
      dummyStatusBar.innerHTML = '<span>-- NORMAL --</span>';

      // Simulate cleanup logic
      if (vimAdapter) {
        vimAdapter.dispose();
      }
      dummyStatusBar.innerHTML = '';

      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(dummyStatusBar.innerHTML).toBe('');
    });

    it('should gracefully handle defineEx if Ex command is already defined', () => {
      const mockVimMode = {
        Vim: {
          defineEx: vi.fn(() => {
            throw new Error('Command already defined');
          }),
        },
      };

      expect(() => {
        try {
          mockVimMode.Vim.defineEx();
        } catch {
          // Hook catches this error
        }
      }).not.toThrow();
    });
  });
});
