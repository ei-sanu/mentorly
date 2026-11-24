import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../common/async-handler';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (req, res) => {
    const connection = mongoose.connection;
    let databaseStatus = 'healthy';
    // No external Redis anymore: cache + queues live in-process, so
    // there is nothing external to ping. The `redis` field is kept
    // (same name/shape) so existing health consumers don't break.
    const redisStatus = 'healthy (in-memory)';

    // 1. Verify MongoDB Connection
    try {
      if (connection.readyState !== 1) {
        throw new Error(`MongoDB connection readyState is ${connection.readyState}`);
      }
    } catch (err) {
      databaseStatus = `unhealthy: ${err.message}`;
    }

    const overallHealthy = databaseStatus === 'healthy' && redisStatus.startsWith('healthy');

    res.json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      database: databaseStatus,
      redis: redisStatus,
      application: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }),
);
