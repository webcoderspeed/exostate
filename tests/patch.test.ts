import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store'

describe('Store.patch()', () => {
  it('merges object partial with current state', () => {
    const store = createStore({ count: 0, text: 'hello' })
    store.patch({ count: 5 })
    expect(store.read()).toEqual({ count: 5, text: 'hello' })
  })

  it('works with function partial', () => {
    const store = createStore({ count: 10, text: 'hello' })
    store.patch(prev => ({ count: prev.count + 5 }))
    expect(store.read()).toEqual({ count: 15, text: 'hello' })
  })

  it('increments version', () => {
    const store = createStore({ a: 1 })
    expect(store.version).toBe(0)
    store.patch({ a: 2 })
    expect(store.version).toBe(1)
  })

  it('notifies subscribers only when selected value changes', () => {
    const store = createStore({ a: 1, b: 2 })
    const subscriber = vi.fn()
    
    store.subscribe(state => state.a, subscriber)
    
    // Changing b shouldn't trigger subscriber for a
    store.patch({ b: 3 })
    expect(subscriber).not.toHaveBeenCalled()
    
    // Changing a should trigger subscriber
    store.patch({ a: 5 })
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith(5)
  })

  it('preserves unmentioned properties', () => {
    const store = createStore({ a: 1, b: { c: 2 }, d: [1, 2] })
    const originalB = store.read().b
    const originalD = store.read().d
    
    store.patch({ a: 10 })
    
    expect(store.read().b).toBe(originalB)
    expect(store.read().d).toBe(originalD)
  })
})
