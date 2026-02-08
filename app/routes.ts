import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  layout("./components/auth/AuthLayout.tsx", [
    route("callback", "./routes/callback.tsx"),
    route("login", "./routes/login.tsx"),
    route("register", "./routes/register.tsx"),
    route("forgot-password", "./routes/forgot-password.tsx"),
  ]),

  // redirect to workspaceId if logged in and has workspace
  route("ws", "./routes/ws.tsx"),

  // Workspaces Layout
  layout("./components/workspaces/Layout/WorkspacesLayout.tsx", [
    route("create", "./routes/workspaces/create.tsx"),
    route("manage", "./routes/workspaces/manage.tsx"),
  ]),

  // Workspace Layout
  layout("./components/workspace/layout/WorkspaceLayout.tsx", [

    layout("./components/workspace/projects/layout/ProjectsLayout.tsx", [
      route(":workspaceId", "./routes/workspace/$workspaceId.tsx"),
      route(
        ":workspaceId/pages",
        "./routes/workspace/$workspaceId/pages/index.tsx",
      ),
      route(
        ":workspaceId/works",
        "./routes/workspace/$workspaceId/works/index.tsx",
      ),
      route(
        ":workspaceId/stickies",
        "./routes/workspace/$workspaceId/stickies/index.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/stickies",
        "./routes/workspace/$workspaceId/project/$projectId/stickies.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/tasks",
        "./routes/workspace/$workspaceId/project/$projectId/task.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/overview",
        "./routes/workspace/$workspaceId/project/$projectId/overview.tsx",
      ),

      route(
        ":workspaceId/projects/:projectId/pages",
        "./routes/workspace/$workspaceId/project/pages.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage",
        "./routes/workspace/$workspaceId/project/$projectId/storage/index.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/settings",
        "./routes/workspace/$workspaceId/project/$projectId/settings.tsx",
      ),
    ]),
    route(
      ":workspaceId/setting",
      "./routes/workspace/$workspaceId/setting.tsx",
    ),
    layout("./components/workspace/ai/layout/ChatAiLayout.tsx", [
      route(":workspaceId/ai", "./routes/workspace/$workspaceId/ai/index.tsx"),
      // [ route(":chatId", "./routes/workspace/$workspaceId/ai/$chatId$/chatId.tsx"),
      // ],
    ]),
    layout("./components/workspace/storage/layout/StorageLayout.tsx", [
      route(":workspaceId/storage", "./routes/workspace/$workspaceId/storage/index.tsx"),
      route(":workspaceId/storage/my-files", "./routes/workspace/$workspaceId/storage/my-files.tsx"),
      route(":workspaceId/storage/shared", "./routes/workspace/$workspaceId/storage/shared.tsx"),
      route(":workspaceId/storage/starred", "./routes/workspace/$workspaceId/storage/starred.tsx"),
      route(":workspaceId/storage/trash", "./routes/workspace/$workspaceId/storage/trash.tsx"),
    ]),
    route(":workspaceId/team", "./routes/workspace/$workspaceId/team.tsx"),
    route(":workspaceId/roles", "./routes/workspace/$workspaceId/roles/index.tsx"),
    route(":workspaceId/roles/:roleId", "./routes/workspace/$workspaceId/roles/$roleId.tsx"),
  ]),


  layout("./components/workspace/$pageId/layout/PageLayout.tsx", [
    route("/editor/:pageId", "./routes/workspace/$pageId/$pageId.tsx"),
  ]),
] satisfies RouteConfig;
