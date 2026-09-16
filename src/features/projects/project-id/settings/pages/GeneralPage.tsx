'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { Skeleton } from "@/shared/components/ui";
import TopBar from '../components/layout/TopBar';
import { GeneralBanner } from '../components/general/Banner';
import { GeneralDetails } from '../components/general/Details';
import { GeneralDanger } from '../components/general/Danger';
import { useGeneral } from '../hooks/use-general';

export default function GeneralPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();

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
    isArchived,
    createdAt,
    // Actions
    hasChanges,
    save,
    errors,
    isSaving,
    isUploading,
    handleSelectAvatar,
    handleSelectCover,
    handleUploadCustomCover,
    toggleArchive,
    deleteProj,
    isDeleting,
  } = useGeneral(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="General"
          Icon={Settings}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
            <Skeleton className="h-44 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-28 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="General"
          Icon={Settings}
        />
        <div className="flex-1 p-5 md:p-6 text-sm text-muted-foreground">
          Error loading project details.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <TopBar
        title="General"
        Icon={Settings}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
          {/* ── Visual Banner & Icon ── */}
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

          {/* ── Core Details Form & Update Action ── */}
          <GeneralDetails
            name={name}
            identifier={identifier}
            description={description}
            createdAt={createdAt}
            isSaving={isSaving}
            hasChanges={hasChanges}
            errors={errors}
            onNameChange={setName}
            onIdentifierChange={setIdentifier}
            onDescriptionChange={setDescription}
            onSubmit={save}
          />

          {/* ── Danger Zone: Archive & Delete ── */}
          <GeneralDanger
            projectName={project.name || name}
            isArchived={isArchived}
            onToggleArchive={toggleArchive}
            onDeleteProject={deleteProj}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </div>
  );
}
