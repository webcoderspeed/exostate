import { describe, it, expect, vi } from "vitest"
import { defineStore } from "../src/define-store.js"

interface CounterState {
  count: number
  increment: () => void
  reset: () => void
  setCount: (n: number) => void
}

describe("defineStore", () => {
  it("creates store with initial state and actions", () => {
    const store = defineStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ ...state, count: state.count + 1 })),
      reset: () => set({ count: 0 }),
      setCount: (n) => set({ count: n })
    }))

    expect(store.read().count).toBe(0)
  })

  it("actions can read and write state", () => {
    const store = defineStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ ...state, count: state.count + 1 })),
      reset: () => set({ count: 0 }),
      setCount: (n) => set({ count: n })
    }))

    store.read().increment()
    expect(store.read().count).toBe(1)

    store.read().increment()
    expect(store.read().count).toBe(2)

    store.read().reset()
    expect(store.read().count).toBe(0)

    store.read().setCount(5)
    expect(store.read().count).toBe(5)
  })

  it("subscribers fire when actions change state", () => {
    const store = defineStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ ...state, count: state.count + 1 })),
      reset: () => set({ count: 0 }),
      setCount: (n) => set({ count: n })
    }))

    const subscriber = vi.fn()
    store.subscribe((state) => state.count, subscriber)

    store.read().increment()
    expect(subscriber).toHaveBeenCalledWith(1)
  })

  it("get() returns current state inside actions", () => {
    interface GetState {
      val: string
      check: () => string
    }

    const store = defineStore<GetState>((set, get) => ({
      val: "initial",
      check: () => get().val
    }))

    expect(store.read().check()).toBe("initial")
    
    store.set({ ...store.read(), val: "changed" })
    
    expect(store.read().check()).toBe("changed")
  })
})
