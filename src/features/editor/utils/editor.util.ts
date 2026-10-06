/**
 * editor.util.ts — Monaco Editor utilities & LaTeX context builder
 */

import { API_BASE_URL } from '@/config/env';
import { editorCommandBus } from '../core/command-bus/editor-command-bus';
import type { SidebarPanelName } from '../ports/command-bus.port';

const _inMemoryEventHandlers = new Map<string, Set<(payload: any) => void>>();

const _inMemoryEventBus = {
  emit(event: string, detail?: any): void {
    const handlers = _inMemoryEventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(detail);
        } catch (err) {
          console.error(`[EditorEventBus] Error in listener for "${event}":`, err);
        }
      }
    }
  },
  on(event: string, handler: (detail: any) => void): () => void {
    if (!_inMemoryEventHandlers.has(event)) {
      _inMemoryEventHandlers.set(event, new Set());
    }
    const set = _inMemoryEventHandlers.get(event)!;
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        _inMemoryEventHandlers.delete(event);
      }
    };
  },
};

// ── Document Structure ────────────────────────────────────────────────────────

export interface LatexSection {
  level: "section" | "subsection" | "subsubsection";
  title: string;
  startLine: number;
}

export interface LatexEnvironment {
  type: string;
  startLine: number;
  endLine: number;
}

export interface LatexStructure {
  sections: LatexSection[];
  environments: LatexEnvironment[];
  packages: string[];
  labels: string[];
  citations: string[];
  totalLines: number;
}

export function parseLatexStructure(content: any): LatexStructure {
  const str = typeof content === 'string'
    ? content
    : content && typeof content === 'object'
      ? (content.source || content.text || content.content || '')
      : '';
  const lines = str.split("\n");
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];

  const envStack: { type: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1; // 1-based

    // Sections
    const secMatch = line.match(/\\((?:sub){0,2}section)\*?\{([^}]*)\}/);
    if (secMatch) {
      const raw = secMatch[1] as string;
      const level =
        raw === "section"
          ? "section"
          : raw === "subsection"
            ? "subsection"
            : "subsubsection";
      sections.push({ level, title: secMatch[2], startLine: ln });
    }

    // Packages
    const pkgMatch = line.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (pkgMatch) {
      pkgMatch[1].split(",").forEach((p: string) => {
        const pkg = p.trim();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      });
    }

    // Labels
    const labelMatch = line.match(/\\label\{([^}]+)\}/);
    if (labelMatch && !labels.includes(labelMatch[1])) {
      labels.push(labelMatch[1]);
    }

    // Citations
    const citeMatch = line.match(/\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g);
    if (citeMatch) {
      citeMatch.forEach((m: string) => {
        const inner = m.match(/\{([^}]+)\}/)?.[1] ?? "";
        inner.split(",").forEach((c: string) => {
          const cite = c.trim();
          if (cite && !citations.includes(cite)) citations.push(cite);
        });
      });
    }

    // Environments
    const beginMatch = line.match(/\\begin\{([^}]+)\}/);
    if (beginMatch) envStack.push({ type: beginMatch[1], startLine: ln });

    const endMatch = line.match(/\\end\{([^}]+)\}/);
    if (endMatch && envStack.length > 0) {
      const top = envStack[envStack.length - 1];
      if (top.type === endMatch[1]) {
        envStack.pop();
        if (top.type !== "document") {
          environments.push({ type: top.type, startLine: top.startLine, endLine: ln });
        }
      }
    }
  }

  return { sections, environments, packages, labels, citations, totalLines: lines.length };
}

/** Find what section and environment a line falls inside */
export function getLineContext(
  lineNumber: number,
  structure: LatexStructure,
): { section: string | null; environment: string | null } {
  let section: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= lineNumber) section = `\\${s.level}{${s.title}}`;
    else break;
  }

  let environment: string | null = null;
  for (const env of structure.environments) {
    if (env.startLine <= lineNumber && env.endLine >= lineNumber) {
      environment = env.type;
    }
  }

  return { section, environment };
}

// ── Compile Error Parser ───────────────────────────────────────────────────────

