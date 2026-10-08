/**
 * latex-dependency.util.ts
 *
 * LaTeX Include Dependency Graph & DAG Resolver.
 * Re-exports from single-source-of-truth `latex-dag-engine.ts`.
 */

export * from '../latex-dag-engine';
export {
  LatexDagEngine as LatexDependencyGraphEngine,
  latexDagEngine as latexDependencyGraph,
} from '../latex-dag-engine';
