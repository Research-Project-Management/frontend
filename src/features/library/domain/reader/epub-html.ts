import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import type { ReaderAnnotation } from '@/features/library/types/reader.types';
import { DEFAULT_ANNOTATION_COLOR } from './reader';

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  htmlContent: string;
}

export function sanitizeReaderHtml(rawHtml: string): string {
  const clean = DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    SANITIZE_NAMED_PROPS: true,
    ADD_TAGS: ['article', 'section', 'header', 'footer', 'figure', 'figcaption'],
    ADD_ATTR: ['target', 'rel', 'id'],
    FORBID_TAGS: [
      'style',
      'form',
      'input',
      'button',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
    ],
    FORBID_ATTR: ['onerror', 'onload', 'name'],
  });
  if (typeof DOMParser === 'undefined') return clean;
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (/^(https?:|mailto:|tel:|\/\/)/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
  });
  return doc.body.innerHTML;
}

/**
 * Resolves a relative path inside an EPUB archive against a base directory.
 */
function resolveEpubPath(baseDir: string, relativeHref: string): string {
  const cleanHref = relativeHref.split('#')[0];
  if (!baseDir) return cleanHref.replace(/^\/+/, '');
  const parts = `${baseDir}/${cleanHref}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

/**
 * Unpacks an EPUB archive ArrayBuffer into ordered, sanitized HTML chapters.
 */
export async function unpackEpubArchiveChapters(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<EpubChapter[]> {
  const zip = await JSZip.loadAsync(buffer);
  if (signal?.aborted) return [];

  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = '';
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    if (signal?.aborted) return [];
    const match = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (match?.[1]) opfPath = match[1];
  }

  if (!opfPath) {
    const opfFiles = Object.keys(zip.files).filter((k) =>
      k.toLowerCase().endsWith('.opf'),
    );
    opfPath = opfFiles[0] || '';
  }

  if (!opfPath || !zip.file(opfPath)) {
    throw new Error('Invalid EPUB archive: missing package.opf manifest.');
  }

  const opfXml = await zip.file(opfPath)!.async('text');
  if (signal?.aborted) return [];
  const opfDir = opfPath.includes('/')
    ? opfPath.slice(0, opfPath.lastIndexOf('/'))
    : '';

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  const manifestMap = new Map<string, { href: string; mediaType: string }>();
  const itemEls = Array.from(opfDoc.getElementsByTagName('item'));
  for (const el of itemEls) {
    const id = el.getAttribute('id');
    const href = el.getAttribute('href');
    const mediaType = el.getAttribute('media-type') || '';
    if (id && href) {
      manifestMap.set(id, { href, mediaType });
    }
  }

  const itemrefEls = Array.from(opfDoc.getElementsByTagName('itemref'));
  const loadedChapters: EpubChapter[] = [];

  for (let i = 0; i < itemrefEls.length; i++) {
    if (signal?.aborted) return [];
    const idref = itemrefEls[i].getAttribute('idref');
    if (!idref) continue;
    const manifestEntry = manifestMap.get(idref);
    if (!manifestEntry) continue;

    const resolvedPath = resolveEpubPath(opfDir, manifestEntry.href);
    let decodedPath = resolvedPath;
    try {
      decodedPath = decodeURIComponent(resolvedPath);
    } catch {
      decodedPath = resolvedPath;
    }
    const chapterFile = zip.file(resolvedPath) || zip.file(decodedPath);
    if (!chapterFile) continue;

    const rawChapterHtml = await chapterFile.async('text');
    if (signal?.aborted) return [];
    const chapterDoc = parser.parseFromString(rawChapterHtml, 'text/html');
    const chapterDir = resolvedPath.includes('/')
      ? resolvedPath.slice(0, resolvedPath.lastIndexOf('/'))
      : '';

    // Inline relative EPUB archive images as data: URLs so figures/diagrams render cleanly
    const imgEls = Array.from(chapterDoc.querySelectorAll('img[src], image[href], image[*|href]'));
    for (const imgEl of imgEls) {
      const rawSrc =
        imgEl.getAttribute('src') ||
        imgEl.getAttribute('href') ||
        imgEl.getAttribute('xlink:href');
      if (!rawSrc || /^(data:|blob:|https?:|\/\/)/i.test(rawSrc.trim())) continue;
      const resolvedImgPath = resolveEpubPath(chapterDir, rawSrc.trim());
      let decodedImgPath = resolvedImgPath;
      try {
        decodedImgPath = decodeURIComponent(resolvedImgPath);
      } catch {
        decodedImgPath = resolvedImgPath;
      }
      const imgZipFile = zip.file(resolvedImgPath) || zip.file(decodedImgPath);
      if (!imgZipFile) continue;
      try {
        const b64 = await imgZipFile.async('base64');
        const ext = resolvedImgPath.split('.').pop()?.toLowerCase() || '';
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'svg'
              ? 'image/svg+xml'
              : ext === 'gif'
                ? 'image/gif'
                : ext === 'webp'
                  ? 'image/webp'
                  : 'image/jpeg';
        const dataUri = `data:${mime};base64,${b64}`;
        if (imgEl.hasAttribute('src')) {
          imgEl.setAttribute('src', dataUri);
        } else {
          imgEl.setAttribute('href', dataUri);
        }
      } catch {
        // Ignore unreadable image entries
      }
    }

    const headingText =
      chapterDoc.querySelector('h1, h2, h3, title')?.textContent?.trim() ||
      `Section ${loadedChapters.length + 1}`;
    const bodyHtml = chapterDoc.body ? chapterDoc.body.innerHTML : rawChapterHtml;

    const sanitizedHtml = sanitizeReaderHtml(bodyHtml);
    if (sanitizedHtml.trim()) {
      loadedChapters.push({
        id: idref,
        title: headingText,
        href: resolvedPath,
        htmlContent: sanitizedHtml,
      });
    }
  }

  return loadedChapters;
}

/**
 * Pure helper to inject saved annotation highlights and search query marks into sanitized chapter/snapshot HTML.
 */
export function highlightReaderHtml(
  html: string,
  annotations: ReadonlyArray<ReaderAnnotation>,
  currentPageNum: number,
  isSearchOpen: boolean,
  searchQuery: string,
): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  const pageQuotes = (annotations || [])
    .filter((a) => {
      const p = a.pageIndex !== undefined ? a.pageIndex + 1 : a.pageNumber || 1;
      return p === currentPageNum && Boolean(a.quoteText?.trim());
    })
    .map((a) => ({
      id: a.id,
      quote: a.quoteText!.trim(),
      color: a.color || DEFAULT_ANNOTATION_COLOR,
    }));

  const q = isSearchOpen ? searchQuery.trim().slice(0, 120) : '';
  if (q.length < 2 && pageQuotes.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  for (const item of pageQuotes) {
    if (item.quote.length < 2) continue;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const text = node.nodeValue || '';
      const idx = text.indexOf(item.quote);
      if (idx !== -1) {
        const frag = doc.createDocumentFragment();
        if (idx > 0) frag.appendChild(doc.createTextNode(text.slice(0, idx)));
        const mark = doc.createElement('mark');
        mark.setAttribute('data-annotation-id', item.id);
        mark.style.backgroundColor = `${item.color}55`;
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 2px';
        mark.textContent = item.quote;
        frag.appendChild(mark);
        const after = text.slice(idx + item.quote.length);
        if (after) frag.appendChild(doc.createTextNode(after));
        node.parentNode?.replaceChild(frag, node);
        break;
      }
      node = walker.nextNode() as Text | null;
    }
  }

  if (q.length < 2) return doc.body.innerHTML;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  let matchCount = 0;
  const MAX_MATCHES = 500;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    if (matchCount >= MAX_MATCHES) break;
    const text = textNode.nodeValue;
    if (!text) continue;
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (matchCount >= MAX_MATCHES) break;
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }
      const mark = doc.createElement('mark');
      mark.className = 'bg-warning/30 text-foreground rounded px-0.5';
      mark.textContent = match[0];
      fragment.appendChild(mark);
      lastIndex = regex.lastIndex;
      matchCount++;
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}
