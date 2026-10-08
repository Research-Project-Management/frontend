/**
 * latex-dag-engine.ts
 *
 * LaTeX Include Dependency Graph & DAG Resolver (Domain Layer).
 *
 * Capabilities:
 * - High-speed static analysis of LaTeX include directives (\input, \include, \subfile, \import, \bibliography).
 * - Directed Graph G = (V, E) representation with forward and reverse adjacency lists.
 * - Cycle Detection via DFS 3-Coloring (White, Gray, Black) in O(V + E).
 * - Intelligent Root Document Inference:
 *     1. Explicit user-configured main file verification.
 *     2. Active file standalone check (\documentclass without parents).
 *     3. Subfiles package ancestry resolution (\documentclass[main.tex]{subfiles}).
 *     4. Reverse DAG Backtracking from child files up to the true root document.
 *     5. Heuristic candidate scoring (main.tex, thesis.tex, out-degree, root depth).
 * - Incremental node update O(k) for real-time keystroke tracking without full project re-scans.
 * - Blast Radius / Affected Ancestor calculation for selective recompilation.
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
 * - Strips quotes, spaces, and backslashes
 * - Strips leading "./" and "/"
 * - Appends default extension (.tex, .bib) if no extension present
 */
export function normalizeLatexPath(rawPath: string, defaultExt: string = '.tex'): string {
  if (!rawPath) return '';
  let clean = rawPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');

  while (clean.startsWith('./')) {
    clean = clean.slice(2);
  }
  while (clean.startsWith('/')) {
    clean = clean.slice(1);
  }

  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  if (!filename.includes('.')) {
    const ext = defaultExt.startsWith('.') ? defaultExt : `.${defaultExt}`;
    clean = `${clean}${ext}`;
  }

  return clean;
}

/**
 * Resolves relative LaTeX path against base directory of containing file.
 * Handles "../" parent traversal, subfolder scoping, and extension normalization.
 * E.g. baseDir="sections", target="../main.tex" -> "main.tex"
 *      baseDir="sections", target="intro" -> "sections/intro.tex"
 */
export function resolveRelativeLatexPath(
  baseDir: string,
  targetPath: string,
  defaultExt: string = '.tex',
): string {
  if (!targetPath) return '';
  let cleanTarget = targetPath.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');

  while (cleanTarget.startsWith('./')) {
    cleanTarget = cleanTarget.slice(2);
  }

  // Root-relative path
  if (cleanTarget.startsWith('/')) {
    return normalizeLatexPath(cleanTarget.slice(1), defaultExt);
  }

  if (!baseDir || baseDir === '.' || baseDir === '/') {
    return normalizeLatexPath(cleanTarget, defaultExt);
  }

  const combined = `${baseDir}/${cleanTarget}`;
  const parts = combined.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      }
    } else {
      resolved.push(part);
    }
  }

  return normalizeLatexPath(resolved.join('/'), defaultExt);
}

/**
 * Strips comments from LaTeX source text to prevent false positive include parsing.
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
 * Directives parser: extracts include targets, bibliography files, and document class info from a LaTeX file.
 * Automatically resolves relative targets against the file's containing directory.
 */
