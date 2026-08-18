'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Skeleton, Button, Input } from '@/shared/components/ui';
import { DeleteModal } from '@/features/workspaces/settings/components/modal/DeleteModal';
import { toast } from 'sonner';
import { Lead } from '../components/member/Lead';
import { Assignee } from '../components/member/Assignee';
import { Subscribers } from '../components/member/Subscribers';
import { Item } from '../components/member/Item';
import { Filter } from '../components/member/Filter';
import { AddMemberDialog } from '../components/member/Dialog';
import { useMembers } from '../hooks/use-member';
import type { ProjectMemberItem } from '../types/member.types';
import { cn } from '@/shared/lib/utils';

type SortFieldType = 'name' | 'displayName' | 'email' | 'role' | 'date';

// ── Sort header with A→Z / Z→A dropdown (supports custom labels) ───────────
function SortableHeader({
  label,
  field,
  sortField,
  sortAsc,
  onSort,
  ascLabel = 'A → Z',
  descLabel = 'Z → A',
}: {
  label: string;
  field: SortFieldType;
  sortField: string;
  sortAsc: boolean;
  onSort: (field: SortFieldType, asc: boolean) => void;
  ascLabel?: string;
  descLabel?: string;
}) {
  const active = sortField === field;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Sort by ${label}`}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none"
        >
          <span className={cn(active && 'text-foreground font-semibold')}>{label}</span>
          <ChevronDown
            className={cn(
              'size-3 transition-transform shrink-0',
              active ? 'text-foreground' : 'text-muted-foreground/60',
              active && sortAsc && 'rotate-180',
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-1 text-xs">
        <DropdownMenuItem
          onClick={() => onSort(field, true)}
          className={cn(
            'flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5',
            active && sortAsc && 'bg-accent',
          )}
        >
          <ArrowDownAZ className="size-3.5 text-muted-foreground shrink-0" />
          <span>{ascLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSort(field, false)}
          className={cn(
            'flex items-center gap-2 cursor-pointer rounded-sm px-2 py-1.5',
            active && !sortAsc && 'bg-accent',
          )}
        >
          <ArrowUpZA className="size-3.5 text-muted-foreground shrink-0" />
          <span>{descLabel}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MemberPage() {
  const { projectId } = useParams() as { projectId: string };
  const { state, actions } = useMembers(projectId);

  const {
    project,
    members,
    filteredMembers,
    workspace,
    currentUser,
    isOwnerOrAdmin,
    leadId,
    leadMember,
    defaultAssigneeId,
    defaultAssigneeMember,
    subscriberIds,
    search,
    roleFilter,
    sortField,
    sortAsc,
    isLoading,
    isError,
    isAdding,
  } = state;

  const {
    setLead,
    setDefaultAssignee,
    toggleSubscriber,
    addMembers,
    updateRole,
    removeMember,
    setSearch,
    setRoleFilter,
    toggleSort,
  } = actions;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<ProjectMemberItem | null>(null);

  const existingMemberIds = useMemo(() => {
    return new Set<string>(members.map((m: any) => m.userId));
  }, [members]);

  const confirmDelete = () => {
    if (!deletingMember) return;
    removeMember(deletingMember.userId);
    setDeletingMember(null);
  };

  const handleImport = () => {
    toast.info('Importing members from CSV is coming soon');
  };

  // Adapter: convert (field, asc) → hook's toggleSort
  const handleSort = (field: SortFieldType, asc: boolean) => {
    if (sortField !== field) {
      toggleSort(field);          // switch field → defaults to true (asc)
      if (!asc) toggleSort(field); // flip once → desc
    } else if (sortAsc !== asc) {
      toggleSort(field);           // same field, flip direction
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Error loading project members.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Members</h1>
      </div>

      {/* Top Settings */}
      <div className="space-y-5">
        <Lead members={members} leadId={leadId} onSelect={setLead} disabled={!isOwnerOrAdmin} />
        <Assignee members={members} defaultAssigneeId={defaultAssigneeId} onSelect={setDefaultAssignee} disabled={!isOwnerOrAdmin} />
        <Subscribers members={members} subscriberIds={subscriberIds} onToggle={toggleSubscriber} disabled={!isOwnerOrAdmin} />
      </div>

      {/* Members Table Section */}
      <div className="space-y-4 pt-2">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Members</h2>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search */}
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-border/80 bg-background focus:ring-0 focus:outline-none rounded-md"
              />
            </div>

            {/* Role filter */}
            <Filter currentRole={roleFilter} onSelectRole={setRoleFilter} />

            {/* Import */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="h-8 px-3 text-xs font-medium border-border/80 bg-background hover:bg-muted/50 text-foreground cursor-pointer rounded-md shrink-0"
            >
              Import
            </Button>

            {/* Add member */}
            {isOwnerOrAdmin && (
              <Button
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="h-8 px-3.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer rounded-md shadow-2xs shrink-0"
              >
                Add member
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/80 overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-muted-foreground select-none">
                  <th className="py-2.5 px-4 font-medium" aria-sort={sortField === 'name' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                    <SortableHeader label="Full name" field="name" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="py-2.5 px-4 font-medium" aria-sort={sortField === 'displayName' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                    <SortableHeader label="Display name" field="displayName" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="py-2.5 px-4 font-medium" aria-sort={sortField === 'email' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                    <SortableHeader label="Email" field="email" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                  </th>
                  <th className="py-2.5 px-4 font-medium" aria-sort={sortField === 'role' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                    <SortableHeader
                      label="Role"
                      field="role"
                      sortField={sortField}
                      sortAsc={sortAsc}
                      onSort={handleSort}
                      ascLabel="Viewer → Admin"
                      descLabel="Admin → Viewer"
                    />
                  </th>
                  <th className="py-2.5 px-4 font-medium" aria-sort={sortField === 'date' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                    <SortableHeader
                      label="Joining date"
                      field="date"
                      sortField={sortField}
                      sortAsc={sortAsc}
                      onSort={handleSort}
                      ascLabel="Old → New"
                      descLabel="New → Old"
                    />
                  </th>
                  <th className="py-2.5 px-2 w-10 pr-4" />
                </tr>
              </thead>

              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                      {search || roleFilter
                        ? 'No members found matching your search.'
                        : 'No members in this project.'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member: any) => {
                    const isCurrentUser = currentUser?.id === member.userId;
                    return (
                      <Item
                        key={member.userId}
                        member={member}
                        canManage={isOwnerOrAdmin}
                        isCurrentUser={isCurrentUser}
                        onUpdateRole={(newRole) => updateRole(member.userId, newRole)}
                        onRemove={() => setDeletingMember(member)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        workspace={workspace}
        existingMemberIds={existingMemberIds}
        onAdd={addMembers}
        isLoading={isAdding}
      />

      {/* Remove Member Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={confirmDelete}
        title="Remove member"
        description={`Are you sure you want to remove ${deletingMember?.user.name || 'this member'} from the project? They will lose access to all project resources.`}
        confirmText="Remove member"
        cancelText="Cancel"
      />
    </div>
  );
}
