/**
 * latex-symbols-core.ts
 *
 * Pure In-Memory Symbol, Metadata & Structure Outline Engine (Domain Layer).
 * Location: `features/editor/domain/latex/latex-symbols-core.ts`
 *
 * Responsibilities:
 * - High-speed deterministic regex parsing of BibTeX (@article, @book, etc.) and LaTeX source files.
 * - Extracts `\label{...}`, `label={...}`, `\newcommand`, `\input`, `\include`.
 * - Extracts LaTeX document structure outline (\part, \chapter, \section, \subsection, etc.)
 *   and constructs an immutable hierarchical tree.
 * - Zero UI or DOM dependencies; fully portable between Web Worker and Main UI thread.
 * - Serializes and deserializes snapshot state for 0ms synchronous CodeMirror autocompletion & outline queries.
 */

export interface BibEntry {
  key: string;
  type: string; // 'article' | 'book' | 'inproceedings' | ...
  title?: string;
  author?: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  doi?: string;
  sourceFile: string;
  isRetracted?: boolean;
  retractionReason?: string;
  retractionNature?: string;
  retractionNoticeUrl?: string;
}

export interface LabelEntry {
  name: string;
  type: 'fig' | 'tab' | 'sec' | 'eq' | 'lst' | 'thm' | 'lem' | 'def' | 'prop' | 'cor' | 'alg' | 'app' | 'other';
  line: number;
  sourceFile: string;
}

export interface EnvironmentEntry {
  name: string;
  sourceFile: string;
  line: number;
}

export interface CommandEntry {
  name: string;
  argsCount: number;
  sourceFile: string;
}

export type SectionLevel =
  | 'book'
  | 'part'
  | 'chapter'
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'paragraph'
  | 'subparagraph'
  | 'figure'
  | 'table'
  | 'slide'
  | 'appendix'
  | 'abstract';

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
  type: SectionLevel;
  line: number;
  sourceFile: string;
  hasStar: boolean;
}

export interface OutlineNode extends OutlineItem {
  children: OutlineNode[];
}

export const SECTION_LEVEL_WEIGHT: Record<SectionLevel, number> = {
  book: 0,
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
  appendix: 2,
  abstract: 2,
  slide: 3,
  figure: 3,
  table: 3,
};

export function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: { node: OutlineNode; level: number }[] = [];

  for (const item of items) {
    const node: OutlineNode = { ...item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, level: item.level });
  }

  return root;
}

export interface SymbolSnapshot {
  citations: BibEntry[];
  labels: LabelEntry[];
  commands: CommandEntry[];
  environments: EnvironmentEntry[];
  includeFiles: string[];
  imageFiles?: string[];
  outlineByFile: Record<string, OutlineNode[]>;
  flatOutlineByFile: Record<string, OutlineItem[]>;
  projectOutline?: OutlineNode[];
  projectFlatOutline?: OutlineItem[];
  version: number;
}

export type SymbolsWorkerMessageIn =
  | { type: 'indexFile'; fileId: string; filePath: string; content: string; id: number }
  | { type: 'removeFile'; fileId: string; filePath?: string; id: number }
  | { type: 'clear'; id: number }
  | { type: 'getSnapshot'; id: number };

export interface SymbolsWorkerMessageOut {
  id: number;
  snapshot: SymbolSnapshot;
}

export class LatexSymbolsIndexCore {
  private bibEntries = new Map<string, Map<string, BibEntry>>(); // fileId -> (key -> BibEntry)
  private labelEntries = new Map<string, Map<string, LabelEntry>>(); // fileId -> (name -> LabelEntry)
  private commandEntries = new Map<string, Map<string, CommandEntry>>(); // fileId -> (name -> CommandEntry)
  private environmentEntries = new Map<string, Map<string, EnvironmentEntry>>(); // fileId -> (name -> EnvironmentEntry)
  private outlineEntries = new Map<string, OutlineItem[]>(); // fileId -> OutlineItem[]
  private includeEntries = new Map<string, Array<{ path: string; line: number }>>(); // fileId -> includes
  private filePaths = new Map<string, string>(); // fileId -> normalized filePath
  private knownFiles = new Set<string>(); // List of known project file paths
  private version = 0;

