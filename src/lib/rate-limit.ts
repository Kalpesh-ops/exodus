// src/lib/rate-limit.ts

// ─────────────────────────────────────────────────────────────
// SECURITY: Sliding-window rate limiter + duplicate-claim dedup
// ─────────────────────────────────────────────────────────────

/**
 * Tracks timestamps of requests to enforce a sliding-window rate limit.
 */
interface RateLimitEntry {
    timestamps: number[];
    lastSeen: number;
}

// Configurable constants
const RATE_LIMIT_WINDOW_MS = 60_000;   // 60-second sliding window
const RATE_LIMIT_MAX_REQUESTS = 10;     // Max requests per window per IP
const CLAIM_TTL_MS = 5 * 60_000;       // 5-minute TTL for claim records
const CLEANUP_INTERVAL_MS = 60_000;     // Purge stale entries every 60s

// EFFICIENCY: Map tracking IP -> sliding window timestamps for rate limiting
const rateLimitMap = new Map<string, RateLimitEntry>();

// EFFICIENCY: Map tracking IP -> Set of claimed reward strings (with TTL)
const claimedMap = new Map<string, { claims: Set<string>; createdAt: number }>();

/**
 * SECURITY: True sliding-window rate limiter.
 * Returns `true` if the request is ALLOWED, `false` if BLOCKED.
 */
export function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    let entry = rateLimitMap.get(ip);

    if (!entry) {
        entry = { timestamps: [], lastSeen: now };
        rateLimitMap.set(ip, entry);
    }

    // Prune timestamps outside the sliding window
    entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );
    entry.lastSeen = now;

    if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false; // BLOCKED
    }

    entry.timestamps.push(now);
    return true; // ALLOWED
}

/**
 * SECURITY: Duplicate-claim prevention with TTL.
 * Returns `true` if this is a NEW claim, `false` if already claimed.
 */
export function checkAndRegisterClaim(ip: string, rewardType: string): boolean {
    const now = Date.now();
    let record = claimedMap.get(ip);

    // Evict stale record if TTL has expired
    if (record && now - record.createdAt > CLAIM_TTL_MS) {
        claimedMap.delete(ip);
        record = undefined;
    }

    if (!record) {
        record = { claims: new Set<string>(), createdAt: now };
        claimedMap.set(ip, record);
    }

    if (record.claims.has(rewardType)) {
        return false; // Already claimed
    }

    record.claims.add(rewardType);
    return true;
}

/**
 * SECURITY: Periodic cleanup to prevent unbounded memory growth.
 * Removes entries that have not been seen in over CLAIM_TTL_MS.
 */
export function evictStaleEntries(): void {
    const now = Date.now();

    for (const [ip, entry] of rateLimitMap) {
        if (now - entry.lastSeen > CLAIM_TTL_MS) {
            rateLimitMap.delete(ip);
        }
    }

    for (const [ip, record] of claimedMap) {
        if (now - record.createdAt > CLAIM_TTL_MS) {
            claimedMap.delete(ip);
        }
    }
}

// Auto-start cleanup interval (only in non-test environments)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    setInterval(evictStaleEntries, CLEANUP_INTERVAL_MS).unref();
}

/**
 * TEST HELPER: Reset all internal state. Only exported for testing.
 */
export function _resetForTesting(): void {
    rateLimitMap.clear();
    claimedMap.clear();
}