import { proxy } from './proxy';
export { config } from './proxy';

/**
 * Standard Next.js Edge Middleware entry point.
 * Bridges to the centralized auth & route-protection logic in src/proxy.ts.
 */
export const middleware = proxy;
