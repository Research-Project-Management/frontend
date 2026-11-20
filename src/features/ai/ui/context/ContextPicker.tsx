'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import type { ContextTab, SourceEntry } from '../../context/source.port';
import { LibraryTab } from './LibraryTab';
import { UploadedTab } from './UploadedTab';

export interface ContextPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId?: string | null;
  initialTab?: ContextTab;
  selectedIds?: ReadonlySet<string>;
  onSelect: (entries: SourceEntry[]) => void;
}

const TABS: ReadonlyArray<{
  id: ContextTab;
  label: string;
  icon: typeof BookOpen;
}> = [
  { id: 'library', label: 'Paper Library', icon: BookOpen },
  { id: 'uploaded', label: 'Uploaded Docs', icon: Database },
];

export function ContextPicker({
  open,
  onOpenChange,
  spaceId = null,
  initialTab = 'library',
  selectedIds,
  onSelect,
}: ContextPickerProps) {
  const [activeTab, setActiveTab] = useState<ContextTab>(initialTab);
  const [pending, setPending] = useState<Map<string, SourceEntry>>(new Map());

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setPending(new Map());
    }
  }, [open, initialTab]);

  const toggleEntry = useCallback((entry: SourceEntry) => {
    setPending((prev) => {
      const next = new Map(prev);
      if (next.has(entry.id)) {
        next.delete(entry.id);
      } else {
        next.set(entry.id, entry);
      }
      return next;
    });
  }, []);

  const handleQuickAttach = useCallback(
    (entry: SourceEntry) => {
      onSelect([entry]);
      toast.success(`Attached "${entry.name}"`);
      setPending(new Map());
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const handleUploadedEntries = useCallback((entries: SourceEntry[]) => {
    setPending((prev) => {
      const next = new Map(prev);
      for (const e of entries) {
        next.set(e.id, e);
      }
      return next;
    });
  }, []);

  const handleConfirm = () => {
    if (pending.size > 0) {
      onSelect(Array.from(pending.values()));
    }
    setPending(new Map());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] max-h-[680px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-0 border-b border-border shrink-0">
          <DialogTitle className="text-15 font-semibold text-foreground">
            Attach Context
          </DialogTitle>

          <div className="flex items-center gap-4 pt-2.5 -mb-px">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 pb-2 text-13 font-medium border-b-2 transition-colors cursor-pointer',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <TabIcon className="size-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {open && activeTab === 'library' && (
            <LibraryTab
              spaceId={spaceId}
              pending={pending}
              selectedIds={selectedIds}
              onToggle={toggleEntry}
              onQuickAttach={handleQuickAttach}
              onAttachMany={handleUploadedEntries}
            />
          )}

          {open && activeTab === 'uploaded' && (
            <UploadedTab
              spaceId={spaceId}
              pending={pending}
              selectedIds={selectedIds}
              onToggle={toggleEntry}
              onQuickAttach={handleQuickAttach}
              onUploadedEntries={handleUploadedEntries}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/20 shrink-0">
          <span className="text-12 text-muted-foreground">
            {pending.size > 0
              ? `${pending.size} context item${pending.size === 1 ? '' : 's'} selected`
              : 'Click or double-click items to attach'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending.size === 0}
              onClick={handleConfirm}
              className="bg-ai text-white hover:bg-ai-hover gap-1.5"
            >
              <Check className="size-3.5" />
              <span>Attach {pending.size > 0 ? `(${pending.size})` : ''}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ContextPicker;
