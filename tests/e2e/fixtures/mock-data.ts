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

export const MOCK_COMPILE_SUCCESS = {
  success: true,
  pdfUrl: '/mock-assets/paper-preview.pdf',
  synctexUrl: '/mock-assets/paper.synctex.gz',
  issues: [],
  logs: [
    'This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2024)',
    'Output written on main.pdf (1 page, 32150 bytes).',
  ],
  durationMs: 980,
};

export const MOCK_COMPILE_WITH_WARNING = {
  success: true,
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
  ],
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
