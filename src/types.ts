export type DeepReadonly<T> =
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

export type Reducer<T, P> = (prev: DeepReadonly<T>, payload: P) => T

export type Selector<T, R> = (state: DeepReadonly<T>) => R

export type Equality<T> = (a: T, b: T) => boolean

export type Subscriber<T> = (value: T) => void

export type Unsubscribe = () => void

export interface SubscribeOptions<T> {
  eq?: Equality<T>
  fireImmediately?: boolean
}

export type Compute<T> = (prev: DeepReadonly<T>) => T

export type Effect<T, P> = (snapshot: DeepReadonly<T>, payload: P) => void | Promise<void>

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
