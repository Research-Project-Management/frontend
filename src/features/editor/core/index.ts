/**
 * core/index.ts
 *
 * Public API barrier for Editor Core (CommandBus, Contexts, Reactive Bridges, Session & Models).
 */

// Re-export from canonical Coordinators and Domain layers
export * from '../coordinators';
export * from '../domain';

export * from './context/editor-instance.context';
export * from './context/viewer-instance.context';
export * from './session/useDocumentSession';
