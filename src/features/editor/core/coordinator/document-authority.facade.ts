/**
 * document-authority.facade.ts
 *
 * Centralized Document Authority & Overlay Read Model (Core Workbench Deep Module).
 *
 * Unifies:
 * 1. Live CodeMirror Engine Buffers (`getEditorEngineForFile` / `getActiveEditorEngine`)
 * 2. In-Memory LRU Document Cache (`lruDocumentCache`)
 * 3. Active Page & Workspace Tab State (`usePageStore`, `useWorkspaceStore`)
 * 4. Server Project Files Read Model (`hydrateServerProjectFiles` -> `getOverlayFiles`)
 *
 * Provides a single authoritative API so UI viewlets (SearchTab, OutlineSection,
 * CitationTab, Compiler, Navigation) never need ad-hoc fallback chains.
 */

import {
  getActiveEditorEngine,
  getEditorEngineForFile,
} from '@/features/editor/core/bus/command-bus';
import type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import {
  extractDocumentContentString,
  extractProjectId,
  type Page,
  type PageFile,
} from '@/features/editor/domain/types/core.types';

export interface ProjectFileReadModel {
  id: string;
  title: string;
  path: string;
  content: string;
  isCurrent: boolean;
  isDirty: boolean;
  projectId: string;
}

export interface ActiveDocumentDescriptor {
  fileId: string | null;
  title: string;
  path: string;
  content: string;
  projectId: string;
  parentPageId: string | null;
  isDirty: boolean;
}

