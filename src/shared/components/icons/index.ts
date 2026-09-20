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

// Icon Picker & Project Avatar (consolidated from icon-picker)
export { IconPicker, type IconPickerProps } from "./IconPicker";
export { default } from "./IconPicker";
export {
  ProjectAvatar,
  type ProjectAvatarProps,
  PROJECT_DEFAULT_EMOJIS,
  getRandomProjectEmoji,
  getDeterministicProjectEmoji,
} from "./ProjectAvatar";
export { ICON_MAP, ICONS, ICON_PALETTE, type IconItem } from "./icon-data";
export { EMOJI_CATEGORIES, SKIN_TONES, type EmojiItem, type EmojiCategory } from "./emoji-data";
