import React from 'react';
import { ConfirmDeleteModal } from '@/shared/components/modals/ConfirmDeleteModal';
import type { WorkItemViewItem } from '../../types/view.types';

export interface DeleteProjectViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  view: WorkItemViewItem | null;
  loading?: boolean;
}

export const DeleteProjectViewModal: React.FC<DeleteProjectViewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  view,
  loading = false,
}) => {
  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      title="Delete view"
      description={
        <span>
          Are you sure you want to delete view{' '}
          <span className="font-semibold text-foreground break-all">
            &quot;{view?.name}&quot;
          </span>
          ? The work items in the view won&apos;t be deleted. This action cannot be undone.
        </span>
      }
      confirmText="Delete view"
      cancelText="Cancel"
    />
  );
};
