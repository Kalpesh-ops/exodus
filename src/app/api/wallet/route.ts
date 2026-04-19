// src/app/api/wallet/route.ts
import { NextResponse } from 'next/server';
import { generateWalletPass } from '@/lib/wallet';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reward, delayMinutes } = body;

        if (!reward || !delayMinutes) {
            return NextResponse.json({ error: 'Missing incentive data' }, { status: 400 });
        }

        // Generate the secure Google Wallet link
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