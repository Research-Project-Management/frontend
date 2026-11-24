/**
 * latex-visual-floats.ts
 *
 * CodeMirror 6 Visual Mode Floats Extension (Overleaf Visual Editor Parity).
 * - Renders unfocused `\begin{figure}...\end{figure}` blocks as clean preview cards
 *   showing image filename/path, options, caption, and label.
 * - Renders unfocused `\begin{table}...\end{table}` and standalone `\begin{tabular}`
 *   blocks as structured HTML tables preserving booktabs / bordered / minimal styling
 *   and column alignments (`l`, `c`, `r`).
 * - Lossless by construction: placing the cursor inside a float block (or clicking
 *   "Edit LaTeX" / double-clicking the card) immediately expands back to raw LaTeX.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import {
  RangeSetBuilder,
  StateField,
  type EditorState,
  type Extension,
  type Text,
} from '@codemirror/state';
import {
  parseLatexTabular,
  type TableAlignment,
  type TableGrid,
} from '@/features/editor/domain/latex/table-matrix';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import type { WorkspaceProjectItem } from '@/features/editor/core/coordinator/workspace-file-index';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { filestore } from '@/features/editor/sdk/pages/filestore.client';
import { fetchAuthorized, resolveFileUrl } from '@/shared/lib/file-client';
import { findBeginDocumentLine } from './latex-visual-document-shell';
import { cleanInlineLatexText, findMatchingBrace } from './latex-visual-headings';

const END_DOC_RE = /^\s*\\end\{document\}\s*(?:%.*)?$/;
const BEGIN_FLOAT_RE = /^\s*\\begin\{(figure\*?|table\*?|tabular\*?)\}(.*)$/;
const PREVIEWABLE_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const MAX_CACHED_IMAGE_BLOBS = 64;
const figureBlobUrlCache = new Map<string, string>();
const pendingBlobRequests = new Map<string, Promise<string | null>>();

function normalizeLatexAssetPath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function stripFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  return lastDot > lastSlash ? path.slice(0, lastDot) : path;
}

function getBaseName(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

export function resolveProjectImageAssetUrl(latexPath: string): string | null {
  const normQuery = normalizeLatexAssetPath(latexPath);
  if (!normQuery) return null;

  try {
    const pageState =
      typeof usePageStore?.getState === 'function' ? usePageStore.getState() : null;
    const projectFiles =
      (workspaceCoordinator?.getProjectFiles?.() as WorkspaceProjectItem[] | undefined) ??
      [];
    if (!pageState || projectFiles.length === 0) return null;

    const queryStem = stripFileExtension(normQuery);
    const queryBase = getBaseName(normQuery);
    const queryBaseStem = stripFileExtension(queryBase);

    let bestItem: WorkspaceProjectItem | null = null;
    let bestScore = 0;

    for (const item of projectFiles) {
      if (item.isFolder) continue;
      const candidates = [item.path, item.name, item.title].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      for (const cand of candidates) {
        const normCand = normalizeLatexAssetPath(cand);
        const dotIdx = normCand.lastIndexOf('.');
        const slashIdx = normCand.lastIndexOf('/');
        if (dotIdx <= slashIdx) continue;
        const ext = normCand.slice(dotIdx + 1);
        if (!PREVIEWABLE_IMAGE_EXTS.has(ext)) continue;

        const candStem = stripFileExtension(normCand);
        const candBase = getBaseName(normCand);
        const candBaseStem = stripFileExtension(candBase);

        let score = 0;
        if (normCand === normQuery) {
          score = 4;
        } else if (candStem === queryStem) {
          score = 3;
        } else if (candBase === queryBase) {
          score = 2;
        } else if (candBaseStem === queryBaseStem) {
          score = 1;
        }

        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
          if (score === 4) break;
        }
      }
      if (bestScore === 4) break;
    }

    if (!bestItem) return null;

    const projectOrSpaceId =
      bestItem.projectId ||
      pageState.spaceId ||
      pageState.projectId ||
      pageState.rootPageId ||
      pageState.parentPageId ||
      '';
    const fileId = bestItem.fileId || bestItem.id;
    if (!projectOrSpaceId || !fileId) return null;

    const pageId =
      bestItem.pageId || pageState.rootPageId || pageState.parentPageId || undefined;
    const streamUrl = filestore.getStreamUrl(projectOrSpaceId, fileId, pageId);
    return resolveFileUrl(streamUrl) || null;
  } catch {
    return null;
  }
}

async function loadAuthorizedImageBlobUrl(resolvedUrl: string): Promise<string | null> {
  const cached = figureBlobUrlCache.get(resolvedUrl);
  if (cached) return cached;

  const inflight = pendingBlobRequests.get(resolvedUrl);
  if (inflight) return inflight;

  const promise = (async (): Promise<string | null> => {
    try {
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return null;
      }
      const res = await fetchAuthorized(resolvedUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (figureBlobUrlCache.size >= MAX_CACHED_IMAGE_BLOBS) {
        const oldestKey = figureBlobUrlCache.keys().next().value;
        if (oldestKey) {
          const oldestUrl = figureBlobUrlCache.get(oldestKey);
          figureBlobUrlCache.delete(oldestKey);
          if (oldestUrl && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(oldestUrl);
          }
        }
      }
      figureBlobUrlCache.set(resolvedUrl, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      pendingBlobRequests.delete(resolvedUrl);
    }
  })();

  pendingBlobRequests.set(resolvedUrl, promise);
  return promise;
}

interface FloatBlockMatch {
  readonly baseKind: 'figure' | 'table' | 'tabular';
  readonly envName: string;
  readonly from: number;
  readonly to: number;
  readonly raw: string;
}

interface FigureImageInfo {
  readonly path: string;
  readonly options: string;
}

interface FigureMetadata {
  readonly images: FigureImageInfo[];
  readonly caption?: string;
  readonly label?: string;
}

function stripLatexLineComments(text: string): string {
  return text.replace(/(^|[^\\])%.*$/gm, '$1');
}

function extractBalancedCommand(text: string, prefixPattern: RegExp): string | undefined {
  const re = new RegExp(prefixPattern.source, 'g');
  const match = re.exec(text);
  if (!match) return undefined;
  const openBrace = match.index + match[0].length - 1;
  const closeBrace = findMatchingBrace(text, openBrace);
  if (closeBrace === null) return undefined;
  const value = text.slice(openBrace + 1, closeBrace).trim();
  return value || undefined;
}

function parseFigureMetadata(rawBlock: string): FigureMetadata {
  const cleaned = stripLatexLineComments(rawBlock);
  const images: FigureImageInfo[] = [];

  const imgRegex = /\\includegraphics\*?(?:\s*\[([^\]]*)\])?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(cleaned)) !== null) {
    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(cleaned, openBrace);
    if (closeBrace !== null) {
      const path = cleaned.slice(openBrace + 1, closeBrace).trim();
      if (path) {
        images.push({
          path,
          options: match[1]?.trim() ?? '',
        });
      }
      imgRegex.lastIndex = closeBrace + 1;
    }
  }

  const rawCaption = extractBalancedCommand(
    cleaned,
    /\\caption\*?(?:\s*\[[^\]]*\])?\s*\{/,
  );
  const caption = rawCaption ? cleanInlineLatexText(rawCaption) : undefined;
  const label = extractBalancedCommand(cleaned, /\\label\s*\{/);

  return { images, caption, label };
}

function findFloatBlocks(doc: Text): FloatBlockMatch[] {
  if (doc.length === 0) return [];

  const beginDocLine = findBeginDocumentLine(doc);
  const bodyStartLine = beginDocLine ? beginDocLine.number + 1 : 1;

  const blocks: FloatBlockMatch[] = [];
  let active: {
    baseKind: 'figure' | 'table' | 'tabular';
    envName: string;
    from: number;
    nesting: number;
  } | null = null;

  for (let l = bodyStartLine; l <= doc.lines; l++) {
    const line = doc.line(l);
    const text = line.text;

    if (END_DOC_RE.test(text)) {
      break;
    }

    if (!active) {
      const beginMatch = BEGIN_FLOAT_RE.exec(text);
      if (!beginMatch) continue;

      const envName = beginMatch[1]!;
      const restOfLine = beginMatch[2] ?? '';
      const baseKind = envName.startsWith('figure')
        ? 'figure'
        : envName.startsWith('table')
          ? 'table'
          : 'tabular';

      const escapedEnv = envName.replace(/\*/g, '\\*');
      const sameLineEndRe = new RegExp(`\\\\end\\{${escapedEnv}\\}`);
      if (sameLineEndRe.test(restOfLine)) {
        blocks.push({
          baseKind,
          envName,
          from: line.from,
          to: line.to,
          raw: doc.sliceString(line.from, line.to),
        });
        continue;
      }

      active = {
        baseKind,
        envName,
        from: line.from,
        nesting: 1,
      };
      continue;
    }

    // Track nesting of identical environment names until matching \end{envName}
    const lineNoComment = stripLatexLineComments(text);
    const escapedEnv = active.envName.replace(/\*/g, '\\*');
    const nestedBeginRe = new RegExp(`\\\\begin\\{${escapedEnv}\\}`, 'g');
    const nestedEndRe = new RegExp(`\\\\end\\{${escapedEnv}\\}`, 'g');

    const beginsOnLine = lineNoComment.match(nestedBeginRe)?.length ?? 0;
    const endsOnLine = lineNoComment.match(nestedEndRe)?.length ?? 0;
    active.nesting += beginsOnLine - endsOnLine;

    if (active.nesting <= 0) {
      blocks.push({
        baseKind: active.baseKind,
        envName: active.envName,
        from: active.from,
        to: line.to,
        raw: doc.sliceString(active.from, line.to),
      });
      active = null;
    }
  }

  return blocks;
}

