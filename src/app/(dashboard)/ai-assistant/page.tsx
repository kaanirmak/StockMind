'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { Button, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import {
  getStoredOpenRouterKey,
  saveStoredOpenRouterKey,
  getStoredDefaultModel,
} from '@/lib/ai/apiKeyStorage';
import { ChatMessageContent } from '@/components/ai/ChatMessageContent';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sourceScope?: 'live_market_data' | 'unverified_general_knowledge';
  asOf?: string;
  disclaimer?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content: `👋 **Merhaba! Ben StockMind AI Finansal Danışmanınız.**

Uygulamamızın canlı piyasa motoruna doğrudan bağlıyım. Anlık döviz kurları (USD/TRY, EUR/TRY), altın fiyatları, BIST 100 endeksi, hisse ve TEFAS fonları ile kendi portföyünüz hakkında gerçek zamanlı sorular sorabilirsiniz.

Aşağıdaki hızlı konulardan birini seçebilir veya aklınızdaki soruyu doğrudan iletebilirsiniz:`,
    createdAt: new Date().toISOString(),
  },
];

const PROMPT_SUGGESTIONS = [
  { label: '💵 Dolar Kaç TL?', prompt: 'Şu an güncel Dolar (USD/TRY) kuru ne kadar ve günlük değişim nasıl?' },
  { label: '🥇 Gram Altın Fiyatı', prompt: 'Gram altın ve ons altın şu anda ne kadar? Günlük hareket nasıl?' },
  { label: '📊 Portföyümü Analiz Et', prompt: 'Portföyümdeki varlıkların kâr/zarar durumunu ve ağırlık dağılımını analiz et.' },
  { label: '✈️ THYAO Kaç TL?', prompt: 'THYAO hissesi şu an kaç TL ve teknik göstergeleri nasıl?' },
  { label: '🏦 En İyi TEFAS Fonları', prompt: 'Son 1 yılda en çok kazandıran TEFAS fonları ve dengeli bir fon sepeti önerisi ver.' },
];

