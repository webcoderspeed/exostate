import { Store, createStore } from "./store.js"
import { Unsubscribe } from "./types.js"
import { SafeError, toSafeError } from "./errors.js"

export type QueryKey = ReadonlyArray<unknown>

export type QueryStatus = "idle" | "loading" | "success" | "error"
export type FetchStatus = "idle" | "fetching" | "paused"

export interface QueryState<TData> {
  /** Cached data, if this query has ever resolved. */
  data: TData | undefined
  error: SafeError | undefined
  status: QueryStatus
  /** Whether a request is in flight right now — independent of `status`. */
  fetchStatus: FetchStatus
  /** `true` while loading with no cached data to show. */
  isLoading: boolean
  /** `true` while refetching with cached data already on screen. */
  isFetching: boolean
  isSuccess: boolean
  isError: boolean
  /** `true` when the cached data is older than `staleTime`. */
  isStale: boolean
  /** Epoch ms of the last successful resolution, or 0. */
  dataUpdatedAt: number
  errorUpdatedAt: number
  failureCount: number
}

export interface QueryFunctionContext {
  queryKey: QueryKey
  signal: AbortSignal
}

export type QueryFunction<TData> = (context: QueryFunctionContext) => Promise<TData>

export interface QueryOptions<TData> {
  /** How long resolved data stays fresh, in ms. Default `0` (immediately stale). */
  staleTime?: number
  /** How long unused data is kept after the last observer leaves. Default `5 * 60_000`. */
  gcTime?: number
  /** Retries after the first failure. A function receives the zero-based attempt and the error. */
  retry?: number | ((attempt: number, error: SafeError) => boolean)
  /** Backoff in ms. Default: exponential, `min(1000 * 2 ** attempt, 30_000)`. */
  retryDelay?: number | ((attempt: number) => number)
  /** Refetch when the window regains focus. Default `true`. */
  refetchOnWindowFocus?: boolean
  /** Refetch when the network comes back. Default `true`. */
  refetchOnReconnect?: boolean
  /** Poll on an interval, in ms. Default `0` (off). */
  refetchInterval?: number
  /** Skip fetching entirely while `false`. Default `true`. */
  enabled?: boolean
  /** Seed the cache synchronously on first observation. */
  initialData?: TData | (() => TData)
  /** Shown while loading, but never written to the cache. */
  placeholderData?: TData | (() => TData)
  /** Called on every successful resolution. */
  onSuccess?: (data: TData) => void
  /** Called when a fetch ultimately fails. */
  onError?: (error: SafeError) => void
}

interface ResolvedOptions<TData> extends QueryOptions<TData> {
  staleTime: number
  gcTime: number
  refetchOnWindowFocus: boolean
  refetchOnReconnect: boolean
  refetchInterval: number
  enabled: boolean
}

export interface QueryObserverOptions<TData> extends QueryOptions<TData> {
  queryKey: QueryKey
  queryFn: QueryFunction<TData>
}

/**
 * Serializes a query key into a stable cache identity. Object keys are sorted
 * so `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` map to the same entry.
 */
export function hashQueryKey(key: QueryKey): string {
  return JSON.stringify(key, (_field, value: unknown) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const source = value as Record<string, unknown>
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(source).sort()) sorted[k] = source[k]
      return sorted
    }
    return value
  })
}

function initialState<TData>(): QueryState<TData> {
  return {
    data: undefined,
    error: undefined,
    status: "idle",
    fetchStatus: "idle",
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    isError: false,
    isStale: true,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
  }
}

/** True when `filter` is a prefix of `key` — the basis of partial invalidation. */
function keyMatchesPrefix(key: QueryKey, filter: QueryKey): boolean {
  if (filter.length > key.length) return false
  for (let i = 0; i < filter.length; i++) {
    if (hashQueryKey([key[i]]) !== hashQueryKey([filter[i]])) return false
  }
  return true
}

class QueryEntry<TData> {
  readonly store: Store<QueryState<TData>>
  readonly hash: string
  readonly key: QueryKey

  private queryFn: QueryFunction<TData> | null = null
  private options: ResolvedOptions<TData>
  private observers = new Set<object>()
  private controller: AbortController | null = null
  private inFlight: Promise<TData> | null = null
  private gcTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private staleTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private optionsApplied = false

