'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import {
  useDrafts,
  useCreateDraft,
  useUpdateDraft,
  useDuplicateDraft,
  usePublishDraft,
  useDeleteDraft,
} from '../hooks/use-drafts';
import { EmptyState } from '../components/layout/EmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { ListView } from '../components/views/ListView';
import { EditorModal } from '../components/modals/EditorModal';
import { MoveToProjectModal } from '../components/modals/MoveToProjectModal';
import { DeleteModal } from '../components/modals/DeleteModal';
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import { DraftsIcon } from '@/shared/components/icons';
import { Button } from '@/shared/components/ui';
import type { WorkItemDraft } from '../types/draft.types';
import type { WorkItemPriority } from '@/features/projects/project-id/work-items/types/work-item.types';

export default function DraftsPage() {
  const { projects = [] } = useProjects();

  // Modal States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<WorkItemDraft | null>(null);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingDraft, setMovingDraft] = useState<WorkItemDraft | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState<WorkItemDraft | null>(null);

  // Queries & Mutations
  const { data, isLoading, isError, error, refetch } = useDrafts();
  const drafts = data?.drafts || [];
  const total = data?.total ?? drafts.length;

  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const duplicateDraft = useDuplicateDraft();
  const publishDraft = usePublishDraft();
  const deleteDraft = useDeleteDraft();

  // Action Handlers
  const handleOpenCreate = () => {
    setEditingDraft(null);
    setIsEditorModalOpen(true);
  };

  const handleEdit = (draft: WorkItemDraft) => {
    setEditingDraft(draft);
    setIsEditorModalOpen(true);
  };

  const handleDuplicate = async (draft: WorkItemDraft) => {
    await duplicateDraft.mutateAsync(draft.id);
  };

  const handleOpenMove = (draft: WorkItemDraft) => {
    setMovingDraft(draft);
    setIsMoveModalOpen(true);
  };

  const handleOpenDelete = (draft: WorkItemDraft) => {
    setDeletingDraft(draft);
    setIsDeleteModalOpen(true);
  };

  const handleSaveDraft = async (formData: {
    title: string;
    description: string;
    priority: WorkItemPriority;
    columnId?: string;
    projectId?: string;
    labels?: string[];
    startDate?: string;
    dueDate?: string;
  }) => {
    if (editingDraft) {
      await updateDraft.mutateAsync({
        id: editingDraft.id,
        input: {
          title: formData.title,
          description: formData.description,
          content: formData.description,
          priority: formData.priority,
          columnId: formData.columnId,
          projectId: formData.projectId,
          labels: formData.labels,
          startDate: formData.startDate,
          dueDate: formData.dueDate,
        },
      });
    } else {
      await createDraft.mutateAsync({
        title: formData.title,
        description: formData.description,
        content: formData.description,
        priority: formData.priority,
        columnId: formData.columnId,
        projectId: formData.projectId,
        labels: formData.labels,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
      });
    }
  };

  const handleConfirmMove = async (draftId: string, targetProjectId: string) => {
    await publishDraft.mutateAsync({
      id: draftId,
      input: { projectId: targetProjectId },
    });
    setIsMoveModalOpen(false);
  };

  const handleConfirmDelete = async (draftId: string) => {
    await deleteDraft.mutateAsync(draftId);
    setIsDeleteModalOpen(false);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Drafts"
        icon={DraftsIcon}
        actions={
          <div className="flex items-center gap-2">
            {total !== undefined && total > 0 && (
              <span className="px-1.5 py-0.5 rounded text-11 font-mono font-medium text-muted-foreground bg-muted">
                {total}
              </span>
            )}
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="h-8 px-3 text-12 font-medium relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              Draft a work item
            </Button>
          </div>
        }
      />

      <PageContent maxWidth="full" noPadding>
        {isLoading ? (
          <div className="flex flex-col divide-y divide-border border-b border-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 px-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-3 w-24 rounded bg-muted shrink-0" />
                  <div className="h-3 w-64 max-w-sm rounded bg-muted" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-5 w-20 rounded-md bg-muted" />
                  <div className="h-5 w-16 rounded-md bg-muted" />
                  <div className="size-5 rounded-md bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <PlaneErrorState
            title="Failed to load drafts"
            description="We encountered an issue fetching your drafts. Please check your connection or try again."
            error={error}
            reset={() => refetch()}
          />
        ) : drafts.length === 0 ? (
          <EmptyState onCreateDraft={handleOpenCreate} />
        ) : (
          <ListView
            drafts={drafts}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onMoveToProject={handleOpenMove}
            onDelete={handleOpenDelete}
          />
        )}
      </PageContent>

      {/* Create / Edit Draft Modal matching Image 3 */}
      <EditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        draft={editingDraft}
        projects={projects}
        onSave={handleSaveDraft}
        isSaving={createDraft.isPending || updateDraft.isPending}
      />

      {/* Move to Project Modal */}
      <MoveToProjectModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        draft={movingDraft}
        projects={projects}
        onMove={handleConfirmMove}
        isMoving={publishDraft.isPending}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        draft={deletingDraft}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteDraft.isPending}
      />
    </PageLayout>
  );
}
