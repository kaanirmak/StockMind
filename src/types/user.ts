// User Types

export interface UserProfile {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  preferredLanguage: 'tr' | 'en';
  preferredCurrency: string;
  isPro?: boolean;
  plan?: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  language: 'tr' | 'en';
  currency: string;
  theme: 'dark' | 'light' | 'system';
  notifications: {
    priceAlerts: boolean;
    portfolioUpdates: boolean;
    newsAlerts: boolean;
  };
}
