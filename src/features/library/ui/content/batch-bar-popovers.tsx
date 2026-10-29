'use client';

import React from 'react';
import {
  FolderInput,
  FolderMinus,
  Copy,
  Trash2,
  Folder,
  Library,
  Quote,
  Download,
  RotateCcw,
  GitMerge,
  ShieldAlert,
  Star,
  Award,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';
import { executeDownloadFormatFile } from '@/features/library/core/coordinator/citation-export.coordinator';
import type {
  Collection,
  CslStyle,
  Item,
} from '@/features/library/domain/types/library.types';

export interface BatchMoveCollectionPopoverProps {
  isUnfiledView: boolean;
  isAllProcessingSelected: boolean;
  canMoveToRootUnfiled: boolean;
  isProjectScope: boolean;
  rootLibraryName: string;
  targetableCollections: Collection[];
  onBatchMove: (collectionId: string | null) => void;
}

export function BatchMoveCollectionPopover({
  isUnfiledView,
  isAllProcessingSelected,
  canMoveToRootUnfiled,
  isProjectScope,
  rootLibraryName,
  targetableCollections,
  onBatchMove,
}: BatchMoveCollectionPopoverProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none relative before:absolute before:-inset-1 md:before:hidden"
            >
              <FolderInput className="size-3.5 text-foreground shrink-0" />
              <span>{isUnfiledView ? 'Assign to' : 'Move to'}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {isUnfiledView ? 'Assign to collection' : 'Move to collection'}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="center"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 max-h-64 overflow-y-auto"
      >
        {canMoveToRootUnfiled && (
          <DropdownMenuItem
            onClick={() => onBatchMove(null)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            {isProjectScope ? (
              <Folder
                className="size-4 text-foreground shrink-0"
                strokeWidth={1.5}
              />
            ) : (
              <Library
                className="size-4 text-foreground shrink-0"
                strokeWidth={1.5}
              />
            )}
            <span>{rootLibraryName} (Unfile)</span>
          </DropdownMenuItem>
        )}
        {targetableCollections.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onBatchMove(c.id)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Folder
              className="size-4 text-foreground shrink-0"
              strokeWidth={1.5}
            />
            <span className="truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface BatchCitationExportPopoversProps {
  citationStyles: Array<{ id: string; label: string }>;
  resolvedItems: Item[];
  effectiveScopeId: string;
  retractedCount: number;
  onCopyMultiCite: (style: CslStyle | 'latex') => void;
  onCopyInTextCite: (style: CslStyle) => void;
  onExportAllBibtex: () => void;
  onDownloadBibFile: () => void;
}

export function BatchCitationExportPopovers({
  citationStyles,
  resolvedItems,
  effectiveScopeId,
  retractedCount,
  onCopyMultiCite,
  onCopyInTextCite,
  onExportAllBibtex,
  onDownloadBibFile,
}: BatchCitationExportPopoversProps) {
  return (
    <>
      {/* Copy Multi Citation Dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                aria-label="Copy citation"
              >
                <Quote className="size-3.5 shrink-0 text-foreground" />
                <span>Copy citation</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Copy citation
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="center"
          side="top"
          sideOffset={8}
          className="w-auto min-w-[240px] max-w-[320px] p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
        >
          {citationStyles.map((style) => (
            <DropdownMenuItem
              key={style.id}
              onClick={() => onCopyMultiCite(style.id as CslStyle)}
              className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap"
            >
              <span>{style.label}</span>
            </DropdownMenuItem>
          ))}

          <div className="mx-1 h-px my-1 bg-border" />

          <DropdownMenuItem
            onClick={() => onCopyMultiCite('latex')}
            className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap font-mono text-11"
          >
            <span>LaTeX \cite</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onCopyInTextCite('apa')}
            className="h-8 gap-2 px-2.5 text-13 cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors whitespace-nowrap"
          >
            <span>In-Text Citation</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Copy All BibTeX */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportAllBibtex}
            className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
          >
            <Copy className="size-3.5 shrink-0 text-foreground" />
            <span>Copy BibTeX</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          Copy BibTeX
        </TooltipContent>
      </Tooltip>

      {/* Export Dropdown (.bib, .ris, .json, .csv, .md) */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
              >
                <Download className="size-3.5 shrink-0 text-foreground" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Export selected references
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="center"
          side="top"
          sideOffset={8}
          className="w-48 p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200"
        >
          <DropdownMenuItem
            onClick={onDownloadBibFile}
            className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            <span>BibTeX (.bib)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void executeDownloadFormatFile(
                resolvedItems,
                effectiveScopeId,
                'ris',
                retractedCount,
              )
            }
            className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            <span>RIS (.ris)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void executeDownloadFormatFile(
                resolvedItems,
                effectiveScopeId,
                'csl_json',
                retractedCount,
              )
            }
            className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            <span>CSL-JSON (.json)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void executeDownloadFormatFile(
                resolvedItems,
                effectiveScopeId,
                'csv',
                retractedCount,
              )
            }
            className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            <span>CSV Table (.csv)</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void executeDownloadFormatFile(
                resolvedItems,
                effectiveScopeId,
                'markdown',
                retractedCount,
              )
            }
            className="h-8 gap-2 px-2.5 text-12 cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            <span>Markdown (.md)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export interface BatchSmartViewActionsProps {
  effectiveIsTrash: boolean;
  isDuplicatesView: boolean;
  isStarredView: boolean;
  isMyPublicationsView: boolean;
  isRetractedView: boolean;
  canEdit: boolean;
  selectedCount: number;
  isAllProcessingSelected: boolean;
  isCheckingRetraction?: boolean;
  isUnflaggingRetraction?: boolean;
  onBatchMerge?: () => void;
  onBatchUnstar?: () => Promise<void> | void;
  onBatchRemoveFromMyPublications?: () => Promise<void> | void;
  onBatchRecheckRetraction?: () => Promise<void> | void;
  onBatchClearRetractionFlags?: () => Promise<void> | void;
}

export function BatchSmartViewActions({
  effectiveIsTrash,
  isDuplicatesView,
  isStarredView,
  isMyPublicationsView,
  isRetractedView,
  canEdit,
  selectedCount,
  isAllProcessingSelected,
  isCheckingRetraction,
  isUnflaggingRetraction,
  onBatchMerge,
  onBatchUnstar,
  onBatchRemoveFromMyPublications,
  onBatchRecheckRetraction,
  onBatchClearRetractionFlags,
}: BatchSmartViewActionsProps) {
  if (effectiveIsTrash || !canEdit) return null;

  return (
    <>
      {/* Merge Duplicates Button — Strictly ONLY on Duplicate Items page */}
      {isDuplicatesView && onBatchMerge && selectedCount >= 2 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              onClick={onBatchMerge}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <GitMerge className="size-3.5 shrink-0 text-foreground" />
              <span>Merge {selectedCount} items</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Merge duplicate items
          </TooltipContent>
        </Tooltip>
      )}

      {/* Starred Items Page Action: Remove from Starred */}
      {isStarredView && onBatchUnstar && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              onClick={() => void onBatchUnstar()}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Star className="size-3.5 shrink-0 text-foreground" />
              <span>Unstar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Remove selected items from Starred
          </TooltipContent>
        </Tooltip>
      )}

      {/* My Publications Page Action: Remove from My Publications */}
      {isMyPublicationsView && onBatchRemoveFromMyPublications && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              onClick={() => void onBatchRemoveFromMyPublications()}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Award className="size-3.5 shrink-0 text-foreground" />
              <span>Remove from Publications</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Remove selected items from My Publications
          </TooltipContent>
        </Tooltip>
      )}

      {/* Retracted Items Page Actions: Re-verify & Clear Flag */}
      {isRetractedView && (
        <>
          {onBatchRecheckRetraction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isAllProcessingSelected || isCheckingRetraction}
                  onClick={() => void onBatchRecheckRetraction()}
                  className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                >
                  <RefreshCw className="size-3.5 shrink-0 text-foreground" />
                  <span>Re-check retraction</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Re-verify retraction status for selected items
              </TooltipContent>
            </Tooltip>
          )}
          {onBatchClearRetractionFlags && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isAllProcessingSelected || isUnflaggingRetraction}
                  onClick={() => void onBatchClearRetractionFlags()}
                  className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
                >
                  <ShieldAlert className="size-3.5 shrink-0 text-foreground" />
                  <span>Clear flag</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Clear retraction flag on selected items
              </TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </>
  );
}

