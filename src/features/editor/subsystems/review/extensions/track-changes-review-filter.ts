/**
 * track-changes-review-filter.ts
 *
 * CodeMirror 6 transactionFilter forSuggesting/Review Mode: intercepts user edits
 * (insertions, deletions, replacements) and converts them into coalesced local
 * track-change suggestion records.
 */

import { EditorState, Transaction } from '@codemirror/state';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getCachedUser } from '@/features/auth/services/auth.service';
import {
  trackChangesStateField,
  setTrackChangesSuggestionsEffect,
  resolveSuggestionRange,
} from './track-changes-state';

export const trackChangesReviewModeFilter = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged) return tr;
  const config = tr.startState.field(trackChangesStateField, false);
  if (!config || !config.reviewMode) return tr;
  const currentScopePageId = config.pageId || '';

  const userEvt = tr.annotation(Transaction.userEvent);
  if (
    !userEvt ||
    (!userEvt.startsWith('input') &&
      !userEvt.startsWith('delete') &&
      userEvt !== 'ai.accept-diff')
  ) {
    return tr;
  }

  let changeCount = 0;
  let fromA = 0;
  let toA = 0;
  let fromB = 0;
  let toB = 0;
  let insertedText = '';

  tr.changes.iterChanges((fA, tA, fB, tB, inserted) => {
    changeCount++;
    fromA = fA;
    toA = tA;
    fromB = fB;
    toB = tB;
    insertedText = inserted.toString();
  });

  if (changeCount !== 1) return tr;

  const startDoc = tr.startState.doc;
  const existing = [...config.suggestions];
  const nowIso = new Date().toISOString();

  let cachedFullText: string | null = null;
  const getFullText = () => {
    if (cachedFullText === null) {
      cachedFullText = startDoc.toString();
    }
    return cachedFullText;
  };
  const cachedUser = getCachedUser();
  const localAuthorId = cachedUser?.id || 'current-user';
  const localAuthorName = cachedUser?.name || cachedUser?.email || 'You';
  const isLocalSuggestionAuthor = (s: PageSuggestion) =>
    s.authorId === localAuthorId ||
    s.author?.id === localAuthorId ||
    s.authorId === 'current-user' ||
    s.author?.id === 'current-user';

  // Case 1: Pure insertion in Suggesting Mode
  if (fromA === toA && insertedText.length > 0) {
    const newDoc = tr.newDoc;
    const startLineObj = newDoc.lineAt(fromB);
    const endLineObj = newDoc.lineAt(toB);
    const delta = insertedText.length;

    let coalescedSug: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s, getFullText);
      if (
        !coalescedSug &&
        s.status === 'pending' &&
        s.type === 'insert' &&
        isLocalSuggestionAuthor(s) &&
        range.to === fromA
      ) {
        const updated: PageSuggestion = {
          ...s,
          suggestedText: (s.suggestedText || '') + insertedText,
          fromIndex: range.from,
          toIndex: range.to + delta,
          toLine: endLineObj.number,
          toColumn: toB - endLineObj.from + 1,
          updatedAt: nowIso,
        };
        coalescedSug = updated;
        return updated;
      }
      if (range.from >= fromA) {
        return {
          ...s,
          fromIndex: range.from + delta,
          toIndex: range.to + delta,
        };
      }
      return s;
    });

    if (!coalescedSug) {
      coalescedSug = {
        id: `sug-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageId: currentScopePageId,
        type: 'insert',
        originalText: '',
        suggestedText: insertedText,
        fromIndex: fromB,
        toIndex: toB,
        fromLine: startLineObj.number,
        fromColumn: fromB - startLineObj.from + 1,
        toLine: endLineObj.number,
        toColumn: toB - endLineObj.from + 1,
        status: 'pending',
        authorId: localAuthorId,
        author: { id: localAuthorId, name: localAuthorName },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSuggestions.push(coalescedSug);
    }

    const recorded = coalescedSug;
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: recorded },
      });
    });

    return [
      tr,
      {
        effects: [...tr.effects, setTrackChangesSuggestionsEffect.of(nextSuggestions)],
      },
    ];
  }

  // Case 2: Deletion in Suggesting Mode -> keep text in buffer and mark as pending delete
  if (fromA < toA && insertedText.length === 0) {
    const deletedText = startDoc.sliceString(fromA, toA);
    const startLineObj = startDoc.lineAt(fromA);
    const endLineObj = startDoc.lineAt(toA);

    let coalescedSug: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s, getFullText);
      if (
        !coalescedSug &&
        s.status === 'pending' &&
        s.type === 'delete' &&
        isLocalSuggestionAuthor(s) &&
        (range.from === toA || range.to === fromA)
      ) {
        const mergedFrom = Math.min(range.from, fromA);
        const mergedTo = Math.max(range.to, toA);
        const mStartLine = startDoc.lineAt(mergedFrom);
        const mEndLine = startDoc.lineAt(mergedTo);
        const updated: PageSuggestion = {
          ...s,
          originalText: startDoc.sliceString(mergedFrom, mergedTo),
          fromIndex: mergedFrom,
          toIndex: mergedTo,
          fromLine: mStartLine.number,
          fromColumn: mergedFrom - mStartLine.from + 1,
          toLine: mEndLine.number,
          toColumn: mergedTo - mEndLine.from + 1,
          updatedAt: nowIso,
        };
        coalescedSug = updated;
        return updated;
      }
      return s;
    });

    if (!coalescedSug) {
      coalescedSug = {
        id: `sug-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageId: currentScopePageId,
        type: 'delete',
        originalText: deletedText,
        suggestedText: '',
        fromIndex: fromA,
        toIndex: toA,
        fromLine: startLineObj.number,
        fromColumn: fromA - startLineObj.from + 1,
        toLine: endLineObj.number,
        toColumn: toA - endLineObj.from + 1,
        status: 'pending',
        authorId: localAuthorId,
        author: { id: localAuthorId, name: localAuthorName },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextSuggestions.push(coalescedSug);
    }

    const recorded = coalescedSug;
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: recorded },
      });
    });

    return {
      selection: { anchor: fromA },
      effects: [...tr.effects, setTrackChangesSuggestionsEffect.of(nextSuggestions)],
    };
  }

  // Case 3: Selection replacement in Suggesting Mode -> keep originalText as pending 'delete'
  // and insert new text right after it as a pending 'insert' so buffer and backend model stay 1:1
  if (fromA < toA && insertedText.length > 0) {
    const originalText = startDoc.sliceString(fromA, toA);
    const startLineObj = startDoc.lineAt(fromA);
    const endLineObj = startDoc.lineAt(toA);
    const insertedLines = insertedText.split('\n');
    const insertToLine = endLineObj.number + insertedLines.length - 1;
    const insertFromColumn = toA - endLineObj.from + 1;
    const insertToColumn =
      insertedLines.length === 1
        ? insertFromColumn + insertedText.length
        : insertedLines[insertedLines.length - 1].length + 1;
    const baseToken = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const deleteSug: PageSuggestion = {
      id: `sug-local-${baseToken}-del`,
      pageId: currentScopePageId,
      type: 'delete',
      originalText,
      suggestedText: '',
      fromIndex: fromA,
      toIndex: toA,
      fromLine: startLineObj.number,
      fromColumn: fromA - startLineObj.from + 1,
      toLine: endLineObj.number,
      toColumn: insertFromColumn,
      status: 'pending',
      authorId: localAuthorId,
      author: { id: localAuthorId, name: localAuthorName },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const insertSug: PageSuggestion = {
      id: `sug-local-${baseToken}-ins`,
      pageId: currentScopePageId,
      type: 'insert',
      originalText: '',
      suggestedText: insertedText,
      fromIndex: toA,
      toIndex: toA + insertedText.length,
      fromLine: endLineObj.number,
      fromColumn: insertFromColumn,
      toLine: insertToLine,
      toColumn: insertToColumn,
      status: 'pending',
      authorId: localAuthorId,
      author: { id: localAuthorId, name: localAuthorName },
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const mappedExisting = existing.map((s) => {
      if (s.fromIndex == null || s.toIndex == null) return s;
      const delta = insertedText.length;
      return {
        ...s,
        fromIndex: s.fromIndex >= toA ? s.fromIndex + delta : s.fromIndex,
        toIndex: s.toIndex > toA ? s.toIndex + delta : s.toIndex,
      };
    });

    const nextSuggestions = [...mappedExisting, deleteSug, insertSug];
    queueMicrotask(() => {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: deleteSug },
      });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: currentScopePageId,
        event: 'suggestion:local-recorded',
        payload: { suggestion: insertSug },
      });
    });

    return {
      changes: { from: toA, to: toA, insert: insertedText },
      selection: { anchor: toA + insertedText.length },
      effects: [...tr.effects, setTrackChangesSuggestionsEffect.of(nextSuggestions)],
    };
  }

  return tr;
});
