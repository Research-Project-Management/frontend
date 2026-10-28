import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore, editorCommandBus } from '@/features/editor/core';

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

  describe('Visual Editor Command Bus (editorCommandBus delegation)', () => {
    it('should dispatch and receive editor:visual-command events for formatting', () => {
      const listener = vi.fn();
      const unsub = editorCommandBus.subscribe('editor:visual-command', listener);

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'bold' });
      expect(listener).toHaveBeenCalledWith({ type: 'editor:visual-command', command: 'bold' });

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'italic' });
      expect(listener).toHaveBeenCalledWith({ type: 'editor:visual-command', command: 'italic' });

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'heading', level: 2 });
      expect(listener).toHaveBeenCalledWith({ type: 'editor:visual-command', command: 'heading', level: 2 });

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'insertMath' });
      expect(listener).toHaveBeenCalledWith({ type: 'editor:visual-command', command: 'insertMath' });

      unsub();

      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'strike' });
      expect(listener).toHaveBeenCalledTimes(4); // Did not trigger after unsub
    });

    it('should dispatch and receive editor:insert-citation event', () => {
      const listener = vi.fn();
      const unsub = editorCommandBus.subscribe('editor:insert-citation', listener);

      editorCommandBus.dispatch({ type: 'editor:insert-citation', bibKey: 'knuth1984' });
      expect(listener).toHaveBeenCalledWith({ type: 'editor:insert-citation', bibKey: 'knuth1984' });

      unsub();
    });
  });
});
