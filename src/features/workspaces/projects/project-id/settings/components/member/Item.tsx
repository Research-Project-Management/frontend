'use client';

import React from 'react';
import { ChevronDown, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { ProjectMemberItem } from '../../types/member.types';

interface ItemProps {
  member: ProjectMemberItem;
  canManage: boolean;
  isCurrentUser: boolean;
  onUpdateRole: (role: string) => void;
  onRemove: () => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Aug 15, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Aug 15, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Aug 15, 2026';
  }
}

function getDisplayName(user: { name: string; email?: string }): string {
  if (user.email) {
    return user.email.split('@')[0];
  }
  return user.name.toLowerCase().replace(/\s+/g, '');
}

function getRoleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    case 'viewer':
      return 'Viewer';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function Item({
  member,
  canManage,
  isCurrentUser,
  onUpdateRole,
  onRemove,
}: ItemProps) {
  const { user, role, joinedAt } = member;
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(role);
  const dateFormatted = formatDate(joinedAt);

  return (
    <tr className="group border-b border-border/60 hover:bg-muted/20 transition-colors text-xs">
      {/* Full name & Avatar */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-8 rounded-full border border-border/80 shrink-0">
            {user.avatar && (
              <AvatarImage src={user.avatar} className="object-cover" />
            )}
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-semibold">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground text-xs truncate max-w-[160px]">
            {user.name}
          </span>
        </div>
      </td>

      {/* Display name */}
      <td className="py-3 px-4 text-muted-foreground font-normal truncate max-w-[150px]">
        {displayName}
      </td>

      {/* Email */}
      <td className="py-3 px-4 text-muted-foreground font-normal truncate max-w-[200px]">
        {user.email || '—'}
      </td>

      {/* Role */}
      <td className="py-3 px-4">
        {canManage && !isCurrentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors cursor-pointer outline-none select-none"
              >
                <span>{roleLabel}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 p-1 rounded-lg">
              <DropdownMenuRadioGroup
                value={role.toLowerCase()}
                onValueChange={onUpdateRole}
              >
                <DropdownMenuRadioItem value="admin" className="text-xs cursor-pointer">
                  Admin
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="member" className="text-xs cursor-pointer">
                  Member
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="viewer" className="text-xs cursor-pointer">
                  Viewer
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="font-semibold text-foreground">{roleLabel}</span>
        )}
      </td>

      {/* Joining date */}
      <td className="py-3 px-4 text-muted-foreground font-normal whitespace-nowrap">
        {dateFormatted}
      </td>

      {/* Actions (hover) */}
      <td className="py-3 px-2 text-right w-10 pr-4">
        {canManage && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer outline-none"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 rounded-lg">
              <DropdownMenuItem
                onClick={onRemove}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs font-medium cursor-pointer rounded-md flex items-center gap-2"
              >
                <Trash2 className="size-3.5" />
                <span>Remove from project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}