const SESSIONS_STORAGE_KEY = 'stockmind_ai_chat_sessions_v2';

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // 1. Initialize Sessions from LocalStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
          setMessages(parsed[0].messages || INITIAL_MESSAGES);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load chat sessions:', e);
    }

    // Default first session
    const firstSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Yeni Finansal Sohbet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: INITIAL_MESSAGES,
    };
    setSessions([firstSession]);
    setCurrentSessionId(firstSession.id);
    setMessages(INITIAL_MESSAGES);
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify([firstSession]));
    } catch {}
  }, []);

  // 2. Load API key & model
  useEffect(() => {
    const key = getStoredOpenRouterKey(user?.id);
    if (key) setCustomApiKey(key);
    const model = getStoredDefaultModel(user?.id);
    if (model) setSelectedModel(model);
  }, [user]);

  // 3. Sync active session messages to LocalStorage
  const updateCurrentSessionMessages = (newMessages: Message[], titleOverride?: string) => {
    setMessages(newMessages);

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === currentSessionId) {
          let updatedTitle = s.title;
          if (titleOverride) {
            updatedTitle = titleOverride;
          } else if (s.title === 'Yeni Finansal Sohbet' && newMessages.length > 1) {
            const firstUserMsg = newMessages.find((m) => m.role === 'user');
            if (firstUserMsg) {
              updatedTitle = firstUserMsg.content.slice(0, 36) + (firstUserMsg.content.length > 36 ? '...' : '');
            }
          }
          return {
            ...s,
            title: updatedTitle,
            updatedAt: new Date().toISOString(),
            messages: newMessages,
          };
        }
        return s;
      });

      try {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed saving sessions to localStorage:', err);
      }
      return updated;
    });
  };

  // 4. Create New Chat Session
  const handleCreateNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Yeni Finansal Sohbet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: INITIAL_MESSAGES,
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    setCurrentSessionId(newSession.id);
    setMessages(INITIAL_MESSAGES);
    setInput('');
    setShowHistoryModal(false);

    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // 5. Select a Past Session
  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || INITIAL_MESSAGES);
    setShowHistoryModal(false);
  };

  // 6. Delete a Session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);

    if (remaining.length === 0) {
      handleCreateNewSession();
      return;
    }

    setSessions(remaining);
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(remaining));
    } catch {}

    if (sessionId === currentSessionId) {
      setCurrentSessionId(remaining[0].id);
      setMessages(remaining[0].messages || INITIAL_MESSAGES);
    }
  };

  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  };

  // 7. Track User Scroll Position in Chat Container (Fix for auto-scroll yanking)
  const handleContainerScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isAtBottom = distanceFromBottom < 80;
    isNearBottomRef.current = isAtBottom;
    setShowScrollBottomBtn(!isAtBottom && scrollHeight > clientHeight + 100);
  };

  // Auto scroll only when user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      const raf = requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [messages, loading]);

  // Initial session switch scroll to bottom
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollToBottom('instant');
    });
    return () => cancelAnimationFrame(raf);
  }, [currentSessionId]);

  // Handle URL prompt query param
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && messages.length === 1) {
      handleSendMessage(urlPrompt);
    }
  }, [searchParams]);

  // 8. Send Message
  const handleSendMessage = async (userText: string) => {
    const cleanText = userText.trim();
    if (!cleanText || loading) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: cleanText,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    updateCurrentSessionMessages(newMessages);
    setInput('');
    setLoading(true);
    isNearBottomRef.current = true;

    // Extract current portfolio state
    let portfolioPayload: any = undefined;
    try {
      const summary = usePortfolioStore.getState().getSummary();
      if (summary && (summary.totalValue > 0 || (summary.holdings && summary.holdings.length > 0))) {
        portfolioPayload = {
          totalValue: summary.totalValue,
          totalCost: summary.totalCost,
          totalProfitLoss: summary.totalPnL,
          totalProfitLossPercent: summary.totalPnLPercent,
          dailyProfitLoss: summary.dailyPnL,
          dailyProfitLossPercent: summary.dailyPnLPercent,
          holdings: summary.holdings.map((h) => ({
            symbol: h.symbol,
            assetType: h.assetType,
            shares: h.totalQuantity,
            averageCost: h.averageCost,
            currentPrice: h.currentPrice,
            totalValue: h.currentValue,
            profitLoss: h.pnl,
            profitLossPercent: h.pnlPercent,
            weight: h.weight,
          })),
        };
      }
    } catch (_) {}

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          apiKey: customApiKey || undefined,
          portfolioContext: portfolioPayload,
        }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        const assistantMessage: Message = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: data.message.content,
          createdAt: data.message.createdAt || new Date().toISOString(),
          sourceScope: data.sourceScope || data.message.sourceScope,
          asOf: data.asOf || data.message.asOf,
          disclaimer: data.disclaimer,
        };
        updateCurrentSessionMessages([...newMessages, assistantMessage]);
      } else {
        const errorText = data.error || 'AI yanıtı alınamadı.';
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Analiz Uyarısı:** ${errorText}\n\n*Sunucu yanıt veremedi veya model meşgul.*`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `stop-${Date.now()}`,
            role: 'assistant',
            content: `⏹ **Analiz Durduruldu:** *İstek kullanıcı tarafından iptal edildi.*`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Ağ Bağlantı Hatası:** ${err?.message || 'Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-container flex flex-col h-full max-h-full min-h-0 animate-fade-in relative pb-[env(safe-area-inset-bottom)]">
      {/* Top Header - Compact for Mobile, Detailed for Desktop */}
      <div className="glass-card p-2 sm:p-3 mb-2 shrink-0 rounded-2xl border border-border shadow-sm">
        {/* Mobile Header (Single Compact Row) */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center text-white shrink-0 shadow-md shadow-accent/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-text-primary truncate">StockMind AI</h1>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Canlı Lisanslı
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* History Button */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg border border-border hover:bg-bg-hover transition-colors text-xs cursor-pointer flex items-center gap-1"
              title="Sohbet Geçmişi"
            >
              <span>📜</span>
            </button>

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="p-1.5 text-accent hover:text-white rounded-lg border border-accent/30 bg-accent/10 hover:bg-accent transition-colors text-xs cursor-pointer"
              title="Yeni Sohbet"
            >
              <span>➕</span>
            </button>

            {/* Model Select */}
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                saveStoredOpenRouterKey(customApiKey, user?.id, e.target.value);
              }}
              className="bg-bg-input text-text-primary text-[11px] rounded-lg border border-border px-1.5 py-1 focus:border-accent focus:outline-none max-w-[105px] truncate cursor-pointer font-medium"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.split(' (')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center text-white shadow-lg shadow-accent/25 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-text-primary">StockMind AI Danışman</h1>
                <Badge variant="success" size="sm" dot>
                  Canlı Piyasa & Portföy Entegre
                </Badge>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Sistem Lisansı Aktif
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">BIST 100, TEFAS ve Küresel Piyasalar Canlı Analiz Motoru</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Button */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📜</span>
              <span>Geçmiş Sohbetler ({sessions.length})</span>
            </button>

            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="px-3 py-1.5 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent text-accent hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>➕</span>
              <span>Yeni Sohbet</span>
            </button>

            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                saveStoredOpenRouterKey(customApiKey, user?.id, e.target.value);
              }}
              className="bg-bg-input text-text-primary text-xs rounded-xl border border-border px-3 py-1.5 focus:border-accent focus:outline-none cursor-pointer font-medium"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div
        ref={messagesContainerRef}
        onScroll={handleContainerScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 sm:space-y-4 px-1 py-1 mb-2 custom-scrollbar overscroll-y-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isUser
                    ? 'bg-accent text-white shadow-md shadow-accent/20'
                    : 'bg-gradient-to-tr from-accent to-accent-secondary text-white'
                }`}
              >
                {isUser ? 'Siz' : 'AI'}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-xl md:max-w-2xl p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-accent text-white rounded-tr-xs shadow-md shadow-accent/15'
                    : 'glass-card border border-border/80 text-text-primary rounded-tl-xs space-y-2'
                }`}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ChatMessageContent content={msg.content} isUser={isUser} />
                </div>

                {!isUser && msg.sourceScope && (
                  <div className="pt-1.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    {msg.sourceScope === 'live_market_data' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Canlı Piyasa & Portföy Doğrulandı
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                        <span>ℹ️</span>
                        Genel Finans Bilgisi (Canlı veri yok)
                      </span>
                    )}
                    {msg.asOf && (
                      <span className="text-text-muted">
                        Veri saati: {new Date(msg.asOf).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}

                <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${isUser ? 'text-white/70 justify-end' : 'text-text-muted'}`}>
                  {!isUser && (
                    <span className="text-[9px] text-text-muted/70 italic truncate">
                      StockMind AI yatırım tavsiyesi vermez.
                    </span>
                  )}
                  <span>{new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-2 sm:gap-3 animate-fade-in">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
              AI
            </div>
            <div className="glass-card p-3 sm:p-4 rounded-2xl rounded-tl-xs border border-border/80 flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>{AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name.split(' (')[0] || 'AI'} canlı analiz hazırlıyor...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={() => {
            isNearBottomRef.current = true;
            scrollToBottom('smooth');
          }}
          className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 sm:right-4 z-20 px-3 py-1.5 rounded-full bg-accent text-white shadow-lg shadow-accent/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-hover active:scale-95 transition-all cursor-pointer animate-fade-in"
          title="En alta kaydır"
        >
          <span>↓ En Yeni Mesaj</span>
        </button>
      )}

      {/* Preset Prompt Suggestions */}
      {messages.length <= 2 && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto overscroll-x-contain touch-pan-x py-1.5 shrink-0 no-scrollbar -mx-1 px-1 mb-1">
          {PROMPT_SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              onClick={() => handleSendMessage(sug.prompt)}
              className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-full text-[11px] sm:text-xs bg-bg-secondary/90 hover:bg-bg-tertiary border border-border/80 text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-sm active:scale-[0.98]"
            >
              {sug.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Box - Mobile Ergonomic */}
      <div className="glass-card p-1.5 sm:p-2 rounded-2xl border border-border shrink-0 flex items-center gap-1.5 sm:gap-2 shadow-sm mb-1 sm:mb-0 pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:pb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(input);
            }
          }}
          placeholder="Hisse, fon veya teknik analiz sorusu sorun..."
          className="flex-1 bg-transparent px-3 py-2.5 sm:py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none min-w-0"
        />

        {/* Mobile Submit / Stop Button */}
        {loading ? (
          <button
            type="button"
            onClick={handleStopGeneration}
            className="sm:hidden w-9 h-9 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 hover:bg-danger/80 active:scale-95 transition-all cursor-pointer font-bold text-xs"
            title="Durdur"
            aria-label="Durdur"
          >
            ⏹
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSendMessage(input)}
            disabled={!input.trim()}
            className="sm:hidden w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 hover:bg-accent-hover active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            title="Gönder"
            aria-label="Gönder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        )}

        {/* Desktop Submit / Stop Button */}
        <div className="hidden sm:block shrink-0">
          {loading ? (
            <Button
              variant="danger"
              size="md"
              onClick={handleStopGeneration}
              className="text-xs sm:text-sm px-4 py-2"
            >
              Durdur ⏹
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSendMessage(input)}
              disabled={!input.trim()}
              className="text-xs sm:text-sm px-4 py-2"
            >
              Gönder
            </Button>
          )}
        </div>
      </div>

      {/* Chat Sessions History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
          <div className="glass-card max-w-lg w-full p-5 sm:p-6 border border-border rounded-2xl shadow-elevated space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xl">📜</span>
                <div>
                  <h3 className="text-base font-bold text-text-primary">Sohbet Geçmişi</h3>
                  <p className="text-xs text-text-muted">Önceki analiz ve danışmanlık oturumlarınız</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Kayıtlı Sohbetler ({sessions.length})</span>
              <button
                type="button"
                onClick={handleCreateNewSession}
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>➕ Yeni Sohbet Başlat</span>
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 custom-scrollbar pr-1">
              {sessions.map((sess) => {
                const isActive = sess.id === currentSessionId;
                const messageCount = sess.messages?.length || 0;
                return (
                  <div
                    key={sess.id}
                    onClick={() => handleSelectSession(sess)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-accent/15 border-accent text-text-primary shadow-sm'
                        : 'bg-bg-tertiary/50 border-border hover:bg-bg-hover text-text-secondary'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isActive && <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}
                        <h4 className="text-xs sm:text-sm font-semibold truncate text-text-primary">
                          {sess.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted mt-1">
                        <span>{new Date(sess.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{messageCount} mesaj</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, sess.id)}
                      className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors cursor-pointer shrink-0"
                      title="Sohbeti Sil"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border/60 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-12 text-center text-text-muted">
          <span>AI Asistan yükleniyor...</span>
        </div>
      }
    >
      <AIAssistantContent />
    </Suspense>
  );
}
