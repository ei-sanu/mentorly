import { NotFoundException, ForbiddenException, BadRequestException } from '../common/errors';
import { ConversationModel, MessageModel, UserModel } from '../database/models';
import { Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { User, UserDocument } from '../database/schemas/user.schema';

/**
 * Recent-send guard (Item 1, 2026-11-20) — the server-side half of the
 * exactly-once send. The old client re-POSTed over REST when a socket
 * echo was slow, writing the same content a second time as a second
 * row with a distinct id, which the page's id-dedupe could never
 * collapse. The client no longer blind-posts (ack + GET-before-POST),
 * but this guard is the backstop: an identical send — same
 * conversation, same sender, same content — inside
 * RECENT_SEND_WINDOW_MS returns the already-stored message instead
 * of saving a second row. In-process memory only (the backend runs
 * one process); a multi-process deploy would need a shared store.
 * Trade-off, stated plainly: sending the exact same text twice within
 * 10s intentionally stores one row and returns it twice. Deliberate
 * repeats more than 10s apart, and any different content, are
 * unaffected. `recentSends` is exported so tests can inspect/clear it.
 */
export const RECENT_SEND_WINDOW_MS = 10000;

interface RecentSend {
  message: any;
  at: number;
}

export const recentSends = new Map<string, RecentSend>();

export function recentSendKey(conversationId: string, senderId: string, content: string): string {
  return `${conversationId}:${senderId}:${content}`;
}

export class MessagingService {
  private readonly conversationModel = ConversationModel;
  private readonly messageModel = MessageModel;
  private readonly userModel = UserModel;

  /**
   * (Item 4, 2026-11-20) One mapping for every conversation read, so the
   * list, the by-mentorship lookup, and any future reader return the
   * same shape. Returns BOTH `otherUser` (what the backend always sent)
   * AND `participants` (what the frontend Conversation type requires —
   * the missing field crashed the Messages page on first render with
   * "Cannot read properties of undefined (reading 'find')").
   */
  private async mapConversation(c: any, userId: string) {
    const otherParticipant: any = (c.participants || []).find(
      (p: any) => p._id.toString() !== userId,
    );

    const lastMessage = await this.messageModel
      .findOne({ conversationId: c._id })
      .sort({ createdAt: -1 })
      .lean();

    return {
      id: c._id.toString(),
      mentorshipId: c.mentorshipId.toString(),
      updatedAt: (c as any).updatedAt,
      participants: (c.participants || []).map((p: any) => ({
        id: p._id.toString(),
        firstName: p.firstName,
        lastName: p.lastName,
        avatar: p.avatar,
        role: p.role,
      })),
      otherUser: otherParticipant
        ? {
            id: otherParticipant._id.toString(),
            firstName: otherParticipant.firstName,
            lastName: otherParticipant.lastName,
            avatar: otherParticipant.avatar,
            role: otherParticipant.role,
          }
        : null,
      lastMessage: lastMessage
        ? {
            id: lastMessage._id.toString(),
            content: lastMessage.content,
            senderId: lastMessage.senderId.toString(),
            createdAt: (lastMessage as any).createdAt,
          }
        : null,
    };
  }

  async getConversations(userId: string) {
    const userIdObj = new Types.ObjectId(userId);
    const conversations = await this.conversationModel
      .find({ participants: userIdObj })
      .populate('participants')
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = [];
    for (const c of conversations) {
      mapped.push(await this.mapConversation(c, userId));
    }

    return mapped;
  }

  /**
   * (Item 4, 2026-11-20) NEW — the single conversation for a mentorship,
   * for the workspace "Message" button (no need to list all conversations
   * and match client-side). Participant-checked by the query itself:
   * a conversation the caller does not participate in reads exactly like
   * a missing one — 404 either way.
   */
  async getConversationByMentorship(mentorshipId: string, userId: string) {
    const conversation = await this.conversationModel
      .findOne({
        mentorshipId: new Types.ObjectId(mentorshipId),
        participants: new Types.ObjectId(userId),
      })
      .populate('participants')
      .lean();

    if (!conversation) {
      throw new NotFoundException('Conversation not found for this mentorship');
    }

    return this.mapConversation(conversation, userId);
  }

  async getMessages(conversationId: string, userId: string, limit = 20, before?: string) {
    const conversationIdObj = new Types.ObjectId(conversationId);
    const userIdObj = new Types.ObjectId(userId);

    // Verify participant
    const conversation = await this.conversationModel.findOne({
      _id: conversationIdObj,
      participants: userIdObj,
    });

    if (!conversation) {
      throw new ForbiddenException('Access denied. You do not participate in this conversation.');
    }

    const query: any = { conversationId: conversationIdObj };
    if (before) {
      const beforeMessage = await this.messageModel.findById(before).lean();
      if (beforeMessage) {
        query.createdAt = { $lt: (beforeMessage as any).createdAt };
      }
    }

    const messages = await this.messageModel
      .find(query)
      .populate('senderId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return messages.reverse().map((m: any) => ({
      id: m._id.toString(),
      content: m.content,
      senderId: m.senderId._id?.toString() || m.senderId?.toString(),
      senderName: m.senderId ? `${m.senderId.firstName} ${m.senderId.lastName}` : 'System',
      createdAt: m.createdAt,
    }));
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversationIdObj = new Types.ObjectId(conversationId);
    const senderIdObj = new Types.ObjectId(senderId);

    const conversation = await this.conversationModel.findOne({
      _id: conversationIdObj,
      participants: senderIdObj,
    });

    if (!conversation) {
      throw new ForbiddenException('Access denied. You are not a participant in this conversation.');
    }

    // (Item 4, 2026-11-20) Content validation — an empty string used to
    // be stored as a message. Whitespace-only is empty; over 2000 chars
    // is rejected rather than silently truncated.
    if (typeof content !== 'string' || content.trim() === '') {
      throw new BadRequestException('Message cannot be empty');
    }
    if (content.length > 2000) {
      throw new BadRequestException('Message must be at most 2000 characters');
    }

    // (Item 1, 2026-11-20) Recent-send guard — return the row already
    // stored for this identical send instead of writing a second one.
    const sendKey = recentSendKey(conversationId, senderId, content);
    const previousSend = recentSends.get(sendKey);
    if (previousSend && Date.now() - previousSend.at <= RECENT_SEND_WINDOW_MS) {
      return previousSend.message;
    }

    const message = new this.messageModel({
      conversationId: conversationIdObj,
      senderId: senderIdObj,
      content,
    });
    await message.save();

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      $set: { updatedAt: new Date() },
    });

    const populated = await this.messageModel.findById(message._id).populate('senderId').lean();

    const sent = {
      id: message._id.toString(),
      conversationId,
      content: message.content,
      senderId: message.senderId.toString(),
      senderName: `${(populated.senderId as any).firstName} ${(populated.senderId as any).lastName}`,
      createdAt: (populated as any).createdAt,
    };

    recentSends.set(sendKey, { message: sent, at: Date.now() });
    // Opportunistic prune so the map cannot grow without bound.
    if (recentSends.size > 500) {
      const cutoff = Date.now() - RECENT_SEND_WINDOW_MS;
      for (const [k, v] of recentSends) {
        if (v.at < cutoff) recentSends.delete(k);
      }
    }

    return sent;
  }
}

export const messagingService = new MessagingService();
