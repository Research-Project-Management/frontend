'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Search,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
  X,
  Check,
  UploadCloud,
  Eye,
  Trash2,
  Layers,
} from 'lucide-react';
import {
  fetchDocuments,
  deleteDocument,
  fetchDocumentContent,
  uploadDocument,
} from '../../services/chat.service';
import type { DocumentItem } from '../../types/chat.types';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import StorageEmptyState from '@/features/storage/components/layout/StorageEmptyState';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface UploadedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
  onSelectItems?: (items: Array<{ id: string; name: string; size: number }>) => void;
}

type FileCategory = 'all' | 'pdf' | 'doc_text' | 'spreadsheet' | 'image' | 'code' | 'other';

const PDF_EXTS = new Set(['pdf']);
const DOC_TEXT_EXTS = new Set(['doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'tex', 'bib']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'csv', 'tsv']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'eps', 'bmp']);
const CODE_EXTS = new Set([
  'py', 'r', 'ts', 'tsx', 'js', 'jsx', 'json', 'java', 'cpp', 'c', 'go', 'rs', 'sh', 'bash', 'sql', 'html', 'css',
]);

function getDocumentCategory(title: string, type?: string): FileCategory {
  const parts = (title || '').split('.');
  const ext = (parts.length > 1 ? parts.pop() || '' : type || '').toLowerCase();

  if (PDF_EXTS.has(ext)) return 'pdf';
  if (DOC_TEXT_EXTS.has(ext)) return 'doc_text';
  if (SHEET_EXTS.has(ext)) return 'spreadsheet';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (CODE_EXTS.has(ext)) return 'code';
  return 'other';
}

function getDocumentIcon(category: FileCategory) {
  switch (category) {
    case 'pdf':
    case 'doc_text':
      return FileText;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'image':
      return FileImage;
    case 'code':
      return FileCode;
    default:
      return File;
  }
}

const CATEGORY_ITEMS: { id: FileCategory; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'all', label: 'All Files', icon: Layers },
  { id: 'pdf', label: 'PDF Documents', icon: FileText },
  { id: 'doc_text', label: 'Office & Text', icon: FileText },
  { id: 'spreadsheet', label: 'Data Sheets', icon: FileSpreadsheet },
  { id: 'image', label: 'Images', icon: FileImage },
  { id: 'code', label: 'Scripts & Code', icon: FileCode },
];

export function UploadedDocumentsModal({
  isOpen,
  onClose,
  projectId,
  onSelectItem,
  onSelectItems,
}: UploadedDocumentsModalProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Map<string, DocumentItem>>(new Map());

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const targetScope = projectId && projectId !== 'all' ? projectId : undefined;
      const res = await fetchDocuments(targetScope);
      setDocuments(Array.isArray(res) ? res : []);
    } catch (err: any) {
      console.error('[UploadedDocumentsModal] Failed to load documents:', err);
      setError(err?.message || 'Failed to load uploaded documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Reset state and fetch on open
  useEffect(() => {
    if (isOpen) {
      setSelectedDocs(new Map());
      setSearch('');
      setSelectedCategory('all');
      setError(null);
      loadDocuments();
    }
  }, [isOpen, loadDocuments]);

  // Handle single upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        const targetScope = projectId === 'all' || !projectId ? 'me' : projectId;
        await uploadDocument(targetScope, file);
        successCount++;
      } catch (err: any) {
        toast.error('Failed to upload ' + file.name + ': ' + (err?.message || 'Upload error'));
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      toast.success('Uploaded ' + successCount + ' document(s) successfully');
      loadDocuments();
    }
  };

  // Handle delete document
  const handleDeleteDoc = async (doc: DocumentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete "' + doc.title + '"?')) return;

    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id, projectId || undefined);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setSelectedDocs((prev) => {
        const next = new Map(prev);
        next.delete(doc.id);
        return next;
      });
      toast.success('Deleted "' + doc.title + '"');
    } catch (err: any) {
      toast.error('Failed to delete document: ' + (err?.message || 'Error'));
    } finally {
      setDeletingId(null);
    }
  };

  // Handle preview document text
  const handlePreviewDoc = async (doc: DocumentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPreviewLoading(true);
    setPreviewDoc({ title: doc.title, content: '' });
    try {
      const res = await fetchDocumentContent(doc.id);
      setPreviewDoc({
        title: doc.title,
        content: res.text || 'No text extracted for this document.',
      });
    } catch {
      setPreviewDoc({
        title: doc.title,
        content: 'Failed to load document preview content.',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    let list = documents;

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((doc) => getDocumentCategory(doc.title, doc.type) === selectedCategory);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((doc) => {
        const titleMatch = (doc.title || '').toLowerCase().includes(q);
        const tagMatch = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
        const typeMatch = (doc.type || '').toLowerCase().includes(q);
        return titleMatch || tagMatch || typeMatch;
      });
    }

    return list;
  }, [documents, selectedCategory, search]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory, number> = {
      all: documents.length,
      pdf: 0,
      doc_text: 0,
      spreadsheet: 0,
      image: 0,
      code: 0,
      other: 0,
    };
    for (const doc of documents) {
      const cat = getDocumentCategory(doc.title, doc.type);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    }
    return counts;
  }, [documents]);

  // Toggle select item
  const toggleSelect = (doc: DocumentItem) => {
    setSelectedDocs((prev) => {
      const next = new Map(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
      } else {
        next.set(doc.id, doc);
      }
      return next;
    });
  };

  // Double click item to immediately attach
  const handleDoubleClick = (doc: DocumentItem) => {
    const payload = {
      id: doc.id,
      name: doc.title || 'Untitled Document',
      size: (doc as any).size || 0,
    };
    onSelectItem?.(payload);
    onSelectItems?.([payload]);
    toast.success('Attached "' + payload.name + '" to chat');
    onClose();
  };

  // Batch confirm
  const handleConfirm = () => {
    if (selectedDocs.size === 0) return;
    const list = Array.from(selectedDocs.values()).map((doc) => ({
      id: doc.id,
      name: doc.title || 'Untitled Document',
      size: (doc as any).size || 0,
    }));

    if (onSelectItems) {
      onSelectItems(list);
    } else if (onSelectItem) {
      list.forEach((doc) => onSelectItem(doc));
    }

    toast.success('Attached ' + list.length + ' ' + (list.length === 1 ? 'document' : 'documents') + ' to chat');
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] h-[580px] flex flex-col p-0 overflow-hidden rounded-lg bg-background border border-border/60 shadow-raised-400">
          {/* Header: Title only with compact spacing */}
          <DialogHeader className="px-5 pt-3.5 pb-1 flex flex-row items-center shrink-0">
            <DialogTitle className="text-14 font-semibold text-foreground">
              Uploaded documents
            </DialogTitle>
          </DialogHeader>

          {/* Main Body: Sidebar + Main Content Area */}
          <div className="flex-1 flex min-h-0">
            {/* Left Sidebar: Categories */}
            <div className="w-48 bg-muted/20 border-r border-border/50 px-2.5 pt-1 pb-2 overflow-y-auto space-y-1 shrink-0 select-none">
              <p className="px-2 pb-1 text-11 font-medium text-muted-foreground">
                Categories
              </p>

              {CATEGORY_ITEMS.map((cat) => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors group',
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
                    {count > 0 && (
                      <span
                        className={cn(
                          'text-11 px-1.5 py-0.2 rounded tabular-nums font-normal shrink-0',
                          isActive
                            ? 'text-foreground bg-muted font-medium'
                            : 'text-muted-foreground/70 group-hover:text-muted-foreground'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Main Content: Toolbar + Document List */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Toolbar: Search input (flex-1) + Upload button placed directly adjacent */}
              <div className="px-3 pt-1 pb-2 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                    strokeWidth={1.5}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search documents..."
                    aria-label="Search documents"
                    className="w-full h-8 pl-8 pr-7 text-12 rounded-md border border-border bg-background hover:border-foreground/30 focus:border-ring focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      <X className="size-3" strokeWidth={1.5} />
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-8 px-3 text-12 font-medium rounded-md cursor-pointer shadow-none gap-1.5 shrink-0"
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="size-3.5" />
                  )}
                  <span>Upload</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,.tex,.bib,.csv,.tsv,.xls,.xlsx,.json,.ts,.tsx,.js,.jsx,.py,.r,.sh,.sql,.png,.jpg,.jpeg,.svg,.webp"
                />
              </div>

              {/* Document List Scroll Area */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-foreground">
                    <Loader2 className="size-5 animate-spin text-muted-foreground mb-2" />
                    <span className="text-12 text-muted-foreground">Loading documents...</span>
                  </div>
                ) : error ? (
                  <PlaneErrorState
                    error={error || new Error('Internal Server Error')}
                    title="Failed to load documents"
                    description={typeof error === 'string' ? error : 'An error occurred while loading documents.'}
                    className="min-h-0 py-8 px-4"
                  />
                ) : filteredDocs.length === 0 ? (
                  <StorageEmptyState
                    searchQuery={search}
                    title={search ? 'No matching documents' : 'No documents found'}
                    description={
                      search
                        ? 'No documents found matching "' + search + '". Try searching with different keywords.'
                        : 'Upload files to make them available for AI companion context.'
                    }
                    className="min-h-0 py-8 px-4"
                  />
                ) : (
                  <div className="space-y-0.5">
                    {filteredDocs.map((doc) => {
                      const isSelected = selectedDocs.has(doc.id);
                      const cat = getDocumentCategory(doc.title, doc.type);
                      const Icon = getDocumentIcon(cat);

                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleSelect(doc)}
                          onDoubleClick={() => handleDoubleClick(doc)}
                          className={cn(
                            'group relative flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors cursor-pointer select-none',
                            isSelected
                              ? 'bg-primary/[0.07] text-primary'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background group-hover:border-foreground/40'
                            )}
                          >
                            {isSelected && <Check className="size-3 stroke-[2.5]" />}
                          </div>

                          {/* Icon */}
                          <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />

                          {/* Title only */}
                          <span
                            className={cn(
                              'text-13 truncate flex-1 leading-normal',
                              isSelected ? 'font-medium text-primary' : 'font-normal text-foreground'
                            )}
                            title={doc.title || 'Untitled Document'}
                          >
                            {doc.title || 'Untitled Document'}
                          </span>

                          {/* Action Buttons on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => handlePreviewDoc(doc, e)}
                              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                              title="Preview extracted text"
                              aria-label="Preview extracted text"
                            >
                              <Eye className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteDoc(doc, e)}
                              disabled={deletingId === doc.id}
                              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                              title="Delete document"
                              aria-label="Delete document"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: 2 buttons only (Cancel, Attach) */}
          <div className="px-4 py-3 flex items-center justify-end gap-2 shrink-0 select-none bg-background">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedDocs.size === 0}
              className="h-8 px-3.5 text-12 font-medium rounded-md cursor-pointer shadow-none"
            >
              Attach
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Content Preview Sub-Dialog */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col p-4 bg-background border border-border shadow-raised-400 rounded-lg">
          <DialogHeader className="pb-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <DialogTitle className="text-13 font-semibold truncate text-foreground">
                {previewDoc?.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-11 text-muted-foreground">
              Extracted document text from vector index.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3 rounded-md bg-muted/30 font-mono text-12 leading-relaxed whitespace-pre-wrap select-text max-h-[50vh] thin-scrollbar">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center p-6 gap-2 text-muted-foreground text-12">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span>Loading preview content...</span>
              </div>
            ) : (
              previewDoc?.content
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default UploadedDocumentsModal;
