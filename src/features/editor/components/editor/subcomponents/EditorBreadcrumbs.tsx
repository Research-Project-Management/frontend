'use client';

import React from 'react';
import { Folder, FileCode2 } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb';
import { useSettingsStore } from '@/features/editor/store';

export interface EditorBreadcrumbsProps {
  projectTitle?: string;
  fileName?: string;
  onNavigateRoot?: () => void;
}

export function EditorBreadcrumbs({
  projectTitle = 'Project',
  fileName = 'main.tex',
  onNavigateRoot,
}: EditorBreadcrumbsProps) {
  const showBreadcrumbs = useSettingsStore((s) => s.showBreadcrumbs);

  if (!showBreadcrumbs) return null;

  return (
    <nav
      aria-label="Document Breadcrumb"
      className="h-6 px-3 bg-muted/20 border-b border-border/40 flex items-center shrink-0 select-none"
    >
      <Breadcrumb>
        <BreadcrumbList className="text-11 text-muted-foreground flex items-center gap-1.5 font-sans leading-none">
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={onNavigateRoot}
              className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
            >
              <Folder className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{projectTitle}</span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator className="opacity-40" />

          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium text-foreground flex items-center gap-1 font-mono">
              <FileCode2 className="size-3 text-primary shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-[240px]">{fileName}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </nav>
  );
}

export default EditorBreadcrumbs;
