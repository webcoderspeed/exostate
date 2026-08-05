import { promises as fs } from "node:fs"
import path from "node:path"
import type { DeepReadonly } from "../types.js"
import type { Store } from "../store.js"
import type { PersistOptions, PersistController } from "../persist.js"

export type { PersistOptions, PersistController } from "../persist.js"

/**
 * Mirrors a store to a JSON file on disk.
 *
 * Lives in the `exostate/node` entry point rather than the core bundle: a
 * top-level `node:fs` import in the main entry breaks browser bundlers that
 * cannot resolve node builtins.
 *
 * Writes are serialized through a single-slot queue, so a burst of updates
 * collapses to one pending write and can never interleave two `writeFile`
 * calls into a torn file.
 */
export async function persistFs<T>(
  store: Store<T>,
  filePath: string,
  options?: PersistOptions<T>
): Promise<PersistController> {
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
      try { store.set(initial) }
      finally { suppress = false }
    } catch { void 0 }
  }

  let writing: Promise<void> | null = null
  let pending: string | null = null

  function drain(): void {
    if (writing || pending === null) return
    const payload = pending
    pending = null
    writing = fs.writeFile(filePath, payload, "utf8")
      .catch(() => void 0)
      .then(() => {
        writing = null
        drain()
      })
  }

  const unsub = store.subscribe(s => s as unknown as T, (next) => {
    if (suppress) return
    try {
      pending = encode(next as unknown as DeepReadonly<T>)
    } catch { return }
    drain()
  })

  return {
    detach: () => {
      unsub()
    }
  }
}
