/**
 * latex-linter.util.ts
 *
 * Real-time LaTeX structural linter & spellchecker engine.
 * Matches Overleaf latexqc and linter standards.
 * Fast, pure TypeScript, non-blocking and zero external dependencies.
 */

export interface LatexLintDiagnostic {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  suggestions?: string[];
}

export interface RetractedItemInfo {
  title?: string;
  reason?: string;
  nature?: string;
  noticeUrl?: string;
}

export interface LatexLinterOptions {
  enableStructureLint?: boolean;
  enableSpellCheck?: boolean;
  userDictionary?: string[];
  retractedItemsMap?: Map<string, RetractedItemInfo>;
}

// ── Deprecated LaTeX 2.09 Command Map ─────────────────────────────────────────
const DEPRECATED_COMMANDS: Record<string, { replacement: string; desc: string }> = {
  '\\bf': { replacement: '\\textbf{...}', desc: 'Use modern \\textbf{...} instead of obsolete \\bf' },
  '\\it': { replacement: '\\textit{...}', desc: 'Use modern \\textit{...} instead of obsolete \\it' },
  '\\rm': { replacement: '\\textrm{...}', desc: 'Use modern \\textrm{...} instead of obsolete \\rm' },
  '\\tt': { replacement: '\\texttt{...}', desc: 'Use modern \\texttt{...} instead of obsolete \\tt' },
  '\\sf': { replacement: '\\textsf{...}', desc: 'Use modern \\textsf{...} instead of obsolete \\sf' },
  '\\sc': { replacement: '\\textsc{...}', desc: 'Use modern \\textsc{...} instead of obsolete \\sc' },
  '\\sl': { replacement: '\\textsl{...}', desc: 'Use modern \\textsl{...} instead of obsolete \\sl' },
};

// ── Academic & Scientific Terms Dictionary ───────────────────────────────────
const ACADEMIC_DICTIONARY = new Set([
  'latex', 'bibtex', 'overleaf', 'tex', 'pdflatex', 'xelatex', 'lualatex', 'synctex',
  'algorithm', 'algorithms', 'algorithmic', 'methodology', 'methodologies',
  'dataset', 'datasets', 'hyperparameter', 'hyperparameters', 'hyperparameterized',
  'eigenvalue', 'eigenvalues', 'eigenvector', 'eigenvectors',
  'stochastic', 'heterogeneous', 'homogeneous', 'asynchronous', 'synchronous',
  'convolutional', 'convolution', 'convolutions', 'recurrent',
  'transformer', 'transformers', 'attention', 'encoder', 'decoder',
  'embedding', 'embeddings', 'latent', 'manifold', 'manifolds',
  'quantization', 'regularization', 'generalization', 'optimization', 'optimizer',
  'backpropagation', 'gradient', 'gradients', 'hessian', 'jacobian',
  'ablation', 'ablations', 'benchmark', 'benchmarks', 'benchmarked',
  'scalability', 'throughput', 'latency', 'bandwidth',
  'corpus', 'corpora', 'lexical', 'semantic', 'semantics', 'syntactic',
  'multimodal', 'unimodal', 'probabilistic', 'deterministic',
  'heuristic', 'heuristics', 'heuristic', 'heuristically',
  'supervised', 'unsupervised', 'semisupervised', 'reinforcement',
  'arxiv', 'ieee', 'acm', 'springer', 'neurips', 'icml', 'iclr', 'cvpr', 'iccv', 'acl', 'emnlp',
  'doi', 'isbn', 'issn', 'url', 'uri', 'api', 'apis', 'sdk', 'sdks',
  'metadata', 'repository', 'repositories', 'framework', 'frameworks',
  'architecture', 'architectures', 'paradigm', 'paradigms',
  'theorem', 'theorems', 'corollary', 'corollaries', 'proposition', 'propositions',
  'lemma', 'lemmas', 'lemmata', 'axiom', 'axioms', 'postulate', 'postulates',
  'matrix', 'matrices', 'vector', 'vectors', 'tensor', 'tensors',
  'linear', 'nonlinear', 'affine', 'orthogonal', 'orthonormal',
  'boolean', 'integer', 'integers', 'float', 'floats', 'tuple', 'tuples',
  'monotonic', 'monotonically', 'asymptotic', 'asymptotically',
  'converge', 'converges', 'converged', 'convergence', 'divergence',
  'variance', 'covariance', 'standard', 'deviation', 'deviations',
  'distribution', 'distributions', 'gaussian', 'poisson', 'bernoulli',
  'parameter', 'parameters', 'parametric', 'nonparametric',
  'empirical', 'empirically', 'theoretical', 'theoretically',
  'neural', 'network', 'networks', 'layer', 'layers', 'node', 'nodes',
  'weight', 'weights', 'bias', 'biases', 'loss', 'losses',
  'train', 'training', 'trained', 'test', 'testing', 'tested', 'validate', 'validation',
  'compute', 'computes', 'computed', 'computing', 'computation', 'computations', 'computational',
  'accuracy', 'metric', 'metrics', 'input', 'inputs', 'output', 'outputs',
  'feature', 'features', 'class', 'classes', 'classification', 'regression',
  'predict', 'predicts', 'predicted', 'predicting', 'prediction', 'predictions',
  'represent', 'represents', 'represented', 'representing', 'representation', 'representations',
  'graph', 'graphs', 'tree', 'trees', 'edge', 'edges', 'vertex', 'vertices',
  'author', 'authors', 'coauthor', 'coauthors', 'acknowledgment', 'acknowledgments',
  'abstract', 'introduction', 'conclusion', 'conclusions', 'appendix', 'appendices',
  'fig', 'figure', 'figures', 'tab', 'table', 'tables', 'sec', 'section', 'sections',
  'eq', 'equation', 'equations', 'ref', 'reference', 'references',
]);

