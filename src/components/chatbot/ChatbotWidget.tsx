'use client';

// Mentorly AI chatbot widget (2026-11-20, chatbot + RAG slice, frontend
// half). Floating button, bottom-right, mounted once in the in-app shell
// (AppLayout) — never on the public landing page, never on an individual
// page. Answers come from POST /api/v1/chatbot/chat via chatbotService;
// the engine state line comes from GET /api/v1/chatbot/status, fetched
// once when the panel first opens (never polled).
//
// History is session-only (useState): closing the panel keeps the
// messages until the page reloads, and nothing is written to
// localStorage or any other persistent storage.
//
// When the AI engine is down or disabled the backend still answers 200
// with aiAvailable: false and an honest "AI engine unavailable" reply —
// that reply renders as a normal assistant message with a subtle amber
// treatment, never a crash. A failed send (network / 401 / 500) shows a
// small red line under the input and keeps the typed text — the message
// is never lost silently.
//
// 2026-11-21, chatbot typewriter slice: the newest assistant reply
// types out character by character (one char every
// TYPEWRITER_INTERVAL_MS, frontend-only reveal of the already-received
// reply — the backend stays non-streaming). Older replies render in
// full immediately. Clicking the reply (or the message list) shows the
// full text at once. The engine line no longer names the model id —
// it reads "AI engine: Mentorly" (2026-11-21).
//
// 2026-11-21, chatbot access + lag slice: the reply now streams in
// over POST /chatbot/chat/stream (SSE tokens via
// chatbotService.sendMessageStream, non-streaming sendMessage as the
// fallback when the stream fails before the first token). The input
// clears the instant Send is hit — the old code only cleared it after
// the reply arrived, so the typed text sat in the composer for the
// whole 1–2s round trip. A just-sent user bubble rises out of the
// composer (chatbot-send-rise keyframe, disabled under
// prefers-reduced-motion).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { chatbotService, type ChatbotHistoryItem } from '@/services/api';
import {
  TYPEWRITER_INTERVAL_MS,
  isTypingComplete,
  isTypingMessage,
  nextTypedLength,
  visibleReplyText,
} from '@/lib/typewriter';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
  // False only when the backend answered while the AI engine was
  // unavailable — the reply is still shown, with amber treatment.
  aiAvailable?: boolean;
}

const EMPTY_STATE_GREETING =
  'Hi! Ask me about your mentorship, sessions, requests, or how Mentorly works.';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT_LENGTH = 500;

