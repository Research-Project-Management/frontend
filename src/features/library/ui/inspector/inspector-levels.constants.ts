'use client';

import type { InspectorSectionId } from '@/features/library/core/store/library-ui.store';

export type InspectorTabKey = InspectorSectionId;

/**
 * Inspector Levels counted from bottom icon to top icon:
 * Level 1: 'cite' (1 bar/tab: Citation)
 * Level 2: 'relations' (2 bars/tabs: Related, Citation)
 * Level 3: 'tags' (3 bars/tabs: Tags, Related, Citation)
 * Level 4: 'collections' (4 bars/tabs: Collections, Tags, Related, Citation)
 * Level 5: 'notes' (5 bars/tabs: Notes, Collections, Tags, Related, Citation)
 * Level 6: 'files' (6 bars/tabs: Attachments, Notes, Collections, Tags, Related, Citation)
 * Level 7: 'abstract' (7 bars/tabs: Abstract, Attachments, Notes, Collections, Tags, Related, Citation)
 * Level 8: 'info' (8 bars/tabs: Details, Abstract, Attachments, Notes, Collections, Tags, Related, Citation)
 */
export const INSPECTOR_LEVELS_FROM_BOTTOM: InspectorSectionId[] = [
  'cite',
  'relations',
  'tags',
  'collections',
  'notes',
  'files',
  'abstract',
  'info',
];

export const INSPECTOR_LEVELS = INSPECTOR_LEVELS_FROM_BOTTOM;

export const SECTION_TO_LEVEL: Record<InspectorSectionId, number> = {
  cite: 1,
  relations: 2,
  tags: 3,
  collections: 4,
  notes: 5,
  files: 6,
  abstract: 7,
  info: 8,
};

export const LEVEL_TO_SECTION: Record<number, InspectorSectionId> = {
  1: 'cite',
  2: 'relations',
  3: 'tags',
  4: 'collections',
  5: 'notes',
  6: 'files',
  7: 'abstract',
  8: 'info',
};
