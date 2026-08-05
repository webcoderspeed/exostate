import { Store, createStore } from "./store.js"

/**
 * Creates a store factory that produces isolated store instances.
 * Useful for scoped UI components (widgets, modals, multi-tenant).
 *
 * @example
 * ```ts
 * const createWidgetStore = storeFactory((id: string) => ({
 *   id,
 *   items: [] as string[],
 *   loading: false,
 * }));
 *
 * const widget1 = createWidgetStore('w1');
 * const widget2 = createWidgetStore('w2');
 * // Each gets its own isolated store
 * ```
 */
export function storeFactory<T, A extends unknown[]>(
  initializer: (...args: A) => T
): (...args: A) => Store<T> {
  return (...args: A) => {
    const initial = initializer(...args)
    return createStore<T>(initial)
  }
}

/**
 * Creates a cached store factory that returns the same store instance
 * for the same key. Useful for entity-scoped stores.
 *
 * @example
 * ```ts
 * const getUserStore = cachedStoreFactory((userId: string) => ({
 *   id: userId,
 *   name: '',
 *   loading: false,
 * }));
 *
 * const store1 = getUserStore('user-1');
 * const store2 = getUserStore('user-1');
 * console.log(store1 === store2); // true — same instance
 * ```
 */
export function cachedStoreFactory<T>(
  initializer: (key: string) => T
): {
  get(key: string): Store<T>
  has(key: string): boolean
  delete(key: string): boolean
  clear(): void
  keys(): IterableIterator<string>
  size: number
} {
  const cache = new Map<string, Store<T>>()

  return {
    get(key: string): Store<T> {
      let store = cache.get(key)
      if (!store) {
        store = createStore<T>(initializer(key))
        cache.set(key, store)
      }
      return store
    },
    has(key: string): boolean {
      return cache.has(key)
    },
    delete(key: string): boolean {
      return cache.delete(key)
    },
    clear(): void {
      cache.clear()
    },
    keys(): IterableIterator<string> {
      return cache.keys()
    },
    get size(): number {
      return cache.size
    }
  }
}
