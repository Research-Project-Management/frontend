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
  private docClassFiles = new Set<string>(); // Normalized paths of files containing \documentclass (excluding subfiles)
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
    } else if (
      normPath.endsWith('.tex') ||
      normPath.endsWith('.ltx') ||
      normPath.endsWith('.sty') ||
      normPath.endsWith('.cls') ||
      normPath.endsWith('.bbl')
    ) {
      this.indexTexContent(fileId, normPath, content);
    }
    this.version++;
  }

  /**
   * Removes all indexed symbols for a deleted file
   */
  public removeFile(fileId: string, filePath?: string): void {
    const prevPath = this.filePaths.get(fileId);
    this.bibEntries.delete(fileId);
    this.labelEntries.delete(fileId);
    this.commandEntries.delete(fileId);
    this.environmentEntries.delete(fileId);
    this.outlineEntries.delete(fileId);
    this.includeEntries.delete(fileId);
    this.filePaths.delete(fileId);
    if (prevPath) {
      this.docClassFiles.delete(prevPath);
    }
    if (filePath) {
      const norm = filePath.replace(/\\/g, '/');
      this.knownFiles.delete(norm);
      this.docClassFiles.delete(norm);
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
    this.docClassFiles.clear();
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
      allPaths.find((p) => this.docClassFiles.has(p) && /(^|\/)main\.tex$/i.test(p)) ||
      allPaths.find((p) => this.docClassFiles.has(p) && /(^|\/)main[^/]*\.tex$/i.test(p)) ||
      allPaths.find((p) => this.docClassFiles.has(p)) ||
      allPaths.find((p) => /(^|\/)main\.tex$/i.test(p)) ||
      allPaths.find((p) => /(^|\/)index\.tex$/i.test(p)) ||
      allPaths.find((p) => p.endsWith('.tex')) ||
      '';

    const appendFileOutlines = (targetPath: string) => {
      const norm = targetPath.replace(/\\/g, '/');
      if (visitedFiles.has(norm)) return;

      const bareName = norm.split('/').pop() || norm;
      const fileIdMatch = Array.from(this.filePaths.entries()).find(
        ([_, p]) => p === norm || p.endsWith('/' + norm) || p.endsWith('/' + bareName) || bareName === p.split('/').pop()
      );
      const resolvedId = fileIdMatch ? fileIdMatch[0] : norm;
      const resolvedNormPath = fileIdMatch ? fileIdMatch[1] : norm;
      if (visitedFiles.has(resolvedNormPath)) return;
      visitedFiles.add(norm);
      visitedFiles.add(resolvedNormPath);

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
      const p = (this.filePaths.get(fId) || fId).replace(/\\/g, '/');
      if (!visitedFiles.has(p)) {
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
   * Extracts balanced brace `{...}` content starting at the index of `{`.
   */
  private extractBalancedBraces(text: string, openBraceIdx: number): { value: string; endIdx: number } | null {
    if (openBraceIdx < 0 || openBraceIdx >= text.length || text[openBraceIdx] !== '{') {
      return null;
    }
    let depth = 1;
    let i = openBraceIdx + 1;
    const len = text.length;
    while (i < len && depth > 0) {
      const ch = text[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth !== 0) return null;
    return {
      value: text.slice(openBraceIdx + 1, i - 1),
      endIdx: i,
    };
  }

  /**
   * Balanced-brace and quote-aware BibTeX parser (handles nested braces like {PASCAL}, {\L}ukasz, and @ in URLs/emails)
   */
  private indexBibContent(fileId: string, filePath: string, content: string): void {
    const fileBibMap = new Map<string, BibEntry>();
    const len = content.length;
    let pos = 0;

    while (pos < len) {
      const atIdx = content.indexOf('@', pos);
      if (atIdx === -1) break;

      let typeStart = atIdx + 1;
      while (typeStart < len && /\s/.test(content[typeStart])) typeStart++;
      let typeEnd = typeStart;
      while (typeEnd < len && /[a-zA-Z0-9_-]/.test(content[typeEnd])) typeEnd++;

      const type = content.slice(typeStart, typeEnd).toLowerCase();
      if (!type) {
        pos = atIdx + 1;
        continue;
      }

      let openIdx = typeEnd;
      while (openIdx < len && /\s/.test(content[openIdx])) openIdx++;
      if (openIdx >= len || (content[openIdx] !== '{' && content[openIdx] !== '(')) {
        pos = typeEnd;
        continue;
      }

      const openChar = content[openIdx];
      const closeChar = openChar === '{' ? '}' : ')';
      let depth = 1;
      let i = openIdx + 1;
      while (i < len && depth > 0) {
        if (content[i] === openChar) depth++;
        else if (content[i] === closeChar) depth--;
        i++;
      }

      const rawEntryBody = content.slice(openIdx + 1, depth === 0 ? i - 1 : i);
      pos = i;

      if (type === 'comment' || type === 'string' || type === 'preamble') {
        continue;
      }

      const commaIdx = rawEntryBody.indexOf(',');
      if (commaIdx === -1) continue;

      const key = rawEntryBody.slice(0, commaIdx).trim();
      if (!key || /\s/.test(key)) continue;

      const fieldsBody = rawEntryBody.slice(commaIdx + 1);
      const fields = this.parseBibEntryFields(fieldsBody);

      fileBibMap.set(key, {
        key,
        type,
        title: fields.title,
        author: fields.author,
        year: fields.year,
        journal: fields.journal || fields.booktitle,
        booktitle: fields.booktitle,
        doi: fields.doi,
        sourceFile: filePath,
      });
    }

    this.bibEntries.set(fileId, fileBibMap);
  }

  private parseBibEntryFields(body: string): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    let i = 0;
    const len = body.length;

    while (i < len) {
      while (i < len && /[\s,]/.test(body[i])) i++;
      if (i >= len) break;

      const nameStart = i;
      while (i < len && /[a-zA-Z0-9_-]/.test(body[i])) i++;
      const fieldName = body.slice(nameStart, i).toLowerCase();
      if (!fieldName) {
        i++;
        continue;
      }

      while (i < len && /\s/.test(body[i])) i++;
      if (i >= len || body[i] !== '=') continue;
      i++; // skip '='

      while (i < len && /\s/.test(body[i])) i++;
      if (i >= len) break;

      let value = '';
      if (body[i] === '{') {
        let depth = 1;
        i++;
        const valStart = i;
        while (i < len && depth > 0) {
          if (body[i] === '{') depth++;
          else if (body[i] === '}') depth--;
          i++;
        }
        value = body.slice(valStart, depth === 0 ? i - 1 : i);
      } else if (body[i] === '"') {
        i++;
        const valStart = i;
        while (i < len) {
          if (body[i] === '"' && body[i - 1] !== '\\') {
            i++;
            break;
          }
          i++;
        }
        value = body.slice(valStart, i > valStart ? i - 1 : i);
      } else {
        const valStart = i;
        while (i < len && body[i] !== ',' && body[i] !== '}' && body[i] !== ')') {
          i++;
        }
        value = body.slice(valStart, i);
      }

      const cleaned = value.replace(/\s+/g, ' ').trim();
      if (cleaned) {
        if (fieldName === 'year') {
          const ym = cleaned.match(/\b(\d{4})\b/);
          result.year = ym ? ym[1] : cleaned;
        } else {
          result[fieldName] = cleaned;
        }
      }
    }

    return result;
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
   * Fast regex & balanced-brace parsing of LaTeX labels, commands, \bibitem (.tex/.bbl), and structural sections (Overleaf Parity)
   */
  private indexTexContent(fileId: string, filePath: string, content: string): void {
    const fileLabelMap = new Map<string, LabelEntry>();
    const fileCommandMap = new Map<string, CommandEntry>();
    const fileEnvironmentMap = new Map<string, EnvironmentEntry>();
    const fileOutlineItems: OutlineItem[] = [];
    const fileIncludes: Array<{ path: string; line: number }> = [];

    // Also support embedded \bibitem references directly in .tex and .bbl files
    let fileBibMap = this.bibEntries.get(fileId);
    if (!fileBibMap) {
      fileBibMap = new Map<string, BibEntry>();
      this.bibEntries.set(fileId, fileBibMap);
    } else if (!filePath.endsWith('.bib')) {
      fileBibMap.clear();
    }

    const lines = content.split('\n');
    const cleanLines: string[] = new Array(lines.length);
    let inFigure = false;
    let inTable = false;
    let hasDocClass = false;
    let isSubfileDoc = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Accurate comment stripping: ignore escaped \%
      const activeLine = this.getNonCommentedContent(line);
      cleanLines[lineIdx] = activeLine;
      if (!activeLine.trim()) continue;

      // Detect root \documentclass (excluding subfiles child documents)
      if (/\\documentclass\b/.test(activeLine)) {
        hasDocClass = true;
        if (/\\documentclass\s*(?:\[[^\]]*\])?\s*\{\s*subfiles\s*\}/.test(activeLine)) {
          isSubfileDoc = true;
        }
      }

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

      // 0. Figure / Table Caption Extraction with balanced braces (supports nested macros & multi-line captions)
      if (inFigure || inTable) {
        const capPrefixRegex = /\\caption(?:\s*\[[^\]]*\])?\s*\{/g;
        let capPrefixMatch: RegExpExecArray | null;
        while ((capPrefixMatch = capPrefixRegex.exec(activeLine)) !== null) {
          const openBraceCol = capPrefixMatch.index + capPrefixMatch[0].length - 1;
          // Join up to 8 subsequent non-commented lines if caption spans multiple lines
          let windowText = activeLine.slice(openBraceCol);
          for (let lookahead = 1; lookahead <= 8 && lineIdx + lookahead < lines.length; lookahead++) {
            if (this.extractBalancedBraces(windowText, 0)) break;
            windowText += '\n' + this.getNonCommentedContent(lines[lineIdx + lookahead]);
          }
          const balanced = this.extractBalancedBraces(windowText, 0);
          const rawCaption = balanced ? balanced.value : activeLine.slice(openBraceCol + 1).replace(/\}.*$/, '');
          const cleanTitle = rawCaption
            .replace(/\\(?:auto|paren|text|foot|no|new|short)?cite[a-z*]*\{[^}]*\}/gi, '')
            .replace(/\\(?:C|c)?ref\{[^}]*\}/g, '')
            .replace(/\\label\{[^}]*\}/g, '')
            .replace(/\\looseness-?\d+\s*/g, '')
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

      // 2. Match \newcommand{\name}[args], \newcommand*\name[args], \renewcommand*, \providecommand*
      const cmdRegex = /\\(?:re|provide)?newcommand\*?\s*\{?\s*\\([a-zA-Z@]+)\s*\}?(?:\s*\[(\d+)\])?/g;
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

      // 2a-extra. Match \DeclareMathOperator*{\name}{...} and \def\name
      const mathOpRegex = /\\DeclareMathOperator\*?\s*\{\s*\\([a-zA-Z]+)\s*\}/g;
      let mathOpMatch: RegExpExecArray | null;
      while ((mathOpMatch = mathOpRegex.exec(activeLine)) !== null) {
        const name = `\\${mathOpMatch[1]}`;
        fileCommandMap.set(name, {
          name,
          argsCount: 0,
          sourceFile: filePath,
        });
      }

      const defRegex = /\\(?:g|e|x)?def\s*\\([a-zA-Z]{2,})((?:#\d+)*)\s*\{/g;
      let defMatch: RegExpExecArray | null;
      while ((defMatch = defRegex.exec(activeLine)) !== null) {
        const rawName = defMatch[1];
        if (rawName === 'natexlab') continue;
        const name = `\\${rawName}`;
        const params = defMatch[2] || '';
        const argsCount = params ? (params.match(/#\d/g) || []).length : 0;
        if (!fileCommandMap.has(name)) {
          fileCommandMap.set(name, {
            name,
            argsCount,
            sourceFile: filePath,
          });
        }
      }

      // 2b. Match \newtheorem{envname} or \newenvironment{envname}
      const envRegex = /\\(?:newtheorem|(?:re)?newenvironment)\*?\{([a-zA-Z*0-9_]+)\}/g;
      let envMatch: RegExpExecArray | null;
      while ((envMatch = envRegex.exec(activeLine)) !== null) {
        const envName = envMatch[1].trim();
        fileEnvironmentMap.set(envName, {
          name: envName,
          sourceFile: filePath,
          line: lineIdx + 1,
        });
      }

      // 3. Match LaTeX Document Structure: \book, \part, \chapter, \section, \subsection, etc. (with balanced braces)
      const sectionPrefixRegex = /\\(book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\s*(?:\[[^\]]*\])?\s*\{/;
      const sectionMatch = sectionPrefixRegex.exec(activeLine);
      if (sectionMatch) {
        const type = sectionMatch[1] as SectionLevel;
        const hasStar = sectionMatch[2] === '*';
        const openBraceIdx = sectionMatch.index + sectionMatch[0].length - 1;
        const balanced = this.extractBalancedBraces(activeLine, openBraceIdx);
        const rawTitle = balanced
          ? balanced.value
          : activeLine.slice(openBraceIdx + 1).replace(/\}.*$/, '');
        const cleanTitle = rawTitle
          .replace(/\\(?:auto|paren|text|foot|no|new|short)?cite[a-z*]*\{[^}]*\}/gi, '')
          .replace(/\\label\{[^}]*\}/g, '')
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

    if (hasDocClass && !isSubfileDoc) {
      this.docClassFiles.add(filePath);
    } else {
      this.docClassFiles.delete(filePath);
    }

    // 4. Multi-line \bibitem[...]{key} extraction across full clean text (supports wrapped .bbl & inline thebibliography)
    const fullCleanText = cleanLines.join('\n');
    if (fullCleanText.includes('\\bibitem')) {
      const bibitemGlobalRegex = /\\bibitem\s*(?:\[([\s\S]*?)\])?\s*\{([^}]+)\}/g;
      const matches: Array<{ key: string; optLabel?: string; bodyStart: number; matchStart: number }> = [];
      let bm: RegExpExecArray | null;
      while ((bm = bibitemGlobalRegex.exec(fullCleanText)) !== null) {
        matches.push({
          optLabel: bm[1] ? bm[1].replace(/\s+/g, ' ').trim() : undefined,
          key: bm[2].trim(),
          matchStart: bm.index,
          bodyStart: bm.index + bm[0].length,
        });
      }

      const endBibIdx = fullCleanText.indexOf('\\end{thebibliography}');
      for (let mIdx = 0; mIdx < matches.length; mIdx++) {
        const cur = matches[mIdx];
        const nextStart =
          mIdx + 1 < matches.length
            ? matches[mIdx + 1].matchStart
            : endBibIdx !== -1 && endBibIdx > cur.bodyStart
              ? endBibIdx
              : Math.min(fullCleanText.length, cur.bodyStart + 800);
        const block = fullCleanText.slice(cur.bodyStart, nextStart).trim();
        const newblocks = block.split(/\\newblock\b/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

        // Extract author from first segment before \newblock or from optional [label]
        let author = cur.optLabel
          ? cur.optLabel.replace(/^\{|\}$/g, '').replace(/\(\d{4}[a-z]?\).*/, '').trim()
          : undefined;
        if ( newblocks.length > 0) {
          const firstSeg = newblocks[0]
            .replace(/\\(?:emph|textit|textbf|textsc)\{([^}]*)\}/g, '$1')
            .replace(/[{}~]/g, ' ')
            .replace(/\s+\d{4}[a-z]?\.\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (firstSeg && (!author || firstSeg.length > author.length)) {
            author = firstSeg.replace(/\.\s*$/, '');
          }
        }

        // Extract title from second segment (after first \newblock)
        let title: string | undefined;
        if (newblocks.length > 1) {
          title = newblocks[1]
            .replace(/\\href\s*\{[^}]*\}\s*\{([\s\S]*?)\}/g, '$1')
            .replace(/\\(?:emph|textit|textbf|textsc)\{([^}]*)\}/g, '$1')
            .replace(/\{\\(?:em|it|bf)\s+([^}]*)\}/g, '$1')
            .replace(/[{}]/g, '')
            .replace(/\.\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        const yearMatch = (cur.optLabel || '') .match(/\b(19\d{2}|20\d{2})\b/) || block.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? yearMatch[1] : undefined;

        fileBibMap.set(cur.key, {
          key: cur.key,
          type: 'bibitem',
          author: author || undefined,
          title: title || undefined,
          year,
          sourceFile: filePath,
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
