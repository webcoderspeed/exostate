import { Selector, Subscriber, Unsubscribe, SubscribeOptions, DeepReadonly } from "./types.js"
import { Store } from "./store.js"

export interface Derived<R> {
  read(): R
  subscribe(subscriber: Subscriber<R>, options?: SubscribeOptions<R>): Unsubscribe
}

export function derive<T, R>(store: Store<T>, selector: Selector<T, R>): Derived<R> {
  return {
    read() {
      return selector(store.snapshot() as DeepReadonly<T>)
    },
    subscribe(subscriber: Subscriber<R>, options?: SubscribeOptions<R>) {
      return store.subscribe(selector, subscriber, options)
    },
  }
}

