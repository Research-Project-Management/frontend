'use client';

import React, { useState } from 'react';
import {
  Link2,
  Globe,
  Search,
  Loader2,
  Check,
  BookOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import {
  fetchReferenceByDoi,
  resolveAcademicQuery,
} from '@/features/workspaces/library/services/reference.service';
import { extractDoiFromText } from '@/features/workspaces/library/utils/library.util';

export interface AddLinkData {
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  journal?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  issn?: string;
  isbn?: string;
  pmid?: string;
  pmcid?: string;
  arxivId?: string;
  url?: string;
  type?: string;
  itemType?: string;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  citationKey?: string;
  editors?: string[];
  keywords?: string[];
  extra?: string;
}

interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddLinkData) => Promise<any> | void;
  isPending?: boolean;
}

export default function AddLinkModal({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: AddLinkModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // Metadata fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [journal, setJournal] = useState('');
  const [publisher, setPublisher] = useState('');
  const [abstract, setAbstract] = useState('');
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pages, setPages] = useState('');
  const [itemType, setItemType] = useState('journalArticle');

  const [resolvedMeta, setResolvedMeta] = useState<any>(null);

  const reset = () => {
    setUrlInput('');
    setIsResolving(false);
    setResolvedMeta(null);
    setTitle('');
    setAuthors('');
    setYear('');
    setDoi('');
    setJournal('');
    setPublisher('');
    setAbstract('');
    setVolume('');
    setIssue('');
    setPages('');
    setItemType('journalArticle');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleResolve = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      toast.error('Please enter a link URL, DOI, arXiv ID, or PMID');
      return;
    }

    setIsResolving(true);
    try {
      // 1. Try unified resolver (CrossRef, Semantic Scholar, arXiv, PubMed)
      const res = await resolveAcademicQuery(trimmed);
      if (res && res.metadata && res.metadata.title) {
        const meta = res.metadata;
        setResolvedMeta(meta);
        setTitle(meta.title);
        if (meta.authors?.length) setAuthors(meta.authors.join(', '));
        if (meta.year) setYear(String(meta.year));
        if (meta.journal || meta.publicationTitle)
          setJournal(meta.journal || meta.publicationTitle || '');
        if (meta.publisher) setPublisher(meta.publisher);
        if (meta.abstract) setAbstract(meta.abstract);
        if (meta.doi) setDoi(meta.doi);
        if (meta.volume) setVolume(meta.volume);
        if (meta.issue) setIssue(meta.issue);
        if (meta.pages) setPages(meta.pages);
        if (meta.itemType || meta.type)
          setItemType(meta.itemType || meta.type || 'journalArticle');
        toast.success(`Metadata resolved via ${res.provider} (${res.queryType})!`);
        return;
      }

      // 2. Fallback to direct DOI lookup
      const extractedDoi = extractDoiFromText(trimmed) || (trimmed.startsWith('10.') ? trimmed : '');
      if (extractedDoi) {
        const meta = await fetchReferenceByDoi(extractedDoi);
        if (meta) {
          setResolvedMeta(meta);
          if (meta.title) setTitle(meta.title);
          if (meta.authors?.length) setAuthors(meta.authors.join(', '));
          if (meta.year) setYear(String(meta.year));
          if (meta.journal || meta.publicationTitle)
            setJournal(meta.journal || meta.publicationTitle || '');
          if (meta.publisher) setPublisher(meta.publisher);
          if (meta.abstract) setAbstract(meta.abstract);
          setDoi(meta.doi || extractedDoi);
          if (meta.volume) setVolume(meta.volume);
          if (meta.issue) setIssue(meta.issue);
          if (meta.pages) setPages(meta.pages);
          if (meta.itemType || meta.type)
            setItemType(meta.itemType || meta.type || 'journalArticle');
          toast.success('Metadata resolved from CrossRef!');
          return;
        }
      }

      // 3. Fallback: Parse URL filename
      const filename = trimmed.split('/').pop()?.split('?')[0] || '';
      if (filename && !title) {
        setTitle(decodeURIComponent(filename).replace(/\.[^/.]+$/, ''));
      }
      toast.info('Link accepted. Please review details.');
    } catch (err) {
      console.warn('Link resolve error:', err);
      toast.error('Could not fetch metadata for this link. You can enter details manually.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedUrl = urlInput.trim();
    if (!title.trim() || !trimmedUrl) return;

    const derivedName = trimmedUrl.split('/').pop()?.split('?')[0] || 'linked-document.pdf';
    const finalFilename = derivedName.endsWith('.pdf') ? derivedName : `${derivedName}.pdf`;
    const resolved = resolvedMeta || {};

    await onSubmit({
      title: title.trim() || resolved.title,
      authors: authors
        ? authors.split(',').map((a) => a.trim()).filter(Boolean)
        : (resolved.authors || []),
      year: year ? parseInt(year, 10) : (resolved.year ? Number(resolved.year) : null),
      doi: doi.trim() || resolved.doi || '',
      abstract: abstract.trim() || resolved.abstract || '',
      fileUrl: trimmedUrl,
      filename: finalFilename,
      mimeType: 'application/pdf',
      size: 0,
      journal: journal.trim() || resolved.journal || resolved.publicationTitle || undefined,
      publicationTitle: resolved.publicationTitle || journal.trim() || undefined,
      publisher: publisher.trim() || resolved.publisher || undefined,
      volume: volume.trim() || resolved.volume || undefined,
      issue: issue.trim() || resolved.issue || undefined,
      pages: pages.trim() || resolved.pages || undefined,
      url: trimmedUrl,
      type: itemType || resolved.itemType || resolved.type || 'journalArticle',
      itemType: itemType || resolved.itemType || resolved.type || 'journalArticle',
      issn: resolved.issn || undefined,
      isbn: resolved.isbn || undefined,
      pmid: resolved.pmid || undefined,
      pmcid: resolved.pmcid || undefined,
      arxivId: resolved.arxivId || undefined,
      keywords: resolved.keywords || resolved.keywordsList || (resolved.tags ? resolved.tags : undefined),
      publicationDate: resolved.publicationDate || resolved.date || undefined,
      journalAbbr: resolved.journalAbbr || resolved.journalAbbreviation || undefined,
      shortTitle: resolved.shortTitle || undefined,
      language: resolved.language || undefined,
      rights: resolved.rights || resolved.copyright || undefined,
      license: resolved.license || undefined,
      citationKey: resolved.citationKey || undefined,
      editors: resolved.editors || undefined,
      place: resolved.place || undefined,
      series: resolved.series || undefined,
      seriesTitle: resolved.seriesTitle || undefined,
      seriesText: resolved.seriesText || undefined,
    });

    reset();
    onOpenChange(false);
  };

  const canSubmit = Boolean(title.trim()) && Boolean(urlInput.trim()) && !isPending && !isResolving;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border bg-muted/20">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Add Link to File / Identifier
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4 text-xs">
          {/* URL / Identifier Input Bar */}
          <div className="space-y-2 p-3 bg-muted/20 border border-border/50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Document URL or Academic Identifier *
              </Label>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">DOI</Badge>
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">arXiv</Badge>
                <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">PMID</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. https://arxiv.org/pdf/... or 10.1145/... or arXiv:1706.03762"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
                  className="pl-8 text-xs font-mono"
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleResolve}
                disabled={!urlInput.trim() || isResolving}
                className="h-9 px-3 text-xs gap-1.5 cursor-pointer shrink-0"
              >
                {isResolving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                <span>Lookup</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste a direct PDF link, arXiv URL, DOI, or PubMed ID to automatically fetch metadata.
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Paper title"
                className="h-8 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Authors (comma separated)</Label>
              <Input
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="e.g. John Doe, Jane Smith"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Publication / Venue</Label>
                <Input
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  placeholder="e.g. NeurIPS / Nature"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Year</Label>
                <Input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2024"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Publisher</Label>
                <Input
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="e.g. IEEE / Springer"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">DOI</Label>
                <Input
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.xxxx/..."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold">Abstract</Label>
              <Textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={3}
                placeholder="Paper abstract or summary..."
                className="text-xs leading-relaxed"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t border-border bg-muted/20 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-8 text-xs cursor-pointer gap-1.5"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            <span>Add to Library</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