export class DocumentAuthorityRegistry {
  private readonly serverFilesByProject = new Map<
    string,
    Array<{ id: string; title: string; path: string; content: string }>
  >();
  private workspaceSubUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initUnidirectionalWorkspaceSync();
  }

  /**
   * Unidirectional synchronization: when `useWorkspaceStore` changes the active tab for a project,
   * automatically keeps `lruDocumentCache.activeFileId` aligned.
   */
  public initUnidirectionalWorkspaceSync(): void {
    if (this.workspaceSubUnsubscribe) return;
    this.workspaceSubUnsubscribe = useWorkspaceStore.subscribe(
      (state) => state.activeByProject,
      (activeByProject) => {
        const pageState = usePageStore.getState();
        const projectKey =
          pageState.parentPageId ||
          pageState.projectId ||
          pageState.currentPage?.id ||
          '';
        const nextActiveId = projectKey ? activeByProject[projectKey] : null;
        if (nextActiveId && lruDocumentCache.getActiveFileId() !== nextActiveId) {
          lruDocumentCache.setActiveFileId(nextActiveId);
        }
      },
    );
  }

  /**
   * Retrieves the mounted CodeMirror engine for a specific fileId (handles split-panes).
   */
  public getEditorEngineForFile(fileId: string): IEditorEngine | null {
    return getEditorEngineForFile(fileId);
  }

  /**
   * Retrieves the currently active CodeMirror engine.
   */
  public getActiveEditorEngine(): IEditorEngine | null {
    return getActiveEditorEngine();
  }

  /**
   * Resolves the canonical project ID and root page ID from store state and optional route params.
   */
  public resolveProjectContext(params?: {
    projectId?: string | null;
    pageId?: string | null;
  }): { projectId: string; rootPageId: string; activeFileId: string | null } {
    const pageState = usePageStore.getState();
    const currentPage = pageState.currentPage;
    const activeFilePage = pageState.activeFilePage;

    const rootPageId =
      params?.pageId ||
      pageState.parentPageId ||
      params?.projectId ||
      currentPage?.id ||
      '';

    const projectId =
      params?.projectId ||
      pageState.projectId ||
      extractProjectId(currentPage) ||
      rootPageId ||
      '';

    const wsState = useWorkspaceStore.getState();
    const wsActiveId =
      (rootPageId ? wsState.activeByProject[rootPageId] : null) ||
      (projectId ? wsState.activeByProject[projectId] : null) ||
      null;

    const activeFileId =
      activeFilePage?.id ||
      pageState.activePageId ||
      wsActiveId ||
      currentPage?.id ||
      null;

    return { projectId, rootPageId, activeFileId };
  }

  /**
   * Authoritative content resolution for a specific fileId:
   * Priority:
   * 1. Mounted CodeMirror Engine for `fileId` (`getEditorEngineForFile(fileId)`)
   * 2. Active CodeMirror Engine if `fileId` is the active document
   * 3. In-memory LRU Document Cache (`lruDocumentCache.getModel(fileId)`)
   * 4. `usePageStore` (`activeFilePage` / `currentPage`)
   * 5. Hydrated Server Read Model (`serverFilesByProject`)
   */
  public getDocumentContent(fileId?: string | null): string {
    const { activeFileId, projectId, rootPageId } = this.resolveProjectContext();
    const targetId = fileId || activeFileId;
    if (!targetId) {
      const activeEngine = getActiveEditorEngine();
      return activeEngine?.getContent() ?? '';
    }

    // 1. Per-file mounted CodeMirror instance (handles both primary & secondary split panes)
    const fileEngine = getEditorEngineForFile(targetId);
    if (fileEngine) {
      const liveText = fileEngine.getContent();
      if (typeof liveText === 'string') {
        return liveText;
      }
    }

    // 2. Active CodeMirror instance if targetId matches activeFileId
    if (targetId === activeFileId) {
      const activeEngine = getActiveEditorEngine();
      const activeText = activeEngine?.getContent();
      if (typeof activeText === 'string' && activeText.length > 0) {
        return activeText;
      }
    }

    // 3. In-Memory LRU Document Cache
    const cachedModel = lruDocumentCache.getModel(targetId);
    if (cachedModel && typeof cachedModel.content === 'string') {
      return cachedModel.content;
    }

    // 4. Page Store fallback
    const pageState = usePageStore.getState();
    if (pageState.activeFilePage?.id === targetId) {
      return extractDocumentContentString(pageState.activeFilePage.content);
    }
    if (pageState.currentPage?.id === targetId) {
      return extractDocumentContentString(pageState.currentPage.content);
    }

    // 5. Server Project Files Read Model
    for (const key of [projectId, rootPageId]) {
      if (!key) continue;
      const list = this.serverFilesByProject.get(key);
      const found = list?.find((f) => f.id === targetId || f.path === targetId || f.title === targetId);
      if (found) return found.content;
    }

    return '';
  }

  /**
   * Returns a complete snapshot of the currently active document.
   */
  public getActiveDocumentSnapshot(): ActiveDocumentDescriptor {
    const { projectId, rootPageId, activeFileId } = this.resolveProjectContext();
    const pageState = usePageStore.getState();
    const docObj = pageState.activeFilePage || pageState.currentPage;
    const cached = activeFileId ? lruDocumentCache.getModel(activeFileId) : undefined;
    const title = cached?.filePath || docObj?.title || 'main.tex';
    const content = this.getDocumentContent(activeFileId);

    return {
      fileId: activeFileId,
      title,
      path: cached?.filePath || title,
      content,
      projectId,
      parentPageId: rootPageId || null,
      isDirty: Boolean(cached?.isDirty),
    };
  }

  /**
   * Hydrates server project files into the centralized read model, warming non-dirty
   * LRU models and updating the LaTeX DAG & Symbols Index in one place.
   */
  public hydrateServerProjectFiles(
    projectKey: string,
    rawFiles: ReadonlyArray<Page | PageFile | { id: string; title?: string; name?: string; path?: string; content?: unknown }>,
  ): ProjectFileReadModel[] {
    if (!projectKey || !Array.isArray(rawFiles)) return [];

    const normalized: Array<{ id: string; title: string; path: string; content: string }> = [];
    const indexPayload: Array<{ id: string; path: string; content: string }> = [];

    for (const f of rawFiles) {
      if (!f || !f.id) continue;
      const rawRecord = f as {
        id: string;
        title?: string;
        name?: string;
        path?: string;
        content?: unknown;
      };
      const title = rawRecord.title || rawRecord.name || rawRecord.path || 'untitled.tex';
      const path = rawRecord.path || title;
      const serverContent = extractDocumentContentString(rawRecord.content);

      normalized.push({
        id: rawRecord.id,
        title,
        path,
        content: serverContent,
      });

      // Only update LRU cache if the model is not currently dirty
      const existing = lruDocumentCache.getModel(rawRecord.id);
      if (existing && !existing.isDirty && serverContent && existing.content !== serverContent) {
        lruDocumentCache.registerModel(rawRecord.id, {
          content: serverContent,
          filePath: path,
          projectId: projectKey,
        });
      }

      const effectiveContent = existing?.isDirty ? existing.content : serverContent;
      if (/\.(tex|bib|sty|cls)$/i.test(path)) {
        indexPayload.push({ id: rawRecord.id, path, content: effectiveContent });
      }
    }

    this.serverFilesByProject.set(projectKey, normalized);

    if (indexPayload.length > 0) {
      for (const item of indexPayload) {
        latexDagEngine.parseAndRegister(item.path, item.content, item.id);
        latexSymbolsIndex.indexFile(item.id, item.path, item.content);
      }
    }

    return this.getOverlayFiles(projectKey, rawFiles);
  }

  /**
   * Returns the unified list of project files with live overlay content from
   * CodeMirror engines and `lruDocumentCache` merged on top of server files.
   */
  public getOverlayFiles(
    projectKey?: string | null,
    fallbackServerFiles?: ReadonlyArray<{ id: string; title?: string; name?: string; path?: string; content?: unknown }>,
  ): ProjectFileReadModel[] {
    const { projectId, rootPageId, activeFileId } = this.resolveProjectContext({
      projectId: projectKey,
    });
    const effectiveKey = projectKey || rootPageId || projectId;

    const baseList =
      (fallbackServerFiles && fallbackServerFiles.length > 0
        ? fallbackServerFiles.map((f) => ({
            id: f.id,
            title: f.title || f.name || f.path || 'untitled.tex',
            path: f.path || f.title || f.name || 'untitled.tex',
            content: extractDocumentContentString(f.content),
          }))
        : (projectKey ? this.serverFilesByProject.get(projectKey) : undefined) ??
          (projectId ? this.serverFilesByProject.get(projectId) : undefined) ??
          (rootPageId ? this.serverFilesByProject.get(rootPageId) : undefined)) ?? [];

    if (baseList.length === 0) {
      const pageState = usePageStore.getState();
      const fallbackDoc = pageState.activeFilePage || pageState.currentPage;
      const fallbackId = fallbackDoc?.id || activeFileId || 'main';
      const fallbackTitle = fallbackDoc?.title || 'main.tex';
      const cached = lruDocumentCache.getModel(fallbackId);
      return [
        {
          id: fallbackId,
          title: fallbackTitle,
          path: fallbackTitle,
          content: this.getDocumentContent(fallbackId),
          isCurrent: true,
          isDirty: Boolean(cached?.isDirty),
          projectId: effectiveKey || '',
        },
      ];
    }

    return baseList.map((file) => {
      const isCurrent = file.id === activeFileId;
      const cached = lruDocumentCache.getModel(file.id);
      const fileEngine = getEditorEngineForFile(file.id);
      const liveContent =
        fileEngine?.getContent() ??
        (isCurrent ? getActiveEditorEngine()?.getContent() : undefined) ??
        cached?.content ??
        file.content;

      return {
        id: file.id,
        title: file.title,
        path: file.path,
        content: typeof liveContent === 'string' ? liveContent : file.content,
        isCurrent,
        isDirty: Boolean(cached?.isDirty),
        projectId: effectiveKey || '',
      };
    });
  }

  public clearProjectCache(projectKey?: string): void {
    if (projectKey) {
      this.serverFilesByProject.delete(projectKey);
    } else {
      this.serverFilesByProject.clear();
    }
  }
}

export const documentAuthority = new DocumentAuthorityRegistry();
