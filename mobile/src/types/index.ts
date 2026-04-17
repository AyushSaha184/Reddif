export interface Post {
  id: string;
  flair: string;
  title: string;
  body?: string;
  permalink: string;
  imageUrls: string[];
  detectedBudget: string | null;
  status: 'open' | 'solved';
  createdAt: number;
}

export interface Settings {
  theme: 'system' | 'dark' | 'amoled';
  accentColor: string;
  showBody: boolean;
  fontSize: number;
  hapticFeedback: boolean;
  notifToggles: {
    paidNoAI: boolean;
    paidAIOK: boolean;
    free: boolean;
  };
}

export interface FCMMessage {
  type: 'NEW_POST' | 'FLAIR_UPDATE' | 'EXPIRED' | 'SOLVED';
  postId?: string;
  flair?: string;
  title?: string;
  permalink?: string;
  imageUrls?: string;
  detectedBudget?: string;
  createdAt?: string;
  newFlair?: string;
  status?: string;
}

export type FlairType = 'Paid - No AI' | 'Paid - AI OK' | 'Free';
