// React integration - basic hooks usage
// Demonstrates how to use exostate with React components through hooks

import React from 'react';
import { createStore } from '../../src/store';
import { useStore, useSelector } from '../../src/react';

// Define a simple counter state
interface CounterState {
  count: number;
  increment: number;
}

// Create a store for counter state
const counterStore = createStore<CounterState>({
  count: 0,
  increment: 1
});

// Simple counter component using useStore
const CounterComponent: React.FC = () => {
  const state = useStore(counterStore);
  
  const increment = () => {
    counterStore.update((prev, amount: number) => ({
      ...prev,
      count: prev.count + amount
    }), state.increment);
  };
  
  const decrement = () => {
    counterStore.update((prev, amount: number) => ({
      ...prev,
      count: prev.count - amount
    }), state.increment);
  };
  
  const setIncrement = (value: number) => {
    counterStore.update((prev, increment: number) => ({
      ...prev,
      increment
    }), value);
  };
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h2>Counter Component</h2>
      <p>Count: {state.count}</p>
      <p>Increment by: {state.increment}</p>
      
      <div style={{ margin: '10px 0' }}>
        <button onClick={increment} style={{ marginRight: '10px' }}>
          Increment (+{state.increment})
        </button>
        <button onClick={decrement}>
          Decrement (-{state.increment})
        </button>
      </div>
      
      <div>
        <label>
          Set increment amount:
          <input 
            type="number" 
            value={state.increment} 
            onChange={(e) => setIncrement(Number(e.target.value))}
            style={{ marginLeft: '10px' }}
          />
        </label>
      </div>
    </div>
  );
};

// User profile state
interface UserProfile {
  name: string;
  email: string;
  age: number;
  isActive: boolean;
}

const userStore = createStore<UserProfile>({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  isActive: true
});

// Component using useSelector for selective state access
const UserProfileComponent: React.FC = () => {
  const name = useSelector(userStore, (state) => state.name);
  const email = useSelector(userStore, (state) => state.email);
  const isActive = useSelector(userStore, (state) => state.isActive);
  
  const updateName = (newName: string) => {
    userStore.update((prev, name: string) => ({
      ...prev,
      name
    }), newName);
  };
  
  const toggleActive = () => {
    userStore.update((prev, newStatus: boolean) => ({
      ...prev,
      isActive: newStatus
    }), !isActive);
  };
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h2>User Profile Component</h2>
      <p>Name: {name}</p>
      <p>Email: {email}</p>
      <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      
      <div style={{ margin: '10px 0' }}>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => updateName(e.target.value)}
          placeholder="Enter name"
          style={{ marginRight: '10px' }}
        />
        <button onClick={toggleActive}>
          {isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
};

// Main demo component
const ReactIntegrationDemo: React.FC = () => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>React Integration - Basic Hooks Usage</h1>
      <p>This example demonstrates how to use exostate with React components through hooks.</p>
      
      <CounterComponent />
      <UserProfileComponent />
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5' }}>
        <h3>Key Features Demonstrated:</h3>
        <ul>
          <li><strong>useStore</strong> - Access entire store state in components</li>
          <li><strong>useSelector</strong> - Selective state access for optimized re-renders</li>
          <li><strong>State updates</strong> - Updating store state from component events</li>
          <li><strong>Type safety</strong> - Full TypeScript support with proper typing</li>
        </ul>
      </div>
    </div>
  );
};

// For demonstration purposes, we'll export the components
// In a real app, you'd render them in your React application
export { ReactIntegrationDemo, CounterComponent, UserProfileComponent };

console.log('=== React Integration - Basic Hooks Usage ===');
console.log('This example provides React components that demonstrate:');
console.log('1. useStore hook for full state access');
console.log('2. useSelector hook for selective state access');
console.log('3. State updates from component events');
console.log('4. Type-safe React integration');

// Note: To run this example in a real React app, you would:
// 1. Import these components
// 2. Render them in your app
// 3. The state management is handled automatically by exostate