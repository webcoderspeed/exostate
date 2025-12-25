// React integration - advanced patterns with selectors
// Demonstrates advanced React patterns with optimized selectors and derived state

import React from 'react';
import { createStore } from '../../src/store';
import { useSelector, useStores, useStoresSelector } from '../../src/react';

// Complex user state with nested objects
interface UserState {
  profile: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    preferences: {
      theme: 'light' | 'dark';
      language: string;
      notifications: boolean;
    };
  };
  stats: {
    loginCount: number;
    lastLogin: Date;
    posts: number;
    followers: number;
    following: number;
  };
  status: {
    isOnline: boolean;
    lastSeen: Date;
    isSubscribed: boolean;
  };
}

// Create user store
const userStore = createStore<UserState>({
  profile: {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    avatar: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'light',
      language: 'en',
      notifications: true
    }
  },
  stats: {
    loginCount: 42,
    lastLogin: new Date(),
    posts: 156,
    followers: 1240,
    following: 890
  },
  status: {
    isOnline: true,
    lastSeen: new Date(),
    isSubscribed: true
  }
});

// Separate store for UI state
interface UIState {
  sidebarOpen: boolean;
  currentView: 'profile' | 'settings' | 'dashboard';
  modal: {
    isOpen: boolean;
    type: string | null;
    data: any;
  };
}

const uiStore = createStore<UIState>({
  sidebarOpen: false,
  currentView: 'profile',
  modal: {
    isOpen: false,
    type: null,
    data: null
  }
});

// 1. Memoized selectors for optimized re-renders
const UserProfileComponent: React.FC = () => {
  // Basic selector - re-renders only when profile changes
  const profile = useSelector(userStore, (state) => state.profile);
  
  // Fine-grained selectors - re-renders only when specific fields change
  const userName = useSelector(userStore, (state) => state.profile.name);
  const userEmail = useSelector(userStore, (state) => state.profile.email);
  const theme = useSelector(userStore, (state) => state.profile.preferences.theme);
  
  const updateName = (name: string) => {
    userStore.update((prev, updates: Partial<UserState>) => ({
      ...prev,
      profile: { ...prev.profile, ...(updates.profile || {}) }
    } as UserState), { profile: { name } } as Partial<UserState>);
  };
  
  const toggleTheme = () => {
    userStore.update((prev, theme: 'light' | 'dark') => ({
      ...prev,
      profile: {
        ...prev.profile,
        preferences: {
          ...prev.profile.preferences,
          theme: theme
        }
      }
    } as UserState), profile.preferences.theme === 'light' ? 'dark' : 'light');
  };
  
  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      margin: '10px',
      backgroundColor: theme === 'dark' ? '#333' : '#fff',
      color: theme === 'dark' ? '#fff' : '#000'
    }}>
      <h3>User Profile (Optimized Selectors)</h3>
      <p>Name: {userName}</p>
      <p>Email: {userEmail}</p>
      <p>Theme: {theme}</p>
      
      <input
        type="text"
        value={userName}
        onChange={(e) => updateName(e.target.value)}
        placeholder="Update name"
        style={{ marginRight: '10px' }}
      />
      <button onClick={toggleTheme}>
        Switch to {theme === 'light' ? 'Dark' : 'Light'} Theme
      </button>
    </div>
  );
};

// 2. Derived state with computed properties
const UserStatsComponent: React.FC = () => {
  // Derived statistics - computed from multiple store fields
  const userStats = useSelector(userStore, (state) => ({
    engagement: state.stats.posts > 0 
      ? (state.stats.followers / state.stats.posts).toFixed(2)
      : '0.00',
    activityLevel: state.stats.loginCount > 50 ? 'High' : 'Medium',
    isPopular: state.stats.followers > 1000
  }));
  
  const stats = useSelector(userStore, (state) => state.stats);
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>User Statistics (Derived State)</h3>
      <p>Posts: {stats.posts}</p>
      <p>Followers: {stats.followers}</p>
      <p>Following: {stats.following}</p>
      <p>Engagement Ratio: {userStats.engagement}</p>
      <p>Activity Level: {userStats.activityLevel}</p>
      <p>Popular: {userStats.isPopular ? 'Yes' : 'No'}</p>
    </div>
  );
};

