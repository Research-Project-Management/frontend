'use client';

/**
 * BibVisualEditor.tsx
 *
 * Overleaf-parity Visual Editor (Form View) for `.bib` files.
 * Hides raw BibTeX syntax (`@article{...}`) behind structured, editable entry cards
 * while preserving comments, `@string`, and `@preamble` blocks on round-trip.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, Search, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  parseBibDocument,
  serializeBibDocument,
  type BibFormEntry,
} from '@/features/editor/domain/latex/bib-parser';

const ENTRY_TYPES = [
  'article',
  'inproceedings',
  'book',
  'incollection',
  'inbook',
  'phdthesis',
  'mastersthesis',
  'techreport',
  'misc',
  'online',
  'unpublished',
] as const;

export interface BibVisualEditorProps {
  value: string;
  readOnly?: boolean;
  onChange: (nextBibtex: string) => void;
}

export function BibVisualEditor({
  value,
  readOnly = false,
  onChange,
}: BibVisualEditorProps) {
  const parsedDoc = useMemo(() => parseBibDocument(value), [value]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(
    () => parsedDoc.entries[0]?.id ?? null,
  );

  const commitEntries = useCallback(
    (nextEntries: BibFormEntry[]) => {
      if (readOnly) return;
      const serialized = serializeBibDocument({
        preambleBlocks: parsedDoc.preambleBlocks,
        entries: nextEntries,
      });
      onChange(serialized);
    },
    [parsedDoc.preambleBlocks, onChange, readOnly],
  );

  const handleUpdateEntry = useCallback(
    (index: number, updater: (entry: BibFormEntry) => BibFormEntry) => {
      const next = parsedDoc.entries.map((entry, idx) =>
        idx === index ? updater(entry) : entry,
      );
      commitEntries(next);
    },
    [parsedDoc.entries, commitEntries],
  );

  const handleAddEntry = useCallback(() => {
    if (readOnly) return;
    const baseKey = `ref${new Date().getFullYear()}`;
    const existingKeys = new Set(parsedDoc.entries.map((e) => e.key));
    let key = baseKey;
    let suffix = 1;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix++}`;
    }
    const newEntry: BibFormEntry = {
      id: `bib-new-${Date.now()}`,
      type: 'article',
      key,
      fields: {
        title: '',
        author: '',
        year: String(new Date().getFullYear()),
        journal: '',
      },
    };
    commitEntries([...parsedDoc.entries, newEntry]);
    setExpandedId(newEntry.id);
  }, [parsedDoc.entries, commitEntries, readOnly]);

  const handleDeleteEntry = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (readOnly) return;
      const next = parsedDoc.entries.filter((_, idx) => idx !== index);
      commitEntries(next);
    },
    [parsedDoc.entries, commitEntries, readOnly],
  );

  const handleFormatAll = useCallback(() => {
    if (readOnly) return;
    commitEntries(parsedDoc.entries);
  }, [parsedDoc.entries, commitEntries, readOnly]);

  const filteredWithIndex = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parsedDoc.entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => {
        if (!q) return true;
        return (
          entry.key.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q) ||
          (entry.fields.title ?? '').toLowerCase().includes(q) ||
          (entry.fields.author ?? '').toLowerCase().includes(q) ||
          (entry.fields.year ?? '').toLowerCase().includes(q)
        );
      });
  }, [parsedDoc.entries, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-canvas text-foreground overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-semibold tracking-tight whitespace-nowrap">
            Bibliography ({parsedDoc.entries.length})
          </span>
          <div className="relative flex-1 max-w-xs">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by key, author, title..."
              className="w-full h-7 pl-8 pr-2.5 rounded-md border border-border bg-canvas text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={handleFormatAll}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-canvas hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
                title="Normalize BibTeX formatting"
              >
                <Sparkles className="size-3.5" />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={handleAddEntry}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Entry</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Entry Cards List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredWithIndex.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-surface/40">
            <p className="text-xs text-muted-foreground">
              {parsedDoc.entries.length === 0
                ? 'No BibTeX entries in this file yet.'
                : 'No entries match your filter.'}
            </p>
            {!readOnly && parsedDoc.entries.length === 0 && (
              <button
                type="button"
                onClick={handleAddEntry}
                className="mt-3 inline-flex items-center gap-1 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add First Entry</span>
              </button>
            )}
          </div>
        ) : (
          filteredWithIndex.map(({ entry, index }) => {
            const isExpanded = expandedId === entry.id;
            const venueField =
              entry.type === 'inproceedings' || entry.type === 'incollection'
                ? 'booktitle'
                : 'journal';

            return (
              <div
                key={entry.id}
                className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs"
              >
                {/* Card Summary Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : entry.id);
                    }
                  }}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-muted text-11 font-mono text-muted-foreground shrink-0">
                      @{entry.type}
                    </span>
                    <span className="font-mono text-xs font-semibold text-foreground shrink-0">
                      {entry.key}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.fields.title || 'Untitled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {entry.fields.year && (
                      <span className="text-11 text-muted-foreground font-mono">
                        {entry.fields.year}
                      </span>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteEntry(index, e)}
                        aria-label={`Delete ${entry.key}`}
                        className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Form Grid */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-border bg-canvas/50 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">Entry Type</span>
                      <select
                        value={entry.type}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({ ...cur, type: e.target.value }))
                        }
                        className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {!ENTRY_TYPES.includes(entry.type as (typeof ENTRY_TYPES)[number]) && (
                          <option value={entry.type}>{entry.type}</option>
                        )}
                        {ENTRY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">Citation Key</span>
                      <input
                        type="text"
                        value={entry.key}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({ ...cur, key: e.target.value }))
                        }
                        className="h-7 px-2 rounded-md border border-border bg-surface font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-11 font-medium text-muted-foreground">Title</span>
                      <input
                        type="text"
                        value={entry.fields.title ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, title: e.target.value },
                          }))
                        }
                        placeholder="Paper or book title"
                        className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-11 font-medium text-muted-foreground">Author(s)</span>
                      <input
                        type="text"
                        value={entry.fields.author ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, author: e.target.value },
                          }))
                        }
                        placeholder="Last, First and Last, First"
                        className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">
                        {venueField === 'booktitle' ? 'Booktitle / Conference' : 'Journal'}
                      </span>
                      <input
                        type="text"
                        value={entry.fields[venueField] ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, [venueField]: e.target.value },
                          }))
                        }
                        className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">Year</span>
                      <input
                        type="text"
                        value={entry.fields.year ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, year: e.target.value },
                          }))
                        }
                        placeholder="2025"
                        className="h-7 px-2 rounded-md border border-border bg-surface font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-11 font-medium text-muted-foreground">Volume</span>
                        <input
                          type="text"
                          value={entry.fields.volume ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            handleUpdateEntry(index, (cur) => ({
                              ...cur,
                              fields: { ...cur.fields, volume: e.target.value },
                            }))
                          }
                          className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-11 font-medium text-muted-foreground">Number</span>
                        <input
                          type="text"
                          value={entry.fields.number ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            handleUpdateEntry(index, (cur) => ({
                              ...cur,
                              fields: { ...cur.fields, number: e.target.value },
                            }))
                          }
                          className="h-7 px-2 rounded-md border border-border bg-surface text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-11 font-medium text-muted-foreground">Pages</span>
                        <input
                          type="text"
                          value={entry.fields.pages ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            handleUpdateEntry(index, (cur) => ({
                              ...cur,
                              fields: { ...cur.fields, pages: e.target.value },
                            }))
                          }
                          placeholder="1--12"
                          className="h-7 px-2 rounded-md border border-border bg-surface font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </label>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">DOI</span>
                      <input
                        type="text"
                        value={entry.fields.doi ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, doi: e.target.value },
                          }))
                        }
                        placeholder="10.1000/xyz123"
                        className="h-7 px-2 rounded-md border border-border bg-surface font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-11 font-medium text-muted-foreground">URL</span>
                      <input
                        type="text"
                        value={entry.fields.url ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          handleUpdateEntry(index, (cur) => ({
                            ...cur,
                            fields: { ...cur.fields, url: e.target.value },
                          }))
                        }
                        placeholder="https://..."
                        className={cn(
                          'h-7 px-2 rounded-md border border-border bg-surface font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                        )}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default BibVisualEditor;
