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
} from 'lucide-react';
import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
} from 'react';
import { useParams } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { useChatMode } from '../../hooks/use-chat-mode';
import {
  uploadDocument,
  fetchDocumentContent,
} from '../../services/chat.service';
import { SourcePickerModal } from '../modals/source-picker-modal';

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
    return <FileImage className="size-3.5 shrink-0 text-violet-400" />;
  if (/\.(pdf|doc|docx)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-rose-400" />;
  if (/\.(xls|xlsx|csv)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-emerald-400" />;
  if (/\.(ts|tsx|js|jsx|json)$/.test(n))
    return <FileCode className="size-3.5 shrink-0 text-sky-400" />;
  if (/\.(md|txt)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-amber-400" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground/40" />;
}

export function Panel() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const {
    sources,
    addSource,
    removeSource,
    toggleSource,
  } = useChatMode();

  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ name: string; content: string } | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!workspaceId) return;

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setUploading((prev) => [
        ...prev,
        { tempId, name: file.name, size: file.size },
      ]);

      try {
        const res = await uploadDocument(workspaceId, file);
        addSource(res.id, res.name);
      } catch {
        setUploading((prev) =>
          prev.map((e) => (e.tempId === tempId ? { ...e, error: true } : e)),
        );
      } finally {
        setUploading((prev) => prev.filter((e) => e.tempId !== tempId));
      }
    },
    [workspaceId, addSource],
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

  const allChecked = sources.length > 0 && sources.every((s) => s.enabled);

  const handleToggleAll = (checked: boolean) => {
    sources.forEach((s) => {
      if (s.enabled !== checked) {
        toggleSource(s.id);
      }
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border/60 hover:border-primary/40 hover:bg-secondary/30'
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
        <FileUp className="size-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">Upload reference documents</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOC, TXT, MD, CSV, code files</p>
      </div>

      {/* Library Link Button */}
      {workspaceId && (
        <button
          onClick={() => setSourcePickerOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 text-xs font-medium text-foreground transition-colors"
        >
          <BookOpen className="size-3.5 text-primary" />
          <span>Add from Paper Library</span>
        </button>
      )}

      {/* Uploading progress list */}
      {uploading.length > 0 && (
        <div className="space-y-1.5">
          {uploading.map((entry) => (
            <div
              key={entry.tempId}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                <span className="truncate">{entry.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => handleToggleAll(e.target.checked)}
              className="rounded border-border text-primary size-3.5"
            />
            <span>Select All Sources ({sources.length})</span>
          </label>
        </div>

        {sources.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No source documents added yet. Upload files or select from Library to ground AI responses.
          </div>
        ) : (
          <div className="space-y-1">
            {sources.map((src) => (
              <div
                key={src.id}
                className="group flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/40 transition-colors text-xs"
              >
                <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={src.enabled}
                    onChange={() => toggleSource(src.id)}
                    className="rounded border-border text-primary size-3.5 shrink-0"
                  />
                  {getFileIcon(src.name)}
                  <span className="truncate text-foreground/90">{src.name}</span>
                </label>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewContent(src.id, src.name)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Preview content
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => removeSource(src.id)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Remove source
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Doc Preview Modal */}
      <Dialog open={Boolean(viewingDoc)} onOpenChange={(o) => !o && setViewingDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">{viewingDoc?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 rounded-lg bg-secondary/30 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {viewingLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              viewingDoc?.content
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Source Picker Modal */}
      {workspaceId && (
        <SourcePickerModal
          open={sourcePickerOpen}
          onOpenChange={setSourcePickerOpen}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

// Backward compatibility aliases
export const SourcePanel = Panel;
export const WikiChatFeatures = Panel;
export default Panel;