function focusRawLatex(view: EditorView, pos: number): void {
  const safePos = Math.max(0, Math.min(pos, view.state.doc.length));
  view.dispatch({
    selection: { anchor: safePos },
    scrollIntoView: true,
  });
  view.focus();
}

function createImageSvgIcon(): SVGSVGElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const rect = document.createElementNS(svgNs, 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '3');
  rect.setAttribute('width', '18');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '2');

  const circle = document.createElementNS(svgNs, 'circle');
  circle.setAttribute('cx', '8.5');
  circle.setAttribute('cy', '8.5');
  circle.setAttribute('r', '1.5');

  const path = document.createElementNS(svgNs, 'polyline');
  path.setAttribute('points', '21 15 16 10 5 21');

  svg.append(rect, circle, path);
  return svg;
}

interface FloatCardShellOptions {
  readonly view: EditorView;
  readonly blockFrom: number;
  readonly kindClass: string;
  readonly badgeText: string;
  readonly metaText?: string;
  readonly label?: string;
  readonly wizardButtonLabel?: string;
  readonly wizardButtonTitle?: string;
  readonly onWizardClick?: () => void;
}

function selectBlockAndOpenDialog(
  view: EditorView,
  blockFrom: number,
  blockTo: number,
  dialog: 'table-wizard' | 'figure-wizard',
  payload?: { initialTab?: string; initialLatex?: string },
): void {
  const docLen = view.state.doc.length;
  const safeFrom = Math.max(0, Math.min(blockFrom, docLen));
  const safeTo = Math.max(safeFrom, Math.min(blockTo, docLen));
  view.dispatch({
    selection: { anchor: safeFrom, head: safeTo },
    scrollIntoView: true,
  });
  editorCommandBus.dispatch({
    type: 'dialog:open',
    dialog,
    ...(payload ? { payload } : {}),
  });
}

