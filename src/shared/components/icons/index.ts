export * from "./CycleIcon";
export * from "./WorkItemsIcon";
export * from "./AddWorkItemIcon";
export * from "./StickiesIcon";
export * from "./DraftsIcon";
export * from "./StatusIcon";
export * from "./PriorityIcons";
export * from "./ViewIcons";
import * as PriorityIcons from "./PriorityIcons";
import * as ViewIcons from "./ViewIcons";
export { PriorityIcons, ViewIcons };
export * from "./LibraryIcon";
export * from "./StorageIcon";
export * from "./ProjectsIcon";
export * from "./AIIcon";
export * from "./IntegrationIcons";

// Icon Picker & Project Avatar (consolidated from icon-picker)
export { IconPicker, type IconPickerProps } from "./IconPicker";
export {
  ProjectAvatar,
  type ProjectAvatarProps,
  PROJECT_DEFAULT_EMOJIS,
  getRandomProjectEmoji,
  getDeterministicProjectEmoji,
} from "./ProjectAvatar";
export { ICON_MAP, type IconItem } from "./icon-data";
export type { EmojiItem, EmojiCategory } from "./emoji-data";
