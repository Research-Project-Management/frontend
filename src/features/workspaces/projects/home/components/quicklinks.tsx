'use client';

import React, { useState } from 'react';
import { Section } from './layouts/section';
import { Plus, Globe, MoreVertical, Pencil, ExternalLink, Link2, Trash2, FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useQuicklinks } from '../hooks/use-quicklinks';
import { QuicklinkModal } from './modals/quicklink-modal';
import { DeleteModal } from './modals/delete-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { Quicklink } from '../types/home.types';

const getDisplayTitle = (title: string, url: string) => {
  if (title && title !== url) return title;
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return title || url;
  }
};

const getQuicklinkIcon = (url: string, title?: string) => {
  const lower = ((title || '') + ' ' + url).toLowerCase();
  if (lower.includes('doc') || lower.includes('wiki') || lower.includes('readme') || lower.includes('paper') || lower.includes('page')) {
    return FileText;
  }
  return Globe;
};

// --- Main Component ---
export default function Quicklinks() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { state, actions } = useQuicklinks(workspaceId);
  const { links, isLoaded } = state;
  const { addQuicklink, updateQuicklink, removeQuicklink } = actions;
  const [modalOpen, setModalOpen] = useState(false);
  const [editLink, setEditLink] = useState<Quicklink | null>(null);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);

  const handleAddClick = () => {
    setEditLink(null);
    setModalOpen(true);
  };

  const handleEditClick = (link: Quicklink) => {
    setEditLink(link);
    setModalOpen(true);
  };

  const actionButton = (
    <button
      onClick={handleAddClick}
      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline transition-colors cursor-pointer"
    >
      <Plus className="size-3.5 text-primary shrink-0" />
      <span>Add quicklink</span>
    </button>
  );

  return (
    <>
      <Section title="Quicklinks" action={actionButton}>
        {!isLoaded ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : links.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {links.map((link) => {
              const IconComp = getQuicklinkIcon(link.url, link.title);
              return (
                <div
                  key={link.id}
                  className="group relative flex items-center gap-3.5 p-3.5 rounded-md border border-border bg-card transition-colors duration-200"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors" aria-hidden="true">
                    <IconComp className="size-5 shrink-0 text-foreground" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 pr-6">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground truncate transition-colors before:absolute before:inset-0"
                    >
                      {getDisplayTitle(link.title, link.url)}
                    </a>
                    <span className="text-xs font-normal text-muted-foreground truncate mt-0.5">
                      {formatDistanceToNow(new Date(link.createdAt))} ago
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-muted text-foreground transition-colors duration-150 z-10 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        aria-label="More options"
                      >
                        <MoreVertical className="size-4 shrink-0" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} className="bg-popover">
                    <DropdownMenuItem onClick={() => handleEditClick(link)} className="cursor-pointer">
                      <Pencil className="mr-2 size-4 text-foreground shrink-0" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(link.url, '_blank')} className="cursor-pointer">
                      <ExternalLink className="mr-2 size-4 text-foreground shrink-0" />
                      Open in new tab
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(link.url)} className="cursor-pointer">
                      <Link2 className="mr-2 size-4 text-foreground shrink-0" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteLinkId(link.id)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-4 text-destructive shrink-0" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-muted border border-dashed border-border rounded-lg mt-3">
            <p className="text-sm text-muted-foreground mb-2">No quicklinks added yet</p>
            <button
              onClick={handleAddClick}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Add your first quicklink
            </button>
          </div>
        )}
      </Section>

      <QuicklinkModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={(data) => {
          if (editLink) {
            updateQuicklink(editLink.id, data);
          } else {
            addQuicklink(data);
          }
        }}
        initialData={editLink || undefined}
      />

      <DeleteModal
        open={!!deleteLinkId}
        onOpenChange={(open) => !open && setDeleteLinkId(null)}
        onConfirm={() => {
          if (deleteLinkId) {
            removeQuicklink(deleteLinkId);
            setDeleteLinkId(null);
          }
        }}
        title="Remove Quicklink"
        description="Are you sure you want to remove this quicklink? This action cannot be undone."
      />
    </>
  );
}
