/**
 * latex-citation-hover.ts
 *
 * CodeMirror 6 Hover Tooltip for LaTeX & Markdown Citations (Engines Layer).
 * Location: `features/editor/engines/extensions/latex-citation-hover.ts`
 *
 * Inspects hovered text for citation commands (\cite{...}, \citep{...}, [@key], @key)
 * and displays an instant rich metadata card with:
 * - Culturally formatted Vietnamese/Western authors
 * - Publication title, journal/venue, year, DOI
 * - In-text citation preview: (Nguyễn Văn An và c.s., 2024)
 * - Source indicator (project .bib vs workspace library)
 * - Self-healing fallback for unresolved citation keys with shortcut prompt and 1-click picker opener
 */

import { hoverTooltip, type Tooltip, type EditorView } from '@codemirror/view';
import { latexSymbolsIndex, type BibEntry } from '../../domain/latex/latex-symbols-index';
import {
  isVietnameseAuthorName,
  formatShortAuthor,
  formatInTextCitationPreview,
  formatBibliographyPreview,
} from '@/features/editor/domain/citation/citation-formatter';
import { formatRetractionReason } from '@/features/library';
import { editorCommandBus } from '../../coordinators/command-bus';

/**
 * LaTeX citation command regex matching \cite, \citep, \citet, \autocite, \parencite, etc.
 * Supports optional * and bracketed arguments e.g. \citep[see][p. 10]{key1, key2}
 */
const LATEX_CITE_REGEX =
  /\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{([^}]+)\}/gi;

/**
 * Pandoc-style bracketed markdown citations e.g. [@key1; @key2] or [see @key, p. 12]
 */
const PANDOC_BRACKET_REGEX = /\[([^\]]*@[a-zA-Z0-9_:-]+[^\]]*)\]/g;

/**
 * Standalone inline @citekey in markdown text
 */
const INLINE_CITEKEY_REGEX = /(^|[\s(])@([a-zA-Z0-9_:-]+)/g;

export function citationHoverSource(
  view: EditorView,
  pos: number,
  side: -1 | 1 = 1
): Tooltip | null {
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const col = pos - line.from;

  // 1. Check LaTeX citation macros on current line
    LATEX_CITE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LATEX_CITE_REGEX.exec(lineText)) !== null) {
      const fullMatch = match[0];
      const rawKeys = match[1];
      const braceIdx = fullMatch.indexOf('{');
      if (braceIdx === -1) continue;

      const innerStartCol = match.index + braceIdx + 1;
      const innerEndCol = innerStartCol + rawKeys.length;

      if (col >= innerStartCol && col <= innerEndCol) {
        // Find which specific comma-separated key is under the cursor
        let offset = innerStartCol;
        const segments = rawKeys.split(',');
        for (const seg of segments) {
          const segStart = offset;
          const segEnd = segStart + seg.length;
          offset = segEnd + 1; // +1 for comma

          const trimmed = seg.trim();
          if (!trimmed) continue;

          const leadingSpace = seg.indexOf(trimmed);
          const keyFrom = segStart + leadingSpace;
          const keyTo = keyFrom + trimmed.length;

          if (col >= keyFrom && col <= keyTo) {
            return createCitationTooltip(line.from + keyFrom, line.from + keyTo, trimmed);
          }
        }
      }
    }

    // 2. Check Pandoc bracketed citations [@key1; @key2]
    PANDOC_BRACKET_REGEX.lastIndex = 0;
    while ((match = PANDOC_BRACKET_REGEX.exec(lineText)) !== null) {
      const bracketContent = match[1];
      const bracketStartCol = match.index + 1; // skip '['
      const bracketEndCol = bracketStartCol + bracketContent.length;

      if (col >= bracketStartCol && col <= bracketEndCol) {
        const atRegex = /@([a-zA-Z0-9_:-]+)/g;
        let atMatch: RegExpExecArray | null;
        while ((atMatch = atRegex.exec(bracketContent)) !== null) {
          const key = atMatch[1];
          const keyStart = bracketStartCol + atMatch.index;
          const keyEnd = keyStart + 1 + key.length;

          if (col >= keyStart && col <= keyEnd) {
            return createCitationTooltip(line.from + keyStart, line.from + keyEnd, key);
          }
        }
      }
    }

    // 3. Check standalone inline @citekey in Markdown prose
    INLINE_CITEKEY_REGEX.lastIndex = 0;
    while ((match = INLINE_CITEKEY_REGEX.exec(lineText)) !== null) {
      const prefixLen = match[1].length;
      const key = match[2];
      const keyStart = match.index + prefixLen; // '@' position
      const keyEnd = keyStart + 1 + key.length;

      if (col >= keyStart && col <= keyEnd) {
        return createCitationTooltip(line.from + keyStart, line.from + keyEnd, key);
      }
    }

    return null;
}

