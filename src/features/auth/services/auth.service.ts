import {
  apiGet,
  apiPost,
  apiPut,
  setTokens,
  removeAuthToken,
  getAuthToken,
  getRefreshToken,
} from "@/shared/lib/api";
import { fixMojibake } from "@/shared/lib/utils";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from '../types/auth.types';

/**
 * Authenticates user credentials, stores access/refresh tokens, and returns user profile.
 */
export const loginUser = async (payload: LoginPayload): Promise<AuthUser> => {
  const data = await apiPost<AuthUser & {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
  }>('/auth/login', payload);

  if (data.accessToken || data.token) {
    setTokens(data.accessToken || data.token!, data.refreshToken || '');
  }
  if (data.name) {
    data.name = fixMojibake(data.name);
  }
  return data;
};

/**
 * Retrieves the current authenticated user's profile from the session endpoint.
 */
export const getUser = async (): Promise<AuthUser | null> => {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const data = await apiGet<{ user: AuthUser }>('/auth/user');
    if (data?.user) {
      if (data.user.name) {
        data.user.name = fixMojibake(data.user.name);
      }
      return data.user;
    }
    return null;
  } catch (err: unknown) {
    return null;
  }
};

/**
 * Registers a new user account with credentials and optionally auto-persists tokens.
 */
export const registerUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  const res = await apiPost<
    RegisterResponse & {
      accessToken?: string;
      token?: string;
      refreshToken?: string;
    }
  >('/auth/register', payload);

  if (res.accessToken || res.token) {
    setTokens(res.accessToken || res.token!, res.refreshToken || '');
  }
  return res;
};

/**
 * Revokes the server-side refresh token and clears all local credentials.
 */
export const logoutUser = async (): Promise<void> => {
  const refreshToken = getRefreshToken();
  removeAuthToken();
  try {
    if (refreshToken) {
      await apiPost('/auth/logout', { refreshToken });
    } else {
      await apiPost('/auth/logout', {});
    }
  } catch {
    // Graceful swallow of network failures during client logout
  }
};

/**
 * Dispatches a password reset request email to the specified address.
 */
export const forgotPassword = async (email: string): Promise<void> => {
  await apiPost('/auth/forgot-password', { email });
};

/**
 * Updates the user password after verifying current credentials.
 */
export const changePassword = async (
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> => {
  return apiPut<ChangePasswordResponse>('/auth/change-password', payload);
};
