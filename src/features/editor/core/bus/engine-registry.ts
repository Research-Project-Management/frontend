/**
 * engine-registry.ts
 *
 * Dedicated Context-Free Registry for Active Editor Engine & PDF Viewer Instances.
 * Extracted from command-bus.ts for single-responsibility separation while preserving
 * full backward compatibility via re-exports.
 */

import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

/**
 * Null Object Pattern: Safe no-op implementation of IEditorEngine when no surface is mounted.
 */
export const NOOP_EDITOR_ENGINE: IEditorEngine = Object.freeze({
  getContent: () => '',
  setContent: () => undefined,
  getSelection: () => null,
  getSelectedText: () => '',
  insertText: () => undefined,
  replaceRange: () => undefined,
  proposeDiff: () => undefined,
  clearDiff: () => undefined,
  acceptDiff: () => undefined,
  rejectDiff: () => undefined,
  getSelectionOffsets: () => null,
  wrapSelection: () => undefined,
  format: () => undefined,
  jumpToLine: () => undefined,
  scrollToLine: () => undefined,
  getVisibleLine: () => 1,
  getScrollContainer: () => null,
  getLineCount: () => 0,
  undo: () => undefined,
  redo: () => undefined,
  focus: () => undefined,
  getCursorPosition: () => null,
  selectAll: () => undefined,
  openFind: () => undefined,
  indent: () => undefined,
  outdent: () => undefined,
  toggleComment: () => undefined,
  onContentChange: () => () => undefined,
  onCursorChange: () => () => undefined,
  setSearchQuery: () => undefined,
  findNext: () => false,
  findPrevious: () => false,
  replaceNext: () => false,
  replaceAll: () => false,
  clearSearch: () => undefined,
  getSearchMatchesCount: () => ({ current: 0, total: 0 }),
  getView: () => null,
  onDestroy: () => undefined,
});

/**
 * Registry Class Pattern: Encapsulates active editor engine & PDF viewer state.
 */
export class EditorEngineRegistry {
  private activeEngineInstance: IEditorEngine | null = null;
  private activeViewerInstance: unknown = null;
  private readonly enginesByFileId = new Map<string, IEditorEngine>();
  private readonly engineChangeListeners = new Set<() => void>();

  private notifyListeners(): void {
    for (const listener of this.engineChangeListeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.engineChangeListeners.add(listener);
    return () => {
      this.engineChangeListeners.delete(listener);
    };
  }

  public register(fileId: string, engine: IEditorEngine): void {
    const prevForFile = this.enginesByFileId.get(fileId);
    const prevActive = this.activeEngineInstance;
    this.enginesByFileId.set(fileId, engine);
    if (!this.activeEngineInstance) {
      this.activeEngineInstance = engine;
    }
    if (prevForFile !== engine || prevActive !== this.activeEngineInstance) {
      this.notifyListeners();
    }
  }

  public unregister(fileId: string, engine: IEditorEngine): void {
    let changed = false;
    if (this.enginesByFileId.get(fileId) === engine) {
      this.enginesByFileId.delete(fileId);
      changed = true;
    }
    if (this.activeEngineInstance === engine) {
      this.activeEngineInstance =
        this.enginesByFileId.values().next().value ?? null;
      changed = true;
    }
    if (changed) {
      this.notifyListeners();
    }
  }

  public getForFile(fileId: string): IEditorEngine | null {
    return this.enginesByFileId.get(fileId) ?? null;
  }

  public getAll(): ReadonlyMap<string, IEditorEngine> {
    return this.enginesByFileId;
  }

  public setActive(engine: IEditorEngine | null): void {
    if (this.activeEngineInstance === engine) return;
    this.activeEngineInstance = engine;
    this.notifyListeners();
  }

  public getActive(): IEditorEngine | null {
    return this.activeEngineInstance;
  }

  public getActiveOrNoop(): IEditorEngine {
    return this.activeEngineInstance ?? NOOP_EDITOR_ENGINE;
  }

  public getActiveContent(): string {
    return this.getActiveOrNoop().getContent();
  }

  public setActivePdfViewer(viewer: unknown): void {
    this.activeViewerInstance = viewer;
  }

  public getActivePdfViewer(): unknown {
    return this.activeViewerInstance;
  }
}

export const editorEngineRegistry = new EditorEngineRegistry();

export function subscribeEditorEngineChanges(listener: () => void): () => void {
  return editorEngineRegistry.subscribe(listener);
}

export function registerEditorEngine(fileId: string, engine: IEditorEngine): void {
  editorEngineRegistry.register(fileId, engine);
}

export function unregisterEditorEngine(fileId: string, engine: IEditorEngine): void {
  editorEngineRegistry.unregister(fileId, engine);
}

export function getEditorEngineForFile(fileId: string): IEditorEngine | null {
  return editorEngineRegistry.getForFile(fileId);
}

export function getAllRegisteredEngines(): ReadonlyMap<string, IEditorEngine> {
  return editorEngineRegistry.getAll();
}

export function setActiveEditorEngine(engine: IEditorEngine | null): void {
  editorEngineRegistry.setActive(engine);
}

export function getActiveEditorEngine(): IEditorEngine | null {
  return editorEngineRegistry.getActive();
}

export function getEditorEngineOrNoop(): IEditorEngine {
  return editorEngineRegistry.getActiveOrNoop();
}

export function getActiveEditorContent(): string {
  return editorEngineRegistry.getActiveContent();
}

export function setActivePdfViewer(viewer: unknown): void {
  editorEngineRegistry.setActivePdfViewer(viewer);
}

export function getActivePdfViewer(): unknown {
  return editorEngineRegistry.getActivePdfViewer();
}
