/**
 * auth-types.ts
 * All TypeScript types scoped to the auth feature.
 */

export type AuthUser = {
  id?: string;
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterResponse = {
  user: AuthUser;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  message: string;
};
