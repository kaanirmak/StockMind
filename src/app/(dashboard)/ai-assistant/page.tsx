'use client';
import { prepareChatHistory } from '@/lib/ai/chatHistory';
import { chatErrorMessage } from '@/lib/ai/chatErrors';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AUTO_MODEL, resolvePreferredModel, type CatalogModel } from '@/lib/ai/modelCatalog';
import { Button, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import {
  useOpenRouterKey,
} from '@/lib/ai/apiKeyStorage';
import { StockMindMark } from '@/components/ui/StockMindMark';
import { ChatMessageContent } from '@/components/ai/ChatMessageContent';
import { useChatScroll } from '@/hooks/useChatScroll';
import { ProRequestModal } from '@/components/pro/ProRequestModal';

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
    content: ` **Merhaba! Ben StockMind AI Finansal Danışmanınız.**

Uygulamamızın canlı piyasa motoruna doğrudan bağlıyım. Anlık döviz kurları (USD/TRY, EUR/TRY), altın fiyatları, BIST 100 endeksi, hisse ve TEFAS fonları ile kendi portföyünüz hakkında gerçek zamanlı sorular sorabilirsiniz.

Aşağıdaki hızlı konulardan birini seçebilir veya aklınızdaki soruyu doğrudan iletebilirsiniz:`,
    createdAt: new Date().toISOString(),
  },
];

const PROMPT_SUGGESTIONS = [
  { label: 'Portföyümü Analiz Et', prompt: 'Portföyümdeki varlıkların kâr/zarar durumunu ve ağırlık dağılımını analiz et. Özet kartı ve karşılaştırma tablosu ekle.' },
  { label: 'Risk Raporu Çıkar', prompt: 'Portföyümün yoğunlaşma ve varlık dağılımı risklerini tablo halinde incele. Eksik verileri açıkça belirt.' },
  { label: 'Günün Piyasa Özeti', prompt: 'BIST, döviz, altın ve kripto piyasalarının güncel durumunu kısa özet ve tablo halinde göster.' },
];

