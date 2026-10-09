import type { ComponentType } from 'react';

export type AddFilesTab = 'new-file' | 'upload' | 'project' | 'url' | 'library';

export interface AddFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: AddFilesTab;
  parentPageId: string | null;
  projectId?: string;
  onPickItems?: (items: { file: File; name: string }[]) => void;
}

export interface AddFilesTabItem {
  id: AddFilesTab;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}
