'use client';

import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Brain,
  MessageSquare,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import { useAiUIStore } from '../../store';

export function AnalyticsModal() {
  const { activeModal, closeModal } = useAiUIStore();
  const isOpen = activeModal === 'analytics';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Plane AI Analytics
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Performance benchmarks, citation accuracy, and agent distribution telemetry.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <FileCheck className="size-3.5 text-success" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Citation Fidelity</span>
              </div>
              <p className="text-xl font-bold text-foreground">98.4%</p>
              <span className="text-[11px] text-muted-foreground">Anchored to peer papers</span>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Brain className="size-3.5 text-primary" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Reasoning Depth</span>
              </div>
              <p className="text-xl font-bold text-foreground">High</p>
              <span className="text-[11px] text-muted-foreground">Chain-of-thought active</span>
            </div>
          </div>

          {/* Workflow Distribution */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Agent Activity Distribution
            </h4>
            <div className="space-y-2 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Scientific RAG & Q&A</span>
                  <span className="text-foreground font-mono font-medium">48%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '48%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Workspace Project Actions</span>
                  <span className="text-foreground font-mono font-medium">28%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-full" style={{ width: '28%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Academic Web Scout</span>
                  <span className="text-foreground font-mono font-medium">16%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/50 rounded-full" style={{ width: '16%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">LaTeX Synthesis & Proofs</span>
                  <span className="text-foreground font-mono font-medium">8%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/30 rounded-full" style={{ width: '8%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default AnalyticsModal;
