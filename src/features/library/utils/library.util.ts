import type { Paper, Item, Note } from '../types/library.types';
import { getVenueFieldForType } from '../schemas/item-type.schema';
import {
  INSTITUTION_KEYWORDS,
  PREFIX_PARTICLES,
  splitAuthorString,
  parseCreatorName,
  normalizeAuthors,
  formatCreatorCompact,
  cleanPaperTitle,
  normalizeAcademicTitleCase,
  trimUnmatchedClosingBrackets,
  cleanDoi,
} from './author-doi.util';

export {
  INSTITUTION_KEYWORDS,
  PREFIX_PARTICLES,
  splitAuthorString,
  parseCreatorName,
  normalizeAuthors,
  formatCreatorCompact,
  cleanPaperTitle,
  normalizeAcademicTitleCase,
  trimUnmatchedClosingBrackets,
  cleanDoi,
};

// ── 1. ID & Key Resolution ───────────────────────────────────────────────────

export function isProjectScope(scopeId?: string): scopeId is string {
  if (!scopeId) return false;
  const s = scopeId.trim().toLowerCase();
  return s !== 'user' && s !== 'me' && s !== 'personal' && s !== 'global' && s !== 'default';
}


/**
 * Extracts the primary PDF or reading file URL from a Paper object.
 * Strictly resolves canonical binary content URLs (/api/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getPaperFileUrl(
  paper?: Partial<Paper> | Partial<Item> | Record<string, any> | null | undefined,
  scopeId?: string,
): string {
  if (!paper) return '';

  const effectiveScope = scopeId || (paper as any)?.projectId || (paper as any)?.userId;
  void effectiveScope;

  const normalizeUrl = (url?: string | null, fileId?: string | null): string => {
    if (fileId) {
      return `/api/v1/library/files/${encodeURIComponent(fileId)}/content`;
    }
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('/api/files/') &&
      !trimmed.includes('/r2/') &&
      !trimmed.endsWith('/content')
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  // 1. Primary file / attachment (priority order: primary_pdf -> application/pdf -> .pdf filename)
  const attachments = Array.isArray(paper.attachments)
    ? paper.attachments
    : [];

  const primaryPdfAttachment =
    attachments.find(
      (a) =>
        a?.attachmentType === 'primary_pdf',
    ) ||
    attachments.find(
      (a) => a?.mimeType === 'application/pdf',
    ) ||
    attachments.find(
      (a) =>
        Boolean(a?.fileId) &&
        typeof a?.filename === 'string' &&
        a.filename.toLowerCase().endsWith('.pdf'),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  // 2. Direct fileId on paper
  if (paper.fileId) {
    return `/api/v1/library/files/${encodeURIComponent(paper.fileId)}/content`;
  }

  // 3. PrimaryFile object
  if (paper.primaryFile) {
    const url = normalizeUrl(
      paper.primaryFile.url,
      paper.primaryFile.fileId,
    );
    if (url) return url;
  }

  // 4. Direct fileUrl on paper
  if (paper.fileUrl) {
    const url = normalizeUrl(paper.fileUrl, paper.fileId);
    if (url) return url;
  }

  // 4b. Direct openAccessPdfUrl on paper
  if (paper.openAccessPdfUrl) {
    const oaUrl = normalizeUrl(paper.openAccessPdfUrl);
    if (oaUrl) return oaUrl;
  }

  // 5. arXiv fallback: If paper has arxivId, arXiv DOI, arXiv URL, or arXiv filename
  const arxivMatch =
    paper.arxivId ||
    paper.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    return `https://arxiv.org/pdf/${arxivMatch.replace(/\.pdf$/i, '')}.pdf`;
  }

  return '';
}

// ── Academic Tag Normalizer Constants ───────────────────────────────────────
export const ARXIV_CATEGORY_MAP: Record<string, string> = {
  // Computer Science
  'cs.ai': 'Computer Science - Artificial Intelligence',
  'cs.ar': 'Computer Science - Hardware Architecture',
  'cs.cc': 'Computer Science - Computational Complexity',
  'cs.ce': 'Computer Science - Computational Engineering',
  'cs.cg': 'Computer Science - Computational Geometry',
  'cs.cl': 'Computer Science - Computation and Language',
  'cs.cr': 'Computer Science - Cryptography and Security',
  'cs.cv': 'Computer Science - Computer Vision and Pattern Recognition',
  'cs.cy': 'Computer Science - Computers and Society',
  'cs.db': 'Computer Science - Databases',
  'cs.dc': 'Computer Science - Distributed and Cluster Computing',
  'cs.dl': 'Computer Science - Digital Libraries',
  'cs.dm': 'Computer Science - Discrete Mathematics',
  'cs.ds': 'Computer Science - Data Structures and Algorithms',
  'cs.et': 'Computer Science - Emerging Technologies',
  'cs.fl': 'Computer Science - Formal Languages and Automata',
  'cs.gl': 'Computer Science - General Literature',
  'cs.gr': 'Computer Science - Graphics',
  'cs.gt': 'Computer Science - Computer Science and Game Theory',
  'cs.hc': 'Computer Science - Human-Computer Interaction',
  'cs.ir': 'Computer Science - Information Retrieval',
  'cs.it': 'Computer Science - Information Theory',
  'cs.lg': 'Computer Science - Machine Learning',
  'cs.lo': 'Computer Science - Logic in Computer Science',
  'cs.ma': 'Computer Science - Multiagent Systems',
  'cs.mm': 'Computer Science - Multimedia',
  'cs.ms': 'Computer Science - Mathematical Software',
  'cs.na': 'Computer Science - Numerical Analysis',
  'cs.ne': 'Computer Science - Neural and Evolutionary Computing',
  'cs.ni': 'Computer Science - Networking and Internet Architecture',
  'cs.oh': 'Computer Science - Other Computer Science',
  'cs.os': 'Computer Science - Operating Systems',
  'cs.pf': 'Computer Science - Performance',
  'cs.pl': 'Computer Science - Programming Languages',
  'cs.ro': 'Computer Science - Robotics',
  'cs.sc': 'Computer Science - Symbolic Computation',
  'cs.sd': 'Computer Science - Sound',
  'cs.se': 'Computer Science - Software Engineering',
  'cs.si': 'Computer Science - Social and Information Networks',
  'cs.sy': 'Computer Science - Systems and Control',

  // Statistics
  'stat.ml': 'Statistics - Machine Learning',
  'stat.ap': 'Statistics - Applied Statistics',
  'stat.co': 'Statistics - Computation',
  'stat.me': 'Statistics - Methodology',
  'stat.th': 'Statistics - Statistics Theory',

  // Mathematics
  'math.oc': 'Mathematics - Optimization and Control',
  'math.pr': 'Mathematics - Probability',
  'math.st': 'Mathematics - Statistical Theory',
  'math.na': 'Mathematics - Numerical Analysis',
  'math.ag': 'Mathematics - Algebraic Geometry',
  'math.at': 'Mathematics - Algebraic Topology',
  'math.ap': 'Mathematics - Analysis of PDEs',
  'math.ca': 'Mathematics - Classical Analysis and ODEs',
  'math.co': 'Mathematics - Combinatorics',
  'math.ds': 'Mathematics - Dynamical Systems',
  'math.fa': 'Mathematics - Functional Analysis',
  'math.gm': 'Mathematics - General Mathematics',
  'math.gn': 'Mathematics - General Topology',
  'math.gr': 'Mathematics - Group Theory',
  'math.gt': 'Mathematics - Geometric Topology',
  'math.lo': 'Mathematics - Logic',
  'math.mg': 'Mathematics - Metric Geometry',
  'math.mp': 'Mathematics - Mathematical Physics',
  'math.nt': 'Mathematics - Number Theory',
  'math.oa': 'Mathematics - Operator Algebras',
  'math.qa': 'Mathematics - Quantum Algebra',
  'math.ra': 'Mathematics - Rings and Algebras',
  'math.rt': 'Mathematics - Representation Theory',
  'math.sg': 'Mathematics - Symplectic Geometry',
  'math.sp': 'Mathematics - Spectral Theory',

  // Quantitative Biology
  'q-bio.bm': 'Quantitative Biology - Biomolecules',
  'q-bio.cb': 'Quantitative Biology - Cell Behavior',
  'q-bio.gn': 'Quantitative Biology - Genomics',
  'q-bio.mn': 'Quantitative Biology - Molecular Networks',
  'q-bio.nc': 'Quantitative Biology - Neurons and Cognition',
  'q-bio.ot': 'Quantitative Biology - Other Quantitative Biology',
  'q-bio.pe': 'Quantitative Biology - Populations and Evolution',
  'q-bio.qm': 'Quantitative Biology - Quantitative Methods',
  'q-bio.sc': 'Quantitative Biology - Subcellular Processes',
  'q-bio.to': 'Quantitative Biology - Tissues and Organs',

  // Quantitative Finance
  'q-fin.cp': 'Quantitative Finance - Computational Finance',
  'q-fin.ec': 'Quantitative Finance - Economics',
  'q-fin.gn': 'Quantitative Finance - General Finance',
  'q-fin.mf': 'Quantitative Finance - Mathematical Finance',
  'q-fin.pm': 'Quantitative Finance - Portfolio Management',
  'q-fin.pr': 'Quantitative Finance - Pricing of Securities',
  'q-fin.rm': 'Quantitative Finance - Risk Management',
  'q-fin.st': 'Quantitative Finance - Statistical Finance',
  'q-fin.tr': 'Quantitative Finance - Trading and Market Microstructure',

  // Electrical Engineering and Systems Science
  'eess.as': 'Electrical Engineering and Systems Science - Audio and Speech Processing',
  'eess.iv': 'Electrical Engineering and Systems Science - Image and Video Processing',
  'eess.sp': 'Electrical Engineering and Systems Science - Signal Processing',
  'eess.sy': 'Electrical Engineering and Systems Science - Systems and Control',

  // Nonlinear Sciences
  'nlin.ao': 'Nonlinear Sciences - Adaptation and Self-Organizing Systems',
  'nlin.cd': 'Nonlinear Sciences - Chaotic Dynamics',
  'nlin.cg': 'Nonlinear Sciences - Cellular Automata and Lattice Gases',
  'nlin.ps': 'Nonlinear Sciences - Pattern Formation and Solitons',
  'nlin.si': 'Nonlinear Sciences - Exactly Solvable and Solitable Nonlinear Systems',

  // Physics & Others
  'physics.comp-ph': 'Physics - Computational Physics',
  'physics.data-an': 'Physics - Data Analysis and Statistics',
  'physics.soc-ph': 'Physics - Physics and Society',
  'quant-ph': 'Quantum Physics',
  'gr-qc': 'General Relativity and Quantum Cosmology',
  'hep-th': 'High Energy Physics - Theory',
  'hep-ph': 'High Energy Physics - Phenomenology',
  'hep-lat': 'High Energy Physics - Lattice',
  'hep-ex': 'High Energy Physics - Experiment',
  'cond-mat.mes-hall': 'Condensed Matter - Mesoscale and Nanoscale Physics',
  'cond-mat.mtrl-sci': 'Condensed Matter - Materials Science',
  'cond-mat.str-el': 'Condensed Matter - Strongly Correlated Electrons',
  'cond-mat.supr-con': 'Condensed Matter - Superconductivity',
  'astro-ph.co': 'Astrophysics - Cosmology and Nongalactic Astrophysics',
  'astro-ph.ep': 'Astrophysics - Earth and Planetary Astrophysics',
  'astro-ph.ga': 'Astrophysics - Astrophysics of Galaxies',
  'astro-ph.he': 'Astrophysics - High Energy Astrophysical Phenomena',
  'astro-ph.im': 'Astrophysics - Instrumentation and Methods for Astrophysics',
  'astro-ph.sr': 'Astrophysics - Solar and Stellar Astrophysics',
  'econ.em': 'Economics - Econometrics',
  'econ.gn': 'Economics - General Economics',
  'econ.th': 'Economics - Theoretical Economics',
};

// ── Canonical Casing for arXiv Category Codes ──────────────────────────────
export const CANONICAL_ARXIV_CATEGORIES: Record<string, string> = {
  // Computer Science
  'cs.ai': 'cs.AI',
  'cs.ar': 'cs.AR',
  'cs.cc': 'cs.CC',
  'cs.ce': 'cs.CE',
  'cs.cg': 'cs.CG',
  'cs.cl': 'cs.CL',
  'cs.cr': 'cs.CR',
  'cs.cv': 'cs.CV',
  'cs.cy': 'cs.CY',
  'cs.db': 'cs.DB',
  'cs.dc': 'cs.DC',
  'cs.dl': 'cs.DL',
  'cs.dm': 'cs.DM',
  'cs.ds': 'cs.DS',
  'cs.et': 'cs.ET',
  'cs.fl': 'cs.FL',
  'cs.gl': 'cs.GL',
  'cs.gr': 'cs.GR',
  'cs.gt': 'cs.GT',
  'cs.hc': 'cs.HC',
  'cs.ir': 'cs.IR',
  'cs.it': 'cs.IT',
  'cs.lg': 'cs.LG',
  'cs.lo': 'cs.LO',
  'cs.ma': 'cs.MA',
  'cs.mm': 'cs.MM',
  'cs.ms': 'cs.MS',
  'cs.na': 'cs.NA',
  'cs.ne': 'cs.NE',
  'cs.ni': 'cs.NI',
  'cs.oh': 'cs.OH',
  'cs.os': 'cs.OS',
  'cs.pf': 'cs.PF',
  'cs.pl': 'cs.PL',
  'cs.ro': 'cs.RO',
  'cs.sc': 'cs.SC',
  'cs.sd': 'cs.SD',
  'cs.se': 'cs.SE',
  'cs.si': 'cs.SI',
  'cs.sy': 'cs.SY',

  // Statistics
  'stat.ml': 'stat.ML',
  'stat.ap': 'stat.AP',
  'stat.co': 'stat.CO',
  'stat.me': 'stat.ME',
  'stat.th': 'stat.TH',

  // Mathematics
  'math.oc': 'math.OC',
  'math.pr': 'math.PR',
  'math.st': 'math.ST',
  'math.na': 'math.NA',
  'math.ag': 'math.AG',
  'math.at': 'math.AT',
  'math.ap': 'math.AP',
  'math.ca': 'math.CA',
  'math.co': 'math.CO',
  'math.ds': 'math.DS',
  'math.fa': 'math.FA',
  'math.gm': 'math.GM',
  'math.gn': 'math.GN',
  'math.gr': 'math.GR',
  'math.gt': 'math.GT',
  'math.lo': 'math.LO',
  'math.mg': 'math.MG',
  'math.mp': 'math.MP',
  'math.nt': 'math.NT',
  'math.oa': 'math.OA',
  'math.qa': 'math.QA',
  'math.ra': 'math.RA',
  'math.rt': 'math.RT',
  'math.sg': 'math.SG',
  'math.sp': 'math.SP',

  // Quantitative Biology
  'q-bio.bm': 'q-bio.BM',
  'q-bio.cb': 'q-bio.CB',
  'q-bio.gn': 'q-bio.GN',
  'q-bio.mn': 'q-bio.MN',
  'q-bio.nc': 'q-bio.NC',
  'q-bio.ot': 'q-bio.OT',
  'q-bio.pe': 'q-bio.PE',
  'q-bio.qm': 'q-bio.QM',
  'q-bio.sc': 'q-bio.SC',
  'q-bio.to': 'q-bio.TO',

  // Quantitative Finance
  'q-fin.cp': 'q-fin.CP',
  'q-fin.ec': 'q-fin.EC',
  'q-fin.gn': 'q-fin.GN',
  'q-fin.mf': 'q-fin.MF',
  'q-fin.pm': 'q-fin.PM',
  'q-fin.pr': 'q-fin.PR',
  'q-fin.rm': 'q-fin.RM',
  'q-fin.st': 'q-fin.ST',
  'q-fin.tr': 'q-fin.TR',

  // Physics & Others
  'physics.comp-ph': 'physics.comp-ph',
  'physics.data-an': 'physics.data-an',
  'physics.soc-ph': 'physics.soc-ph',
  'quant-ph': 'quant-ph',
  'gr-qc': 'gr-qc',
  'hep-th': 'hep-th',
  'hep-ph': 'hep-ph',
  'hep-lat': 'hep-lat',
  'hep-ex': 'hep-ex',
  'cond-mat.mes-hall': 'cond-mat.mes-hall',
  'cond-mat.mtrl-sci': 'cond-mat.mtrl-sci',
  'cond-mat.str-el': 'cond-mat.str-el',
  'cond-mat.supr-con': 'cond-mat.supr-con',
  'astro-ph.co': 'astro-ph.CO',
  'astro-ph.ep': 'astro-ph.EP',
  'astro-ph.ga': 'astro-ph.GA',
  'astro-ph.he': 'astro-ph.HE',
  'astro-ph.im': 'astro-ph.IM',
  'astro-ph.sr': 'astro-ph.SR',

  // Electrical Engineering and Systems Science
  'eess.as': 'eess.AS',
  'eess.iv': 'eess.IV',
  'eess.sp': 'eess.SP',
  'eess.sy': 'eess.SY',

  // Nonlinear Sciences
  'nlin.ao': 'nlin.AO',
  'nlin.cd': 'nlin.CD',
  'nlin.cg': 'nlin.CG',
  'nlin.ps': 'nlin.PS',
  'nlin.si': 'nlin.SI',

  'econ.em': 'econ.EM',
  'econ.gn': 'econ.GN',
  'econ.th': 'econ.TH',
};

// ── Landmark Classic arXiv Benchmark Papers ──────────────────────────────
export const KNOWN_CANONICAL_ARXIV_CATEGORIES: Record<string, string> = {
  '1312.6114': 'cs.LG', // Playing Atari with Deep Reinforcement Learning (DQN)
  '1406.2661': 'stat.ML', // Generative Adversarial Networks (GANs)
  '1512.03385': 'cs.CV', // Deep Residual Learning for Image Recognition (ResNet)
  '1706.03762': 'cs.CL', // Attention Is All You Need (Transformer)
  '1810.04805': 'cs.CL', // BERT
  '2005.14165': 'cs.CL', // GPT-3
  '2010.11929': 'cs.CV', // Vision Transformer (ViT)
  '1506.01497': 'cs.CV', // Faster R-CNN
  '1409.1556': 'cs.CV', // VGG
  '1409.4842': 'cs.CV', // GoogLeNet
  '1611.07004': 'cs.CV', // Pix2Pix
  '1703.10593': 'cs.CV', // CycleGAN
  '1905.11946': 'cs.CV', // EfficientNet
  '2103.00020': 'cs.CV', // CLIP
  '2112.10752': 'cs.CV', // Latent Diffusion
  '2205.11487': 'cs.CL', // Zero-shot COT
  '2210.03629': 'cs.CL', // ReAct
  '2303.08774': 'cs.CL', // GPT-4
  '2302.13971': 'cs.CL', // LLaMA
  '2307.09288': 'cs.CL', // LLaMA 2
};

/**
 * Resolves the canonical arXiv primary category code (e.g. "cs.LG", "stat.ML", "math.PR")
 * for native Zotero Extra field formatting: arXiv: <id> [<primaryCategory>]
 */
