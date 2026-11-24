import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { validateBody } from '../middleware/validate';
import { validateObjectIdParam } from '../middleware/validate-object-id';
import { calendarNotesService } from './calendar-notes.service';
import { CreateCalendarNoteDto } from './dto/create-calendar-note.dto';
import { UpdateCalendarNoteDto } from './dto/update-calendar-note.dto';

export const calendarNotesRouter = Router();

// Personal calendar notes (Item 5, 2026-11-20). This is a NEW module
// for day notes — it does not touch the existing Google Calendar sync
// in src/calendar/ (OAuth connect/disconnect + session sync), which
// lives on its own routes. Every route here is owner-scoped in the
// service: the user id always comes from the auth token, never from
// the request body or query.

calendarNotesRouter.get(
  '/calendar-notes',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const month = typeof req.query.month === 'string' && req.query.month ? req.query.month : undefined;
    const notes = await calendarNotesService.listForMonth(user.id, month);
    res.json({ success: true, data: notes });
  }),
);

calendarNotesRouter.post(
  '/calendar-notes',
  requireAuth,
  validateBody(CreateCalendarNoteDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const note = await calendarNotesService.create(user.id, req.body);
    res.status(201).json({ success: true, data: note });
  }),
);

calendarNotesRouter.patch(
  '/calendar-notes/:id',
  requireAuth,
  validateObjectIdParam('id', 'note'),
  validateBody(UpdateCalendarNoteDto),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const updated = await calendarNotesService.update(user.id, req.params.id as string, req.body);
    res.json({ success: true, data: updated });
  }),
);

calendarNotesRouter.delete(
  '/calendar-notes/:id',
  requireAuth,
  validateObjectIdParam('id', 'note'),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const result = await calendarNotesService.delete(user.id, req.params.id as string);
    res.json(result);
  }),
);
