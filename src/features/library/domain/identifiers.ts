/**
 * Pure Domain Model: Identifiers (DOI, arXiv, PMID, ISBN) & Title Normalizer
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

const SPECIAL_CASE_WORDS: Readonly<Record<string, string>> = {
  arxiv: 'arXiv',
  biorxiv: 'bioRxiv',
  medrxiv: 'medRxiv',
  latex: 'LaTeX',
  bibtex: 'BibTeX',
  fmri: 'fMRI',
  mrna: 'mRNA',
  't-sne': 't-SNE',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  openai: 'OpenAI',
  chatgpt: 'ChatGPT',
  ios: 'iOS',
  macos: 'macOS',
  phd: 'PhD',
  ieee: 'IEEE',
  acm: 'ACM',
  nature: 'Nature',
  science: 'Science',
};

const COMMON_ACADEMIC_ACRONYMS: ReadonlySet<string> = new Set([
  'AI', 'ML', 'DL', 'RL', 'NLP', 'CV', 'NLU', 'NLG',
  'LLM', 'LLMS', 'SLM', 'SLMS', 'VLM', 'VLMS',
  'CNN', 'CNNS', 'RNN', 'RNNS', 'GNN', 'GNNS', 'GAN', 'GANS',
  'VAE', 'VAES', 'BERT', 'GPT', 'CLIP', 'LSTM', 'SVM',
  'RAG', 'COT', 'TOT', 'DQN', 'PPO', 'DDPG', 'SAC',
  'DNA', 'RNA', 'CRISPR', 'COVID', 'COVID-19', 'SARS', 'MERS', 'HIV', 'PCR',
  'EEG', 'ECG', 'MRI', 'CT', 'PET',
  'API', 'APIS', 'REST', 'HTTP', 'HTTPS', 'URL', 'URI', 'SQL', 'NOSQL',
  'CPU', 'CPUS', 'GPU', 'GPUS', 'TPU', 'TPUS', 'RAM', 'ROM',
  '2D', '3D', '4D', '5G', '6G',
  'DOI', 'ISBN', 'ISSN', 'CSL', 'PDF', 'OCR', 'XML', 'HTML', 'JSON',
  'USA', 'UK', 'EU', 'UN', 'WHO', 'NIH', 'NSF', 'NASA', 'DARPA',
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
]);

const MINOR_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'as', 'at', 'by', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'per', 'to', 'up', 'via', 'with',
]);

export function trimUnmatchedClosingBrackets(str: string): string {
  let s = str;
  const pairs: Array<[string, string]> = [[')', '('], [']', '['], ['}', '{'], ['>', '<']];
  for (const [closeChar, openChar] of pairs) {
    while (
      s.endsWith(closeChar) &&
      (s.match(new RegExp(`\\${closeChar}`, 'g')) || []).length >
      (s.match(new RegExp(`\\${openChar}`, 'g')) || []).length
    ) {
      s = s.slice(0, -1);
    }
  }
  return s;
}

/**
 * Validates and extracts a canonical clean DOI string (10.NNNN/...)
 */
export function cleanDoi(doi?: string | null): string {
  if (!doi || typeof doi !== 'string') return '';
  let clean = doi.trim();

  // Nature article URL: nature.com/articles/<slug>
  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${natureMatch[1]}`;

  // Zenodo record URL: zenodo.org/records/<id>
  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  // BioRxiv / MedRxiv preprint URL
  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return biorxivMatch[1].replace(/v\d+$/, '');

  // PLOS article URL
  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return decodeURIComponent(plosMatch[1]);

  // Embedded /doi/ or /article/ in publisher URLs
  const embeddedMatch = clean.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*\/(?:doi\/|article\/)(?:abs\/|full\/|epdf\/|pdf\/)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)(?:[?#].*)?$/i,
  );
  if (embeddedMatch && embeddedMatch[1]) {
    clean = embeddedMatch[1];
  }

  // Strip standard resolver prefixes (doi.org, dx.doi.org, http, https)
  clean = clean
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/^doi\//i, '')
    .trim();

  // Strip trailing punctuation
  clean = clean.replace(/[.,;:\s]+$/, '');
  clean = trimUnmatchedClosingBrackets(clean);

  // Canonical DOI format: starts with 10.NNNN/
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)/;
  const match = clean.match(doiRegex);
  if (match) {
    let extracted = match[1].replace(/[.,;:\s]+$/, '');
    extracted = trimUnmatchedClosingBrackets(extracted);
    return extracted;
  }

  return clean.startsWith('10.') ? clean : '';
}

export function isValidDoi(doi?: string | null): boolean {
  const cleaned = cleanDoi(doi);
  return Boolean(cleaned && /^10\.\d{4,9}\/.+/.test(cleaned));
}

/**
 * Extracts canonical arXiv ID from text, DOI or URL (e.g. "1706.03762" or "2305.18290v1")
 */
export function extractArxivId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  const match =
    clean.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);

  return match ? match[1] : null;
}

export function getArxivPdfUrl(arxivId?: string | null): string {
  const id = extractArxivId(arxivId);
  return id ? `https://arxiv.org/pdf/${id}.pdf` : '';
}