// 3. Multiple stores with useStores
const MultiStoreComponent: React.FC = () => {
  // Combine multiple stores
  const stores = useStores({
    user: userStore,
    ui: uiStore
  });
  
  const toggleSidebar = () => {
    uiStore.update((prev, sidebarOpen: boolean) => ({
      ...prev,
      sidebarOpen
    }), !stores.ui.sidebarOpen);
  };
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Multiple Stores Integration</h3>
      <p>User: {stores.user.profile.name}</p>
      <p>UI View: {stores.ui.currentView}</p>
      <p>Sidebar: {stores.ui.sidebarOpen ? 'Open' : 'Closed'}</p>
      
      <button onClick={toggleSidebar}>
        {stores.ui.sidebarOpen ? 'Close' : 'Open'} Sidebar
      </button>
    </div>
  );
};

// 4. Advanced selector with custom equality function
const OptimizedUserComponent: React.FC = () => {
  // Custom equality function to prevent unnecessary re-renders
  const userStatus = useSelector(
    userStore,
    (state) => ({ 
      isOnline: state.status.isOnline, 
      lastSeen: state.status.lastSeen 
    }),
    (prev, next) => prev.isOnline === next.isOnline // Only re-render when online status changes
  );
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Optimized Status (Custom Equality)</h3>
      <p>Online: {userStatus.isOnline ? 'Yes' : 'No'}</p>
      <p>Last seen: {userStatus.lastSeen.toLocaleString()}</p>
    </div>
  );
};

// 5. useStoresSelector for complex derived state across multiple stores
const ComplexDerivedComponent: React.FC = () => {
  const derivedData = useStoresSelector(
    {
      user: userStore,
      ui: uiStore
    },
    (stores) => ({
      userTheme: stores.user.profile.preferences.theme,
      uiView: stores.ui.currentView,
      combined: `${stores.user.profile.name} - ${stores.ui.currentView}`,
      isDarkDashboard: stores.user.profile.preferences.theme === 'dark' && 
                     stores.ui.currentView === 'dashboard'
    })
  );
  
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Complex Derived State</h3>
      <p>Theme: {derivedData.userTheme}</p>
      <p>View: {derivedData.uiView}</p>
      <p>Combined: {derivedData.combined}</p>
      <p>Dark Dashboard: {derivedData.isDarkDashboard ? 'Yes' : 'No'}</p>
    </div>
  );
};

// Main demo component
const AdvancedPatternsDemo: React.FC = () => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>React Integration - Advanced Patterns with Selectors</h1>
      
      <UserProfileComponent />
      <UserStatsComponent />
      <MultiStoreComponent />
      <OptimizedUserComponent />
      <ComplexDerivedComponent />
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5' }}>
        <h3>Advanced Features Demonstrated:</h3>
        <ul>
          <li><strong>Memoized Selectors</strong> - Optimized re-renders with fine-grained state access</li>
          <li><strong>Derived State</strong> - Computed properties from store data</li>
          <li><strong>Multiple Stores</strong> - Combining and using multiple stores together</li>
          <li><strong>Custom Equality</strong> - Fine control over re-render conditions</li>
          <li><strong>Complex Selectors</strong> - Advanced state derivation across stores</li>
        </ul>
      </div>
    </div>
  );
};

export { AdvancedPatternsDemo };

console.log('=== React Integration - Advanced Patterns with Selectors ===');
console.log('This example demonstrates advanced React patterns:');
console.log('1. Memoized selectors for optimized performance');
console.log('2. Derived state computation');
console.log('3. Multiple store integration');
console.log('4. Custom equality functions');
console.log('5. Complex cross-store selectors');