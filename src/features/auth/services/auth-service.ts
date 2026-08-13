import { apiGet, apiPost, apiPut } from '@/shared/lib';

import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from '../types/auth-types';

export const loginUser = async (payload: LoginPayload): Promise<AuthUser> => {
  const data = await apiPost<{ user: AuthUser }>('/auth/login', payload);
  return data.user;
};

export const getUser = async (): Promise<AuthUser> => {
  const data = await apiGet<{ user: AuthUser }>('/auth/user');
  return data.user;
};

export const registerUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  return apiPost<RegisterResponse>('/auth/register', payload);
};

export const logoutUser = async (): Promise<void> => {
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
