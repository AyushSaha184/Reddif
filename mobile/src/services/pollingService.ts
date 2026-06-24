import { apiClient } from './apiService';
import { useAppStore } from '../store/useAppStore';
import { Post } from '../types';
import { notifeeService } from './notifeeService';
import { canonicalizeFlairLabel } from './fcmService';

const POLL_INTERVAL_MS = 60000;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

const isFlairEnabled = (flair: string): boolean => {
  const { settings } = useAppStore.getState();
  const toggles = settings?.notifToggles ?? { paidNoAI: true, paidAIOK: true, free: true };
  const canonical = canonicalizeFlairLabel(flair);
  if (canonical === 'Paid - No AI') return toggles.paidNoAI;
  if (canonical === 'Paid - AI OK') return toggles.paidAIOK;
  if (canonical === 'Free') return toggles.free;
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
      const response = await apiClient.get('/posts');
      const posts: BackendPost[] = response.data;
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
    } catch (error) {
      // Issue #36: Log errors instead of silently swallowing them
      console.warn('Polling error:', error);
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
