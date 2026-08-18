/**
 * Type declarations for built-in JavaScript APIs with enhanced type safety.
 */

type Falsy = false | 0 | '' | null | undefined | 0n;

interface JSON {
  /**
   * Converts a JavaScript Object Notation (JSON) string into an object.
   * Returns `unknown` to enforce explicit type narrowing or validation.
   */
  parse(text: string, reviver?: (this: any, key: string, value: any) => any): unknown;
}

interface Body {
  /**
   * Parses the response body as JSON, returning `Promise<unknown>`.
   */
  json(): Promise<unknown>;
}

interface Array<T> {
  /**
   * Determines whether an array includes a certain element, accepting `unknown`.
   */
  includes(searchElement: unknown, fromIndex?: number): searchElement is T;

  /**
   * Filters out falsy values with accurate type narrowing.
   */
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: any,
  ): Array<Exclude<S, Falsy>>;
}

interface ReadonlyArray<T> {
  /**
   * Determines whether a readonly array includes a certain element, accepting `unknown`.
   */
  includes(searchElement: unknown, fromIndex?: number): searchElement is T;

  /**
   * Filters out falsy values with accurate type narrowing for readonly arrays.
   */
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: any,
  ): ReadonlyArray<Exclude<S, Falsy>>;
}

