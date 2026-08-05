import { useRef, useCallback, useSyncExternalStore } from "react"
import type { Store } from "../store.js"
import type { Selector, Equality, DeepReadonly } from "../types.js"
import { combineStores } from "../combine.js"

export function useStore<T>(store: Store<T>): DeepReadonly<T> {
  const subscribe = useCallback(
    (onChange: () => void) => store.subscribe<DeepReadonly<T>>((s) => s, () => onChange()),
    [store]
  )
  const getSnapshot = useCallback(() => store.snapshot(), [store])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

interface SelectorCache<R> {
  version: number
  value: R
  filled: boolean
}

/**
 * Subscribes to a slice of a store.
 *
 * The selector result is memoized against the store's version, so a selector
 * that builds a fresh object each call (`s => ({ a: s.a })`) returns a stable
 * reference between renders instead of tripping React's
 * "getSnapshot should be cached" infinite loop. Selectors must therefore be
 * pure functions of state.
 *
 * Pass `shallow` from `exostate` as `eq` when you want the subscription itself
 * to compare by value rather than by reference.
 */
export function useSelector<T, R>(
  store: Store<T>,
  selector: Selector<T, R>,
  eq?: Equality<R>
): R {
  // Latest-ref so an inline selector/comparator does not change the identity of
  // `subscribe`, which would make React tear down and re-add the listener on
  // every single render.
  const selectorRef = useRef(selector)
  const eqRef = useRef(eq)
  selectorRef.current = selector
  eqRef.current = eq

  const cacheRef = useRef<SelectorCache<R>>({ version: -1, value: undefined as R, filled: false })

  const getSnapshot = useCallback(() => {
    const cache = cacheRef.current
    const version = store.version
    if (cache.filled && cache.version === version) return cache.value

    const next = selectorRef.current(store.snapshot())
    if (cache.filled) {
      const equal = eqRef.current ? eqRef.current(cache.value, next) : Object.is(cache.value, next)
      if (equal) {
        // Value is unchanged — keep the previous reference so React sees a
        // stable snapshot even though the selector allocated a new object.
        cache.version = version
        return cache.value
      }
    }
    cache.filled = true
    cache.version = version
    cache.value = next
    return next
  }, [store])

  const subscribe = useCallback(
    (onChange: () => void) =>
      store.subscribe<R>(
        (s) => selectorRef.current(s),
        () => onChange(),
        { eq: (a, b) => (eqRef.current ? eqRef.current(a, b) : Object.is(a, b)) }
      ),
    [store]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useStores<TShape extends Record<string, unknown>>(
  stores: { [K in keyof TShape]: Store<TShape[K]> }
): { [K in keyof TShape]: DeepReadonly<TShape[K]> } {
  const ref = useRef<ReturnType<typeof combineStores<TShape>> | null>(null)
  if (!ref.current) {
    ref.current = combineStores(stores)
  }
  const c = ref.current
  const subscribe = useCallback(
    (onChange: () => void) => c.subscribe(() => onChange()),
    [c]
  )
  const getSnapshot = useCallback(
    () => c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> },
    [c]
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useCombined<TShape extends Record<string, unknown>>(
  stores: { [K in keyof TShape]: Store<TShape[K]> }
): { [K in keyof TShape]: DeepReadonly<TShape[K]> } {
  return useStores(stores)
}

export function useStoresSelector<TShape extends Record<string, unknown>, R>(
  stores: { [K in keyof TShape]: Store<TShape[K]> },
  selector: (s: { [K in keyof TShape]: DeepReadonly<TShape[K]> }) => R,
  eq?: Equality<R>
): R {
  const ref = useRef<ReturnType<typeof combineStores<TShape>> | null>(null)
  if (!ref.current) {
    ref.current = combineStores(stores)
  }
  const c = ref.current

  const selectorRef = useRef(selector)
  const eqRef = useRef(eq)
  selectorRef.current = selector
  eqRef.current = eq

  const cacheRef = useRef<{ source: unknown; value: R; filled: boolean }>({
    source: undefined,
    value: undefined as R,
    filled: false,
  })

  const getSnapshot = useCallback(() => {
    const cache = cacheRef.current
    const source = c.read()
    // The combined object identity changes only when a child store changes,
    // so it works the same way a version counter does for a single store.
    if (cache.filled && Object.is(cache.source, source)) return cache.value

    const next = selectorRef.current(source as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
    if (cache.filled) {
      const equal = eqRef.current ? eqRef.current(cache.value, next) : Object.is(cache.value, next)
      if (equal) {
        cache.source = source
        return cache.value
      }
    }
    cache.filled = true
    cache.source = source
    cache.value = next
    return next
  }, [c])

  const subscribe = useCallback(
    (onChange: () => void) => {
      let prev = selectorRef.current(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
      return c.subscribe(() => {
        const next = selectorRef.current(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
        const equal = eqRef.current ? eqRef.current(prev, next) : Object.is(prev, next)
        if (!equal) {
          prev = next
          onChange()
        }
      })
    },
    [c]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
