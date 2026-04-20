// src/app/api/chat/route.ts
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        // SECURITY: Re-use our IP rate limiter to protect the Gemini API
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ip = forwardedFor ? forwardedFor.split(',').map(s => s.trim()).pop() || '127.0.0.1' : '127.0.0.1';

        if (!checkRateLimit(ip)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }

        const { message, gatesContext } = await request.json();

        if (!message || !gatesContext) {
            return NextResponse.json({ error: 'Missing context' }, { status: 400 });
        }

        // Initialize the modern SDK
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        // CONTEXTUAL LOGIC: Injecting real-time state into the prompt
        const prompt = `
      You are 'Exodus', a highly helpful, smart accessibility assistant for a stadium.
      Current live gate status: ${JSON.stringify(gatesContext)}.
      
      User asks: "${message}"
      
      Instructions:
      1. Be concise (2-3 sentences max).
      2. Base your advice strictly on the live gate status provided.
      3. If a gate is over 85% congested, strongly recommend they wait and claim the incentive from the dashboard.
      4. If they mention mobility issues (wheelchair, stroller), recommend the least congested route.
    `;

        let responseText = "";

        // EFFICIENCY & RELIABILITY: Primary model with a reliable fallback
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            responseText = response.text || "I'm currently calculating the best route.";
        } catch (e) {
            console.warn("Primary model routing failed, triggering fallback...");
            const fallbackResponse = await ai.models.generateContent({
                model: 'gemini-pro',
                contents: prompt,
            });
            responseText = fallbackResponse.text || "I'm currently calculating the best route.";
        }

        return NextResponse.json({ success: true, reply: responseText }, { status: 200 });

    } catch (error) {
        console.error("Assistant Error:", error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}