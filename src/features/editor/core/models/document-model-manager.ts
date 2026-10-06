/**
 * document-model-manager.ts
 *
 * In-Memory Virtual Document Model Manager (VS Code ITextModelService Parity).
 *
 * Responsibilities:
 * - Maintains in-memory DocumentModel instances for all opened/cached project files.
 * - Stores cursor positions, selections, and scroll viewports across tab switches.
 * - Enables 0ms file tab switching without resetting editor selection or re-fetching.
 * - Tracks dirty state and in-flight buffers across compilation and autosave flushes.
 */

export interface DocumentCursorSelection {
  anchor: number;
  head: number;
}

export interface DocumentScrollViewport {
  top: number;
  left: number;
}

export interface DocumentModelState {
  fileId: string;
  filePath: string;
  content: string;
  selection?: DocumentCursorSelection;
  scrollViewport?: DocumentScrollViewport;
  yText?: any | null;
  isDirty: boolean;
  lastSavedAt?: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
}

type ModelChangeListener = (fileId: string, model: DocumentModelState) => void;

class DocumentModelManagerRegistry {
  private readonly models = new Map<string, DocumentModelState>();
  private readonly listeners = new Set<ModelChangeListener>();

  /**
   * Retrieves an existing DocumentModel by its unique file ID.
   */
  public getModel(fileId: string): DocumentModelState | undefined {
    return this.models.get(fileId);
  }

  /**
   * Registers or updates a DocumentModel with initial or updated parameters.
   */
  public registerModel(
    fileId: string,
    initial: {
      filePath?: string;
      content?: string;
      selection?: DocumentCursorSelection;
      scrollViewport?: DocumentScrollViewport;
      yText?: any | null;
      metadata?: Record<string, unknown>;
    }
  ): DocumentModelState {
    const existing = this.models.get(fileId);
    if (existing) {
      if (initial.filePath) existing.filePath = initial.filePath;
      if (initial.content !== undefined) existing.content = initial.content;
      if (initial.selection) existing.selection = initial.selection;
      if (initial.scrollViewport) existing.scrollViewport = initial.scrollViewport;
      if (initial.yText !== undefined) existing.yText = initial.yText;
      if (initial.metadata) existing.metadata = { ...existing.metadata, ...initial.metadata };
      existing.lastActiveAt = Date.now();
      this.notify(fileId, existing);
      return existing;
    }

    const newModel: DocumentModelState = {
      fileId,
      filePath: initial.filePath || fileId,
      content: initial.content ?? '',
      selection: initial.selection,
      scrollViewport: initial.scrollViewport,
      yText: initial.yText ?? null,
      isDirty: false,
      lastSavedAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: initial.metadata,
    };

    this.models.set(fileId, newModel);
    this.notify(fileId, newModel);
    return newModel;
  }

  /**
   * Updates content and tracks dirty buffer state.
   */
  public updateContent(fileId: string, content: string, markDirty = true): void {
    const model = this.models.get(fileId);
    if (!model) {
      this.registerModel(fileId, { content });
      if (markDirty) {
        const created = this.models.get(fileId)!;
        created.isDirty = true;
        this.notify(fileId, created);
      }
      return;
    }

    if (model.content !== content) {
      model.content = content;
      if (markDirty) {
        model.isDirty = true;
      }
      model.lastActiveAt = Date.now();
      this.notify(fileId, model);
    }
  }

  /**
   * Persists the viewport state (cursor selection & scroll offset) for instant restore.
   */
  public updateViewState(
    fileId: string,
    selection?: DocumentCursorSelection,
    scrollViewport?: DocumentScrollViewport
  ): void {
    const model = this.models.get(fileId);
    if (!model) return;

    if (selection) model.selection = selection;
    if (scrollViewport) model.scrollViewport = scrollViewport;
    model.lastActiveAt = Date.now();
  }

  /**
   * Marks a model as clean (saved to disk / persisted).
   */
  public markClean(fileId: string): void {
    const model = this.models.get(fileId);
    if (model) {
      model.isDirty = false;
      model.lastSavedAt = Date.now();
      this.notify(fileId, model);
    }
  }

  /**
   * Returns all models that have unsaved changes.
   */
  public getDirtyModels(): DocumentModelState[] {
    const dirty: DocumentModelState[] = [];
    for (const model of this.models.values()) {
      if (model.isDirty) {
        dirty.push(model);
      }
    }
    return dirty;
  }

  /**
   * Returns all in-memory open models.
   */
  public getAllModels(): DocumentModelState[] {
    return Array.from(this.models.values());
  }

  /**
   * Evicts a model from memory (e.g. file deleted or closed long ago).
   */
  public evictModel(fileId: string): void {
    this.models.delete(fileId);
  }

  /**
   * Clears all open models (e.g. project switch).
   */
  public clearAll(): void {
    this.models.clear();
  }

  /**
   * Subscribes to model change notifications.
   */
  public subscribe(listener: ModelChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(fileId: string, model: DocumentModelState): void {
    for (const listener of this.listeners) {
      try {
        listener(fileId, model);
      } catch (err) {
        console.error('[DocumentModelManager] Listener notification error', err);
      }
    }
  }
}

export const documentModelManager = new DocumentModelManagerRegistry();
