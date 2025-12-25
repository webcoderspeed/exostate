// Error-safe state transitions with validation
// Demonstrates robust error handling and validation patterns

import { createStore } from '../../src/store';

// Define a user profile with validation constraints
interface UserProfile {
  id: string;
  email: string;
  age: number;
  username: string;
  isActive: boolean;
}

// Validation functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateAge = (age: number): boolean => {
  return age >= 0 && age <= 150;
};

const validateUsername = (username: string): boolean => {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
};

// Create store with initial valid state
const userStore = createStore<UserProfile>({
  id: '1',
  email: 'user@example.com',
  age: 25,
  username: 'valid_user',
  isActive: true
});

console.log('=== Error-safe State Transitions with Validation ===\n');

// 1. Safe update with validation
console.log('1. Safe update with validation:');

const safeUpdate = <T extends keyof UserProfile>(
  field: T,
  value: UserProfile[T],
  validator: (value: UserProfile[T]) => boolean
): boolean => {
  if (!validator(value)) {
    console.log(`Validation failed for ${field}:`, value);
    return false;
  }
  
  userStore.update((prev, updates: Partial<UserProfile>) => ({
    ...prev,
    ...updates
  }), { [field]: value } as Partial<UserProfile>);
  
  console.log(`Successfully updated ${field}:`, value);
  return true;
};

// Test valid updates
console.log('Testing valid updates:');
safeUpdate('email', 'new@example.com', validateEmail);
safeUpdate('age', 30, validateAge);
safeUpdate('username', 'new_user_123', validateUsername);

// Test invalid updates
console.log('\nTesting invalid updates:');
safeUpdate('email', 'invalid-email', validateEmail);
safeUpdate('age', -5, validateAge);
safeUpdate('username', 'ab', validateUsername);

console.log('\nCurrent state:', userStore.read());

// 2. Transaction-like batch operations with rollback
console.log('\n2. Transaction-like operations:');

const transactionalUpdate = (updates: Partial<UserProfile>): boolean => {
  
  // Validate all updates
  if (updates.email && !validateEmail(updates.email)) {
    console.log('Transaction failed: Invalid email');
    return false;
  }
  
  if (updates.age && !validateAge(updates.age)) {
    console.log('Transaction failed: Invalid age');
    return false;
  }
  
  if (updates.username && !validateUsername(updates.username)) {
    console.log('Transaction failed: Invalid username');
    return false;
  }
  
  // Apply all updates in batch
    userStore.batch(() => {
      if (updates.email) {
        userStore.update((prev, email: string) => ({
          ...prev,
          email
        }), updates.email);
      }
      
      if (updates.age) {
        userStore.update((prev, age: number) => ({
          ...prev,
          age
        }), updates.age);
      }
      
      if (updates.username) {
        userStore.update((prev, username: string) => ({
          ...prev,
          username
        }), updates.username);
      }
      
      if (updates.isActive !== undefined) {
        userStore.update((prev, isActive: boolean) => ({
          ...prev,
          isActive
        }), updates.isActive);
      }
    });
  
  console.log('Transaction successful:', updates);
  return true;
};

// Test successful transaction
console.log('Testing successful transaction:');
transactionalUpdate({
  email: 'transaction@example.com',
  age: 35,
  username: 'transaction_user'
});

console.log('State after transaction:', userStore.read());

// Test failed transaction
console.log('\nTesting failed transaction:');
transactionalUpdate({
  email: 'invalid-email',
  age: 200
});

console.log('State remains unchanged:', userStore.read());

// 3. Error boundaries with fallback values
console.log('\n3. Error boundaries with fallback values:');

// Field-specific validation with proper typing
const validateUserProfileField = (
  field: keyof UserProfile,
  value: UserProfile[keyof UserProfile]
): boolean => {
  switch (field) {
    case 'email':
      return validateEmail(value as string);
    case 'age':
      return validateAge(value as number);
    case 'username':
      return validateUsername(value as string);
    case 'isActive':
      return typeof value === 'boolean';
    case 'id':
      return typeof value === 'string' && value.length > 0;
    default:
      return false;
  }
};

const updateWithFallback = (
  field: keyof UserProfile,
  value: UserProfile[keyof UserProfile],
  fallback: UserProfile[keyof UserProfile]
): void => {
  if (!validateUserProfileField(field, value)) {
      console.log(`Using fallback for ${field}:`, fallback);
      userStore.update((prev, updates: Partial<UserProfile>) => ({
        ...prev,
        ...updates
      }), { [field]: fallback } as Partial<UserProfile>);
    } else {
      userStore.update((prev, updates: Partial<UserProfile>) => ({
        ...prev,
        ...updates
      }), { [field]: value } as Partial<UserProfile>);
    }
};

// Test fallback behavior
console.log('Testing fallback behavior:');
updateWithFallback('email', 'bad-email', 'fallback@example.com');
updateWithFallback('age', -10, 18);

console.log('Final state with fallbacks:', userStore.read());

// 4. State recovery and consistency checks
console.log('\n4. State recovery and consistency:');

const ensureConsistency = (): void => {
  const state = userStore.read();
  
  // Fix any inconsistencies
  if (!validateEmail(state.email)) {
    console.log('Fixing inconsistent email');
    userStore.update((prev, email: string) => ({
      ...prev,
      email: 'recovered@example.com'
    }), 'recovered@example.com');
  }
  
  if (!validateAge(state.age)) {
    console.log('Fixing inconsistent age');
    userStore.update((prev, age: number) => ({
      ...prev,
      age: 25
    }), 25);
  }
  
  if (!validateUsername(state.username)) {
    console.log('Fixing inconsistent username');
    userStore.update((prev, username: string) => ({
      ...prev,
      username: 'recovered_user'
    }), 'recovered_user');
  }
};

// Intentionally corrupt state for demonstration
console.log('Intentionally corrupting state...');
userStore.set({
  id: '1',
  email: 'invalid',
  age: -1,
  username: 'ab',
  isActive: true
});

console.log('Corrupted state:', userStore.read());
ensureConsistency();
console.log('Recovered state:', userStore.read());

console.log('\n=== Error-safe Validation Example Complete ===');