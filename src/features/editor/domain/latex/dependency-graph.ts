/**
 * dependency-graph.ts
 *
 * LaTeX Include Dependency Graph & DAG Resolver (Domain Layer).
 *
 * Capabilities:
 * - Static analysis of LaTeX include directives (\input, \include, \subfile, \import, \bibliography).
 * - Directed Graph G = (V, E) representation with forward and reverse adjacency lists.
 * - Cycle Detection via DFS 3-Coloring in O(V + E).
 * - Root Document Inference (explicit, standalone, subfiles, DAG backtracking, heuristic).
 * - Incremental node updates O(k) and Affected Ancestor calculation.
 */

export interface LatexDependencyNode {
  id: string;
  path: string;
  title: string;
  hasDocumentClass: boolean;
  hasBeginDocument?: boolean;
  isSubfile: boolean;
  subfileParentPath: string | null;
  includes: string[];
  inDegree: number;
  outDegree: number;
}

export interface InferRootOptions {
  subfileStandalone?: boolean;
}

export interface DependencyGraphAnalysis {
  nodes: Map<string, LatexDependencyNode>;
  cycles: string[][];
  hasCycle: boolean;
  rootCandidates: string[];
}

const SURROUNDING_QUOTES_REGEX = /^["']|["']$/g;
const BACKSLASH_REGEX = /\\/g;
const MULTI_SLASH_REGEX = /\/+/g;
const COMPILE_DIR_PREFIX_REGEX = /^.*\/compiles\/[0-9a-zA-Z_-]+(?:-[0-9a-zA-Z_-]+)?\/(?:\.\/)?/;
const SIMPLE_COMPILE_PREFIX_REGEX = /^\/?compile\//;
const DOC_CLASS_REGEX = /\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/;
const BEGIN_DOC_REGEX = /\\begin\s*\{document\}/;
const BRACED_INCLUDE_REGEX = /\\(?:input|include|subfile)\s*\{([^}]+)\}/g;
const BRACELESS_INPUT_REGEX = /\\input(?![a-zA-Z@])[ \t]*(?:\r?\n[ \t]*)?([^\s%\\{}]+)/g;
const IMPORT_DIRECTIVE_REGEX = /\\(?:sub)?import\s*\{([^}]+)\}\s*\{([^}]+)\}/g;
const MINTED_DIRECTIVE_REGEX = /\\inputminted\s*(?:\[[^\]]*\])?\s*\{[^}]+\}\s*\{([^}]+)\}/g;
const BIB_DIRECTIVE_REGEX = /\\(?:bibliography|addbibresource)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
const INCLUDE_PDF_REGEX = /\\includepdf\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
const PREAMBLE_FILENAME_REGEX = /preamble|macros?\.tex|settings\.tex|setup\.tex|config\.tex/i;
const COMMON_ROOT_FILENAME_REGEX = /^(thesis|paper|document|index|root)\.tex$/;

export function normalizeLatexPath(rawPath: string, defaultExt = '.tex'): string {
  if (!rawPath) return '';
  let clean = rawPath
    .trim()
    .replace(SURROUNDING_QUOTES_REGEX, '')
    .replace(BACKSLASH_REGEX, '/')
    .replace(MULTI_SLASH_REGEX, '/')
    .replace(COMPILE_DIR_PREFIX_REGEX, '')
    .replace(SIMPLE_COMPILE_PREFIX_REGEX, '');
  while (clean.startsWith('./')) clean = clean.slice(2);
  while (clean.startsWith('/')) clean = clean.slice(1);
  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  if (!filename.includes('.')) {
    const ext = defaultExt.startsWith('.') ? defaultExt : `.${defaultExt}`;
    clean = `${clean}${ext}`;
  }
  return clean;
}

