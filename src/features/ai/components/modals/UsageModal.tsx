'use client';

import React from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  Clock,
  Sparkles,
  BarChart,
  HardDrive,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import { useAiUIStore } from '../../store';

export function UsageModal() {
  const { activeModal, closeModal } = useAiUIStore();
  const isOpen = activeModal === 'usage';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Activity className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Plane AI Usage & Quotas
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Overview of current token utilization, context bandwidth, and model allocations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Top stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Zap className="size-3.5 text-primary" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Tokens Used</span>
              </div>
              <p className="text-lg font-bold text-foreground">248,512</p>
              <span className="text-[11px] text-muted-foreground">In active cycle</span>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="size-3.5 text-success" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Queries</span>
              </div>
              <p className="text-lg font-bold text-foreground">142</p>
              <span className="text-[11px] text-success font-medium">99.8% Success</span>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock className="size-3.5 text-warning" />
                <span className="text-[11px] font-medium uppercase tracking-wider">Avg Latency</span>
              </div>
              <p className="text-lg font-bold text-foreground">412ms</p>
              <span className="text-[11px] text-muted-foreground">Stream TTFT</span>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Monthly Context Quota</span>
              </div>
              <span className="text-xs font-medium text-foreground">24.8% Used</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: '24.8%' }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>248k / 1.0M tokens</span>
              <span>Resets in 18 days</span>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="p-4 rounded-lg border border-border bg-card space-y-2.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Usage by Intelligence Model
            </h4>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Claude Sonnet 3.7 / 5</span>
                <span className="font-mono text-foreground font-medium">164,200 tokens (66%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">GPT-4o Reasoning</span>
                <span className="font-mono text-foreground font-medium">58,110 tokens (23%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gemini 2.0 Flash / DeepSeek</span>
                <span className="font-mono text-foreground font-medium">26,202 tokens (11%)</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default UsageModal;
