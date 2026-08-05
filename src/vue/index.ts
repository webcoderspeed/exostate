import { shallowRef, readonly, onScopeDispose, type Ref, type DeepReadonly as VueDeepReadonly } from 'vue'
import type { Store } from '../store.js'
import type { Selector, DeepReadonly } from '../types.js'

/**
 * Binds a whole store to a Vue ref.
 *
 * Uses `shallowRef` because Exostate state is already immutable — deep
 * reactivity would walk and proxy the entire tree on every commit for no gain.
 *
 * Cleanup is registered with `onScopeDispose`, so this works inside components
 * *and* inside any standalone effect scope, unlike `onUnmounted`.
 */
export function useExostore<T>(store: Store<T>): VueDeepReadonly<Ref<DeepReadonly<T>>> {
  const state = shallowRef(store.snapshot()) as Ref<DeepReadonly<T>>
  const unsubscribe = store.subscribe<DeepReadonly<T>>(
    (s) => s,
    (val) => { state.value = val }
  )
  onScopeDispose(() => unsubscribe())
  return readonly(state)
}

/** Binds a selected slice of a store to a Vue ref. */
export function useExoselector<T, R>(
  store: Store<T>,
  selector: Selector<T, R>
): VueDeepReadonly<Ref<R>> {
  const state = shallowRef(selector(store.snapshot())) as Ref<R>
  const unsubscribe = store.subscribe<R>(
    selector,
    (val) => { state.value = val }
  )
  onScopeDispose(() => unsubscribe())
  return readonly(state)
}
