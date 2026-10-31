"use client";

import React from "react";
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
} from "lucide-react";
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
import type { LibraryModalType } from "@/features/library/core/store/library-ui.store";
import { useItemTypes } from "@/features/library/sdk/queries/catalog.queries";
import { mapRegistryItemTypes } from "@/features/library/domain/types/library.types";
import { executeExportScopeFormat } from "@/features/library/core/coordinator/citation-export.coordinator";

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

export interface TopbarNewItemDropdownProps {
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
