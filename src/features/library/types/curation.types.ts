import { z } from 'zod';
import {
  duplicateGroupSchema,
  mergeStrategySchema,
  flaggedItemIssueSchema,
  libraryIntegrityReportSchema,
} from '../schemas/curation.schema';
import { Item } from './items.types';

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>;
export type MergeStrategy = z.infer<typeof mergeStrategySchema>;
export type FlaggedItemIssue = z.infer<typeof flaggedItemIssueSchema>;
export type LibraryIntegrityReport = z.infer<typeof libraryIntegrityReportSchema>;

export interface DuplicateCluster {
  id: string;
  reason: 'doi' | 'title';
  items: Item[];
}

export interface DuplicatesState {
  clusters: DuplicateCluster[];
  selectedClusterId: string | null;
  isMerging: boolean;
}
