import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateObjectIdParam, validateObjectIdQuery } from '../middleware/validate-object-id';
import { messagingService } from './messaging.service';
import { globalEventBus } from '../common/event-bus';

export const messagingRouter = Router();


messagingRouter.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const list = await messagingService.getConversations(user.id);
    res.json({ success: true, data: list });
  }),
);

// (Item 4, 2026-11-20) NEW — registered BEFORE '/conversations/:id/...'
// so '/conversations/by-mentorship/<id>' is never swallowed by the
// :id param route.
messagingRouter.get(
  '/conversations/by-mentorship/:mentorshipId',
  requireAuth,
  validateObjectIdParam('mentorshipId', 'mentorship'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const conversation = await messagingService.getConversationByMentorship(
      (req.params.mentorshipId as string),
      user.id,
    );
    res.json({ success: true, data: conversation });
  }),
);

messagingRouter.get(
  '/conversations/:id/messages',
  requireAuth,
  validateObjectIdParam('id', 'conversation'),
  validateObjectIdQuery('before', 'message reference'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const limit = req.query.limit as unknown as number | undefined;
    const before = req.query.before as string | undefined;
    const messages = await messagingService.getMessages(
      (req.params.id as string),
      user.id,
      limit ? parseInt(limit as any, 10) : 20,
      before,
    );
    res.json({ success: true, data: messages });
  }),
);

messagingRouter.post(
  '/conversations/:id/messages',
  requireAuth,
  validateObjectIdParam('id', 'conversation'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const content = req.body?.content;
    const message = await messagingService.sendMessage((req.params.id as string), user.id, content);
    // Real-time safety net (2026-11-20): the chat gateway forwards this
    // bus event to `conversation:<id>` as `new_message`, so the other
    // participant sees the message live even when the sender's socket
    // emit never arrived. The client dedupes by message id, so the two
    // paths never produce a double bubble.
    globalEventBus.emit('chat_message_sent', { conversationId: req.params.id as string, message });
    res.status(201).json({ success: true, data: message });
  }),
);
