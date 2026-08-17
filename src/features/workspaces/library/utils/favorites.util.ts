import type { Paper } from '../types/library.types';

/**
 * Filters items marked as favorites/starred.
 */
export function filterFavoritePapers(papers: Paper[]): Paper[] {
  return papers.filter((p) => Boolean(p.isFavorite || (p as any).starred));
}

/**
 * Sorts favorites by year descending or title ascending.
 */
export function sortFavorites(papers: Paper[], sortBy: 'year' | 'title' = 'year'): Paper[] {
  return [...papers].sort((a, b) => {
    if (sortBy === 'year') {
      const yearA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10);
      const yearB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10);
      return yearB - yearA;
    }
    return (a.title || '').localeCompare(b.title || '');
  });
}
