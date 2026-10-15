/**
 * src/features/editor/subsystems/keybinding/index.ts
 *
 * Keybinding Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Scoped Keyboard Shortcut Registry & Router (VS Code / Overleaf parity).
 * - Keybinding customization and keymap configuration.
 */

export {
  keybindingCoordinator,
  KeybindingCoordinatorRegistry,
  type KeybindingScope,
  type ShortcutDefinition,
} from './coordinator/keybinding.coordinator';
