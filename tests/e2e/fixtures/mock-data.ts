/**
 * mock-data.ts
 *
 * Deterministic mock data for Overleaf Parity E2E test suite.
 * Adheres strictly to Overleaf specifications and Flux Project-Manuscript architecture.
 */

export const MOCK_USER = {
  id: 'user-academic-001',
  name: 'Dr. Alan Turing',
  email: 'alan@flux.academic',
  role: 'owner',
  avatarUrl: null,
};

export const MOCK_PROJECT = {
  id: 'proj-academic-001',
  name: 'Quantum Foundations Manuscript',
  slug: 'quantum-foundations',
  role: 'owner',
  modules: ['pages'],
  settings: {
    compiler: 'pdflatex',
    texLiveVersion: '2024',
    mainFile: 'main.tex',
    autoCompile: false,
  },
};

export const MOCK_PROJECT_MEMBERS = [
  {
    id: 'pm-1',
    userId: 'user-academic-001',
    role: 'owner',
    user: MOCK_USER,
  },
  {
    id: 'pm-2',
    userId: 'user-reviewer-002',
    role: 'reviewer',
    user: {
      id: 'user-reviewer-002',
      name: 'Prof. Emmy Noether',
      email: 'noether@flux.academic',
    },
  },
];

export const INITIAL_LATEX_CONTENT = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{Quantum State Estimation}
\\author{Dr. Alan Turing}

\\begin{document}
\\maketitle

\\section{Introduction}
Recent developments in quantum information demonstrate notable advantages.

\\section{Main Results}
Let $|\\psi\\rangle$ be a pure state in Hilbert space $\\mathcal{H}$.

\\end{document}
`;

export const MOCK_PAGE = {
  id: 'page-paper-001',
  title: 'main.tex',
  content: INITIAL_LATEX_CONTENT,
  docContent: INITIAL_LATEX_CONTENT,
  projectId: 'proj-academic-001',
  isMain: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_FILES_HIERARCHY = [
  {
    id: 'page-paper-001',
    title: 'main.tex',
    projectId: 'proj-academic-001',
    isMain: true,
  },
  {
    id: 'page-bib-002',
    title: 'references.bib',
    projectId: 'proj-academic-001',
    isMain: false,
  },
];

export const MOCK_WORD_COUNT = {
  success: true,
  stats: {
    wordsInText: 42,
    wordsInHeaders: 6,
    wordsInCaptions: 0,
    headers: 2,
    floats: 0,
    mathInlines: 2,
    mathDisplayed: 0,
  },
};

export function buildMockValidPdfBase64(lines: string[] = ['Quantum Foundations Manuscript']): string {
  const escapedLines = lines.map((l) => l.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
  const textOps = escapedLines
    .map((txt, idx) => `BT /F1 12 Tf 72 ${740 - idx * 24} Td (${txt}) Tj ET`)
    .join('\n');
  const stream = `${textOps}\n`;
  const objs = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objs) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf-8').toString('base64');
}

export const MOCK_VALID_PDF_BASE64 = buildMockValidPdfBase64([
  'Quantum State Estimation',
  'Dr. Alan Turing',
  '1 Introduction',
  'Recent developments in quantum information demonstrate notable advantages.',
]);

export const MOCK_COMPILE_SUCCESS = {
  success: true,
  pdf: MOCK_VALID_PDF_BASE64,
  pdfUrl: '/mock-assets/paper-preview.pdf',
  synctexUrl: '/mock-assets/paper.synctex.gz',
  issues: [],
  logs: [
    'This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024)',
    'Output written on main.pdf (1 page, 32150 bytes).',
  ].join('\n'),
  durationMs: 980,
};

export const MOCK_COMPILE_WITH_WARNING = {
  success: true,
  pdf: MOCK_VALID_PDF_BASE64,
  pdfUrl: '/mock-assets/paper-preview.pdf',
  issues: [
    {
      file: 'main.tex',
      line: 12,
      message: 'Underfull \\hbox (badness 10000) in paragraph at lines 12--14',
      severity: 'warning',
    },
  ],
  logs: [
    'Underfull \\hbox (badness 10000) in paragraph at lines 12--14',
    'Output written on main.pdf (1 page, 32150 bytes).',
  ].join('\n'),
};

export const MOCK_SUGGESTIONS = [
  {
    id: 'sug-001',
    pageId: 'page-paper-001',
    userId: 'user-reviewer-002',
    originalText: 'notable advantages',
    suggestedText: 'provable exponential speedups',
    type: 'replace',
    status: 'pending',
    createdAt: new Date().toISOString(),
    user: {
      name: 'Prof. Emmy Noether',
    },
  },
];
