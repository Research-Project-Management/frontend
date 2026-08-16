'use client';

import { useParams } from "next/navigation";

import { useProject } from '@/features/workspaces/projects/shell/services/project.service';
import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';


import { Trash2 } from "lucide-react";
import { Skeleton } from '@/shared/components/ui';
import ListView from '../components/views/ListView';
import GridView from '../components/views/GridView';
import { useViewStore } from '../store/use-view-store';
import { usePreviewStore } from '../store/use-preview-store';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';
import { downloadFileUrl } from '@/shared/utils/file';
import Topbar from '../components/layout/Topbar';

export default function ProjectTrashPage() {
  const { projectId } = useParams() as { projectId: string };
  const { view } = useViewStore();
  const setSelectedItem = usePreviewStore(s => s.setSelectedItem);
  const { data: projectData, isLoading: isProjectLoading } = useProject(
    projectId!,
  );

  const { data, isLoading: isFilesLoading } = useTrash(projectId!);
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  const handleDownload = async (item: StorageItem) => {
    if (!item.url) return;
    try {
      await downloadFileUrl(item.url, item.filename);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  if (isProjectLoading || isFilesLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  if (!projectId) {
    return <div className="p-6">Project not found</div>;
  }

  const files = (data?.files || []) as StorageItem[];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar title="Trash" icon={Trash2} projectId={projectId} />
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        {view === 'list' ? (
          <ListView
            items={files}
            onToggleStar={(id) => { handleRestore(id); }}
            onDelete={(id) => { handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        ) : (
          <GridView
            items={files}
            onToggleStar={(id) => { handleRestore(id); }}
            onDelete={(id) => { handlePermanentlyDelete(id); }}
            onDownload={handleDownload}
            onFileClick={(item) => setSelectedItem(item)}
            isTrash={true}
          />
        )}
      </div>
    </div>
  );
}
