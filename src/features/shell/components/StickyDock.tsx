'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { useSticky } from '@/features/projects/stickies/hooks/use-sticky';
import { STICKY_COLOR_MAP, type Sticky, type StickyColor } from '@/features/projects/stickies/types/sticky.types';
import Content from '@/features/projects/stickies/components/card/Content';
import Toolbar from '@/features/projects/stickies/components/card/Toolbar';
import { StickiesIcon } from '@/shared/components/icons/StickiesIcon';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { stripHtml } from '@/features/projects/stickies/utils/sticky.utils';
import type { Editor } from '@tiptap/react';

// ── 1. Single Sticky Rail Icon (Folded bottom-right corner) ───────────────────
export function StickyRailIcon({ className, size = 18, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M16 21H6a2.5 2.5 0 0 1-2.5-2.5V5.5A2.5 2.5 0 0 1 6 3h12a2.5 2.5 0 0 1 2.5 2.5v10.5L15.5 21H16Z" />
      <path d="M15 21v-4.5a1 1 0 0 1 1-1h4.5" />
    </svg>
  );
}

// ── 2. Empty State Illustration (Isometric 3 Stacked Sticky Cards) ───────────
function EmptyStickiesIllustration({ className = 'size-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Back card */}
      <path
        d="M30 20 L56 13 L56 65 L30 72 Z"
        fill="currentColor"
        fillOpacity="0.04"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-muted-foreground/30"
      />
      {/* Middle card */}
      <path
        d="M40 24 L66 17 L66 69 L40 76 Z"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-muted-foreground/45"
      />
      {/* Front card with dog-ear fold */}
      <g className="text-muted-foreground/75">
        <path
          d="M50 28 L76 21 L76 61 L66 64 L66 73 L50 77 Z"
          fill="var(--background)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M76 61 L66 64 L76 70 Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

// ── Main StickyDock Component ────────────────────────────────────────────────
export default function StickyDock() {
  const [isPillOpen, setIsPillOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStickyId, setActiveStickyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Active floating note editor state
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const dockRef = useRef<HTMLDivElement>(null);

  // Close pill when clicking outside
  useEffect(() => {
    if (!isPillOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setIsPillOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isPillOpen]);

  const { query, mutations } = useSticky();
  const stickies = useMemo(() => (query.data || []) as Sticky[], [query.data]);

  const activeSticky = useMemo(
    () => stickies.find((s) => s.id === activeStickyId) || null,
    [stickies, activeStickyId]
  );

  const filteredStickies = useMemo(() => {
    if (!searchQuery.trim()) return stickies;
    const lower = searchQuery.toLowerCase();
    return stickies.filter(
      (s) =>
        s.title?.toLowerCase().includes(lower) ||
        stripHtml(s.content || '').toLowerCase().includes(lower)
    );
  }, [stickies, searchQuery]);

  // Quick create new sticky note
  const handleCreateSticky = async () => {
    try {
      const created = await mutations.create.mutateAsync({
        color: 'pink-1',
        content: '<p></p>',
      });
      if (created?.id) {
        setActiveStickyId(created.id);
      }
    } catch (e) {
      console.error('Failed to create sticky', e);
    }
  };

  const currentColor = (activeSticky?.color as StickyColor) || 'pink-1';
  const colorConfig = STICKY_COLOR_MAP[currentColor] || STICKY_COLOR_MAP['pink-1'];

  return (
    <>
      <div ref={dockRef} className="relative flex items-center justify-center size-8">
        {/* ── A. Rail Icon Button at Bottom of Sidebar (Single sticky note) ──── */}
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsPillOpen(true)}
                aria-label="Stickies"
                className={cn(
                  'relative flex size-8 shrink-0 items-center justify-center rounded-md text-foreground transition-colors duration-200 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary',
                  isPillOpen
                    ? 'opacity-0 pointer-events-none'
                    : activeStickyId
                    ? 'bg-sidebar-accent'
                    : 'hover:bg-sidebar-hover'
                )}
              >
                <StickyRailIcon className="size-5 shrink-0" />
              </button>
            </TooltipTrigger>
            {!isPillOpen && (
              <TooltipContent side="right" sideOffset={10}>
                Stickies
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* ── B. Action Pill Aligned IN Sidebar (Matching Reference Image) ──── */}
        <AnimatePresence>
          {isPillOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-11 md:bottom-0 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 py-1.5 px-[2px] w-[38px] rounded-full border border-border bg-background shadow-md select-none"
            >
              <TooltipProvider delayDuration={150}>
                {/* 1. Stickies List (Top) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(true);
                        setIsPillOpen(false);
                      }}
                      className={cn(
                        'size-8 flex items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted cursor-pointer outline-none',
                        isModalOpen && 'bg-muted text-primary'
                      )}
                      aria-label="Your stickies"
                    >
                      <StickiesIcon className="size-4.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    Your stickies
                  </TooltipContent>
                </Tooltip>

                {/* 2. Add Sticky (+) (Middle) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleCreateSticky();
                        setIsPillOpen(false);
                      }}
                      disabled={mutations.create.isPending}
                      className="size-8 flex items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted cursor-pointer outline-none disabled:opacity-50"
                      aria-label="Add sticky"
                    >
                      {mutations.create.isPending ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <Plus className="size-4.5 text-foreground" strokeWidth={2} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    Add sticky
                  </TooltipContent>
                </Tooltip>

                {/* 3. Close Pill (X) (Bottom) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsPillOpen(false)}
                      className="size-8 rounded-full bg-muted flex items-center justify-center text-foreground transition-colors hover:bg-muted/80 cursor-pointer outline-none"
                      aria-label="Close"
                    >
                      <X className="size-4" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    Close
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── C. 'Your stickies' Modal (Matching Plane.so Screenshot) ───────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[760px] md:max-w-[800px] w-full p-6 rounded-2xl border border-border/80 bg-background shadow-2xl font-sans gap-0 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 select-none">
            <div className="flex items-center gap-2.5">
              <StickiesIcon className="size-4.5 text-foreground shrink-0" />
              <DialogTitle className="text-15 font-medium text-foreground tracking-tight">
                Your stickies
              </DialogTitle>
              <DialogDescription className="sr-only">
                Manage and search your personal stickies
              </DialogDescription>
            </div>

            <div className="flex items-center gap-4">
              {/* Search Toggle */}
              {isSearchOpen ? (
                <div className="relative flex items-center animate-in fade-in duration-150">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stickies..."
                    className="h-7 w-48 rounded-md border border-border bg-background pl-8 pr-6 text-12 text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="ml-1 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                    title="Close search"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Search stickies"
                >
                  <Search className="size-4" />
                </button>
              )}

              {/* + Add sticky button */}
              <button
                type="button"
                onClick={handleCreateSticky}
                disabled={mutations.create.isPending}
                className="text-13 font-medium text-primary hover:opacity-85 flex items-center gap-1.5 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {mutations.create.isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Plus className="size-4 text-primary" strokeWidth={2} />
                )}
                <span>Add sticky</span>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex flex-col justify-center">
            {query.isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-12">Loading stickies...</span>
              </div>
            ) : filteredStickies.length === 0 ? (
              /* Empty State matching Plane.so screenshot */
              <div className="w-full rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/40 py-16 px-6 flex flex-col items-center justify-center text-center select-none min-h-[340px]">
                <EmptyStickiesIllustration className="size-28 mb-4" />
                <p className="text-13 text-muted-foreground leading-relaxed max-w-sm">
                  {searchQuery
                    ? 'No stickies match your search query.'
                    : 'Jot down an idea, capture an aha, or record a brainwave. Add a sticky to get started.'}
                </p>
              </div>
            ) : (
              /* Grid of existing stickies */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
                {filteredStickies.map((note) => {
                  const color = STICKY_COLOR_MAP[note.color as StickyColor] || STICKY_COLOR_MAP['pink-1'];
                  const snippet = stripHtml(note.content || '') || 'Empty sticky note';
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setActiveStickyId(note.id);
                        setIsModalOpen(false);
                      }}
                      style={{ backgroundColor: color.bg, color: color.text }}
                      className="group relative h-40 rounded-xl p-4 border border-border/30 cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                    >
                      <p className="text-13 line-clamp-5 leading-relaxed font-normal">
                        {snippet}
                      </p>
                      <div className="flex items-center justify-between text-11 opacity-60 font-mono pt-2">
                        <span>{note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}</span>
                        <span className="opacity-0 group-hover:opacity-100 font-sans text-primary underline text-12 transition-opacity">
                          Open
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── D. Floating Sticky Note (Image 4) ─────────────────────────────── */}
      {activeSticky && (
        <div
          className="fixed left-4 bottom-14 md:left-[54px] md:bottom-12 z-50 w-72 rounded-lg shadow-raised-200 border border-border/40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            backgroundColor: colorConfig.bg,
            color: colorConfig.text,
          }}
        >
          {/* Header with Close X */}
          <div className="flex items-center justify-between px-3 pt-2 pb-0.5 select-none">
            <span className="text-10 opacity-40 font-mono">
              {activeSticky.updatedAt ? new Date(activeSticky.updatedAt).toLocaleDateString() : ''}
            </span>
            <button
              type="button"
              onClick={() => setActiveStickyId(null)}
              className="size-5 rounded flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
              title="Close sticky"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Content (Tiptap Editor) */}
          <Content
            sticky={activeSticky}
            onUpdate={(id, updates) => mutations.update.mutate({ stickyId: id, updates })}
            onReady={setEditor}
          />

          {/* Toolbar */}
          <div className="border-t border-black/5 dark:border-white/5">
            <Toolbar
              sticky={activeSticky}
              onUpdate={(id, updates) => mutations.update.mutate({ stickyId: id, updates })}
              onDelete={(id) => {
                mutations.remove.mutate(id);
                setActiveStickyId(null);
              }}
              editor={editor}
              activeModal={activeModal}
              onActiveModalChange={setActiveModal}
            />
          </div>
        </div>
      )}
    </>
  );
}
