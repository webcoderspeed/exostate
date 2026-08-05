import { DeepReadonly, Reducer, Compute } from "./types.js"
import { Store } from "./store.js"

export interface Transaction<T> {
  read(): T
  apply<P>(reducer: Reducer<T, P>, payload: P): T
  compute(fn: Compute<T>): T
  set(next: T): T
  commit(): T
  rollback(): T
}

export function beginTransaction<T>(store: Store<T>): Transaction<T> {
  const initial = store.snapshot() as unknown as T
  let next = initial
  let sealed = false

  function assertOpen() {
    if (sealed) throw new Error("Transaction is already sealed (committed or rolled back)")
  }

  return {
    read() {
      return next
    },
    apply<P>(reducer: Reducer<T, P>, payload: P) {
      assertOpen()
      next = reducer(next as DeepReadonly<T>, payload)
      return next
    },
    compute(fn: Compute<T>) {
      assertOpen()
      next = fn(next as DeepReadonly<T>)
      return next
    },
    set(s: T) {
      assertOpen()
      next = s
      return next
    },
    commit() {
      assertOpen()
      sealed = true
      store.set(next)
      return store.read()
    },
    rollback() {
      assertOpen()
      sealed = true
      next = initial
      return next
    }
  }
}

