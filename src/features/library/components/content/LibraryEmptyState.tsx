'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Library,
  Search,
  FolderOpen,
  Trash2,
  Star,
  ShieldCheck,
  Upload,
  Link2,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface LibraryEmptyStateProps {
  search?: string;
  activeFilter?: string | null;
  collectionId?: string;
  collectionName?: string;
  canEdit?: boolean;
  onClearSearch?: () => void;
  onDirectFilesUpload?: (files: File[]) => void;
  onAddLink?: () => void;
  onAddCollection?: () => void;
}

type EmptyStateVariant =
  | 'search'
  | 'trash'
  | 'starred'
  | 'retracted'
  | 'publications'
  | 'saved-search'
  | 'collection'
  | 'default';

interface EmptyStateConfig {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  title: string;
  description: string;
  showDropzone: boolean;
}

export function LibraryEmptyState({
  search = '',
  activeFilter = null,
  collectionId,
  collectionName,
  canEdit = true,
  onClearSearch,
  onDirectFilesUpload,
  onAddLink,
}: LibraryEmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isSearchActive = Boolean(search.trim());

  // Determine current context variant
  const variant: EmptyStateVariant = (() => {
    if (isSearchActive) return 'search';
    if (activeFilter === 'trash' || activeFilter === 'bin') return 'trash';
    if (activeFilter === 'starred' || activeFilter === 'favorites') return 'starred';
    if (activeFilter === 'retracted') return 'retracted';
    if (activeFilter === 'my-publications' || activeFilter === 'publications') return 'publications';
    if (activeFilter === 'saved-search') return 'saved-search';
    if (collectionId) return 'collection';
    return 'default';
  })();

  const getConfig = (): EmptyStateConfig => {
    switch (variant) {
      case 'search':
        return {
          icon: Search,
          title: 'No matching references',
          description: `No records found matching "${search}".`,
          showDropzone: false,
        };
      case 'trash':
        return {
          icon: Trash2,
          title: 'Trash is empty',
          description: 'Deleted references appear here before permanent deletion.',
          showDropzone: false,
        };
      case 'starred':
        return {
          icon: Star,
          title: 'No starred references',
          description: 'Star items to save them here for quick access.',
          showDropzone: false,
        };
      case 'retracted':
        return {
          icon: ShieldCheck,
          title: 'No retracted items',
          description: 'No retraction notices detected across your references.',
          showDropzone: false,
        };
      case 'publications':
        return {
          icon: UserCheck,
          title: 'No publications',
          description: 'Add your authored or co-authored papers to organize your publications.',
          showDropzone: true,
        };
      case 'saved-search':
        return {
          icon: Search,
          title: 'No results',
          description: 'No references match the active filter criteria.',
          showDropzone: false,
        };
      case 'collection':
        return {
          icon: FolderOpen,
          title: collectionName || 'Collection is empty',
          description: 'Drag references here or import files directly into this collection.',
          showDropzone: true,
        };
      case 'default':
      default:
        return {
          icon: Library,
          title: 'No references',
          description: 'Upload PDFs or import bibliography files to build your library.',
          showDropzone: true,
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  // File drag & drop handling
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || !onDirectFilesUpload || !config.showDropzone) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [canEdit, onDirectFilesUpload, config.showDropzone],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!canEdit || !onDirectFilesUpload || !config.showDropzone) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onDirectFilesUpload(Array.from(e.dataTransfer.files));
      }
    },
    [canEdit, onDirectFilesUpload, config.showDropzone],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onDirectFilesUpload) {
      onDirectFilesUpload(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 w-full h-full min-h-[380px] flex items-center justify-center p-6 select-none animate-in fade-in-50 duration-150"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.bib,.ris,.json,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Central Workbench Box */}
      <div
        className={cn(
          'w-full max-w-sm flex flex-col items-center text-center p-6 rounded-md transition-colors',
          config.showDropzone && canEdit
            ? isDragOver
              ? 'border border-dashed border-primary bg-primary/5 ring-1 ring-primary'
              : 'border border-dashed border-border bg-background hover:border-border'
            : 'border border-border bg-background',
        )}
      >
        {/* Abstract Minimal Icon Mark */}
        <div className="size-9 rounded-md border border-border bg-muted shadow-2xs flex items-center justify-center text-foreground shrink-0 mb-3">
          <IconComponent className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h3 className="text-13 font-medium text-foreground tracking-tight mb-1">
          {config.title}
        </h3>

        {/* Description */}
        <p className="text-12 text-muted-foreground leading-normal max-w-[260px] mb-4 font-normal">
          {config.description}
        </p>

        {/* Contextual Actions */}
        {variant === 'search' ? (
          onClearSearch && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearSearch}
              className="h-7 px-3 rounded-md text-12 font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
            >
              Clear search
            </Button>
          )
        ) : canEdit && config.showDropzone ? (
          <div className="flex flex-col items-center gap-2.5 w-full">
            <div className="flex items-center gap-2">
              {onDirectFilesUpload && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 px-3 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
                >
                  <Upload className="size-3.5 mr-1.5 shrink-0" strokeWidth={1.5} />
                  <span>Import files</span>
                </Button>
              )}

              {onAddLink && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddLink}
                  className="h-7 px-3 rounded-md text-12 font-medium border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
                >
                  <Link2 className="size-3.5 mr-1.5 shrink-0" strokeWidth={1.5} />
                  <span>Add via DOI</span>
                </Button>
              )}
            </div>

            {/* Supported Formats Footnote */}
            <div className="flex items-center gap-1 text-11 font-mono text-muted-foreground mt-1">
              <span>Drop files here (.pdf, .bib, .ris)</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LibraryEmptyState;
