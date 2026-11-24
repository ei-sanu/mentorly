import { Logger } from '../common/logger';
import { inMemoryStore } from '../common/in-memory-store';

/**
 * Shared helper for the real-time dashboard pipeline.
 * Holds cache-busting logic for dashboard aggregation caches.
 * Cache lives in the shared in-process store (was Upstash Redis) —
 * the same instance AnalyticsService caches into, so busting works.
 */
export class DashboardEventsService {
  private readonly logger = new Logger(DashboardEventsService.name);
  // Kept for symmetry with the other services; always present now.
  private redis = inMemoryStore;

  /** Delete dashboard aggregation cache keys so next fetches recompute fresh data. */
  bustDashboardCaches(keys: string[] = ['dash:admin:v2', 'dash:alumni:v1', 'dash:placement:v1']) {
    this.redis.del(...keys).catch(() => undefined);
  }
}

export const dashboardEventsService = new DashboardEventsService();