// Common English Core Vocabulary
const COMMON_ENGLISH_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
  'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
  'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
  'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'uses', 'used', 'using', 'two',
  'run', 'runs', 'running', 'ran', 'hold', 'holds', 'held',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
  'day', 'most', 'us', 'is', 'are', 'was', 'were', 'been', 'has', 'had', 'does', 'did', 'having',
  'show', 'shows', 'shown', 'showing', 'present', 'presents', 'presented', 'presenting',
  'propose', 'proposes', 'proposed', 'proposing', 'demonstrate', 'demonstrates', 'demonstrated',
  'evaluate', 'evaluates', 'evaluated', 'evaluating', 'evaluation', 'evaluations',
  'compare', 'compares', 'compared', 'comparing', 'comparison', 'comparisons',
  'achieve', 'achieves', 'achieved', 'achieving', 'achievement',
  'improve', 'improves', 'improved', 'improving', 'improvement', 'improvements',
  'perform', 'performs', 'performed', 'performing', 'performance',
  'result', 'results', 'resulting', 'resulted', 'find', 'finds', 'found', 'finding', 'findings',
  'discuss', 'discusses', 'discussed', 'discussing', 'discussion',
  'analyze', 'analyzes', 'analyzed', 'analyzing', 'analysis', 'analyses',
  'observe', 'observes', 'observed', 'observing', 'observation', 'observations',
  'suggest', 'suggests', 'suggested', 'suggesting', 'suggestion', 'suggestions',
  'indicate', 'indicates', 'indicated', 'indicating', 'indicator', 'indicators',
  'illustrate', 'illustrates', 'illustrated', 'illustrating', 'illustration',
  'denote', 'denotes', 'denoted', 'denoting', 'assume', 'assumes', 'assumed', 'assuming', 'assumption',
  'consider', 'considers', 'considered', 'considering', 'state', 'states', 'stated',
  'define', 'defines', 'defined', 'defining', 'definition', 'definitions',
  'obtain', 'obtains', 'obtained', 'obtaining', 'provide', 'provides', 'provided', 'providing',
  'high', 'higher', 'highest', 'low', 'lower', 'lowest', 'large', 'larger', 'largest', 'small', 'smaller', 'smallest',
  'significant', 'significantly', 'novel', 'effective', 'effectively', 'efficient', 'efficiently',
  'robust', 'accurate', 'accurately', 'comprehensive', 'preliminary', 'substantial',
  'furthermore', 'moreover', 'however', 'nevertheless', 'consequently', 'therefore', 'specifically',
  'respectively', 'similarly', 'conversely', 'notably', 'insofar', 'whereby', 'wherein',
  'such', 'both', 'between', 'among', 'through', 'during', 'before', 'after', 'above', 'below',
  'each', 'every', 'either', 'neither', 'many', 'much', 'several', 'few', 'less', 'more',
  'here', 'thus', 'hence', 'whereas', 'overall', 'together', 'well', 'rather', 'quite',
  'case', 'cases', 'step', 'steps', 'stage', 'stages', 'level', 'levels', 'point', 'points',
  'part', 'parts', 'type', 'types', 'form', 'forms', 'task', 'tasks', 'domain', 'domains',
  'problem', 'problems', 'solution', 'solutions', 'approach', 'approaches', 'system', 'systems',
  'model', 'models', 'method', 'methods', 'technique', 'techniques', 'strategy', 'strategies',
  'experiment', 'experiments', 'experimental', 'theorist', 'study', 'studies', 'research',
]);

