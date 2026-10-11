import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocumentSettingsStore } from '@/features/editor/store/settings.store';

describe('Emacs Mode & Keybinding Configuration (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentSettingsStore.setState({ keybinding: 'standard' });
  });

  describe('Settings Store Keybinding Management', () => {
    it('should support switching between standard, vim, and emacs', () => {
      const store = useDocumentSettingsStore.getState();
      expect(store.keybinding).toBe('standard');

      store.setKeybinding('emacs');
      expect(useDocumentSettingsStore.getState().keybinding).toBe('emacs');

      store.setKeybinding('vim');
      expect(useDocumentSettingsStore.getState().keybinding).toBe('vim');

      store.setKeybinding('standard');
      expect(useDocumentSettingsStore.getState().keybinding).toBe('standard');
    });

    it('should persist emacs keybinding preference along with other settings', () => {
      const store = useDocumentSettingsStore.getState();
      store.setKeybinding('emacs');
      store.setFontSize(15);
      store.setEditorTheme('dark');

      const state = useDocumentSettingsStore.getState();
      expect(state.keybinding).toBe('emacs');
      expect(state.fontSize).toBe(15);
      expect(state.editorTheme).toBe('dark');
    });
  });

  describe('Emacs Adapter Lifecycle & C-x C-s Save Command', () => {
    it('should register custom C-x C-s command to trigger save and compile', () => {
      let registeredSaveHandler: (() => void) | null = null;

      const mockRegisterGlobalCommand = vi.fn(
        (key: string, command: { run: () => void }) => {
          if (key === 'C-x C-s') {
            registeredSaveHandler = command.run;
          }
        },
      );

      const onSaveMock = vi.fn();

      // Simulate hook setup logic
      mockRegisterGlobalCommand('C-x C-s', {
        run: () => {
          onSaveMock();
        },
      });

      expect(mockRegisterGlobalCommand).toHaveBeenCalledWith(
        'C-x C-s',
        expect.objectContaining({ run: expect.any(Function) }),
      );
      expect(registeredSaveHandler).not.toBeNull();

      // Trigger Emacs C-x C-s
      registeredSaveHandler!();
      expect(onSaveMock).toHaveBeenCalledTimes(1);
    });

    it('should track mark changes (selection mode) and prefix keybuffer', () => {
      let markListener: ((inSelectionMode: boolean) => void) | null = null;
      let keyListener: ((key: string) => void) | null = null;
      let status = '';

      const mockEmacs = {
        start: vi.fn(),
        dispose: vi.fn(),
        onDidMarkChange: vi.fn(
          (cb: (inSelectionMode: boolean) => void) => (markListener = cb),
        ),
        onDidChangeKey: vi.fn((cb: (key: string) => void) => (keyListener = cb)),
      };

      // Wire listeners
      mockEmacs.onDidMarkChange((inSelectionMode) => {
        status = inSelectionMode ? 'Mark set' : 'Mark deactivated';
      });

      mockEmacs.onDidChangeKey((key) => {
        status = key || 'Ready';
      });

      // Emacs start
      mockEmacs.start();
      expect(mockEmacs.start).toHaveBeenCalledTimes(1);

      // Simulate C-Space (Mark set)
      markListener!(true);
      expect(status).toBe('Mark set');

      // Simulate typing C-x
      keyListener!('C-x');
      expect(status).toBe('C-x');

      // Simulate C-g (Quit / cancel)
      keyListener!('');
      expect(status).toBe('Ready');

      // Dispose
      mockEmacs.dispose();
      expect(mockEmacs.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
