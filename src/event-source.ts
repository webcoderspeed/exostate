import { Store } from "./store.js"
import { DeepReadonly, Unsubscribe } from "./types.js"

/**
 * A recorded domain event with timestamp and version.
 */
export interface DomainEvent<TPayload = unknown> {
  readonly type: string
  readonly payload: TPayload
  readonly timestamp: number
  readonly version: number
}

/**
 * Options for configuring event sourcing on a store.
 */
export interface EventSourceOptions {
  /** Maximum number of events to retain. Oldest events are pruned. Default: 1000 */
  maxEvents?: number
}

/**
 * Event source controller attached to a store.
 */
export interface EventSource<T> {
  /** Dispatch a domain event and apply it via the reducer */
  dispatch<P>(type: string, payload: P, reducer: (prev: DeepReadonly<T>, payload: P) => T): T
  /** Get all recorded events */
  events(): ReadonlyArray<DomainEvent>
  /** Get events since a specific version */
  eventsSince(version: number): ReadonlyArray<DomainEvent>
  /** Number of recorded events */
  size(): number
  /** Clear all recorded events */
  clear(): void
  /** Subscribe to new events */
  onEvent(listener: (event: DomainEvent) => void): Unsubscribe
  /** Replay all events from scratch (requires initial state and store) */
  replay(initialState: T): T
}

/**
 * Creates an event sourcing controller for a store.
 * Records all state mutations as an append-only event log.
 *
 * @example
 * ```ts
 * const store = createStore({ items: [], total: 0 });
 * const es = createEventSource(store);
 *
 * es.dispatch('ITEM_ADDED', { name: 'Widget' }, (prev, payload) => ({
 *   items: [...prev.items, payload],
 *   total: prev.total + 1,
 * }));
 *
 * console.log(es.events()); // [{ type: 'ITEM_ADDED', payload: {...}, timestamp, version }]
 * ```
 */
export function createEventSource<T>(store: Store<T>, options?: EventSourceOptions): EventSource<T> {
  const maxEvents = options?.maxEvents ?? 1000
  const log: DomainEvent[] = []
  const eventListeners = new Set<(event: DomainEvent) => void>()
  const reducers = new Map<string, (prev: DeepReadonly<T>, payload: unknown) => T>()

  return {
    dispatch<P>(type: string, payload: P, reducer: (prev: DeepReadonly<T>, payload: P) => T): T {
      // Store reducer for replay
      if (!reducers.has(type)) {
        reducers.set(type, reducer as (prev: DeepReadonly<T>, payload: unknown) => T)
      }

      // Apply the update
      const result = store.update(reducer, payload)

      // Record the event
      const event: DomainEvent<P> = {
        type,
        payload,
        timestamp: Date.now(),
        version: store.version,
      }
      log.push(event)

      // Prune if over limit
      while (log.length > maxEvents) {
        log.shift()
      }

      // Notify event listeners
      for (const listener of eventListeners) {
        listener(event)
      }

      return result
    },

    events(): ReadonlyArray<DomainEvent> {
      return log
    },

    eventsSince(version: number): ReadonlyArray<DomainEvent> {
      return log.filter(e => e.version > version)
    },

    size(): number {
      return log.length
    },

    clear(): void {
      log.length = 0
    },

    onEvent(listener: (event: DomainEvent) => void): Unsubscribe {
      eventListeners.add(listener)
      return () => { eventListeners.delete(listener) }
    },

    replay(initialState: T): T {
      store.set(initialState)
      for (const event of log) {
        const reducer = reducers.get(event.type)
        if (reducer) {
          store.update(reducer, event.payload)
        }
      }
      return store.read()
    }
  }
}
