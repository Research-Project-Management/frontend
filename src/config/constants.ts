export const APP_CONFIG = {
  name: 'Research Management',
  version: '1.0.0',
  apiTimeout: 10000,
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  WORKSPACE: (workspaceId: string) => `/${workspaceId}`,
};
