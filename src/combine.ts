import { Equality } from "./types"
import { Store } from "./store"

export interface Combined<TShape extends Record<string, unknown>> {
  read(): { [K in keyof TShape]: Readonly<TShape[K]> }
  subscribe(
    subscriber: (s: { [K in keyof TShape]: Readonly<TShape[K]> }) => void,
    options?: { eq?: Equality<{ [K in keyof TShape]: Readonly<TShape[K]> }>, fireImmediately?: boolean }
  ): () => void
}

export function combineStores<TShape extends Record<string, unknown>>(
  stores: { [K in keyof TShape]: Store<TShape[K]> }
): Combined<TShape> {
  const keys = Object.keys(stores) as Array<keyof TShape>
  let current = {} as { [K in keyof TShape]: Readonly<TShape[K]> }
  for (const k of keys) {
    const s = stores[k]
    current[k] = s.snapshot() as Readonly<TShape[typeof k]>
  }

  const subscribers: Array<() => void> = []
  let childUnsubs: Array<() => void> | null = null

  function notifyAll() {
    for (const n of subscribers) n()
  }

  function attach() {
    if (childUnsubs) return
    childUnsubs = keys.map((k) => {
      const s = stores[k]
      return s.subscribe(x => x as Readonly<TShape[typeof k]>, () => {
        const next = { ...current }
        next[k] = s.snapshot() as Readonly<TShape[typeof k]>
        if (!Object.is(current, next)) {
          current = next
          notifyAll()
        }
      })
    })
  }

  function detach() {
    if (!childUnsubs) return
    for (const u of childUnsubs) u()
    childUnsubs = null
  }

  return {
    read() {
      return current
    },
    subscribe(subscriber, options) {
      const eq: Equality<{ [K in keyof TShape]: Readonly<TShape[K]> }> = options?.eq ?? Object.is
      if (!childUnsubs) attach()
      let prev = current
      if (options?.fireImmediately) subscriber(prev)
      const notify = () => {
        const next = current
        if (!eq(prev, next)) {
          prev = next
          subscriber(next)
        }
      }
      subscribers.push(notify)
      return () => {
        const idx = subscribers.indexOf(notify)
        if (idx >= 0) subscribers.splice(idx, 1)
        if (subscribers.length === 0) detach()
      }
    }
  }
}
