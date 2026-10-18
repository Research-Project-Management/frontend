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
  hasBeginDocument?: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includes: string[]; // List of target normalized paths included by this file
  inDegree: number;
  outDegree: number;
}

export interface InferRootOptions {
  /** Compile a subfiles child on its own instead of via its parent (default false). */
  subfileStandalone?: boolean;
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
  let clean = rawPath
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');

  // Official Overleaf `normalizeFilePath` (`services/web/frontend/js/features/pdf-preview/util/output-files.ts`):
  // Strip CLSI container build paths: `/var/lib/.../compiles/<objectId>(-<objectId>)?/(./)?` and `/compile/`
  clean = clean.replace(
    /^.*\/compiles\/[0-9a-zA-Z_-]+(?:-[0-9a-zA-Z_-]+)?\/(?:\.\/)?/,
    '',
  );
  clean = clean.replace(/^\/?compile\//, '');

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
      if (line[c] === '%') {
        // Count consecutive backslashes preceding % to distinguish \% from \\%
        let backslashCount = 0;
        let b = c - 1;
        while (b >= 0 && line.charCodeAt(b) === 92 /* '\' */) {
          backslashCount++;
          b--;
        }
        if (backslashCount % 2 === 0) {
          commentIdx = c;
          break;
        }
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
  hasBeginDocument: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includedFiles: string[];
  includeGroups: string[][];
} {
  const cleanSource = stripLatexComments(content);

  // Derive directory containing current file (e.g. "sections" from "sections/intro.tex")
  const normCurrent = currentFilePath ? normalizeLatexPath(currentFilePath) : '';
  const lastSlash = normCurrent.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? normCurrent.slice(0, lastSlash) : '';

  // 1. Check \documentclass
  const docClassMatch = cleanSource.match(/\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/);
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

  // Check \begin{document}
  const hasBeginDocument = /\\begin\s*\{document\}/.test(cleanSource);

  const includedFilesSet = new Set<string>();
  // Each include yields an ordered list of candidate paths (root-relative first, then
  // relative to the including file). The engine resolves each group to ONE target.
  const includeGroups: string[][] = [];

  const registerTarget = (rawTarget: string, ext: string = '.tex') => {
    if (!rawTarget) return;
    const group: string[] = [];
    const rootPath = normalizeLatexPath(rawTarget, ext);
    if (rootPath) group.push(rootPath);
    if (baseDir) {
      const relPath = resolveRelativeLatexPath(baseDir, rawTarget, ext);
      if (relPath && relPath !== rootPath) group.push(relPath);
    }
    if (group.length === 0) return;
    for (const p of group) includedFilesSet.add(p);
    includeGroups.push(group);
  };
  const registerExact = (path: string) => {
    if (!path) return;
    includedFilesSet.add(path);
    includeGroups.push([path]);
  };

  // 2. \input{...} and \include{...} with optional whitespace/newlines before '{'
  const bracedInputIncludeRegex = /\\(?:input|include)\s*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = bracedInputIncludeRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) registerTarget(rawTarget);
  }

  // 2b. TeX primitive braceless \input filename (e.g. \input macro.tex or \input preamble)
  // Must be separated by whitespace, not starting with \ or { or %. A preceding `\\`
  // (line break) is allowed: only an odd run of backslashes escapes the command.
  const bracelessInputRegex = /\\input(?![a-zA-Z@])[ \t]*(?:\r?\n[ \t]*)?([^\s%\\{}]+)/g;
  while ((m = bracelessInputRegex.exec(cleanSource)) !== null) {
    let bs = 0;
    for (let k = m.index - 1; k >= 0 && cleanSource[k] === '\\'; k--) bs++;
    if (bs % 2 === 1) continue;
    const rawTarget = m[1]?.trim();
    if (rawTarget) registerTarget(rawTarget);
  }

