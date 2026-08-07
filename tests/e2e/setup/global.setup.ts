import { test as setup, request, expect } from '@playwright/test';
import { registerAPI, loginAPI, createWorkspaceAPI, createProjectAPI, inviteMemberAPI, inviteWorkspaceMemberAPI } from '../utils/api';
import fs from 'fs';
import path from 'path';

setup('authenticate & seed data', async ({ baseURL }) => {
  const timestamp = Date.now();
  const password = 'password123';
  
  const roles = ['owner', 'admin', 'member', 'viewer'];
  const users = roles.reduce((acc, role) => {
    acc[role] = {
      name: `QA ${role}`,
      email: `qa_${role}_${timestamp}@example.com`,
      authFile: `tests/.auth/${role}.json`
    };
    return acc;
  }, {} as Record<string, any>);

  const apiContext = await request.newContext({ baseURL: 'http://localhost:3000' });

  // 1. Register all users
  for (const role of roles) {
    try {
      const data = await registerAPI(apiContext, users[role].name, users[role].email, password);
      users[role].userId = data.user._id;
    } catch (e) {
      // User might already exist, login to get ID
      const loginResp = await loginAPI(apiContext, users[role].email, password);
      const data = await loginResp.json();
      users[role].userId = data.user._id;
    }
  }

  // 2. Login as Owner
  await loginAPI(apiContext, users['owner'].email, password);
  await apiContext.storageState({ path: users['owner'].authFile });

  // 3. Create Workspace and Project as Owner
  const uniqueSuffix = Date.now().toString();
  const workspaceName = `Test Workspace ${uniqueSuffix}`;
  const projectName = `Test Project ${uniqueSuffix}`;
  const workspaceData = await createWorkspaceAPI(apiContext, workspaceName);
  const workspaceId = workspaceData.workspace._id;
  
  const projectData = await createProjectAPI(apiContext, workspaceId, projectName);
  const projectId = projectData.project._id;

  // Save projectId to a file so tests can use it
  const testData = { workspaceId, projectId };
  fs.writeFileSync('tests/.auth/testData.json', JSON.stringify(testData));

  // 4. Invite other roles to Workspace first, then Project
  await inviteWorkspaceMemberAPI(apiContext, workspaceId, users['admin'].userId, 'admin');
  await inviteWorkspaceMemberAPI(apiContext, workspaceId, users['member'].userId, 'member');
  await inviteWorkspaceMemberAPI(apiContext, workspaceId, users['viewer'].userId, 'viewer');

  await inviteMemberAPI(apiContext, projectId, users['admin'].userId, 'admin');
  await inviteMemberAPI(apiContext, projectId, users['member'].userId, 'member');
  await inviteMemberAPI(apiContext, projectId, users['viewer'].userId, 'viewer');

  // 5. Login as other roles and save state
  for (const role of ['admin', 'member', 'viewer']) {
    const roleContext = await request.newContext({ baseURL: 'http://localhost:3000' });
    await loginAPI(roleContext, users[role].email, password);
    await roleContext.storageState({ path: users[role].authFile });
    await roleContext.dispose();
  }

  await apiContext.dispose();
});
