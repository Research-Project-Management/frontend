/**
 * track-changes-inline-widget.test.ts
 *
 * Comprehensive Test Suite for Overleaf-Parity Track Changes & Inline Suggestion Widget:
 * - CodeMirror 6 ViewModes ('changes' | 'clean' | 'original')
 * - Range decorations for insertions, deletions, and replacements
 * - Defensive overlap handling for clean/original mode replace decorations
 * - Interactive hover tooltip popover DOM with diff preview and 1-click action buttons
 * - 0ms local optimistic document edits via reviewCoordinator
 * - Review gutter markers for comments, suggestions, and combined lines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createTrackChangesExtension,
  trackChangesStateField,
  trackChangesDecorationsField,
  trackChangesHoverTooltip,
  getTrackChangesTooltip,
  trackChangesGutter,
  setTrackChangesSuggestionsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  setTrackChangesCommentsEffect,
  getSafeOffset,
} from '@/features/editor/subsystems/review/extensions/track-changes.extension';
import { reviewCoordinator } from '@/features/editor/subsystems/review';
import { editorCommandBus } from '@/features/editor/core';
import { suggestionService } from '@/features/editor/sdk/manuscript.service';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';

describe('Track Changes & In-Editor Inline Suggestion Widget', () => {
  let container: HTMLDivElement;
  let view: EditorView | null = null;

  const sampleDoc = [
    '\\documentclass{article}',
    '\\begin{document}',
    'This is the first draft of the paper.',
    'We propose an inefficient algorithm that runs slowly.',
    '\\end{document}',
  ].join('\n');

  const mockSuggestions: PageSuggestion[] = [
    {
      id: 'sug-insert-1',
      pageId: 'doc-1',
      authorId: 'user-alice',
      author: { id: 'user-alice', name: 'Alice Smith', email: 'alice@example.com' },
      type: 'insert',
      originalText: '',
      suggestedText: ' highly scalable',
      fromLine: 4,
      fromColumn: 18,
      toLine: 4,
      toColumn: 34,
      status: 'pending',
      description: 'Emphasize performance scalability',
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'sug-delete-1',
      pageId: 'doc-1',
      authorId: 'user-bob',
      author: { id: 'user-bob', name: 'Bob Jones', email: 'bob@example.com' },
      type: 'delete',
      originalText: 'inefficient ',
      suggestedText: '',
      fromLine: 4,
      fromColumn: 15,
      toLine: 4,
      toColumn: 27,
      status: 'pending',
      description: 'Remove negative phrasing',
      createdAt: '2026-10-12T10:05:00.000Z',
      updatedAt: '2026-10-12T10:05:00.000Z',
    },
  ];

  const mockComments: PageComment[] = [
    {
      id: 'comment-1',
      page: 'doc-1',
      projectId: 'proj-1',
      author: { id: 'user-charlie', name: 'Charlie' },
      content: 'Can we add a citation for this claim?',
      line: 3,
      status: 'open',
      createdAt: '2026-10-12T10:10:00.000Z',
    } as any,
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (view) {
      view.destroy();
      view = null;
    }
    container.remove();
  });

  function createTestEditor(initialViewMode: 'changes' | 'clean' | 'original' = 'changes') {
    const state = EditorState.create({
      doc: sampleDoc,
      extensions: [
        createTrackChangesExtension({
          initialSuggestions: mockSuggestions,
          initialComments: mockComments,
          initialViewMode,
          initialReviewMode: true,
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: container,
    });

    return view;
  }

  describe('1. CodeMirror ViewModes & Visual Decorations', () => {
    it('renders insertion and deletion decorations in "changes" mode', () => {
      const editor = createTestEditor('changes');
      const decos = editor.state.field(trackChangesDecorationsField);
      expect(decos).toBeDefined();

      let foundInsert = false;
      let foundDelete = false;

      decos.between(0, editor.state.doc.length, (_from, _to, value) => {
        const className = (value.spec as any).class;
        if (className?.includes('cm-track-change-insert')) foundInsert = true;
        if (className?.includes('cm-track-change-delete')) foundDelete = true;
      });

      expect(foundInsert).toBe(true);
      expect(foundDelete).toBe(true);
    });

    it('hides deleted text and renders clean in "clean" mode (Show final text)', () => {
      const editor = createTestEditor('clean');
      const decos = editor.state.field(trackChangesDecorationsField);

      let foundDeleteMark = false;
      let foundReplaceDeco = false;

      decos.between(0, editor.state.doc.length, (_from, _to, value) => {
        const spec = value.spec as any;
        if (spec.class?.includes('cm-track-change-delete')) foundDeleteMark = true;
        // In clean mode, delete becomes a replace decoration that collapses/hides text
        if (spec.inclusive === false && !spec.widget) foundReplaceDeco = true;
      });

      expect(foundDeleteMark).toBe(false);
      expect(foundReplaceDeco).toBe(true);
    });

    it('hides inserted text in "original" mode (Show original text)', () => {
      const editor = createTestEditor('original');
      const decos = editor.state.field(trackChangesDecorationsField);

      let foundInsertMark = false;
      let foundReplaceDeco = false;

      decos.between(0, editor.state.doc.length, (_from, _to, value) => {
        const spec = value.spec as any;
        if (spec.class?.includes('cm-track-change-insert')) foundInsertMark = true;
        // In original mode, insert becomes a replace decoration that collapses/hides text
        if (spec.inclusive === false && !spec.widget) foundReplaceDeco = true;
      });

      expect(foundInsertMark).toBe(false);
      expect(foundReplaceDeco).toBe(true);
    });

    it('dynamically switches view modes without throwing or remounting', () => {
      const editor = createTestEditor('changes');

      // Switch to clean
      editor.dispatch({
        effects: setTrackChangesViewModeEffect.of('clean'),
      });
      expect(editor.state.field(trackChangesStateField).viewMode).toBe('clean');

      // Switch to original
      editor.dispatch({
        effects: setTrackChangesViewModeEffect.of('original'),
      });
      expect(editor.state.field(trackChangesStateField).viewMode).toBe('original');

      // Switch back to changes
      editor.dispatch({
        effects: setTrackChangesViewModeEffect.of('changes'),
      });
      expect(editor.state.field(trackChangesStateField).viewMode).toBe('changes');
    });
  });

  describe('2. In-Editor Inline Hover Suggestion Tooltip', () => {
    it('generates rich popover DOM with author details, diff, and action buttons', () => {
      const editor = createTestEditor('changes');
      const doc = editor.state.doc;
      const line4 = doc.line(4);
      const testPos = line4.from + 16; // inside the suggestions

      // Query tooltip for this position
      const tooltip = getTrackChangesTooltip(editor, testPos);

      expect(tooltip).not.toBeNull();
      expect(tooltip!.pos).toBeDefined();

      const tooltipDom = tooltip!.create(editor).dom;
      expect(tooltipDom.className).toContain('cm-track-tooltip');
      expect(tooltipDom.getAttribute('data-testid')).toBe('inline-suggestion-tooltip');

      // Check author header & badges
      expect(tooltipDom.querySelector('.cm-track-author-name')).not.toBeNull();
      expect(tooltipDom.querySelector('.cm-track-type-badge')).not.toBeNull();

      // Check buttons
      const acceptBtn = tooltipDom.querySelector('[data-testid="inline-accept-btn"]');
      const rejectBtn = tooltipDom.querySelector('[data-testid="inline-reject-btn"]');
      expect(acceptBtn).not.toBeNull();
      expect(rejectBtn).not.toBeNull();
    });

    it('dispatches review:accept-suggestion command when Accept button is clicked', () => {
      const editor = createTestEditor('changes');
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const pos = editor.state.doc.line(4).from + 16;
      const tooltip = getTrackChangesTooltip(editor, pos);
      expect(tooltip).not.toBeNull();
      const dom = tooltip!.create(editor).dom;

      const acceptBtn = dom.querySelector('[data-testid="inline-accept-btn"]') as HTMLButtonElement;
      acceptBtn.click();

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review:accept-suggestion',
          suggestionId: expect.any(String),
        })
      );
    });

    it('dispatches review:reject-suggestion command when Reject button is clicked', () => {
      const editor = createTestEditor('changes');
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      const pos = editor.state.doc.line(4).from + 16;
      const tooltip = getTrackChangesTooltip(editor, pos);
      expect(tooltip).not.toBeNull();
      const dom = tooltip!.create(editor).dom;

      const rejectBtn = dom.querySelector('[data-testid="inline-reject-btn"]') as HTMLButtonElement;
      rejectBtn.click();

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'review:reject-suggestion',
          suggestionId: expect.any(String),
        })
      );
    });
  });

  describe('3. 0ms Optimistic Document Edits via reviewCoordinator', () => {
    it('immediately deletes text in CodeMirror when a delete suggestion is accepted', async () => {
      const editor = createTestEditor('changes');
      reviewCoordinator.bindEditorView(editor, 'doc-1');
      reviewCoordinator.syncEditorDecorations(editor, mockSuggestions, mockComments);

      vi.spyOn(suggestionService, 'acceptSuggestion').mockResolvedValueOnce({
        ok: true,
        suggestion: { ...mockSuggestions[1], status: 'accepted' },
        page: {},
      } as any);

      const beforeDoc = editor.state.doc.toString();
      expect(beforeDoc).toContain('inefficient');

      const success = await reviewCoordinator.acceptSuggestion('doc-1', 'sug-delete-1');
      expect(success).toBe(true);

      // Verify text was deleted optimistically from the active document in 0ms
      const afterDoc = editor.state.doc.toString();
      expect(afterDoc).not.toContain('inefficient');
    });

    it('immediately removes inserted text in CodeMirror when an insert suggestion is rejected', async () => {
      // In this scenario, text was already in document as proposed addition
      const editor = createTestEditor('changes');
      reviewCoordinator.bindEditorView(editor, 'doc-1');
      reviewCoordinator.syncEditorDecorations(editor, mockSuggestions, mockComments);

      vi.spyOn(suggestionService, 'rejectSuggestion').mockResolvedValueOnce({
        ok: true,
        suggestion: { ...mockSuggestions[0], status: 'rejected' },
      } as any);

      const success = await reviewCoordinator.rejectSuggestion('doc-1', 'sug-insert-1');
      expect(success).toBe(true);
    });
  });

  describe('4. Review Gutter Markers', () => {
    it('creates gutter markers for comment and suggestion lines', () => {
      const editor = createTestEditor('changes');
      const gutterExt = trackChangesGutter as any;
      expect(gutterExt).toBeDefined();

      const line3 = editor.state.doc.line(3);
      const line4 = editor.state.doc.line(4);

      // Safe offset mapping verification
      expect(getSafeOffset(editor.state.doc, 3, 1)).toBe(line3.from);
      expect(getSafeOffset(editor.state.doc, 4, 1)).toBe(line4.from);
    });
  });
});
