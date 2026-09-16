'use client';

import React, { useState } from 'react';
import { ProjectLink } from '../types/overview.types';
import { AddLinkModal } from './AddLinkModal';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Plus,
  ExternalLink,
  MoreVertical,
  Link2,
  Copy,
  Edit2,
  Trash2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

interface PinnedLinksCardProps {
  links: ProjectLink[];
  onCreateLink: (data: { title: string; url: string }) => Promise<void>;
  onUpdateLink: (linkId: string, data: { title: string; url: string }) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
}

function getDomain(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
}

export function PinnedLinksCard({
  links,
  onCreateLink,
  onUpdateLink,
  onDeleteLink,
}: PinnedLinksCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null);

  const handleOpenCreate = () => {
    setEditingLink(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (link: ProjectLink) => {
    setEditingLink(link);
    setModalOpen(true);
  };

  const handleCopy = (url: string) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard', { id: 'project-link-action' });
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await onDeleteLink(linkId);
      toast.success('Link removed', { id: 'project-link-action' });
    } catch {
      toast.error('Failed to delete link', { id: 'project-link-action' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Pinned Resources & Links
          </h2>
          {links.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {links.length}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenCreate}
          className="h-8 gap-1 text-xs font-medium"
        >
          <Plus className="size-3.5" />
          Add link
        </Button>
      </div>

      {/* Links List / Empty state */}
      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center rounded-lg border border-dashed border-border/70 bg-muted/20">
          <Globe className="size-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-medium text-foreground">No pinned resources yet</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
            Pin important files, Figma boards, GitHub repos, or documentation for easy access by the team.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenCreate}
            className="mt-3 h-7 text-xs text-primary gap-1"
          >
            <Plus className="size-3" />
            Add first link
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {links.map((link) => {
            const domain = getDomain(link.url);
            return (
              <div
                key={link.id}
                className="group relative flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/60 p-3 hover:border-border hover:bg-muted/30 transition-all shadow-xs"
              >
                {/* Link click anchor */}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-w-0 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 shrink-0 transition-colors">
                    <Globe className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {link.title}
                      </p>
                      <ExternalLink className="size-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {domain}
                    </p>
                  </div>
                </a>

                {/* Dropdown action */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onClick={() => handleCopy(link.url)}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleOpenEdit(link)}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <Edit2 className="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(link.id)}
                      className="text-xs gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Add / Edit */}
      <AddLinkModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={async (data) => {
          if (editingLink) {
            await onUpdateLink(editingLink.id, data);
          } else {
            await onCreateLink(data);
          }
        }}
        initialData={editingLink}
      />
    </div>
  );
}
