import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type TabId = 'events' | 'services' | 'spaces' | 'things';

export interface TabTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export const TAB_THEMES: Record<TabId, TabTheme> = {
  events: {
    primary: '#FF6B47',      // Vibrant orange
    secondary: '#FFE5DF',     // Light peach
    accent: '#FF8964',        // Coral
    background: '#FFFBFA',    // Warm white
    surface: '#FFFFFF',       // Pure white
    text: '#1A1A1A',         // Near black
    muted: '#6B7280',        // Gray
    border: '#FFE5DF',       // Light peach border
  },
  services: {
    primary: '#4A90E2',      // Professional blue
    secondary: '#E3F2FD',     // Light blue
    accent: '#64B5F6',        // Sky blue
    background: '#FAFBFF',    // Cool white
    surface: '#FFFFFF',       // Pure white
    text: '#1A1A1A',         // Near black
    muted: '#6B7280',        // Gray
    border: '#E3F2FD',       // Light blue border
  },
  spaces: {
    primary: '#7ED321',      // Fresh green
    secondary: '#F1F8E9',     // Light green
    accent: '#9CCC65',        // Lime
    background: '#FAFFF5',    // Natural white
    surface: '#FFFFFF',       // Pure white
    text: '#1A1A1A',         // Near black
    muted: '#6B7280',        // Gray
    border: '#F1F8E9',       // Light green border
  },
  things: {
    primary: '#9B51E0',      // Creative purple
    secondary: '#F3E5F5',     // Light purple
    accent: '#BA68C8',        // Orchid
    background: '#FDFAFF',    // Soft lavender white
    surface: '#FFFFFF',       // Pure white
    text: '#1A1A1A',         // Near black
    muted: '#6B7280',        // Gray
    border: '#F3E5F5',       // Light purple border
  },
};

// Tab metadata for UI display
export const TAB_CONFIG = {
  events: {
    label: 'Events',
    icon: 'Calendar',
    placeholder: 'Search concerts, workshops, meetups...',
    description: 'Discover local events and activities',
  },
  services: {
    label: 'Services',
    icon: 'Briefcase',
    placeholder: 'Find photographers, trainers, consultants...',
    description: 'Connect with service professionals',
  },
  spaces: {
    label: 'Spaces',
    icon: 'MapPin',
    placeholder: 'Discover venues, studios, offices...',
    description: 'Rent spaces for any occasion',
  },
  things: {
    label: 'Things',
    icon: 'Package',
    placeholder: 'Browse equipment, tools, furniture...',
    description: 'Buy and sell items locally',
  },
} as const;

interface TabState {
  searchQuery: string;
  filters: Record<string, any>;
  sortBy: string;
  viewMode: 'grid' | 'list';
  page: number;
  resultsCache?: any[];
  lastFetched?: number;
}

interface MarketplaceStore {
  // Current state
  activeTab: TabId;
  previousTab: TabId | null;
  tabHistory: TabId[];
  tabStates: Record<TabId, TabState>;
  isTransitioning: boolean;
  globalSearchQuery: string;
  
  // Actions
  switchTab: (tab: TabId) => void;
  goBack: () => void;
  updateTabState: (tab: TabId, state: Partial<TabState>) => void;
  setSearchQuery: (tab: TabId, query: string) => void;
  setGlobalSearchQuery: (query: string) => void;
  clearTabState: (tab: TabId) => void;
  clearAllFilters: () => void;
  setTransitioning: (transitioning: boolean) => void;
  
  // Computed
  canGoBack: () => boolean;
  getTabTheme: (tab: TabId) => TabTheme;
  getCurrentTheme: () => TabTheme;
  getTabConfig: (tab: TabId) => typeof TAB_CONFIG[TabId];
  getCurrentTabState: () => TabState;
}

const defaultTabState: TabState = {
  searchQuery: '',
  filters: {},
  sortBy: 'relevance',
  viewMode: 'grid',
  page: 1,
};

export const useMarketplaceStore = create<MarketplaceStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      activeTab: 'events',
      previousTab: null,
      tabHistory: ['events'],
      tabStates: {
        events: { ...defaultTabState },
        services: { ...defaultTabState },
        spaces: { ...defaultTabState },
        things: { ...defaultTabState },
      },
      isTransitioning: false,
      globalSearchQuery: '',
      
      // Switch to a different tab
      switchTab: (tab: TabId) => {
        set((state) => {
          // Don't switch if already on this tab
          if (state.activeTab === tab) return;
          
          // Update tab history
          state.previousTab = state.activeTab;
          state.tabHistory.push(tab);
          if (state.tabHistory.length > 10) {
            state.tabHistory.shift();
          }
          
          // Switch to new tab
          state.activeTab = tab;
          state.isTransitioning = true;
        });
        
        // Reset transitioning state after animation
        setTimeout(() => {
          set((state) => {
            state.isTransitioning = false;
          });
        }, 200);
      },
      
      // Go back to previous tab
      goBack: () => {
        const { tabHistory } = get();
        if (tabHistory.length > 1) {
          set((state) => {
            state.tabHistory.pop();
            const previousTab = state.tabHistory[state.tabHistory.length - 1];
            if (previousTab) {
              state.activeTab = previousTab;
              state.isTransitioning = true;
            }
          });
          
          setTimeout(() => {
            set((state) => {
              state.isTransitioning = false;
            });
          }, 200);
        }
      },
      
      // Update state for a specific tab
      updateTabState: (tab: TabId, partialState: Partial<TabState>) => {
        set((state) => {
          state.tabStates[tab] = {
            ...state.tabStates[tab],
            ...partialState,
            lastFetched: Date.now(),
          };
        });
      },
      
      // Set search query for a specific tab
      setSearchQuery: (tab: TabId, query: string) => {
        set((state) => {
          state.tabStates[tab].searchQuery = query;
        });
      },
      
      // Set global search query (updates current tab)
      setGlobalSearchQuery: (query: string) => {
        const { activeTab } = get();
        set((state) => {
          state.globalSearchQuery = query;
          state.tabStates[activeTab].searchQuery = query;
        });
      },
      
      // Clear state for a specific tab
      clearTabState: (tab: TabId) => {
        set((state) => {
          state.tabStates[tab] = { ...defaultTabState };
        });
      },
      
      // Clear all filters across all tabs
      clearAllFilters: () => {
        set((state) => {
          Object.keys(state.tabStates).forEach((tab) => {
            state.tabStates[tab as TabId].filters = {};
          });
        });
      },
      
      // Set transitioning state
      setTransitioning: (transitioning: boolean) => {
        set((state) => {
          state.isTransitioning = transitioning;
        });
      },
      
      // Check if can go back
      canGoBack: () => {
        const { tabHistory } = get();
        return tabHistory.length > 1;
      },
      
      // Get theme for a specific tab
      getTabTheme: (tab: TabId) => {
        return TAB_THEMES[tab];
      },
      
      // Get current active theme
      getCurrentTheme: () => {
        const { activeTab } = get();
        return TAB_THEMES[activeTab];
      },
      
      // Get tab configuration
      getTabConfig: (tab: TabId) => {
        return TAB_CONFIG[tab];
      },
      
      // Get current tab state
      getCurrentTabState: () => {
        const { activeTab, tabStates } = get();
        return tabStates[activeTab];
      },
    })),
    {
      name: 'marketplace-store',
      partialize: (state) => ({
        activeTab: state.activeTab,
        tabStates: state.tabStates,
      }),
    }
  )
);