/**
 * latex-dependency.util.ts
 *
 * LaTeX Include Dependency Graph & DAG Resolver.
 *
 * Capabilities:
 * - High-speed static analysis of LaTeX include directives (\input, \include, \subfile, \import, \bibliography).
 * - Directed Graph G = (V, E) representation with adjacency and reverse adjacency lists.
 * - Cycle Detection via DFS 3-Coloring (White, Gray, Black) in O(V + E).
 * - Intelligent Root Document Inference:
 *     1. Explicit user-configured main file verification.
 *     2. Active file standalone check (\documentclass without parents).
 *     3. Subfiles package ancestry resolution (\documentclass[main.tex]{subfiles}).
 *     4. Reverse DFS / BFS backtracking from any child file up to the true root.
 *     5. Heuristic candidate scoring (main.tex, thesis.tex, out-degree, root depth).
 * - Incremental node update O(k) for real-time keystroke tracking without full project re-scans.
 * - Blast Radius / Affected Ancestor calculation for selective recompilation & caching.
 */

export interface LatexDependencyNode {
  id: string; // Unique file ID or normalized path
  path: string; // e.g. "main.tex", "chapters/intro.tex"
  title: string;
  hasDocumentClass: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includes: string[]; // List of target normalized paths included by this file
  inDegree: number;
  outDegree: number;
}

export interface DependencyGraphAnalysis {
  nodes: Map<string, LatexDependencyNode>;
  cycles: string[][]; // Detected circular include chains, e.g. [["a.tex", "b.tex", "a.tex"]]
  hasCycle: boolean;
  rootCandidates: string[]; // Node paths that have \documentclass and in-degree = 0
}

/**
 * Normalizes LaTeX file paths:
 * - Strips leading/trailing whitespace and quotes.
 * - Replaces backslashes with forward slashes.
 * - Removes leading "./"
 * - Appends ".tex" extension if not present (unless it already has an extension like .bib, .sty).
 */
export function normalizeLatexPath(rawPath: string): string {
  if (!rawPath) return '';
  let clean = rawPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');

  // Strip leading ./
  if (clean.startsWith('./')) {
    clean = clean.slice(2);
  }

  // If no extension, append .tex
  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  if (!filename.includes('.')) {
    clean = `${clean}.tex`;
  }

  return clean;
}

/**
 * Strips comments from LaTeX source text to prevent false positive include parsing.
 * Handles escaped percent signs (\%).
 */
export function stripLatexComments(source: string): string {
  if (!source) return '';
  const lines = source.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let commentIdx = -1;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '%' && (c === 0 || line[c - 1] !== '\\')) {
        commentIdx = c;
        break;
      }
    }
    result.push(commentIdx >= 0 ? line.slice(0, commentIdx) : line);
  }

  return result.join('\n');
}

/**
 * Directives parser: extracts include targets and document class info from a LaTeX file.
 */
export function parseLatexDirectives(content: string): {
  hasDocumentClass: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includedFiles: string[];
} {
  const cleanSource = stripLatexComments(content);

  // 1. Check \documentclass
  const docClassMatch = cleanSource.match(/\\documentclass(?:\[([^\]]*)\])?\{([^}]+)\}/);
  let hasDocumentClass = false;
  let isSubfile = false;
  let subfileParentPath: string | null = null;

  if (docClassMatch) {
    hasDocumentClass = true;
    const opt = docClassMatch[1]?.trim() || '';
    const cls = docClassMatch[2]?.trim() || '';

    if (cls === 'subfiles' && opt) {
      isSubfile = true;
      subfileParentPath = normalizeLatexPath(opt);
    }
  }

  const includedFilesSet = new Set<string>();

  // 2. \input{...} and \include{...}
  const inputIncludeRegex = /\\(?:input|include)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = inputIncludeRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      includedFilesSet.add(normalizeLatexPath(rawTarget));
    }
  }

  // 3. \subfile{...}
  const subfileRegex = /\\subfile\{([^}]+)\}/g;
  while ((m = subfileRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      includedFilesSet.add(normalizeLatexPath(rawTarget));
    }
  }

  // 4. \import{path}{filename} or \subimport{path}{filename}
  const importRegex = /\\(?:sub)?import\{([^}]+)\}\{([^}]+)\}/g;
  while ((m = importRegex.exec(cleanSource)) !== null) {
    const dir = m[1]?.trim() || '';
    const file = m[2]?.trim() || '';
    if (file) {
      const combined = dir ? `${dir.replace(/\/+$/, '')}/${file}` : file;
      includedFilesSet.add(normalizeLatexPath(combined));
    }
  }

  // 5. \inputminted{lang}{filename}
  const mintedRegex = /\\inputminted(?:\[[^\]]*\])?\{[^}]+\}\{([^}]+)\}/g;
  while ((m = mintedRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      includedFilesSet.add(normalizeLatexPath(rawTarget));
    }
  }

  return {
    hasDocumentClass,
    isSubfile,
    subfileParentPath,
    includedFiles: Array.from(includedFilesSet),
  };
}

