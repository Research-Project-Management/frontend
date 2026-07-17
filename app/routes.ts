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
    route("contact-sales", "./routes/contact-sales.tsx"),
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
        ":workspaceId/works/your-work",
        "./routes/workspace/$workspaceId/works/your-work.tsx",
      ),
      route(
        ":workspaceId/pages",
        "./routes/workspace/$workspaceId/pages/index.tsx",
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
        ":workspaceId/projects/:projectId/cycles",
        "./routes/workspace/$workspaceId/project/$projectId/cycle.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/cycles/:cycleId",
        "./routes/workspace/$workspaceId/project/$projectId/cycle-detail.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/overview",
        "./routes/workspace/$workspaceId/project/$projectId/overview.tsx",
        { id: "project-overview" }
      ),
      route(
        ":workspaceId/projects/:projectId",
        "./routes/workspace/$workspaceId/project/$projectId/overview.tsx",
        { id: "project-root" }
      ),

      route(
        ":workspaceId/projects/:projectId/pages",
        "./routes/workspace/$workspaceId/project/$projectId/pages.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage",
        "./routes/workspace/$workspaceId/project/$projectId/storage/index.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage/my-files",
        "./routes/workspace/$workspaceId/project/$projectId/storage/my-files.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage/shared",
        "./routes/workspace/$workspaceId/project/$projectId/storage/shared.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage/starred",
        "./routes/workspace/$workspaceId/project/$projectId/storage/starred.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/storage/trash",
        "./routes/workspace/$workspaceId/project/$projectId/storage/trash.tsx",
      ),
      route(
        ":workspaceId/projects/:projectId/collection",
        "./routes/workspace/$workspaceId/project/$projectId/collection.tsx",
      ),

      layout("./components/workspace/projects/$projectId/settings/layout/ProjectSettingLayout.tsx", [
        route(
          ":workspaceId/projects/:projectId/settings",
          "./routes/workspace/$workspaceId/project/$projectId/settings/index.tsx",
        ),
        route(
          ":workspaceId/projects/:projectId/settings/team",
          "./routes/workspace/$workspaceId/project/$projectId/settings/team.tsx",
        ),
        route(
          ":workspaceId/projects/:projectId/settings/modules",
          "./routes/workspace/$workspaceId/project/$projectId/settings/modules.tsx",
        ),
        route(
          ":workspaceId/projects/:projectId/settings/model",
          "./routes/workspace/$workspaceId/project/$projectId/settings/model.tsx",
        ),
      ]),
    ]),
    layout("./components/workspace/settings/layout/SettingLayout.tsx", [
      route(":workspaceId/settings", "./routes/workspace/$workspaceId/settings/index.tsx"),
      route(":workspaceId/settings/profile", "./routes/workspace/$workspaceId/settings/profile.tsx"),
      route(":workspaceId/settings/members", "./routes/workspace/$workspaceId/settings/members.tsx"),
      route(":workspaceId/settings/roles", "./routes/workspace/$workspaceId/settings/roles.tsx"),
    ]),

    layout("./components/workspace/ai/layout/ChatAiLayout.tsx", [
      route(":workspaceId/ai", "./routes/workspace/$workspaceId/ai/index.tsx"),
      route(":workspaceId/ai/:chatId", "./routes/workspace/$workspaceId/ai/$chatId.tsx"),
    ]),
    layout("./components/workspace/storage/layout/StorageLayout.tsx", [
      route(":workspaceId/storage", "./routes/workspace/$workspaceId/storage/index.tsx"),
      route(":workspaceId/storage/my-files", "./routes/workspace/$workspaceId/storage/my-files.tsx"),
      route(":workspaceId/storage/shared", "./routes/workspace/$workspaceId/storage/shared.tsx"),
      route(":workspaceId/storage/starred", "./routes/workspace/$workspaceId/storage/starred.tsx"),
      route(":workspaceId/storage/trash", "./routes/workspace/$workspaceId/storage/trash.tsx"),
    ]),

    layout("./components/workspace/library/layout/LibraryLayout.tsx", [
      route(":workspaceId/library", "./routes/workspace/$workspaceId/library/index.tsx"),
      route(":workspaceId/library/:collectionId", "./routes/workspace/$workspaceId/library/$collectionId.tsx"),
      route(
        ":workspaceId/library/papers/:paperId/reader",
        "./routes/workspace/$workspaceId/library/reader.$paperId.tsx"
      ),
    ]),
  ]),


  layout("./components/workspace/$pageId/layout/PageLayout.tsx", [
    route("/editor/:pageId", "./routes/workspace/$pageId/$pageId.tsx", { id: "editor-direct" }),
    route(
      ":workspaceId/pages/:pageId",
      "./routes/workspace/$pageId/$pageId.tsx",
      { id: "workspace-page-detail" }
    ),
    route(
      ":workspaceId/projects/:projectId/pages/:pageId",
      "./routes/workspace/$pageId/$pageId.tsx",
      { id: "project-page-detail" }
    ),
  ]),


] satisfies RouteConfig;
