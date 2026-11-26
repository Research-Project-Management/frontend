import React from 'react';
import type { IllustrationProps } from './tokens';
import {
  ArchiveIllustration,
  DraftsIllustration,
  ProjectsIllustration,
  WorkItemsIllustration,
} from './projects';
import {
  CitationsIllustration,
  DetachedWindowIllustration,
  DocumentIllustration,
  HistoryIllustration,
  LibraryIllustration,
  LogsIllustration,
  PdfPreviewIllustration,
  ReviewIllustration,
} from './academic';
import {
  FilesIllustration,
  LabelsIllustration,
  SearchIllustration,
  StickiesIllustration,
} from './storage';
import {
  AiIllustration,
  ChatIllustration,
  ExperimentsIllustration,
} from './realtime';

export * from './tokens';
export * from './projects';
export * from './academic';
export * from './storage';
export * from './realtime';

export type EmptyStateVariant =
  | 'document'
  | 'preview'
  | 'detached'
  | 'review'
  | 'history'
  | 'search'
  | 'files'
  | 'citations'
  | 'chat'
  | 'logs'
  | 'projects'
  | 'drafts'
  | 'work-items'
  | 'stickies'
  | 'archive'
  | 'library'
  | 'storage'
  | 'ai'
  | 'experiments'
  | 'labels';

export interface EmptyStatePreset {
  illustration: React.ComponentType<IllustrationProps>;
  title: string;
  description: string | React.ReactNode;
}

export const EMPTY_STATE_REGISTRY: Record<EmptyStateVariant, EmptyStatePreset> = {
  document: {
    illustration: DocumentIllustration,
    title: 'No file selected',
    description: 'Select a document from the file tree or create a new file to start writing.',
  },
  preview: {
    illustration: PdfPreviewIllustration,
    title: 'No PDF preview',
    description: 'Click Recompile on the toolbar or press Ctrl+Enter to build your document.',
  },
  detached: {
    illustration: DetachedWindowIllustration,
    title: 'PDF viewer detached',
    description: 'Document preview is currently running in a separate window.',
  },
  review: {
    illustration: ReviewIllustration,
    title: 'No comments or suggestions',
    description: 'Comments, inline discussion threads, and suggested edits will appear here.',
  },
  history: {
    illustration: HistoryIllustration,
    title: 'No revisions found',
    description: 'Milestones and compilation snapshots will automatically be checkpointed as you edit.',
  },
  search: {
    illustration: SearchIllustration,
    title: 'No matching results',
    description: 'No items matched your search query. Try adjusting your keywords or filters.',
  },
  files: {
    illustration: FilesIllustration,
    title: 'No files yet',
    description: 'Create a new file or upload sources to get started.',
  },
  citations: {
    illustration: CitationsIllustration,
    title: 'No citations found',
    description: 'Bibliography entries from your .bib files or library references will appear here.',
  },
  chat: {
    illustration: ChatIllustration,
    title: 'No messages yet',
    description: 'Start a conversation with your team or the AI research assistant.',
  },
  logs: {
    illustration: LogsIllustration,
    title: 'Compilation clean',
    description: 'No errors, warnings, or raw engine log lines to display.',
  },
  projects: {
    illustration: ProjectsIllustration,
    title: 'No projects yet',
    description: 'Create your first research project to organize manuscripts, work items, and collaborators.',
  },
  drafts: {
    illustration: DraftsIllustration,
    title: 'Half-written work items',
    description: 'Start adding a work item and leave it mid-way or create your first draft.',
  },
  'work-items': {
    illustration: WorkItemsIllustration,
    title: 'No work items yet',
    description: 'Create a work item to track milestones, experiments, and writing tasks.',
  },
  stickies: {
    illustration: StickiesIllustration,
    title: 'No stickies yet',
    description: 'Click "Add Sticky" to capture quick ideas and reminders.',
  },
  archive: {
    illustration: ArchiveIllustration,
    title: 'No archived items',
    description: 'Archived projects and completed work items will appear here for safekeeping.',
  },
  library: {
    illustration: LibraryIllustration,
    title: 'Your library is empty',
    description: 'Import PDFs, BibTeX files, or DOIs to build your research reference collection.',
  },
  storage: {
    illustration: FilesIllustration,
    title: 'No files in storage',
    description: 'Upload datasets, figures, or documents to share across your workspace.',
  },
  ai: {
    illustration: AiIllustration,
    title: 'Ask Flux AI anything',
    description: 'Summarize papers, refine LaTeX prose, or debug compilation issues with context.',
  },
  experiments: {
    illustration: ExperimentsIllustration,
    title: 'No experiments recorded',
    description: 'Log your first experiment run to compare parameters and evaluation metrics.',
  },
  labels: {
    illustration: LabelsIllustration,
    title: 'No labels yet',
    description: 'Create labels to categorize and filter work items, papers, and documents.',
  },
};
