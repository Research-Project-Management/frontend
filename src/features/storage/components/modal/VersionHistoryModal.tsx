'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  History,
  UploadCloud,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  User,
  Loader2,
  FileText,
  AlertCircle,
  Plus,
  X,
  FileUp,
  ShieldCheck,
} from 'lucide-react';
import { useFileVersions, useUploadNewVersion, useRevertFileVersion } from '../../hooks/use-file-versions';
import { getVersionDownloadUrl } from '../../services/version.service';
import { downloadFileUrl } from '@/shared/lib/file-client';
import { formatFileSize, formatDate } from '../../utils/storage.util';
import type { StorageItem } from '../../types/storage.types';
import { toast } from 'sonner';

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: StorageItem | null;
}

export default function VersionHistoryModal({
  open,
  onOpenChange,
  file,
}: VersionHistoryModalProps) {
  const fileId = file?.id || '';
  const { data, isLoading, refetch } = useFileVersions(open ? fileId : undefined);
  const { mutateAsync: uploadVersion, isPending: isUploading } = useUploadNewVersion();
  const { mutateAsync: revertVersion, isPending: isReverting } = useRevertFileVersion();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [changeComment, setChangeComment] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmRevertVersion, setConfirmRevertVersion] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!file) return null;

  const versions = data?.versions || [];
  const currentVersionNumber = data?.currentVersionNumber || 1;
  const nextVersionNumber = (data?.versions?.[0]?.versionNumber || 1) + 1;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setSelectedFile(f);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a new version file');
      return;
    }

    try {
      await uploadVersion({
        fileId,
        file: selectedFile,
        changeComment: changeComment.trim() || undefined,
        onProgress: (p) => setUploadProgress(p),
      });

      setSelectedFile(null);
      setChangeComment('');
      setIsUploadOpen(false);
      setUploadProgress(0);
      refetch();
    } catch {
      // Error handled by hook toast
    }
  };

  const handleDownloadVersion = (versionNumber: number) => {
    const url = getVersionDownloadUrl(fileId, versionNumber);
    const dotIndex = file.filename.lastIndexOf('.');
    const versionedName =
      dotIndex !== -1
        ? `${file.filename.slice(0, dotIndex)}_v${versionNumber}${file.filename.slice(dotIndex)}`
        : `${file.filename}_v${versionNumber}`;

    downloadFileUrl(url, versionedName);
    toast.info(`Downloading version ${versionNumber}...`);
  };

  const handleRevertConfirm = async (versionNumber: number) => {
    try {
      await revertVersion({ fileId, versionNumber });
      setConfirmRevertVersion(null);
      refetch();
    } catch {
      // Error handled by hook toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <DialogHeader className="px-6 py-4.5 pr-14 border-b border-border/70 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <History className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span>Version history</span>
                <Badge
                  variant="secondary"
                  className="px-2 py-0.5 text-xs font-mono font-medium bg-primary/10 text-primary border-primary/20"
                >
                  Current v{currentVersionNumber}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={file.filename}>
                {file.filename}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upload New Version Section */}
          {!isUploadOpen ? (
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] hover:bg-primary/[0.07] text-primary transition-all duration-150 group cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <Plus className="size-4.5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Upload new version (v{nextVersionNumber})
                  </p>
                  <p className="text-11 text-muted-foreground">
                    Create a new revision while preserving file links and ID
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-11 border-primary/30 text-primary bg-primary/5">
                Upload
              </Badge>
            </button>
          ) : (
            <div className="p-4.5 rounded-2xl border border-primary/30 bg-primary/[0.04] space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <FileUp className="size-4" />
                  <span>Upload new version: v{nextVersionNumber}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setChangeComment('');
                    setIsUploadOpen(false);
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Close upload"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Dropzone Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-150 ${
                  selectedFile
                    ? 'border-primary bg-primary/10 shadow-2xs'
                    : 'border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/[0.02]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2.5 text-xs text-foreground font-medium">
                    <FileText className="size-4.5 text-primary shrink-0" />
                    <span className="truncate max-w-sm">{selectedFile.name}</span>
                    <Badge variant="secondary" className="font-mono text-11">
                      {formatFileSize(selectedFile.size)}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                      <UploadCloud className="size-5" />
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      Click to choose file or drag & drop here
                    </p>
                    <span className="text-11 text-muted-foreground">
                      Automatic deduplication applied if binary content is identical
                    </span>
                  </div>
                )}
              </div>

              {/* Changelog / Comment Input */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground">
                  Changelog notes (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Added section 4 results, fixed dataset typos..."
                  value={changeComment}
                  onChange={(e) => setChangeComment(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1.5 focus:ring-primary text-foreground placeholder:text-muted-foreground/60 transition-all"
                />
              </div>

              {/* Progress bar */}
              {isUploading && uploadProgress > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Submit & Cancel Buttons */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setChangeComment('');
                    setIsUploadOpen(false);
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedFile || isUploading}
                  onClick={handleUploadSubmit}
                  className="h-8 text-xs gap-1.5 font-medium cursor-pointer shadow-2xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Uploading ({uploadProgress}%)
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-3.5" />
                      Save version v{nextVersionNumber}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Versions Timeline Section */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
              <span className="font-semibold text-foreground/80">Revision timeline ({versions.length} {versions.length === 1 ? 'version' : 'versions'})</span>
              <span className="text-11 text-muted-foreground/70">Sorted newest first</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs">Loading version history...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground bg-muted/10">
                <Clock className="size-8 mx-auto opacity-30 mb-2 text-primary" />
                <p className="text-xs font-medium text-foreground">No revision history</p>
                <span className="text-11 text-muted-foreground">
                  This is the initial version of the file.
                </span>
              </div>
            ) : (
              <div className="relative pl-7 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-0.5 before:bg-border/70">
                {versions.map((ver) => {
                  const isCurrent = ver.isCurrent;
                  const isConfirmingRevert = confirmRevertVersion === ver.versionNumber;

                  return (
                    <div
                      key={ver.id || `ver-${ver.versionNumber}`}
                      className="relative"
                    >
                      {/* Timeline Node Badge on Left */}
                      <div
                        className={`absolute -left-7 top-3.5 size-6 rounded-full flex items-center justify-center text-10 font-bold font-mono ring-4 ring-background shadow-xs transition-colors ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        v{ver.versionNumber}
                      </div>

                      {/* Version Card */}
                      <div
                        className={`p-4 rounded-xl border transition-all duration-150 ${
                          isCurrent
                            ? 'border-primary/40 bg-primary/[0.02] ring-1 ring-primary/10 shadow-2xs'
                            : 'border-border/70 bg-card hover:border-border hover:shadow-2xs'
                        }`}
                      >
                        {/* Top Info & Actions Bar */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">
                              Version {ver.versionNumber}
                            </span>
                            {isCurrent && (
                              <Badge
                                variant="outline"
                                className="h-5 px-2 text-10 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1"
                              >
                                <CheckCircle2 className="size-3" />
                                Current version
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground font-mono">
                              • {formatFileSize(ver.size)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadVersion(ver.versionNumber)}
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs gap-1"
                              title="Download this version"
                            >
                              <Download className="size-3.5" />
                              <span>Download</span>
                            </Button>

                            {!isCurrent && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmRevertVersion(isConfirmingRevert ? null : ver.versionNumber)}
                                className="h-7 px-2.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer gap-1"
                                title="Revert to this version"
                              >
                                <RotateCcw className="size-3.5" />
                                <span>Revert</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Changelog Comment Box */}
                        {ver.changeComment && (
                          <div className="mt-2.5 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-xs text-foreground/90 italic">
                            "{ver.changeComment}"
                          </div>
                        )}

                        {/* Author & Timestamp Footer */}
                        <div className="flex items-center justify-between text-11 text-muted-foreground pt-2.5 mt-2.5 border-t border-border/40">
                          <div className="flex items-center gap-1.5">
                            {ver.author?.avatar ? (
                              <img
                                src={ver.author.avatar}
                                alt={ver.author.name}
                                className="size-4 rounded-full object-cover"
                              />
                            ) : (
                              <User className="size-3.5 text-muted-foreground/60" />
                            )}
                            <span className="font-medium text-foreground/80">{ver.author?.name || 'Researcher'}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="size-3 opacity-60" />
                            <span>{formatDate(ver.createdAt)}</span>
                          </div>
                        </div>

                        {/* Inline Revert Confirmation Warning */}
                        {isConfirmingRevert && (
                          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs space-y-2 animate-in fade-in duration-150">
                            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                              <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                              <span>
                                Reverting to <strong>Version {ver.versionNumber}</strong> will create a new <strong>Version {nextVersionNumber}</strong> containing this exact snapshot.
                              </span>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmRevertVersion(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={isReverting}
                                onClick={() => handleRevertConfirm(ver.versionNumber)}
                                className="h-7 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white gap-1 shadow-2xs"
                              >
                                {isReverting ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3" />
                                )}
                                Confirm revert
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground/80">
            <ShieldCheck className="size-4 text-primary/70 shrink-0" />
            <span>Immutable revision history and audit trail</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
