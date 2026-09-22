'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  HardDrive,
  UploadCloud,
  FileImage,
  FileCode,
  FileSpreadsheet,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { useChatMode } from '../../hooks/use-chat-mode';
import {
  useCollections,
  useItems as usePapers,
  type Collection,
  type Paper,
} from '@/features/library';
import { storageFileService, type StorageItem } from '@/features/storage';
import { uploadDocument } from '../../services/chat.service';

export interface SourcePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  scopeId?: string;
  initialTab?: 'library' | 'storage';
}

type SelectedSource = {
  id: string;
  name: string;
  sourceType: 'library' | 'storage' | 'upload';
  size?: number;
};

type TreeNode = Collection & { children: TreeNode[] };

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const n = (name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(n))
    return <FileImage className="size-3.5 shrink-0 text-muted-foreground" />;
  if (/\.(pdf|doc|docx)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-muted-foreground" />;
  if (/\.(xls|xlsx|csv)$/.test(n))
    return <FileSpreadsheet className="size-3.5 shrink-0 text-muted-foreground" />;
  if (/\.(ts|tsx|js|jsx|json|py|java|cpp|c|go|rs|md|txt)$/.test(n))
    return <FileCode className="size-3.5 shrink-0 text-muted-foreground" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground" />;
}

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) map.set(c.id, { ...c, children: [] });

  for (const node of map.values()) {
    const parentId = node.parentId || (node as any).parent;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function branchNameMatches(node: TreeNode, query: string): boolean {
  return (
    node.name.toLowerCase().includes(query) ||
    node.children.some((child: TreeNode) => branchNameMatches(child, query))
  );
}

const isIndexedPaper = (paper: Paper): paper is Paper & { ragDocId: string } =>
  paper.ragStatus === 'indexed' && typeof paper.ragDocId === 'string' && paper.ragDocId.length > 0;

const compactAuthors = (paper: Paper) => {
  if (!paper.authors.length) return '';
  if (paper.authors.length === 1) return paper.authors[0];
  return `${paper.authors[0]} et al.`;
};

export function SourcePickerModal({
  open,
  onOpenChange,
  projectId,
  scopeId,
  initialTab = 'library',
}: SourcePickerModalProps) {
  const { addSource, sources, setFluxDataEnabled } = useChatMode();

  const [activeTab, setActiveTab] = useState<'library' | 'storage'>(initialTab);

  useEffect(() => {
    if (initialTab && open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  // ── Library State ──────────────────────────────────────────────────────────
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [librarySearch, setLibrarySearch] = useState('');

  const effectiveScopeId = scopeId || projectId || 'user';
  const { state: collectionsState } = useCollections(effectiveScopeId);
  const { state: papersState } = usePapers({
    scopeId: effectiveScopeId,
    collectionId: selectedCollectionId,
  });

  const collections = collectionsState.collections;
  const collectionsLoading = collectionsState.isLoading;

  const activePapers = useMemo(() => {
    const raw = selectedCollectionId
      ? (Array.isArray(papersState.collectionPapers)
          ? papersState.collectionPapers
          : (papersState.collectionPapers as any)?.papers ?? [])
      : papersState.allPapers ?? [];
    return (raw as Paper[]).filter(isIndexedPaper);
  }, [papersState, selectedCollectionId]);

  const papersLoading = selectedCollectionId
    ? papersState.isLoadingCollection
    : papersState.isLoadingAll;

  const tree = useMemo(() => buildTree(collections), [collections]);

  // ── Storage State ──────────────────────────────────────────────────────────
  const [storageFiles, setStorageFiles] = useState<StorageItem[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageSearch, setStorageSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && activeTab === 'storage' && storageFiles.length === 0) {
      setStorageLoading(true);
      storageFileService
        .getMyFiles()
        .then((res: any) => {
          const raw = Array.isArray(res) ? res : res?.files || [];
          const files = raw.filter((f: StorageItem) => !f.isFolder);
          setStorageFiles(files);
        })
        .catch(() => {
          setStorageFiles([]);
        })
        .finally(() => {
          setStorageLoading(false);
        });
    }
  }, [open, activeTab, storageFiles.length]);

  const filteredStorageFiles = useMemo(() => {
    if (!storageSearch.trim()) return storageFiles;
    const q = storageSearch.toLowerCase();
    return storageFiles.filter((f) => (f.filename || f.name || '').toLowerCase().includes(q));
  }, [storageFiles, storageSearch]);

  // ── Selected Sources State ────────────────────────────────────────────────
  const [pendingSelection, setPendingSelection] = useState<Map<string, SelectedSource>>(new Map());

  const togglePaper = (p: Paper) => {
    if (!isIndexedPaper(p)) return;
    setPendingSelection((prev) => {
      const next = new Map(prev);
      if (next.has(p.ragDocId)) {
        next.delete(p.ragDocId);
      } else {
        next.set(p.ragDocId, {
          id: p.id,
          name: p.title,
          sourceType: 'library',
        });
      }
      return next;
    });
  };

  const toggleStorageFile = (file: StorageItem) => {
    setPendingSelection((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.set(file.id, {
          id: file.id,
          name: file.filename || file.name || 'Document',
          sourceType: 'storage',
          size: file.size,
        });
      }
      return next;
    });
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const targetScope = projectId || 'me';
      const res = await uploadDocument(targetScope, file);
      setPendingSelection((prev) => {
        const next = new Map(prev);
        next.set(res.id, {
          id: res.id,
          name: res.name,
          sourceType: 'upload',
          size: res.size,
        });
        return next;
      });
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(`Failed to upload ${file.name}: ${err?.message || 'Upload error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApply = () => {
    let addedCount = 0;
    pendingSelection.forEach((item) => {
      if (!sources.some((s) => s.id === item.id)) {
        addSource(item.id, item.name, {
          size: item.size,
          sourceType: item.sourceType,
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setFluxDataEnabled(true);
      toast.success(`Attached ${addedCount} source(s) to AI context`);
    }

    setPendingSelection(new Map());
    onOpenChange(false);
  };

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map((node) => {
      const isExp = expanded.has(node.id);
      const isSel = selectedCollectionId === node.id;
      const hasChildren = node.children.length > 0;

      if (librarySearch && !branchNameMatches(node, librarySearch.toLowerCase())) {
        return null;
      }

      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedCollectionId(node.id)}
            className={cn(
              'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-12 transition-colors text-left',
              isSel ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80',
            )}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
                className="p-0.5 hover:bg-muted rounded"
              >
                <ChevronRight
                  className={cn('size-3 text-muted-foreground transition-transform shrink-0', isExp && 'rotate-90')}
                />
              </span>
            ) : (
              <span className="size-4" />
            )}

            {isExp ? (
              <FolderOpen className="size-3.5 text-warning shrink-0" />
            ) : (
              <Folder className="size-3.5 text-warning shrink-0" />
            )}

            <span className="truncate flex-1">{node.name}</span>
          </button>

          {hasChildren && isExp && <div className="pl-3">{renderTree(node.children)}</div>}
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header with Title & Tab Navigation */}
        <DialogHeader className="px-5 pt-4 pb-0 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-15 font-semibold text-foreground">
              Attach Sources
            </DialogTitle>
          </div>

          <div className="flex items-center gap-4 pt-2.5 -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={cn(
                "flex items-center gap-2 pb-2 text-13 font-medium border-b-2 transition-colors cursor-pointer",
                activeTab === 'library'
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="size-4 shrink-0" />
              <span>Paper Library</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('storage')}
              className={cn(
                "flex items-center gap-2 pb-2 text-13 font-medium border-b-2 transition-colors cursor-pointer",
                activeTab === 'storage'
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <HardDrive className="size-4 shrink-0" />
              <span>Storage & Upload</span>
            </button>
          </div>
        </DialogHeader>

        {/* Tab 1: Library */}
        {activeTab === 'library' && (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border/40 overflow-hidden min-h-[360px]">
            {/* Collections tree */}
            <div className="md:col-span-2 p-3 flex flex-col overflow-hidden bg-muted/40">
              <div className="mb-2">
                <Input
                  placeholder="Filter collections..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="h-7 text-12 shadow-none"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId(undefined)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-12 text-left transition-colors',
                    selectedCollectionId === undefined
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-foreground/80',
                  )}
                >
                  <BookOpen className="size-3.5 text-primary shrink-0" />
                  <span className="truncate">All Library Papers</span>
                </button>

                {collectionsLoading ? (
                  <div className="p-2 space-y-1.5">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                  </div>
                ) : (
                  renderTree(tree)
                )}
              </div>
            </div>

            {/* Papers list */}
            <div className="md:col-span-3 p-3 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-2">
                {papersLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                  </div>
                ) : activePapers.length === 0 ? (
                  <div className="p-8 text-center text-12 text-muted-foreground">
                    No indexed papers found in this collection.
                  </div>
                ) : (
                  activePapers.map((paper) => {
                    const checked =
                      pendingSelection.has(paper.ragDocId) ||
                      sources.some((s) => s.id === paper.ragDocId);
                    const alreadyAdded = sources.some((s) => s.id === paper.ragDocId);

                    return (
                      <div
                        key={paper.id}
                        onClick={() => !alreadyAdded && togglePaper(paper)}
                        className={cn(
                          'flex items-start gap-2.5 p-2.5 rounded-md border text-12 transition-colors cursor-pointer',
                          alreadyAdded
                            ? 'border-border bg-muted/20 opacity-60 cursor-default'
                            : checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={alreadyAdded}
                          onCheckedChange={() => !alreadyAdded && togglePaper(paper)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                            <p className="font-medium text-foreground truncate">{paper.title}</p>
                          </div>
                          <p className="text-11 text-muted-foreground mt-0.5 truncate">
                            {[compactAuthors(paper), paper.year].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Storage & Upload */}
        {activeTab === 'storage' && (
          <div className="flex-1 p-4 flex flex-col overflow-hidden min-h-[360px] space-y-3.5">
            {/* Upload Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) handleUploadFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) handleUploadFile(file);
                  e.target.value = '';
                }}
              />
              <UploadCloud className="size-6 mx-auto mb-1 text-muted-foreground shrink-0" />
              <p className="text-12 font-medium text-foreground">Upload reference documents</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                Drag & drop or click to upload PDF, DOCX, TXT, MD, CSV, code files
              </p>
              {isUploading && (
                <div className="flex items-center justify-center gap-2 mt-2 text-12 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                  <span>Uploading file...</span>
                </div>
              )}
            </div>

            {/* Storage Files List */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between pb-2">
                <span className="text-12 font-medium text-foreground">Storage Files</span>
                <div className="w-52">
                  <Input
                    placeholder="Filter files..."
                    value={storageSearch}
                    onChange={(e) => setStorageSearch(e.target.value)}
                    className="h-7 text-12 px-2 shadow-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                {storageLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                  </div>
                ) : filteredStorageFiles.length === 0 ? (
                  <div className="p-6 text-center text-12 text-muted-foreground">
                    No files found in storage. Upload files above to attach them.
                  </div>
                ) : (
                  filteredStorageFiles.map((file) => {
                    const checked =
                      pendingSelection.has(file.id) || sources.some((s) => s.id === file.id);
                    const alreadyAdded = sources.some((s) => s.id === file.id);

                    return (
                      <div
                        key={file.id}
                        onClick={() => !alreadyAdded && toggleStorageFile(file)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md border text-12 transition-colors cursor-pointer",
                          alreadyAdded
                            ? "border-border bg-muted/20 opacity-60 cursor-default"
                            : checked
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Checkbox
                            checked={checked}
                            disabled={alreadyAdded}
                            onCheckedChange={() => !alreadyAdded && toggleStorageFile(file)}
                          />
                          {getFileIcon(file.filename || file.name || '')}
                          <span className="truncate text-foreground font-medium">
                            {file.filename || file.name}
                          </span>
                        </div>
                        <span className="text-11 text-muted-foreground shrink-0 ml-2">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-background">
          <span className="text-12 text-muted-foreground">
            {pendingSelection.size} source(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={pendingSelection.size === 0}
            >
              Attach Sources
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SourcePickerModal;
