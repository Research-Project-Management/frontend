import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RemoteCursorWidget,
  RemoteCursorManager,
  type RemoteUserCursor,
} from '@/features/editor/components/editor/monaco-remote-cursor';

describe('RemoteCursorWidget', () => {
  it('should initialize with correct styles, color, and name flag', () => {
    const widget = new RemoteCursorWidget('widget-user-1', 'Alice', '#10b981');

    expect(widget.getId()).toBe('widget-user-1');

    const dom = widget.getDomNode();
    expect(dom).toBeInstanceOf(HTMLElement);
    expect(dom.className).toContain('monaco-remote-cursor-container');

    const caret = dom.querySelector('.monaco-remote-caret') as HTMLElement;
    expect(caret).not.toBeNull();
    expect(caret.style.backgroundColor).toBe('rgb(16, 185, 129)');

    const flag = dom.querySelector('.monaco-remote-flag') as HTMLElement;
    expect(flag).not.toBeNull();
    expect(flag.textContent).toBe('Alice');
    expect(flag.style.backgroundColor).toBe('rgb(16, 185, 129)');
  });

  it('should accurately calculate position preference on updatePosition', () => {
    const widget = new RemoteCursorWidget('widget-user-2', 'Bob', '#3b82f6');
    expect(widget.getPosition()).toBeNull();

    widget.updatePosition(42, 15);
    const pos = widget.getPosition();
    expect(pos).not.toBeNull();
    expect(pos?.position).toEqual({ lineNumber: 42, column: 15 });
    expect(pos?.preference).toEqual([0]);
  });
});

describe('RemoteCursorManager', () => {
  let mockEditor: any;
  let mockMonaco: any;
  let manager: RemoteCursorManager;

  beforeEach(() => {
    mockEditor = {
      addContentWidget: vi.fn(),
      layoutContentWidget: vi.fn(),
      removeContentWidget: vi.fn(),
      createDecorationsCollection: vi.fn(() => ({
        set: vi.fn(),
        clear: vi.fn(),
      })),
    };

    mockMonaco = {
      Range: class {
        constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number,
        ) {}
      },
    };

    manager = new RemoteCursorManager();
    manager.setEditor(mockEditor, mockMonaco);
  });

  it('should create and layout content widget when user cursor updates', () => {
    const user: RemoteUserCursor = {
      id: 'user-1',
      name: 'Charlie',
      color: '#ec4899',
      cursor: {
        line: 12,
        column: 5,
      },
    };

    manager.updateUserCursor(user);

    expect(mockEditor.addContentWidget).toHaveBeenCalledTimes(1);
    const addedWidget = mockEditor.addContentWidget.mock.calls[0][0];
    expect(addedWidget.getId()).toBe('remote-cursor-user-1');
    expect(addedWidget.getPosition()?.position).toEqual({ lineNumber: 12, column: 5 });
    expect(mockEditor.layoutContentWidget).toHaveBeenCalledWith(addedWidget);
  });

  it('should update existing widget without creating a duplicate', () => {
    const user: RemoteUserCursor = {
      id: 'user-1',
      name: 'Charlie',
      color: '#ec4899',
      cursor: {
        line: 12,
        column: 5,
      },
    };

    manager.updateUserCursor(user);
    expect(mockEditor.addContentWidget).toHaveBeenCalledTimes(1);

    // Update position
    manager.updateUserCursor({
      ...user,
      cursor: {
        line: 15,
        column: 8,
      },
    });

    expect(mockEditor.addContentWidget).toHaveBeenCalledTimes(1);
    expect(mockEditor.layoutContentWidget).toHaveBeenCalledTimes(2);
  });

  it('should handle remote selection highlight decorations', () => {
    const mockCollection = {
      set: vi.fn(),
      clear: vi.fn(),
    };
    mockEditor.createDecorationsCollection.mockReturnValue(mockCollection);

    const userWithSel: RemoteUserCursor = {
      id: 'user-2',
      name: 'David',
      color: '#f59e0b',
      cursor: {
        line: 20,
        column: 1,
        selection: {
          startLineNumber: 20,
          startColumn: 1,
          endLineNumber: 20,
          endColumn: 10,
        },
      },
    };

    manager.updateUserCursor(userWithSel);

    expect(mockEditor.createDecorationsCollection).toHaveBeenCalledTimes(1);
    expect(mockCollection.set).toHaveBeenCalledTimes(1);

    // Update with empty selection -> clears selection decoration
    manager.updateUserCursor({
      ...userWithSel,
      cursor: {
        line: 20,
        column: 1,
        selection: {
          startLineNumber: 20,
          startColumn: 1,
          endLineNumber: 20,
          endColumn: 1,
        },
      },
    });

    expect(mockCollection.clear).toHaveBeenCalledTimes(1);
  });

  it('should remove user widget and decorations when user leaves', () => {
    const mockCollection = {
      set: vi.fn(),
      clear: vi.fn(),
    };
    mockEditor.createDecorationsCollection.mockReturnValue(mockCollection);

    const user: RemoteUserCursor = {
      id: 'user-3',
      name: 'Eve',
      color: '#8b5cf6',
      cursor: {
        line: 5,
        column: 3,
        selection: {
          startLineNumber: 5,
          startColumn: 3,
          endLineNumber: 5,
          endColumn: 9,
        },
      },
    };

    manager.updateUserCursor(user);
    manager.removeUser('user-3');

    expect(mockEditor.removeContentWidget).toHaveBeenCalledTimes(1);
    expect(mockCollection.clear).toHaveBeenCalledTimes(1);
  });

  it('should clear all widgets and decorations on clearAll', () => {
    manager.updateUserCursor({
      id: 'u1',
      name: 'User 1',
      color: '#10b981',
      cursor: { line: 1, column: 1 },
    });
    manager.updateUserCursor({
      id: 'u2',
      name: 'User 2',
      color: '#ef4444',
      cursor: { line: 2, column: 2 },
    });

    manager.clearAll();

    expect(mockEditor.removeContentWidget).toHaveBeenCalledTimes(2);
  });
});
