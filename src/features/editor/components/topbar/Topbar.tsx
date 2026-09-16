'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Home, PanelLeft } from 'lucide-react';

import {
  Menubar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";

import FileMenu from './file/FileMenu';
import EditMenu from './edit/EditMenu';
import ViewMenu from './view/ViewMenu';
import InsertMenu from './insert/InsertMenu';
import FormatMenu from './format/FormatMenu';
import DocumentBreadcrumb from './breadcrumb/DocumentBreadcrumb';
import LayoutSwitcher from './view/LayoutSwitcher';
import Trigger from './settings/Trigger';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export default function Topbar() {
  const params = useParams<{ projectId?: string }>();
  const homeHref = params?.projectId ? `/projects/${params.projectId}` : '/projects';

  return (
    <nav
      aria-label="Editor toolbar"
      className="flex h-11 items-center justify-between gap-2 px-2 py-1 border-b border-border bg-muted shrink-0 z-10 select-none"
    >
      {/* ── Left: Logo (Back to project / Home), Main Menubar ── */}
      <div className="flex items-center min-w-0 shrink-0 gap-1">
        {/* Mobile sidebar drawer trigger */}
        <button
          type="button"
          onClick={() => EditorEventBus.emit('flux:toggle-sidebar')}
          title="Open Explorer & Tools"
          aria-label="Open Explorer & Tools"
          className="md:hidden flex items-center justify-center p-1.5 rounded text-foreground hover:bg-sidebar-hover transition-colors mr-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <PanelLeft className="size-4 shrink-0" />
        </button>

        <TooltipProvider delayDuration={150}>
          {/* Single Logo button: click to go back to project, hover transforms to Home icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={homeHref}
                aria-label="Back to your project"
                className="group relative flex size-8 items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0 cursor-pointer"
              >
                <img
                  src="/Flux.svg"
                  className="size-5 shrink-0 transition-[opacity,transform] duration-150 group-hover:scale-0 group-hover:opacity-0"
                  alt="Flux"
                />
                <Home
                  className="size-4 shrink-0 text-foreground transition-[opacity,transform] duration-150 absolute scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Back to your project
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Menubar className="h-8 border-none bg-transparent p-0 gap-0.5 shadow-none">
          {/* Sub-menu Tabs */}
          <FileMenu />
          <EditMenu />
          <ViewMenu />
          <InsertMenu />
          <FormatMenu />
        </Menubar>
      </div>

      {/* ── Center: Document Breadcrumb & Inline Rename ── */}
      <DocumentBreadcrumb />

      {/* ── Right: Quick Layout Switcher & Settings Trigger ── */}
      <div className="flex items-center gap-1 shrink-0">
        <LayoutSwitcher />
        <Trigger />
      </div>
    </nav>
  );
}
