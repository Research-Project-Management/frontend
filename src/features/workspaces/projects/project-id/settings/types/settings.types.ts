export interface ProjectSettingsNavTab {
  id: string;
  label: string;
  icon: any;
  to: string;
  aliases?: string[];
  exact?: boolean;
}
