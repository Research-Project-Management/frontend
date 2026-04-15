import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "~/lib/api";
import { useWorkspace } from "~/query/workspace";
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
} from "~/components/ui/dialog";
import TopBar from "../layout/TopBar";
import { Plus, Trash2, ShieldCheck } from "lucide-react";

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

function useRoles(workspaceId: string) {
  const { workspace } = useWorkspace(workspaceId);
  return useQuery({
    queryKey: ["roles", workspace?._id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/roles/${workspace?._id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json() as Promise<{ roles: Role[] }>;
    },
    enabled: !!workspace?._id,
  });
}

export default function RolesPage() {
  const { workspaceId } = useParams();
  const { workspace } = useWorkspace(workspaceId!);
  const { data, isLoading } = useRoles(workspaceId!);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("#6366f1");
  const [formPerms, setFormPerms] = useState<Permission[]>([]);

  const roles = data?.roles || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`${API_URL}/api/roles/${workspace?._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDialogOpen(false);
      toast.success("Role created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ roleId, ...data }: any) => {
      const res = await fetch(
        `${API_URL}/api/roles/${workspace?._id}/${roleId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDialogOpen(false);
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(
        `${API_URL}/api/roles/${workspace?._id}/${roleId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      updateMutation.mutate({ roleId: editingRole._id, ...payload });
    } else {
      createMutation.mutate(payload);
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
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="p-6 space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Roles" Icon={ShieldCheck} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              New Role
            </Button>
          </div>

          {/* Roles table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Permissions
                  </th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roles.map((role) => (
                  <tr
                    key={role._id}
                    onClick={() => openEdit(role)}
                    className={`transition-colors ${role.isSystem ? "" : "hover:bg-accent/30 cursor-pointer"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: role.color }}
                        />
                        <span className="font-medium text-foreground">
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {role.description}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 4).map((p) => (
                          <span
                            key={p.resource}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground"
                          >
                            {p.resource}: {p.actions.join(", ")}
                          </span>
                        ))}
                        {role.permissions.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{role.permissions.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!role.isSystem && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this role?"))
                              deleteMutation.mutate(role._id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}