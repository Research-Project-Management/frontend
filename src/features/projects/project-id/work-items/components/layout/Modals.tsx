'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Loader2 } from 'lucide-react';
import type {
  ModalState,
  ModalsProps,
  DeleteModalProps,
} from '@/features/projects/project-id/work-items/types/work-item.types';

const CreateModal = dynamic(
  () => import('@/features/projects/project-id/work-items/components/modals/CreateModal').then((m) => m.CreateModal),
  { ssr: false }
);
const DetailModal = dynamic(
  () => import('@/features/projects/project-id/work-items/components/modals/DetailModal').then((m) => m.DetailModal),
  { ssr: false }
);
const AnalyticsDrawer = dynamic(
  () => import('@/features/projects/project-id/work-items/components/analytics/AnalyticsDrawer').then((m) => m.AnalyticsDrawer),
  { ssr: false }
);

export type { ModalState, ModalsProps, DeleteModalProps };

export function DeleteModal({
  open,
  onOpenChange,
  item,
  onConfirm,
  isDeleting = false,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md p-6 gap-4 rounded-md border border-border bg-background shadow-raised-200">
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-16 font-semibold text-foreground">
            Delete work item
          </DialogTitle>
          <DialogDescription className="text-13 text-foreground/70">
            Are you sure you want to delete &quot;{item?.title || 'this work item'}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium rounded-md text-foreground hover:bg-muted cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring inline-flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none shrink-0" />}
            <span>{isDeleting ? 'Deleting...' : 'Delete work item'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Modals({
  modal,
  onCloseModal,
  columns,
  members,
  project,
  allItems,
  isSaving,
  isDeleting,
  isReadOnly,
  onCreateItem,
  onSaveItem,
  onDeleteItem,
  onConfirmDelete,
  onDuplicateItem,
  isAnalyticsOpen,
  onCloseAnalytics,
  analyticsItems,
  analyticsAssignees,
  projectId,
}: ModalsProps) {
  const handleModalOpenChange = (open: boolean) => {
    if (!open) onCloseModal();
  };

  return (
    <>
      {/* Analytics Drawer */}
      {isAnalyticsOpen && (
        <AnalyticsDrawer
          isOpen={isAnalyticsOpen}
          onClose={onCloseAnalytics}
          project={project || undefined}
          projectId={projectId}
          items={analyticsItems}
          columns={columns}
          assignees={analyticsAssignees}
        />
      )}

      {/* Work Item Create Dialog */}
      {modal.type === 'create' && (
        <CreateModal
          open={true}
          onOpenChange={handleModalOpenChange}
          columns={columns}
          members={members}
          initialData={modal.initialData}
          project={project || undefined}
          availableItems={allItems}
          onSubmit={onCreateItem}
          isSubmitting={isSaving}
        />
      )}

      {/* Work Item Detail Dialog */}
      {modal.type === 'detail' && (
        <DetailModal
          open={true}
          onOpenChange={handleModalOpenChange}
          item={modal.item}
          columns={columns}
          project={project}
          members={members}
          availableItems={allItems}
          onSave={onSaveItem}
          onDelete={onDeleteItem}
          onDuplicate={modal.item.id ? onDuplicateItem : undefined}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Work Item Delete Confirmation Modal */}
      {modal.type === 'delete' && (
        <DeleteModal
          open={true}
          onOpenChange={handleModalOpenChange}
          item={modal.item}
          onConfirm={onConfirmDelete}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
