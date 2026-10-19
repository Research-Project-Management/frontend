/**
 * Pure Domain & Utility Module: Zotero 7 RSS 2.0, RDF/PRISM (RSS 1.0), and Atom Feed Parser
 * + One-Click "Save to Library / Collection" Payload Mapper.
 *
 */

import {
  cleanDoi,
  extractArxivId,
  cleanPaperTitle,
} from '../domain/identifiers';
import {
  cleanAbstractText,
  stripLatexMarkup,
} from '../domain/metadata';
import {
  parseCreatorName,
  splitAuthorString,
} from '../domain/creators';
import { resolveArxivCategory } from '../domain/categories';

export type FeedFormat = 'rss2' | 'rdf' | 'atom' | 'unknown';

export interface ParsedFeedEntry {
  id: string;
  title: string;
  authors: string[];
  creators: Array<{ firstName: string; lastName: string; creatorType: 'author' }>;
  doi?: string;
  arxivId?: string;
  url?: string;
  pdfUrl?: string;
  publishedAt?: string;
  year?: number;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  categories: string[];
  feedFormat: FeedFormat;
}

import type { CreatorCredit } from './types/items.types';

export interface CreateLibraryItemFromFeedPayload {
  title: string;
  itemType: 'journalArticle' | 'preprint' | 'webpage';
  authors: string[];
  creators: CreatorCredit[];
  doi?: string;
  arxivId?: string;
  url?: string;
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  year?: number;
  publicationDate?: string;
  abstract?: string;
  tags: string[];
  collectionId?: string;
  collectionIds?: string[];
  scopeId: string;
}

function unwrapCdataAndEntities(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Repeatedly unwrap <![CDATA[ ... ]]> blocks
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  // Decode common XML/HTML entities
  text = text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return text.trim();
}

const TAG_REGEX_SINGLE_CACHE = new Map<string, RegExp>();
const TAG_REGEX_GLOBAL_CACHE = new Map<string, RegExp>();

function getSingleTagRegex(tag: string): RegExp {
  let rx = TAG_REGEX_SINGLE_CACHE.get(tag);
  if (!rx) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rx = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'i');
    TAG_REGEX_SINGLE_CACHE.set(tag, rx);
  }
  return rx;
}

function getGlobalTagRegex(tag: string): RegExp {
  let rx = TAG_REGEX_GLOBAL_CACHE.get(tag);
  if (!rx) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rx = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'gi');
    TAG_REGEX_GLOBAL_CACHE.set(tag, rx);
  }
  rx.lastIndex = 0;
  return rx;
}

function extractFirstTagText(xmlBlock: string, tagNames: readonly string[]): string {
  for (const tag of tagNames) {
    const regex = getSingleTagRegex(tag);
    const match = xmlBlock.match(regex);
    if (match && match[1]) {
      const cleaned = unwrapCdataAndEntities(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return '';
}

function extractAllTagTexts(xmlBlock: string, tagNames: readonly string[]): string[] {
  const results: string[] = [];
  for (const tag of tagNames) {
    const regex = getGlobalTagRegex(tag);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xmlBlock)) !== null) {
      if (match[1]) {
        const cleaned = unwrapCdataAndEntities(match[1]);
        if (cleaned) results.push(cleaned);
      }
    }
  }
  return results;
}

function extractAtomAuthors(entryXml: string): string[] {
  const authors: string[] = [];
  const authorBlockRegex = /<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/gi;
  let match: RegExpExecArray | null;
  while ((match = authorBlockRegex.exec(entryXml)) !== null) {
    const inner = match[1] || '';
    const name = extractFirstTagText(inner, ['name', 'atom:name']);
    if (name) {
      authors.push(stripLatexMarkup(name.replace(/<[^>]+>/g, '').trim()));
    } else {
      const rawText = unwrapCdataAndEntities(inner).replace(/<[^>]+>/g, '').trim();
      if (rawText) authors.push(stripLatexMarkup(rawText));
    }
  }
  return authors;
}

function extractCategories(entryXml: string): string[] {
  const categories = new Set<string>();

  // 1. Atom <category term="cs.CL" /> or <arxiv:primary_category term="cs.LG" />
  const termRegex = /<(?:arxiv:primary_category|category)\b[^>]*?\bterm=["']([^"']+)["'][^>]*>/gi;
  let termMatch: RegExpExecArray | null;
  while ((termMatch = termRegex.exec(entryXml)) !== null) {
    if (termMatch[1]) {
      const resolved = resolveArxivCategory(unwrapCdataAndEntities(termMatch[1]));
      if (resolved) categories.add(resolved);
    }
  }

  // 2. RSS <category>...</category> or <dc:subject>...</dc:subject>
  const textCategories = extractAllTagTexts(entryXml, ['category', 'dc:subject']);
  for (const cat of textCategories) {
    const clean = cat.replace(/<[^>]+>/g, '').trim();
    if (clean) categories.add(resolveArxivCategory(clean));
  }

  return Array.from(categories);
}

