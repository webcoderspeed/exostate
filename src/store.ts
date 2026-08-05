import {
  Reducer,
  Selector,
  Subscriber,
  Unsubscribe,
  Equality,
  SubscribeOptions,
  DeepReadonly,
  Compute,
  Effect,
  ExostatePlugin,
  StoreOptions,
  NotifyMode,
} from "./types.js"
import { State } from "./state.js"

export interface Store<T> extends State<T> {
  update<P>(reducer: Reducer<T, P>, payload: P): T
  set(next: T): T
  subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>): Unsubscribe
  compute(fn: Compute<T>): T
  batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void): T
  effect<P>(fn: Effect<T, P>, payload: P): void | Promise<void>
  patch(partial: Partial<T> | ((prev: DeepReadonly<T>) => Partial<T>)): T
  /** Attach a plugin. Returns a function that detaches it. */
  use(plugin: ExostatePlugin<T>): Unsubscribe
  /** Plugins currently attached, in attach order. */
  plugins(): ReadonlyArray<ExostatePlugin<T>>
  /** Deliver any notification queued by `notify: "microtask"` immediately. */
  flush(): void
  destroy(): void
  readonly destroyed: boolean
}

interface PluginRegistration<T> {
  plugin: ExostatePlugin<T>
  cleanup?: () => void
}

export class StoreImpl<T> implements Store<T> {
  version = 0
  listeners = new Set<() => void>()
  destroyed = false

  private readonly options: StoreOptions<T>
  private readonly mode: NotifyMode
  private registrations: Array<PluginRegistration<T>> = []

  // Hot-path hook caches. Kept as plain arrays so a store with no plugins
  // pays only a `.length` check per mutation.
  private beforeHooks: Array<(prev: DeepReadonly<T>, next: T) => T | void> = []
  private afterHooks: Array<(prev: DeepReadonly<T>, next: T) => void> = []
  private subHooks: Array<(count: number) => void> = []
  private unsubHooks: Array<(count: number) => void> = []

  private notifyScheduled = false
  private unmountTimer: ReturnType<typeof setTimeout> | null = null

  constructor(public current: T, options?: StoreOptions<T>) {
    this.options = options ?? {}
    this.mode = this.options.notify ?? "sync"
    if (this.options.plugins) {
      for (const p of this.options.plugins) this.use(p)
    }
  }

  private checkDestroyed() {
    if (this.destroyed) throw new Error('Store is destroyed')
  }

  read() {
    return this.current
  }

  snapshot() {
    return this.current as DeepReadonly<T>
  }

  /**
   * Single write path: runs the plugin pipeline, commits, bumps the version,
   * then schedules notification. Every mutating method funnels through here so
   * plugins and batching can never be bypassed.
   */
  private commit(next: T): T {
    let value = next
    if (this.beforeHooks.length > 0) {
      const prev = this.current as DeepReadonly<T>
      for (const hook of this.beforeHooks) {
        const replaced = hook(prev, value)
        if (replaced !== undefined) value = replaced
      }
    }

    const prev = this.current as DeepReadonly<T>
    this.current = value
    this.version += 1

    if (this.afterHooks.length > 0) {
      for (const hook of this.afterHooks) hook(prev, value)
    }
    if (this.listeners.size > 0) this.scheduleNotify()
    return this.current
  }

  update<P>(reducer: Reducer<T, P>, payload: P) {
    this.checkDestroyed()
    return this.commit(reducer(this.current as DeepReadonly<T>, payload))
  }

  set(next: T) {
    this.checkDestroyed()
    return this.commit(next)
  }

  compute(fn: Compute<T>) {
    this.checkDestroyed()
    return this.commit(fn(this.current as DeepReadonly<T>))
  }

  batch(apply: (apply: <P>(reducer: Reducer<T, P>, payload: P) => void) => void) {
    this.checkDestroyed()
    let next = this.current
    const applier = <P>(reducer: Reducer<T, P>, payload: P) => {
      next = reducer(next as DeepReadonly<T>, payload)
    }
    apply(applier)
    return this.commit(next)
  }

  patch(partial: Partial<T> | ((prev: DeepReadonly<T>) => Partial<T>)) {
    this.checkDestroyed()
    const p = typeof partial === 'function'
      ? (partial as (prev: DeepReadonly<T>) => Partial<T>)(this.current as DeepReadonly<T>)
      : partial
    return this.commit(Object.assign({}, this.current, p))
  }

  effect<P>(fn: Effect<T, P>, payload: P) {
    return fn(this.current as DeepReadonly<T>, payload)
  }

  subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>) {
    this.checkDestroyed()
    const eq: Equality<R> = options?.eq || Object.is
    let prev = selector(this.current as DeepReadonly<T>)
    if (options?.fireImmediately) subscriber(prev)

    // Optimize: flatten notify logic to reduce closure/stack depth
    const notify = () => {
      const next = selector(this.current as DeepReadonly<T>)
      if (!eq(prev, next)) {
        prev = next
        subscriber(next)
      }
    }

    // Copy-on-write add (Set) — an in-flight notification loop iterates a
    // snapshot, so subscribing during notification can't corrupt it.
    const nextListeners = new Set(this.listeners)
    nextListeners.add(notify)
    this.listeners = nextListeners
    this.handleSubscribe()

    let active = true
    const unsubscribe: Unsubscribe = () => {
      // Idempotent: a double unsubscribe must not fire lifecycle hooks twice.
      if (!active) return
      active = false
      if (this.listeners.has(notify)) {
        // Copy-on-write remove (Set)
        const next = new Set(this.listeners)
        next.delete(notify)
        this.listeners = next
      }
      this.handleUnsubscribe()
    }

    return unsubscribe
  }

  private scheduleNotify() {
    if (this.mode === "sync") {
      this.notifyListeners()
      return
    }
    if (this.notifyScheduled) return
    this.notifyScheduled = true
    queueMicrotask(() => {
      if (!this.notifyScheduled) return
      this.notifyScheduled = false
      if (this.destroyed) return
      this.notifyListeners()
    })
  }

  flush() {
    if (!this.notifyScheduled) return
    this.notifyScheduled = false
    if (this.destroyed) return
    this.notifyListeners()
  }

  private notifyListeners() {
    for (const notify of this.listeners) notify()
  }

  private handleSubscribe() {
    // A new subscriber cancels a pending idle teardown.
    if (this.unmountTimer !== null) {
      clearTimeout(this.unmountTimer)
      this.unmountTimer = null
    }
    if (this.subHooks.length === 0 && !this.options.onSubscribe) return
    const count = this.listeners.size
    this.options.onSubscribe?.(this, count)
    for (const hook of this.subHooks) hook(count)
  }

  private handleUnsubscribe() {
    if (this.unsubHooks.length === 0 && !this.options.onUnsubscribe) return
    const emit = () => {
      const count = this.listeners.size
      this.options.onUnsubscribe?.(this, count)
      for (const hook of this.unsubHooks) hook(count)
    }
    const delay = this.options.unmountDelay ?? 0
    if (this.listeners.size === 0 && delay > 0) {
      if (this.unmountTimer !== null) clearTimeout(this.unmountTimer)
      this.unmountTimer = setTimeout(() => {
        this.unmountTimer = null
        // Re-check: a subscriber may have arrived during the grace period.
        if (this.listeners.size === 0) emit()
      }, delay)
      return
    }
    emit()
  }

  use(plugin: ExostatePlugin<T>): Unsubscribe {
    const cleanup = plugin.onInit?.(this)
    const registration: PluginRegistration<T> = {
      plugin,
      cleanup: typeof cleanup === "function" ? cleanup : undefined,
    }
    this.registrations.push(registration)
    this.rebuildHooks()

    let detached = false
    return () => {
      if (detached) return
      detached = true
      const idx = this.registrations.indexOf(registration)
      if (idx >= 0) this.registrations.splice(idx, 1)
      this.rebuildHooks()
      registration.cleanup?.()
    }
  }

  plugins(): ReadonlyArray<ExostatePlugin<T>> {
    return this.registrations.map(r => r.plugin)
  }

  private rebuildHooks() {
    this.beforeHooks = []
    this.afterHooks = []
    this.subHooks = []
    this.unsubHooks = []
    for (const { plugin } of this.registrations) {
      if (plugin.onBeforeUpdate) this.beforeHooks.push(plugin.onBeforeUpdate.bind(plugin))
      if (plugin.onAfterUpdate) this.afterHooks.push(plugin.onAfterUpdate.bind(plugin))
      if (plugin.onSubscribe) this.subHooks.push(plugin.onSubscribe.bind(plugin))
      if (plugin.onUnsubscribe) this.unsubHooks.push(plugin.onUnsubscribe.bind(plugin))
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.unmountTimer !== null) {
      clearTimeout(this.unmountTimer)
      this.unmountTimer = null
    }
    this.notifyScheduled = false
    this.listeners = new Set()
    for (const registration of this.registrations) {
      registration.plugin.onDestroy?.()
      registration.cleanup?.()
    }
    this.registrations = []
    this.rebuildHooks()
    this.version = -1
  }
}

export function createStore<T>(initial: T, options?: StoreOptions<T>): Store<T> {
  return new StoreImpl(initial, options)
}
