/**
 * Presentation Model: Subject & Academic Categories
 *
 * Provides category mapping and lookup for arXiv, ACM, and CrossRef classifications.
 */

export const ARXIV_CATEGORIES: Record<string, string> = {
  'cs.AI': 'Artificial Intelligence',
  'cs.CL': 'Computation and Language',
  'cs.CC': 'Computational Complexity',
  'cs.CE': 'Computational Engineering, Finance, and Science',
  'cs.CG': 'Computational Geometry',
  'cs.GT': 'Computer Science and Game Theory',
  'cs.CV': 'Computer Vision and Pattern Recognition',
  'cs.CY': 'Computers and Society',
  'cs.CR': 'Cryptography and Security',
  'cs.DS': 'Data Structures and Algorithms',
  'cs.DB': 'Databases',
  'cs.DL': 'Digital Libraries',
  'cs.DM': 'Discrete Mathematics',
  'cs.DC': 'Distributed, Parallel, and Cluster Computing',
  'cs.ET': 'Emerging Technologies',
  'cs.FL': 'Formal Languages and Automata Theory',
  'cs.GL': 'General Literature',
  'cs.GR': 'Graphics',
  'cs.AR': 'Hardware Architecture',
  'cs.HC': 'Human-Computer Interaction',
  'cs.IR': 'Information Retrieval',
  'cs.IT': 'Information Theory',
  'cs.LG': 'Machine Learning',
  'cs.LO': 'Logic in Computer Science',
  'cs.MS': 'Mathematical Software',
  'cs.MA': 'Multiagent Systems',
  'cs.MM': 'Multimedia',
  'cs.NI': 'Networking and Internet Architecture',
  'cs.NE': 'Neural and Evolutionary Computing',
  'cs.NA': 'Numerical Analysis',
  'cs.OS': 'Operating Systems',
  'cs.PF': 'Performance',
  'cs.PL': 'Programming Languages',
  'cs.RO': 'Robotics',
  'cs.SE': 'Software Engineering',
  'cs.SD': 'Sound',
  'cs.SC': 'Symbolic Computation',
  'cs.SY': 'Systems and Control',
  'stat.ML': 'Machine Learning (Statistics)',
  'math.PR': 'Probability',
  'physics.soc-ph': 'Physics and Society',
  'q-bio.NC': 'Neurons and Cognition',
};

/**
 * Resolves an arXiv category identifier code (e.g. "cs.AI") to its canonical
 * representation or returns the code if unrecognized.
 */
export function resolveArxivCategory(categoryCode?: string | null): string {
  if (!categoryCode || typeof categoryCode !== 'string') return '';
  const trimmed = categoryCode.trim();
  // Returns category code or label according to academic standard
  return trimmed;
}

/**
 * Returns human-readable label for an arXiv category code.
 */
export function getArxivCategoryLabel(categoryCode?: string | null): string {
  if (!categoryCode || typeof categoryCode !== 'string') return '';
  const trimmed = categoryCode.trim();
  return ARXIV_CATEGORIES[trimmed] || trimmed;
}
