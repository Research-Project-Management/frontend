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
  private readonly extraSinks = new Set<LogSink>();
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Replace the primary active log sink (useful for unit tests, Sentry, Datadog).
   */
  public setSink(sink: LogSink): void {
    this.sink = sink;
  }

  /**
   * Subscribe an additional telemetry sink (e.g. remote RUM / OpenTelemetry beacon).
   * Returns an unsubscribe function.
   */
  public addSink(sink: LogSink): () => void {
    this.extraSinks.add(sink);
    return () => {
      this.extraSinks.delete(sink);
    };
  }

  /**
   * Reset primary sink to default console sink and clear extra sinks.
   */
  public resetSink(): void {
    this.sink = defaultConsoleSink;
    this.extraSinks.clear();
  }

  private emit(entry: LogEntry): void {
    this.sink(entry);
    for (const extra of this.extraSinks) {
      try {
        extra(entry);
      } catch {
        // Isolate telemetry sink errors
      }
    }
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
    this.emit(this.createEntry('debug', message, undefined, context));
  }

  /**
   * Info level logging.
   */
  public info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    this.emit(this.createEntry('info', message, undefined, context));
  }

  /**
   * Warning level logging.
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    this.emit(this.createEntry('warn', message, undefined, context));
  }

  /**
   * Error level logging with error object & context capture.
   */
  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    this.emit(this.createEntry('error', message, error, context));
  }
}

export const logger = new StructuredLogger();