export interface BatchLifecycleActionsProps {
  effectiveIsTrash: boolean;
  canEdit: boolean;
  isAllProcessingSelected: boolean;
  onBatchRestore?: () => void;
  onBatchDelete?: () => void;
  onBatchDetach?: () => void;
}

export function BatchLifecycleActions({
  effectiveIsTrash,
  canEdit,
  isAllProcessingSelected,
  onBatchRestore,
  onBatchDelete,
  onBatchDetach,
}: BatchLifecycleActionsProps) {
  if (!canEdit) return null;

  if (effectiveIsTrash) {
    return (
      <>
        {onBatchRestore && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isAllProcessingSelected}
                onClick={onBatchRestore}
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
              >
                <RotateCcw className="size-3.5 shrink-0 text-foreground" />
                <span>Restore</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Restore selected items
            </TooltipContent>
          </Tooltip>
        )}
        {onBatchDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isAllProcessingSelected}
                onClick={onBatchDelete}
                className="h-8 px-2.5 gap-1.5 text-12 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
              >
                <Trash2 className="size-3.5 shrink-0 text-destructive" />
                <span>Delete permanently</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Delete permanently
            </TooltipContent>
          </Tooltip>
        )}
      </>
    );
  }

  return (
    <>
      {onBatchDetach && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              onClick={() => onBatchDetach()}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <FolderMinus className="size-3.5 shrink-0 text-foreground" />
              <span>Remove from collection</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Remove from collection
          </TooltipContent>
        </Tooltip>
      )}
      {onBatchDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isAllProcessingSelected}
              onClick={onBatchDelete}
              className="h-8 px-2.5 gap-1.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shadow-none inline-flex items-center relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Trash2 className="size-3.5 shrink-0 text-foreground" />
              <span>Move to trash</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Move to trash
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