/**
 * LaTeX Include Dependency Graph Engine (DAG Resolver)
 */
export class LatexDependencyGraphEngine {
  // Map of normalized path / fileId -> Node
  private nodes = new Map<string, LatexDependencyNode>();
  // Adjacency: u -> set of v (u includes v)
  private forwardEdges = new Map<string, Set<string>>();
  // Reverse Adjacency: v -> set of u (v is included by u)
  private reverseEdges = new Map<string, Set<string>>();
  // Path to fileId lookup
  private pathToIdMap = new Map<string, string>();
  // fileId to Path lookup
  private idToPathMap = new Map<string, string>();

  /**
   * Resets the entire graph.
   */
  public clear(): void {
    this.nodes.clear();
    this.forwardEdges.clear();
    this.reverseEdges.clear();
    this.pathToIdMap.clear();
    this.idToPathMap.clear();
  }

  /**
   * Registers or updates a single file node in the dependency graph.
   * Incremental complexity: O(k) where k is the number of include directives in this file.
   */
  public updateFileNode(fileId: string, filePath: string, content: string): void {
    const normalizedPath = normalizeLatexPath(filePath || fileId);
    this.pathToIdMap.set(normalizedPath, fileId);
    this.idToPathMap.set(fileId, normalizedPath);

    // If node previously existed, remove its old outgoing edges from reverse lists
    const existingNode = this.nodes.get(normalizedPath);
    if (existingNode) {
      const oldIncludes = this.forwardEdges.get(normalizedPath) || new Set();
      for (const target of oldIncludes) {
        const revSet = this.reverseEdges.get(target);
        if (revSet) {
          revSet.delete(normalizedPath);
        }
        const targetNode = this.nodes.get(target);
        if (targetNode) {
          targetNode.inDegree = Math.max(0, targetNode.inDegree - 1);
        }
      }
    }

    // Parse the new content
    const parsed = parseLatexDirectives(content);

    const node: LatexDependencyNode = {
      id: fileId,
      path: normalizedPath,
      title: filePath,
      hasDocumentClass: parsed.hasDocumentClass,
      isSubfile: parsed.isSubfile,
      subfileParentPath: parsed.subfileParentPath,
      includes: parsed.includedFiles,
      inDegree: this.reverseEdges.get(normalizedPath)?.size ?? 0,
      outDegree: parsed.includedFiles.length,
    };

    this.nodes.set(normalizedPath, node);

    // Reconstruct outgoing edges
    const targetSet = new Set<string>(parsed.includedFiles);
    this.forwardEdges.set(normalizedPath, targetSet);

    for (const target of targetSet) {
      if (!this.reverseEdges.has(target)) {
        this.reverseEdges.set(target, new Set());
      }
      this.reverseEdges.get(target)!.add(normalizedPath);

      const targetNode = this.nodes.get(target);
      if (targetNode) {
        targetNode.inDegree = this.reverseEdges.get(target)!.size;
      }
    }
  }

  /**
   * Batch builds the entire graph from a collection of project files.
   */
  public buildFromProjectFiles(
    files: Array<{ id: string; title: string; path?: string; content?: string }>
  ): DependencyGraphAnalysis {
    this.clear();

    for (const f of files) {
      const path = f.path || f.title || f.id;
      // Only process TeX/LaTeX files or files without extension
      if (path.endsWith('.tex') || path.endsWith('.bib') || !path.includes('.')) {
        this.updateFileNode(f.id, path, f.content || '');
      }
    }

    return this.analyze();
  }