export function resolveArxivCategory(
  arxivId?: string | null,
  associatedPaperItem?: any,
  additionalExtraFields?: Record<string, any> | null,
): string | undefined {
  // 1. Explicit primaryCategory / category in additionalExtraFields
  if (typeof additionalExtraFields?.primaryCategory === 'string' && additionalExtraFields.primaryCategory.trim()) {
    const raw = additionalExtraFields.primaryCategory.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }
  if (typeof additionalExtraFields?.category === 'string' && additionalExtraFields.category.trim()) {
    const raw = additionalExtraFields.category.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }

  // 2. Explicit primaryCategory / category in associatedPaperItem or extraFields
  if (typeof associatedPaperItem?.primaryCategory === 'string' && associatedPaperItem.primaryCategory.trim()) {
    const raw = associatedPaperItem.primaryCategory.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }
  if (typeof associatedPaperItem?.extraFields?.primaryCategory === 'string' && associatedPaperItem.extraFields.primaryCategory.trim()) {
    const raw = associatedPaperItem.extraFields.primaryCategory.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }
  if (typeof associatedPaperItem?.extraFields?.category === 'string' && associatedPaperItem.extraFields.category.trim()) {
    const raw = associatedPaperItem.extraFields.category.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }

  // 3. Search tags and keywords
  const candidates: string[] = [];
  if (Array.isArray(associatedPaperItem?.keywords)) {
    for (const k of associatedPaperItem.keywords) {
      if (k) candidates.push(typeof k === 'object' && k.name ? String(k.name) : String(k));
    }
  }
  if (Array.isArray(associatedPaperItem?.tags)) {
    for (const t of associatedPaperItem.tags) {
      if (t) candidates.push(typeof t === 'object' && t.name ? String(t.name) : String(t));
    }
  }

  // 3a. Direct code match (e.g. "cs.LG", "stat.ML", "math.PR")
  for (const c of candidates) {
    const lower = c.trim().toLowerCase();
    if (CANONICAL_ARXIV_CATEGORIES[lower]) {
      return CANONICAL_ARXIV_CATEGORIES[lower];
    }
    if (
      /^[a-z\-]+(?:\.[a-z\-]+)?$/i.test(c.trim()) &&
      !['pdf', 'oa', 'openaccess', 'arxiv', 'preprint', 'paper', 'article'].includes(lower)
    ) {
      return CANONICAL_ARXIV_CATEGORIES[lower] || c.trim();
    }
  }

  // 3b. Reverse lookup in ARXIV_CATEGORY_MAP
  for (const c of candidates) {
    const lower = c.trim().toLowerCase();
    for (const [code, desc] of Object.entries(ARXIV_CATEGORY_MAP)) {
      if (desc.toLowerCase() === lower) {
        return CANONICAL_ARXIV_CATEGORIES[code] || code;
      }
    }
  }

  // 3c. Keyword heuristics from tags/keywords
  for (const c of candidates) {
    const lower = c.trim().toLowerCase();
    if (/machine\s*learning|reinforcement\s*learning/i.test(lower)) return 'cs.LG';
    if (/computer\s*vision/i.test(lower)) return 'cs.CV';
    if (/natural\s*language|computation\s*and\s*language/i.test(lower)) return 'cs.CL';
    if (/artificial\s*intelligence/i.test(lower)) return 'cs.AI';
    if (/robotics/i.test(lower)) return 'cs.RO';
    if (/neural\s*and\s*evolutionary/i.test(lower)) return 'cs.NE';
  }

  // 4. Known landmark classic arXiv papers (e.g. 1312.6114 -> cs.LG)
  if (arxivId) {
    const cleanId = String(arxivId)
      .replace(/^arxiv:\s*/i, '')
      .replace(/\s*\[.*?\]\s*$/, '')
      .replace(/v\d+$/i, '')
      .trim();
    if (KNOWN_CANONICAL_ARXIV_CATEGORIES[cleanId]) {
      return KNOWN_CANONICAL_ARXIV_CATEGORIES[cleanId];
    }
  }

  // 5. Title / abstract fallback for arXiv preprints
  const title = String(associatedPaperItem?.title || '').toLowerCase();
  const abs = String(associatedPaperItem?.abstract || '').toLowerCase();
  if (arxivId || associatedPaperItem?.repository === 'arXiv') {
    if (/reinforcement\s*learning|deep\s*q-network|atari/i.test(title) || /deep\s*q-network|atari/i.test(abs)) {
      return 'cs.LG';
    }
    if (/machine\s*learning/i.test(title)) return 'cs.LG';
    if (/generative\s*adversarial\s*network/i.test(title)) return 'stat.ML';
    if (/computer\s*vision|object\s*detection|segmentation/i.test(title)) return 'cs.CV';
    if (/language\s*model|transformer|bert|gpt/i.test(title)) return 'cs.CL';
  }

  return undefined;
}

