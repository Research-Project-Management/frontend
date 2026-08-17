import React from "react";
import { type Sticky } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { type StickyColor } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { STICKY_COLOR_MAP } from '@/features/workspaces/projects/stickies/types/sticky.types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { Palette } from "lucide-react";
import { ToolbarBtn } from "../ui/ToolbarBtn";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/utils";

interface ColorModalProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  isActive: boolean;
  onActiveChange: (open: boolean) => void;
}

export default function ColorModal({
  sticky,
  onUpdate,
  isActive,
  onActiveChange,
}: ColorModalProps) {
  return (
    <Popover open={isActive} onOpenChange={onActiveChange}>
      <PopoverTrigger asChild>
        <ToolbarBtn
          title="Color"
          isActive={isActive}
        >
          <Palette size={14} />
        </ToolbarBtn>
      </PopoverTrigger>
      <PopoverContent 
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-[242px] p-0 rounded-lg shadow-2xl z-[100] bg-popover border border-border text-popover-foreground overflow-hidden" 
        align="start" 
        side="top" 
        sideOffset={14}
      >
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1.0] }}
              className="p-3"
            >
              <div className="mb-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Background colors
              </div>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(STICKY_COLOR_MAP) as StickyColor[]).map((color) => (
                  <motion.button
                    key={color}
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "w-8 h-8 rounded-lg transition-shadow shadow-sm border-2",
                      sticky.color === color ? "border-black" : "border-black/5"
                    )}
                    style={{
                      backgroundColor: STICKY_COLOR_MAP[color].bg,
                    }}
                    onClick={() => {
                      const sId = sticky._id || (sticky as any).id;
                      if (sId) onUpdate(sId, { color });
                      onActiveChange(false);
                    }}
                    aria-label={`Change color to ${color}`}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
