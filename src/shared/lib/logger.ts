/**
 * Structured telemetry and logging seam.
 * Provides environment-aware filtering, error serialization, and pluggable sinks.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

export type LogSink = (entry: LogEntry) => void;

const defaultConsoleSink: LogSink = (entry) => {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const contextStr = entry.context && Object.keys(entry.context).length > 0
    ? `\nContext: ${JSON.stringify(entry.context, null, 2)}`
    : '';

  switch (entry.level) {
    case 'debug':
      console.debug(`${prefix} ${entry.message}`, contextStr);
      break;
    case 'info':
      console.info(`${prefix} ${entry.message}`, contextStr);
      break;
    case 'warn':
      console.warn(`${prefix} ${entry.message}`, contextStr);
      break;
    case 'error':
      if (entry.error) {
        console.error(`${prefix} ${entry.message}`, entry.error, contextStr);
      } else {
        console.error(`${prefix} ${entry.message}`, contextStr);
      }
      break;
  }
};

class StructuredLogger {
  private sink: LogSink = defaultConsoleSink;
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Replace the active log sink (useful for unit tests, Sentry, Datadog).
   */
  public setSink(sink: LogSink): void {
    this.sink = sink;
  }

  /**
   * Reset sink to default console sink.
   */
  public resetSink(): void {
    this.sink = defaultConsoleSink;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isProduction && level === 'debug') {
      return false;
    }
    return true;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      error,
      context,
    };
  }

  /**
   * Debug level logging (suppressed in production).
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    this.sink(this.createEntry('debug', message, undefined, context));
  }

  /**
   * Info level logging.
   */
  public info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    this.sink(this.createEntry('info', message, undefined, context));
  }

  /**
   * Warning level logging.
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    this.sink(this.createEntry('warn', message, undefined, context));
  }

  /**
   * Error level logging with error object & context capture.
   */
  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    this.sink(this.createEntry('error', message, error, context));
  }
}

export const logger = new StructuredLogger();
