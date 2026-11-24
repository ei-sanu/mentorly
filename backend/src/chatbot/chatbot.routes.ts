import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { chatbotService } from './chatbot.service';
import { ChatMessageDto } from './dto/chat-message.dto';

export const chatbotRouter = Router();

// Mentorly AI chatbot (2026-11-20) — service-level RAG over the local
// Mentorly AI engine. The user id always comes from the auth token, never from the
// request body: every context lookup in the service is scoped to that
// id, so one user can never reach another user's records. History is
// session-only (the panel keeps it in component state); nothing about
// a conversation is stored on the server.
//
// POST /chatbot/chat/stream (2026-11-21) streams the same answer as
// SSE: one `data: {"token": "..."}` line per token, then a final
// `data: {"done": true, "reply": ..., "sources": ..., "aiAvailable": ...}`
// line. Validation, rate-limiting and context build run BEFORE any
// headers are sent, so a 400/429 still returns as a normal JSON error.

chatbotRouter.get(
  '/chatbot/status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const status = await chatbotService.getStatus();
    res.json({ success: true, data: status });
  }),
);

chatbotRouter.post(
  '/chatbot/chat',
  requireAuth,
  validateBody(ChatMessageDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const reply = await chatbotService.chat(user.id, req.body.message, req.body.history);
    res.json({ success: true, data: reply });
  }),
);

chatbotRouter.post(
  '/chatbot/chat/stream',
  requireAuth,
  validateBody(ChatMessageDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    // Preparation (validation, rate-limit, context build) runs BEFORE
    // any headers are sent, via the onPrepared hook — so a 400/429
    // still returns as a normal JSON error, not a half-open stream.
    // Tokens stream only after headers are set, one SSE data line per
    // token, then a final done line carrying the full reply.
    const reply = await chatbotService.chatStream(
      user.id,
      req.body.message,
      req.body.history,
      (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      () => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
      },
    );
    res.write(
      `data: ${JSON.stringify({ done: true, reply: reply.reply, sources: reply.sources, aiAvailable: reply.aiAvailable })}\n\n`,
    );
    res.end();
  }),
);
