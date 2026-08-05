import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import {
  QueryClient,
  type QueryKey,
  type QueryObserver,
  type QueryObserverOptions,
  type QueryState,
  type Mutation,
  type MutationOptions,
  type MutationState,
  createMutation,
  hashQueryKey,
} from "../query.js"

const QueryClientContext = createContext<QueryClient | null>(null)

export interface QueryClientProviderProps {
  client: QueryClient
  children?: ReactNode
}

export function QueryClientProvider({ client, children }: QueryClientProviderProps) {
  return createElement(QueryClientContext.Provider, { value: client }, children)
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext)
  if (!client) {
    throw new Error("No QueryClient found. Wrap your app in <QueryClientProvider client={...}>.")
  }
  return client
}

export interface UseQueryResult<TData> extends QueryState<TData> {
  refetch: () => Promise<TData>
}

/**
 * Subscribes a component to a cached query.
 *
 * The observer is rebuilt only when the serialized query key changes, so
 * inline `queryFn` closures and options objects do not cause resubscribe
 * churn on every render.
 */
export function useQuery<TData>(options: QueryObserverOptions<TData>): UseQueryResult<TData> {
  const client = useQueryClient()
  const keyHash = hashQueryKey(options.queryKey)

  // Latest-ref: the observer reads the current queryFn/options at fetch time
  // rather than capturing the first render's closure.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const observerRef = useRef<{ hash: string; observer: QueryObserver<TData> } | null>(null)
  if (!observerRef.current || observerRef.current.hash !== keyHash) {
    observerRef.current?.observer.destroy()
    observerRef.current = {
      hash: keyHash,
      observer: client.watch<TData>({
        ...options,
        queryFn: (ctx) => optionsRef.current.queryFn(ctx),
      }),
    }
  }
  const observer = observerRef.current.observer

  useEffect(() => {
    return () => {
      // Only tear down the observer this effect owns; a key change already
      // replaced and destroyed the previous one during render.
      if (observerRef.current?.observer === observer) {
        observer.destroy()
        observerRef.current = null
      }
    }
  }, [observer])

  const subscribe = useCallback(
    (onChange: () => void) => observer.subscribe(() => onChange()),
    [observer]
  )
  const getSnapshot = useCallback(() => observer.store.read(), [observer])
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const state = observer.getState()
  const refetch = useCallback(() => observer.refetch(), [observer])
  return { ...state, refetch }
}

export interface UseMutationResult<TData, TVariables> extends MutationState<TData, TVariables> {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  reset: () => void
}

/**
 * Runs a mutation and tracks its loading/success/error state.
 *
 * `mutate` fires and forgets (rejections are swallowed so an unhandled promise
 * never escapes into the console); `mutateAsync` returns the promise for
 * callers that want to await or catch it.
 */
export function useMutation<TData, TVariables = void, TContext = unknown>(
  options: MutationOptions<TData, TVariables, TContext>
): UseMutationResult<TData, TVariables> {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [mutation] = useState<Mutation<TData, TVariables>>(() =>
    createMutation<TData, TVariables, TContext>({
      mutationFn: (vars) => optionsRef.current.mutationFn(vars),
      onMutate: (vars) => optionsRef.current.onMutate?.(vars) as TContext,
      onSuccess: (data, vars, ctx) => optionsRef.current.onSuccess?.(data, vars, ctx),
      onError: (error, vars, ctx) => optionsRef.current.onError?.(error, vars, ctx),
      onSettled: (data, error, vars, ctx) => optionsRef.current.onSettled?.(data, error, vars, ctx),
      get retry() { return optionsRef.current.retry },
      get retryDelay() { return optionsRef.current.retryDelay },
    })
  )

  const subscribe = useCallback(
    (onChange: () => void) => mutation.subscribe(() => onChange()),
    [mutation]
  )
  const getSnapshot = useCallback(() => mutation.store.read(), [mutation])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const mutateAsync = useCallback((variables: TVariables) => mutation.mutate(variables), [mutation])
  const mutate = useCallback(
    (variables: TVariables) => { void mutation.mutate(variables).catch(() => void 0) },
    [mutation]
  )
  const reset = useCallback(() => mutation.reset(), [mutation])

  return { ...state, mutate, mutateAsync, reset }
}

/** Convenience wrapper around `client.invalidateQueries`. */
export function useInvalidateQueries(): (queryKey?: QueryKey) => Promise<void> {
  const client = useQueryClient()
  return useCallback(
    (queryKey?: QueryKey) => client.invalidateQueries(queryKey ? { queryKey } : undefined),
    [client]
  )
}
