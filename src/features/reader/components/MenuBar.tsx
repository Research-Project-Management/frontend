'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useLibrarySidebarStore } from '@/features/library/store/sidebar.store';
import { useReaderStore } from '@/features/reader/store/reader.store';
import { ExportService } from '@/features/library/services/exports.service';
import { toast } from 'sonner';

export function FluxLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-3.5 shrink-0 select-none", className)}
      aria-label="Flux Logo"
    >
      <path d="M0 130H41.5556C49.2875 130 55.5556 136.268 55.5556 144V200H14C6.26802 200 0 193.732 0 186V130Z" fill="#FFCB2C"/>
      <path d="M144.444 0H192C196.418 0 200 3.58172 200 8V166C200 184.778 184.778 200 166 200H144.444V0Z" fill="#3370FF"/>
      <path d="M0 34C0 15.2223 15.2223 0 34 0H150V50H0V34Z" fill="#3370FF"/>
      <path d="M72.2222 65H119.778C124.196 65 127.778 68.5817 127.778 73V182C127.778 191.941 119.719 200 109.778 200H72.2222V65Z" fill="#F97802"/>
      <path d="M0 83C0 73.0589 8.05888 65 18 65H77V115H0V83Z" fill="#F97802"/>
    </svg>
  );
}

export function MenuBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isReader = pathname.includes('/library/papers/');

  // Stores
  const { isOpen, setIsOpen, isInspectorOpen, setIsInspectorOpen } = useLibrarySidebarStore();
  const { tabs, activeTabId, setActiveTab, closeTab } = useReaderStore();

  const handleGoLibrary = () => {
    router.push('/library');
  };

  const handleNextTab = () => {
    if (tabs.length <= 1) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    const nextTab = tabs[nextIndex];
    if (nextTab.id === 'library') {
      router.push('/library');
    } else {
      setActiveTab(nextTab.id);
      router.push(`/library/papers/${nextTab.id}`);
    }
  };

  const handlePrevTab = () => {
    if (tabs.length <= 1) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    const prevTab = tabs[prevIndex];
    if (prevTab.id === 'library') {
      router.push('/library');
    } else {
      setActiveTab(prevTab.id);
      router.push(`/library/papers/${prevTab.id}`);
    }
  };

  const handleCloseCurrentTab = () => {
    if (activeTabId && activeTabId !== 'library') {
      closeTab(activeTabId);
      const remaining = tabs.filter((t) => t.id !== activeTabId);
      const next = remaining[remaining.length - 1] || { id: 'library' };
      if (next.id === 'library') {
        router.push('/library');
      } else {
        router.push(`/library/papers/${next.id}`);
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleExportAnnotatedPdf = async () => {
    if (!activeTabId || activeTabId === 'library') return;
    const currentTab = tabs.find((t) => t.id === activeTabId);
    toast.loading('Exporting PDF with annotations...', { id: 'export-annotated-pdf' });
    try {
      await ExportService.downloadAnnotatedPdf('me', activeTabId, `${currentTab?.title || 'document'}-annotated.pdf`);
      toast.success('Annotated PDF exported successfully', { id: 'export-annotated-pdf' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export annotated PDF', { id: 'export-annotated-pdf' });
    }
  };

  return (
    <div className="h-7 shrink-0 border-b border-border bg-muted px-2 flex items-center justify-between select-none z-40 text-12">
      <div className="flex items-center gap-1">
        {/* Flux Brand Logo */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleGoLibrary}
                className="size-6 flex items-center justify-center rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer mr-0.5"
                aria-label="Flux Home"
              >
                <FluxLogo />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Flux Research Platform
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Desktop Application Menubar: File, Edit, View, Go (Tools & Help excluded) */}
        <Menubar className="h-6 border-none bg-transparent p-0 gap-0.5 shadow-none">
          {/* 1. FILE MENU */}
          <MenubarMenu>
            <MenubarTrigger className="h-5 px-2 py-0 text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground">
              File
            </MenubarTrigger>
            <MenubarContent align="start" className="min-w-[14rem] p-1 text-12 bg-popover border border-border shadow-none rounded-md">
              <MenubarItem onClick={() => router.push('/library')} className="text-11 cursor-pointer">
                New Collection...
                <MenubarShortcut>Ctrl+Shift+N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => router.push('/library')} className="text-11 cursor-pointer">
                New Item / Add Paper...
                <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => router.push('/library')} className="text-11 cursor-pointer">
                Import PDF Files...
                <MenubarShortcut>Ctrl+I</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => router.push('/library')} className="text-11 cursor-pointer">
                Import from Clipboard
                <MenubarShortcut>Ctrl+Alt+I</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={() => router.push('/library')} className="text-11 cursor-pointer">
                Export Library...
                <MenubarShortcut>Ctrl+E</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handleExportAnnotatedPdf}
                disabled={!isReader}
                className="text-11 cursor-pointer"
              >
                Export PDF with Annotations...
                <MenubarShortcut>Ctrl+Shift+E</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={handleCloseCurrentTab}
                disabled={!isReader}
                className="text-11 cursor-pointer"
              >
                Close Tab
                <MenubarShortcut>Ctrl+W</MenubarShortcut>
              </MenubarItem>
              <MenubarItem onClick={handlePrint} className="text-11 cursor-pointer">
                Print...
                <MenubarShortcut>Ctrl+P</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 2. EDIT MENU */}
          <MenubarMenu>
            <MenubarTrigger className="h-5 px-2 py-0 text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground">
              Edit
            </MenubarTrigger>
            <MenubarContent align="start" className="min-w-[14rem] p-1 text-12 bg-popover border border-border shadow-none rounded-md">
              <MenubarItem
                onClick={() => {
                  if (typeof document !== 'undefined') document.execCommand('undo');
                }}
                className="text-11 cursor-pointer"
              >
                Undo
                <MenubarShortcut>Ctrl+Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  if (typeof document !== 'undefined') document.execCommand('redo');
                }}
                className="text-11 cursor-pointer"
              >
                Redo
                <MenubarShortcut>Ctrl+Y</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  if (typeof document !== 'undefined') document.execCommand('cut');
                }}
                className="text-11 cursor-pointer"
              >
                Cut
                <MenubarShortcut>Ctrl+X</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  if (typeof document !== 'undefined') document.execCommand('copy');
                }}
                className="text-11 cursor-pointer"
              >
                Copy
                <MenubarShortcut>Ctrl+C</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  if (typeof document !== 'undefined') document.execCommand('selectAll');
                }}
                className="text-11 cursor-pointer"
              >
                Select All
                <MenubarShortcut>Ctrl+A</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  const searchInput = document.querySelector('input[placeholder*="search" i], input[type="search"]') as HTMLInputElement | null;
                  if (searchInput) searchInput.focus();
                }}
                className="text-11 cursor-pointer"
              >
                Find...
                <MenubarShortcut>Ctrl+F</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => router.push('/settings')} className="text-11 cursor-pointer">
                Preferences...
                <MenubarShortcut>Ctrl+,</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 3. VIEW MENU */}
          <MenubarMenu>
            <MenubarTrigger className="h-5 px-2 py-0 text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground">
              View
            </MenubarTrigger>
            <MenubarContent align="start" className="min-w-[14rem] p-1 text-12 bg-popover border border-border shadow-none rounded-md">
              <MenubarItem
                onClick={() => setIsOpen(!isOpen)}
                className="text-11 cursor-pointer"
              >
                Toggle Left Sidebar
                <MenubarShortcut>Ctrl+\</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => setIsInspectorOpen(!isInspectorOpen)}
                className="text-11 cursor-pointer"
              >
                Toggle Right Inspector
                <MenubarShortcut>Ctrl+/</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              {isReader && (
                <>
                  <MenubarItem
                    onClick={() => {
                      const zoomInBtn = document.querySelector('[data-reader-zoom-in]') as HTMLButtonElement | null;
                      if (zoomInBtn) zoomInBtn.click();
                    }}
                    className="text-11 cursor-pointer"
                  >
                    Zoom In
                    <MenubarShortcut>Ctrl++</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      const zoomOutBtn = document.querySelector('[data-reader-zoom-out]') as HTMLButtonElement | null;
                      if (zoomOutBtn) zoomOutBtn.click();
                    }}
                    className="text-11 cursor-pointer"
                  >
                    Zoom Out
                    <MenubarShortcut>Ctrl+-</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      const rotateBtn = document.querySelector('[data-reader-rotate]') as HTMLButtonElement | null;
                      if (rotateBtn) rotateBtn.click();
                    }}
                    className="text-11 cursor-pointer"
                  >
                    Rotate Clockwise 90°
                    <MenubarShortcut>Ctrl+R</MenubarShortcut>
                  </MenubarItem>
                  <MenubarSeparator />
                </>
              )}
              <MenubarItem onClick={handleToggleFullscreen} className="text-11 cursor-pointer">
                Toggle Fullscreen
                <MenubarShortcut>F11</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 4. GO MENU */}
          <MenubarMenu>
            <MenubarTrigger className="h-5 px-2 py-0 text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground">
              Go
            </MenubarTrigger>
            <MenubarContent align="start" className="min-w-[14rem] p-1 text-12 bg-popover border border-border shadow-none rounded-md">
              <MenubarItem onClick={handleGoLibrary} className="text-11 cursor-pointer font-medium">
                My Library
                <MenubarShortcut>Alt+Home</MenubarShortcut>
              </MenubarItem>
              {isReader && (
                <>
                  <MenubarSeparator />
                  <MenubarItem
                    onClick={() => {
                      const firstPageBtn = document.querySelector('[data-reader-first-page]') as HTMLButtonElement | null;
                      if (firstPageBtn) firstPageBtn.click();
                    }}
                    className="text-11 cursor-pointer"
                  >
                    First Page
                    <MenubarShortcut>Home</MenubarShortcut>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      const lastPageBtn = document.querySelector('[data-reader-last-page]') as HTMLButtonElement | null;
                      if (lastPageBtn) lastPageBtn.click();
                    }}
                    className="text-11 cursor-pointer"
                  >
                    Last Page
                    <MenubarShortcut>End</MenubarShortcut>
                  </MenubarItem>
                </>
              )}
              <MenubarSeparator />
              <MenubarItem
                onClick={handleNextTab}
                disabled={tabs.length <= 1}
                className="text-11 cursor-pointer"
              >
                Next Tab
                <MenubarShortcut>Ctrl+Tab</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={handlePrevTab}
                disabled={tabs.length <= 1}
                className="text-11 cursor-pointer"
              >
                Previous Tab
                <MenubarShortcut>Ctrl+Shift+Tab</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>
    </div>
  );
}

export default MenuBar;
