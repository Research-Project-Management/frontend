# Research Project Management (RPM) — Domain Context (IAM)

## 1. Ubiquitous Language

### Identity & Authentication
- **Principal / Identity**: The unique entity accessing the system, uniquely identified by a `UserId` (UUIDv4).
- **Session**: A verified, time-bound interaction state established via an Access Token (`1h`) and stored Refresh Token (`30d`).
- **AccessToken**: Signed JWT payload containing `{ sub: UserId, email: string }`.
- **RefreshToken**: Cryptographically secure token persisted in database (`refresh_tokens` table) with rotation and revocation capabilities.

### Organization & Tenancy
- **Workspace**: The top-level multi-tenant boundary identified by `WorkspaceId` (UUID) and `url` (slug). All projects, papers, cycles, and files belong to exactly one Workspace.
- **WorkspaceMember**: The association between a `UserId` and a `WorkspaceId` with a hierarchical role:
  - `owner` (Level 4): Full administrative and destructive control over the workspace.
  - `admin` (Level 3): Manage members, billing, integrations, and global workspace settings.
  - `member` (Level 2): Create projects, upload papers, author notes, create tasks.
  - `viewer` (Level 1): Read-only access across the workspace.

### Project & Collaboration
- **Project**: A scoped research endeavor within a Workspace, identified by `ProjectId`.
- **ProjectMember**: The association between a `UserId` and a `ProjectId` with a scoped role:
  - `admin` (Level 4): Full control over project configurations, cycles, and member assignments.
  - `contributor` (Level 3): Author and edit documents, tasks, stickies, and cycles.
  - `commenter` (Level 2): View project artifacts and leave comments/reviews.
  - `viewer` (Level 1): Read-only access to project contents.

---

## 2. Architectural Invariants

1. **Strict Identifier Branding**: `UserId`, `WorkspaceId`, and `ProjectId` must never be passed interchangeably. Type-level branded types enforce this at compile-time across all services and guards.
2. **Context Resolution Locality**: Guards resolve and verify membership once, attaching typed `workspaceMember` and `projectMember` to the execution context. Downstream controllers consume these via `@CurrentMember()` without duplicate database roundtrips.
3. **Exhaustive Auth State**: Frontend client state models Authentication strictly as a Discriminated Union (`loading` | `unauthenticated` | `authenticated`), eliminating contradictory boolean flags.
