'use client';

/**
 * use-spell-checker.ts
 *
 * Monaco Editor spell checker using WebWorker + nspell (Hunspell-compatible).
 * Architecture inspired by Overleaf's HunspellManager + SpellChecker.
 *
 * Key differences from Overleaf (which uses CodeMirror 6 + Lezer):
 * - Uses Monaco's IModelDeltaDecoration for red squiggly underlines
 * - Uses Monaco's registerCodeActionProvider for right-click suggestions
 * - Manually skips LaTeX commands using regex (Overleaf uses Lezer parser)
 */

import { useEffect, useRef, useCallback } from 'react';
import type { editor, IDisposable } from 'monaco-editor';

// Words to skip: LaTeX commands, short words, numbers
const SKIP_WORD_REGEX = /^(\\\w+|\d+|[^a-zA-Z]{1,2}|[a-zA-Z]{1,2})$/;
// Match normal text words (not LaTeX commands), minimum 3 chars
const WORD_REGEX = /\b([a-zA-Z'\u00C0-\u024F]{3,})\b/g;
// LaTeX command detector - skip words after backslash
const LATEX_COMMAND_REGEX = /\\[a-zA-Z]+/g;

interface UseSpellCheckerOptions {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<any>;
  language?: string; // e.g. 'en_US'
  enabled?: boolean;
}

export function useSpellChecker({
  editorRef,
  monacoRef,
  language = 'en_US',
  enabled = true,
}: UseSpellCheckerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, (result: any) => void>>(new Map());
  const decorationsRef = useRef<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposablesRef = useRef<IDisposable[]>([]);

  const spellCheck = useCallback(async () => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const worker = workerRef.current;
    if (!ed || !monaco || !worker || !enabled) return;

    const model = ed.getModel();
    if (!model) return;

    const content = model.getValue();
    const lines = content.split('\n');
    const newDecorations: editor.IModelDeltaDecoration[] = [];

    // Collect all words to check in one batch
    const wordsToCheck: Array<{
      word: string;
      lineNumber: number;
      startColumn: number;
      endColumn: number;
    }> = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNumber = lineIdx + 1;

      // Build a mask of LaTeX command positions to skip
      const commandRanges: Array<[number, number]> = [];
      let cmdMatch: RegExpExecArray | null;
      LATEX_COMMAND_REGEX.lastIndex = 0;
      while ((cmdMatch = LATEX_COMMAND_REGEX.exec(line)) !== null) {
        commandRanges.push([cmdMatch.index, cmdMatch.index + cmdMatch[0].length]);
      }

      WORD_REGEX.lastIndex = 0;
      let wordMatch: RegExpExecArray | null;
      while ((wordMatch = WORD_REGEX.exec(line)) !== null) {
        const word = wordMatch[1];
        const wordStart = wordMatch.index;
        const wordEnd = wordStart + word.length;

        // Skip if this word is inside a LaTeX command
        const inCommand = commandRanges.some(([s, e]) => wordStart >= s && wordEnd <= e);
        if (inCommand) continue;

        // Skip LaTeX-specific patterns and short words
        if (SKIP_WORD_REGEX.test(word)) continue;
        // Skip all-caps (likely acronyms)
        if (word === word.toUpperCase()) continue;

        wordsToCheck.push({
          word,
          lineNumber,
          startColumn: wordStart + 1,
          endColumn: wordEnd + 1,
        });
      }
    }

    if (wordsToCheck.length === 0) {
      // Clear all decorations
      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, []);
      return;
    }

    // Batch spell check via WebWorker
    const id = Math.random().toString(36).slice(2);
    const words = wordsToCheck.map((w) => w.word);

    const result = await new Promise<{ misspellings: number[] }>((resolve) => {
      pendingRef.current.set(id, resolve);
      worker.postMessage({ type: 'spell', id, words });
      // Timeout fallback — don't hang forever
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          resolve({ misspellings: [] });
        }
      }, 5000);
    });

    // Build decorations for misspelled words
    for (const idx of result.misspellings) {
      const w = wordsToCheck[idx];
      if (!w) continue;
      newDecorations.push({
        range: {
          startLineNumber: w.lineNumber,
          startColumn: w.startColumn,
          endLineNumber: w.lineNumber,
          endColumn: w.endColumn,
        },
        options: {
          inlineClassName: 'monaco-spell-error',
          hoverMessage: {
            value: `'${w.word}' may be misspelled. Right-click for suggestions.`,
          },
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
        },
      });
    }

    // Apply decorations (replaces previous set atomically)
    if (ed.getModel() === model) {
      decorationsRef.current = ed.deltaDecorations(decorationsRef.current, newDecorations);
    }
  }, [editorRef, monacoRef, enabled]);

  const scheduleSpellCheck = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(spellCheck, 800); // 800 ms debounce
  }, [spellCheck]);

  /** Add a word to the personal dictionary and clear its decoration. */
  const learnWord = useCallback(
    (word: string) => {
      workerRef.current?.postMessage({ type: 'add_word', word });
      // Re-run to clear the squiggly
      scheduleSpellCheck();
    },
    [scheduleSpellCheck],
  );

  /** Remove a word from the personal dictionary. */
  const forgetWord = useCallback(
    (word: string) => {
      workerRef.current?.postMessage({ type: 'remove_word', word });
      scheduleSpellCheck();
    },
    [scheduleSpellCheck],
  );

  // ─── Initialize / tear down WebWorker ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker(
      new URL('../../../workers/spell-check.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === 'spell' || msg.type === 'suggest') {
        const resolve = pendingRef.current.get(msg.id);
        if (resolve) {
          pendingRef.current.delete(msg.id);
          resolve(msg);
        }
      }
      // 'ready' fires after dictionary loads → kick off first check
      if (msg.type === 'ready') {
        scheduleSpellCheck();
      }
    };

    worker.postMessage({ type: 'init', language });
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, language]);

  // ─── Inject CSS for squiggly underline ─────────────────────────────────────
  useEffect(() => {
    const STYLE_ID = 'monaco-spell-styles';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .monaco-spell-error {
          text-decoration: underline wavy #f43f5e;
          text-decoration-skip-ink: none;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById('monaco-spell-styles')?.remove();
    };
  }, []);

  // ─── Attach content-change listener to Monaco editor ───────────────────────
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !enabled) return;

    const disposable = ed.onDidChangeModelContent(() => {
      scheduleSpellCheck();
    });
    disposablesRef.current.push(disposable);

    // Initial check once editor is ready
    scheduleSpellCheck();

    return () => {
      disposable.dispose();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRef.current, enabled, scheduleSpellCheck]);

  // ─── Clear decorations when disabled ───────────────────────────────────────
  useEffect(() => {
    if (!enabled && editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        [],
      );
    }
  }, [enabled, editorRef]);

  return { learnWord, forgetWord, runSpellCheck: scheduleSpellCheck };
}
