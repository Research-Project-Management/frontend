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
import { usePageStore } from '@/features/editor/store/editor.store';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
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

const LEVEL_BADGES: Record<string, { label: string; className: string }> = {
  book: { label: 'Book', className: 'bg-primary/25 text-primary border-primary/50 font-semibold' },
  part: { label: 'Part', className: 'bg-primary/20 text-primary border-primary/40' },
  chapter: { label: 'Ch', className: 'bg-primary/15 text-primary border-primary/30' },
  section: { label: 'Sec', className: 'bg-success/15 text-success border-success/30' },
  subsection: { label: 'Sub', className: 'bg-muted text-foreground border-border' },
  subsubsection: { label: 'Sub3', className: 'bg-muted text-muted-foreground border-border' },
  paragraph: { label: '¶', className: 'bg-muted text-muted-foreground border-border' },
  subparagraph: { label: '§', className: 'bg-muted text-muted-foreground border-border' },
  figure: { label: 'Fig', className: 'bg-warning/15 text-warning border-warning/30' },
  table: { label: 'Tab', className: 'bg-primary/15 text-primary border-primary/30' },
  slide: { label: 'Slide', className: 'bg-ai/15 text-ai border-ai/30' },
  appendix: { label: 'App', className: 'bg-warning/15 text-warning border-warning/30' },
  abstract: { label: 'Abs', className: 'bg-success/15 text-success border-success/30' },
};

export function OutlineTab({ onClose }: OutlineTabProps) {
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const activeDoc = activeFilePage || currentPage;
  const filePath = (activeDoc && 'path' in activeDoc && typeof activeDoc.path === 'string' ? activeDoc.path : activeDoc?.title) || 'main.tex';
  const fileId = activeDoc?.id || '';

  const { engine } = useEditorInstance();

  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'project' | 'file'>('project');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sections' | 'figures-tables'>('all');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [cursorLine, setCursorLine] = useState<number>(1);
  const [treeVersion, setTreeVersion] = useState(0);

  // 1. Fetch current outline tree & flat list (Project vs Current File scope)
  const { rawTree, flatItems } = useMemo(() => {
    void treeVersion;
    if (scope === 'project') {
      const projTree = latexSymbolsIndex.getProjectOutline();
      const projFlat = latexSymbolsIndex.getProjectFlatOutline();
      if (projTree.length > 0) {
        return { rawTree: projTree, flatItems: projFlat };
      }
    }
    // Fallback to active file
    const byPath = latexSymbolsIndex.getOutline(filePath);
    const flatByPath = latexSymbolsIndex.getFlatOutline(filePath);
    if (byPath.length > 0) {
      return { rawTree: byPath, flatItems: flatByPath };
    }
    if (fileId) {
      return {
        rawTree: latexSymbolsIndex.getOutline(fileId),
        flatItems: latexSymbolsIndex.getFlatOutline(fileId),
      };
    }
    return { rawTree: [], flatItems: [] };
  }, [filePath, fileId, treeVersion, scope]);

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
      const it = flatItems[i];
      // Only highlight items matching current active file
      if (it.sourceFile && filePath && !it.sourceFile.endsWith(filePath.split('/').pop() || '')) {
        continue;
      }
      if (cursorLine >= it.line) {
        currentActive = it;
      } else {
        break;
      }
    }

    return currentActive?.id || null;
  }, [flatItems, cursorLine, filePath]);

  // 5. Jump to section with cross-file and SyncTeX PDF forward navigation
  const handleJumpToSection = useCallback(
    (targetFile: string, line: number) => {
      editorCommandBus.dispatch({
        type: 'navigation:jump-to-line',
        filePath: targetFile,
        line,
        highlight: 'synctex',
      });
      editorCommandBus.dispatch({
        type: 'synctex:forward',
        line,
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

  // 7. Filter outline by search query & category
  const filteredTree = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const matchesCategory = (type: SectionLevel) => {
      if (categoryFilter === 'sections') {
        return type !== 'figure' && type !== 'table';
      }
      if (categoryFilter === 'figures-tables') {
        return type === 'figure' || type === 'table';
      }
      return true;
    };

    const filterNodes = (nodes: OutlineNode[]): OutlineNode[] => {
      const result: OutlineNode[] = [];
      for (const node of nodes) {
        const matchesCat = matchesCategory(node.type);
        const matchesQuery =
          !q ||
          node.title.toLowerCase().includes(q) ||
          (node.sourceFile && node.sourceFile.toLowerCase().includes(q));
        const filteredChildren = node.children ? filterNodes(node.children) : [];

        if (matchesCat && matchesQuery) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        } else if (filteredChildren.length > 0) {
          // Promote matching descendants if parent is filtered out by category or query
          result.push(...filteredChildren);
        }
      }
      return result;
    };

    return filterNodes(rawTree);
  }, [rawTree, searchQuery, categoryFilter]);

  // Recursive tree node renderer
  const renderOutlineNode = (node: OutlineNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const isActive = activeSectionId === node.id;
    const badge = LEVEL_BADGES[node.type] || LEVEL_BADGES.section;
    const nodeFileBase = node.sourceFile ? node.sourceFile.split('/').pop() : '';
    const activeFileBase = filePath.split('/').pop();
    const isOtherFile = Boolean(nodeFileBase && nodeFileBase !== activeFileBase);

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleJumpToSection(node.sourceFile || filePath, node.line)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleJumpToSection(node.sourceFile || filePath, node.line);
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
                className="size-4 shrink-0 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground"
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
                'inline-flex items-center justify-center px-1.5 py-0.5 rounded-sm text-11 leading-none font-mono font-medium border shrink-0',
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

          <div className="flex items-center gap-1 shrink-0">
            {/* Subfile origin tag if from an included file */}
            {isOtherFile && (
              <span
                title={`Defined in ${node.sourceFile}`}
                className="text-[10px] font-mono text-muted-foreground/70 px-1 py-0.2 rounded-sm bg-muted/60 max-w-[80px] truncate"
              >
                {nodeFileBase}
              </span>
            )}

            {/* Line number chip */}
            <span className="text-11 font-mono text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground transition-colors ml-0.5">
              L{node.line}
            </span>
          </div>
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
      <div className="p-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sections & figures..."
            className="h-7 pl-8 pr-7 text-12 bg-muted/30 focus-visible:bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 size-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label="Clear filter"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Scope Switcher & Category Filters (Overleaf Parity) ── */}
      <div className="px-2 pb-2 pt-0 border-b border-border flex items-center justify-between gap-1 shrink-0">
        {/* Scope: Project vs Current File */}
        <div className="inline-flex rounded-md p-0.5 bg-muted/50 border border-border/60 text-[11px]">
          <button
            type="button"
            onClick={() => setScope('project')}
            className={cn(
              'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              scope === 'project'
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Project-wide outline"
          >
            Project
          </button>
          <button
            type="button"
            onClick={() => setScope('file')}
            className={cn(
              'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              scope === 'file'
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Current file outline only"
          >
            File
          </button>
        </div>

        {/* Category: All / Sections / Figures & Tables */}
        <div className="inline-flex rounded-md p-0.5 bg-muted/50 border border-border/60 text-[10px]">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'px-1.5 py-0.5 rounded-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              categoryFilter === 'all'
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('sections')}
            className={cn(
              'px-1.5 py-0.5 rounded-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              categoryFilter === 'sections'
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Sec
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('figures-tables')}
            className={cn(
              'px-1.5 py-0.5 rounded-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              categoryFilter === 'figures-tables'
                ? 'bg-background text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Fig/Tab
          </button>
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
