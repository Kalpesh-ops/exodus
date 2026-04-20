// src/app/api/gates/route.ts
import { NextResponse } from 'next/server';
import { calculateCongestion, generateIncentive, type Gate } from '@/lib/balancer';

// EFFICIENCY: Next.js Route Segment Config - forces cache revalidation every 3 seconds
export const revalidate = 3;

let mockGates: Gate[] = [
    { id: 'g-north', name: 'North Gate (Transit Hub)', capacity: 2000, currentLoad: 1850 },
    { id: 'g-south', name: 'South Gate (Parking)', capacity: 1500, currentLoad: 1150 },
    { id: 'g-east', name: 'East Gate (Pedestrian)', capacity: 1000, currentLoad: 300 },
];

export async function GET() {
    try {
        mockGates = mockGates.map(gate => {
            const trafficJitter = Math.floor(Math.random() * 41) - 15;
            let newLoad = gate.currentLoad + trafficJitter;
            newLoad = Math.max(0, Math.min(gate.capacity + 50, newLoad));
            return { ...gate, currentLoad: newLoad };
        });

        const gatesWithRouting = mockGates.map(gate => ({
            ...gate,
            congestionPercentage: calculateCongestion(gate),
            incentive: generateIncentive(gate),
        }));

        // SCALABILITY: HTTP Cache-Control headers instruct the CDN to absorb the 50,000 RPS load.
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: gatesWithRouting
        }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=59',
            }
        });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}