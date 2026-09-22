import { describe, it, expect } from 'vitest';
import {
  parseDocumentOutline,
  type OutlineEntry,
} from '@/features/editor/utils/pdf-outline.util';
import { EditorEventBus, type SidebarTabName } from '@/features/editor/utils/editor.util';

describe('Phase 1 Parity: Document Outline Parsing (OutlineTab)', () => {
  const sampleLatex = `\\documentclass{article}
\\usepackage{amsmath}

\\title{A Comprehensive Study}
\\author{Flux Research Group}

\\begin{document}
\\maketitle

\\part{Theoretical Foundations}
Line 10 content.

\\chapter{Introduction and Overview}
Line 13 content.

\\section{Background \\& Motivation}
Line 16 content.

\\subsection{Prior Work in LaTeX Editors}
Line 19 content.

\\subsubsection{Collaborative Sync Algorithms}
Line 22 content.

\\section*{Unnumbered Acknowledgments}
Line 25 content.

\\section[Short Title]{Full Section Title with Optional Argument}
Line 28 content.

\\paragraph{Final Remarks}
Line 31 content.

\\end{document}
`;

  it('parses standard LaTeX sectioning commands into structured outline entries', () => {
    const entries = parseDocumentOutline(sampleLatex);

    expect(entries.length).toBe(8);

    expect(entries[0]).toEqual({
      level: 0,
      levelName: 'Chapter',
      title: 'Theoretical Foundations',
      line: 10,
    });

    expect(entries[1]).toEqual({
      level: 0,
      levelName: 'Chapter',
      title: 'Introduction and Overview',
      line: 13,
    });

    expect(entries[2]).toEqual({
      level: 1,
      levelName: 'Section',
      title: 'Background \\& Motivation',
      line: 16,
    });

    expect(entries[3]).toEqual({
      level: 2,
      levelName: 'Sub',
      title: 'Prior Work in LaTeX Editors',
      line: 19,
    });

    expect(entries[4]).toEqual({
      level: 3,
      levelName: 'Subsub',
      title: 'Collaborative Sync Algorithms',
      line: 22,
    });
  });

  it('correctly captures unnumbered starred sections (e.g. \\section*)', () => {
    const entries = parseDocumentOutline(sampleLatex);
    const unnumbered = entries.find((e) => e.title === 'Unnumbered Acknowledgments');

    expect(unnumbered).toBeDefined();
    expect(unnumbered?.level).toBe(1);
    expect(unnumbered?.levelName).toBe('Section');
  });

  it('correctly handles optional arguments (e.g. \\section[short]{full})', () => {
    const entries = parseDocumentOutline(sampleLatex);
    const withOpt = entries.find((e) => e.title.includes('Full Section Title'));

    expect(withOpt).toBeDefined();
    expect(withOpt?.title).toBe('Full Section Title with Optional Argument');
    expect(withOpt?.level).toBe(1);
  });

  it('parses paragraph levels as leaf nodes', () => {
    const entries = parseDocumentOutline(sampleLatex);
    const para = entries.find((e) => e.title === 'Final Remarks');

    expect(para).toBeDefined();
    expect(para?.level).toBe(4);
    expect(para?.levelName).toBe('Para');
  });

  it('handles JSON/object content wrappers safely', () => {
    const objContent = {
      source: '\\section{First Section}\n\\subsection{Child Subsection}',
    };
    const entries = parseDocumentOutline(objContent);

    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe('First Section');
    expect(entries[1].title).toBe('Child Subsection');
  });

  it('returns empty array when content has no section headers or is empty', () => {
    expect(parseDocumentOutline('')).toEqual([]);
    expect(parseDocumentOutline('Just plain text without any LaTeX commands.')).toEqual([]);
    expect(parseDocumentOutline(null)).toEqual([]);
  });
});

describe('Phase 1 Parity: OutlineTab Live Search Filtering', () => {
  const entries: OutlineEntry[] = [
    { level: 0, levelName: 'Chapter', title: 'Foundations', line: 5 },
    { level: 1, levelName: 'Section', title: 'Background Research', line: 20 },
    { level: 2, levelName: 'Sub', title: 'Editor Layout Architecture', line: 45 },
    { level: 3, levelName: 'Subsub', title: 'Performance Profiling', line: 120 },
  ];

  function filterOutline(items: OutlineEntry[], query: string): OutlineEntry[] {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.levelName.toLowerCase().includes(q) ||
        String(item.line) === q,
    );
  }

  it('filters entries by heading title substring', () => {
    const res = filterOutline(entries, 'layout');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Editor Layout Architecture');
  });

  it('filters entries by level category name', () => {
    const res = filterOutline(entries, 'subsub');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Performance Profiling');
  });

  it('filters entries by exact line number', () => {
    const res = filterOutline(entries, '20');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Background Research');
  });

  it('returns empty array when query does not match any entry', () => {
    const res = filterOutline(entries, 'nonexistent');
    expect(res).toHaveLength(0);
  });
});

describe('Phase 1 Parity: EventBus Integration & Sidebar Tab Routing', () => {
  it('dispatches flux:open-panel with Outline tab name', () => {
    let receivedPanel: SidebarTabName | null = null;

    const unsub = EditorEventBus.on('flux:open-panel', (detail) => {
      receivedPanel = typeof detail === 'string' ? detail : detail.panel;
    });

    EditorEventBus.emit('flux:open-panel', 'Outline');
    expect(receivedPanel).toBe('Outline');

    EditorEventBus.emit('flux:open-panel', { panel: 'Outline' });
    expect(receivedPanel).toBe('Outline');

    unsub();
  });
});
