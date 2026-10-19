'use client';

import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Highlighter,
  StickyNote,
  Loader2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { fetchPdfBlob } from '@/features/library/sdk/library.client';

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  htmlContent: string;
}

export interface EpubAndSnapshotViewerProps {
  url: string;
  mode: 'epub' | 'snapshot';
  title?: string;
  sourceUrl?: string;
  themeMode?: 'normal' | 'sepia' | 'dark';
  zoom?: number;
  activeColor?: string;
  onAddToNote?: (text: string, pageNumber?: number) => void;
  onAnnotate?: (
    text: string,
    pageNum?: number,
    colorHex?: string,
  ) => Promise<unknown> | void;
  onPageChange?: (current: number, total: number) => void;
}

/**
 * Resolves a relative path inside an EPUB archive against a base directory.
 */
function resolveEpubPath(baseDir: string, relativeHref: string): string {
  const cleanHref = relativeHref.split('#')[0];
  if (!baseDir) return cleanHref.replace(/^\/+/, '');
  const parts = `${baseDir}/${cleanHref}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

/**
 * Zotero 7-style Unified EPUB & Web Snapshot Reader
 * Supports:
 * - Native `.epub` archive unpacking via JSZip (OPF spine + TOC + Chapter HTML)
 * - Clean Web Snapshot HTML rendering
 * - Text selection toolbar to Highlight & Add to Note (1:1 with PDF Reader)
 * - Reading themes (Normal, Sepia, Dark) & Zoom scaling
 */
export function EpubAndSnapshotViewer({
  url,
  mode,
  title,
  sourceUrl,
  themeMode = 'normal',
  zoom = 1.0,
  activeColor = '#ffd400',
  onAddToNote,
  onAnnotate,
  onPageChange,
}: EpubAndSnapshotViewerProps) {
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [snapshotHtml, setSnapshotHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');

  // Load EPUB or Snapshot
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    async function loadContent() {
      setIsLoading(true);
      setError(null);
      try {
        if (mode === 'snapshot') {
          const blob = await fetchPdfBlob(url, abortController.signal);
          if (cancelled || abortController.signal.aborted) return;
          const rawHtml = await blob.text();
          if (cancelled || abortController.signal.aborted) return;
          const sanitized = DOMPurify.sanitize(rawHtml, {
            WHOLE_DOCUMENT: false,
            ADD_TAGS: ['article', 'section', 'header', 'footer', 'figure', 'figcaption'],
          });
          setSnapshotHtml(sanitized);
          onPageChange?.(1, 1);
          setIsLoading(false);
          return;
        }

        // Mode === 'epub': Unpack with JSZip
        const blob = await fetchPdfBlob(url, abortController.signal);
        if (cancelled || abortController.signal.aborted) return;
        const buffer = await blob.arrayBuffer();
        if (cancelled || abortController.signal.aborted) return;
        const zip = await JSZip.loadAsync(buffer);
        if (cancelled || abortController.signal.aborted) return;

        // 1. Locate OPF package path from META-INF/container.xml
        const containerFile = zip.file('META-INF/container.xml');
        let opfPath = '';
        if (containerFile) {
          const containerXml = await containerFile.async('text');
          if (cancelled || abortController.signal.aborted) return;
          const match = containerXml.match(/full-path=["']([^"']+)["']/i);
          if (match?.[1]) opfPath = match[1];
        }

        if (!opfPath) {
          // Fallback: search for any .opf file in the zip
          const opfFiles = Object.keys(zip.files).filter((k) =>
            k.toLowerCase().endsWith('.opf'),
          );
          opfPath = opfFiles[0] || '';
        }

        if (!opfPath || !zip.file(opfPath)) {
          throw new Error('Invalid EPUB archive: missing package.opf manifest.');
        }

        const opfXml = await zip.file(opfPath)!.async('text');
        if (cancelled || abortController.signal.aborted) return;
        const opfDir = opfPath.includes('/')
          ? opfPath.slice(0, opfPath.lastIndexOf('/'))
          : '';

        const parser = new DOMParser();
        const opfDoc = parser.parseFromString(opfXml, 'application/xml');

        // 2. Parse <manifest> items
        const manifestMap = new Map<
          string,
          { href: string; mediaType: string }
        >();
        const itemEls = Array.from(opfDoc.getElementsByTagName('item'));
        for (const el of itemEls) {
          const id = el.getAttribute('id');
          const href = el.getAttribute('href');
          const mediaType = el.getAttribute('media-type') || '';
          if (id && href) {
            manifestMap.set(id, { href, mediaType });
          }
        }

        // 3. Parse <spine> itemrefs
        const itemrefEls = Array.from(opfDoc.getElementsByTagName('itemref'));
        const loadedChapters: EpubChapter[] = [];

        for (let i = 0; i < itemrefEls.length; i++) {
          if (cancelled || abortController.signal.aborted) return;
          const idref = itemrefEls[i].getAttribute('idref');
          if (!idref) continue;
          const manifestEntry = manifestMap.get(idref);
          if (!manifestEntry) continue;

          const resolvedPath = resolveEpubPath(opfDir, manifestEntry.href);
          const chapterFile =
            zip.file(resolvedPath) ||
            zip.file(decodeURIComponent(resolvedPath));
          if (!chapterFile) continue;

          const rawChapterHtml = await chapterFile.async('text');
          if (cancelled || abortController.signal.aborted) return;
          const chapterDoc = parser.parseFromString(
            rawChapterHtml,
            'text/html',
          );
          const headingText =
            chapterDoc.querySelector('h1, h2, h3, title')?.textContent?.trim() ||
            `Section ${loadedChapters.length + 1}`;
          const bodyHtml = chapterDoc.body
            ? chapterDoc.body.innerHTML
            : rawChapterHtml;

          const sanitizedHtml = DOMPurify.sanitize(bodyHtml);
          if (sanitizedHtml.trim()) {
            loadedChapters.push({
              id: idref,
              title: headingText,
              href: resolvedPath,
              htmlContent: sanitizedHtml,
            });
          }
        }

        if (cancelled || abortController.signal.aborted) return;
        setChapters(loadedChapters);
        setCurrentChapterIndex(0);
        onPageChange?.(1, Math.max(1, loadedChapters.length));
      } catch (err) {
        if (!cancelled && !abortController.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not render this document.',
          );
        }
      } finally {
        if (!cancelled && !abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [url, mode, onPageChange]);

  const handleMouseUp = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection()?.toString().trim() || '';
    setSelectedText(sel);
  }, []);

  const handlePrevChapter = () => {
    setCurrentChapterIndex((prev) => {
      const next = Math.max(0, prev - 1);
      onPageChange?.(next + 1, chapters.length);
      return next;
    });
  };

  const handleNextChapter = () => {
    setCurrentChapterIndex((prev) => {
      const next = Math.min(chapters.length - 1, prev + 1);
      onPageChange?.(next + 1, chapters.length);
      return next;
    });
  };

  const themeClasses =
    themeMode === 'dark'
      ? 'bg-zinc-900 text-zinc-100'
      : themeMode === 'sepia'
        ? 'bg-[#f4ecd8] text-[#3c3222]'
        : 'bg-background text-foreground';

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 bg-muted/20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-12 text-muted-foreground">
          {mode === 'epub'
            ? 'Opening EPUB eBook chapters...'
            : 'Loading archived Web Snapshot...'}
        </p>
      </div>
    );
  }

  if (error && mode === 'epub') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-13 font-medium text-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          Download File Instead
        </Button>
      </div>
    );
  }

  const currentChapter = chapters[currentChapterIndex];

  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-0 overflow-hidden relative',
        themeClasses,
      )}
    >
      {/* Top Sub-bar for EPUB Chapters or Snapshot Controls */}
      <div className="h-9 px-4 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 select-none bg-background/80 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'epub' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsTocOpen((v) => !v)}
                className="h-7 px-2 text-11 gap-1.5 cursor-pointer"
              >
                <List className="size-3.5" />
                <span>Chapters ({chapters.length})</span>
              </Button>
              {currentChapter && (
                <span className="text-12 font-medium text-muted-foreground truncate">
                  {currentChapter.title}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-12 text-muted-foreground truncate">
              <Globe className="size-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground truncate">
                {title || 'Archived Web Snapshot'}
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 text-primary hover:underline ml-2 shrink-0"
                >
                  Original Page <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Selection Quick Action Bar (Highlight & Add to Note) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedText && (
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-0.5">
              {onAnnotate && (
                <button
                  type="button"
                  onClick={() => {
                    onAnnotate(
                      selectedText,
                      mode === 'epub' ? currentChapterIndex + 1 : 1,
                      activeColor,
                    );
                    setSelectedText('');
                  }}
                  className="h-6 px-2 rounded text-11 font-medium text-foreground hover:bg-primary/20 flex items-center gap-1 cursor-pointer"
                >
                  <Highlighter className="size-3 text-primary" />
                  <span>Save Highlight</span>
                </button>
              )}
              {onAddToNote && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToNote(
                      selectedText,
                      mode === 'epub' ? currentChapterIndex + 1 : 1,
                    );
                    setSelectedText('');
                  }}
                  className="h-6 px-2 rounded text-11 font-medium text-foreground hover:bg-primary/20 flex items-center gap-1 cursor-pointer"
                >
                  <StickyNote className="size-3 text-primary" />
                  <span>Add to Note</span>
                </button>
              )}
            </div>
          )}

          {mode === 'epub' && chapters.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentChapterIndex <= 0}
                onClick={handlePrevChapter}
                className="h-7 px-2 text-11 cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                <span>Prev</span>
              </Button>
              <span className="text-11 font-mono px-1.5 text-muted-foreground">
                {currentChapterIndex + 1} / {chapters.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentChapterIndex >= chapters.length - 1}
                onClick={handleNextChapter}
                className="h-7 px-2 text-11 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area with Collapsible EPUB Table of Contents */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {mode === 'epub' && isTocOpen && (
          <aside className="w-64 border-r border-border bg-background/95 overflow-y-auto p-2 flex flex-col gap-0.5 shrink-0 z-10">
            <div className="px-2 py-1 text-11 font-semibold text-muted-foreground uppercase tracking-wider">
              Table of Contents
            </div>
            {chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setCurrentChapterIndex(idx);
                  onPageChange?.(idx + 1, chapters.length);
                  setIsTocOpen(false);
                }}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-left text-xs truncate cursor-pointer transition-colors',
                  idx === currentChapterIndex
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {idx + 1}. {ch.title}
              </button>
            ))}
          </aside>
        )}

        {/* Reader Scroll Viewport */}
        <div
          onMouseUp={handleMouseUp}
          className="flex-1 overflow-y-auto px-6 py-8 md:px-14"
        >
          {mode === 'epub' ? (
            currentChapter ? (
              <article
                style={{ fontSize: `${Math.round(zoom * 100)}%` }}
                className="max-w-3xl mx-auto prose prose-sm md:prose-base dark:prose-invert leading-relaxed select-text"
                dangerouslySetInnerHTML={{ __html: currentChapter.htmlContent }}
              />
            ) : (
              <div className="text-center text-muted-foreground py-12 text-13">
                <BookOpen className="size-8 mx-auto mb-2 stroke-1" />
                No readable chapters found in this EPUB file.
              </div>
            )
          ) : snapshotHtml ? (
            <article
              style={{ fontSize: `${Math.round(zoom * 100)}%` }}
              className="max-w-4xl mx-auto prose prose-sm md:prose-base dark:prose-invert leading-relaxed select-text"
              dangerouslySetInnerHTML={{ __html: snapshotHtml }}
            />
          ) : (
            <iframe
              src={url}
              sandbox="allow-same-origin allow-popups"
              className="w-full h-full min-h-[75vh] border border-border rounded-md bg-white"
              title={title || 'Web Snapshot'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default EpubAndSnapshotViewer;
