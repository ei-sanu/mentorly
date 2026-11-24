'use client';

import { io, Socket } from 'socket.io-client';
import { messagingService, type ChatMessage } from '@/services/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const WS_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Singleton Socket.IO client for the real-time chat namespace
 * (2026-11-20, Items 4 + 6, reworked 2026-11-20 for Items 1 + 2).
 * Modelled on src/lib/dashboard-socket.ts: same token logic (Clerk
 * session JWT, mock_token_* dev shortcut), same WS_URL derivation,
 * one shared connection.
 *
 * Server protocol (backend/src/sockets/chat.socket.ts — read, not
 * assumed): namespace `/chat`, auth `{ token }`. Events the client
 * sends: `join_conversation { conversationId }`,
 * `send_message { conversationId, content }` (WITH an acknowledgement
 * callback — the server acks `{ ok: true, message }` after saving +
 * broadcasting, or `{ ok: false, error }`),
 * `typing { conversationId, isTyping }`. Events the server sends:
 * `joined_room { conversationId }`, `new_message` (the stored message
 * object, broadcast to the whole room — including the sender),
 * `typing { userId, isTyping }` (note: NO conversationId — the client
 * attaches the conversation it has joined),
 * `presence { userId, online }` (connect/disconnect flips + a snapshot
 * of every conversation partner on connect and on join),
 * `error { message }`.
 *
 * ─── Exactly-once send (Item 1 — the duplicate-message fix) ─────────────
 * The old client resolved a send from the `new_message` echo and, when
 * the echo was slow (>8s), errored, or the socket dropped, fired a
 * REST POST of the same content — even when the socket emit had
 * ALREADY saved the message. That wrote a second row with a second
 * id, which the page's id-dedupe could never collapse (see the
 * gateway comment for the full root cause). The new flow:
 *   1. Emit `send_message` WITH an ack. The ack is the delivery
 *      confirmation — resolve on `{ ok: true, message }`, reject on
 *      `{ ok: false, error }`.
 *   2. On ack timeout, do NOT blindly POST. `confirmOrSend` first
 *      GETs the thread; if the message is already there (same content,
 *      sent within the last 30s), resolve with it. Only POST when it
 *      is genuinely absent.
 *   3. The server refuses an identical send twice within 10s
 *      (messaging.service recent-send guard), and the page collapses
 *      same-sender + same-content rows within 15s at render.
 * A socket send NEVER silently drops a message: no socket, or a
 * failed send, still resolves via REST — exactly once.
 *
 * ─── Presence (Item 2) ───────────────────────────────────────────────────
 * `onPresence(handler)` subscribes to `{ userId, online }` flips. The
 * manager keeps the last known state per user and REPLAYS it to every
 * new subscriber, so a component that mounts after the snapshot still
 * learns the current state. A user with no presence event yet is
 * UNKNOWN (`getPresence` returns `undefined`) — the UI renders
 * nothing for them rather than inventing Offline.
 * Presence is only as wide as the socket: the socket connects when the
 * Messages page mounts (joinConversation -> connect). A user is
 * therefore "Online" while they have Messages open; if the app shell
 * ever calls connectChatSocket() on mount, presence becomes app-wide
 * with no change here — the manager is already a singleton.
 */

// How long to wait for the server's send ack before checking over REST.
const SEND_ACK_TIMEOUT_MS = 8000;
// A socket-saved message found by the GET check must have been created
// within this long of the send starting (covers clock skew).
const SEND_RECENT_WINDOW_MS = 30000;

/** A chat message as the page renders it: real rows plus optimistic temps. */
export type DisplayChatMessage = ChatMessage & {
  /** True while the message is an unsent optimistic temp. */
  pending?: boolean;
  /** True when the send failed and the bubble offers a retry. */
  failed?: boolean;
};

export type ChatPresence = { userId: string; online: boolean };

type ChatMessageHandler = (msg: ChatMessage & { conversationId: string }) => void;
type ChatTypingHandler = (info: { conversationId: string; userId: string; isTyping: boolean }) => void;
type ChatPresenceHandler = (presence: ChatPresence) => void;

