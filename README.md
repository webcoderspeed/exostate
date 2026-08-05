# exostate

<p align="center">
  <strong>State management and async data fetching in one 1.2 kB package.</strong><br/>
  Stale-while-revalidate cache &middot; Request deduplication &middot; Optimistic updates &middot; SSR hydration<br/>
  React &middot; Vue &middot; Svelte &middot; Solid &middot; Vanilla JS &middot; Node.js
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/exostate"><img src="https://img.shields.io/npm/v/exostate" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/exostate"><img src="https://img.shields.io/npm/dm/exostate" alt="npm downloads"/></a>
  <a href="https://bundlephobia.com/package/exostate"><img src="https://img.shields.io/bundlephobia/minzip/exostate" alt="bundle size"/></a>
  <a href="https://github.com/webcoderspeed/exostate/actions/workflows/ci.yml"><img src="https://github.com/webcoderspeed/exostate/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT"/></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0%2B-blue" alt="TypeScript"/></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies"/>
</p>

<p align="center">
  <a href="https://github.com/webcoderspeed/exostate">GitHub</a> &middot;
  <a href="https://www.npmjs.com/package/exostate">npm</a> &middot;
  <a href="https://github.com/webcoderspeed/exostate/issues">Issues</a> &middot;
  <a href="https://github.com/webcoderspeed/exostate/discussions">Discussions</a>
</p>

---

## The two-library problem

Every serious frontend app installs two state libraries and glues them together:

```bash
# Client state
npm install zustand

# Server state
npm install @tanstack/react-query

# ...then discover they don't share a cache
# ...then write the bridge code yourself
# ...then repeat all of it for your Vue admin panel
```

Exostate is one package, one mental model, every framework:

```bash
npm install exostate
```

```typescript
import { createStore, QueryClient } from 'exostate'

// Client state — synchronous, immutable, type-safe
const ui = createStore({ theme: 'dark', sidebarOpen: false })
ui.patch({ sidebarOpen: true })

// Server state — cached, deduplicated, revalidated
const client = new QueryClient()
const user = await client.fetchQuery({
  queryKey: ['user', 42],
  queryFn: ({ signal }) => fetch('/api/users/42', { signal }).then(r => r.json()),
  staleTime: 30_000,
})
```

Same store primitive underneath. Same subscription model. Works in React, Vue,
Svelte, Solid, and plain JavaScript — including on the server.

---

## Table of Contents

