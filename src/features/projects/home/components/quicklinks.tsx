'use client';

import React, { useState } from 'react';
import { Section } from './layouts/section';
import { Plus, Globe, MoreVertical, Pencil, ExternalLink, Link2, Trash2, FileText } from 'lucide-react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import dynamic from 'next/dynamic';
import { useQuicklinks } from '../hooks/use-quicklinks';

const QuicklinkModal = dynamic(
  () => import('./modals/quicklink-modal').then((m) => m.QuicklinkModal),
  { ssr: false }
);

const DeleteModal = dynamic(
  () => import('./modals/delete-modal').then((m) => m.DeleteModal),
  { ssr: false }
);
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

export default function Quicklinks() {
  const { state, actions } = useQuicklinks();
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
      type="button"
      onClick={handleAddClick}
      className="relative flex items-center gap-1.5 text-12 font-medium text-primary hover:underline transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
    >
      <Plus className="size-3.5 text-primary shrink-0" />
      <span>Add quicklink</span>
    </button>
  );

  return (
    <>
      <Section title="Quicklinks" action={actionButton}>
        {!isLoaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-[74px] rounded-md border border-border bg-card p-3.5 flex items-center gap-3.5 animate-pulse motion-reduce:animate-none"
              >
                <div className="size-10 rounded-md bg-muted shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3.5 w-24 bg-muted rounded" />
                  <div className="h-2.5 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
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
                      className="text-13 font-medium text-foreground truncate transition-colors before:absolute before:inset-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {getDisplayTitle(link.title, link.url)}
                    </a>
                    <span className="font-mono text-11 text-muted-foreground truncate mt-0.5">
                      {formatDistanceToNow(new Date(link.createdAt))} ago
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-muted text-foreground transition-colors duration-150 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
                        aria-label="More options"
                      >
                        <MoreVertical className="size-4 shrink-0" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()} className="bg-popover shadow-overlay">
                    <DropdownMenuItem onClick={() => handleEditClick(link)} className="cursor-pointer text-12">
                      <Pencil className="mr-2 size-3.5 text-foreground shrink-0" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open(link.url, '_blank')} className="cursor-pointer text-12">
                      <ExternalLink className="mr-2 size-3.5 text-foreground shrink-0" />
                      Open in new tab
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(link.url)} className="cursor-pointer text-12">
                      <Link2 className="mr-2 size-3.5 text-foreground shrink-0" />
                      Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteLinkId(link.id)}
                      className="cursor-pointer text-12 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5 text-destructive shrink-0" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-13 text-foreground/80 mb-2">No quicklinks added yet</p>
            <button
              type="button"
              onClick={handleAddClick}
              className="relative text-12 font-medium text-primary hover:underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            >
              Add your first quicklink
            </button>
          </div>
        )}
      </Section>

      {modalOpen && (
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
      )}

      {deleteLinkId && (
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
      )}
    </>
  );
}
