# Flux Frontend — Engineering Handbook & Developer Guidelines

> **Internal Reference Manual** for frontend engineers and AI agents contributing to the Flux web client.  
> Design System specs: [`../DESIGN.md`](../DESIGN.md) | Product vision: [`../PRODUCT.md`](../PRODUCT.md) | Agent constraints: [`./AGENTS.md`](./AGENTS.md)

---

## 📑 Table of Contents

1. [Technology Stack Matrix](#1-technology-stack-matrix)
2. [Getting Started & Local Environment](#2-getting-started--local-environment)
3. [Architecture & Directory Anatomy](#3-architecture--directory-anatomy)
4. [Module Boundaries & Strict No-Barrel Policy](#4-module-boundaries--strict-no-barrel-policy)
5. [State Management Hierarchy](#5-state-management-hierarchy)
6. [Design System & Craft Floor Rules](#6-design-system--craft-floor-rules)
7. [Testing, Auditing & Quality Gates](#7-testing-auditing--quality-gates)
8. [Code Conventions & PR Protocol](#8-code-conventions--pr-protocol)

---

## 1. Technology Stack Matrix

| Layer | Technology | Version | Rationale & Usage |
|---|---|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router) | `16.3.x` | Turbopack compilation, React Server Components (RSC), route groups |
| **Runtime UI** | [React](https://react.dev/) | `19.2.x` | Modern Concurrent Features, Actions, Server/Client components |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `5.9.x` | Strict mode enabled, zero untyped code policy |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `4.3.x` | CSS-first `@theme`, pure semantic CSS variables, zero runtime overhead |
| **Primitives** | [Radix UI](https://www.radix-ui.com/) | Latest | Unstyled, accessible (WAI-ARIA compliant) headless primitives |
| **Icons** | [Lucide React](https://lucide.dev/) | `1.47.x` | Consistent optical weight, monochrome UI chrome icons |
| **Server State** | [TanStack Query](https://tanstack.com/query/v5) | `v5.101.x` | Caching, deduplication, optimistic mutations, server synchronization |
| **Client State** | [Zustand](https://zustand.docs.pmnd.rs/) | `v5.0.x` | High-performance, lightweight UI state management |
| **Document/CRDT** | [CodeMirror 6](https://codemirror.net/) + [Yjs](https://yjs.dev/) | Latest | Collaborative LaTeX/Markdown editor, Vim bindings, real-time sync |
| **Unit/Component Test** | [Vitest](https://vitest.dev/) + RTL | `4.1.x` | Fast Vite-powered scoped runner with jsdom |
| **E2E Testing** | [Playwright](https://playwright.dev/) | `1.62.x` | Multi-browser headless user journey verification |
| **Package Manager** | [pnpm](https://pnpm.io/) | `10.27.x` | Fast, deterministic, space-efficient dependency management |

---

## 2. Getting Started & Local Environment

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` LTS
- **Package Manager**: `pnpm >= 10.27.0` (Run `corepack enable pnpm` if needed)
- **Local Ports**: The frontend runs strictly on port `2915` to avoid collisions with backend and sidecar services.

### Installation

```bash
cd frontend
pnpm install
```

### Daily Development Commands

```bash
# Start Next.js dev server with Turbopack on port 2915 (Default)
pnpm dev

# Fallback: Start dev server with Webpack (only if Turbopack hits native issues)
pnpm dev:webpack

# Release stuck ports (Kills any orphaned processes on port 2915 or 3000 via PowerShell)
pnpm clean:ports

# Clean build artifacts and Next.js cache
pnpm clean

# Production build test
pnpm build
```

---

## 3. Architecture & Directory Anatomy

Flux follows a **Domain-Driven, Feature-Sliced Architecture** prioritizing high cohesion, clear ownership, and rapid compilation.

```
frontend/
├── public/                 # Static assets (fonts, workers, SVGs)
├── src/
│   ├── app/                # Next.js App Router (Routing & Shells ONLY)
│   │   ├── (app)/          # Authenticated app routes (workspaces, dashboard)
│   │   ├── (auth)/         # Authentication routes (login, register, reset)
│   │   ├── (editor)/       # Fullscreen LaTeX & document editor workspace
│   │   ├── (marketing)/    # Public landing and product pages
│   │   ├── layout.tsx      # Root application shell
│   │   └── providers.tsx   # Global React providers (QueryClient, Theme, Toast)
│   │
│   ├── features/           # Self-contained business domains
│   │   ├── ai/             # Multi-agent chat, RAG panels, citation assistant
│   │   ├── auth/           # Session management, login cards, OAuth handlers
│   │   ├── editor/         # CodeMirror 6 engine, LaTeX composer, Vim mode, Yjs sync
│   │   ├── library/        # Literature catalog, PDF viewer, DOI/BibTeX extraction
│   │   ├── projects/       # Kanban boards, Work Items, Lists, Timelines
│   │   ├── reader/         # Academic PDF reader & annotation layer
│   │   ├── stickies/       # Brainstorming paper notes & canvas
│   │   └── storage/        # Cloud asset manager & upload pipelines
│   │
│   ├── shared/             # Universal domain-agnostic primitives
│   │   ├── components/     # Reusable UI primitives (buttons, inputs, dialogs)
│   │   │   ├── layout/     # PageLayout, PageHeader, PageToolbar, EmptyState
│   │   │   └── ui/         # Radix + Tailwind headless building blocks
│   │   ├── hooks/          # Universal hooks (useDebounce, useMediaQuery, etc.)
│   │   ├── lib/            # Shared utilities (fetcher, date formatting, cn helper)
│   │   ├── styles/         # Global stylesheets & font definitions
│   │   └── types/          # Universal ambient and shared contract types
│   │
│   ├── config/             # Environment, route definitions, and feature flags
│   └── proxy.ts            # Development reverse proxy configuration
```

### Architectural Layering Rules

1. **`src/app` is thin**:
   - `app/` routes only handle URL params, authentication guards, data prefetching, and composing feature components.
   - Do **NOT** write rich business logic or inline DOM elements (> 50 lines) directly in `page.tsx`. Delegate to a feature screen component.
2. **`src/features/*` are self-contained**:
   - Features own their internal sub-components, stores, queries, and business utilities.
   - Internal sub-folders typically comprise: `/ui` (or `/components`), `/domain` (models & business logic), `/hooks`, and `/store`.
3. **`src/shared/*` never imports from `src/features/*`**:
   - Primitives in `shared` must remain 100% agnostic of specific business entities.

---

## 4. Module Boundaries & Strict No-Barrel Policy

### 🚫 The Hard Ban on Barrel Files (`index.ts`)

> **CRITICAL PERFORMANCE RULE**: Do **NOT** create or import from `index.ts` barrel files.

#### Why is this enforced?
Barrel files force bundlers (Webpack and Turbopack) to parse and build the entire exported module graph regardless of whether a single symbol is used. In Next.js with React Server Components, barrel files cause:
- **Massive memory bloat** during `next dev`.
- **Significant HMR lag** (Fast Refresh taking seconds instead of milliseconds).
- **Accidental client-server boundary leaks** (`'use client'` spreading to server-safe utilities).

#### Import Standards

```typescript
// ❌ FORBIDDEN: Barrel file imports
import { Button, Dialog } from '@/shared/components';
import { ProjectCard } from '@/features/projects';
import { useAuth } from '@/features/auth';

// ✅ MANDATORY: Direct file path imports
import { Button } from '@/shared/components/ui/button';
import { Dialog } from '@/shared/components/ui/dialog';
import { ProjectCard } from '@/features/projects/home/components/project-card';
import { useAuth } from '@/features/auth/hooks/use-auth';
```

### Cross-Feature Code Sharing Matrix

- **Types & Contracts**: Allowed to be imported across features using **direct subpath imports** (e.g., `import type { Project } from '@/features/projects/domain/models/project'`).
- **UI Components & Hooks**: If a component or hook is needed by **more than one feature**, it **MUST be promoted to `@/shared/*`**. Never deep-import UI components across features.

---

## 5. State Management Hierarchy

Flux clearly separates concerns across 4 distinct state tiers. Choose the appropriate tool using the matrix below:

| Tier | Category | Technology | Usage & Boundary |
|---|---|---|---|
| **1** | **Server State & Cache** | **TanStack Query v5** | API data, server caching, pagination, mutation with optimistic rollback. Never duplicate API response data into Zustand! |
| **2** | **Global Client UI State** | **Zustand v5** | Ephemeral application UI states only: sidebar collapsed, active modal states, command palette toggle, current active view mode. |
| **3** | **Document / CRDT State** | **CodeMirror 6 + Yjs** | Real-time collaborative LaTeX documents, cursor presence, undo/redo histories. Managed via editor engine coordinators. |
| **4** | **Form State** | **React Hook Form + Zod** | Controlled/uncontrolled form inputs, client-side schema validation, field errors, touched states. |

### Query Key Conventions (TanStack Query)

Always organize query keys in structured arrays using a factory pattern:

```typescript
// ✅ Good: Structured query key hierarchy
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string, filter: ProjectFilter) => 
    [...projectKeys.lists(), { workspaceId, ...filter }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...projectKeys.details(), projectId] as const,
};
```

---

## 6. Design System & Craft Floor Rules

Frontend UI follows **"The Linear Lab Protocol"** — high-density academic precision inspired by Plane.so and Linear.  
Detailed specs, color tokens, and ergonomics are defined in [`../DESIGN.md`](../DESIGN.md).

### The Golden Development Rules

1. **Strict 600 Weight Ceiling**:
   - **Never** use `font-bold` (700+). Visual hierarchy is driven by size and contrast, never heavy bold fonts.
   - Max weight allowed in UI: `font-semibold` (600) for headers/KPIs, `font-medium` (500) for badges/labels, `font-normal` (450) for body/tables.
2. **Plane.so 32px / 13px Cadence**:
   - Standard data rows, table items, toolbar items, and buttons have a default height of **32px** (`h-8`), font size of **13px** (`text-13`), and optical line height of `1.54` (`leading-normal`).
3. **Pure Semantic Color Tokens (No Raw Tailwind Colors)**:
   - **Never** use raw Tailwind colors like `bg-blue-500`, `text-red-600`, or `text-amber-500`.
   - **Always** use CSS semantic tokens: `bg-primary`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `text-warning`, `text-success`.
4. **Dual-Engine Color Separation**:
   - **Primer Blue (`#0969DA` / dark: `#58A6FF`)**: Exclusively for human/system actions (primary CTA, active navigation, active filters).
   - **Copilot Purple (`#8250DF` / dark: `#BC8CFF`)**: Exclusively for AI intelligence (chat triggers, AI badges, RAG verified labels, citation recommendations). Never mix them.
5. **Flat-By-Default (`shadow-none`)**:
   - All cards, containers, inputs, and buttons are flat (`shadow-none`). Boundaries are defined strictly by hairline borders (`border border-border`).
   - Shadows are reserved strictly for floating overlays (Dropdowns, Popovers, Dialog modals).
6. **Zero Academic Surface Rule**:
   - The LaTeX Editor, PDF Reader, and Academic Composer must have **zero animations** (`0ms transition`). Preserve uninterrupted focus for researchers.
7. **Consistent Page Layout Primitives**:
   - All feature pages must compose layout from `@/shared/components/layout`: `PageLayout`, `PageHeader`, `PageToolbar`, `PageContent`, `EmptyState`.

---

## 7. Testing, Auditing & Quality Gates

### Pre-PR Quality Gate (Required Before Every Commit/PR)

Every PR must pass this 3-step verification locally:

```bash
# Step 1: Strict TypeScript compilation check
pnpm typecheck

# Step 2: ESLint rule verification
pnpm lint

# Step 3: Run Vitest on changed files or targeted feature scope
pnpm test:changed
# OR targeted feature test:
pnpm test:projects
```

### Scoped Test Commands

To keep the development feedback loop under 5 seconds, run unit tests targeted to your active feature:

| Command | Target Scope |
|---|---|
| `pnpm test:changed` | Runs tests affected by uncommitted or recent git changes |
| `pnpm test:projects` | Tests under `tests/unit/projects` |
| `pnpm test:editor` | Tests under `tests/unit/editor` |
| `pnpm test:library` | Tests under `tests/unit/library` |
| `pnpm test:storage` | Tests under `tests/unit/storage` |
| `pnpm test:reader` | Tests under `tests/unit/reader` |
| `pnpm test:ai` | Tests under `tests/unit/ai` |
| `pnpm test:auth` | Tests under `tests/unit/auth` |
| `pnpm test:shared` | Tests under `tests/unit/shared` |

### ⛔ Prohibited Commands (Do NOT Run)

As mandated in [`./AGENTS.md`](./AGENTS.md):
- **DO NOT run full-codebase audits** (`knip`, `madge`, `jscpd`). These commands cause high CPU/memory usage, hang execution runners, and trigger false positives on dynamic route manifests.

---

## 8. Code Conventions & PR Protocol

### 1. Server vs. Client Component Boundaries
- By default, all components in `src/app/` are React Server Components (RSC).
- Add `'use client'` only at the top of leaf components that require:
  - React hooks (`useState`, `useEffect`, `useCallback`, etc.)
  - Event listeners (`onClick`, `onChange`, `onSubmit`)
  - Browser-only APIs (`window`, `localStorage`, `navigator`)
- Keep `'use client'` boundaries as low in the component tree as possible.

### 2. Git Commit Conventions
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(projects)`: Add Kanban column drag-and-drop
- `fix(editor)`: Resolve cursor jump on remote Yjs sync
- `refactor(library)`: Migrate PDF parser to direct subpath imports
- `perf(shared)`: Optimize Radix dropdown mounting time
- `test(ai)`: Add unit tests for citation format validation
- `style(ui)`: Enforce 32px height cadence on table action items

### 3. Pre-Merge Checklist
Before submitting a Pull Request:
- [ ] Code strictly avoids creating or importing from `index.ts` (No-Barrel rule).
- [ ] No `font-bold` used in styles (600 weight ceiling respected).
- [ ] Semantic tokens used instead of hardcoded/raw Tailwind colors.
- [ ] `pnpm typecheck` returns 0 errors.
- [ ] `pnpm lint` returns 0 warnings/errors.
- [ ] Scoped unit tests (`pnpm test:<feature>`) pass cleanly.
