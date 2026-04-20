// src/lib/balancer.ts

/**
 * Basic representation of a stadium gate for load balancing.
 */
export type Gate = {
    id: string;
    name: string;
    capacity: number;
    currentLoad: number;
};

// SECURITY & EFFICIENCY: Pure function, isolated state logic, highly testable.
/**
 * Calculates the congestion percentage for a given gate.
 * Clamps the result between 0 and 100.
 *
 * @param gate The gate to calculate congestion for.
 * @returns The congestion percentage (0-100).
 */
export function calculateCongestion(gate: Gate): number {
    if (gate.capacity === 0) return 100; // Prevent division by zero
    const percentage = (gate.currentLoad / gate.capacity) * 100;
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100
}

/**
 * Generates an incentive (delay minutes and reward) if a gate is significantly congested.
 *
 * @param gate The gate to evaluate for incentives.
 * @returns An incentive object or null if no incentive is needed.
 */
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