'use client';

import React, { useState } from 'react';
import { Paperclip, ExternalLink, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/shared/components/ui';

export type TaskAttachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: string;
  url: string;
};

export type TaskAttachmentsProps = {
  attachments: TaskAttachment[];
  onRenameAttachment: (attachmentId: string, newName: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onCommentAttachment?: (attachment: TaskAttachment) => void;
  onDownloadAttachment?: (attachment: TaskAttachment) => void;
  isReadOnly?: boolean;
};

function getAttachmentTypeLabel(attachment: TaskAttachment) {
  const name = attachment.name.trim();
  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  const mimeType = attachment.type?.split('/')[0] || '';

  if (extension) return extension;
  if (mimeType === 'image') return 'IMG';
  if (mimeType === 'video') return 'VID';
  if (mimeType === 'audio') return 'AUD';
  if (mimeType === 'application') return 'FILE';

  return 'FILE';
}

function formatAttachmentMeta(createdAt: string) {
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return 'Added';

  const diffInMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Added just now';
  if (diffInMinutes < 60) return `Added ${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Added ${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `Added ${diffInDays}d ago`;
}

export function TaskAttachments({
  attachments,
  onRenameAttachment,
  onRemoveAttachment,
  onCommentAttachment,
  onDownloadAttachment,
  isReadOnly = false,
}: TaskAttachmentsProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renameItem, setRenameItem] = useState<TaskAttachment | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (attachments.length === 0) return null;

  const handleOpenRename = (item: TaskAttachment) => {
    setRenameItem(item);
    setRenameValue(item.name);
    setActiveMenuId(null);
  };

  const handleSaveRename = () => {
    if (!renameItem || !renameValue.trim()) return;
    onRenameAttachment(renameItem.id, renameValue.trim());
    setRenameItem(null);
    setRenameValue('');
  };

  return (
    <>
      <div className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Paperclip className="size-4 text-zinc-500" />
          <h3 className="text-[16px] font-bold text-foreground">Attachments</h3>
        </div>
        <div className="space-y-3 pl-1">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-4 rounded-sm px-2 py-2 transition-colors hover:bg-zinc-100"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-zinc-100 text-[15px] font-bold text-zinc-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  {getAttachmentTypeLabel(item)}
                </div>

                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block min-w-0 max-w-full truncate text-[14px] font-semibold text-foreground hover:underline"
                    title={item.name}
                  >
                    {item.name}
                  </a>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    {formatAttachmentMeta(item.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 self-stretch">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-8 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted"
                  aria-label={`Open ${item.name}`}
                >
                  <ExternalLink className="size-4 text-foreground" />
                </a>
                {!isReadOnly && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                      className="inline-flex size-8 items-center justify-center rounded-sm text-foreground transition-colors hover:bg-muted cursor-pointer"
                      aria-label={`Options for ${item.name}`}
                    >
                      <MoreHorizontal className="size-4 text-foreground" />
                    </button>

                    {activeMenuId === item.id ? (
                      <div className="absolute right-0 top-full mt-2 z-30 w-44 rounded-sm border border-border bg-popover p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => handleOpenRename(item)}
                          className="flex w-full items-center rounded-sm px-3 py-2 text-left text-[14px] text-foreground hover:bg-muted cursor-pointer"
                        >
                          Edit
                        </button>
                        {onCommentAttachment && (
                          <button
                            type="button"
                            onClick={() => {
                              onCommentAttachment(item);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-[14px] text-foreground hover:bg-muted cursor-pointer"
                          >
                            Comment
                          </button>
                        )}
                        {onDownloadAttachment && (
                          <button
                            type="button"
                            onClick={() => {
                              onDownloadAttachment(item);
                              setActiveMenuId(null);
                            }}
                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-[14px] text-foreground hover:bg-muted cursor-pointer"
                          >
                            Download
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveAttachment(item.id);
                            setActiveMenuId(null);
                          }}
                          className="flex w-full items-center rounded-sm px-3 py-2 text-left text-[14px] text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rename Attachment Dialog */}
      <Dialog
        open={!!renameItem}
        onOpenChange={(open) => {
          if (!open) setRenameItem(null);
        }}
      >
        <DialogContent className="max-w-130 rounded-sm border-0 p-0 shadow-2xl" showCloseButton={false}>
          <div className="p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[18px] font-bold text-foreground">
                Rename attachment
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-6 text-zinc-500">
                Update the display name for this attachment.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-10 w-full rounded-sm border border-transparent px-4 text-[14px] text-foreground outline-none focus:border-primary"
                placeholder="Enter new file name"
                autoFocus
              />
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-4 text-zinc-500 hover:bg-zinc-100"
                onClick={() => setRenameItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 bg-primary px-4 text-primary-foreground shadow-none hover:bg-primary/90"
                onClick={handleSaveRename}
                disabled={!renameValue.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TaskAttachments;
