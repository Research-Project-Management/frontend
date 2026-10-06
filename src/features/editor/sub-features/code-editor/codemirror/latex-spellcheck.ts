/**
 * latex-spellcheck.ts
 *
 * CodeMirror 6 Spell Check Linter Extension (Overleaf Parity):
 * - Calls manuscripts spelling engine for academic & multi-lingual spell checking.
 * - Underlines misspelled words with squiggly lines.
 * - Provides interactive quick-fix action buttons:
 *    - Replace with suggestions
 *    - Add to project dictionary
 *    - Add to personal dictionary
 * - Caches locally learned words for zero-latency UI updates.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { type EditorView } from '@codemirror/view';
import { spellingService } from '@/features/editor/services/spelling.service';
import { toast } from 'sonner';

// In-memory set of words learned in the active editor session
const sessionLearnedWords = new Set<string>();

export function addSessionLearnedWord(word: string) {
  sessionLearnedWords.add(word.trim().toLowerCase());
}

export function createLatexSpellcheckExtension(
  projectId?: string,
  getLanguage: () => string = () => 'en_US',
) {
  return [
    linter(
      async (view: EditorView): Promise<Diagnostic[]> => {
        const text = view.state.doc.toString();
        if (!text || text.trim().length === 0) return [];

        const language = getLanguage() || 'en_US';
        const doc = view.state.doc;
        const diagnostics: Diagnostic[] = [];

        if (!projectId) {
          return [];
        }

        try {
          const report = await spellingService.checkSpelling(projectId, {
            text,
            language,
          });

          if (!report || !Array.isArray(report.errors)) {
            return [];
          }

          for (const err of report.errors) {
            const wordLower = err.word.toLowerCase();
            if (sessionLearnedWords.has(wordLower)) {
              continue;
            }

            // Convert 1-indexed line & column to CodeMirror absolute offset
            const lineNum = Math.min(Math.max(1, err.line), doc.lines);
            const lineObj = doc.line(lineNum);
            const from = Math.min(lineObj.from + Math.max(0, err.col - 1), lineObj.to);
            const to = Math.min(from + (err.length || err.word.length), lineObj.to);

            if (from >= to) continue;

            const actions: Array<{
              name: string;
              apply: (view: EditorView, from: number, to: number) => void;
            }> = [];

            // Suggestion quick fixes
            if (Array.isArray(err.suggestions)) {
              for (const sugg of err.suggestions.slice(0, 4)) {
                actions.push({
                  name: `Change to "${sugg}"`,
                  apply: (v, f, t) => {
                    v.dispatch({
                      changes: { from: f, to: t, insert: sugg },
                    });
                  },
                });
              }
            }

            // Add to Project Dictionary
            if (projectId) {
              actions.push({
                name: `Add "${err.word}" to project dictionary`,
                apply: () => {
                  addSessionLearnedWord(err.word);
                  spellingService.learnProjectWord(projectId, err.word).then(() => {
                    toast.success(`Added "${err.word}" to project dictionary`);
                  });
                },
              });
            }

            // Add to Personal Dictionary
            actions.push({
              name: `Add "${err.word}" to personal dictionary`,
              apply: () => {
                addSessionLearnedWord(err.word);
                spellingService.learnUserWord(err.word).then(() => {
                  toast.success(`Added "${err.word}" to personal dictionary`);
                });
              },
            });

            diagnostics.push({
              from,
              to,
              severity: 'warning',
              message: `Misspelled word: "${err.word}"`,
              source: 'Spell Check',
              actions,
            });
          }
        } catch {
          // Graceful fallback if backend spelling endpoint is offline
          return [];
        }

        return diagnostics;
      },
      { delay: 1200 },
    ),
  ];
}
