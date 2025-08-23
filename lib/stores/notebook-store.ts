import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type TabId = 'events' | 'services' | 'spaces' | 'profile';

export interface TabTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export const TAB_THEMES: Record<TabId, TabTheme> = {
  events: {
    primary: '#FF6B47',
    secondary: '#FFE5DF',
    accent: '#FF8964',
    background: '#FFF9F7',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B7280',
  },
  services: {
    primary: '#4A90E2',
    secondary: '#E3F2FD',
    accent: '#64B5F6',
    background: '#F5F9FF',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B7280',
  },
  spaces: {
    primary: '#7ED321',
    secondary: '#F1F8E9',
    accent: '#9CCC65',
    background: '#F9FFF5',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B7280',
  },
  profile: {
    primary: '#9B9B9B',
    secondary: '#F5F5F5',
    accent: '#BDBDBD',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    muted: '#6B7280',
  },
};

interface TabState {
  scrollPosition: number;
  searchQuery: string;
  filters: Record<string, any>;
  lastVisited: number;
}

interface NotebookStore {
  // Current state
  activeTab: TabId;
  previousTab: TabId | null;
  tabHistory: TabId[];
  tabStates: Record<TabId, TabState>;
  isTransitioning: boolean;
  
  // Actions
  switchTab: (tab: TabId) => void;
  goBack: () => void;
  saveTabState: (tab: TabId, state: Partial<TabState>) => void;
  clearTabHistory: () => void;
  setTransitioning: (transitioning: boolean) => void;
  
  // Computed
  canGoBack: () => boolean;
  getTabTheme: (tab: TabId) => TabTheme;
  getCurrentTheme: () => TabTheme;
}

const defaultTabState: TabState = {
  scrollPosition: 0,
  searchQuery: '',
  filters: {},
  lastVisited: Date.now(),
};

export const useNotebookStore = create<NotebookStore>()(
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
        profile: { ...defaultTabState },
      },
      isTransitioning: false,
      
      // Switch to a different tab
      switchTab: (tab: TabId) => {
        set((state) => {
          // Don't switch if already on this tab
          if (state.activeTab === tab) return;
          
          // Save current tab state
          const currentTab = state.activeTab;
          state.tabStates[currentTab].lastVisited = Date.now();
          
          // Update tab history
          state.previousTab = currentTab;
          state.tabHistory.push(tab);
          if (state.tabHistory.length > 10) {
            state.tabHistory.shift();
          }
          
          // Switch to new tab
          state.activeTab = tab;
          state.isTransitioning = true;
          
          // Update new tab's last visited
          state.tabStates[tab].lastVisited = Date.now();
        });
        
        // Reset transitioning state after animation
        setTimeout(() => {
          set((state) => {
            state.isTransitioning = false;
          });
        }, 300);
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
          }, 300);
        }
      },
      
      // Save state for a specific tab
      saveTabState: (tab: TabId, partialState: Partial<TabState>) => {
        set((state) => {
          state.tabStates[tab] = {
            ...state.tabStates[tab],
            ...partialState,
          };
        });
      },
      
      // Clear tab history
      clearTabHistory: () => {
        set((state) => {
          state.tabHistory = [state.activeTab];
          state.previousTab = null;
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
    })),
    {
      name: 'notebook-store',
      partialize: (state) => ({
        activeTab: state.activeTab,
        tabStates: state.tabStates,
      }),
    }
  )
);