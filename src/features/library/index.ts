/**
 * Features / Library - Public API
 *
 * This is the canonical entry point that external features (reader, projects, etc.)
 * and app routes import from.
 */

// Pages (for Next.js App Router)
export {
  ModernLibraryPage as LibraryPage,
  ModernLibraryPage,
  TrashPage,
  DuplicatesPage,
  RecentlyReadPage,
  UnfiledPage,
} from './pages';

// Aliased Layout Components
export { LibrarySidebar as Sidebar, LibrarySidebar } from './components';
export { LibraryTopbar as Topbar, LibraryTopbar } from './components';

// Unified Library Services SDK (Microservice Facade)
export {
  libraryServices,
  libraryService,
  LibraryServices,
  LIBRARY_SERVICES_API_BASE,
  LIBRARY_DOMAINS,
  getDomainEndpoint,
} from './data';

// Architecture Layers: Types, Store, Data, Domain, Components, Utils, Hooks
export * from './types';
export * from './store';
export * from './data';
export * from './domain';
export * from './components';
export * from './utils';
export * from './hooks';