/**
 * Replace matched ranges with spaces to preserve line & column offsets 1:1.
 */
function replaceWithSpaces(input: string, start: number, end: number): string {
  const segment = input.slice(start, end);
  const spaced = segment.replace(/[^\n]/g, ' ');
  return input.slice(0, start) + spaced + input.slice(end);
}

/**
 * Mask LaTeX syntax elements: comments, inline/display math, macros, and citations.
 * Output string has identical length and newline positions as original text.
 */
export function maskLatexSyntax(text: string): string {
  let masked = text;

  // 1. Mask comments (% to end of line, avoiding escaped \%)
  masked = masked.replace(/(^|[^\\])%.*$/gm, (match, prefix, offset) => {
    const commentStart = offset + prefix.length;
    const commentLen = match.length - prefix.length;
    return prefix + ' '.repeat(commentLen);
  });

  // 2. Mask display math: $$ ... $$ and \[ ... \]
  masked = masked.replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/[^\n]/g, ' '));
  masked = masked.replace(/\\\[[\s\S]*?\\\]/g, (m) => m.replace(/[^\n]/g, ' '));

  // 3. Mask inline math: $ ... $ (ignoring escaped \$)
  masked = masked.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, (match, prefix) => {
    const mathContent = match.slice(prefix.length);
    return prefix + ' '.repeat(mathContent.length);
  });

  // 4. Mask environment bodies for math / code / verbatim
  const MASK_ENVS = [
    'equation', 'equation*', 'align', 'align*', 'gather', 'gather*',
    'multline', 'multline*', 'split', 'bmatrix', 'pmatrix', 'vmatrix',
    'verbatim', 'verbatim*', 'lstlisting', 'minted',
  ];
  for (const env of MASK_ENVS) {
    const envEscaped = env.replace('*', '\\*');
    const regex = new RegExp(`\\\\begin\\{${envEscaped}\\}[\\s\\S]*?\\\\end\\{${envEscaped}\\}`, 'g');
    masked = masked.replace(regex, (m) => m.replace(/[^\n]/g, ' '));
  }

  // 5. Mask command names and non-prose parameters (\cite{...}, \ref{...}, \label{...}, etc.)
  const MASK_MACROS = [
    'cite', 'citep', 'citet', 'citeauthor', 'citeyear',
    'ref', 'pageref', 'autoref', 'eqref', 'nameref',
    'label', 'input', 'include', 'bibliography', 'bibliographystyle',
    'usepackage', 'documentclass', 'includegraphics', 'url', 'href',
  ];
  for (const macro of MASK_MACROS) {
    const regex = new RegExp(`\\\\${macro}(?:\\[[^\\]]*\\])?\\{[^\\}]*\\}`, 'g');
    masked = masked.replace(regex, (m) => m.replace(/[^\n]/g, ' '));
  }

  // 6. Mask other standalone LaTeX control words (\section, \textbf, \noindent, etc.)
  masked = masked.replace(/\\[a-zA-Z@]+(?:\*|\b)?/g, (m) => ' '.repeat(m.length));

  return masked;
}

