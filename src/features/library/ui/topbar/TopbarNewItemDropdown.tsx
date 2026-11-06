"use client";

import React, { useRef } from "react";
import {
  MoreHorizontal,
  FileText,
  FileUp,
  FolderUp,
  FolderPlus,
  FolderInput,
  Wand2,
  Book,
  BookOpen,
  Users,
  ScrollText,
  FileBarChart,
  GraduationCap,
  Globe,
  Database,
  PenLine,
  Scale,
  Bookmark,
  Presentation,
  Code2,
  Newspaper,
  Rss,
  File,
  Briefcase,
  Music,
  Video,
  Mic,
  UserCheck,
  Map,
  Palette,
  Download,
  Loader2,
  UploadCloud,
  Settings2,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ZoteroLineIcon } from "@/shared/components/icons";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  useLibraryUIStore,
  type LibraryModalType,
} from "@/features/library/core/store/library-ui.store";
import { useFeedsStore } from "@/features/library/core/store/reader.store";
import { useItemTypes } from "@/features/library/core/coordinator/item-action.coordinator";
import {
  useExportOpmlFeedsMutation,
  useImportOpmlFeedsMutation,
} from "@/features/library/core/coordinator/curation.coordinator";
import { mapRegistryItemTypes } from "@/features/library/domain/types/core.types";
import {
  executeExportScopeFormat,
  triggerBrowserTextDownload,
} from "@/features/library/core/coordinator/citation-export.coordinator";

const PRIMARY_TYPE_KEYS = new Set([
  "journalArticle",
  "book",
  "bookSection",
  "conferencePaper",
  "preprint",
  "report",
  "thesis",
  "webpage",
  "dataset",
]);

