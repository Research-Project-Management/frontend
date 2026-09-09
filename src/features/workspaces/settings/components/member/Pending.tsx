'use client';

import React, { useState } from 'react';
import { Mail, Clock, Trash2, Copy, Check, ShieldAlert } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { toast } from 'sonner';
import type { WorkspacePendingInvite } from '../../types/member.types';

interface PendingInvitesProps {
  invites: WorkspacePendingInvite[];
  canManage: boolean;
  onCancelInvite: (inviteId: string) => void;
  isLoading?: boolean;
}

export function PendingInvites({
  invites,
  canManage,
  onCancelInvite,
  isLoading,
}: PendingInvitesProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (token?: string, inviteId?: string) => {
    if (!token) {
      toast.error('Invite token is not available');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(inviteId || token);
    toast.success('Invite link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatExpiresIn = (expiresAtStr?: string) => {
    if (!expiresAtStr) return '7 days';
    const expires = new Date(expiresAtStr).getTime();
    const now = Date.now();
    const diffMs = expires - now;
    if (diffMs <= 0) return 'Expired';
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden bg-background p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-44 rounded-md" />
                <Skeleton className="h-2.5 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none rounded-lg border border-border bg-background">
        <div className="size-12 rounded-md border border-border bg-muted flex items-center justify-center mb-3">
          <Mail className="size-5 text-muted-foreground stroke-[1.5] shrink-0" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No pending invitations
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
          Invitations sent to team members will appear here until they accept.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted text-muted-foreground text-11 font-medium">
              <th className="py-3 px-4 w-[35%]">Invited email</th>
              <th className="py-3 px-4 w-[15%]">Role</th>
              <th className="py-3 px-4 w-[20%]">Invited on</th>
              <th className="py-3 px-4 w-[18%]">Expiration</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invites.map((invite) => {
              const isCopied = copiedId === (invite.id || invite.token);
              const isExpiringSoon =
                invite.expiresAt &&
                new Date(invite.expiresAt).getTime() - Date.now() <
                  2 * 24 * 60 * 60 * 1000;

              return (
                <tr
                  key={invite.id}
                  className="hover:bg-muted transition-colors group text-foreground"
                >
                  {/* Email & Initial */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-muted border border-border text-foreground flex items-center justify-center text-10 font-medium shrink-0">
                        {invite.email.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate text-xs">
                          {invite.email}
                        </p>
                        {invite.invitedBy?.name && (
                          <p className="text-10 text-muted-foreground truncate">
                            Invited by {invite.invitedBy.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-10 font-medium tracking-normal bg-secondary text-secondary-foreground border border-border">
                      {invite.role}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 text-muted-foreground text-11">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3 text-muted-foreground shrink-0" />
                      <span>{formatDate(invite.createdAt)}</span>
                    </div>
                  </td>

                  {/* Expiration */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-11 ${
                        isExpiringSoon
                          ? 'text-amber-500 font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {isExpiringSoon && <ShieldAlert className="size-3 shrink-0" />}
                      {formatExpiresIn(invite.expiresAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {invite.token && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(invite.token, invite.id)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1 rounded-md"
                          title="Copy invitation link"
                        >
                          {isCopied ? (
                            <>
                              <Check className="size-3 text-emerald-500 shrink-0" />
                              <span className="text-11 text-emerald-500 font-medium">
                                Copied
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 shrink-0" />
                              <span className="text-11">Copy link</span>
                            </>
                          )}
                        </Button>
                      )}

                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onCancelInvite(invite.id)}
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0 cursor-pointer rounded-md transition-colors"
                          title="Cancel invitation"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
