import type { ReaderAnnotation } from '@/features/library/types/reader.types';
import {
  PdfAnnotationEngine,
  ANNOTATION_PALETTE_COLORS,
} from './reader';

const ANNOTATION_COLOR_BY_HEX_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
  ANNOTATION_PALETTE_COLORS.map((c) => [c.hex.toLowerCase(), c]),
);
const ANNOTATION_COLOR_BY_ID_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
  ANNOTATION_PALETTE_COLORS.map((c) => [c.id.toLowerCase(), c]),
);

export function extractAnnotationFacets(annotations: ReaderAnnotation[]): {
  existingColors: Array<(typeof ANNOTATION_PALETTE_COLORS)[number]>;
  existingTags: string[];
  availableAuthors: string[];
} {
  const colorMap = new Map<string, (typeof ANNOTATION_PALETTE_COLORS)[number]>();
  const tagSet = new Set<string>();
  const authorSet = new Set<string>();

  for (const a of annotations) {
    const resolvedId = PdfAnnotationEngine.resolveColorId(a.color);
    const canonicalColorHex = PdfAnnotationEngine.getColorConfig(resolvedId).border.toLowerCase();
    const match = ANNOTATION_COLOR_BY_ID_MAP.get(resolvedId) ?? ANNOTATION_COLOR_BY_HEX_MAP.get(canonicalColorHex);
    if (match && !colorMap.has(match.id)) colorMap.set(match.id, match);
    for (const t of a.tags ?? []) if (t && t.trim()) tagSet.add(t.trim());
    if (a.authorId) authorSet.add(a.authorId);
  }
  return { existingColors: Array.from(colorMap.values()), existingTags: Array.from(tagSet), availableAuthors: Array.from(authorSet) };
}

export function computeAnnotationRangeIds(
  filteredAnnotations: ReaderAnnotation[],
  selectedIds: ReadonlySet<string>,
  lastSelectedId: string,
  targetId: string,
): Set<string> | null {
  const idx1 = filteredAnnotations.findIndex((a) => a.id === lastSelectedId);
  const idx2 = filteredAnnotations.findIndex((a) => a.id === targetId);
  if (idx1 === -1 || idx2 === -1) return null;
  const next = new Set(selectedIds);
  for (let i = Math.min(idx1, idx2); i <= Math.max(idx1, idx2); i++) next.add(filteredAnnotations[i].id);
  return next;
}

export function filterAndSortAnnotations(
  annotations: ReaderAnnotation[],
  params: { searchQuery: string; selectedColor: string; selectedTag: string | null; authorFilter: string; typeFilter?: string; sortBy: 'position' | 'newest' | 'oldest' | 'color' },
): ReaderAnnotation[] {
  const filtered = PdfAnnotationEngine.filterAnnotations(annotations, {
    query: params.searchQuery, color: params.selectedColor, tag: params.selectedTag, authorId: params.authorFilter, type: params.typeFilter,
  });
  return params.sortBy === 'position' ? PdfAnnotationEngine.sortAnnotations(filtered) : PdfAnnotationEngine.sortAnnotationsByMode(filtered, params.sortBy);
}