/**
 * Normalizes academic title casing while preserving specialized acronyms (BERT, GPT, fMRI).
 */
export function normalizeAcademicTitleCase(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  const trimmed = title.trim();
  if (trimmed.length < 3) return trimmed;

  const isAllUpper =
    trimmed.length > 3 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed);
  const isAllLower =
    trimmed.length > 3 &&
    trimmed === trimmed.toLowerCase() &&
    /[a-z]/.test(trimmed);

  const startsWithLower = /^[a-z]/.test(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);

  const hasShoutingWords = words.some((w) => {
    const clean = w.replace(/^[^\w]+|[^\w]+$/g, '');
    return (
      clean.length >= 4 &&
      clean === clean.toUpperCase() &&
      !COMMON_ACADEMIC_ACRONYMS.has(clean) &&
      /[A-Z]/.test(clean)
    );
  });

  const significantWords = words
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, ''))
    .filter(
      (w) => w.length >= 4 && !COMMON_ACADEMIC_ACRONYMS.has(w.toUpperCase()),
    );
  const isSentenceCase =
    significantWords.length >= 2 &&
    significantWords.filter((w) => w === w.toLowerCase()).length /
      significantWords.length >=
      0.5;

  if (
    !isAllUpper &&
    !isAllLower &&
    !startsWithLower &&
    !hasShoutingWords &&
    !isSentenceCase
  ) {
    return trimmed;
  }

  const formatWord = (
    word: string,
    isFirstOrLast: boolean,
    prevEndsWithColon: boolean,
  ): string => {
    const leadingPunct = word.match(/^[^\w]+/)?.[0] || '';
    const trailingPunct = word.match(/[^\w]+$/)?.[0] || '';
    const core = word.slice(
      leadingPunct.length,
      word.length - (trailingPunct.length || 0),
    );

    if (!core) return word;

    const lower = core.toLowerCase();
    const upper = core.toUpperCase();

    if (SPECIAL_CASE_WORDS[lower]) {
      return `${leadingPunct}${SPECIAL_CASE_WORDS[lower]}${trailingPunct}`;
    }

    if (COMMON_ACADEMIC_ACRONYMS.has(upper)) {
      return `${leadingPunct}${upper}${trailingPunct}`;
    }

    if (core.includes('-')) {
      const parts = core.split('-');
      const formattedParts = parts.map((part, idx) => {
        const pLower = part.toLowerCase();
        const pUpper = part.toUpperCase();
        if (SPECIAL_CASE_WORDS[pLower]) return SPECIAL_CASE_WORDS[pLower];
        if (COMMON_ACADEMIC_ACRONYMS.has(pUpper)) return pUpper;
        if (idx > 0 && MINOR_WORDS.has(pLower)) return pLower;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      });
      return `${leadingPunct}${formattedParts.join('-')}${trailingPunct}`;
    }

    if (MINOR_WORDS.has(lower) && !isFirstOrLast && !prevEndsWithColon) {
      return `${leadingPunct}${lower}${trailingPunct}`;
    }

    return `${leadingPunct}${core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()}${trailingPunct}`;
  };

  const formattedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const isFirstOrLast = i === 0 || i === words.length - 1;
    const prevWord = i > 0 ? words[i - 1] : '';
    const prevEndsWithColon = /[:—\-\?!]$/.test(prevWord);

    if (!isAllUpper && !isAllLower) {
      const clean = w.replace(/^[^\w]+|[^\w]+$/g, '');
      const cleanUpper = clean.toUpperCase();
      if (
        clean.length <= 4 ||
        COMMON_ACADEMIC_ACRONYMS.has(cleanUpper) ||
        SPECIAL_CASE_WORDS[clean.toLowerCase()] ||
        clean !== cleanUpper
      ) {
        formattedWords.push(w);
        continue;
      }
    }

    formattedWords.push(formatWord(w, isFirstOrLast, prevEndsWithColon));
  }

  return formattedWords.join(' ');
}

/**
 * Cleans PDF small-caps drop-cap gaps, typographic spaces, and screaming casing.
 */
export function cleanPaperTitle(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  let s = title.trim();

  // Fix PDF small-caps drop-cap gaps (e.g. "V ERY" -> "VERY", "D EEP" -> "DEEP")
  s = s.replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, '$1$2');

  // Fix spaced hyphens (e.g. "Auto - Encoding" -> "Auto-Encoding")
  s = s.replace(/\b([A-Za-z0-9]+)\s+-\s+([A-Za-z0-9]+)\b/g, '$1-$2');

  // Fix single letter uppercase gaps: "B Y" -> "BY"
  s = s.replace(/\b([B-HJ-Z])\s+([A-Z])\b/g, '$1$2');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  return normalizeAcademicTitleCase(s.trim());
}
