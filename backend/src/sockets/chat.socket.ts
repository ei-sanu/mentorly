import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { Logger } from '../common/logger';
import { globalEventBus } from '../common/event-bus';
import { UserModel, ConversationModel } from '../database/models';
import { messagingService } from '../messaging/messaging.service';

const logger = new Logger('MessagingGateway');
const userModel = UserModel;
const conversationModel = ConversationModel;

/**
 * Port of the old MessagingGateway (namespace 'chat').
 * Attaches the '/chat' namespace to the shared Socket.IO server.
 *
 * ─── Duplicate messages, root cause + fix (2026-11-20, Item 1) ─────────
 * The doubled bubbles in the screenshots are DISTINCT rows (distinct
 * Mongo ids), not one message rendered twice: the Messages page already
 * dedupes by id on every append path (functional setState with
 * `prev.some((m) => m.id === msg.id)`), so a same-id double delivery
 * collapses to one bubble. Two live double-WRITE paths produced the
 * second rows:
 *   (a) the old client re-POSTed over REST when a socket echo was slow
 *       (>8s), errored, or the socket dropped — even when the socket
 *       emit had ALREADY saved the message server-side (the old
 *       comment conceded "a duplicate in the first case is the safer
 *       failure mode"). The two rows had different ids, so no client
 *       dedupe could ever collapse them.
 *   (b) the page's only double-submit guard was React state `sending`,
 *       which updates asynchronously — a rapid double-click /
 *       double-Enter before re-render passed the guard twice.
 * Ruled out by reading the code: the gateway is attached once
 * (main.ts), the client is one ChatSocketManager singleton, and
 * StrictMode double-mount reuses the same connecting promise/socket.
 * The fix, defence in depth:
 *   1. `send_message` now takes a Socket.IO acknowledgement: the
 *      server acks `{ ok: true, message }` (or `{ ok: false, error }`)
 *      AFTER saving + broadcasting. The client resolves on the ack —
 *      it knows the send landed instead of guessing from the echo.
 *   2. On ack timeout the client does NOT blindly POST. It first
 *      GETs the thread and only POSTs when the message is absent
 *      (see chat-socket.ts `confirmOrSend`).
 *   3. `messaging.service.sendMessage` refuses to store the identical
 *      send twice within 10s (in-memory recent-send guard).
 *   4. The page collapses same-sender + same-content rows within 15s
 *      at render (covers rows already doubled before this fix).
 *
 * ─── Presence (2026-11-20, Item 2) ──────────────────────────────────────
 * A user is ONLINE while at least one of their /chat sockets is
 * connected, OFFLINE the moment the last one disconnects. Presence is
 * tracked here, in the gateway: `onlineSockets` maps user id -> live
 * socket ids (a Set, so two tabs / two devices do not flip a user
 * offline when one tab closes). Every connected socket joins its
 * personal room `user:<userId>`; presence changes are emitted to the
 * OTHER participants' personal rooms, so a client learns about its
 * conversation partners without joining every conversation room. On
 * connect the client also gets a snapshot (`presence` events for every
 * partner, online AND offline — never invented, never a "last seen").
 * A client that joins a conversation gets the other participant's
 * current presence again in the join handler, so a missed snapshot
 * cannot leave the header blank.
 */

type SendAck = (res: { ok: boolean; message?: any; error?: string }) => void;

// userId -> live socket ids for that user. Online === entry exists.
const onlineSockets = new Map<string, Set<string>>();

function userRoom(userId: string): string {
  return `user:${userId}`;
}

// The other participants of every conversation this user is in.
async function conversationPartnerIds(userId: string): Promise<string[]> {
  const convs: any[] = await (conversationModel as any)
    .find({ participants: new Types.ObjectId(userId) })
    .select('participants')
    .lean();
  const ids = new Set<string>();
  for (const c of convs || []) {
    for (const p of (c as any).participants || []) {
      const s = p.toString();
      if (s !== userId) ids.add(s);
    }
  }
  return [...ids];
}

// Tell every conversation partner of `userId` whether they are online.
async function broadcastPresence(server: any, userId: string, online: boolean): Promise<void> {
  try {
    const partners = await conversationPartnerIds(userId);
    for (const partnerId of partners) {
      server.to(userRoom(partnerId)).emit('presence', { userId, online });
    }
  } catch (err: any) {
    logger.warn(`Failed to broadcast presence for ${userId}: ${err?.message || err}`);
  }
}

