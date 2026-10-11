'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { PageService } from '@/features/projects/project-id/pages/services/page.service';
import { pageService } from '@/features/editor/sdk';

export interface ProjectTabPaneProps {
  projectId?: string;
  parentPageId: string | null;
  createFile: any;
  setSearchParams: (params: Record<string, string>) => void;
  onClose: () => void;
}

export function ProjectTabPane({
  projectId = '',
  parentPageId,
  createFile,
  setSearchParams,
  onClose,
}: ProjectTabPaneProps) {
  const { projects: allProjects = [], isLoading: isLoadingProjects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [projectTargetName, setProjectTargetName] = useState<string>('');
  const [isCopyingFromProject, setIsCopyingFromProject] = useState(false);

  const availableProjects = useMemo(() => {
    return allProjects.filter((p: any) => p.id !== projectId);
  }, [allProjects, projectId]);

  const {
    data: otherProjectPages = [],
    isLoading: isLoadingOtherPages,
  } = useQuery({
    queryKey: ['project-pages-for-copy', selectedProjectId],
    queryFn: () => PageService.getProjectPages(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const handleCopyFromProject = async () => {
    if (!parentPageId || !selectedFileId || !projectTargetName.trim()) return;
    setIsCopyingFromProject(true);
    try {
      const sourcePage = await pageService.getById(selectedFileId);
      const rawContent = sourcePage?.content;
      const contentStr = typeof rawContent === 'string'
        ? rawContent
        : (rawContent as any)?.text || (rawContent as any)?.content || '';
      createFile.mutate(
        {
          parentPageId,
          title: projectTargetName.trim(),
          content: contentStr,
        },
        {
          onSuccess: (created: any) => {
            setSearchParams({ file: created.id });
            onClose();
          },
          onSettled: () => {
            setIsCopyingFromProject(false);
          },
        },
      );
    } catch {
      setIsCopyingFromProject(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-3 pt-1">
        {/* Select Project */}
        <div className="space-y-1">
          <label className="text-12 font-medium text-foreground">
            Project
          </label>
          {isLoadingProjects ? (
            <div className="flex items-center gap-2 text-12 text-muted-foreground py-2">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
              Loading projects...
            </div>
          ) : availableProjects.length === 0 ? (
            <p className="text-12 text-muted-foreground py-1">
              No other projects found in your workspace.
            </p>
          ) : (
            <Select
              value={selectedProjectId}
              onValueChange={(val) => {
                setSelectedProjectId(val);
                setSelectedFileId('');
                setProjectTargetName('');
              }}
            >
              <SelectTrigger className="h-8 text-12 bg-muted/40 rounded-md border-border/60">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p: any) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="text-12"
                  >
                    {p.name || p.title || 'Untitled Project'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Select File from Chosen Project */}
        {selectedProjectId && (
          <div className="space-y-1">
            <label className="text-12 font-medium text-foreground">
              File to copy
            </label>
            {isLoadingOtherPages ? (
              <div className="flex items-center gap-2 text-12 text-muted-foreground py-2">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                Loading files...
              </div>
            ) : otherProjectPages.length === 0 ? (
              <p className="text-12 text-muted-foreground py-1">
                No files found in selected project.
              </p>
            ) : (
              <Select
                value={selectedFileId}
                onValueChange={(val) => {
                  setSelectedFileId(val);
                  const target = otherProjectPages.find(
                    (f: any) => f.id === val,
                  );
                  if (target) setProjectTargetName(target.title);
                }}
              >
                <SelectTrigger className="h-8 text-12 bg-muted/40 rounded-md border-border/60">
                  <SelectValue placeholder="Select a file" />
                </SelectTrigger>
                <SelectContent>
                  {otherProjectPages.map((f: any) => (
                    <SelectItem
                      key={f.id}
                      value={f.id}
                      className="text-12"
                    >
                      {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Target File Name in this project */}
        {selectedFileId && (
          <div className="space-y-1">
            <label className="text-12 font-medium text-foreground">
              File name in this project
            </label>
            <Input
              value={projectTargetName}
              onChange={(e) => setProjectTargetName(e.target.value)}
              placeholder="File name"
              className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={
            !selectedFileId ||
            !projectTargetName.trim() ||
            isCopyingFromProject
          }
          onClick={handleCopyFromProject}
          className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
        >
          {isCopyingFromProject && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          )}
          <span>Create</span>
        </Button>
      </div>
    </div>
  );
}
