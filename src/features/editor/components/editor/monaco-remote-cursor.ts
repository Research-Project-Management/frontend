import type { editor } from 'monaco-editor';

export interface RemoteUserCursor {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  role?: string;
  cursor?: {
    line: number;
    column: number;
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
}

/**
 * Monaco IContentWidget implementation for remote collaborator cursors.
 * Renders a colored vertical caret and a floating name badge above the cursor.
 */
export class RemoteCursorWidget implements editor.IContentWidget {
  private readonly domNode: HTMLElement;
  private position: editor.IContentWidgetPosition | null = null;
  private flagElement: HTMLElement;

  constructor(
    private readonly widgetId: string,
    private readonly name: string,
    private readonly color: string,
  ) {
    this.domNode = document.createElement('div');
    this.domNode.className = 'monaco-remote-cursor-container pointer-events-none select-none z-50';
    this.domNode.style.position = 'relative';

    // Vertical colored caret
    const caret = document.createElement('div');
    caret.className = 'monaco-remote-caret animate-pulse';
    caret.style.position = 'absolute';
    caret.style.width = '2px';
    caret.style.height = '18px';
    caret.style.backgroundColor = this.color;
    caret.style.top = '0px';
    caret.style.left = '0px';

    // Floating name badge flag
    this.flagElement = document.createElement('div');
    this.flagElement.className =
      'monaco-remote-flag text-[10px] font-sans font-medium px-1.5 py-0.5 rounded shadow-xs';
    this.flagElement.style.position = 'absolute';
    this.flagElement.style.bottom = '18px';
    this.flagElement.style.left = '-2px';
    this.flagElement.style.backgroundColor = this.color;
    this.flagElement.style.color = '#ffffff';
    this.flagElement.style.whiteSpace = 'nowrap';
    this.flagElement.style.pointerEvents = 'none';
    this.flagElement.style.transform = 'translateY(-2px)';
    this.flagElement.textContent = this.name;

    this.domNode.appendChild(caret);
    this.domNode.appendChild(this.flagElement);
  }

  public updatePosition(line: number, column: number): void {
    this.position = {
      position: { lineNumber: line, column },
      preference: [0], // EXACT
    };
  }

  public getId(): string {
    return this.widgetId;
  }

  public getDomNode(): HTMLElement {
    return this.domNode;
  }

  public getPosition(): editor.IContentWidgetPosition | null {
    return this.position;
  }
}

/**
 * RemoteCursorManager manages all active remote collaborator cursors
 * and selection highlights inside a Monaco Editor instance.
 */
export class RemoteCursorManager {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private monaco: any = null;
  private widgets = new Map<string, RemoteCursorWidget>();
  private selectionCollections = new Map<string, editor.IEditorDecorationsCollection>();

  public setEditor(editor: editor.IStandaloneCodeEditor | null, monaco: any): void {
    if (this.editor !== editor) {
      this.clearAll();
    }
    this.editor = editor;
    this.monaco = monaco;
  }

  /**
   * Updates or creates a remote user cursor and selection in the editor.
   */
  public updateUserCursor(user: RemoteUserCursor): void {
    if (!this.editor || !this.monaco || !user.cursor) return;

    const widgetId = `remote-cursor-${user.id}`;
    let widget = this.widgets.get(user.id);

    if (!widget) {
      widget = new RemoteCursorWidget(widgetId, user.name, user.color);
      this.widgets.set(user.id, widget);
      this.editor.addContentWidget(widget);
    }

    widget.updatePosition(user.cursor.line, user.cursor.column);
    this.editor.layoutContentWidget(widget);

    // Update selection highlight if present
    const sel = user.cursor.selection;
    if (
      sel &&
      (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn)
    ) {
      let coll = this.selectionCollections.get(user.id);
      if (!coll) {
        coll = this.editor.createDecorationsCollection([]);
        this.selectionCollections.set(user.id, coll);
      }

      coll.set([
        {
          range: new this.monaco.Range(
            sel.startLineNumber,
            sel.startColumn,
            sel.endLineNumber,
            sel.endColumn,
          ),
          options: {
            className: 'remote-selection-highlight',
            inlineClassName: 'bg-primary/20',
          },
        },
      ]);
    } else {
      const coll = this.selectionCollections.get(user.id);
      if (coll) {
        coll.set([]);
        coll.clear();
      }
    }
  }

  /**
   * Removes a user's cursor widget and selection decorations.
   */
  public removeUserCursor(userId: string): void {
    const widget = this.widgets.get(userId);
    if (widget && this.editor) {
      this.editor.removeContentWidget(widget);
      this.widgets.delete(userId);
    }

    const coll = this.selectionCollections.get(userId);
    if (coll) {
      coll.clear();
      this.selectionCollections.delete(userId);
    }
  }

  /**
   * Alias for removeUserCursor
   */
  public removeUser(userId: string): void {
    this.removeUserCursor(userId);
  }

  /**
   * Clears all remote cursors and decorations.
   */
  public clearAll(): void {
    if (this.editor) {
      for (const widget of this.widgets.values()) {
        this.editor.removeContentWidget(widget);
      }
    }
    this.widgets.clear();

    for (const coll of this.selectionCollections.values()) {
      coll.clear();
    }
    this.selectionCollections.clear();
  }

  public dispose(): void {
    this.clearAll();
    this.editor = null;
    this.monaco = null;
  }
}
