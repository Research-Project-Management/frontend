'use client';

import React, { useState, useMemo } from 'react';
import { Search, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { Checkbox } from '@/shared/components/ui';
import { useViewItems } from '../../hooks/use-items';
import { ItemService } from '../../services/item.service';
import { formatCreatorCompact, normalizeAuthors } from '../../utils/library.util';
import type { Item } from '../../types/library.types';

interface ImportFromPersonalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onSuccess?: () => void;
}

export default function ImportFromPersonalModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
}: ImportFromPersonalModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Always query from personal scope ('user')
  const { data, isLoading } = useViewItems('user', 'all', search);
  const personalItems: Item[] = useMemo(() => data?.items ?? [], [data?.items]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const isAllSelected =
    personalItems.length > 0 && selectedIds.length === personalItems.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(personalItems.map((it) => it.id));
    }
  };

  const handleImport = async () => {
    if (!selectedIds.length || !projectId) return;
    setIsImporting(true);
    try {
      const res = await ItemService.importFromPersonal(projectId, selectedIds);
      toast.success(
        `Imported ${res.importedCount ?? selectedIds.length} document(s) into ${projectName}`,
      );
      setSelectedIds([]);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import documents');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border border-border bg-background shadow-none select-none">
        <DialogHeader className="p-4 pb-3 border-b border-border">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Import from My Library
          </DialogTitle>
          <p className="text-12 text-muted-foreground mt-0.5">
            Select items from your personal library to collaborate on in{' '}
            <span className="font-medium text-foreground">{projectName}</span>.
          </p>
        </DialogHeader>

        <div className="p-3 border-b border-border bg-muted/20 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter personal documents..."
              className="h-8 pl-8 text-12 rounded-md bg-background"
            />
          </div>
          {personalItems.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 text-12 font-normal whitespace-nowrap"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {/* Items List */}
        <div className="max-h-[340px] min-h-[160px] overflow-y-auto divide-y divide-border/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              <span className="text-12">Loading personal library...</span>
            </div>
          ) : personalItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <BookOpen className="size-6 mb-2 opacity-60" />
              <p className="text-12 font-medium">No documents found</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                {search.trim()
                  ? 'No personal items match your search filter.'
                  : 'Your personal library is empty.'}
              </p>
            </div>
          ) : (
            personalItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const authorText = formatCreatorCompact(
                normalizeAuthors(item),
              );
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`flex items-start gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-muted/60' : 'hover:bg-muted/30'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-12 font-medium text-foreground truncate leading-tight">
                      {item.title || 'Untitled Reference'}
                    </p>
                    <p className="text-11 text-muted-foreground truncate mt-0.5">
                      {authorText ? `${authorText} ` : ''}
                      {item.year ? `(${item.year})` : ''}
                      {item.publicationTitle ? ` — ${item.publicationTitle}` : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="p-3 border-t border-border bg-muted/10 flex items-center justify-between sm:justify-between">
          <span className="text-11 text-muted-foreground font-mono">
            {selectedIds.length} item(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-12 font-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.length === 0 || isImporting}
              className="h-8 text-12 font-normal"
            >
              {isImporting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              <span>Import to Project</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
