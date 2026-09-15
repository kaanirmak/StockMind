'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { Button, Input, Badge } from '@/components/ui';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content: `👋 **Merhaba! Ben StockMind AI Finansal Asistanınız.**

BIST ve ABD hisseleri, TEFAS yatırım fonları, teknik analiz göstergeleri (RSI, MACD, Bollinger) ve portföy optimizasyonu konularında size rehberlik etmek için buradayım.

Aşağıdaki hızlı konulardan birini seçebilir veya aklınızdaki soruyu sorabilirsiniz:`,
    createdAt: new Date().toISOString(),
  },
];

const PROMPT_SUGGESTIONS = [
  { label: '📊 Portföyümü Analiz Et', prompt: 'Portföyümdeki hisse ve fon dağılımının risk ve getiri potansiyelini analiz et.' },
  { label: '✈️ THYAO Teknik Analiz', prompt: 'THYAO hissesi için teknik göstergeleri incele ve AL/SAT sinyal durumunu belirt.' },
  { label: '🏦 En İyi TEFAS Fonları', prompt: 'Son 1 yılda en çok kazandıran TEFAS fonları ve dengeli bir fon sepeti önerisi ver.' },
  { label: '🛡️ Enflasyon Korumalı Sepet', prompt: 'Yüksek enflasyon ortamında alım gücünü korumak için hisse ve altın fonu stratejisi oluştur.' },
];

function AIAssistantContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(AVAILABLE_MODELS[0].id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || loading) return;

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

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
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
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ Üzgünüm, şu an bağlantı kurulamadı. Lütfen tekrar deneyin.',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Ağ hatası oluştu. Lütfen bağlantınızı kontrol edin.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      {/* Top Header & Model Selector */}
      <div className="glass-card p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center text-white shadow-lg shadow-accent/25">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text-primary">StockMind AI Danışman</h1>
              <Badge variant="success" size="sm" dot>
                OpenRouter AI
              </Badge>
            </div>
            <p className="text-xs text-text-muted">BIST, TEFAS ve Küresel Piyasalar Analiz Motoru</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-bg-input text-text-primary text-xs rounded-xl border border-border px-3.5 py-2 focus:border-accent focus:outline-none"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleClearChat}
            className="p-2 text-text-muted hover:text-text-primary rounded-xl border border-border hover:bg-bg-hover transition-colors text-xs"
            title="Sohbeti Temizle"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isUser
                    ? 'bg-accent text-white shadow-md shadow-accent/20'
                    : 'bg-gradient-to-tr from-accent to-accent-secondary text-white'
                }`}
              >
                {isUser ? 'Siz' : 'AI'}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-2xl p-4 rounded-2xl text-sm leading-relaxed ${
                  isUser
                    ? 'bg-accent text-white rounded-tr-sm shadow-md shadow-accent/15'
                    : 'glass-card border-border/80 text-text-primary rounded-tl-sm space-y-2'
                }`}
              >
                <div className="whitespace-pre-line prose prose-invert max-w-none text-xs sm:text-sm">
                  {msg.content}
                </div>
                <div className={`text-[10px] mt-1 ${isUser ? 'text-white/70 text-right' : 'text-text-muted'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-accent-secondary text-white flex items-center justify-center text-xs font-bold shrink-0">
              AI
            </div>
            <div className="glass-card p-4 rounded-2xl rounded-tl-sm border-border/80 flex items-center gap-2 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              <span>StockMind analiz yapıyor ve yanıt oluşturuyor...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Prompt Suggestions */}
      {messages.length <= 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 shrink-0">
          {PROMPT_SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              onClick={() => handleSendMessage(sug.prompt)}
              className="px-3 py-1.5 rounded-full text-xs bg-bg-secondary border border-border/80 text-text-secondary hover:text-accent hover:border-accent transition-all cursor-pointer shrink-0"
            >
              {sug.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="glass-card p-2 shrink-0 flex items-center gap-2">
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
          placeholder="Hisse senedi, TEFAS fonu veya teknik analiz hakkında bir soru sorun..."
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <Button
          variant="primary"
          size="md"
          onClick={() => handleSendMessage(input)}
          disabled={!input.trim() || loading}
          isLoading={loading}
          className="shrink-0"
        >
          Gönder
        </Button>
      </div>
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
