import { describe, it, expect } from 'vitest'
import { createStore, type StoreImpl } from "../src/store"

describe('Store.destroy()', () => {
  it('clears listeners and sets sentinel version', () => {
    const store = createStore({ count: 0 })
    store.subscribe(s => s.count, () => {})
    expect((store as unknown as StoreImpl<{ count: number }>).listeners.size).toBe(1)
    
    store.destroy()
    
    expect((store as unknown as StoreImpl<{ count: number }>).listeners.size).toBe(0)
    expect(store.version).toBe(-1)
  })

  it('throws on mutation methods when destroyed', () => {
    const store = createStore({ count: 0 })
    store.destroy()
    
    const err = 'Store is destroyed'
    
    expect(() => store.set({ count: 1 })).toThrowError(err)
    expect(() => store.update((s, p) => ({ count: s.count + p }), 1)).toThrowError(err)
    expect(() => store.compute(s => ({ count: s.count + 1 }))).toThrowError(err)
    expect(() => store.batch(apply => apply((s, p) => ({ count: s.count + p }), 1))).toThrowError(err)
    expect(() => store.patch({ count: 1 })).toThrowError(err)
  })

  it('throws on subscribe when destroyed', () => {
    const store = createStore({ count: 0 })
    store.destroy()
    expect(() => store.subscribe(s => s.count, () => {})).toThrowError('Store is destroyed')
  })

  it('allows read and snapshot after destruction', () => {
    const store = createStore({ count: 42 })
    store.destroy()
    
    expect(store.read()).toEqual({ count: 42 })
    expect(store.snapshot()).toEqual({ count: 42 })
  })
})
