import { describe, it, expect } from "vitest"
import { createStore } from "../src"

type CounterState = { count: number; label: string }

describe("store basics", () => {
  it("read, set, version", () => {
    const store = createStore<CounterState>({ count: 0, label: "init" })
    expect(store.version).toBe(0)
    expect(store.read()).toEqual({ count: 0, label: "init" })
    store.set({ count: 1, label: "a" })
    expect(store.version).toBe(1)
    expect(store.read()).toEqual({ count: 1, label: "a" })
  })

  it("update with reducer and payload", () => {
    const store = createStore<CounterState>({ count: 0, label: "init" })
    const add = (prev: Readonly<CounterState>, delta: number): CounterState => ({
      ...prev,
      count: prev.count + delta,
    })
    store.update(add, 2)
    expect(store.read().count).toBe(2)
    expect(store.version).toBe(1)
  })
})

describe("subscribe and selector", () => {
  it("fires immediately when requested", () => {
    const store = createStore<CounterState>({ count: 0, label: "init" })
    const events: number[] = []
    store.subscribe(
      s => s.count,
      v => events.push(v),
      { fireImmediately: true }
    )
    expect(events).toEqual([0])
  })

  it("dedups by equality", () => {
    const store = createStore<CounterState>({ count: 0, label: "init" })
    const events: number[] = []
    store.subscribe(s => s.count, v => events.push(v))
    store.set({ count: 0, label: "x" }) // no change for selector
    store.set({ count: 1, label: "y" }) // change for selector
    store.set({ count: 1, label: "z" }) // no change for selector
    expect(events).toEqual([1])
  })
})

describe("compute and batch", () => {
  it("compute applies derived update", () => {
    const store = createStore<CounterState>({ count: 1, label: "init" })
    const out = store.compute(prev => ({ ...prev, count: prev.count * 2 }))
    expect(out.count).toBe(2)
    expect(store.version).toBe(1)
  })

  it("batch notifies once after multiple reducers", () => {
    const store = createStore<CounterState>({ count: 0, label: "init" })
    let notifications = 0
    store.subscribe(s => s.count, () => {
      notifications += 1
    })
    store.batch(apply => {
      apply((p, d: number) => ({ ...p, count: p.count + d }), 1)
      apply((p, d: number) => ({ ...p, count: p.count + d }), 2)
    })
    expect(store.read().count).toBe(3)
    expect(store.version).toBe(1)
    expect(notifications).toBe(1)
  })
})

