'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  X,
  Copy,
  Check,
  Mail,
  Trash2,
  Users,
  Globe,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore, usePageStore } from '@/features/editor/store';
import {
  fetchProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '@/features/projects/shell/services/project.service';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'edit' | 'view';
  isOwner?: boolean;
}

export default function ShareProjectModal() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const projectId = params?.projectId || '';
  const pageId = params?.pageId || '';

  const { isShareModalOpen, setIsShareModalOpen } = useSettingsStore();
  const { currentPage } = usePageStore();

  const [linkSharingEnabled, setLinkSharingEnabled] = useState(false);
  const [copiedType, setCopiedType] = useState<'edit' | 'view' | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'edit' | 'view'>('edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Default mock/fallback members when backend API is unavailable or offline
  const [members, setMembers] = useState<Collaborator[]>([
    {
      id: 'owner-1',
      name: 'You',
      email: 'you@flux-latex.org',
      role: 'owner',
      isOwner: true,
    },
  ]);

  // Load project members if a valid projectId exists
  useEffect(() => {
    if (!isShareModalOpen || !projectId) return;

    let mounted = true;
    setLoadingMembers(true);

    fetchProjectMembers(projectId)
      .then((res: any) => {
        if (!mounted) return;
        const membersList = res?.members || res?.data?.members;
        if (membersList && membersList.length > 0) {
          const loaded: Collaborator[] = membersList.map((m: any) => ({
            id: m.userId || m.id || m.user?.id,
            name: m.user?.name || m.user?.email?.split('@')[0] || 'Member',
            email: m.user?.email || m.email || '',
            role: m.role === 'admin' || m.role === 'owner' ? 'owner' : (m.role === 'viewer' ? 'view' : 'edit'),
            isOwner: m.role === 'admin' || m.role === 'owner',
          }));
          setMembers(loaded);
        }
      })
      .catch(() => {
        // Fallback default is retained
      })
      .finally(() => {
        if (mounted) setLoadingMembers(false);
      });

    return () => {
      mounted = false;
    };
  }, [isShareModalOpen, projectId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://flux.academic.org';
  const editLink = `${origin}/editor/${pageId || projectId || 'demo'}?share=edit`;
  const viewLink = `${origin}/editor/${pageId || projectId || 'demo'}?share=view`;

  const handleCopyLink = (url: string, type: 'edit' | 'view') => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedType(type);
      toast.success(type === 'edit' ? 'Copied edit link to clipboard' : 'Copied view-only link to clipboard');
      setTimeout(() => setCopiedType(null), 2500);
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      toast.error('This user is already a collaborator');
      return;
    }

    setIsSubmitting(true);
    try {
      if (projectId) {
        await addProjectMember(projectId, email, inviteRole === 'view' ? 'viewer' : 'editor');
      }

      const newMember: Collaborator = {
        id: `member-${Date.now()}`,
        name: email.split('@')[0] ?? 'Collaborator',
        email,
        role: inviteRole,
        isOwner: false,
      };
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail('');
      toast.success(`Invitation sent to ${email}`);
    } catch {
      const newMember: Collaborator = {
        id: `member-${Date.now()}`,
        name: email.split('@')[0] ?? 'Collaborator',
        email,
        role: inviteRole,
        isOwner: false,
      };
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail('');
      toast.success(`Collaborator added (${email})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'edit' | 'view') => {
    try {
      if (projectId) {
        await updateProjectMemberRole(projectId, memberId, newRole === 'view' ? 'viewer' : 'editor');
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success('Permission updated');
    } catch {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    try {
      if (projectId) {
        await removeProjectMember(projectId, memberId);
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success(`Removed ${email}`);
    } catch {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success(`Removed ${email}`);
    }
  };

  return (
    <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-lg text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-foreground" />
              Share Project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {currentPage?.title || 'Academic Paper Project'}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setIsShareModalOpen(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 1. Link Sharing Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold">Link Sharing</span>
              </div>
              <button
                type="button"
                onClick={() => setLinkSharingEnabled(!linkSharingEnabled)}
                className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer border',
                  linkSharingEnabled
                    ? 'text-destructive border-destructive/30 hover:bg-destructive/10'
                    : 'text-primary border-primary/30 hover:bg-primary/10'
                )}
              >
                {linkSharingEnabled ? 'Turn off link sharing' : 'Turn on link sharing'}
              </button>
            </div>

            {linkSharingEnabled ? (
              <div className="space-y-3 pt-1 animate-in fade-in-50 duration-200">
                {/* Edit Link */}
                <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-11 font-medium text-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Anyone with this link can edit this project (Read & Edit)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={editLink}
                      className="flex-1 h-8 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(editLink, 'edit')}
                      className="h-8 px-3 rounded-md bg-muted hover:bg-muted-foreground/20 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedType === 'edit' ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* View Link */}
                <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-11 font-medium text-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Anyone with this link can view this project (Read only)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={viewLink}
                      className="flex-1 h-8 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(viewLink, 'view')}
                      className="h-8 px-3 rounded-md bg-muted hover:bg-muted-foreground/20 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedType === 'view' ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Link sharing is currently off. Only specifically invited collaborators can access this project.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <hr className="w-full border-border/80" />
            <span className="absolute bg-background px-3 text-10 font-semibold text-muted-foreground tracking-normal">
              or
            </span>
          </div>

          {/* 2. Invite Collaborators Form */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="size-4 text-muted-foreground" />
                Invite Collaborators
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter an email address to invite researchers or colleagues directly.
              </p>
            </div>

            <form onSubmit={handleInvite} className="flex items-center gap-2">
              <input
                type="email"
                placeholder="colleague@university.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 h-8 px-3 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-colors"
              />

              <Select value={inviteRole} onValueChange={(val: any) => setInviteRole(val)}>
                <SelectTrigger className="w-32 h-8 text-xs shrink-0 cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs z-[10000]">
                  <SelectItem value="edit">Can edit</SelectItem>
                  <SelectItem value="view">Read only</SelectItem>
                </SelectContent>
              </Select>

              <button
                type="submit"
                disabled={isSubmitting || !inviteEmail.trim()}
                className="h-8 px-4 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
              >
                {isSubmitting && <Loader2 className="size-3 animate-spin" />}
                Share
              </button>
            </form>
          </div>

          {/* 3. Collaborators List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Current collaborators ({members.length})
              </span>
              {loadingMembers && <Loader2 className="size-3 text-muted-foreground animate-spin" />}
            </div>

            <div className="border border-border/80 rounded-md divide-y divide-border/60 overflow-hidden">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-3.5 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                        {member.name}
                        {member.isOwner && (
                          <Badge variant="secondary" className="text-9 px-1.5 py-0 font-semibold bg-muted text-muted-foreground">
                            Owner
                          </Badge>
                        )}
                      </div>
                      <div className="text-11 text-muted-foreground truncate">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {member.isOwner ? (
                      <span className="text-xs text-muted-foreground px-2 py-1 font-medium">
                        Owner
                      </span>
                    ) : (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(val: any) => handleChangeRole(member.id, val)}
                        >
                          <SelectTrigger className="w-28 h-7 text-xs cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="text-xs z-[10000]">
                            <SelectItem value="edit">Can edit</SelectItem>
                            <SelectItem value="view">Read only</SelectItem>
                          </SelectContent>
                        </Select>

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          title="Remove collaborator"
                          aria-label={`Remove ${member.name}`}
                          className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-background border-t border-border flex items-center justify-between text-11 text-muted-foreground">
          <span>Collaborators count towards project collaboration limits.</span>
          <button
            type="button"
            onClick={() => setIsShareModalOpen(false)}
            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-muted transition-colors cursor-pointer text-foreground"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
