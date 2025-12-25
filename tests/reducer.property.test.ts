import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { createStore } from "../src"

type CounterState = { count: number; label: string }

const addCount = (prev: Readonly<CounterState>, delta: number): CounterState => ({
  ...prev,
  count: prev.count + delta,
})

const setLabel = (prev: Readonly<CounterState>, label: string): CounterState => ({
  ...prev,
  label,
})

describe("reducers properties", () => {
  it("addCount preserves other fields and does not mutate prev", () => {
    fc.assert(
      fc.property(
        fc.record({ count: fc.integer(), label: fc.string() }),
        fc.integer(),
        (prev, delta) => {
          const prevCopy = { ...prev }
          const out = addCount(prev, delta)
          expect(out.count).toBe(prev.count + delta)
          expect(out.label).toBe(prev.label)
          expect(prev).toEqual(prevCopy)
        }
      )
    )
  })

  it("setLabel preserves count and does not mutate prev", () => {
    fc.assert(
      fc.property(
        fc.record({ count: fc.integer(), label: fc.string() }),
        fc.string(),
        (prev, label) => {
          const prevCopy = { ...prev }
          const out = setLabel(prev, label)
          expect(out.count).toBe(prev.count)
          expect(out.label).toBe(label)
          expect(prev).toEqual(prevCopy)
        }
      )
    )
  })

  it("deterministic: same inputs yield same outputs", () => {
    fc.assert(
      fc.property(
        fc.record({ count: fc.integer(), label: fc.string() }),
        fc.integer(),
        (prev, delta) => {
          const a = addCount(prev, delta)
          const b = addCount(prev, delta)
          expect(a).toEqual(b)
        }
      )
    )
  })
})

describe("store update sequence property", () => {
  it("sum of deltas equals final count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        (deltas) => {
          const store = createStore<CounterState>({ count: 0, label: "" })
          for (const d of deltas) {
            store.update(addCount, d)
          }
          const expected = deltas.reduce((a, b) => a + b, 0)
          expect(store.read().count).toBe(expected)
        }
      )
    )
  })
})

