import { useState, useMemo, useRef } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "~/query/workspace";
import { 
  useRoles, 
  useCreateRole, 
  useUpdateRole, 
  useDeleteRole 
} from "~/query/role";
import { toast } from "sonner";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import TopBar from "../layout/TopBar";
import { Plus, Trash2, ShieldCheck, Search, MoreHorizontal } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import DeleteModal from "../general/components/deleteModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";

type Permission = {
  resource: string;
  actions: string[];
};

type Role = {
  _id: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  permissions: Permission[];
};

const RESOURCES = [
  "workspace",
  "project",
  "task",
  "page",
  "file",
  "sticky",
  "member",
  "settings",
  "role",
];

const ACTIONS = ["create", "read", "update", "delete", "manage", "invite"];

export default function RolesPage() {
  const { workspaceId } = useParams();
  const { workspace } = useWorkspace(workspaceId!);
  const { data, isLoading } = useRoles(workspace?._id || "");
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#6366f1");
  const [formPerms, setFormPerms] = useState<Permission[]>([]);

  const roles = useMemo(() => {
    if (!data) return [];
    const priority: Record<string, number> = {
      owner: 1,
      admin: 2,
      member: 3,
    };
    return [...data].sort((a, b) => {
      const pA = priority[a.name.toLowerCase()] || 99;
      const pB = priority[b.name.toLowerCase()] || 99;
      return pA - pB;
    });
  }, [data]);

  const createMutation = useCreateRole(workspace?._id || "");
  const updateMutation = useUpdateRole(workspace?._id || "");
  const deleteMutation = useDeleteRole(workspace?._id || "");

  const openCreate = () => {
    setEditingRole(null);
    setFormName("");
    setFormDesc("");
    setFormColor("#6366f1");
    setFormPerms([]);
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    if (role.isSystem) return;
    setEditingRole(role);
    setFormName(role.name);
    setFormDesc(role.description || "");
    setFormColor(role.color);
    setFormPerms(role.permissions || []);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: formName,
      description: formDesc,
      color: formColor,
      permissions: formPerms,
    };
    if (editingRole) {
      updateMutation.mutate({ roleId: editingRole._id, ...payload }, {
        onSuccess: () => {
          setDialogOpen(false);
          toast.success("Role updated");
          queryClient.invalidateQueries({ queryKey: ["roles", workspace?._id] });
        }
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false);
          toast.success("Role created");
          queryClient.invalidateQueries({ queryKey: ["roles", workspace?._id] });
        }
      });
    }
  };

  const togglePerm = (resource: string, action: string) => {
    setFormPerms((prev) => {
      const existing = prev.find((p) => p.resource === resource);
      if (existing) {
        const hasAction = existing.actions.includes(action);
        const newActions = hasAction
          ? existing.actions.filter((a) => a !== action)
          : [...existing.actions, action];
        if (newActions.length === 0) {
          return prev.filter((p) => p.resource !== resource);
        }
        return prev.map((p) =>
          p.resource === resource ? { ...p, actions: newActions } : p,
        );
      }
      return [...prev, { resource, actions: [action] }];
    });
  };

  const hasAction = (resource: string, action: string) =>
    formPerms.some(
      (p) => p.resource === resource && p.actions.includes(action),
    );

  const roleHasAction = (role: Role, resource: string, action: string) =>
    role.permissions.some(
      (p) => p.resource === resource && p.actions.includes(action),
    );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
      <div className="px-4 h-13 border-b border-border flex items-center">
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="p-8 space-y-8">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Roles"
        Icon={ShieldCheck}
        actions={
          <Button
            onClick={openCreate}
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            New Role
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-background/50">
        <div className="border border-border/60 rounded-lg bg-card/30 backdrop-blur-sm shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                  <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    Role
                  </th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    Description
                  </th>
                  <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    Permissions
                  </th>
                  <th className="px-6 py-4 border-b border-border/60 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {roles.map((role) => (
                  <tr
                    key={role._id}
                    onClick={() => openEdit(role)}
                    className={cn(
                      "transition-all duration-200 group",
                      role.isSystem ? "" : "hover:bg-accent/40 cursor-pointer"
                    )}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-2 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: role.color }}
                        />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[15px] text-foreground tracking-tight">
                              {role.name}
                            </span>
                            {role.isSystem && (
                              <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-500 border-none">
                                System
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-muted-foreground text-[13px] max-w-xs truncate font-medium">
                      {role.description || <span className="opacity-30 italic">No description</span>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap items-center gap-2 max-w-[500px]">
                        {role.permissions.length > 0 ? (
                          <>
                            {role.permissions.slice(0, 4).map((p) => (
                              <div
                                key={p.resource}
                                className="px-2.5 py-1 rounded-[4px] bg-[#f2f2f2] text-[#666] text-[11px] font-medium border border-transparent shadow-none"
                              >
                                {p.resource}: {p.actions.join(", ")}
                              </div>
                            ))}
                            {role.permissions.length > 4 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[11px] text-[#888] hover:text-primary font-bold pl-1 transition-all hover:underline"
                                  >
                                    +{role.permissions.length - 4} more
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-72 p-0 shadow-2xl border-border/40 bg-background/95 backdrop-blur-xl overflow-hidden rounded-xl" 
                                  align="start"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="p-3 space-y-3">
                                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">All Permissions</h4>
                                    
                                    <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1">
                                      {role.permissions.map((p) => (
                                        <div key={p.resource} className="p-2 gap-2 flex flex-col bg-[#f9f9f9] border border-border/20 rounded-lg">
                                          <div className="flex items-center gap-1.5 px-0.5">
                                            <div className="size-1 rounded-full bg-primary/60" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80 capitalize">
                                              {p.resource}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {p.actions.map(a => (
                                              <span key={a} className="text-[9px] text-[#666] capitalize bg-white px-2 py-0.5 rounded border border-border/30 font-medium">
                                                {a}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40 italic">
                            No permissions defined
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {!role.isSystem && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-all rounded-sm hover:bg-accent opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRoleToDelete(role);
                              }}
                            >
                              <Trash2 className="mr-2 size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {roles.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <ShieldCheck className="size-6 text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No roles found</p>
                <p className="text-xs text-muted-foreground italic">
                  Create your first custom role to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? `Edit "${editingRole.name}"` : "New Role"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Reviewer"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-9 w-12 rounded-md border border-input cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Role description"
              />
            </div>

            {/* Permissions grid */}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="border border-border rounded-lg overflow-hidden text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                        Resource
                      </th>
                      {ACTIONS.map((a) => (
                        <th
                          key={a}
                          className="text-center px-2 py-2 font-medium text-muted-foreground capitalize"
                        >
                          {a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {RESOURCES.map((resource) => (
                      <tr key={resource} className="hover:bg-accent/20">
                        <td className="px-3 py-2 font-medium text-foreground capitalize">
                          {resource}
                        </td>
                        {ACTIONS.map((action) => (
                          <td key={action} className="text-center px-2 py-2">
                            <input
                              type="checkbox"
                              checked={hasAction(resource, action)}
                              onChange={() => togglePerm(resource, action)}
                              className="size-3.5 rounded border-border accent-primary cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editingRole ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <DeleteModal
        isOpen={!!roleToDelete}
        onClose={() => setRoleToDelete(null)}
        onConfirm={() => {
          if (roleToDelete) {
            deleteMutation.mutate(roleToDelete._id, {
              onSuccess: () => {
                setRoleToDelete(null);
                toast.success("Role deleted");
              }
            });
          }
        }}
        title={`Delete "${roleToDelete?.name}" role?`}
        description="Are you sure you want to delete this role? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
