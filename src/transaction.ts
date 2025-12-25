import { DeepReadonly, Reducer, Compute } from "./types"
import { Store } from "./store"

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
  return {
    read() {
      return next
    },
    apply<P>(reducer: Reducer<T, P>, payload: P) {
      next = reducer(next as DeepReadonly<T>, payload)
      return next
    },
    compute(fn: Compute<T>) {
      next = fn(next as DeepReadonly<T>)
      return next
    },
    set(s: T) {
      next = s
      return next
    },
    commit() {
      store.set(next)
      return store.read()
    },
    rollback() {
      next = initial
      return next
    }
  }
}

