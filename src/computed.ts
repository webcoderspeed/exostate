import { Selector, Subscriber, SubscribeOptions } from "./types.js"
import { Store } from "./store.js"
import { Derived } from "./derived.js"

export function computed<T, R>(store: Store<T>, selector: Selector<T, R>): Derived<R> {
  let cachedVersion = -1
  let cachedValue: R

  return {
    read() {
      if (store.version !== cachedVersion) {
        cachedValue = selector(store.snapshot())
        cachedVersion = store.version
      }
      return cachedValue
    },
    subscribe(subscriber: Subscriber<R>, options?: SubscribeOptions<R>) {
      return store.subscribe(selector, subscriber, options)
    },
  }
}
