/**
 * duplicates.util.ts
 *
 * NOTE: All duplicate detection, clustering, and quality auditing are canonically
 * handled by the backend CurationController (DuplicateService & QualityService).
 * The frontend acts purely as a presentation layer consuming the backend API.
 */

import type { DuplicateCluster } from '../types/library.types';

export type { DuplicateCluster };

export function getDuplicateIds(_items?: any[]): Set<string> {
  return new Set<string>();
}


