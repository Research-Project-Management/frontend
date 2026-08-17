'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowUpLeft } from 'lucide-react';

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from '@/shared/components/ui';

import FileMenu from './file/FileMenu';
import EditMenu from './edit/EditMenu';
import ViewMenu from './view/ViewMenu';
import InsertMenu from './insert/InsertMenu';
import FormatMenu from './format/FormatMenu';
import DocumentBreadcrumb from './breadcrumb/DocumentBreadcrumb';
import LayoutSwitcher from './view/LayoutSwitcher';
import Trigger from './settings/Trigger';

export default function Topbar() {
  const params = useParams<{ workspaceId?: string }>();
  const homeHref = params?.workspaceId ? `/${params.workspaceId}` : '/ws';

  return (
    <nav
      aria-label="Editor toolbar"
      className="flex h-12 items-center justify-between gap-2 px-2 py-1 border-b border-border bg-background shrink-0 z-10"
    >
      {/* ── Left: Main Menubar (Home, File, Edit, View, Insert, Format) ── */}
      <div className="flex items-center min-w-0 shrink-0">
        <Menubar className="h-8 border-none bg-transparent p-0 gap-0.5 shadow-none">
          {/* Back to workspace / Home link */}
          <MenubarMenu>
            <MenubarTrigger asChild>
              <Link
                href={homeHref}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm hover:bg-muted focus:bg-muted outline-none"
              >
                <ArrowUpLeft className="size-3.5" />
                <span>Home</span>
              </Link>
            </MenubarTrigger>
          </MenubarMenu>

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
