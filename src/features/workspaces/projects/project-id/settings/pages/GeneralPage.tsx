'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { GeneralBanner } from '../components/general/Banner';
import { GeneralDetails } from '../components/general/Details';
import { GeneralDanger } from '../components/general/Danger';
import { useGeneral } from '../hooks/use-general';

export default function GeneralPage() {
  const { workspaceId, projectId } = useParams() as {
    workspaceId: string;
    projectId: string;
  };

  const {
    project,
    isLoading,
    isError,
    // Fields
    name,
    setName,
    identifier,
    setIdentifier,
    description,
    setDescription,
    avatar,
    cover,
    isPrivate,
    setIsPrivate,
    timezone,
    setTimezone,
    isArchived,
    createdAt,
    // Actions
    hasChanges,
    save,
    isSaving,
    isUploading,
    handleSelectAvatar,
    handleSelectCover,
    handleUploadCustomCover,
    toggleArchive,
    deleteProj,
    isDeleting,
  } = useGeneral(projectId, workspaceId);

  if (isLoading) {
    return (
      <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="px-6 md:px-10 lg:px-12 py-8 text-sm text-muted-foreground">
        Error loading project details.
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 lg:px-12 py-8 md:py-10 max-w-6xl mx-auto space-y-8">
      {/* ── Visual Banner & Icon (Image 1) ── */}
      <GeneralBanner
        name={name}
        identifier={identifier}
        isPrivate={isPrivate}
        avatar={avatar}
        cover={cover}
        isUploading={isUploading}
        onSelectAvatar={handleSelectAvatar}
        onSelectCover={handleSelectCover}
        onUploadCustomCover={handleUploadCustomCover}
      />

      {/* ── Core Details Form & Update Action (Image 1 & 2) ── */}
      <GeneralDetails
        name={name}
        identifier={identifier}
        description={description}
        isPrivate={isPrivate}
        timezone={timezone}
        createdAt={createdAt}
        isSaving={isSaving}
        hasChanges={hasChanges}
        onNameChange={setName}
        onIdentifierChange={setIdentifier}
        onDescriptionChange={setDescription}
        onPrivateChange={setIsPrivate}
        onTimezoneChange={setTimezone}
        onSubmit={save}
      />

      {/* ── Danger Zone: Archive & Delete (Image 2) ── */}
      <GeneralDanger
        projectName={project.name || name}
        isArchived={isArchived}
        onToggleArchive={toggleArchive}
        onDeleteProject={deleteProj}
        isDeleting={isDeleting}
      />
    </div>
  );
}