export function parseLatexDirectives(
  content: string,
  currentFilePath?: string,
): {
  hasDocumentClass: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includedFiles: string[];
} {
  const cleanSource = stripLatexComments(content);

  // Derive directory containing current file (e.g. "sections" from "sections/intro.tex")
  const normCurrent = currentFilePath ? normalizeLatexPath(currentFilePath) : '';
  const lastSlash = normCurrent.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? normCurrent.slice(0, lastSlash) : '';

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
      // Resolve subfile parent relative to baseDir (e.g. sections/ + ../main.tex -> main.tex)
      subfileParentPath = resolveRelativeLatexPath(baseDir, opt);
    }
  }

  const includedFilesSet = new Set<string>();

  // 2. \input{...} and \include{...}
  const inputIncludeRegex = /\\(?:input|include)\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = inputIncludeRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const rootPath = normalizeLatexPath(rawTarget);
      includedFilesSet.add(rootPath);
      if (baseDir) {
        const relPath = resolveRelativeLatexPath(baseDir, rawTarget);
        if (relPath) includedFilesSet.add(relPath);
      }
    }
  }

  // 3. \subfile{...}
  const subfileRegex = /\\subfile\{([^}]+)\}/g;
  while ((m = subfileRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const rootPath = normalizeLatexPath(rawTarget);
      includedFilesSet.add(rootPath);
      if (baseDir) {
        const relPath = resolveRelativeLatexPath(baseDir, rawTarget);
        if (relPath) includedFilesSet.add(relPath);
      }
    }
  }

  // 4. \import{path}{filename} or \subimport{path}{filename}
  const importRegex = /\\(?:sub)?import\{([^}]+)\}\{([^}]+)\}/g;
  while ((m = importRegex.exec(cleanSource)) !== null) {
    const dir = m[1]?.trim() || '';
    const file = m[2]?.trim() || '';
    if (file) {
      const combined = dir ? `${dir.replace(/\/+$/, '')}/${file}` : file;
      includedFilesSet.add(resolveRelativeLatexPath(baseDir, combined));
    }
  }

  // 5. \inputminted{lang}{filename}
  const mintedRegex = /\\inputminted(?:\[[^\]]*\])?\{[^}]+\}\{([^}]+)\}/g;
  while ((m = mintedRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      includedFilesSet.add(resolveRelativeLatexPath(baseDir, rawTarget));
    }
  }

  // 6. \bibliography{file1,file2} (comma-separated, .bib extension)
  const bibRegex = /\\bibliography\{([^}]+)\}/g;
  while ((m = bibRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const entries = rawTarget.split(',').map((s) => s.trim()).filter(Boolean);
      for (const entry of entries) {
        const bibFile = entry.endsWith('.bib') ? entry : `${entry}.bib`;
        includedFilesSet.add(normalizeLatexPath(bibFile, '.bib'));
        if (baseDir) {
          includedFilesSet.add(resolveRelativeLatexPath(baseDir, bibFile, '.bib'));
        }
      }
    }
  }

  // 7. \addbibresource[options]{file.bib}
  const biblatexRegex = /\\addbibresource(?:\[[^\]]*\])?\{([^}]+)\}/g;
  while ((m = biblatexRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const bibFile = rawTarget.endsWith('.bib') ? rawTarget : `${rawTarget}.bib`;
      includedFilesSet.add(normalizeLatexPath(bibFile, '.bib'));
      if (baseDir) {
        includedFilesSet.add(resolveRelativeLatexPath(baseDir, bibFile, '.bib'));
      }
    }
  }

  // 8. \includepdf[options]{file.pdf}
  const includePdfRegex = /\\includepdf(?:\[[^\]]*\])?\{([^}]+)\}/g;
  while ((m = includePdfRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const pdfFile = rawTarget.endsWith('.pdf') ? rawTarget : `${rawTarget}.pdf`;
      includedFilesSet.add(normalizeLatexPath(pdfFile, '.pdf'));
      if (baseDir) {
        includedFilesSet.add(resolveRelativeLatexPath(baseDir, pdfFile, '.pdf'));
      }
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
export class LatexDagEngine {
  private nodes = new Map<string, LatexDependencyNode>();
  private forwardEdges = new Map<string, Set<string>>();
  private reverseEdges = new Map<string, Set<string>>();
  private pathToIdMap = new Map<string, string>();
  private idToPathMap = new Map<string, string>();

  public clear(): void {
    this.nodes.clear();
    this.forwardEdges.clear();
    this.reverseEdges.clear();
    this.pathToIdMap.clear();
    this.idToPathMap.clear();
  }

  public updateFileNode(fileId: string, filePath: string, content: string): void {
    const normalizedPath = normalizeLatexPath(filePath || fileId);
    this.pathToIdMap.set(normalizedPath, fileId);
    this.idToPathMap.set(fileId, normalizedPath);

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

    const parsed = parseLatexDirectives(content, filePath || normalizedPath);

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
   * Safe registration helper invoked by Session and Workspace coordinators
   */
  public parseAndRegister(filePath: string, content: string, fileId?: string): void {
    const normalized = normalizeLatexPath(filePath);
    const effectiveId = fileId || this.pathToIdMap.get(normalized) || filePath;
    this.updateFileNode(effectiveId, filePath, content);
  }

  /**
   * Safely removes a file and cascades graph unlinking
   */
  public removeFileNode(fileIdOrPath: string): void {
    const normalized = this.resolveNormalizedPath(fileIdOrPath) || normalizeLatexPath(fileIdOrPath);
    const fileId = this.pathToIdMap.get(normalized) || fileIdOrPath;

    const targets = this.forwardEdges.get(normalized) || new Set();
    for (const target of targets) {
      const rev = this.reverseEdges.get(target);
      if (rev) {
        rev.delete(normalized);
      }
      const targetNode = this.nodes.get(target);
      if (targetNode) {
        targetNode.inDegree = Math.max(0, targetNode.inDegree - 1);
      }
    }
    this.forwardEdges.delete(normalized);

    const parents = this.reverseEdges.get(normalized) || new Set();
    for (const p of parents) {
      const fwd = this.forwardEdges.get(p);
      if (fwd) {
        fwd.delete(normalized);
      }
      const pNode = this.nodes.get(p);
      if (pNode) {
        pNode.outDegree = Math.max(0, pNode.outDegree - 1);
      }
    }
    this.reverseEdges.delete(normalized);

    this.nodes.delete(normalized);
    this.pathToIdMap.delete(normalized);
    if (fileId) {
      this.idToPathMap.delete(fileId);
    }
  }

  public getNode(fileIdOrPath: string): LatexDependencyNode | undefined {
    const normalized = this.resolveNormalizedPath(fileIdOrPath);
    return normalized ? this.nodes.get(normalized) : undefined;
  }


  public buildFromProjectFiles(
    files: Array<{ id: string; title: string; path?: string; content?: string }>
  ): DependencyGraphAnalysis {
    this.clear();

    for (const f of files) {
      const path = f.path || f.title || f.id;
      if (path.endsWith('.tex') || path.endsWith('.bib') || !path.includes('.')) {
        this.updateFileNode(f.id, path, f.content || '');
      }
    }

    return this.analyze();
  }

  public detectCycles(): string[][] {
    const visited = new Map<string, number>();
    const parentMap = new Map<string, string | null>();
    const cycles: string[][] = [];

    const dfs = (node: string, pathStack: string[]) => {
      visited.set(node, 1);
      pathStack.push(node);

      const neighbors = this.forwardEdges.get(node) || new Set();
      for (const neighbor of neighbors) {
        const state = visited.get(neighbor) ?? 0;
        if (state === 1) {
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
      for (const [path, node] of this.nodes) {
        if (path === normalizedExplicit || path.endsWith(`/${normalizedExplicit}`)) {
          return {
            rootPath: node.path,
            rootFileId: node.id,
            inferredBy: 'explicit',
            hasCycleWarning,
          };
        }
      }
      // Explicit setting takes top precedence
      return {
        rootPath: normalizedExplicit,
        rootFileId: this.pathToIdMap.get(normalizedExplicit),
        inferredBy: 'explicit',
        hasCycleWarning,
      };
    }

    const normalizedActive = activeFileIdOrPath ? this.resolveNormalizedPath(activeFileIdOrPath) : null;
    const activeNode = normalizedActive ? this.nodes.get(normalizedActive) : null;

    if (activeNode && activeNode.hasDocumentClass && !activeNode.isSubfile && activeNode.inDegree === 0) {
      return {
        rootPath: activeNode.path,
        rootFileId: activeNode.id,
        inferredBy: 'active-standalone',
        hasCycleWarning,
      };
    }

    if (activeNode && activeNode.isSubfile && activeNode.subfileParentPath) {
      const parentNorm = normalizeLatexPath(activeNode.subfileParentPath);
      const resolvedParent = this.resolveNormalizedPath(parentNorm) || parentNorm;
      if (this.nodes.has(resolvedParent)) {
        return {
          rootPath: resolvedParent,
          rootFileId: this.pathToIdMap.get(resolvedParent),
          inferredBy: 'subfile',
          hasCycleWarning,
        };
      }
    }

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
          score += 20;
        }

        score += node.outDegree * 2;

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

    const fallbackPath = 'main.tex';
    return {
      rootPath: fallbackPath,
      rootFileId: this.pathToIdMap.get(fallbackPath),
      inferredBy: 'fallback',
      hasCycleWarning,
    };
  }

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

  public resolveNormalizedPath(idOrPath: string): string | null {
    if (!idOrPath) return null;
    if (this.nodes.has(idOrPath)) return idOrPath;
    const normalized = normalizeLatexPath(idOrPath);
    if (this.nodes.has(normalized)) return normalized;
    if (this.idToPathMap.has(idOrPath)) return this.idToPathMap.get(idOrPath)!;

    for (const [path] of this.nodes) {
      if (
        path === idOrPath ||
        path === normalized ||
        path.endsWith(`/${idOrPath}`) ||
        path.endsWith(`/${normalized}`) ||
        idOrPath.endsWith(`/${path}`) ||
        normalized.endsWith(`/${path}`)
      ) {
        return path;
      }
    }

    return null;
  }
}


export const latexDagEngine = new LatexDagEngine();
// Alias for backward compatibility
export const latexDependencyGraph = latexDagEngine;
