// src/app/api/wallet/route.ts
import { NextResponse } from 'next/server';
import { generateWalletPass } from '@/lib/wallet';
import { checkAndRegisterClaim } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

        const body = await request.json();
        const { reward, delayMinutes } = body;

        if (!reward || !delayMinutes) {
            return NextResponse.json({ error: 'Missing incentive data' }, { status: 400 });
        }

        // SECURITY: Prevent duplicate claims for the same reward category
        if (!checkAndRegisterClaim(ip, reward)) {
            console.warn(`Duplicate claim attempt for IP: ${ip} on reward: ${reward}`);
            return NextResponse.json(
                { success: false, error: `You have already claimed a ${reward} pass.` },
                { status: 429 }
            );
        }

        const walletLink = await generateWalletPass(reward, delayMinutes);

        return NextResponse.json({
            success: true,
            link: walletLink
        }, { status: 200 });

    } catch (error) {
        console.error("Wallet Generation Error:", error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate Wallet pass' },
            { status: 500 }
        );
    }
}