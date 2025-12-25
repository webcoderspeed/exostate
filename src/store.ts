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

export class StoreImpl<T> implements Store<T> {
  version = 0
  listeners = new Set<() => void>()

  constructor(public current: T) {}

  read() {
    return this.current
  }

  snapshot() {
    return this.current as DeepReadonly<T>
  }

  update<P>(reducer: Reducer<T, P>, payload: P) {
    const next = reducer(this.current as DeepReadonly<T>, payload)
    this.current = next
    this.version += 1
    if (this.listeners.size > 0) this.notifyListeners()
    return this.current
  }

  set(next: T) {
    this.current = next
    this.version += 1
    if (this.listeners.size > 0) this.notifyListeners()
    return this.current
  }

  compute(fn: Compute<T>) {
    const next = fn(this.current as DeepReadonly<T>)
    this.current = next
    this.version += 1
    if (this.listeners.size > 0) this.notifyListeners()
    return this.current
  }

  batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void) {
    let next = this.current
    const applier = <P>(reducer: Reducer<T, P>, payload: P) => {
      next = reducer(next as DeepReadonly<T>, payload)
    }
    apply(applier)
    this.current = next
    this.version += 1
    if (this.listeners.size > 0) this.notifyListeners()
    return this.current
  }

  effect<P>(fn: Effect<T, P>, payload: P) {
    return fn(this.current as DeepReadonly<T>, payload)
  }

  subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>) {
    const eq: Equality<R> = options?.eq || Object.is
    let prev = selector(this.current as DeepReadonly<T>)
    if (options?.fireImmediately) subscriber(prev)
    
    // Optimize: flatten notify logic to reduce closure/stack depth
    const notify = () => {
      const next = selector(this.current as DeepReadonly<T>)
      if (!eq(prev, next)) {
        prev = next
        subscriber(next)
      }
    }
    
    // Copy-on-write add (Set)
    const nextListeners = new Set(this.listeners)
    nextListeners.add(notify)
    this.listeners = nextListeners
    
    const unsubscribe: Unsubscribe = () => {
      if (this.listeners.has(notify)) {
        // Copy-on-write remove (Set)
        const next = new Set(this.listeners)
        next.delete(notify)
        this.listeners = next
      }
    }
    
    return unsubscribe
  }

  private notifyListeners() {
    for (const notify of this.listeners) notify()
  }
}

export function createStore<T>(initial: T): Store<T> {
  return new StoreImpl(initial)
}
