import { DeepReadonly } from "./types.js"
import { Store } from "./store.js"
import type { PersistController } from "./persist.js"

export interface PersistIdbOptions<T> {
  dbName?: string
  storeName?: string
  key?: string
  loadInitial?: boolean
  /** Serialize before writing. Defaults to storing the structured value as-is. */
  encode?: (snapshot: DeepReadonly<T>) => unknown
  decode?: (raw: unknown) => T
  /** Coalesce writes over this many ms. Default `50`. Use `0` to write eagerly. */
  writeDebounceMs?: number
}

function requestToPromise<R>(request: IDBRequest<R>): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"))
    request.onblocked = () => reject(new Error("IndexedDB open blocked by another connection"))
  })
}

/**
 * Mirrors a store into IndexedDB.
 *
 * Preferred over `persistLocal` for large state: IndexedDB is asynchronous (so
 * it never blocks the main thread) and is not bound by the ~5MB localStorage
 * quota. Values are stored structured-clone style, so `Date`, `Map`, `Set`, and
 * typed arrays survive a round trip without a custom serializer.
 *
 * @example
 * ```ts
 * const ctrl = await persistIndexedDB(store, { dbName: 'my-app', key: 'main' })
 * // later
 * ctrl.detach()
 * ```
 */
export async function persistIndexedDB<T>(
  store: Store<T>,
  options?: PersistIdbOptions<T>
): Promise<PersistController> {
  const dbName = options?.dbName ?? "exostate"
  const storeName = options?.storeName ?? "state"
  const key = options?.key ?? "main"
  const debounceMs = options?.writeDebounceMs ?? 50
  const encode = options?.encode ?? ((s: DeepReadonly<T>) => s as unknown)
  const decode = options?.decode ?? ((raw: unknown) => raw as T)

  if (typeof indexedDB === "undefined") {
    throw new Error("persistIndexedDB requires an environment with IndexedDB")
  }

  const db = await openDatabase(dbName, storeName)
  let suppress = false
  let detached = false

  if (options?.loadInitial !== false) {
    try {
      const tx = db.transaction(storeName, "readonly")
      const raw: unknown = await requestToPromise(tx.objectStore(storeName).get(key) as IDBRequest<unknown>)
      if (raw !== undefined) {
        const initial = decode(raw)
        suppress = true
        try { store.set(initial) }
        finally { suppress = false }
      }
    } catch { void 0 }
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: unknown = undefined
  let hasPending = false

  function write(force = false): void {
    if ((detached && !force) || !hasPending) return
    const payload = pending
    hasPending = false
    pending = undefined
    try {
      const tx = db.transaction(storeName, "readwrite")
      tx.objectStore(storeName).put(payload, key)
    } catch { void 0 }
  }

  const unsub = store.subscribe(s => s as unknown as T, (next) => {
    if (suppress || detached) return
    pending = encode(next as unknown as DeepReadonly<T>)
    hasPending = true
    if (debounceMs <= 0) {
      write()
      return
    }
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      write()
    }, debounceMs)
  })

  return {
    detach: () => {
      if (detached) return
      detached = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      // Flush whatever was still queued so a detach never silently drops the
      // most recent state.
      write(true)
      unsub()
      db.close()
    }
  }
}