function extractLinks(entryXml: string): { url?: string; pdfUrl?: string } {
  let url: string | undefined;
  let pdfUrl: string | undefined;

  // Atom <link href="..." rel="..." type="..." title="..." />
  const linkTagRegex = /<link\b([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkTagRegex.exec(entryXml)) !== null) {
    const attrs = match[1] || '';
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch || !hrefMatch[1]) continue;
    const href = unwrapCdataAndEntities(hrefMatch[1]);
    const titleMatch = attrs.match(/\btitle=["']([^"']+)["']/i);
    const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
    const relMatch = attrs.match(/\brel=["']([^"']+)["']/i);

    const isPdf =
      (titleMatch && titleMatch[1]?.toLowerCase() === 'pdf') ||
      (typeMatch && typeMatch[1]?.toLowerCase().includes('pdf')) ||
      /\/pdf\//i.test(href) ||
      href.toLowerCase().endsWith('.pdf');

    if (isPdf && !pdfUrl) {
      pdfUrl = href;
    } else if (!url && (!relMatch || relMatch[1]?.toLowerCase() === 'alternate')) {
      url = href;
    } else if (!url) {
      url = href;
    }
  }

  // Standard RSS <link>https://...</link>
  if (!url) {
    const rssLink = extractFirstTagText(entryXml, ['link', 'guid']);
    if (rssLink && /^https?:\/\//i.test(rssLink)) {
      url = rssLink;
    }
  }

  return { url, pdfUrl };
}

function parseYearFromDateString(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  if (match && match[1]) {
    const y = parseInt(match[1], 10);
    if (y >= 1900 && y <= 2100) return y;
  }
  return undefined;
}

/**
 * Parses an RSS 2.0, RSS 1.0 (RDF/PRISM/Dublin Core), or Atom XML feed string
 * into normalized `ParsedFeedEntry` objects.
 */
