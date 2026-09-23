/**
 * Pure Domain Model: Academic Categories & Taxonomy (arXiv, Fields of Study)
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

export const ARXIV_CATEGORY_MAP: Readonly<Record<string, string>> = {
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
};

export function getCategoryDisplayName(code: string): string {
  const clean = code.trim().toLowerCase();
  return ARXIV_CATEGORY_MAP[clean] || code;
}

export const CANONICAL_ARXIV_CATEGORIES: Record<string, string> = {
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
  'stat.ml': 'stat.ML',
  'stat.ap': 'stat.AP',
  'stat.co': 'stat.CO',
  'stat.me': 'stat.ME',
  'stat.th': 'stat.TH',
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
  'q-fin.cp': 'q-fin.CP',
  'q-fin.ec': 'q-fin.EC',
  'q-fin.gn': 'q-fin.GN',
  'q-fin.mf': 'q-fin.MF',
  'q-fin.pm': 'q-fin.PM',
  'q-fin.pr': 'q-fin.PR',
  'q-fin.rm': 'q-fin.RM',
  'q-fin.st': 'q-fin.ST',
  'q-fin.tr': 'q-fin.TR',
  'eess.as': 'eess.AS',
  'eess.iv': 'eess.IV',
  'eess.sp': 'eess.SP',
  'eess.sy': 'eess.SY',
  'nlin.ao': 'nlin.AO',
  'nlin.cd': 'nlin.CD',
  'nlin.cg': 'nlin.CG',
  'nlin.ps': 'nlin.PS',
  'nlin.si': 'nlin.SI',
  'econ.em': 'econ.EM',
  'econ.gn': 'econ.GN',
  'econ.th': 'econ.TH',
};

export const KNOWN_CANONICAL_ARXIV_CATEGORIES: Record<string, string> = {
  '1312.6114': 'cs.LG',
  '1406.2661': 'stat.ML',
  '1512.03385': 'cs.CV',
  '1706.03762': 'cs.CL',
  '1810.04805': 'cs.CL',
  '2005.14165': 'cs.CL',
  '2010.11929': 'cs.CV',
  '1506.01497': 'cs.CV',
  '1409.1556': 'cs.CV',
  '1409.4842': 'cs.CV',
  '1611.07004': 'cs.CV',
  '1703.10593': 'cs.CV',
  '1905.11946': 'cs.CV',
  '2103.00020': 'cs.CV',
  '2112.10752': 'cs.CV',
  '2205.11487': 'cs.CL',
  '2210.03629': 'cs.CL',
  '2303.08774': 'cs.CL',
  '2302.13971': 'cs.CL',
  '2307.09288': 'cs.CL',
};

export function resolveArxivCategory(
  arxivId?: string | null,
  associatedPaperItem?: Record<string, any> | null,
  additionalExtraFields?: Record<string, any> | null
): string | undefined {
  if (arxivId) {
    const rawCode = arxivId.trim().toLowerCase();
    if (CANONICAL_ARXIV_CATEGORIES[rawCode]) {
      return CANONICAL_ARXIV_CATEGORIES[rawCode];
    }
    if (ARXIV_CATEGORY_MAP[rawCode]) {
      return ARXIV_CATEGORY_MAP[rawCode];
    }
  }

  if (typeof additionalExtraFields?.primaryCategory === 'string' && additionalExtraFields.primaryCategory.trim()) {
    const raw = additionalExtraFields.primaryCategory.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }
  if (typeof additionalExtraFields?.category === 'string' && additionalExtraFields.category.trim()) {
    const raw = additionalExtraFields.category.trim();
    return CANONICAL_ARXIV_CATEGORIES[raw.toLowerCase()] || raw;
  }

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

  for (const c of candidates) {
    const lower = c.trim().toLowerCase();
    for (const [code, desc] of Object.entries(ARXIV_CATEGORY_MAP)) {
      if (desc.toLowerCase() === lower) {
        return CANONICAL_ARXIV_CATEGORIES[code] || code;
      }
    }
  }

  for (const c of candidates) {
    const lower = c.trim().toLowerCase();
    if (/machine\s*learning|reinforcement\s*learning/i.test(lower)) return 'cs.LG';
    if (/computer\s*vision/i.test(lower)) return 'cs.CV';
    if (/natural\s*language|computation\s*and\s*language/i.test(lower)) return 'cs.CL';
    if (/artificial\s*intelligence/i.test(lower)) return 'cs.AI';
    if (/robotics/i.test(lower)) return 'cs.RO';
    if (/neural\s*and\s*evolutionary/i.test(lower)) return 'cs.NE';
  }

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

export function getSubjectArea(code: string): string {
  const clean = code.trim().toLowerCase();
  const parts = clean.split('.');
  const prefix = parts[0];
  const areaMap: Record<string, string> = {
    cs: 'Computer Science',
    stat: 'Statistics',
    math: 'Mathematics',
    'q-bio': 'Quantitative Biology',
    'q-fin': 'Quantitative Finance',
    eess: 'Electrical Engineering & Systems',
    physics: 'Physics',
    econ: 'Economics',
  };
  return areaMap[prefix] || 'Academic Research';
}