// Current presence of every partner, sent to a client that just connected.
async function sendPresenceSnapshot(client: Socket, userId: string): Promise<void> {
  try {
    const partners = await conversationPartnerIds(userId);
    for (const partnerId of partners) {
      client.emit('presence', { userId: partnerId, online: onlineSockets.has(partnerId) });
    }
  } catch (err: any) {
    logger.warn(`Failed to send presence snapshot to ${userId}: ${err?.message || err}`);
  }
}

function markOnline(server: any, userId: string, socketId: string): void {
  let set = onlineSockets.get(userId);
  if (!set) {
    set = new Set<string>();
    onlineSockets.set(userId, set);
  }
  const wasOnline = set.size > 0;
  set.add(socketId);
  // Broadcast only on the offline -> online flip, not on a second tab.
  if (!wasOnline) void broadcastPresence(server, userId, true);
}

function markOffline(server: any, userId: string, socketId: string): void {
  const set = onlineSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    onlineSockets.delete(userId);
    // Broadcast only on the online -> offline flip (last socket gone).
    void broadcastPresence(server, userId, false);
  }
}

export function attachChatSocket(io: Server): void {
  const server = io.of('/chat');

  logger.log('Chat gateway initialised');

  globalEventBus.on('dashboard_update', () => {
    logger.log('Broadcasting dashboard_update event to WebSocket clients');
    try {
      if (server) {
        server.emit('dashboard_update');
      }
    } catch (err) {
      logger.warn(`Failed to broadcast dashboard_update: ${err.message}`);
    }
  });

  // REST safety net (2026-11-20): POST /conversations/:id/messages emits
  // `chat_message_sent` on the bus after the save; forward it to the
  // room as `new_message` so the other participant sees the message
  // live even when the sender's socket emit never arrived (socket down,
  // auth failed, or the sender is on REST fallback). The client dedupes
  // by message id (appendChatMessage), so a message delivered both via
  // the sender's socket emit and via this forward still renders once.
  globalEventBus.on('chat_message_sent', (payload: { conversationId: string; message: any }) => {
    try {
      if (!payload?.conversationId || !payload?.message) return;
      server.to(`conversation:${payload.conversationId}`).emit('new_message', payload.message);
    } catch (err: any) {
      logger.warn(`Failed to forward REST chat message: ${err.message}`);
    }
  });

  async function handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!authHeader) {
        client.disconnect(true);
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      let clerkUserId: string;
      // Set only for mock tokens (the only branch that knows the
      // email); the real-JWT branch below resolves by clerk id alone.
      let email: string | undefined;

      if (token.startsWith('mock_token_')) {
        // Mock tokens are `mock_token_<email>_role<ROLE>` (built by
        // chat-socket.ts getToken). Parse EXACTLY like require-auth.ts:
        // strip the `_role<ROLE>` suffix first, then the clerk id is
        // `mock_user_<email>`. The old code kept the whole
        // `<email>_role<ROLE>` as the clerk id, so the lookup below
        // never matched and every mock-login socket was disconnected
        // on connect — realtime was dead for every mock user while
        // REST kept working, which is exactly the reported symptom
        // (message visible only after reload).
        const rawToken = token.replace('mock_token_', '');
        if (rawToken.includes('_role')) {
          const emailPart = rawToken.split('_role')[0];
          clerkUserId = `mock_user_${emailPart}`;
          email = emailPart;
        } else {
          // Canned dev identity (mock_token_mentor_1 etc.): the clerk
          // id is the token itself, as in require-auth.ts.
          clerkUserId = rawToken;
        }
      } else {
        // Real Clerk JWT — verify signature via JWKS
        const jwksUri = process.env.CLERK_JWKS_URL;
        if (!jwksUri || !jwksUri.startsWith('https')) {
          // If JWKS not configured for real tokens, reject
          logger.warn('Real JWT received but CLERK_JWKS_URL not configured for WebSocket auth');
          client.disconnect(true);
          return;
        }

        try {
          const jwksRsa = require('jwks-rsa');
          const jwksClient = jwksRsa({
            jwksUri,
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
          });

          const decodedHeader: any = jwt.decode(token, { complete: true });
          if (!decodedHeader?.header?.kid) {
            client.disconnect(true);
            return;
          }

          const key = await jwksClient.getSigningKey(decodedHeader.header.kid);
          const publicKey = key.getPublicKey();
          const verified: any = jwt.verify(token, publicKey);
          clerkUserId = verified.sub;
        } catch (jwtErr) {
          logger.warn(`WebSocket JWT verification failed: ${jwtErr.message}`);
          client.disconnect(true);
          return;
        }
      }

      // Same resolution as require-auth.ts: clerk id OR email, so a
      // mock user provisioned under `mock_user_<email>` is found even
      // if the stored clerk id ever drifts from the token-derived one.
      const user = await userModel
        .findOne(email ? { $or: [{ clerkUserId }, { email }] } : { clerkUserId })
        .lean();

      if (!user) {
        // Was a silent disconnect: nothing in the log said WHY the
        // socket died, which is how this bug hid. Say so now.
        logger.warn(`Chat WS auth: no user for clerkUserId=${clerkUserId} — disconnecting`);
        client.disconnect(true);
        return;
      }

      client.data.user = {
        ...user,
        id: user._id.toString(),
      };
      logger.log(`Socket Client Connected: ${user.firstName} ${user.lastName} (ID: ${user._id.toString()})`);

      // Presence (Item 2): this socket joins the user's personal room,
      // the user flips online (first socket only), and the client gets
      // the current presence of every conversation partner.
      const userId = user._id.toString();
      client.join(userRoom(userId));
      markOnline(server, userId, client.id);
      void sendPresenceSnapshot(client, userId);
    } catch (err) {
      logger.error(`Socket connection error: ${err.message}`);
      client.disconnect(true);
    }
  }

  function handleDisconnect(client: Socket) {
    if (client.data?.user) {
      logger.log(`Socket Client Disconnected: ${client.data.user.firstName}`);
    }
  }

  server.on('connection', async (client: Socket) => {
    // Attach the disconnect handler FIRST, before auth completes: a
    // client that drops mid-auth must still clear presence if it was
    // ever marked online. The handler no-ops while client.data.user
    // is unset (auth not yet done / failed).
    client.on('disconnect', () => {
      const userId = client.data?.user?.id;
      if (userId) markOffline(server, userId, client.id);
      handleDisconnect(client);
    });

    await handleConnection(client);

    client.on('join_conversation', async (data: { conversationId: string }) => {
      const userId = client.data.user?.id;
      if (!userId) return;

      try {
        // Verify user is participant in conversation
        const conversation = await conversationModel.findOne({
          _id: new Types.ObjectId(data.conversationId),
          participants: new Types.ObjectId(userId),
        });

        if (conversation) {
          client.join(`conversation:${data.conversationId}`);
          logger.log(`User ${userId} joined room conversation:${data.conversationId}`);
          client.emit('joined_room', { conversationId: data.conversationId });
          // Presence (Item 2): the other participant's current state,
          // so the header never waits on the connect-time snapshot.
          for (const p of (conversation as any).participants || []) {
            const participantId = p.toString();
            if (participantId !== userId) {
              client.emit('presence', { userId: participantId, online: onlineSockets.has(participantId) });
            }
          }
        } else {
          client.emit('error', { message: 'Not authorized for this conversation' });
        }
      } catch (error) {
        client.emit('error', { message: 'Invalid conversation reference' });
      }
    });

    client.on(
      'send_message',
      async (data: { conversationId: string; content: string }, ack?: SendAck) => {
        const userId = client.data.user?.id;
        if (!userId) {
          ack?.({ ok: false, error: 'Not signed in. Please reload and try again.' });
          return;
        }

        try {
          const message = await messagingService.sendMessage(
            data.conversationId,
            userId,
            data.content,
          );

          server.to(`conversation:${data.conversationId}`).emit('new_message', message);
          // Ack AFTER save + broadcast: the sender now knows the send
          // landed (Item 1 — no more guessing from the echo, and no
          // blind REST re-POST on a lost echo). Old clients that sent
          // without an ack simply get none (ack is optional).
          ack?.({ ok: true, message });
        } catch (err: any) {
          // Never emit a raw Mongoose/BSON message to the client: a
          // malformed conversationId makes sendMessage() throw a
          // BSONError ("input must be a 24 character hex string...").
          // Human service errors (e.g. the not-a-participant message)
          // pass through; anything technical gets the plain wording
          // and the detail stays in the server log.
          const isObjectIdError = err?.name === 'CastError' || err?.name === 'BSONError' || err?.kind === 'ObjectId';
          let humanMessage: string;
          if (isObjectIdError) {
            logger.error(`Socket send_message ObjectId error: ${err?.stack || err}`);
            humanMessage = 'That conversation link looks broken. Please go back and try again.';
          } else {
            humanMessage = err.message;
          }
          client.emit('error', { message: humanMessage });
          ack?.({ ok: false, error: humanMessage });
        }
      },
    );

    client.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      const userId = client.data.user?.id;
      if (!userId) return;

      client.to(`conversation:${data.conversationId}`).emit('typing', {
        userId,
        isTyping: data.isTyping,
      });
    });
  });
}
