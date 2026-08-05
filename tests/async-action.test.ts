import { describe, it, expect } from 'vitest'
import { createStore } from '../src/store'
import { asyncAction } from '../src/async-action'

describe('asyncAction', () => {
  it('should succeed and update store', async () => {
    const store = createStore({ loading: false, data: '' })
    const action = asyncAction(store, async (s, val: string) => {
      s.set(Object.assign({}, s.read(), { loading: true }))
      await new Promise(r => setTimeout(r, 10))
      return { loading: false, data: val }
    })

    const p = action('hello')
    expect(store.read().loading).toBe(true)
    await p
    expect(store.read()).toEqual({ loading: false, data: 'hello' })
  })

  it('should handle error with onError', async () => {
    const store = createStore({ loading: false, error: '' })
    const action = asyncAction(store, async (s) => {
      s.set(Object.assign({}, s.read(), { loading: true }))
      throw new Error('fail')
    }, {
      onError: (err) => ({ loading: false, error: err.message })
    })

    await expect(action()).rejects.toThrow('fail')
    expect(store.read()).toEqual({ loading: false, error: 'fail' })
  })

  it('should retry', async () => {
    const store = createStore({ count: 0 })
    let attempts = 0
    const action = asyncAction(store, async () => {
      attempts++
      if (attempts < 3) throw new Error('fail')
      return { count: attempts }
    }, {
      retry: 3,
      retryDelay: 5
    })

    await action()
    expect(attempts).toBe(3)
    expect(store.read()).toEqual({ count: 3 })
  })

  it('should abort', async () => {
    const store = createStore({ data: '' })
    const action = asyncAction(store, async () => {
      await new Promise(r => setTimeout(r, 50))
      return { data: 'done' }
    })

    const p = action()
    p.abort()
    
    // In our implementation, abortion doesn't necessarily reject the promise immediately if it's waiting
    // But it will return early without resolving. Wait a bit to ensure it doesn't update store.
    await new Promise(r => setTimeout(r, 100))
    expect(store.read()).toEqual({ data: '' })
  })
})
