import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router";
import {
  useWorkspace,
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
} from "~/query/workspace";
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Trash2,
  ShieldCheck,
  Shield,
  User,
  Loader2,
} from "lucide-react";
import Loading from "~/components/ui/Loading";
import { getRoleName, getRoleColor } from "~/lib/utils";
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

export default function WorkspaceTeamPage() {
  const { workspaceId: workspaceUrl } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // Fetch Workspace Data
  const { workspace, isLoading, yourRole } = useWorkspace(workspaceUrl!);

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
      if (
        confirm(
          "Are you sure you want to remove this member from the workspace?",
        )
      ) {
        removeMemberMutation.mutate({ workspaceId: workspace._id, userId });
      }
    },
    [removeMemberMutation, workspace],
  );

  // Early returns AFTER all hooks
  if (isLoading) return <Loading />;
  if (!workspace) return <div className="p-6">Workspace not found</div>;

  return (
    <div className="flex-1 p-6 space-y-6 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Workspace Team
          </h1>
          <p className="text-muted-foreground">
            Manage members of the "{workspace.name}" workspace.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search workspace members..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10 border-b">
            <tr>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Role</th>
              <th className="text-left p-4 font-medium">Joined</th>
              <th className="p-4 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredMembers.map((member: any) => {
              const roleName = getRoleName(member);
              const roleColor = getRoleColor(member);

              return (
                <tr
                  key={member.user._id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.user.avatar} />
                        <AvatarFallback>
                          {member.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid">
                        <span className="font-medium truncate">
                          {member.user.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {member.user.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        roleName.toLowerCase() === "owner"
                          ? "default"
                          : roleName.toLowerCase() === "admin"
                            ? "secondary"
                            : "outline"
                      }
                      style={
                        roleColor
                          ? {
                              backgroundColor: `${roleColor}20`,
                              color: roleColor,
                              borderColor: roleColor,
                            }
                          : undefined
                      }
                    >
                      {roleName}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(
                      member.joinedAt || Date.now(),
                    ).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    {canManage && roleName.toLowerCase() !== "owner" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={roleName}
                            onValueChange={(val) =>
                              handleUpdateRole(member.user._id, val)
                            }
                          >
                            {yourRole === "owner" && (
                              <DropdownMenuRadioItem value="admin">
                                Admin
                              </DropdownMenuRadioItem>
                            )}
                            <DropdownMenuRadioItem value="member">
                              Member
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleRemoveMember(member.user._id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from Workspace
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
          <div className="p-12 text-center text-muted-foreground italic">
            No members found matching "{searchTerm}"
          </div>
        )}
      </div>

      <AddWorkspaceMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        workspaceId={workspace._id}
      />
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
