import { DeepReadonly, StorageLike } from "./types"
import { Store } from "./store"
import { promises as fs } from "node:fs"
import path from "node:path"

export interface PersistOptions<T> {
  loadInitial?: boolean
  encode?: (snapshot: DeepReadonly<T>) => string
  decode?: (raw: string) => T
}

export function persistLocal<T>(
  store: Store<T>,
  key: string,
  storage: StorageLike,
  options?: PersistOptions<T>
) {
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
        store.set(initial)
        suppress = false
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

export async function persistFs<T>(
  store: Store<T>,
  filePath: string,
  options?: PersistOptions<T>
) {
  const encode = options?.encode ?? ((s: DeepReadonly<T>) => JSON.stringify(s))
  const decode = options?.decode ?? ((raw: string) => JSON.parse(raw) as T)
  const dir = path.dirname(filePath)
  let suppress = false
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch { void 0 }
  
  if (options?.loadInitial !== false) {
    try {
      const raw = await fs.readFile(filePath, "utf8")
      const initial = decode(raw)
      suppress = true
      store.set(initial)
      suppress = false
    } catch { void 0 }
  }
  
  const unsub = store.subscribe(s => s as unknown as T, (next) => {
    if (suppress) return
    fs.writeFile(filePath, encode(next as unknown as DeepReadonly<T>), "utf8").catch(() => void 0)
  })
  
  return {
    detach: () => {
      unsub()
    }
  }
}
