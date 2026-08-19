'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Share2, ZoomIn, ZoomOut, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useWorkspaceKnowledgeGraph } from '../../hooks/use-library';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';

interface KnowledgeGraphModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSelectPaper?: (paperId: string) => void;
}

export const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  open,
  onOpenChange,
  workspaceId,
  onSelectPaper,
}) => {
  const { data: graphData, isLoading } = useWorkspaceKnowledgeGraph(workspaceId);
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  // Calculate circular layout coordinates for nodes
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const total = nodes.length;
    if (total === 0) return map;

    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(250, 40 + total * 25);

    nodes.forEach((node, idx) => {
      const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
      map.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return map;
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const q = search.toLowerCase();
    return nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (Array.isArray(n.authors) && n.authors.some((a) => a.toLowerCase().includes(q))),
    );
  }, [nodes, search]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (onSelectPaper) {
      onSelectPaper(nodeId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-border/80">
        <DialogHeader className="p-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Share2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                Workspace Knowledge Graph
                <Badge variant="outline" className="text-[10px] bg-background">
                  {nodes.length} Papers • {edges.length} Connections
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Interactive citation network and semantic cross-paper relationships
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search node..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-md bg-background border border-border outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-dot-grid overflow-hidden flex">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
              <Sparkles className="size-4 animate-spin text-primary mr-2" />
              Building Knowledge Graph...
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
              <Share2 className="size-8 stroke-1 text-muted-foreground mb-2" />
              <p className="font-semibold text-foreground">No relationships yet</p>
              <p className="text-[11px] max-w-xs mt-1">
                Link related papers together using the &quot;Related Papers&quot; tab in the inspector panel to generate your interactive graph.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              <svg
                viewBox="0 0 800 600"
                className="w-full h-full max-h-[600px] select-none transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              >
                {/* Edges */}
                {edges.map((edge, idx) => {
                  const sourcePos = nodePositions.get(edge.source);
                  const targetPos = nodePositions.get(edge.target);
                  if (!sourcePos || !targetPos) return null;

                  const isHighlighted =
                    selectedNodeId === edge.source || selectedNodeId === edge.target;

                  return (
                    <g key={idx}>
                      <line
                        x1={sourcePos.x}
                        y1={sourcePos.y}
                        x2={targetPos.x}
                        y2={targetPos.y}
                        stroke={isHighlighted ? 'var(--primary)' : 'currentColor'}
                        strokeOpacity={isHighlighted ? 0.9 : 0.25}
                        strokeWidth={isHighlighted ? 2.5 : 1.5}
                        strokeDasharray={edge.relationType === 'rebuts' ? '4 4' : undefined}
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {filteredNodes.map((node) => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const isMatching =
                    search &&
                    (node.title.toLowerCase().includes(search.toLowerCase()) ||
                      node.authors?.some((a) => a.toLowerCase().includes(search.toLowerCase())));

                  return (
                    <g
                      key={node.id}
                      onClick={() => handleNodeClick(node.id)}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isSelected ? 18 : 14}
                        fill={isSelected ? 'var(--primary)' : isMatching ? '#f59e0b' : 'var(--card)'}
                        stroke={isSelected ? 'var(--primary)' : 'var(--border)'}
                        strokeWidth={2}
                        className="transition-all shadow-md"
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 24}
                        textAnchor="middle"
                        className={cn(
                          'text-[10px] font-sans pointer-events-none fill-foreground/80 font-medium truncate max-w-32',
                          isSelected && 'fill-primary font-bold text-[11px]',
                        )}
                      >
                        {node.title.slice(0, 20)}...
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Node detail side card */}
          {selectedNode && (
            <div className="w-64 border-l border-border/70 p-3.5 bg-card/60 space-y-2.5 text-xs overflow-y-auto">
              <h4 className="font-semibold text-foreground text-xs leading-snug">
                {selectedNode.title}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {selectedNode.authors?.join(', ') || 'Unknown Authors'}
              </p>
              {selectedNode.year && (
                <Badge variant="secondary" className="text-[10px]">
                  {selectedNode.year}
                </Badge>
              )}
              {selectedNode.citationKey && (
                <p className="font-mono text-[10px] text-muted-foreground/80">
                  @{selectedNode.citationKey}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
