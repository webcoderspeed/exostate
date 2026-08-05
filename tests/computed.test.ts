import { describe, it, expect, vi } from "vitest"
import { createStore } from "../src/store.js"
import { computed } from "../src/computed.js"

describe("computed", () => {
  it("caches value when read multiple times without store change", () => {
    const store = createStore({ a: 1, b: 2 })
    const selector = vi.fn((state: { a: number, b: number }) => state.a + state.b)
    const derived = computed(store, selector)

    expect(derived.read()).toBe(3)
    expect(derived.read()).toBe(3)
    expect(selector).toHaveBeenCalledTimes(1)
  })

  it("recomputes when store changes", () => {
    const store = createStore({ a: 1, b: 2 })
    const selector = vi.fn((state: { a: number, b: number }) => state.a + state.b)
    const derived = computed(store, selector)

    expect(derived.read()).toBe(3)

    store.set({ a: 2, b: 2 })
    
    expect(derived.read()).toBe(4)
    expect(selector).toHaveBeenCalledTimes(2)
  })

  it("subscribe works and fires on changes", () => {
    const store = createStore({ a: 1, b: 2 })
    const derived = computed(store, state => state.a)
    
    const subscriber = vi.fn()
    const unsubscribe = derived.subscribe(subscriber)
    
    store.set({ a: 2, b: 2 })
    expect(subscriber).toHaveBeenCalledWith(2)
    
    unsubscribe()
    store.set({ a: 3, b: 2 })
    expect(subscriber).toHaveBeenCalledTimes(1) // Doesn't fire after unsubscribe
  })
})
