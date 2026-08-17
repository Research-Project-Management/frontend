'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectDetails } from '@/features/workspaces/projects/shell/hooks/use-project';
import { Button, Skeleton } from '@/shared/components/ui';
import { DeleteModal } from '@/features/workspaces/settings';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '../components/label/EmptyState';
import { Form } from '../components/label/Form';
import { Item } from '../components/label/Item';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel } from '../hooks/use-label';
import type { Label } from '../types/label.types';

// ── Main Page Component ───────────────────────────────────────────────────────

export default function LabelPage() {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };
  const { data: projectData, isLoading: isLoadingProject, isError } = useProjectDetails(projectId);
  const project = (projectData as any)?.project || projectData;

  const { data: labels = [], isLoading: isLoadingLabels } = useLabels(workspaceId);
  const createMutation = useCreateLabel(workspaceId);
  const updateMutation = useUpdateLabel(workspaceId);
  const deleteMutation = useDeleteLabel(workspaceId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<Label | null>(null);

  const handleAdd = (name: string, color: string) => {
    // Check for duplicate name
    const exists = labels.some((l) => l.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (exists) {
      toast.error(`A label named "${name}" already exists`);
      return;
    }

    createMutation.mutate(
      { name, color, type: 'task' },
      {
        onSuccess: () => setIsAdding(false),
      },
    );
  };

  const handleUpdate = (id: string, name: string, color: string) => {
    // Check for duplicate name excluding self
    const exists = labels.some(
      (l) => l.id !== id && l.name.toLowerCase().trim() === name.toLowerCase().trim(),
    );
    if (exists) {
      toast.error(`A label named "${name}" already exists`);
      return;
    }

    updateMutation.mutate(
      { labelId: id, name, color },
      {
        onSuccess: () => setEditingId(null),
      },
    );
  };

  const confirmDelete = () => {
    if (!deletingItem) return;
    deleteMutation.mutate(deletingItem.id, {
      onSuccess: () => setDeletingItem(null),
    });
  };

  const isLoading = isLoadingProject || isLoadingLabels;

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return <div className="p-8 text-sm text-muted-foreground">Error loading project.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Labels</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <span>Labels help you group and filter work items in this project.</span>
            <a
              href="https://docs.plane.so"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline"
            >
              Docs <ArrowUpRight className="size-3.5" />
            </a>
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          className="h-8 text-xs font-medium px-3.5 rounded-md bg-[#0070f3] hover:bg-[#0060df] text-white cursor-pointer shadow-2xs shrink-0"
        >
          Add label
        </Button>
      </div>

      {/* ── Add Label Inline Form ── */}
      {isAdding && (
        <Form
          initialColor="#FF6900"
          submitText="Add"
          isLoading={createMutation.isPending}
          onSubmit={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* ── Labels List or Empty State ── */}
      {labels.length === 0 && !isAdding ? (
        <EmptyState onCreate={() => setIsAdding(true)} />
      ) : (
        <div className="space-y-2">
          {labels.map((item) => {
            if (editingId === item.id) {
              return (
                <Form
                  key={item.id}
                  initialName={item.name}
                  initialColor={item.color}
                  submitText="Save"
                  isLoading={updateMutation.isPending}
                  onSubmit={(name, color) => handleUpdate(item.id, name, color)}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            return (
              <Item
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditingId(item.id);
                  setIsAdding(false);
                }}
                onDelete={() => setDeletingItem(item)}
              />
            );
          })}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        title="Delete label"
        description={`Are you sure you want to delete "${deletingItem?.name || ''}"? This action cannot be undone and will remove this label from all work items.`}
        confirmText="Delete permanently"
        cancelText="Cancel"
      />
    </div>
  );
}
