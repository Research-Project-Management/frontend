import { describe, it, expect, vi } from 'vitest';
import { EditorEventBus, EditorCommandBus } from '@/features/editor/utils/editor.util';

describe('EditorEventBus & EditorCommandBus Deep Module', () => {
  it('subscribes and receives typed event payloads on EditorEventBus', () => {
    const handler = vi.fn();
    const unsubscribe = EditorEventBus.on('flux:open-panel', handler);

    EditorEventBus.emit('flux:open-panel', 'Review');
    expect(handler).toHaveBeenCalledWith('Review');

    EditorEventBus.emit('flux:open-panel', { panel: 'AI', commentId: 'c123' });
    expect(handler).toHaveBeenCalledWith({ panel: 'AI', commentId: 'c123' });

    unsubscribe();
    EditorEventBus.emit('flux:open-panel', 'Settings');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('executes LaTeX wrap commands on Monaco editor instance via EditorCommandBus', () => {
    let executedEdits: any[] = [];
    const mockModel = {
      getValueInRange: vi.fn().mockReturnValue('sample text'),
    };
    const mockEditor: any = {
      getSelection: vi.fn().mockReturnValue({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 12,
      }),
      getModel: vi.fn().mockReturnValue(mockModel),
      executeEdits: vi.fn((_source, edits) => {
        executedEdits = edits;
      }),
      focus: vi.fn(),
      trigger: vi.fn(),
    };

    // 1. Bold format
    EditorCommandBus.format(mockEditor, 'bold');
    expect(mockEditor.executeEdits).toHaveBeenCalled();
    expect(executedEdits[0].text).toBe('\\textbf{sample text}');
    expect(mockEditor.focus).toHaveBeenCalled();

    // 2. Math format
    EditorCommandBus.format(mockEditor, 'inlineMath');
    expect(executedEdits[0].text).toBe('$sample text$');

    // 3. Table snippet
    EditorCommandBus.format(mockEditor, 'table');
    expect(executedEdits[0].text).toContain('\\begin{table}');

    // 4. Undo / Redo
    EditorCommandBus.undo(mockEditor);
    expect(mockEditor.trigger).toHaveBeenCalledWith('toolbar', 'undo', null);
  });

  it('supports multiple independent subscribers and handles listener errors gracefully', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn().mockImplementation(() => {
      throw new Error('Listener crash');
    });
    const fn3 = vi.fn();

    const unsub1 = EditorEventBus.on('flux:trigger-compile', fn1);
    const unsub2 = EditorEventBus.on('flux:trigger-compile', fn2);
    const unsub3 = EditorEventBus.on('flux:trigger-compile', fn3);

    expect(() => {
      EditorEventBus.emit('flux:trigger-compile');
    }).not.toThrow();

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn3).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
    unsub3();
  });
});