export interface ParsedCompileError {
  line: number | null;
  message: string;
  context: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

/** Parse pdflatex/xelatex/tectonic log to extract error and warning entries */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  const errors: ParsedCompileError[] = [];
  const lines = log.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File:line error: ./main.tex:14: Undefined control sequence
    const fileLineMatch = line.match(/^(\.{0,2}\/?[^\s:!]+\.(?:tex|bib|sty|cls)):(\d+):\s*(.+)$/i);
    if (fileLineMatch) {
      const file = fileLineMatch[1].replace(/^\.\//, '');
      const lineNum = parseInt(fileLineMatch[2], 10);
      const message = fileLineMatch[3].trim();
      if (!errors.find((e) => e.message === message && e.line === lineNum && e.file === file)) {
        errors.push({
          file,
          line: lineNum,
          message,
          context: line,
          severity: 'error',
        });
      }
      continue;
    }

    // LaTeX hard error: ! Error message
    if (line.startsWith("!")) {
      const message = line.slice(1).trim();
      let errorLine: number | null = null;
      let context = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)/);
        if (m) {
          errorLine = parseInt(m[1], 10);
          context = lines.slice(i, j + 2).join("\n");
          break;
        }
      }
      if (!context) context = lines.slice(i, i + 4).join("\n");

      if (!errors.find((e) => e.message === message && e.line === errorLine)) {
        errors.push({ line: errorLine, message, context, severity: 'error' });
      }
      continue;
    }

    // Warning: Undefined reference / citation / LaTeX Warning
    const warnMatch = line.match(/(?:LaTeX|Package [^\s]+) Warning:.*?(?:on input line (\d+)|input line (\d+))/i);
    if (warnMatch) {
      const warnLine = parseInt(warnMatch[1] || warnMatch[2], 10);
      const message = line.replace(/^(?:LaTeX|Package [^\s]+) Warning:\s*/i, "").trim();
      if (!errors.find((e) => e.message === message && e.line === warnLine)) {
        errors.push({ line: warnLine, message, context: line, severity: 'warning' });
      }
    }
  }

  return errors.slice(0, 50);
}

// ── Rich Editor Context ────────────────────────────────────────────────────────

export interface RichEditorContext {
  fileContent: string;
  filename: string;
  totalLines: number;

  hasSelection: boolean;
  selectedText: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  selectedLineCount: number;
  selectedCharCount: number;
  selectedWordCount: number;

  contextBefore: string;
  contextAfter: string;

  currentSection: string | null;
  currentEnvironment: string | null;

  structure: LatexStructure;

  cursorLine: number;
  cursorCol: number;
  cursorContext: string;
}

export function buildRichContext(
  editor: any,
  filename: string,
): RichEditorContext {
  const model = editor.getModel();
  const fullContent = model?.getValue() ?? "";
  const totalLines = model?.getLineCount() ?? 0;
  const position = editor.getPosition();
  const selectionRange = editor.getSelection();

  const cursorLine = position?.lineNumber ?? 1;
  const cursorCol = position?.column ?? 1;

  const ctxStart = Math.max(1, cursorLine - 10);
  const ctxEnd = Math.min(totalLines, cursorLine + 10);
  const cursorContext = Array.from(
    { length: ctxEnd - ctxStart + 1 },
    (_, i) => model?.getLineContent(ctxStart + i) ?? "",
  ).join("\n");

  const hasSelection =
    !!selectionRange &&
    (selectionRange.startLineNumber !== selectionRange.endLineNumber ||
      selectionRange.startColumn !== selectionRange.endColumn);

  const selectedText = hasSelection && selectionRange && model
    ? model.getValueInRange(selectionRange)
    : "";

  const startLine = selectionRange?.startLineNumber ?? cursorLine;
  const endLine = selectionRange?.endLineNumber ?? cursorLine;
  const startCol = selectionRange?.startColumn ?? cursorCol;
  const endCol = selectionRange?.endColumn ?? cursorCol;

  const selectedLineCount = endLine - startLine + 1;
  const selectedCharCount = selectedText.length;
  const selectedWordCount = selectedText
    ? selectedText.split(/\s+/).filter(Boolean).length
    : 0;

  const surStart = Math.max(1, startLine - 15);
  const surEnd = Math.min(totalLines, endLine + 15);

  const contextBefore = Array.from(
    { length: Math.max(0, startLine - surStart) },
    (_, i) => model?.getLineContent(surStart + i) ?? "",
  ).join("\n");

  const contextAfter = Array.from(
    { length: Math.max(0, surEnd - endLine) },
    (_, i) => model?.getLineContent(endLine + 1 + i) ?? "",
  ).join("\n");

  const structure = parseLatexStructure(fullContent);
  const { section, environment } = getLineContext(startLine, structure);

  return {
    fileContent: fullContent,
    filename,
    totalLines,
    hasSelection,
    selectedText,
    startLine,
    endLine,
    startCol,
    endCol,
    selectedLineCount,
    selectedCharCount,
    selectedWordCount,
    contextBefore,
    contextAfter,
    currentSection: section,
    currentEnvironment: environment,
    structure,
    cursorLine,
    cursorCol,
    cursorContext,
  };
}