  constructor(
    key: QueryKey,
    hash: string,
    options: ResolvedOptions<TData>,
    private readonly onDispose: (hash: string) => void,
    private readonly now: () => number
  ) {
    this.key = key
    this.hash = hash
    this.options = options
    this.store = createStore<QueryState<TData>>(initialState<TData>())

    if (options.initialData !== undefined) {
      const seed = typeof options.initialData === "function"
        ? (options.initialData as () => TData)()
        : options.initialData
      this.setData(seed)
    }
  }

  getOptions(): ResolvedOptions<TData> {
    return this.options
  }

  /**
   * Merges a new observer's options in. Once a real observer exists, later
   * observers can only tighten `staleTime`/`gcTime` — with several components
   * sharing one key, the most demanding one wins.
   *
   * The first call replaces outright rather than merging: an entry created by
   * `hydrate` or `setQueryData` carries placeholder defaults (`staleTime: 0`),
   * and merging those in would make hydrated data permanently stale.
   */
  applyOptions(options: ResolvedOptions<TData>, queryFn: QueryFunction<TData>) {
    this.queryFn = queryFn
    if (this.optionsApplied) {
      this.options = {
        ...this.options,
        ...options,
        staleTime: Math.min(this.options.staleTime, options.staleTime),
        gcTime: Math.max(this.options.gcTime, options.gcTime),
      }
    } else {
      this.options = options
      this.optionsApplied = true
    }
    this.scheduleInterval()
    this.scheduleStaleTransition()
  }

  isStale(): boolean {
    const { dataUpdatedAt, status } = this.store.read()
    if (status !== "success") return true
    return this.now() - dataUpdatedAt >= this.options.staleTime
  }

  addObserver(token: object) {
    this.observers.add(token)
    if (this.gcTimer !== null) {
      clearTimeout(this.gcTimer)
      this.gcTimer = null
    }
    this.scheduleInterval()
  }

  removeObserver(token: object) {
    this.observers.delete(token)
    if (this.observers.size > 0) return

    this.stopInterval()
    // Nothing is watching: cancel work in flight and start the GC countdown.
    this.cancel()
    if (this.options.gcTime === Infinity) return
    this.gcTimer = setTimeout(() => {
      this.gcTimer = null
      if (this.observers.size === 0) this.dispose()
    }, this.options.gcTime)
  }

  observerCount(): number {
    return this.observers.size
  }

  setData(data: TData, updatedAt?: number) {
    const at = updatedAt ?? this.now()
    this.store.patch({
      data,
      error: undefined,
      status: "success",
      isSuccess: true,
      isError: false,
      isLoading: false,
      isStale: this.options.staleTime <= 0,
      dataUpdatedAt: at,
      failureCount: 0,
    })
    this.scheduleStaleTransition()
  }

  /**
   * Runs the query function, deduplicating concurrent callers: while a request
   * is in flight every caller receives the same promise instead of firing a
   * second network request.
   */
  fetch(force = false): Promise<TData> {
    if (this.disposed) return Promise.reject(new Error("Query has been garbage collected"))
    if (!this.queryFn) return Promise.reject(new Error("No queryFn registered for this query"))
    if (!this.options.enabled && !force) {
      return Promise.resolve(this.store.read().data as TData)
    }
    if (this.inFlight) return this.inFlight

    const controller = new AbortController()
    this.controller = controller
    const hasData = this.store.read().status === "success"

    this.store.patch({
      status: hasData ? "success" : "loading",
      fetchStatus: "fetching",
      isFetching: true,
      isLoading: !hasData,
    })

    const attemptFetch = async (attempt: number): Promise<TData> => {
      try {
        const data = await this.queryFn!({ queryKey: this.key, signal: controller.signal })
        if (controller.signal.aborted) throw new Error("aborted")
        return data
      } catch (raw) {
        if (controller.signal.aborted) throw raw
        const error = toSafeError(raw)
        if (this.shouldRetry(attempt, error)) {
          this.store.patch({ failureCount: attempt + 1 })
          await new Promise(resolve => setTimeout(resolve, this.retryDelay(attempt)))
          if (controller.signal.aborted) throw raw
          return attemptFetch(attempt + 1)
        }
        throw error
      }
    }

    const run = attemptFetch(0)
      .then((data) => {
        if (controller.signal.aborted || this.disposed) return data
        this.setData(data)
        this.store.patch({ fetchStatus: "idle", isFetching: false })
        this.options.onSuccess?.(data)
        return data
      })
      .catch((raw: unknown) => {
        if (controller.signal.aborted || this.disposed) {
          // A cancelled fetch must not clobber good cached data with an error.
          this.store.patch({ fetchStatus: "idle", isFetching: false, isLoading: false })
          throw toSafeError(raw)
        }
        const error = toSafeError(raw)
        this.store.patch({
          error,
          status: "error",
          fetchStatus: "idle",
          isError: true,
          isFetching: false,
          isLoading: false,
          isSuccess: this.store.read().data !== undefined,
          errorUpdatedAt: this.now(),
        })
        this.options.onError?.(error)
        throw error
      })
      .finally(() => {
        if (this.controller === controller) this.controller = null
        this.inFlight = null
      })

    this.inFlight = run
    return run
  }

