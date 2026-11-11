'use client';
import { prepareChatHistory } from '@/lib/ai/chatHistory';
import {
  chatErrorMessage,
  classifyChatFailure,
  type ChatErrorClassification,
} from '@/lib/ai/chatErrors';
import {
  PORTFOLIO_CONTEXT_FIELDS,
  PORTFOLIO_SCOPE_LABELS,
  buildPortfolioContextPayload,
  classifyPortfolioQuestionScope,
  getPortfolioFieldsForScope,
  type PortfolioFieldScopePreference,
} from '@/lib/ai/portfolioContext';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AUTO_MODEL, resolvePreferredModel, type CatalogModel } from '@/lib/ai/modelCatalog';
import { Button, Badge, Modal } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  getAiChatStorageKey,
  resolveSessionScopeKey,
  SESSION_BOUNDARY_EVENT,
} from '@/lib/auth/sessionBoundary';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import {
  useOpenRouterKey,
} from '@/lib/ai/apiKeyStorage';
import { StockMindMark } from '@/components/ui/StockMindMark';
import { ChatMessageContent } from '@/components/ai/ChatMessageContent';
import { useChatScroll } from '@/hooks/useChatScroll';
import { ProRequestModal } from '@/components/pro/ProRequestModal';

import type { AIContextProvenance } from '@/lib/ai/market-context';
import {
  buildAiUsageVisibilitySummary,
  type AiQuotaSnapshot,
} from '@/lib/ai/quotaVisibility';
import {
  buildDefaultNewsQuestion,
  parseNewsAnalysisSearchParams,
  type NewsAnalysisContext,
} from '@/lib/ai/newsAnalysisContext';
import {
  buildSavedReportFromChatMessage,
  deleteSavedAnalysisReport,
  listSavedAnalysisReports,
  saveAnalysisReport,
  type SavedAnalysisReport,
} from '@/lib/ai/savedReports';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sourceScope?: 'live_market_data' | 'unverified_general_knowledge';
  asOf?: string;
  disclaimer?: string;
  provenance?: AIContextProvenance;
  errorInfo?: ChatErrorClassification & { retryPrompt?: string };
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
    content: `👋 **Merhaba! StockMind AI Finans Danışmanınıza hoş geldiniz.** Canlı piyasalar, hisseler, TEFAS fonları ve portföyünüz hakkında dilediğinizi sorabilirsiniz.`,
    createdAt: new Date().toISOString(),
  },
];

const PROMPT_SUGGESTIONS = [
  { label: 'Portföyümü Analiz Et', prompt: 'Portföyümdeki varlıkların kâr/zarar durumunu ve ağırlık dağılımını analiz et. Özet kartı ve karşılaştırma tablosu ekle.', requiresPortfolio: true },
  { label: 'Risk Raporu Çıkar', prompt: 'Portföyümün yoğunlaşma ve varlık dağılımı risklerini tablo halinde incele. Eksik verileri açıkça belirt.', requiresPortfolio: true },
  { label: 'Günün Piyasa Özeti', prompt: 'BIST, döviz, altın ve kripto piyasalarının güncel durumunu kısa özet ve tablo halinde göster.', requiresPortfolio: false },
];