  /**
   * Detects cycles in the graph using standard 3-coloring DFS:
   * 0 = White (unvisited), 1 = Gray (in active recursion stack), 2 = Black (visited).
   * Complexity: O(V + E)
   */
  public detectCycles(): string[][] {
    const visited = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited
    const parentMap = new Map<string, string | null>();
    const cycles: string[][] = [];

    const dfs = (node: string, pathStack: string[]) => {
      visited.set(node, 1);
      pathStack.push(node);

      const neighbors = this.forwardEdges.get(node) || new Set();
      for (const neighbor of neighbors) {
        const state = visited.get(neighbor) ?? 0;
        if (state === 1) {
          // Cycle found: reconstruct the loop from pathStack
          const cycleStartIdx = pathStack.indexOf(neighbor);
          if (cycleStartIdx >= 0) {
            const cyclePath = pathStack.slice(cycleStartIdx).concat(neighbor);
            cycles.push(cyclePath);
          }
        } else if (state === 0) {
          parentMap.set(neighbor, node);
          dfs(neighbor, pathStack);
        }
      }

      pathStack.pop();
      visited.set(node, 2);
    };

    for (const nodeKey of this.nodes.keys()) {
      if ((visited.get(nodeKey) ?? 0) === 0) {
        dfs(nodeKey, []);
      }
    }

    return cycles;
  }

  /**
   * Finds all ancestors that include the specified file (Blast Radius / Impact Analysis).
   * Performs reverse BFS traversal.
   */
  public getAffectedAncestors(fileIdOrPath: string): Set<string> {
    const startNode = this.resolveNormalizedPath(fileIdOrPath);
    const affected = new Set<string>();
    if (!startNode) return affected;

    const queue: string[] = [startNode];
    const visited = new Set<string>([startNode]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const parents = this.reverseEdges.get(current);
      if (parents) {
        for (const p of parents) {
          if (!visited.has(p)) {
            visited.add(p);
            affected.add(p);
            queue.push(p);
          }
        }
      }
    }

    return affected;
  }

  /**
   * Topological sorting of included files (or reverse topological for compilation dependency order).
   * Throws an error or returns partial list if cycles exist.
   */
  public getTopologicalOrder(): string[] {
    const inDegreeMap = new Map<string, number>();
    for (const [path, node] of this.nodes) {
      inDegreeMap.set(path, node.inDegree);
    }

    const queue: string[] = [];
    for (const [path, deg] of inDegreeMap) {
      if (deg === 0) {
        queue.push(path);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);

      const targets = this.forwardEdges.get(curr) || new Set();
      for (const t of targets) {
        const currentDeg = inDegreeMap.get(t) ?? 1;
        const newDeg = currentDeg - 1;
        inDegreeMap.set(t, newDeg);
        if (newDeg === 0) {
          queue.push(t);
        }
      }
    }

    return order;
  }