function createFloatCardShell(opts: FloatCardShellOptions): {
  card: HTMLElement;
  body: HTMLElement;
} {
  const card = document.createElement('div');
  card.className = `cm-visual-float-card ${opts.kindClass}`;
  card.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    focusRawLatex(opts.view, opts.blockFrom);
  });

  const header = document.createElement('div');
  header.className = 'cm-visual-float-header';

  const left = document.createElement('div');
  left.className = 'cm-visual-float-header-left';

  const badge = document.createElement('span');
  badge.className = 'cm-visual-float-badge';
  badge.textContent = opts.badgeText;
  left.appendChild(badge);

  if (opts.metaText) {
    const meta = document.createElement('span');
    meta.className = 'cm-visual-float-meta';
    meta.textContent = opts.metaText;
    left.appendChild(meta);
  }

  if (opts.label) {
    const labelEl = document.createElement('code');
    labelEl.className = 'cm-visual-float-label';
    labelEl.textContent = opts.label;
    left.appendChild(labelEl);
  }

  const actions = document.createElement('div');
  actions.className = 'cm-visual-float-actions';

  if (opts.onWizardClick) {
    const wizardBtn = document.createElement('button');
    wizardBtn.type = 'button';
    wizardBtn.className = 'cm-visual-float-wizard-btn';
    wizardBtn.textContent = opts.wizardButtonLabel ?? 'Edit Table';
    wizardBtn.title = opts.wizardButtonTitle ?? 'Open interactive Wizard for this block';
    wizardBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onWizardClick!();
    });
    actions.appendChild(wizardBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'cm-visual-float-edit-btn';
  editBtn.textContent = 'Edit LaTeX';
  editBtn.title = 'Click or place cursor inside to edit raw LaTeX';
  editBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    focusRawLatex(opts.view, opts.blockFrom);
  });
  actions.appendChild(editBtn);

  header.append(left, actions);

  const body = document.createElement('div');
  body.className = 'cm-visual-float-body';

  card.append(header, body);
  return { card, body };
}

