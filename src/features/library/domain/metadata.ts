/**
 * Pure Domain Model: Academic Metadata Formatting, Abstract Normalization & Tags/Notes
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item, Paper, Note } from '../types/library.types';
import { getVenueFieldForType } from '../types';
import { cleanDoi } from './identifiers';
import {
  ARXIV_CATEGORY_MAP,
  CANONICAL_ARXIV_CATEGORIES,
  resolveArxivCategory,
} from './categories';

const SCIENTIFIC_ACRONYMS = new Set([
  'AI', 'ML', 'NLP', 'CV', 'CNN', 'RNN', 'LSTM', 'GAN', 'BERT', 'LLM', 'COCO',
  'YOLO', 'RESNET', 'VGG', 'SVM', 'RL', 'API', 'GPU', 'CPU', 'TPU', 'DNA', 'RNA', 'SGD', 'ADAM',
]);

export const NOISE_TAG_WORDS = new Set([
  'undefined', 'null', 'n/a', 'na', 'none', 'unknown', 'nil', 'empty', 'void',
  'sample', 'test', 'draft', 'untitled', 'etc', 'etc.', 'various', 'others',
  'and others', 'et al', 'et al.', 'et-al', 'introduction', 'conclusion',
  'conclusions', 'background', 'paper', 'article', 'study', 'approach',
  'method', 'methods', 'methodology', 'result', 'results', 'discussion',
  'overview', 'experiment', 'experiments', 'experimental', 'analysis',
  'abstract', 'summary', 'contents', 'table of contents', 'references',
  'bibliography', 'appendix', 'acknowledgments', 'acknowledgements',
  'keywords', 'keyword', 'index terms', 'key words', 'subject', 'subjects',
  'topics', 'topic', 'category', 'categories', 'all rights reserved',
  'copyright', 'open access', 'creative commons', 'springer', 'elsevier',
  'ieee', 'acm', 'wiley', 'nature', 'science', 'proceedings', 'conference',
  'journal', 'volume', 'issue', 'page', 'pages', 'pp', 'no', 'vol', 'pdf',
  'full text', 'available online', 'downloaded', 'preprint', 'manuscript',
  'author', 'authors', 'editor', 'editors',
]);

export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw
    .replace(/â€“|â€”/g, '-')
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€ /g, '"')
    .replace(/\uFFFD/g, '')
    .trim();

  str = str.replace(/<[^>]+>/g, '').replace(/[{}]/g, '').trim();
  str = str.replace(/(?<=[\w\d])\s+\([^)]*\)$/g, '').trim();

  str = str
    .replace(
      /^(?:tags?|keywords?|index terms?|categor(?:y|ies)|subject(?: areas?)?|topics?|terms?|arxiv)[:—\-\s]+/i,
      ''
    )
    .replace(/^[#"''`([{<•·*—\-\s]+/, '')
    .replace(/^(?:\.{2,}|…)+/, '')
    .replace(/["''`)\]}>]+$/, '')
    .replace(/(?:\.{2,}|…|[.,;:—\-\s•·*])+$/, '')
    .trim();

  if (!str) return null;

  const lower = str.toLowerCase();
  if (ARXIV_CATEGORY_MAP[lower]) return ARXIV_CATEGORY_MAP[lower];
  const withDot = lower.replace(/[-_]/g, '.');
  if (ARXIV_CATEGORY_MAP[withDot]) return ARXIV_CATEGORY_MAP[withDot];

  if (NOISE_TAG_WORDS.has(lower)) return null;
  if (str.length < 2 || str.length > 60) return null;
  if (!/[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(str)) return null;
  if (/^\d+$/.test(str)) return null;
  if (/^(?:p|pp|vol|no|v|issue)\.?\s*\d+(?:[-–—]\d+)?$/i.test(str)) return null;
  if (/^\d{1,4}[-–—]\d{1,4}$/.test(str)) return null;
  if (
    /^https?:\/\//i.test(str) ||
    /^www\./i.test(str) ||
    /@/.test(str) ||
    /^10\.\d{4,9}\//i.test(str)
  ) {
    return null;
  }
  if (/^(\.{2,}|…)+$/.test(str)) return null;
  if (NOISE_TAG_WORDS.has(str.toLowerCase())) return null;

  const formatted = str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (SCIENTIFIC_ACRONYMS.has(upper)) return upper;
      if (word === '-') return '-';
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => {
            const partUpper = part.toUpperCase();
            if (SCIENTIFIC_ACRONYMS.has(partUpper)) return partUpper;
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          })
          .join('-');
      }
      const lowerWord = word.toLowerCase();
      if (['and', 'or', 'of', 'in', 'on', 'for', 'with', 'at', 'by'].includes(lowerWord)) {
        return lowerWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  let result = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  result = result.replace(/(?:\.{2,}|…|[.,;:—\-\s])+$/, '').trim();
  return result.length >= 2 ? result : null;
}

export function normalizeTags(
  paper: Partial<Item> | null | undefined,
  maxTags?: number
): string[] {
  if (!paper) return [];
  const raw: unknown[] = [
    ...(Array.isArray(paper.tags) ? paper.tags : []),
    ...(Array.isArray(paper.labels) ? paper.labels : []),
    ...(Array.isArray(paper.keywords) ? paper.keywords : []),
    ...(Array.isArray((paper as any).itemTags)
      ? (paper as any).itemTags.map((it: any) => it?.tag?.name ?? '')
      : []),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    const s =
      typeof t === 'string'
        ? t
        : t && typeof t === 'object'
          ? (typeof (t as any).tag === 'string'
              ? (t as any).tag
              : typeof (t as any).name === 'string'
                ? (t as any).name
                : '')
          : '';
    if (!s) continue;
    const parts = s.split(/[,;\n\r|•·]/).map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = cleanSingleFrontendTag(part);
      if (cleaned) {
        const lowerKey = cleaned.toLowerCase();
        if (!seen.has(lowerKey)) {
          seen.add(lowerKey);
          result.push(cleaned);
        }
      }
    }
  }
  return typeof maxTags === 'number' && maxTags > 0 ? result.slice(0, maxTags) : result;
}

export interface NormalizedNote {
  id: string;
  content: string;
  contentMd?: string;
  contentJson?: unknown;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeNotes(
  notes?: Array<string | Note | { id?: string; content?: string; note?: string }> | null
): NormalizedNote[] {
  if (!Array.isArray(notes)) return [];

  return notes.map((note, index) => {
    if (typeof note === 'string') {
      const contentHash = note.trim().slice(0, 32).replace(/[^a-z0-9]/gi, '').toLowerCase() || index.toString();
      return {
        id: `local-${contentHash}`,
        content: note,
        createdAt: new Date().toISOString(),
      };
    }

    const noteObj = note as any;
    const rawContent =
      noteObj.content ||
      noteObj.contentMd ||
      noteObj.note ||
      (typeof noteObj.contentJson === 'string' ? noteObj.contentJson : '') ||
      '';
    const cleanPreview = /<\/?[a-z][\s\S]*>/i.test(rawContent)
      ? rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : rawContent;

    return {
      id: note.id || `note-${index}`,
      content: cleanPreview,
      contentMd: noteObj.contentMd || (noteObj.note ? cleanPreview : rawContent),
      contentJson: noteObj.contentJson,
      note: noteObj.note || `<p>${cleanPreview}</p>`,
      createdAt: (note as Note).createdAt || new Date().toISOString(),
      updatedAt: (note as Note).updatedAt,
    };
  });
}

export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  cleaned = cleaned.replace(/\\(?:textbf|textit|emph|underline|text)\{([^}]+)\}/g, '$1');
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*[:.—\-–\u2014\u2013]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*\r?\n+/i, '');

  cleaned = cleaned.replace(/(?:\((?:19|20)\d{2}\)\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/(?:\[(?:19|20)\d{2}\]\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/\((?:(?:19|20)\d{2}[,\s;]*){3,}\)\.?/g, '');

  cleaned = cleaned.replace(
    /(?:(?:\n\s*|\.\s+|\s+)[*†‡§\d]*\s*(?:Equal contribution|Corresponding author|Correspondence to|Author ordering|Listing order|These authors contributed equally|Work performed while|Supported in part by|This work was supported by)[\s\S]*$)/i,
    '.'
  );

  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)(?:ACM Reference [Ff]ormat|Index Terms|Keywords|Key words|Additional Key Words and Phrases)[—:\-\s]+[\s\S]*$/i,
    ''
  );

  cleaned = cleaned.replace(
    /(?:\n\s*|\.\s+|\s+)(?:Copyright\s*(?:\(c\)|©)?\s*(?:19|20)\d{2}|©\s*(?:19|20)\d{2}\s*IEEE)[\s\S]*$/i,
    ''
  );
  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)\b\d{4}-\d{3}[\dX]\s*(?:\(c\)|©)?\s*\d{4}\s*IEEE[\s\S]*$/i,
    ''
  );

  const rawParagraphs = cleaned.split(/\r?\n\s*\r?\n/);
  const normalizedParagraphs = rawParagraphs
    .map((paragraph) => {
      let p = paragraph.replace(/([a-zA-Z]{2,})-\s*\r?\n\s*([a-zA-Z]{2,})/g, '$1$2');
      p = p.replace(/\r?\n/g, ' ');
      p = p.replace(/\s+/g, ' ').trim();
      p = p.replace(/\s+([.,;:!?])/g, '$1');
      p = p.replace(/\.\s*\.(?!\.)/g, '.');
      return p;
    })
    .filter((p) => p.length > 0);

  return normalizedParagraphs.join('\n\n').trim();
}

export function getPublicationVenue(
  item?: Partial<Item> | Partial<Paper> | Record<string, any> | null
): string {
  if (!item) return '—';
  const anyItem = item as Record<string, any>;
  const rawItemType = anyItem.itemType || anyItem.item_type || anyItem.type || anyItem.cslType;
  const itemType = String(rawItemType || 'journalArticle');
  const typeLower = itemType.toLowerCase();
  const ef = (anyItem.extraFields as Record<string, any>) || {};

  const venueField = getVenueFieldForType(itemType);
  const directValue = anyItem[venueField] || ef[venueField];
  if (directValue && typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim();
  }

  if (typeLower === 'preprint') {
    if (typeof anyItem.repository === 'string' && anyItem.repository.trim()) {
      return anyItem.repository.trim();
    }
    if (typeof ef.repository === 'string' && ef.repository.trim()) {
      return ef.repository.trim();
    }
    if (
      typeof anyItem.publisher === 'string' &&
      anyItem.publisher.trim() &&
      !/^arxiv$/i.test(anyItem.publisher.trim())
    ) {
      return anyItem.publisher.trim();
    }
    const isArxiv = Boolean(
      anyItem.arxivId ||
        (typeof anyItem.doi === 'string' && anyItem.doi.includes('arXiv')) ||
        (typeof anyItem.callNumber === 'string' && anyItem.callNumber.toLowerCase().startsWith('arxiv:')) ||
        (typeof anyItem.publicationTitle === 'string' && /arxiv/i.test(anyItem.publicationTitle)) ||
        (typeof anyItem.publisher === 'string' && /arxiv/i.test(anyItem.publisher))
    );
    if (isArxiv) return 'arXiv';
    if (
      typeof anyItem.publicationTitle === 'string' &&
      anyItem.publicationTitle.trim() &&
      !/^(ieee|acm|arxiv(\s*preprint)?)$/i.test(anyItem.publicationTitle.trim())
    ) {
      return anyItem.publicationTitle.trim();
    }
    return '—';
  }

  if (typeLower === 'conferencepaper') {
    return (
      (typeof anyItem.proceedingsTitle === 'string' && anyItem.proceedingsTitle.trim()) ||
      (typeof anyItem.conferenceName === 'string' && anyItem.conferenceName.trim()) ||
      (typeof ef.proceedingsTitle === 'string' && ef.proceedingsTitle.trim()) ||
      (typeof ef.conferenceName === 'string' && ef.conferenceName.trim()) ||
      (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
      '—'
    );
  }

  if (typeLower === 'booksection') {
    return (
      (typeof anyItem.bookTitle === 'string' && anyItem.bookTitle.trim()) ||
      (typeof ef.bookTitle === 'string' && ef.bookTitle.trim()) ||
      (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
      '—'
    );
  }

  if (typeLower === 'book') {
    return (
      (typeof anyItem.publisher === 'string' && anyItem.publisher.trim()) ||
      (typeof ef.publisher === 'string' && ef.publisher.trim()) ||
      (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
      '—'
    );
  }

  if (typeLower === 'thesis') {
    return (
      (typeof anyItem.university === 'string' && anyItem.university.trim()) ||
      (typeof anyItem.institution === 'string' && anyItem.institution.trim()) ||
      (typeof ef.university === 'string' && ef.university.trim()) ||
      (typeof ef.institution === 'string' && ef.institution.trim()) ||
      (typeof anyItem.publisher === 'string' && anyItem.publisher.trim()) ||
      '—'
    );
  }

  if (typeLower === 'report') {
    return (
      (typeof anyItem.institution === 'string' && anyItem.institution.trim()) ||
      (typeof ef.institution === 'string' && ef.institution.trim()) ||
      (typeof anyItem.publisher === 'string' && anyItem.publisher.trim()) ||
      '—'
    );
  }

  if (typeLower === 'patent') {
    return (
      (typeof anyItem.issuingAuthority === 'string' && anyItem.issuingAuthority.trim()) ||
      (typeof ef.issuingAuthority === 'string' && ef.issuingAuthority.trim()) ||
      (typeof anyItem.assignee === 'string' && anyItem.assignee.trim()) ||
      (typeof ef.assignee === 'string' && ef.assignee.trim()) ||
      '—'
    );
  }

  if (typeLower === 'webpage' || typeLower === 'blogpost') {
    return (
      (typeof anyItem.websiteTitle === 'string' && anyItem.websiteTitle.trim()) ||
      (typeof anyItem.blogTitle === 'string' && anyItem.blogTitle.trim()) ||
      (typeof ef.websiteTitle === 'string' && ef.websiteTitle.trim()) ||
      (typeof ef.blogTitle === 'string' && ef.blogTitle.trim()) ||
      (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
      '—'
    );
  }

  const defaultVenue =
    (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
    (typeof anyItem.journal === 'string' && anyItem.journal.trim()) ||
    (typeof anyItem.publisher === 'string' && anyItem.publisher.trim());

  return defaultVenue || '—';
}

export function formatItemTypeLabel(rawType?: string | null): string {
  if (!rawType) return '—';
  const str = String(rawType).trim();
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ');
  return withSpaces
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatExtraDisplay(paper: Item): string {
  if (typeof paper.extra === 'string' && paper.extra.trim()) {
    const trimmed = paper.extra.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return trimmed.replace(/\r?\n+/g, ', ');
    }
  }

  let fields: Record<string, unknown> | null = null;
  if (paper.extraFields && typeof paper.extraFields === 'object' && !Array.isArray(paper.extraFields)) {
    fields = paper.extraFields;
  } else if (typeof paper.extra === 'string') {
    const trimmed = paper.extra.trim();
    if (trimmed.startsWith('{')) {
      try {
        fields = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        // Ignore
      }
    }
  }

  if (fields && typeof fields === 'object') {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null && v !== undefined && v !== '') {
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        const keyLabel = k
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ');
        parts.push(`${keyLabel}: ${valStr}`);
      }
    }
    if (parts.length > 0) {
      return parts.join(', ');
    }
  }

  return '—';
}

export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null
): string {
  let textContent = '';

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          if (typeof record._rawExtra === 'string') {
            textContent = record._rawExtra.trim();
          } else {
            const customLines: string[] = [];
            for (const [key, value] of Object.entries(parsed)) {
              const normKey = key.toLowerCase().replace(/[-_\s]/g, '');
              if (value === null || value === undefined) continue;
              if (typeof value === 'object') continue;
              const strVal = String(value).trim();
              if (!strVal) continue;
              if (normKey === 'arxiv' || normKey === 'arxivid' || normKey === 'archiveid') {
                const cleanVal = strVal.replace(/^arxiv:\s*/i, '');
                customLines.push(`arXiv: ${cleanVal}`);
              } else {
                customLines.push(`${key}: ${strVal}`);
              }
            }
            textContent = customLines.join('\n');
          }
        }
      } catch {
        textContent = trimmed;
      }
    } else {
      textContent = trimmed;
    }
  }

  const paperTitle = associatedPaperItem?.title?.trim().toLowerCase();
  const paperUrl = associatedPaperItem?.url?.trim();
  const paperFileUrl = associatedPaperItem?.fileUrl?.trim();
  const paperOaUrl = associatedPaperItem?.openAccessPdfUrl?.trim();
  const paperCiteKey = associatedPaperItem?.citationKey?.trim().toLowerCase();
  const paperDoi = cleanDoi(associatedPaperItem?.doi || (associatedPaperItem as any)?.DOI);
  const paperPmid = associatedPaperItem?.pmid?.trim();
  const paperPmcid = associatedPaperItem?.pmcid?.trim();
  const paperIsbn = associatedPaperItem?.isbn?.trim();
  const paperIssn = associatedPaperItem?.issn?.trim();
  const isPreprint = associatedPaperItem?.itemType === 'preprint';
  const paperArchiveId = (associatedPaperItem?.archiveId || (associatedPaperItem as any)?.archiveID || associatedPaperItem?.arxivId)?.trim();

  const lines = textContent ? textContent.split(/\r?\n/) : [];
  const sanitizedLines: string[] = [];
  let hasArxivLine = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const titleMatch = trimmedLine.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      const lineTitle = titleMatch[1].trim().toLowerCase();
      if (!paperTitle || lineTitle === paperTitle) continue;
    }

    const citeKeyMatch = trimmedLine.match(/^(?:citation\s*key|cite\s*key|citekey):\s*(.+)$/i);
    if (citeKeyMatch) {
      const lineKey = citeKeyMatch[1].trim().toLowerCase();
      if (!paperCiteKey || lineKey === paperCiteKey) continue;
    }

    if (/^open\s*access:?/i.test(trimmedLine)) continue;
    if (trimmedLine === paperOaUrl || trimmedLine === paperFileUrl || trimmedLine === paperUrl) continue;

    const urlMatch = trimmedLine.match(/^url:\s*(https?:\/\/.+)$/i);
    if (urlMatch && paperUrl) continue;

    const doiMatch = trimmedLine.match(/^doi:\s*(.+)$/i);
    if (doiMatch && paperDoi) {
      const lineDoi = cleanDoi(doiMatch[1]);
      if (!lineDoi || lineDoi.toLowerCase() === paperDoi.toLowerCase()) continue;
    }

    const pmidMatch = trimmedLine.match(/^(?:pmid|pubmed\s*id):\s*(.+)$/i);
    if (pmidMatch && paperPmid) continue;

    const pmcidMatch = trimmedLine.match(/^(?:pmcid|pmc):\s*(.+)$/i);
    if (pmcidMatch && paperPmcid) continue;

    const isbnMatch = trimmedLine.match(/^isbn:\s*(.+)$/i);
    if (isbnMatch && paperIsbn) continue;

    const issnMatch = trimmedLine.match(/^issn:\s*(.+)$/i);
    if (issnMatch && paperIssn) continue;

    if (/^comments?:\s*/i.test(trimmedLine)) continue;
    if (/^tl;?dr:\s*/i.test(trimmedLine)) continue;
    if (/^(?:number\s*of\s*pages|num\s*pages|page\s*count|total\s*pages):\s*/i.test(trimmedLine)) continue;

    const genericKvMatch = trimmedLine.match(/^([a-zA-Z0-9_\s]+):\s*(.+)$/);
    if (genericKvMatch) {
      const rawKey = genericKvMatch[1].trim();
      const normKey = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
      const dedicatedFormFields = new Set([
        'edition', 'eventplace', 'conferencename', 'proceedingstitle',
        'booktitle', 'websitetitle', 'websitetype', 'blogtitle',
        'university', 'institution', 'repository', 'reportnumber',
        'reporttype', 'thesistype', 'patentnumber', 'issuingauthority',
        'assignee', 'numpages', 'numberofpages', 'pages', 'volume',
        'issue', 'section', 'publisher', 'place', 'series', 'seriestitle',
        'seriesnumber', 'seriestext', 'journalabbr', 'journalabbreviation',
        'publicationtitle', 'date', 'publicationdate', 'accessedat', 'accessdate',
      ]);
      if (dedicatedFormFields.has(normKey)) continue;
    }

    if (/^arxiv:\s*/i.test(trimmedLine)) {
      if (isPreprint && paperArchiveId) continue;

      hasArxivLine = true;
      const normalizedLine = trimmedLine.replace(
        /^arxiv:\s*([^\s\[]+)(?:v\d+)?\s*(\[[^\]]+\])?/i,
        (_, id, cat) => {
          const cleanId = id.replace(/v\d+$/i, '').trim();
          let category = cat ? cat.replace(/[\[\]]/g, '').trim() : '';
          if (!category) {
            category = resolveArxivCategory(cleanId, associatedPaperItem, additionalExtraFields) || '';
          }
          if (category) {
            const canonicalCat = CANONICAL_ARXIV_CATEGORIES[category.toLowerCase()] || category;
            return `arXiv: ${cleanId} [${canonicalCat}]`;
          }
          return `arXiv: ${cleanId}`;
        }
      );
      sanitizedLines.push(normalizedLine);
      continue;
    }

    sanitizedLines.push(trimmedLine);
  }

  if (!hasArxivLine && !isPreprint) {
    const rawArxiv =
      associatedPaperItem?.arxivId ||
      (typeof additionalExtraFields?.arxivId === 'string' ? additionalExtraFields.arxivId : undefined) ||
      (typeof additionalExtraFields?.archiveId === 'string' ? additionalExtraFields.archiveId : undefined) ||
      (associatedPaperItem?.callNumber?.startsWith('arXiv:') ? associatedPaperItem.callNumber.replace(/^arXiv:/i, '').trim() : undefined);

    if (rawArxiv) {
      const cleanArxiv = rawArxiv
        .replace(/^arxiv:\s*/i, '')
        .replace(/\s*\[.*?\]\s*$/, '')
        .replace(/v\d+$/i, '')
        .trim();
      const category = resolveArxivCategory(cleanArxiv, associatedPaperItem, additionalExtraFields);
      const canonicalCat = category ? (CANONICAL_ARXIV_CATEGORIES[category.toLowerCase()] || category) : '';

      const formattedArxivLine = canonicalCat
        ? `arXiv: ${cleanArxiv} [${canonicalCat}]`
        : `arXiv: ${cleanArxiv}`;

      sanitizedLines.unshift(formattedArxivLine);
    }
  }

  const structuredKeyValLines: string[] = [];
  const freeTextNotesLines: string[] = [];

  for (const line of sanitizedLines) {
    if (/^[a-zA-Z_][a-zA-Z0-9_\-]*:\s*.+$/.test(line)) {
      structuredKeyValLines.push(line);
    } else {
      freeTextNotesLines.push(line);
    }
  }

  return [...structuredKeyValLines, ...freeTextNotesLines].join('\n');
}
