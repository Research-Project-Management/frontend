'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui';
import { DeleteModal } from '@/features/workspaces/settings/components/modal/DeleteModal';

interface GeneralDangerProps {
  projectName: string;
  isArchived: boolean;
  onToggleArchive: () => void;
  onDeleteProject: () => void;
  isDeleting?: boolean;
}

export function GeneralDanger({
  projectName,
  isArchived,
  onToggleArchive,
  onDeleteProject,
  isDeleting,
}: GeneralDangerProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="pt-6">
      {/* Container Card with Divider */}
      <div className="rounded-lg border border-border/80 bg-background divide-y divide-border/60 overflow-hidden shadow-2xs">
        {/* Row 1: Archive */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h4 className="text-xs font-semibold text-foreground">Archive</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Archiving a project will unlist your project from your side navigation although you will still be able to access it from your projects page. You can restore the project or delete it whenever you want.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setArchiveOpen(true)}
            className="h-8 px-3.5 rounded-lg border-border/80 bg-background hover:bg-muted/50 text-xs font-medium text-foreground shrink-0 cursor-pointer"
          >
            {isArchived ? 'Restore' : 'Archive'}
          </Button>
        </div>

        {/* Row 2: Delete */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <h4 className="text-xs font-semibold text-foreground">Delete</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When deleting a project, all of the data and resources within that project will be permanently removed and cannot be recovered.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={isDeleting}
            className="h-8 px-3.5 rounded-lg border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive text-xs font-medium shrink-0 cursor-pointer"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Archive Modal */}
      <DeleteModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => {
          onToggleArchive();
          setArchiveOpen(false);
        }}
        title={isArchived ? 'Restore project' : 'Archive project'}
        description={
          isArchived
            ? `Are you sure you want to restore "${projectName}" back to the active sidebar?`
            : `Are you sure you want to archive "${projectName}"? It will be unlisted from your active side navigation.`
        }
        confirmText={isArchived ? 'Restore' : 'Archive'}
        cancelText="Cancel"
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          onDeleteProject();
          setDeleteOpen(false);
        }}
        title="Delete project"
        description={`Are you absolutely sure you want to delete "${projectName}"? This action cannot be undone and will permanently remove all work items and resources.`}
        confirmText="Delete permanently"
        cancelText="Cancel"
        loading={isDeleting}
      />
    </div>
  );
}
