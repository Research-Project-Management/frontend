'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Textarea,
} from '@/shared/components/ui';
import { Search, BookOpen, Check, Upload, Sparkles, Loader2, FileCode } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchCslStyles, useUploadCustomCslStyle } from '../../data';
import type { CslStyleMetadata } from '../../types/library.types';

export interface CslStyleSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStyle: (style: { id: string; label: string }) => void;
  currentStyleId?: string;
}

const POPULAR_QUICK_TAGS = [
  { id: 'nature', label: 'Nature' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'acm-siggraph', label: 'ACM' },
  { id: 'cell', label: 'Cell' },
  { id: 'the-lancet', label: 'The Lancet' },
  { id: 'pnas', label: 'PNAS' },
  { id: 'elsevier-harvard', label: 'Elsevier' },
  { id: 'springer-vancouver', label: 'Springer' },
];

export default function CslStyleSearchModal({
  open,
  onOpenChange,
  onSelectStyle,
  currentStyleId,
}: CslStyleSearchModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'custom'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [, startTransition] = useTransition();

  // Custom CSL State
  const [customTitle, setCustomTitle] = useState('');
  const [customXml, setCustomXml] = useState('');

  const { data: searchData, isLoading } = useSearchCslStyles(debouncedQuery, 40);
  const uploadCustomMutation = useUploadCustomCslStyle();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    startTransition(() => {
      setDebouncedQuery(val);
    });
  };

  const handleSelect = (item: CslStyleMetadata) => {
    const label = item.titleShort || item.title;
    onSelectStyle({ id: item.id, label });
    onOpenChange(false);
    toast.success(`Selected style: ${label}`);
  };

  const handleQuickTagClick = (tagId: string) => {
    setSearchQuery(tagId);
    setDebouncedQuery(tagId);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csl') && !file.name.endsWith('.xml')) {
      toast.error('Please upload a valid .csl or .xml stylesheet file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCustomXml(text);
        if (!customTitle) {
          const autoTitle = file.name.replace(/\.(csl|xml)$/i, '');
          setCustomTitle(autoTitle);
        }
        toast.success(`Loaded stylesheet from ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCustom = async () => {
    if (!customXml.trim()) {
      toast.error('Please provide CSL XML content');
      return;
    }

    try {
      const result = await uploadCustomMutation.mutateAsync({
        xml: customXml,
        title: customTitle.trim() || undefined,
      });

      onSelectStyle({ id: result.id, label: result.title });
      onOpenChange(false);
      toast.success(`Custom style installed: ${result.title}`);
      setCustomXml('');
      setCustomTitle('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to install custom CSL stylesheet');
    }
  };

  const styles = searchData?.styles || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-300">
        <DialogHeader className="px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <DialogTitle className="text-13 font-semibold text-foreground">
              Citation Style Repository
            </DialogTitle>
          </div>
          <DialogDescription className="text-11 text-muted-foreground mt-0.5">
            Search 10,000+ official international journal styles from CSL & Zotero or install custom stylesheets.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="px-4 pt-2.5 border-b border-border bg-background flex items-center justify-between">
            <TabsList className="bg-muted p-0.5 rounded-md border border-border">
              <TabsTrigger
                value="search"
                className="text-11 font-medium px-3 py-1 rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
              >
                Search Repository (10,000+)
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="text-11 font-medium px-3 py-1 rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs"
              >
                Custom CSL (Upload / Paste)
              </TabsTrigger>
            </TabsList>

            <span className="text-11 font-mono text-muted-foreground tabular-nums">
              {activeTab === 'search' && `${styles.length} styles available`}
            </span>
          </div>

          {/* TAB 1: SEARCH REPOSITORY */}
          <TabsContent value="search" className="m-0 p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground shrink-0 pointer-events-none" strokeWidth={1.5} />
              <Input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by journal name (e.g. Nature, ACM, Physical Review, Lancet)..."
                className="pl-8 h-8 text-13 bg-white dark:bg-card border-border rounded-md shadow-2xs font-normal text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {isLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin shrink-0" />
              )}
            </div>

            {/* Quick Filter Tags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-11 text-muted-foreground shrink-0">Popular:</span>
              {POPULAR_QUICK_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleQuickTagClick(tag.id)}
                  className="px-2 py-0.5 text-11 font-mono rounded-sm border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Styles Results List */}
            <div className="max-h-80 overflow-y-auto space-y-1 divide-y divide-border/40 border border-border rounded-md p-1 bg-background select-none">
              {isLoading && styles.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground text-12">
                  <Loader2 className="size-4 animate-spin text-foreground shrink-0" />
                  <span>Searching 10,000+ CSL styles catalog...</span>
                </div>
              ) : styles.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-12">
                  No citation styles found for &quot;{searchQuery}&quot;. You can install it under the Custom CSL tab.
                </div>
              ) : (
                styles.map((item) => {
                  const isSelected = currentStyleId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-muted text-foreground font-medium'
                          : 'hover:bg-muted/70 text-foreground'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-13 font-medium text-foreground truncate" title={item.title}>
                            {item.title}
                          </p>
                          {item.isCustom && (
                            <Badge variant="outline" className="text-10 px-1 py-0 border-border bg-muted/60 text-foreground shrink-0">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-11 text-muted-foreground font-mono truncate">
                          {item.id}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-10 font-mono px-1.5 py-0 border-border bg-muted text-muted-foreground shrink-0 capitalize"
                        >
                          {item.category}
                        </Badge>

                        {isSelected ? (
                          <span className="flex items-center gap-1 text-11 font-medium text-foreground">
                            <Check className="size-3.5 text-foreground shrink-0" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="h-7 px-2.5 text-11 font-medium rounded-md border border-border bg-background hover:bg-muted shadow-2xs text-foreground transition-colors cursor-pointer"
                          >
                            Use Style
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* TAB 2: CUSTOM CSL UPLOAD */}
          <TabsContent value="custom" className="m-0 p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-11 font-medium text-foreground">
                Style Title (Optional)
              </label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. My University PhD Thesis Style"
                className="h-8 text-13 bg-white dark:bg-card border-border rounded-md shadow-2xs text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-11 font-medium text-foreground flex items-center gap-1.5">
                  <FileCode className="size-3.5 text-foreground shrink-0" />
                  <span>CSL XML Content</span>
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1 text-11 font-medium text-foreground hover:underline">
                  <Upload className="size-3 shrink-0" />
                  <span>Upload .csl file</span>
                  <input
                    type="file"
                    accept=".csl,.xml"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <Textarea
                value={customXml}
                onChange={(e) => setCustomXml(e.target.value)}
                placeholder="Paste XML starting with <style xmlns=&quot;http://purl.org/net/xbiblio/csl&quot; ...>...</style>"
                className="font-mono text-11 h-44 resize-none bg-white dark:bg-card border-border rounded-md shadow-2xs text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 px-3 text-13 rounded-md border-border bg-background shadow-2xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveCustom}
                disabled={uploadCustomMutation.isPending || !customXml.trim()}
                className="h-8 px-3 text-13 rounded-md bg-foreground text-background hover:bg-foreground/90 font-medium inline-flex items-center gap-1.5"
              >
                {uploadCustomMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="size-3.5 shrink-0" />
                )}
                <span>Install &amp; Select Style</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
