import { describe, it, expect } from 'vitest';
import {
  validateCitationKey,
  refactorCitationKeyInBibTeX,
  refactorCitationKeyInLatex,
  refactorCitationKeyAcrossFiles,
} from '@/features/editor/domain/citation/citation-refactor';

describe('Citation Key Refactoring & Renaming Subsystem (Overleaf Parity)', () => {
  describe('1. validateCitationKey', () => {
    it('accepts standard valid BibTeX citation keys', () => {
      expect(validateCitationKey('vaswani2017').isValid).toBe(true);
      expect(validateCitationKey('vaswani_attention_2017').isValid).toBe(true);
      expect(validateCitationKey('vaswani:2017').isValid).toBe(true);
      expect(validateCitationKey('nguyen-van-an.2024').isValid).toBe(true);
      expect(validateCitationKey('nguyen2024#1').isValid).toBe(true);
    });

    it('rejects empty or whitespace-only keys', () => {
      expect(validateCitationKey('').isValid).toBe(false);
      expect(validateCitationKey('   ').isValid).toBe(false);
      expect(validateCitationKey('vaswani 2017').isValid).toBe(false);
    });

    it('rejects keys prefixed with @ and gives helpful tip', () => {
      const res = validateCitationKey('@vaswani2017');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('@');
    });

    it('rejects illegal characters like curly braces, commas, backslashes, quotes', () => {
      expect(validateCitationKey('vaswani{2017}').isValid).toBe(false);
      expect(validateCitationKey('vaswani,2017').isValid).toBe(false);
      expect(validateCitationKey('vaswani\\2017').isValid).toBe(false);
      expect(validateCitationKey('vaswani"2017').isValid).toBe(false);
      expect(validateCitationKey('vaswani%2017').isValid).toBe(false);
    });

    it('rejects new key identical to old key', () => {
      const res = validateCitationKey('vaswani2017', 'vaswani2017');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('phải khác');
    });
  });

  describe('2. refactorCitationKeyInBibTeX', () => {
    const sampleBib = `@article{oldKey,
  author = {Vaswani, Ashish and others},
  title = {Attention is All you Need},
  journal = {NeurIPS},
  year = {2017}
}

@inproceedings{oldKey_extended,
  author = {Other, Author},
  title = {Different Paper},
  year = {2018}
}`;

    it('renames exact BibTeX entry definition without modifying substrings', () => {
      const res = refactorCitationKeyInBibTeX(sampleBib, 'oldKey', 'newKey');
      expect(res.count).toBe(1);
      expect(res.content).toContain('@article{newKey,');
      // Substring @inproceedings{oldKey_extended, must remain untouched!
      expect(res.content).toContain('@inproceedings{oldKey_extended,');
    });

    it('handles whitespace around braces and commas in BibTeX entries', () => {
      const bibWithSpaces = `@book{   oldKey   ,
  title = {Deep Learning}
}`;
      const res = refactorCitationKeyInBibTeX(bibWithSpaces, 'oldKey', 'goodfellow2016');
      expect(res.count).toBe(1);
      expect(res.content).toContain('@book{   goodfellow2016   ,');
    });
  });

  describe('3. refactorCitationKeyInLatex', () => {
    it('renames single and multi-key LaTeX citation commands', () => {
      const latex = 'As shown in \\cite{oldKey} and \\citep{devlin2018, oldKey, radford2019}.';
      const res = refactorCitationKeyInLatex(latex, 'oldKey', 'vaswani2017');

      expect(res.count).toBe(2);
      expect(res.content).toBe(
        'As shown in \\cite{vaswani2017} and \\citep{devlin2018, vaswani2017, radford2019}.'
      );
    });

    it('preserves leading and trailing spacing inside citation braces', () => {
      const latex = '\\citet[see][p. 10]{  oldKey  }';
      const res = refactorCitationKeyInLatex(latex, 'oldKey', 'vaswani2017');

      expect(res.count).toBe(1);
      expect(res.content).toBe('\\citet[see][p. 10]{  vaswani2017  }');
    });

    it('never corrupts similar substrings of other citation keys', () => {
      const latex = '\\cite{oldKey_2020, prefix_oldKey, oldKey}';
      const res = refactorCitationKeyInLatex(latex, 'oldKey', 'newKey');

      expect(res.count).toBe(1);
      expect(res.content).toBe('\\cite{oldKey_2020, prefix_oldKey, newKey}');
    });

    it('refactors Pandoc Markdown bracketed citations [@oldKey; @other]', () => {
      const md = 'Transformer models [@oldKey; @devlin2018, p. 12] revolutionized NLP.';
      const res = refactorCitationKeyInLatex(md, 'oldKey', 'vaswani2017');

      expect(res.count).toBe(1);
      expect(res.content).toBe('Transformer models [@vaswani2017; @devlin2018, p. 12] revolutionized NLP.');
    });

    it('refactors Pandoc inline citations @oldKey', () => {
      const md = 'According to @oldKey, attention mechanisms suffice.';
      const res = refactorCitationKeyInLatex(md, 'oldKey', 'vaswani2017');

      expect(res.count).toBe(1);
      expect(res.content).toBe('According to @vaswani2017, attention mechanisms suffice.');
    });
  });

  describe('4. refactorCitationKeyAcrossFiles', () => {
    it('renames citation keys across multiple project files (.bib, .tex, .md)', () => {
      const files = [
        {
          id: 'file-1',
          path: 'references.bib',
          content: '@article{vaswani,\n  title={Attention}\n}',
        },
        {
          id: 'file-2',
          path: 'main.tex',
          content: '\\section{Introduction}\nSee \\cite{vaswani} and \\citep{other, vaswani}.',
        },
        {
          id: 'file-3',
          path: 'chapter1.tex',
          content: 'No citations here.',
        },
        {
          id: 'file-4',
          path: 'notes.md',
          content: 'Important reference: [@vaswani]',
        },
      ];

      const res = refactorCitationKeyAcrossFiles(files, 'vaswani', 'vaswani2017');

      expect(res.totalCount).toBe(4);
      expect(res.modifiedFiles).toHaveLength(3);

      const bibMod = res.modifiedFiles.find((f) => f.path === 'references.bib');
      expect(bibMod?.newContent).toContain('@article{vaswani2017,');

      const texMod = res.modifiedFiles.find((f) => f.path === 'main.tex');
      expect(texMod?.newContent).toContain('\\cite{vaswani2017} and \\citep{other, vaswani2017}');

      const mdMod = res.modifiedFiles.find((f) => f.path === 'notes.md');
      expect(mdMod?.newContent).toContain('[@vaswani2017]');
    });
  });
});