// ─── Pure message-list helpers (exported for unit tests) ──────────────────
// Two rows are the "same send" when they share sender + content and
// their createdAt stamps fall within this window. 15s covers both
// known double-write shapes (a rapid double-submit, <1s apart, and
// the old echo-timeout re-POST, ~8s apart) and every row doubled
// before this fix. Trade-off, stated plainly: the exact same text sent
// twice on purpose within 15s renders as one bubble.
export const DUPLICATE_WINDOW_MS = 15000;

/**
 * Collapse duplicate rows in a chronological list: exact-id dupes
 * first, then same-sender + same-content within DUPLICATE_WINDOW_MS.
 * Within a collapsed group the first REAL message wins over a pending
 * optimistic temp (a temp's sender id can be the Clerk id while the
 * confirmed row carries the backend Mongo id, so the sender check is
 * waived when either side is pending — content + window is the match).
 * Otherwise the earliest entry is kept. Pure — no I/O, no React.
 */
export function collapseDuplicateMessages<T extends DisplayChatMessage>(list: T[]): T[] {
  const byId = new Map<string, T>();
  for (const m of list) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  const out: T[] = [];
  for (const m of byId.values()) {
    const at = new Date(m.createdAt).getTime();
    const dupIndex = out.findIndex((k) => {
      if (k.content !== m.content) return false;
      const sameSender = k.senderId === m.senderId || k.pending === true || m.pending === true;
      if (!sameSender) return false;
      return Math.abs(new Date(k.createdAt).getTime() - at) <= DUPLICATE_WINDOW_MS;
    });
    if (dupIndex === -1) {
      out.push(m);
      continue;
    }
    // Prefer a real message over a pending temp in the same group.
    if (out[dupIndex].pending === true && m.pending !== true) {
      out[dupIndex] = m;
    }
    // Otherwise keep the earliest entry and drop the later dupe.
  }
  return out;
}

/**
 * Append one incoming message to a chronological list, collapsing
 * duplicates. When `replaceTempId` is given, a pending optimistic temp
 * with that id and the same content is REPLACED by the confirmed
 * message (the normal ack path) instead of appending a second bubble.
 */
export function appendChatMessage<T extends DisplayChatMessage>(
  prev: T[],
  incoming: T,
  opts?: { replaceTempId?: string | null },
): T[] {
  if (opts?.replaceTempId) {
    const idx = prev.findIndex((m) => m.id === opts.replaceTempId);
    if (idx !== -1) {
      const temp = prev[idx];
      // Match on content only: the temp's senderId may be the Clerk id
      // while the confirmed row carries the backend Mongo id.
      if (temp.content === incoming.content) {
        const next = [...prev.slice(0, idx), incoming, ...prev.slice(idx + 1)];
        return collapseDuplicateMessages(next);
      }
    }
  }
  if (prev.some((m) => m.id === incoming.id)) return prev;
  return collapseDuplicateMessages([...prev, incoming]);
}

interface AckResult {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
}

class ChatSocketManager {
  private socket: Socket | null = null;
  private connecting: Promise<Socket | null> | null = null;
  private currentConversationId: string | null = null;
  private messageHandlers = new Set<ChatMessageHandler>();
  private typingHandlers = new Set<ChatTypingHandler>();
  private presenceHandlers = new Set<ChatPresenceHandler>();
  // Last known presence per user id. A missing entry means UNKNOWN —
  // no event has arrived for that user yet (never invent Offline).
  private presenceByUser = new Map<string, boolean>();

  async getToken(maxMs = 3000): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // Mock-auth dev shortcut — must match services/api.ts and dashboard-socket.ts.
    const mockToken = localStorage.getItem('mock_user_token');
    const mockEmail = localStorage.getItem('mock_user_email');
    if (mockToken || mockEmail) {
      const email = mockEmail || 'someshranjanbiswal13678@gmail.com';
      const activeRole = localStorage.getItem('active_role') || 'ADMIN';
      return `mock_token_${email}_role${activeRole}`;
    }

