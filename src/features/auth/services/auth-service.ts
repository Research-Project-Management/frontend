import { apiGet, apiPost, apiPut, setAuthToken, removeAuthToken } from '@/shared/lib/api';
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from '../types/auth-types';

export const loginUser = async (payload: LoginPayload): Promise<AuthUser> => {
  const data = await apiPost<{ user: AuthUser; accessToken?: string; token?: string }>('/auth/login', payload);
  if (data.accessToken || data.token) {
    setAuthToken(data.accessToken || data.token!);
  }
  return data.user;
};

export const getUser = async (): Promise<AuthUser> => {
  const data = await apiGet<{ user: AuthUser }>('/auth/user');
  return data.user;
};

export const registerUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  const res = await apiPost<RegisterResponse & { accessToken?: string; token?: string }>('/auth/register', payload);
  if (res.accessToken || res.token) {
    setAuthToken(res.accessToken || res.token!);
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
