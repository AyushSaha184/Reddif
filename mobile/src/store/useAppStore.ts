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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      posts: [],
      bookmarks: [],
      trackedPosts: [],
      settings: {
        theme: 'system',
        accentColor: '#FF6B35',
        showBody: true,
        fontSize: 16,
        hapticFeedback: true,
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
            posts: [post, ...state.posts],
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
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId ? { ...p, flair: newFlair } : p
          ),
          bookmarks: state.bookmarks.map((p) =>
            p.id === postId ? { ...p, flair: newFlair } : p
          ),
        }));
      },

      clearExpiredPosts: () => {
        const now = Date.now();
        set((state) => ({
          posts: state.posts.filter(
            (p) => now - p.createdAt < EXPIRY_DURATION
          ),
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
    }
  )
);
