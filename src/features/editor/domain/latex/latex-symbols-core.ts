/**
 * latex-symbols-core.ts
 *
 * Lightweight Project Symbol & Structure Outline State Holder (Domain Layer).
 * Location: `features/editor/domain/latex/latex-symbols-core.ts`
 *
 * Responsibilities:
 * - Holds the in-memory symbol catalog hydrated from backend `GET /api/v1/manuscripts/projects/:projectId/structure/symbols`.
 * - Provides lightweight single-file incremental updates when local buffers are edited prior to flush.
 * - Serializes snapshot state for 0ms synchronous CodeMirror autocompletion & outline queries.
 */

import { type BibEntry, parseBibContent } from './bib-parser';
import type { ProjectSymbolsResponseDto } from '@/features/editor/sdk/manuscript/types';

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

export function inferLabelType(name: string): LabelEntry['type'] {
  const lower = (name || '').toLowerCase();
  if (lower.startsWith('fig:') || lower.startsWith('figure:')) return 'fig';
  if (lower.startsWith('tab:') || lower.startsWith('table:')) return 'tab';
  if (lower.startsWith('sec:') || lower.startsWith('section:')) return 'sec';
  if (lower.startsWith('eq:') || lower.startsWith('equation:')) return 'eq';
  if (lower.startsWith('lst:') || lower.startsWith('listing:')) return 'lst';
  if (lower.startsWith('thm:') || lower.startsWith('theorem:')) return 'thm';
  if (lower.startsWith('lem:') || lower.startsWith('lemma:')) return 'lem';
  if (lower.startsWith('def:') || lower.startsWith('definition:')) return 'def';
  if (lower.startsWith('prop:') || lower.startsWith('proposition:')) return 'prop';
  if (lower.startsWith('cor:') || lower.startsWith('corollary:')) return 'cor';
  if (lower.startsWith('alg:') || lower.startsWith('algorithm:')) return 'alg';
  if (lower.startsWith('app:') || lower.startsWith('appendix:')) return 'app';
  return 'other';
}

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

export class LatexSymbolsIndexCore {
  private bibEntries = new Map<string, Map<string, BibEntry>>();
  private labelEntries = new Map<string, Map<string, LabelEntry>>();
  private commandEntries = new Map<string, Map<string, CommandEntry>>();
  private environmentEntries = new Map<string, Map<string, EnvironmentEntry>>();
  private outlineEntries = new Map<string, OutlineItem[]>();
  private filePaths = new Map<string, string>();
  private knownFiles = new Set<string>();
  private version = 0;

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
   * Hydrates state directly from the backend `/structure/symbols` response DTO.
   */
  public hydrateFromServerDto(dto: ProjectSymbolsResponseDto): SymbolSnapshot {
    this.clear();

    for (const f of dto.files || []) {
      const norm = f.replace(/\\/g, '/').replace(/^\/+/, '');
      if (norm) this.knownFiles.add(norm);
    }
    for (const img of dto.imageFiles || dto.images || []) {
      const norm = img.replace(/\\/g, '/').replace(/^\/+/, '');
      if (norm) this.knownFiles.add(norm);
    }
    for (const inc of dto.includedFiles || []) {
      const norm = inc.replace(/\\/g, '/').replace(/^\/+/, '');
      if (norm) this.knownFiles.add(norm);
    }

    for (const c of dto.citations || []) {
      const normFile = (c.file || 'references.bib').replace(/\\/g, '/').replace(/^\/+/, '');
      this.knownFiles.add(normFile);
      this.filePaths.set(normFile, normFile);
      let fileMap = this.bibEntries.get(normFile);
      if (!fileMap) {
        fileMap = new Map();
        this.bibEntries.set(normFile, fileMap);
      }
      fileMap.set(c.key, {
        key: c.key,
        type: c.type || 'article',
        title: c.title,
        author: c.author,
        year: c.year,
        journal: c.journal || c.booktitle || c.publisher,
        doi: c.doi,
        url: c.url,
        volume: c.volume,
        number: c.number,
        pages: c.pages,
        publisher: c.publisher,
        booktitle: c.booktitle,
        sourceFile: normFile,
      });
    }

    for (const l of dto.labels || []) {
      const normFile = (l.file || 'main.tex').replace(/\\/g, '/').replace(/^\/+/, '');
      this.knownFiles.add(normFile);
      this.filePaths.set(normFile, normFile);
      let fileMap = this.labelEntries.get(normFile);
      if (!fileMap) {
        fileMap = new Map();
        this.labelEntries.set(normFile, fileMap);
      }
      fileMap.set(l.key, {
        name: l.key,
        type: inferLabelType(l.key),
        line: l.line || 1,
        sourceFile: normFile,
      });
    }

    for (const cmd of dto.customCommands || []) {
      const normFile = (cmd.file || 'main.tex').replace(/\\/g, '/').replace(/^\/+/, '');
      this.knownFiles.add(normFile);
      this.filePaths.set(normFile, normFile);
      let fileMap = this.commandEntries.get(normFile);
      if (!fileMap) {
        fileMap = new Map();
        this.commandEntries.set(normFile, fileMap);
      }
      const normalizedName = cmd.name.startsWith('\\') ? cmd.name : `\\${cmd.name}`;
      fileMap.set(normalizedName, {
        name: normalizedName,
        argsCount: cmd.argCount ?? 0,
        sourceFile: normFile,
      });
    }

    for (const env of dto.customEnvironments || []) {
      const normFile = (env.file || 'main.tex').replace(/\\/g, '/').replace(/^\/+/, '');
      this.knownFiles.add(normFile);
      this.filePaths.set(normFile, normFile);
      let fileMap = this.environmentEntries.get(normFile);
      if (!fileMap) {
        fileMap = new Map();
        this.environmentEntries.set(normFile, fileMap);
      }
      fileMap.set(env.name, {
        name: env.name,
        sourceFile: normFile,
        line: env.line || 1,
      });
    }

    for (const item of dto.outline || []) {
      const normFile = (item.file || 'main.tex').replace(/\\/g, '/').replace(/^\/+/, '');
      this.knownFiles.add(normFile);
      this.filePaths.set(normFile, normFile);
      const list = this.outlineEntries.get(normFile) || [];
      const secType = (item.levelName as SectionLevel) || 'section';
      list.push({
        id: `${normFile}:${item.line}`,
        title: item.title || 'Untitled Section',
        level: item.level ?? SECTION_LEVEL_WEIGHT[secType] ?? 2,
        type: secType,
        line: item.line || 1,
        sourceFile: normFile,
        hasStar: false,
      });
      this.outlineEntries.set(normFile, list);
    }

    this.version++;
    return this.exportSnapshot();
  }

