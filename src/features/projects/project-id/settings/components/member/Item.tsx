'use client';

import React from 'react';
import { ChevronDown, Crown, MoreHorizontal, Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { ProjectMemberItem } from '../../types/member.types';

interface ItemProps {
  member: ProjectMemberItem;
  canManage: boolean;
  isCurrentUser: boolean;
  isOwner?: boolean;
  onUpdateRole: (role: string) => void;
  onRemove: () => void;
  onTransferOwnership?: () => void;
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
    case 'coordinator':
      return 'Coordinator';
    case 'contributor':
      return 'Contributor';
    case 'reviewer':
    case 'commenter':
      return 'Reviewer';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function Item({
  member,
  canManage,
  isCurrentUser,
  isOwner = false,
  onUpdateRole,
  onRemove,
  onTransferOwnership,
}: ItemProps) {
  const { user, role, joinedAt } = member;
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(role);
  const dateFormatted = formatDate(joinedAt);

  return (
    <tr className="group border-b border-border hover:bg-muted transition-colors text-12">
      {/* Full name & Avatar */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-7 rounded-full border border-border shrink-0">
            {user.avatar && (
              <AvatarImage src={user.avatar} className="object-cover" />
            )}
            <AvatarFallback className="text-11 bg-muted text-muted-foreground font-semibold">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground text-12 truncate max-w-[160px]">
            {user.name}
          </span>
        </div>
      </td>

      {/* Display name */}
      <td className="py-2.5 px-4 text-muted-foreground font-normal truncate max-w-[150px]">
        {displayName}
      </td>

      {/* Email */}
      <td className="py-2.5 px-4 text-muted-foreground font-normal truncate max-w-[200px]">
        {user.email || '-'}
      </td>

      {/* Role */}
      <td className="py-2.5 px-4">
        {canManage && !isCurrentUser && role.toLowerCase() !== 'owner' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-0.5 select-none relative before:absolute before:-inset-1 md:before:hidden"
              >
                <span>{roleLabel}</span>
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 p-1 rounded-md shadow-overlay">
              <DropdownMenuRadioGroup
                value={role.toLowerCase()}
                onValueChange={(val) => {
                  if (val === 'owner') {
                    onTransferOwnership?.();
                  } else {
                    onUpdateRole(val);
                  }
                }}
              >
                {isOwner && onTransferOwnership && (
                  <DropdownMenuRadioItem
                    value="owner"
                    className="text-12 cursor-pointer text-warning font-medium"
                  >
                    Owner (Transfer ownership)
                  </DropdownMenuRadioItem>
                )}
                <DropdownMenuRadioItem value="coordinator" className="text-12 cursor-pointer">
                  Coordinator
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="contributor" className="text-12 cursor-pointer">
                  Contributor
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="reviewer" className="text-12 cursor-pointer">
                  Reviewer (Advisor / Reviewer)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="font-semibold text-foreground">{roleLabel}</span>
        )}
      </td>

      {/* Joining date */}
      <td className="py-2.5 px-4 text-muted-foreground font-normal whitespace-nowrap">
        {dateFormatted}
      </td>

      {/* Actions (hover) */}
      <td className="py-2.5 px-2 text-right w-10 pr-4">
        {canManage && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Member options"
                className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 transition-opacity cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2 md:before:hidden"
              >
                <MoreHorizontal className="size-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 rounded-md shadow-overlay">
              {isOwner && onTransferOwnership && (
                <DropdownMenuItem
                  onClick={onTransferOwnership}
                  className="text-12 font-medium cursor-pointer rounded-md flex items-center gap-2 text-warning focus:text-warning focus:bg-muted"
                >
                  <Crown className="size-3.5 shrink-0" />
                  <span>Transfer ownership</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onRemove}
                className="text-12 font-medium cursor-pointer rounded-md flex items-center gap-2 text-destructive focus:text-destructive focus:bg-muted"
              >
                <Trash2 className="size-3.5 shrink-0" />
                <span>Remove member</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}
