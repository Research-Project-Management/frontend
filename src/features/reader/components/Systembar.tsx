'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, FileText } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";

const ZOTERO_COLORS = [
  { id: 'yellow', label: 'Yellow', hex: '#ffd400' },
  { id: 'red', label: 'Red', hex: '#ff6666' },
  { id: 'green', label: 'Green', hex: '#5fb236' },
  { id: 'blue', label: 'Blue', hex: '#2ea8e5' },
  { id: 'purple', label: 'Purple', hex: '#a28ae5' },
  { id: 'magenta', label: 'Magenta', hex: '#e56eee' },
  { id: 'orange', label: 'Orange', hex: '#f19837' },
  { id: 'gray', label: 'Gray', hex: '#aaaaaa' },
] as const;

export interface SystembarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onChangeColor?: (colorHex: string) => void;
  onAddToNote?: () => void;
  onBatchDelete?: () => void;
  isProcessing?: boolean;
}

export function Systembar({
  selectedCount,
  onClearSelection,
  onChangeColor,
  onAddToNote,
  onBatchDelete,
  isProcessing = false,
}: SystembarProps) {
  React.useEffect(() => {
    if (selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, onClearSelection]);

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <div
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 shadow-none select-none font-sans"
          >
            {/* Selected Count */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-border text-12 font-mono font-medium text-foreground">
              <span className="flex size-4 items-center justify-center rounded bg-primary text-10 font-semibold tabular-nums text-primary-foreground">
                {selectedCount}
              </span>
              <span>selected</span>
            </div>

            {/* Color palette */}
            {onChangeColor && (
              <div className="flex items-center gap-1 px-1 border-r border-border">
                {ZOTERO_COLORS.map((c) => (
                  <TooltipProvider key={c.id}>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onChangeColor(c.hex)}
                          disabled={isProcessing}
                          aria-label={`Set color ${c.label}`}
                          className="size-4 rounded-full border border-border transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          style={{ backgroundColor: c.hex }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-11 py-0.5 px-1.5">
                        {c.label}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              {onAddToNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddToNote}
                  disabled={isProcessing}
                  className="h-7 px-2.5 text-12 font-medium text-foreground hover:bg-muted rounded-md cursor-pointer"
                >
                  <FileText className="mr-1 size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  Add to Note
                </Button>
              )}

              {onBatchDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBatchDelete}
                  disabled={isProcessing}
                  className="h-7 px-2.5 text-12 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md cursor-pointer"
                >
                  <Trash2 className="mr-1 size-3.5 shrink-0" strokeWidth={1.5} />
                  Delete
                </Button>
              )}
            </div>

            {/* Dismiss button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isProcessing}
              aria-label="Clear selection"
              className="h-7 px-2.5 text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md ml-1 cursor-pointer"
            >
              Clear
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Systembar;
