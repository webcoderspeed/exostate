import { createSignal, onCleanup, type Accessor } from 'solid-js'
import type { Store } from '../store.js'
import type { Selector, DeepReadonly } from '../types.js'

/**
 * Binds a whole store to a Solid signal.
 *
 * The setter is called with a thunk (`() => val`) because Solid treats a bare
 * function argument as an updater — without it, a state object that happens to
 * be callable would be invoked instead of stored.
 */
export function useExostore<T>(store: Store<T>): Accessor<DeepReadonly<T>> {
  const [state, setState] = createSignal<DeepReadonly<T>>(store.snapshot())
  const unsubscribe = store.subscribe<DeepReadonly<T>>(
    (s) => s,
    (val) => setState(() => val)
  )
  onCleanup(() => unsubscribe())
  return state
}

/** Binds a selected slice of a store to a Solid signal. */
export function useExoselector<T, R>(store: Store<T>, selector: Selector<T, R>): Accessor<R> {
  const [state, setState] = createSignal<R>(selector(store.snapshot()))
  const unsubscribe = store.subscribe<R>(
    selector,
    (val) => setState(() => val)
  )
  onCleanup(() => unsubscribe())
  return state
}
