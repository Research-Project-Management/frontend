'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FolderOpen,
  ExternalLink,
  RefreshCcw,
  Loader2,
  Edit3,
  X,
  Check,
  Trash2,
  Plus,
  Calendar,
  FileText,
  FileJson,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Input, Textarea } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { API_BASE_URL } from '@/shared/constants';
import { usePapers } from '../../../hooks/data/use-papers';
import { useReferences } from '../../../hooks/data/use-references';
import type { Paper, Collection, Note } from '../../../types/library.types';
import {
  paperFormSchema,
  type PaperFormValues,
} from '../../../schemas/library.schema';
import BibtexModal from '../../reader/modals/bibtex-modal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNoteDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getPaperDefaultValues(p: Paper): PaperFormValues {
  return {
    title: p.title || '',
    authors: p.authors?.join(', ') || '',
    year: p.year ? String(p.year) : '',
    doi: p.doi || '',
    journal: p.journal || '',
    publisher: p.publisher || '',
    keywords: p.keywords?.join(', ') || '',
    abstract: p.abstract || '',
    volume: p.volume || '',
    issue: p.issue || '',
    pages: p.pages || '',
    issn: p.issn || '',
    isbn: p.isbn || '',
    url: p.url || '',
    type: p.type || '',
    language: p.language || '',
    journalAbbr: p.journalAbbr || '',
    shortTitle: p.shortTitle || '',
    rights: p.rights || '',
    extra: p.extra || '',
  };
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div className={cn('flex items-start py-1 text-xs border-b border-border/5 last:border-0', className)}>
      <span className="w-24 shrink-0 font-bold text-[10px] uppercase text-muted-foreground pt-0.5 select-none text-left pr-2">
        {label}
      </span>
      <div className="flex-1 text-foreground/90 break-all leading-normal min-w-0 font-normal">
        {children}
      </div>
    </div>
  );
}

function EditRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center py-1 text-xs border-b border-border/5 last:border-0', className)}>
      <span className="w-24 shrink-0 font-bold text-[10px] uppercase text-muted-foreground select-none text-left pr-2">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[9px] font-bold text-primary/70 tracking-widest mb-1.5 uppercase select-none mt-4 first:mt-1">
      {title}
    </div>
  );
}

