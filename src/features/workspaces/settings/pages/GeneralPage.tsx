'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { BuildingOfficeIcon } from '../components/icons/BuildingOfficeIcon';
import { Skeleton } from "@/shared/components/ui";
import { useGeneral } from '@/features/workspaces/settings/hooks/use-general';
import { TopBar } from '../components/layout/TopBar';
import { AvatarSection } from '../components/general/AvatarSection';
import { GeneralForm } from '../components/general/GeneralForm';
import { DangerZone } from '../components/general/DangerZone';
import { DeleteModal } from '../components/modal/DeleteModal';

export default function GeneralPage() {
  const { workspaceId = '' } = useParams() as { workspaceId?: string };

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
        <TopBar title="General" Icon={BuildingOfficeIcon} />
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <TopBar title="General" Icon={BuildingOfficeIcon} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Error loading workspace settings.
        </div>
      </div>
    );
  }

  const slug = `${host}/${workspace.url}`;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="General" Icon={BuildingOfficeIcon} />

      <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
        <div className="w-full max-w-5xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">General Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your personal research laboratory identity, workbench URL, and environment preferences.
            </p>
          </div>

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
        title="Delete Personal Workspace"
        description="Are you sure you want to permanently delete this personal research workspace? All associated projects, papers, notes, and records will be deleted."
        loading={isDeleting}
      />
    </div>
  );
}