    const poll = async (elapsed = 0): Promise<string | null> => {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded && !clerk.session) return null;
      if (clerk?.session) {
        try {
          const token = await clerk.session.getToken();
          if (token) return token;
        } catch {
          // fall through to retry
        }
      }
      if (elapsed >= maxMs) return null;
      await new Promise((r) => setTimeout(r, 150));
      return poll(elapsed + 150);
    };
    return poll();
  }

  async connect(): Promise<Socket | null> {
    if (typeof window === 'undefined') return null;
    // Reuse the one live socket, even while it is still connecting:
    // socket.io buffers emits until connect, and the 'connect' handler
    // below re-joins the active conversation. Creating a second socket
    // here (the old behaviour when `connected` was false) left two
    // live sockets in the same room, both delivering every message.
    if (this.socket) return this.socket;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const token = await this.getToken();
      if (!token) return null;

      const socket = io(`${WS_URL}/chat`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      socket.on('connect_error', () => {
        // Silent — chat still works over REST (sendChatMessage falls
        // back, and the page keeps its manual Refresh).
      });

      // Reconnect attempts exhausted: drop the dead socket so the
      // next connect() builds a fresh one instead of returning it.
      socket.on('reconnect_failed', () => {
        if (this.socket === socket) this.socket = null;
      });

      // 2026-11-20: a SERVER-initiated disconnect ('io server
      // disconnect' — e.g. the gateway rejected the token at connect)
      // never auto-reconnects, and 'reconnect_failed' above never fires
      // for it, so the old manager kept returning the dead socket from
      // connect() forever and realtime stayed dead until a full page
      // reload. Drop the dead socket here so the next connect() builds
      // a fresh one. Transport drops ('ping timeout', 'transport
      // close') are NOT cleared: socket.io auto-reconnects those
      // itself and the 'connect' handler above re-joins the room.
      socket.on('disconnect', (reason: string) => {
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          if (this.socket === socket) this.socket = null;
        }
      });

      // Re-join the active conversation after a reconnect: the server
      // keeps rooms per connection, so a new connection starts outside
      // every room.
      socket.on('connect', () => {
        if (this.currentConversationId) {
          socket.emit('join_conversation', { conversationId: this.currentConversationId });
        }
      });

      socket.on('new_message', (msg: ChatMessage) => {
        const conversationId = msg.conversationId ?? this.currentConversationId ?? '';
        const full = { ...msg, conversationId };
        this.messageHandlers.forEach((handler) => handler(full));
      });

      socket.on('typing', (info: { userId: string; isTyping: boolean }) => {
        // The server rebroadcasts typing WITHOUT a conversationId, so
        // the only conversation it can belong to is the one joined.
        if (!this.currentConversationId) return;
        const full = { ...info, conversationId: this.currentConversationId };
        this.typingHandlers.forEach((handler) => handler(full));
      });

      socket.on('presence', (info: ChatPresence) => {
        this.presenceByUser.set(info.userId, info.online);
        this.presenceHandlers.forEach((handler) => handler(info));
      });

      socket.on('error', (err: { message?: string }) => {
        // A server-side failure for a send now arrives on the send's
        // ack as { ok: false, error } — this is only the join/error
        // channel. Log it; never re-POST a send from here (the old
        // fallback did, and wrote the duplicate row).
        console.error('[chat-socket] server error:', err?.message || err);
      });

      this.socket = socket;
      return socket;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.currentConversationId = null;
  }

  joinConversation(conversationId: string): void {
    this.currentConversationId = conversationId;
    // Connect in the background when needed; the 'connect' handler
    // above re-emits the join once the socket is up.
    this.connect().then((socket) => {
      if (!socket) return;
      // Only emit if this is still the active conversation — the user
      // may have switched conversations while connecting.
      if (this.currentConversationId === conversationId) {
        socket.emit('join_conversation', { conversationId });
      }
    });
  }

  leaveConversation(): void {
    // The server has no leave event; rooms live per connection, so
    // there is nothing to emit. Clearing the local id stops typing
    // fan-out and echo matching for the old conversation. The
    // connection itself stays up for the next conversation.
    this.currentConversationId = null;
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    if (!this.socket?.connected) return;
    this.socket.emit('typing', { conversationId, isTyping });
  }

  /**
   * Did the socket save land? Only used when the ack never arrives:
   * GET the thread and look for our own content from just now. Found
   * -> resolve with the stored row (no second write). Absent -> one
   * REST POST. This is what makes a lost ack safe instead of a
   * duplicate row.
   */
  private async confirmOrSend(conversationId: string, content: string, sentAt: number): Promise<ChatMessage> {
    try {
      const recent = await messagingService.getMessages(conversationId, 20);
      const found = recent.find(
        (m) => m.content === content && Math.abs(new Date(m.createdAt).getTime() - sentAt) <= SEND_RECENT_WINDOW_MS,
      );
      if (found) return found;
    } catch {
      // The GET failed — fall through to the POST below; if the socket
      // save did land, the server's recent-send guard returns that row
      // instead of storing a second one.
    }
    return messagingService.sendMessage(conversationId, content);
  }

  async sendChatMessage(conversationId: string, content: string): Promise<ChatMessage> {
    const socket = await this.connect();
    // No socket (signed out, or the server is unreachable): REST is
    // the send path, not a silent drop.
    if (!socket || !socket.connected) {
      return messagingService.sendMessage(conversationId, content);
    }

    return new Promise<ChatMessage>((resolve, reject) => {
      let settled = false;
      const sentAt = Date.now();
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Ack lost — check over REST before posting, never blind-post.
        this.confirmOrSend(conversationId, content, sentAt).then(resolve, reject);
      }, SEND_ACK_TIMEOUT_MS);
      socket.emit(
        'send_message',
        { conversationId, content },
        (res: AckResult | undefined) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (res && res.ok === false) {
            reject(new Error(res.error || 'Message failed to send'));
            return;
          }
          if (res && res.message) {
            resolve(res.message);
            return;
          }
          // No ack payload (an older server): confirm over REST.
          this.confirmOrSend(conversationId, content, sentAt).then(resolve, reject);
        },
      );
    });
  }

  onMessage(handler: ChatMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onTyping(handler: ChatTypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => {
      this.typingHandlers.delete(handler);
    };
  }

  onPresence(handler: ChatPresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    // Replay what is already known, so a late subscriber still learns
    // the current state instead of waiting for the next flip.
    this.presenceByUser.forEach((online, userId) => handler({ userId, online }));
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  /** Last known presence for a user, or `undefined` when unknown. */
  getPresence(userId: string): boolean | undefined {
    return this.presenceByUser.get(userId);
  }
}

export const chatSocket = new ChatSocketManager();

/** Open (or reuse) the /chat connection. Returns null when signed out. */
export function connectChatSocket(): Promise<Socket | null> {
  return chatSocket.connect();
}

/** Join a conversation's room; re-joins automatically after reconnects. */
export function joinConversation(conversationId: string): void {
  chatSocket.joinConversation(conversationId);
}

/** Stop receiving events for the current conversation (connection stays up). */
export function leaveConversation(): void {
  chatSocket.leaveConversation();
}

/**
 * Send a message over the socket with a server ack, with REST as the
 * fallback only when the send provably did not land (ack timeout ->
 * GET check -> POST if absent). Never silently drops, never writes
 * the same send twice: the promise resolves with the sent message,
 * or rejects when both paths fail.
 */
export function sendChatMessage(conversationId: string, content: string): Promise<ChatMessage> {
  return chatSocket.sendChatMessage(conversationId, content);
}

/** Emit a typing signal for a conversation (no-op when disconnected). */
export function sendTyping(conversationId: string, isTyping: boolean): void {
  chatSocket.sendTyping(conversationId, isTyping);
}

/** Subscribe to incoming messages. Returns an unsubscribe function. */
export function onChatMessage(handler: (msg: ChatMessage & { conversationId: string }) => void): () => void {
  return chatSocket.onMessage(handler);
}

/** Subscribe to typing signals. Returns an unsubscribe function. */
export function onChatTyping(
  handler: (info: { conversationId: string; userId: string; isTyping: boolean }) => void,
): () => void {
  return chatSocket.onTyping(handler);
}

/**
 * Subscribe to presence flips (`{ userId, online }`). The handler is
 * immediately replayed the last known state per user, so a late
 * subscriber still learns who is online now. Returns an unsubscribe
 * function.
 */
export function onPresence(handler: (presence: ChatPresence) => void): () => void {
  return chatSocket.onPresence(handler);
}

/** Last known presence for a user, or `undefined` when unknown. */
export function getPresence(userId: string): boolean | undefined {
  return chatSocket.getPresence(userId);
}
