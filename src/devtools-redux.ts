import { Store } from "./store.js"
import { Unsubscribe } from "./types.js"

/**
 * Interface matching the Redux DevTools browser extension API.
 * @see https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Methods.md
 */
export interface ReduxDevToolsExtension {
  connect(options?: { name?: string; features?: Record<string, unknown> }): ReduxDevToolsInstance
}

export interface ReduxDevToolsInstance {
  init(state: unknown): void
  send(action: { type: string; payload?: unknown }, state: unknown): void
  subscribe(listener: (message: { type: string; payload?: unknown; state?: string }) => void): (() => void)
  unsubscribe(): void
}

export interface ConnectReduxDevToolsOptions {
  name?: string
  enabled?: boolean
}

/**
 * Connects an Exostate store to the Redux DevTools browser extension.
 * Enables time-travel debugging, state inspection, and action logging.
 *
 * @example
 * ```ts
 * const store = createStore({ count: 0 });
 * const disconnect = connectReduxDevTools(store, { name: 'Counter' });
 * // Now visible in Redux DevTools!
 * ```
 */
export function connectReduxDevTools<T>(
  store: Store<T>,
  options?: ConnectReduxDevToolsOptions
): Unsubscribe {
  const enabled = options?.enabled ?? true
  if (!enabled) return () => {}

  // Access the Redux DevTools extension from window
  const devtoolsExtension = typeof globalThis !== "undefined"
    ? (globalThis as Record<string, unknown>)["__REDUX_DEVTOOLS_EXTENSION__"] as ReduxDevToolsExtension | undefined
    : undefined

  if (!devtoolsExtension) {
    return () => {}
  }

  const devtools = devtoolsExtension.connect({
    name: options?.name ?? "Exostate Store",
    features: {
      jump: true,
      skip: false,
      reorder: false,
      dispatch: true,
      persist: false,
    }
  })

  // Send initial state
  devtools.init(store.read())

  // Subscribe to state changes and send to devtools
  let lastVersion = store.version
  const unsubStore = store.subscribe(
    (s) => s as unknown as T,
    (next) => {
      const currentVersion = store.version
      if (currentVersion !== lastVersion) {
        devtools.send(
          { type: `update (v${currentVersion})` },
          next
        )
        lastVersion = currentVersion
      }
    }
  )

  // Listen for time-travel from devtools
  const unsubDevtools = devtools.subscribe((message) => {
    if (message.type === "DISPATCH") {
      const payload = message.payload as { type?: string } | undefined
      if (payload?.type === "JUMP_TO_STATE" || payload?.type === "JUMP_TO_ACTION") {
        if (message.state) {
          try {
            const parsed = JSON.parse(message.state) as T
            store.set(parsed)
          } catch {
            // Invalid state from devtools, ignore
          }
        }
      }
    }
  })

  return () => {
    unsubStore()
    unsubDevtools?.()
    devtools.unsubscribe()
  }
}
