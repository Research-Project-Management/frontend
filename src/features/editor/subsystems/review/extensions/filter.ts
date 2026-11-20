import { EditorState, Transaction } from '@codemirror/state';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getCachedUser } from '@/features/auth/services/auth.service';
import {
  createLocalSuggestionId,
  resolveSuggestionRange,
  reviewStateField,
  setSuggestionsEffect,
} from './state';

function emitLocalRecorded(pageId: string, suggestion: PageSuggestion): void {
  queueMicrotask(() => {
    editorCommandBus.dispatch({
      type: 'editor:review-event',
      pageId,
      event: 'suggestion:local-recorded',
      payload: { suggestion },
    });
  });
}

export const reviewModeFilter = EditorState.transactionFilter.of((tr: Transaction) => {
  if (!tr.docChanged) return tr;
  const config = tr.startState.field(reviewStateField, false);
  if (!config || !config.reviewMode) return tr;
  const pageId = config.pageId || '';

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

  const cachedUser = getCachedUser();
  const localAuthorId = cachedUser?.id || 'current-user';
  const localAuthorName = cachedUser?.name || cachedUser?.email || 'You';
  const isLocalAuthor = (s: PageSuggestion) =>
    s.authorId === localAuthorId ||
    s.author?.id === localAuthorId ||
    s.authorId === 'current-user' ||
    s.author?.id === 'current-user';

  // Case 1: Pure insertion in Reviewing Mode
  if (fromA === toA && insertedText.length > 0) {
    const newDoc = tr.newDoc;
    const startLineObj = newDoc.lineAt(fromB);
    const endLineObj = newDoc.lineAt(toB);
    const delta = insertedText.length;

    let coalesced: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s);
      if (
        !coalesced &&
        s.status === 'pending' &&
        s.type === 'insert' &&
        isLocalAuthor(s) &&
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
        coalesced = updated;
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

    if (!coalesced) {
      coalesced = {
        id: createLocalSuggestionId(),
        pageId,
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
      nextSuggestions.push(coalesced);
    }

    emitLocalRecorded(pageId, coalesced);
    return [
      tr,
      { effects: [...tr.effects, setSuggestionsEffect.of(nextSuggestions)] },
    ];
  }

  // Case 2: Deletion in Reviewing Mode -> keep text in buffer and mark pending delete
  if (fromA < toA && insertedText.length === 0) {
    const deletedText = startDoc.sliceString(fromA, toA);
    const startLineObj = startDoc.lineAt(fromA);
    const endLineObj = startDoc.lineAt(toA);

    let coalesced: PageSuggestion | null = null;
    const nextSuggestions: PageSuggestion[] = existing.map((s) => {
      const range = resolveSuggestionRange(startDoc, s);
      if (
        !coalesced &&
        s.status === 'pending' &&
        s.type === 'delete' &&
        isLocalAuthor(s) &&
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
        coalesced = updated;
        return updated;
      }
      return s;
    });

    if (!coalesced) {
      coalesced = {
        id: createLocalSuggestionId(),
        pageId,
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
      nextSuggestions.push(coalesced);
    }

    emitLocalRecorded(pageId, coalesced);
    return {
      selection: { anchor: fromA },
      effects: [...tr.effects, setSuggestionsEffect.of(nextSuggestions)],
    };
  }

  // Case 3: Selection replacement -> pending delete + pending insert
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

    const deleteSug: PageSuggestion = {
      id: createLocalSuggestionId('del'),
      pageId,
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
      id: createLocalSuggestionId('ins'),
      pageId,
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
    emitLocalRecorded(pageId, deleteSug);
    emitLocalRecorded(pageId, insertSug);

    return {
      changes: { from: toA, to: toA, insert: insertedText },
      selection: { anchor: toA + insertedText.length },
      effects: [...tr.effects, setSuggestionsEffect.of(nextSuggestions)],
    };
  }

  return tr;
});