  /**
   * Indexes or updates a file based on its extension
   */
  public indexFile(fileId: string, filePath: string, content: string): void {
    const normPath = filePath.replace(/\\/g, '/');
    this.knownFiles.add(normPath);
    this.filePaths.set(fileId, normPath);

    if (normPath.endsWith('.bib')) {
      this.indexBibContent(fileId, normPath, content);
    } else if (normPath.endsWith('.tex') || normPath.endsWith('.ltx') || normPath.endsWith('.sty')) {
      this.indexTexContent(fileId, normPath, content);
    }
    this.version++;
  }

  /**
   * Removes all indexed symbols for a deleted file
   */
  public removeFile(fileId: string, filePath?: string): void {
    this.bibEntries.delete(fileId);
    this.labelEntries.delete(fileId);
    this.commandEntries.delete(fileId);
    this.environmentEntries.delete(fileId);
    this.outlineEntries.delete(fileId);
    this.includeEntries.delete(fileId);
    this.filePaths.delete(fileId);
    if (filePath) {
      this.knownFiles.delete(filePath.replace(/\\/g, '/'));
    }
    this.version++;
  }

  /**
   * Clears all indexed symbols
   */
  public clear(): void {
    this.bibEntries.clear();
    this.labelEntries.clear();
    this.commandEntries.clear();
    this.environmentEntries.clear();
    this.outlineEntries.clear();
    this.includeEntries.clear();
    this.filePaths.clear();
    this.knownFiles.clear();
    this.version++;
  }

  /**
   * Exports an immutable snapshot of all indexed project symbols and outline trees
   */
  public exportSnapshot(): SymbolSnapshot {
    const citations: BibEntry[] = [];
    for (const fileMap of this.bibEntries.values()) {
      for (const entry of fileMap.values()) {
        citations.push(entry);
      }
    }

    const labels: LabelEntry[] = [];
    for (const fileMap of this.labelEntries.values()) {
      for (const entry of fileMap.values()) {
        labels.push(entry);
      }
    }

    const commands: CommandEntry[] = [];
    for (const fileMap of this.commandEntries.values()) {
      for (const cmd of fileMap.values()) {
        commands.push(cmd);
      }
    }

    const environments: EnvironmentEntry[] = [];
    for (const fileMap of this.environmentEntries.values()) {
      for (const env of fileMap.values()) {
        environments.push(env);
      }
    }

    const includeFiles = Array.from(this.knownFiles).filter((p) => p.endsWith('.tex'));
    const imageFiles = Array.from(this.knownFiles).filter((p) =>
      /\.(png|jpe?g|pdf|eps|svg|gif|webp)$/i.test(p)
    );

    const outlineByFile: Record<string, OutlineNode[]> = {};
    const flatOutlineByFile: Record<string, OutlineItem[]> = {};

    for (const [fileId, items] of this.outlineEntries.entries()) {
      const path = this.filePaths.get(fileId) || fileId;
      flatOutlineByFile[path] = items;
      flatOutlineByFile[fileId] = items;
      const tree = buildOutlineTree(items);
      outlineByFile[path] = tree;
      outlineByFile[fileId] = tree;
    }

    // 5. Construct hierarchical multi-file Project Outline (Overleaf Parity)
    const projectFlatOutline: OutlineItem[] = [];
    const visitedFiles = new Set<string>();

    const allPaths = Array.from(this.knownFiles);
    const rootPath =
      allPaths.find((p) => /(^|\/)main\.tex$/i.test(p)) ||
      allPaths.find((p) => /(^|\/)index\.tex$/i.test(p)) ||
      allPaths.find((p) => p.endsWith('.tex')) ||
      '';

    const appendFileOutlines = (targetPath: string) => {
      const norm = targetPath.replace(/\\/g, '/');
      if (visitedFiles.has(norm)) return;
      visitedFiles.add(norm);

      const bareName = norm.split('/').pop() || norm;
      const fileIdMatch = Array.from(this.filePaths.entries()).find(
        ([_, p]) => p === norm || p.endsWith('/' + bareName) || bareName === p.split('/').pop()
      );
      const resolvedId = fileIdMatch ? fileIdMatch[0] : norm;
      const items = this.outlineEntries.get(resolvedId) || this.outlineEntries.get(norm) || [];
      const includes = this.includeEntries.get(resolvedId) || this.includeEntries.get(norm) || [];

      let incIdx = 0;
      for (const item of items) {
        while (incIdx < includes.length && includes[incIdx].line < item.line) {
          appendFileOutlines(includes[incIdx].path);
          incIdx++;
        }
        projectFlatOutline.push(item);
      }
      while (incIdx < includes.length) {
        appendFileOutlines(includes[incIdx].path);
        incIdx++;
      }
    };

    if (rootPath) {
      appendFileOutlines(rootPath);
    }
    // Append any orphan / unincluded .tex files so they are still discoverable in project outline
    for (const [fId, items] of this.outlineEntries.entries()) {
      const p = this.filePaths.get(fId) || fId;
      if (!visitedFiles.has(p.replace(/\\/g, '/'))) {
        for (const it of items) {
          projectFlatOutline.push(it);
        }
      }
    }

    const projectOutline = buildOutlineTree(projectFlatOutline);

    return {
      citations,
      labels,
      commands,
      environments,
      includeFiles,
      imageFiles,
      outlineByFile,
      flatOutlineByFile,
      projectOutline,
      projectFlatOutline,
      version: this.version,
    };
  }