const SESSIONS_STORAGE_KEY_PREFIX = 'stockmind_ai_chat_sessions_v2';
const getSessionsStorageKey = (userId?: string | null) =>
  getAiChatStorageKey(userId);

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const activeScopeRef = useRef<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [quotaState, setQuotaState] = useState<AiQuotaSnapshot | null>(null);
  const [usePersonalKey, setUsePersonalKey] = useState(true);
  const [showProModal, setShowProModal] = useState(false);
  const [showQuotaExceededModal, setShowQuotaExceededModal] = useState(false);
  const [showQuotaDetailsModal, setShowQuotaDetailsModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [recentModels, setRecentModels] = useState<string[]>([]);
  const [includePortfolioContext, setIncludePortfolioContext] = useState(false);
  const [portfolioContextScope, setPortfolioContextScope] = useState<PortfolioFieldScopePreference>('auto');
  const [showPortfolioFieldsInfo, setShowPortfolioFieldsInfo] = useState(false);
  const [pendingNewsContext, setPendingNewsContext] = useState<NewsAnalysisContext | null>(null);
  const [savedReports, setSavedReports] = useState<SavedAnalysisReport[]>([]);
  const [showSavedReportsModal, setShowSavedReportsModal] = useState(false);
  const [activeSavedReport, setActiveSavedReport] = useState<SavedAnalysisReport | null>(null);
  const [savedToastId, setSavedToastId] = useState<string | null>(null);
  const effectivePortfolioScope = React.useMemo(
    () => classifyPortfolioQuestionScope(input || 'dağılım', portfolioContextScope),
    [input, portfolioContextScope]
  );
  const effectivePortfolioFields = React.useMemo(
    () => getPortfolioFieldsForScope(effectivePortfolioScope),
    [effectivePortfolioScope]
  );

  const portfolioTransactions = usePortfolioStore((s) => s.transactions);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const portfolioHoldingsCount = React.useMemo(() => {
    try {
      return usePortfolioStore.getState().getSummary()?.holdings?.length ?? 0;
    } catch {
      return 0;
    }
  }, [portfolioTransactions, activePortfolioId]);

  useEffect(() => {
    setSavedReports(listSavedAnalysisReports(undefined, user?.id));
  }, [user?.id]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('stockmind_recent_models');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentModels(parsed);
      }
    } catch {}
  }, []);

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

  const handleSelectModel = (modelId: string) => {
    const isProModel = models.some((m) => m.id === modelId && !m.free);
    if (isProModel && !proModelsAllowed) {
      setShowModelModal(false);
      setShowProModal(true);
      return;
    }
    setSelectedModel(modelId);
    setShowModelModal(false);
    try {
      const nextRecent = [modelId, ...recentModels.filter((id) => id !== modelId)].slice(0, 4);
      setRecentModels(nextRecent);
      localStorage.setItem('stockmind_recent_models', JSON.stringify(nextRecent));
    } catch {}
  };

  const currentModel = models.find((m) => m.id === selectedModel) || { id: selectedModel, name: selectedModel, free: true };
  const hasSavedCustomKey = Boolean(customApiKey && customApiKey.trim().length > 0);
  const activeCustomKey = hasSavedCustomKey && usePersonalKey ? customApiKey.trim() : undefined;
  const usageVisibility = React.useMemo(
    () =>
      buildAiUsageVisibilitySummary({
        selectedModel: currentModel,
        quota: quotaState,
        hasCustomKey: hasSavedCustomKey,
        usePersonalKey,
        isPro: quotaState?.isPro ?? proModelsAllowed,
      }),
    [currentModel, quotaState, hasSavedCustomKey, usePersonalKey, proModelsAllowed]
  );
  const queryLower = modelSearchQuery.trim().toLowerCase();
  const searchFilter = (m: CatalogModel) =>
    !queryLower || m.name.toLowerCase().includes(queryLower) || m.id.toLowerCase().includes(queryLower);

  const filteredFreeModels = models.filter((m) => m.free && searchFilter(m));
  const filteredProModels = models.filter((m) => !m.free && searchFilter(m));
  const recentModelObjects = recentModels
    .map((id) => models.find((m) => m.id === id))
    .filter((m): m is CatalogModel => Boolean(m));

  const { containerRef, contentRef, showLatest, followLatest, onScroll, onTouchStart, onTouchEnd, onWheel } = useChatScroll(messages, currentSessionId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    const prev = previousUserIdRef.current;
    previousUserIdRef.current = user?.id;
    if (prev && user?.id !== prev) {
      setLoading(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [user?.id]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // 1. Initialize Sessions from LocalStorage (strictly scoped to user after auth resolves)
  useEffect(() => {
    if (typeof window === 'undefined' || authLoading) return;

    const nextScope = resolveSessionScopeKey(user?.id);
    if (activeScopeRef.current && activeScopeRef.current !== nextScope) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setLoading(false);
      setQuotaState(null);
      setSessions([]);
      setCurrentSessionId('');
      setMessages(INITIAL_MESSAGES);
    }
    activeScopeRef.current = nextScope;

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
  }, [user?.id, authLoading]);

  // Reset transient AI chat & in-flight state immediately on session boundary transitions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBoundary = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setLoading(false);
      setQuotaState(null);
      setSessions([]);
      setCurrentSessionId('');
      setMessages(INITIAL_MESSAGES);
    };
    window.addEventListener(SESSION_BOUNDARY_EVENT, handleBoundary);
    return () => window.removeEventListener(SESSION_BOUNDARY_EVENT, handleBoundary);
  }, []);

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

  // Handle URL prompt or sourced news analysis query params
  const promptProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    const parsedNews = parseNewsAnalysisSearchParams(searchParams);
    if (parsedNews) {
      const newsKey = `${parsedNews.news.source}:${parsedNews.news.title}:${parsedNews.includePortfolio}`;
      if (promptProcessedRef.current !== newsKey) {
        promptProcessedRef.current = newsKey;
        setPendingNewsContext(parsedNews.news);
        setIncludePortfolioContext(parsedNews.includePortfolio);
        setInput(buildDefaultNewsQuestion(parsedNews.news, parsedNews.includePortfolio));
      }
      return;
    }

    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && urlPrompt !== promptProcessedRef.current) {
      promptProcessedRef.current = urlPrompt;
      const includeFromParam = searchParams.get('includePortfolio');
      const shouldAttach = includeFromParam === '1' || includeFromParam === 'true';
      handleSendMessage(urlPrompt, shouldAttach);
    }
  }, [searchParams]);

  // 8. Send & Retry Message
  const sendChatMessages = async (
    baseHistory: Message[],
    cleanText: string,
    shouldIncludePortfolio: boolean,
    attachedNews?: NewsAnalysisContext | null
  ) => {
    const hasCustomKey = Boolean(activeCustomKey);
    const activeNewsContext = attachedNews !== undefined ? attachedNews : pendingNewsContext;
    setLoading(true);
    followLatest();

    // Extract current portfolio state ONLY when the user explicitly opted in,
    // minimized to the fields required by the question type (AIP-02).
    let portfolioPayload: ReturnType<typeof buildPortfolioContextPayload> = undefined;
    try {
      if (shouldIncludePortfolio) {
        const summary = usePortfolioStore.getState().getSummary();
        portfolioPayload = buildPortfolioContextPayload(summary, true, {
          prompt: cleanText,
          scope: portfolioContextScope,
        });
      }
    } catch (_) {}

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Sanitize model: if non-pro user and no active custom API key, ensure they don't send a pro model
    let effectiveModel = selectedModel;
    const isFreeModel = selectedModel === AUTO_MODEL.id || models.some((m) => m.id === selectedModel && m.free);
    if (!isFreeModel && !proModelsAllowed && !activeCustomKey) {
      effectiveModel = AUTO_MODEL.id;
      setSelectedModel(AUTO_MODEL.id);
    }

    // Exclude welcome greeting and error/cancel alerts from model history
    const validHistory = baseHistory.filter(
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
          apiKey: activeCustomKey,
          portfolioContext: portfolioPayload,
          newsContext: activeNewsContext || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) || {};
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
          provenance: data.provenance || data.message.provenance,
        };
        updateCurrentSessionMessages([...baseHistory, assistantMessage]);
      } else {
        const classified = classifyChatFailure({
          status: res.status,
          code: data.code,
          error: data.error,
          retryAfterSeconds: data.quota?.retryAfter ?? data.quota?.resetInSeconds,
        });
        if (data.code === 'HOURLY_QUOTA_EXCEEDED' && !data.quota?.isPro && !hasCustomKey) {
          setShowQuotaExceededModal(true);
        }
        if (data.code === 'PRO_REQUIRED') {
          setSelectedModel(AUTO_MODEL.id);
          setShowProModal(true);
        }
        updateCurrentSessionMessages([
          ...baseHistory,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `**${classified.title}:** ${classified.message}`,
            createdAt: new Date().toISOString(),
            errorInfo: { ...classified, retryPrompt: cleanText },
          },
        ]);
      }
    } catch (err: any) {
      if (abortControllerRef.current !== controller) return;
      const isAbort = err?.name === 'AbortError';
      const classified = classifyChatFailure({
        aborted: isAbort,
        networkError: !isAbort,
      });
      updateCurrentSessionMessages([
        ...baseHistory,
        {
          id: isAbort ? `stop-${Date.now()}` : `err-${Date.now()}`,
          role: 'assistant',
          content: `**${classified.title}:** ${classified.message}`,
          createdAt: new Date().toISOString(),
          errorInfo: { ...classified, retryPrompt: cleanText },
        },
      ]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSendMessage = async (userText: string, includePortfolioOverride?: boolean) => {
    const cleanText = userText.trim();
    if (!cleanText || loading || abortControllerRef.current) return;

    const shouldIncludePortfolio = includePortfolioOverride ?? includePortfolioContext;
    if (includePortfolioOverride === true && !includePortfolioContext) {
      setIncludePortfolioContext(true);
    }

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

    const newsToAttach = pendingNewsContext;
    const newMessages = [...messages, userMessage];
    updateCurrentSessionMessages(newMessages);
    setInput('');
    if (newsToAttach) {
      setPendingNewsContext(null);
    }
    await sendChatMessages(newMessages, cleanText, shouldIncludePortfolio, newsToAttach);
  };

  const handleRetryFailedPrompt = async (errorMessageId: string, promptText: string) => {
    if (loading || abortControllerRef.current || !promptText.trim()) return;
    const cleanedHistory = messages.filter((m) => m.id !== errorMessageId);
    updateCurrentSessionMessages(cleanedHistory);
    await sendChatMessages(cleanedHistory, promptText, includePortfolioContext);
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-sm font-bold text-text-primary truncate">StockMind AI</h1>
                {activeCustomKey ? (
                  <button
                    type="button"
                    onClick={() => setShowQuotaDetailsModal(true)}
                    title="Özel OpenRouter API anahtarı aktif (Limitsiz). Ayrıntılar için dokunun."
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer shrink-0"
                  >
                    Limitsiz
                  </button>
                ) : quotaState ? (
                  <button
                    type="button"
                    onClick={() => setShowQuotaDetailsModal(true)}
                    title={
                      quotaState.remaining === 0
                        ? 'Saatlik soru limitiniz doldu. Ayrıntılar için dokunun.'
                        : `Kalan soru hakkı: ${quotaState.remaining}/${quotaState.isPro ? 20 : 5}. Ayrıntılar için dokunun.`
                    }
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer shrink-0 ${
                      quotaState.remaining === 0
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40 font-bold'
                        : quotaState.remaining === 1
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold'
                        : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    }`}
                  >
                    {quotaState.remaining === 0 ? 'Limit doldu' : `${quotaState.remaining}/${quotaState.isPro ? 20 : 5}`}
                  </button>
                ) : null}
              </div>
              <p className="text-[10px] text-text-muted truncate">Finans asistanı</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="ai-saved-reports-btn"
              onClick={() => setShowSavedReportsModal(true)}
              aria-label="Kayıtlı Analizler"
              title="Kayıtlı Analizler"
              className={`inline-flex items-center gap-1 px-2 ${isKeyboardOpen ? 'h-7' : 'h-8.5 sm:h-9'} rounded-xl border border-border text-[11px] font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer`}
            >
              <span>Kayıtlı</span>
              {savedReports.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-accent/15 text-accent text-[10px]">
                  {savedReports.length}
                </span>
              )}
            </button>
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

        {/* Row 2: Unified Model, Quota, Cost & Key Visibility Strip */}
        <div
          data-testid="ai-usage-visibility-strip"
          className={`${isKeyboardOpen ? 'hidden sm:flex' : 'flex'} flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/50`}
        >
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] text-text-muted shrink-0 font-medium">Model:</span>
            <button
              type="button"
              onClick={() => {
                setModelSearchQuery('');
                setShowModelModal(true);
              }}
              className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-xs text-text-primary transition-colors cursor-pointer max-w-full truncate"
              title="AI Modeli Seçin"
            >
              <span className="truncate font-medium">{currentModel.name}</span>
              {currentModel.free ? (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-semibold shrink-0">
                  Ücretsiz
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-800 dark:text-amber-400 font-semibold shrink-0">
                  Pro
                </span>
              )}
              <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setShowQuotaDetailsModal(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg bg-bg-secondary/80 border border-border text-[10px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              title="Kota, maliyet ve kişisel anahtar ayrıntılarını aç"
            >
              <span>{usageVisibility.keyModeLabel}</span>
              <span>•</span>
              <span>{usageVisibility.costTierLabel}</span>
              <span>•</span>
              <span>{usageVisibility.quotaLabel}</span>
              <span className="hidden md:inline">• {usageVisibility.resetTimeLabel}</span>
            </button>

            {hasSavedCustomKey && (
              <button
                type="button"
                data-testid="ai-key-mode-toggle"
                onClick={() => setUsePersonalKey((prev) => !prev)}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-accent/30 bg-accent/10 text-accent text-[10px] font-semibold hover:bg-accent/20 transition-colors cursor-pointer"
              >
                {usePersonalKey ? 'Kişisel Anahtar Aktif (Platforma Geç)' : 'Platform Kotası Aktif (Kişisele Geç)'}
              </button>
            )}
          </div>
          {modelWarning && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 truncate max-w-[150px] shrink-0" title={modelWarning}>
              {modelWarning}
            </span>
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

                  {!isUser && msg.errorInfo && (
                    <div
                      data-testid="ai-error-actions"
                      className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[10px]"
                    >
                      <span
                        data-testid="ai-error-category-badge"
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-bg-secondary border border-border text-text-muted font-medium"
                      >
                        {msg.errorInfo.category === 'network' && 'Durum: Ağ Kesintisi'}
                        {msg.errorInfo.category === 'quota' && 'Durum: Kota / Hız Sınırı'}
                        {msg.errorInfo.category === 'model' && 'Durum: Model Hatası'}
                        {msg.errorInfo.category === 'cancelled' && 'Durum: Kullanıcı İptali'}
                        {msg.errorInfo.category === 'auth' && 'Durum: Oturum / Yetki'}
                        {msg.errorInfo.category === 'unknown' && 'Durum: Bilinmeyen Hata'}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {msg.errorInfo.retryable && msg.errorInfo.retryPrompt && (
                          <button
                            type="button"
                            data-testid="ai-error-retry-button"
                            onClick={() => handleRetryFailedPrompt(msg.id, msg.errorInfo!.retryPrompt!)}
                            className="px-2 py-1 rounded-lg bg-accent/15 text-accent font-semibold hover:bg-accent/25 transition-colors cursor-pointer"
                          >
                            Yeniden Dene
                          </button>
                        )}
                        {msg.errorInfo.suggestModelSwitch && (
                          <button
                            type="button"
                            onClick={() => setShowModelModal(true)}
                            className="px-2 py-1 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          >
                            Model Değiştir
                          </button>
                        )}
                        {msg.errorInfo.suggestSettingsKey && (
                          <a
                            href="/settings"
                            className="px-2 py-1 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
                          >
                            API Anahtarı / Ayarlar
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {!isUser && (msg.sourceScope || msg.provenance) && (
                    <div
                      data-testid="ai-response-provenance"
                      className="pt-2 border-t border-border/40 space-y-1.5 text-[10px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {msg.sourceScope === 'live_market_data' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Sağlayıcı Verisi: {msg.provenance?.dataSources?.length ? msg.provenance.dataSources.join(' • ') : 'Piyasa verisi bağlama eklendi'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                              <span><UIIcon name="sparkles" className="w-3.5 h-3.5" /></span>
                              Canlı Sağlayıcı Verisi Yok
                            </span>
                          )}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-medium">
                            Genel Model Yorumu (Doğrulama gerektirir)
                          </span>
                        </div>
                        {(msg.provenance?.observedAt || msg.asOf) && (
                          <span className="text-text-muted">
                            {msg.provenance?.observedAt
                              ? `Veri saati: ${new Date(msg.provenance.observedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} TSİ`
                              : ''}
                            {msg.provenance?.observedAt && msg.asOf ? ' • ' : ''}
                            {msg.asOf
                              ? `Yanıt: ${new Date(msg.asOf).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} TSİ`
                              : ''}
                          </span>
                        )}
                      </div>

                      {msg.provenance && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-text-muted">
                          <span>
                            Kapsam:{' '}
                            {msg.provenance.portfolioScope === 'none'
                              ? 'Portföy eklenmedi (Genel soru)'
                              : PORTFOLIO_SCOPE_LABELS[msg.provenance.portfolioScope]}
                          </span>
                          <span>• {msg.provenance.modelCommentaryNote}</span>
                        </div>
                      )}

                      {msg.provenance?.missingSummary && (
                        <div
                          data-testid="ai-missing-data-notice"
                          className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-amber-300"
                        >
                          <strong>Eksik veri:</strong> {msg.provenance.missingSummary}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${isUser ? 'text-white/70 justify-end' : 'text-text-muted'}`}>
                    {!isUser && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] text-text-muted/70 italic truncate">
                          StockMind AI yatırım tavsiyesi vermez.
                        </span>
                        {msg.id !== 'msg-welcome' && !msg.errorInfo && (
                          <button
                            type="button"
                            data-testid="ai-save-analysis-btn"
                            onClick={() => {
                              const modelLabel =
                                models.find((m) => m.id === selectedModel)?.name || selectedModel;
                              const assumptions = [
                                includePortfolioContext
                                  ? `Portföy kapsamı: ${PORTFOLIO_SCOPE_LABELS[effectivePortfolioScope]}`
                                  : 'Portföy verisi dahil edilmedi.',
                                activeCustomKey ? 'Kişisel OpenRouter API anahtarı kullanıldı.' : 'Uygulama kotası üzerinden üretildi.',
                              ];
                              const saved = saveAnalysisReport(
                                buildSavedReportFromChatMessage({
                                  message: msg,
                                  model: modelLabel,
                                  assumptions,
                                }),
                                undefined,
                                user?.id
                              );
                              setSavedReports(listSavedAnalysisReports(undefined, user?.id));
                              setSavedToastId(saved.id);
                              setTimeout(() => setSavedToastId(null), 2000);
                            }}
                            className="text-[10px] font-semibold text-accent hover:underline shrink-0 cursor-pointer"
                          >
                            {savedToastId && msg.id ? 'Analiz Kaydedildi' : 'Analizi Kaydet'}
                          </button>
                        )}
                      </div>
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
              onClick={() => handleSendMessage(sug.prompt, sug.requiresPortfolio)}
              className="px-3 sm:px-3.5 py-2 sm:py-1.5 rounded-full text-[11px] sm:text-xs bg-bg-secondary/90 hover:bg-bg-tertiary border border-border/80 text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-sm active:scale-[0.98]"
            >
              {sug.label}
            </button>
          ))}
        </div>
      )}

      {/* Attached Sourced News Context Preview Card (AIP-06) */}
      {pendingNewsContext && (
        <div
          data-testid="ai-news-context-card"
          className="shrink-0 mb-2 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-xs space-y-1.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[10px] font-bold">
                  Haber Kaynağı: {pendingNewsContext.source}
                </span>
                {pendingNewsContext.relatedSymbols?.length ? (
                  <span className="text-[10px] text-text-muted font-medium">
                    Semboller: {pendingNewsContext.relatedSymbols.join(', ')}
                  </span>
                ) : null}
              </div>
              <p className="font-semibold text-text-primary leading-snug">{pendingNewsContext.title}</p>
              {pendingNewsContext.summary && (
                <p className="text-[11px] text-text-secondary line-clamp-2">{pendingNewsContext.summary}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPendingNewsContext(null)}
              aria-label="Haber bağlamını kaldır"
              className="text-text-muted hover:text-text-primary px-1 cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-[11px] text-text-primary cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="ai-news-portfolio-toggle"
              checked={includePortfolioContext}
              onChange={(e) => {
                const next = e.target.checked;
                setIncludePortfolioContext(next);
                setInput(buildDefaultNewsQuestion(pendingNewsContext, next));
              }}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Portföy bağlamımı bu haber analizine dahil et (isteğe bağlı)</span>
          </label>
        </div>
      )}

      {/* Portfolio Context Opt-in Controls */}
      <div className="shrink-0 mb-1.5 px-1 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="toggle-portfolio-context"
              aria-pressed={includePortfolioContext}
              onClick={() => setIncludePortfolioContext((prev) => !prev)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                includePortfolioContext
                  ? 'bg-accent/15 border-accent/50 text-accent'
                  : 'bg-bg-secondary/90 border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
              }`}
            >
              <span>{includePortfolioContext ? '✓ Portföy Analizde' : '+ Portföyü Analize Ekle'}</span>
              <span className="text-[10px] opacity-80">
                ({portfolioHoldingsCount > 0 ? `${portfolioHoldingsCount} varlık` : 'Boş'})
              </span>
            </button>

            <span className="text-[11px] text-text-muted">
              {includePortfolioContext
                ? 'Seçili portföy alanları AI isteğine eklenecek.'
                : 'Genel soru modu: Portföy verileri gönderilmiyor.'}
            </span>
          </div>

          <button
            type="button"
            aria-expanded={showPortfolioFieldsInfo}
            onClick={() => setShowPortfolioFieldsInfo((prev) => !prev)}
            className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
          >
            {showPortfolioFieldsInfo ? 'Alanları gizle' : 'Kullanılacak alanları gör'}
          </button>
        </div>

        {(showPortfolioFieldsInfo || includePortfolioContext) && (
          <div
            data-testid="portfolio-context-fields"
            className="rounded-xl border border-border/80 bg-bg-secondary/70 px-3 py-2 text-[11px] text-text-secondary space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-text-primary">
                {includePortfolioContext
                  ? `AI analizine gönderilecek kapsam: ${PORTFOLIO_SCOPE_LABELS[effectivePortfolioScope]}`
                  : `Portföy eklenirse kapsam: ${PORTFOLIO_SCOPE_LABELS[effectivePortfolioScope]}`}
              </p>
              <select
                aria-label="Portföy veri kapsamı"
                data-testid="portfolio-scope-select"
                value={portfolioContextScope}
                onChange={(e) => setPortfolioContextScope(e.target.value as PortfolioFieldScopePreference)}
                className="rounded-lg border border-border bg-bg-primary px-2 py-0.5 text-[10px] font-medium text-text-primary"
              >
                <option value="auto">Otomatik (Soru Türüne Göre Azalt)</option>
                <option value="allocation_weights">Yalnız Dağılım &amp; Ağırlık</option>
                <option value="performance_returns">Dağılım &amp; Getiri (%)</option>
                <option value="full_financials">Tam Tutar &amp; Maliyetler</option>
              </select>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-text-muted">
              {PORTFOLIO_CONTEXT_FIELDS.map((field) => {
                const included = effectivePortfolioFields.some((f) => f.key === field.key);
                return (
                  <li key={field.key} className={included ? 'text-text-secondary font-medium' : 'line-through opacity-55'}>
                    {included ? '✓' : '×'} {field.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Input Box - Mobile Ergonomic */}
      <div className="glass-card p-1.5 sm:p-2 rounded-2xl border border-border shrink-0 flex items-center gap-1.5 sm:gap-2 shadow-sm mb-1 sm:mb-0 pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:pb-2 focus-within:border-accent/80 focus-within:ring-1 focus-within:ring-accent/30 transition-all">
        <input
          type="text"
          aria-label="Hisse, fon veya teknik analiz sorusu sorun"
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

      {/* Quota, Cost, Model & Key Details Modal */}
      {showQuotaDetailsModal && (
        <Modal
          isOpen={showQuotaDetailsModal}
          onClose={() => setShowQuotaDetailsModal(false)}
          title="Model, Kota ve Anahtar Özeti"
          size="sm"
        >
          <div data-testid="ai-quota-visibility-modal" className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Seçili Model</span>
                <span className="font-semibold text-text-primary">{usageVisibility.modelName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Maliyet / Plan</span>
                <span className="font-semibold text-text-primary">{usageVisibility.costTierLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Kalan Kota</span>
                <span className="font-bold text-text-primary">{usageVisibility.quotaLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Kota Yenilenme Zamanı</span>
                <span className="font-medium text-text-primary">{usageVisibility.resetTimeLabel}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">API Anahtarı Kaynağı</span>
                <span className="font-medium text-text-primary">{usageVisibility.keyModeLabel}</span>
              </div>
              <p className="pt-2 border-t border-border/60 text-[11px] text-text-muted leading-relaxed">
                {usageVisibility.costDescription}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-bg-secondary/60 border border-border space-y-2">
              <p className="text-xs font-semibold text-text-primary">Kişisel Anahtar ve Model Tercihi</p>
              <div className="flex flex-wrap gap-2">
                {hasSavedCustomKey ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setUsePersonalKey((prev) => !prev)}
                  >
                    {usePersonalKey ? 'Platform Kotasını Kullan' : 'Kişisel Anahtarı Kullan'}
                  </Button>
                ) : (
                  <a
                    href="/settings"
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-bg-card border border-border text-xs font-semibold text-text-primary hover:bg-bg-hover"
                  >
                    Ayarlar &gt; Kişisel OpenRouter Anahtarı Ekle
                  </a>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowQuotaDetailsModal(false);
                    setModelSearchQuery('');
                    setShowModelModal(true);
                  }}
                >
                  Model Değiştir
                </Button>
              </div>
            </div>

            {!quotaState?.isPro && !activeCustomKey && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/25 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-sm">⭐</span>
                  <p className="text-xs font-bold text-text-primary">StockMind Pro ile 4 Kat Fazla Soru</p>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Pro üyeler saat başı 20 soru sorabilir ve Pro modelleri platform kotasıyla kullanabilir.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setShowQuotaDetailsModal(false);
                    setShowProModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-2 shadow-sm"
                >
                  Pro&apos;ya Yükselt (20 Soru/Saat)
                </Button>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={() => setShowQuotaDetailsModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Model Selector Modal with Search, Recent, Free and Pro groups */}
      {showModelModal && (
        <Modal
          isOpen={showModelModal}
          onClose={() => setShowModelModal(false)}
          title="AI Modeli Seçin"
          description="Finans analizleri için optimize edilmiş açık ve ticari modeller"
          size="md"
        >
          <div className="space-y-3 pt-1">
            {/* Search Input */}
            <div className="relative">
              <input
                type="search"
                aria-label="AI modeli ara"
                placeholder="Model ara... (örn: gpt, gemini, claude, deepseek)"
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl bg-bg-input border border-border text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted" aria-hidden="true">🔍</span>
              {modelSearchQuery && (
                <button
                  type="button"
                  aria-label="Model aramasını temizle"
                  onClick={() => setModelSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              {/* Son Kullanılanlar */}
              {!modelSearchQuery && recentModelObjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    Son Kullanılanlar
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recentModelObjects.map((model) => (
                      <button
                        key={`recent-${model.id}`}
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          selectedModel === model.id
                            ? 'border-accent bg-accent/10 text-text-primary'
                            : 'border-border bg-bg-card hover:border-accent/40 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium truncate">{model.name}</p>
                        </div>
                        {model.free ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-semibold shrink-0">
                            Ücretsiz
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-400 font-semibold shrink-0">
                            Pro
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ücretsiz Modeller */}
              {filteredFreeModels.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                    Ücretsiz Modeller ({filteredFreeModels.length})
                  </p>
                  <div className="space-y-1">
                    {filteredFreeModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          selectedModel === model.id
                            ? 'border-accent bg-accent/10 text-text-primary'
                            : 'border-border bg-bg-card hover:border-accent/40 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold truncate text-text-primary">{model.name}</p>
                          <p className="text-[10px] text-text-muted truncate">{model.id}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                            Ücretsiz
                          </span>
                          {selectedModel === model.id && (
                            <span className="text-accent text-xs font-bold">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro Modeller */}
              {filteredProModels.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                      Pro Modeller ({filteredProModels.length})
                    </p>
                    {!proModelsAllowed && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Pro üyelik gerekir</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {filteredProModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          selectedModel === model.id
                            ? 'border-accent bg-accent/10 text-text-primary'
                            : 'border-border bg-bg-card hover:border-accent/40 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold truncate text-text-primary">{model.name}</p>
                          <p className="text-[10px] text-text-muted truncate">{model.id}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {proModelsAllowed ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-400 font-semibold border border-amber-500/20">
                              Pro
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-secondary text-text-muted border border-border flex items-center gap-1">
                              🔒 Pro
                            </span>
                          )}
                          {selectedModel === model.id && (
                            <span className="text-accent text-xs font-bold">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Saved Analysis Reports Modal (AIP-08) */}
      {showSavedReportsModal && (
        <Modal
          isOpen={showSavedReportsModal}
          onClose={() => {
            setShowSavedReportsModal(false);
            setActiveSavedReport(null);
          }}
          title="Kayıtlı Analiz Raporları"
          description="Kaydedilmiş raporlar sembol, veri tarihi, model ve varsayımlarıyla saklanır."
          size="lg"
        >
          <div data-testid="saved-reports-modal" className="space-y-4 text-xs">
            {activeSavedReport ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{activeSavedReport.title}</h3>
                    <p className="text-[11px] text-text-muted">
                      Sembol: <strong className="font-mono text-text-primary">{activeSavedReport.symbol}</strong> • Veri Tarihi:{' '}
                      {new Date(activeSavedReport.dataDate).toLocaleString('tr-TR')} • Model: {activeSavedReport.model}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveSavedReport(null)}
                  >
                    Listeye Dön
                  </Button>
                </div>
                <div className="rounded-xl bg-bg-secondary/50 border border-border/60 p-2.5 space-y-1">
                  <div className="font-semibold text-text-primary">Varsayımlar ve Veri Kapsamı</div>
                  {activeSavedReport.assumptions.map((a) => (
                    <p key={a} className="text-[11px] text-text-secondary">• {a}</p>
                  ))}
                  {activeSavedReport.missingDataNotes.map((m) => (
                    <p key={m} className="text-[11px] text-warning">• {m}</p>
                  ))}
                </div>
                <div className="rounded-xl border border-border/70 bg-bg-card p-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-xs text-text-primary">
                  {activeSavedReport.contentMarkdown}
                </div>
              </div>
            ) : savedReports.length === 0 ? (
              <p className="text-text-muted py-6 text-center">
                Henüz kaydedilmiş analiz raporu yok. AI yanıtlarının altındaki &ldquo;Analizi Kaydet&rdquo; veya Yatırım Komitesi&apos;ndeki &ldquo;Raporu Kaydet&rdquo; düğmesini kullanabilirsiniz.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedReports.map((item) => (
                  <div
                    key={item.id}
                    data-testid="saved-report-item"
                    className="rounded-xl border border-border/70 bg-bg-secondary/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="accent" size="sm">{item.symbol}</Badge>
                        <span className="font-bold text-text-primary truncate">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Veri: {new Date(item.dataDate).toLocaleString('tr-TR')} • Model: {item.model}
                      </p>
                      <p className="text-[11px] text-text-secondary truncate">
                        Varsayım: {item.assumptions.join(' | ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveSavedReport(item)}
                      >
                        Yeniden Aç
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSavedReports(deleteSavedAnalysisReport(item.id, undefined, user?.id))}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
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
