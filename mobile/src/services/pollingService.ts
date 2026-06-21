import { getBackendUrl } from './apiService';
import { useAppStore } from '../store/useAppStore';
import { Post } from '../types';
import { notifeeService } from './notifeeService';

const POLL_INTERVAL_MS = 60000;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

const normalizeFlair = (flair: string): string => {
  return flair
    .trim()
    .toLowerCase()
    .replace(/:[a-z0-9_+-]+:/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const isFlairEnabled = (flair: string): boolean => {
  const { settings } = useAppStore.getState();
  const normalized = normalizeFlair(flair);
  if (normalized === 'paid-no-ai') return settings.notifToggles.paidNoAI;
  if (normalized === 'paid-ai-ok') return settings.notifToggles.paidAIOK;
  if (normalized === 'free') return settings.notifToggles.free;
  return false;
};

interface BackendPost {
  post_id: string;
  flair: string;
  title: string;
  permalink: string;
  image_urls: string[];
  detected_budget: string | null;
  status: string;
  created_at: number;
  body: string;
  author: string;
  subreddit: string;
  score: number | null;
  num_comments: number | null;
}

export const pollingService = {
  async fetchAndProcessPosts(): Promise<void> {
    try {
      const baseUrl = await getBackendUrl();
      const response = await fetch(`${baseUrl}/posts`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) return;

      const posts: BackendPost[] = await response.json();
      const { addPost, posts: existingPosts } = useAppStore.getState();
      const existingIds = new Set(existingPosts.map((p) => p.id));

      for (const post of posts) {
        if (existingIds.has(post.post_id)) continue;
        if (!isFlairEnabled(post.flair)) continue;

        const newPost: Post = {
          id: post.post_id,
          flair: post.flair,
          title: post.title,
          body: post.body || '',
          permalink: post.permalink,
          imageUrls: post.image_urls || [],
          detectedBudget: post.detected_budget || null,
          status: 'open',
          createdAt: post.created_at * 1000,
        };

        addPost(newPost);

        try {
          await notifeeService.showNewPostNotification(
            newPost.title,
            newPost.flair,
            newPost.detectedBudget,
          );
        } catch {
          // Notification display failure shouldn't break the flow
        }
      }
    } catch {
      // Silently fail - network errors are expected when offline
    }
  },

  startPolling(intervalMs: number = POLL_INTERVAL_MS): void {
    if (pollingTimer) return;
    this.fetchAndProcessPosts();
    pollingTimer = setInterval(() => {
      this.fetchAndProcessPosts();
    }, intervalMs);
  },

  stopPolling(): void {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  },
};