export const latexCitationHoverTooltip = hoverTooltip(citationHoverSource, { hideOnChange: true });

/**
 * Creates the CodeMirror Tooltip object with custom DOM card for a citation key
 */
function createCitationTooltip(from: number, to: number, citeKey: string): Tooltip {
  const entry = latexSymbolsIndex.getCitationByKey(citeKey);

  return {
    pos: from,
    end: to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className =
        'cm-citation-hover-card p-3.5 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl text-xs max-w-sm sm:max-w-md select-text pointer-events-auto leading-relaxed';

      if (entry) {
        renderResolvedCard(dom, entry, citeKey);
      } else {
        renderUnresolvedCard(dom, citeKey);
      }

      return { dom };
    },
  };
}

/**
 * Renders rich card when citation key is resolved in .bib or workspace library
 */
function renderResolvedCard(container: HTMLElement, entry: BibEntry, citeKey: string): void {
  const typeStr = (entry.type || 'article').toUpperCase();
  const isVn = isVietnameseAuthorName(entry.author || '');
  const authorShort = formatShortAuthor(entry.author);
  const inTextPreview = formatInTextCitationPreview(entry);
  const bibPreview = formatBibliographyPreview(entry);

  // 1. Header Row (Type badge, Citekey, Source)
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/60';

  const leftPills = document.createElement('div');
  leftPills.className = 'flex items-center gap-1.5 flex-wrap';

  const typeBadge = document.createElement('span');
  typeBadge.className =
    'px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-primary/15 text-primary border border-primary/20 uppercase';
  typeBadge.textContent = typeStr;
  leftPills.appendChild(typeBadge);

  const keyPill = document.createElement('span');
  keyPill.className = 'font-mono text-[11px] font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded';
  keyPill.textContent = `@${entry.key || citeKey}`;
  leftPills.appendChild(keyPill);

  if (entry.isRetracted) {
    const retractedBadge = document.createElement('span');
    retractedBadge.className =
      'px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30 uppercase tracking-wide flex items-center gap-1';
    retractedBadge.innerHTML = '🚨 <span>THU HỒI / RETRACTED</span>';
    leftPills.appendChild(retractedBadge);
  }

  header.appendChild(leftPills);

  const sourceBadge = document.createElement('span');
  sourceBadge.className = 'text-[11px] text-muted-foreground flex items-center gap-1';
  if (entry.sourceFile === 'workspace-library') {
    sourceBadge.innerHTML = '📚 <span class="hidden sm:inline">Thư viện số</span>';
  } else if (entry.sourceFile) {
    const bibBtn = document.createElement('button');
    bibBtn.type = 'button';
    bibBtn.className = 'font-mono text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0';
    bibBtn.innerHTML = `📁 <span>${escapeHtml(entry.sourceFile)}</span>`;
    bibBtn.title = `Mở ${entry.sourceFile} (nhảy tới định nghĩa)`;
    bibBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorCommandBus.dispatch({
        type: 'workspace:open-file',
        fileId: entry.sourceFile!,
        filePath: entry.sourceFile!,
      });
    });
    sourceBadge.appendChild(bibBtn);
  }
  header.appendChild(sourceBadge);
  container.appendChild(header);

  // Retraction Callout Alert Box
  if (entry.isRetracted) {
    const alertBox = document.createElement('div');
    alertBox.className =
      'rounded-md bg-destructive/10 border border-destructive/30 p-2.5 my-2 text-xs flex flex-col gap-1 text-destructive';

    const alertHeader = document.createElement('div');
    alertHeader.className = 'flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-destructive';
    alertHeader.innerHTML = '<span>🚨 CẢNH BÁO: BÀI BÁO ĐÃ BỊ THU HỒI</span>';
    alertBox.appendChild(alertHeader);

    const reasonDesc = entry.retractionReason
      ? formatRetractionReason(entry.retractionReason, entry.retractionNature)
      : 'Bài báo này đã bị nhà xuất bản hoặc ủy ban liêm chính học thuật thu hồi chính thức.';
    const alertBody = document.createElement('div');
    alertBody.className = 'text-[11px] text-destructive/90 leading-relaxed font-medium';
    alertBody.textContent = reasonDesc;
    alertBox.appendChild(alertBody);

    if (entry.retractionNoticeUrl) {
      const noticeLink = document.createElement('a');
      noticeLink.href = entry.retractionNoticeUrl;
      noticeLink.target = '_blank';
      noticeLink.rel = 'noopener noreferrer';
      noticeLink.className =
        'inline-flex items-center gap-1 text-[11px] text-destructive underline font-semibold hover:opacity-80 mt-0.5';
      noticeLink.innerHTML = '<span>Xem thông báo chính thức của nhà xuất bản</span> <span>↗</span>';
      alertBox.appendChild(noticeLink);
    }

    container.appendChild(alertBox);
  }

  // 2. Publication Title
  if (entry.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'font-semibold text-sm text-foreground line-clamp-2 mb-1.5 leading-snug';
    titleEl.textContent = entry.title;
    container.appendChild(titleEl);
  }

  // 3. Authors
  if (entry.author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'flex items-start gap-1.5 text-xs text-muted-foreground mb-2';

    const icon = document.createElement('span');
    icon.textContent = '👤';
    authorEl.appendChild(icon);

    const authorText = document.createElement('span');
    // Display all authors joined cleanly
    const authorList = entry.author.split(/\s+and\s+|;\s*/i).join(', ');
    authorText.className = 'line-clamp-2';
    authorText.textContent = authorList;
    authorEl.appendChild(authorText);

    container.appendChild(authorEl);
  }

  // 4. Metadata Badges (Year, Journal/Venue, DOI)
  const metaRow = document.createElement('div');
  metaRow.className = 'flex flex-wrap items-center gap-2 mb-2.5 text-[11px] text-muted-foreground';

  if (entry.year) {
    const yearSpan = document.createElement('span');
    yearSpan.className = 'inline-flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded';
    yearSpan.textContent = `📅 ${entry.year}`;
    metaRow.appendChild(yearSpan);
  }

  if (entry.journal || (entry as any).booktitle) {
    const venue = entry.journal || (entry as any).booktitle;
    const venueSpan = document.createElement('span');
    venueSpan.className = 'inline-flex items-center gap-1 bg-muted/40 px-1.5 py-0.5 rounded max-w-[200px] truncate';
    venueSpan.title = venue;
    venueSpan.textContent = `🏛️ ${venue}`;
    metaRow.appendChild(venueSpan);
  }

  if (entry.doi) {
    const doiLink = document.createElement('a');
    const cleanDoi = entry.doi.replace(/^https?:\/\/doi\.org\//i, '');
    doiLink.href = `https://doi.org/${cleanDoi}`;
    doiLink.target = '_blank';
    doiLink.rel = 'noopener noreferrer';
    doiLink.className =
      'inline-flex items-center gap-1 text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded transition-colors';
    doiLink.textContent = `🔗 ${cleanDoi}`;
    metaRow.appendChild(doiLink);
  }

  if (metaRow.children.length > 0) {
    container.appendChild(metaRow);
  }

  // 5. In-Text Citation Preview Box
  const previewBox = document.createElement('div');
  previewBox.className =
    'rounded-md bg-muted/30 border border-border/50 p-2 text-xs flex flex-col gap-1';

  const previewLabel = document.createElement('div');
  previewLabel.className = 'text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center justify-between';
  previewLabel.innerHTML = `
    <span>Xem trước trích dẫn</span>
    <span class="text-[9px] font-normal normal-case text-muted-foreground/80">${isVn ? 'Tên tiếng Việt tự nhiên' : 'Chuẩn học thuật'}</span>
  `;
  previewBox.appendChild(previewLabel);

  const previewText = document.createElement('div');
  previewText.className = 'font-serif italic text-foreground text-[12px] bg-background/50 px-2 py-1 rounded border border-border/30';
  previewText.textContent = inTextPreview;
  previewBox.appendChild(previewText);

  container.appendChild(previewBox);

  // 6. Action Bar: Rename Citekey & Definition jump
  const footerRow = document.createElement('div');
  footerRow.className = 'flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-border/60 text-[11px]';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className =
    'inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-0.5 rounded transition-colors cursor-pointer border border-border/40';
  renameBtn.innerHTML = '✏️ <span>Đổi tên key (Refactor)</span>';
  renameBtn.title = 'Đổi tên khóa trích dẫn trong toàn bộ dự án mà không làm hỏng tài liệu';
  renameBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorCommandBus.dispatch({
      type: 'dialog:open',
      dialog: 'rename-symbol',
      payload: { type: 'citation', oldKey: entry.key || citeKey },
    });
  });
  footerRow.appendChild(renameBtn);

  if (entry.sourceFile && entry.sourceFile !== 'workspace-library') {
    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.className =
      'inline-flex items-center gap-1 text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-[11px]';
    jumpBtn.innerHTML = '<span>Tới .bib</span> ↗';
    jumpBtn.title = `Mở ${entry.sourceFile}`;
    jumpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorCommandBus.dispatch({
        type: 'workspace:open-file',
        fileId: entry.sourceFile!,
        filePath: entry.sourceFile!,
      });
    });
    footerRow.appendChild(jumpBtn);
  }

  container.appendChild(footerRow);
}

