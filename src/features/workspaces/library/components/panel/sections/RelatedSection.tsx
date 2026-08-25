'use client';

import React, { useState } from 'react';
import { Share2, Link2, Unlink2, Plus, ArrowRight, ExternalLink, Network } from 'lucide-react';
import { useRelatedPapers, useLinkPapers, useUnlinkPapers } from '@/features/workspaces/library/hooks/library/use-library';
import { useLibraryPapers } from '@/features/workspaces/library/hooks/library/use-papers';
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
    (targetPaper: Paper) => targetPaper.id !== paper.id && !relatedList.some((rel) => rel.id === targetPaper.id),
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
    <div className="p-4 space-y-4 text-xs">
      {/* Header bar with Add Link & Graph visualizer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Share2 className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Paper Relations
          </h3>
          {relatedList.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
              {relatedList.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 cursor-pointer"
            onClick={() => setGraphOpen(true)}
          >
            <Network className="size-3 text-primary" />
            <span>Graph View</span>
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1 cursor-pointer"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3" />
            <span>Link Paper</span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="p-6 text-center text-muted-foreground space-y-2">
          <div className="animate-spin inline-block size-4 border-2 border-primary border-t-transparent rounded-full" />
          <p>Loading linked references...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && relatedList.length === 0 && (
        <div className="p-8 border border-dashed border-border rounded-lg text-center space-y-2">
          <Share2 className="size-8 mx-auto text-muted-foreground/40" />
          <p className="font-medium text-foreground">No linked papers yet</p>
          <p className="text-muted-foreground text-[11px]">
            Connect this paper with others to build your personal knowledge graph.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 mt-2 cursor-pointer"
            onClick={() => setAddOpen(true)}
          >
            <Link2 className="size-3" />
            <span>Add Connection</span>
          </Button>
        </div>
      )}

      {/* Relations list */}
      {!isLoading && relatedList.length > 0 && (
        <div className="space-y-2">
          {relatedList.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors flex items-start justify-between gap-3 group"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                    {item.relationType || 'related'}
                  </Badge>
                  {item.year && (
                    <span className="text-[10px] text-muted-foreground">({item.year})</span>
                  )}
                </div>
                <p className="font-medium text-foreground truncate text-xs">{item.title}</p>
                {item.authors && item.authors.length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {item.authors.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {item.doi && (
                  <a
                    href={`https://doi.org/${item.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Open DOI"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleUnlink(item.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                  title="Remove Link"
                >
                  <Unlink2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold">Link Paper Connection</DialogTitle>
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
                {availablePapers.map((targetPaper: Paper) => (
                  <option key={targetPaper.id} value={targetPaper.id}>
                    {targetPaper.title} ({targetPaper.year || 'n.d.'})
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
                className="w-full p-2 rounded-md border border-border bg-background text-foreground text-xs outline-none focus:border-primary"
              >
                <option value="related">Related / Mentions</option>
                <option value="extends">Extends / Builds Upon</option>
                <option value="rebuts">Rebuts / Contradicts</option>
                <option value="uses_dataset">Uses Same Dataset</option>
                <option value="survey_of">Survey / Literature Review</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!selectedTargetId || linkMutation.isPending}
                onClick={handleLink}
              >
                {linkMutation.isPending ? 'Linking...' : 'Create Relation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Graph Visualizer Modal */}
      <KnowledgeGraphModal
        open={graphOpen}
        onOpenChange={setGraphOpen}
        workspaceId={targetWsId}
      />
    </div>
  );
}
