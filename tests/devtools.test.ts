import { describe, it, expect } from "vitest"
import { createStore, withMiddleware, devtoolsMiddleware, createMemoryConnection } from "../src"

type S = { count: number; label: string }

describe("devtools adapter protocol", () => {
  it("records init and operations with version", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const { conn, inits, events } = createMemoryConnection()
    const wrapped = withMiddleware(store, [devtoolsMiddleware(conn, "counter")])
    wrapped.set({ count: 1, label: "b" })
    wrapped.update((p, d: number) => ({ ...p, count: p.count + d }), 2)
    wrapped.compute(p => ({ ...p, count: p.count * 2 }))
    expect(inits.length).toBe(1)
    expect(events.length).toBe(3)
    expect(events.map(e => e.op)).toEqual(["set", "update", "compute"])
    expect(events[0].meta?.version).toBe(1)
    expect(events[1].meta?.version).toBe(2)
    expect(events[2].meta?.version).toBe(3)
    expect(events[0].meta?.name).toBe("counter")
  })
})

