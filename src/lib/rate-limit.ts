// src/lib/rate-limit.ts

// EFFICIENCY: Map tracking IP -> Set of claimed reward strings
const claimedMap = new Map<string, Set<string>>();

export function checkAndRegisterClaim(ip: string, rewardType: string): boolean {
    let userClaims = claimedMap.get(ip);

    if (!userClaims) {
        userClaims = new Set<string>();
        claimedMap.set(ip, userClaims);
    }

    // If they already claimed this specific reward, block it
    if (userClaims.has(rewardType)) {
        return false;
    }

    // Register the claim
    userClaims.add(rewardType);
    return true;
}