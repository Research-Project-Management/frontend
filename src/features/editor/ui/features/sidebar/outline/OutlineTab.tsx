'use client';

/**
 * OutlineTab.tsx
 *
 * Canonical Primary Sidebar Document Structure Outline (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/outline/OutlineTab.tsx`
 *
 * Architecture (Overleaf & VS Code Parity):
 * - Displays a live, hierarchical document section outline (\part, \chapter, \section, \subsection, etc.).
 * - Synchronously backed by `latexSymbolsIndex` (offloaded to Web Worker).
 * - Tracks editor cursor line in real time to visually highlight the active section.
 * - Click-to-Jump: Dispatches `editor:jump-to-line` with SyncTeX flash to scroll instantly to code.
 * - Search filter & Collapse/Expand all controls.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListTree,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import { usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import {
  latexSymbolsIndex,
  type OutlineNode,
  type OutlineItem,
  type SectionLevel,
} from '@/features/editor/domain/latex/latex-symbols-index';
import { SidebarPanelHeader } from '../SidebarPanelHeader';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface OutlineTabProps {
  onClose?: () => void;
}

const LEVEL_BADGES: Record<SectionLevel, { label: string; className: string }> = {
  part: { label: 'Part', className: 'bg-primary/20 text-primary border-primary/40' },
  chapter: { label: 'Ch', className: 'bg-primary/15 text-primary border-primary/30' },
  section: { label: 'Sec', className: 'bg-success/15 text-success border-success/30' },
  subsection: { label: 'Sub', className: 'bg-muted text-foreground border-border' },
  subsubsection: { label: 'Sub3', className: 'bg-muted text-muted-foreground border-border' },
  paragraph: { label: '¶', className: 'bg-muted text-muted-foreground border-border' },
  subparagraph: { label: '§', className: 'bg-muted text-muted-foreground border-border' },
};

export function OutlineTab({ onClose }: OutlineTabProps) {
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const activeDoc = activeFilePage || currentPage;
  const filePath = (activeDoc as any)?.path || activeDoc?.title || 'main.tex';
  const fileId = activeDoc?.id || '';

  const { engine } = useEditorInstance();

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [treeVersion, setTreeVersion] = useState(0);

  // 1. Fetch current outline tree & flat list
  const rawTree = useMemo(() => {
    void treeVersion;
    const byPath = latexSymbolsIndex.getOutline(filePath);
    if (byPath.length > 0) return byPath;
    if (fileId) return latexSymbolsIndex.getOutline(fileId);
    return [];
  }, [filePath, fileId, treeVersion]);

  const flatItems = useMemo(() => {
    void treeVersion;
    const byPath = latexSymbolsIndex.getFlatOutline(filePath);
    if (byPath.length > 0) return byPath;
    if (fileId) return latexSymbolsIndex.getFlatOutline(fileId);
    return [];
  }, [filePath, fileId, treeVersion]);

  // 2. Subscribe to background worker updates
  useEffect(() => {
    const unsubscribe = latexSymbolsIndex.subscribe(() => {
      setTreeVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // 3. Track cursor position in real-time
  useEffect(() => {
    if (!engine) return;
    const initialPos = engine.getCursorPosition();
    if (initialPos) setCursorLine(initialPos.line);

    return engine.onCursorChange((line: number) => {
      setCursorLine(line);
    });
  }, [engine]);

  // 4. Identify currently active section based on cursor line
  const activeSectionId = useMemo(() => {
    if (flatItems.length === 0) return null;
    let currentActive: OutlineItem | null = null;

    for (let i = 0; i < flatItems.length; i++) {
      if (cursorLine >= flatItems[i].line) {
        currentActive = flatItems[i];
      } else {
        break;
      }
    }

    return currentActive?.id || null;
  }, [flatItems, cursorLine]);

  // 5. Jump to section in CodeMirror 6
  const handleJumpToSection = useCallback(
    (line: number) => {
      editorCommandBus.dispatch({
        type: 'editor:jump-to-line',
        line,
        highlight: 'synctex',
      });
      engine?.focus();
    },
    [engine]
  );

  // 6. Collapse / Expand controls
  const toggleCollapse = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCollapseAll = useCallback(() => {
    const allParentIds = new Set<string>();
    const collectParentIds = (nodes: OutlineNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          allParentIds.add(node.id);
          collectParentIds(node.children);
        }
      }
    };
    collectParentIds(rawTree);
    setCollapsedNodes(allParentIds);
  }, [rawTree]);

  const handleExpandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);

  // 7. Filter outline by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return rawTree;
    const q = searchQuery.toLowerCase().trim();

    const filterNodes = (nodes: OutlineNode[]): OutlineNode[] => {
      const result: OutlineNode[] = [];
      for (const node of nodes) {
        const matchesSelf = node.title.toLowerCase().includes(q);
        const filteredChildren = node.children ? filterNodes(node.children) : [];
        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
      return result;
    };

    return filterNodes(rawTree);
  }, [rawTree, searchQuery]);

  // Recursive tree node renderer
  const renderOutlineNode = (node: OutlineNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const isActive = activeSectionId === node.id;
    const badge = LEVEL_BADGES[node.type] || LEVEL_BADGES.section;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleJumpToSection(node.line)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleJumpToSection(node.line);
            }
          }}
          className={cn(
            'group relative flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-12 transition-colors cursor-pointer',
            isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground hover:bg-muted/70 hover:text-foreground'
          )}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          {/* Active section indicator pill */}
          {isActive && (
            <span className="absolute left-0 top-1 bottom-1 w-0.75 rounded-r bg-primary" />
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Expand / Collapse Toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleCollapse(node.id, e)}
                className="size-4 shrink-0 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>
            ) : (
              <span className="size-4 shrink-0" />
            )}

            {/* Level Badge */}
            <span
              className={cn(
                'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-11 leading-none font-mono font-medium border shrink-0',
                badge.className
              )}
            >
              {badge.label}
            </span>

            {/* Title */}
            <span className="truncate text-12 leading-tight">
              {node.title}
              {node.hasStar && <span className="text-muted-foreground ml-0.5">*</span>}
            </span>
          </div>

          {/* Line number chip */}
          <span className="text-11 font-mono text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground transition-colors ml-1">
            L{node.line}
          </span>
        </div>

        {/* Child Subsections */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col">
            {node.children.map((child) => renderOutlineNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface text-foreground select-none">
      {/* ── Header Toolbar (h-9) ── */}
      <SidebarPanelHeader
        title="Document Outline"
        onClose={onClose}
        closeAriaLabel="Close outline panel"
      >
        <div className="flex items-center gap-0.5">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleExpandAll}
                className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Expand all"
              >
                <ChevronsUpDown className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Expand all
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Collapse all"
              >
                <ChevronsDownUp className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Collapse all
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarPanelHeader>

      {/* ── Search Input ── */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sections..."
            className="h-7 pl-8 pr-7 text-12 bg-muted/30 focus-visible:bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 size-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear filter"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Outline Tree Content ── */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filteredTree.length > 0 ? (
          filteredTree.map((node) => renderOutlineNode(node, 0))
        ) : (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
            <ListTree className="size-8 text-muted-foreground/40 mb-2" strokeWidth={1.5} />
            <p className="text-12 font-medium text-foreground">
              {searchQuery ? 'No matching headings' : 'No outline sections found'}
            </p>
            <p className="text-12 text-muted-foreground mt-1 max-w-[200px]">
              {searchQuery
                ? 'Try a different search term.'
                : 'Add \\section{...} or \\chapter{...} to build a structured outline.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer Status ── */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/20 text-11 text-muted-foreground flex items-center justify-between shrink-0">
        <span>{flatItems.length} heading{flatItems.length === 1 ? '' : 's'}</span>
        <span className="font-mono truncate max-w-[140px]">{filePath}</span>
      </div>
    </div>
  );
}

export default OutlineTab;
