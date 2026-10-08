'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  FileCheck,
  FileText,
  GraduationCap,
  Layout,
  Mail,
  Presentation,
  Scroll,
  Search,
  Loader2,
  Copy,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';
import { pageKeys } from '../../hooks/use-page';

export interface TemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  author: string;
  defaultRootDoc?: string;
  fileCount?: number;
  files?: Array<{ path: string; content: string }>;
}

export const OVERLEAF_CATEGORIES = [
  { id: 'all', label: 'All templates', icon: Layout },
  { id: 'journal', label: 'Journal articles', icon: BookOpen },
  { id: 'book', label: 'Books', icon: BookOpen },
  { id: 'letter', label: 'Formal letters', icon: Mail },
  { id: 'assignment', label: 'Assignments', icon: FileCheck },
  { id: 'poster', label: 'Posters', icon: Layout },
  { id: 'presentation', label: 'Presentations', icon: Presentation },
  { id: 'report', label: 'Reports', icon: Scroll },
  { id: 'cv', label: 'CVs and résumés', icon: FileText },
  { id: 'thesis', label: 'Theses', icon: GraduationCap },
] as const;

interface TemplatePickerDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  projectId: string;
  initialCategory?: string;
}

export function TemplatePickerDialog({
  isOpen,
  setIsOpen,
  projectId,
  initialCategory = 'all',
}: TemplatePickerDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'main' | 'bib'>('main');
  const [isCopied, setIsCopied] = useState(false);
  const [isScaffolding, setIsScaffolding] = useState(false);

  // Sync category if initialCategory changes when opened
  React.useEffect(() => {
    if (isOpen && initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

  // Fetch templates from API
  const { data: templates = [], isLoading } = useQuery<TemplateItem[]>({
    queryKey: ['academic-templates', selectedCategory, searchQuery],
    queryFn: async () => {
      try {
        const res = await manuscriptService.templates.list({
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          search: searchQuery || undefined,
        });
        return (res as unknown as TemplateItem[]) || [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Keep a selected template
  const activeTemplate = useMemo(() => {
    if (!templates || templates.length === 0) return null;
    if (selectedTemplateId) {
      const found = templates.find((t) => t.id === selectedTemplateId);
      if (found) return found;
    }
    return templates[0];
  }, [templates, selectedTemplateId]);

  // Main file vs bib file preview extraction
  const previewContent = useMemo(() => {
    if (!activeTemplate?.files || activeTemplate.files.length === 0) {
      return '% Template content will be loaded upon scaffolding';
    }
    if (previewTab === 'bib') {
      const bib = activeTemplate.files.find((f) => f.path.endsWith('.bib'));
      return bib ? bib.content : '% No companion bibliography file';
    }
    const main = activeTemplate.files.find(
      (f) => f.path === (activeTemplate.defaultRootDoc || 'main.tex')
    ) || activeTemplate.files[0];
    return main ? main.content : '% No document content available';
  }, [activeTemplate, previewTab]);

  const hasBibFile = useMemo(() => {
    return Boolean(activeTemplate?.files?.some((f) => f.path.endsWith('.bib')));
  }, [activeTemplate]);

  const handleCopy = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success('Code copied to clipboard');
  };

  const handleScaffold = async () => {
    if (!activeTemplate || !projectId) return;
    setIsScaffolding(true);
    const toastId = toast.loading(`Scaffolding ${activeTemplate.title}...`);

    try {
      const result = await manuscriptService.exportImport.scaffoldTemplate(
        projectId,
        activeTemplate.id
      );

      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success(`Template ${activeTemplate.title} scaffolded`, { id: toastId });
      setIsOpen(false);

      if (result?.rootDocId) {
        router.push(`/projects/${projectId}/pages/${result.rootDocId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scaffolding failed', { id: toastId });
    } finally {
      setIsScaffolding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[85vh] h-[600px] flex flex-col p-0 overflow-hidden rounded-md bg-background border border-border/80 shadow-raised-200">
        {/* Header: Title only, clean and compact */}
        <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-16 font-semibold text-foreground">
            Template gallery
          </DialogTitle>
          <DialogDescription className="sr-only">
            Browse and scaffold LaTeX document templates.
          </DialogDescription>
        </DialogHeader>

        {/* Main Body: 3-column layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Column 1: Category Sidebar */}
          <div className="w-48 bg-muted/20 border-r border-border/50 px-2.5 pt-2 pb-2 overflow-y-auto space-y-1 shrink-0 select-none">
            <p className="px-2 pb-1 text-11 font-medium text-muted-foreground">
              Categories
            </p>
            {OVERLEAF_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSelectedTemplateId(null);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors group relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                    isActive
                      ? 'bg-background text-foreground font-medium shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-normal border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={cn('size-3.5 shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{cat.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Column 2: Template Card List */}
          <div className="w-72 sm:w-80 border-r border-border flex flex-col bg-background shrink-0 min-h-0">
            {/* Search Toolbar */}
            <div className="p-2.5 border-b border-border bg-background shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  aria-label="Search templates"
                  className="w-full h-8 pl-8 pr-7 text-12 rounded-md border border-border bg-background hover:border-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="size-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 thin-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground" />
                  <span className="text-12">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-muted-foreground text-center p-4">
                  <span className="text-12 font-medium text-foreground">No templates found</span>
                  <span className="text-11 text-muted-foreground">Try selecting another category or clear search.</span>
                </div>
              ) : (
                templates.map((tmpl) => {
                  const isSelected = activeTemplate?.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 select-none relative before:absolute before:-inset-0.5 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                        isSelected
                          ? 'border-primary/50 bg-primary/[0.04] ring-1 ring-primary/20'
                          : 'border-border/60 hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn(
                          'text-12 truncate flex-1 leading-normal',
                          isSelected ? 'font-medium text-foreground' : 'font-normal text-foreground'
                        )}>
                          {tmpl.title}
                        </span>
                        <span className="text-10 px-1.5 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground font-normal shrink-0">
                          {tmpl.category}
                        </span>
                      </div>
                      <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </p>
                      {tmpl.author && (
                        <span className="text-11 text-muted-foreground/70">
                          by {tmpl.author}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Live Preview Pane */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {activeTemplate ? (
              <>
                {/* Preview Toolbar */}
                <div className="h-10 px-4 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-12 font-medium text-foreground truncate max-w-xs">
                      {activeTemplate.title}
                    </span>
                    <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('main')}
                        className={cn(
                          'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
                          previewTab === 'main'
                            ? 'bg-background text-foreground font-medium shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {activeTemplate.defaultRootDoc || 'main.tex'}
                      </button>
                      {hasBibFile && (
                        <button
                          type="button"
                          onClick={() => setPreviewTab('bib')}
                          className={cn(
                            'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
                            previewTab === 'bib'
                              ? 'bg-background text-foreground font-medium shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          references.bib
                        </button>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 px-2 text-11 text-muted-foreground hover:text-foreground cursor-pointer gap-1 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {isCopied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>

                {/* Code Body */}
                <div className="flex-1 overflow-auto p-4 font-mono text-12 text-foreground/90 leading-relaxed whitespace-pre select-text bg-muted/5 thin-scrollbar">
                  {previewContent}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-12 p-6 text-center">
                <FileText className="size-8 text-muted-foreground/50 mb-2" strokeWidth={1.5} />
                <span className="font-medium text-foreground">No template selected</span>
                <span className="text-11 text-muted-foreground mt-0.5">Select a template from the list to preview source code</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Dialog Actions */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0 select-none bg-background">
          <div className="text-11 text-muted-foreground truncate hidden sm:block">
            {activeTemplate
              ? `Selected: ${activeTemplate.title}`
              : 'Select a template to scaffold'}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isScaffolding}
              className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleScaffold}
              disabled={!activeTemplate || isScaffolding}
              className="h-8 px-3.5 text-12 font-medium rounded-md cursor-pointer shadow-none gap-1.5 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              {isScaffolding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                  <span>Scaffolding...</span>
                </>
              ) : (
                'Scaffold project'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePickerDialog;
