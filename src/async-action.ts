import { Store } from './store.js'
import { SafeError, toSafeError } from './errors.js'

export interface AsyncActionOptions<T> {
  /** Merged into the store before the action runs — the place to set a loading flag. */
  onStart?: () => Partial<T>
  /** Merged into the store when the action ultimately fails. */
  onError?: (error: SafeError) => Partial<T>
  /** Number of additional attempts after the first failure. */
  retry?: number
  /** Fixed delay in ms, or a function of the zero-based attempt number. */
  retryDelay?: number | ((attempt: number) => number)
  /**
   * When true (the default), a result is discarded if a newer invocation of the
   * same action has started since. Without this, two in-flight calls commit in
   * completion order, so a slow early request can overwrite a fast later one.
   */
  latestOnly?: boolean
}

export interface AsyncActionHandle {
  abort(): void
}

export function asyncAction<T, P extends unknown[]>(
  store: Store<T>,
  fn: (store: Store<T>, ...args: P) => Promise<Partial<T>>,
  options?: AsyncActionOptions<T>
): (...args: P) => Promise<T> & AsyncActionHandle {
  const latestOnly = options?.latestOnly ?? true
  let invocationCounter = 0

  const action = (...args: P) => {
    // One controller per invocation. Sharing a single controller across calls
    // means `promise.abort()` on one call cancels whichever call ran last.
    const controller = new AbortController()
    const invocation = ++invocationCounter

    const isStale = () =>
      controller.signal.aborted || (latestOnly && invocation !== invocationCounter)

    if (options?.onStart) {
      store.set(Object.assign({}, store.read(), options.onStart()))
    }

    const execute = async (attempt: number): Promise<T> => {
      try {
        const result = await fn(store, ...args)
        if (isStale()) return store.read()
        store.set(Object.assign({}, store.read(), result))
        return store.read()
      } catch (e) {
        if (isStale()) return store.read()

        const safeError = toSafeError(e)

        if (options?.retry && attempt < options.retry) {
          if (options.retryDelay !== undefined) {
            const delay = typeof options.retryDelay === 'function'
              ? options.retryDelay(attempt)
              : options.retryDelay
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          if (isStale()) return store.read()
          return execute(attempt + 1)
        }

        if (options?.onError) {
          store.set(Object.assign({}, store.read(), options.onError(safeError)))
        }
        throw safeError
      }
    }

    const promise = execute(0) as Promise<T> & AsyncActionHandle
    promise.abort = () => { controller.abort() }
    return promise
  }

  return action
}