  private shouldRetry(attempt: number, error: SafeError): boolean {
    const retry = this.options.retry
    if (retry === undefined) return attempt < 3
    if (typeof retry === "function") return retry(attempt, error)
    return attempt < retry
  }

  private retryDelay(attempt: number): number {
    const delay = this.options.retryDelay
    if (delay === undefined) return Math.min(1000 * 2 ** attempt, 30_000)
    return typeof delay === "function" ? delay(attempt) : delay
  }

  /**
   * Flips `isStale` when `staleTime` elapses so subscribers re-render into the
   * stale state without anyone having to poll.
   */
  private scheduleStaleTransition() {
    if (this.staleTimer !== null) {
      clearTimeout(this.staleTimer)
      this.staleTimer = null
    }
    const { staleTime } = this.options
    if (staleTime <= 0 || staleTime === Infinity) {
      if (staleTime <= 0 && !this.store.read().isStale) this.store.patch({ isStale: true })
      return
    }
    const elapsed = this.now() - this.store.read().dataUpdatedAt
    const remaining = staleTime - elapsed
    if (remaining <= 0) {
      if (!this.store.read().isStale) this.store.patch({ isStale: true })
      return
    }
    this.staleTimer = setTimeout(() => {
      this.staleTimer = null
      if (!this.disposed) this.store.patch({ isStale: true })
    }, remaining)
  }

  private scheduleInterval() {
    this.stopInterval()
    const interval = this.options.refetchInterval
    if (!interval || interval <= 0 || this.observers.size === 0) return
    this.intervalTimer = setInterval(() => {
      void this.fetch().catch(() => void 0)
    }, interval)
  }

  private stopInterval() {
    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
  }

  invalidate(): void {
    this.store.patch({ isStale: true })
  }

  cancel(): void {
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
    this.inFlight = null
    if (this.store.read().isFetching) {
      this.store.patch({ fetchStatus: "idle", isFetching: false, isLoading: false })
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.cancel()
    this.stopInterval()
    if (this.gcTimer !== null) { clearTimeout(this.gcTimer); this.gcTimer = null }
    if (this.staleTimer !== null) { clearTimeout(this.staleTimer); this.staleTimer = null }
    this.store.destroy()
    this.onDispose(this.hash)
  }
}

export interface QueryFilters {
  /** Matches every query whose key starts with these elements. */
  queryKey?: QueryKey
  /** Require an exact key match rather than a prefix match. */
  exact?: boolean
}

/** A single cached query captured by `QueryClient.dehydrate()`. */
export interface DehydratedQuery {
  queryKey: QueryKey
  data: unknown
  dataUpdatedAt: number
}

/** JSON-serializable cache snapshot for server-side rendering. */
export interface DehydratedState {
  queries: DehydratedQuery[]
}

export interface QueryClientOptions {
  defaultOptions?: QueryOptions<unknown>
  /** Injectable clock, for deterministic tests. */
  now?: () => number
}

export interface QueryObserver<TData> {
  /** Live state store for this query — subscribe to it directly if you like. */
  readonly store: Store<QueryState<TData>>
  getState(): QueryState<TData>
  subscribe(listener: (state: QueryState<TData>) => void): Unsubscribe
  /** Force a fetch, ignoring freshness. */
  refetch(): Promise<TData>
  /** Stop observing. Releases the entry toward garbage collection. */
  destroy(): void
}

/**
 * Caches asynchronous results by key with stale-while-revalidate semantics:
 * cached data is served instantly while a background refetch runs, concurrent
 * requests for the same key are deduplicated into a single call, failures are
 * retried with exponential backoff, and unobserved entries are garbage
 * collected.
 *
 * @example
 * ```ts
 * const client = new QueryClient()
 * const observer = client.watch({
 *   queryKey: ['user', id],
 *   queryFn: ({ signal }) => fetch(`/api/users/${id}`, { signal }).then(r => r.json()),
 *   staleTime: 30_000,
 * })
 * observer.subscribe(s => render(s))
 * ```
 */
export class QueryClient {
  private entries = new Map<string, QueryEntry<unknown>>()
  private readonly defaults: QueryOptions<unknown>
  private readonly now: () => number
  private focusUnsub: Unsubscribe | null = null
  private onlineUnsub: Unsubscribe | null = null

