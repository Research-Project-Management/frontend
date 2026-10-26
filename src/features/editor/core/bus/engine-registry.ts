/**
 * engine-registry.ts
 *
 * Dedicated Context-Free Registry for Active Editor Engine & PDF Viewer Instances.
 * Extracted from command-bus.ts for single-responsibility separation while preserving
 * full backward compatibility via re-exports.
 */

import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

let activeEngineInstance: IEditorEngine | null = null;
let activeViewerInstance: unknown = null;
const enginesByFileId = new Map<string, IEditorEngine>();
const engineChangeListeners = new Set<() => void>();

function notifyEngineListeners(): void {
  for (const listener of engineChangeListeners) {
    try {
      listener();
    } catch {
      // Ignore listener error
    }
  }
}

export function subscribeEditorEngineChanges(listener: () => void): () => void {
  engineChangeListeners.add(listener);
  return () => {
    engineChangeListeners.delete(listener);
  };
}

export function registerEditorEngine(fileId: string, engine: IEditorEngine): void {
  enginesByFileId.set(fileId, engine);
  if (!activeEngineInstance) {
    activeEngineInstance = engine;
  }
  notifyEngineListeners();
}

export function unregisterEditorEngine(fileId: string, engine: IEditorEngine): void {
  if (enginesByFileId.get(fileId) === engine) {
    enginesByFileId.delete(fileId);
  }
  if (activeEngineInstance === engine) {
    activeEngineInstance = enginesByFileId.values().next().value ?? null;
  }
  notifyEngineListeners();
}

export function getEditorEngineForFile(fileId: string): IEditorEngine | null {
  return enginesByFileId.get(fileId) ?? null;
}

export function getAllRegisteredEngines(): ReadonlyMap<string, IEditorEngine> {
  return enginesByFileId;
}

export function setActiveEditorEngine(engine: IEditorEngine | null): void {
  activeEngineInstance = engine;
  notifyEngineListeners();
}

export function getActiveEditorEngine(): IEditorEngine | null {
  return activeEngineInstance;
}

export function getActiveEditorContent(): string {
  return activeEngineInstance?.getContent() ?? '';
}

export function setActivePdfViewer(viewer: unknown): void {
  activeViewerInstance = viewer;
}

export function getActivePdfViewer(): unknown {
  return activeViewerInstance;
}
