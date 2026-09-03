'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BookOpen, Search, Download, Plus, Library } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useCatalogItems as usePapers } from '@/features/workspaces/library/hooks/library/use-items';
import { useCollections } from '@/features/workspaces/library/hooks/library/use-library';
import ItemTable from '@/features/workspaces/library/components/Table';
import Panel from '@/features/workspaces/library/components/Panel';
import UploadModal from '@/features/workspaces/library/components/modals/UploadModal';
import CreateCollectionModal from '@/features/workspaces/library/components/modals/CreateCollectionModal';
import { convertToBibTeX, filterPapers } from '@/features/workspaces/library/utils/library.util';
import type { Paper } from '@/features/workspaces/library/types/library.types';

export default function ReferencesPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const workspaceUrl = params?.workspaceId || '';
  const projectId = params?.projectId || '';
  const router = useRouter();

  const projectQuery = useProject(projectId);
  const project = projectQuery.state.project;
  const paperService = usePapers({ workspaceId: workspaceUrl });
  const collectionService = useCollections(workspaceUrl);

  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'folder' | 'link'>('file');
  const [createColOpen, setCreateColOpen] = useState(false);

  const allPapers = useMemo(
    () => paperService.state.allPapers ?? [],
    [paperService.state.allPapers],
  );
  const collections = useMemo(
    () => collectionService.state.collections ?? [],
    [collectionService.state.collections],
  );
  const isLoading = paperService.state.isLoadingAll || projectQuery.isLoading;

  // Filter papers for search query
  const filteredPapers = useMemo(() => {
    return filterPapers(allPapers, search, null, null);
  }, [allPapers, search]);

  const selectedPaper = useMemo(() => {
    if (!selectedPaperId) return null;
    return allPapers.find((p: Paper) => p.id === selectedPaperId) ?? null;
  }, [allPapers, selectedPaperId]);

  const handleSelectPaper = (paper: Paper) => {
    setSelectedPaperId((prev) => (prev === paper.id ? null : paper.id || null));
  };

  const handleDeletePaper = (paperId: string) => {
    paperService.actions.deletePaper({ paperId });
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

  const handleBatchDeletePapers = (paperIds: string[]) => {
    for (const paperId of paperIds) {
      paperService.actions.deletePaper({ paperId });
    }
    if (selectedPaperId && paperIds.includes(selectedPaperId)) {
      setSelectedPaperId(null);
    }
  };

  const handleBatchMovePapers = (paperIds: string[], targetCollectionId: string | null) => {
    for (const paperId of paperIds) {
      paperService.actions.updatePaper({ paperId, collectionId: targetCollectionId ?? undefined });
    }
  };

  const handleExportBibtex = () => {
    if (allPapers.length === 0) {
      toast.error('No references to export');
      return;
    }
    const bibtex = allPapers.map((p: Paper) => convertToBibTeX(p)).join('\n\n');
    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${project?.name ? project.name.toLowerCase().replace(/\s+/g, '-') : 'references'}.bib`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported project references to .bib file');
  };

  const handleOpenUpload = (mode: 'file' | 'folder' | 'link' = 'file') => {
    setUploadMode(mode);
    setUploadOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-border/50 bg-background px-6 h-14 shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="size-4.5 text-foreground shrink-0" />
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
            {project?.name ? `${project.name} References` : 'Project References'}
          </h1>
          <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
            {filteredPapers.length} {filteredPapers.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Search & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Search */}
          <div className="relative flex items-center w-48 sm:w-56 h-8 rounded-md border border-border/50 bg-background/60 hover:bg-background focus-within:bg-background focus-within:border-primary/50 transition-colors">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search references..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full text-xs py-0 bg-transparent focus:outline-none border-none shadow-none w-full placeholder:text-muted-foreground/60 pl-8 pr-7"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45" />
              </button>
            )}
          </div>

          {/* Export BibTeX */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBibtex}
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted cursor-pointer"
            title="Download .bib file for this project"
          >
            <Download className="size-3.5 text-foreground" />
            <span className="hidden sm:inline">Export .bib</span>
          </Button>

          {/* Add Reference Button */}
          <Button
            size="sm"
            onClick={() => handleOpenUpload('file')}
            className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Reference</span>
          </Button>
        </div>
      </header>

      {/* Main Table + Inspector Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <main className="flex-1 overflow-auto p-4 sm:p-6 min-w-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center border border-dashed border-border/60 rounded-xl p-8 bg-muted/10">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <BookOpen className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No references found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add references or academic papers to this project to enable citation auto-complete and bibtex compilation in Editor.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenUpload('file')}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Add Reference
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/${workspaceUrl}/library`)}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Library className="size-3.5" />
                  Open Workspace Library
                </Button>
              </div>
            </div>
          ) : (
            <ItemTable
              papers={filteredPapers}
              collections={collections}
              isLoading={isLoading}
              isSearch={Boolean(search.trim())}
              selectedPaperId={selectedPaperId}
              onSelectPaper={handleSelectPaper}
              onDeletePaper={handleDeletePaper}
              onBatchDeletePapers={handleBatchDeletePapers}
              onBatchMovePapers={handleBatchMovePapers}
              onClearSearch={() => setSearch('')}
              onAddPaper={() => handleOpenUpload('file')}
            />
          )}
        </main>

        {/* Metadata Inspector Right Panel */}
        {selectedPaper && (
          <Panel
            paper={selectedPaper}
            workspaceId={workspaceUrl}
            onClose={() => setSelectedPaperId(null)}
          />
        )}
      </div>

      {/* Upload Modal (DOI, File, Link) */}
      {workspaceUrl && (
        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={async (data) => {
            await paperService.actions.addPaper(data);
            setUploadOpen(false);
          }}
          isPending={paperService.state.isAdding}
          workspaceId={workspaceUrl}
          initialMode={uploadMode}
        />
      )}

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createColOpen}
        onOpenChange={setCreateColOpen}
        collections={collections}
        onSubmit={async (data) => {
          await collectionService.actions.createAsync(data);
          setCreateColOpen(false);
        }}
        isPending={collectionService.state.isCreating}
      />
    </div>
  );
}
