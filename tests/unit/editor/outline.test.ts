import { describe, it, expect } from 'vitest';
import {
  parseDocumentOutline,
  dtoToOutlineEntries,
} from '@/features/editor/subsystems/compiler/synctex/outline';

describe('outline (frontend parser & DTO mapper)', () => {
  it('separates part and chapter levels cleanly and handles multi-line & nested headings', () => {
    const tex = [
      '\\part{Foundations}',
      '\\chapter{Background}',
      '\\section{R\\&D 100\\% % inline comment',
      '  in \\textbf{Flux \\emph{Editor}}}',
      '\\begin{verbatim}',
      '\\section{Ignored Verbatim}',
      '\\end{verbatim}',
      '\\begin{frame}[fragile]{Overview of \\textbf{CLSI}}',
      '\\end{frame}',
    ].join('\n');

    const entries = parseDocumentOutline(tex, 'main.tex');
    expect(entries.map((e) => ({ level: e.level, type: e.type, title: e.title }))).toEqual([
      { level: 0, type: 'part', title: 'Foundations' },
      { level: 1, type: 'chapter', title: 'Background' },
      { level: 2, type: 'section', title: 'R&D 100% in Flux Editor' },
      { level: 3, type: 'slide', title: 'Overview of CLSI' },
    ]);
  });

  it('maps backend LatexOutlineEntryDto preserving part < chapter < section hierarchy', () => {
    const mapped = dtoToOutlineEntries([
      { level: 'part', title: 'Part I', line: 1 },
      { level: 'chapter', title: 'Intro', line: 5 },
      { level: 'section', title: 'Scope', line: 10 },
    ] as any);

    expect(mapped.map((e) => e.level)).toEqual([0, 1, 2]);
  });
});