  /**
   * Lightweight single-file symbol update for active buffer edits before server flush.
   */
  public indexFile(fileId: string, filePath: string, content: string): void {
    const normPath = (filePath || fileId).replace(/\\/g, '/').replace(/^\/+/, '');
    this.knownFiles.add(normPath);
    this.filePaths.set(fileId, normPath);

    if (normPath.endsWith('.bib')) {
      const fileBibMap = new Map<string, BibEntry>();
      for (const entry of parseBibContent(content, normPath)) {
        fileBibMap.set(entry.key, entry);
      }
      this.bibEntries.set(fileId, fileBibMap);
      if (normPath !== fileId) this.bibEntries.delete(normPath);
      this.version++;
      return;
    }

    if (
      !normPath.endsWith('.tex') &&
      !normPath.endsWith('.ltx') &&
      !normPath.endsWith('.sty') &&
      !normPath.endsWith('.cls') &&
      !normPath.endsWith('.bbl')
    ) {
      this.version++;
      return;
    }

    if (normPath !== fileId) {
      this.labelEntries.delete(normPath);
      this.commandEntries.delete(normPath);
      this.environmentEntries.delete(normPath);
      this.outlineEntries.delete(normPath);
    }

    const fileLabelMap = new Map<string, LabelEntry>();
    const fileCommandMap = new Map<string, CommandEntry>();
    const fileEnvironmentMap = new Map<string, EnvironmentEntry>();
    const fileOutlineItems: OutlineItem[] = [];

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i] ?? '';
      const commentIdx = rawLine.search(/(?<!\\)%/);
      const line = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
      if (!line.trim()) continue;
      const lineNum = i + 1;

