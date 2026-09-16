import {
  apiGet,
  apiPost,
  apiPut,
  setTokens,
  removeAuthToken,
  getAuthToken,
  getRefreshToken,
} from "@/shared/lib/api";
import { isApiError } from "@/shared/types/api.types";
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
  const res = await apiPost<{
    user?: AuthUser;
    accessToken?: string;
    token?: string;
    refreshToken?: string;
  } & Partial<AuthUser>>('/auth/login', payload);

  const accessToken = res.accessToken || res.token;
  if (accessToken) {
    setTokens(accessToken, res.refreshToken || '');
  }

  const user: AuthUser = (res.user || res) as AuthUser;
  if (user?.name) {
    user.name = fixMojibake(user.name);
  }
  setCachedUser(user);
  return user;
};

const USER_CACHE_KEY = 'flux_cached_user';

export function getCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Ignore quota or security errors
  }
}

/**
 * Retrieves the current authenticated user's profile from the session endpoint.
 * Resilient against transient backend reboots and gateway 502/503 errors.
 */
export const getUser = async (): Promise<AuthUser | null> => {
  const token = getAuthToken();
  if (!token) {
    setCachedUser(null);
    return null;
  }

  try {
    const data = await apiGet<{ user?: AuthUser } & Partial<AuthUser>>('/auth/user');
    const user = data?.user || (data?.id ? (data as AuthUser) : null);
    if (user) {
      if (user.name) {
        user.name = fixMojibake(user.name);
      }
      setCachedUser(user);
      return user;
    }
    removeAuthToken();
    setCachedUser(null);
    return null;
  } catch (err: unknown) {
    // ONLY purge credentials if the server explicitly rejects authentication (401 / 403)
    const isExplicitAuthFailure =
      isApiError(err) && (err.statusCode === 401 || err.statusCode === 403);

    if (isExplicitAuthFailure) {
      removeAuthToken();
      setCachedUser(null);
      return null;
    }

    // Transient failure (backend rebooting, 502 Bad Gateway, network timeout):
    // Fall back to cached user profile to prevent disruptive logout loops!
    const cached = getCachedUser();
    if (cached) {
      return cached;
    }

    // If no cache exists, throw so caller / React Query knows it's a network error rather than unauthenticated
    throw err;
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
  setCachedUser(null);
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
