import type { PdfMetadata, CrossrefWork } from '../types/preview.types';

const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/[^\s<>'{}|\\^`[\]]+)/g;

export function extractDoiFromText(text: string): string | null {
  const matches = text.match(DOI_REGEX);
  if (!matches || !matches[0]) return null;
  let doi = matches[0].trim();
  
  doi = doi.replace(/[.,;:!?\s]+$/, '');

  if (doi.endsWith(')')) {
    const openCount = (doi.match(/\(/g) || []).length;
    const closeCount = (doi.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      doi = doi.slice(0, -1).trim();
    }
  }

  if (doi.endsWith(']')) {
    const openCount = (doi.match(/\[/g) || []).length;
    const closeCount = (doi.match(/\]/g) || []).length;
    if (closeCount > openCount) {
      doi = doi.slice(0, -1).trim();
    }
  }

  if (doi.startsWith('(') && doi.endsWith(')')) {
    doi = doi.slice(1, -1).trim();
  }
  if (doi.startsWith('[') && doi.endsWith(']')) {
    doi = doi.slice(1, -1).trim();
  }
  doi = doi.replace(/[.,;:!?\s]+$/, '');

  return doi || null;
}

export function parseXmpMetadata(xml: string): Record<string, string> {
  if (!xml) return {};
  const fields: Record<string, string> = {};
  const get = (tag: string): string | undefined => {
    const patterns = [
      new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'),
      new RegExp(`<${tag}[^>]*>\\s*<rdf:(?:Alt|Seq|Bag)>\\s*<rdf:li[^>]*>([^<]+)</rdf:li>`, 'i'),
    ];
    for (const p of patterns) {
      const m = xml.match(p);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };

  fields.title = get('dc:title') || '';
  fields.creator = get('dc:creator') || '';
  fields.description = get('dc:description') || '';
  fields.date = get('dc:date') || '';
  fields.rights = get('dc:rights') || '';
  fields.language = get('dc:language') || '';
  fields.publisher = get('dc:publisher') || '';

  fields.doi = get('prism:doi') || get('pdfx:doi') || get('crossmark:DOI') || '';
  fields.journal = get('prism:publicationName') || get('prism:aggregationType') || '';
  fields.publicationName = get('prism:publicationName') || '';
  fields.volume = get('prism:volume') || '';
  fields.number = get('prism:number') || '';
  fields.issue = get('prism:issueIdentifier') || '';
  fields.issn = get('prism:issn') || get('prism:eIssn') || '';
  fields.isbn = get('prism:isbn') || '';
  fields.startPage = get('prism:startingPage') || '';
  fields.endPage = get('prism:endingPage') || '';
  fields.pages = get('prism:pageRange') || '';
  fields.publicationDate = get('prism:coverDate') || get('prism:coverDisplayDate') || '';
  fields.keywords = get('pdf:Keywords') || get('prism:keyword') || '';

  if (!fields.doi) {
    const doiMatch = xml.match(/doi[>''\s:]+([^<''\s]+10\.\d{4,}\/[^\s<'']+)/i);
    if (doiMatch) fields.doi = doiMatch[1];
  }

  fields.abstract = get('dc:description') || get('pdfx:Abstract') || '';

  for (const k of Object.keys(fields)) {
    if (!fields[k]) delete fields[k];
  }

  return fields;
}

export function mergeCrossrefMetadata(base: PdfMetadata, work: CrossrefWork): PdfMetadata {
  return {
    ...base,
    title: base.title || work.title || base.title,
    author: base.author || work.authors?.join(', ') || base.author,
    authors: work.authors?.length ? work.authors : base.authors,
    editors: work.editors?.length ? work.editors : base.editors,
    doi: base.doi || work.doi || base.doi,
    journal: base.journal || work.journal || base.journal,
    publicationTitle: base.publicationTitle || work.publicationTitle || work.journal || base.publicationTitle,
    publicationDate: base.publicationDate || work.publicationDate || (work.year ? String(work.year) : undefined) || base.publicationDate,
    publisher: base.publisher || work.publisher || base.publisher,
    place: base.place || work.place || base.place,
    issn: base.issn || work.issn || base.issn,
    isbn: base.isbn || work.isbn || base.isbn,
    volume: base.volume || work.volume || base.volume,
    issue: base.issue || work.issue || base.issue,
    pages: base.pages || work.pages || base.pages,
    year: base.year || work.year || base.year,
    abstract: base.abstract || work.abstract || base.abstract,
    type: base.type || work.type || base.type,
    itemType: base.itemType || work.itemType || work.type || base.itemType,
    url: base.url || work.url || base.url,
    language: base.language || work.language || base.language,
    journalAbbr: base.journalAbbr || work.journalAbbr || base.journalAbbr,
    shortTitle: base.shortTitle || work.shortTitle || base.shortTitle,
    rights: base.copyright || work.rights || base.copyright,
    license: base.license || work.license || work.rights || base.license,
    keywordsList: work.keywords?.length ? work.keywords : base.keywordsList,
    crossrefEnriched: true,
  };
}

export function toAuthors(metadata?: { author?: string; authors?: string[] } | null): string[] {
  if (metadata?.authors?.length) return metadata.authors;
  if (metadata?.author) {
    return metadata.author
      .split(/,|;|\band\b/i)
      .map((author: string) => author.trim())
      .filter(Boolean);
  }
  return [];
}

export function toKeywords(keywords?: string): string[] {
  return keywords
    ? keywords
        .split(/,|;/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];
}

export function toYear(year?: string | number): number | null {
  if (typeof year === 'number') return year;
  if (typeof year === 'string') {
    const parsed = parseInt(year, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
