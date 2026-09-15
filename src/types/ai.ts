// AI Types

export type AIRole = 'user' | 'assistant';

export interface AIMessage {
  id: string;
  conversationId: string;
  role: AIRole;
  content: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  messages?: AIMessage[];
}

export interface AIInsight {
  type: 'bullish' | 'bearish' | 'neutral';
  title: string;
  summary: string;
  confidence: number; // 0-100
  symbol?: string;
  indicators?: string[];
}

export interface AIChatRequest {
  conversationId?: string;
  message: string;
  context?: {
    symbol?: string;
    portfolio?: string;
    indicators?: string[];
  };
}

export interface AIChatResponse {
  conversationId: string;
  message: AIMessage;
  insights?: AIInsight[];
}