let nextMessageId = 1;

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineLine, setEngineLine] = useState<string | null>(null);
  const [statusFetched, setStatusFetched] = useState(false);
  // Typewriter state: which assistant reply is currently typing out,
  // and how many of its characters are on screen. Only ever one at a
  // time — the newest assistant reply.
  const [typingId, setTypingId] = useState<number | null>(null);
  const [typedLength, setTypedLength] = useState(0);
  // Send animation (2026-11-21): id of the just-sent user bubble so
  // only that one rises out of the composer; cleared ~350ms later
  // (just after the 280ms animation). Re-renders never re-trigger it
  // because the class is keyed on this id, not on the message list.
  const [sentAnimId, setSentAnimId] = useState<number | null>(null);
  const sentAnimTimerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Never leave the animation-clear timer running after unmount.
  useEffect(() => {
    return () => {
      if (sentAnimTimerRef.current !== null) {
        window.clearTimeout(sentAnimTimerRef.current);
      }
    };
  }, []);

  // Engine state, once, when the panel first opens — never polled.
  // The line names the engine only ("AI engine: Mentorly"); the model
  // id is deliberately not shown here (2026-11-21).
  useEffect(() => {
    if (!open || statusFetched) return;
    setStatusFetched(true);
    chatbotService
      .getStatus()
      .then((status) => {
        if (status.available && status.enabled) {
          setEngineLine('AI engine: Mentorly');
        } else if (!status.enabled) {
          setEngineLine('AI engine disabled');
        } else {
          setEngineLine('AI engine unavailable');
        }
      })
      .catch(() => {
        setEngineLine('AI engine unavailable');
      });
  }, [open, statusFetched]);

  const typingMessage = messages.find((m) => m.id === typingId) ?? null;

  // Typewriter: reveal the newest assistant reply one character at a
  // time. A timeout chain (not an interval) so each tick schedules
  // exactly one more character; cleanup on unmount / message change.
  // With streaming, the reply's content grows token by token while it
  // types — nextTypedLength caps at the current content length, so the
  // reveal simply continues as more content arrives. The thinking
  // dots show while `pending` is true and no reply has started yet,
  // and stop the moment the first token arrives — the first character
  // appears one tick later.
  useEffect(() => {
    if (!typingMessage) return;
    if (isTypingComplete(typedLength, typingMessage.content.length)) {
      setTypingId(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setTypedLength((n) => nextTypedLength(n, typingMessage.content.length));
    }, TYPEWRITER_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [typingMessage, typedLength]);

  // Finish the in-progress typing instantly: show the full reply.
  // No-op when nothing is typing.
  function completeTyping() {
    if (typingId === null) return;
    const current = messages.find((m) => m.id === typingId);
    if (current) setTypedLength(current.content.length);
    setTypingId(null);
  }

  // Auto-scroll to the latest message — including as the reply types
  // out, so the newest characters stay in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, open, typedLength]);

  const canSend = !pending && input.trim().length > 0;

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setError(null);
    // A previous reply still typing out finishes instantly — the new
    // exchange starts from a complete message, never a half-typed one.
    completeTyping();

    const userMessage: ChatMessage = { id: nextMessageId++, role: 'user', content: text };
    // Prior turns only — the new message travels as `message`, not history.
    const history: ChatbotHistoryItem[] = messages
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CONTENT_LENGTH) }));
    setMessages((prev) => [...prev, userMessage]);
    // The lag fix (2026-11-21): clear the input THE INSTANT Send is
    // hit — before any await. The old code cleared it only after the
    // reply arrived, so the typed text sat in the composer, greyed
    // out, for the whole 1–2s round trip. The user message is already
    // in the list above, so nothing is lost by clearing here; on a
    // failure before the first token it is restored below.
    setInput('');
    // The just-sent bubble rises out of the composer (iMessage-style);
    // only this bubble animates, and only once.
    setSentAnimId(userMessage.id);
    if (sentAnimTimerRef.current !== null) {
      window.clearTimeout(sentAnimTimerRef.current);
    }
    sentAnimTimerRef.current = window.setTimeout(() => {
      setSentAnimId(null);
    }, 350);
    setPending(true);
    // Tracks the streaming reply: null until the first token arrives.
    // `sawToken` separates "failed before the first token" (fall back
    // to the non-streaming path, and on total failure restore the
    // input + remove the user message) from "failed mid-stream" (the
    // partial reply and the user message stay, red error only).
    let assistantId: number | null = null;
    let sawToken = false;
    try {
      const data = await chatbotService.sendMessageStream(text, history, {
        onToken: (token) => {
          sawToken = true;
          if (assistantId === null) {
            // First token: append the assistant message (empty, then
            // tokens fill it) and start the typewriter on it. The
            // existing typewriter reveals the growing content at
            // 15ms/char and finishes the rest after the stream ends.
            const assistantMessage: ChatMessage = {
              id: nextMessageId++,
              role: 'assistant',
              content: '',
            };
            assistantId = assistantMessage.id;
            setMessages((prev) => [...prev, assistantMessage]);
            setTypingId(assistantMessage.id);
            setTypedLength(0);
          }
          const id = assistantId;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: m.content + token } : m)),
          );
        },
      });
      if (assistantId !== null) {
        // Streamed reply finished: pin the message to the done
        // payload's full reply (covers any token/reply drift) and its
        // aiAvailable flag. The typewriter keeps revealing it if it
        // has not finished yet.
        const id = assistantId;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, content: data.reply, aiAvailable: data.aiAvailable } : m,
          ),
        );
      } else {
        // No tokens arrived but the stream completed cleanly (e.g. the
        // Ollama-down done line): append the reply as before, with
        // the typewriter reveal.
        const assistantMessage: ChatMessage = {
          id: nextMessageId++,
          role: 'assistant',
          content: data.reply,
          aiAvailable: data.aiAvailable,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setTypingId(assistantMessage.id);
        setTypedLength(0);
      }
    } catch (err) {
      if (!sawToken && assistantId === null) {
        // Stream failed before the first token (network / HTTP error,
        // including a 429 thrown before streaming started): fall back
        // to the existing non-streaming path with the typewriter
        // reveal as before.
        try {
          const data = await chatbotService.sendMessage(text, history);
          const assistantMessage: ChatMessage = {
            id: nextMessageId++,
            role: 'assistant',
            content: data.reply,
            aiAvailable: data.aiAvailable,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setTypingId(assistantMessage.id);
          setTypedLength(0);
        } catch (fallbackErr) {
          // Total failure before any reply: restore the typed text
          // into the input AND remove the just-appended user message,
          // so the audited "failed send keeps the typed text"
          // behaviour is preserved exactly — nothing is lost.
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
          setInput(text);
          setSentAnimId(null);
          setError(
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Something went wrong. Please try again.',
          );
        }
      } else {
        // Stream failed AFTER tokens arrived: the message WAS sent, so
        // keep the partial reply and the user message, show the red
        // error line, and do NOT restore the input.
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Mentorly AI chat"
          className="fixed bottom-24 right-4 z-50 flex h-[560px] max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-lpu-border bg-white shadow-xl"
        >
          {/* Send animation (2026-11-21, iMessage-style): the just-sent
              user bubble rises out of the composer instead of just
              appearing. Self-contained here so both apps carry it with
              the widget; disabled entirely under reduced-motion. */}
          <style>{`
            .chatbot-send-rise { animation: chatbot-send-rise 280ms ease-out; }
            @keyframes chatbot-send-rise {
              from { opacity: 0; transform: translateY(20px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              .chatbot-send-rise { animation: none; }
            }
          `}</style>
          <div className="flex items-start justify-between gap-3 border-b border-lpu-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Mentorly AI</p>
              <p className="text-xs text-neutral-500">Answers from your account and Mentorly info</p>
              {engineLine && (
                <p className="mt-0.5 text-xs text-neutral-400">{engineLine}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={listRef}
            onClick={completeTyping}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && !pending ? (
              <div className="flex h-full items-center justify-center text-center">
                <p className="max-w-[280px] text-sm text-neutral-500">{EMPTY_STATE_GREETING}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-neutral-900 px-4 py-2 text-sm text-white ${
                          m.id === sentAnimId ? 'chatbot-send-rise' : ''
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex justify-start">
                      <div
                        onClick={completeTyping}
                        title={
                          isTypingMessage(m.id, typingId)
                            ? 'Click to show the full reply'
                            : undefined
                        }
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2 text-sm text-neutral-900 ${
                          m.aiAvailable === false
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-lpu-border bg-white'
                        } ${isTypingMessage(m.id, typingId) ? 'cursor-pointer' : ''}`}
                      >
                        {m.aiAvailable === false && (
                          <p className="mb-1 text-xs font-medium text-amber-700">
                            AI engine unavailable
                          </p>
                        )}
                        {visibleReplyText(m.content, typedLength, isTypingMessage(m.id, typingId))}
                        {isTypingMessage(m.id, typingId) && (
                          <span
                            aria-hidden="true"
                            className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-neutral-900 align-middle"
                          />
                        )}
                      </div>
                    </div>
                  ),
                )}
                {/* Thinking dots show ONLY while no reply has started
                    yet — once the first stream token arrives the
                    typewriter takes over, so the dots must not linger
                    beside the typing reply. */}
                {pending && typingId === null && (
                  <div className="flex justify-start">
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-2 rounded-2xl border border-lpu-border bg-white px-4 py-2"
                    >
                      <span className="flex items-center gap-1.5" aria-hidden="true">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-900" />
                      </span>
                      <span className="text-sm text-neutral-500">Mentorly AI is thinking…</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-lpu-border px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Ask about your mentorship…"
                aria-label="Message Mentorly AI"
                disabled={pending}
                className="min-w-0 flex-1 rounded-full border border-lpu-border bg-white px-4 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 px-1 text-xs text-red-600">
                {error}
              </p>
            )}
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close Mentorly AI chat' : 'Open Mentorly AI chat'}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-neutral-800"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="hidden sm:inline">Mentorly AI</span>
      </button>
    </>
  );
}
