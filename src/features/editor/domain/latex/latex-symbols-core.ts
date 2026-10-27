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

import { type BibEntry, parseBibContent } from './bib-parser';

export type { BibEntry };

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
  | {
      type: 'indexBatch';
      files: Array<{ fileId: string; filePath: string; content: string }>;
      id: number;
    }
  | { type: 'removeFile'; fileId: string; filePath?: string; id: number }
  | { type: 'clear'; id: number }
  | { type: 'getSnapshot'; id: number };

export interface SymbolsWorkerMessageOut {
  id: number;
  snapshot: SymbolSnapshot;
}

const IMAGE_FILE_REGEX = /\.(png|jpe?g|pdf|eps|svg|gif|webp)$/i;
const MAIN_TEX_EXACT_REGEX = /(^|\/)main\.tex$/i;
const MAIN_TEX_PREFIX_REGEX = /(^|\/)main[^/]*\.tex$/i;
const INDEX_TEX_REGEX = /(^|\/)index\.tex$/i;
const DOCCLASS_REGEX = /\\documentclass\b/;
const SUBFILES_DOCCLASS_REGEX = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{\s*subfiles\s*\}/;
const BEGIN_FIGURE_REGEX = /\\begin\s*\{\s*figure\*?\s*\}/;
const END_FIGURE_REGEX = /\\end\s*\{\s*figure\*?\s*\}/;
const BEGIN_TABLE_REGEX = /\\begin\s*\{\s*table\*?\s*\}/;
const END_TABLE_REGEX = /\\end\s*\{\s*table\*?\s*\}/;
const CAPTION_PREFIX_REGEX = /\\caption(?:\s*\[[^\]]*\])?\s*\{/g;
const CAPTION_CITE_STRIP_REGEX = /\\(?:auto|paren|text|foot|no|new|short)?cite[a-z*]*\{[^}]*\}/gi;
const CAPTION_REF_STRIP_REGEX = /\\(?:C|c)?ref\{[^}]*\}/g;
const CAPTION_LABEL_STRIP_REGEX = /\\label\{[^}]*\}/g;
const CAPTION_LOOSENESS_STRIP_REGEX = /\\looseness-?\d+\s*/g;
const INCLUDE_CMD_REGEX = /\\(?:input|include|subfile)\{([^}]+)\}/g;
const LABEL_CMD_REGEX = /\\label\{([^}]{1,80})\}/g;
const LABEL_OPT_REGEX = /\blabel=\{?([^,}\s\]]{1,80})[},\]]/g;
const NEWCOMMAND_REGEX = /\\(?:re|provide)?newcommand\*?\s*\{?\s*\\([a-zA-Z@]+)\s*\}?(?:\s*\[(\d+)\])?/g;
const MATH_OP_REGEX = /\\DeclareMathOperator\*?\s*\{\s*\\([a-zA-Z]+)\s*\}/g;
const DEF_CMD_REGEX = /\\(?:g|e|x)?def\s*\\([a-zA-Z]{2,})((?:#\d+)*)\s*\{/g;
const NEWENV_REGEX = /\\(?:newtheorem|(?:re)?newenvironment)\*?\{([a-zA-Z*0-9_]+)\}/g;
const SECTION_PREFIX_REGEX = /\\(book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\s*(?:\[[^\]]*\])?\s*\{/;
const BIBITEM_GLOBAL_REGEX = /\\bibitem\s*(?:\[([\s\S]*?)\])?\s*\{([^}]+)\}/g;

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

    const allPaths = Array.from(this.knownFiles);
    const includeFiles = allPaths.filter((p) => p.endsWith('.tex'));
    const imageFiles = allPaths.filter((p) => IMAGE_FILE_REGEX.test(p));

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

    const rootPath =
      allPaths.find((p) => this.docClassFiles.has(p) && MAIN_TEX_EXACT_REGEX.test(p)) ||
      allPaths.find((p) => this.docClassFiles.has(p) && MAIN_TEX_PREFIX_REGEX.test(p)) ||
      allPaths.find((p) => this.docClassFiles.has(p)) ||
      allPaths.find((p) => MAIN_TEX_EXACT_REGEX.test(p)) ||
      allPaths.find((p) => INDEX_TEX_REGEX.test(p)) ||
      includeFiles[0] ||
      '';

    // Pre-build O(1) lookup maps for filePaths resolution
    const exactPathMap = new Map<string, [string, string]>();
    const bareNameMap = new Map<string, [string, string]>();
    const filePathEntries = Array.from(this.filePaths.entries());
    for (const entry of filePathEntries) {
      const p = entry[1];
      if (!exactPathMap.has(p)) exactPathMap.set(p, entry);
      const bare = p.split('/').pop() || p;
      if (!bareNameMap.has(bare)) bareNameMap.set(bare, entry);
    }

    const appendFileOutlines = (targetPath: string) => {
      const norm = targetPath.replace(/\\/g, '/');
      if (visitedFiles.has(norm)) return;

      const bareName = norm.split('/').pop() || norm;
      const fileIdMatch =
        exactPathMap.get(norm) ||
        filePathEntries.find(([_, p]) => p.endsWith('/' + norm) || p.endsWith('/' + bareName)) ||
        bareNameMap.get(bareName);
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
   * Balanced-brace and quote-aware BibTeX parser (delegates to canonical domain/latex/bib-parser.ts)
   */
  private indexBibContent(fileId: string, filePath: string, content: string): void {
    const fileBibMap = new Map<string, BibEntry>();
    for (const entry of parseBibContent(content, filePath)) {
      fileBibMap.set(entry.key, entry);
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

      const hasBackslash = activeLine.indexOf('\\') !== -1;

      if (hasBackslash) {
        // Detect root \documentclass (excluding subfiles child documents)
        if (activeLine.indexOf('\\documentclass') !== -1 && DOCCLASS_REGEX.test(activeLine)) {
          hasDocClass = true;
          if (SUBFILES_DOCCLASS_REGEX.test(activeLine)) {
            isSubfileDoc = true;
          }
        }

        // Environment tracking for Figures & Tables (Overleaf Parity)
        if (activeLine.indexOf('\\begin') !== -1 || activeLine.indexOf('\\end') !== -1) {
          if (BEGIN_FIGURE_REGEX.test(activeLine)) {
            inFigure = true;
            inTable = false;
          } else if (END_FIGURE_REGEX.test(activeLine)) {
            inFigure = false;
          } else if (BEGIN_TABLE_REGEX.test(activeLine)) {
            inTable = true;
            inFigure = false;
          } else if (END_TABLE_REGEX.test(activeLine)) {
            inTable = false;
          }
        }

        // 0. Figure / Table Caption Extraction with balanced braces (supports nested macros & multi-line captions)
        if ((inFigure || inTable) && activeLine.indexOf('\\caption') !== -1) {
          CAPTION_PREFIX_REGEX.lastIndex = 0;
          let capPrefixMatch: RegExpExecArray | null;
          while ((capPrefixMatch = CAPTION_PREFIX_REGEX.exec(activeLine)) !== null) {
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
              .replace(CAPTION_CITE_STRIP_REGEX, '')
              .replace(CAPTION_REF_STRIP_REGEX, '')
              .replace(CAPTION_LABEL_STRIP_REGEX, '')
              .replace(CAPTION_LOOSENESS_STRIP_REGEX, '')
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
        if (activeLine.indexOf('{') !== -1) {
          INCLUDE_CMD_REGEX.lastIndex = 0;
          let incMatch: RegExpExecArray | null;
          while ((incMatch = INCLUDE_CMD_REGEX.exec(activeLine)) !== null) {
            let incPath = incMatch[1].trim().replace(/\\/g, '/');
            if (!incPath.endsWith('.tex') && !incPath.includes('.')) {
              incPath += '.tex';
            }
            fileIncludes.push({ path: incPath, line: lineIdx + 1 });
          }

          // 1a. Match standard \label{key} with safe length limit (Overleaf parity)
          if (activeLine.indexOf('\\label{') !== -1) {
            LABEL_CMD_REGEX.lastIndex = 0;
            let labelMatch: RegExpExecArray | null;
            while ((labelMatch = LABEL_CMD_REGEX.exec(activeLine)) !== null) {
              this.registerLabel(fileLabelMap, labelMatch[1].trim(), lineIdx + 1, filePath);
            }
          }
        }
      }

      // 1b. Match optional label={key} in environment options (Overleaf parity)
      if (activeLine.indexOf('label=') !== -1) {
        LABEL_OPT_REGEX.lastIndex = 0;
        let optionMatch: RegExpExecArray | null;
        while ((optionMatch = LABEL_OPT_REGEX.exec(activeLine)) !== null) {
          this.registerLabel(fileLabelMap, optionMatch[1].trim(), lineIdx + 1, filePath);
        }
      }

      if (!hasBackslash) continue;

      // 2. Match \newcommand{\name}[args], \newcommand*\name[args], \renewcommand*, \providecommand*
      if (activeLine.indexOf('newcommand') !== -1) {
        NEWCOMMAND_REGEX.lastIndex = 0;
        let cmdMatch: RegExpExecArray | null;
        while ((cmdMatch = NEWCOMMAND_REGEX.exec(activeLine)) !== null) {
          const name = `\\${cmdMatch[1]}`;
          const argsCount = cmdMatch[2] ? parseInt(cmdMatch[2], 10) : 0;
          fileCommandMap.set(name, {
            name,
            argsCount,
            sourceFile: filePath,
          });
        }
      }

      // 2a-extra. Match \DeclareMathOperator*{\name}{...} and \def\name
      if (activeLine.indexOf('\\DeclareMathOperator') !== -1) {
        MATH_OP_REGEX.lastIndex = 0;
        let mathOpMatch: RegExpExecArray | null;
        while ((mathOpMatch = MATH_OP_REGEX.exec(activeLine)) !== null) {
          const name = `\\${mathOpMatch[1]}`;
          fileCommandMap.set(name, {
            name,
            argsCount: 0,
            sourceFile: filePath,
          });
        }
      }

      if (activeLine.indexOf('def') !== -1) {
        DEF_CMD_REGEX.lastIndex = 0;
        let defMatch: RegExpExecArray | null;
        while ((defMatch = DEF_CMD_REGEX.exec(activeLine)) !== null) {
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
      }

      // 2b. Match \newtheorem{envname} or \newenvironment{envname}
      if (activeLine.indexOf('new') !== -1) {
        NEWENV_REGEX.lastIndex = 0;
        let envMatch: RegExpExecArray | null;
        while ((envMatch = NEWENV_REGEX.exec(activeLine)) !== null) {
          const envName = envMatch[1].trim();
          fileEnvironmentMap.set(envName, {
            name: envName,
            sourceFile: filePath,
            line: lineIdx + 1,
          });
        }
      }

      // 3. Match LaTeX Document Structure: \book, \part, \chapter, \section, \subsection, etc. (with balanced braces)
      const sectionMatch = SECTION_PREFIX_REGEX.exec(activeLine);
      if (sectionMatch) {
        const type = sectionMatch[1] as SectionLevel;
        const hasStar = sectionMatch[2] === '*';
        const openBraceIdx = sectionMatch.index + sectionMatch[0].length - 1;
        const balanced = this.extractBalancedBraces(activeLine, openBraceIdx);
        const rawTitle = balanced
          ? balanced.value
          : activeLine.slice(openBraceIdx + 1).replace(/\}.*$/, '');
        const cleanTitle = rawTitle
          .replace(CAPTION_CITE_STRIP_REGEX, '')
          .replace(CAPTION_LABEL_STRIP_REGEX, '')
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
      BIBITEM_GLOBAL_REGEX.lastIndex = 0;
      const matches: Array<{ key: string; optLabel?: string; bodyStart: number; matchStart: number }> = [];
      let bm: RegExpExecArray | null;
      while ((bm = BIBITEM_GLOBAL_REGEX.exec(fullCleanText)) !== null) {
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
