import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '@/features/editor/core';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';

describe('Source vs Visual Editor Mode (Overleaf 1:1 Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ editorMode: 'code' });
  });

  describe('Settings Store editorMode State', () => {
    it('should default to code (Source) mode', () => {
      const mode = useSettingsStore.getState().editorMode;
      expect(mode).toBe('code');
    });

    it('should allow setting mode to visual', () => {
      useSettingsStore.getState().setEditorMode('visual');
      expect(useSettingsStore.getState().editorMode).toBe('visual');
    });

    it('should allow toggling between code and visual mode', () => {
      expect(useSettingsStore.getState().editorMode).toBe('code');

      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('visual');

      useSettingsStore.getState().toggleEditorMode();
      expect(useSettingsStore.getState().editorMode).toBe('code');
    });
  });

  describe('Visual Editor Command Bus (EditorEventBus delegation)', () => {
    it('should dispatch and receive flux:visual-command events for formatting', () => {
      const listener = vi.fn();
      const unsub = EditorEventBus.on('flux:visual-command', listener);

      EditorEventBus.emit('flux:visual-command', { command: 'bold' });
      expect(listener).toHaveBeenCalledWith({ command: 'bold' });

      EditorEventBus.emit('flux:visual-command', { command: 'italic' });
      expect(listener).toHaveBeenCalledWith({ command: 'italic' });

      EditorEventBus.emit('flux:visual-command', { command: 'heading', level: 2 });
      expect(listener).toHaveBeenCalledWith({ command: 'heading', level: 2 });

      EditorEventBus.emit('flux:visual-command', { command: 'insertMath' });
      expect(listener).toHaveBeenCalledWith({ command: 'insertMath' });

      unsub();

      EditorEventBus.emit('flux:visual-command', { command: 'strike' });
      expect(listener).toHaveBeenCalledTimes(4); // Did not trigger after unsub
    });

    it('should dispatch and receive flux:insert-citation event', () => {
      const listener = vi.fn();
      const unsub = EditorEventBus.on('flux:insert-citation', listener);

      EditorEventBus.emit('flux:insert-citation', { bibKey: 'knuth1984' });
      expect(listener).toHaveBeenCalledWith({ bibKey: 'knuth1984' });

      unsub();
    });
  });
});
