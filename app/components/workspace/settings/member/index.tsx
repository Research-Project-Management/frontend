import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router";
import {
  useWorkspace,
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
} from "~/query/workspace";
import { useRoles } from "~/query/role";
import { Plus, Users, UserPlus, Search, MoreHorizontal, Trash2, Loader2, Check } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { getRoleName, getRoleColor, cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import TopBar from "../layout/TopBar";
import DeleteModal from "../general/components/deleteModal";

export default function MemberPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Workspace Data
  const { workspace, isLoading, yourRole } = useWorkspace(workspaceUrl!);
  const { data: roles } = useRoles(workspace?._id ?? "");

  // Mutations
  const updateRoleMutation = useUpdateWorkspaceMemberRole();
  const removeMemberMutation = useRemoveWorkspaceMember();

  const members = workspace?.members || [];

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m: any) =>
          m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [members, searchTerm],
  );

  const canManage = yourRole === "owner" || yourRole === "admin";

  const handleUpdateRole = useCallback(
    (userId: string, newRole: string) => {
      if (!workspace) return;
      updateRoleMutation.mutate({
        workspaceId: workspace._id,
        userId,
        newRole,
      });
    },
    [updateRoleMutation, workspace],
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (!workspace) return;
      removeMemberMutation.mutate({ workspaceId: workspace._id, userId }, {
        onSuccess: () => {
          setMemberToRemove(null);
        }
      });
    },
    [removeMemberMutation, workspace],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
      <div className="px-4 h-13 border-b border-border flex items-center">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex-1 p-8 space-y-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!workspace) return <div className="p-8 text-muted-foreground">Workspace not found</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Members"
        Icon={Users}
        actions={
          <div className="flex items-center gap-3">
            {/* Expandable Search */}
            <div
              className={cn(
                "relative flex items-center transition-all duration-300 ease-in-out overflow-hidden h-8",
                isSearchExpanded || searchTerm ? "w-64" : "w-8"
              )}
            >
              {isSearchExpanded || searchTerm ? (
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => !searchTerm && setIsSearchExpanded(false)}
                    className="pl-8 pr-8 h-8 text-[13px] rounded-sm border border-border/60 bg-background focus-visible:ring-0 shadow-none w-full"
                    autoFocus
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearchTerm("");
                      setIsSearchExpanded(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <Plus className="size-3.5 rotate-45" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-sm hover:bg-secondary/60"
                  onClick={() => setIsSearchExpanded(true)}
                >
                  <Search className="size-4" />
                </Button>
              )}
            </div>

            {canManage && (
              <Button
                onClick={() => setAddMemberOpen(true)}
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Member
              </Button>
            )}
          </div>
        }
      />
      <div className="flex-1 p-8 space-y-8 flex flex-col overflow-hidden bg-background/50">
        <div className="flex-1 overflow-auto border border-border/60 rounded-lg bg-card/30 backdrop-blur-sm shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">User</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">Role</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">Joined</th>
                <th className="px-6 py-4 border-b border-border/60 w-[80px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredMembers.map((member: any) => {
                const roleName = getRoleName(member);
                const roleColor = getRoleColor(member);

                return (
                  <tr
                    key={member.user._id}
                    className="hover:bg-accent/40 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-sm border border-border/50 shadow-sm">
                          <AvatarImage src={member.user.avatar} className="object-cover" />
                          <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold rounded-sm">
                            {member.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-[14px] text-foreground truncate tracking-tight">
                            {member.user.name}
                          </span>
                          <span className="text-[12px] text-muted-foreground truncate font-medium">
                            {member.user.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge
                        variant="outline"
                        className="font-bold text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider border-none"
                        style={
                          roleColor
                            ? {
                                backgroundColor: `${roleColor}15`,
                                color: roleColor,
                              }
                            : undefined
                        }
                      >
                        {roleName}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-muted-foreground text-[13px] font-medium">
                      {new Date(
                        member.joinedAt || Date.now(),
                      ).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-5 text-right">
                      {canManage && roleName.toLowerCase() !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-2xl border-border/40 bg-background/95 backdrop-blur-xl rounded-sm">
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-2.5 py-2">
                                Change Role
                              </DropdownMenuLabel>
                              <div className="space-y-0.5 px-0.5">
                                {roles
                                  ?.filter(
                                    (r) => r.name.toLowerCase() !== "owner",
                                  )
                                  .filter(
                                    (r) =>
                                      yourRole === "owner" ||
                                      r.name.toLowerCase() !== "admin",
                                  )
                                  .sort((a, b) => {
                                    const priority: Record<string, number> = { admin: 1, member: 2 };
                                    return (priority[a.name.toLowerCase()] || 99) - (priority[b.name.toLowerCase()] || 99);
                                  })
                                  .map((r) => {
                                    const isSelected = roleName === r.name;
                                    return (
                                      <DropdownMenuItem
                                        key={r._id}
                                        onClick={() => handleUpdateRole(member.user._id, r.name)}
                                        className={cn(
                                          "flex items-center justify-between px-3 py-2 rounded-sm cursor-pointer transition-colors duration-150",
                                          isSelected ? "bg-[#f4f4f5] text-foreground" : "hover:bg-accent/50"
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div
                                            className="size-1.5 rounded-full shrink-0"
                                            style={{
                                              backgroundColor: r.color ?? "#6b7280",
                                            }}
                                          />
                                          <span className={cn("text-[13px] font-bold tracking-tight", isSelected ? "text-foreground" : "text-muted-foreground")}>
                                            {r.name}
                                          </span>
                                        </div>
                                        {isSelected && <Check className="size-3.5 text-muted-foreground/60 stroke-[3px]" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                              </div>
                              <DropdownMenuSeparator className="my-1.5 opacity-50" />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10 text-[13px] font-bold px-3 py-2 rounded-sm cursor-pointer"
                                onClick={() => setMemberToRemove(member)}
                              >
                                <Trash2 className="mr-1.5 size-4" />
                                Delete Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <Users className="size-6 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No members found</p>
                <p className="text-xs text-muted-foreground italic">
                  Try adjusting your search for "{searchTerm}"
                </p>
              </div>
            </div>
          )}
        </div>

        <AddWorkspaceMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          workspaceId={workspace._id}
        />

        <DeleteModal
          isOpen={!!memberToRemove}
          onClose={() => setMemberToRemove(null)}
          onConfirm={() => {
            if (memberToRemove) {
              handleRemoveMember(memberToRemove.user._id);
            }
          }}
          title="Delete Member"
          description={`Are you sure you want to remove ${memberToRemove?.user?.name} from this workspace? They will lose access to all projects and tasks.`}
          confirmText="Delete Member"
          cancelText="Cancel"
          loading={removeMemberMutation.isPending}
        />
      </div>
    </div>
  );
}

function AddWorkspaceMemberDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const addMemberMutation = useAddWorkspaceMember();

  // Debounced search effect
  useEffect(() => {
    // Reset results if search is too short
    if (search.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Set searching state immediately
    setIsSearching(true);

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/search?query=${search}`,
          {
            credentials: "include",
          },
        );
        const data = await response.json();
        setSearchResults(data.users || []);
      } catch (e) {
        console.error("Search error", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Wait 500ms after user stops typing

    // Cleanup function to cancel the timeout if search changes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [search]); // Only re-run when search changes

  const handleAdd = async (userId: string) => {
    try {
      await addMemberMutation.mutateAsync({
        workspaceId,
        userId,
        role: "member",
      });
      onOpenChange(false);
      setSearch("");
      setSearchResults([]);
    } catch (e) {
      console.error("Failed to add member", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Search for a user by name or email to add them to this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
            {isSearching ? (
              <div className="p-4 text-center">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search.length < 2
                  ? "Type at least 2 characters to search"
                  : "No users found"}
              </div>
            ) : (
              searchResults.map((user: any) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-3 hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid overflow-hidden">
                      <span className="text-sm font-medium truncate">
                        {user.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAdd(user._id)}
                    disabled={addMemberMutation.isPending}
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
