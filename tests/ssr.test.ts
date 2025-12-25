import { describe, it, expect } from "vitest"
import { createStore, dehydrate, rehydrate, createSerializer } from "../src"

type S = { count: number; label: string }

describe("SSR hydration helpers", () => {
  it("dehydrates as JSON and rehydrates to same state", () => {
    const store = createStore<S>({ count: 2, label: "a" })
    const raw = dehydrate(store)
    const next = createStore<S>({ count: 0, label: "" })
    rehydrate(next, raw)
    expect(next.read()).toEqual({ count: 2, label: "a" })
  })

  it("supports serializer with migrations", () => {
    const isV2 = (x: unknown): x is S =>
      typeof x === "object" && x !== null &&
      typeof (x as Record<string, unknown>)["count"] === "number" &&
      typeof (x as Record<string, unknown>)["label"] === "string"
    const s = createSerializer<S>(2, {
      validate: isV2,
      migrations: {
        1: (input: unknown) => {
          const cnt = (input as Record<string, unknown>)["count"]
          return { count: cnt as number, label: "" }
        }
      }
    })
    const legacy = JSON.stringify({ v: 1, data: { count: 9 } })
    const store = createStore<S>({ count: 0, label: "" })
    rehydrate(store, legacy, s)
    expect(store.read()).toEqual({ count: 9, label: "" })
    store.set({ count: 10, label: "x" })
    const raw = dehydrate(store, s)
    const next = createStore<S>({ count: 0, label: "" })
    rehydrate(next, raw, s)
    expect(next.read()).toEqual({ count: 10, label: "x" })
  })
})

