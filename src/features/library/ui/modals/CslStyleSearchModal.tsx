"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { useSearchCslStyles } from "@/features/library/sdk/queries/citation.queries";
import type { CslStyleMetadata } from "@/features/library/domain/types/library.types";
import { getCleanStyleLabel } from "@/features/library/domain/citations";

export interface CslStyleSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStyle: (style: { id: string; label: string }) => void;
  currentStyleId?: string;
}

export default function CslStyleSearchModal({
  open,
  onOpenChange,
  onSelectStyle,
  currentStyleId,
}: CslStyleSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<{
    id: string;
    label: string;
  } | null>(null);

  // Sync initial selected style when modal opens or currentStyleId changes
  useEffect(() => {
    if (open) {
      const isCoreStyle = [
        "bibtex",
        "apa-7th",
        "ieee",
        "mla-9th",
        "apa",
        "mla",
      ].includes(currentStyleId?.toLowerCase() || "");
      if (currentStyleId && !isCoreStyle) {
        setSelectedStyle({
          id: currentStyleId,
          label: getCleanStyleLabel(currentStyleId),
        });
      } else {
        setSelectedStyle(null);
      }
    }
  }, [open, currentStyleId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const {
    data: searchData,
    isLoading,
  } = useSearchCslStyles(debouncedQuery, 50, {
    enabled: open,
  });

  const styles = useMemo(() => searchData?.styles ?? [], [searchData?.styles]);

  const handleItemClick = (item: CslStyleMetadata) => {
    const rawLabel = item.titleShort || item.title;
    const label = getCleanStyleLabel(item.id, rawLabel);
    setSelectedStyle({ id: item.id, label });
  };

  const handleConfirm = () => {
    if (!selectedStyle || selectedStyle.id === currentStyleId) return;
    onSelectStyle(selectedStyle);
    onOpenChange(false);
    toast.success(`Selected style: ${selectedStyle.label}`, {
      id: "csl-style-select",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[540px] w-full p-0 overflow-hidden rounded-xl border border-border bg-background shadow-raised-300 gap-0"
      >
        {/* Header - Unified px-4 padding and vertically centered Close button */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 bg-background">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Citation Styles
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search and select a citation style for references and bibliography
            export.
          </DialogDescription>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.5} />
            </Button>
          </DialogClose>
        </div>

        {/* Fixed Search Bar - Aligned to exact px-4 matching header and results */}
        <div className="px-4 pb-2.5 bg-background">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (selectedStyle && selectedStyle.id !== currentStyleId) {
                    handleConfirm();
                  } else if (styles.length > 0) {
                    const first = styles[0];
                    const rawLabel = first.titleShort || first.title;
                    const label = getCleanStyleLabel(first.id, rawLabel);
                    onSelectStyle({ id: first.id, label });
                    onOpenChange(false);
                    toast.success(`Selected style: ${label}`, {
                      id: "csl-style-select",
                    });
                  }
                }
              }}
              placeholder="Search by journal name or keyword..."
              className="h-8 pl-8 pr-8 text-13 bg-background border-border rounded-md shadow-none font-normal text-foreground placeholder:text-muted-foreground hover:border-border-hover focus-visible:ring-1 focus-visible:border-primary focus-visible:ring-ring transition-colors"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-foreground hover:bg-muted rounded-xs cursor-pointer transition-colors"
                aria-label="Clear search"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            ) : isLoading ? (
              <Loader2
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground animate-spin shrink-0"
                strokeWidth={1.5}
              />
            ) : null}
          </div>
        </div>

        {/* Scrollable Styles Results List - Aligned px-4 container with comfortable item padding */}
        <div className="h-[340px] overflow-y-auto px-4 pb-2 space-y-1 thin-scrollbar select-none border-b border-border-subtle">
          {isLoading && styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-foreground text-12 py-12">
              <Loader2
                className="size-4 animate-spin text-foreground shrink-0"
                strokeWidth={1.5}
              />
              <span>Searching citation styles...</span>
            </div>
          ) : styles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-1.5 text-center text-foreground text-12 px-6 py-12">
              <p className="font-medium text-foreground">
                No citation styles found
              </p>
              <p className="text-11 text-foreground max-w-[320px]">
                {debouncedQuery
                  ? `No matches found for "${debouncedQuery}". Try another journal name or keyword.`
                  : "No citation styles available. Try typing a journal name or keyword."}
              </p>
            </div>
          ) : (
            styles.map((item) => {
              const isSelected = selectedStyle?.id === item.id;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => {
                    handleItemClick(item);
                    const rawLabel = item.titleShort || item.title;
                    const label = getCleanStyleLabel(item.id, rawLabel);
                    onSelectStyle({ id: item.id, label });
                    onOpenChange(false);
                    toast.success(`Selected style: ${label}`, {
                      id: "csl-style-select",
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(item);
                      const rawLabel = item.titleShort || item.title;
                      const label = getCleanStyleLabel(item.id, rawLabel);
                      onSelectStyle({ id: item.id, label });
                      onOpenChange(false);
                      toast.success(`Selected style: ${label}`, {
                        id: "csl-style-select",
                      });
                    }
                  }}
                  className={cn(
                    "group flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors outline-none select-none",
                    isSelected
                      ? "bg-muted text-foreground font-medium"
                      : "hover:bg-muted text-foreground focus-visible:bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-13 font-medium text-foreground truncate leading-snug">
                      {item.title}
                    </p>
                    <p className="text-11 text-foreground font-mono truncate mt-0.5">
                      {item.id}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center pr-1">
                    {isSelected && (
                      <Check
                        className="size-4 text-primary shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer - Aligned px-4 */}
        <DialogFooter className="px-4 py-3 bg-background flex items-center justify-end sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedStyle || selectedStyle.id === currentStyleId}
            onClick={handleConfirm}
            className="h-8 px-4 text-13 font-medium cursor-pointer rounded-md shadow-none"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