const SCIENTIFIC_ACRONYMS = new Set([
  'AI', 'ML', 'NLP', 'CV', 'CNN', 'RNN', 'LSTM', 'GAN', 'BERT', 'LLM', 'COCO',
  'YOLO', 'RESNET', 'VGG', 'SVM', 'RL', 'API', 'GPU', 'CPU', 'TPU', 'DNA', 'RNA', 'SGD', 'ADAM',
]);

export const NOISE_TAG_WORDS = new Set([
  // Placeholders / Empty / Null indicators
  'undefined',
  'null',
  'n/a',
  'na',
  'none',
  'unknown',
  'nil',
  'empty',
  'void',
  'sample',
  'test',
  'draft',
  'untitled',
  'etc',
  'etc.',
  'various',
  'others',
  'and others',
  'et al',
  'et al.',
  'et-al',

  // Document sections & structural headers
  'introduction',
  'conclusion',
  'conclusions',
  'background',
  'paper',
  'article',
  'study',
  'approach',
  'method',
  'methods',
  'methodology',
  'result',
  'results',
  'discussion',
  'overview',
  'experiment',
  'experiments',
  'experimental',
  'analysis',
  'abstract',
  'summary',
  'contents',
  'table of contents',
  'references',
  'bibliography',
  'appendix',
  'acknowledgments',
  'acknowledgements',

  // Metadata field headers & taxonomy labels
  'keywords',
  'keyword',
  'index terms',
  'key words',
  'subject',
  'subjects',
  'topics',
  'topic',
  'category',
  'categories',

  // Publisher, copyright, repository noise
  'all rights reserved',
  'copyright',
  'open access',
  'creative commons',
  'springer',
  'elsevier',
  'ieee',
  'acm',
  'wiley',
  'nature',
  'science',
  'proceedings',
  'conference',
  'journal',
  'volume',
  'issue',
  'page',
  'pages',
  'pp',
  'no',
  'vol',
  'pdf',
  'full text',
  'available online',
  'downloaded',
  'preprint',
  'manuscript',
  'author',
  'authors',
  'editor',
  'editors',
]);

