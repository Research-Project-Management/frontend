import { describe, it, expect, vi } from 'vitest';
import { AcademicAiService } from '@/features/editor/services/ai-academic-assistant.service';

describe('AI Inline Floating Assistant & Academic Rephrase (Overleaf AI Parity)', () => {
  it('enhances academic tone while preserving citations and math formulas verbatim', async () => {
    const rawText = 'We look at a lot of samples to show that $E = mc^2$ holds as cited in \\cite{einstein1905}.';

    const result = await AcademicAiService.executeAction({
      action: 'academic-tone',
      selectedText: rawText,
    });

    expect(result.success).toBe(true);
    // Technical macros MUST be preserved 1:1
    expect(result.suggestedText).toContain('$E = mc^2$');
    expect(result.suggestedText).toContain('\\cite{einstein1905}');
    // Informal phrases should be elevated
    expect(result.suggestedText).toContain('investigate');
    expect(result.suggestedText).toContain('demonstrate that');
    expect(result.diffSummary.wordsOriginal).toBeGreaterThan(0);
    expect(result.diffSummary.wordsSuggested).toBeGreaterThan(0);
  });

  it('makes text concise by pruning wordy phrases', async () => {
    const wordyText = 'In order to evaluate the model, due to the fact that data was limited, we ran tests.';

    const result = await AcademicAiService.executeAction({
      action: 'make-concise',
      selectedText: wordyText,
    });

    expect(result.success).toBe(true);
    expect(result.suggestedText).toContain('To evaluate');
    expect(result.suggestedText).toContain('because');
    expect(result.suggestedText).not.toContain('In order to');
    expect(result.suggestedText).not.toContain('due to the fact that');
  });

  it('preserves equation references \\ref{} and \\eqref{}', async () => {
    const textWithRefs = 'According to Equation \\eqref{eq:loss} and Figure \\ref{fig:arch}, accuracy improves.';

    const result = await AcademicAiService.executeAction({
      action: 'fix-grammar',
      selectedText: textWithRefs,
    });

    expect(result.success).toBe(true);
    expect(result.suggestedText).toContain('\\eqref{eq:loss}');
    expect(result.suggestedText).toContain('\\ref{fig:arch}');
  });

  it('returns empty result gracefully when selected text is blank', async () => {
    const result = await AcademicAiService.executeAction({
      action: 'academic-tone',
      selectedText: '   ',
    });

    expect(result.success).toBe(false);
    expect(result.diffSummary.wordsOriginal).toBe(0);
  });
});
