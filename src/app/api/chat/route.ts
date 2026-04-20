import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',').map(s => s.trim()).pop() || '127.0.0.1' : '127.0.0.1';
        if (!checkRateLimit(ip)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

        const { message, gatesContext } = await request.json();
        if (!message || !gatesContext) return NextResponse.json({ error: 'Missing context' }, { status: 400 });

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        // EFFICIENCY & CODE QUALITY: Using Advanced System Instructions instead of string concatenation
        const config = {
            systemInstruction: `You are 'Exodus', an expert stadium accessibility assistant. Live gate status: ${JSON.stringify(gatesContext)}. Rules: 1. Max 2 sentences. 2. If a gate >85% congested, strongly urge the user to claim the dashboard incentive. 3. Accommodate mobility/wheelchair requests.`,
            temperature: 0.2, // Deterministic responses
        };

        let responseText = "";
        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: message, config });
            responseText = response.text || "Calculating the safest route...";
        } catch (e) {
            const fallback = await ai.models.generateContent({ model: 'gemini-pro', contents: message, config });
            responseText = fallback.text || "Calculating the safest route...";
        }
        return NextResponse.json({ success: true, reply: responseText }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}