/** Format rich context into a system-prompt-friendly string */
export function formatContextForPrompt(ctx: RichEditorContext): string {
  const parts: string[] = [];

  parts.push(`File: ${ctx.filename} (${ctx.totalLines} lines total)`);

  if (ctx.currentSection) parts.push(`Current section: ${ctx.currentSection}`);
  if (ctx.currentEnvironment) parts.push(`Inside environment: \\begin{${ctx.currentEnvironment}}`);

  if (ctx.structure.packages.length > 0) {
    parts.push(`Packages: ${ctx.structure.packages.slice(0, 10).join(", ")}`);
  }
  if (ctx.structure.labels.length > 0) {
    parts.push(`Defined labels: ${ctx.structure.labels.slice(0, 15).join(", ")}`);
  }

  if (ctx.hasSelection) {
    const range =
      ctx.startLine === ctx.endLine
        ? `line ${ctx.startLine}`
        : `lines ${ctx.startLine}–${ctx.endLine}`;
    parts.push(`\nSelected (${range}, ${ctx.selectedWordCount} words):\n\`\`\`latex\n${ctx.selectedText}\n\`\`\``);
    if (ctx.contextBefore) parts.push(`\nContext before:\n\`\`\`latex\n${ctx.contextBefore}\n\`\`\``);
    if (ctx.contextAfter) parts.push(`\nContext after:\n\`\`\`latex\n${ctx.contextAfter}\n\`\`\``);
  } else {
    parts.push(`Cursor at line ${ctx.cursorLine}, col ${ctx.cursorCol}`);
    parts.push(`\nSurrounding context:\n\`\`\`latex\n${ctx.cursorContext}\n\`\`\``);
  }

  return parts.join("\n");
}

// ── File URL Resolution ────────────────────────────────────────────────────────

