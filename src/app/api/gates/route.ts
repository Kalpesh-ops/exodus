// src/app/api/gates/route.ts
import { NextResponse } from 'next/server';
import { calculateCongestion, generateIncentive, type Gate } from '@/lib/balancer';

// EFFICIENCY: Mock state to simulate a real-time stadium database without heavy ORMs.
const mockGates: Gate[] = [
    { id: 'g-north', name: 'North Gate (Transit Hub)', capacity: 2000, currentLoad: 1850 }, // ~92.5% full -> High incentive
    { id: 'g-south', name: 'South Gate (Parking)', capacity: 1500, currentLoad: 1150 },     // ~76.6% full -> Low incentive
    { id: 'g-east', name: 'East Gate (Pedestrian)', capacity: 1000, currentLoad: 300 },      // 30% full -> No incentive
];

export async function GET() {
    try {
        // SECURITY & QUALITY: Catching errors and safely mapping data.
        const gatesWithRouting = mockGates.map(gate => ({
            ...gate,
            congestionPercentage: calculateCongestion(gate),
            incentive: generateIncentive(gate),
        }));

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: gatesWithRouting
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Internal Server Error during load calculation' },
            { status: 500 }
        );
    }
}