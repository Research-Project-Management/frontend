/**
 * error.util.ts
 *
 * Matt Pocock's "Error as Value" Pattern for Frontend.
 * Replaces unhandled exceptions with type-safe Result<T, E> objects.
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
 * Extracts a human-readable message from an unknown error.
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
 * Safely executes an async Promise, returning a Result<T, Error>.
 * Never throws an unhandled rejection.
 */
export async function tryCatch<T>(
  promise: Promise<T>,
): Promise<Result<T, Error>> {
  try {
    const data = await promise;
    return Ok(data);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(getErrorMessage(error)));
  }
}

/**
 * Safely executes a synchronous function, returning a Result<T, Error>.
 * Never throws an uncaught exception.
 */
export function tryCatchSync<T>(fn: () => T): Result<T, Error> {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(getErrorMessage(error)));
  }
}
