import { describe, it, expect } from 'vitest';
import {
  getDemoManuscript,
  DEMO_MAIN_TEX,
  DEMO_PDF_URL,
  DEMO_REFERENCES_BIB,
} from '@/features/editor/mock/demo-dataset';

describe('Editor Demo Dataset (Adam Paper)', () => {
  it('should return complete manuscript page and child files', () => {
    const { page, files } = getDemoManuscript('demo');

    expect(page.id).toBe('demo');
    expect(page.title).toContain('Adam');
    expect(page.content).toBe(DEMO_MAIN_TEX);
    expect(page.author.name).toBe('Diederik P. Kingma & Jimmy Ba');

    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('should include all necessary modular LaTeX sections and bibliography', () => {
    const { files } = getDemoManuscript('demo');
    const titles = files.map((f) => f.title);

    expect(titles).toContain('main.tex');
    expect(titles).toContain('macros.tex');
    expect(titles).toContain('sections/01_introduction.tex');
    expect(titles).toContain('sections/02_algorithm.tex');
    expect(titles).toContain('sections/03_experiments.tex');
    expect(titles).toContain('sections/04_convergence.tex');
    expect(titles).toContain('sections/05_conclusion.tex');
    expect(titles).toContain('references.bib');
  });

  it('should have valid BibTeX citation keys in references.bib', () => {
    expect(DEMO_REFERENCES_BIB).toContain('@article{kingma2014adam');
    expect(DEMO_REFERENCES_BIB).toContain('@article{duchi2011adaptive');
    expect(DEMO_REFERENCES_BIB).toContain('@inproceedings{vaswani2017attention');
    expect(DEMO_REFERENCES_BIB).toContain('@inproceedings{he2016deep');
  });

  it('should provide pre-compiled PDF link for split-screen rendering', () => {
    expect(DEMO_PDF_URL).toBe('/papers/adam-paper.pdf');
  });
});
