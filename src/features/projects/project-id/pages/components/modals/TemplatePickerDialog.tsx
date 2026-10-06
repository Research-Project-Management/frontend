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
  Sparkles,
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
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
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
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-foreground" />
              <span>Template Gallery</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Choose from standardized academic templates matching Overleaf's official formats.
            </DialogDescription>
          </div>
          <div className="w-64">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/30"
              />
            </div>
          </div>
        </div>

        {/* Body 3-column / 2-column layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Column 1: Category Sidebar */}
          <div className="w-52 border-r border-border bg-muted/10 p-2 overflow-y-auto shrink-0 flex flex-col gap-0.5">
            <span className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </span>
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
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-foreground hover:bg-muted/70'
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Column 2: Template Card List */}
          <div className="w-80 border-r border-border p-3 overflow-y-auto shrink-0 flex flex-col gap-2 bg-background">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-xs">Loading templates...</span>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-1.5 text-muted-foreground text-center p-4">
                <span className="text-xs font-medium">No templates found</span>
                <span className="text-[11px]">Try selecting another category or clear search.</span>
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
                      'w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/70 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground line-clamp-1">
                        {tmpl.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal">
                        {tmpl.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>
                    <span className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                      by {tmpl.author}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Column 3: Live Preview & Action Pane */}
          <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
            {activeTemplate ? (
              <>
                {/* Preview Toolbar */}
                <div className="h-10 px-4 border-b border-border bg-background flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate max-w-xs">
                      {activeTemplate.title}
                    </span>
                    <div className="flex items-center rounded-md bg-muted/50 p-0.5 border border-border text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPreviewTab('main')}
                        className={cn(
                          'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer',
                          previewTab === 'main'
                            ? 'bg-background text-foreground font-semibold shadow-xs'
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
                            'px-2 py-0.5 rounded-sm font-medium transition-colors cursor-pointer',
                            previewTab === 'bib'
                              ? 'bg-background text-foreground font-semibold shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          references.bib
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isCopied ? <Check className="size-3.5 text-green-600 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                      {isCopied ? 'Copied' : 'Copy code'}
                    </Button>
                  </div>
                </div>

                {/* Code Body */}
                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre select-text bg-background/50">
                  {previewContent}
                </div>

                {/* Footer Action */}
                <div className="h-12 px-5 border-t border-border bg-background flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-muted-foreground">
                    Scaffolding creates all required template files in this project.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isScaffolding}
                      onClick={handleScaffold}
                      className="h-8 text-xs font-medium px-4 cursor-pointer gap-1.5"
                    >
                      {isScaffolding ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileCheck className="size-3.5" />
                      )}
                      <span>{isScaffolding ? 'Scaffolding...' : 'Scaffold Project'}</span>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                Select a template to view source code preview
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePickerDialog;
