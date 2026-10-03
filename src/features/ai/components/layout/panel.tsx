'use client';

import {
  FileText,
  Trash2,
  FileUp,
  FileImage,
  FileCode,
  File,
  Loader2,
  Eye,
  BookOpen,
  Database,
  Search,
  Plus,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
} from 'react';
import { useParams } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { useChatMode } from '../../hooks/use-chat-mode';
import {
  uploadDocument,
  fetchDocumentContent,
  fetchDocuments,
  deleteDocument,
} from '../../services/chat.service';
import type { DocumentItem } from '../../types/chat.types';
import { SourcePickerModal } from '../modals/source-picker-modal';
import { DocumentLibraryModal } from '../modals/document-library-modal';
import { toast } from 'sonner';

type UploadingEntry = {
  tempId: string;
  name: string;
  size: number;
  error?: boolean;
};

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.ts,.tsx,.js,.json';

function getFileIcon(name: string) {
  const n = (name || '').toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(n))
    return <FileImage className="size-3.5 shrink-0 text-primary" />;
  if (/\.(pdf|doc|docx)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-destructive" />;
  if (/\.(xls|xlsx|csv)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-success" />;
  if (/\.(ts|tsx|js|jsx|json)$/.test(n))
    return <FileCode className="size-3.5 shrink-0 text-primary" />;
  if (/\.(md|txt)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-warning" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground/40" />;
}

export function Panel() {
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId;
  const {
    sources,
    addSource,
    removeSource,
    toggleSource,
    setFluxDataEnabled,
  } = useChatMode();

  const [activeTab, setActiveTab] = useState<'chat' | 'library'>('chat');
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ name: string; content: string } | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  // Knowledge base state in panel
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAllDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const data = await fetchDocuments(projectId);
      setAllDocs(data);
    } catch {
      // ignore
    } finally {
      setLoadingDocs(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'library') {
      loadAllDocs();
    }
  }, [activeTab, loadAllDocs]);

  const handleUpload = useCallback(
    async (file: File) => {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setUploading((prev) => [
        ...prev,
        { tempId, name: file.name, size: file.size },
      ]);

      try {
        const res = await uploadDocument(projectId || 'me', file);
        addSource(res.id, res.name, { size: res.size || file.size, sourceType: 'upload' });
        setFluxDataEnabled(true);
        if (activeTab === 'library') loadAllDocs();
      } catch {
        setUploading((prev) =>
          prev.map((e) => (e.tempId === tempId ? { ...e, error: true } : e)),
        );
      } finally {
        setUploading((prev) => prev.filter((e) => e.tempId !== tempId));
      }
    },
    [projectId, addSource, setFluxDataEnabled, activeTab, loadAllDocs],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handleViewContent = async (docId: string, name: string) => {
    setViewingLoading(true);
    setViewingDoc({ name, content: '' });
    try {
      const res = await fetchDocumentContent(docId);
      setViewingDoc({ name, content: res.text || 'No content available.' });
    } catch {
      setViewingDoc({ name, content: 'Failed to load document content.' });
    } finally {
      setViewingLoading(false);
    }
  };

  const handleDeleteLibraryDoc = async (docId: string, title: string) => {
    if (!confirm(`Xóa vĩnh viễn tài liệu "${title}" khỏi vector store?`)) return;
    try {
      await deleteDocument(docId, projectId);
      setAllDocs((prev) => prev.filter((d) => d.id !== docId));
      removeSource(docId);
      toast.success(`Đã xóa ${title}`);
    } catch {
      toast.error('Không thể xóa tài liệu');
    }
  };

  const allChecked = sources.length > 0 && sources.every((s) => s.enabled);

  const handleToggleAll = (checked: boolean) => {
    sources.forEach((s) => {
      if (s.enabled !== checked) {
        toggleSource(s.id);
      }
    });
  };

  const activeSourceSet = new Set(sources.filter((s) => s.enabled).map((s) => s.id));

  const filteredLibraryDocs = allDocs.filter((d) =>
    (d.title || '').toLowerCase().includes(docSearch.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Tab Switcher: Chat Sources vs Knowledge Base */}
      <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/60 text-xs shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={cn(
            "flex-1 py-1 px-2 rounded-md font-medium text-center transition-all cursor-pointer",
            activeTab === 'chat'
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Trong Chat ({sources.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={cn(
            "flex-1 py-1 px-2 rounded-md font-medium text-center transition-all cursor-pointer flex items-center justify-center gap-1.5",
            activeTab === 'library'
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Database className="size-3 text-primary shrink-0" />
          <span>Kho dữ liệu</span>
        </button>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors shrink-0 ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) handleUpload(file);
                e.target.value = '';
              }}
            />
            <FileUp className="size-5 mx-auto mb-1.5 text-muted-foreground shrink-0" />
            <p className="text-11 font-medium text-foreground">Kéo thả file hoặc bấm để tải lên</p>
            <p className="text-10 text-muted-foreground mt-0.5">PDF, DOC, TXT, CSV, Code</p>
          </div>

          {/* Library Link Buttons */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <button
              onClick={() => setSourcePickerOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border border-border bg-background hover:bg-muted text-11 font-medium text-foreground transition-colors cursor-pointer"
            >
              <BookOpen className="size-3 text-primary shrink-0" />
              <span>Từ Library</span>
            </button>

            <button
              onClick={() => setLibraryModalOpen(true)}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border border-border bg-background hover:bg-muted text-11 font-medium text-foreground transition-colors cursor-pointer"
            >
              <Database className="size-3 text-primary shrink-0" />
              <span>Quản lý kho</span>
            </button>
          </div>

          {/* Uploading progress list */}
          {uploading.length > 0 && (
            <div className="space-y-1.5 shrink-0">
              {uploading.map((entry) => (
                <div
                  key={entry.tempId}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sources List in Chat */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => handleToggleAll(e.target.checked)}
                  className="rounded border-border text-primary size-3.5"
                />
                <span>Chọn tất cả ({sources.length})</span>
              </label>
            </div>

            {sources.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Chưa có tài liệu nào trong phiên chat này. Tải lên hoặc chọn từ kho dữ liệu để AI tra cứu.
              </div>
            ) : (
              <div className="space-y-1">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="group flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted transition-colors text-xs border border-transparent hover:border-border/60"
                  >
                    <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={src.enabled}
                        onChange={() => toggleSource(src.id)}
                        className="rounded border-border text-primary size-3.5 shrink-0"
                      />
                      {getFileIcon(src.name)}
                      <span className="truncate text-foreground/90 font-medium">{src.name}</span>
                    </label>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleViewContent(src.id, src.name)}
                            className="p-1 rounded-md hover:bg-muted text-foreground cursor-pointer"
                          >
                            <Eye className="size-3 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          Xem trước
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => removeSource(src.id)}
                            className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          Bỏ khỏi chat
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Knowledge Base Tab */
        <div className="flex-1 flex flex-col min-h-0 space-y-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex-1">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Tìm tài liệu..."
                className="pl-8 h-7 text-xs bg-muted/30 border-border"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAllDocs}
                  disabled={loadingDocs}
                  className="size-7 p-0 shrink-0"
                >
                  <RefreshCw className={cn("size-3", loadingDocs && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Làm mới kho dữ liệu</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
            {loadingDocs && allDocs.length === 0 ? (
              <div className="flex items-center justify-center p-8 gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Đang tải kho tài liệu...</span>
              </div>
            ) : filteredLibraryDocs.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {docSearch ? 'Không tìm thấy tài liệu' : 'Kho dữ liệu chưa có tài liệu nào'}
              </div>
            ) : (
              filteredLibraryDocs.map((doc) => {
                const isAttached = activeSourceSet.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "group p-2 rounded-lg border text-xs transition-colors flex flex-col gap-1.5",
                      isAttached ? "bg-primary/[0.03] border-primary/40" : "bg-card border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {getFileIcon(doc.title)}
                        <span className="font-medium text-foreground truncate" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                      <span className="text-9 px-1 rounded bg-muted text-muted-foreground shrink-0">
                        {doc.chunk_count || 1} chunks
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <button
                        onClick={() => {
                          if (isAttached) {
                            removeSource(doc.id);
                          } else {
                            addSource(doc.id, doc.title, { sourceType: 'upload' });
                            setFluxDataEnabled(true);
                          }
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 text-10 font-medium px-2 py-0.5 rounded cursor-pointer transition-colors",
                          isAttached
                            ? "bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                      >
                        {isAttached ? (
                          <>
                            <Check className="size-3" />
                            <span>Đang dùng</span>
                          </>
                        ) : (
                          <>
                            <Plus className="size-3" />
                            <span>Thêm vào chat</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewContent(doc.id, doc.title)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                          title="Xem nội dung"
                        >
                          <Eye className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteLibraryDoc(doc.id, doc.title)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setLibraryModalOpen(true)}
            className="w-full text-xs h-8 gap-1.5 shrink-0"
          >
            <ExternalLink className="size-3" />
            <span>Mở kho tài liệu đầy đủ</span>
          </Button>
        </div>
      )}

      {/* Doc Preview Modal */}
      <Dialog open={Boolean(viewingDoc)} onOpenChange={(o) => !o && setViewingDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-5 bg-background">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-sm font-semibold truncate">{viewingDoc?.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Nội dung văn bản được lưu trữ trong vector store.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 rounded-lg bg-muted/40 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[55vh] select-text">
            {viewingLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4.5 animate-spin text-primary shrink-0" />
                <span>Đang tải nội dung...</span>
              </div>
            ) : (
              viewingDoc?.content
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Source Picker Modal (Library & Storage) */}
      <SourcePickerModal
        open={sourcePickerOpen}
        onOpenChange={setSourcePickerOpen}
        scopeId={projectId || 'me'}
      />

      {/* Full Document Knowledge Base Modal */}
      <DocumentLibraryModal
        open={libraryModalOpen}
        onOpenChange={setLibraryModalOpen}
        projectId={projectId}
      />
    </div>
  );
}

// Backward compatibility aliases
export const SourcePanel = Panel;
export const WikiChatFeatures = Panel;
export default Panel;