/**
 * Check structural integrity of LaTeX document:
 * - Unclosed \begin{env} without \end{env}
 * - Deprecated LaTeX 2.09 commands (\bf, \it, \rm)
 * - Empty \cite{} or \ref{}
 * - Repeated words (e.g. "the the")
 * - Whitespace before punctuation (e.g. "word ,")
 */
export function lintLatexStructure(text: string): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  // ── 1. Unclosed / Mismatched Environments ─────────────────────────────────
  const envStack: Array<{ name: string; line: number; col: number }> = [];
  const beginEndRegex = /\\(begin|end)\{([a-zA-Z0-9*_-]+)\}/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    // Skip line comments
    const commentIdx = lineText.indexOf('%');
    const activeText = commentIdx !== -1 ? lineText.slice(0, commentIdx) : lineText;

    let match: RegExpExecArray | null;
    beginEndRegex.lastIndex = 0;
    while ((match = beginEndRegex.exec(activeText)) !== null) {
      const type = match[1];
      const envName = match[2];
      const colNum = match.index + 1;

      if (type === 'begin') {
        envStack.push({ name: envName, line: lineNum, col: colNum });
      } else if (type === 'end') {
        if (envStack.length === 0) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: colNum,
            endLineNumber: lineNum,
            endColumn: colNum + match[0].length,
            message: `Found \\end{${envName}} without matching \\begin{${envName}}`,
            severity: 'error',
            code: 'EXTRA_END_ENV',
          });
        } else {
          const last = envStack[envStack.length - 1];
          if (last.name === envName) {
            envStack.pop();
          } else {
            diagnostics.push({
              startLineNumber: lineNum,
              startColumn: colNum,
              endLineNumber: lineNum,
              endColumn: colNum + match[0].length,
              message: `Mismatched environment: \\begin{${last.name}} (line ${last.line}) closed by \\end{${envName}}`,
              severity: 'error',
              code: 'MISMATCHED_ENV',
              suggestions: [`\\end{${last.name}}`],
            });
            envStack.pop();
          }
        }
      }
    }
  });

  // Flag any unclosed environments at EOF
  for (const unclosed of envStack) {
    diagnostics.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + `\\begin{${unclosed.name}}`.length,
      message: `Unclosed environment: \\begin{${unclosed.name}} is missing a closing \\end{${unclosed.name}}`,
      severity: 'warning',
      code: 'UNCLOSED_ENV',
      suggestions: [`\\end{${unclosed.name}}`],
    });
  }

  // ── 2. Line-by-Line Linting ───────────────────────────────────────────────
  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const commentIdx = lineText.indexOf('%');
    const textWithoutComment = commentIdx !== -1 ? lineText.slice(0, commentIdx) : lineText;

    // Check deprecated commands (\bf, \it, \rm, etc.)
    for (const [cmd, info] of Object.entries(DEPRECATED_COMMANDS)) {
      const idx = textWithoutComment.indexOf(cmd);
      if (idx !== -1) {
        // Ensure not part of longer command like \bfseries or \item
        const afterChar = textWithoutComment[idx + cmd.length];
        if (!afterChar || /[^a-zA-Z]/.test(afterChar)) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: idx + 1,
            endLineNumber: lineNum,
            endColumn: idx + 1 + cmd.length,
            message: info.desc,
            severity: 'warning',
            code: 'DEPRECATED_COMMAND',
            suggestions: [info.replacement],
          });
        }
      }
    }

    // Check empty \ref{}, \cite{}, \label{}
    const emptyRefRegex = /\\(cite|ref|label|pageref|eqref)\{\s*\}/g;
    let emptyMatch: RegExpExecArray | null;
    while ((emptyMatch = emptyRefRegex.exec(textWithoutComment)) !== null) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: emptyMatch.index + 1,
        endLineNumber: lineNum,
        endColumn: emptyMatch.index + 1 + emptyMatch[0].length,
        message: `Empty argument in \\${emptyMatch[1]}{}. Provide a reference/cite key.`,
        severity: 'warning',
        code: 'EMPTY_REFERENCE',
      });
    }

    // Check repeated words (e.g. "the the", "in in")
    const repeatedWordRegex = /\b([a-zA-Z]{2,})\s+\1\b/gi;
    let repMatch: RegExpExecArray | null;
    while ((repMatch = repeatedWordRegex.exec(textWithoutComment)) !== null) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: repMatch.index + 1,
        endLineNumber: lineNum,
        endColumn: repMatch.index + 1 + repMatch[0].length,
        message: `Repeated word '${repMatch[1]}'`,
        severity: 'warning',
        code: 'REPEATED_WORD',
        suggestions: [repMatch[1]],
      });
    }

    // Check unexpected whitespace before punctuation
    const spacePunctRegex = /([a-zA-Z0-9])\s+([,;:?.!])/g;
    let punctMatch: RegExpExecArray | null;
    while ((punctMatch = spacePunctRegex.exec(textWithoutComment)) !== null) {
      diagnostics.push({
        startLineNumber: lineNum,
        startColumn: punctMatch.index + 1,
        endLineNumber: lineNum,
        endColumn: punctMatch.index + 1 + punctMatch[0].length,
        message: `Unexpected whitespace before punctuation '${punctMatch[2]}'`,
        severity: 'info',
        code: 'SPACE_BEFORE_PUNCT',
        suggestions: [`${punctMatch[1]}${punctMatch[2]}`],
      });
    }
  });

  return diagnostics;
}