export function resolveRelativeLatexPath(baseDir: string, targetPath: string, defaultExt = '.tex'): string {
  if (!targetPath) return '';
  let cleanTarget = targetPath.trim().replace(SURROUNDING_QUOTES_REGEX, '').replace(BACKSLASH_REGEX, '/');
  while (cleanTarget.startsWith('./')) cleanTarget = cleanTarget.slice(2);
  if (cleanTarget.startsWith('/')) return normalizeLatexPath(cleanTarget.slice(1), defaultExt);
  if (!baseDir || baseDir === '.' || baseDir === '/') return normalizeLatexPath(cleanTarget, defaultExt);

  const resolved: string[] = [];
  for (const part of `${baseDir}/${cleanTarget}`.split('/').filter(Boolean)) {
    if (part === '.') continue;
    if (part === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return normalizeLatexPath(resolved.join('/'), defaultExt);
}

export function stripLatexComments(source: string): string {
  if (!source) return '';
  if (!source.includes('%')) return source;
  return source
    .split('\n')
    .map((line) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '%') {
          let bs = 0;
          for (let b = c - 1; b >= 0 && line.charCodeAt(b) === 92; b--) bs++;
          if (bs % 2 === 0) return line.slice(0, c);
        }
      }
      return line;
    })
    .join('\n');
}

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
  const normCurrent = currentFilePath ? normalizeLatexPath(currentFilePath) : '';
  const lastSlash = normCurrent.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? normCurrent.slice(0, lastSlash) : '';

  const docClassMatch = cleanSource.match(DOC_CLASS_REGEX);
  const hasDocumentClass = Boolean(docClassMatch);
  const opt = docClassMatch?.[1]?.trim() || '';
  const cls = docClassMatch?.[2]?.trim() || '';
  const isSubfile = hasDocumentClass && cls === 'subfiles' && Boolean(opt);
  const subfileParentPath = isSubfile ? resolveRelativeLatexPath(baseDir, opt) : null;
  const hasBeginDocument = BEGIN_DOC_REGEX.test(cleanSource);

  const includedFilesSet = new Set<string>();
  const includeGroups: string[][] = [];

  const registerTarget = (rawTarget: string, ext = '.tex') => {
    if (!rawTarget) return;
    const group: string[] = [];
    const rootPath = normalizeLatexPath(rawTarget, ext);
    if (rootPath) group.push(rootPath);
    if (baseDir) {
      const relPath = resolveRelativeLatexPath(baseDir, rawTarget, ext);
      if (relPath && relPath !== rootPath) group.push(relPath);
    }
    if (group.length > 0) {
      for (const p of group) includedFilesSet.add(p);
      includeGroups.push(group);
    }
  };
  const registerExact = (path: string) => {
    if (path) {
      includedFilesSet.add(path);
      includeGroups.push([path]);
    }
  };

  let m: RegExpExecArray | null;
  BRACED_INCLUDE_REGEX.lastIndex = 0;
  while ((m = BRACED_INCLUDE_REGEX.exec(cleanSource)) !== null) {
    if (m[1]?.trim()) registerTarget(m[1].trim());
  }

  BRACELESS_INPUT_REGEX.lastIndex = 0;
  while ((m = BRACELESS_INPUT_REGEX.exec(cleanSource)) !== null) {
    let bs = 0;
    for (let k = m.index - 1; k >= 0 && cleanSource[k] === '\\'; k--) bs++;
    if (bs % 2 === 0 && m[1]?.trim()) registerTarget(m[1].trim());
  }

  IMPORT_DIRECTIVE_REGEX.lastIndex = 0;
  while ((m = IMPORT_DIRECTIVE_REGEX.exec(cleanSource)) !== null) {
    const dir = m[1]?.trim() || '';
    const file = m[2]?.trim() || '';
    if (file) registerExact(resolveRelativeLatexPath(baseDir, dir ? `${dir.replace(/\/+$/, '')}/${file}` : file));
  }

  MINTED_DIRECTIVE_REGEX.lastIndex = 0;
  while ((m = MINTED_DIRECTIVE_REGEX.exec(cleanSource)) !== null) {
    if (m[1]?.trim()) registerExact(resolveRelativeLatexPath(baseDir, m[1].trim()));
  }

  BIB_DIRECTIVE_REGEX.lastIndex = 0;
  while ((m = BIB_DIRECTIVE_REGEX.exec(cleanSource)) !== null) {
    for (const entry of (m[1] || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      registerTarget(entry.endsWith('.bib') ? entry : `${entry}.bib`, '.bib');
    }
  }

  INCLUDE_PDF_REGEX.lastIndex = 0;
  while ((m = INCLUDE_PDF_REGEX.exec(cleanSource)) !== null) {
    const raw = m[1]?.trim();
    if (raw) registerTarget(raw.endsWith('.pdf') ? raw : `${raw}.pdf`, '.pdf');
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

export class LatexDependencyGraph {
  private nodes = new Map<string, LatexDependencyNode>();
  private forwardEdges = new Map<string, Set<string>>();
  private reverseEdges = new Map<string, Set<string>>();
  private pathToIdMap = new Map<string, string>();
  private idToPathMap = new Map<string, string>();
  private includeGroups = new Map<string, string[][]>();
  private serverRootDocPath: string | null = null;
  private serverRootFileId: string | null = null;

  public setServerRootDoc(rootDocPath: string | null, rootFileId?: string | null): void {
    this.serverRootDocPath = rootDocPath ? normalizeLatexPath(rootDocPath) : null;
    this.serverRootFileId = rootFileId ?? null;
  }

  public getServerRootDoc(): { rootDocPath: string | null; rootFileId: string | null } {
    return { rootDocPath: this.serverRootDocPath, rootFileId: this.serverRootFileId };
  }

  public clear(): void {
    this.nodes.clear();
    this.forwardEdges.clear();
    this.reverseEdges.clear();
    this.pathToIdMap.clear();
    this.idToPathMap.clear();
    this.includeGroups.clear();
    this.serverRootDocPath = null;
    this.serverRootFileId = null;
  }

  private resolveGroup(group: string[]): string {
    for (const candidate of group) {
      if (this.nodes.has(candidate)) return candidate;
    }
    return group[0];
  }

  private relinkNode(sourcePath: string): void {
    for (const target of this.forwardEdges.get(sourcePath) || []) {
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

  private relinkDependentsOf(path: string): void {
    for (const [source, groups] of this.includeGroups) {
      if (source !== path && groups.some((g) => g.includes(path))) this.relinkNode(source);
    }
  }

  public updateFileNode(fileId: string, filePath: string, content: string): void {
    const normalizedPath = normalizeLatexPath(filePath || fileId);
    this.pathToIdMap.set(normalizedPath, fileId);
    this.idToPathMap.set(fileId, normalizedPath);
    const isNew = !this.nodes.has(normalizedPath);
    const parsed = parseLatexDirectives(content, filePath || normalizedPath);

    this.nodes.set(normalizedPath, {
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
    });
    this.includeGroups.set(normalizedPath, parsed.includeGroups);
    this.relinkNode(normalizedPath);
    if (isNew) this.relinkDependentsOf(normalizedPath);
  }

  public parseAndRegister(filePath: string, content: string, fileId?: string): void {
    const normalized = normalizeLatexPath(filePath);
    const effectiveId = fileId || this.pathToIdMap.get(normalized) || filePath;
    this.updateFileNode(effectiveId, filePath, content);
  }

  public removeFileNode(fileIdOrPath: string): void {
    const normalized = this.resolveNormalizedPath(fileIdOrPath) || normalizeLatexPath(fileIdOrPath);
    const fileId = this.pathToIdMap.get(normalized) || fileIdOrPath;
    this.includeGroups.delete(normalized);
    this.relinkNode(normalized);
    this.nodes.delete(normalized);
    this.pathToIdMap.delete(normalized);
    if (fileId) this.idToPathMap.delete(fileId);
    this.relinkDependentsOf(normalized);
  }

  public getNode(fileIdOrPath: string): LatexDependencyNode | undefined {
    const normalized = this.resolveNormalizedPath(fileIdOrPath);
    return normalized ? this.nodes.get(normalized) : undefined;
  }

  public buildFromProjectFiles(
    files: Array<{ id: string; title: string; path?: string; content?: string }>,
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
    const cycles: string[][] = [];
    const dfs = (node: string, stack: string[]) => {
      visited.set(node, 1);
      stack.push(node);
      for (const neighbor of this.forwardEdges.get(node) || []) {
        const state = visited.get(neighbor) ?? 0;
        if (state === 1) {
          const idx = stack.indexOf(neighbor);
          if (idx >= 0) cycles.push(stack.slice(idx).concat(neighbor));
        } else if (state === 0) {
          dfs(neighbor, stack);
        }
      }
      stack.pop();
      visited.set(node, 2);
    };
    for (const nodeKey of this.nodes.keys()) {
      if ((visited.get(nodeKey) ?? 0) === 0) dfs(nodeKey, []);
    }
    return cycles;
  }

  public getAffectedAncestors(fileIdOrPath: string): Set<string> {
    const startNode = this.resolveNormalizedPath(fileIdOrPath);
    const affected = new Set<string>();
    if (!startNode) return affected;
    const queue = [startNode];
    const visited = new Set<string>([startNode]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const p of this.reverseEdges.get(current) || []) {
        if (!visited.has(p)) {
          visited.add(p);
          affected.add(p);
          queue.push(p);
        }
      }
    }
    return affected;
  }

  public resolveSubfileParent(node: LatexDependencyNode): LatexDependencyNode | null {
    let current = node;
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

  private isPreambleLike(node: LatexDependencyNode): boolean {
    if (PREAMBLE_FILENAME_REGEX.test(node.path)) return true;
    if (node.hasDocumentClass && !node.hasBeginDocument && node.inDegree > 0) {
      for (const p of this.reverseEdges.get(node.path) || []) {
        if (this.nodes.get(p)?.hasBeginDocument) return true;
      }
    }
    return false;
  }

  private includesDocClassPreamble(node: LatexDependencyNode): boolean {
    if (!node.hasBeginDocument || node.hasDocumentClass) return false;
    for (const target of this.forwardEdges.get(node.path) || []) {
      const t = this.nodes.get(target);
      if (t && t.hasDocumentClass && !t.hasBeginDocument) return true;
    }
    return false;
  }

  private scoreAncestorRootCandidate(node: LatexDependencyNode): number {
    return (
      (this.includesDocClassPreamble(node) ? 60 : 0) +
      (node.hasBeginDocument ? 100 : 0) -
      (this.isPreambleLike(node) ? 150 : 0) -
      node.inDegree * 10 +
      node.outDegree * 2
    );
  }

  private scoreHeuristicRootCandidate(path: string, node: LatexDependencyNode): number {
    let score =
      50 +
      (node.inDegree === 0 ? 30 : 0) +
      (node.hasBeginDocument ? 80 : 0) +
      (node.hasDocumentClass ? 40 : 0) +
      (this.includesDocClassPreamble(node) ? 60 : 0);
    const baseName = path.toLowerCase();
    if (baseName === 'main.tex') score += 100;
    else if (COMMON_ROOT_FILENAME_REGEX.test(baseName)) score += 70;
    if (!path.includes('/')) score += 20;
    score += node.outDegree * 2;
    if (this.isPreambleLike(node) && (!node.hasBeginDocument || node.inDegree > 0)) score -= 150;
    return score;
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
    const hasCycleWarning = this.detectCycles().length > 0;
    if (explicitMainFile) {
      const normalizedExplicit = normalizeLatexPath(explicitMainFile);
      if (this.nodes.has(normalizedExplicit)) {
        return { rootPath: normalizedExplicit, rootFileId: this.pathToIdMap.get(normalizedExplicit), inferredBy: 'explicit', hasCycleWarning };
      }
      for (const [path, node] of this.nodes) {
        if (path === normalizedExplicit || path.endsWith(`/${normalizedExplicit}`)) {
          return { rootPath: node.path, rootFileId: node.id, inferredBy: 'explicit', hasCycleWarning };
        }
      }
      return { rootPath: normalizedExplicit, rootFileId: this.pathToIdMap.get(normalizedExplicit), inferredBy: 'explicit', hasCycleWarning };
    }

    const normalizedActive = activeFileIdOrPath ? this.resolveNormalizedPath(activeFileIdOrPath) : null;
    const activeNode = normalizedActive ? this.nodes.get(normalizedActive) : null;
    const isBibActive = Boolean(normalizedActive?.endsWith('.bib') || activeFileIdOrPath?.endsWith('.bib'));

    if (!isBibActive && activeNode && activeNode.hasDocumentClass && !activeNode.isSubfile && activeNode.inDegree === 0) {
      return { rootPath: activeNode.path, rootFileId: activeNode.id, inferredBy: 'active-standalone', hasCycleWarning };
    }

    if (!isBibActive && activeNode && activeNode.isSubfile) {
      if (!options.subfileStandalone) {
        const parent = this.resolveSubfileParent(activeNode);
        if (parent) return { rootPath: parent.path, rootFileId: parent.id, inferredBy: 'subfile-parent', hasCycleWarning };
      }
      return { rootPath: activeNode.path, rootFileId: activeNode.id, inferredBy: 'subfile', hasCycleWarning };
    }

    if (normalizedActive) {
      const rootAncestors = Array.from(this.getAffectedAncestors(normalizedActive))
        .map((p) => this.nodes.get(p))
        .filter((n): n is LatexDependencyNode => Boolean(n && !n.path.endsWith('.bib') && (n.hasDocumentClass || n.hasBeginDocument)));
      if (rootAncestors.length > 0) {
        rootAncestors.sort((a, b) => this.scoreAncestorRootCandidate(b) - this.scoreAncestorRootCandidate(a));
        const best = rootAncestors[0];
        return { rootPath: best.path, rootFileId: best.id || this.pathToIdMap.get(best.path), inferredBy: 'dag-backtracking', hasCycleWarning };
      }
    }

    let bestCandidate: LatexDependencyNode | null = null;
    let bestScore = -Infinity;
    for (const [path, node] of this.nodes) {
      if (path.endsWith('.bib') || node.isSubfile) continue;
      if (!(node.hasDocumentClass || node.hasBeginDocument || (node.inDegree === 0 && node.outDegree > 0))) continue;
      const score = this.scoreHeuristicRootCandidate(path, node);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = node;
      }
    }

    if (bestCandidate) {
      return { rootPath: bestCandidate.path, rootFileId: bestCandidate.id || this.pathToIdMap.get(bestCandidate.path), inferredBy: 'heuristic', hasCycleWarning };
    }

    if (this.serverRootDocPath) {
      return { rootPath: this.serverRootDocPath, rootFileId: this.serverRootFileId || this.pathToIdMap.get(this.serverRootDocPath), inferredBy: 'explicit', hasCycleWarning };
    }
    return { rootPath: 'main.tex', rootFileId: this.pathToIdMap.get('main.tex'), inferredBy: 'fallback', hasCycleWarning };
  }

  public analyze(): DependencyGraphAnalysis {
    const cycles = this.detectCycles();
    const rootCandidates: string[] = [];
    for (const [path, node] of this.nodes) {
      if ((node.hasDocumentClass || node.hasBeginDocument) && !node.isSubfile && node.inDegree === 0 && !this.isPreambleLike(node)) {
        rootCandidates.push(path);
      }
    }
    return { nodes: new Map(this.nodes), cycles, hasCycle: cycles.length > 0, rootCandidates };
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

export { LatexDependencyGraph as LatexDagEngine };
export const latexDependencyGraph = new LatexDependencyGraph();
export { latexDependencyGraph as latexDagEngine };
