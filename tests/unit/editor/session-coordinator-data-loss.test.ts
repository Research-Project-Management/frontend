import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';
import {
  sessionCoordinator,
  shouldUseRealtimePersistence,
  type DocumentConflict,
} from '@/features/editor/core';
import { useConnectivityStore } from '@/features/editor/core';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now()}-${seq++}`;

describe('Session coordinator data-loss guards', () => {
  beforeEach(() => {
    useConnectivityStore.getState().recordOnline?.();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('#2 realtime persistence policy', () => {
    it('requires an actually connected provider', () => {
      expect(shouldUseRealtimePersistence({ hasYText: true, isOnline: true, isProviderConnected: true })).toBe(true);
      expect(shouldUseRealtimePersistence({ hasYText: true, isOnline: true, isProviderConnected: false })).toBe(false);
      expect(shouldUseRealtimePersistence({ hasYText: true, isOnline: false, isProviderConnected: true })).toBe(false);
      expect(shouldUseRealtimePersistence({ hasYText: false, isOnline: true, isProviderConnected: true })).toBe(false);
    });

    it('schedules HTTP autosave when the realtime provider disconnects with dirty content', async () => {
      vi.useFakeTimers();
      const id = nextId('rt');
      const spy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue(undefined as never);
      lruDocumentCache.registerModel(id, { content: 'base' });
      sessionCoordinator.setRealtimeConnected(id, true);
      sessionCoordinator.notifyContentChange(id, 'typed while connected', { isRealtimeActive: true, skipAutoCompile: true });
      await vi.advanceTimersByTimeAsync(2000);
      expect(spy).not.toHaveBeenCalled();

      sessionCoordinator.setRealtimeConnected(id, false);
      await vi.advanceTimersByTimeAsync(2500);
      expect(spy).toHaveBeenCalledWith(id, 'typed while connected');
      sessionCoordinator.clearRealtimeStatus(id);
    });
  });

  describe('#4 remote-origin changes', () => {
    it('do not mark a clean model dirty', () => {
      const id = nextId('remote');
      lruDocumentCache.registerModel(id, { content: 'a' });
      sessionCoordinator.notifyContentChange(id, 'a + remote', { origin: 'remote' });
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(false);
      expect(lruDocumentCache.getModel(id)?.content).toBe('a + remote');
    });

    it('do not clear an existing local dirty flag', () => {
      const id = nextId('remote-dirty');
      lruDocumentCache.registerModel(id, { content: 'a' });
      lruDocumentCache.updateContent(id, 'a local', true);
      sessionCoordinator.notifyContentChange(id, 'a local + remote', { origin: 'remote' });
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    });
  });

  describe('#5 remote content-updated conflicts', () => {
    it('surfaces a conflict instead of silently dropping remote content', () => {
      const id = nextId('conflict');
      lruDocumentCache.registerModel(id, { content: 'server v1' });
      lruDocumentCache.updateContent(id, 'local edit', true);
      const seen: DocumentConflict[] = [];
      const unsub = sessionCoordinator.onConflict((c) => seen.push(c));

      sessionCoordinator.handleRemoteContentUpdated(id, 'server v2');

      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ fileId: id, localContent: 'local edit', remoteContent: 'server v2' });
      expect(lruDocumentCache.getModel(id)?.content).toBe('local edit');
      expect(sessionCoordinator.getConflict(id)).toBeDefined();

      sessionCoordinator.resolveConflict(id, 'take-remote');
      expect(lruDocumentCache.getModel(id)?.content).toBe('server v2');
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(false);
      expect(sessionCoordinator.getConflict(id)).toBeUndefined();
      unsub();
    });

    it('applies remote content directly when local is clean', () => {
      const id = nextId('clean');
      lruDocumentCache.registerModel(id, { content: 'v1' });
      const listener = vi.fn();
      const unsub = sessionCoordinator.onConflict(listener);
      sessionCoordinator.handleRemoteContentUpdated(id, 'v2');
      expect(lruDocumentCache.getModel(id)?.content).toBe('v2');
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });

    it('keep-local keeps the local edits dirty', () => {
      const id = nextId('keep');
      lruDocumentCache.registerModel(id, { content: 'v1' });
      lruDocumentCache.updateContent(id, 'mine', true);
      sessionCoordinator.handleRemoteContentUpdated(id, 'theirs');
      sessionCoordinator.resolveConflict(id, 'keep-local');
      expect(lruDocumentCache.getModel(id)?.content).toBe('mine');
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    });
  });

  describe('#6 flush race', () => {
    it('flushFile does not mark clean when content changed mid-flight', async () => {
      const id = nextId('race');
      lruDocumentCache.registerModel(id, { content: 'v0' });
      lruDocumentCache.updateContent(id, 'v1', true);
      let release!: () => void;
      vi.spyOn(manuscriptService.docs, 'updateContent').mockImplementation(
        () => new Promise((r) => (release = () => r(undefined as never)))
      );
      const p = sessionCoordinator.flushFile(id);
      await Promise.resolve();
      lruDocumentCache.updateContent(id, 'v2 typed during save', true);
      release();
      const clean = await p;
      expect(clean).toBe(false);
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
      expect(lruDocumentCache.getModel(id)?.content).toBe('v2 typed during save');
    });

    it('flushFile marks clean when content is unchanged', async () => {
      const id = nextId('ok');
      lruDocumentCache.registerModel(id, { content: 'v0' });
      lruDocumentCache.updateContent(id, 'v1', true);
      vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue(undefined as never);
      expect(await sessionCoordinator.flushFile(id)).toBe(true);
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(false);
    });

    it('flushAllPending keeps files dirty that changed mid-flight', async () => {
      const id = nextId('all');
      lruDocumentCache.registerModel(id, { content: 'v0' });
      lruDocumentCache.updateContent(id, 'v1', true);
      const releases: Array<() => void> = [];
      vi.spyOn(manuscriptService.docs, 'updateContent').mockImplementation(
        () => new Promise((r) => releases.push(() => r(undefined as never)))
      );
      const p = sessionCoordinator.flushAllPending();
      await Promise.resolve();
      lruDocumentCache.updateContent(id, 'v2', true);
      releases.forEach((release) => release());
      await p;
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    });
  });

  describe('#1 draft decision gate', () => {
    it('does not overwrite or clear the stored draft while a decision is pending', async () => {
      const id = nextId('draft');
      await draftStorageService.saveDraft(id, 'precious offline draft', 'proj');
      sessionCoordinator.beginDraftDecision(id);
      sessionCoordinator.saveDraftSnapshot(id, 'stale server content', 'proj');
      sessionCoordinator.clearDraftSnapshot(id);
      sessionCoordinator.flushPendingDrafts();
      const check = await sessionCoordinator.checkDraftRecoveryAsync(id, 'stale server content');
      expect(check.hasRecoverableDraft).toBe(true);
      expect(check.draft?.content).toBe('precious offline draft');

      sessionCoordinator.restoreDraft(id, check.draft!.content);
      expect(sessionCoordinator.isDraftDecisionPending(id)).toBe(false);
      expect(lruDocumentCache.getModel(id)?.content).toBe('precious offline draft');
      expect(lruDocumentCache.getModel(id)?.isDirty).toBe(true);
    });

    it('discardDraft removes the draft and keeps server version', async () => {
      const id = nextId('discard');
      await draftStorageService.saveDraft(id, 'old draft', 'proj');
      sessionCoordinator.beginDraftDecision(id);
      sessionCoordinator.discardDraft(id);
      await new Promise((r) => setTimeout(r, 10));
      const check = await sessionCoordinator.checkDraftRecoveryAsync(id, 'server');
      expect(check.hasRecoverableDraft).toBe(false);
    });
  });
});
