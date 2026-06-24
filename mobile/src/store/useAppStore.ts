import { Post, Settings } from '../types';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // Posts
  posts: Post[];
  addPost: (post: Post) => void;
  removePost: (postId: string) => void;
  updatePostFlair: (postId: string, newFlair: string) => void;
  clearExpiredPosts: () => void;

  // Bookmarks
  bookmarks: Post[];
  addBookmark: (post: Post) => void;
  removeBookmark: (postId: string) => void;
  isBookmarked: (postId: string) => boolean;

  // Tracked posts (for status updates)
  trackedPosts: string[];
  toggleTrackedPost: (postId: string) => void;
  isTracked: (postId: string) => boolean;

  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // App Updates
  hasUpdateAvailable: boolean;
  setHasUpdateAvailable: (hasUpdate: boolean) => void;

  // Unread count
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

const EXPIRY_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
const MAX_RETAINED_POSTS = 250;
const MAX_RETAINED_BOOKMARKS = 100; // Issue #28

// Issue #27: Only run the expensive sort+slice when needed.
const prunePosts = (posts: Post[]): Post[] => {
  const now = Date.now();
  const filtered = posts.filter((post) => now - post.createdAt < EXPIRY_DURATION);
  // Skip sort if under the limit — avoids O(n log n) on every addPost call
  if (filtered.length <= MAX_RETAINED_POSTS) {
    return filtered;
  }
  return filtered
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RETAINED_POSTS);
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      posts: [],
      bookmarks: [],
      trackedPosts: [],
      settings: {
        theme: 'system',
        accentColor: '#FF6B35',
        fontSize: 16,
        notifToggles: {
          paidNoAI: true,
          paidAIOK: true,
          free: true,
        },
      },
      unreadCount: 0,
      hasUpdateAvailable: false,

      addPost: (post) => {
        set((state) => {
          if (state.posts.find((p) => p.id === post.id)) {
            return state;
          }

          return {
            posts: [...state.posts, post],
            unreadCount: state.unreadCount + 1,
          };
        });
      },

      removePost: (postId) => {
        set((state) => ({
          posts: state.posts.filter((p) => p.id !== postId),
        }));
      },

      updatePostFlair: (postId, newFlair) => {
        set((state) => {
          const wasSolved = state.posts.find(p => p.id === postId)?.flair === 'Solved';
          const isNowSolved = newFlair === 'Solved';
          return {
            posts: state.posts.map((p) =>
              p.id === postId ? { ...p, flair: newFlair } : p
            ),
            bookmarks: state.bookmarks.map((p) =>
              p.id === postId ? { ...p, flair: newFlair } : p
            ),
            unreadCount: (!wasSolved && isNowSolved) ? state.unreadCount + 1 : state.unreadCount,
          };
        });
      },

      clearExpiredPosts: () => {
        set((state) => ({
          posts: prunePosts(state.posts),
        }));
      },

      addBookmark: (post) => {
        set((state) => {
          if (state.bookmarks.find((p) => p.id === post.id)) {
            return state;
          }
          return { bookmarks: [post, ...state.bookmarks] };
        });
      },

      removeBookmark: (postId) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((p) => p.id !== postId),
        }));
      },

      isBookmarked: (postId) => {
        return get().bookmarks.some((p) => p.id === postId);
      },

      toggleTrackedPost: (postId) => {
        set((state) => {
          const isTracked = state.trackedPosts.includes(postId);
          if (isTracked) {
            return {
              trackedPosts: state.trackedPosts.filter((id) => id !== postId),
            };
          }
          return { trackedPosts: [...state.trackedPosts, postId] };
        });
      },

      isTracked: (postId) => {
        return get().trackedPosts.includes(postId);
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      incrementUnread: () => {
        set((state) => ({ unreadCount: state.unreadCount + 1 }));
      },

      clearUnread: () => {
        set({ unreadCount: 0 });
      },

      setHasUpdateAvailable: (hasUpdate) => {
        set({ hasUpdateAvailable: hasUpdate });
      },
    }),
    {
      name: 'reddit-leads-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        posts: prunePosts(state.posts),
        // Issue #28: Limit persisted bookmarks to prevent unbounded storage growth
        bookmarks: state.bookmarks.slice(0, MAX_RETAINED_BOOKMARKS),
        trackedPosts: state.trackedPosts,
        settings: state.settings,
        hasUpdateAvailable: state.hasUpdateAvailable,
      }),
      merge: (persistedState: any, currentState: AppState) => {
        // Shallow merge persisted top-level, but deeply merge settings to avoid losing new default keys
        const merged = { ...currentState, ...persistedState };
        const mergedSettings = {
          ...currentState.settings,
          ...(persistedState?.settings || {}),
        };
        // Ensure notifToggles defaults exist if old persisted state is missing them
        mergedSettings.notifToggles = {
          paidNoAI: true,
          paidAIOK: true,
          free: true,
          ...((persistedState?.settings?.notifToggles) || {}),
        };
        merged.settings = mergedSettings;
        return merged as AppState;
      },
    }
  )
);
