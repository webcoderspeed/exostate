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

/**
 * How a store delivers change notifications.
 * - `sync` (default): listeners run synchronously inside the mutation call.
 * - `microtask`: notifications are coalesced and flushed once per microtask,
 *   so N synchronous mutations produce a single notification.
 */
export type NotifyMode = "sync" | "microtask"

/**
 * A plugin observes and can transform a store's lifecycle.
 * Plugins are attached with `store.use(plugin)`.
 */
export interface ExostatePlugin<T> {
  name: string
  /** Runs when the plugin is attached. Return a function to clean up on detach. */
  onInit?(store: PluginHost<T>): void | (() => void)
  /** Runs before the next state is committed. Return a value to replace it. */
  onBeforeUpdate?(prev: DeepReadonly<T>, next: T): T | void
  /** Runs after the state is committed, before listeners are notified. */
  onAfterUpdate?(prev: DeepReadonly<T>, next: T): void
  /** Runs after a listener is added, with the resulting listener count. */
  onSubscribe?(listenerCount: number): void
  /** Runs after a listener is removed, with the resulting listener count. */
  onUnsubscribe?(listenerCount: number): void
  /** Runs when the plugin is torn down (store destroyed or plugins destroyed). */
  onDestroy?(): void
}

/**
 * Minimal store surface a plugin receives in `onInit`.
 * Declared structurally to avoid a circular import between store and types.
 */
export interface PluginHost<T> {
  readonly version: number
  read(): T
  snapshot(): DeepReadonly<T>
  set(next: T): T
}

export interface StoreOptions<T> {
  /** Notification strategy. Default `sync`. */
  notify?: NotifyMode
  /** Plugins attached at construction time. */
  plugins?: ReadonlyArray<ExostatePlugin<T>>
  /**
   * Called after a listener is added, with the resulting listener count.
   * A count of 1 means the store just became "active" — the place to open
   * sockets, start timers, or begin polling.
   */
  onSubscribe?: (store: PluginHost<T>, listenerCount: number) => void
  /**
   * Called after a listener is removed, with the resulting listener count.
   * A count of 0 means the store just went idle — the place to release resources.
   */
  onUnsubscribe?: (store: PluginHost<T>, listenerCount: number) => void
  /**
   * Delay in ms before firing `onUnsubscribe` once the listener count hits 0.
   * Prevents teardown/setup churn when a component unmounts and immediately
   * remounts (route transitions, Suspense retries). Default `0`.
   */
  unmountDelay?: number
}
