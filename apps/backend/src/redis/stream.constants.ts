export const DOMAIN_EVENTS_STREAM =
  process.env.DOMAIN_EVENTS_STREAM ?? 'domain-events';

export const DOMAIN_EVENTS_DLQ_STREAM =
  process.env.DOMAIN_EVENTS_DLQ_STREAM ?? 'domain-events-dlq';

export const ADMIN_NOTIFICATIONS_GROUP = 'admin-notifications';

export const USER_NOTIFICATIONS_GROUP = 'user-notifications';

export const DOMAIN_EVENTS_MAX_LEN = Number(
  process.env.DOMAIN_EVENTS_MAX_LEN ?? '10000',
);

export const STREAM_CONSUMER_CONCURRENCY = Number(
  process.env.NOTIFY_QUEUE_CONCURRENCY ??
    process.env.ADMIN_NOTIFY_QUEUE_CONCURRENCY ??
    '5',
);

export const STREAM_BLOCK_MS = Number(process.env.STREAM_BLOCK_MS ?? '5000');

export const STREAM_CLAIM_IDLE_MS = Number(
  process.env.STREAM_CLAIM_IDLE_MS ?? '30000',
);

export const STREAM_RECLAIM_INTERVAL_MS = Number(
  process.env.STREAM_RECLAIM_INTERVAL_MS ?? '15000',
);

export const STREAM_MAX_DELIVERIES = Number(
  process.env.STREAM_MAX_DELIVERIES ?? '3',
);