  /**
   * Fast regex parsing of BibTeX entries
   */
  private indexBibContent(fileId: string, filePath: string, content: string): void {
    const fileBibMap = new Map<string, BibEntry>();

    // Match @type{key, ...
    const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,([^@]*)/g;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(content)) !== null) {
      const type = match[1].toLowerCase();
      const key = match[2].trim();
      const body = match[3];

      if (type === 'comment' || type === 'string' || type === 'preamble') {
        continue;
      }

      // Extract title, author, year, journal, doi from entry body
      const titleMatch = /title\s*=\s*[{"]([^}"]+)[}"]/i.exec(body);
      const authorMatch = /author\s*=\s*[{"]([^}"]+)[}"]/i.exec(body);
      const yearMatch = /year\s*=\s*[{"]?(\d{4})[}"]?/i.exec(body);
      const journalMatch = /(?:journal|booktitle)\s*=\s*[{"]([^}"]+)[}"]/i.exec(body);
      const doiMatch = /doi\s*=\s*[{"]([^}"]+)[}"]/i.exec(body);

      fileBibMap.set(key, {
        key,
        type,
        title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined,
        author: authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : undefined,
        year: yearMatch ? yearMatch[1] : undefined,
        journal: journalMatch ? journalMatch[1].replace(/\s+/g, ' ').trim() : undefined,
        doi: doiMatch ? doiMatch[1].trim() : undefined,
        sourceFile: filePath,
      });
    }

    this.bibEntries.set(fileId, fileBibMap);
  }

  /**
   * Fast utility to strip Vietnamese diacritics for search and autocompletion
   */
  public static stripVietnameseDiacritics(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  /**
   * Fast regex parsing of LaTeX labels, commands, and structural sections (Overleaf Parity)
   */
  private indexTexContent(fileId: string, filePath: string, content: string): void {
    const fileLabelMap = new Map<string, LabelEntry>();
    const fileCommandMap = new Map<string, CommandEntry>();
    const fileEnvironmentMap = new Map<string, EnvironmentEntry>();
    const fileOutlineItems: OutlineItem[] = [];
    const fileIncludes: Array<{ path: string; line: number }> = [];

    // Also support embedded \bibitem references directly in .tex files
    let fileBibMap = this.bibEntries.get(fileId);
    if (!fileBibMap) {
      fileBibMap = new Map<string, BibEntry>();
      this.bibEntries.set(fileId, fileBibMap);
    }

    const lines = content.split('\n');
    let inFigure = false;
    let inTable = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Accurate comment stripping: ignore escaped \%
      const activeLine = this.getNonCommentedContent(line);
      if (!activeLine.trim()) continue;

      // Environment tracking for Figures & Tables (Overleaf Parity)
      if (/\\begin\s*\{\s*figure\*?\s*\}/.test(activeLine)) {
        inFigure = true;
        inTable = false;
      } else if (/\\end\s*\{\s*figure\*?\s*\}/.test(activeLine)) {
        inFigure = false;
      } else if (/\\begin\s*\{\s*table\*?\s*\}/.test(activeLine)) {
        inTable = true;
        inFigure = false;
      } else if (/\\end\s*\{\s*table\*?\s*\}/.test(activeLine)) {
        inTable = false;
      }

      // 0. Figure / Table Caption Extraction (Overleaf Parity)
      if (inFigure || inTable) {
        const captionRegex = /\\caption(?:\s*\[[^\]]*\])?\{([^}]+)\}/g;
        let capMatch: RegExpExecArray | null;
        while ((capMatch = captionRegex.exec(activeLine)) !== null) {
          const rawCaption = capMatch[1];
          const cleanTitle = rawCaption
            .replace(/\\cite\{[^}]+\}/g, '')
            .replace(/\\label\{[^}]+\}/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const type: SectionLevel = inFigure ? 'figure' : 'table';
          fileOutlineItems.push({
            id: `${filePath}:${lineIdx + 1}`,
            title: `${inFigure ? 'Fig: ' : 'Tab: '}${cleanTitle || (inFigure ? 'Figure' : 'Table')}`,
            level: SECTION_LEVEL_WEIGHT[type],
            type,
            line: lineIdx + 1,
            sourceFile: filePath,
            hasStar: false,
          });
        }
      }

      // 0b. Subfile inclusion tracking (\input, \include, \subfile)
      const incRegex = /\\(?:input|include|subfile)\{([^}]+)\}/g;
      let incMatch: RegExpExecArray | null;
      while ((incMatch = incRegex.exec(activeLine)) !== null) {
        let incPath = incMatch[1].trim().replace(/\\/g, '/');
        if (!incPath.endsWith('.tex') && !incPath.includes('.')) {
          incPath += '.tex';
        }
        fileIncludes.push({ path: incPath, line: lineIdx + 1 });
      }

      // 1a. Match standard \label{key} with safe length limit (Overleaf parity)
      const labelRegex = /\\label\{([^}]{1,80})\}/g;
      let labelMatch: RegExpExecArray | null;
      while ((labelMatch = labelRegex.exec(activeLine)) !== null) {
        this.registerLabel(fileLabelMap, labelMatch[1].trim(), lineIdx + 1, filePath);
      }

      // 1b. Match optional label={key} in environment options (Overleaf parity)
      const labelOptionRegex = /\blabel=\{?([^,}\s\]]{1,80})[},\]]/g;
      let optionMatch: RegExpExecArray | null;
      while ((optionMatch = labelOptionRegex.exec(activeLine)) !== null) {
        this.registerLabel(fileLabelMap, optionMatch[1].trim(), lineIdx + 1, filePath);
      }

      // 2. Match \newcommand{\name}[args]
      const cmdRegex = /\\(?:re)?newcommand\{?\\([a-zA-Z]+)\}?(?:\[(\d+)\])?/g;
      let cmdMatch: RegExpExecArray | null;
      while ((cmdMatch = cmdRegex.exec(activeLine)) !== null) {
        const name = `\\${cmdMatch[1]}`;
        const argsCount = cmdMatch[2] ? parseInt(cmdMatch[2], 10) : 0;
        fileCommandMap.set(name, {
          name,
          argsCount,
          sourceFile: filePath,
        });
      }

      // 2b. Match \newtheorem{envname} or \newenvironment{envname}
      const envRegex = /\\(?:newtheorem|(?:re)?newenvironment)\{([a-zA-Z*0-9_]+)\}/g;
      let envMatch: RegExpExecArray | null;
      while ((envMatch = envRegex.exec(activeLine)) !== null) {
        const envName = envMatch[1].trim();
        fileEnvironmentMap.set(envName, {
          name: envName,
          sourceFile: filePath,
          line: lineIdx + 1,
        });
      }

      // 2c. Match embedded \bibitem[label]{key} (e.g. \begin{thebibliography})
      const bibitemRegex = /\\bibitem(?:\[([^\]]*)\])?\{([^}]+)\}/g;
      let bibMatch: RegExpExecArray | null;
      while ((bibMatch = bibitemRegex.exec(activeLine)) !== null) {
        const key = bibMatch[2].trim();
        const shortAuthor = bibMatch[1] ? bibMatch[1].trim() : undefined;
        fileBibMap.set(key, {
          key,
          type: 'bibitem',
          author: shortAuthor,
          sourceFile: filePath,
        });
      }

      // 3. Match LaTeX Document Structure: \book, \part, \chapter, \section, \subsection, etc.
      const sectionRegex = /\\(book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\{([^}]+)\}/;
      const sectionMatch = sectionRegex.exec(activeLine);
      if (sectionMatch) {
        const type = sectionMatch[1] as SectionLevel;
        const hasStar = sectionMatch[2] === '*';
        const cleanTitle = sectionMatch[3]
          .replace(/\\cite\{[^}]+\}/g, '')
          .replace(/\\label\{[^}]+\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const level = SECTION_LEVEL_WEIGHT[type];

        fileOutlineItems.push({
          id: `${filePath}:${lineIdx + 1}`,
          title: cleanTitle || 'Untitled Section',
          level,
          type,
          line: lineIdx + 1,
          sourceFile: filePath,
          hasStar,
        });
      }
    }

    this.labelEntries.set(fileId, fileLabelMap);
    this.commandEntries.set(fileId, fileCommandMap);
    this.environmentEntries.set(fileId, fileEnvironmentMap);
    this.outlineEntries.set(fileId, fileOutlineItems);
    this.includeEntries.set(fileId, fileIncludes);
  }

  private registerLabel(map: Map<string, LabelEntry>, name: string, line: number, sourceFile: string): void {
    if (!name) return;
    let type: LabelEntry['type'] = 'other';
    const lower = name.toLowerCase();
    if (lower.startsWith('fig:') || lower.startsWith('figure:')) type = 'fig';
    else if (lower.startsWith('tab:') || lower.startsWith('table:')) type = 'tab';
    else if (lower.startsWith('sec:') || lower.startsWith('section:')) type = 'sec';
    else if (lower.startsWith('eq:') || lower.startsWith('equation:')) type = 'eq';
    else if (lower.startsWith('lst:') || lower.startsWith('listing:')) type = 'lst';
    else if (lower.startsWith('thm:') || lower.startsWith('theorem:')) type = 'thm';
    else if (lower.startsWith('lem:') || lower.startsWith('lemma:')) type = 'lem';
    else if (lower.startsWith('def:') || lower.startsWith('definition:')) type = 'def';
    else if (lower.startsWith('prop:') || lower.startsWith('proposition:')) type = 'prop';
    else if (lower.startsWith('cor:') || lower.startsWith('corollary:')) type = 'cor';
    else if (lower.startsWith('alg:') || lower.startsWith('algorithm:')) type = 'alg';
    else if (lower.startsWith('app:') || lower.startsWith('appendix:')) type = 'app';

    map.set(name, {
      name,
      type,
      line,
      sourceFile,
    });
  }

  /**
   * Strips TeX comments from a single line, respecting escaped \%
   */
  private getNonCommentedContent(line: string): string {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '%') {
        let backslashes = 0;
        let j = i - 1;
        while (j >= 0 && line[j] === '\\') {
          backslashes++;
          j--;
        }
        if (backslashes % 2 === 0) {
          return line.slice(0, i);
        }
      }
    }
    return line;
  }

  /**
   * Returns all citations matching query prefix
   */
  public getCitations(query = ''): BibEntry[] {
    const q = query.toLowerCase();
    const results: BibEntry[] = [];

    for (const fileMap of this.bibEntries.values()) {
      for (const entry of fileMap.values()) {
        if (!q || entry.key.toLowerCase().includes(q) || (entry.author && entry.author.toLowerCase().includes(q)) || (entry.title && entry.title.toLowerCase().includes(q))) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Returns all labels matching query prefix
   */
  public getLabels(query = ''): LabelEntry[] {
    const q = query.toLowerCase();
    const results: LabelEntry[] = [];

    for (const fileMap of this.labelEntries.values()) {
      for (const entry of fileMap.values()) {
        if (!q || entry.name.toLowerCase().includes(q)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Returns all custom project commands
   */
  public getCommands(): CommandEntry[] {
    const results: CommandEntry[] = [];
    for (const fileMap of this.commandEntries.values()) {
      for (const cmd of fileMap.values()) {
        results.push(cmd);
      }
    }
    return results;
  }

  /**
   * Returns all known .tex filenames for \input / \include
   */
  public getIncludeFiles(query = ''): string[] {
    const q = query.toLowerCase();
    return Array.from(this.knownFiles)
      .filter((path) => path.endsWith('.tex') && (!q || path.toLowerCase().includes(q)));
  }

  /**
   * Returns all known image filenames for \includegraphics
   */
  public getImageFiles(query = ''): string[] {
    const q = query.toLowerCase();
    return Array.from(this.knownFiles).filter(
      (path) =>
        /\.(png|jpe?g|pdf|eps|svg|gif|webp)$/i.test(path) &&
        (!q || path.toLowerCase().includes(q))
    );
  }

  /**
   * Returns hierarchical outline tree for a given file
   */
  public getOutline(fileIdOrPath: string): OutlineNode[] {
    const norm = fileIdOrPath.replace(/\\/g, '/');
    const items = this.outlineEntries.get(norm) || this.outlineEntries.get(fileIdOrPath);
    if (!items) {
      // Try search by matching path
      for (const [id, path] of this.filePaths.entries()) {
        if (path === norm || id === fileIdOrPath) {
          return buildOutlineTree(this.outlineEntries.get(id) || []);
        }
      }
      return [];
    }
    return buildOutlineTree(items);
  }
}
