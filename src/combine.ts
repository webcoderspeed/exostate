import { Equality } from "./types.js"
import { Store } from "./store.js"

export interface Combined<TShape extends Record<string, unknown>> {
  read(): { [K in keyof TShape]: Readonly<TShape[K]> }
  subscribe(
    subscriber: (s: { [K in keyof TShape]: Readonly<TShape[K]> }) => void,
    options?: { eq?: Equality<{ [K in keyof TShape]: Readonly<TShape[K]> }>, fireImmediately?: boolean }
  ): () => void
  /** Detaches from all child stores and drops every subscriber. */
  destroy(): void
}

export function combineStores<TShape extends Record<string, unknown>>(
  stores: { [K in keyof TShape]: Store<TShape[K]> }
): Combined<TShape> {
  const keys = Object.keys(stores) as Array<keyof TShape>
  let current = {} as { [K in keyof TShape]: Readonly<TShape[K]> }
  for (const k of keys) {
    current[k] = stores[k].snapshot() as Readonly<TShape[typeof k]>
  }

  let subscribers: Array<() => void> = []
  let childUnsubs: Array<() => void> | null = null

  function notifyAll() {
    // Iterate a snapshot so a subscriber unsubscribing mid-notification
    // can't shift the array out from under the loop.
    for (const n of subscribers.slice()) n()
  }

  /**
   * Pulls the latest snapshot from every child store. Returns true when the
   * combined value actually changed, so notifications stay change-driven.
   */
  function refresh(): boolean {
    let next: { [K in keyof TShape]: Readonly<TShape[K]> } | null = null
    for (const k of keys) {
      const snap = stores[k].snapshot() as Readonly<TShape[typeof k]>
      if (!Object.is(current[k], snap)) {
        if (next === null) next = { ...current }
        next[k] = snap
      }
    }
    if (next === null) return false
    current = next
    return true
  }

  function attach() {
    if (childUnsubs) return
    // Catch up on anything that changed while we were detached, otherwise the
    // first post-attach notification would compare against a stale baseline.
    refresh()
    childUnsubs = keys.map((k) => {
      const s = stores[k]
      return s.subscribe(x => x as Readonly<TShape[typeof k]>, () => {
        if (refresh()) notifyAll()
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
      // While detached there are no child subscriptions keeping `current`
      // up to date, so pull fresh values on demand.
      if (!childUnsubs) refresh()
      return current
    },
    subscribe(subscriber, options) {
      const eq: Equality<{ [K in keyof TShape]: Readonly<TShape[K]> }> = options?.eq ?? Object.is
      attach()
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
      let active = true
      return () => {
        if (!active) return
        active = false
        const idx = subscribers.indexOf(notify)
        if (idx >= 0) subscribers.splice(idx, 1)
        if (subscribers.length === 0) detach()
      }
    },
    destroy() {
      subscribers = []
      detach()
    }
  }
}