/**
 * Renders warning card with quick actions when citation key cannot be resolved
 */
function renderUnresolvedCard(container: HTMLElement, citeKey: string): void {
  // 1. Header warning
  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-2 pb-1.5 border-b border-border/60';

  const warningBadge = document.createElement('span');
  warningBadge.className =
    'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase';
  warningBadge.textContent = '⚠️ Chưa tìm thấy';
  header.appendChild(warningBadge);

  const keySpan = document.createElement('span');
  keySpan.className = 'font-mono text-[11px] font-semibold text-foreground';
  keySpan.textContent = `@${citeKey}`;
  header.appendChild(keySpan);

  container.appendChild(header);

  // 2. Explanation text
  const desc = document.createElement('div');
  desc.className = 'text-xs text-muted-foreground mb-3 leading-relaxed';
  desc.innerHTML = `Khóa trích dẫn <strong>@${escapeHtml(
    citeKey
  )}</strong> chưa được tìm thấy trong tệp <code>.bib</code> của dự án hoặc Thư viện số.`;
  container.appendChild(desc);

  // 3. Action row
  const actionRow = document.createElement('div');
  actionRow.className = 'flex items-center justify-between gap-2 pt-2 border-t border-border/60';

  const shortcutHint = document.createElement('span');
  shortcutHint.className = 'text-[11px] text-muted-foreground';
  shortcutHint.innerHTML = 'Phím tắt: <kbd class="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Ctrl+Shift+K</kbd>';
  actionRow.appendChild(shortcutHint);

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className =
    'px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer';
  openBtn.textContent = 'Mở Citation Picker';
  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
  });
  actionRow.appendChild(openBtn);

  container.appendChild(actionRow);
}

/**
 * Escapes HTML characters to prevent XSS in dynamic tooltips
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
