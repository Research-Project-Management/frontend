'use client';

import React, { useState } from 'react';
import { FileText, Plus, X, ExternalLink, Loader2 } from 'lucide-react';
import { useRelatedPapers, useLinkPapers, useUnlinkPapers } from '@/features/workspaces/library/hooks/library/use-library';
import { useLibraryPapers } from '@/features/workspaces/library/hooks/library/use-papers';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { Paper, RelatedPaperItem } from '@/features/workspaces/library/types/library.types';
import { cn } from '@/shared/lib/utils';

interface RelatedSectionProps {
  paper: Paper;
  workspaceId: string;
  onSelectPaper?: (paperId: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
}

export default function RelatedSection({
  paper,
  workspaceId,
  onSelectPaper,
  hideHeader = false,
  forceAdding = false,
}: RelatedSectionProps) {
  const targetWsId = workspaceId || paper.workspaceId || '';
  const { data: relatedData, isLoading } = useRelatedPapers(targetWsId, paper.id || '');
  const { data: allPapersData } = useLibraryPapers(targetWsId);

  const linkMutation = useLinkPapers(targetWsId, paper.id || '');
  const unlinkMutation = useUnlinkPapers(targetWsId, paper.id || '');

  const [addOpen, setAddOpen] = useState(false);

  React.useEffect(() => {
    if (forceAdding) {
      setAddOpen(true);
    }
  }, [forceAdding]);

  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const relatedList: RelatedPaperItem[] = relatedData?.relatedPapers || [];
  const availablePapers = (allPapersData?.papers || []).filter(
    (targetPaper: Paper) =>
      targetPaper.id !== paper.id &&
      !relatedList.some((rel) => rel.id === targetPaper.id) &&
      (searchQuery.trim() === '' ||
        (targetPaper.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (targetPaper.authors || []).some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  const handleLink = async () => {
    if (!selectedTargetId) return;
    await linkMutation.mutateAsync({ targetPaperId: selectedTargetId, relationType: 'related' });
    setSelectedTargetId('');
    setSearchQuery('');
    setAddOpen(false);
  };

  const handleUnlink = async (targetId: string) => {
    await unlinkMutation.mutateAsync(targetId);
  };

  return (
    <div className="space-y-3 text-xs min-w-0">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Related
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1 cursor-pointer font-medium"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5 text-foreground" />
            <span>Add</span>
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 text-center text-muted-foreground space-y-1.5 flex flex-col items-center justify-center">
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <p className="text-xs">Loading related items...</p>
        </div>
      )}

      {/* Empty state - suppressed */}
      {!isLoading && relatedList.length === 0 ? null : null}

      {/* Relations list (Zotero-style clean list) */}
      {!isLoading && relatedList.length > 0 && (
        <div className="space-y-1 divide-y divide-border/20 border border-border/40 rounded-md overflow-hidden bg-card">
          {relatedList.map((item) => (
            <div
              key={item.id}
              className="p-2.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2.5 group cursor-pointer"
              onClick={() => onSelectPaper?.(item.id)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="size-3.5 text-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-normal text-foreground truncate text-xs group-hover:underline">
                    {item.title || 'Untitled Paper'}
                  </p>
                  {(item.authors?.length || item.year) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[item.authors?.join(', '), item.year].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {item.doi && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://doi.org/${item.doi}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="p-1 rounded text-foreground hover:bg-muted transition-colors cursor-pointer"
                          aria-label="Open DOI"
                        >
                          <ExternalLink className="size-3.5 text-foreground" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs py-1 px-2">
                        Open DOI
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleUnlink(item.id)}
                        className="p-1 rounded text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        aria-label="Remove relation"
                      >
                        <X className="size-3.5 text-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2">
                      Remove
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Related Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground p-5 space-y-4 shadow-none border border-border rounded-xl">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Add Related Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an item from your library to link with this paper.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {/* Quick search input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library items..."
              className="w-full px-3 py-1.5 text-xs bg-muted/20 text-foreground rounded-lg border border-border/40 focus:border-border outline-none transition-colors"
            />

            {/* Paper options select / list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border/40 rounded-lg p-1 bg-muted/10">
              {availablePapers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No other items available to link
                </p>
              ) : (
                availablePapers.map((targetPaper: Paper) => {
                  const isSelected = selectedTargetId === targetPaper.id;
                  return (
                    <button
                      key={targetPaper.id}
                      type="button"
                      onClick={() => setSelectedTargetId(targetPaper.id)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer',
                        isSelected
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground hover:bg-muted/60',
                      )}
                    >
                      <span className="truncate flex-1">{targetPaper.title || 'Untitled'}</span>
                      {targetPaper.year && (
                        <span className="text-xs text-muted-foreground shrink-0 font-mono">
                          {targetPaper.year}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => {
                  setAddOpen(false);
                  setSearchQuery('');
                  setSelectedTargetId('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!selectedTargetId || linkMutation.isPending}
                onClick={handleLink}
                className="h-8 px-4 text-xs cursor-pointer font-medium"
              >
                {linkMutation.isPending ? 'Adding...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
