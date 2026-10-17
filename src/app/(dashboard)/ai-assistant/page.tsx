'use client';
import { chatErrorMessage } from '@/lib/ai/chatErrors';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AUTO_MODEL, type CatalogModel } from '@/lib/ai/modelCatalog';
import { Button, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import {
  getStoredOpenRouterKey,
  saveStoredOpenRouterKey,
  getStoredDefaultModel,
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

const SESSIONS_STORAGE_KEY = 'stockmind_ai_chat_sessions_v2';

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

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

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/chat', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!controller.signal.aborted) {
        setReadinessError(data.success ? '' : chatErrorMessage(response.status, data));
        if (data.quota) {
          setQuotaState(data.quota);
        }
      }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [selectedModel, setSelectedModel] = useState<string>(AUTO_MODEL.id);
  const [models, setModels] = useState<CatalogModel[]>([AUTO_MODEL]);
  const [proModelsAllowed, setProModelsAllowed] = useState(false);
  const [modelWarning, setModelWarning] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ai/models', { signal: controller.signal }).then(response => response.json()).then(data => {
      if (controller.signal.aborted || !Array.isArray(data.models)) return;
      setModels(data.models);
      setProModelsAllowed(data.pro === true);
      setModelWarning(data.warning || '');
      setSelectedModel(current => data.models.some((model: CatalogModel) => model.id === current && (model.free || data.pro)) ? current : AUTO_MODEL.id);
    }).catch(() => { if (!controller.signal.aborted) setModelWarning('Model listesi alınamadı. Otomatik ücretsiz kullanılabilir.'); });
    return () => controller.abort();
  }, [user?.id]);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const { containerRef, contentRef, showLatest, followLatest, onScroll, onTouchStart, onTouchEnd, onWheel } = useChatScroll(messages, currentSessionId);
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
    if (model) {
      const isProModel = models.some((m) => m.id === model && !m.free);
      if (isProModel && !proModelsAllowed && !key) {
        setSelectedModel(AUTO_MODEL.id);
      } else {
        setSelectedModel(model);
      }
    }
  }, [user, proModelsAllowed, models]);

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
    followLatest();

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

    // Sanitize model: if non-pro user and no custom API key, ensure they don't send a pro model
    let effectiveModel = selectedModel;
    const isFreeModel = selectedModel === AUTO_MODEL.id || models.some((m) => m.id === selectedModel && m.free);
    if (!isFreeModel && !proModelsAllowed && !customApiKey) {
      effectiveModel = AUTO_MODEL.id;
      setSelectedModel(AUTO_MODEL.id);
      saveStoredOpenRouterKey(customApiKey, user?.id, AUTO_MODEL.id);
    }


    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: effectiveModel,
          apiKey: customApiKey || undefined,
          portfolioContext: portfolioPayload,
        }),
      });

      const data = await res.json();
      if (data.quota) {
        setQuotaState(data.quota);
      }
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
        const errorText = chatErrorMessage(res.status, data);
        if (data.code === 'HOURLY_QUOTA_EXCEEDED' && !data.quota?.isPro) {
          setShowProModal(true);
        }
        if (data.code === 'PRO_REQUIRED') {
          setSelectedModel(AUTO_MODEL.id);
          saveStoredOpenRouterKey(customApiKey, user?.id, AUTO_MODEL.id);
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
      abortControllerRef.current = null;
      setLoading(false);
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
                if (isProModel && !proModelsAllowed && !customApiKey) {
                  setShowProModal(true);
                  return;
                }
                setSelectedModel(newModel);
                saveStoredOpenRouterKey(customApiKey, user?.id, newModel);
              }}
              className="flex-1 min-w-0 h-9 px-2.5 rounded-xl bg-bg-input border border-border text-xs text-text-primary focus:border-accent focus:outline-none"
            >
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

          {quotaState && (
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              {quotaState.isPro ? (
                <span
                  title="StockMind Pro: Saatte 20 soru hakkı"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[11px] font-semibold"
                >
                  <UIIcon name="sparkles" className="w-3.5 h-3.5" />
                  <span>{quotaState.remaining}/20 Soru (Saatlik)</span>
                </span>
              ) : (
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <span
                    title="Standart Plan: Saatte 5 soru hakkı"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium shrink-0 ${
                      quotaState.remaining === 0
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-bg-secondary text-text-secondary border-border'
                    }`}
                  >
                    <span>{quotaState.remaining}/5 Soru (Saatlik)</span>
                    {quotaState.remaining === 0 && <span className="font-bold text-rose-400">(Dolu)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-[11px] font-bold shadow-sm shadow-amber-500/20 transition-all cursor-pointer shrink-0"
                  >
                    Pro&apos;ya Geç (20/saat)
                  </button>
                </div>
              )}
            </div>
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
                          Canlı Piyasa & Portföy Doğrulandı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                          <span><UIIcon name="sparkles" className="w-4 h-4" /></span>
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

      {/* Pro Upgrade Request Modal */}
      <ProRequestModal
        isOpen={showProModal}
        onClose={() => setShowProModal(false)}
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
