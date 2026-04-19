// src/lib/balancer.ts

export type Gate = {
    id: string;
    name: string;
    capacity: number;
    currentLoad: number;
};

// SECURITY & EFFICIENCY: Pure function, isolated state logic, highly testable.
export function calculateCongestion(gate: Gate): number {
    if (gate.capacity === 0) return 100; // Prevent division by zero
    const percentage = (gate.currentLoad / gate.capacity) * 100;
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100
}

export function generateIncentive(gate: Gate): { delayMinutes: number; reward: string } | null {
    const congestion = calculateCongestion(gate);

    if (congestion > 85) {
        return { delayMinutes: 20, reward: "Free Beverage Voucher" };
    } else if (congestion > 70) {
        return { delayMinutes: 10, reward: "15% Off Merchandise" };
    }

    // No incentive needed if under 70% capacity
    return null;
}