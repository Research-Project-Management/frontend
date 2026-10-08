/**
 * editor-review-history-e2e.test.ts
 *
 * Comprehensive End-to-End Suite for Track Changes, Review Mode,
 * and Project Version History (Overleaf Parity).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import {
  createTrackChangesExtension,
  trackChangesExtension,
  setReviewModeEffect,
  setViewModeEffect,
  setTrackChangesDataEffect,
  trackChangesStateField,
  trackChangesDecorationsField,
} from '@/features/editor/engines/extensions/track-changes.extension';
import { reviewCoordinator } from '@/features/editor/coordinators/review.coordinator';
import { suggestionService } from '@/features/editor/coordinators/services/suggestion.service';
import { historyService } from '@/features/editor/coordinators/services/history.service';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import type { TrackChangeDto, CommentThreadDto } from '@/features/editor/coordinators/services/manuscript.service';
import type { ProjectVersionListItem, ProjectDiffResponse } from '@/features/editor/domain/types/history.types';

describe('Track Changes, Review Mode & Version History Subsystem', () => {
  // ─── 1. CodeMirror 6 Track Changes Extension ────────────────────────────────

  describe('1. CodeMirror 6 Track Changes Extension (track-changes.extension.ts)', () => {
    let container: HTMLDivElement;
    let view: EditorView;

    const initialDoc = [
      '\\documentclass{article}',
      '\\begin{document}',
      'Hello world, this is a collaborative manuscript.',
      '\\end{document}',
    ].join('\n');

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);

      const state = EditorState.create({
        doc: initialDoc,
        extensions: [
          trackChangesExtension({
            reviewMode: 'on',
            viewMode: 'show',
          }),
        ],
      });

      view = new EditorView({
        state,
        parent: container,
      });
    });

    afterEach(() => {
      view?.destroy();
      container?.remove();
    });

    it('initializes track changes state with provided options', () => {
      const stateVal = view.state.field(trackChangesStateField);
      expect(stateVal).toBeDefined();
      expect(stateVal.reviewMode).toBe(true);
      expect(stateVal.viewMode).toBe('show');
      expect(stateVal.suggestions).toEqual([]);
      expect(stateVal.comments).toEqual([]);
    });

    it('updates reviewMode and viewMode dynamically via StateEffects', () => {
      // Toggle reviewMode off
      view.dispatch({
        effects: [setReviewModeEffect.of(false)],
      });
      let stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.reviewMode).toBe(false);

      // Toggle viewMode to hide
      view.dispatch({
        effects: [setViewModeEffect.of('hide')],
      });
      stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.viewMode).toBe('hide');
    });

    it('renders insert and delete decorations accurately in "show" mode', () => {
      const mockChanges: TrackChangeDto[] = [
        {
          id: 'change-1',
          projectId: 'p-1',
          docId: 'doc-1',
          type: 'insert',
          text: 'collaborative ',
          fromIndex: 58,
          toIndex: 72,
          authorId: 'user-alice',
          authorName: 'Alice',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'change-2',
          projectId: 'p-1',
          docId: 'doc-1',
          type: 'delete',
          text: 'world',
          fromIndex: 47,
          toIndex: 52,
          authorId: 'user-bob',
          authorName: 'Bob',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ];

      view.dispatch({
        effects: [setTrackChangesDataEffect.of({ changes: mockChanges })],
      });

      const stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.suggestions).toHaveLength(2);

      const decSet = view.state.field(trackChangesDecorationsField);
      expect(decSet.size).toBe(2);

      // Verify decoration attributes
      const classes: string[] = [];
      decSet.between(0, view.state.doc.length, (from, to, value) => {
        classes.push(value.spec.class || '');
      });

      expect(classes.some((c) => c.includes('cm-track-change-insert'))).toBe(true);
      expect(classes.some((c) => c.includes('cm-track-change-delete'))).toBe(true);
    });

    it('hides deleted text decorations when viewMode is switched to "hide"', () => {
      const mockChanges: TrackChangeDto[] = [
        {
          id: 'change-del-1',
          projectId: 'p-1',
          docId: 'doc-1',
          type: 'delete',
          text: 'world',
          fromIndex: 47,
          toIndex: 52,
          authorId: 'user-bob',
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ];

      view.dispatch({
        effects: [
          setTrackChangesDataEffect.of({ changes: mockChanges }),
          setViewModeEffect.of('hide'),
        ],
      });

      const stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.viewMode).toBe('hide');

      const decSet = view.state.field(trackChangesDecorationsField);
      let hasReplacedRange = false;
      decSet.between(0, view.state.doc.length, (from, to, value) => {
        if ((value.spec as any).inclusive === false || !value.spec.class) {
          hasReplacedRange = true;
        }
      });

      expect(hasReplacedRange).toBe(true);
    });

    it('populates comment gutter markers correctly', () => {
      const mockComments: CommentThreadDto[] = [
        {
          id: 'thread-1',
          projectId: 'p-1',
          docId: 'doc-1',
          authorId: 'user-charlie',
          content: 'Consider citing Doe et al. here',
          fromIndex: 45,
          toIndex: 55,
          resolved: false,
          replies: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      view.dispatch({
        effects: [setTrackChangesDataEffect.of({ comments: mockComments })],
      });

      const stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.comments).toHaveLength(1);
    });
  });

  // ─── 2. Review Coordinator Orchestration ──────────────────────────────────

  describe('2. ReviewCoordinator (review.coordinator.ts)', () => {
    let container: HTMLDivElement;
    let view: EditorView;

    beforeEach(() => {
      setActiveEditorEngine(null);
      container = document.createElement('div');
      document.body.appendChild(container);

      const state = EditorState.create({
        doc: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n',
        extensions: [trackChangesExtension()],
      });

      view = new EditorView({
        state,
        parent: container,
      });

      reviewCoordinator.bindEditorView(view, 'doc-123');
    });

    afterEach(() => {
      reviewCoordinator.bindEditorView(null, 'doc-123');
      setActiveEditorEngine(null);
      view?.destroy();
      container?.remove();
      vi.clearAllMocks();
    });

    it('syncs editor decorations through reviewCoordinator.syncEditorDecorations', () => {
      const mockSuggestions = [
        {
          id: 'sug-1',
          pageId: 'doc-123',
          projectId: 'proj-1',
          type: 'insert' as const,
          originalText: '',
          suggestedText: 'New text',
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          author: { id: 'a1', name: 'Author 1' },
          fromLine: 2,
          fromColumn: 1,
          toLine: 2,
          toColumn: 5,
        },
      ];

      reviewCoordinator.syncEditorDecorations(null, mockSuggestions, [], 'show', true);

      const stateVal = view.state.field(trackChangesStateField);
      expect(stateVal.suggestions).toHaveLength(1);
      expect(stateVal.suggestions[0].id).toBe('sug-1');
      expect(stateVal.suggestions[0].suggestedText).toBe('New text');
    });

    it('navigates cursor to specific line via navigateToLine', () => {
      reviewCoordinator.navigateToLine(3);
      const linePos = view.state.doc.line(3);
      expect(view.state.selection.main.head).toBe(linePos.from);
    });

    it('delegates acceptSuggestion to suggestionService and dispatches update', async () => {
      const spyAccept = vi
        .spyOn(suggestionService, 'acceptSuggestion')
        .mockResolvedValue(undefined as any);

      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const ok = await reviewCoordinator.acceptSuggestion('doc-123', 'sug-1');

      expect(ok).toBe(true);
      expect(spyAccept).toHaveBeenCalledWith('doc-123', 'sug-1');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:review-event',
          pageId: 'doc-123',
          event: 'suggestion:accepted',
          payload: { suggestionId: 'sug-1' },
        })
      );
    });

    it('delegates rejectSuggestion to suggestionService and dispatches update', async () => {
      const spyReject = vi
        .spyOn(suggestionService, 'rejectSuggestion')
        .mockResolvedValue(undefined as any);

      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const ok = await reviewCoordinator.rejectSuggestion('doc-123', 'sug-2');

      expect(ok).toBe(true);
      expect(spyReject).toHaveBeenCalledWith('doc-123', 'sug-2');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:review-event',
          pageId: 'doc-123',
          event: 'suggestion:rejected',
          payload: { suggestionId: 'sug-2' },
        })
      );
    });

    it('performs acceptAll and rejectAll batch operations via suggestionService', async () => {
      const spyAcceptAll = vi
        .spyOn(suggestionService, 'acceptAllSuggestions')
        .mockResolvedValue(undefined as any);

      const spyRejectAll = vi
        .spyOn(suggestionService, 'rejectAllSuggestions')
        .mockResolvedValue(undefined as any);

      await reviewCoordinator.acceptAll('doc-123');
      expect(spyAcceptAll).toHaveBeenCalledWith('doc-123');

      await reviewCoordinator.rejectAll('doc-123');
      expect(spyRejectAll).toHaveBeenCalledWith('doc-123');
    });
  });

  // ─── 3. Project History, Diffs & Rollback Engine ───────────────────────────

  describe('3. Project History & Snapshot Diff Engine (history.service.ts)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('fetches project versions timeline with snapshots and labels', async () => {
      const mockVersions: ProjectVersionListItem[] = [
        {
          id: 'ver-3',
          projectId: 'p-1',
          version: 3,
          summary: 'Added bibliography',
          isAutomatic: false,
          fileCount: 3,
          labels: [{ id: 'lbl-1', version: 3, label: 'Camera-Ready', createdAt: new Date().toISOString() }],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ver-2',
          projectId: 'p-1',
          version: 2,
          summary: 'Auto-save after section 2',
          isAutomatic: true,
          fileCount: 2,
          labels: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'ver-1',
          projectId: 'p-1',
          version: 1,
          summary: 'Initial project setup',
          isAutomatic: false,
          fileCount: 1,
          labels: [{ id: 'lbl-0', version: 1, label: 'Initial Draft', createdAt: new Date().toISOString() }],
          createdAt: new Date().toISOString(),
        },
      ];

      vi.spyOn(manuscriptService.history, 'getProjectVersions').mockResolvedValue(mockVersions);

      const list = await historyService.getProjectVersions('p-1');
      expect(list).toHaveLength(3);
      expect(list[0].version).toBe(3);
      expect(list[0].labels[0].label).toBe('Camera-Ready');
    });

    it('computes diff between base and target versions with additions, deletions, and hunks', async () => {
      const mockDiffResponse: ProjectDiffResponse = {
        baseVersion: 1,
        targetVersion: 2,
        totalAdditions: 12,
        totalDeletions: 3,
        filesChanged: 1,
        files: [
          {
            path: 'main.tex',
            status: 'modified',
            type: 'doc',
            additions: 12,
            deletions: 3,
            hunks: [
              {
                oldStartLine: 10,
                oldLineCount: 3,
                newStartLine: 10,
                newLineCount: 5,
                lines: [
                  { type: 'unchanged', text: '\\section{Introduction}', oldLineNumber: 10, newLineNumber: 10 },
                  {
                    type: 'deleted',
                    text: 'Old introduction text.',
                    oldLineNumber: 11,
                    words: [{ type: 'deleted', text: 'Old introduction text.' }],
                  },
                  {
                    type: 'added',
                    text: 'Modern introduction text with citations.',
                    newLineNumber: 11,
                    words: [{ type: 'added', text: 'Modern introduction text with citations.' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      vi.spyOn(manuscriptService.history, 'compareProjectVersions').mockResolvedValue(mockDiffResponse);

      const diff = await historyService.compareProjectVersions('p-1', 1, 2);
      expect(diff).not.toBeNull();
      expect(diff?.totalAdditions).toBe(12);
      expect(diff?.totalDeletions).toBe(3);
      expect(diff?.files).toHaveLength(1);
      expect(diff?.files[0].path).toBe('main.tex');
      expect(diff?.files[0].hunks[0].lines).toHaveLength(3);
    });

    it('attaches and deletes milestone labels on a version', async () => {
      const spyLabel = vi.spyOn(manuscriptService.history, 'labelProjectVersion').mockResolvedValue({
        id: 'lbl-new',
        version: 2,
        label: 'Pre-Submission',
      });

      const spyDelete = vi.spyOn(manuscriptService.history, 'deleteProjectLabel').mockResolvedValue();

      await historyService.labelProjectVersion('p-1', 2, 'Pre-Submission');
      expect(spyLabel).toHaveBeenCalledWith('p-1', 2, 'Pre-Submission');

      await historyService.deleteProjectLabel('p-1', 'lbl-new');
      expect(spyDelete).toHaveBeenCalledWith('p-1', 'lbl-new');
    });

    it('restores project files to a historical version with 1-click rollback', async () => {
      const spyRestore = vi.spyOn(manuscriptService.history, 'restoreProjectVersion').mockResolvedValue({
        restoredSnapshot: { version: 1 } as any,
        newSnapshot: { version: 4 } as any,
        restoreResult: { restoredFilesCount: 2, restoredDocIds: ['doc-1', 'doc-2'] },
      });

      const result = await historyService.restoreProjectVersion('p-1', 1);
      expect(spyRestore).toHaveBeenCalledWith('p-1', 1);
      expect(result.restoreResult.restoredFilesCount).toBe(2);
      expect(result.newSnapshot.version).toBe(4);
    });

    it('creates on-demand snapshot checkpoints', async () => {
      const spyCreate = vi.spyOn(manuscriptService.history, 'createProjectSnapshot').mockResolvedValue({
        id: 'snap-new',
        version: 5,
        summary: 'Manual checkpoint before refactor',
      } as any);

      const snap = await historyService.createProjectSnapshot('p-1', 'Manual checkpoint before refactor');
      expect(spyCreate).toHaveBeenCalledWith('p-1', { summary: 'Manual checkpoint before refactor' });
      expect(snap.version).toBe(5);
    });

    it('dispatches history:open-modal via command bus and triggers subscriber', () => {
      const listener = vi.fn();
      const unsub = editorCommandBus.subscribe('history:open-modal', listener);

      editorCommandBus.dispatch({
        type: 'history:open-modal',
        projectId: 'p-1',
        initialVersion: 2,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'history:open-modal',
          projectId: 'p-1',
          initialVersion: 2,
        })
      );

      unsub();
    });
  });
});
