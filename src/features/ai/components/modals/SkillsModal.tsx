'use client';

import React from 'react';
import {
  Lightbulb,
  FileSearch,
  Globe,
  Sigma,
  GitPullRequest,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import { useAiUIStore } from '../../store';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'Active' | 'Ready';
  features: string[];
}

const AI_SKILLS: SkillItem[] = [
  {
    id: 'rag',
    name: 'Scientific RAG & Paper Ingestion',
    description: 'Deep semantic retrieval across PDF papers, datasets, and personal libraries.',
    category: 'Knowledge Retrieval',
    icon: FileSearch,
    status: 'Active',
    features: ['Multi-vector search', 'Citation anchoring', 'Hybrid BM25 + Vector ranking'],
  },
  {
    id: 'web_search',
    name: 'Academic Web Search',
    description: 'Targeted literature scout targeting arXiv, Semantic Scholar, IEEE, and Nature.',
    category: 'Research Scouting',
    icon: Globe,
    status: 'Active',
    features: ['Peer-reviewed filter', 'Real-time preprint fetch', 'Abstract summarization'],
  },
  {
    id: 'latex',
    name: 'LaTeX Synthesis & Mathematical Proofs',
    description: 'Render and verify complex equations, theoretical proofs, and journal notation.',
    category: 'Academic Writing',
    icon: Sigma,
    status: 'Active',
    features: ['KaTeX auto-render', 'Proof verification', 'BibTeX citation generation'],
  },
  {
    id: 'action',
    name: 'Workspace Actions & Autonomous Planning',
    description: 'Create work items, schedule milestones, update project states, and manage stickies.',
    category: 'Productivity',
    icon: GitPullRequest,
    status: 'Active',
    features: ['Task decomposition', 'Sprint assignment', 'Automated progress logs'],
  },
];

export function SkillsModal() {
  const { activeModal, closeModal } = useAiUIStore();
  const isOpen = activeModal === 'skills';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Lightbulb className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Plane AI Skills & Capabilities
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pre-trained cognitive capabilities and specialized tools active in your workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 overflow-y-auto space-y-3.5">
          {AI_SKILLS.map((skill) => {
            const Icon = skill.icon;
            return (
              <div
                key={skill.id}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-md bg-secondary flex items-center justify-center text-foreground shrink-0 mt-0.5">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground tracking-tight">
                          {skill.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
                          <CheckCircle2 className="size-2.5" />
                          {skill.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                  {skill.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default SkillsModal;
