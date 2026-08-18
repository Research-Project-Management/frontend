import { describe, it, expect } from 'vitest';
import { AiPatchEngine, type AiEditOperation } from '@/features/editor/utils/ai.util';

describe('AiPatchEngine Deep Module', () => {
  const sampleLatex = `\\documentclass{article}
\\title{Old Title}
\\author{Jane Doe}
\\begin{document}
\\maketitle
\\section{Introduction}
This is the original introductory text.
\\end{document}`;

  it('extracts old text precisely for single-line and multi-line edits', () => {
    // Edit title on line 2
    const titleEdit: AiEditOperation = {
      type: 'replace',
      startLineNumber: 2,
      startColumn: 8,
      endLineNumber: 2,
      endColumn: 17,
      text: 'New Breakthrough Title',
    };

    const oldText = AiPatchEngine.extractOldText(sampleLatex, titleEdit);
    expect(oldText).toBe('Old Title');
  });

  it('computes structured diff hunks', () => {
    const edits: AiEditOperation[] = [
      {
        type: 'replace',
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 18,
        text: '\\title{Updated Title}',
        description: 'Update article title',
      },
    ];

    const hunks = AiPatchEngine.computeHunks(sampleLatex, edits);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].startLine).toBe(2);
    expect(hunks[0].oldText).toBe('\\title{Old Title}');
    expect(hunks[0].newText).toBe('\\title{Updated Title}');
    expect(hunks[0].description).toBe('Update article title');
  });

  it('applies atomic string patches without React/Monaco dependencies', () => {
    const edits: AiEditOperation[] = [
      {
        type: 'replace',
        startLineNumber: 2,
        startColumn: 8,
        endLineNumber: 2,
        endColumn: 17,
        text: 'Deep Architecture in LaTeX',
      },
      {
        type: 'replace',
        startLineNumber: 7,
        startColumn: 1,
        endLineNumber: 7,
        endColumn: 40,
        text: 'This is the deepened section content.',
      },
    ];

    const { updatedContent, affected } = AiPatchEngine.applyAtomicToString(sampleLatex, edits);
    expect(updatedContent).toContain('\\title{Deep Architecture in LaTeX}');
    expect(updatedContent).toContain('This is the deepened section content.');
    expect(updatedContent).not.toContain('Old Title');
    expect(affected).toBeDefined();
    expect(affected?.startLine).toBe(2);
  });

  it('validates edit boundaries and flags safety violations', () => {
    const invalidEdits: AiEditOperation[] = [
      {
        type: 'replace',
        startLineNumber: 99,
        startColumn: 1,
        endLineNumber: 100,
        endColumn: 5,
        text: 'Out of bounds',
      },
    ];

    const res = AiPatchEngine.validate(invalidEdits, 8, sampleLatex);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('handles empty document and single-line document edge cases safely', () => {
    // Empty document edit
    const emptyDoc = '';
    const insertEdit: AiEditOperation = {
      type: 'insert',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      text: '\\documentclass{article}',
    };

    const res = AiPatchEngine.applyAtomicToString(emptyDoc, [insertEdit]);
    expect(res.updatedContent).toBe('\\documentclass{article}');

    // Single line doc
    const singleLine = '\\title{My Draft}';
    const replaceSingle: AiEditOperation = {
      type: 'replace',
      startLineNumber: 1,
      startColumn: 8,
      endLineNumber: 1,
      endColumn: 16,
      text: 'Final Paper',
    };
    const resSingle = AiPatchEngine.applyAtomicToString(singleLine, [replaceSingle]);
    expect(resSingle.updatedContent).toBe('\\title{Final Paper}');
  });

  it('detects concurrent merge conflicts between base and modified main document', () => {
    const baseContent = `\\section{Introduction}\nOriginal Text\n\\section{Methods}`;
    const edits: AiEditOperation[] = [
      {
        type: 'replace',
        startLineNumber: 2,
        startColumn: 1,
        endLineNumber: 2,
        endColumn: 14,
        text: 'AI Improved Text',
      },
    ];

    // Case 1: No change in main document -> No conflict
    const noConflict = AiPatchEngine.detectConflict(baseContent, baseContent, edits);
    expect(noConflict.hasConflict).toBe(false);

    // Case 2: Teammate modified line 2 in main document -> Conflict detected!
    const modifiedMain = `\\section{Introduction}\nTeammate Edited Text\n\\section{Methods}`;
    const conflictRes = AiPatchEngine.detectConflict(baseContent, modifiedMain, edits);
    expect(conflictRes.hasConflict).toBe(true);
    expect(conflictRes.conflicts).toHaveLength(1);
    expect(conflictRes.conflicts[0]!.currentText).toBe('Teammate Edited Text');
    expect(conflictRes.conflicts[0]!.expectedText).toBe('Original Text');
  });
});
