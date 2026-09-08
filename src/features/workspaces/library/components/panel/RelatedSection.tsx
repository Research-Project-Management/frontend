'use client';

import React, { useState } from 'react';
import { FileText, Plus, X, ExternalLink, Loader2 } from 'lucide-react';
import { useRelations } from '@/features/workspaces/library/hooks/use-relations';
import { useViewItems } from '@/features/workspaces/library/hooks/use-items';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import type { CatalogItem, RelatedItem } from '@/features/workspaces/library/types/library.types';
import { cn } from '@/shared/lib/utils';

interface RelatedSectionProps {
  paper: CatalogItem;
  workspaceId: string;
  onSelectPaper?: (paperId: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  isAddOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
}

export default function RelatedSection({
  paper,
  workspaceId,
  onSelectPaper,
  hideHeader = false,
  forceAdding = false,
  isAddOpen,
  onAddOpenChange,
}: RelatedSectionProps) {
  const activeWorkspaceId = workspaceId || paper.workspaceId || '';
  const { relatedItems, isLoading, link, unlink, isLinking } = useRelations(activeWorkspaceId, paper.id || '');
  const { data: allItemsRes } = useViewItems(activeWorkspaceId, 'all');

  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const isModalOpen = isAddOpen !== undefined ? isAddOpen : internalAddOpen;
  const setModalOpen = onAddOpenChange || setInternalAddOpen;

  React.useEffect(() => {
    if (forceAdding) {
      setModalOpen(true);
    }
  }, [forceAdding, setModalOpen]);

  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const relatedList: RelatedItem[] = relatedItems;
  const availableItems = (allItemsRes?.items || []).filter(
    (targetItem: CatalogItem) =>
      targetItem.id !== paper.id &&
      !relatedList.some((rel) => rel.id === targetItem.id) &&
      (searchQuery.trim() === '' ||
        (targetItem.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (targetItem.authors || []).some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  const handleLink = async () => {
    if (!selectedTargetId) return;
    await link({ targetItemId: selectedTargetId, relationType: 'related' });
    setSelectedTargetId('');
    setSearchQuery('');
    setModalOpen(false);
  };

  const handleUnlink = async (targetItemId: string) => {
    await unlink({ targetItemId });
  };

  if (!isLoading && relatedList.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 text-xs min-w-0">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Related
          </h3>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 text-center text-muted-foreground space-y-1.5 flex flex-col items-center justify-center">
          <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
          <p className="text-xs">Loading related items...</p>
        </div>
      )}

      {/* Relations list */}
      {!isLoading && relatedList.length > 0 && (
        <div className="divide-y divide-border/30 border border-border rounded-md overflow-hidden bg-transparent">
          {relatedList.map((item) => (
            <div
              key={item.id}
              className="px-2 py-1.5 hover:bg-muted flex items-center justify-between gap-2.5 group cursor-pointer"
              onClick={() => onSelectPaper?.(item.id)}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <FileText className="size-3.5 text-foreground shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-normal text-foreground truncate text-xs group-hover:underline">
                    {item.title || 'Untitled Item'}
                  </p>
                  {(item.authors?.length || item.year) && (
                    <p className="text-xs text-foreground truncate">
                      {[item.authors?.join(', '), item.year].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {item.doi && (
                  <a
                    href={`https://doi.org/${item.doi}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="p-1 rounded-md text-foreground hover:bg-muted cursor-pointer"
                    aria-label="Open DOI"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleUnlink(item.id)}
                  className="p-1 rounded-md text-foreground hover:bg-muted invisible group-hover:visible cursor-pointer"
                  aria-label="Remove relation"
                >
                  <X className="size-3.5 text-foreground shrink-0" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Related Item Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-background text-foreground p-5 space-y-4 shadow-none border border-border rounded-md">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Add Related Item
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground">
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
              className="w-full px-3 py-1.5 text-xs bg-muted text-foreground rounded-md border border-border focus:border-primary outline-none focus:outline-none focus-visible:outline-none"
            />

            {/* Paper options select / list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-1 bg-muted">
              {availableItems.length === 0 ? (
                <p className="text-xs text-foreground text-center py-4">
                  No other items available to link
                </p>
              ) : (
                availableItems.map((targetItem: CatalogItem) => {
                  const isSelected = selectedTargetId === targetItem.id;
                  return (
                    <button
                      key={targetItem.id}
                      type="button"
                      onClick={() => setSelectedTargetId(targetItem.id)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 cursor-pointer',
                        isSelected
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <span className="truncate flex-1">{targetItem.title || 'Untitled'}</span>
                      {targetItem.year && (
                        <span className="text-xs text-foreground shrink-0 font-mono">
                          {targetItem.year}
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
                className="h-8 px-3 text-xs text-muted-foreground hover:bg-muted cursor-pointer rounded-md"
                onClick={() => {
                  setModalOpen(false);
                  setSearchQuery('');
                  setSelectedTargetId('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!selectedTargetId || isLinking}
                onClick={handleLink}
                className="h-8 px-4 text-xs cursor-pointer font-medium rounded-md"
              >
                {isLinking ? 'Adding...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}




