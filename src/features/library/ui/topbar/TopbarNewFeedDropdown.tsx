'use client';

import React, { useRef } from 'react';
import {
  Plus,
  Rss,
  UploadCloud,
  Download,
  Settings2,
  ChevronDown,
  RefreshCw,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';

export interface TopbarNewFeedDropdownProps {
  onRefreshFeed?: () => void;
  onMarkAllFeedRead?: () => void;
}

export function TopbarNewFeedDropdown({
  onRefreshFeed,
  onMarkAllFeedRead,
}: TopbarNewFeedDropdownProps) {
  const openModal = useLibraryUIStore((s) => s.openModal);
  const feeds = useFeedsStore((s) => s.feeds);
  const addFeed = useFeedsStore((s) => s.addFeed);
  const opmlInputRef = useRef<HTMLInputElement>(null);

  // Export Feeds to OPML file
  const handleExportOPML = () => {
    if (!feeds || feeds.length === 0) {
      toast.info('No feeds to export');
      return;
    }

    const outlines = feeds
      .map(
        (f) =>
          `    <outline type="rss" text="${escapeXml(f.name)}" title="${escapeXml(f.name)}" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.url)}"/>`,
      )
      .join('\n');

    const opmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Flux Academic Feeds Export</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Subscriptions" title="Subscriptions">
${outlines}
    </outline>
  </body>
</opml>`;

    const blob = new Blob([opmlContent], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flux-feeds-${new Date().toISOString().slice(0, 10)}.opml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${feeds.length} feeds to OPML file`);
  };

  // Import OPML file handler
  const handleImportOPML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') return;

      try {
        const outlineRegex = /<outline\b([^>]*?)\/?>/gi;
        let match: RegExpExecArray | null;
        let importedCount = 0;

        while ((match = outlineRegex.exec(content)) !== null) {
          const attrs = match[1] || '';
          const xmlUrlMatch = attrs.match(/\bxmlUrl=["']([^"']+)["']/i);
          if (xmlUrlMatch?.[1]) {
            const feedUrl = xmlUrlMatch[1].trim();
            const titleMatch = attrs.match(/\b(?:title|text)=["']([^"']+)["']/i);
            const feedName = titleMatch?.[1]?.trim() || '';
            addFeed(feedName, feedUrl, 30);
            importedCount++;
          }
        }

        if (importedCount > 0) {
          toast.success(`Imported ${importedCount} feeds from OPML`);
        } else {
          toast.error('No valid RSS/Atom feeds found in OPML file');
        }
      } catch {
        toast.error('Failed to parse OPML file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={opmlInputRef}
        type="file"
        accept=".opml,.xml"
        className="hidden"
        onChange={handleImportOPML}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 px-3 rounded-md font-medium text-13 inline-flex items-center cursor-pointer shadow-none select-none transition-colors"
          >
            <span>New Feed</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-56 p-1.5 text-13 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none space-y-0.5"
        >
          {onRefreshFeed && (
            <DropdownMenuItem
              onClick={onRefreshFeed}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Refresh Feed</span>
            </DropdownMenuItem>
          )}

          {onMarkAllFeedRead && (
            <DropdownMenuItem
              onClick={onMarkAllFeedRead}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <CheckCheck className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Mark All as Read</span>
            </DropdownMenuItem>
          )}

          {(onRefreshFeed || onMarkAllFeedRead) && (
            <DropdownMenuSeparator className="my-1" />
          )}

          <DropdownMenuItem
            onClick={() => openModal('ADD_FEED')}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Rss className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Add Feed From URL...</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => opmlInputRef.current?.click()}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <UploadCloud className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Import From OPML...</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleExportOPML}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Download className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Export Feeds to OPML</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem
            onClick={() => openModal('FEEDS_MANAGER')}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Settings2 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Manage Subscriptions...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default TopbarNewFeedDropdown;
