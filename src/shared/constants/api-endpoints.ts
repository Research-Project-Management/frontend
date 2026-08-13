export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** @deprecated Use API_BASE_URL instead. Will be removed once all features are migrated. */
export const API_URL = API_BASE_URL;


export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    FORGOT_PASSWORD: `${API_BASE_URL}/auth/forgot-password`,
  },
  WORKSPACES: {
    BASE: `${API_BASE_URL}/workspaces`,
    DETAIL: (id: string) => `${API_BASE_URL}/workspaces/${id}`,
  },
  // Add more feature endpoints here as the project grows
} as const;
