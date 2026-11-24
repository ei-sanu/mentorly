import 'reflect-metadata';
import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { connectDatabase } from './database/models';
import { attachChatSocket } from './sockets/chat.socket';
import { attachDashboardSocket } from './sockets/dashboard.socket';
import { jobsService } from './jobs/jobs.service';
import { Logger } from './common/logger';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const env = process.env.NODE_ENV || 'development';
  logger.log(`Starting Mentorly API (env=${env})...`);

  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);

  // Real-time gateways (chat + dashboard namespaces)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080,http://localhost:8081';
  const io = new SocketIOServer(server, {
    cors: {
      origin: frontendUrl.split(','),
      credentials: true,
    },
  });
  attachChatSocket(io);
  attachDashboardSocket(io);
  logger.log(`Socket.IO ready (namespaces: /chat, /dashboard) — frontend: ${frontendUrl}`);

  // Background queues/workers (in-process, no Redis) + scheduled jobs
  await jobsService.onModuleInit();

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    logger.log(`Server running on http://localhost:${port}`);
    logger.log(`API base: http://localhost:${port}/api/v1 — docs: http://localhost:${port}/api`);
  });

  // Clean shutdown so Ctrl+C in the terminal leaves a readable last line
  const shutdown = (signal: string) => {
    logger.warn(`Received ${signal} — shutting down...`);
    server.close(() => {
      logger.log('Server stopped');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:');
  console.error(err);
  process.exit(1);
});
