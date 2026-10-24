'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import { libraryBibtexModalSchema, type LibraryBibtexModalFormValues } from '@/features/editor/domain/types/forms.types';
import { formatItemToBibtex } from '@/features/editor/subsystems/citation';
import { useViewItems } from '@/features/library/sdk/queries/catalog.queries';
import type { Item } from '@/features/library/domain/types/library.types';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';

export interface LibraryTabPaneProps {
  parentPageId: string | null;
  createFile: {
    mutate: (
      variables: { parentPageId: string; title: string; content?: string },
      options?: {
        onSuccess?: (created: { id: string }) => void;
        onSettled?: () => void;
      },
    ) => void;
  };
  setSearchParams: (params: Record<string, string>) => void;
  onClose: () => void;
}

export function LibraryTabPane({
  parentPageId,
  createFile,
  setSearchParams,
  onClose,
}: LibraryTabPaneProps) {
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isExportingBib, setIsExportingBib] = useState(false);

  const {
    register: registerLibraryBibtex,
    handleSubmit: handleSubmitLibraryBibtex,
    formState: { errors: libraryBibtexErrors },
  } = useForm<LibraryBibtexModalFormValues>({
    resolver: zodResolver(libraryBibtexModalSchema),
    defaultValues: { fileName: 'references.bib' },
  });

  const { data: libraryData, isLoading: isLoadingLibrary } = useViewItems(
    'user',
    'all',
    librarySearch,
  );
  const libraryItems: Item[] = useMemo(() => libraryData?.items ?? [], [libraryData]);

  // Default select all when library items are loaded for the first time
  useEffect(() => {
    if (libraryItems.length > 0) {
      setSelectedItemIds((prev) => (prev.size === 0 ? new Set(libraryItems.map((i) => i.id)) : prev));
    }
  }, [libraryItems]);

  const handleToggleSelectAll = () => {
    if (selectedItemIds.size === libraryItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(libraryItems.map((i) => i.id)));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportFromLibrary = (data: LibraryBibtexModalFormValues) => {
    if (!parentPageId || selectedItemIds.size === 0) return;
    const targetName = data.fileName.trim() || 'references.bib';
    const chosenItems = libraryItems.filter((i) => selectedItemIds.has(i.id));

    setIsExportingBib(true);
    const bibEntries = chosenItems
      .map((item) => formatItemToBibtex(item))
      .join('\n\n');

    createFile.mutate(
      {
        parentPageId,
        title: targetName,
        content: bibEntries,
      },
      {
        onSuccess: (created: { id: string }) => {
          navigationCoordinator.openDocument({
            fileId: created.id,
            title: targetName,
            content: bibEntries,
          });
          setSearchParams({ file: created.id });
          onClose();
        },
        onSettled: () => {
          setIsExportingBib(false);
        },
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-3 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-12 font-medium text-foreground">
              BibTeX file name
            </label>
            <Input
              {...registerLibraryBibtex('fileName')}
              aria-label="BibTeX file name"
            placeholder="references.bib"
              className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
            />
            {libraryBibtexErrors.fileName && (
              <p className="text-11 text-destructive">{libraryBibtexErrors.fileName.message}</p>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-12 font-medium text-foreground">
              Search library
            </label>
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                aria-label="Search library"
            placeholder="Filter papers..."
                className="h-8 text-12 pl-8 bg-muted/40 rounded-md border-border/60 focus:bg-background"
              />
            </div>
          </div>
        </div>

        {/* Library items list with open hairlines */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-11 pb-1.5 px-1 border-b border-border/60 text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={
                  libraryItems.length > 0 &&
                  selectedItemIds.size === libraryItems.length
                }
                onCheckedChange={handleToggleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-11 font-medium cursor-pointer text-foreground"
              >
                Select all
              </label>
            </div>
            <span>
              {selectedItemIds.size} of {libraryItems.length} selected
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-border/60 px-1 thin-scrollbar">
            {isLoadingLibrary ? (
              <div className="flex items-center justify-center py-6 text-12 text-muted-foreground gap-2">
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
                <span>Loading library items...</span>
              </div>
            ) : libraryItems.length === 0 ? (
              <div className="text-center py-6 text-12 text-muted-foreground">
                No references found in your library.
              </div>
            ) : (
              libraryItems.map((item) => {
                const isSelected = selectedItemIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => handleToggleItem(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleItem(item.id);
                      }
                    }}
                    className={cn(
                      'flex items-start gap-2.5 py-2 px-1 hover:bg-muted/20 transition-colors cursor-pointer text-12 outline-none focus-visible:ring-1 focus-visible:ring-border rounded-sm',
                      isSelected && 'bg-muted/15',
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">
                        {item.title || 'Untitled Reference'}
                      </div>
                      <div className="text-11 text-muted-foreground flex items-center gap-2 mt-0.5">
                        {item.citationKey && (
                          <Badge
                            variant="outline"
                            className="text-10 px-1 py-0 h-4 font-mono font-normal"
                          >
                            {item.citationKey}
                          </Badge>
                        )}
                        {item.date && (
                          <span>
                            {typeof item.date === 'string'
                              ? item.date.slice(0, 4)
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-border mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={selectedItemIds.size === 0 || isExportingBib}
          onClick={handleSubmitLibraryBibtex(handleExportFromLibrary)}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
        >
          {isExportingBib && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          )}
          <span>Create</span>
        </Button>
      </div>
    </div>
  );
}

