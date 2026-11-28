'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/shared/components/ui/confirm-delete-dialog';

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  itemName?: React.ReactNode;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  buttonVariant?: 'blue' | 'red' | 'primary' | 'destructive';
}

export function DeleteModal({
  open,
  onOpenChange,
  title = 'Move to trash',
  description = 'Are you sure you want to move this item to the trash? Items can be restored from the Trash at any time.',
  itemName,
  children,
  onConfirm,
  isDeleting = false,
  confirmLabel = 'Move to trash',
  cancelLabel = 'Cancel',
  icon,
  buttonVariant = 'red',
}: DeleteModalProps) {
  const isRed = buttonVariant === 'red' || buttonVariant === 'destructive';

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      itemName={itemName}
      onConfirm={onConfirm}
      isLoading={isDeleting}
      confirmLabel={confirmLabel}
      loadingLabel="Processing..."
      cancelLabel={cancelLabel}
      icon={icon || <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />}
      variant={isRed ? 'destructive' : 'primary'}
    >
      {children}
    </ConfirmDeleteDialog>
  );
}

export default DeleteModal;
