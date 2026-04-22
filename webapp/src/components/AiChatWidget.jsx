import { useState, useRef, useEffect } from 'react';
import { sendAiMessage } from '../services/api';

const QUICK_PROMPTS = [
  { label: '📊 Рынок NEAR', text: 'Расскажи про текущее состояние рынка NEAR и основные тренды' },
  { label: '🔥 HOT Protocol', text: 'Что такое HOT Protocol и стоит ли в нём участвовать?' },
  { label: '💰 DeFi советы', text: 'Какие возможности DeFi есть в экосистеме NEAR для пассивного дохода?' },
  { label: '⚡ Мой портфель', text: 'Проанализируй мой портфель и дай рекомендации' },
];

export default function AiChatWidget({ walletContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Привет! Я NearPulse AI — твой аналитик NEAR и крипторынка.\n\nМогу помочь с анализом рынка, оценкой портфеля и советами по DeFi. Спрашивай!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  const getHistory = () =>
    messages
      .filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0)
      .map((m) => ({ role: m.role, content: m.content }));

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = getHistory();
      const { reply } = await sendAiMessage(trimmed, history, walletContext);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Ошибка соединения с AI. Попробуй позже.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-white font-semibold text-sm transition-all active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
        }}
      >
        <span className="text-base">🤖</span>
        <span>AI Анализ</span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-2xl overflow-hidden"
            style={{ background: '#fff', maxHeight: '85vh' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🤖</div>
                <div>
                  <div className="text-white font-semibold text-sm">NearPulse AI</div>
                  <div className="text-white/70 text-xs">NEAR & Крипто аналитик</div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Quick Prompts */}
            {messages.length <= 1 && (
              <div className="px-4 py-3 flex gap-2 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #f0f0f0' }}>
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => sendMessage(p.text)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95"
                    style={{ background: '#f5f3ff', color: '#6366f1', borderColor: '#e0d9ff' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderBottomRightRadius: 4 }
                        : { background: '#f5f5f5', color: '#1a1a1a', borderBottomLeftRadius: 4 }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: '#f5f5f5', borderBottomLeftRadius: 4 }}>
                    <span className="inline-flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="px-4 py-3 flex gap-2 items-end flex-shrink-0"
              style={{ borderTop: '1px solid #f0f0f0', background: '#fff' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спроси про NEAR, рынок, портфель..."
                rows={1}
                className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  background: '#f5f5f5',
                  border: '1.5px solid #e8e8e8',
                  maxHeight: 80,
                  lineHeight: '1.4',
                  color: '#1a1a1a',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                onBlur={(e) => (e.target.style.borderColor = '#e8e8e8')}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
