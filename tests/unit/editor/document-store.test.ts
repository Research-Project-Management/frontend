import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentStore, documentStore } from '@/features/editor/domain/document/document-store';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';

describe('DocumentStore Deep Module Architecture (Matt Pocock Codebase Design)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    documentStore.clear();
    documentStore.storage.clearMemory();
    try {
      localStorage.clear();
    } catch {}
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('provides a unified interface over RAM and persistent drafts', () => {
    documentStore.warm('doc-1', {
      content: '\\section{Unified Store}',
      filePath: 'main.tex',
      projectId: 'proj-1',
    });

    expect(documentStore.has('doc-1')).toBe(true);
    expect(documentStore.getContent('doc-1')).toBe('\\section{Unified Store}');
    expect(documentStore.isDirty('doc-1')).toBe(false);
  });

  it('updates content, tracks dirty state in RAM, and automatically saves draft to persistence', async () => {
    const saveDraftSpy = vi.spyOn(draftStorageService, 'saveDraft');

    documentStore.warm('doc-2', {
      content: 'Initial text',
      filePath: 'ch1.tex',
      projectId: 'proj-1',
    });

    documentStore.updateContent('doc-2', 'Modified text', { isDirty: true });

    expect(documentStore.getContent('doc-2')).toBe('Modified text');
    expect(documentStore.isDirty('doc-2')).toBe(true);
    expect(saveDraftSpy).toHaveBeenCalledWith('doc-2', 'Modified text', 'proj-1', 'ch1.tex');
  });

  it('marks clean and automatically clears persistent draft snapshot upon sync', async () => {
    const clearDraftSpy = vi.spyOn(draftStorageService, 'clearDraft');

    documentStore.warm('doc-3', { content: 'Synced text' });
    documentStore.markDirty('doc-3');
    expect(documentStore.isDirty('doc-3')).toBe(true);

    documentStore.markClean('doc-3');

    expect(documentStore.isDirty('doc-3')).toBe(false);
    expect(clearDraftSpy).toHaveBeenCalledWith('doc-3');
  });

  it('checks draft recovery correctly comparing RAM dirty model and server content', () => {
    documentStore.warm('conflict-doc', {
      content: 'Local unpersisted changes',
      filePath: 'section.tex',
      projectId: 'proj-x',
    });
    documentStore.markDirty('conflict-doc');

    const recovery = documentStore.checkDraftRecovery('conflict-doc', 'Old server version');
    expect(recovery.hasRecoverableDraft).toBe(true);
    expect(recovery.draft?.content).toBe('Local unpersisted changes');

    const noRecovery = documentStore.checkDraftRecovery('conflict-doc', 'Local unpersisted changes');
    expect(noRecovery.hasRecoverableDraft).toBe(false);
  });

  it('asynchronously hydrates evicted model from persistent storage tier', async () => {
    await draftStorageService.saveDraft('evicted-doc', 'Recovered from IndexedDB', 'proj-x', 'file.tex');

    // Not in RAM initially
    expect(documentStore.has('evicted-doc')).toBe(false);

    const model = await documentStore.getModelAsync('evicted-doc', 'Fallback text', 'file.tex', 'proj-x');

    expect(model.content).toBe('Recovered from IndexedDB');
    expect(documentStore.has('evicted-doc')).toBe(true);
  });
});
