import { test as setup, request } from '@playwright/test';
import fs from 'fs';
import crypto from 'crypto';

function signTestJwt(payload: Record<string, any>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const h64 = encode(header);
  const nowSec = Math.floor(Date.now() / 1000);
  const p64 = encode({
    ...payload,
    iat: nowSec,
    exp: nowSec + 86400 * 7,
  });
  const data = `${h64}.${p64}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

setup('authenticate & seed real PostgreSQL data', async () => {
  fs.mkdirSync('tests/e2e/.auth', { recursive: true });

  const jwtSecret = process.env.JWT_SECRET || 'flux2026';
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:Thanh26102006@localhost:5432/flux-db?schema=public';

  const workspaceId = 'ws-test-e2e-fullstack';
  const ownerUserId = 'usr-e2e-owner';

  // 1. Seed real test fixtures into PostgreSQL
  try {
    const { Pool } = require('d:/project/flux/backend/node_modules/pg');
    const { PrismaPg } = require('d:/project/flux/backend/node_modules/@prisma/adapter-pg');
    const { PrismaClient } = require('d:/project/flux/backend/node_modules/@prisma/client');

    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    await prisma.user.upsert({
      where: { id: ownerUserId },
      update: { email: 'owner@example.com', name: 'QA Owner', status: 'active' },
      create: {
        id: ownerUserId,
        email: 'owner@example.com',
        name: 'QA Owner',
        status: 'active',
        password: '$2b$10$abcdefghijklmnopqrstuv',
      },
    });

    await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: { name: 'GenAI Systems Lab', url: workspaceId },
      create: {
        id: workspaceId,
        name: 'GenAI Systems Lab',
        url: workspaceId,
        createdById: ownerUserId,
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: ownerUserId,
        },
      },
      update: { role: 'owner' },
      create: {
        workspaceId,
        userId: ownerUserId,
        role: 'owner',
      },
    });

    await prisma.$disconnect();
  } catch (err) {
    console.warn(`[E2E SETUP] Database seeding notice: ${(err as any)?.message}`);
  }

  // 2. Generate cryptographically valid signed JWT
  const ownerToken = signTestJwt(
    {
      id: ownerUserId,
      sub: ownerUserId,
      email: 'owner@example.com',
      role: 'OWNER',
    },
    jwtSecret,
  );

  const createStorageState = (token: string, userId: string, role: string) => ({
    cookies: [
      {
        name: 'access_token',
        value: token,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'access_token',
        value: token,
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [
      {
        origin: 'http://127.0.0.1:2915',
        localStorage: [
          { name: 'accessToken', value: token },
          { name: 'token', value: token },
          { name: 'auth_token', value: token },
          {
            name: 'current_user',
            value: JSON.stringify({
              id: userId,
              name: `QA ${role.toUpperCase()}`,
              email: `${role}@example.com`,
              role: role.toUpperCase(),
            }),
          },
        ],
      },
      {
        origin: 'http://localhost:2915',
        localStorage: [
          { name: 'accessToken', value: token },
          { name: 'token', value: token },
          { name: 'auth_token', value: token },
          {
            name: 'current_user',
            value: JSON.stringify({
              id: userId,
              name: `QA ${role.toUpperCase()}`,
              email: `${role}@example.com`,
              role: role.toUpperCase(),
            }),
          },
        ],
      },
    ],
  });

  fs.writeFileSync(
    'tests/e2e/.auth/owner.json',
    JSON.stringify(createStorageState(ownerToken, ownerUserId, 'owner')),
  );

  const testData = {
    workspaceId,
    projectId: 'proj-test-e2e-fullstack',
    ownerUserId,
  };
  fs.writeFileSync('tests/e2e/.auth/testData.json', JSON.stringify(testData));
});