const SESSIONS_STORAGE_KEY_PREFIX = 'stockmind_ai_chat_sessions_v2';
const getSessionsStorageKey = (userId?: string | null) =>
  userId && userId !== 'guest'
    ? `${SESSIONS_STORAGE_KEY_PREFIX}_${userId}`
    : SESSIONS_STORAGE_KEY_PREFIX;

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [quotaState, setQuotaState] = useState<{
    limit: number;
    remaining: number;
    used: number;
    isPro: boolean;
  } | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showQuotaExceededModal, setShowQuotaExceededModal] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/chat', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!controller.signal.aborted) {
        if (data.quota) {
          setQuotaState(data.quota);
        } else if (response.ok) {
          setQuotaState({ limit: 5, remaining: 5, used: 0, isPro: false });
        }
        if (response.status === 401 || data.code === 'AUTH_REQUIRED') {
          setReadinessError(chatErrorMessage(response.status, data));
        } else {
          setReadinessError('');
        }
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [user?.id]);
  const { apiKey: customApiKey, model: preferredModel, setModel: setSelectedModel } = useOpenRouterKey(user?.id);
  const [models, setModels] = useState<CatalogModel[]>([AUTO_MODEL]);
  const [proModelsAllowed, setProModelsAllowed] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const selectedModel = resolvePreferredModel(preferredModel, models, proModelsAllowed, catalogReady);
  const [modelWarning, setModelWarning] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setCatalogReady(false);
    fetch('/api/ai/models', { signal: controller.signal }).then(response => response.json()).then(data => {
      if (controller.signal.aborted || !Array.isArray(data.models)) return;
      setModels(data.models);
      setProModelsAllowed(data.pro === true);
      setModelWarning(data.warning || '');
      setCatalogReady(!data.warning);
    }).catch(() => { if (!controller.signal.aborted) setModelWarning('Model listesi alınamadı. Otomatik ücretsiz kullanılabilir.'); });
    return () => controller.abort();
  }, [user?.id]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const { containerRef, contentRef, showLatest, followLatest, onScroll, onTouchStart, onTouchEnd, onWheel } = useChatScroll(messages, currentSessionId);
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setLoading(false);
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [user?.id]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // 1. Initialize Sessions from LocalStorage (scoped to user)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = getSessionsStorageKey(user?.id);
    try {
      const raw = localStorage.getItem(storageKey);
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
      localStorage.setItem(storageKey, JSON.stringify([firstSession]));
    } catch {}
  }, [user?.id]);

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
        const storageKey = getSessionsStorageKey(user?.id);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed saving sessions to localStorage:', err);
      }
      return updated;
    });
  };

  // 4. Create New Chat Session
  const createNewSession = (previousSessions: ChatSession[]) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Yeni Finansal Sohbet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: INITIAL_MESSAGES,
    };

    const updated = [newSession, ...previousSessions];
    setSessions(updated);
    setCurrentSessionId(newSession.id);
    setMessages(INITIAL_MESSAGES);
    setInput('');
    setShowHistoryModal(false);

    try {
      const storageKey = getSessionsStorageKey(user?.id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };
  const handleCreateNewSession = () => createNewSession(sessions);

  // 5. Select a Past Session
  const handleSelectSession = (session: ChatSession) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setCurrentSessionId(session.id);
    setMessages(session.messages || INITIAL_MESSAGES);
    setShowHistoryModal(false);
  };

  // 6. Delete a Session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);

    if (remaining.length === 0) {
      createNewSession([]);
      return;
    }

    setSessions(remaining);
    try {
      const storageKey = getSessionsStorageKey(user?.id);
      localStorage.setItem(storageKey, JSON.stringify(remaining));
    } catch {}

    if (sessionId === currentSessionId) {
      setCurrentSessionId(remaining[0].id);
      setMessages(remaining[0].messages || INITIAL_MESSAGES);
    }
  };

  // Handle URL prompt query param
  const promptProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && urlPrompt !== promptProcessedRef.current) {
      promptProcessedRef.current = urlPrompt;
      handleSendMessage(urlPrompt);
    }
  }, [searchParams]);

  // 8. Send Message
  const handleSendMessage = async (userText: string) => {
    const cleanText = userText.trim();
    if (!cleanText || loading || abortControllerRef.current) return;

    const hasCustomKey = Boolean(customApiKey && customApiKey.trim().length > 0);

    // The server checks the sliding window; a stale client snapshot must not block retries.
    if (cleanText.length > 8000) {
      setReadinessError('Mesaj en fazla 8000 karakter olabilir. Lütfen kısaltın.');
      return;
    }
    setReadinessError('');

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
    followLatest();

    // Extract current portfolio state with safe finite numbers
    let portfolioPayload: any = undefined;
    try {
      const summary = usePortfolioStore.getState().getSummary();
      if (summary && (summary.totalValue > 0 || (summary.holdings && summary.holdings.length > 0))) {
        const safeNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        portfolioPayload = {
          totalValue: safeNum(summary.totalValue),
          totalCost: safeNum(summary.totalCost),
          totalProfitLoss: safeNum(summary.totalPnL),
          totalProfitLossPercent: safeNum(summary.totalPnLPercent),
          dailyProfitLoss: safeNum(summary.dailyPnL),
          dailyProfitLossPercent: safeNum(summary.dailyPnLPercent),
          holdings: summary.holdings.slice(0, 100).map((h) => ({
            symbol: h.symbol,
            name: (h as any).name || h.symbol,
            assetType: h.assetType || 'HISSE',
            shares: Math.max(0, safeNum(h.totalQuantity)),
            averageCost: Math.max(0, safeNum(h.averageCost)),
            currentPrice: Math.max(0, safeNum(h.currentPrice)),
            totalValue: Math.max(0, safeNum(h.currentValue)),
            profitLoss: safeNum(h.pnl),
            profitLossPercent: safeNum(h.pnlPercent),
            weight: safeNum(h.weight),
          })),
        };
      }
    } catch (_) {}

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Sanitize model: if non-pro user and no custom API key, ensure they don't send a pro model
    let effectiveModel = selectedModel;
    const isFreeModel = selectedModel === AUTO_MODEL.id || models.some((m) => m.id === selectedModel && m.free);
    if (!isFreeModel && !proModelsAllowed && !customApiKey) {
      effectiveModel = AUTO_MODEL.id;
      setSelectedModel(AUTO_MODEL.id);
    }

    // Exclude welcome greeting and error/cancel alerts from model history
    const validHistory = newMessages.filter(
      (m) => m.id !== 'msg-welcome' && !m.id.startsWith('err-') && !m.id.startsWith('stop-')
    );

    const payloadMessages = prepareChatHistory(validHistory);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: payloadMessages.map((m) => ({ role: m.role, content: m.content })),
          model: effectiveModel,
          apiKey: customApiKey || undefined,
          portfolioContext: portfolioPayload,
        }),
      });

      const data = await res.json();
      if (abortControllerRef.current !== controller) return;
      if (data.quota) {
        setQuotaState(data.quota);
        if (data.quota.remaining === 0 && !data.quota.isPro && !hasCustomKey) {
          setShowQuotaExceededModal(true);
        }
      }
      if (res.ok && data.success && data.message) {
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
        const errorText = chatErrorMessage(res.status, data);
        if (data.code === 'HOURLY_QUOTA_EXCEEDED' && !data.quota?.isPro && !hasCustomKey) {
          setShowQuotaExceededModal(true);
        }
        if (data.code === 'PRO_REQUIRED') {
          setSelectedModel(AUTO_MODEL.id);
          setShowProModal(true);
        }
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: ` **Analiz Uyarısı:** ${errorText}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      if (abortControllerRef.current !== controller) return;
      if (err?.name === 'AbortError') {
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `stop-${Date.now()}`,
            role: 'assistant',
            content: ` **Analiz Durduruldu:** *İstek kullanıcı tarafından iptal edildi.*`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        updateCurrentSessionMessages([
          ...newMessages,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: ` **Ağ Bağlantı Hatası:** Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const [viewportHeight, setViewportHeight] = useState<number | undefined>();
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setViewportHeight(viewport?.height || window.innerHeight);
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => { viewport?.removeEventListener('resize', update); window.removeEventListener('resize', update); };
  }, []);

  const isKeyboardOpen = typeof window !== 'undefined' && Boolean(
    viewportHeight && window.innerHeight - viewportHeight > 150
  );

  useEffect(() => {
    if (isKeyboardOpen) {
      followLatest('smooth');
    }
  }, [isKeyboardOpen, followLatest]);

  return (
    <div
      style={{
        height: viewportHeight
          ? (isKeyboardOpen
              ? `calc(${viewportHeight}px - 3.5rem)`
              : `calc(${viewportHeight}px - 3.5rem - 4.5rem - env(safe-area-inset-bottom, 0px))`)
          : 'calc(100dvh - 8rem)',
      }}
      className="ai-chat-container flex flex-col h-full max-h-full min-h-0 animate-fade-in relative pb-[env(safe-area-inset-bottom)]"
    >
      <div className={`glass-card ${isKeyboardOpen ? 'p-2 mb-1 space-y-1.5' : 'p-2.5 sm:p-3 mb-2 space-y-2.5'} shrink-0 rounded-2xl border border-border transition-all`}>
        {/* Row 1: Title and brand on left, action buttons on right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StockMindMark className={`${isKeyboardOpen ? 'w-6 h-6' : 'w-7 h-7'} shrink-0`} />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-text-primary truncate">StockMind AI</h1>
              <p className="text-[10px] text-text-muted truncate">Finans asistanı</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              aria-label="Sohbet Geçmişi"
              title="Sohbet Geçmişi"
              className={`inline-flex items-center justify-center ${isKeyboardOpen ? 'w-7 h-7' : 'w-8.5 h-8.5 sm:w-9 sm:h-9'} rounded-xl border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer`}
            >
              <UIIcon name="history" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={handleCreateNewSession}
              aria-label="Yeni Sohbet"
              title="Yeni Sohbet"
              className={`inline-flex items-center justify-center ${isKeyboardOpen ? 'w-7 h-7' : 'w-8.5 h-8.5 sm:w-9 sm:h-9'} rounded-xl border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer`}
            >
              <UIIcon name="plus" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Model selector & Quota display - hide on mobile when typing to maximize chat space */}
        <div className={`${isKeyboardOpen ? 'hidden sm:flex' : 'flex'} flex-col sm:flex-row sm:items-center gap-2 pt-1.5 border-t border-border/50`}>
          <label className="flex items-center gap-2 text-xs text-text-muted flex-1 min-w-0">
            <span className="shrink-0 font-medium">Model:</span>
            <select
              aria-label="AI modeli"
              value={selectedModel}
              onChange={(e) => {
                const newModel = e.target.value;
                const isProModel = models.some((m) => m.id === newModel && !m.free);
                if (isProModel && !proModelsAllowed) {
                  setShowProModal(true);
                  return;
                }
                setSelectedModel(newModel);
              }}
              className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-bg-input border border-border text-xs text-text-primary focus:border-accent focus:outline-none"
            >
              {!models.some(model => model.id === selectedModel) && <option value={selectedModel}>{selectedModel} · Kaydedilen seçim</option>}
              <optgroup label="Ücretsiz modeller">
                {models.filter((model) => model.free).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pro modeller">
                {models.filter((model) => !model.free).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {proModelsAllowed ? '· Pro' : '🔒 (Pro)'}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          {customApiKey ? (
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span
                title="Kendi OpenRouter API anahtarınız aktif: Platform saatlik soru kotası uygulanmaz."
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold"
              >
                <UIIcon name="sparkles" className="w-3.5 h-3.5" />
                <span>Özel Anahtar (Limitsiz)</span>
              </span>
            </div>
          ) : (
            quotaState && (
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                {quotaState.isPro ? (
                  <span
                    title="StockMind Pro: Saatte 20 soru hakkı"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[11px] font-semibold"
                  >
                    <UIIcon name="sparkles" className="w-3.5 h-3.5" />
                    <span>{quotaState.remaining}/20 Hak</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowQuotaExceededModal(true)}
                    title="Saatlik Soru Hakkı (Pro'da saat başı 20 soru)"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium shrink-0 cursor-pointer transition-colors ${
                      quotaState.remaining === 0
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 font-bold'
                        : 'bg-bg-secondary text-text-secondary border-border hover:border-accent/40 hover:text-text-primary'
                    }`}
                  >
                    <span>{quotaState.remaining}/5 Hak</span>
                    {quotaState.remaining === 0 && <span className="font-bold text-rose-400">(Dolu)</span>}
                  </button>
                )}
              </div>
            )
          )}
        </div>
        {modelWarning && <p className="text-xs text-text-muted">{modelWarning}</p>}
        {readinessError && <p role="alert" className="text-xs text-danger">{readinessError} <a href="/login" className="underline">Giriş yap</a></p>}
      </div>

      {/* Chat Messages Body */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 py-1 mb-2 custom-scrollbar overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={contentRef} className="space-y-3 sm:space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isUser
                      ? 'bg-accent text-white shadow-md shadow-accent/20'
                      : 'bg-bg-card border border-border'
                  }`}
                >
                  {isUser ? 'Siz' : <StockMindMark className="w-6 h-6" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`min-w-0 max-w-[88%] sm:max-w-xl md:max-w-2xl p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
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
                          Piyasa verisi bağlama eklendi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                          <span><UIIcon name="sparkles" className="w-4 h-4" /></span>
                          Genel Finans Bilgisi (Canlı veri yok)
                        </span>
                      )}
                      {msg.asOf && (
                        <span className="text-text-muted">
                          Yanıt saati: {new Date(msg.asOf).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
                <StockMindMark className="w-6 h-6" />
              </div>
              <div className="glass-card p-3 sm:p-4 rounded-2xl rounded-tl-xs border border-border/80 flex items-center gap-2 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span>{models.find((m) => m.id === selectedModel)?.name.split(' (')[0] || 'AI'} canlı analiz hazırlıyor...</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showLatest && !isKeyboardOpen && (
        <button
          type="button"
          onClick={() => followLatest('smooth')}
          className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 sm:right-4 z-20 px-3 py-1.5 rounded-full bg-accent text-white shadow-lg shadow-accent/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-hover active:scale-95 transition-all cursor-pointer animate-fade-in"
          title="En alta kaydır"
        >
          <span>↓ En Yeni Mesaj</span>
        </button>
      )}

      {/* Preset Prompt Suggestions */}
      {messages.length <= 2 && !isKeyboardOpen && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto overscroll-x-contain py-1.5 shrink-0 no-scrollbar -mx-1 px-1 mb-1">
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
      <div className="glass-card p-1.5 sm:p-2 rounded-2xl border border-border shrink-0 flex items-center gap-1.5 sm:gap-2 shadow-sm mb-1 sm:mb-0 pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:pb-2 focus-within:border-accent/80 focus-within:ring-1 focus-within:ring-accent/30 transition-all">
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
          className="flex-1 bg-transparent px-3 py-2.5 sm:py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:!outline-none focus:ring-0 focus-visible:!ring-0 outline-none border-none min-w-0"
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
            <span className="w-3.5 h-3.5 rounded-xs bg-white block" />
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
              Durdur
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
                <span className="text-xl"><UIIcon name="sparkles" className="w-4 h-4" /></span>
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
                <span> Yeni Sohbet Başlat</span>
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

      {/* Quota Exceeded Modal */}
      {showQuotaExceededModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm p-6 rounded-3xl bg-bg-card border border-border shadow-2xl text-center space-y-4 animate-scale-up">
            <button
              type="button"
              onClick={() => setShowQuotaExceededModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-border/80 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Kapat"
            >
              ✕
            </button>

            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/10">
              ⚡
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-text-primary">
                {quotaState && quotaState.remaining === 0 ? 'Limitin Doldu!' : 'Saatlik Soru Hakkı'}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                {quotaState && quotaState.remaining === 0 ? (
                  <>
                    Standart planda saatlik 5 soru limitine ulaştın.<br />
                    <span className="font-semibold text-text-primary mt-1 inline-block">
                      Pro planda <span className="text-amber-400 font-bold">saat başı 20 soru</span> hakkı bulunur.
                    </span>
                  </>
                ) : (
                  <>
                    Şu anki kalan hakkın: <strong className="text-text-primary">{quotaState?.remaining ?? 5}/5 soru</strong>.<br />
                    <span className="font-semibold text-text-primary mt-1 inline-block">
                      Pro planda <span className="text-amber-400 font-bold">saat başı 20 soru</span> hakkı bulunur.
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setShowQuotaExceededModal(false);
                  setShowProModal(true);
                }}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-2.5 shadow-md shadow-amber-500/20"
              >
                Pro&apos;ya Geç (20 Soru/Saat)
              </Button>
              <button
                type="button"
                onClick={() => setShowQuotaExceededModal(false)}
                className="text-xs text-text-muted hover:text-text-primary py-1 transition-colors cursor-pointer"
              >
                Tamam, sonra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Upgrade Request Modal */}
      <ProRequestModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
        userEmail={user?.email || undefined}
        userName={profile?.fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || undefined}
      />
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
