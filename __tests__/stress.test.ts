// __tests__/stress.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Exodus Comprehensive Stress Test Suite
//   1. Stadium gate capacity datasets (0 → 50,000 users)
//   2. Edge-case math for calculateCongestion & generateIncentive
//   3. Simulated concurrent load test for the in-memory rate limiter
// ─────────────────────────────────────────────────────────────────────────────

import { calculateCongestion, generateIncentive, type Gate } from '../src/lib/balancer';
import {
    checkRateLimit,
    checkAndRegisterClaim,
    _resetForTesting,
} from '../src/lib/rate-limit';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Factory to create a Gate with sensible defaults. */
function makeGate(overrides: Partial<Gate> = {}): Gate {
    return {
        id: 'test-gate',
        name: 'Test Gate',
        capacity: 1000,
        currentLoad: 0,
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STADIUM GATE CAPACITY DATASET
//    Tests calculateCongestion across the full operational range.
// ─────────────────────────────────────────────────────────────────────────────

describe('Stadium Gate Capacity Dataset (0 – 50,000)', () => {
    const capacities = [0, 100, 1_000, 5_000, 10_000, 25_000, 50_000];

    test.each(capacities)(
        'capacity=%i — empty gate reports 0%% congestion (or 100%% for zero-capacity)',
        (capacity) => {
            const gate = makeGate({ capacity, currentLoad: 0 });
            const result = calculateCongestion(gate);
            // A zero-capacity gate should always read as fully congested (100%)
            expect(result).toBe(capacity === 0 ? 100 : 0);
        }
    );

    test.each(capacities.filter(c => c > 0))(
        'capacity=%i — half-full gate reports 50%%',
        (capacity) => {
            const gate = makeGate({ capacity, currentLoad: capacity / 2 });
            expect(calculateCongestion(gate)).toBeCloseTo(50, 5);
        }
    );

    test.each(capacities.filter(c => c > 0))(
        'capacity=%i — completely full gate reports 100%%',
        (capacity) => {
            const gate = makeGate({ capacity, currentLoad: capacity });
            expect(calculateCongestion(gate)).toBe(100);
        }
    );

    test('50,000-capacity gate at 92% load', () => {
        const gate = makeGate({ capacity: 50_000, currentLoad: 46_000 });
        expect(calculateCongestion(gate)).toBe(92);
    });

    test('50,000-capacity gate overflow clamped to 100%', () => {
        const gate = makeGate({ capacity: 50_000, currentLoad: 60_000 });
        expect(calculateCongestion(gate)).toBe(100);
    });

    test('1-capacity gate with 1 user = 100%', () => {
        const gate = makeGate({ capacity: 1, currentLoad: 1 });
        expect(calculateCongestion(gate)).toBe(100);
    });

    test('very large capacity with 1 user ≈ 0%', () => {
        const gate = makeGate({ capacity: 50_000, currentLoad: 1 });
        expect(calculateCongestion(gate)).toBeCloseTo(0.002, 3);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EDGE-CASE MATH
//    Division by zero, negative integers, overflow, floating-point precision.
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge-Case Math — calculateCongestion', () => {
    test('division by zero: capacity=0, load=50 → 100%', () => {
        const gate = makeGate({ capacity: 0, currentLoad: 50 });
        expect(calculateCongestion(gate)).toBe(100);
    });

    test('division by zero: capacity=0, load=0 → 100%', () => {
        const gate = makeGate({ capacity: 0, currentLoad: 0 });
        expect(calculateCongestion(gate)).toBe(100);
    });

    test('negative load clamped to 0%', () => {
        const gate = makeGate({ capacity: 1000, currentLoad: -500 });
        expect(calculateCongestion(gate)).toBe(0);
    });

    test('negative capacity with positive load → clamps correctly', () => {
        // (-500 / -1000) * 100 = 50, clamped to [0,100] → 50
        const gate = makeGate({ capacity: -1000, currentLoad: -500 });
        expect(calculateCongestion(gate)).toBe(50);
    });

    test('negative capacity with 0 load → 0%', () => {
        const gate = makeGate({ capacity: -1000, currentLoad: 0 });
        expect(calculateCongestion(gate)).toBe(0);
    });

    test('load greatly exceeding capacity is clamped to 100%', () => {
        const gate = makeGate({ capacity: 100, currentLoad: 999_999 });
        expect(calculateCongestion(gate)).toBe(100);
    });

    test('floating-point precision: 1/3 capacity', () => {
        const gate = makeGate({ capacity: 3, currentLoad: 1 });
        const result = calculateCongestion(gate);
        expect(result).toBeCloseTo(33.333, 2);
    });

    test('MAX_SAFE_INTEGER values do not produce NaN or Infinity', () => {
        const gate = makeGate({
            capacity: Number.MAX_SAFE_INTEGER,
            currentLoad: Number.MAX_SAFE_INTEGER,
        });
        const result = calculateCongestion(gate);
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBe(100);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. INCENTIVE THRESHOLD BOUNDARY TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge-Case Math — generateIncentive thresholds', () => {
    test('exactly 70% → no incentive (threshold is >70)', () => {
        const gate = makeGate({ capacity: 1000, currentLoad: 700 });
        expect(generateIncentive(gate)).toBeNull();
    });

    test('70.1% → mid-tier incentive (15% Off Merchandise)', () => {
        const gate = makeGate({ capacity: 1000, currentLoad: 701 });
        const result = generateIncentive(gate);
        expect(result).not.toBeNull();
        expect(result!.reward).toBe('15% Off Merchandise');
        expect(result!.delayMinutes).toBe(10);
    });

    test('exactly 85% → mid-tier incentive (threshold is >85)', () => {
        const gate = makeGate({ capacity: 1000, currentLoad: 850 });
        const result = generateIncentive(gate);
        expect(result).not.toBeNull();
        expect(result!.reward).toBe('15% Off Merchandise');
    });

    test('85.1% → high-tier incentive (Free Beverage Voucher)', () => {
        const gate = makeGate({ capacity: 1000, currentLoad: 851 });
        const result = generateIncentive(gate);
        expect(result).not.toBeNull();
        expect(result!.reward).toBe('Free Beverage Voucher');
        expect(result!.delayMinutes).toBe(20);
    });

    test('zero-capacity gate → 100% → high-tier incentive', () => {
        const gate = makeGate({ capacity: 0, currentLoad: 0 });
        const result = generateIncentive(gate);
        expect(result).not.toBeNull();
        expect(result!.reward).toBe('Free Beverage Voucher');
    });

    test('empty gate (0 load, positive capacity) → no incentive', () => {
        const gate = makeGate({ capacity: 5000, currentLoad: 0 });
        expect(generateIncentive(gate)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SIMULATED CONCURRENT LOAD — RATE LIMITER
//    Proves the in-memory rate limiter blocks a single IP after the window
//    is exhausted, even under simulated concurrent fire.
// ─────────────────────────────────────────────────────────────────────────────

describe('Simulated Concurrent Load — Rate Limiter', () => {
    beforeEach(() => {
        // Reset all internal maps between tests to prevent cross-contamination
        _resetForTesting();
    });

    test('a single IP is blocked after 10 requests within the rate-limit window', () => {
        const ip = '203.0.113.42';
        const results: boolean[] = [];

        // Simulate 100 rapid-fire requests from the same IP
        for (let i = 0; i < 100; i++) {
            results.push(checkRateLimit(ip));
        }

        const allowed = results.filter(Boolean).length;
        const blocked = results.filter((r) => !r).length;

        // Exactly 10 should be allowed (the configured max), 90 should be blocked
        expect(allowed).toBe(10);
        expect(blocked).toBe(90);
    });

    test('different IPs are tracked independently', () => {
        // Exhaust rate limit for IP-A
        for (let i = 0; i < 15; i++) {
            checkRateLimit('ip-a');
        }

        // IP-B should still be allowed
        expect(checkRateLimit('ip-b')).toBe(true);

        // IP-A should be blocked
        expect(checkRateLimit('ip-a')).toBe(false);
    });

    test('duplicate-claim dedup blocks second claim for same reward', () => {
        const ip = '10.0.0.1';

        // First claim should succeed
        expect(checkAndRegisterClaim(ip, 'Free Beverage Voucher')).toBe(true);

        // Second claim for same reward should be blocked
        expect(checkAndRegisterClaim(ip, 'Free Beverage Voucher')).toBe(false);

        // Different reward from same IP should still succeed
        expect(checkAndRegisterClaim(ip, '15% Off Merchandise')).toBe(true);
    });

    test('100 simulated concurrent requests from 1 IP: ≤10 succeed', () => {
        const ip = '192.168.1.1';

        // Simulate 100 "concurrent" requests by firing them all synchronously
        // (mirrors real behavior since Node.js is single-threaded)
        const promises = Array.from({ length: 100 }, () =>
            Promise.resolve(checkRateLimit(ip))
        );

        return Promise.all(promises).then((results) => {
            const allowed = results.filter(Boolean).length;
            expect(allowed).toBeLessThanOrEqual(10);
            expect(allowed).toBeGreaterThanOrEqual(1);
        });
    });
});