class FigureCardWidget extends WidgetType {
  private readonly rawKey: string;

  constructor(
    readonly blockFrom: number,
    readonly blockTo: number,
    readonly meta: FigureMetadata,
  ) {
    super();
    this.rawKey = JSON.stringify(meta);
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof FigureCardWidget &&
      other.blockFrom === this.blockFrom &&
      other.blockTo === this.blockTo &&
      other.rawKey === this.rawKey
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const { card, body } = createFloatCardShell({
      view,
      blockFrom: this.blockFrom,
      kindClass: 'cm-visual-figure-card',
      badgeText: 'Figure',
      metaText:
        this.meta.images.length > 1
          ? `${this.meta.images.length} images`
          : undefined,
      label: this.meta.label,
      wizardButtonLabel: 'Edit Figure',
      wizardButtonTitle: 'Open Figure Wizard to replace or adjust figure',
      onWizardClick: () => {
        selectBlockAndOpenDialog(view, this.blockFrom, this.blockTo, 'figure-wizard');
      },
    });

    const preview = document.createElement('div');
    preview.className = 'cm-visual-figure-preview';

    if (this.meta.images.length === 0) {
      const emptyRow = document.createElement('div');
      emptyRow.className = 'cm-visual-figure-item';
      const iconWrap = document.createElement('span');
      iconWrap.className = 'cm-visual-figure-icon';
      iconWrap.appendChild(createImageSvgIcon());
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cm-visual-figure-path';
      nameSpan.textContent = 'Figure block';
      emptyRow.append(iconWrap, nameSpan);
      preview.appendChild(emptyRow);
    } else {
      for (const img of this.meta.images) {
        const row = document.createElement('div');
        row.className = 'cm-visual-figure-item';

        const iconWrap = document.createElement('span');
        iconWrap.className = 'cm-visual-figure-icon';
        iconWrap.appendChild(createImageSvgIcon());

        const info = document.createElement('div');
        info.className = 'cm-visual-figure-info';

        const pathEl = document.createElement('div');
        pathEl.className = 'cm-visual-figure-path';
        pathEl.textContent = img.path;
        info.appendChild(pathEl);

        if (img.options) {
          const optsEl = document.createElement('div');
          optsEl.className = 'cm-visual-figure-options';
          optsEl.textContent = img.options;
          info.appendChild(optsEl);
        }

        row.append(iconWrap, info);
        preview.appendChild(row);

        const resolvedAssetUrl = resolveProjectImageAssetUrl(img.path);
        if (resolvedAssetUrl) {
          const thumbWrap = document.createElement('div');
          thumbWrap.className = 'cm-visual-figure-thumb-wrap';
          thumbWrap.style.display = 'none';

          const thumbImg = document.createElement('img');
          thumbImg.className = 'cm-visual-figure-thumb';
          thumbImg.alt = img.path;
          thumbWrap.appendChild(thumbImg);
          preview.appendChild(thumbWrap);

          const cachedBlobUrl = figureBlobUrlCache.get(resolvedAssetUrl);
          if (cachedBlobUrl) {
            thumbImg.src = cachedBlobUrl;
            thumbWrap.style.display = 'flex';
          } else {
            void loadAuthorizedImageBlobUrl(resolvedAssetUrl).then((blobUrl) => {
              if (!thumbWrap.isConnected) return;
              if (blobUrl) {
                thumbImg.src = blobUrl;
                thumbWrap.style.display = 'flex';
              } else {
                thumbWrap.remove();
              }
            });
          }
        }
      }
    }

    body.appendChild(preview);

    if (this.meta.caption) {
      const captionEl = document.createElement('div');
      captionEl.className = 'cm-visual-float-caption';
      captionEl.textContent = this.meta.caption;
      body.appendChild(captionEl);
    }

    return card;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function mapAlignment(align: TableAlignment | undefined): 'left' | 'center' | 'right' {
  if (align === 'l') return 'left';
  if (align === 'r') return 'right';
  return 'center';
}

function getTotalGridRows(grid: TableGrid): number {
  return (grid.hasHeaderRow ? 1 : 0) + grid.data.length;
}

class TableCardWidget extends WidgetType {
  private readonly rawKey: string;

  constructor(
    readonly blockFrom: number,
    readonly blockTo: number,
    readonly rawBlock: string,
    readonly grid: TableGrid,
  ) {
    super();
    this.rawKey = JSON.stringify(grid);
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof TableCardWidget &&
      other.blockFrom === this.blockFrom &&
      other.blockTo === this.blockTo &&
      other.rawKey === this.rawKey
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const totalRows = getTotalGridRows(this.grid);
    const captionText = this.grid.caption
      ? cleanInlineLatexText(this.grid.caption)
      : '';

    const { card, body } = createFloatCardShell({
      view,
      blockFrom: this.blockFrom,
      kindClass: 'cm-visual-table-card',
      badgeText: 'Table',
      metaText: `${totalRows} × ${this.grid.cols}`,
      label: this.grid.label || undefined,
      wizardButtonLabel: 'Edit Table',
      wizardButtonTitle: 'Open interactive Table Wizard for this table',
      onWizardClick: () => {
        selectBlockAndOpenDialog(view, this.blockFrom, this.blockTo, 'table-wizard', {
          initialTab: 'table',
          initialLatex: this.rawBlock,
        });
      },
    });

    if (captionText) {
      const captionEl = document.createElement('div');
      captionEl.className = 'cm-visual-float-caption';
      captionEl.textContent = captionText;
      body.appendChild(captionEl);
    }

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'cm-visual-table-scroll';

    const table = document.createElement('table');
    table.className = `cm-visual-table cm-visual-table-${this.grid.style}`;

    if (this.grid.hasHeaderRow && this.grid.headers.length > 0) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      for (let c = 0; c < this.grid.cols; c++) {
        const th = document.createElement('th');
        th.style.textAlign = mapAlignment(this.grid.alignments[c]);
        th.textContent = this.grid.headers[c] ?? '';
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    for (const row of this.grid.data) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.grid.cols; c++) {
        const td = document.createElement('td');
        td.style.textAlign = mapAlignment(this.grid.alignments[c]);
        td.textContent = row[c] ?? '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    scrollWrap.appendChild(table);
    body.appendChild(scrollWrap);

    return card;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function computeFloatDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  if (doc.length === 0) return Decoration.none;

  const selection = state.selection.main;
  const blocks = findFloatBlocks(doc);
  if (blocks.length === 0) return Decoration.none;

  const builder = new RangeSetBuilder<Decoration>();
  for (const block of blocks) {
    // Expand cleanly back to raw LaTeX when cursor enters this float block
    const isCursorInside = selection.from <= block.to && selection.to >= block.from;
    if (isCursorInside) continue;

    if (block.baseKind === 'figure') {
      const cleaned = stripLatexLineComments(block.raw);
      const meta = parseFigureMetadata(block.raw);
      const hasTikz = /\\begin\{tikzpicture\}/.test(cleaned);
      if (hasTikz && meta.images.length === 0) {
        continue;
      }
      if (meta.images.length === 0 && !meta.caption && !meta.label) {
        continue;
      }

      builder.add(
        block.from,
        block.to,
        Decoration.replace({
          widget: new FigureCardWidget(block.from, block.to, meta),
          block: true,
        }),
      );
      continue;
    }

    // `table` or standalone `tabular`
    const grid = parseLatexTabular(block.raw);
    if (!grid || getTotalGridRows(grid) === 0) {
      continue;
    }

    builder.add(
      block.from,
      block.to,
      Decoration.replace({
        widget: new TableCardWidget(block.from, block.to, block.raw, grid),
        block: true,
      }),
    );
  }

  return builder.finish();
}

export const visualFloatsField = StateField.define<DecorationSet>({
  create(state) {
    return computeFloatDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged || tr.selection) {
      return computeFloatDecorations(tr.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const visualFloatsTheme = EditorView.baseTheme({
  '.cm-visual-float-card': {
    margin: '12px 0',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    backgroundColor: 'var(--card)',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
    userSelect: 'none',
  },
  '.cm-visual-float-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '7px 12px',
    backgroundColor: 'var(--muted)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  '.cm-visual-float-header-left': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '0',
    flexWrap: 'wrap',
  },
  '.cm-visual-float-badge': {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 8px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'var(--accent)',
    color: 'var(--foreground)',
  },
  '.cm-visual-float-meta': {
    fontSize: '11.5px',
    color: 'var(--muted-foreground)',
  },
  '.cm-visual-float-label': {
    fontSize: '11px',
    padding: '1px 6px',
    borderRadius: '4px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
  },
  '.cm-visual-float-actions': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: '0',
  },
  '.cm-visual-float-edit-btn, .cm-visual-float-wizard-btn': {
    fontSize: '11px',
    fontWeight: '500',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    color: 'var(--muted-foreground)',
    cursor: 'pointer',
    flexShrink: '0',
  },
  '.cm-visual-float-edit-btn:hover, .cm-visual-float-wizard-btn:hover': {
    color: 'var(--foreground)',
    borderColor: 'var(--primary)',
  },
  '.cm-visual-float-body': {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  '.cm-visual-figure-preview': {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'var(--muted)',
  },
  '.cm-visual-figure-item': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  '.cm-visual-figure-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    color: 'var(--primary)',
    flexShrink: '0',
  },
  '.cm-visual-figure-info': {
    minWidth: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  '.cm-visual-figure-path': {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--foreground)',
    wordBreak: 'break-all',
  },
  '.cm-visual-figure-options': {
    fontSize: '11.5px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--muted-foreground)',
  },
  '.cm-visual-figure-thumb-wrap': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '6px',
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border-subtle)',
  },
  '.cm-visual-figure-thumb': {
    maxHeight: '220px',
    maxWidth: '100%',
    objectFit: 'contain',
    borderRadius: '6px',
  },
  '.cm-visual-float-caption': {
    fontSize: '13px',
    lineHeight: '1.45',
    color: 'var(--muted-foreground)',
  },
  '.cm-visual-table-scroll': {
    overflowX: 'auto',
  },
  '.cm-visual-table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--foreground)',
  },
  '.cm-visual-table th, .cm-visual-table td': {
    padding: '6px 10px',
  },
  '.cm-visual-table th': {
    fontWeight: '600',
  },
  '.cm-visual-table-booktabs thead th': {
    borderTop: '2px solid var(--foreground)',
    borderBottom: '1px solid var(--muted-foreground)',
  },
  '.cm-visual-table-booktabs tbody tr:last-child td': {
    borderBottom: '2px solid var(--foreground)',
  },
  '.cm-visual-table-bordered th, .cm-visual-table-bordered td': {
    border: '1px solid var(--border)',
  },
  '.cm-visual-table-minimal th': {
    borderBottom: '1px solid var(--border)',
  },
  '.cm-visual-table-minimal td': {
    borderBottom: '1px solid var(--border-subtle)',
  },
});

export const latexVisualFloats = (): Extension => [
  visualFloatsField,
  visualFloatsTheme,
];
