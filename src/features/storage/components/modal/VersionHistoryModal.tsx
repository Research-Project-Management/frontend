'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
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
  Tag,
} from 'lucide-react';
import { useFileVersions, useUploadNewVersion, useRevertFileVersion } from '../../hooks/use-file-versions';
import { getVersionDownloadUrl } from '../../services/version.service';
import { downloadFileUrl } from '@/shared/lib/file-client';
import { formatFileSize, formatDate } from '../../utils/file';
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <History className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>Version history</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">
                    v{currentVersionNumber}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate max-w-md mt-0.5" title={file.filename}>
                  {file.filename}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsUploadOpen(!isUploadOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
            >
              {isUploadOpen ? (
                <>
                  <X className="size-3.5" />
                  Close upload
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  New version (v{nextVersionNumber})
                </>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Modal Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Upload New Version Collapsible Form */}
          {isUploadOpen && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <FileUp className="size-4" />
                  <span>Upload new version: v{nextVersionNumber}</span>
                </div>
                <span className="text-11 text-muted-foreground">
                  File ID and share links remain preserved
                </span>
              </div>

              {/* Dropzone Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-foreground font-medium">
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="truncate max-w-sm">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(selectedFile.size)})</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-2">
                    <UploadCloud className="size-6 text-muted-foreground/60" />
                    <p className="text-xs text-foreground font-medium">
                      Click or drag new version file here
                    </p>
                    <span className="text-11 text-muted-foreground">
                      Automatic deduplication if file content is unchanged
                    </span>
                  </div>
                )}
              </div>

              {/* Changelog / Comment Input */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Changelog notes (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Added 50 new samples, revised section 4..."
                  value={changeComment}
                  onChange={(e) => setChangeComment(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
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
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setChangeComment('');
                    setIsUploadOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedFile || isUploading}
                  onClick={handleUploadSubmit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
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
                </button>
              </div>
            </div>
          )}

          {/* Versions Timeline Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium">Version timeline ({versions.length} versions)</span>
              <span>Sorted newest first</span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-xs">Loading version history...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground">
                <Clock className="size-8 mx-auto opacity-30 mb-2" />
                <p className="text-xs font-medium text-foreground">No revision history</p>
                <span className="text-11 text-muted-foreground">
                  This is the initial version of the file.
                </span>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
                {versions.map((ver) => {
                  const isCurrent = ver.isCurrent;
                  const isConfirmingRevert = confirmRevertVersion === ver.versionNumber;

                  return (
                    <div
                      key={ver.id || `ver-${ver.versionNumber}`}
                      className={`relative p-3.5 rounded-xl border transition-all ${
                        isCurrent
                          ? 'border-primary/40 bg-primary/[0.03] shadow-xs'
                          : 'border-border/70 bg-card hover:bg-muted/20'
                      }`}
                    >
                      {/* Timeline Node Icon Indicator */}
                      <div
                        className={`absolute -left-[1.85rem] top-4 size-3 rounded-full border-2 bg-background ${
                          isCurrent
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-muted-foreground/40'
                        }`}
                      />

                      {/* Version Top Bar */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-muted text-foreground">
                            v{ver.versionNumber}
                          </span>
                          {isCurrent && (
                            <span className="flex items-center gap-1 text-11 font-medium px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                              <CheckCircle2 className="size-3" />
                              Current
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatFileSize(ver.size)}
                          </span>
                        </div>

                        {/* Actions for this version */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDownloadVersion(ver.versionNumber)}
                            className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Download this version"
                          >
                            <Download className="size-3.5" />
                            Download
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => setConfirmRevertVersion(isConfirmingRevert ? null : ver.versionNumber)}
                              className="flex items-center gap-1 h-7 px-2 rounded-md text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Revert to this version"
                            >
                              <RotateCcw className="size-3.5" />
                              Revert
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Changelog Comment Box */}
                      {ver.changeComment && (
                        <div className="mb-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border/40 text-xs text-foreground/90 italic">
                          "{ver.changeComment}"
                        </div>
                      )}

                      {/* Author & Timestamp Footer */}
                      <div className="flex items-center justify-between text-11 text-muted-foreground pt-1 border-t border-border/30">
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
                          <span>{ver.author?.name || 'Researcher'}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="size-3 opacity-60" />
                          <span>{formatDate(ver.createdAt)}</span>
                        </div>
                      </div>

                      {/* Inline Revert Confirmation Warning */}
                      {isConfirmingRevert && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <span>
                              Are you sure you want to revert to <strong>Version {ver.versionNumber}</strong>?
                              A new <strong>Version {nextVersionNumber}</strong> will be created containing this content.
                            </span>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setConfirmRevertVersion(null)}
                              className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={isReverting}
                              onClick={() => handleRevertConfirm(ver.versionNumber)}
                              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                            >
                              {isReverting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3" />
                              )}
                              Confirm revert
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>Research data version control (WORM & Audit Trail)</span>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
