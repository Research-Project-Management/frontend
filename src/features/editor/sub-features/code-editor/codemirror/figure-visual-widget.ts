/**
 * figure-visual-widget.ts
 *
 * Overleaf-parity Visual Figure Widget for CodeMirror 6:
 * - WYSIWYG interactive figure card for \begin{figure}...\end{figure} and \begin{figure*}...\end{figure*}
 * - Floating contextual action bar (Figure icon, label tag, [htbp] placement, actions)
 * - In-place image preview with graceful missing-asset placeholder
 * - In-place caption editor with two-way sync into LaTeX source
 * - Raw LaTeX code toggle {} with direct editing and apply
 * - Delete figure action with clean AST preservation
 * - Strict adherence to Flux Design System (no card-in-card, min 11px floor, token styling)
 */

import { WidgetType, EditorView } from '@codemirror/view';

export interface ParsedFigure {
  rawLatex: string;
  isStarred: boolean;
  placement: string;
  isCentered: boolean;
  imageSrc: string;
  imageOpts: string;
  caption: string | null;
  label: string | null;
}

/**
 * Parses LaTeX \begin{figure}...\end{figure} into structured properties
 */
export function parseLatexFigure(raw: string): ParsedFigure {
  const isStarred = /\\begin\{figure\*\}/.test(raw);
  
  const placementMatch = raw.match(/\\begin\{figure\*?\}(?:\[([^\]]*)\])?/);
  const placement = placementMatch?.[1] ? placementMatch[1].trim() : 'htbp';

  const isCentered = /\\centering/.test(raw);

  const imgMatch = raw.match(/\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/);
  const imageOpts = imgMatch?.[1] ? imgMatch[1].trim() : '';
  const imageSrc = imgMatch?.[2] ? imgMatch[2].trim() : '';

  const captionMatch = raw.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
  const caption = captionMatch?.[1] ? captionMatch[1].trim() : null;

  const labelMatch = raw.match(/\\label\{([^}]+)\}/);
  const label = labelMatch?.[1] ? labelMatch[1].trim() : null;

  return {
    rawLatex: raw,
    isStarred,
    placement,
    isCentered,
    imageSrc,
    imageOpts,
    caption,
    label,
  };
}

/**
 * Serializes ParsedFigure back into LaTeX code
 */
export function serializeFigureToLatex(fig: ParsedFigure): string {
  const envName = fig.isStarred ? 'figure*' : 'figure';
  const placementStr = fig.placement ? `[${fig.placement}]` : '';
  const lines: string[] = [];

  lines.push(`\\begin{${envName}}${placementStr}`);
  if (fig.isCentered) {
    lines.push('  \\centering');
  }

  const optStr = fig.imageOpts ? `[${fig.imageOpts}]` : '';
  lines.push(`  \\includegraphics${optStr}{${fig.imageSrc}}`);

  if (fig.caption !== null && fig.caption !== undefined) {
    lines.push(`  \\caption{${fig.caption}}`);
  }

  if (fig.label) {
    lines.push(`  \\label{${fig.label}}`);
  }

  lines.push(`\\end{${envName}}`);
  return lines.join('\n');
}

/**
 * CodeMirror 6 Visual Figure Widget
 */
export class FigureWidget extends WidgetType {
  private parsed: ParsedFigure;
  private isEditingCode = false;

  constructor(
    public readonly rawLatex: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
    this.parsed = parseLatexFigure(rawLatex);
  }

  override eq(other: FigureWidget): boolean {
    return this.rawLatex === other.rawLatex && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className =
      'cm-figure-widget my-3 border border-border/70 rounded-md bg-muted/10 relative overflow-hidden transition-all text-foreground select-none';

    this.renderWidget(root, view);
    return root;
  }

  private renderWidget(root: HTMLElement, view: EditorView): void {
    root.innerHTML = '';

    if (this.isEditingCode) {
      this.renderCodeView(root, view);
      return;
    }

    this.renderVisualView(root, view);
  }