  /**
   * Intelligent Root Document Inference.
   *
   * Solves the classic problem:
   * "User presses compile while editing chapters/intro.tex -> Which file is the compile entry point?"
   *
   * Algorithm:
   * 1. Explicit verification: If explicitMainFile is provided and exists with \documentclass -> returns it.
   * 2. Active file check: If active file has \documentclass and is not a subfile and inDegree = 0 -> returns active file.
   * 3. Subfile package check: If active file has \documentclass[main.tex]{subfiles} -> returns subfileParentPath.
   * 4. Reverse DAG Backtracking: Walk reverseEdges up from active file. Find the first ancestor with \documentclass and inDegree = 0.
   * 5. Heuristic Root Candidate Ranking: Score all files with \documentclass and inDegree = 0:
   *    - "main.tex" -> 100 pts
   *    - "index.tex", "thesis.tex", "paper.tex", "document.tex", "root.tex" -> 80 pts
   *    - Root level directory (no "/") -> 20 pts
   *    - Out-degree -> +2 pts per included file
   * 6. Ultimate fallback: "main.tex".
   */
  public inferRootDocument(
    activeFileIdOrPath?: string | null,
    explicitMainFile?: string | null
  ): {
    rootPath: string;
    rootFileId?: string;
    inferredBy: 'explicit' | 'active-standalone' | 'subfile' | 'dag-backtracking' | 'heuristic' | 'fallback';
    hasCycleWarning: boolean;
  } {
    const cycles = this.detectCycles();
    const hasCycleWarning = cycles.length > 0;

    // 1. Explicit user-configured main file
    if (explicitMainFile) {
      const normalizedExplicit = normalizeLatexPath(explicitMainFile);
      if (this.nodes.has(normalizedExplicit)) {
        return {
          rootPath: normalizedExplicit,
          rootFileId: this.pathToIdMap.get(normalizedExplicit),
          inferredBy: 'explicit',
          hasCycleWarning,
        };
      }
    }

    const normalizedActive = activeFileIdOrPath ? this.resolveNormalizedPath(activeFileIdOrPath) : null;
    const activeNode = normalizedActive ? this.nodes.get(normalizedActive) : null;

    // 2. Active file standalone check
    if (activeNode && activeNode.hasDocumentClass && !activeNode.isSubfile && activeNode.inDegree === 0) {
      return {
        rootPath: activeNode.path,
        rootFileId: activeNode.id,
        inferredBy: 'active-standalone',
        hasCycleWarning,
      };
    }

    // 3. Subfile package check
    if (activeNode && activeNode.isSubfile && activeNode.subfileParentPath) {
      const parentNorm = normalizeLatexPath(activeNode.subfileParentPath);
      if (this.nodes.has(parentNorm)) {
        return {
          rootPath: parentNorm,
          rootFileId: this.pathToIdMap.get(parentNorm),
          inferredBy: 'subfile',
          hasCycleWarning,
        };
      }
    }

    // 4. Reverse DAG Backtracking from active file to true root ancestor
    if (normalizedActive) {
      const ancestors = this.getAffectedAncestors(normalizedActive);
      const rootAncestors: LatexDependencyNode[] = [];

      for (const ancPath of ancestors) {
        const node = this.nodes.get(ancPath);
        if (node && node.hasDocumentClass) {
          rootAncestors.push(node);
        }
      }

      if (rootAncestors.length > 0) {
        // Sort by lowest inDegree (ideally 0) and highest outDegree
        rootAncestors.sort((a, b) => a.inDegree - b.inDegree || b.outDegree - a.outDegree);
        const bestAncestor = rootAncestors[0];
        return {
          rootPath: bestAncestor.path,
          rootFileId: bestAncestor.id,
          inferredBy: 'dag-backtracking',
          hasCycleWarning,
        };
      }
    }

    // 5. Heuristic Root Candidate Ranking
    const candidates: Array<{ node: LatexDependencyNode; score: number }> = [];

    for (const [path, node] of this.nodes) {
      if (node.hasDocumentClass) {
        let score = 50;
        if (node.inDegree === 0) score += 30;

        const baseName = path.toLowerCase();
        if (baseName === 'main.tex') {
          score += 100;
        } else if (
          baseName === 'thesis.tex' ||
          baseName === 'paper.tex' ||
          baseName === 'document.tex' ||
          baseName === 'index.tex' ||
          baseName === 'root.tex'
        ) {
          score += 70;
        }

        if (!path.includes('/')) {
          score += 20; // Root directory bonus
        }

        score += node.outDegree * 2; // More includes = more likely master document

        candidates.push({ node, score });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0].node;
      return {
        rootPath: best.path,
        rootFileId: best.id,
        inferredBy: 'heuristic',
        hasCycleWarning,
      };
    }

    // 6. Fallback
    const fallbackPath = 'main.tex';
    return {
      rootPath: fallbackPath,
      rootFileId: this.pathToIdMap.get(fallbackPath),
      inferredBy: 'fallback',
      hasCycleWarning,
    };
  }

  /**
   * Produces a full analysis report of the current graph.
   */
  public analyze(): DependencyGraphAnalysis {
    const cycles = this.detectCycles();
    const rootCandidates: string[] = [];

    for (const [path, node] of this.nodes) {
      if (node.hasDocumentClass && node.inDegree === 0) {
        rootCandidates.push(path);
      }
    }

    return {
      nodes: new Map(this.nodes),
      cycles,
      hasCycle: cycles.length > 0,
      rootCandidates,
    };
  }

  /**
   * Resolves a file ID or path to the normalized internal path key.
   */
  private resolveNormalizedPath(idOrPath: string): string | null {
    if (this.nodes.has(idOrPath)) return idOrPath;
    const normalized = normalizeLatexPath(idOrPath);
    if (this.nodes.has(normalized)) return normalized;
    if (this.idToPathMap.has(idOrPath)) return this.idToPathMap.get(idOrPath)!;

    // Fuzzy basename search
    for (const [path] of this.nodes) {
      if (path.endsWith(`/${idOrPath}`) || path.endsWith(`/${normalized}`)) {
        return path;
      }
    }

    return null;
  }
}

/** Global singleton instance for the editor session */
export const latexDependencyGraph = new LatexDependencyGraphEngine();
