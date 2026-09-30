type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }
  current.count += 1;
  return { ok: true };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: `Rate limit exceeded. Retry in ${retryAfter}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}