const ITEM_TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  journalArticle: FileText,
  book: Book,
  bookSection: BookOpen,
  conferencePaper: Users,
  preprint: ScrollText,
  report: FileBarChart,
  thesis: GraduationCap,
  webpage: Globe,
  dataset: Database,
  artwork: Palette,
  audioRecording: Music,
  bill: FileText,
  blogPost: Globe,
  case: Briefcase,
  computerProgram: Code2,
  dictionaryEntry: Book,
  document: File,
  encyclopediaArticle: BookOpen,
  film: Video,
  forumPost: Globe,
  hearing: Users,
  interview: UserCheck,
  magazineArticle: FileText,
  manuscript: ScrollText,
  map: Map,
  newspaperArticle: Newspaper,
  patent: Scale,
  podcast: Mic,
  presentation: Presentation,
  standard: Bookmark,
  statute: Scale,
  tvBroadcast: Video,
  videoRecording: Video,
};

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
      toast.info("No feeds to export");
      return;
    }

    const filename = `flux-feeds-${new Date().toISOString().slice(0, 10)}.opml`;
    try {
      const serverData = await exportOpmlMutation();
      if (serverData?.opmlXml) {
        triggerBrowserTextDownload(serverData.opmlXml, filename, "text/x-opml");
        toast.success(`Exported ${serverData.count ?? feeds.length} feeds to OPML file`);
      } else {
        toast.error("Failed to export feeds to OPML");
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to export feeds to OPML",
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
          toast.success(`Imported ${imported.importedCount} feeds from OPML`);
        } else {
          toast.error("No valid RSS/Atom feeds found in OPML file");
        }
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "Failed to import feeds from OPML",
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
          className="w-56 p-1.5 text-13 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 select-none space-y-0.5"
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

interface TopbarNewItemDropdownProps {
  scopeId?: string;
  activeCollectionId?: string;
  isSubcollection?: boolean;
  onAddLinkClick: () => void;
  onAddFileClick: () => void;
  onAddFolderClick: () => void;
  onCreateCollectionClick: () => void;
  onNewManualItem?: (itemType: string) => void;
  onImportFromUser?: () => void;
  openModal: (modal: LibraryModalType, payload?: Record<string, unknown>) => void;
}

export function TopbarNewItemDropdown({
  scopeId,
  activeCollectionId,
  isSubcollection = false,
  onAddLinkClick,
  onAddFileClick,
  onAddFolderClick,
  onCreateCollectionClick,
  onNewManualItem,
  onImportFromUser,
  openModal,
}: TopbarNewItemDropdownProps) {
  const { types: registryItemTypes, isLoading, isError } = useItemTypes(scopeId);

  const { primaryTypes, moreTypes } = React.useMemo(() => {
    const rawDefinitions = mapRegistryItemTypes(registryItemTypes);
    const definitions = rawDefinitions.filter(
      (t) =>
        t.isBibliographic !== false &&
        !t.isSpecial &&
        t.itemType !== "attachment" &&
        t.itemType !== "note" &&
        t.itemType !== "annotation",
    );

    const primary = definitions
      .filter((t) => PRIMARY_TYPE_KEYS.has(t.itemType))
      .map((t) => ({
        type: t.itemType,
        label: t.label,
        icon: ITEM_TYPE_ICON_MAP[t.itemType] || FileText,
      }));
    const more = definitions
      .filter((t) => !PRIMARY_TYPE_KEYS.has(t.itemType))
      .map((t) => ({
        type: t.itemType,
        label: t.label,
        icon: ITEM_TYPE_ICON_MAP[t.itemType] || File,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { primaryTypes: primary, moreTypes: more };
  }, [registryItemTypes]);

  const handleManualTypeSelect = (type: string) => {
    if (onNewManualItem) onNewManualItem(type);
    else openModal("ADD_BY_IDENTIFIER");
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-8 px-3 rounded-lg cursor-pointer font-medium text-13 shadow-none inline-flex items-center justify-center"
        >
          <span>New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-56 p-1.5 rounded-lg border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none space-y-0.5"
      >
        <DropdownMenuItem
          onClick={onAddLinkClick}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Wand2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-foreground">Add by Identifier</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onAddFileClick}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FileUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-foreground">Upload Files</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onAddFolderClick}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FolderUp className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-foreground">Upload Folder</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
            <PenLine className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span className="text-foreground">Manual Entry</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            collisionPadding={16}
            sideOffset={4}
            alignOffset={-4}
            className="w-52 p-1.5 rounded-lg border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
          >
            {isLoading ? (
              <div className="py-2.5 px-3 flex items-center justify-center gap-2 text-12 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span>Loading types...</span>
              </div>
            ) : primaryTypes.length === 0 ? (
              <div className="py-2.5 px-3 text-12 text-muted-foreground text-center">
                {isError ? "Unable to load types" : "No types available"}
              </div>
            ) : (
              primaryTypes.map(({ type, label, icon: TypeIcon }) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => handleManualTypeSelect(type)}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                >
                  <TypeIcon className="size-3.5 text-foreground shrink-0" />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))
            )}

            {!isLoading && moreTypes.length > 0 && (
              <>
                <DropdownMenuSeparator className="my-1" />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted">
                    <MoreHorizontal className="size-3.5 text-foreground shrink-0" />
                    <span>More Types...</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    collisionPadding={16}
                    sideOffset={4}
                    alignOffset={-4}
                    className="w-56 max-h-[min(380px,var(--radix-dropdown-menu-content-available-height,calc(100vh-64px)))] overflow-y-auto overflow-x-hidden p-1.5 rounded-lg border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
                  >
                    {moreTypes.map(({ type, label, icon: MoreIcon }) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => handleManualTypeSelect(type)}
                        className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
                      >
                        <MoreIcon className="size-3.5 text-foreground shrink-0" />
                        <span>{label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={onCreateCollectionClick}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-foreground">
            {isSubcollection ? "New Subcollection" : "New Collection"}
          </span>
        </DropdownMenuItem>

        {onImportFromUser && (
          <DropdownMenuItem
            onClick={onImportFromUser}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <FolderInput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span className="text-foreground">Import from User Library</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() =>
            openModal("EXPORT_LIBRARY", {
              provider: "zotero",
              collectionId: activeCollectionId,
            })
          }
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <ZoteroLineIcon className="size-4 text-foreground shrink-0" />
          <span className="text-foreground">Zotero Sync...</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() =>
            openModal("ADD_FEED", {
              collectionId: activeCollectionId,
            })
          }
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Rss className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="text-foreground">New RSS Feed...</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
            <Download className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span className="text-foreground">Export Library</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            collisionPadding={16}
            sideOffset={4}
            alignOffset={-4}
            className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
          >
            {(
              [
                { format: "bibtex" as const, label: "BibTeX (.bib)" },
                { format: "ris" as const, label: "RIS (.ris)" },
                { format: "csl_json" as const, label: "CSL-JSON (.json)" },
                { format: "csv" as const, label: "CSV (.csv)" },
                { format: "markdown" as const, label: "Markdown (.md)" },
              ]
            ).map(({ format, label }) => (
              <DropdownMenuItem
                key={format}
                onClick={() =>
                  void executeExportScopeFormat(
                    scopeId || "user",
                    format,
                    activeCollectionId,
                  )
                }
                className="h-8 gap-2.5 px-2.5 text-12 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted"
              >
                <FileText className="size-3.5 text-foreground shrink-0" />
                <span>{label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
