import {
  normalizePageRotation,
  rotatePointToCanonical,
  rotateRectFromCanonical,
  rotateRectToCanonical,
  type PdfPageHoverGeometry,
} from './annotation-geometry';
import {
  AUTHOR_YEAR_CITATION_RE,
  cleanRawCitation,
  formatAuthorsSummary,
  parseBracketCitationIndices,
  buildReferenceOverlayEntry,
  extractFallbackReferencesFromPages,
  buildSemanticLookupIndex,
  buildSemanticPageOverlays,
  type NormalizedPdfRect,
  type SemanticOverlayEntry,
  type SemanticPageOverlay,
  type DocumentReferenceItem,
  type DocumentFigureItem,
  type DocumentTableItem,
  type DocumentSectionItem,
  type IndexedReferenceEntry,
  type SemanticLookupIndex,
} from './semantic-index';

export {
  AUTHOR_YEAR_CITATION_RE,
  cleanRawCitation,
  formatAuthorsSummary,
  parseBracketCitationIndices,
  buildReferenceOverlayEntry,
  extractFallbackReferencesFromPages,
  buildSemanticLookupIndex,
  buildSemanticPageOverlays,
  type NormalizedPdfRect,
  type SemanticOverlayEntry,
  type SemanticPageOverlay,
  type DocumentReferenceItem,
  type DocumentFigureItem,
  type DocumentTableItem,
  type DocumentSectionItem,
  type IndexedReferenceEntry,
  type SemanticLookupIndex,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toNormalizedPdfRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): NormalizedPdfRect {
  const minX = clamp01(Math.min(x1, x2));
  const minY = clamp01(Math.min(y1, y2));
  const maxX = clamp01(Math.max(x1, x2));
  const maxY = clamp01(Math.max(y1, y2));
  return {
    x1: minX,
    y1: minY,
    x2: maxX,
    y2: maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function hitTestSemanticOverlays(
  overlays: SemanticPageOverlay[] | undefined,
  normX: number,
  normY: number,
  rotation = 0,
): SemanticPageOverlay | null {
  if (!overlays || overlays.length === 0) return null;
  if (!Number.isFinite(normX) || !Number.isFinite(normY)) return null;
  if (normX < -0.01 || normX > 1.01 || normY < -0.01 || normY > 1.01) return null;

  const pt = rotatePointToCanonical({ x: normX, y: normY }, rotation);
  const tol = 0.002;

  let bestOverlay: SemanticPageOverlay | null = null;
  let bestArea = Infinity;

  for (const overlay of overlays) {
    let hit = false;
    let totalArea = 0;

    for (const r of overlay.rects) {
      totalArea += Math.max(0, r.x2 - r.x1) * Math.max(0, r.y2 - r.y1);
      if (
        pt.x >= r.x1 - tol &&
        pt.x <= r.x2 + tol &&
        pt.y >= r.y1 - tol &&
        pt.y <= r.y2 + tol
      ) {
        hit = true;
      }
    }

    if (hit && totalArea < bestArea) {
      bestArea = totalArea;
      bestOverlay = overlay;
    }
  }

  return bestOverlay;
}

function measureSubstringClientRectInSpan(
  span: HTMLElement,
  matchStart: number,
  matchEnd: number,
): DOMRect | null {
  if (typeof document === 'undefined') return null;
  try {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const len = textNode.data.length;
      if (!startNode && offset + len >= matchStart) {
        startNode = textNode;
        startOffset = Math.max(0, matchStart - offset);
      }
      if (startNode && offset + len >= matchEnd) {
        endNode = textNode;
        endOffset = Math.max(0, matchEnd - offset);
        break;
      }
      offset += len;
    }

    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  } catch {
    return null;
  }
}

/**
 * Refines `source === 'matched'` single-rect overlays using the rendered DOM TextLayer spans
 * (which already reflect PDF.js `scaleX` and justified spacing), leaving native `/Link` overlays untouched.
 */
export function refineSemanticOverlaysWithTextLayer(
  pageEl: HTMLElement | null,
  overlays: SemanticPageOverlay[],
  rotation = 0,
): SemanticPageOverlay[] {
  if (!pageEl || overlays.length === 0) return overlays;

  const spans = Array.from(
    pageEl.querySelectorAll<HTMLElement>(
      '.react-pdf__Page__textLayer span, .react-pdf__Page__textContent span, .textLayer span',
    ),
  );
  if (spans.length === 0) return overlays;

  const pageRect = pageEl.getBoundingClientRect();
  if (pageRect.width <= 0 || pageRect.height <= 0) return overlays;

  const normRot = normalizePageRotation(rotation);
  const spanEntries = spans
    .map((el) => {
      const text = el.textContent || '';
      const rect = el.getBoundingClientRect();
      return { el, text, rect };
    })
    .filter((entry) => entry.text.length > 0 && entry.rect.width > 0 && entry.rect.height > 0);

  if (spanEntries.length === 0) return overlays;

  let changed = false;
  const refined = overlays.map((overlay) => {
    if (overlay.source !== 'matched' || overlay.rects.length !== 1) {
      return overlay;
    }
    const token = overlay.matchedText?.trim() || overlay.entries[0]?.badge?.trim();
    if (!token) return overlay;

    const approxRotated = rotateRectFromCanonical(
      {
        x1: overlay.rects[0]!.x1,
        y1: overlay.rects[0]!.y1,
        x2: overlay.rects[0]!.x2,
        y2: overlay.rects[0]!.y2,
      },
      normRot,
    );
    const approxCx = (approxRotated.x1 + approxRotated.x2) / 2;
    const approxCy = (approxRotated.y1 + approxRotated.y2) / 2;

    let bestDist = Infinity;
    let bestNormBox: { x1: number; y1: number; x2: number; y2: number } | null = null;

    const considerBox = (left: number, top: number, right: number, bottom: number) => {
      const vx1 = (left - pageRect.left) / pageRect.width;
      const vy1 = (top - pageRect.top) / pageRect.height;
      const vx2 = (right - pageRect.left) / pageRect.width;
      const vy2 = (bottom - pageRect.top) / pageRect.height;

      const cx = (vx1 + vx2) / 2;
      const cy = (vy1 + vy2) / 2;
      const dist = Math.hypot(cx - approxCx, cy - approxCy);
      if (dist <= 0.06 && dist < bestDist) {
        bestDist = dist;
        bestNormBox = {
          x1: clamp01(vx1),
          y1: clamp01(vy1),
          x2: clamp01(vx2),
          y2: clamp01(vy2),
        };
      }
    };

    for (const s of spanEntries) {
      const spanVx1 = (s.rect.left - pageRect.left) / pageRect.width;
      const spanVy1 = (s.rect.top - pageRect.top) / pageRect.height;
      const spanVx2 = (s.rect.right - pageRect.left) / pageRect.width;
      const spanVy2 = (s.rect.bottom - pageRect.top) / pageRect.height;

      if (
        approxCx < spanVx1 - 0.08 ||
        approxCx > spanVx2 + 0.08 ||
        approxCy < spanVy1 - 0.06 ||
        approxCy > spanVy2 + 0.06
      ) {
        continue;
      }

      let searchFrom = 0;
      let idx: number;
      while ((idx = s.text.indexOf(token, searchFrom)) !== -1) {
        searchFrom = idx + Math.max(1, token.length);
        const clientRect = measureSubstringClientRectInSpan(s.el, idx, idx + token.length);
        if (!clientRect) continue;
        considerBox(clientRect.left, clientRect.top, clientRect.right, clientRect.bottom);
      }
    }

    // Multi-span same-line search when PDF.js splits a citation token across adjacent spans
    const strippedToken = token.replace(/\s+/g, '');
    if (strippedToken.length > 0) {
      const lineSpans = spanEntries
        .filter((s) => {
          const spanVx1 = (s.rect.left - pageRect.left) / pageRect.width;
          const spanVy1 = (s.rect.top - pageRect.top) / pageRect.height;
          const spanVx2 = (s.rect.right - pageRect.left) / pageRect.width;
          const spanVy2 = (s.rect.bottom - pageRect.top) / pageRect.height;
          return (
            approxCy >= spanVy1 - 0.04 &&
            approxCy <= spanVy2 + 0.04 &&
            spanVx2 >= approxRotated.x1 - 0.12 &&
            spanVx1 <= approxRotated.x2 + 0.12
          );
        })
        .sort((a, b) => a.rect.left - b.rect.left);

      if (lineSpans.length > 0) {
        const charMap: Array<{ span: (typeof spanEntries)[number]; charIndex: number }> = [];
        let strippedLine = '';

        for (const span of lineSpans) {
          for (let ci = 0; ci < span.text.length; ci++) {
            const ch = span.text[ci]!;
            if (!/\s/.test(ch)) {
              strippedLine += ch;
              charMap.push({ span, charIndex: ci });
            }
          }
        }

        let searchFrom = 0;
        let matchIdx: number;
        while ((matchIdx = strippedLine.indexOf(strippedToken, searchFrom)) !== -1) {
          searchFrom = matchIdx + Math.max(1, strippedToken.length);
          const spanRanges = new Map<(typeof spanEntries)[number], { start: number; end: number }>();

          for (let k = matchIdx; k < matchIdx + strippedToken.length; k++) {
            const mapped = charMap[k]!;
            const existing = spanRanges.get(mapped.span);
            if (existing) {
              existing.start = Math.min(existing.start, mapped.charIndex);
              existing.end = Math.max(existing.end, mapped.charIndex + 1);
            } else {
              spanRanges.set(mapped.span, {
                start: mapped.charIndex,
                end: mapped.charIndex + 1,
              });
            }
          }

          let unionLeft = Infinity;
          let unionTop = Infinity;
          let unionRight = -Infinity;
          let unionBottom = -Infinity;
          let valid = true;

          for (const [span, range] of spanRanges.entries()) {
            const rect = measureSubstringClientRectInSpan(span.el, range.start, range.end);
            if (!rect) {
              valid = false;
              break;
            }
            unionLeft = Math.min(unionLeft, rect.left);
            unionTop = Math.min(unionTop, rect.top);
            unionRight = Math.max(unionRight, rect.right);
            unionBottom = Math.max(unionBottom, rect.bottom);
          }

          if (valid && unionRight > unionLeft && unionBottom > unionTop) {
            considerBox(unionLeft, unionTop, unionRight, unionBottom);
          }
        }
      }
    }

    if (!bestNormBox) return overlay;

    const canonicalBox = rotateRectToCanonical(bestNormBox, normRot);
    const exactRect = toNormalizedPdfRect(
      canonicalBox.x1,
      canonicalBox.y1,
      canonicalBox.x2,
      canonicalBox.y2,
    );
    if (
      exactRect.x2 <= exactRect.x1 ||
      exactRect.y2 <= exactRect.y1 ||
      (Math.abs(exactRect.x1 - overlay.rects[0]!.x1) < 0.0005 &&
        Math.abs(exactRect.y1 - overlay.rects[0]!.y1) < 0.0005 &&
        Math.abs(exactRect.x2 - overlay.rects[0]!.x2) < 0.0005 &&
        Math.abs(exactRect.y2 - overlay.rects[0]!.y2) < 0.0005)
    ) {
      return overlay;
    }

    changed = true;
    return {
      ...overlay,
      rects: [exactRect],
    };
  });

  return changed ? refined : overlays;
}
