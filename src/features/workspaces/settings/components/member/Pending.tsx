'use client';

import React from 'react';
import { Mail, Clock, Trash2 } from 'lucide-react';
import { Badge, Button } from '@/shared/components/ui';
import type { WorkspacePendingInvite } from '../../types/member.types';

interface PendingInvitesProps {
  invites: WorkspacePendingInvite[];
  canManage: boolean;
  onCancelInvite: (inviteId: string) => void;
}

export function PendingInvites({
  invites,
  canManage,
  onCancelInvite,
}: PendingInvitesProps) {
  if (invites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none">
        <div className="size-12 rounded-lg border border-border/80 bg-muted/20 flex items-center justify-center mb-3">
          <Mail className="size-5 text-muted-foreground stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          No pending invitations
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
          Invitations sent to new team members will appear here until they accept.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground">
            <th className="py-2.5 px-4 font-medium">Email</th>
            <th className="py-2.5 px-4 font-medium">Role</th>
            <th className="py-2.5 px-4 font-medium">Invited on</th>
            <th className="py-2.5 px-2 w-10 pr-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {invites.map((invite) => (
            <tr key={invite.id} className="hover:bg-muted/20 transition-colors group">
              <td className="py-3 px-4 font-medium text-foreground">
                {invite.email}
              </td>
              <td className="py-3 px-4">
                <Badge variant="secondary" className="text-[10px] font-medium h-5 px-2 rounded capitalize">
                  {invite.role}
                </Badge>
              </td>
              <td className="py-3 px-4 text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3 text-muted-foreground" />
                <span>{invite.createdAt}</span>
              </td>
              <td className="py-3 px-2 text-right pr-4">
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onCancelInvite(invite.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer rounded-md"
                    title="Cancel invitation"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
