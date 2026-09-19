'use client';

import React from 'react';
import { FolderOpen, PanelRight, Plus, FolderPlus, FileUp } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { TopbarSearch } from './TopbarSearch';
import { TopbarBulkBar } from './TopbarBulkBar';
import { useLibraryModalStore } from '../../store/library-modal.store';
import { useLibrarySidebarStore } from '../../store/sidebar.store';

interface LibraryTopbarProps {
  title?: string;
  count?: number;
}

export function LibraryTopbar({
  title = 'My Library',
  count,
}: LibraryTopbarProps) {
  const openModal = useLibraryModalStore((s) => s.openModal);
  const isInspectorOpen = useLibrarySidebarStore((s) => s.isInspectorOpen);
  const toggleInspector = useLibrarySidebarStore((s) => s.toggleInspector);

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 1. Left: Breadcrumb & Title */}
      <div className="flex items-center gap-2 min-w-0">
        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
        <h1 className="text-sm font-semibold truncate tracking-tight text-foreground">
          {title}
        </h1>
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground font-mono">
            ({count})
          </span>
        )}
      </div>

      {/* 2. Middle: Bulk Action Bar or Search */}
      <div className="flex items-center gap-3">
        <TopbarBulkBar />
        <TopbarSearch />
      </div>

      {/* 3. Right: Add actions & Inspector Toggle */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Thêm mới
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuItem
              onClick={() => openModal('CREATE_COLLECTION')}
              className="gap-2 cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
              Thư mục mới
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => openModal('IMPORT_PAPER')}
              className="gap-2 cursor-pointer"
            >
              <FileUp className="h-4 w-4 text-muted-foreground" />
              Tải tài liệu (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleInspector}
          className={`h-8 w-8 text-muted-foreground hover:text-foreground ${
            isInspectorOpen ? 'bg-accent text-accent-foreground' : ''
          }`}
          title="Đóng/Mở chi tiết (Inspector)"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
