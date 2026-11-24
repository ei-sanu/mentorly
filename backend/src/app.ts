import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { Logger } from './common/logger';

const logger = new Logger('App');

import { usersRouter } from './users/users.routes';
import { studentsRouter } from './students/students.routes';
import { mentorsRouter } from './mentors/mentors.routes';
import { verificationRouter } from './verification/verification.routes';
import { passwordResetRouter } from './auth/password-reset.routes';
import { recommendationsRouter } from './recommendations/recommendations.routes';
import { requestsRouter } from './requests/requests.routes';
import { mentorshipsRouter } from './mentorships/mentorships.routes';
import { sessionsRouter } from './sessions/sessions.routes';
import { calendarRouter } from './calendar/calendar.routes';
import { calendarNotesRouter } from './calendar-notes/calendar-notes.routes';
import { goalsRouter } from './goals/goals.routes';
import { actionItemsRouter } from './action-items/action-items.routes';
import { messagingRouter } from './messaging/messaging.routes';
import { notificationsRouter } from './notifications/notifications.routes';
import { chatbotRouter } from './chatbot/chatbot.routes';
import { feedbackRouter } from './feedback/feedback.routes';
import { analyticsRouter } from './analytics/analytics.routes';
import { alumniOfficerRouter } from './analytics/alumni-officer.routes';
import { placementOfficerRouter } from './analytics/placement-officer.routes';
import { adminRouter } from './admin/admin.routes';
import { filesRouter } from './files/files.routes';
import { healthRouter } from './health/health.routes';

const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Mentorly API',
    description: 'Backend APIs for the Mentorly Alumni Mentorship Network',
    version: '1.0.0',
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearer: [] }],
  paths: {},
};

export function createApp(): Express {
  const app = express();

  // Live request logging — first middleware, so every request is timed
  // and printed to the server terminal (see middleware/request-logger).
  app.use(requestLogger);

  // Security headers (CSP off so the Swagger UI at /api keeps working)
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS — same whitelist behaviour as the old Nest bootstrap
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080,http://localhost:8081';
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === frontendUrl || frontendUrl.split(',').includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API documentation (Swagger UI, previously served by @nestjs/swagger).
  // Mounted carefully: only non-/v1 paths under /api go to Swagger, so the
  // /api/v1 routers below are never swallowed by the UI.
  const swaggerStack: any[] = [...(swaggerUi as any).serve, swaggerUi.setup(openApiDocument)];
  app.use('/api', (req: Request, res: Response, next: any) => {
    if (req.path === '/v1' || req.path.startsWith('/v1/')) return next();
    let i = 0;
    const run = (err?: any) => {
      if (err) return next(err);
      const mw = swaggerStack[i++];
      if (!mw) return next();
      try {
        mw(req, res, run);
      } catch (e) {
        next(e);
      }
    };
    run();
  });

  // All feature routes — paths inside each router are full /api/v1 paths
  const api = express.Router();
  api.use(usersRouter);
  api.use(studentsRouter);
  api.use(mentorsRouter);
  api.use(verificationRouter);
  api.use(passwordResetRouter); // public pre-auth password reset (OTP proof, rate-limited)
  api.use(recommendationsRouter);
  api.use(requestsRouter);
  api.use(mentorshipsRouter);
  api.use(sessionsRouter);
  api.use(calendarRouter);
  api.use(calendarNotesRouter);
  api.use(goalsRouter);
  api.use(actionItemsRouter);
  api.use(messagingRouter);
  api.use(notificationsRouter);
  api.use(chatbotRouter);
  api.use(feedbackRouter);
  api.use(analyticsRouter);
  api.use(alumniOfficerRouter);
  api.use(placementOfficerRouter);
  api.use(adminRouter);
  api.use(filesRouter);
  api.use(healthRouter);
  app.use('/api/v1', api);

  // Unknown routes — same standardized error shape as the exception filter
  app.use((req: Request, res: Response) => {
    logger.warn(`Unknown route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      success: false,
      error: {
        code: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
      requestId: (req as any).requestId || (req.headers['x-request-id'] as string) || uuidv4(),
    });
  });

  app.use(errorHandler);

  return app;
}
