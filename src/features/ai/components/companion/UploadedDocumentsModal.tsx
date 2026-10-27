'use client';

import React from 'react';
import { DocumentLibraryModal } from '../modals/document-library-modal';

export interface UploadedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
  onSelectItems?: (items: Array<{ id: string; name: string; size: number }>) => void;
}

export function UploadedDocumentsModal({
  isOpen,
  onClose,
  projectId,
  onSelectItem,
}: UploadedDocumentsModalProps) {
  return (
    <DocumentLibraryModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      projectId={projectId || undefined}
      onSelectItem={onSelectItem}
    />
  );
}

export default UploadedDocumentsModal;
