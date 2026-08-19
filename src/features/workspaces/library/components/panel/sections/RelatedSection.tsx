'use client';

import React, { useState } from 'react';
import { Share2, Link2, Unlink2, Plus, ArrowRight, ExternalLink, Network } from 'lucide-react';
import { useRelatedPapers, useLinkPapers, useUnlinkPapers, useLibraryPapers } from '@/features/workspaces/library/hooks/use-library';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import type { Paper, RelatedPaperItem } from '@/features/workspaces/library/types/library.types';
import { cn } from '@/shared/lib/utils';
import { KnowledgeGraphModal } from '../../system/KnowledgeGraphModal';

interface RelatedSectionProps {
  paper: Paper;
  workspaceId: string;
}

export default function RelatedSection({ paper, workspaceId }: RelatedSectionProps) {
  const targetWsId = workspaceId || paper.workspaceId || '';
  const { data: relatedData, isLoading } = useRelatedPapers(targetWsId, paper.id || '');
  const { data: allPapersData } = useLibraryPapers(targetWsId);

  const linkMutation = useLinkPapers(targetWsId, paper.id || '');
  const unlinkMutation = useUnlinkPapers(targetWsId, paper.id || '');

  const [addOpen, setAddOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [relationType, setRelationType] = useState('related');

  const relatedList: RelatedPaperItem[] = relatedData?.relatedPapers || [];
  const availablePapers = (allPapersData?.papers || []).filter(
    (p) => p.id !== paper.id && !relatedList.some((r) => r.id === p.id),
  );

  const handleLink = async () => {
    if (!selectedTargetId) return;
    await linkMutation.mutateAsync({ targetPaperId: selectedTargetId, relationType });
    setSelectedTargetId('');
    setAddOpen(false);
  };

  const handleUnlink = async (targetId: string) => {
    await unlinkMutation.mutateAsync(targetId);
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Share2 className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Related Papers ({relatedList.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGraphOpen(true)}
            className="h-7 px-2 text-xs gap-1 shadow-xs cursor-pointer"
          >
            <Network className="size-3 text-primary" />
            <span>Graph</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="h-7 px-2 text-xs gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="size-3" />
            <span>Link</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-12 bg-muted/40 animate-pulse rounded-lg" />
        </div>
      ) : relatedList.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border/60 rounded-xl bg-muted/10 space-y-1.5">
          <Share2 className="size-6 text-muted-foreground/60 mx-auto" />
          <p className="text-xs font-medium text-foreground">No related papers linked</p>
          <p className="text-[11px] text-muted-foreground">
            Connect papers symmetrically with semantic tags like &quot;extends&quot; or &quot;uses dataset&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {relatedList.map((rel) => (
            <div
              key={rel.id}
              className="p-2.5 rounded-lg border border-border/70 bg-card/60 space-y-1.5 text-xs hover:border-border transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <h5 className="font-semibold text-foreground leading-snug line-clamp-2">
                  {rel.title}
                </h5>
                <button
                  type="button"
                  onClick={() => handleUnlink(rel.id)}
                  title="Unlink paper"
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                >
                  <Unlink2 className="size-3" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{rel.authors?.join(', ') || 'Unknown'} ({rel.year || 'n.d.'})</span>
                <Badge variant="outline" className="text-[9px] uppercase font-mono">
                  {rel.relationType}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Paper Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-border">
          <DialogHeader className="p-4 border-b border-border bg-muted/20">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="size-4 text-primary" />
              Link Symmetrically to Paper
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a paper in this workspace to establish a 2-way academic relationship
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Target Paper
              </label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              >
                <option value="">-- Choose a paper --</option>
                {availablePapers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.year || 'n.d.'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Relationship Type
              </label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary font-mono"
              >
                <option value="related">related (General academic relation)</option>
                <option value="extends">extends (Builds on this methodology)</option>
                <option value="rebuts">rebuts (Challenges or refutes findings)</option>
                <option value="uses_dataset">uses_dataset (Evaluates on same dataset)</option>
                <option value="survey_of">survey_of (Literature review or survey)</option>
              </select>
            </div>
          </div>

          <div className="p-3 border-t border-border bg-muted/20 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleLink}
              disabled={!selectedTargetId || linkMutation.isPending}
              className="h-8 text-xs cursor-pointer"
            >
              {linkMutation.isPending ? 'Linking...' : 'Establish Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Knowledge Graph Modal */}
      <KnowledgeGraphModal
        open={graphOpen}
        onOpenChange={setGraphOpen}
        workspaceId={targetWsId}
      />
    </div>
  );
}
