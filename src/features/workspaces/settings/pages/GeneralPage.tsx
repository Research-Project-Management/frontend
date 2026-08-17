'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui';
import { useGeneral } from '@/features/workspaces/settings/hooks/use-general';
import { TopBar } from '../components/layout/TopBar';
import { AvatarSection } from '../components/general/AvatarSection';
import { GeneralForm } from '../components/general/GeneralForm';
import { DangerZone } from '../components/general/DangerZone';
import { DeleteModal } from '../components/modal/DeleteModal';

export default function GeneralPage() {
  const { workspaceId } = useParams() as { workspaceId: string };

  const { state, actions } = useGeneral(workspaceId);

  const {
    form,
    workspace,
    isLoading,
    isError,
    host,
    currentAvatar,
    isUploadingAvatar,
    fileRef,
    isDeleteOpen,
    isSubmitting,
    isDeleting,
    hasChanges,
  } = state;

  const {
    setIsDeleteOpen,
    handleUpdate,
    handleAvatarUpload,
    handleDelete,
  } = actions;

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="General Settings" Icon={Settings} />
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="General Settings" Icon={Settings} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Error loading workspace settings.
        </div>
      </div>
    );
  }

  const slug = `${host}/${workspace.url}`;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="General Settings" Icon={Settings} />

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {/* Profile / Avatar Section */}
          <AvatarSection
            name={workspace.name}
            slug={slug}
            currentAvatar={currentAvatar}
            isUploadingAvatar={isUploadingAvatar}
            fileRef={fileRef}
            onAvatarUpload={handleAvatarUpload}
          />

          <hr className="border-border" />

          {/* General Form Section */}
          <GeneralForm
            form={form}
            slug={slug}
            isSubmitting={isSubmitting}
            hasChanges={hasChanges}
            onSubmit={handleUpdate}
          />

          <hr className="border-border" />

          {/* Danger Zone */}
          <DangerZone onDeleteClick={() => setIsDeleteOpen(true)} />
        </div>
      </div>

      {/* Delete Workspace Confirmation Modal */}
      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Workspace"
        description="Are you sure you want to delete this workspace? This action cannot be undone."
        loading={isDeleting}
      />
    </div>
  );
}
