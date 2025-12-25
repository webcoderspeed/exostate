import { useRef, useSyncExternalStore } from "react"
import type { Store } from "../store"
import type { Selector, Equality, DeepReadonly } from "../types"
import { combineStores } from "../combine"

export function useStore<T>(store: Store<T>): DeepReadonly<T> {
  return useSyncExternalStore(
    (onChange: () => void) => store.subscribe<DeepReadonly<T>>((s) => s, () => onChange()),
    () => store.snapshot(),
    () => store.snapshot()
  )
}

export function useSelector<T, R>(
  store: Store<T>,
  selector: Selector<T, R>,
  eq?: Equality<R>
): R {
  return useSyncExternalStore(
    (onChange: () => void) => store.subscribe(selector, () => onChange(), { eq }),
    () => selector(store.snapshot()),
    () => selector(store.snapshot())
  )
}

export function useStores<TShape extends Record<string, unknown>>(
  stores: { [K in keyof TShape]: Store<TShape[K]> }
): { [K in keyof TShape]: DeepReadonly<TShape[K]> } {
  const ref = useRef<ReturnType<typeof combineStores<TShape>> | null>(null)
  if (!ref.current) {
    ref.current = combineStores(stores)
  }
  const c = ref.current
  return useSyncExternalStore(
    (onChange: () => void) => c.subscribe(() => onChange()),
    () => c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> },
    () => c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> }
  )
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
  return useSyncExternalStore(
    (onChange: () => void) => {
      let prev = selector(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
      return c.subscribe(() => {
        const next = selector(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
        const equal = eq ? eq(prev, next) : Object.is(prev, next)
        if (!equal) {
          prev = next
          onChange()
        }
      })
    },
    () => selector(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> }),
    () => selector(c.read() as { [K in keyof TShape]: DeepReadonly<TShape[K]> })
  )
}
