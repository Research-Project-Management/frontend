'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Search, Users, Plus, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Skeleton } from "@/shared/components/ui";
import { DeleteModal } from '@/features/settings/components/modal/DeleteModal';
import { toast } from 'sonner';
import TopBar from '../components/layout/TopBar';
import { Assignee } from '../components/member/Assignee';
import { Item } from '../components/member/Item';
import { Filter } from '../components/member/Filter';
import { AddMemberDialog } from '../components/member/Dialog';
import { useMembers } from '../hooks/use-member';
import type { ProjectMemberItem } from '../types/member.types';
import { cn } from "@/shared/lib/utils";

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
          className="inline-flex items-center gap-1 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
            'flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5',
            active && sortAsc && 'bg-muted font-medium',
          )}
        >
          <ArrowDownAZ className="size-3.5 text-muted-foreground shrink-0" />
          <span>{ascLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSort(field, false)}
          className={cn(
            'flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5',
            active && !sortAsc && 'bg-muted font-medium',
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
    currentUser,
    isOwnerOrAdmin,
    defaultAssigneeId,
    search,
    roleFilter,
    sortField,
    sortAsc,
    isLoading,
    isError,
    isAdding,
  } = state;

  const {
    setDefaultAssignee,
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

  const handleSort = (field: SortFieldType, asc: boolean) => {
    if (sortField !== field) {
      toggleSort(field);
      if (!asc) toggleSort(field);
    } else if (sortAsc !== asc) {
      toggleSort(field);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Members"
          description="Manage project researchers and collaborators"
          Icon={Users}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TopBar
          title="Members"
          description="Manage project researchers and collaborators"
          Icon={Users}
        />
        <div className="flex-1 p-5 md:p-6 text-sm text-muted-foreground">
          Error loading project members.
        </div>
      </div>
    );
  }

  const topBarActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleImport}
        className="h-8 gap-1.5 px-3 text-xs font-medium border-border bg-background hover:bg-muted text-foreground cursor-pointer rounded-md shrink-0"
      >
        <Upload className="size-3.5 text-muted-foreground shrink-0" />
        Import
      </Button>

      {isOwnerOrAdmin && (
        <Button
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="h-8 gap-1.5 px-3 text-xs font-medium bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer rounded-md shadow-none shrink-0"
        >
          <Plus className="size-3.5 text-primary-foreground shrink-0" />
          Add member
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <TopBar
        title="Members"
        description="Manage project researchers, collaborators and roles"
        Icon={Users}
        actions={topBarActions}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-6 space-y-6">
          {/* Top Settings: Default Assignee */}
          <Assignee
            members={members}
            defaultAssigneeId={defaultAssigneeId}
            onSelect={setDefaultAssignee}
            disabled={!isOwnerOrAdmin}
          />

          {/* Members Table Section */}
          <div className="space-y-3">
            {/* Filter toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs border-border bg-background focus:ring-0 focus:outline-none rounded-md"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Filter currentRole={roleFilter} onSelectRole={setRoleFilter} />
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-muted-foreground select-none">
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
                          ascLabel="Viewer → Owner"
                          descLabel="Owner → Viewer"
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

                  <tbody className="divide-y divide-border/60">
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
        </div>
      </div>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
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
