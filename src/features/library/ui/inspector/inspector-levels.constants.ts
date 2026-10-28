'use client';

import type { InspectorSectionId } from '@/features/library/core/store/library-ui.store';

export type InspectorTabKey = InspectorSectionId;

/**
 * Inspector sections ordered from bottom icon ('cite') to top icon ('info').
 */
export const INSPECTOR_LEVELS: InspectorSectionId[] = [
  'cite',
  'relations',
  'tags',
  'collections',
  'notes',
  'files',
  'abstract',
  'info',
];

