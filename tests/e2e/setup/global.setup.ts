import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * global.setup.ts
 *
 * Prepares deterministic authentication state for Playwright tests.
 * Writes tests/e2e/.auth/owner.json with valid JWT claims so all tests
 * execute as an authenticated owner without redundant login flows.
 */

setup('configure authenticated owner storage state', async ({}) => {
  const authDir = path.resolve(process.cwd(), 'tests/e2e/.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const exp = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days expiration
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-academic-001',
      id: 'user-academic-001',
      email: 'alan@flux.academic',
      name: 'Dr. Alan Turing',
      exp,
    })
  ).toString('base64');
  const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.signature`;

  const userObj = {
    id: 'user-academic-001',
    name: 'Dr. Alan Turing',
    email: 'alan@flux.academic',
    role: 'owner',
  };

  const authState = {
    cookies: [
      {
        name: 'accessToken',
        value: mockJwt,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: exp,
      },
      {
        name: 'token',
        value: mockJwt,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: exp,
      },
      {
        name: 'flux_token',
        value: mockJwt,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
        expires: exp,
      },
    ],
    origins: [
      {
        origin: 'http://127.0.0.1:2915',
        localStorage: [
          {
            name: 'accessToken',
            value: mockJwt,
          },
          {
            name: 'token',
            value: mockJwt,
          },
          {
            name: 'flux_token',
            value: mockJwt,
          },
          {
            name: 'flux_cached_user',
            value: JSON.stringify(userObj),
          },
          {
            name: 'user',
            value: JSON.stringify(userObj),
          },
        ],
      },
    ],
  };

  const authFilePath = path.join(authDir, 'owner.json');
  fs.writeFileSync(authFilePath, JSON.stringify(authState, null, 2), 'utf-8');
});
