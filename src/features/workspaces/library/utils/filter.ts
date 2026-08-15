import type { Paper } from '../types/library.types';

/**
 * Filter papers by search text across title, authors, journal, and abstract.
 */
export const filterPapers = (papers: Paper[], search: string): Paper[] => {
  if (!search.trim()) return papers;

  const q = search.toLowerCase();
  return papers.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.authors.some((a) => a.toLowerCase().includes(q)) ||
      (p.journal || '').toLowerCase().includes(q) ||
      (p.abstract || '').toLowerCase().includes(q),
  );
};
