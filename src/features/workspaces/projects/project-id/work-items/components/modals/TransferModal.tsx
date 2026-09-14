'use client';

import React, { useState, useMemo } from "react";
import { Button } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui";
import {
  Search,
  ArrowRightLeft,
  PlayCircle,
  CircleDashed,
  X,
} from "lucide-react";
import { useTransferItems } from "../../hooks/use-cycle";
import { DetailModal } from "./DetailModal";
import type { Item, Column, Cycle } from "../../types/work-item.types";
import { cn } from "@/shared/lib/utils";

export interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sourceCycleId: string;
  sourceCycleName: string;
  items?: Item[];
  availableCycles: Cycle[];
  columns: Column[];
  members?: any[];
  onSuccess?: () => void;
}

export function TransferModal({
  open,
  onOpenChange,
  projectId,
  sourceCycleId,
  sourceCycleName,
  items = [],
  availableCycles,
  columns,
  members = [],
  onSuccess,
}: TransferModalProps) {
  const displayItems = items;
  const { transferItems, isPending } = useTransferItems(projectId);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [targetCycleId, setTargetCycleId] = useState<string>("");

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return displayItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.identifier?.toLowerCase().includes(keyword)
      );
    });
  }, [displayItems, searchTerm]);

  const targetCycles = useMemo(() => {
    return availableCycles.filter(
      (c) => c.id !== sourceCycleId && c.status !== "completed"
    );
  }, [availableCycles, sourceCycleId]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredItems.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (itemId: string) => {
    setSelectedIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleTransfer = async () => {
    await transferItems({
      selectedIds,
      targetCycleId,
      onSuccess: () => {
        onOpenChange(false);
        setSelectedIds([]);
        onSuccess?.();
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border border-border bg-background rounded-lg">
          {/* Header */}
          <DialogHeader className="px-6 py-5 border-b border-border bg-background text-left">
            <DialogTitle className="flex items-center gap-2 text-foreground font-semibold text-base">
              <ArrowRightLeft className="size-4.5 text-primary shrink-0" />
              <span>Transfer Work Items from Cycle</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Select work items to move from{" "}
              <span className="font-semibold text-foreground">{sourceCycleName}</span> to another cycle.
            </DialogDescription>
          </DialogHeader>

          {/* Controls */}
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Destination Cycle
              </label>
              <Select value={targetCycleId} onValueChange={setTargetCycleId}>
                <SelectTrigger className="w-full h-9 rounded-sm border-border bg-background text-sm">
                  <SelectValue placeholder="Select target cycle..." />
                </SelectTrigger>
                <SelectContent className="rounded-sm border-border">
                  <SelectItem value="unassigned" className="cursor-pointer">
                    <span className="text-muted-foreground font-medium">Remove from Cycle (Unassign)</span>
                  </SelectItem>
                  {targetCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        {cycle.status === "active" ? (
                          <PlayCircle className="size-3.5 text-success shrink-0" />
                        ) : (
                          <CircleDashed className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span>{cycle.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative flex items-center h-9 rounded-sm border border-border bg-background px-3 focus-within:border-primary transition-colors">
              <Search className="size-3.5 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search work items to transfer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search work items to transfer"
                className="w-full h-full text-xs bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                  className="text-foreground cursor-pointer"
                >
                  <X className="size-3 shrink-0" />
                </button>
              )}
            </div>

            {/* Work item list */}
            <div className="border border-border rounded-sm overflow-hidden bg-background">
              <div className="px-3 py-2 border-b border-border bg-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      filteredItems.length > 0 &&
                      selectedIds.length === filteredItems.length
                    }
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                  />
                  <label
                    htmlFor="select-all"
                    className="text-xs font-semibold text-muted-foreground cursor-pointer"
                  >
                    Select All ({filteredItems.length})
                  </label>
                </div>
                <span className="text-xs font-medium text-primary">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-border">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No work items found matching criteria.
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleSelect(item.id)}
                        className={cn(
                          "px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {item.title}
                          </p>
                          {item.identifier && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {item.identifier}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailItem(item);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border bg-background flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleTransfer}
              disabled={
                !targetCycleId ||
                selectedIds.length === 0 ||
                isPending
              }
              className="text-xs font-semibold"
            >
              {isPending ? "Transferring..." : "Transfer items"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Preview Dialog */}
      {detailItem && (
        <DetailModal
          open={!!detailItem}
          onOpenChange={(v) => !v && setDetailItem(null)}
          card={detailItem}
          columns={columns}
          members={members}
          onSave={() => {}}
          isReadOnly={true}
        />
      )}
    </>
  );
}

export default TransferModal;