- [Why Exostate](#why-exostate)
- [Feature comparison](#feature-comparison)
- [Bundle size](#bundle-size)
- [Performance](#performance)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
  - [Creating a store](#creating-a-store)
  - [Updating state](#updating-state)
  - [Subscribing and selectors](#subscribing-and-selectors)
  - [Computed values](#computed-values)
  - [Combining stores](#combining-stores)
  - [Microtask batching](#microtask-batching)
  - [Lifecycle hooks (lazy stores)](#lifecycle-hooks-lazy-stores)
  - [Destroying a store](#destroying-a-store)
- [The query layer](#the-query-layer)
  - [Stale-while-revalidate](#stale-while-revalidate)
  - [Request deduplication](#request-deduplication)
  - [Retries and backoff](#retries-and-backoff)
  - [Invalidation](#invalidation)
  - [Mutations and optimistic updates](#mutations-and-optimistic-updates)
  - [Garbage collection](#garbage-collection)
  - [Server-side rendering](#server-side-rendering)
- [Framework adapters](#framework-adapters)
  - [React](#react)
  - [Vue](#vue)
  - [Svelte](#svelte)
  - [Solid](#solid)
  - [Vanilla JavaScript](#vanilla-javascript)
- [Advanced features](#advanced-features)
  - [Plugins](#plugins)
  - [Middleware](#middleware)
  - [Transactions](#transactions)
  - [History and time travel](#history-and-time-travel)
  - [Persistence](#persistence)
  - [Event sourcing](#event-sourcing)
  - [Store factories](#store-factories)
  - [Redux DevTools](#redux-devtools)
  - [Schema validation](#schema-validation)
  - [Versioned serialization](#versioned-serialization)
- [Recipes](#recipes)
- [API reference](#api-reference)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Why Exostate

**One package instead of two.** Client state and server state use the same
store, the same subscription model, and the same types. No bridge code.

**Genuinely framework-agnostic.** The core has zero framework imports. The
React, Vue, Svelte, and Solid adapters are thin — under 1 kB each — and every
feature works in plain JavaScript and on Node.

**Zero runtime dependencies.** Nothing is pulled into your lockfile.

**Tree-shakeable by design.** Importing `createStore` costs 1.16 kB gzipped.
The query layer only ships if you import it.

**Immutable and type-safe.** State is `DeepReadonly` at the type level;
mutating methods return new values. No proxies, no magic, no `any`.

**Browser-safe core.** Node-only code lives in `exostate/node`, so the main
entry never drags `node:fs` into a browser bundle. CI enforces this.

---

## Feature comparison

| Feature | Exostate | Zustand | Jotai | Nanostores | Redux Toolkit | TanStack Query |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Client state | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Async query cache | ✅ | ❌ | partial | ❌ | RTK Query | ✅ |
| Stale-while-revalidate | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Request deduplication | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Optimistic updates + rollback | ✅ | manual | manual | manual | ✅ | ✅ |
| Cache garbage collection | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| SSR dehydrate / hydrate | ✅ | manual | manual | manual | ✅ | ✅ |
| React adapter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vue adapter | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Svelte adapter | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Solid adapter | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Vanilla JS | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Transactions with rollback | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Undo / redo history | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Event sourcing / audit log | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Plugin system | ✅ | middleware | ❌ | ❌ | middleware | ❌ |
| Lazy mount/unmount lifecycle | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Microtask batching | ✅ | ❌ | ✅ | ❌ | ❌ | n/a |
| IndexedDB persistence | ✅ | plugin | plugin | plugin | plugin | ❌ |
| Redux DevTools | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Runtime dependencies | **0** | 0 | 0 | 0 | 3+ | 0 |

<sub>Comparison reflects each library's core package without third-party plugins,
as of August 2026. "manual" means achievable but not provided.</sub>

---

## Bundle size

Measured with `size-limit` on real esbuild-bundled, minified, gzipped output —
not on the un-bundled barrel file. Reproduce with `npm run size`.

| What you import | Gzipped |
| --- | ---: |
| `createStore` only | **1.16 kB** |
| `createStore` + `computed` + `persistLocal` + `createHistory` | 1.92 kB |
| Query layer (`QueryClient` + `createMutation`) | 3.84 kB |
| React adapter (all hooks) | 913 B |
| React query hooks | 2.37 kB |
| Entire library, nothing tree-shaken | 7.72 kB |

Because the package is side-effect free and every feature is a separate export,
you only pay for what you import — a counter store costs 1.16 kB whether or not
the query layer exists in the package.

---

## Performance

Run on Node 20, 100,000 iterations. Reproduce with `npm run bench:compare`.
These are micro-benchmarks — in real apps, render behaviour dominates.

**Updates, no subscribers**

| Library | Operation | Ops/sec |
| --- | --- | ---: |
| Exostate | `patch` / assign | **19,833,891** |
| Zustand | `setState` | 14,755,883 |
| Exostate | `update(reducer)` | 7,648,695 |
| Redux | `dispatch` | 5,273,404 |

**Updates with one subscriber**

| Library | Operation | Ops/sec |
| --- | --- | ---: |
| Exostate | `patch` / assign | **16,114,630** |
| Zustand | `setState` | 14,683,389 |
| Exostate | `update(reducer)` | 6,941,873 |
| Redux | `dispatch` | 4,982,034 |

Read honestly: Exostate's shallow-merge path is the fastest of the four, and
its reducer path beats Redux but trails Zustand's `setState` — reducers do
strictly more work. Pick `patch` for hot paths and `update` when you want the
reducer discipline.

---

## Installation

```bash
npm install exostate
# or
pnpm add exostate
# or
yarn add exostate
# or
bun add exostate
```

Framework packages are **optional peer dependencies** — install only what you use.

| Entry point | Import from | Requires |
| --- | --- | --- |
| Core (framework-agnostic) | `exostate` | — |
| React hooks | `exostate/react` | `react >= 18` |
| React query hooks | `exostate/react/query` | `react >= 18` |
| Vue composables | `exostate/vue` | `vue >= 3` |
| Svelte stores | `exostate/svelte` | `svelte >= 4` |
| Solid signals | `exostate/solid` | `solid-js >= 1` |
| Filesystem persistence | `exostate/node` | Node >= 18 |

Requires TypeScript 5.0+ for the bundled types. Node 18+ for the runtime.

---

## Quick start

```typescript
import { createStore } from 'exostate'

interface CartState {
  items: Array<{ id: string; qty: number }>
  coupon: string | null
}

const cart = createStore<CartState>({ items: [], coupon: null })

// Read
cart.read()          // CartState
cart.snapshot()      // DeepReadonly<CartState>

// Write — shallow merge, Zustand-style
cart.patch({ coupon: 'SUMMER25' })

// Write — functional
cart.patch(prev => ({ items: [...prev.items, { id: 'sku-1', qty: 1 }] }))

// Write — with a reducer, for logic you want named and testable
const addItem = (prev: CartState, item: { id: string; qty: number }) => ({
  ...prev,
  items: [...prev.items, item],
})
cart.update(addItem, { id: 'sku-2', qty: 3 })

// Subscribe to a slice — only fires when that slice changes
const unsubscribe = cart.subscribe(
  s => s.items.length,
  count => console.log('item count:', count)
)

unsubscribe()
```

---

## Core concepts

### Creating a store

```typescript
import { createStore } from 'exostate'

const store = createStore({ count: 0 })
```

With options:

```typescript
const store = createStore(
  { count: 0 },
  {
    notify: 'microtask',   // coalesce notifications — see below
    unmountDelay: 1000,    // grace period before onUnsubscribe fires
    plugins: [logger()],   // attach plugins at construction
    onSubscribe: (s, listenerCount) => { /* … */ },
    onUnsubscribe: (s, listenerCount) => { /* … */ },
  }
)
```

### Updating state

Every mutating method returns the new state and goes through a single commit
path, so plugins and batching can never be bypassed.

| Method | Use for |
| --- | --- |
| `patch(partial)` | Shallow-merge an object or `prev => partial` |
| `set(next)` | Replace the whole state |
| `update(reducer, payload)` | Named, testable transitions |
| `compute(fn)` | `prev => next` without a payload |
| `batch(apply)` | Several reducers, one notification |
| `effect(fn, payload)` | Read-only side effects |

```typescript
store.patch({ count: 5 })
store.patch(prev => ({ count: prev.count + 1 }))
store.set({ count: 0 })
store.update((prev, by: number) => ({ count: prev.count + by }), 10)
store.compute(prev => ({ count: prev.count * 2 }))

// One notification for the whole group
store.batch(apply => {
  apply((prev, by: number) => ({ count: prev.count + by }), 1)
  apply((prev, by: number) => ({ count: prev.count * by }), 3)
})
```

> `patch` performs a **shallow** merge. Nested objects are replaced, not merged
> — the same rule Zustand uses, chosen because it is predictable.

### Subscribing and selectors

```typescript
const unsubscribe = store.subscribe(
  s => s.user.name,          // selector — subscription is scoped to this
  name => console.log(name), // only called when the selected value changes
  { fireImmediately: true }  // optional: call once with the current value
)
```

Pass a custom comparator when the selector builds a new object each call:

```typescript
import { shallow, deepEqual } from 'exostate'

store.subscribe(
  s => ({ id: s.user.id, name: s.user.name }),
  user => render(user),
  { eq: shallow }
)
```

### Computed values

`computed` caches against the store's version counter, so the selector runs at
most once per state change no matter how often you read it.

```typescript
import { computed } from 'exostate'

const fullName = computed(userStore, s => `${s.firstName} ${s.lastName}`)

fullName.read()   // computes
fullName.read()   // cached — no recomputation
fullName.subscribe(name => console.log(name))
```

### Combining stores

```typescript
import { combineStores } from 'exostate'

const app = combineStores({ cart, user, ui })

app.read()  // { cart: CartState, user: UserState, ui: UiState }
app.subscribe(all => console.log(all.cart.items.length))
```

The combined view attaches to its children lazily and detaches when the last
subscriber leaves, so it never keeps idle stores alive.

### Microtask batching

Inspired by Valtio. With `notify: 'microtask'`, a burst of synchronous writes
produces exactly one notification:

```typescript
const store = createStore({ a: 0, b: 0, c: 0 }, { notify: 'microtask' })

store.subscribe(s => s, () => console.log('notified'))

store.patch({ a: 1 })
store.patch({ b: 2 })
store.patch({ c: 3 })
// → logs "notified" once, on the next microtask

store.flush() // or deliver it synchronously right now
```

### Lifecycle hooks (lazy stores)

Inspired by Nanostores. Open a resource when the first subscriber arrives and
release it when the last one leaves — so an unused store costs nothing:

```typescript
let socket: WebSocket | null = null

const messages = createStore<{ items: string[] }>(
  { items: [] },
  {
    // Debounce teardown so a route change or Suspense retry doesn't
    // tear down and immediately rebuild the connection.
    unmountDelay: 1000,

    onSubscribe: (store, listenerCount) => {
      if (listenerCount !== 1) return
      socket = new WebSocket('wss://example.com/feed')
      socket.onmessage = e => {
        store.set({ items: [...store.read().items, e.data as string] })
      }
    },

    onUnsubscribe: (_store, listenerCount) => {
      if (listenerCount !== 0) return
      socket?.close()
      socket = null
    },
  }
)
```

### Destroying a store

```typescript
store.destroy()
// Clears listeners, fires plugin onDestroy hooks, cancels pending
// notifications, and sets version to -1.

store.destroyed  // true
store.read()     // still works — reads never throw
store.set({ … }) // throws "Store is destroyed"
```

---

## The query layer

Everything TanStack Query is loved for, framework-agnostic and in the same
package as your client state.

```typescript
import { QueryClient } from 'exostate'

const client = new QueryClient()

const observer = client.watch({
  queryKey: ['user', userId],
  queryFn: ({ signal }) => fetch(`/api/users/${userId}`, { signal }).then(r => r.json()),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 3,
})

observer.subscribe(state => {
  // state.data, state.error, state.isLoading, state.isFetching,
  // state.isSuccess, state.isError, state.isStale, state.dataUpdatedAt
})

await observer.refetch()
observer.destroy()   // release the observer; entry becomes GC-eligible
```

`queryKey` is hashed structurally with sorted object keys, so
`['user', { id: 1, tab: 'a' }]` and `['user', { tab: 'a', id: 1 }]` are the
same cache entry.

### Stale-while-revalidate

Cached data is served instantly while a refetch runs in the background, so the
UI never blanks out:

```typescript
const observer = client.watch({ queryKey: ['posts'], queryFn: fetchPosts, staleTime: 60_000 })

// Once resolved and later stale:
observer.getState().data        // previous data, still on screen
observer.getState().isFetching  // true — refresh in flight
observer.getState().isLoading   // false — we have data to show
```

`isLoading` means "loading with nothing to show". `isFetching` means "a request
is in flight". Use `isLoading` for spinners and `isFetching` for subtle
refresh indicators.

### Request deduplication

Concurrent requests for the same key collapse into a single call:

```typescript
await Promise.all([
  client.fetchQuery({ queryKey: ['config'], queryFn }),
  client.fetchQuery({ queryKey: ['config'], queryFn }),
  client.fetchQuery({ queryKey: ['config'], queryFn }),
])
// queryFn ran exactly once
```

### Retries and backoff

```typescript
client.watch({
  queryKey: ['flaky'],
  queryFn,
  retry: 3,                                  // or (attempt, error) => boolean
  retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30_000), // the default
})
```

### Invalidation

```typescript
// Everything under the ['users', …] prefix
await client.invalidateQueries({ queryKey: ['users'] })

// Exactly one entry
await client.invalidateQueries({ queryKey: ['users', 7], exact: true })

// Everything
await client.invalidateQueries()
```

Invalidation marks entries stale and refetches those with active observers.
Unobserved entries refetch on next use.

Other cache controls:

```typescript
client.getQueryData(['users', 7])
client.setQueryData(['users', 7], user => ({ ...user, name: 'Ada' }))
client.getQueryState(['users', 7])
client.cancelQueries({ queryKey: ['users'] })
client.removeQueries({ queryKey: ['users'] })
await client.refetchQueries({ queryKey: ['users'] })
await client.prefetchQuery({ queryKey: ['users', 7], queryFn })
```

### Mutations and optimistic updates

`onMutate` runs before the request and its return value is handed to `onError`
— which is exactly what you need to roll back:

```typescript
import { createMutation } from 'exostate'

const addTodo = createMutation<Todo, string, Todo[] | undefined>({
  mutationFn: text => api.addTodo(text),

  onMutate: text => {
    const previous = client.getQueryData<Todo[]>(['todos'])
    client.setQueryData<Todo[]>(['todos'], old => [
      ...(old ?? []),
      { id: 'temp', text },
    ])
    return previous          // becomes the rollback context
  },

  onError: (_error, _text, previous) => {
    client.setQueryData(['todos'], previous ?? [])
  },

  onSettled: () => client.invalidateQueries({ queryKey: ['todos'] }),
})

await addTodo.mutate('Buy milk')
addTodo.getState()  // { data, error, status, isLoading, isSuccess, isError, variables }
```

### Garbage collection

When the last observer of a query leaves, its in-flight request is cancelled
and a `gcTime` countdown starts (default 5 minutes). If nobody observes it
again in that window, the entry is disposed and its memory released. Set
`gcTime: Infinity` to keep an entry forever.

### Server-side rendering

The query core has no `window` or `document` access — focus and reconnect
listeners are feature-detected — so it runs unchanged on the server.

```typescript
// ── Server ──
const client = new QueryClient()
await client.prefetchQuery({ queryKey: ['user', id], queryFn })
const dehydrated = client.dehydrate()   // JSON-serializable

res.send(`<script>window.__STATE__ = ${JSON.stringify(dehydrated)}</script>`)

// ── Client ──
const client = new QueryClient()
client.hydrate(window.__STATE__)
// Data is on screen immediately. staleTime is measured from the server's
// fetch time, so no refetch waterfall on first paint.
```

Plain store state has its own SSR pair:

```typescript
import { dehydrate, rehydrate } from 'exostate'

const json = dehydrate(store)   // server
rehydrate(store, json)          // client
```

---

## Framework adapters

### React

```tsx
import { createStore } from 'exostate'
import { useStore, useSelector, useStores } from 'exostate/react'

const counter = createStore({ count: 0, label: 'hits' })

function Counter() {
  const count = useSelector(counter, s => s.count)
  return <button onClick={() => counter.patch({ count: count + 1 })}>{count}</button>
}

function Whole() {
  const state = useStore(counter)          // whole store
  return <p>{state.label}: {state.count}</p>
}

function Multi() {
  const { counter: c, user } = useStores({ counter, user: userStore })
  return <p>{user.name} — {c.count}</p>
}
```

**Inline object selectors are safe.** The selector result is memoized against
the store version, so this does not trip React's
`getSnapshot should be cached to avoid an infinite loop` error:

```tsx
const { a, b } = useSelector(store, s => ({ a: s.a, b: s.b }))
```

Add `shallow` when you also want to skip re-renders for unrelated changes:

```tsx
import { shallow } from 'exostate'

const slice = useSelector(store, s => ({ a: s.a, b: s.b }), shallow)
```

Query hooks:

```tsx
import { QueryClient } from 'exostate'
import { QueryClientProvider, useQuery, useMutation } from 'exostate/react/query'

const client = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={client}>
      <Profile id="42" />
    </QueryClientProvider>
  )
}

function Profile({ id }: { id: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery<User>({
    queryKey: ['user', id],
    queryFn: ({ signal }) => fetch(`/api/users/${id}`, { signal }).then(r => r.json()),
    staleTime: 30_000,
  })

  if (isLoading) return <Spinner />
  if (isError) return <p>{error?.message}</p>
  return <h1 onClick={() => refetch()}>{data?.name}</h1>
}

function AddTodo() {
  const { mutate, isLoading } = useMutation<Todo, string>({
    mutationFn: text => api.addTodo(text),
    onSettled: () => client.invalidateQueries({ queryKey: ['todos'] }),
  })
  return <button disabled={isLoading} onClick={() => mutate('New')}>Add</button>
}
```

`mutate` fires and forgets; `mutateAsync` returns the promise.

### Vue

```vue
<script setup lang="ts">
import { createStore } from 'exostate'
import { useExostore, useExoselector } from 'exostate/vue'

const counter = createStore({ count: 0 })

const state = useExostore(counter)              // readonly ref to whole state
const count = useExoselector(counter, s => s.count)  // readonly ref to a slice
</script>

<template>
  <button @click="counter.patch({ count: count + 1 })">{{ count }}</button>
</template>
```

Uses `shallowRef` (state is already immutable, so deep reactivity would be
wasted work) and `onScopeDispose`, so it cleans up inside components *and*
standalone effect scopes.

### Svelte

```svelte
<script lang="ts">
  import { createStore } from 'exostate'
  import { exostore, exoselector } from 'exostate/svelte'

  const counter = createStore({ count: 0 })
  const state = exostore(counter)
  const count = exoselector(counter, s => s.count)
</script>

<button on:click={() => counter.patch({ count: $count + 1 })}>
  {$count}
</button>
```

Implements Svelte's readable-store contract, so `$store` auto-subscription
works and unsubscription is automatic.

### Solid

```tsx
import { createStore } from 'exostate'
import { useExostore, useExoselector } from 'exostate/solid'

const counter = createStore({ count: 0 })

function Counter() {
  const count = useExoselector(counter, s => s.count)
  return <button onClick={() => counter.patch({ count: count() + 1 })}>{count()}</button>
}
```

### Vanilla JavaScript

No build step, no framework, no adapter:

```html
<script type="module">
  import { createStore } from 'https://esm.sh/exostate'

  const store = createStore({ count: 0 })

  store.subscribe(
    s => s.count,
    count => { document.getElementById('out').textContent = count }
  )

  document.getElementById('inc').onclick = () =>
    store.patch(prev => ({ count: prev.count + 1 }))
</script>
```

The query layer works the same way — it is plain JavaScript with no framework
coupling.

---

## Advanced features

### Plugins

Plugins observe and can transform every commit:

```typescript
import { createStore, logger, freeze } from 'exostate'

const store = createStore({ count: 0 })

store.use(logger({ name: 'MyApp', collapsed: true }))
store.use(freeze())   // deep-freeze state in development to catch mutations

const detach = store.use({
  name: 'analytics',
  onInit: s => {
    const timer = setInterval(() => report(s.read()), 10_000)
    return () => clearInterval(timer)   // cleanup on detach
  },
  onBeforeUpdate: (prev, next) => {
    // Return a value to replace what gets committed
    return { ...next, count: Math.min(next.count, 100) }
  },
  onAfterUpdate: (prev, next) => track('state_changed', { prev, next }),
  onSubscribe: count => console.log('listeners:', count),
  onUnsubscribe: count => console.log('listeners:', count),
  onDestroy: () => flush(),
})

detach()
```

### Middleware

Operation-level instrumentation, including timings:

```typescript
import { withMiddleware } from 'exostate'

const instrumented = withMiddleware(store, [
  {
    before: (op, ctx) => console.log('→', op, ctx.version),
    after: (op, ctx) => console.log('←', op, `${ctx.durationMs}ms`),
  },
])
```

### Transactions

Stage several changes and commit or discard them atomically:

```typescript
import { beginTransaction } from 'exostate'

const tx = beginTransaction(store)
tx.apply(addItem, { id: 'a' })
tx.apply(applyDiscount, 0.2)
tx.read()      // staged value — the store is untouched so far

if (isValid(tx.read())) {
  tx.commit()  // one notification for the whole transaction
} else {
  tx.rollback()
}

tx.commit()    // throws — a transaction is sealed after commit or rollback
```

### History and time travel

```typescript
import { createHistory } from 'exostate'

const history = createHistory(store, { limit: 50 })
history.attach()

store.patch({ count: 1 })
store.patch({ count: 2 })

history.undo()          // back to { count: 1 }
history.redo()          // forward to { count: 2 }
history.jumpTo(0)       // straight to any recorded entry
history.canUndo()       // boolean
history.entries()       // recorded snapshots
history.clear()
history.detach()
```

### Persistence

```typescript
import { persistLocal, persistIndexedDB } from 'exostate'

// localStorage / sessionStorage / any StorageLike
const local = persistLocal(store, 'app-state', localStorage)
local.detach()

// IndexedDB — async, no 5 MB cap, survives Date/Map/Set round trips
const idb = await persistIndexedDB(store, {
  dbName: 'my-app',
  key: 'main',
  writeDebounceMs: 50,
})
idb.detach()   // flushes anything still queued
```

Filesystem persistence lives in the Node entry point:

```typescript
import { persistFs } from 'exostate/node'

const fsPersist = await persistFs(store, './state/app.json')
```

Writes are serialized through a single-slot queue, so a burst of updates
collapses to one pending write and can never tear the file.

### Event sourcing

An append-only log for audit trails and replay:

```typescript
import { createEventSource } from 'exostate'

const events = createEventSource(store, { maxEvents: 1000 })

events.dispatch('ITEM_ADDED', { id: 1, name: 'Widget' }, (prev, payload) => ({
  ...prev,
  items: [...prev.items, payload],
}))

events.events()            // [{ type, payload, timestamp, version }]
events.eventsSince(5)
events.onEvent(e => audit(e))
events.replay(initialState)
```

### Store factories

Isolated stores per widget, modal, or tenant:

```typescript
import { storeFactory, cachedStoreFactory } from 'exostate'

const createWidget = storeFactory((id: string) => ({ id, items: [] }))
const w1 = createWidget('w1')   // independent instances
const w2 = createWidget('w2')

// Same key returns the same instance
const userStores = cachedStoreFactory((userId: string) => ({ id: userId, name: '' }))
userStores.get('u1') === userStores.get('u1')   // true
userStores.delete('u1')
```

### Redux DevTools

```typescript
import { connectReduxDevTools } from 'exostate'

const disconnect = connectReduxDevTools(store, { name: 'My App' })
// Time travel from the extension writes back into the store.
```

### Schema validation

```typescript
import { z } from 'zod'
import { fromZod, fromPredicate } from 'exostate'

const schema = fromZod(z.object({ count: z.number() }))
const state = schema.parse(untrustedInput)

const isUser = (x: unknown): x is User => typeof x === 'object' && x !== null && 'id' in x
const userSchema = fromPredicate(isUser)
```

### Versioned serialization

Migrate persisted state across schema versions:

```typescript
import { createSerializer } from 'exostate'

const serializer = createSerializer<StateV3>(3, {
  validate: (x): x is StateV3 => typeof x === 'object' && x !== null,
  migrations: {
    1: (v1: any) => ({ ...v1, theme: 'light' }),  // v1 → v2
    2: (v2: any) => ({ ...v2, locale: 'en' }),    // v2 → v3
  },
})

persistLocal(store, 'app', localStorage, {
  encode: serializer.encode,
  decode: serializer.decode,
})
```

Decoding a payload from a *newer* version throws rather than silently
corrupting state.

---

## Recipes

**Error handling with typed errors**

```typescript
import { createError, toSafeError, isSafeError } from 'exostate'

const err = createError('NOT_FOUND', 'User does not exist', { id: 42 })
err.name    // 'SafeError'
err.code    // 'NOT_FOUND'
err.details // { id: 42 }

const safe = toSafeError(unknownThrowable, 'FETCH_FAILED')
```

**Async actions on a plain store** (when you want loading flags without the
full query cache)

```typescript
import { asyncAction } from 'exostate'

const load = asyncAction(
  userStore,
  async (_store, id: string) => ({ user: await api.getUser(id) }),
  {
    onStart: () => ({ loading: true, error: null }),
    onError: err => ({ loading: false, error: err.message }),
    retry: 3,
    retryDelay: attempt => 2 ** attempt * 100,
    latestOnly: true,   // default — a slow earlier call can't clobber a newer one
  }
)

const promise = load('user-42')
promise.abort()   // cancels only this invocation
```

**Co-locating actions with state**

```typescript
import { defineStore } from 'exostate'

const counter = defineStore((set, get) => ({
  count: 0,
  increment: () => set(s => ({ ...s, count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))

counter.read().increment()
```

---

## API reference

### Core

| Export | Description |
| --- | --- |
| `createStore(initial, options?)` | Create a store |
| `createState(initial)` | Immutable read-only state container |
| `defineStore(creator)` | Creator pattern with co-located actions |
| `storeFactory(init)` / `cachedStoreFactory(init)` | Scoped store instances |
| `combineStores(stores)` | Compose multiple stores into one view |
| `computed(store, selector)` | Version-cached derived value |
| `derive(store, selector)` | Uncached derived value |
| `shallow` / `deepEqual` | Comparators for selectors |

### Store methods

`read` · `snapshot` · `version` · `patch` · `set` · `update` · `compute` ·
`batch` · `effect` · `subscribe` · `use` · `plugins` · `flush` · `destroy` ·
`destroyed`

### Query

| Export | Description |
| --- | --- |
| `QueryClient` | Cache with SWR, dedup, retries, GC, SSR |
| `createMutation(options)` | Mutation with optimistic-update support |
| `hashQueryKey(key)` | Structural key hashing |

`QueryClient` methods: `watch` · `fetchQuery` · `prefetchQuery` ·
`getQueryData` · `setQueryData` · `getQueryState` · `invalidateQueries` ·
`refetchQueries` · `cancelQueries` · `removeQueries` · `dehydrate` ·
`hydrate` · `size` · `clear`

### Persistence, history, and integrity

`persistLocal` · `persistIndexedDB` · `persistFs` (from `exostate/node`) ·
`createHistory` · `beginTransaction` · `createEventSource` ·
`createSerializer` · `dehydrate` · `rehydrate`

### Plugins and observability

`withMiddleware` · `logger` · `freeze` · `registerPlugin` · `getPlugins` ·
`destroyPlugins` · `devtoolsMiddleware` · `connectReduxDevTools`

### Errors and validation

`SafeError` · `createError` · `isSafeError` · `toSafeError` · `applyPolicy` ·
`fromZod` · `fromPredicate`

---

## FAQ

**Does it work without React?**
Yes. The core has zero framework imports. Vue, Svelte, and Solid have first-class
adapters, and plain JavaScript needs no adapter at all.

**Does the query layer work on the server?**
Yes. There is no `window`/`document` access, and `dehydrate`/`hydrate` move the
cache across the server-client boundary with fetch timestamps preserved.

**Can I use it with Next.js / Nuxt / SvelteKit?**
Yes. Create the `QueryClient` per request on the server, prefetch, `dehydrate`,
then `hydrate` on the client.

**Is `patch` a deep merge?**
No — shallow, like Zustand. Nested objects are replaced. Shallow is predictable;
deep merging surprises people about arrays.

**Do I need `useShallow`-style wrappers in React?**
No. Inline object selectors are memoized against the store version, so they
cannot cause infinite loops. Pass `shallow` as the comparator when you also want
to skip re-renders for unrelated changes.

**Why is `version` `-1` after `destroy()`?**
It is a sentinel marking the store as destroyed. Reads still work; writes throw.

**Does it bring dependencies into my bundle?**
None. Exostate ships zero runtime dependencies; framework packages are optional
peers you already have.

**Can I migrate gradually from Zustand or TanStack Query?**
Yes. They are independent — adopt the query layer first, or the store first, and
run both side by side during the transition.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
project layout, design constraints, and the commit convention.

```bash
git clone https://github.com/webcoderspeed/exostate.git
cd exostate
npm install
npm run validate
```

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues
should be reported privately — see [SECURITY.md](SECURITY.md).

---

## License

[MIT](LICENSE) © [Sanjeev Sharma](https://github.com/webcoderspeed)
