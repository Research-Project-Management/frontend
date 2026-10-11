'use client';

/**
 * TemplateGalleryModal.tsx
 *
 * Canonical Academic & Document LaTeX Template Selector (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/TemplateGalleryModal.tsx`
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileCode,
  FileText,
  GraduationCap,
  Layout,
  Scroll,
  X,
  FileCheck,
  Search,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTemplateGalleryActions } from './hooks/useTemplateGalleryActions';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore, usePageStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { manuscriptService } from '@/features/editor/sdk';

import {
  type AcademicTemplate,
  ACADEMIC_TEMPLATES,
} from './template-gallery.data';

export type { AcademicTemplate };
export { ACADEMIC_TEMPLATES };


export default function TemplateGalleryModal() {
  const isTemplateModalOpen = useSettingsStore((s) => s.isTemplateModalOpen);
  const setIsTemplateModalOpen = useSettingsStore((s) => s.setIsTemplateModalOpen);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const projectId = usePageStore((s) => s.projectId);
  const { engine } = useEditorInstance();
  const [selectedTemplate, setSelectedTemplate] = useState<AcademicTemplate>(ACADEMIC_TEMPLATES[0]);
  const [previewTab, setPreviewTab] = useState<'main' | 'bib'>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Query dynamic backend manuscript templates
  const { data: serverTemplates = [], isLoading: isLoadingServer } = useQuery({
    queryKey: ['manuscript-templates', categoryFilter, searchQuery],
    queryFn: async () => {
      try {
        const res = await manuscriptService.templates.list({
          category: categoryFilter === 'All' ? undefined : categoryFilter,
          search: searchQuery || undefined,
        });
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    enabled: isTemplateModalOpen,
  });

  const combinedTemplates = useMemo(() => {
    const list: AcademicTemplate[] = [...ACADEMIC_TEMPLATES];
    serverTemplates.forEach((st: any) => {
      if (!list.some((t) => t.id === st.id)) {
        list.push({
          id: st.id,
          name: st.name,
          category: (st.category as any) || 'Conference',
          publisher: st.publisher || 'Manuscripts',
          description: st.description || 'Verified academic template from backend repository',
          icon: Layout,
          badge: st.badge || 'latex',
          mainTex: `% Template: ${st.name}\n\\documentclass{article}\n\\begin{document}\n\\title{${st.name}}\n\\maketitle\n\n\\section{Introduction}\nDocument initialized from template.\n\\end{document}`,
        });
      }
    });
    return list.filter((tpl) => {
      const matchCat =
        categoryFilter === 'All' || tpl.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchQuery =
        !searchQuery ||
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [serverTemplates, categoryFilter, searchQuery]);

  const handleSelectTemplate = async (tpl: AcademicTemplate) => {
    setSelectedTemplate(tpl);
    setPreviewTab('main');
    // If it's a server template, dynamically fetch latest template payload
    if (!ACADEMIC_TEMPLATES.some((a) => a.id === tpl.id)) {
      try {
        const remoteDetails = await manuscriptService.templates.getById(tpl.id);
        if (remoteDetails?.mainTex || remoteDetails?.content) {
          setSelectedTemplate((prev) => ({
            ...prev,
            mainTex: remoteDetails.mainTex || remoteDetails.content || prev.mainTex,
            bibTex: remoteDetails.bibTex || prev.bibTex,
          }));
        }
      } catch {
        // use fallback mainTex
      }
    }
  };

  const {
    isScaffolding,
    applyTemplate,
    scaffoldProject,
    copyCode,
  } = useTemplateGalleryActions({
    selectedTemplate,
    engine,
    activeFileTitle: activeFilePage?.title,
    projectId,
    previewTab,
    onClose: () => setIsTemplateModalOpen(false),
  });

  return (
    <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[85vh] h-[600px] flex flex-col p-0 overflow-hidden rounded-lg bg-background border border-border/60 shadow-raised-400 text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Academic templates & starters
          </DialogTitle>
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Browse and apply academic LaTeX templates and starters
        </DialogDescription>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          {/* Left Column: Search & Template List (~340px) */}
          <div className="w-full md:w-84 flex flex-col bg-muted/10 shrink-0 overflow-hidden border-r border-border">
            {/* Search Input */}
            <div className="p-2.5 border-b border-border bg-background/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingServer && combinedTemplates.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Loading templates...
                </div>
              ) : combinedTemplates.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No templates found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                combinedTemplates.map((tpl) => {
                  const isSelected = selectedTemplate.id === tpl.id;
                  const IconComp = tpl.icon || Layout;
                  return (
                    <div
                      key={tpl.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectTemplate(tpl)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectTemplate(tpl);
                        }
                      }}
                      className={cn(
                        'p-3 rounded-md border transition-all cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'border-border/60 hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            'size-6 rounded-sm flex items-center justify-center shrink-0',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <IconComp className="size-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-foreground truncate">
                            {tpl.name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-10 px-1 py-0 font-mono shrink-0 rounded-sm">
                          {tpl.badge}
                        </Badge>
                      </div>
                      <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Preview & Apply Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {/* Template Header & Switcher */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className="bg-primary text-primary-foreground text-10 font-semibold rounded-sm">
                  {selectedTemplate.publisher}
                </Badge>
                <span className="text-xs font-semibold text-foreground truncate">
                  {selectedTemplate.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('main')}
                    className={cn(
                      'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      previewTab === 'main'
                        ? 'bg-background text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    main.tex
                  </button>
                  {selectedTemplate.bibTex && (
                    <button
                      type="button"
                      onClick={() => setPreviewTab('bib')}
                      className={cn(
                        'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        previewTab === 'bib'
                          ? 'bg-background text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      references.bib
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={copyCode}
                  title="Copy code"
                  className="size-7 rounded-md flex items-center justify-center border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Code Preview Box */}
            <div className="flex-1 overflow-auto p-4 bg-muted/5 font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre select-text">
              {previewTab === 'bib' && selectedTemplate.bibTex
                ? selectedTemplate.bibTex
                : selectedTemplate.mainTex}
            </div>

            {/* Bottom Action Footer */}
            <div className="px-5 py-2.5 border-t border-border/60 bg-background flex items-center justify-end gap-2 shrink-0 select-none">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateModalOpen(false)}
                className="h-8 px-4 text-12 font-medium"
              >
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyTemplate}
                disabled={isScaffolding}
                className="h-8 gap-1.5 px-3 text-12 font-medium rounded-md cursor-pointer shadow-none"
                title="Insert template code into current active file"
              >
                <FileText className="size-3.5" />
                <span>Insert into file</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={scaffoldProject}
                disabled={isScaffolding}
                className="h-8 gap-1.5 px-3.5 text-12 font-medium rounded-md cursor-pointer shadow-none"
                title="Scaffold complete multi-file project with .bib, style files, and assets"
              >
                {isScaffolding ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <FileCheck className="size-3.5" />
                )}
                <span>{isScaffolding ? 'Scaffolding...' : 'Scaffold project'}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
