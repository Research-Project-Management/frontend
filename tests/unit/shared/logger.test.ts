import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, type LogEntry } from '@/shared/lib/logger';

describe('StructuredLogger Deep Module', () => {
  let capturedEntries: LogEntry[] = [];

  beforeEach(() => {
    capturedEntries = [];
    logger.setSink((entry) => {
      capturedEntries.push(entry);
    });
  });

  it('captures structured info log entries with timestamp and context', () => {
    logger.info('Application initialized', { version: '1.0.0' });

    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].level).toBe('info');
    expect(capturedEntries[0].message).toBe('Application initialized');
    expect(capturedEntries[0].context).toEqual({ version: '1.0.0' });
    expect(capturedEntries[0].timestamp).toBeDefined();
  });

  it('captures error logs with error objects and stack', () => {
    const error = new Error('Test database connection failure');
    logger.error('Failed to connect to database', error, { retryCount: 3 });

    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].level).toBe('error');
    expect(capturedEntries[0].message).toBe('Failed to connect to database');
    expect(capturedEntries[0].error).toBe(error);
    expect(capturedEntries[0].context).toEqual({ retryCount: 3 });
  });

  it('captures warn logs properly', () => {
    logger.warn('Token expires in 60 seconds', { remainingSec: 60 });

    expect(capturedEntries).toHaveLength(1);
    expect(capturedEntries[0].level).toBe('warn');
    expect(capturedEntries[0].message).toBe('Token expires in 60 seconds');
  });

  it('allows resetting back to default console sink', () => {
    logger.resetSink();
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('Reset sink test');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
