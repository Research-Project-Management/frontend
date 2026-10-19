/**
 * bib-parser.ts
 *
 * Re-exports the canonical BibTeX parser from `domain/latex/bib-parser.ts`.
 */

import {
  type BibEntry as DomainBibEntry,
  parseBibFields,
  parseBibContent,
  parseMultipleBibContents,
} from '@/features/editor/domain/latex/bib-parser';

export type BibEntry = Omit<DomainBibEntry, 'author' | 'rawText'>;

export {
  parseBibFields,
  parseBibContent,
  parseMultipleBibContents,
};
