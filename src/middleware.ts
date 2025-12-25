import { DeepReadonly, Reducer, Compute, Effect } from "./types"
import { Store } from "./store"

export type Operation = "set" | "update" | "compute" | "batch" | "effect"

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

export function withMiddleware<T>(store: Store<T>, middlewares: ReadonlyArray<Middleware<T>>): Store<T> {
  const callBefore = (op: Operation, ctx: MiddlewareContext<T>) => {
    for (const m of middlewares) m.before?.(op, ctx)
  }
  const callAfter = (op: Operation, ctx: MiddlewareAfterContext<T>) => {
    for (const m of middlewares) m.after?.(op, ctx)
  }
  return {
    get version() {
      return store.version
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
    subscribe: store.subscribe.bind(store),
  }
}

