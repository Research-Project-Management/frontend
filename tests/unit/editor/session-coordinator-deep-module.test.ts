import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SessionCoordinatorRegistry,
  type DocumentPersistencePort,
} from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { useConnectivityStore } from '@/features/editor/core';

describe('SessionCoordinator as Deep Module (Matt Pocock Codebase Design)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConnectivityStore.setState({ isOnline: true, syncStatus: 'synced', pendingSaveCount: 0 });
    lruDocumentCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses injected in-memory persistence adapter across the seam without monkey-patching', async () => {
    const savedDocs = new Map<string, string>();
    const inMemoryAdapter: DocumentPersistencePort = {
      updateContent: async (fileId: string, content: string) => {
        savedDocs.set(fileId, content);
      },
    };

    const session = new SessionCoordinatorRegistry({
      persistenceAdapter: inMemoryAdapter,
      autoSaveDelay: 200,
    });

    lruDocumentCache.registerModel('paper.tex', { content: '\\section{Original}' });
    expect(session.getFsmState('paper.tex')).toBe('idle');

    // Notify local change
    session.notifyContentChange('paper.tex', '\\section{Edited}', { isRealtimeActive: false });
    expect(session.getFsmState('paper.tex')).toBe('dirty');

    // Flush file
    const clean = await session.flushFile('paper.tex');
    expect(clean).toBe(true);
    expect(session.getFsmState('paper.tex')).toBe('idle');
    expect(savedDocs.get('paper.tex')).toBe('\\section{Edited}');
  });

  it('handles FSM state transitions during tab switching', () => {
    const session = new SessionCoordinatorRegistry();
    lruDocumentCache.registerModel('tab1.tex', { content: 'Doc 1' });
    lruDocumentCache.registerModel('tab2.tex', { content: 'Doc 2' });

    session.switchTab(null, 'tab1.tex');
    expect(session.getFsmState('tab1.tex')).toBe('active');

    session.switchTab('tab1.tex', 'tab2.tex');
    expect(session.getFsmState('tab1.tex')).toBe('idle');
    expect(session.getFsmState('tab2.tex')).toBe('active');

    session.closeTab('tab1.tex');
    expect(session.getFsmState('tab1.tex')).toBe('evicted');
  });

  it('survives mid-flight edits during async save without dropping dirty flag', async () => {
    let finishSave: () => void = () => {};
    const deferredAdapter: DocumentPersistencePort = {
      updateContent: async () => {
        return new Promise<void>((resolve) => {
          finishSave = resolve;
        });
      },
    };

    const session = new SessionCoordinatorRegistry({
      persistenceAdapter: deferredAdapter,
    });

    lruDocumentCache.registerModel('doc.tex', { content: 'v1' });
    session.notifyContentChange('doc.tex', 'v2', { isRealtimeActive: false });
    expect(session.getFsmState('doc.tex')).toBe('dirty');

    // Start save
    const flushPromise = session.flushFile('doc.tex');
    expect(session.getFsmState('doc.tex')).toBe('saving');

    // User types 'v3' while save of 'v2' is in-flight!
    session.notifyContentChange('doc.tex', 'v3', { isRealtimeActive: false });
    expect(session.getFsmState('doc.tex')).toBe('saving');

    // Server acknowledges save of 'v2'
    finishSave();
    const clean = await flushPromise;

    // Must be FALSE because 'v3' is still dirty!
    expect(clean).toBe(false);
    expect(session.getFsmState('doc.tex')).toBe('dirty');
    expect(lruDocumentCache.getModel('doc.tex')?.isDirty).toBe(true);
  });
});