/**
 * Spellchecker for natural prose in LaTeX manuscripts.
 * Evaluates words against English core vocabulary + Academic dictionary.
 */
export function checkLatexSpelling(
  rawText: string,
  maskedText: string,
  customWords: string[] = [],
): LatexLintDiagnostic[] {
  const diagnostics: LatexLintDiagnostic[] = [];
  const userDictSet = new Set(customWords.map((w) => w.toLowerCase()));

  const lines = maskedText.split(/\r?\n/);
  const wordRegex = /\b([a-zA-Z]{3,})\b/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    let match: RegExpExecArray | null;
    wordRegex.lastIndex = 0;

    while ((match = wordRegex.exec(lineText)) !== null) {
      const rawWord = match[1];
      const lower = rawWord.toLowerCase();

      // Ignore if uppercase acronym (e.g. GPU, CPU, REST, LSTM, BERT)
      if (rawWord.length <= 5 && rawWord === rawWord.toUpperCase()) {
        continue;
      }

      // Check dictionaries
      const isKnown =
        COMMON_ENGLISH_WORDS.has(lower) ||
        ACADEMIC_DICTIONARY.has(lower) ||
        userDictSet.has(lower);

      if (!isKnown) {
        // Only flag if not a common suffix like -ing, -ed, -s, -ly of a known word
        const isPluralOfKnown = (lower.endsWith('s') && (
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -1)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -1))
        )) || (lower.endsWith('es') && (
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -2)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -2))
        ));

        const isEdOfKnown = lower.endsWith('ed') && (
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -2)) ||
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -1)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -2)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -1))
        );

        const isIngOfKnown = lower.endsWith('ing') && (
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -3)) ||
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -3) + 'e') ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -3)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -3) + 'e')
        );

        const isLyOfKnown = lower.endsWith('ly') && (
          COMMON_ENGLISH_WORDS.has(lower.slice(0, -2)) ||
          ACADEMIC_DICTIONARY.has(lower.slice(0, -2))
        );

        if (!isPluralOfKnown && !isEdOfKnown && !isIngOfKnown && !isLyOfKnown) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: match.index + 1,
            endLineNumber: lineNum,
            endColumn: match.index + 1 + rawWord.length,
            message: `Possible spelling issue: '${rawWord}'`,
            severity: 'info',
            code: 'SPELL_CHECK',
            suggestions: [],
          });
        }
      }
    }
  });

  return diagnostics;
}

/**
 * Scans document for citations referencing known retracted publications.
 * Detects \cite{...}, \citep{...}, etc. and Markdown [@key] citations.
 */
