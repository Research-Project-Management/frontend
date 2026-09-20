# ADR 002: Pragmatic Hexagonal Frontend Architecture (PHFA) for Feature Modules

## Status
**Accepted** (2026-09-19)

## Context
The `features/library` module in Flux had grown organically into a large, monolithic subsystem ("nồi bánh thập cẩm"):
1. **Split-Brain State**: Sidebar layout, item selection, and modal dialog state were scattered across 3 separate Zustand stores (`sidebar.store.ts`, `library-view.store.ts`, `library-modal.store.ts`) with duplicated state keys (such as `isInspectorOpen` appearing in two stores simultaneously), creating synchronization bugs and race conditions.
2. **$O(N)$ Re-render Bottlenecks**: The table row component (`ItemTable.tsx`, 667 lines) subscribed directly to the full `selectedIds: string[]` array and entire item collections. Clicking a single row caused 500+ rows to simultaneously re-render, dropping framerates well below 60 FPS on large collections.
3. **Monolithic Inspector**: `InfoSection.tsx` had ballooned to 1,620 lines, mixing schema parsing, author manipulation, dynamic registry fields, retraction warnings, and item conversion modals in one unmaintainable file.
4. **Fuzzy Layering**: The folder structure used a generic `ui/` directory containing top-level Next.js route pages alongside micro-components and modals, blurring the boundary between domain business logic, server state cache, client UI state, and routing.

## Decision
We adopted **Pragmatic Hexagonal Frontend Architecture (PHFA)** for `features/library/` (and established it as the architectural standard for all complex frontend features in Flux).

PHFA synthesizes five established software architecture paradigms:

### 1. Hexagonal Architecture (Cockburn, 2005) - Ports & Adapters
- **Domain Core**: Pure TypeScript logic (citations, deduplication, search filters, diffing, creator normalization) is completely isolated from React, the browser DOM, and network APIs.
- **Driven Adapters (Outbound)**: HTTP API client (`ItemService`, `CollectionService`), file downloaders, and localStorage adapters interact with external systems through typed interfaces.
- **Driving Adapters (Inbound)**: React UI components and Next.js page controllers drive the domain by reading state through selectors and dispatching actions.

### 2. Clean Architecture (Martin, 2012) - Inward Dependency Rule
Dependencies strictly point inward in a directed acyclic graph (DAG):
```
pages/ (Routing)
  └── components/ (Presentation & User Interaction)
        ├── data/ (Server State Queries & Cache)
        └── store/ (Client UI Layout & Transient State)
              └── domain/ (Pure Business Logic & Rules)
                    └── types/ (Contract Definitions)
```
- Rule: `domain/` CANNOT import from `store/`, `data/`, `components/`, or `pages/`.
- Rule: `domain/` contains 0% React hooks and 0% DOM dependencies.

### 3. Elm Architecture / Flux - Unidirectional Data Flow
- **Model**: Single source of truth for UI state in `store/library-ui.store.ts` (persisted to localStorage) and server state in TanStack Query cache (`data/`).
- **Update**: State mutations occur via explicit store actions or optimistic React Query mutations.
- **View**: UI components derive view models using memoized primitive selectors (`useIsItemSelected(id)`, `useActiveItemId()`, `useViewMode()`).

### 4. Client-side CQRS (Command Query Responsibility Segregation)
- **Queries (Read)**: Managed by TanStack Query (`useItems`, `useCollections`, `useAttachments`) with automatic background revalidation, stale-time caching, and garbage collection.
- **Commands (Write)**: Explicit mutations with optimistic updates and rollback on failure (`updatePaper`, `convertItemType`, `deleteItems`).
- **Transient UI State**: Pure client interactions (column resizing, panel collapsing, active tab, active modal dialog) reside exclusively in Zustand.

### 5. Deep Modules (Ousterhout / Pocock)
- Modules expose narrow, expressive public surfaces while hiding rich, robust implementations behind them.
- External features (`reader`, `editor`, `ai`, `projects`, Next.js App Router) ONLY import from the public contract: `@/features/library` (`features/library/index.ts`).
- Internal organization is encapsulated:
  - `pages/`: Route-level entry points (`LibraryPage`, `TrashPage`, `DuplicatesPage`, `RecentlyReadPage`, `UnfiledPage`).
  - `components/`: Pure presentation split into `content/`, `inspector/`, `sidebar/`, `topbar/`, `modals/`.
  - `components/inspector/fields/`: Decomposed fieldsets (`InlineField`, `InlineTextarea`, `CreatorFields`, `GeneralFields`, `DynamicInspectorField`, `ExtraAuditFields`).
  - `utils/`: Generic, domain-agnostic helpers (`format-bytes`, `download`).

### 6. High-Performance $O(1)$ Row Rendering Pattern
To guarantee sustained 60 FPS table performance on 500+ items:
- `ItemTableRow` is memoized with `React.memo`.
- Instead of rows subscribing to `selectedIds: string[]` (which causes all $N$ rows to re-render whenever one row is toggled), rows subscribe to boolean primitive selectors:
  ```tsx
  const isSelected = useIsItemSelected(item.id);
  const isActive = useIsActiveItem(item.id);
  ```
- Result: Toggling selection of an item only re-renders the previous active row and the new active row ($O(1)$ cost instead of $O(N)$).

## Consequences

### Positive
- **Guaranteed 60 FPS Interaction**: Table selection, keyboard navigation, and inspector resizing remain silky smooth even with hundreds of loaded references.
- **Zero Split-Brain State**: Layout, selection, and modal dialog state are unified in `library-ui.store.ts` with no duplicate keys.
- **100% Backwards Compatibility**: Zero breaking changes to external consumers (`reader`, `editor`, `projects`, Next.js routes). Legacy shims ensure all existing imports continue working seamlessly.
- **Maintainable Codebase**: `ItemTable.tsx` dropped from 667 to ~220 lines. `InfoSection.tsx` dropped from 1,620 to 480 lines with modular fieldsets.
- **Testable Pure Logic**: 100% of domain rules can be unit tested without mounting React components or mocking the DOM.

### Negative / Trade-offs
- Additional selector functions are required (`useIsItemSelected`, `useIsActiveItem`) instead of simple direct store destructuring.
- Increased number of smaller component files in `components/inspector/fields/`.

### Architecture Invariants
1. `features/library/domain/` must NEVER import React, Next.js, or DOM APIs.
2. External consumers must NEVER import internal files (e.g. `features/library/components/content/...`); they must only import through `@/features/library`.
3. Table row components must NEVER subscribe to `selectedIds` directly. Always use primitive granular selectors.