  constructor(options?: QueryClientOptions) {
    this.defaults = options?.defaultOptions ?? {}
    this.now = options?.now ?? (() => Date.now())
    this.bindBrowserEvents()
  }

  private resolveOptions<TData>(options: QueryOptions<TData>): ResolvedOptions<TData> {
    const merged = { ...this.defaults, ...options } as QueryOptions<TData>
    return {
      ...merged,
      staleTime: merged.staleTime ?? 0,
      gcTime: merged.gcTime ?? 5 * 60_000,
      refetchOnWindowFocus: merged.refetchOnWindowFocus ?? true,
      refetchOnReconnect: merged.refetchOnReconnect ?? true,
      refetchInterval: merged.refetchInterval ?? 0,
      enabled: merged.enabled ?? true,
    }
  }

  private getOrCreate<TData>(
    key: QueryKey,
    options: ResolvedOptions<TData>
  ): QueryEntry<TData> {
    const hash = hashQueryKey(key)
    const existing = this.entries.get(hash)
    if (existing) return existing as unknown as QueryEntry<TData>
    const entry = new QueryEntry<TData>(key, hash, options, (h) => { this.entries.delete(h) }, this.now)
    this.entries.set(hash, entry as unknown as QueryEntry<unknown>)
    return entry
  }

  /**
   * Starts observing a query. Fetches immediately when the cached value is
   * missing or stale; otherwise serves the cache and revalidates in the
   * background.
   */
  watch<TData>(options: QueryObserverOptions<TData>): QueryObserver<TData> {
    const resolved = this.resolveOptions<TData>(options)
    const entry = this.getOrCreate<TData>(options.queryKey, resolved)
    entry.applyOptions(resolved, options.queryFn)

    const token = {}
    entry.addObserver(token)

    if (resolved.enabled && entry.isStale()) {
      void entry.fetch().catch(() => void 0)
    }

    let destroyed = false
    return {
      store: entry.store,
      getState: () => {
        const state = entry.store.read()
        if (state.data === undefined && resolved.placeholderData !== undefined) {
          const placeholder = typeof resolved.placeholderData === "function"
            ? (resolved.placeholderData as () => TData)()
            : resolved.placeholderData
          return { ...state, data: placeholder }
        }
        return state
      },
      subscribe: (listener) => entry.store.subscribe(s => s as unknown as QueryState<TData>, listener),
      refetch: () => entry.fetch(true),
      destroy: () => {
        if (destroyed) return
        destroyed = true
        entry.removeObserver(token)
      },
    }
  }

  /**
   * Resolves a query once: returns cached data when fresh, otherwise fetches.
   * Concurrent calls for the same key share a single request.
   */
  async fetchQuery<TData>(options: QueryObserverOptions<TData>): Promise<TData> {
    const resolved = this.resolveOptions<TData>(options)
    const entry = this.getOrCreate<TData>(options.queryKey, resolved)
    entry.applyOptions(resolved, options.queryFn)
    if (!entry.isStale()) return entry.store.read().data as TData
    return entry.fetch(true)
  }

  /** Warms the cache without subscribing. Never rejects. */
  async prefetchQuery<TData>(options: QueryObserverOptions<TData>): Promise<void> {
    try {
      await this.fetchQuery(options)
    } catch { void 0 }
  }

  /** Reads cached data for a key without triggering a fetch. */
  getQueryData<TData>(key: QueryKey): TData | undefined {
    const entry = this.entries.get(hashQueryKey(key))
    return entry ? (entry.store.read().data as TData | undefined) : undefined
  }

  /** Writes cached data directly — the basis of optimistic updates. */
  setQueryData<TData>(key: QueryKey, updater: TData | ((prev: TData | undefined) => TData)): TData {
    const resolved = this.resolveOptions<TData>({})
    const entry = this.getOrCreate<TData>(key, resolved)
    const prev = entry.store.read().data
    const next = typeof updater === "function"
      ? (updater as (p: TData | undefined) => TData)(prev)
      : updater
    entry.setData(next)
    return next
  }