/** Resolve a relative backend file URL to an absolute URL. */
export function resolveFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return '';
  if (
    fileUrl.startsWith('http://') ||
    fileUrl.startsWith('https://') ||
    fileUrl.startsWith('blob:')
  ) {
    return fileUrl;
  }
  const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${API_BASE_URL}${cleanUrl}`;
}

// ── Strongly-Typed Event Bus ──────────────────────────────────────────────────

export type SidebarTabName = 'Files' | 'Explorer' | 'Outline' | 'Search' | 'Review' | 'History' | 'Chat' | 'AI' | 'Settings' | 'Citations';

export interface EditorEventMap {
  'flux:open-panel': SidebarTabName | { panel: SidebarTabName; query?: string; commentId?: string; suggestionId?: string };
  'flux:toggle-panel': SidebarTabName;
  'flux:review-event': { pageId: string; event: string; payload?: any };
  'flux:autofix': undefined;
  'flux:lint-page': undefined;
  'flux:lint-project': { projectId?: string } | undefined;
  'flux:open-suggestion-widget': { suggestionId: string; x?: number; y?: number };
  'flux:open-ai-panel': { initialPrompt?: string; selectedText?: string } | undefined;
  'flux:toggle-ai-panel': undefined;
  'flux:open-chat-panel': { initialPrompt?: string; selectedText?: string } | undefined;
  'flux:toggle-chat-panel': undefined;
  'flux:trigger-compile': { forceSync?: boolean; draft?: boolean } | undefined;
  'flux:compile-started': undefined;
  'flux:compile-progress': { status?: string; logs?: string[] };
  'flux:compile-finished': { success: boolean; aborted?: boolean };
  'flux:insert-citation': { bibKey: string; textInserted?: boolean; entry?: any };
  'flux:open-citation-picker': { initialQuery?: string; initialKey?: string } | undefined;
  'flux:open-table-wizard': { initialSnippet?: string } | undefined;
  'flux:open-figure-wizard': undefined;
  'flux:open-symbol-palette': undefined;
  'flux:focus-editor': undefined;
  'flux:toggle-sidebar': undefined;
  'flux:open-word-count': undefined;
  'flux:synctex-forward': undefined;
  'flux:synctex-backward': undefined;
  'flux:new-file': undefined;
  'flux:new-folder': undefined;
  'flux:upload-file': undefined;
  'flux:zoom-in': undefined;
  'flux:zoom-out': undefined;
  'flux:zoom-fit-width': undefined;
  'flux:zoom-fit-height': undefined;
  'flux:diagnostics-updated': {
    diagnostics: any[];
    errorCount: number;
    warningCount: number;
  };
  'flux:visual-command': {
    command:
      | 'undo'
      | 'redo'
      | 'bold'
      | 'italic'
      | 'strike'
      | 'code'
      | 'heading'
      | 'bulletList'
      | 'orderedList'
      | 'blockquote'
      | 'insertMath'
      | 'clearFormatting'
      | 'paragraph'
      | 'alignLeft'
      | 'alignCenter'
      | 'alignRight'
      | 'insertTable'
      | 'addColumnBefore'
      | 'addColumnAfter'
      | 'deleteColumn'
      | 'addRowBefore'
      | 'addRowAfter'
      | 'deleteRow'
      | 'deleteTable'
      | 'toggleHeaderRow';
    level?: 1 | 2 | 3;
    rows?: number;
    cols?: number;
    withHeaderRow?: boolean;
    contentHtml?: string;
  };
}

export const EditorEventBus = {
  emit<K extends keyof EditorEventMap>(
    event: K,
    ...args: [undefined] extends [EditorEventMap[K]]
      ? [detail?: EditorEventMap[K]]
      : [detail: EditorEventMap[K]]
  ) {
    const detail = args[0];

    // 1. Dispatch strongly-typed commands into editorCommandBus
    switch (event) {
      case 'flux:open-panel': {
        const payload = detail as any;
        const panel: SidebarPanelName = typeof payload === 'string' ? payload : payload?.panel;
        if (panel) {
          editorCommandBus.dispatch({
            type: 'sidebar:open-panel',
            panel,
            query: payload?.query,
            commentId: payload?.commentId,
            suggestionId: payload?.suggestionId,
          });
        }
        break;
      }
      case 'flux:toggle-panel': {
        const panel = detail as SidebarPanelName;
        if (panel) {
          editorCommandBus.dispatch({ type: 'sidebar:toggle-panel', panel });
        }
        break;
      }
      case 'flux:trigger-compile': {
        const p = detail as any;
        editorCommandBus.dispatch({
          type: 'compiler:trigger',
          forceSync: p?.forceSync,
          draft: p?.draft,
        });
        break;
      }
      case 'flux:compile-started': {
        editorCommandBus.dispatch({ type: 'compiler:started' });
        break;
      }
      case 'flux:compile-progress': {
        const p = detail as any;
        editorCommandBus.dispatch({
          type: 'compiler:progress',
          status: p?.status,
          logs: p?.logs,
        });
        break;
      }
      case 'flux:compile-finished': {
        const p = detail as any;
        editorCommandBus.dispatch({
          type: 'compiler:finished',
          success: p?.success ?? true,
          aborted: p?.aborted,
        });
        break;
      }
      case 'flux:autofix': {
        editorCommandBus.dispatch({ type: 'editor:autofix' });
        break;
      }
      case 'flux:lint-project': {
        const p = detail as any;
        editorCommandBus.dispatch({ type: 'editor:lint-project', projectId: p?.projectId });
        break;
      }
      case 'flux:open-suggestion-widget': {
        const p = detail as any;
        if (p?.suggestionId) {
          editorCommandBus.dispatch({
            type: 'editor:open-suggestion-widget',
            suggestionId: p.suggestionId,
            x: p.x,
            y: p.y,
          });
        }
        break;
      }
      case 'flux:insert-citation': {
        const p = detail as any;
        if (p?.bibKey) {
          editorCommandBus.dispatch({
            type: 'editor:insert-citation',
            bibKey: p.bibKey,
            textInserted: p.textInserted,
            entry: p.entry,
          });
        }
        break;
      }
      case 'flux:visual-command': {
        const p = detail as any;
        if (p?.command) {
          editorCommandBus.dispatch({
            type: 'editor:visual-command',
            command: p.command,
            level: p.level,
            rows: p.rows,
            cols: p.cols,
            withHeaderRow: p.withHeaderRow,
            contentHtml: p.contentHtml,
          });
        }
        break;
      }
      case 'flux:open-word-count': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
        break;
      }
      case 'flux:open-citation-picker': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker', payload: detail });
        break;
      }
      case 'flux:open-table-wizard': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard', payload: detail });
        break;
      }
      case 'flux:open-figure-wizard': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' });
        break;
      }
      case 'flux:open-symbol-palette': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'symbol-palette' });
        break;
      }
      case 'flux:upload-file': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'upload-file' });
        break;
      }
      case 'flux:new-file': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'new-file' });
        break;
      }
      case 'flux:new-folder': {
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'new-folder' });
        break;
      }
      case 'flux:zoom-in': {
        editorCommandBus.dispatch({ type: 'viewer:zoom-in' });
        break;
      }
      case 'flux:zoom-out': {
        editorCommandBus.dispatch({ type: 'viewer:zoom-out' });
        break;
      }
      case 'flux:zoom-fit-width': {
        editorCommandBus.dispatch({ type: 'viewer:fit-width' });
        break;
      }
      case 'flux:zoom-fit-height': {
        editorCommandBus.dispatch({ type: 'viewer:fit-height' });
        break;
      }
      case 'flux:open-ai-panel': {
        const p = detail as any;
        editorCommandBus.dispatch({
          type: 'sidebar:open-ai-panel',
          initialPrompt: p?.initialPrompt,
          selectedText: p?.selectedText,
        });
        break;
      }
      case 'flux:toggle-ai-panel': {
        editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });
        break;
      }
      case 'flux:synctex-forward': {
        editorCommandBus.dispatch({ type: 'synctex:forward' });
        break;
      }
      case 'flux:synctex-backward': {
        editorCommandBus.dispatch({ type: 'synctex:backward' });
        break;
      }
      case 'flux:review-event': {
        const p = detail as any;
        if (p?.pageId && p?.event) {
          editorCommandBus.dispatch({
            type: 'editor:review-event',
            pageId: p.pageId,
            event: p.event,
            payload: p.payload,
          });
        }
        break;
      }
      default:
        break;
    }

    // 2. Also dispatch via fallback in-memory channel for any custom events
    _inMemoryEventBus.emit(event as string, detail);
  },

  on<K extends keyof EditorEventMap>(
    event: K,
    handler: (detail: EditorEventMap[K]) => void,
  ): () => void {
    const unsubs: Array<() => void> = [];

    // 1. Subscribe to typed editorCommandBus mappings
    switch (event) {
      case 'flux:open-panel': {
        unsubs.push(
          editorCommandBus.subscribe('sidebar:open-panel', (cmd) => {
            handler({
              panel: cmd.panel as any,
              query: cmd.query,
              commentId: cmd.commentId,
              suggestionId: cmd.suggestionId,
            } as any);
          })
        );
        break;
      }
      case 'flux:toggle-panel': {
        unsubs.push(
          editorCommandBus.subscribe('sidebar:toggle-panel', (cmd) => {
            handler(cmd.panel as any);
          })
        );
        break;
      }
      case 'flux:trigger-compile': {
        unsubs.push(
          editorCommandBus.subscribe('compiler:trigger', (cmd) => {
            handler({ forceSync: cmd.forceSync, draft: cmd.draft } as any);
          })
        );
        break;
      }
      case 'flux:compile-started': {
        unsubs.push(
          editorCommandBus.subscribe('compiler:started', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:compile-progress': {
        unsubs.push(
          editorCommandBus.subscribe('compiler:progress', (cmd) => {
            handler({ status: cmd.status, logs: cmd.logs } as any);
          })
        );
        break;
      }
      case 'flux:compile-finished': {
        unsubs.push(
          editorCommandBus.subscribe('compiler:finished', (cmd) => {
            handler({ success: cmd.success, aborted: cmd.aborted } as any);
          })
        );
        break;
      }
      case 'flux:autofix': {
        unsubs.push(
          editorCommandBus.subscribe('editor:autofix', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:lint-project': {
        unsubs.push(
          editorCommandBus.subscribe('editor:lint-project', (cmd) => {
            handler({ projectId: cmd.projectId } as any);
          })
        );
        break;
      }
      case 'flux:open-suggestion-widget': {
        unsubs.push(
          editorCommandBus.subscribe('editor:open-suggestion-widget', (cmd) => {
            handler({ suggestionId: cmd.suggestionId, x: cmd.x, y: cmd.y } as any);
          })
        );
        break;
      }
      case 'flux:insert-citation': {
        unsubs.push(
          editorCommandBus.subscribe('editor:insert-citation', (cmd) => {
            handler({ bibKey: cmd.bibKey, textInserted: cmd.textInserted, entry: cmd.entry } as any);
          })
        );
        break;
      }
      case 'flux:visual-command': {
        unsubs.push(
          editorCommandBus.subscribe('editor:visual-command', (cmd) => {
            handler(cmd as any);
          })
        );
        break;
      }
      case 'flux:open-word-count': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'word-count') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:open-citation-picker': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'citation-picker') handler(cmd.payload as any);
          })
        );
        break;
      }
      case 'flux:open-table-wizard': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'table-wizard') handler(cmd.payload as any);
          })
        );
        break;
      }
      case 'flux:open-figure-wizard': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'figure-wizard') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:open-symbol-palette': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'symbol-palette') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:upload-file': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'upload-file') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:new-file': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'new-file') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:new-folder': {
        unsubs.push(
          editorCommandBus.subscribe('dialog:open', (cmd) => {
            if (cmd.dialog === 'new-folder') handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:zoom-in': {
        unsubs.push(
          editorCommandBus.subscribe('viewer:zoom-in', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:zoom-out': {
        unsubs.push(
          editorCommandBus.subscribe('viewer:zoom-out', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:zoom-fit-width': {
        unsubs.push(
          editorCommandBus.subscribe('viewer:fit-width', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:zoom-fit-height': {
        unsubs.push(
          editorCommandBus.subscribe('viewer:fit-height', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:open-ai-panel': {
        unsubs.push(
          editorCommandBus.subscribe('sidebar:open-ai-panel', (cmd) => {
            handler({ initialPrompt: cmd.initialPrompt, selectedText: cmd.selectedText } as any);
          })
        );
        break;
      }
      case 'flux:toggle-ai-panel': {
        unsubs.push(
          editorCommandBus.subscribe('sidebar:toggle-ai-panel', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:synctex-forward': {
        unsubs.push(
          editorCommandBus.subscribe('synctex:forward', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:synctex-backward': {
        unsubs.push(
          editorCommandBus.subscribe('synctex:backward', () => {
            handler(undefined as any);
          })
        );
        break;
      }
      case 'flux:review-event': {
        unsubs.push(
          editorCommandBus.subscribe('editor:review-event', (cmd) => {
            handler(cmd as any);
          })
        );
        break;
      }
      default:
        break;
    }

    // 2. Also listen to fallback in-memory channel for custom events
    const unsubMemory = _inMemoryEventBus.on(event as string, handler as any);
    unsubs.push(unsubMemory);

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  },
};

// ── Strongly-Typed Command Bus ────────────────────────────────────────────────

export type LatexFormatType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'inlineMath'
  | 'displayMath'
  | 'equation'
  | 'code'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'paragraph'
  | 'itemize'
  | 'enumerate'
  | 'table'
  | 'figure'
  | 'cite'
  | 'ref'
  | 'align';

export const EditorCommandBus = {
  wrapSelection(
    editor: any,
    prefix: string,
    suffix: string,
    placeholder = '',
  ): void {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const model = editor.getModel();
    if (!model) return;

    const selectedText = model.getValueInRange(selection);
    const contentToWrap = selectedText || placeholder;
    const newText = `${prefix}${contentToWrap}${suffix}`;

    editor.executeEdits('toolbar-command', [
      { range: selection, text: newText, forceMoveMarkers: true },
    ]);

    editor.focus();
  },

  insertSnippet(
    editor: any,
    snippet: string,
  ): void {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    editor.executeEdits('toolbar-command', [
      { range: selection, text: snippet, forceMoveMarkers: true },
    ]);

    editor.focus();
  },

  format(
    editor: any,
    type: LatexFormatType,
  ): void {
    switch (type) {
      case 'bold':
        return EditorCommandBus.wrapSelection(editor, '\\textbf{', '}', 'bold text');
      case 'italic':
        return EditorCommandBus.wrapSelection(editor, '\\textit{', '}', 'italic text');
      case 'underline':
        return EditorCommandBus.wrapSelection(editor, '\\underline{', '}', 'underlined text');
      case 'inlineMath':
        return EditorCommandBus.wrapSelection(editor, '$', '$', 'x');
      case 'displayMath':
        return EditorCommandBus.wrapSelection(editor, '\\[\n', '\n\\]', 'E = mc^2');
      case 'equation':
        return EditorCommandBus.wrapSelection(
          editor,
          '\\begin{equation}\n  ',
          '\n\\end{equation}',
          'y = mx + b',
        );
      case 'code':
        return EditorCommandBus.wrapSelection(editor, '\\texttt{', '}', 'code');
      case 'strikethrough':
        return EditorCommandBus.wrapSelection(editor, '\\sout{', '}', 'text');
      case 'superscript':
        return EditorCommandBus.wrapSelection(editor, '^{', '}', '2');
      case 'subscript':
        return EditorCommandBus.wrapSelection(editor, '_{', '}', 'i');
      case 'section':
        return EditorCommandBus.wrapSelection(editor, '\\section{', '}', 'Section Title');
      case 'subsection':
        return EditorCommandBus.wrapSelection(editor, '\\subsection{', '}', 'Subsection Title');
      case 'subsubsection':
        return EditorCommandBus.wrapSelection(editor, '\\subsubsection{', '}', 'Subsubsection Title');
      case 'paragraph':
        return EditorCommandBus.wrapSelection(editor, '\\paragraph{', '}', 'Paragraph Heading');
      case 'itemize':
        return EditorCommandBus.insertSnippet(
          editor,
          '\\begin{itemize}\n  \\item First item\n  \\item Second item\n\\end{itemize}',
        );
      case 'enumerate':
        return EditorCommandBus.insertSnippet(
          editor,
          '\\begin{enumerate}\n  \\item First step\n  \\item Second step\n\\end{enumerate}',
        );
      case 'table':
        return EditorCommandBus.insertSnippet(
          editor,
          '\\begin{table}[htbp]\n  \\centering\n  \\begin{tabular}{cc}\n    \\toprule\n    Header 1 & Header 2 \\\\\n    \\midrule\n    Data 1 & Data 2 \\\\\n    \\bottomrule\n  \\end{tabular}\n  \\caption{Caption}\n  \\label{tab:my_label}\n\\end{table}',
        );
      case 'figure':
        return EditorCommandBus.insertSnippet(
          editor,
          '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{filename}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}',
        );
      case 'cite':
        return EditorCommandBus.wrapSelection(editor, '\\cite{', '}', 'citation_key');
      case 'ref':
        return EditorCommandBus.wrapSelection(editor, '\\ref{', '}', 'label_name');
      case 'align':
        return EditorCommandBus.insertSnippet(
          editor,
          '\\begin{align}\n  y &= mx + b \\\\\n  z &= ax + c\n\\end{align}',
        );
    }
  },

  undo(editor: any): void {
    if (!editor) return;
    editor.trigger('toolbar', 'undo', null);
    editor.focus();
  },

  redo(editor: any): void {
    if (!editor) return;
    editor.trigger('toolbar', 'redo', null);
    editor.focus();
  },
};

