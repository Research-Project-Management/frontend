'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import type {
  ReaderAnnotation,
  AnnotationFormData,
} from '@/features/library/domain/types/reader.types';
import { annotationFormSchema } from '@/features/library/domain/types/reader.schema';
import {
  PdfAnnotationEngine,
  ANNOTATION_PALETTE_COLORS,
} from '@/features/library/domain/reader.domain';

export const ANNOTATION_COLOR_BY_HEX_MAP: ReadonlyMap<
  string,
  (typeof ANNOTATION_PALETTE_COLORS)[number]
> = new Map(ANNOTATION_PALETTE_COLORS.map((c) => [c.hex.toLowerCase(), c]));

export function extractAnnotationFacets(annotations: ReaderAnnotation[]): {
  existingColors: Array<(typeof ANNOTATION_PALETTE_COLORS)[number]>;
  existingTags: string[];
  availableAuthors: string[];
} {
  const colorMap = new Map<string, (typeof ANNOTATION_PALETTE_COLORS)[number]>();
  const tagSet = new Set<string>();
  const authorSet = new Set<string>();

  for (const a of annotations) {
    const hex = (a.color || '#ffd400').toLowerCase();
    const match = ANNOTATION_COLOR_BY_HEX_MAP.get(hex);
    if (match && !colorMap.has(match.id)) {
      colorMap.set(match.id, match);
    }
    if (a.tags) {
      for (const t of a.tags) {
        if (t && t.trim()) tagSet.add(t.trim());
      }
    }
    if (a.authorId) {
      authorSet.add(a.authorId);
    }
  }

  return {
    existingColors: Array.from(colorMap.values()),
    existingTags: Array.from(tagSet),
    availableAuthors: Array.from(authorSet),
  };
}

export function computeRangeSelectedAnnotationIds(
  filteredAnnotations: ReaderAnnotation[],
  selectedIds: ReadonlySet<string>,
  lastSelectedId: string,
  targetId: string,
): Set<string> | null {
  const idx1 = filteredAnnotations.findIndex((a) => a.id === lastSelectedId);
  const idx2 = filteredAnnotations.findIndex((a) => a.id === targetId);
  if (idx1 === -1 || idx2 === -1) return null;
  const start = Math.min(idx1, idx2);
  const end = Math.max(idx1, idx2);
  const next = new Set(selectedIds);
  for (let i = start; i <= end; i++) {
    next.add(filteredAnnotations[i].id);
  }
  return next;
}

export function filterAndSortAnnotations(
  annotations: ReaderAnnotation[],
  params: {
    searchQuery: string;
    selectedColor: string;
    selectedTag: string | null;
    authorFilter: string;
    sortBy: 'position' | 'newest' | 'oldest' | 'color';
  },
): ReaderAnnotation[] {
  const qLower = params.searchQuery.trim().toLowerCase();
  const colorLower = params.selectedColor === 'all' ? null : params.selectedColor.toLowerCase();

  const list = annotations.filter((a) => {
    if (params.authorFilter !== 'all' && a.authorId !== params.authorFilter) return false;
    if (params.selectedTag && (!a.tags || !a.tags.includes(params.selectedTag))) return false;
    if (colorLower !== null && (a.color || '#ffd400').toLowerCase() !== colorLower) {
      return false;
    }
    if (!qLower) return true;
    return Boolean(
      (a.quoteText && a.quoteText.toLowerCase().includes(qLower)) ||
        (a.comment && a.comment.toLowerCase().includes(qLower)) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(qLower))),
    );
  });

  if (params.sortBy === 'position') {
    return PdfAnnotationEngine.sortAnnotationsInReadingOrder(list);
  }

  if (params.sortBy === 'newest' || params.sortBy === 'oldest') {
    const tsMap = new Map<string, number>();
    for (const a of list) {
      const ts = Date.parse(a.createdAt);
      tsMap.set(a.id, Number.isNaN(ts) ? 0 : ts);
    }
    const dir = params.sortBy === 'newest' ? -1 : 1;
    return list.sort((a, b) => ((tsMap.get(a.id) ?? 0) - (tsMap.get(b.id) ?? 0)) * dir);
  }

  return list.sort((a, b) => (a.color || '').localeCompare(b.color || ''));
}

export function AnnotationEditForm({
  initialQuote,
  initialComment,
  initialColor,
  initialTags = [],
  isSaving,
  onSave,
  onCancel,
}: {
  initialQuote?: string;
  initialComment?: string;
  initialColor?: string;
  initialTags?: string[];
  isSaving: boolean;
  onSave: (data: AnnotationFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [tagText, setTagText] = useState((initialTags || []).join(', '));
  const form = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '',
      comment: initialComment || '',
      color: initialColor,
      tags: initialTags,
    },
  });

  const { register, handleSubmit } = form;

  const handleFormSubmit = (data: AnnotationFormData) => {
    const parsedTags = tagText
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);
    return onSave({ ...data, tags: parsedTags });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="space-y-2 rounded-md border border-border p-2 bg-background font-sans"
      >
        <input
          {...register('quoteText')}
          aria-label="Quote text"
          placeholder="Quote text..."
          className="w-full bg-transparent text-12 font-medium outline-none text-foreground font-sans"
        />
        <textarea
          {...register('comment')}
          aria-label="Comment"
          placeholder="Add a note/comment..."
          rows={2}
          className="w-full resize-none bg-transparent text-12 outline-none text-foreground leading-relaxed font-sans"
        />
        <input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-label="Tags"
          placeholder="Tags (e.g. methodology, result)..."
          className="w-full bg-transparent text-11 font-mono outline-none text-foreground placeholder:text-muted-foreground border-t border-border-subtle pt-1"
        />
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-11 px-2.5 cursor-pointer rounded-md border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 text-11 px-3 font-medium cursor-pointer rounded-md relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} /> : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