  private renderVisualView(root: HTMLElement, view: EditorView): void {
    // ── Header Toolbar ──────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className =
      'flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/50 text-11';

    // Left info
    const leftInfo = document.createElement('div');
    leftInfo.className = 'flex items-center gap-2';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'flex items-center gap-1.5 font-medium text-foreground';
    titleWrap.innerHTML = `<span>🖼️</span><span>Figure</span>`;
    leftInfo.appendChild(titleWrap);

    if (this.parsed.label) {
      const labelBadge = document.createElement('span');
      labelBadge.className =
        'px-1.5 py-0.5 rounded bg-muted border border-border/60 text-muted-foreground font-mono text-11';
      labelBadge.textContent = this.parsed.label;
      labelBadge.title = `Label: ${this.parsed.label}`;
      leftInfo.appendChild(labelBadge);
    }

    if (this.parsed.placement) {
      const placeBadge = document.createElement('span');
      placeBadge.className = 'px-1 py-0.5 text-muted-foreground font-mono text-11 opacity-80';
      placeBadge.textContent = `[${this.parsed.placement}]`;
      placeBadge.title = `Placement: [${this.parsed.placement}]`;
      leftInfo.appendChild(placeBadge);
    }

    header.appendChild(leftInfo);

    // Right action buttons
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1';

    // Raw Code View toggle button
    const codeBtn = document.createElement('button');
    codeBtn.className =
      'h-7 px-2 flex items-center gap-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-11 font-mono transition-colors';
    codeBtn.title = 'View and edit raw LaTeX code';
    codeBtn.innerHTML = `<span>{ }</span><span>Code</span>`;
    codeBtn.onclick = (e) => {
      e.stopPropagation();
      this.isEditingCode = true;
      this.renderWidget(root, view);
    };
    actions.appendChild(codeBtn);

    // Edit Caption button
    const editBtn = document.createElement('button');
    editBtn.className =
      'h-7 px-2 flex items-center gap-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-11 transition-colors';
    editBtn.title = 'Edit caption and label';
    editBtn.innerHTML = `<span>✎</span><span>Edit</span>`;
    editBtn.onclick = (e) => {
      e.stopPropagation();
      this.openCaptionPrompt(root, view);
    };
    actions.appendChild(editBtn);

    // Delete Figure button
    const delBtn = document.createElement('button');
    delBtn.className =
      'h-7 px-2 flex items-center gap-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive text-11 transition-colors';
    delBtn.title = 'Delete figure from document';
    delBtn.innerHTML = `<span>🗑️</span>`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Delete this figure from the document?')) {
        view.dispatch({
          changes: { from: this.from, to: this.to, insert: '' },
          scrollIntoView: true,
        });
      }
    };
    actions.appendChild(delBtn);

    header.appendChild(actions);
    root.appendChild(header);

    // ── Image Preview Area ──────────────────────────────────────────────────────
    const imageArea = document.createElement('div');
    imageArea.className = 'p-4 flex flex-col items-center justify-center bg-background/40';

    if (this.parsed.imageSrc) {
      const img = document.createElement('img');
      const resolvedSrc =
        this.parsed.imageSrc.startsWith('http') || this.parsed.imageSrc.startsWith('/')
          ? this.parsed.imageSrc
          : `/${this.parsed.imageSrc}`;
      img.src = resolvedSrc;
      img.alt = this.parsed.caption || this.parsed.imageSrc;
      img.className = 'max-h-64 max-w-full object-contain rounded border border-border/40 bg-background';

      // Fallback placeholder when image file is missing or not yet uploaded
      img.onerror = () => {
        imageArea.innerHTML = '';
        const placeholder = document.createElement('div');
        placeholder.className =
          'w-full max-w-md py-6 px-4 border border-dashed border-border/80 rounded bg-muted/20 flex flex-col items-center justify-center gap-2 text-center';

        placeholder.innerHTML = `
          <div class="text-2xl opacity-70">🖼️</div>
          <div class="font-mono text-12 font-medium text-foreground">${this.escapeHtml(this.parsed.imageSrc)}</div>
          <div class="text-11 text-muted-foreground">Image file placeholder · Compiles in PDF or renders when asset is uploaded</div>
          ${this.parsed.imageOpts ? `<div class="text-11 font-mono text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded border border-border/40">[${this.escapeHtml(this.parsed.imageOpts)}]</div>` : ''}
        `;
        imageArea.appendChild(placeholder);
      };

      imageArea.appendChild(img);
    } else {
      const emptyState = document.createElement('div');
      emptyState.className =
        'py-6 px-4 text-center text-muted-foreground text-12 font-mono border border-dashed border-border/70 rounded';
      emptyState.textContent = 'No \\includegraphics specified in this figure';
      imageArea.appendChild(emptyState);
    }

    root.appendChild(imageArea);

    // ── Caption Area ────────────────────────────────────────────────────────────
    const captionWrap = document.createElement('div');
    captionWrap.className = 'px-4 pb-3 pt-1 text-center text-12 text-muted-foreground font-sans';

    if (this.parsed.caption) {
      const captionText = document.createElement('span');
      captionText.className =
        'caption-text cursor-pointer hover:text-foreground hover:underline transition-colors';
      captionText.title = 'Click to edit caption in-place';
      captionText.innerHTML = `<strong class="font-semibold text-foreground">Figure: </strong><span>${this.escapeHtml(this.parsed.caption)}</span>`;
      captionText.onclick = (e) => {
        e.stopPropagation();
        this.openCaptionPrompt(root, view);
      };
      captionWrap.appendChild(captionText);
    } else {
      const addCaptionBtn = document.createElement('button');
      addCaptionBtn.className =
        'text-11 text-muted-foreground/70 hover:text-foreground transition-colors hover:underline';
      addCaptionBtn.textContent = '+ Add figure caption';
      addCaptionBtn.onclick = (e) => {
        e.stopPropagation();
        this.openCaptionPrompt(root, view);
      };
      captionWrap.appendChild(addCaptionBtn);
    }

    root.appendChild(captionWrap);
  }

  private renderCodeView(root: HTMLElement, view: EditorView): void {
    const wrap = document.createElement('div');
    wrap.className = 'p-3 bg-muted/20 flex flex-col gap-2';

    const label = document.createElement('div');
    label.className = 'flex items-center justify-between text-11 text-muted-foreground font-mono';
    label.innerHTML = `<span>Raw LaTeX Figure Code</span><span class="text-11 opacity-70">100% Syntax Preservation</span>`;
    wrap.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.className =
      'w-full h-36 font-mono text-12 p-2.5 rounded border border-border bg-background text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary';
    textarea.value = this.rawLatex;
    wrap.appendChild(textarea);

    const btnBar = document.createElement('div');
    btnBar.className = 'flex items-center justify-end gap-2 pt-1';

    const cancelBtn = document.createElement('button');
    cancelBtn.className =
      'h-7 px-2.5 rounded text-11 border border-border hover:bg-muted text-foreground transition-colors';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      this.isEditingCode = false;
      this.renderWidget(root, view);
    };
    btnBar.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className =
      'h-7 px-3 rounded text-11 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors';
    saveBtn.textContent = 'Apply Changes';
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      const updatedCode = textarea.value.trim();
      if (updatedCode && updatedCode !== this.rawLatex) {
        view.dispatch({
          changes: { from: this.from, to: this.to, insert: updatedCode },
          scrollIntoView: true,
        });
      }
      this.isEditingCode = false;
    };
    btnBar.appendChild(saveBtn);

    wrap.appendChild(btnBar);
    root.appendChild(wrap);
  }

  private openCaptionPrompt(root: HTMLElement, view: EditorView): void {
    const newCaption = prompt('Edit Figure Caption:', this.parsed.caption || '');
    if (newCaption === null) return;

    this.parsed.caption = newCaption.trim();
    const newLatex = serializeFigureToLatex(this.parsed);
    view.dispatch({
      changes: { from: this.from, to: this.to, insert: newLatex },
      scrollIntoView: true,
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Standalone Image Widget for \includegraphics[...]{filename} outside figure environment
 */
export class StandaloneImageWidget extends WidgetType {
  constructor(
    public readonly src: string,
    public readonly options: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: StandaloneImageWidget): boolean {
    return (
      this.src === other.src &&
      this.options === other.options &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className =
      'cm-image-widget my-3 p-3 bg-muted/15 border border-border/70 rounded-md flex flex-col items-center justify-center relative group';

    // Toolbar
    const bar = document.createElement('div');
    bar.className = 'w-full flex items-center justify-between text-11 text-muted-foreground pb-2';
    bar.innerHTML = `
      <span class="flex items-center gap-1 font-mono text-11 text-foreground"><span>🖼️</span><span>${this.src}</span></span>
      <span class="text-11 font-mono text-muted-foreground">${this.options ? `[${this.options}]` : ''}</span>
    `;
    wrap.appendChild(bar);

    // Image preview
    const img = document.createElement('img');
    const resolvedSrc =
      this.src.startsWith('http') || this.src.startsWith('/') ? this.src : `/${this.src}`;
    img.src = resolvedSrc;
    img.alt = this.src;
    img.className = 'max-h-64 object-contain rounded border border-border/40 bg-background';

    img.onerror = () => {
      wrap.innerHTML = `
        <div class="py-4 px-3 text-11 text-muted-foreground flex flex-col items-center gap-1">
          <span class="text-xl">🖼️</span>
          <span class="font-mono text-12 text-foreground font-medium">${this.src}</span>
          <span>Asset preview placeholder</span>
        </div>
      `;
    };

    wrap.appendChild(img);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}
