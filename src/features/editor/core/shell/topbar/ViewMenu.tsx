'use client';

/**
 * ViewMenu.tsx
 *
 * Topbar View Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/ViewMenu.tsx`
 */

import React from 'react';
import { useParams } from 'next/navigation';
import {
  Columns2,
  Scan,
  Check,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarSeparator } from '@/shared/components/ui/menubar';
import { cn } from "@/shared/lib/utils";
import { editorCommandBus } from '@/features/editor/core';
import { useSettingsStore } from '@/features/editor/core';
import { useWorkspaceStore } from '@/features/editor/core';
import { useShallow } from 'zustand/react/shallow';
import { PenIcon, PdfDocIcon, toggleFocusMode, detachPdfPreview } from './LayoutSwitcher';

function CommentPenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h4" />
      <path d="M8 7h8" />
    </svg>
  );
}

export function ViewMenu() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const {
    layout,
    setLayout,
    editorMode,
    setEditorMode,
    reviewMode,
    setReviewMode,
    isLocked,
    setIsLocked,
    showEditorTabs,
    toggleShowEditorTabs,
    showEquationPreview,
    toggleShowEquationPreview,
  } = useSettingsStore(
    useShallow((s) => ({
      layout: s.layout,
      setLayout: s.setLayout,
      editorMode: s.editorMode,
      setEditorMode: s.setEditorMode,
      reviewMode: s.reviewMode,
      setReviewMode: s.setReviewMode,
      isLocked: s.isLocked,
      setIsLocked: s.setIsLocked,
      showEditorTabs: s.showEditorTabs,
      toggleShowEditorTabs: s.toggleShowEditorTabs,
      showEquationPreview: s.showEquationPreview,
      toggleShowEquationPreview: s.toggleShowEquationPreview,
    }))
  );

  const fileOutlineOpen = useWorkspaceStore((s) => s.fileOutlineOpen);
  const currentEditingMode = isLocked ? 'viewing' : reviewMode ? 'reviewing' : 'editing';

  const handleSelectEditingMode = (mode: 'editing' | 'reviewing' | 'viewing') => {
    if (mode === 'viewing') {
      setIsLocked(true);
      setReviewMode(false);
    } else if (mode === 'reviewing') {
      setIsLocked(false);
      setReviewMode(true);
    } else {
      setIsLocked(false);
      setReviewMode(false);
    }
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary select-none transition-colors">
        View
      </MenubarTrigger>

      <MenubarContent className="min-w-64 text-xs select-none">
        {/* ── Section 1: Layout options ── */}
        <div className="text-12 font-medium text-muted-foreground px-2.5 py-1.5 select-none whitespace-nowrap">
          Layout options
        </div>

        {/* 1. Split view */}
        <MenubarItem
          onClick={() => setLayout('split')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'split'
              ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'split' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <Columns2 className="size-4 opacity-70" strokeWidth={1.8} />
            )}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Split view</span>
        </MenubarItem>

        {/* 2. Editor only */}
        <MenubarItem
          onClick={() => setLayout('editor-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'editor-only'
              ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'editor-only' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <PenIcon className="size-3.5 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Editor only</span>
        </MenubarItem>

        {/* 3. PDF only */}
        <MenubarItem
          onClick={() => setLayout('viewer-only')}
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
            layout === 'viewer-only'
              ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
              : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
          )}
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {layout === 'viewer-only' ? (
              <Check className="size-4 text-primary stroke-[2.5]" />
            ) : (
              <PdfDocIcon className="size-4 opacity-70" />
            )}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">PDF only</span>
        </MenubarItem>

        {/* 4. Open PDF in separate tab */}
        <MenubarItem
          onClick={() => detachPdfPreview(params?.projectId)}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            <ExternalLink className="size-4 opacity-70" strokeWidth={1.8} />
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Open PDF in separate tab</span>
        </MenubarItem>

        {/* 5. Focus mode */}
        <MenubarItem
          onClick={toggleFocusMode}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            <Scan className="size-4 opacity-70" strokeWidth={1.8} />
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Focus mode</span>
          <kbd className="text-11 font-mono text-muted-foreground ml-auto whitespace-nowrap shrink-0">Ctrl Shift M</kbd>
        </MenubarItem>

        <MenubarSeparator />

        {/* ── Section 2: Editor display mode (Source vs Visual) ── */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span>Editor display mode</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-44 text-xs">
            <MenubarItem
              onClick={() => setEditorMode('code')}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                editorMode === 'code'
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                {editorMode === 'code' && <Check className="size-3.5 text-primary stroke-[2.5]" />}
              </div>
              <span className="flex-1 text-xs">Code (LaTeX)</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => setEditorMode('visual')}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                editorMode === 'visual'
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                {editorMode === 'visual' && <Check className="size-3.5 text-primary stroke-[2.5]" />}
              </div>
              <span className="flex-1 text-xs">Visual Editor (Rich Text)</span>
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* ── Section 3: Editing mode ── */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span>Editing mode</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-40 text-xs">
            <MenubarItem
              onClick={() => handleSelectEditingMode('editing')}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                currentEditingMode === 'editing'
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                <PenIcon className={cn('size-3.5 text-foreground', currentEditingMode !== 'editing' && 'opacity-70')} />
              </div>
              <span className="flex-1 text-xs">Editing</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => handleSelectEditingMode('reviewing')}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                currentEditingMode === 'reviewing'
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                <CommentPenIcon className={cn('size-3.5 text-foreground', currentEditingMode !== 'reviewing' && 'opacity-70')} />
              </div>
              <span className="flex-1 text-xs">Reviewing</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => handleSelectEditingMode('viewing')}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                currentEditingMode === 'viewing'
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                <Eye className={cn('size-3.5 text-foreground', currentEditingMode !== 'viewing' && 'opacity-70')} />
              </div>
              <span className="flex-1 text-xs">Viewing</span>
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* Divider */}
        <MenubarSeparator />

        {/* ── Section 3: Editor settings ── */}
        <div className="text-12 font-medium text-muted-foreground px-2.5 py-1.5 select-none whitespace-nowrap">
          Editor settings
        </div>

        {/* Show editor tabs */}
        <MenubarItem
          onClick={toggleShowEditorTabs}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {showEditorTabs && <Check className="size-3.5 text-primary stroke-[2.5]" />}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Show editor tabs</span>
        </MenubarItem>

        {/* Show equation preview */}
        <MenubarItem
          onClick={toggleShowEquationPreview}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {showEquationPreview && <Check className="size-3.5 text-primary stroke-[2.5]" />}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Show equation preview</span>
        </MenubarItem>

        {/* Show file outline */}
        <MenubarItem
          onClick={() => {
            useWorkspaceStore.getState().setSidebarLeftOpen(true);
            useWorkspaceStore.getState().setActiveSidebarTab('files');
            useWorkspaceStore.getState().toggleFileOutline();
          }}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            {fileOutlineOpen && <Check className="size-3.5 text-primary stroke-[2.5]" />}
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Show file outline</span>
        </MenubarItem>

        {/* Divider */}
        <MenubarSeparator />

        {/* ── Section 4: PDF preview ── */}
        <div className="text-12 font-medium text-muted-foreground px-2.5 py-1.5 select-none">
          PDF preview
        </div>

        {/* PDF zoom > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span>PDF zoom</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-36 text-xs">
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'viewer:zoom-in' })}
              className="cursor-pointer"
            >
              Zoom in
            </MenubarItem>
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'viewer:zoom-out' })}
              className="cursor-pointer"
            >
              Zoom out
            </MenubarItem>
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'viewer:fit-width' })}
              className="cursor-pointer"
            >
              Fit to width
            </MenubarItem>
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'viewer:fit-height' })}
              className="cursor-pointer"
            >
              Fit to height
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default ViewMenu;
