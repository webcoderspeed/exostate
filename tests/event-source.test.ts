import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { createEventSource } from "../src/event-source"
import { DeepReadonly } from "../src/types"

type CartState = { items: string[]; total: number }

describe("event sourcing", () => {
  it("dispatches events and applies reducers", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)

    es.dispatch("ITEM_ADDED", "Widget", (prev: DeepReadonly<CartState>, payload: string) => ({
      items: [...prev.items, payload],
      total: prev.total + 1,
    }))

    expect(store.read().items).toEqual(["Widget"])
    expect(store.read().total).toBe(1)
    expect(es.size()).toBe(1)
  })

  it("records event metadata", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)

    es.dispatch("ITEM_ADDED", "A", (prev: DeepReadonly<CartState>, p: string) => ({
      items: [...prev.items, p],
      total: prev.total + 1,
    }))

    const events = es.events()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("ITEM_ADDED")
    expect(events[0].payload).toBe("A")
    expect(typeof events[0].timestamp).toBe("number")
    expect(events[0].version).toBeGreaterThan(0)
  })

  it("eventsSince filters by version", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)
    const addReducer = (prev: DeepReadonly<CartState>, p: string) => ({
      items: [...prev.items, p],
      total: prev.total + 1,
    })

    es.dispatch("ADD", "A", addReducer)
    const v1 = store.version
    es.dispatch("ADD", "B", addReducer)
    es.dispatch("ADD", "C", addReducer)

    const since = es.eventsSince(v1)
    expect(since).toHaveLength(2)
    expect(since[0].payload).toBe("B")
  })

  it("onEvent fires for each dispatch", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)
    const received: string[] = []

    es.onEvent(e => received.push(e.type))

    es.dispatch("A", null, (prev) => prev as CartState)
    es.dispatch("B", null, (prev) => prev as CartState)

    expect(received).toEqual(["A", "B"])
  })

  it("onEvent unsubscribe works", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)
    const received: string[] = []

    const unsub = es.onEvent(e => received.push(e.type))
    es.dispatch("A", null, (prev) => prev as CartState)
    unsub()
    es.dispatch("B", null, (prev) => prev as CartState)

    expect(received).toEqual(["A"])
  })

  it("clear empties the event log", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)

    es.dispatch("A", null, (prev) => prev as CartState)
    es.dispatch("B", null, (prev) => prev as CartState)
    expect(es.size()).toBe(2)

    es.clear()
    expect(es.size()).toBe(0)
    expect(es.events()).toHaveLength(0)
  })

  it("prunes events when exceeding maxEvents", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store, { maxEvents: 3 })

    for (let i = 0; i < 5; i++) {
      es.dispatch("E", i, (prev) => prev as CartState)
    }

    expect(es.size()).toBe(3)
    expect(es.events()[0].payload).toBe(2)
  })

  it("replay reconstructs state from events", () => {
    const store = createStore<CartState>({ items: [], total: 0 })
    const es = createEventSource(store)
    const addReducer = (prev: DeepReadonly<CartState>, p: string) => ({
      items: [...prev.items, p],
      total: prev.total + 1,
    })

    es.dispatch("ADD", "A", addReducer)
    es.dispatch("ADD", "B", addReducer)
    es.dispatch("ADD", "C", addReducer)

    // Mess up the state
    store.set({ items: [], total: 999 })
    expect(store.read().total).toBe(999)

    // Replay should reconstruct
    es.replay({ items: [], total: 0 })
    expect(store.read().items).toEqual(["A", "B", "C"])
    expect(store.read().total).toBe(3)
  })
})