function RagBadge({ status }: { status: Paper['ragStatus'] }) {
  if (!status) return null;
  const config = {
    indexed: { label: 'Indexed', variant: 'secondary' as const, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    pending: { label: 'Indexing…', variant: 'outline' as const, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    failed: { label: 'Index failed', variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  }[status];

  if (!config) return null;
  return (
    <Badge variant={config.variant} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', config.className)}>
      {config.label}
    </Badge>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  paper: Paper;
  collection: Collection | null;
  workspaceId: string;
  className?: string;
  showOpenReader?: boolean;
  showTitle?: boolean;
}

export default function DetailPanel({
  paper,
  collection,
  workspaceId,
  className,
  showOpenReader = true,
  showTitle = true,
}: DetailPanelProps) {
  const { workspaceId: workspaceUrl } = useParams();
  const resolvedUrl = paper.fileUrl?.startsWith('/api/files/')
    ? `${API_BASE_URL}${paper.fileUrl}`
    : paper.fileUrl;

  const paperService = usePapers({ workspaceId, collectionId: paper.collectionId || '' });
  const { actions: referenceActions, state: referenceState } = useReferences();
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Child Notes UI States
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // React Hook Form with Zod Validation
  const form = useForm<PaperFormValues>({
    resolver: zodResolver(paperFormSchema),
    defaultValues: getPaperDefaultValues(paper),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = form;

  // Sync edit states when paper prop changes
  useEffect(() => {
    reset(getPaperDefaultValues(paper));
    setIsEditing(false);
    setNewNoteContent('');
    setIsAddingNote(false);
    setEditingNoteId(null);
    setEditingNoteContent('');
    setBibtexOpen(false);
  }, [paper, reset]);

  // Form submit handler
  const onSaveMetadata = (data: PaperFormValues) => {
    paperService.actions.updatePaper(
      {
        paperId: paper._id,
        title: data.title.trim(),
        authors: data.authors.split(',').map((a: string) => a.trim()).filter(Boolean),
        year: data.year ? parseInt(data.year) : null,
        doi: data.doi.trim(),
        journal: data.journal.trim(),
        publisher: data.publisher.trim(),
        keywords: data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean),

        abstract: data.abstract.trim(),
        volume: data.volume.trim(),
        issue: data.issue.trim(),
        pages: data.pages.trim(),
        issn: data.issn.trim(),
        isbn: data.isbn.trim(),
        url: data.url.trim(),
        type: data.type.trim(),
        language: data.language.trim(),
        journalAbbr: data.journalAbbr.trim(),
        shortTitle: data.shortTitle.trim(),
        rights: data.rights.trim(),
        extra: data.extra.trim(),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('Paper details updated');
        },
        onError: () => toast.error('Failed to update paper details'),
      },
    );
  };

  // Crawl DOI metadata and populate form fields
  const handleCrawlDoi = async () => {
    if (!paper.doi) return;
    try {
      const res: any = await referenceActions.lookupDoi(paper.doi);
      const meta = res?.work || res?.data?.work;
      if (!meta) throw new Error('No metadata returned from server');

      if (meta.title) setValue('title', meta.title);
      if (meta.authors?.length) setValue('authors', meta.authors.join(', '));
      if (meta.year) setValue('year', String(meta.year));
      if (meta.journal) setValue('journal', meta.journal);
      if (meta.publisher) setValue('publisher', meta.publisher);
      if (meta.language) setValue('language', meta.language);
      if (meta.journalAbbr) setValue('journalAbbr', meta.journalAbbr);
      if (meta.shortTitle) setValue('shortTitle', meta.shortTitle);
      if (meta.rights) setValue('rights', meta.rights);
      if (meta.extra) setValue('extra', meta.extra);

      setIsEditing(true);
      toast.success('DOI metadata loaded. Please review and save.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to crawl DOI');
    }
  };

  // Notes handlers
  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = [
      ...currentNotes.map((n) => ({ _id: n._id, content: n.content })),
      { content: newNoteContent.trim() },
    ];
    paperService.actions.updatePaper(
      { paperId: paper._id, notes: updatedNotes as any },
      {
        onSuccess: () => {
          setNewNoteContent('');
          setIsAddingNote(false);
        },
      },
    );
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = currentNotes.map((n) =>
      n._id === noteId ? { _id: n._id, content: editingNoteContent.trim() } : { _id: n._id, content: n.content },
    );
    paperService.actions.updatePaper(
      { paperId: paper._id, notes: updatedNotes as any },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          setEditingNoteContent('');
        },
      },
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = currentNotes
      .filter((n) => n._id !== noteId)
      .map((n) => ({ _id: n._id, content: n.content }));

    paperService.actions.updatePaper({ paperId: paper._id, notes: updatedNotes as any });
  };

  return (
    <div
      className={cn(
        'w-80 shrink-0 border-l border-border bg-card/60 flex flex-col h-full overflow-hidden text-xs',
        className,
      )}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-border/40 shrink-0 space-y-2 bg-background/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {showTitle && (
              <h3 className="font-semibold text-sm leading-snug line-clamp-3 text-foreground" title={paper.title}>
                {paper.title || 'Untitled Paper'}
              </h3>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <RagBadge status={paper.ragStatus} />
              {paper.year && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium">
                  {paper.year}
                </span>
              )}
              {paper.size ? (
                <span className="text-[10px] text-muted-foreground/60 font-mono">
                  {formatSize(paper.size)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                'p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-all duration-200',
                isEditing ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-muted',
              )}
              title={isEditing ? 'Cancel editing' : 'Edit details'}
              aria-label={isEditing ? 'Cancel editing' : 'Edit details'}
            >
              {isEditing ? <X className="size-3.5" /> : <Edit3 className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Form or Detail View */}
      {isEditing ? (
        <form onSubmit={handleSubmit(onSaveMetadata)} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* PRIMARY INFO */}
          <div>
            <SectionHeader title="Primary Info" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="Title *">
                <Input
                  className="h-7 text-xs"
                  placeholder="Paper title"
                  {...register('title')}
                />
                {errors.title && <p className="text-[10px] text-destructive mt-0.5">{errors.title.message}</p>}
              </EditRow>
              <EditRow label="Authors">
                <Input
                  className="h-7 text-xs"
                  placeholder="Comma separated"
                  {...register('authors')}
                />
              </EditRow>
              <EditRow label="Short Title">
                <Input
                  className="h-7 text-xs"
                  {...register('shortTitle')}
                />
              </EditRow>
              <EditRow label="Doc Type">
                <Input
                  className="h-7 text-xs"
                  {...register('type')}
                />
              </EditRow>
              <EditRow label="Abstract">
                <Textarea
                  rows={4}
                  className="text-xs resize-none leading-relaxed"
                  {...register('abstract')}
                />
              </EditRow>
            </div>
          </div>

          {/* PUBLICATION INFO */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Publication Info" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="Journal">
                <Input className="h-7 text-xs" {...register('journal')} />
              </EditRow>
              <EditRow label="Publisher">
                <Input className="h-7 text-xs" {...register('publisher')} />
              </EditRow>
              <EditRow label="Journal Abbr">
                <Input className="h-7 text-xs" {...register('journalAbbr')} />
              </EditRow>
              <EditRow label="Volume">
                <Input className="h-7 text-xs" {...register('volume')} />
              </EditRow>
              <EditRow label="Issue">
                <Input className="h-7 text-xs" {...register('issue')} />
              </EditRow>
              <EditRow label="Pages">
                <Input className="h-7 text-xs" {...register('pages')} />
              </EditRow>
              <EditRow label="Year">
                <Input type="number" className="h-7 text-xs" {...register('year')} />
              </EditRow>
              <EditRow label="Language">
                <Input className="h-7 text-xs" {...register('language')} />
              </EditRow>
            </div>
          </div>

          {/* IDENTIFIERS & LINKS */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Identifiers & Links" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="DOI">
                <Input className="h-7 text-xs" {...register('doi')} />
              </EditRow>
              <EditRow label="ISSN">
                <Input className="h-7 text-xs" {...register('issn')} />
              </EditRow>
              <EditRow label="ISBN">
                <Input className="h-7 text-xs" {...register('isbn')} />
              </EditRow>
              <EditRow label="URL">
                <Input className="h-7 text-xs" {...register('url')} />
              </EditRow>
              <EditRow label="Rights">
                <Input className="h-7 text-xs" {...register('rights')} />
              </EditRow>
              <EditRow label="Extra">
                <Input className="h-7 text-xs" {...register('extra')} />
              </EditRow>
              <EditRow label="Keywords">
                <Input className="h-7 text-xs" placeholder="Comma separated" {...register('keywords')} />
              </EditRow>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={paperService.state.isUpdating}
              className="w-full h-8 text-xs gap-1.5"
            >
              {paperService.state.isUpdating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save Details
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* PRIMARY INFO */}
          <div>
            <SectionHeader title="Primary Info" />
            <div className="space-y-0.5 mt-1">
              {paper.authors?.length > 0 && (
                <DetailRow label="Authors">{paper.authors.join('; ')}</DetailRow>
              )}
              {paper.abstract && (
                <DetailRow label="Abstract">
                  <p className="text-xs leading-relaxed text-muted-foreground hover:text-foreground line-clamp-4 hover:line-clamp-none cursor-pointer transition-all duration-200">
                    {paper.abstract}
                  </p>
                </DetailRow>
              )}
              {paper.shortTitle && (
                <DetailRow label="Short Title">{paper.shortTitle}</DetailRow>
              )}
              {paper.type && (
                <DetailRow label="Doc Type">
                  <span className="capitalize font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground">
                    {paper.type}
                  </span>
                </DetailRow>
              )}
            </div>
          </div>

          {/* PUBLICATION INFO */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Publication Info" />
            <div className="space-y-0.5 mt-1">
              {paper.journal && (
                <DetailRow label="Journal">
                  <em className="font-medium text-foreground">{paper.journal}</em>
                </DetailRow>
              )}
              {paper.publisher && (
                <DetailRow label="Publisher">{paper.publisher}</DetailRow>
              )}
              {paper.journalAbbr && (
                <DetailRow label="Journal Abbr">{paper.journalAbbr}</DetailRow>
              )}
              {(paper.volume || paper.issue || paper.pages) && (
                <DetailRow label="Vol/Is/Pg">
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {[
                      paper.volume ? `Vol. ${paper.volume}` : '',
                      paper.issue ? `No. ${paper.issue}` : '',
                      paper.pages ? `pp. ${paper.pages}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </DetailRow>
              )}
              {paper.year && <DetailRow label="Year">{paper.year}</DetailRow>}
              {paper.language && <DetailRow label="Language">{paper.language}</DetailRow>}
            </div>
          </div>

          {/* IDENTIFIERS & LINKS */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Identifiers & Links" />
            <div className="space-y-0.5 mt-1">
              {paper.doi && (
                <DetailRow label="DOI">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] break-all truncate text-muted-foreground select-all">{paper.doi}</span>
                    <button
                      onClick={handleCrawlDoi}
                      disabled={referenceState.isLookingUp || !paper.doi}
                      className="flex h-5 items-center justify-center rounded px-2 text-[10px] font-medium border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      aria-label="Crawl DOI metadata"
                    >
                      {referenceState.isLookingUp ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCcw className="mr-1 size-3" />}
                      Crawl DOI
                    </button>
                  </div>
                </DetailRow>
              )}
              {paper.issn && <DetailRow label="ISSN">{paper.issn}</DetailRow>}
              {paper.isbn && <DetailRow label="ISBN">{paper.isbn}</DetailRow>}
              {paper.url && (
                <DetailRow label="URL">
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 break-all truncate"
                  >
                    <span className="truncate">{paper.url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </DetailRow>
              )}
              {paper.rights && <DetailRow label="Rights">{paper.rights}</DetailRow>}
              {collection && (
                <DetailRow label="Collection">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium border border-current/10"
                    style={{
                      backgroundColor: `${collection.color || '#3370ff'}10`,
                      color: collection.color || '#3370ff',
                    }}
                  >
                    <FolderOpen className="size-3" />
                    {collection.name}
                  </span>
                </DetailRow>
              )}
              {paper.filename && (
                <DetailRow label="File">
                  <span className="font-mono text-[11px] text-muted-foreground break-all truncate" title={paper.filename}>
                    {paper.filename}
                  </span>
                </DetailRow>
              )}
              {paper.extra && <DetailRow label="Extra">{paper.extra}</DetailRow>}
            </div>
          </div>

          {/* Keywords & Labels */}
          {(paper.keywords && paper.keywords.length > 0) || (paper.labels && paper.labels.length > 0) ? (
            <div className="border-t border-border/30 pt-3 space-y-2">
              {paper.keywords && paper.keywords.length > 0 && (
                <DetailRow label="Keywords">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {paper.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border/40"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
              {paper.labels && paper.labels.length > 0 && (
                <DetailRow label="Labels">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {paper.labels.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
            </div>
          ) : null}

          {/* CHILD NOTES SECTION */}
          <div className="border-t border-border/30 pt-3 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 select-none">
                <FileText className="size-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  Notes ({paper.notes?.length || 0})
                </span>
              </div>
              <button
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
                aria-label={isAddingNote ? 'Cancel adding note' : 'Add new note'}
              >
                {isAddingNote ? (
                  <>
                    <X className="size-3" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="size-3" />
                    Add Note
                  </>
                )}
              </button>
            </div>

            {/* Note Adding Form */}
            {isAddingNote && (
              <div className="mb-3 bg-muted/20 border border-border/40 rounded-lg p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Type a new note..."
                  rows={3}
                  className="text-xs resize-none leading-relaxed"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => {
                      setNewNoteContent('');
                      setIsAddingNote(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-3 text-xs gap-1"
                    onClick={handleAddNote}
                    disabled={paperService.state.isUpdating || !newNoteContent.trim()}
                  >
                    {paperService.state.isUpdating && <Loader2 className="size-3 animate-spin" />}
                    Add Note
                  </Button>
                </div>
              </div>
            )}

            {/* Notes List */}
            <div className="space-y-2.5">
              {!paper.notes || paper.notes.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 italic py-2 text-center select-none">
                  No notes attached to this paper.
                </p>
              ) : (
                paper.notes.map((note) => (
                  <div
                    key={note._id}
                    className="bg-muted/30 backdrop-blur-sm hover:bg-muted/50 transition-all rounded-lg p-3 border border-border/30 relative group"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 select-none">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
                      </div>

                      {/* Hover action icons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingNoteId(note._id);
                            setEditingNoteContent(note.content);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-background/80 transition-colors"
                          title="Edit note"
                          aria-label="Edit note"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background/80 transition-colors"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Content / Edit Form */}
                    {editingNoteId === note._id ? (
                      <div className="space-y-2 mt-1">
                        <Textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          rows={3}
                          className="text-xs resize-none leading-relaxed"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteContent('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 px-2.5 text-[10px] gap-1"
                            onClick={() => handleUpdateNote(note._id)}
                            disabled={paperService.state.isUpdating || !editingNoteContent.trim()}
                          >
                            {paperService.state.isUpdating && <Loader2 className="size-2.5 animate-spin" />}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open PDF Footer Button */}
      {showOpenReader && resolvedUrl && (
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0 bg-background/20 flex gap-2">
          <Link
            href={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200"
            aria-label="Open Reader"
          >
            <FileText className="size-4" />
            Open Reader
          </Link>
          <button
            onClick={() => setBibtexOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground shrink-0"
            title="Export BibTeX citation"
            aria-label="Export BibTeX citation"
          >
            <FileJson className="size-4" />
          </button>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground shrink-0"
            title="Open raw PDF in new tab"
            aria-label="Open raw PDF in new tab"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
      <BibtexModal
        paper={paper}
        open={bibtexOpen}
        onOpenChange={setBibtexOpen}
      />
    </div>
  );
}
