/**
 * Public entry point for `@/features/editor`.
 *
 * Exposes cross-feature UI entry points, scope resolution helpers, and the
 * Pages SDK facade so sibling features (e.g. `features/pages`) never reach
 * into internal subsystem or SDK file paths.
 */

export {
  TemplateGalleryModal,
  type TemplateGalleryModalProps,
} from './subsystems/explorer';

export { pagesService } from './sdk/pages.service';

export {
  resolvePageScope,
  buildPageScopeHref,
  PERSONAL_SPACE_PARAM,
  PERSONAL_LIBRARY_SCOPE_KEY,
  type PageScope,
  type PageScopeInput,
  type PageSpaceKind,
  type PageEditorSubpath,
  type BuildPageEditorHrefOptions,
} from './core/coordinator/editor-scope';