export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw
    .replace(/â€“|â€”/g, '-')
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€ /g, '"')
    .replace(/\uFFFD/g, '')
    .trim();

  // 0. Strip XML/HTML tags and braces
  str = str.replace(/<[^>]+>/g, '').replace(/[{}]/g, '').trim();

  // 1. Strip Wikipedia disambiguation FIRST before edge quotes/brackets
  str = str.replace(/(?<=[\w\d])\s+\([^)]*\)$/g, '').trim();

  // 2. Strip prefixes (tag:, tags:, category:, arxiv:), quotes, brackets, dots, ellipses
  str = str
    .replace(
      /^(?:tags?|keywords?|index terms?|categor(?:y|ies)|subject(?: areas?)?|topics?|terms?|arxiv)[:—\-\s]+/i,
      '',
    )
    .replace(/^[#"''`([{<•·*—\-\s]+/, '')
    .replace(/^(?:\.{2,}|…)+/, '')
    .replace(/["''`)\]}>]+$/, '')
    .replace(/(?:\.{2,}|…|[.,;:—\-\s•·*])+$/, '')
    .trim();

  if (!str) return null;

  // 3. Direct arXiv category mapping (supports cs.cl, cs.CL, cs-cl, cs_cl, [cs.CL])
  const lower = str.toLowerCase();
  if (ARXIV_CATEGORY_MAP[lower]) return ARXIV_CATEGORY_MAP[lower];
  const withDot = lower.replace(/[-_]/g, '.');
  if (ARXIV_CATEGORY_MAP[withDot]) return ARXIV_CATEGORY_MAP[withDot];

  // 4. Noise blacklist check
  if (NOISE_TAG_WORDS.has(lower)) return null;

  // 5. Sanity & garbage checks:
  if (str.length < 2 || str.length > 60) return null;

  // Must contain at least one alphanumeric character
  if (!/[a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/.test(str)) return null;

  // Cannot be pure numbers
  if (/^\d+$/.test(str)) return null;

  // Cannot be page numbers or volume indicators (e.g. "pp. 12-15", "vol. 4", "no. 2")
  if (/^(?:p|pp|vol|no|v|issue)\.?\s*\d+(?:[-–—]\d+)?$/i.test(str)) return null;

  // Cannot be a pure year or number range (e.g. "2020-2021", "10-25")
  if (/^\d{1,4}[-–—]\d{1,4}$/.test(str)) return null;

  // Cannot be a URL, email, or DOI
  if (
    /^https?:\/\//i.test(str) ||
    /^www\./i.test(str) ||
    /@/.test(str) ||
    /^10\.\d{4,9}\//i.test(str)
  ) {
    return null;
  }

  // Cannot be an ellipsis or dots sequence
  if (/^(\.{2,}|…)+$/.test(str)) return null;

  // 6. Generic noise check after prefix removal
  if (NOISE_TAG_WORDS.has(str.toLowerCase())) return null;

  // 7. Format with proper Title Case & Acronyms
  const formatted = str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (SCIENTIFIC_ACRONYMS.has(upper)) return upper;
      // Preserve isolated dash in compounds or category separator " - "
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
      if (
        ['and', 'or', 'of', 'in', 'on', 'for', 'with', 'at', 'by'].includes(
          lowerWord,
        )
      ) {
        return lowerWord;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');

  // Ensure the very first letter is capitalized even if a minor word
  let result = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  result = result.replace(/(?:\.{2,}|…|[.,;:—\-\s])+$/, '').trim();
  return result.length >= 2 ? result : null;
}

/**
 * Normalizes all tag-like fields on a paper into a deduped, trimmed, clean
 * academic string array.
 * Cleans mojibake, strips Wikipedia disambiguation suffixes, maps arXiv taxonomy codes,
 * and formats with Title Case and preserved acronyms.
 */
export function normalizeTags(
  paper: Partial<Item> | null | undefined,
  maxTags?: number,
): string[] {
  if (!paper) return [];
  const raw: unknown[] = [
    ...(Array.isArray(paper.tags) ? paper.tags : []),
    ...(Array.isArray(paper.labels) ? paper.labels : []),
    ...(Array.isArray(paper.keywords) ? paper.keywords : []),
    ...(Array.isArray(paper.itemTags)
      ? paper.itemTags.map((it) => it?.tag?.name ?? '')
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

// ── 2. Notes Normalization ───────────────────────────────────────────────────

export interface NormalizedNote {
  id: string;
  content: string;
  contentMd?: string;
  contentJson?: unknown;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Normalizes raw notes array into strongly-typed NormalizedNote objects.
 * Aligned 100% with Zotero child note format (note: string HTML) and Flux Markdown notes.
 */
export function normalizeNotes(notes?: Array<string | Note | { id?: string; content?: string; note?: string }> | null): NormalizedNote[] {
  if (!Array.isArray(notes)) return [];

  return notes.map((note, index) => {
    if (typeof note === 'string') {
      // String-only notes have no server-assigned ID; use a deterministic
      // content-based hash to avoid collisions across re-renders.
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
    // Strip HTML tags for clean card preview if note originated from Zotero HTML (<p>...</p>)
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

// ── 3. Citation Key & Identifier Resolution ──────────────────────────────────
export { generateCitationKey, getPaperCitationKey } from './bibtex.util';

export const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)\b/i;

export function extractArxivId(text: string): string | null {
  if (!text) return null;
  const match = text.match(ARXIV_REGEX);
  return match ? match[1] : null;
}

// ── 4. Extra Metadata Sanitization & Zotero Formatting ────────────────────────


/**
 * Sanitizes and formats Extra metadata for display.
 * In Zotero, the Extra field contains pure text / custom variables without
 * artificial headings or redundant labels prepended.
 *
 * For arXiv preprints, native Zotero formats the Extra field as:
 *   arXiv: <id> [<primary_category>]
 * (e.g. "arXiv: 1406.2661 [stat.ML]" or "arXiv: 1512.03385 [cs.CV]").
 *
 * This function preserves genuine user content, strips out redundant duplicate fields
 * (such as Title which is already displayed in the main Title field, Cite Key, Pages, Open Access URLs),
 * and eliminates internal telemetry while guaranteeing official Zotero arXiv syntax.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  let textContent = '';

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();

    // If rawExtraMetadata is a JSON object string (e.g. from backend serialization)
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
        // Not valid JSON, process as plain text directly
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

    // 1. Filter out redundant title lines (Title is already shown at the top of the form)
    const titleMatch = trimmedLine.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      const lineTitle = titleMatch[1].trim().toLowerCase();
      if (!paperTitle || lineTitle === paperTitle) {
        continue;
      }
    }

    // 2. Filter out duplicate citation key lines (Citation Key has its own dedicated field)
    const citeKeyMatch = trimmedLine.match(/^(?:citation\s*key|cite\s*key|citekey):\s*(.+)$/i);
    if (citeKeyMatch) {
      const lineKey = citeKeyMatch[1].trim().toLowerCase();
      if (!paperCiteKey || lineKey === paperCiteKey) {
        continue;
      }
    }

    // 3. Filter out Open Access notices / PDF download URLs (managed under Attachments)
    if (/^open\s*access:?/i.test(trimmedLine)) {
      continue;
    }
    if (
      trimmedLine === paperOaUrl ||
      trimmedLine === paperFileUrl ||
      trimmedLine === paperUrl
    ) {
      continue;
    }

    // 4. Filter out duplicate URL if paper already has dedicated URL field populated
    const urlMatch = trimmedLine.match(/^url:\s*(https?:\/\/.+)$/i);
    if (urlMatch && paperUrl) {
      continue;
    }

    // 5. Filter out duplicate DOI if paper already has dedicated DOI field populated
    const doiMatch = trimmedLine.match(/^doi:\s*(.+)$/i);
    if (doiMatch && paperDoi) {
      const lineDoi = cleanDoi(doiMatch[1]);
      if (!lineDoi || lineDoi.toLowerCase() === paperDoi.toLowerCase()) {
        continue;
      }
    }

    // 6. Filter out duplicate PMID / PMCID if paper already has dedicated field
    const pmidMatch = trimmedLine.match(/^(?:pmid|pubmed\s*id):\s*(.+)$/i);
    if (pmidMatch && paperPmid) {
      continue;
    }
    const pmcidMatch = trimmedLine.match(/^(?:pmcid|pmc):\s*(.+)$/i);
    if (pmcidMatch && paperPmcid) {
      continue;
    }

    // 7. Filter out duplicate ISBN / ISSN if paper already has dedicated field
    const isbnMatch = trimmedLine.match(/^isbn:\s*(.+)$/i);
    if (isbnMatch && paperIsbn) {
      continue;
    }
    const issnMatch = trimmedLine.match(/^issn:\s*(.+)$/i);
    if (issnMatch && paperIssn) {
      continue;
    }

    // 8. Filter out Comments (managed in Notes tab)
    if (/^comments?:\s*/i.test(trimmedLine)) {
      continue;
    }

    // 9. Filter out TLDR (Semantic Scholar AI summary removed)
    if (/^tl;?dr:\s*/i.test(trimmedLine)) {
      continue;
    }

    // 10. Filter out page count lines (Pages / # of Pages is a native schema field in Zotero)
    if (/^(?:number\s*of\s*pages|num\s*pages|page\s*count|total\s*pages):\s*/i.test(trimmedLine)) {
      continue;
    }

    // 11. Filter out schema fields that have dedicated input rows in the Inspector form
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
      if (dedicatedFormFields.has(normKey)) {
        continue;
      }
    }

    // Check for native Zotero arXiv syntax (e.g. arXiv: 1406.2661 [stat.ML])
    if (/^arxiv:\s*/i.test(trimmedLine)) {
      // In Zotero, preprints store the identifier natively in Archive ID (#5).
      // If this item is a preprint and already has archiveId/arxivId populated, suppress Extra duplicate.
      if (isPreprint && paperArchiveId) {
        continue;
      }

      hasArxivLine = true;
      // Standardize spacing: "arXiv: <id> [<category>]" with space after colon, clean ID, and canonical category brackets
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
        },
      );
      sanitizedLines.push(normalizedLine);
      continue;
    }

    // Preserve the clean content line as-is (no artificial label/title prepended!)
    sanitizedLines.push(trimmedLine);
  }

  // Fallback: If paper has an arXiv ID but no arXiv line in Extra, synthesize standard Zotero line.
  // CRITICAL: In official Zotero Schema, preprints natively display arXiv in the dedicated "Archive ID" field (#5).
  // Therefore, only synthesize arXiv into Extra for non-preprint item types (journalArticle, book, etc.)
  // that do NOT have an Archive ID field.
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

  // Group all structured key: value pairs at the top (per Zotero 2-invalid-lines heuristic),
  // followed by free-form user notes below.
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

/**
 * Sanitizes and normalizes an academic paper abstract for display and storage.
 * 1. Decodes HTML entities and strips XML/HTML tags.
 * 2. Strips leading "Abstract", "ABSTRACT", "Summary" prefixes.
 * 3. Removes repeated year extraction artifacts (e.g. "(2012)(2013)(2014)(2015)(2016)(2017).").
 * 4. Removes trailing author contribution, copyright, and index terms noise.
 * 5. Unwraps single hard line-breaks within paragraphs while preserving double-newline paragraph separation.
 * 6. Fixes hyphenated words broken across line wraps ("stochas- tic" -> "stochastic").
 */
export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Strip stray LaTeX braces
  cleaned = cleaned.replace(/\\(?:textbf|textit|emph|underline|text)\{([^}]+)\}/g, '$1');

  // 1. Remove leading "Abstract" or "ABSTRACT" headings
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*[:.—\-–\u2014\u2013]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*\r?\n+/i, '');

  // 2. Remove repeated parenthesized / bracketed year-chain extraction artifacts
  // e.g. "(2012)(2013)(2014)(2015)(2016)(2017)."
  cleaned = cleaned.replace(/(?:\((?:19|20)\d{2}\)\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/(?:\[(?:19|20)\d{2}\]\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/\((?:(?:19|20)\d{2}[,\s;]*){3,}\)\.?/g, '');

  // 3. Remove trailing author contribution / footnote noise
  cleaned = cleaned.replace(
    /(?:(?:\n\s*|\.\s+|\s+)[*†‡§\d]*\s*(?:Equal contribution|Corresponding author|Correspondence to|Author ordering|Listing order|These authors contributed equally|Work performed while|Supported in part by|This work was supported by)[\s\S]*$)/i,
    '.',
  );

  // 4. Remove trailing publication metadata or index terms
  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)(?:ACM Reference [Ff]ormat|Index Terms|Keywords|Key words|Additional Key Words and Phrases)[—:\-\s]+[\s\S]*$/i,
    '',
  );

  // 5. Remove trailing IEEE/ACM copyright banners
  cleaned = cleaned.replace(
    /(?:\n\s*|\.\s+|\s+)(?:Copyright\s*(?:\(c\)|©)?\s*(?:19|20)\d{2}|©\s*(?:19|20)\d{2}\s*IEEE)[\s\S]*$/i,
    '',
  );
  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)\b\d{4}-\d{3}[\dX]\s*(?:\(c\)|©)?\s*\d{4}\s*IEEE[\s\S]*$/i,
    '',
  );

  // 6. Normalize paragraphs & unwrap hard line-breaks within each paragraph
  const rawParagraphs = cleaned.split(/\r?\n\s*\r?\n/);
  const normalizedParagraphs = rawParagraphs
    .map((paragraph) => {
      // Fix hyphenation across breaks (e.g., "stochas- tic" -> "stochastic")
      let p = paragraph.replace(/([a-zA-Z]{2,})-\s*\r?\n\s*([a-zA-Z]{2,})/g, '$1$2');
      // Collapse single newlines into a single space
      p = p.replace(/\r?\n/g, ' ');
      // Collapse multiple whitespace
      p = p.replace(/\s+/g, ' ').trim();
      // Clean spacing before punctuation
      p = p.replace(/\s+([.,;:!?])/g, '$1');
      // Clean duplicate periods (excluding ellipsis)
      p = p.replace(/\.\s*\.(?!\.)/g, '.');
      return p;
    })
    .filter((p) => p.length > 0);

  return normalizedParagraphs.join('\n\n').trim();
}

/**
 * Resolves the canonical publication venue display text for an item according to Zotero Schema v42.
 * Uses type-specific field mapping (e.g. proceedingsTitle for conferencePaper, bookTitle for bookSection,
 * websiteTitle for webpage, repository for preprint/dataset, publicationTitle for journalArticle).
 */
export function getPublicationVenue(
  item?: Partial<Item> | Partial<Paper> | Record<string, any> | null,
): string {
  if (!item) return '—';
  const anyItem = item as Record<string, any>;
  const rawItemType = anyItem.itemType || anyItem.item_type || anyItem.type || anyItem.cslType;
  const itemType = String(rawItemType || 'journalArticle');
  const typeLower = itemType.toLowerCase();
  const ef = (anyItem.extraFields as Record<string, any>) || {};

  // 1. Check type-specific mapped venue field from Zotero Schema v42
  const venueField = getVenueFieldForType(itemType);
  const directValue = anyItem[venueField] || ef[venueField];
  if (directValue && typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim();
  }

  // 2. Type-specific semantic fallbacks (matching Zotero specifications)
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
        (typeof anyItem.publisher === 'string' && /arxiv/i.test(anyItem.publisher)),
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

  // 3. General publication title or journal
  const defaultVenue =
    (typeof anyItem.publicationTitle === 'string' && anyItem.publicationTitle.trim()) ||
    (typeof anyItem.journal === 'string' && anyItem.journal.trim()) ||
    (typeof anyItem.publisher === 'string' && anyItem.publisher.trim());

  return defaultVenue || '—';
}

/** Formats item type with proper words and casing (e.g. journalArticle -> Journal Article) */
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

/** Formats extra / extraFields into human-readable text instead of raw JSON brackets */
export function formatExtraDisplay(paper: Item): string {
  // 1. If paper.extra is a clean non-JSON string, use it
  if (typeof paper.extra === 'string' && paper.extra.trim()) {
    const trimmed = paper.extra.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return trimmed.replace(/\r?\n+/g, ', ');
    }
  }

  // 2. Extract key-values from extraFields or parsed extra JSON
  let fields: Record<string, unknown> | null = null;
  if (paper.extraFields && typeof paper.extraFields === 'object' && !Array.isArray(paper.extraFields)) {
    fields = paper.extraFields;
  } else if (typeof paper.extra === 'string') {
    const trimmed = paper.extra.trim();
    if (trimmed.startsWith('{')) {
      try {
        fields = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        // Ignore JSON error
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
