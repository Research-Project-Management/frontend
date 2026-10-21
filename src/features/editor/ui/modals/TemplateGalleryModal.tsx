'use client';

/**
 * TemplateGalleryModal.tsx
 *
 * Canonical Academic & Document LaTeX Template Selector (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/TemplateGalleryModal.tsx`
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore, usePageStore, editorCommandBus, sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer';
import { pageKeys } from '@/features/editor/ui/hooks/document.queries';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

import {
  type AcademicTemplate,
  ACADEMIC_TEMPLATES,
} from '@/features/editor/subsystems/explorer';

export type { AcademicTemplate };
export { ACADEMIC_TEMPLATES };

const TEMPLATE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Layout,
  BookOpen,
  Scroll,
  FileCode,
  GraduationCap,
  FileText,
};


export default function TemplateGalleryModal() {
  const queryClient = useQueryClient();
  const isTemplateModalOpen = useSettingsStore((s) => s.isTemplateModalOpen);
  const setIsTemplateModalOpen = useSettingsStore((s) => s.setIsTemplateModalOpen);
  const activeFileId = usePageStore((s) => s.activeFilePage?.id);
  const activeFileTitle = usePageStore((s) => s.activeFilePage?.title);
  const currentPageId = usePageStore((s) => s.currentPage?.id);
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
    type RawServerTemplate = {
      id: string;
      name: string;
      category?: string;
      publisher?: string;
      description?: string;
      badge?: string;
      mainTex?: string;
    };
    const validCategories: AcademicTemplate['category'][] = [
      'Conference',
      'Journal',
      'Preprint',
      'Thesis',
      'Resume',
    ];
    serverTemplates.forEach((st) => {
      if (!list.some((t) => t.id === st.id)) {
        const matchedCat = validCategories.find(
          (c) => c.toLowerCase() === st.category?.toLowerCase(),
        );
        const templateName = st.name || st.title || 'Untitled Template';
        list.push({
          id: st.id,
          name: templateName,
          category: matchedCat ?? 'Conference',
          publisher: (typeof st.publisher === 'string' && st.publisher) || (typeof st.author === 'string' && st.author) || 'Manuscripts',
          description: st.description || 'Verified academic template from backend repository',
          iconName: 'Layout',
          badge: (typeof st.badge === 'string' && st.badge) || 'latex',
          mainTex:
            (typeof st.mainTex === 'string' && st.mainTex) ||
            `% Template: ${templateName}\n\\documentclass{article}\n\\begin{document}\n\\title{${templateName}}\n\\maketitle\n\n\\section{Introduction}\nDocument initialized from template.\n\\end{document}`,
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
    if (!ACADEMIC_TEMPLATES.some((a: AcademicTemplate) => a.id === tpl.id)) {
      try {
        const remoteDetails = await manuscriptService.templates.getById(tpl.id);
        if (remoteDetails && (remoteDetails.mainTex || remoteDetails.content)) {
          const mainTex = String(remoteDetails.mainTex || remoteDetails.content);
          const bibTex = remoteDetails.bibTex ? String(remoteDetails.bibTex) : undefined;
          setSelectedTemplate((prev) => ({
            ...prev,
            mainTex,
            bibTex: bibTex || prev.bibTex,
          }));
        }
      } catch {
        // use fallback mainTex
      }
    }
  };

  const [isScaffolding, setIsScaffolding] = useState(false);

  const applyTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      const targetDocId = activeFileId || currentPageId;
      if (engine) {
        engine.setContent(selectedTemplate.mainTex);
        if (targetDocId) {
          sessionCoordinator.notifyContentChange(targetDocId, selectedTemplate.mainTex);
        }
        toast.success(`Applied "${selectedTemplate.name}" to ${activeFileTitle || 'current document'}`, { id: 'apply-template' });
        setIsTemplateModalOpen(false);
      } else {
        navigator.clipboard.writeText(selectedTemplate.mainTex);
        toast.success(`Copied "${selectedTemplate.name}" template code to clipboard`, { id: 'copy-template' });
        setIsTemplateModalOpen(false);
      }
    } catch {
      toast.error('Could not apply template', { id: 'apply-template' });
    }
  }, [selectedTemplate, engine, activeFileId, activeFileTitle, currentPageId, setIsTemplateModalOpen]);

  const scaffoldProject = useCallback(async () => {
    if (!selectedTemplate) return;
    if (!projectId) {
      applyTemplate();
      return;
    }
    setIsScaffolding(true);
    try {
      await manuscriptService.templates.scaffold(projectId, selectedTemplate.id);
      lruDocumentCache.clearAll();
      if (engine) {
        engine.setContent(selectedTemplate.mainTex);
      }
      const targetDocId = activeFileId || currentPageId;
      if (targetDocId) {
        sessionCoordinator.notifyContentChange(targetDocId, selectedTemplate.mainTex);
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      editorCommandBus.dispatch({ type: 'filetree:updated' });
      toast.success(`Project scaffolded successfully with "${selectedTemplate.name}"!`, { id: 'scaffold-template' });
      setIsTemplateModalOpen(false);
    } catch (err) {
      console.warn('[TemplateGallery] Backend scaffolding failed, falling back to active file update:', err);
      applyTemplate();
    } finally {
      setIsScaffolding(false);
    }
  }, [selectedTemplate, projectId, applyTemplate, engine, activeFileId, currentPageId, queryClient, setIsTemplateModalOpen]);

  const copyCode = useCallback(() => {
    if (!selectedTemplate) return;
    const code =
      previewTab === 'bib' && selectedTemplate.bibTex
        ? selectedTemplate.bibTex
        : selectedTemplate.mainTex;
    navigator.clipboard.writeText(code);
    toast.success('Template code copied to clipboard', { id: 'copy-template' });
  }, [previewTab, selectedTemplate]);

  return (
    <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] h-[85vh] sm:h-[620px] flex flex-col p-0 overflow-hidden rounded-md bg-background border border-border/60 shadow-raised-400 text-foreground select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Academic templates & starters
          </DialogTitle>
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-border transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
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
          <div className="w-full md:w-84 max-h-48 md:max-h-none flex flex-col bg-muted/10 shrink-0 overflow-hidden border-r border-border">
            {/* Search Input */}
            <div className="p-2.5 border-b border-border bg-background/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md outline-none focus-visible:ring-1 focus-visible:ring-border text-foreground placeholder:text-muted-foreground"
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
                  const IconComp = (tpl.iconName && TEMPLATE_ICON_MAP[tpl.iconName]) || Layout;
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
                        'p-3 rounded-md border transition-all cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-border',
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
                      'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
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
                        'px-2 py-0.5 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
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
                  className="size-7 rounded-md flex items-center justify-center border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
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
            <div className="px-5 py-2.5 border-t border-border/60 bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 select-none">
              <div>
                {projectId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const toastId = toast.loading('Saving current project as template...');
                      try {
                        await manuscriptService.templates.createCustom({
                          projectId,
                          name: `${activeFileTitle?.replace(/\.tex$/i, '') || 'Custom'} Template`,
                          description: 'Saved from active manuscript project',
                          category: 'Academic',
                          mainTex: engine?.getContent(),
                        });
                        queryClient.invalidateQueries({ queryKey: ['manuscript-templates'] });
                        toast.success('Saved project as custom template!', { id: toastId });
                      } catch (err: unknown) {
                        toast.error((err as Error)?.message || 'Failed to save custom template', { id: toastId });
                      }
                    }}
                    className="h-8 px-3 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Save current project as template
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
