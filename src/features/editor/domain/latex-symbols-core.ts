/**
 * latex-symbols-core.ts
 *
 * Pure In-Memory Symbol, Metadata & Structure Outline Engine (Domain Layer).
 * Location: `features/editor/domain/latex-symbols-core.ts`
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
  doi?: string;
  sourceFile: string;
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
  | 'part'
  | 'chapter'
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'paragraph'
  | 'subparagraph';

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
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
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
  outlineByFile: Record<string, OutlineNode[]>;
  flatOutlineByFile: Record<string, OutlineItem[]>;
  version: number;
}

export class LatexSymbolsIndexCore {
  private bibEntries = new Map<string, Map<string, BibEntry>>(); // fileId -> (key -> BibEntry)
  private labelEntries = new Map<string, Map<string, LabelEntry>>(); // fileId -> (name -> LabelEntry)
  private commandEntries = new Map<string, Map<string, CommandEntry>>(); // fileId -> (name -> CommandEntry)
  private environmentEntries = new Map<string, Map<string, EnvironmentEntry>>(); // fileId -> (name -> EnvironmentEntry)
  private outlineEntries = new Map<string, OutlineItem[]>(); // fileId -> OutlineItem[]
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

    return {
      citations,
      labels,
      commands,
      environments,
      includeFiles,
      outlineByFile,
      flatOutlineByFile,
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

    // Also support embedded \bibitem references directly in .tex files
    let fileBibMap = this.bibEntries.get(fileId);
    if (!fileBibMap) {
      fileBibMap = new Map<string, BibEntry>();
      this.bibEntries.set(fileId, fileBibMap);
    }

    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Accurate comment stripping: ignore escaped \%
      const activeLine = this.getNonCommentedContent(line);
      if (!activeLine.trim()) continue;

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

      // 3. Match LaTeX Document Structure: \part, \chapter, \section, \subsection, etc.
      const sectionRegex = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\{([^}]+)\}/;
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
