import React from "react";
import { type Note, type NoteColor, NOTE_COLOR_MAP } from "~/types/sticky";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Palette } from "lucide-react";
import { ToolbarBtn } from "../note/ToolbarBtn";
import { motion, AnimatePresence } from "framer-motion";

interface ColorModalProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  isActive: boolean;
  onActiveChange: (open: boolean) => void;
}

export default function ColorModal({
  note,
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
        className="w-[242px] p-0 rounded-sm shadow-2xl z-[100] bg-popover border border-border text-popover-foreground overflow-hidden" 
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
              <div className="mb-2.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Background colors
              </div>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(NOTE_COLOR_MAP) as NoteColor[]).map((noteColor) => (
                  <motion.button
                    key={noteColor}
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-7 h-7 rounded-sm transition-shadow shadow-sm border-2 ${
                      note.color === noteColor ? "border-black" : "border-black/5"
                    }`}
                    style={{
                      backgroundColor: NOTE_COLOR_MAP[noteColor].bg,
                    }}
                    onClick={() => {
                      onUpdate(note._id, { color: noteColor });
                      onActiveChange(false);
                    }}
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
