import { DeepReadonly, ExostatePlugin } from "./types.js"
import { Store } from "./store.js"

export type { ExostatePlugin } from "./types.js"

/**
 * Detach handles for plugins attached through `registerPlugin`, so that
 * `destroyPlugins` can tear down everything it registered.
 */
const detachRegistry = new WeakMap<object, Array<() => void>>()

/**
 * Attaches a plugin to a store.
 *
 * Prefer `store.use(plugin)` — this function exists so plugins can be attached
 * from helper code that only holds a `Store<T>` reference, and returns the same
 * detach function.
 */
export function registerPlugin<T>(store: Store<T>, plugin: ExostatePlugin<T>): () => void {
  const detach = store.use(plugin)
  const key = store as object
  let handles = detachRegistry.get(key)
  if (!handles) {
    handles = []
    detachRegistry.set(key, handles)
  }
  handles.push(detach)

  return () => {
    const list = detachRegistry.get(key)
    if (list) {
      const idx = list.indexOf(detach)
      if (idx >= 0) list.splice(idx, 1)
    }
    detach()
  }
}

export function getPlugins<T>(store: Store<T>): ReadonlyArray<ExostatePlugin<T>> {
  return store.plugins()
}

/** Fires `onDestroy` for every attached plugin and detaches them all. */
export function destroyPlugins<T>(store: Store<T>): void {
  for (const plugin of store.plugins()) plugin.onDestroy?.()
  const handles = detachRegistry.get(store as object)
  if (handles) {
    for (const detach of handles.slice()) detach()
    detachRegistry.delete(store as object)
  }
}

// ── Built-in Plugins ────────────────────────────────────────────────────

export interface LoggerOptions {
  name?: string
  collapsed?: boolean
  /** Sink for log output. Defaults to the global console. */
  console?: Pick<Console, "log" | "group" | "groupCollapsed" | "groupEnd">
}

/** Logs every committed state change. */
export function logger<T>(options?: LoggerOptions): ExostatePlugin<T> {
  const name = options?.name ?? "ExostateLogger"
  return {
    name,
    onAfterUpdate(prev, next) {
      const sink = options?.console ?? globalThis.console
      if (!sink) return
      const group = options?.collapsed ? sink.groupCollapsed : sink.group
      group.call(sink, `[${name}] state updated`)
      sink.log("prev:", prev)
      sink.log("next:", next)
      sink.groupEnd()
    }
  }
}

/**
 * Deep-freezes every committed state so accidental mutation throws in strict
 * mode. Intended for development builds.
 */
export function freeze<T>(): ExostatePlugin<T> {
  function deepFreeze(obj: unknown, seen: Set<object>): unknown {
    if (typeof obj !== "object" || obj === null) return obj
    // Guard against cycles — a self-referential state would otherwise recurse
    // until the stack blows.
    if (seen.has(obj)) return obj
    seen.add(obj)
    Object.freeze(obj)
    for (const val of Object.values(obj as Record<string, unknown>)) {
      if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
        deepFreeze(val, seen)
      }
    }
    return obj
  }

  return {
    name: "ExostateFreeze",
    onBeforeUpdate(_prev: DeepReadonly<T>, next: T) {
      deepFreeze(next, new Set())
      return next
    }
  }
}
