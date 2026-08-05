import { DeepReadonly, StorageLike } from "./types.js"
import { Store } from "./store.js"

export interface PersistOptions<T> {
  loadInitial?: boolean
  encode?: (snapshot: DeepReadonly<T>) => string
  decode?: (raw: string) => T
}

export interface PersistController {
  detach(): void
}

/**
 * Mirrors a store into any synchronous `StorageLike` (localStorage,
 * sessionStorage, or your own adapter).
 *
 * Filesystem persistence lives in `exostate/node` so that importing the core
 * package never pulls `node:fs` into a browser bundle.
 */
export function persistLocal<T>(
  store: Store<T>,
  key: string,
  storage: StorageLike,
  options?: PersistOptions<T>
): PersistController {
  const encode = options?.encode ?? ((s: DeepReadonly<T>) => JSON.stringify(s))
  const decode = options?.decode ?? ((raw: string) => JSON.parse(raw) as T)
  let detach: (() => void) | null = null
  let suppress = false

  if (options?.loadInitial !== false) {
    const raw = storage.getItem(key)
    if (raw != null) {
      try {
        const initial = decode(raw)
        suppress = true
        // try/finally: if a plugin or listener throws while applying the loaded
        // state, `suppress` must still be cleared or nothing is ever persisted.
        try { store.set(initial) }
        finally { suppress = false }
      } catch { void 0 }
    }
  }

  detach = store.subscribe(s => s as unknown as T, (next) => {
    if (suppress) return
    try {
      storage.setItem(key, encode(next as unknown as DeepReadonly<T>))
    } catch { void 0 }
  })

  return {
    detach: () => {
      if (detach) {
        detach()
        detach = null
      }
    }
  }
}
