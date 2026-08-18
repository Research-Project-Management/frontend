/**
 * Type-safe error handling utilities and Result<T, E> primitives.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard for successful Result.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard for error Result.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Extracts a human-readable message from any unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Safely executes an async Promise, returning a Result<T, E>.
 * Never throws an unhandled rejection.
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
  mapError?: (err: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return Ok(data);
  } catch (error) {
    const formatted = mapError
      ? mapError(error)
      : ((error instanceof Error ? error : new Error(getErrorMessage(error))) as unknown as E);
    return Err(formatted);
  }
}

/**
 * Safely executes a synchronous function, returning a Result<T, E>.
 * Never throws an uncaught exception.
 */
export function tryCatchSync<T, E = Error>(
  fn: () => T,
  mapError?: (err: unknown) => E,
): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    const formatted = mapError
      ? mapError(error)
      : ((error instanceof Error ? error : new Error(getErrorMessage(error))) as unknown as E);
    return Err(formatted);
  }
}

/**
 * Pattern matches over a Result type.
 */
export function matchResult<T, E, R>(
  result: Result<T, E>,
  matchers: {
    ok: (value: T) => R;
    err: (error: E) => R;
  },
): R {
  return result.ok ? matchers.ok(result.value) : matchers.err(result.error);
}

/**
 * Unwraps the value of an Ok result or returns a fallback value.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

