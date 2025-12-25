// Basic vanilla state creation - Simple counter example
// Demonstrates core store creation, typed state, and basic operations

import { createStore } from '../../src'

// Define a strongly typed state interface
interface CounterState {
  count: number
  label: string
  lastUpdated?: Date
}

// Create store with initial state
const counterStore = createStore<CounterState>({
  count: 0,
  label: 'Initial Counter',
})

// Subscribe to state changes - fires immediately with current state
const unsubscribe = counterStore.subscribe(
  (state) => state.count,
  (count) => {
    console.log('Count changed:', count)
  },
  { fireImmediately: true }
)

// Update state using functional update pattern
counterStore.update((prev, delta: number) => ({
  ...prev,
  count: prev.count + delta,
  lastUpdated: new Date()
}), 5)

// Update state using set method
counterStore.set({
  count: 10,
  label: 'Manually Set',
  lastUpdated: new Date()
})

// Get current state
const currentState = counterStore.read()
console.log('Current state:', currentState)

// Clean up subscription
unsubscribe()

// Demonstrate type safety - this would cause compile error:
// counterStore.update((prev, delta: string) => ({ ...prev }), 'invalid') // Type error