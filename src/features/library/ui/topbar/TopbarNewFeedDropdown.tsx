"use client";

import React, { useRef } from "react";
import {
  MoreHorizontal,
  Rss,
  Download,
  UploadCloud,
  Settings2,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import { useLibraryUIStore } from "@/features/library/core/store/ui.store";
import { useFeedsStore } from "@/features/library/core/store/feeds.store";
import {
  useExportOpmlFeedsMutation,
  useImportOpmlFeedsMutation,
} from "@/features/library/core/coordinator/curation.coordinator";
import { triggerBrowserTextDownload } from "@/features/library/core/coordinator/citation.coordinator";

interface TopbarNewFeedDropdownProps {
  onRefreshFeed?: () => void;
  onMarkAllFeedRead?: () => void;
}

export function TopbarNewFeedDropdown({
  onRefreshFeed,
  onMarkAllFeedRead,
}: TopbarNewFeedDropdownProps) {
  const openModal = useLibraryUIStore((s) => s.openModal);
  const feeds = useFeedsStore((s) => s.feeds);
  const { mutateAsync: exportOpmlMutation } = useExportOpmlFeedsMutation();
  const { mutateAsync: importOpmlMutation } = useImportOpmlFeedsMutation();
  const opmlInputRef = useRef<HTMLInputElement>(null);

  const handleExportOPML = async () => {
    if (!feeds || feeds.length === 0) {
      toast.info("No feeds to export", { id: "opml-export" });
      return;
    }

    const filename = `flux-feeds-${new Date().toISOString().slice(0, 10)}.opml`;
    try {
      const serverData = await exportOpmlMutation();
      if (serverData?.opmlXml) {
        triggerBrowserTextDownload(serverData.opmlXml, filename, "text/x-opml");
        toast.success(`Exported ${serverData.count ?? feeds.length} feeds to OPML file`, { id: "opml-export" });
      } else {
        toast.error("Failed to export feeds to OPML", { id: "opml-export" });
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to export feeds to OPML",
        { id: "opml-export" },
      );
    }
  };

  const handleImportOPML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content !== "string") return;

      try {
        const imported = await importOpmlMutation(content);
        if (imported && imported.importedCount > 0) {
          toast.success(`Imported ${imported.importedCount} feeds from OPML`, { id: "opml-import" });
        } else {
          toast.error("No valid RSS/Atom feeds found in OPML file", { id: "opml-import" });
        }
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Failed to import feeds from OPML",
          { id: "opml-import" },
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 px-3 rounded-lg font-medium text-13 inline-flex items-center cursor-pointer shadow-none select-none transition-colors"
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
            onClick={() => openModal("ADD_FEED")}
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
            onClick={() => openModal("FEEDS_MANAGER")}
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
