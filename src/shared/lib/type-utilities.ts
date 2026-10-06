/**
 * type-utilities.ts
 *
 * Total TypeScript Utility Kit (Matt Pocock Design Patterns)
 * Provides compile-time helpers, exhaustive type checks, brand factories,
 * and IDE-friendly hover type simplifiers across the application.
 */

declare const brandSymbol: unique symbol;

/**
 * Nominal / Branded Type helper.
 * Enforces compile-time distinction between identical primitive types (e.g. PageId vs ProjectId).
 */
export type Brand<T, B extends string> = T & { readonly [brandSymbol]: B };

/**
 * Creates a branded value at runtime with compile-time type verification.
 */
export function brand<B extends string, T extends string | number>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

/**
 * Matt Pocock's Prettify helper.
 * Flattens intersection and complex mapped types into an expanded, readable object
 * in TypeScript tooltips and autocomplete hints.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Exhaustive Check Helper.
 * Guarantees at compile-time that all cases in a union or switch have been handled.
 * If a new variant is added to a union, TypeScript raises a compile error here.
 */
export function assertUnreachable(x: never, customMessage?: string): never {
  throw new Error(customMessage || `Unhandled discriminated union member: ${JSON.stringify(x)}`);
}

/**
 * Type-narrowing filter predicate for arrays.
 * Removes null and undefined, narrowing array type from (T | null | undefined)[] to T[].
 */
export function isDefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined;
}

/**
 * Guaranteed non-empty array with at least one element.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Extracts value types of an object or record.
 */
export type ValueOf<T> = T[keyof T];

/**
 * Recursive DeepPartial helper.
 */
export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? DeepPartial<U>[]
  : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/**
 * Matt Pocock's Shoehorn pattern (@total-typescript/shoehorn).
 * Passes partial mock data in tests or fixtures while preserving strict target type checking.
 */
export function fromPartial<T>(partial: DeepPartial<T> | Partial<T>): T {
  return partial as T;
}

/**
 * Passes intentionally arbitrary/mock data in tests while preserving target type inference.
 */
export function fromAny<T = any>(value: any): T {
  return value as T;
}

/**
 * Forces exact full object matching.
 */
export function fromExact<T>(value: T): T {
  return value;
}