      let m: RegExpExecArray | null;
      const labelRe = /\\label\{([^}]{1,80})\}/g;
      while ((m = labelRe.exec(line)) !== null) {
        const name = m[1].trim();
        if (name) {
          fileLabelMap.set(name, {
            name,
            type: inferLabelType(name),
            line: lineNum,
            sourceFile: normPath,
          });
        }
      }

      const cmdRe = /\\(?:re|provide)?newcommand\*?\s*\{?\s*\\([a-zA-Z@]+)\s*\}?(?:\s*\[(\d+)\])?/g;
      while ((m = cmdRe.exec(line)) !== null) {
        const name = `\\${m[1]}`;
        fileCommandMap.set(name, {
          name,
          argsCount: m[2] ? parseInt(m[2], 10) : 0,
          sourceFile: normPath,
        });
      }

      const envRe = /\\(?:newtheorem|(?:re)?newenvironment)\*?\{([a-zA-Z*0-9_]+)\}/g;
      while ((m = envRe.exec(line)) !== null) {
        const name = m[1].trim();
        fileEnvironmentMap.set(name, {
          name,
          sourceFile: normPath,
          line: lineNum,
        });
      }

      const secMatch = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)(\*?)\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/.exec(line);
      if (secMatch) {
        const type = secMatch[1] as SectionLevel;
        fileOutlineItems.push({
          id: `${normPath}:${lineNum}`,
          title: secMatch[3].trim() || 'Untitled Section',
          level: SECTION_LEVEL_WEIGHT[type] ?? 2,
          type,
          line: lineNum,
          sourceFile: normPath,
          hasStar: secMatch[2] === '*',
        });
      }
    }

    this.labelEntries.set(fileId, fileLabelMap);
    this.commandEntries.set(fileId, fileCommandMap);
    this.environmentEntries.set(fileId, fileEnvironmentMap);
    this.outlineEntries.set(fileId, fileOutlineItems);
    this.version++;
  }

  public removeFile(fileId: string, filePath?: string): void {
    const prevPath = this.filePaths.get(fileId);
    for (const key of [fileId, prevPath, filePath?.replace(/\\/g, '/').replace(/^\/+/, '')]) {
      if (!key) continue;
      this.bibEntries.delete(key);
      this.labelEntries.delete(key);
      this.commandEntries.delete(key);
      this.environmentEntries.delete(key);
      this.outlineEntries.delete(key);
      this.filePaths.delete(key);
      this.knownFiles.delete(key);
    }
    this.version++;
  }

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

  public exportSnapshot(): SymbolSnapshot {
    const citations: BibEntry[] = [];
    const seenCitations = new Set<string>();
    for (const fileMap of this.bibEntries.values()) {
      for (const entry of fileMap.values()) {
        if (!seenCitations.has(entry.key)) {
          seenCitations.add(entry.key);
          citations.push(entry);
        }
      }
    }

    const labels: LabelEntry[] = [];
    const seenLabels = new Set<string>();
    for (const fileMap of this.labelEntries.values()) {
      for (const entry of fileMap.values()) {
        if (!seenLabels.has(entry.name)) {
          seenLabels.add(entry.name);
          labels.push(entry);
        }
      }
    }

    const commands: CommandEntry[] = [];
    const seenCommands = new Set<string>();
    for (const fileMap of this.commandEntries.values()) {
      for (const cmd of fileMap.values()) {
        if (!seenCommands.has(cmd.name)) {
          seenCommands.add(cmd.name);
          commands.push(cmd);
        }
      }
    }

    const environments: EnvironmentEntry[] = [];
    const seenEnvs = new Set<string>();
    for (const fileMap of this.environmentEntries.values()) {
      for (const env of fileMap.values()) {
        if (!seenEnvs.has(env.name)) {
          seenEnvs.add(env.name);
          environments.push(env);
        }
      }
    }

    const allPaths = Array.from(this.knownFiles);
    const includeFiles = allPaths.filter((p) => p.endsWith('.tex'));
    const imageFiles = allPaths.filter((p) => IMAGE_FILE_REGEX.test(p));

    const outlineByFile: Record<string, OutlineNode[]> = {};
    const flatOutlineByFile: Record<string, OutlineItem[]> = {};
    const projectFlatOutline: OutlineItem[] = [];

    for (const [fileId, items] of this.outlineEntries.entries()) {
      const path = this.filePaths.get(fileId) || fileId;
      flatOutlineByFile[path] = items;
      flatOutlineByFile[fileId] = items;
      const tree = buildOutlineTree(items);
      outlineByFile[path] = tree;
      outlineByFile[fileId] = tree;
      projectFlatOutline.push(...items);
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

  public getCitations(query = ''): BibEntry[] {
    const q = query.toLowerCase();
    const results: BibEntry[] = [];
    for (const fileMap of this.bibEntries.values()) {
      for (const entry of fileMap.values()) {
        if (
          !q ||
          entry.key.toLowerCase().includes(q) ||
          (entry.author && entry.author.toLowerCase().includes(q)) ||
          (entry.title && entry.title.toLowerCase().includes(q))
        ) {
          results.push(entry);
        }
      }
    }
    return results;
  }

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

  public getCommands(): CommandEntry[] {
    const results: CommandEntry[] = [];
    for (const fileMap of this.commandEntries.values()) {
      for (const cmd of fileMap.values()) {
        results.push(cmd);
      }
    }
    return results;
  }

  public getIncludeFiles(query = ''): string[] {
    const q = query.toLowerCase();
    return Array.from(this.knownFiles).filter(
      (path) => path.endsWith('.tex') && (!q || path.toLowerCase().includes(q)),
    );
  }

  public getImageFiles(query = ''): string[] {
    const q = query.toLowerCase();
    return Array.from(this.knownFiles).filter(
      (path) => IMAGE_FILE_REGEX.test(path) && (!q || path.toLowerCase().includes(q)),
    );
  }

  public getOutline(fileIdOrPath: string): OutlineNode[] {
    const norm = fileIdOrPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const items = this.outlineEntries.get(norm) || this.outlineEntries.get(fileIdOrPath);
    if (!items) {
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