export function lintRetractedCitations(
  text: string,
  retractedMap: Map<string, RetractedItemInfo>,
): LatexLintDiagnostic[] {
  if (!text || !retractedMap || retractedMap.size === 0) return [];
  const diagnostics: LatexLintDiagnostic[] = [];
  const lines = text.split(/\r?\n/);

  const latexCiteRegex = /\\(cite|citep|citet|parencite|textcite|nocite)(?:\[[^\]]*\])*\{([^}]+)\}/g;
  const markdownCiteRegex = /@([a-zA-Z0-9_:.#$%&\-+?<>~/]+)/g;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const commentIdx = lineText.indexOf('%');
    const activeText = commentIdx !== -1 ? lineText.slice(0, commentIdx) : lineText;

    // 1. Check LaTeX \cite{...}
    let match: RegExpExecArray | null;
    latexCiteRegex.lastIndex = 0;
    while ((match = latexCiteRegex.exec(activeText)) !== null) {
      const fullCmd = match[0];
      const keysRaw = match[2];
      const keysStartOffset = match.index + fullCmd.indexOf(keysRaw);

      let currentOffset = 0;
      const rawParts = keysRaw.split(',');
      for (const part of rawParts) {
        const trimmedKey = part.trim();
        const partIndexInRaw = keysRaw.indexOf(part, currentOffset);
        currentOffset = partIndexInRaw + part.length;

        if (trimmedKey && retractedMap.has(trimmedKey)) {
          const info = retractedMap.get(trimmedKey);
          const keyLeadingSpaces = part.indexOf(trimmedKey);
          const startCol = keysStartOffset + partIndexInRaw + keyLeadingSpaces + 1;
          const endCol = startCol + trimmedKey.length;

          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: endCol,
            message: `⚠️ Retracted Paper Warning: Citation '${trimmedKey}' (${info?.title ? `"${info.title}"` : 'Untitled'}) has been officially retracted${info?.reason ? `: ${info.reason}` : '.'}`,
            severity: 'warning',
            code: 'RETRACTED_CITATION',
            suggestions: [`% Retracted: ${trimmedKey}`],
          });
        }
      }
    }

    // 2. Check Markdown citations [@key]
    markdownCiteRegex.lastIndex = 0;
    while ((match = markdownCiteRegex.exec(activeText)) !== null) {
      const citeKey = match[1];
      if (retractedMap.has(citeKey)) {
        const info = retractedMap.get(citeKey);
        const startCol = match.index + 1;
        const endCol = startCol + match[0].length;

        const alreadyReported = diagnostics.some(
          (d) => d.startLineNumber === lineNum && d.startColumn === startCol,
        );
        if (!alreadyReported) {
          diagnostics.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: endCol,
            message: `⚠️ Retracted Paper Warning: Citation '${citeKey}' (${info?.title ? `"${info.title}"` : 'Untitled'}) has been officially retracted${info?.reason ? `: ${info.reason}` : '.'}`,
            severity: 'warning',
            code: 'RETRACTED_CITATION',
            suggestions: [],
          });
        }
      }
    }
  });

  return diagnostics;
}

/**
 * Main linter entry point: orchestrates syntax masking, structure linting,
 * academic spellchecking, and retracted citation detection.
 */
export function runLatexLinter(
  content: string,
  options: LatexLinterOptions = {},
): LatexLintDiagnostic[] {
  if (!content || typeof content !== 'string') return [];

  const {
    enableStructureLint = true,
    enableSpellCheck = true,
    userDictionary = [],
    retractedItemsMap,
  } = options;

  const results: LatexLintDiagnostic[] = [];

  if (enableStructureLint) {
    const structDiagnostics = lintLatexStructure(content);
    results.push(...structDiagnostics);
  }

  if (enableSpellCheck) {
    const masked = maskLatexSyntax(content);
    const spellDiagnostics = checkLatexSpelling(content, masked, userDictionary);
    results.push(...spellDiagnostics);
  }

  if (retractedItemsMap && retractedItemsMap.size > 0) {
    const retractionDiagnostics = lintRetractedCitations(content, retractedItemsMap);
    results.push(...retractionDiagnostics);
  }

  return results;
}
