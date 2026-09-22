'use client';

import React, { useState } from 'react';
import {
  Brain,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import { useAiUIStore } from '../../store';
import { clearAiMemory } from '../../services/chat.service';
import { getErrorMessage } from '@/shared/lib/utils';

export function MemoryModal() {
  const { activeModal, closeModal } = useAiUIStore();
  const isOpen = activeModal === 'memory';
  const [isClearing, setIsClearing] = useState(false);

  const handleClearMemory = async () => {
    if (!confirm('Are you sure you want to clear all Plane AI conversational memory and learned preferences? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      await clearAiMemory();
      toast.success('AI memory cleared successfully');
      closeModal();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to clear AI memory');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Brain className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Plane AI Long-term Memory
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Learned contextual preferences, project affinities, and conversational recall across sessions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                <span className="text-xs font-semibold text-foreground">Memory Status: Active</span>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
                Auto-Promoting
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Plane AI automatically extracts relevant insights from your queries (such as your preferred research methods, active project priorities, and writing tone) to personalize future answers.
            </p>
          </div>

          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-muted-foreground" />
              Retained Contextual Vectors
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-5 list-disc">
              <li>Academic citation format (APA 7th & BibTeX)</li>
              <li>Active workspace projects and sprint cycle deadlines</li>
              <li>Frequently referenced literature datasets and authors</li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border">
            <span className="text-xs text-muted-foreground">
              Reset memory to factory state
            </span>
            <button
              onClick={handleClearMemory}
              disabled={isClearing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
            >
              <RotateCcw className={`size-3.5 ${isClearing ? 'animate-spin' : ''}`} />
              {isClearing ? 'Clearing...' : 'Clear All AI Memory'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default MemoryModal;
