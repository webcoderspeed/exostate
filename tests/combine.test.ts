import { describe, it, expect } from "vitest"
import { createStore, combineStores } from "../src"

type A = { a: number }
type B = { b: string }

describe("multi-store composition utilities", () => {
  it("combines read and notifies when any store changes", () => {
    const sa = createStore<A>({ a: 1 })
    const sb = createStore<B>({ b: "x" })
    const combined = combineStores({ sa, sb })
    expect(combined.read()).toEqual({ sa: { a: 1 }, sb: { b: "x" } })
    let calls = 0
    const unsub = combined.subscribe(() => { calls += 1 }, { fireImmediately: true })
    sa.update((p, d: number) => ({ a: p.a + d }), 1)
    sb.set({ b: "y" })
    expect(combined.read()).toEqual({ sa: { a: 2 }, sb: { b: "y" } })
    expect(calls).toBe(3)
    unsub()
  })
})

