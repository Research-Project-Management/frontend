'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { TopBar } from '../components/layout/TopBar';
import { MemberFilter } from '../components/member/Filter';
import { MemberItem } from '../components/member/Item';
import { PendingInvites } from '../components/member/Pending';
import { Sortable } from '../components/member/Sortable';
import { InviteModal as InviteDialog } from '../components/modal/InviteModal';
import { ImportModal } from '../components/modal/ImportModal';
import { DeleteModal } from '../components/modal/DeleteModal';
import { useMember } from '../hooks/use-member';
import { Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton (using global Skeleton component)
// ─────────────────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="Members" Icon={Users} />
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Title skeleton */}
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-3.5 w-52 rounded-md" />
          </div>
          {/* Tabs + toolbar skeleton */}
          <Skeleton className="h-8 w-full rounded-lg" />
          {/* Table skeleton */}
          <div className="rounded-lg border border-border/60 overflow-hidden space-y-0">
            <Skeleton className="h-9 w-full rounded-none" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none border-t border-border/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkspaceMemberPage() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { state, actions } = useMember(workspaceId);

  const {
    currentUser,
    isLoading,
    canManage,
    activeTab,
    filteredMembers,
    search,
    roleFilter,
    sortField,
    sortDirection,
    inviteModalOpen,
    importModalOpen,
    memberToRemove,
    memberToLeave,
    isInviting,
    isRemoving,
    isLeaving,
  } = state;

  const {
    setActiveTab,
    setSearch,
    setRoleFilter,
    handleSort,
    setInviteModalOpen,
    setImportModalOpen,
    setMemberToRemove,
    setMemberToLeave,
    handleUpdateRole,
    handleRemoveMember,
    handleLeaveWorkspace,
    handleInviteMembers,
    handleImportCsv,
  } = actions;


  if (isLoading) return <LoadingSkeleton />;

  const TABS = [
    { key: 'people',  label: 'People' },
    { key: 'pending', label: 'Pending invitations' },
  ] as const;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar title="Members" Icon={Users} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 md:px-8 pb-16">

          {/* ── Page title ─────────────────────────────────────────────── */}
          <div className="pt-7 pb-6">
            <h1 className="text-[1.35rem] font-bold text-foreground tracking-tight leading-snug">
              Members
            </h1>
            <p className="text-[0.72rem] text-muted-foreground mt-0.5">
              Manage who has access to this workspace.
            </p>
          </div>

          {/* ── Tab bar + toolbar — border-b IS the table's top line ──── */}
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-border/60">
            {/* Sub-tabs */}
            <div className="flex items-end gap-0.5">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'relative px-3.5 py-2 text-[0.72rem] font-medium transition-all cursor-pointer outline-none select-none',
                    activeTab === key
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  {activeTab === key && (
                    /* translate-y[1px] makes bar sit on top of the border-b line = flush with table top */
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full translate-y-[1px]" />
                  )}
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="pb-1.5">
              <MemberFilter
                search={search}
                roleFilter={roleFilter}
                canManage={canManage}
                onSearchChange={setSearch}
                onRoleFilterChange={setRoleFilter}
                onOpenImport={() => setImportModalOpen(true)}
                onAddMember={() => setInviteModalOpen(true)}
              />
            </div>
          </div>

          {/* ── People tab ─────────────────────────────────────────────── */}
          {activeTab === 'people' && (
            <div className="rounded-b-lg rounded-t-none border border-t-0 border-border/60 overflow-hidden bg-background">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/25 text-muted-foreground">
                      {/* Full name — wider */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium w-[22%]">
                        <Sortable
                          label="Full name"
                          field="name"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </th>
                      {/* Display name */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium w-[16%]">
                        <Sortable
                          label="Display name"
                          field="displayName"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </th>
                      {/* Email — flexible */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium">
                        <Sortable
                          label="Email"
                          field="email"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                      </th>
                      {/* Role */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium w-[11%]">
                        <Sortable
                          label="Role"
                          field="role"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          ascLabel="Viewer → Admin"
                          descLabel="Admin → Viewer"
                        />
                      </th>
                      {/* Authentication — no sort */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium text-muted-foreground w-[13%]">
                        Authentication
                      </th>
                      {/* Joining date */}
                      <th className="py-2.5 px-4 text-[0.7rem] font-medium w-[13%]">
                        <Sortable
                          label="Joining date"
                          field="date"
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          ascLabel="Old → New"
                          descLabel="New → Old"
                        />
                      </th>
                      {/* Actions */}
                      <th className="py-2.5 px-3 w-10" aria-hidden="true" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border/50">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-14 text-center text-[0.72rem] text-muted-foreground"
                        >
                          No members found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => (
                        <MemberItem
                          key={m.id || m.userId}
                          member={m}
                          currentUserId={currentUser?.id || (currentUser as any)?._id}
                          canManage={canManage}
                          onRoleChange={handleUpdateRole}
                          onRemove={(member) => setMemberToRemove(member)}
                          onLeave={(member) => setMemberToLeave(member)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>



            </div>
          )}

          {/* ── Pending tab ────────────────────────────────────────────── */}
          {activeTab === 'pending' && (
            <PendingInvites invites={[]} canManage={canManage} onCancelInvite={() => {}} />
          )}

        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <InviteDialog
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInviteMembers}
        isInviting={isInviting}
      />
      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImportCsv}
      />
      <DeleteModal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (memberToRemove) handleRemoveMember(memberToRemove.userId);
        }}
        title={`Remove ${memberToRemove?.user.name ?? 'member'}?`}
        description={
          <>
            Are you sure you want to remove member-{' '}
            <strong>{memberToRemove?.user.name}</strong>? They will no longer
            have access to this workspace. This action cannot be undone.
          </>
        }
        confirmText="Remove"
        cancelText="Cancel"
        loading={isRemoving}
      />
      <DeleteModal
        isOpen={Boolean(memberToLeave)}
        onClose={() => setMemberToLeave(null)}
        onConfirm={handleLeaveWorkspace}
        title="Leave workspace?"
        description="Are you sure you want to leave this workspace? You will lose access to all projects and resources."
        confirmText="Leave"
        cancelText="Cancel"
        loading={isLeaving}
      />
    </div>
  );
}
