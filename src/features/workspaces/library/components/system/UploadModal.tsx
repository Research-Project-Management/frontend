'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  FileText,
  Loader2,
  Sparkles,
  Check,
  Link2,
  Globe,
  Search,
  FolderUp,
  Wand2,
  ChevronDown,
  ChevronUp,
  FileCode,
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
import { cn } from '@/shared/lib/utils';
import { useUpload } from '@/shared/hooks/use-upload';
import {
  extractMetadata,
  extractDoiFromText,
} from '@/features/workspaces/library/utils/library.util';
import {
  fetchReferenceByDoi,
  resolveAcademicQuery,
} from '@/features/workspaces/library/services/reference.service';
import { toast } from 'sonner';
import { Badge } from '@/shared/components/ui/badge';

export interface PaperUploadData {
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
  keywords?: string[];
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
  extra?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PaperUploadData) => void;
  isPending?: boolean;
  workspaceId: string;
  initialMode?: 'identifier' | 'file' | 'folder' | 'link';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ExtractStatus = 'idle' | 'extracting' | 'done' | 'failed';

export default function PaperUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  workspaceId,
  initialMode = 'identifier',
}: Props) {
  const [mode, setMode] = useState<'identifier' | 'file' | 'folder'>('identifier');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // File upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const { uploadFile, isUploading: uploading, clearAll: resetUpload } = useUpload();

  // Folder upload state
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState('');
  const [isFolderUploading, setIsFolderUploading] = useState(false);
  const [folderProgress, setFolderProgress] = useState({ current: 0, total: 0 });

  // Identifier / Link state
  const [identifierInput, setIdentifierInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedMeta, setResolvedMeta] = useState<any | null>(null);

  // Metadata form fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [abstract, setAbstract] = useState('');
  const [journal, setJournal] = useState('');
  const [publisher, setPublisher] = useState('');
  const [keywords, setKeywords] = useState('');
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pages, setPages] = useState('');
  const [url, setUrl] = useState('');
  const [itemType, setItemType] = useState('journalArticle');

  const [dragOver, setDragOver] = useState(false);
  const [extractStatus, setExtractStatus] = useState<ExtractStatus>('idle');

  useEffect(() => {
    if (open) {
      if (initialMode === 'link') {
        setMode('identifier');
      } else {
        setMode(initialMode || 'identifier');
      }
    }
  }, [open, initialMode]);

  const reset = () => {
    setFile(null);
    setUploadedUrl(null);
    setFolderFiles([]);
    setFolderName('');
    setIsFolderUploading(false);
    setFolderProgress({ current: 0, total: 0 });
    setIdentifierInput('');
    setIsResolving(false);
    setResolvedMeta(null);
    setShowAdvanced(false);
    resetUpload();
    setTitle('');
    setAuthors('');
    setYear('');
    setDoi('');
    setAbstract('');
    setJournal('');
    setPublisher('');
    setKeywords('');
    setVolume('');
    setIssue('');
    setPages('');
    setUrl('');
    setItemType('journalArticle');
    setDragOver(false);
    setExtractStatus('idle');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // 1. Magic Wand / Identifier Resolution
  const handleResolveIdentifier = async () => {
    const trimmed = identifierInput.trim();
    if (!trimmed) {
      toast.error('Please enter a DOI, arXiv ID, or PubMed PMID');
      return;
    }

    setIsResolving(true);
    try {
      const res = await resolveAcademicQuery(trimmed);
      if (res && res.metadata && res.metadata.title) {
        const meta = res.metadata;
        setResolvedMeta(meta);
        setTitle(meta.title);
        if (meta.authors?.length) setAuthors(meta.authors.join(', '));
        if (meta.year) setYear(String(meta.year));
        if (meta.journal) setJournal(meta.journal);
        if (meta.publisher) setPublisher(meta.publisher);
        if (meta.abstract) setAbstract(meta.abstract);
        if (meta.doi) setDoi(meta.doi);
        if (meta.url) setUrl(meta.url);
        if (meta.volume) setVolume(meta.volume);
        if (meta.issue) setIssue(meta.issue);
        if (meta.pages) setPages(meta.pages);
        if (meta.itemType) setItemType(meta.itemType);
        toast.success(`Metadata resolved via ${res.provider} (${res.queryType})!`);
      } else {
        // Fallback to DOI
        const extractedDoi = extractDoiFromText(trimmed) || (trimmed.startsWith('10.') ? trimmed : '');
        if (extractedDoi) {
          const meta = await fetchReferenceByDoi(extractedDoi);
          if (meta) {
            setResolvedMeta(meta);
            if (meta.title) setTitle(meta.title);
            if (meta.authors?.length) setAuthors(meta.authors.join(', '));
            if (meta.year) setYear(String(meta.year));
            if (meta.journal) setJournal(meta.journal);
            if (meta.doi) setDoi(meta.doi || extractedDoi);
            if (meta.abstract) setAbstract(meta.abstract);
            toast.success('Metadata resolved from CrossRef!');
            return;
          }
        }
        toast.error('Could not find metadata for this identifier.');
      }
    } catch (err) {
      console.warn('Resolve error:', err);
      toast.error('Could not resolve identifier. You can add details manually.');
    } finally {
      setIsResolving(false);
    }
  };

  // 2. Single File Upload
  const handleFileSelected = async (f: File) => {
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ''));

    const uploadPromise = (async () => {
      try {
        const resultUrl = await uploadFile(f, {
          prefix: `${workspaceId}/library`,
          allowedTypes: ['application/pdf'],
        });
        setUploadedUrl(resultUrl);
      } catch (e: any) {
        console.error('Upload error', e);
        toast.error(e?.message || 'Failed to upload file to storage');
        setFile(null);
        setUploadedUrl(null);
      }
    })();

    const extractPromise = (async () => {
      const isPdf =
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) return;

      try {
        setExtractStatus('extracting');
        const meta = await extractMetadata(f);
        setResolvedMeta(meta);
        if (meta.title) setTitle(meta.title);
        if (meta.authors && meta.authors.length > 0)
          setAuthors(meta.authors.join(', '));
        if (meta.year) setYear(String(meta.year));
        if (meta.doi) setDoi(meta.doi);
        if (meta.abstract) setAbstract(meta.abstract);
        if (meta.journal || meta.publicationTitle)
          setJournal(meta.journal || meta.publicationTitle || '');
        if (meta.publisher) setPublisher(meta.publisher);
        if (meta.volume) setVolume(meta.volume);
        if (meta.issue) setIssue(meta.issue);
        if (meta.pages) setPages(meta.pages);
        if (meta.itemType || meta.type)
          setItemType(meta.itemType || meta.type || 'journalArticle');
        setExtractStatus('done');
      } catch (err) {
        console.warn('PDF metadata extraction warning:', err);
        setExtractStatus('failed');
      }
    })();

    await Promise.all([uploadPromise, extractPromise]);
  };

  // 3. Submit handler
  const handleSubmit = async () => {
    if (mode !== 'folder' && !title.trim()) return;
    const resolved = resolvedMeta || {};

    if (mode === 'identifier') {
      await onSubmit({
        title: title.trim() || resolved.title,
        authors: authors
          ? authors.split(',').map((a) => a.trim()).filter(Boolean)
          : (resolved.authors || []),
        year: year ? parseInt(year, 10) : (resolved.year ? Number(resolved.year) : null),
        doi: doi.trim() || resolved.doi || '',
        abstract: abstract.trim() || resolved.abstract || '',
        fileUrl: url.trim() || resolved.url || '',
        filename: `${title.trim().slice(0, 30)}.pdf`,
        mimeType: 'application/pdf',
        size: 0,
        journal: journal.trim() || resolved.journal || resolved.publicationTitle || undefined,
        publicationTitle: resolved.publicationTitle || journal.trim() || undefined,
        publisher: publisher.trim() || resolved.publisher || undefined,
        volume: volume.trim() || resolved.volume || undefined,
        issue: issue.trim() || resolved.issue || undefined,
        pages: pages.trim() || resolved.pages || undefined,
        url: url.trim() || resolved.url || undefined,
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
    } else if (mode === 'file') {
      if (!uploadedUrl || !file) return;
      await onSubmit({
        title: title.trim() || resolved.title,
        authors: authors
          ? authors.split(',').map((a) => a.trim()).filter(Boolean)
          : (resolved.authors || []),
        year: year ? parseInt(year, 10) : (resolved.year ? Number(resolved.year) : null),
        doi: doi.trim() || resolved.doi || '',
        abstract: abstract.trim() || resolved.abstract || '',
        fileUrl: uploadedUrl,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        journal: journal.trim() || resolved.journal || resolved.publicationTitle || undefined,
        publicationTitle: resolved.publicationTitle || journal.trim() || undefined,
        publisher: publisher.trim() || resolved.publisher || undefined,
        volume: volume.trim() || resolved.volume || undefined,
        issue: issue.trim() || resolved.issue || undefined,
        pages: pages.trim() || resolved.pages || undefined,
        url: url.trim() || resolved.url || undefined,
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
    } else if (mode === 'folder') {
      if (!folderFiles.length) return;
      setIsFolderUploading(true);
      const loadingToastId = toast.loading(
        `Batch importing ${folderFiles.length} files from "${folderName || 'Folder'}"...`,
      );
      let successCount = 0;

      for (let i = 0; i < folderFiles.length; i++) {
        const f = folderFiles[i];
        setFolderProgress({ current: i + 1, total: folderFiles.length });
        try {
          const fileStorageUrl = await uploadFile(f, {
            prefix: `${workspaceId}/library`,
            allowedTypes: ['application/pdf'],
          });

          let extractedTitle = f.name.replace(/\.[^/.]+$/, '');
          let extractedAuthors: string[] = [];
          let extractedYear: number | null = null;
          let extractedDoi = '';
          let extractedAbstract = '';
          let extractedJournal = '';
          let extractedPublisher = '';
          let extractedVolume = '';
          let extractedIssue = '';
          let extractedPages = '';
          let extractedUrl = '';
          let extractedType = 'journalArticle';

          try {
            const extracted = await extractMetadata(f);
            if (extracted.title) extractedTitle = extracted.title;
            if (extracted.authors && extracted.authors.length > 0)
              extractedAuthors = extracted.authors;
            if (extracted.year)
              extractedYear = parseInt(String(extracted.year), 10) || null;
            if (extracted.doi) extractedDoi = extracted.doi;
            if (extracted.abstract) extractedAbstract = extracted.abstract;
            if (extracted.journal || extracted.publicationTitle)
              extractedJournal = extracted.journal || extracted.publicationTitle || '';
            if (extracted.publisher) extractedPublisher = extracted.publisher;
            if (extracted.volume) extractedVolume = extracted.volume;
            if (extracted.issue) extractedIssue = extracted.issue;
            if (extracted.pages) extractedPages = extracted.pages;
            if (extracted.url) extractedUrl = extracted.url;
            if (extracted.itemType || extracted.type)
              extractedType = extracted.itemType || extracted.type || 'journalArticle';
          } catch {
            // Keep default extracted from filename
          }

          await onSubmit({
            title: extractedTitle,
            authors: extractedAuthors,
            year: extractedYear,
            doi: extractedDoi,
            abstract: extractedAbstract,
            fileUrl: fileStorageUrl,
            filename: f.name,
            mimeType: f.type || 'application/pdf',
            size: f.size,
            journal: extractedJournal || undefined,
            publisher: extractedPublisher || undefined,
            volume: extractedVolume || undefined,
            issue: extractedIssue || undefined,
            pages: extractedPages || undefined,
            url: extractedUrl || undefined,
            type: extractedType || undefined,
          });

          successCount++;
        } catch (err) {
          console.error(`Failed to upload ${f.name}:`, err);
        }
      }

      toast.dismiss(loadingToastId);
      setIsFolderUploading(false);
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} papers from folder!`);
      } else {
        toast.error('Failed to import documents from folder.');
      }
      reset();
      onOpenChange(false);
    }
  };

  const canSubmit =
    mode === 'identifier'
      ? Boolean(title.trim()) && !isPending && !isResolving
      : mode === 'file'
      ? Boolean(uploadedUrl) && Boolean(title.trim()) && !uploading && !isPending
      : folderFiles.length > 0 && !isFolderUploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border bg-muted/20">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            Add Paper to Library
          </DialogTitle>
        </DialogHeader>

        {/* 3 Clean Modes: Magic Wand (Identifier) | File (PDF) | Folder (Batch) */}
        <div className="p-4 space-y-4">
          <div className="flex items-center p-0.5 bg-muted/50 rounded-lg border border-border/50 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('identifier')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer',
                mode === 'identifier'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Wand2 className="size-3.5 text-primary" />
              <span>By Identifier</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer',
                mode === 'file'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FileText className="size-3.5" />
              <span>Upload PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('folder')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer',
                mode === 'folder'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FolderUp className="size-3.5" />
              <span>Upload Folder</span>
            </button>
          </div>

          {/* Mode 1: Magic Wand / Identifier (Reference Manager Style) */}
          {mode === 'identifier' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Identifier (DOI / arXiv / PubMed)
                  </Label>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5">DOI</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5">arXiv</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5">PMID</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 10.1145/... or arXiv:1706.03762 or PMID:31234567"
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResolveIdentifier()}
                    className="text-xs font-mono"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResolveIdentifier}
                    disabled={!identifierInput.trim() || isResolving}
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
              </div>

              {/* Resolved Preview Card */}
              {title && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/60 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-foreground text-xs leading-snug">
                      {title}
                    </h4>
                    {doi && (
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {doi}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{authors || 'Unknown Authors'}</span>
                    {year && <span>• ({year})</span>}
                    {journal && <span>• {journal}</span>}
                  </div>
                  {abstract && (
                    <p className="text-[11px] text-foreground/80 line-clamp-3 leading-relaxed">
                      {abstract}
                    </p>
                  )}
                </div>
              )}

              {/* Collapsible Advanced Edit */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  <span>{showAdvanced ? 'Hide metadata fields' : 'Edit details before adding'}</span>
                </button>

                {showAdvanced && (
                  <div className="mt-2 space-y-2.5 p-3 rounded-lg bg-card border border-border/50 text-xs animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Title</Label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Authors (comma separated)</Label>
                      <Input
                        value={authors}
                        onChange={(e) => setAuthors(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Journal</Label>
                        <Input
                          value={journal}
                          onChange={(e) => setJournal(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Year</Label>
                        <Input
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode 2: PDF File Upload */}
          {mode === 'file' && (
            <div className="space-y-3">
              {!file ? (
                <div
                  className={cn(
                    'flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-accent/30',
                  )}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) handleFileSelected(dropped);
                  }}
                >
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="size-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">
                      Click or drag PDF document here
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Metadata will be extracted automatically
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelected(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-accent/30 p-2.5">
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                    ) : (
                      <FileText className="size-5 text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {uploading ? 'Uploading...' : `${formatBytes(file.size)} • PDF`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        resetUpload();
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {extractStatus === 'extracting' && (
                    <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 p-2 rounded-md">
                      <Sparkles className="size-3.5 animate-pulse" />
                      <span>Extracting PDF metadata...</span>
                    </div>
                  )}

                  {title && (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Title *</Label>
                        <Input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Authors</Label>
                        <Input
                          value={authors}
                          onChange={(e) => setAuthors(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Folder Upload */}
          {mode === 'folder' && (
            <div className="space-y-3">
              {folderFiles.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed p-6 border-border hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp className="size-8 text-primary/70" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">
                      Select a folder containing PDFs
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Batch imports all academic PDF files inside
                    </p>
                  </div>
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const fileList = Array.from(e.target.files || []).filter(
                        (f) => f.name.toLowerCase().endsWith('.pdf'),
                      );
                      if (fileList.length > 0) {
                        setFolderFiles(fileList);
                        setFolderName(fileList[0].webkitRelativePath?.split('/')[0] || 'Selected Folder');
                      } else {
                        toast.error('No PDF files found in selected folder.');
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{folderFiles.length} PDF files ready</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFolderFiles([])}
                      className="h-6 text-xs cursor-pointer"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-border/50 rounded-md divide-y divide-border/30 text-xs">
                    {folderFiles.slice(0, 10).map((f, i) => (
                      <div key={i} className="px-2.5 py-1.5 flex items-center justify-between">
                        <span className="truncate max-w-64">{f.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
