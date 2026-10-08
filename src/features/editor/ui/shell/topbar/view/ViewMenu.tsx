'use client';

/**
 * ViewMenu.tsx
 *
 * Topbar View Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/view/ViewMenu.tsx`
 */

import React from 'react';
import { useParams } from 'next/navigation';
import {
  Columns2,
  ExternalLink,
  Scan,
  Check,
} from 'lucide-react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarSeparator,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { useSettingsStore, useCompileStore } from '@/features/editor/store';
import { useShallow } from 'zustand/react/shallow';

function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M362.7 19.32c-25-25-65.5-25-90.51 0l-48.43 48.43 138.94 138.95 48.43-48.43c25-25 25-65.5 0-90.51l-48.43-48.44zm-76.86 118.97L41.34 382.79c-4.44 4.44-7.44 10.15-8.68 16.32L.34 499.72c-2.38 10.76 7.29 20.43 18.05 18.05l100.61-32.32c6.17-1.24 11.88-4.24 16.32-8.68l244.5-244.5-138.94-138.94z" />
    </svg>
  );
}

function PdfDocIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6.5v9.5a1.5 1.5 0 0 0 1.5 1.5h8.5" />
      <path d="M6 3a1 1 0 0 1 1-1h6.5l3.5 3.5v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3z" />
      <polyline points="13.5 2 13.5 5.5 17 5.5" />
      <rect
        x="7.5"
        y="8.5"
        width="8"
        height="5"
        rx="0.75"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="11.5"
        y="12.2"
        fill="var(--background)"
        fontSize="3"
        fontWeight="900"
        letterSpacing="-0.2px"
        textAnchor="middle"
        stroke="none"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

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
  const {
    layout,
    setLayout,
    editorMode,
    setEditorMode,
    reviewMode,
    setReviewMode,
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
      showEditorTabs: s.showEditorTabs,
      toggleShowEditorTabs: s.toggleShowEditorTabs,
      showEquationPreview: s.showEquationPreview,
      toggleShowEquationPreview: s.toggleShowEquationPreview,
    }))
  );

  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const setIsViewerPoppedOut = useCompileStore((s) => s.setIsViewerPoppedOut);
  const params = useParams<{ projectId?: string; pageId?: string }>();

  const handleOpenPdfSeparateTab = () => {
    const pageId = params?.pageId;
    if (pageId) {
      const url = params.projectId
        ? `/projects/${params.projectId}/pages/${pageId}/popout`
        : `/editor/${pageId}/popout`;
      window.open(url, '_blank');
      setIsViewerPoppedOut(true);
    } else if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleToggleFocusMode = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handlePresentationMode = () => {
    setLayout('viewer-only');
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
          onClick={handleOpenPdfSeparateTab}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <div className="size-4 flex items-center justify-center shrink-0">
            <ExternalLink className="size-4 opacity-70" strokeWidth={1.8} />
          </div>
          <span className="flex-1 text-xs whitespace-nowrap">Open PDF in separate tab</span>
        </MenubarItem>

        {/* 5. Focus mode */}
        <MenubarItem
          onClick={handleToggleFocusMode}
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
              <span className="flex-1 text-xs">Source (LaTeX)</span>
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
              <span className="flex-1 text-xs">Visual (Rich Text)</span>
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
              onClick={() => setReviewMode(false)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                !reviewMode
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                <PenIcon className={cn('size-3.5', !reviewMode ? 'text-primary' : 'opacity-70')} />
              </div>
              <span className="flex-1 text-xs">Editing</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => setReviewMode(true)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm cursor-pointer transition-colors text-xs font-medium select-none',
                reviewMode
                  ? 'bg-muted text-foreground font-medium focus:bg-muted focus:text-foreground'
                  : 'text-foreground hover:bg-muted focus:bg-muted focus:text-foreground',
              )}
            >
              <div className="size-4 flex items-center justify-center shrink-0">
                <CommentPenIcon className={cn('size-3.5', reviewMode ? 'text-primary' : 'opacity-70')} />
              </div>
              <span className="flex-1 text-xs">Reviewing</span>
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

        {/* Divider */}
        <MenubarSeparator />

        {/* ── Section 4: PDF preview ── */}
        <div className="text-12 font-medium text-muted-foreground px-2.5 py-1.5 select-none">
          PDF preview
        </div>

        {/* Presentation mode */}
        <MenubarItem
          onClick={handlePresentationMode}
          className="flex items-center px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-medium select-none"
        >
          <span className="flex-1 text-xs">Presentation mode</span>
        </MenubarItem>

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
