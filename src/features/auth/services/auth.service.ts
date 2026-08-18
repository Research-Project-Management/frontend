import { apiGet, apiPost, apiPut, setTokens, removeAuthToken, getAuthToken } from '@/shared/lib/api';
import { ApiError } from '@/shared/types/api.types';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from '../types/auth.types';

export const loginUser = async (payload: LoginPayload): Promise<AuthUser> => {
  const data = await apiPost<{ user: AuthUser; accessToken?: string; token?: string; refreshToken?: string }>('/auth/login', payload);
  if (data.accessToken || data.token) {
    setTokens(data.accessToken || data.token!, data.refreshToken || '');
  }
  return data.user;
};

export const getUser = async (): Promise<AuthUser | null> => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const data = await apiGet<{ user: AuthUser }>('/auth/user');
    return data.user;
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      removeAuthToken();
      return null;
    }
    throw err;
  }
};

export const registerUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  const res = await apiPost<RegisterResponse & { accessToken?: string; token?: string; refreshToken?: string }>('/auth/register', payload);
  if (res.accessToken || res.token) {
    setTokens(res.accessToken || res.token!, res.refreshToken || '');
  }
  return res;
};

export const logoutUser = async (): Promise<void> => {
  removeAuthToken();
  await apiGet('/auth/logout');
};

export const forgotPassword = async (email: string): Promise<void> => {
  await apiPost('/auth/forgot-password', { email });
};

export const changePassword = async (
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> => {
  return apiPut<ChangePasswordResponse>('/auth/change-password', payload);
};
