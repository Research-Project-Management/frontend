import { apiGet, apiPost } from '@/shared/lib/api';
import type { ReferenceData } from '../types/reference.types';
import { cleanDoi } from '../utils/library.util';

export type { ReferenceData };

export async function fetchReferenceByDoi(doi: string): Promise<ReferenceData> {
  const normalizedDoi = cleanDoi(doi);
  if (!normalizedDoi) {
    throw new Error('Invalid DOI provided');
  }

  try {
    const data = await apiPost<{ work?: ReferenceData; data?: ReferenceData } | ReferenceData>(
      `/api/library/references/resolve-doi`,
      { doi: normalizedDoi }
    );
    if ('work' in data && data.work) return data.work;
    if ('data' in data && data.data) return data.data;
    return data as ReferenceData;
  } catch {
    const fallback = await apiGet<{ work?: ReferenceData; data?: ReferenceData } | ReferenceData>(
      `/api/library/references/doi/${encodeURIComponent(normalizedDoi)}`
    );
    if ('work' in fallback && fallback.work) return fallback.work;
    if ('data' in fallback && fallback.data) return fallback.data;
    return fallback as ReferenceData;
  }
}

export async function searchReferences(query: string, rows = 1): Promise<{ works: ReferenceData[]; totalResults: number }> {
  try {
    const res = await apiGet<{ works: ReferenceData[]; totalResults: number }>(
      `/api/library/references/crossref/search`,
      { params: { query, rows: String(rows) } }
    );
    if (res && Array.isArray(res.works)) return res;
  } catch {
    // Fallback to direct CrossRef REST API from browser
  }

  try {
    const response = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { works: [], totalResults: 0 };
    const json = await response.json();
    const items = json?.message?.items || [];
    const totalResults = json?.message?.['total-results'] || items.length;

    const works: ReferenceData[] = items.map((message: any) => {
      const title = Array.isArray(message.title) ? message.title[0] || 'Untitled' : message.title || 'Untitled';
      const authors: string[] = [];
      if (Array.isArray(message.author)) {
        for (const auth of message.author) {
          if (auth.given && auth.family) authors.push(`${auth.family}, ${auth.given}`);
          else if (auth.family) authors.push(auth.family);
          else if (auth.name) authors.push(auth.name);
        }
      }
      let year: number | string = '';
      const dateParts =
        message['published-print']?.['date-parts']?.[0] ||
        message['published-online']?.['date-parts']?.[0] ||
        message.issued?.['date-parts']?.[0];
      if (dateParts && dateParts[0]) year = Number(dateParts[0]);

      return {
        doi: message.DOI || '',
        title,
        authors,
        year,
        journal: Array.isArray(message['container-title']) ? message['container-title'][0] : (message['container-title'] || ''),
        publisher: message.publisher || '',
        volume: message.volume || '',
        issue: message.issue || '',
        pages: message.page || '',
        issn: Array.isArray(message.ISSN) ? message.ISSN[0] : (message.ISSN || ''),
        isbn: Array.isArray(message.ISBN) ? message.ISBN[0] : (message.ISBN || ''),
        url: message.URL || (message.DOI ? `https://doi.org/${message.DOI}` : ''),
        abstract: message.abstract ? message.abstract.replace(/<[^>]*>/g, '') : '',
        type: message.type || 'journal-article',
        itemType: message.type === 'journal-article' ? 'journalArticle' : (message.type || 'journalArticle'),
        score: message.score || 0,
      } as ReferenceData;
    });

    return { works, totalResults };
  } catch (err) {
    console.warn('[searchReferences] CrossRef query failed:', err);
    return { works: [], totalResults: 0 };
  }
}

export const ReferenceService = {
  resolveDoi: fetchReferenceByDoi,
  search: searchReferences,
};
