'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Item, Column, Project, ProjectMember, ItemMutationInput } from '@/features/projects/project-id/work-items/types/work-item.types';

const CreateModal = dynamic(
  () => import('@/features/projects/project-id/work-items/components/modals/CreateModal').then((m) => m.CreateModal),
  { ssr: false }
);
const DetailModal = dynamic(
  () => import('@/features/projects/project-id/work-items/components/modals/DetailModal').then((m) => m.DetailModal),
  { ssr: false }
);
const DeleteModal = dynamic(
  () => import('@/features/projects/project-id/work-items/components/modals/DeleteModal').then((m) => m.DeleteModal),
  { ssr: false }
);
const AnalyticsDrawer = dynamic(
  () => import('@/features/projects/project-id/work-items/components/analytics/AnalyticsDrawer').then((m) => m.AnalyticsDrawer),
  { ssr: false }
);

import type { ModalState, WorkItemModalsProps } from '@/features/projects/project-id/work-items/types/modal.types';

export type { ModalState, WorkItemModalsProps };

export function WorkItemModals({
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
  onSaveCard,
  onDeleteCard,
  onConfirmDelete,
  onDuplicateCard,
  isAnalyticsOpen,
  onCloseAnalytics,
  analyticsItems,
  analyticsAssignees,
  projectId,
}: WorkItemModalsProps) {
  const handleModalOpenChange = (open: boolean) => {
    if (!open) onCloseModal();
  };

  return (
    <>
      {/* Analytics Drawer */}
      <AnalyticsDrawer
        isOpen={isAnalyticsOpen}
        onClose={onCloseAnalytics}
        project={project || undefined}
        projectId={projectId}
        items={analyticsItems}
        columns={columns}
        assignees={analyticsAssignees}
      />

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
          card={modal.card}
          columns={columns}
          project={project}
          members={members}
          availableItems={allItems}
          onSave={onSaveCard}
          onDelete={onDeleteCard}
          onDuplicate={modal.card.id ? onDuplicateCard : undefined}
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
