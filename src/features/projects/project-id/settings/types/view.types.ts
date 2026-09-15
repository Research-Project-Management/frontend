export type DefaultProjectViewLayout = 'board' | 'list' | 'table' | 'calendar' | 'timeline';

export interface ProjectViewSettingsConfig {
  defaultLayout: DefaultProjectViewLayout;
  allowPublicViews: boolean;
  showEmptyGroups: boolean;
  lockedSystemViews?: boolean;
}

export const DEFAULT_PROJECT_VIEW_SETTINGS: ProjectViewSettingsConfig = {
  defaultLayout: 'board',
  allowPublicViews: true,
  showEmptyGroups: true,
  lockedSystemViews: false,
};