export function parseFeedXml(xmlInput?: string | null): ParsedFeedEntry[] {
  if (!xmlInput || typeof xmlInput !== 'string') return [];
  const trimmed = xmlInput.trim();
  if (!trimmed) return [];

  const isAtom = /<feed\b/i.test(trimmed) || /<entry\b/i.test(trimmed);
  const isRdf = /<rdf:RDF\b/i.test(trimmed) || /xmlns:prism=/i.test(trimmed);
  const feedFormat: FeedFormat = isAtom
    ? 'atom'
    : isRdf
      ? 'rdf'
      : /<rss\b|<channel\b/i.test(trimmed)
        ? 'rss2'
        : 'unknown';

  // Extract channel/feed-level publication title (excluding <item> / <entry> blocks)
  const headerXml = trimmed.replace(/<(?:item|entry)\b[\s\S]*$/i, '');
  const feedLevelTitle = cleanPaperTitle(
    extractFirstTagText(headerXml, ['prism:publicationName', 'dc:source', 'title'])
      .replace(/<[^>]+>/g, ''),
  );

  const entryRegex = /<(?:item|entry)\b(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi;
  const entries: ParsedFeedEntry[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = entryRegex.exec(trimmed)) !== null) {
    const block = match[1] || '';

    const rawTitle = extractFirstTagText(block, ['title', 'dc:title'])
      .replace(/<[^>]+>/g, '')
      .replace(/\s*\(arXiv:[^)]+\)\s*$/i, '');
    const title = cleanPaperTitle(rawTitle);
    if (!title) continue;

    // Authors: Atom <author><name>, Dublin Core <dc:creator>, or RSS <author>
    const atomAuthors = extractAtomAuthors(block);
    const dcCreators = extractAllTagTexts(block, ['dc:creator', 'author', 'creator']);
    const rawAuthorList = atomAuthors.length > 0 ? atomAuthors : dcCreators;

    const normalizedAuthors: string[] = [];
    const seenAuthors = new Set<string>();
    for (const rawAuth of rawAuthorList) {
      const stripped = rawAuth.replace(/<[^>]+>/g, '').trim();
      for (const splitAuth of splitAuthorString(stripped)) {
        const cleanAuth = stripLatexMarkup(splitAuth).trim();
        if (cleanAuth && !seenAuthors.has(cleanAuth.toLowerCase())) {
          seenAuthors.add(cleanAuth.toLowerCase());
          normalizedAuthors.push(cleanAuth);
        }
      }
    }

    const creators = normalizedAuthors.map((name) => {
      const parsed = parseCreatorName(name);
      return {
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || parsed.fullName || name,
        creatorType: 'author' as const,
      };
    });

    const { url, pdfUrl } = extractLinks(block);
    const rawId = extractFirstTagText(block, ['id', 'guid', 'dc:identifier']) || url || `feed-item-${index}`;

    // DOI extraction from prism:doi, dc:identifier, arxiv:doi, or URL/abstract
    const explicitDoiCandidates = [
      extractFirstTagText(block, ['prism:doi', 'arxiv:doi', 'dc:identifier', 'doi']),
      rawId,
      url || '',
    ];
    let doi: string | undefined;
    for (const candidate of explicitDoiCandidates) {
      const cleaned = cleanDoi(candidate);
      if (cleaned) {
        doi = cleaned;
        break;
      }
    }

    // ArXiv ID extraction
    const arxivCandidates = [
      rawId,
      url || '',
      extractFirstTagText(block, ['arxiv:id', 'dc:identifier']),
      rawTitle,
    ];
    let arxivId: string | undefined;
    for (const candidate of arxivCandidates) {
      const extracted = extractArxivId(candidate);
      if (extracted && (/arxiv/i.test(candidate) || /^\d{4}\.\d{4,5}/.test(extracted))) {
        arxivId = extracted;
        break;
      }
    }

    const publishedAt =
      extractFirstTagText(block, [
        'published',
        'prism:publicationDate',
        'dc:date',
        'pubDate',
        'updated',
      ]) || undefined;
    const year = parseYearFromDateString(publishedAt);

    const entryPubTitle = cleanPaperTitle(
      extractFirstTagText(block, [
        'prism:publicationName',
        'dc:source',
        'arxiv:journal_ref',
      ]).replace(/<[^>]+>/g, ''),
    );
    const publicationTitle =
      entryPubTitle ||
      (arxivId && !entryPubTitle ? 'arXiv' : feedLevelTitle || undefined);

    const volume = extractFirstTagText(block, ['prism:volume']) || undefined;
    const issue = extractFirstTagText(block, ['prism:number', 'prism:issue']) || undefined;
    const startPage = extractFirstTagText(block, ['prism:startingPage']);
    const endPage = extractFirstTagText(block, ['prism:endingPage']);
    const pages =
      startPage && endPage
        ? `${startPage}-${endPage}`
        : startPage || undefined;

    const rawAbstract = extractFirstTagText(block, [
      'summary',
      'content:encoded',
      'description',
      'dc:description',
      'content',
    ]);
    // Strip arXiv RSS preamble like "arXiv:2401.12345v1 Announce Type: new \nAbstract: "
    const strippedArxivPreamble = rawAbstract.replace(
      /^arXiv:[^\s]+\s+Announce Type:[^\n]+\s*(?:Abstract:\s*)?/i,
      '',
    );
    const abstract = cleanAbstractText(strippedArxivPreamble) || undefined;

    const categories = extractCategories(block);

    entries.push({
      id: rawId,
      title,
      authors: normalizedAuthors,
      creators,
      doi,
      arxivId,
      url,
      pdfUrl: pdfUrl || (arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : undefined),
      publishedAt,
      year,
      publicationTitle,
      volume,
      issue,
      pages,
      abstract,
      categories,
      feedFormat,
    });

    index++;
  }

  return entries;
}

/**
 * Maps a `ParsedFeedEntry` into a normalized `CreateLibraryItemFromFeedPayload`
 * for one-click "Save to Library / Collection" in Personal or Project Libraries.
 */
export function mapFeedEntryToCreateItemPayload(
  entry: ParsedFeedEntry,
  options?: { scopeId?: string; collectionId?: string },
): CreateLibraryItemFromFeedPayload {
  const scopeId = options?.scopeId || 'user';
  const collectionId = options?.collectionId || undefined;
  const isPreprint = Boolean(
    entry.arxivId && (!entry.doi || entry.doi.toLowerCase().includes('arxiv')),
  );

  const creators: CreatorCredit[] = (entry.creators && entry.creators.length > 0)
    ? entry.creators.map((c, idx) => ({
        creatorType: c.creatorType || 'author',
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: [c.firstName, c.lastName].filter(Boolean).join(' ') || (c.lastName || 'Unknown Author'),
        orderIndex: idx,
        fieldMode: 0,
      }))
    : (entry.authors || []).map((author, idx) => ({
        creatorType: 'author',
        fullName: author,
        orderIndex: idx,
        fieldMode: 0,
      }));

  return {
    title: entry.title,
    itemType: isPreprint ? 'preprint' : 'journalArticle',
    authors: entry.authors,
    creators,
    doi: entry.doi,
    arxivId: entry.arxivId,
    url: entry.url || entry.pdfUrl,
    publicationTitle: entry.publicationTitle,
    volume: entry.volume,
    issue: entry.issue,
    pages: entry.pages,
    year: entry.year,
    publicationDate: entry.publishedAt,
    abstract: entry.abstract,
    tags: entry.categories,
    collectionId,
    collectionIds: collectionId ? [collectionId] : [],
    scopeId,
  };
}
