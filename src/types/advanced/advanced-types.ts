/**
 * Advanced Type Utilities for Exostate v2.0
 * Enhanced type system capabilities for complex state management
 */

// ============================================================================
// PATH-BASED TYPE ACCESS
// ============================================================================

/**
 * Extracts the type at a given path within a nested object structure
 * Supports dot notation for deep property access
 * 
 * @example
 * type User = { profile: { name: string; email: string } };
 * type Email = Path<User, 'profile.email'>; // string
 */
export type Path<T, P extends string> = 
  P extends keyof T ? T[P] :
  P extends `${infer K}.${infer R}` ?
    K extends keyof T ? Path<T[K], R> : never :
  never;

/**
 * Creates a type-safe path string for a given object structure
 * Provides autocomplete for valid property paths
 */
export type PathString<T> = 
  T extends object ?
    { [K in keyof T]: 
      K extends string ?
        T[K] extends object ? `${K}.${PathString<T[K]>}` | K : K :
      never
    }[keyof T] :
  never;

/**
 * Utility to validate that a path string is valid for a given type
 */
export type ValidPath<T, P extends string> = 
  Path<T, P> extends never ? never : P;

// ============================================================================
// ENHANCED UTILITY TYPES
// ============================================================================

/**
 * Makes all properties in T deeply partial (recursive)
 */
export type DeepPartial<T> = 
  T extends object ? 
    { [P in keyof T]?: DeepPartial<T[P]> } : 
    T;

/**
 * Makes all properties in T deeply required (recursive)
 */
export type DeepRequired<T> = 
  T extends object ? 
    { [P in keyof T]-?: DeepRequired<T[P]> } : 
    T;

/**
 * Makes all properties in T deeply readonly (recursive)
 * Enhanced version with better handling of functions and primitives
 */
export type DeepReadonly<T> = 
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

/**
 * Makes all properties in T deeply mutable (recursive)
 */
export type DeepMutable<T> = 
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } :
  T;

// ============================================================================
// CONDITIONAL TYPE UTILITIES
// ============================================================================

/**
 * Extracts all property names from T that have type U
 */
export type PropertiesOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T];

/**
 * Filters object properties to only those of type U
 */
export type FilterProperties<T, U> = Pick<T, PropertiesOfType<T, U>>;

/**
 * Extracts all optional properties from T
 */
export type OptionalProperties<T> = {
  [K in keyof T]: object extends Pick<T, K> ? K : never
}[keyof T];

/**
 * Extracts all required properties from T
 */
export type RequiredProperties<T> = Exclude<keyof T, OptionalProperties<T>>;

/**
 * Creates a type with only optional properties from T
 */
export type OnlyOptional<T> = Pick<T, OptionalProperties<T>>;

/**
 * Creates a type with only required properties from T
 */
export type OnlyRequired<T> = Pick<T, RequiredProperties<T>>;

// ============================================================================
// TYPE GUARDS AND VALIDATION
// ============================================================================

/**
 * Type guard to check if a value is a specific literal type
 */
export type LiteralType<T> = 
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends bigint ? bigint :
  T extends symbol ? symbol :
  never;

/**
 * Utility to extract the value type from an array
 */
export type ArrayValue<T> = 
  T extends Array<infer U> ? U :
  T extends ReadonlyArray<infer U> ? U :
  never;

/**
 * Utility to check if a type is a tuple
 */
export type IsTuple<T> = 
  T extends unknown[] ? 
    number extends T['length'] ? false : true :
    false;

// ============================================================================
// STATE-SPECIFIC UTILITIES
// ============================================================================

/**
 * Extracts the state type from a store
 */
export type StoreState<S> = 
  S extends { getState: () => infer T } ? T : never;

/**
 * Creates a type for state patches
 */
export type StatePatch<T> = 
  | Partial<T>
  | ((prev: DeepReadonly<T>) => Partial<T>);

/**
 * Type for state update functions
 */
export type StateUpdater<T> = 
  | T
  | Partial<T>
  | ((prev: DeepReadonly<T>) => T)
  | ((prev: DeepReadonly<T>) => Partial<T>);

// ============================================================================
// SERIALIZATION UTILITIES
// ============================================================================

/**
 * Type that excludes functions and symbols for serialization
 */
export type Serializable<T> = 
  T extends string | number | boolean | null | undefined ? T :
  T extends Array<infer U> ? Array<Serializable<U>> :
  T extends object ? { [K in keyof T]: Serializable<T[K]> } :
  never;

/**
 * Type that includes only serializable properties
 */
export type OnlySerializable<T> = {
  [K in keyof T as T[K] extends ((...args: unknown[]) => unknown) | symbol ? never : K]: Serializable<T[K]>
};

// ============================================================================
// UTILITY FUNCTIONS FOR TYPE MANIPULATION
// ============================================================================

/**
 * Branded type for creating nominal typing in TypeScript
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Opaque type alias for better type safety
 */
export type Opaque<T, K> = T & { __opaque: K };

/**
 * Utility to assert that a type is never (exhaustive type checking)
 */
export function assertNever(): never {
  throw new Error('Unexpected value: This should never happen');
}

/**
 * Type-safe identity function
 */
export function identity<T>(x: T): T {
  return x;
}

// ============================================================================
// TYPE PREDICATES
// ============================================================================

/**
 * Type predicate for checking if a value is an object (not null)
 */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Type predicate for checking if a value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && value.constructor === Object;
}

/**
 * Type predicate for checking if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type predicate for checking if a value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

// ============================================================================
// ADVANCED TYPE OPERATIONS
// ============================================================================

/**
 * Merges two types with property-level conflict resolution
 */
export type Merge<A, B> = 
  Omit<A, keyof B> & B;

/**
 * Deep merge two types
 */
export type DeepMerge<A, B> = 
  A extends object ?
  B extends object ?
    { [K in keyof A | keyof B]: 
      K extends keyof A ?
        K extends keyof B ?
          DeepMerge<A[K], B[K]> :
          A[K] :
        K extends keyof B ? B[K] : never
    } :
    A :
  B;

/**
 * Recursively makes all properties nullable
 */
export type DeepNullable<T> = 
  T extends object ? 
    { [K in keyof T]: DeepNullable<T[K]> | null } : 
    T | null;

/**
 * Recursively makes all properties non-nullable
 */
export type DeepNonNullable<T> = 
  T extends object ? 
    { [K in keyof T]: DeepNonNullable<NonNullable<T[K]>> } : 
    NonNullable<T>;