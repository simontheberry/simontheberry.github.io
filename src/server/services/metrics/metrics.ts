// ============================================================================
// Application Metrics -- Latency tracking, request counts, AI costs
// ============================================================================

interface LatencyBucket {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
}

function newBucket(): LatencyBucket {
  return { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0 };
}

function recordToBucket(bucket: LatencyBucket, ms: number): void {
  bucket.count++;
  bucket.totalMs += ms;
  if (ms < bucket.minMs) bucket.minMs = ms;
  if (ms > bucket.maxMs) bucket.maxMs = ms;
}

function bucketStats(bucket: LatencyBucket) {
  if (bucket.count === 0) return { count: 0, avgMs: 0, minMs: 0, maxMs: 0 };
  return {
    count: bucket.count,
    avgMs: Math.round(bucket.totalMs / bucket.count),
    minMs: bucket.minMs === Infinity ? 0 : bucket.minMs,
    maxMs: bucket.maxMs,
  };
}

// ---- Storage ----

const httpLatency = new Map<string, LatencyBucket>();
const dbLatency = newBucket();
const aiLatency = newBucket();
const aiTokens = { prompt: 0, completion: 0, total: 0 };
const aiCalls = { count: 0, errors: 0, embeddingReuses: 0 };
const requestCounts = { total: 0, errors4xx: 0, errors5xx: 0 };
let startedAt = Date.now();

// ---- Recording ----

export function recordHttpRequest(method: string, path: string, statusCode: number, durationMs: number): void {
  requestCounts.total++;
  if (statusCode >= 400 && statusCode < 500) requestCounts.errors4xx++;
  if (statusCode >= 500) requestCounts.errors5xx++;

  // Normalize path: remove UUIDs and IDs for grouping
  const normalized = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:n');
  const key = `${method} ${normalized}`;

  if (!httpLatency.has(key)) {
    httpLatency.set(key, newBucket());
  }
  recordToBucket(httpLatency.get(key)!, durationMs);
}

export function recordDbQuery(durationMs: number): void {
  recordToBucket(dbLatency, durationMs);
}

export function recordAiCall(durationMs: number, tokens?: { prompt: number; completion: number; total: number }): void {
  recordToBucket(aiLatency, durationMs);
  aiCalls.count++;
  if (tokens) {
    aiTokens.prompt += tokens.prompt;
    aiTokens.completion += tokens.completion;
    aiTokens.total += tokens.total;
  }
}

export function recordAiError(): void {
  aiCalls.errors++;
}

export function recordEmbeddingReuse(): void {
  aiCalls.embeddingReuses++;
}

// ---- Reporting ----

export function getMetrics() {
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);

  // Top routes by request count
  const routes: Array<{ route: string } & ReturnType<typeof bucketStats>> = [];
  for (const [route, bucket] of httpLatency.entries()) {
    routes.push({ route, ...bucketStats(bucket) });
  }
  routes.sort((a, b) => b.count - a.count);

  return {
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    requests: {
      total: requestCounts.total,
      errors4xx: requestCounts.errors4xx,
      errors5xx: requestCounts.errors5xx,
      errorRate: requestCounts.total > 0
        ? Math.round(((requestCounts.errors4xx + requestCounts.errors5xx) / requestCounts.total) * 1000) / 10
        : 0,
    },
    database: bucketStats(dbLatency),
    ai: {
      ...bucketStats(aiLatency),
      calls: aiCalls.count,
      errors: aiCalls.errors,
      embeddingReuses: aiCalls.embeddingReuses,
      tokens: { ...aiTokens },
    },
    topRoutes: routes.slice(0, 20),
  };
}

export function resetMetrics(): void {
  httpLatency.clear();
  dbLatency.count = 0;
  dbLatency.totalMs = 0;
  dbLatency.minMs = Infinity;
  dbLatency.maxMs = 0;
  aiLatency.count = 0;
  aiLatency.totalMs = 0;
  aiLatency.minMs = Infinity;
  aiLatency.maxMs = 0;
  aiTokens.prompt = 0;
  aiTokens.completion = 0;
  aiTokens.total = 0;
  aiCalls.count = 0;
  aiCalls.errors = 0;
  aiCalls.embeddingReuses = 0;
  requestCounts.total = 0;
  requestCounts.errors4xx = 0;
  requestCounts.errors5xx = 0;
  startedAt = Date.now();
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}
