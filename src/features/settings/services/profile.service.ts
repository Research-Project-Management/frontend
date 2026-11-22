import { apiGet, apiPut } from "@/shared/lib/api";
import type { AuthUser } from '@/features/auth/types/auth.types';
import type { UpdateProfilePayload } from '../types/profile.types';

export interface AiByokSettingsView {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string;
}

export interface UserSettingsResponse {
  settings: {
    theme?: string;
    locale?: string;
    editorConfig?: {
      aiByok?: AiByokSettingsView;
      [key: string]: unknown;
    };
  };
}

export interface UpdateAiByokPayload {
  enabled: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export const updateProfile = async (
  data: UpdateProfilePayload,
): Promise<{ user: AuthUser }> => {
  return apiPut<{ user: AuthUser }>('/auth/profile', {
    name: data.name,
    avatar: data.avatar ?? null,
  });
};

export const getUserSettings = async (): Promise<UserSettingsResponse> => {
  return apiGet<UserSettingsResponse>('/api/users/settings');
};

export const updateAiByokSettings = async (
  payload: UpdateAiByokPayload,
): Promise<UserSettingsResponse> => {
  return apiPut<UserSettingsResponse>('/api/users/settings', {
    settings: {
      editorConfig: {
        aiByok: payload,
      },
    },
  });
};
