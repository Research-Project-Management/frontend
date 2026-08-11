
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PenLine, Search, LayoutGrid, List, FileText, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Label } from '@/shared/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
import { useWorkspacePages, useProjectPages, useCreatePage } from '../services/page.services';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';
import { toast } from 'sonner';

export default function DraftPage({ projectId: initialProjectId }: { projectId?: string }) {
  const { workspaceId } = useParams() as { workspaceId: string };
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  
  const { data: workspacePages, isLoading: isWorkspaceLoading } = useWorkspacePages(
    workspaceId,
    undefined,
    undefined,
    { enabled: !initialProjectId }
  );

  const { data: projectPages, isLoading: isProjectLoading } = useProjectPages(
    initialProjectId || '',
    undefined,
    undefined,
    { enabled: !!initialProjectId }
  );

  const pages = initialProjectId ? (projectPages ?? []) : (workspacePages ?? []);
  const isLoading = initialProjectId ? isProjectLoading : isWorkspaceLoading;

  const { projects } = useProjects();
  const { mutateAsync: createPage, isPending: isCreating } = useCreatePage();

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a document title');
      return;
    }
    const targetProjectId = initialProjectId || selectedProjectId;
    if (!targetProjectId) {
      toast.error('Please select a project');
      return;
    }

    try {
      const result = await createPage({
        projectId: targetProjectId,
        title: title.trim(),
        content: '',
      });
      setIsCreateModalOpen(false);
      setTitle('');
      toast.success('Document created successfully');
      // Redirect to the new document in the editor
      const mainFileStr = result.mainFile ? (typeof result.mainFile === 'object' ? result.mainFile._id : result.mainFile) : null;
      const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
      router.push(`/${workspaceId}/projects/${targetProjectId}/pages/${result.page._id}${fileQuery}`);
    } catch (error) {
      console.error(error);
      // useCreatePage already shows a toast error
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <PenLine className="size-4.5 text-primary" />
          <h1 className="text-sm font-semibold text-foreground transition-all duration-200">
            {initialProjectId ? 'Project Pages' : 'All Drafts'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Search className="size-4" />
          </Button>
          
          <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/20">
            <Button
              variant={viewMode === 'grid' ? "secondary" : "ghost"}
              size="icon"
              className={`h-7 w-7 rounded-sm ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? "secondary" : "ghost"}
              size="icon"
              className={`h-7 w-7 rounded-sm ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="size-3.5" />
            </Button>
          </div>

          <Button 
            size="sm" 
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 ml-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Add Document
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!isLoading && pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 -mt-10">
            <div className="flex items-center justify-center size-20 rounded-2xl bg-muted/40">
              <FileText className="size-8 text-muted-foreground/50" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="font-semibold text-foreground">No documents yet</h3>
              <p className="text-sm text-muted-foreground">Create your first LaTeX document to get started</p>
            </div>
            <Button 
              size="sm" 
              className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              Add Document
            </Button>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {pages.map((page: any) => {
              const projId = typeof page.projectId === 'object' ? page.projectId?._id : page.projectId;
              const mainFileStr = page.mainFile ? (typeof page.mainFile === 'object' ? page.mainFile._id : page.mainFile) : null;
              const fileQuery = mainFileStr ? `?file=${mainFileStr}` : '';
              return (
                <Link 
                  key={page._id} 
                  href={`/${workspaceId}/projects/${projId}/pages/${page._id}${fileQuery}`}
                  className="group flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-muted/30 border-b border-border flex items-center justify-center overflow-hidden">
                    {page.pdfThumbnail ? (
                      <img src={page.pdfThumbnail} alt={page.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="size-10 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors" />
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-1.5">
                    <h3 className="font-semibold text-sm line-clamp-1 transition-colors">
                      {page.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(page.updatedAt).toLocaleDateString()}</span>
                      <span className="truncate max-w-[100px] text-right">{page.author?.name}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                placeholder="Enter document title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
            
            {!initialProjectId && (
              <div className="grid gap-2">
                <Label>Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project: any) => (
                      <SelectItem key={project._id} value={project._id}>
                        {project.title || project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