  getQueryState<TData>(key: QueryKey): QueryState<TData> | undefined {
    const entry = this.entries.get(hashQueryKey(key))
    return entry ? (entry.store.read() as QueryState<TData>) : undefined
  }

  private matching(filters?: QueryFilters): QueryEntry<unknown>[] {
    const all = [...this.entries.values()]
    if (!filters?.queryKey) return all
    const filterKey = filters.queryKey
    if (filters.exact) {
      const hash = hashQueryKey(filterKey)
      return all.filter(e => e.hash === hash)
    }
    return all.filter(e => keyMatchesPrefix(e.key, filterKey))
  }

  /**
   * Marks matching queries stale and refetches those with active observers.
   * With no filter, invalidates everything.
   */
  async invalidateQueries(filters?: QueryFilters): Promise<void> {
    const targets = this.matching(filters)
    const refetches: Array<Promise<unknown>> = []
    for (const entry of targets) {
      entry.invalidate()
      if (entry.observerCount() > 0) {
        refetches.push(entry.fetch(true).catch(() => void 0))
      }
    }
    await Promise.all(refetches)
  }

  /** Aborts in-flight requests for matching queries. */
  cancelQueries(filters?: QueryFilters): void {
    for (const entry of this.matching(filters)) entry.cancel()
  }

  /** Drops matching entries from the cache entirely. */
  removeQueries(filters?: QueryFilters): void {
    for (const entry of this.matching(filters)) entry.dispose()
  }

  /** Refetches matching queries regardless of observers. */
  async refetchQueries(filters?: QueryFilters): Promise<void> {
    await Promise.all(this.matching(filters).map(e => e.fetch(true).catch(() => void 0)))
  }

  /** Number of cached entries — useful for asserting GC behaviour in tests. */
  size(): number {
    return this.entries.size
  }

  /**
   * Snapshots every successfully-resolved query into a JSON-serializable
   * payload for server-side rendering.
   *
   * Fetch on the server, embed the result in the HTML, and `hydrate` it on the
   * client so the first paint has data and no refetch waterfall occurs.
   *
   * @example
   * ```ts
   * // server
   * const client = new QueryClient()
   * await client.prefetchQuery({ queryKey: ['user', id], queryFn })
   * const state = client.dehydrate()
   * // → embed JSON.stringify(state) in the response
   *
   * // client
   * const client = new QueryClient()
   * client.hydrate(state)
   * ```
   */
  dehydrate(): DehydratedState {
    const queries: DehydratedQuery[] = []
    for (const entry of this.entries.values()) {
      const state = entry.store.read()
      if (state.status !== "success" || state.data === undefined) continue
      queries.push({
        queryKey: entry.key,
        data: state.data,
        dataUpdatedAt: state.dataUpdatedAt,
      })
    }
    return { queries }
  }

  /**
   * Restores queries produced by `dehydrate`.
   *
   * `dataUpdatedAt` is preserved, so `staleTime` is measured from when the
   * server actually fetched the data rather than from hydration time.
   */
  hydrate(state: DehydratedState): void {
    for (const query of state.queries) {
      const resolved = this.resolveOptions<unknown>({})
      const entry = this.getOrCreate<unknown>(query.queryKey, resolved)
      entry.setData(query.data, query.dataUpdatedAt)
    }
  }

  /**
   * Wires window `focus` and `online` events to revalidation. Skipped outside
   * the browser so the client works unchanged on the server.
   */
  private bindBrowserEvents() {
    const target = globalThis as unknown as {
      addEventListener?: (type: string, fn: () => void) => void
      removeEventListener?: (type: string, fn: () => void) => void
    }
    if (typeof target.addEventListener !== "function") return

    const onFocus = () => {
      for (const entry of this.entries.values()) {
        if (entry.getOptions().refetchOnWindowFocus && entry.observerCount() > 0 && entry.isStale()) {
          void entry.fetch(true).catch(() => void 0)
        }
      }
    }
    const onOnline = () => {
      for (const entry of this.entries.values()) {
        if (entry.getOptions().refetchOnReconnect && entry.observerCount() > 0 && entry.isStale()) {
          void entry.fetch(true).catch(() => void 0)
        }
      }
    }

    target.addEventListener("focus", onFocus)
    target.addEventListener("online", onOnline)
    this.focusUnsub = () => target.removeEventListener?.("focus", onFocus)
    this.onlineUnsub = () => target.removeEventListener?.("online", onOnline)
  }

