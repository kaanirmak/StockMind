'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isKeyPrompt?: boolean;
  pendingPrompt?: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content: `👋 **Merhaba! Ben StockMind AI Finansal Asistanınız.**

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

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempKeyInput, setTempKeyInput] = useState<string>('');
  const [inlineKeyInputs, setInlineKeyInputs] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load custom API key and default model from unified storage and sync automatically
  useEffect(() => {
    const key = getStoredOpenRouterKey(user?.id);
    if (key) {
      setCustomApiKey(key);
      setTempKeyInput(key);
    }
    const model = getStoredDefaultModel(user?.id);
    if (model) {
      setSelectedModel(model);
    }

    const handleSync = () => {
      const refreshedKey = getStoredOpenRouterKey(user?.id);
      setCustomApiKey(refreshedKey);
      setTempKeyInput(refreshedKey);
      const refreshedModel = getStoredDefaultModel(user?.id);
      if (refreshedModel) setSelectedModel(refreshedModel);
    };

    window.addEventListener('stockmind_ai_key_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('stockmind_ai_key_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [user]);

  const saveCustomKey = (key: string) => {
    const trimmed = key.trim();
    setCustomApiKey(trimmed);
    setTempKeyInput(trimmed);
    saveStoredOpenRouterKey(trimmed, user?.id, selectedModel);
    setShowKeyModal(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle URL prompt query param
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && messages.length === 1) {
      handleSendMessage(urlPrompt);
    }
  }, [searchParams]);

  const handleSendMessage = async (userText: string, overrideKey?: string) => {
    const activeKey = (
      overrideKey !== undefined
        ? overrideKey
        : (customApiKey || getStoredOpenRouterKey(user?.id) || '')
    ).trim();

    if (activeKey && !customApiKey) {
      setCustomApiKey(activeKey);
      setTempKeyInput(activeKey);
    }

    if (!userText.trim() || loading) return;

    // 1. If user doesn't have an API key, DO NOT return dummy answers. Prompt directly for the key!
    if (!activeKey) {
      const userMessage: Message = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: userText,
        createdAt: new Date().toISOString(),
      };

      const keyPromptMessage: Message = {
        id: `key-req-${Date.now() + 1}`,
        role: 'assistant',
        content: `🔑 **Canlı AI Analizi İçin API Anahtarı Gerekli**\n\n"${userText}" sorunuzu canlı yapay zeka modelleriyle analiz edebilmem için lütfen OpenRouter API anahtarınızı tanımlayın.\n\n*Sahte/dummy yanıtlar verilmemektedir.* Anahtarınızı aşağıya girip kaydettiğinizde sorunuz anında analiz edilecektir.`,
        createdAt: new Date().toISOString(),
        isKeyPrompt: true,
        pendingPrompt: userText,
      };

      setMessages((prev) => [...prev, userMessage, keyPromptMessage]);
      setInput('');
      return;
    }

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // 2. Extract current portfolio state from application store
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

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => !m.isKeyPrompt)
            .map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          apiKey: activeKey || undefined,
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
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (data.requiresApiKey) {
        // API explicitly reported missing key
        setMessages((prev) => [
          ...prev,
          {
            id: `key-req-${Date.now()}`,
            role: 'assistant',
            content: `🔑 **API Anahtarı Gerekli:** ${data.error}`,
            createdAt: new Date().toISOString(),
            isKeyPrompt: true,
            pendingPrompt: userText,
          },
        ]);
      } else {
        const errorText = data.error || 'AI yanıtı alınamadı.';
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **AI Hatası:**\n\n${errorText}\n\n*Lütfen API anahtarınızın geçerliliğini ve model bakiyenizi kontrol edin.*`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Ağ Bağlantı Hatası:** ${err?.message || 'Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineKeySubmit = (messageId: string, pendingPrompt?: string) => {
    const enteredKey = (inlineKeyInputs[messageId] || '').trim();
    if (!enteredKey) return;

    saveCustomKey(enteredKey);

    // If there was a pending question waiting for the key, execute it right away!
    if (pendingPrompt) {
      handleSendMessage(pendingPrompt, enteredKey);
    }
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4.5rem-0.75rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-4rem-2.5rem)] -mb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:mb-0 pb-1.5 md:pb-0 overflow-hidden animate-fade-in relative">
      {/* Top Header - Compact for Mobile, Detailed for Desktop */}
      <div className="glass-card p-2.5 sm:p-4 mb-2 sm:mb-3 shrink-0 rounded-2xl border border-border">
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
              <button
                type="button"
                onClick={() => {
                  setTempKeyInput(customApiKey);
                  setShowKeyModal(true);
                }}
                className="flex items-center gap-1 text-[10px] font-semibold text-accent hover:underline cursor-pointer"
              >
                {customApiKey ? (
                  <span className="text-emerald-500 font-mono">🟢 Key: ...{customApiKey.slice(-4)}</span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-0.5 animate-pulse">
                    ⚡ Key Tanımla
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                saveStoredOpenRouterKey(customApiKey, user?.id, e.target.value);
              }}
              className="bg-bg-input text-text-primary text-[11px] rounded-lg border border-border px-2 py-1.5 focus:border-accent focus:outline-none max-w-[130px] truncate cursor-pointer font-medium"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.split(' (')[0]}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearChat}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg border border-border hover:bg-bg-hover transition-colors text-xs cursor-pointer shrink-0"
              title="Sohbeti Temizle"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
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

                {/* API Key Status Pill */}
                {customApiKey ? (
                  <button
                    onClick={() => {
                      setTempKeyInput(customApiKey);
                      setShowKeyModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/25 transition-all cursor-pointer font-mono"
                    title="Özel API anahtarınızı görüntüleyin veya değiştirin"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Key: {customApiKey.slice(0, 6)}...{customApiKey.slice(-4)}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setTempKeyInput('');
                      setShowKeyModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-500 hover:bg-amber-500/25 transition-all cursor-pointer animate-pulse"
                    title="Canlı analizler için OpenRouter anahtarınızı girin"
                  >
                    <span>⚡ API Key Tanımla</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">BIST, TEFAS ve Küresel Piyasalar Canlı Analiz Motoru</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector */}
            <select
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                saveStoredOpenRouterKey(customApiKey, user?.id, e.target.value);
              }}
              className="bg-bg-input text-text-primary text-xs rounded-xl border border-border px-3 py-2 focus:border-accent focus:outline-none max-w-[240px] truncate cursor-pointer font-medium"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleClearChat}
              className="p-2 text-text-muted hover:text-text-primary rounded-xl border border-border hover:bg-bg-hover transition-colors text-xs cursor-pointer shrink-0"
              title="Sohbeti Temizle"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Missing Key Notification Banner (Shown when no key is set yet) */}
      {!customApiKey && (
        <div className="glass-card p-3 mb-2 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">🔑</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-primary truncate">Canlı AI İçin API Anahtarı Tanımlayın</p>
              <p className="text-[11px] text-text-muted truncate">Sahte yanıtlar yerine gerçek zamanlı analiz motoru kullanılır.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTempKeyInput('');
              setShowKeyModal(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold shrink-0 hover:bg-amber-600 transition-colors cursor-pointer"
          >
            Key Gir
          </button>
        </div>
      )}

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 px-1 py-1 mb-2 custom-scrollbar">
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

                {/* Interactive Key Input Prompt (Inside Bubble) */}
                {msg.isKeyPrompt && (
                  <div className="mt-3 p-3 rounded-xl bg-bg-secondary/80 border border-accent/30 space-y-2.5 animate-fade-in">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                      <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>OpenRouter API Anahtarınızı Tanımlayın:</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={inlineKeyInputs[msg.id] || ''}
                        onChange={(e) =>
                          setInlineKeyInputs((prev) => ({
                            ...prev,
                            [msg.id]: e.target.value,
                          }))
                        }
                        placeholder="sk-or-v1-xxxxxxxx..."
                        className="flex-1 bg-bg-input text-text-primary text-xs font-mono rounded-lg border border-border px-3 py-2 focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleInlineKeySubmit(msg.id, msg.pendingPrompt)}
                        className="px-3.5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover active:scale-95 transition-all cursor-pointer shrink-0"
                      >
                        Kaydet ve Başlat
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 flex-wrap gap-1">
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-1"
                      >
                        <span>OpenRouter'dan ücretsiz key al</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <span>Tarayıcınızda güvenle saklanır</span>
                    </div>
                  </div>
                )}

                <div className={`text-[10px] mt-1 ${isUser ? 'text-white/70 text-right' : 'text-text-muted'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
              <span>{AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name.split(' (')[0] || 'AI Modeli'} canlı analiz hazırlıyor...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Prompt Suggestions - Touch-Friendly Swipe for Mobile */}
      {messages.length <= 2 && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 shrink-0 no-scrollbar -mx-1 px-1 mb-1">
          {PROMPT_SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              onClick={() => handleSendMessage(sug.prompt)}
              className="px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs bg-bg-secondary hover:bg-bg-tertiary border border-border/80 text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              {sug.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Box - Mobile Ergonomic */}
      <div className="glass-card p-1.5 sm:p-2 rounded-2xl border border-border shrink-0 flex items-center gap-1.5 sm:gap-2 shadow-sm">
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
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus:outline-none min-w-0"
        />

        {/* Mobile Icon Button */}
        <button
          type="button"
          onClick={() => handleSendMessage(input)}
          disabled={!input.trim() || loading}
          className="sm:hidden w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 hover:bg-accent-hover active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          title="Gönder"
          aria-label="Gönder"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
        </button>

        {/* Desktop Button */}
        <div className="hidden sm:block shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => handleSendMessage(input)}
            disabled={!input.trim() || loading}
            isLoading={loading}
            className="text-xs sm:text-sm px-4 py-2"
          >
            Gönder
          </Button>
        </div>
      </div>

      {/* Quick API Key Modal / Bottom Sheet */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className="glass-card max-w-md w-full p-5 sm:p-6 border border-border rounded-2xl shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">OpenRouter API Anahtarı</h3>
                  <p className="text-[11px] text-text-muted">Canlı yapay zeka analiz motoru</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary">API Anahtarı (API Key)</label>
              <input
                type="password"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx..."
                className="w-full bg-bg-input text-text-primary text-xs rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none font-mono"
              />
              <p className="text-[11px] text-text-muted">
                Anahtarınız sunucuda saklanmaz, sadece tarayıcınızda güvenle tutulur. OpenRouter üzerinden ücretsiz modeller (DeepSeek, Llama, Qwen, Gemini) dahil dilediğinizi çalıştırabilirsiniz.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {customApiKey ? (
                <button
                  type="button"
                  onClick={() => saveCustomKey('')}
                  className="text-xs text-danger hover:underline cursor-pointer font-medium"
                >
                  Anahtarı Kaldır
                </button>
              ) : (
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  <span>Ücretsiz Key Al</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowKeyModal(false)}>
                  İptal
                </Button>
                <Button variant="primary" size="sm" onClick={() => saveCustomKey(tempKeyInput)}>
                  Kaydet ve Kullan
                </Button>
              </div>
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
