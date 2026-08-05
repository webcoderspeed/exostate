import type { Store } from '../store.js'
import type { Selector, DeepReadonly, Unsubscribe } from '../types.js'

/** The readable half of the Svelte store contract. */
export interface SvelteReadable<V> {
  subscribe(run: (value: V) => void): Unsubscribe
}

/**
 * Adapts a store to Svelte's readable-store contract, so it works with the
 * `$store` auto-subscription syntax.
 *
 * Svelte requires `subscribe` to invoke the callback synchronously with the
 * current value before returning.
 *
 * @example
 * ```svelte
 * <script>
 *   import { exostore } from 'exostate/svelte'
 *   const count = exostore(counterStore)
 * </script>
 * <p>{$count.value}</p>
 * ```
 */
export function exostore<T>(store: Store<T>): SvelteReadable<DeepReadonly<T>> {
  return {
    subscribe(run: (value: DeepReadonly<T>) => void): Unsubscribe {
      run(store.snapshot())
      return store.subscribe<DeepReadonly<T>>((s) => s, run)
    }
  }
}

/** Adapts a selected slice of a store to Svelte's readable-store contract. */
export function exoselector<T, R>(store: Store<T>, selector: Selector<T, R>): SvelteReadable<R> {
  return {
    subscribe(run: (value: R) => void): Unsubscribe {
      run(selector(store.snapshot()))
      return store.subscribe<R>(selector, run)
    }
  }
}
