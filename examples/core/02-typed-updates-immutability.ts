// Typed state updates and immutability patterns
// Demonstrates type-safe updates, immutability, and various update patterns

import { createStore } from '../../src'

// Simple state interface for demonstration
interface AppState {
  count: number
  user: {
    name: string
    email: string
    preferences: {
      theme: 'light' | 'dark' | 'auto'
      notifications: boolean
    }
  }
  tags: string[]
}

// Initial state
const initialState: AppState = {
  count: 0,
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    preferences: {
      theme: 'auto',
      notifications: true
    }
  },
  tags: ['user', 'viewer']
}

const appStore = createStore<AppState>(initialState)

// 1. Simple set operation - completely replaces state
appStore.set({
  count: 1,
  user: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    preferences: {
      theme: 'light',
      notifications: false
    }
  },
  tags: ['admin']
})

// 2. Functional update with reducer pattern
appStore.update((prev, increment: number) => ({
  ...prev,
  count: prev.count + increment,
  tags: [...prev.tags] // Ensure mutable array
}), 5)

// 3. Nested object updates with immutability
appStore.update((prev, theme: 'light' | 'dark' | 'auto') => ({
  ...prev,
  user: {
    ...prev.user,
    preferences: {
      ...prev.user.preferences,
      theme
    }
  },
  tags: [...prev.tags] // Ensure mutable array
}), 'dark')

// 4. Array operations with immutability
appStore.update((prev, newTag: string) => ({
  ...prev,
  tags: [...prev.tags, newTag] // Creates new mutable array
}), 'editor')

// 5. Using compute for complex transformations
appStore.compute((current) => ({
  ...current,
  user: {
    ...current.user,
    preferences: {
      ...current.user.preferences,
      notifications: !current.user.preferences.notifications
    }
  },
  tags: [...current.tags] // Ensure mutable array
}))

// 6. Batch multiple operations atomically
appStore.batch((apply) => {
  apply((prev, name: string) => ({ 
    ...prev, 
    user: { ...prev.user, name },
    tags: [...prev.tags]
  }), 'Batcher User')
  apply((prev, count: number) => ({ 
    ...prev, 
    count,
    tags: [...prev.tags]
  }), 100)
})

// Verify immutability - original objects should not be modified
console.log('Original tags array:', initialState.tags)
console.log('Current tags array:', appStore.read().tags)
console.log('Arrays are different objects:', initialState.tags !== appStore.read().tags)

// Type safety examples - these would cause compile errors:
// appStore.update((prev, invalid: number) => ({ ...prev }), 'invalid') // Wrong payload type
// appStore.set({ invalidProp: true }) // Missing required properties
// appStore.update((prev, theme: string) => ({ ...prev }), 'invalid-theme') // Wrong enum type