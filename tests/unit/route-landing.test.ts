import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Route Navigation & Middleware Policy', () => {
  it('allows unauthenticated users to access root landing page (/) without redirect', () => {
    const request = new NextRequest('http://localhost:2915/');
    const response = middleware(request);

    // Should NOT redirect to /projects
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('allows authenticated users to access root landing page (/) without redirecting to /projects', () => {
    const request = new NextRequest('http://localhost:2915/', {
      headers: {
        cookie: 'accessToken=mock_jwt_token_123',
      },
    });
    const response = middleware(request);

    // Authenticated user should NOT be kicked to /projects when visiting root route
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('redirects authenticated users to /projects when visiting /login or /register', () => {
    const loginRequest = new NextRequest('http://localhost:2915/login', {
      headers: {
        cookie: 'accessToken=mock_jwt_token_123',
      },
    });
    const loginResponse = middleware(loginRequest);
    expect(loginResponse.headers.get('location')).toBe('http://localhost:2915/projects');

    const registerRequest = new NextRequest('http://localhost:2915/register', {
      headers: {
        cookie: 'token=legacy_mock_token_456',
      },
    });
    const registerResponse = middleware(registerRequest);
    expect(registerResponse.headers.get('location')).toBe('http://localhost:2915/projects');
  });

  it('redirects unauthenticated users to / when accessing protected routes (/projects)', () => {
    const request = new NextRequest('http://localhost:2915/projects');
    const response = middleware(request);

    expect(response.headers.get('location')).toBe('http://localhost:2915/');
  });

  it('allows authenticated users to access protected routes (/projects)', () => {
    const request = new NextRequest('http://localhost:2915/projects', {
      headers: {
        cookie: 'accessToken=mock_jwt_token_123',
      },
    });
    const response = middleware(request);

    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });
});
