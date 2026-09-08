'use client';

import React from 'react';
import { MoreHorizontal, LogOut, Trash2, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import type { WorkspaceMemberItem, WorkspaceRole } from '../../types/member.types';

interface MemberItemProps {
  member: WorkspaceMemberItem;
  currentUserId?: string;
  canManage: boolean;
  onRoleChange: (userId: string, newRole: WorkspaceRole) => void;
  onRemove: (member: WorkspaceMemberItem) => void;
  onLeave?: (member: WorkspaceMemberItem) => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Aug 08, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Aug 08, 2026';
  }
}

export function MemberItem({
  member,
  currentUserId,
  canManage,
  onRoleChange,
  onRemove,
  onLeave,
}: MemberItemProps) {
  const isOwner = member.role === 'owner';
  const isSelf =
    Boolean(currentUserId) &&
    (member.userId === currentUserId || member.user.id === currentUserId);

  const initial = member.user.name.charAt(0).toUpperCase() || 'U';
  const formattedDate = formatDate(member.createdAt);
  const authLabel = member.authProvider || (member.user.email.endsWith('@gmail.com') ? 'Google' : 'Email');

  return (
    <tr className="hover:bg-muted transition-colors group">
      {/* ── 1. Full Name ── */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-6.5 rounded-full border border-border shrink-0">
            {member.user.avatar && (
              <AvatarImage src={member.user.avatar} className="object-cover" />
            )}
            <AvatarFallback className="text-xs bg-muted font-semibold text-muted-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>

          <span className="font-medium text-foreground truncate max-w-[160px] text-xs">
            {member.user.name}
          </span>
        </div>
      </td>

      {/* ── 2. Display Name ── */}
      <td className="py-3.5 px-4 text-xs text-muted-foreground truncate max-w-[140px]">
        {member.user.displayName || member.user.name.toLowerCase().replace(/\s+/g, '')}
      </td>

      {/* ── 3. Email ── */}
      <td className="py-3.5 px-4 text-xs text-muted-foreground truncate max-w-[200px]">
        {member.user.email}
      </td>

      {/* ── 4. Role ── */}
      <td className="py-3.5 px-4 text-xs">
        {canManage && !isOwner && !isSelf ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary capitalize"
              >
                <span>{member.role}</span>
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32 p-1 text-xs">
              <DropdownMenuItem
                onClick={() => onRoleChange(member.userId, 'admin')}
                className="cursor-pointer"
              >
                Admin
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRoleChange(member.userId, 'member')}
                className="cursor-pointer"
              >
                Member
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRoleChange(member.userId, 'viewer')}
                className="cursor-pointer"
              >
                Viewer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="font-medium text-foreground capitalize">
            {member.role}
          </span>
        )}
      </td>

      {/* ── 5. Authentication ── */}
      <td className="py-3.5 px-4 text-xs text-muted-foreground">
        {authLabel}
      </td>

      {/* ── 6. Joining Date ── */}
      <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
        {formattedDate}
      </td>

      {/* ── Actions (Hover 3-dots: Owner => Leave, Others => Remove) ── */}
      <td className="py-3.5 px-2 text-right pr-4 w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="More actions"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 p-1 rounded-md text-xs">
            {isOwner ? (
              <DropdownMenuItem
                onClick={() => (onLeave ? onLeave(member) : onRemove(member))}
                className="text-xs font-medium cursor-pointer rounded-md flex items-center gap-2"
              >
                <LogOut className="size-3.5 text-muted-foreground shrink-0" />
                <span>Leave</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onRemove(member)}
                className="text-xs font-medium cursor-pointer rounded-md flex items-center gap-2"
              >
                <Trash2 className="size-3.5 text-muted-foreground shrink-0" />
                <span>Remove</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
