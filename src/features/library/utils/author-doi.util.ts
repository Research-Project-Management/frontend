// ── Institution keyword list (mirrored from backend creator-parser.util.ts) ───
export const INSTITUTION_KEYWORDS = [
  'organization','organizations','organisation','organisations','association','associations',
  'institute','institutes','institution','institutions','university','universities',
  'laboratory','laboratories','collab','collaboration','collaborations','group','team',
  'consortium','network','department','departments','agency','agencies','center','centers',
  'centre','centres','foundation','corporation','inc','llc','ltd','hospital','hospitals',
  'openai','google','microsoft','meta','deepmind','anthropic','mit','cern','nasa','who','ieee','acm',
];

export const PREFIX_PARTICLES = new Set(['von','van','de','del','der','da','di','du','la','le']);

/**
 * Splits a composite string of authors separated by ';', ' and ', ' & ', or newlines.
 * Logic is canonical with backend creator-parser.util.ts#splitAuthorString.
 */
export function splitAuthorString(input: string): string[] {
  if (!input || !input.trim()) return [];
  const trimmed = input.trim();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const line of lines) {
    if (line.includes(';')) {
      result.push(...line.split(';').map((s) => s.trim()).filter(Boolean));
    } else if (/\s+and\s+/i.test(line)) {
      result.push(
        ...line.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean),
      );
    } else if (/\s+&\s+/.test(line)) {
      result.push(
        ...line.split(/\s+&\s+/).map((s) => s.trim()).filter(Boolean),
      );
    } else if ((line.match(/,/g) || []).length >= 2) {
      // Multiple commas → treat as a list of names (e.g. "Smith, J., Jones, M.")
      result.push(
        ...line.split(',').map((s) => s.trim()).filter(Boolean),
      );
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Parses a single author name into structured fields.
 * Handles institutions, "LastName, FirstName", "FirstName LastName", particles (von/van/de), mononyms.
 * Canonical with backend creator-parser.util.ts#parseCreatorString.
 */
export function parseCreatorName(rawName: string): { firstName: string; lastName: string; fullName: string } {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '', fullName: '' };

  const lower = trimmed.toLowerCase();
  const isInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );
  if (isInstitution) return { firstName: '', lastName: trimmed, fullName: trimmed };

  // Comma-separated: "LastName, FirstName MiddleName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    const fullName = firstName ? `${firstName} ${lastName}` : lastName;
    return { firstName, lastName, fullName };
  }

  // Space-separated: "FirstName [Middle...] LastName"
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return { firstName: '', lastName: tokens[0], fullName: tokens[0] };

  // Handle prefix particles: "Johann von Neumann"
  let splitIndex = tokens.length - 1;
  if (tokens.length >= 3 && PREFIX_PARTICLES.has(tokens[tokens.length - 2].toLowerCase())) {
    splitIndex = tokens.length - 2;
    if (tokens.length >= 4 && PREFIX_PARTICLES.has(tokens[tokens.length - 3].toLowerCase())) {
      splitIndex = tokens.length - 3;
    }
  }

  const lastName = tokens.slice(splitIndex).join(' ');
  const firstName = tokens.slice(0, splitIndex).join(' ');
  return { firstName, lastName, fullName: trimmed };
}

/**
 * Standardizes raw authors or creators into a clean array of author name strings.
 * Handles string[], delimited strings ("Author A; Author B" / "Author A and Author B"),
 * object arrays ([{ name: '...' }] or [{ firstName: '...', lastName: '...' }]),
 * and fallback to creators ([{ creatorType: 'author', name: '...' }]).
 */
