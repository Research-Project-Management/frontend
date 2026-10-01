'use client';

import React from 'react';
import {
  ReaderInspector,
  type ReaderInspectorProps,
import type { InspectorSectionId, Item, Collection } from '../types/reader.types';

export interface InspectorPanelProps {
  paper?: Item | null;
  item?: Item | null;
  collection?: Collection | null;
  scopeId?: string;
  projectId?: string;
  canEdit?: boolean;
  onClose?: () => void;
  onSelectPaper?: (paperId: string) => void;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
  pendingNoteText?: string;
  onClearPendingText?: () => void;
}

export type SectionId = InspectorSectionId;

/**
 * Unified Reader Inspector Panel
 * Delegates directly to ReaderInspector for complete UI, UX, and toggle parity with Library view.
 */
export default function InspectorPanel({
  paper,
  item,
  collection,
  scopeId,
  projectId,
  canEdit = true,
  onClose,
  onSelectPaper,
  onNavigateToAnnotation,
  pendingNoteText,
  onClearPendingText,
}: InspectorPanelProps) {
  const effectiveScope =
    scopeId || projectId || (paper as any)?.projectId || 'user';

  return (
    <ReaderInspector
      paper={paper}
      item={item}
      collection={collection}
      scopeId={effectiveScope}
      projectId={projectId}
      canEdit={canEdit}
      onClose={onClose}
      onSelectPaper={onSelectPaper}
      pendingNoteText={pendingNoteText}
      onClearPendingText={onClearPendingText}
      onNavigateToAnnotation={onNavigateToAnnotation}
    />
  );
}

export const Panel = InspectorPanel;
