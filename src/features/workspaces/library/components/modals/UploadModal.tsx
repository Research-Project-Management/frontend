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
import { useResolveIdentifier } from '@/features/workspaces/library/hooks/use-ingest';
import { toast } from 'sonner';
import { Badge } from '@/shared/components/ui/badge';

export interface PaperUploadData {
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  fileId?: string;
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
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const { uploadFileDetailed, isUploading: uploading, clearAll: resetUpload } = useUpload();

  // Folder upload state
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState('');
  const [isFolderUploading, setIsFolderUploading] = useState(false);
  const [folderProgress, setFolderProgress] = useState({ current: 0, total: 0 });

  // Identifier / Link state
  const [identifierInput, setIdentifierInput] = useState('');
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

  const { resolve, resolveDoi, isResolving } = useResolveIdentifier(workspaceId);

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
    setUploadedFileId(null);
    setFolderFiles([]);
    setFolderName('');
    setIsFolderUploading(false);
    setFolderProgress({ current: 0, total: 0 });
    setIdentifierInput('');
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
  const handleResolveIdentifier = async (customInput?: string) => {
    const trimmed = (customInput ?? identifierInput).trim();
    if (!trimmed) return null;

    try {
      const res = await resolve({ query: trimmed });
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
        return meta;
      } else {
        // Fallback to DOI
        const extractedDoi = extractDoiFromText(trimmed) || (trimmed.startsWith('10.') ? trimmed : '');
        if (extractedDoi) {
          const meta = await resolveDoi({ doi: extractedDoi });
          if (meta) {
            setResolvedMeta(meta);
            if (meta.title) setTitle(meta.title);
            if (meta.authors?.length) setAuthors(meta.authors.join(', '));
            if (meta.year) setYear(String(meta.year));
            if (meta.journal) setJournal(meta.journal);
            if (meta.doi) setDoi(meta.doi || extractedDoi);
            if (meta.abstract) setAbstract(meta.abstract);
            return meta;
          }
        }
      }
    } catch {
      // Handled by resolve / resolveDoi mutation hooks
    }
    return null;
  };

  // 2. Single File Upload
  const handleFileSelected = async (f: File) => {
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ''));

    const uploadPromise = (async () => {
      try {
        const { url: resultUrl, fileId } = await uploadFileDetailed(f, {
          prefix: `${workspaceId}/library`,
          allowedTypes: ['application/pdf'],
        });
        setUploadedUrl(resultUrl);
        setUploadedFileId(fileId || null);
      } catch (e: any) {
        console.error('Upload error', e);
        toast.error(e?.message || 'Failed to upload file to storage', { id: 'upload-progress' });
        setFile(null);
        setUploadedUrl(null);
        setUploadedFileId(null);
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
    let resolved = resolvedMeta || {};
    let currentTitle = title.trim();

    if (mode === 'identifier' && !currentTitle && identifierInput.trim()) {
      const meta = await handleResolveIdentifier();
      if (meta && meta.title) {
        resolved = meta;
        currentTitle = meta.title;
      }
    }

    if (mode !== 'folder' && !currentTitle) return;

    if (mode === 'identifier') {
      await onSubmit({
        ...resolved,
        title: currentTitle || resolved.title,
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
        ...resolved,
        title: title.trim() || resolved.title,
        authors: authors
          ? authors.split(',').map((a) => a.trim()).filter(Boolean)
          : (resolved.authors || []),
        year: year ? parseInt(year, 10) : (resolved.year ? Number(resolved.year) : null),
        doi: doi.trim() || resolved.doi || '',
        abstract: abstract.trim() || resolved.abstract || '',
        fileId: uploadedFileId || undefined,
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
      const loadingToastId = 'upload-progress';
      toast.loading(
        `Batch importing ${folderFiles.length} files from "${folderName || 'Folder'}"...`,
        { id: loadingToastId },
      );
      let successCount = 0;

      for (let i = 0; i < folderFiles.length; i++) {
        const f = folderFiles[i];
        setFolderProgress({ current: i + 1, total: folderFiles.length });
        try {
          const { url: fileStorageUrl, fileId: folderFileId } = await uploadFileDetailed(f, {
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
            fileId: folderFileId || undefined,
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
            silent: true,
          } as any);

          successCount++;
        } catch (err) {
          console.error(`Failed to upload ${f.name}:`, err);
        }
      }

      setIsFolderUploading(false);
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} papers from folder!`, { id: loadingToastId });
      } else {
        toast.error('Failed to import documents from folder.', { id: loadingToastId });
      }
      reset();
      onOpenChange(false);
    }
  };

  const canSubmit =
    mode === 'identifier'
      ? (Boolean(title.trim()) || Boolean(identifierInput.trim())) && !isPending && !isResolving
      : mode === 'file'
      ? Boolean(uploadedUrl) && Boolean(title.trim()) && !uploading && !isPending
      : folderFiles.length > 0 && !isFolderUploading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border border-border/60 shadow-none rounded-md">
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20">
          <DialogTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
            <BookOpen className="size-4 text-foreground" />
            Add Item to Library
          </DialogTitle>
        </DialogHeader>

        {/* 3 Clean Modes: Magic Wand (Identifier) | File (PDF) | Folder (Batch) */}
        <div className="p-4 space-y-4">
          <div className="flex items-center p-0.5 bg-muted/50 rounded-md border border-border/60 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('identifier')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm font-medium transition-colors cursor-pointer',
                mode === 'identifier'
                  ? 'bg-background text-foreground shadow-none font-medium'
                  : 'text-muted-foreground hover:bg-muted/40',
              )}
            >
              <Wand2 className="size-3.5 text-foreground" />
              <span>By Identifier</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('file')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm font-medium transition-colors cursor-pointer',
                mode === 'file'
                  ? 'bg-background text-foreground shadow-none font-medium'
                  : 'text-muted-foreground hover:bg-muted/40',
              )}
            >
              <FileText className="size-3.5 text-foreground" />
              <span>Upload PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('folder')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm font-medium transition-colors cursor-pointer',
                mode === 'folder'
                  ? 'bg-background text-foreground shadow-none font-medium'
                  : 'text-muted-foreground hover:bg-muted/40',
              )}
            >
              <FolderUp className="size-3.5 text-foreground" />
              <span>Upload Folder</span>
            </button>
          </div>

          {/* Mode 1: Magic Wand / Identifier (Reference Manager Style) */}
          {mode === 'identifier' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Identifier (DOI / arXiv / PubMed / ISBN / URL)
                  </Label>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5 rounded-sm">DOI</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5 rounded-sm">arXiv</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5 rounded-sm">PMID</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5 rounded-sm">ISBN</Badge>
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-4.5 rounded-sm">URL</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste DOI, URL (Nature, arXiv, Science, ACM...), PMID, or ISBN..."
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResolveIdentifier()}
                    className="text-xs font-mono rounded-md border-border/60"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleResolveIdentifier()}
                    disabled={!identifierInput.trim() || isResolving}
                    className="h-9 px-3 text-xs gap-1.5 cursor-pointer shrink-0 rounded-md border-border/60"
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
                <div className="p-3 bg-muted/30 rounded-md border border-border/60 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-foreground text-xs leading-snug">
                      {title}
                    </h4>
                    {(doi || resolvedMeta?.arxivId || resolvedMeta?.pmid || resolvedMeta?.pmcid || resolvedMeta?.isbn) && (
                      <Badge variant="outline" className="text-xs font-mono shrink-0 rounded-sm">
                        {doi ? `DOI: ${doi}` : resolvedMeta?.arxivId ? `arXiv:${resolvedMeta.arxivId}` : resolvedMeta?.pmid ? `PMID:${resolvedMeta.pmid}` : resolvedMeta?.pmcid ? `PMC:${resolvedMeta.pmcid}` : `ISBN:${resolvedMeta.isbn}`}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{authors || 'Unknown Authors'}</span>
                    {year && <span>• ({year})</span>}
                    {journal && <span>• {journal}</span>}
                    {resolvedMeta?.citationCount !== undefined && resolvedMeta?.citationCount !== null && (
                      <span>• {Number(resolvedMeta.citationCount).toLocaleString()} citations</span>
                    )}
                  </div>
                  {abstract && (
                    <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
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
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:underline font-medium cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  <span>{showAdvanced ? 'Hide metadata fields' : 'Edit details before adding'}</span>
                </button>

                {showAdvanced && (
                  <div className="mt-2 space-y-2.5 p-3 rounded-md bg-card border border-border/60 text-xs animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <Label htmlFor="item-title" className="text-xs">Title</Label>
                      <Input
                        id="item-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-7 text-xs rounded-sm border-border/60"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="item-authors" className="text-xs">Authors (comma separated)</Label>
                      <Input
                        id="item-authors"
                        value={authors}
                        onChange={(e) => setAuthors(e.target.value)}
                        className="h-7 text-xs rounded-sm border-border/60"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="item-journal" className="text-xs">Journal</Label>
                        <Input
                          id="item-journal"
                          value={journal}
                          onChange={(e) => setJournal(e.target.value)}
                          className="h-7 text-xs rounded-sm border-border/60"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="item-year" className="text-xs">Year</Label>
                        <Input
                          id="item-year"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          className="h-7 text-xs font-mono rounded-sm border-border/60"
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
                    'flex flex-col items-center justify-center gap-2.5 rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer',
                    dragOver
                      ? 'border-border bg-muted/40'
                      : 'border-border/60 hover:border-border hover:bg-muted/30',
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
                  <div className="size-10 rounded-full bg-muted text-foreground border border-border flex items-center justify-center">
                    <Upload className="size-5 text-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">
                      Click or drag PDF document here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                  <div className="flex items-center gap-2.5 rounded-md border border-border bg-accent/30 p-2.5">
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
                    ) : (
                      <FileText className="size-5 text-foreground shrink-0" />
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
                      className="p-1 rounded-sm text-foreground hover:bg-muted cursor-pointer"
                    >
                      <X className="size-3.5 text-foreground" />
                    </button>
                  </div>

                  {extractStatus === 'extracting' && (
                    <div className="flex items-center gap-1.5 text-xs text-foreground bg-muted/60 border border-border/60 p-2 rounded-md">
                      <Sparkles className="size-3.5 animate-pulse text-foreground" />
                      <span>Extracting PDF metadata...</span>
                    </div>
                  )}

                  {title && (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="space-y-1">
                        <Label htmlFor="item-title" className="text-xs">Title *</Label>
                        <Input
                          id="item-title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="h-8 text-xs rounded-sm border-border/60"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="item-authors" className="text-xs">Authors</Label>
                        <Input
                          id="item-authors"
                          value={authors}
                          onChange={(e) => setAuthors(e.target.value)}
                          className="h-8 text-xs rounded-sm border-border/60"
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
                  className="flex flex-col items-center justify-center gap-2.5 rounded-md border-2 border-dashed p-6 border-border/60 hover:border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <FolderUp className="size-8 text-foreground" />
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">
                      Select a folder containing PDFs
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                        toast.error('No PDF files found in selected folder.', { id: 'upload-folder' });
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{folderFiles.length} PDF files ready</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFolderFiles([])}
                      className="h-6 text-xs cursor-pointer rounded-sm"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-border/60 rounded-md divide-y divide-border/30 text-xs">
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

        <DialogFooter className="p-3 border-t border-border/60 bg-muted/20 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-8 text-xs cursor-pointer rounded-md border-border/60"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-8 text-xs cursor-pointer gap-1.5 rounded-md"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            <span>Add to Library</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


