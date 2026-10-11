import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keybindingCoordinator } from '@/features/editor/coordinators/keybinding.coordinator';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { useSettingsStore } from '@/features/editor/store/settings.store';

describe('KeybindingCoordinatorRegistry (Global & Scoped Shortcuts)', () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = keybindingCoordinator.init();
  });

  afterEach(() => {
    cleanup?.();
    vi.restoreAllMocks();
  });

  it('triggers compiler recompile on Mod-Enter', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'compiler:trigger', reason: 'shortcut' })
    );
    expect(event.defaultPrevented).toBe(true);
  });

  it('triggers sessionCoordinator flush on Mod-s', () => {
    const flushSpy = vi.spyOn(sessionCoordinator, 'flushAllPending').mockResolvedValue(undefined as any);
    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(flushSpy).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('triggers next error navigation on F8 and previous error on Shift-F8', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

    const f8Event = new KeyboardEvent('keydown', {
      key: 'F8',
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(f8Event);
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'navigation:next-error' });
    expect(f8Event.defaultPrevented).toBe(true);

    const shiftF8Event = new KeyboardEvent('keydown', {
      key: 'F8',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(shiftF8Event);
    expect(dispatchSpy).toHaveBeenCalledWith({ type: 'navigation:prev-error' });
    expect(shiftF8Event.defaultPrevented).toBe(true);
  });

  it('opens shortcuts cheat sheet on F1', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const f1Event = new KeyboardEvent('keydown', {
      key: 'F1',
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(f1Event);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'shortcuts',
    });
    expect(f1Event.defaultPrevented).toBe(true);
  });

  it('opens shortcuts cheat sheet on Mod-/ when editor is not focused', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const event = new KeyboardEvent('keydown', {
      key: '/',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'shortcuts',
    });
  });

  it('triggers quick-open dialog on Mod-p', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'quick-open',
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('toggles editor mode on Mod-Shift-v', () => {
    const toggleSpy = vi.spyOn(useSettingsStore.getState(), 'toggleEditorMode');
    const event = new KeyboardEvent('keydown', {
      key: 'v',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(toggleSpy).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('opens word count dialog on Mod-Shift-w', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const event = new KeyboardEvent('keydown', {
      key: 'w',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'word-count',
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('opens table wizard on Mod-Shift-t', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const event = new KeyboardEvent('keydown', {
      key: 't',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'table-wizard',
    });
    expect(event.defaultPrevented).toBe(true);
  });
});