export function normalizeAuthors(
  rawAuthors?: unknown,
  creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
  contributors?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
): string[] {
  // If first argument is an object that looks like a paper (has authors/creators/contributors), extract from it
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    const candidate = rawAuthors as {
      authors?: unknown;
      creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null }> | null;
      contributors?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null }> | null;
    };
    if (candidate.authors !== undefined || candidate.creators !== undefined || candidate.contributors !== undefined) {
      return normalizeAuthors(
        candidate.authors,
        candidate.creators,
        candidate.contributors,
      );
    }
  }

  // 1. Check rawAuthors array
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const result: string[] = [];
    for (const item of rawAuthors) {
      if (!item) continue;
      if (typeof item === 'string') {
        result.push(...splitAuthorString(item));
      } else if (typeof item === 'object') {
        const fullName = (item.fullName || item.name || '').trim();
        if (fullName) {
          result.push(...splitAuthorString(fullName));
        } else if ('firstName' in item || 'lastName' in item || 'family' in item || 'given' in item) {
          const first = (item.firstName || item.given || '').trim();
          const last = (item.lastName || item.family || '').trim();
          const full = [first, last].filter(Boolean).join(' ');
          if (full) result.push(full);
        }
      }
    }
    if (result.length > 0) return result;
  } else if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors);
  }

  // 2. Fallback to creators or contributors array
  const creatorList = (Array.isArray(creators) && creators.length > 0)
    ? creators
    : (Array.isArray(contributors) && contributors.length > 0)
    ? contributors
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).creators))
    ? (rawAuthors as any).creators
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).contributors))
    ? (rawAuthors as any).contributors
    : [];

  if (creatorList.length > 0) {
    const fromCreators: string[] = [];
    const hasExplicitAuthors = creatorList.some(
      (c: any) => c && typeof c === 'object' && c.creatorType === 'author',
    );

    for (const c of creatorList) {
      if (!c) continue;
      if (typeof c === 'string') {
        fromCreators.push(...splitAuthorString(c));
        continue;
      }
      if (hasExplicitAuthors && c.creatorType && c.creatorType !== 'author') {
        continue;
      }
      const fullName = (c.fullName || c.name || '').trim();
      if (fullName) {
        fromCreators.push(...splitAuthorString(fullName));
      } else {
        const first = (c.firstName || c.given || '').trim();
        const last = (c.lastName || c.family || '').trim();
        const full = [first, last].filter(Boolean).join(' ');
        if (full) fromCreators.push(full);
      }
    }
    if (fromCreators.length > 0) return fromCreators;
  }

  return [];
}

const SPECIAL_CASE_WORDS: Record<string, string> = {
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

const COMMON_ACADEMIC_ACRONYMS = new Set([
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

const MINOR_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'as', 'at', 'by', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'per', 'to', 'up', 'via', 'with',
]);

/**
 * Normalizes academic paper title casing:
 * - If title is ALL CAPS or all lowercase, converts to standard academic Title Case.
 * - If title has screaming uppercase non-acronym words (e.g. "SURVEY OF DEEP LEARNING"), normalizes them.
 * - Preserves standard academic acronyms (BERT, GPT, LLM, CNN, RNA, etc.) and mixed-case terms (arXiv, mRNA).
 * - Leaves correctly cased mixed-case titles untouched.
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
 * Cleans PDF small-caps font drop-cap spaces, typographic gaps, and normalizes title casing:
 * - "V ERY D EEP C ONVOLUTIONAL N ETWORKS" -> "Very Deep Convolutional Networks"
 * - "N EURAL M ACHINE T RANSLATION" -> "Neural Machine Translation"
 * - "ATTENTION IS ALL YOU NEED" -> "Attention Is All You Need"
 * - "Auto - Encoding" -> "Auto-Encoding"
 */
export function cleanPaperTitle(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  let s = title.trim();

  // Fix PDF small-caps drop-cap gaps (e.g. "V ERY" -> "VERY", "D EEP" -> "DEEP")
  s = s.replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, '$1$2');

  // Fix spaced hyphens (e.g. "Auto - Encoding" -> "Auto-Encoding")
  s = s.replace(/\b([A-Za-z0-9]+)\s+-\s+([A-Za-z0-9]+)\b/g, '$1-$2');

  // Fix single letter uppercase gaps: "B Y" -> "BY" (preserve standalone "A" or "I")
  s = s.replace(/\b([B-HJ-Z])\s+([A-Z])\b/g, '$1$2');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  // Normalize screaming ALL CAPS or all lowercase titles to clean academic Title Case
  return normalizeAcademicTitleCase(s.trim());
}

/**
 * Formats a list of author names into a standard compact academic display string.
 * - 0 authors: "—"
 * - 1 author: "Author 1"
 * - 2 authors: "Author 1 & Author 2"
 * - 3+ authors: "Author 1 et al."
 */
export function formatCreatorCompact(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '—';
  // Filter out obvious title continuation/preposition artifacts leaked as authors
  const clean = authors.filter(
    (a) => !/^(FOR\s+[A-Z]|BY\s+[A-Z]|Reducing\s+Internal)/i.test(a.trim()),
  );
  if (clean.length === 0) return '—';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean[0]} et al.`;
}

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

  // Strip trailing punctuation often caught in copy-paste
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
