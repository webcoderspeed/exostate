import { DeepReadonly, Reducer, Compute, Effect, ExostatePlugin } from "./types.js"
import { Store, StoreImpl } from "./store.js"

export type Operation = "set" | "update" | "compute" | "batch" | "effect" | "patch"

export interface MiddlewareContext<T> {
  store: Store<T>
  version: number
  snapshot: DeepReadonly<T>
  payload?: unknown
}

export interface MiddlewareAfterContext<T> extends MiddlewareContext<T> {
  durationMs: number
}

export interface Middleware<T> {
  before?(op: Operation, ctx: MiddlewareContext<T>): void
  after?(op: Operation, ctx: MiddlewareAfterContext<T>): void
}

/**
 * Wraps a store so every operation is announced to the given middlewares.
 *
 * The returned object also proxies `listeners` and `current` from the
 * underlying `StoreImpl`, so code reaching for those internals sees the same
 * values it would on an unwrapped store.
 */
export function withMiddleware<T>(store: Store<T>, middlewares: ReadonlyArray<Middleware<T>>): Store<T> {
  const callBefore = (op: Operation, ctx: MiddlewareContext<T>) => {
    for (const m of middlewares) m.before?.(op, ctx)
  }
  const callAfter = (op: Operation, ctx: MiddlewareAfterContext<T>) => {
    for (const m of middlewares) m.after?.(op, ctx)
  }
  const wrapped = {
    get version() {
      return store.version
    },
    get destroyed() {
      return store.destroyed
    },
    // `listeners` and `current` are not part of the `Store<T>` contract, but
    // StoreImpl exposes them and callers do reach for them. Proxy both so a
    // wrapped store never reports `undefined` where a raw store would not.
    get listeners() {
      return (store as StoreImpl<T>).listeners
    },
    get current() {
      return (store as StoreImpl<T>).current
    },
    read() {
      return store.read()
    },
    snapshot() {
      return store.snapshot()
    },
    set(next: T) {
      const start = Date.now()
      callBefore("set", { store, version: store.version, snapshot: store.snapshot(), payload: next })
      const out = store.set(next)
      const end = Date.now()
      callAfter("set", { store, version: store.version, snapshot: store.snapshot(), payload: next, durationMs: end - start })
      return out
    },
    update<P>(reducer: Reducer<T, P>, payload: P) {
      const start = Date.now()
      callBefore("update", { store, version: store.version, snapshot: store.snapshot(), payload })
      const out = store.update(reducer, payload)
      const end = Date.now()
      callAfter("update", { store, version: store.version, snapshot: store.snapshot(), payload, durationMs: end - start })
      return out
    },
    compute(fn: Compute<T>) {
      const start = Date.now()
      callBefore("compute", { store, version: store.version, snapshot: store.snapshot() })
      const out = store.compute(fn)
      const end = Date.now()
      callAfter("compute", { store, version: store.version, snapshot: store.snapshot(), durationMs: end - start })
      return out
    },
    batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void) {
      const start = Date.now()
      callBefore("batch", { store, version: store.version, snapshot: store.snapshot() })
      const out = store.batch(apply)
      const end = Date.now()
      callAfter("batch", { store, version: store.version, snapshot: store.snapshot(), durationMs: end - start })
      return out
    },
    effect<P>(fn: Effect<T, P>, payload: P) {
      const start = Date.now()
      callBefore("effect", { store, version: store.version, snapshot: store.snapshot(), payload })
      const res = store.effect(fn, payload)
      if (res instanceof Promise) {
        return res.then(() => {
          const end = Date.now()
          callAfter("effect", { store, version: store.version, snapshot: store.snapshot(), payload, durationMs: end - start })
        })
      }
      const end = Date.now()
      callAfter("effect", { store, version: store.version, snapshot: store.snapshot(), payload, durationMs: end - start })
      return res
    },
    patch(partial: Partial<T> | ((prev: DeepReadonly<T>) => Partial<T>)) {
      const start = Date.now()
      callBefore("patch", { store, version: store.version, snapshot: store.snapshot(), payload: partial })
      const out = store.patch(partial)
      const end = Date.now()
      callAfter("patch", { store, version: store.version, snapshot: store.snapshot(), payload: partial, durationMs: end - start })
      return out
    },
    use(plugin: ExostatePlugin<T>) {
      return store.use(plugin)
    },
    plugins() {
      return store.plugins()
    },
    flush() {
      store.flush()
    },
    destroy() {
      store.destroy()
    },
    subscribe: store.subscribe.bind(store),
  }

  return wrapped as Store<T>
}

