export type Permission = {
  resource: string;
  actions: string[];
};

export type Role = {
  _id: string;
  name: string;
  description: string;
  type: "workspace" | "project";
  workspace: string;
  project?: string;
  permissions: Permission[];
  isDefault: boolean;
  isSystem: boolean;
  color: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export const RESOURCES = [
  { value: "workspace", label: "Workspace", description: "Workspace settings and configuration" },
  { value: "project", label: "Project", description: "Projects within workspace" },
  { value: "task", label: "Task", description: "Tasks and kanban boards" },
  { value: "page", label: "Page", description: "Pages and documents" },
  { value: "file", label: "File", description: "File storage and management" },
  { value: "sticky", label: "Sticky", description: "Sticky notes" },
  { value: "member", label: "Member", description: "Workspace members" },
  { value: "settings", label: "Settings", description: "Workspace settings" },
  { value: "role", label: "Role", description: "Roles and permissions" },
];

export const ACTIONS = [
  { value: "create", label: "Create", icon: "➕" },
  { value: "read", label: "Read", icon: "👁️" },
  { value: "update", label: "Update", icon: "✏️" },
  { value: "delete", label: "Delete", icon: "🗑️" },
  { value: "manage", label: "Manage", icon: "⚙️" },
  { value: "invite", label: "Invite", icon: "📧" },
  { value: "export", label: "Export", icon: "📤" },
];
