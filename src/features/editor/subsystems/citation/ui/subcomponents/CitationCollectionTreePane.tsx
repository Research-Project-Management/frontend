'use client';

/**
 * CitationCollectionTreePane.tsx
 *
 * Column 1 of CitationPickerModal: Library Directory & Collections Tree.
 */

import React, { useState } from 'react';
import {
  Library,
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  FileCode,
  BookMarked,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CollectionNode {
  id: string;
  name: string;
  children?: CollectionNode[];
}

export interface CitationCollectionTreePaneProps {
  activeView: 'tree' | 'list' | 'detail';
  selectedNav: string;
  navCounts: Record<string, number>;
  collectionTree: CollectionNode[];
  onSelectNav: (navId: string) => void;
}

export function CitationCollectionTreePane({
  activeView,
  selectedNav,
  navCounts,
  collectionTree,
  onSelectNav,
}: CitationCollectionTreePaneProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        'w-full md:w-56 shrink-0 bg-muted/20 border-r border-border/70 flex flex-col min-h-0 overflow-hidden',
        activeView !== 'tree' && 'hidden md:flex',
      )}
    >
      <div
        role="tree"
        aria-label="Reference collections"
        className="flex-1 min-h-0 overflow-y-auto p-2 space-y-4 sidebar-scrollbar"
      >
        {/* Scope & System Sections */}
        <div className="space-y-0.5">
          <div className="px-2 pb-1 text-11 font-medium text-foreground select-none">
            My Library
          </div>

          <button
            type="button"
            role="treeitem"
            aria-selected={selectedNav === 'all'}
            onClick={() => onSelectNav('all')}
            className={cn(
              'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-left',
              selectedNav === 'all'
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <Library className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
            <span className="truncate flex-1">All References</span>
            <span className="text-10 font-mono opacity-70">{navCounts.all}</span>
          </button>

          <button
            type="button"
            role="treeitem"
            aria-selected={selectedNav === 'cited'}
            onClick={() => onSelectNav('cited')}
            className={cn(
              'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-left',
              selectedNav === 'cited'
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <FileText className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
            <span className="truncate flex-1">In Document</span>
            <span className="text-10 font-mono opacity-70">{navCounts.cited}</span>
          </button>

          <button
            type="button"
            role="treeitem"
            aria-selected={selectedNav === 'library'}
            onClick={() => onSelectNav('library')}
            className={cn(
              'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-left',
              selectedNav === 'library'
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <BookMarked className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
            <span className="truncate flex-1">Workspace Library</span>
            <span className="text-10 font-mono opacity-70">{navCounts.library}</span>
          </button>

          <button
            type="button"
            role="treeitem"
            aria-selected={selectedNav === 'bib'}
            onClick={() => onSelectNav('bib')}
            className={cn(
              'w-full h-7 px-2 flex items-center gap-2 rounded-md text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-left',
              selectedNav === 'bib'
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <FileCode className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
            <span className="truncate flex-1">Project .bib</span>
            <span className="text-10 font-mono opacity-70">{navCounts.bib}</span>
          </button>
        </div>

        {/* Collections Tree Section */}
        {collectionTree.length > 0 && (
          <div className="space-y-0.5">
            <div className="px-2 pb-1 text-11 font-medium text-foreground select-none">
              Collections
            </div>

            {collectionTree.map((rootNode) => {
              const isExpanded = expandedFolders.has(rootNode.id);
              const isSelected = selectedNav === rootNode.id;
              const hasChildren = rootNode.children && rootNode.children.length > 0;
              const count = navCounts[rootNode.id] ?? 0;

              return (
                <div key={rootNode.id} className="space-y-0.5">
                  <div
                    role="treeitem"
                    tabIndex={0}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    aria-selected={isSelected}
                    onClick={() => onSelectNav(rootNode.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectNav(rootNode.id);
                      } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
                        e.preventDefault();
                        toggleFolder(rootNode.id, e);
                      } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
                        e.preventDefault();
                        toggleFolder(rootNode.id, e);
                      }
                    }}
                    className={cn(
                      'w-full h-7 px-2 flex items-center gap-1.5 rounded-md text-12 transition-colors cursor-pointer outline-none select-none text-left group focus-visible:ring-1 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => toggleFolder(rootNode.id, e)}
                        className="p-0.5 hover:bg-muted rounded text-foreground"
                        aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                      >
                        <ChevronRight
                          className={cn(
                            'size-3 transition-transform duration-150',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    {isExpanded ? (
                      <FolderOpen className="size-3.5 shrink-0 text-foreground" />
                    ) : (
                      <Folder className="size-3.5 shrink-0 text-foreground" />
                    )}

                    <span className="truncate flex-1">{rootNode.name}</span>
                    {count > 0 && (
                      <span className="text-10 font-mono opacity-70">{count}</span>
                    )}
                  </div>

                  {/* Sub-collections */}
                  {hasChildren && isExpanded && (
                    <div className="pl-4 space-y-0.5 border-l border-border/50 ml-3.5 my-0.5">
                      {rootNode.children!.map((subNode) => {
                        const isSubSelected = selectedNav === subNode.id;
                        const subCount = navCounts[subNode.id] ?? 0;

                        return (
                          <button
                            key={subNode.id}
                            type="button"
                            role="treeitem"
                            aria-selected={isSubSelected}
                            onClick={() => onSelectNav(subNode.id)}
                            className={cn(
                              'w-full h-6 px-2 flex items-center gap-2 rounded-md text-11 transition-colors cursor-pointer outline-none select-none text-left focus-visible:ring-1 focus-visible:ring-primary',
                              isSubSelected
                                ? 'bg-muted text-foreground font-medium'
                                : 'text-foreground hover:bg-muted',
                            )}
                          >
                            <Folder className="size-3 shrink-0 text-foreground" />
                            <span className="truncate flex-1">{subNode.name}</span>
                            {subCount > 0 && (
                              <span className="text-10 font-mono opacity-70">{subCount}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
