// __tests__/balancer.test.ts
import { calculateCongestion, generateIncentive, Gate } from '../src/lib/balancer';

describe('Exodus Load Balancer Engine', () => {
    const southGate: Gate = {
        id: 'g-south',
        name: 'South Exit',
        capacity: 1000,
        currentLoad: 0,
    };

    test('calculates correct congestion percentage', () => {
        southGate.currentLoad = 500;
        expect(calculateCongestion(southGate)).toBe(50);

        southGate.currentLoad = 1000;
        expect(calculateCongestion(southGate)).toBe(100);
    });

    test('prevents capacity division by zero', () => {
        const brokenGate: Gate = { ...southGate, capacity: 0, currentLoad: 50 };
        expect(calculateCongestion(brokenGate)).toBe(100);
    });

    test('generates high incentive for critical congestion (>85%)', () => {
        southGate.capacity = 1000;
        southGate.currentLoad = 900; // 90% full
        const incentive = generateIncentive(southGate);

        expect(incentive).not.toBeNull();
        expect(incentive?.delayMinutes).toBe(20);
        expect(incentive?.reward).toBe("Free Beverage Voucher");
    });

    test('generates no incentive for normal traffic (<70%)', () => {
        southGate.currentLoad = 400; // 40% full
        expect(generateIncentive(southGate)).toBeNull();
    });
});