  // 3. \subfile{...}
  const subfileRegex = /\\subfile\s*\{([^}]+)\}/g;
  while ((m = subfileRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) registerTarget(rawTarget);
  }

  // 4. \import{path}{filename} or \subimport{path}{filename}
  const importRegex = /\\(?:sub)?import\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
  while ((m = importRegex.exec(cleanSource)) !== null) {
    const dir = m[1]?.trim() || '';
    const file = m[2]?.trim() || '';
    if (file) {
      const combined = dir ? `${dir.replace(/\/+$/, '')}/${file}` : file;
      registerExact(resolveRelativeLatexPath(baseDir, combined));
    }
  }

  // 5. \inputminted{lang}{filename}
  const mintedRegex = /\\inputminted\s*(?:\[[^\]]*\])?\s*\{[^}]+\}\s*\{([^}]+)\}/g;
  while ((m = mintedRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      registerExact(resolveRelativeLatexPath(baseDir, rawTarget));
    }
  }

  // 6. \bibliography{file1,file2} (comma-separated, .bib extension)
  const bibRegex = /\\bibliography\s*\{([^}]+)\}/g;
  while ((m = bibRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const entries = rawTarget.split(',').map((s) => s.trim()).filter(Boolean);
      for (const entry of entries) {
        const bibFile = entry.endsWith('.bib') ? entry : `${entry}.bib`;
        registerTarget(bibFile, '.bib');
      }
    }
  }

  // 7. \addbibresource[options]{file.bib}
  const biblatexRegex = /\\addbibresource\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
  while ((m = biblatexRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const bibFile = rawTarget.endsWith('.bib') ? rawTarget : `${rawTarget}.bib`;
      registerTarget(bibFile, '.bib');
    }
  }

  // 8. \includepdf[options]{file.pdf}
  const includePdfRegex = /\\includepdf\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
  while ((m = includePdfRegex.exec(cleanSource)) !== null) {
    const rawTarget = m[1]?.trim();
    if (rawTarget) {
      const pdfFile = rawTarget.endsWith('.pdf') ? rawTarget : `${rawTarget}.pdf`;
      registerTarget(pdfFile, '.pdf');
    }
  }

  return {
    hasDocumentClass,
    hasBeginDocument,
    isSubfile,
    subfileParentPath,
    includedFiles: Array.from(includedFilesSet),
    includeGroups,
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
  /** Candidate groups per source node; each group resolves to exactly one edge target */
  private includeGroups = new Map<string, string[][]>();

  public clear(): void {
    this.nodes.clear();
    this.forwardEdges.clear();
    this.reverseEdges.clear();
    this.pathToIdMap.clear();
    this.idToPathMap.clear();
    this.includeGroups.clear();
  }

  /**
   * Picks one target per include: the first candidate that exists as a node (root-relative
   * first, matching TeX's cwd semantics), else the root-relative candidate. Prevents phantom
   * edges to non-existent alternates.
   */
  private resolveGroup(group: string[]): string {
    for (const candidate of group) {
      if (this.nodes.has(candidate)) return candidate;
    }
    return group[0];
  }

  /** Recomputes forward/reverse edges for a single source node from its include groups. */
  private relinkNode(sourcePath: string): void {
    const oldTargets = this.forwardEdges.get(sourcePath) || new Set<string>();
    for (const target of oldTargets) {
      const rev = this.reverseEdges.get(target);
      if (rev) {
        rev.delete(sourcePath);
        if (rev.size === 0) this.reverseEdges.delete(target);
      }
      const targetNode = this.nodes.get(target);
      if (targetNode) targetNode.inDegree = this.reverseEdges.get(target)?.size ?? 0;
    }

    const node = this.nodes.get(sourcePath);
    const groups = this.includeGroups.get(sourcePath);
    if (!node || !groups) {
      this.forwardEdges.delete(sourcePath);
      return;
    }

    const newTargets = new Set<string>();
    for (const group of groups) {
      if (group.length > 0) newTargets.add(this.resolveGroup(group));
    }
    this.forwardEdges.set(sourcePath, newTargets);
    node.includes = Array.from(newTargets);
    node.outDegree = newTargets.size;

    for (const target of newTargets) {
      let rev = this.reverseEdges.get(target);
      if (!rev) {
        rev = new Set();
        this.reverseEdges.set(target, rev);
      }
      rev.add(sourcePath);
      const targetNode = this.nodes.get(target);
      if (targetNode) targetNode.inDegree = rev.size;
    }
  }

  /** Relinks every other node that has `path` among its include candidates. */
  private relinkDependentsOf(path: string): void {
    for (const [source, groups] of this.includeGroups) {
      if (source === path) continue;
      if (groups.some((g) => g.includes(path))) this.relinkNode(source);
    }
  }

  public updateFileNode(fileId: string, filePath: string, content: string): void {
    const normalizedPath = normalizeLatexPath(filePath || fileId);
    this.pathToIdMap.set(normalizedPath, fileId);
    this.idToPathMap.set(fileId, normalizedPath);

    const isNew = !this.nodes.has(normalizedPath);
    const parsed = parseLatexDirectives(content, filePath || normalizedPath);

    const node: LatexDependencyNode = {
      id: fileId,
      path: normalizedPath,
      title: filePath,
      hasDocumentClass: parsed.hasDocumentClass,
      hasBeginDocument: parsed.hasBeginDocument,
      isSubfile: parsed.isSubfile,
      subfileParentPath: parsed.subfileParentPath,
      includes: [],
      inDegree: this.reverseEdges.get(normalizedPath)?.size ?? 0,
      outDegree: 0,
    };

    this.nodes.set(normalizedPath, node);
    this.includeGroups.set(normalizedPath, parsed.includeGroups);
    this.relinkNode(normalizedPath);

    // A newly created node may now be the preferred resolution for other files' includes
    if (isNew) this.relinkDependentsOf(normalizedPath);
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

    // Drop this node's outgoing edges
    this.includeGroups.delete(normalized);
    this.relinkNode(normalized);

    this.nodes.delete(normalized);
    this.pathToIdMap.delete(normalized);
    if (fileId) {
      this.idToPathMap.delete(fileId);
    }

    // Parents re-resolve (may fall back to an alternate candidate or a dangling target)
    this.relinkDependentsOf(normalized);
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

  /** Follows \documentclass[parent]{subfiles} chain to the top-most existing parent (cycle-safe). */
  public resolveSubfileParent(node: LatexDependencyNode): LatexDependencyNode | null {
    let current: LatexDependencyNode = node;
    let result: LatexDependencyNode | null = null;
    const seen = new Set<string>([node.path]);
    while (current.isSubfile && current.subfileParentPath) {
      const parentPath = this.resolveNormalizedPath(current.subfileParentPath);
      if (!parentPath || seen.has(parentPath)) break;
      const parent = this.nodes.get(parentPath);
      if (!parent) break;
      seen.add(parentPath);
      result = parent;
      current = parent;
    }
    return result;
  }

  /**
   * Preamble-like: matches common preamble filenames, or holds \documentclass without
   * \begin{document} while being \input by a file that has \begin{document}.
   */
  private isPreambleLike(node: LatexDependencyNode): boolean {
    if (/preamble|macros?\.tex|settings\.tex|setup\.tex|config\.tex/i.test(node.path)) return true;
    if (node.hasDocumentClass && !node.hasBeginDocument && node.inDegree > 0) {
      const parents = this.reverseEdges.get(node.path);
      if (parents) {
        for (const p of parents) {
          if (this.nodes.get(p)?.hasBeginDocument) return true;
        }
      }
    }
    return false;
  }

  /** True when node has \begin{document} and inputs a file providing \documentclass. */
  private includesDocClassPreamble(node: LatexDependencyNode): boolean {
    if (!node.hasBeginDocument || node.hasDocumentClass) return false;
    for (const target of this.forwardEdges.get(node.path) || []) {
      const t = this.nodes.get(target);
      if (t && t.hasDocumentClass && !t.hasBeginDocument) return true;
    }
    return false;
  }

  public inferRootDocument(
    activeFileIdOrPath?: string | null,
    explicitMainFile?: string | null,
    options: InferRootOptions = {},
  ): {
    rootPath: string;
    rootFileId?: string;
    inferredBy: 'explicit' | 'active-standalone' | 'subfile' | 'subfile-parent' | 'dag-backtracking' | 'heuristic' | 'fallback';
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
    const isBibActive = Boolean(
      (normalizedActive && normalizedActive.endsWith('.bib')) ||
      (activeFileIdOrPath && activeFileIdOrPath.endsWith('.bib'))
    );

    // Active standalone check: file has \documentclass and in-degree 0 (not a subfile, never a .bib)
    if (!isBibActive && activeNode && activeNode.hasDocumentClass && !activeNode.isSubfile && activeNode.inDegree === 0) {
      return {
        rootPath: activeNode.path,
        rootFileId: activeNode.id,
        inferredBy: 'active-standalone',
        hasCycleWarning,
      };
    }

    // Subfiles standalone compile: when a file has \documentclass[...]{subfiles}
    // and is compiled directly as the active document, resolve the file itself as root
    // Subfiles: by default compile via the parent document (\documentclass[parent]{subfiles}).
    // Pass { subfileStandalone: true } to compile the child on its own as root.
    if (!isBibActive && activeNode && activeNode.isSubfile) {
      if (!options.subfileStandalone) {
        const parent = this.resolveSubfileParent(activeNode);
        if (parent) {
          return {
            rootPath: parent.path,
            rootFileId: parent.id,
            inferredBy: 'subfile-parent',
            hasCycleWarning,
          };
        }
      }
      return {
        rootPath: activeNode.path,
        rootFileId: activeNode.id,
        inferredBy: 'subfile',
        hasCycleWarning,
      };
    }

    if (normalizedActive) {
      const ancestors = this.getAffectedAncestors(normalizedActive);
      const rootAncestors: LatexDependencyNode[] = [];

      for (const ancPath of ancestors) {
        const node = this.nodes.get(ancPath);
        if (node && !ancPath.endsWith('.bib') && (node.hasDocumentClass || node.hasBeginDocument)) {
          rootAncestors.push(node);
        }
      }

      if (rootAncestors.length > 0) {
        rootAncestors.sort((a, b) => {
          const aIsPreamble = this.isPreambleLike(a);
          const bIsPreamble = this.isPreambleLike(b);
          const aScore = (this.includesDocClassPreamble(a) ? 60 : 0) + (a.hasBeginDocument ? 100 : 0) - (aIsPreamble ? 150 : 0) - a.inDegree * 10 + a.outDegree * 2;
          const bScore = (this.includesDocClassPreamble(b) ? 60 : 0) + (b.hasBeginDocument ? 100 : 0) - (bIsPreamble ? 150 : 0) - b.inDegree * 10 + b.outDegree * 2;
          return bScore - aScore;
        });
        const bestAncestor = rootAncestors[0];
        return {
          rootPath: bestAncestor.path,
          rootFileId: bestAncestor.id || this.pathToIdMap.get(bestAncestor.path),
          inferredBy: 'dag-backtracking',
          hasCycleWarning,
        };
      }
    }

    const candidates: Array<{ node: LatexDependencyNode; score: number }> = [];

    for (const [path, node] of this.nodes) {
      const baseName = path.toLowerCase();
      const isPreambleFile = this.isPreambleLike(node);

      const isCandidate =
        !path.endsWith('.bib') &&
        (node.hasDocumentClass ||
         node.hasBeginDocument ||
         (node.inDegree === 0 && node.outDegree > 0));

      if (isCandidate && !node.isSubfile) {
        let score = 50;
        if (node.inDegree === 0) score += 30;
        if (node.hasBeginDocument) score += 80;
        if (node.hasDocumentClass) score += 40;
        // \begin{document} file whose \documentclass lives in an \input'ed preamble
        if (this.includesDocClassPreamble(node)) score += 60;

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

        // Preamble guard: heavily penalize preamble/macros/setup files that lack \begin{document} or are included
        if (isPreambleFile) {
          if (!node.hasBeginDocument || node.inDegree > 0) {
            score -= 150;
          }
        }

        candidates.push({ node, score });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0].node;
      return {
        rootPath: best.path,
        rootFileId: best.id || this.pathToIdMap.get(best.path),
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
      const isPreamble = this.isPreambleLike(node);
      const isLikelyRoot = (node.hasDocumentClass || node.hasBeginDocument) && !node.isSubfile;
      if (isLikelyRoot && node.inDegree === 0 && !isPreamble) {
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
