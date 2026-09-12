'use client';

import { useState, useEffect } from 'react';
import {
  X, Download, FileText, Calendar, User, Fingerprint,
  Maximize2, Search, Save, Loader2, RefreshCw,
  CheckCircle2, ChevronDown, ChevronUp,
  BookMarked, Building2, FileDigit, ScrollText, CircleDot
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import {
  getFileType, getFileIcon, getFileColor,
  formatFileSize, formatDate, formatMimeType,
} from '@/features/workspaces/projects/project-id/storage/utils/file';
import { resolveFileUrl } from "@/shared/lib/file-client";
import { usePreview } from '@/features/workspaces/projects/project-id/storage/hooks/use-preview';
import { usePreviewStore } from '@/features/workspaces/projects/project-id/storage/store/use-preview-store';
import { downloadFileUrl } from "@/shared/lib/file-client";

export default function Preview() {
  const { selectedItem: item, setSelectedItem } = usePreviewStore();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [item?.id, item?.url]);

  const {
    metadata, setMetadata,
    previewDataUrl,
    loading: pdfLoading,
    crossrefLoading, crossrefStatus,
    searchOpen, setSearchOpen,
    searchQuery, setSearchQuery,
    searchResults,
    searchLoading,
    saved, setSaved,
    abstractExpanded, setAbstractExpanded,
    handleSearch, handleSelectCrossref, handleRetryLookup, handleSaveMetadata,
  } = usePreview(item);

  if (!item) return null;

  const fileType   = getFileType(item as any);
  const isImage    = fileType === 'image';
  const isPdf      = item.filename.toLowerCase().endsWith('.pdf') || item.mimeType === 'application/pdf';
  const resolvedUrl = resolveFileUrl(item.url);
  const color      = getFileColor(item as any);   // hex / oklch string
  const unsaved    = metadata && !saved;

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try { await downloadFileUrl(resolvedUrl, item.filename); } catch { /* ignore */ }
  };

  // ── Crossref badge config ───────────────────────────────────────────
  const crossrefBadge = {
    found:     { label: 'Crossref matched', cls: 'bg-success/10 text-success' },
    'not-found': { label: 'Not on Crossref', cls: 'bg-muted text-muted-foreground' },
    error:     { label: 'Lookup failed',    cls: 'bg-destructive/10 text-destructive' },
    idle:      { label: 'Checking…',        cls: 'bg-muted text-muted-foreground' },
  }[crossrefStatus];

  return (
    <div className="w-[308px] shrink-0 h-full border-l border-border bg-background flex flex-col overflow-hidden animate-in slide-in-from-right-3 duration-200 ease-out">

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-4 border-b border-border">
        {/* File-type icon — colored icon only, no background box */}
        <span
          className="mt-0.5 shrink-0 [&>svg]:size-5"
          style={{ color }}
        >
          {getFileIcon(fileType, 4)}
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold text-foreground leading-snug break-words line-clamp-2 pr-1"
            title={item.filename}
          >
            {item.filename}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
            {formatMimeType(item as any)}
          </p>
        </div>

        <button
          onClick={() => setSelectedItem(null)}
          aria-label="Close preview"
          className="mt-0.5 shrink-0 size-5 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        >
          <X className="size-3.5 shrink-0" />
        </button>
      </div>

      {/* ─── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Thumbnail zone — fixed height so it doesn't shift layout */}
        <div
          className="relative border-b border-border flex items-center justify-center h-44 overflow-hidden shrink-0"
          style={{
            background: isImage && !imageError && resolvedUrl
              ? 'repeating-conic-gradient(var(--color-muted) 0% 25%, var(--color-background) 0% 50%) 0 0 / 14px 14px'
              : 'color-mix(in oklch, var(--color-muted) 30%, transparent)',
          }}
        >
          {isImage ? (
            !imageError && resolvedUrl ? (
              <img
                src={resolvedUrl}
                alt={item.filename}
                onError={() => setImageError(true)}
                className="w-full h-full object-contain "
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <div
                  className="opacity-25 transition-opacity hover:opacity-40"
                  style={{ color }}
                >
                  {getFileIcon('image', 10)}
                </div>
                <span className="text-xs text-muted-foreground/50">Preview unavailable</span>
              </div>
            )
          ) : isPdf ? (
            pdfLoading ? (
              /* Shimmer skeleton for PDF loading */
              <div className="relative w-[calc(100%-32px)] mx-4 my-6 rounded-md overflow-hidden bg-muted h-36">
                <div
                  className="absolute inset-0 -translate-x-full animate-shimmer"
                  style={{
                    background: 'linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-muted-foreground) 8%, transparent), transparent)',
                  }}
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-muted-foreground/50">
                  <Loader2 className="size-3 animate-spin shrink-0" />
                  Rendering…
                </div>
              </div>
            ) : previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={`${item.filename} preview`}
                className="w-full max-h-52 object-contain animate-in fade-in duration-300"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8">
                <FileText className="size-9 text-muted-foreground/20 shrink-0" />
                <span className="text-xs text-muted-foreground/40">No preview available</span>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <div
                className="opacity-15 transition-opacity hover:opacity-25"
                style={{ color }}
              >
                {getFileIcon(fileType, 10)}
              </div>
              <span className="text-xs text-muted-foreground/40">No preview</span>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex gap-1.5 px-3.5 pt-2 pb-2.5 border-b border-border">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-foreground hover:bg-muted transition-all active:scale-[0.97]"
          >
            <Download className="size-3 shrink-0" />
            Download
          </button>
          {(isPdf || isImage) && (
            <button
              onClick={() => window.open(item.url, '_blank')}
              className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-xs text-foreground hover:bg-muted transition-all active:scale-[0.97]"
            >
              <Maximize2 className="size-3 shrink-0" />
              Open full
            </button>
          )}
        </div>

        {/* ── File details ─────────────────────────────────────────── */}
        <div className="px-3.5 pt-3 pb-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            File details
          </p>
          <div className="divide-y divide-border/30">
            {[
              { label: 'Type',     value: formatMimeType(item as any) },
              { label: 'Size',     value: formatFileSize(item.size) },
              { label: 'Added',    value: formatDate(item.createdAt) },
              ...(item.updatedAt !== item.createdAt
                ? [{ label: 'Modified', value: formatDate(item.updatedAt) }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="text-xs text-muted-foreground/50 shrink-0">{label}</span>
                <span className="text-xs font-medium text-foreground text-right break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Academic metadata ────────────────────────────────────── */}
        {metadata && (
          <div className="px-3.5 pt-3.5 pb-6">

            {/* Section header + Crossref badge */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Academic metadata
              </p>
              <div className="flex items-center gap-1.5">
                {crossrefLoading ? (
                  <Loader2 className="size-3 animate-spin text-muted-foreground/30 shrink-0" />
                ) : (
                  <span className={`text-xs font-medium px-1.5 py-px rounded-full leading-none ${crossrefBadge.cls}`}>
                    {crossrefBadge.label}
                  </span>
                )}
                <button
                  onClick={handleRetryLookup}
                  disabled={crossrefLoading}
                  className="text-muted-foreground/25 hover:bg-muted transition-colors disabled:opacity-30"
                  title="Retry Crossref lookup"
                >
                  <RefreshCw className="size-3 transition-transform duration-300 hover:rotate-180 shrink-0" />
                </button>
              </div>
            </div>

            {/* Manual search trigger */}
            {crossrefStatus !== 'found' && !crossrefLoading && (
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="mb-4 text-xs text-primary transition-colors flex items-center gap-1.5 group hover:underline"
              >
                <Search className="size-3 group-hover:scale-110 transition-transform duration-150 shrink-0" />
                {searchOpen ? 'Cancel' : 'Search Crossref manually'}
              </button>
            )}

            {/* Search panel */}
            {searchOpen && (
              <div className="mb-4 rounded-lg border border-border bg-muted overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex gap-1.5 p-2 border-b border-border">
                  <Input
                    placeholder="Title, DOI, authors…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-7 text-xs bg-background/80"
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 px-0 shrink-0"
                    onClick={handleSearch}
                    disabled={searchLoading}
                  >
                    {searchLoading
                      ? <Loader2 className="size-3 animate-spin shrink-0" />
                      : <Search className="size-3 shrink-0" />}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/20">
                    {searchResults.map((work: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectCrossref(work)}
                        className="w-full text-left px-2.5 py-2 text-xs hover:bg-muted transition-colors cursor-pointer"
                      >
                        <p className="font-medium line-clamp-2 leading-snug mb-0.5">{work.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {work.authors?.join(', ') || 'Unknown authors'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground/50">
                          <span className="bg-muted px-1.5 py-px rounded-sm font-medium">{work.year || 'N/A'}</span>
                          {work.journal && <span className="truncate">{work.journal}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Metadata form fields ─────────────────────────── */}
            <div className="space-y-3">

              {/* Title */}
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                  <FileText className="size-3 shrink-0" />Title
                </Label>
                <Input
                  value={metadata.title || ''}
                  onChange={(e) => { setMetadata({ ...metadata, title: e.target.value }); setSaved(false); }}
                  placeholder="Paper title…"
                  className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                />
              </div>

              {/* Authors */}
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                  <User className="size-3 shrink-0" />Authors
                </Label>
                <Input
                  value={metadata.author || metadata.authors?.join(', ') || ''}
                  onChange={(e) => { setMetadata({ ...metadata, author: e.target.value }); setSaved(false); }}
                  placeholder="Last, First; Last, First…"
                  className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                />
              </div>

              {/* DOI */}
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                  <Fingerprint className="size-3 shrink-0" />DOI
                </Label>
                <Input
                  value={metadata.doi || ''}
                  onChange={(e) => { setMetadata({ ...metadata, doi: e.target.value }); setSaved(false); }}
                  placeholder="10.xxxx/xxxxx"
                  className="h-[30px] text-xs bg-transparent border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25 font-mono"
                />
              </div>

              {/* Year + Pages side by side */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                    <Calendar className="size-3 shrink-0" />Year
                  </Label>
                  <Input
                    value={metadata.year ? String(metadata.year) : ''}
                    onChange={(e) => { setMetadata({ ...metadata, year: e.target.value ? parseInt(e.target.value) : undefined }); setSaved(false); }}
                    placeholder="2024"
                    className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                    <FileDigit className="size-3 shrink-0" />Pages
                  </Label>
                  <Input
                    value={metadata.pages || ''}
                    onChange={(e) => { setMetadata({ ...metadata, pages: e.target.value }); setSaved(false); }}
                    placeholder="1–12"
                    className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                  />
                </div>
              </div>

              {/* Journal */}
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                  <BookMarked className="size-3 shrink-0" />Journal
                </Label>
                <Input
                  value={metadata.journal || ''}
                  onChange={(e) => { setMetadata({ ...metadata, journal: e.target.value }); setSaved(false); }}
                  placeholder="Journal name…"
                  className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                />
              </div>

              {/* Publisher */}
              <div>
                <Label className="flex items-center gap-1 text-xs font-semibold mb-1 text-muted-foreground/60">
                  <Building2 className="size-3 shrink-0" />Publisher
                </Label>
                <Input
                  value={metadata.publisher || ''}
                  onChange={(e) => { setMetadata({ ...metadata, publisher: e.target.value }); setSaved(false); }}
                  placeholder="Publisher…"
                  className="h-8 text-xs bg-transparent border-border hover:border-border focus:border-primary/50 transition-colors placeholder:text-muted-foreground/25"
                />
              </div>

              {/* Abstract — collapsible */}
              {metadata.abstract && (
                <div>
                  <button
                    className="flex items-center gap-1.5 w-full text-left mb-1.5 text-xs font-semibold text-muted-foreground/60 hover:bg-muted transition-colors"
                    onClick={() => setAbstractExpanded(!abstractExpanded)}
                  >
                    <ScrollText className="size-3 shrink-0" />
                    <span>Abstract</span>
                    <span className="ml-auto opacity-60">
                      {abstractExpanded
                        ? <ChevronUp className="size-3 shrink-0" />
                        : <ChevronDown className="size-3 shrink-0" />}
                    </span>
                  </button>
                  <div
                    className={`relative text-xs leading-relaxed text-muted-foreground bg-muted rounded-lg px-3 py-2.5 border border-border overflow-hidden transition-all duration-300 ${abstractExpanded ? 'max-h-[600px]' : 'max-h-[68px]'}`}
                  >
                    {metadata.abstract}
                    {!abstractExpanded && (
                      <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-background/60 to-transparent" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Save footer ─────────────────────────────────────────────── */}
      {metadata && (
        <div className="px-3.5 pt-2.5 pb-3 border-t border-border shrink-0">
          <button
            disabled={saved || !item}
            onClick={handleSaveMetadata}
            className={`relative w-full h-8 rounded-sm flex items-center justify-center gap-2 text-xs font-medium transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
              saved
                ? 'bg-success/8 text-success cursor-default'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {saved ? (
              <>
                <CheckCircle2 className="size-3.5 shrink-0" />
                Saved
              </>
            ) : (
              <>
                <Save className="size-3.5 shrink-0" />
                Save metadata
                {unsaved && (
                  <span className="absolute right-3 size-1.5 rounded-full bg-primary-foreground/60 animate-pulse" />
                )}
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
}
