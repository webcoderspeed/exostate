import { DeepReadonly, Unsubscribe } from "./types"
import { Store } from "./store"

export interface History<T> {
  canUndo(): boolean
  canRedo(): boolean
  undo(): T | undefined
  redo(): T | undefined
  record(state?: DeepReadonly<T>): void
  clear(): void
  size(): number
  pointer(): number
  entries(): ReadonlyArray<DeepReadonly<T>>
  jumpTo(index: number): T | undefined
}

export interface HistoryOptions {
  limit?: number
  recordInitial?: boolean
}

export function createHistory<T>(store: Store<T>, options?: HistoryOptions) {
  const limit = options?.limit ?? 100
  const items: Array<DeepReadonly<T>> = []
  let idx = -1
  let unsub: Unsubscribe | null = null
  let suppress = false
  
  function push(state: DeepReadonly<T>) {
    if (idx < items.length - 1) {
      items.splice(idx + 1)
    }
    items.push(state)
    if (items.length > limit) {
      items.shift()
      idx -= 1
    }
    idx = items.length - 1
  }
  
  const api: History<T> = {
    canUndo() {
      return idx > 0
    },
    canRedo() {
      return idx >= 0 && idx < items.length - 1
    },
    undo() {
      if (!api.canUndo()) return undefined
      idx -= 1
      const state = items[idx]
      suppress = true
      store.set(state as unknown as T)
      suppress = false
      return store.read()
    },
    redo() {
      if (!api.canRedo()) return undefined
      idx += 1
      const state = items[idx]
      suppress = true
      store.set(state as unknown as T)
      suppress = false
      return store.read()
    },
    record(state?: DeepReadonly<T>) {
      const snap = state ?? store.snapshot()
      push(snap)
    },
    clear() {
      items.splice(0)
      idx = -1
    },
    size() {
      return items.length
    },
    pointer() {
      return idx
    },
    entries() {
      return items
    },
    jumpTo(index: number) {
      if (index < 0 || index >= items.length) return undefined
      idx = index
      const state = items[idx]
      suppress = true
      store.set(state as unknown as T)
      suppress = false
      return store.read()
    },
  }
  
  function attach() {
    if (unsub) return
    unsub = store.subscribe(s => s as unknown as T, (next) => {
      if (suppress) return
      api.record(next as unknown as DeepReadonly<T>)
    })
  }
  
  function detach() {
    if (unsub) {
      unsub()
      unsub = null
    }
  }
  
  if (options?.recordInitial !== false) {
    api.record()
  }
  
  return { ...api, attach, detach }
}
