import { Reducer, Selector, Subscriber, Unsubscribe, Equality, SubscribeOptions, DeepReadonly, Compute, Effect } from "./types"
import { State } from "./state"

export interface Store<T> extends State<T> {
  update<P>(reducer: Reducer<T, P>, payload: P): T
  set(next: T): T
  subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>): Unsubscribe
  compute(fn: Compute<T>): T
  batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void): T
  effect<P>(fn: Effect<T, P>, payload: P): void | Promise<void>
}

export function createStore<T>(initial: T): Store<T> {
  let current = initial
  let version = 0
  const listeners: Array<() => void> = []
  
  function notifyListeners() {
    for (const notify of listeners) notify()
  }
  
  return {
    get version() {
      return version
    },
    read() {
      return current
    },
    snapshot() {
      return current as DeepReadonly<T>
    },
    update<P>(reducer: Reducer<T, P>, payload: P) {
      const next = reducer(current as DeepReadonly<T>, payload)
      current = next
      version += 1
      notifyListeners()
      return current
    },
    set(next: T) {
      current = next
      version += 1
      notifyListeners()
      return current
    },
    compute(fn: Compute<T>) {
      const next = fn(current as DeepReadonly<T>)
      current = next
      version += 1
      notifyListeners()
      return current
    },
    batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void) {
      let next = current
      const applier = <P>(reducer: Reducer<T, P>, payload: P) => {
        next = reducer(next as DeepReadonly<T>, payload)
      }
      apply(applier)
      current = next
      version += 1
      notifyListeners()
      return current
    },
    effect<P>(fn: Effect<T, P>, payload: P) {
      return fn(current as DeepReadonly<T>, payload)
    },
    subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>) {
      const eq: Equality<R> = options?.eq ?? Object.is
      let prev = selector(current as DeepReadonly<T>)
      if (options?.fireImmediately) subscriber(prev)
      
      const notify = () => {
        const next = selector(current as DeepReadonly<T>)
        if (!eq(prev, next)) {
          prev = next
          subscriber(next)
        }
      }
      
      listeners.push(notify)
      
      const unsubscribe: Unsubscribe = () => {
        const idx = listeners.indexOf(notify)
        if (idx >= 0) listeners.splice(idx, 1)
      }
      
      return unsubscribe
    },
  }
}
