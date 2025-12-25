# Exostate Documentation

## Table of Contents
1. [Introduction & Philosophy](#introduction--philosophy)
2. [Getting Started](#getting-started)
3. [React Integration](#react-integration)
4. [Transactional State](#transactional-state)
5. [Middleware & Observability](#middleware--observability)
6. [Store Composition](#store-composition)
7. [Validation & Error Handling](#validation--error-handling)
8. [Server-Side Rendering (SSR)](#server-side-rendering-ssr)
9. [Comparison with Other Libraries](#comparison-with-other-libraries)
10. [API Reference](#api-reference)

## Introduction & Philosophy

Exostate is a next-generation state management library designed for **backend-grade reliability** in frontend applications. Our philosophy centers around three core principles:

### 1. **Strict Type Safety**
- Zero tolerance for `any` types
- Full TypeScript generics throughout
- Compile-time guarantees for runtime safety

### 2. **Transactional Integrity**
- Inspired by database transaction models
- Atomic commit/rollback semantics
- Consistent state guarantees during complex operations

### 3. **Universal Compatibility**
- Framework-agnostic core (works with React, Vue, Svelte, Vanilla JS)
- Server-side rendering ready
- Node.js and browser compatible

### Why Exostate?

Traditional state management libraries often prioritize simplicity over reliability. Exostate brings the rigor of backend systems to frontend state management:

- **For complex applications**: When your state logic involves multi-step operations, conditional updates, or error recovery
- **For mission-critical systems**: When data consistency and reliability are non-negotiable
- **For teams that value types**: When you want compile-time guarantees about your state transitions

## Getting Started

### Installation

```bash
npm install exostate
```

For React applications:
```bash
npm install exostate react react-dom
```

### Your First Store

```typescript
import { createStore } from 'exostate';

// Define your state interface
interface CounterState {
  count: number;
  loading: boolean;
}

// Create a store with initial state
const counterStore = createStore<CounterState>({
  count: 0,
  loading: false
});

// Read current state
console.log(counterStore.read()); // { count: 0, loading: false }

// Update state using a reducer
counterStore.update((state, increment: number) => ({
  ...state,
  count: state.count + increment
}), 5);

console.log(counterStore.read().count); // 5
```

### Basic Subscription

```typescript
// Subscribe to count changes
const unsubscribe = counterStore.subscribe(
  (state) => state.count,
  (count) => console.log('Count changed:', count)
);

// Later, unsubscribe
unsubscribe();
```

## React Integration

Exostate provides first-class React hooks through the `exostate/react` subpath.

### Basic Usage

```tsx
import { createStore } from 'exostate';
import { useStore, useSelector } from 'exostate/react';

const userStore = createStore({
  user: null,
  preferences: { theme: 'dark' }
});

function UserProfile() {
  // Access entire store state
  const state = useStore(userStore);
  
  // Or use selector for granular updates
  const theme = useSelector(userStore, state => state.preferences.theme);
  
  return (
    <div className={theme}>
      <h1>{state.user?.name}</h1>
    </div>
  );
}
```

### Multiple Stores with useStores

```tsx
import { useStores } from 'exostate/react';

function App() {
  const { auth, settings, notifications } = useStores({
    auth: authStore,
    settings: settingsStore,
    notifications: notificationsStore
  });
  
  return (
    <div className={settings.theme}>
      {auth.user ? <Dashboard /> : <Login />}
    </div>
  );
}
```

### Optimized Selectors

```tsx
function ExpensiveComponent() {
  // Only re-renders when specific user properties change
  const userName = useSelector(
    userStore,
    state => state.user?.name,
    (prev, next) => prev === next // Custom equality check
  );
  
  return <div>{userName}</div>;
}
```

## Transactional State

Exostate's transaction system provides atomic operations with rollback capabilities.

### Basic Transaction

```typescript
import { beginTransaction } from 'exostate';

const store = createStore({ balance: 100, transactions: [] });

function transferFunds(amount: number) {
  const tx = beginTransaction(store);
  
  try {
    // Multiple operations in transaction
    tx.update(state => ({ 
      balance: state.balance - amount,
      transactions: [...state.transactions, { amount, type: 'debit' }]
    }), undefined);
    
    // Additional business logic...
    
    // Commit if everything succeeds
    tx.commit();
    console.log('Transfer successful');
    
  } catch (error) {
    // Automatic rollback on error
    tx.rollback();
    console.log('Transfer failed, state restored');
  }
}
```

### Nested Transactions

```typescript
function complexOperation() {
  const outerTx = beginTransaction(store);
  
  try {
    // First operation
    outerTx.update(state => ({ ...state, step: 1 }), undefined);
    
    // Nested transaction for specific part
    const innerTx = beginTransaction(store);
    try {
      innerTx.update(state => ({ ...state, detail: 'nested' }), undefined);
      innerTx.commit();
    } catch {
      innerTx.rollback();
      throw new Error('Nested operation failed');
    }
    
    outerTx.commit();
  } catch {
    outerTx.rollback();
  }
}
```

## Middleware & Observability

Exostate's middleware system allows intercepting operations for logging, metrics, and side effects.

### Basic Middleware

```typescript
import { withMiddleware } from 'exostate';

const loggingMiddleware = {
  before: (operation, context) => {
    console.log(`Starting ${operation}`, {
      version: context.version,
      snapshot: context.snapshot,
      payload: context.payload
    });
  },
  
  after: (operation, context) => {
    console.log(`Completed ${operation} in ${context.durationMs}ms`, {
      version: context.version,
      snapshot: context.snapshot
    });
  }
};

const monitoredStore = withMiddleware(store, [loggingMiddleware]);
```

### Performance Monitoring

```typescript
const metricsMiddleware = {
  after: (operation, context) => {
    // Send metrics to monitoring service
    trackMetric({
      operation,
      duration: context.durationMs,
      stateSize: JSON.stringify(context.snapshot).length
    });
  }
};
```

### DevTools Integration

```typescript
import { devtoolsMiddleware, createMemoryConnection } from 'exostate';

const connection = createMemoryConnection();
const devToolsStore = withMiddleware(store, [
  devtoolsMiddleware(connection, 'my-app')
]);

// Connect to devtools UI
connection.connect(devToolsUI);
```

## Store Composition

Combine multiple stores into a unified state tree.

### Basic Composition

```typescript
import { combineStores } from 'exostate';

const authStore = createStore({ user: null, token: null });
const uiStore = createStore({ theme: 'dark', sidebarOpen: false });
const dataStore = createStore({ items: [], loading: false });

const rootStore = combineStores({
  auth: authStore,
  ui: uiStore,
  data: dataStore
});

// Access combined state
const state = rootStore.read();
console.log(state.auth.user, state.ui.theme, state.data.items);
```

### React Composition

```tsx
import { useStores } from 'exostate/react';

function AppLayout() {
  const { auth, ui, data } = useStores({
    auth: authStore,
    ui: uiStore,
    data: dataStore
  });
  
  return (
    <div className={ui.theme}>
      <Sidebar open={ui.sidebarOpen} />
      <MainContent user={auth.user} items={data.items} />
    </div>
  );
}
```

### Selective Subscription

```typescript
// Only subscribe to auth changes
rootStore.subscribe(
  state => state.auth,
  authState => console.log('Auth changed:', authState)
);
```

## Validation & Error Handling

### Schema Validation with Zod

```typescript
import { z } from 'zod';
import { fromZod } from 'exostate';

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest'])
});

const userValidator = fromZod(UserSchema);

// Validate state updates
function updateUser(newUser: unknown) {
  if (userValidator.validate(newUser)) {
    userStore.set(newUser);
  } else {
    throw new Error('Invalid user data');
  }
}
```

### Safe Error Handling

```typescript
import { createError, isSafeError, toSafeError } from 'exostate';

// Create typed errors
const AppError = createError('app_error', 'Application error');
const ValidationError = createError('validation_error', 'Validation failed');

// Error handling in transactions
try {
  const tx = beginTransaction(store);
  // ... operations
  tx.commit();
} catch (error) {
  if (isSafeError(error)) {
    console.log(`Error ${error.code}: ${error.message}`);
  } else {
    // Convert to safe error
    const safeError = toSafeError(error, 'unknown_error');
    console.log('Unknown error:', safeError.message);
  }
}
```

### Error Recovery Policies

```typescript
const errorPolicy = {
  map: (code: string, error: SafeError) => {
    switch (code) {
      case 'network_error':
        return createError('retry_later', 'Please try again later');
      case 'validation_error':
        return createError('invalid_input', 'Please check your input');
      default:
        return error;
    }
  }
};

// Apply policy to errors
const userFriendlyError = applyPolicy(rawError, errorPolicy);
```

## Server-Side Rendering (SSR)

### Dehydration/Rehydration

```typescript
// Server-side
import { dehydrate } from 'exostate';

function renderApp() {
  const store = createStore(initialState);
  // ... populate store
  
  const html = renderToString(<App store={store} />);
  const serializedState = dehydrate(store);
  
  return {
    html,
    state: serializedState
  };
}
```

```typescript
// Client-side
import { rehydrate } from 'exostate';

function hydrateApp() {
  const store = createStore(initialState);
  
  // Rehydrate from server state
  if (window.__INITIAL_STATE__) {
    rehydrate(store, window.__INITIAL_STATE__);
  }
  
  ReactDOM.hydrate(<App store={store} />, container);
}
```

### Custom Serialization

```typescript
import { createSerializer } from 'exostate';

const customSerializer = createSerializer(2, {
  validate: (x): x is AppState => 
    typeof x?.version === 'number' && Array.isArray(x?.items),
  
  migrations: {
    1: (v1Data: any) => ({
      version: 2,
      items: v1Data.products || []
    })
  }
});

const serialized = dehydrate(store, customSerializer);
```

## Comparison with Other Libraries

### vs Zustand

| Feature | Exostate | Zustand |
|---------|----------|---------|
| **Transactions** | ✅ Full commit/rollback | ❌ No built-in support |
| **Type Safety** | ✅ Strict generics, no `any` | ⚠️ Optional, can use `any` |
| **Middleware** | ✅ Full lifecycle hooks | ✅ Basic middleware |
| **SSR** | ✅ First-class support | ✅ Good support |
| **Complexity** | 🟡 Medium (more features) | 🟢 Simple |
| **Use Case** | Complex apps, mission-critical | Simple to medium apps |

### vs Redux

| Feature | Exostate | Redux |
|---------|----------|-------|
| **Boilerplate** | 🟢 Minimal | 🔴 High |
| **Type Safety** | ✅ Excellent | 🟡 Good (with RTK) |
| **Transactions** | ✅ Native support | ❌ Requires middleware |
| **Performance** | ✅ Optimized updates | 🟡 Good (with selectors) |
| **Learning Curve** | 🟡 Moderate | 🔴 Steep |
| **Bundle Size** | 🟢 Small (~3kB) | 🔴 Large (~10kB+) |

### Performance Benchmarks

Benchmarks run on Node.js (higher is better). Exostate leads in raw throughput and with subscribers when reducers use `Object.assign` for updates.

| Library | Scenario | Ops/sec |
|---------|----------|-------:|
| **Exostate** | update (`Object.assign`) | **~19,800,000** |
| **Zustand** | setState | ~14,800,000 |
| **Exostate** | update (`{...spread}`) | ~8,000,000 |
| **Redux** | dispatch | ~5,500,000 |
| **Exostate** | sub (`Object.assign`) | ~17,400,000 |
| **Zustand** | sub | ~15,000,000 |
| **Exostate** | sub (`{...spread}`) | ~7,300,000 |
| **Redux** | sub | ~5,000,000 |

Quickly reproduce locally:
- `npm install`
- `npm run build`
- `node benchmarks/comparison.mjs`

Notes:
- Using `Object.assign` in reducers minimizes allocation and consistently delivers the highest throughput.
- Exostate’s subscriber path remains predictable and fast due to a Set-based listener model with copy-on-write safety.

### When to Choose Exostate

- **✅ Complex state logic** with multiple dependent updates
- **✅ Mission-critical applications** where data consistency is vital
- **✅ TypeScript-heavy projects** wanting maximum type safety
- **✅ Applications needing** audit logging or operation tracking
- **✅ Teams familiar** with backend development patterns

## API Reference

### Core API

#### `createStore<T>(initial: T): Store<T>`
Creates a new store with initial state.

#### `Store<T>` Interface
```typescript
interface Store<T> {
  read(): T;
  snapshot(): DeepReadonly<T>;
  update<P>(reducer: Reducer<T, P>, payload: P): T;
  set(next: T): T;
  compute(fn: Compute<T>): T;
  batch(apply: (apply: Function) => void): T;
  subscribe<R>(selector: Selector<T, R>, subscriber: Subscriber<R>, options?: SubscribeOptions<R>): Unsubscribe;
}
```

### Transaction API

#### `beginTransaction<T>(store: Store<T>): Transaction<T>`
Starts a new transaction.

#### `Transaction<T>` Interface
```typescript
interface Transaction<T> {
  read(): T;
  apply<P>(reducer: Reducer<T, P>, payload: P): T;
  compute(fn: Compute<T>): T;
  set(next: T): T;
  commit(): T;
  rollback(): T;
}
```

### React API

#### `useStore<T>(store: Store<T>): DeepReadonly<T>`
Hook to access entire store state.

#### `useSelector<T, R>(store: Store<T>, selector: Selector<T, R>, eq?: Equality<R>): R`
Hook to access derived state with optional equality check.

#### `useStores<TShape>(stores: { [K in keyof TShape]: Store<TShape[K]> }): { [K in keyof TShape]: DeepReadonly<TShape[K]> }`
Hook to combine multiple stores.

### Utility API

#### `combineStores<TShape>(stores: TShape): Combined<TShape>`
Combines multiple stores into one.

#### `withMiddleware<T>(store: Store<T>, middlewares: Middleware<T>[]): Store<T>`
Wraps store with middleware.

#### `dehydrate<T>(store: Store<T>, serializer?: Serializer<T>): string`
Serializes store state for SSR.

#### `rehydrate<T>(store: Store<T>, raw: string, serializer?: Serializer<T>): T`
Restores store state from serialized data.

### Error API

#### `createError(code: string, message: string, details?: unknown): SafeError`
Creates a typed error instance.

#### `isSafeError(error: unknown): error is SafeError`
Type guard for safe errors.

#### `toSafeError(error: unknown, fallbackCode?: string): SafeError`
Converts unknown errors to safe errors.

## Examples

### Real-world Example: E-commerce Cart

```typescript
const cartStore = createStore({
  items: [],
  discount: 0,
  tax: 0,
  total: 0
});

function addToCart(product: Product, quantity: number) {
  const tx = beginTransaction(cartStore);
  
  try {
    // Add item
    tx.update(state => ({
      ...state,
      items: [...state.items, { product, quantity }]
    }), undefined);
    
    // Recalculate totals
    tx.update(calculateTotals, undefined);
    
    // Validate business rules
    if (tx.read().items.length > 10) {
      throw new Error('Cart limit exceeded');
    }
    
    tx.commit();
  } catch (error) {
    tx.rollback();
    throw error;
  }
}
```

### Real-world Example: User Authentication Flow

```typescript
const authStore = createStore({
  user: null,
  token: null,
  loading: false,
  error: null
});

async function login(credentials: LoginData) {
  const tx = beginTransaction(authStore);
  
  try {
    tx.set({ ...tx.read(), loading: true, error: null });
    
    const response = await api.login(credentials);
    
    tx.set({
      user: response.user,
      token: response.token,
      loading: false,
      error: null
    });
    
    tx.commit();
    return response;
  } catch (error) {
    tx.set({
      ...tx.read(),
      loading: false,
      error: toSafeError(error, 'login_failed')
    });
    tx.commit();
    throw error;
  }
}
```
