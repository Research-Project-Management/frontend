import { expect, type APIRequestContext } from '@playwright/test';

export async function registerAPI(request: APIRequestContext, name: string, email: string, password: string) {
  const response = await request.post('/auth/register', {
    data: { name, email, password }
  });
  if (!response.ok()) {
    throw new Error(`Failed to register: ${await response.text()}`);
  }
  return response.json();
}

export async function loginAPI(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/auth/login', {
    data: { email, password }
  });
  if (!response.ok()) {
    throw new Error(`Failed to login: ${await response.text()}`);
  }
  return response;
}

export async function createWorkspaceAPI(request: APIRequestContext, name: string) {
  const url = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const response = await request.post('/api/workspace', {
    data: { name, description: '', url }
  });
  if (!response.ok()) {
    throw new Error(`Failed to create workspace: ${await response.text()}`);
  }
  return response.json();
}

export async function createProjectAPI(request: APIRequestContext, workspaceId: string, name: string) {
  const response = await request.post(`/api/workspace/${workspaceId}/projects`, {
    data: { name, description: '' }
  });
  if (!response.ok()) {
    throw new Error(`Failed to create project: ${await response.text()}`);
  }
  return response.json();
}

export async function inviteMemberAPI(request: APIRequestContext, projectId: string, userId: string, role: string) {
  const response = await request.put(`/api/project/${projectId}/add-member`, {
    data: { userId, role }
  });
  if (!response.ok()) {
    throw new Error(`Failed to invite member: ${await response.text()}`);
  }
  return response.json();
}

export async function inviteWorkspaceMemberAPI(request: APIRequestContext, workspaceId: string, userId: string, role: string) {
  const response = await request.put(`/api/workspace/${workspaceId}/add-member`, {
    data: { userId, role }
  });
  if (!response.ok()) {
    throw new Error(`Failed to invite workspace member: ${await response.text()}`);
  }
  return response.json();
}
