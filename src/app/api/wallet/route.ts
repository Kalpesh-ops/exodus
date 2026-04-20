// src/app/api/wallet/route.ts
import { NextResponse } from 'next/server';
import { generateWalletPass } from '@/lib/wallet';
import { checkRateLimit, checkAndRegisterClaim } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        // SECURITY: Extract IP from the RIGHTMOST X-Forwarded-For entry.
        // Cloud Run (and most reverse proxies) APPEND the real client IP as the
        // last entry. The leftmost values are client-supplied and trivially spoofable.
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor
            ? forwardedFor.split(',').map(s => s.trim()).pop() || '127.0.0.1'
            : '127.0.0.1';

        // ── Step 1: Rate-limit check (before any body parsing) ──────────
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        // ── Step 2: Parse & validate input ──────────────────────────────
        const body = await request.json();
        const { reward, delayMinutes } = body;

        if (
            typeof reward !== 'string' ||
            reward.trim().length === 0 ||
            typeof delayMinutes !== 'number' ||
            !Number.isFinite(delayMinutes) ||
            delayMinutes <= 0
        ) {
            return NextResponse.json(
                { error: 'Invalid incentive data. reward must be a non-empty string, delayMinutes must be a positive number.' },
                { status: 400 }
            );
        }

        // ── Step 3: Duplicate-claim prevention ──────────────────────────
        if (!checkAndRegisterClaim(ip, reward)) {
            console.warn(`Duplicate claim attempt for IP: ${ip} on reward: ${reward}`);
            return NextResponse.json(
                { success: false, error: `You have already claimed a ${reward} pass.` },
                { status: 429 }
            );
        }

        // ── Step 4: Generate wallet pass ────────────────────────────────
        const walletLink = await generateWalletPass(reward, delayMinutes);

        return NextResponse.json({
            success: true,
            link: walletLink
        }, { status: 200 });

    } catch (error) {
        // SECURITY: Only log the error message, not the full stack, in production.
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Wallet Generation Error:', message);
        return NextResponse.json(
            { success: false, error: 'Failed to generate Wallet pass' },
            { status: 500 }
        );
    }
}