  /** Tears down every entry and detaches global listeners. */
  clear(): void {
    for (const entry of [...this.entries.values()]) entry.dispose()
    this.entries.clear()
    this.focusUnsub?.()
    this.onlineUnsub?.()
    this.focusUnsub = null
    this.onlineUnsub = null
  }
}

// ── Mutations ───────────────────────────────────────────────────────────

export interface MutationState<TData, TVariables> {
  data: TData | undefined
  error: SafeError | undefined
  status: "idle" | "loading" | "success" | "error"
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  variables: TVariables | undefined
}

export interface MutationOptions<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>
  /**
   * Runs before the request. Return a context value (for example the previous
   * cache snapshot) and it is handed back to `onError` for rollback.
   */
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onError?: (error: SafeError, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onSettled?: (
    data: TData | undefined,
    error: SafeError | undefined,
    variables: TVariables,
    context: TContext | undefined
  ) => void | Promise<void>
  retry?: number
  retryDelay?: number | ((attempt: number) => number)
}

export interface Mutation<TData, TVariables> {
  readonly store: Store<MutationState<TData, TVariables>>
  getState(): MutationState<TData, TVariables>
  subscribe(listener: (state: MutationState<TData, TVariables>) => void): Unsubscribe
  mutate(variables: TVariables): Promise<TData>
  reset(): void
}

/**
 * Creates a mutation with built-in optimistic-update support.
 *
 * `onMutate` runs first and its return value is passed to `onError`, which is
 * the hook for rolling back an optimistic cache write when the request fails.
 *
 * @example
 * ```ts
 * const addTodo = createMutation({
 *   mutationFn: (text: string) => api.add(text),
 *   onMutate: (text) => {
 *     const prev = client.getQueryData<Todo[]>(['todos'])
 *     client.setQueryData(['todos'], (old: Todo[] = []) => [...old, { text }])
 *     return prev
 *   },
 *   onError: (_err, _text, prev) => client.setQueryData(['todos'], prev),
 *   onSettled: () => client.invalidateQueries({ queryKey: ['todos'] }),
 * })
 * ```
 */
export function createMutation<TData, TVariables = void, TContext = unknown>(
  options: MutationOptions<TData, TVariables, TContext>
): Mutation<TData, TVariables> {
  const store = createStore<MutationState<TData, TVariables>>({
    data: undefined,
    error: undefined,
    status: "idle",
    isLoading: false,
    isSuccess: false,
    isError: false,
    variables: undefined,
  })

  const retryDelay = (attempt: number): number => {
    const delay = options.retryDelay
    if (delay === undefined) return Math.min(1000 * 2 ** attempt, 30_000)
    return typeof delay === "function" ? delay(attempt) : delay
  }

  async function run(variables: TVariables): Promise<TData> {
    store.patch({
      status: "loading",
      isLoading: true,
      isSuccess: false,
      isError: false,
      error: undefined,
      variables,
    })

    let context: TContext | undefined
    try {
      context = await options.onMutate?.(variables)
    } catch (raw) {
      const error = toSafeError(raw)
      store.patch({ status: "error", isLoading: false, isError: true, error })
      throw error
    }

    const attempt = async (n: number): Promise<TData> => {
      try {
        return await options.mutationFn(variables)
      } catch (raw) {
        const error = toSafeError(raw)
        if (options.retry !== undefined && n < options.retry) {
          await new Promise(resolve => setTimeout(resolve, retryDelay(n)))
          return attempt(n + 1)
        }
        throw error
      }
    }

    try {
      const data = await attempt(0)
      store.patch({ data, status: "success", isLoading: false, isSuccess: true, isError: false })
      await options.onSuccess?.(data, variables, context)
      await options.onSettled?.(data, undefined, variables, context)
      return data
    } catch (raw) {
      const error = toSafeError(raw)
      store.patch({ error, status: "error", isLoading: false, isSuccess: false, isError: true })
      await options.onError?.(error, variables, context)
      await options.onSettled?.(undefined, error, variables, context)
      throw error
    }
  }

  return {
    store,
    getState: () => store.read(),
    subscribe: (listener) => store.subscribe(s => s as unknown as MutationState<TData, TVariables>, listener),
    mutate: run,
    reset: () => {
      store.set({
        data: undefined,
        error: undefined,
        status: "idle",
        isLoading: false,
        isSuccess: false,
        isError: false,
        variables: undefined,
      })
    },
  }
}
