// Subscription and observation patterns
// Demonstrates how to subscribe to state changes and observe reactive behavior

import { createStore } from '../../src/store';

// Define a simple user preferences interface
interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
  fontSize: number;
}

// Create a store for user preferences
const preferencesStore = createStore<UserPreferences>({
  theme: 'light',
  language: 'en',
  notifications: true,
  fontSize: 14
});

console.log('=== Subscription and Observation Patterns ===\n');

// 1. Basic subscription with immediate callback
console.log('1. Basic subscription:');
const unsubscribe1 = preferencesStore.subscribe(
  (state) => state, // Select entire state
  (newState) => {
    console.log('State changed to:', newState);
  },
  { fireImmediately: true }
);

// Make some changes to trigger subscriptions
preferencesStore.update((prev, theme: 'dark') => ({
  ...prev,
  theme
}), 'dark');

// 2. Subscription with specific state selector
console.log('\n2. Subscription with selector (theme only):');
let themeChangeCount = 0;
const unsubscribe2 = preferencesStore.subscribe(
  (state) => state.theme, // Only trigger when theme changes
  (newTheme) => {
    themeChangeCount++;
    console.log(`Theme changed ${themeChangeCount} times: ${newTheme}`);
  }
);

preferencesStore.update((prev, theme: 'light') => ({
  ...prev,
  theme
}), 'light');

preferencesStore.update((prev, theme: 'dark') => ({
  ...prev,
  theme
}), 'dark');

// 3. Multiple subscriptions with different selectors
console.log('\n3. Multiple selective subscriptions:');

// Subscription for language changes
const unsubscribe3 = preferencesStore.subscribe(
  (state) => state.language,
  (newLanguage) => {
    console.log(`Language changed to: ${newLanguage}`);
  }
);

// Subscription for notification changes  
const unsubscribe4 = preferencesStore.subscribe(
  (state) => state.notifications,
  (newNotifications) => {
    console.log(`Notifications: ${newNotifications}`);
  }
);

// Trigger multiple changes
preferencesStore.update((prev, updates: Partial<UserPreferences>) => ({
  ...prev,
  ...updates
}), { language: 'fr', notifications: false });

// 4. Batch operations and subscription behavior
console.log('\n4. Batch operations:');

preferencesStore.batch(() => {
  preferencesStore.set({
    theme: 'light',
    language: preferencesStore.read().language,
    notifications: preferencesStore.read().notifications,
    fontSize: 16
  });
  
  preferencesStore.update((prev, language: string) => ({
    ...prev,
    language
  }), 'es');
});

// 5. Cleanup subscriptions
console.log('\n5. Cleaning up subscriptions:');
unsubscribe1();
unsubscribe2(); 
unsubscribe3();
unsubscribe4();

// Final changes (should not trigger any subscriptions)
console.log('\n6. Final changes (no subscriptions active):');
preferencesStore.update((prev, theme: 'dark') => ({
  ...prev,
  theme
}), 'dark');

console.log('\n=== Subscription Example Complete ===');
console.log('Final state:', preferencesStore.read());