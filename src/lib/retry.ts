// src/lib/retry.ts

// RELIABILITY: Exponential backoff wrapper to handle dropped packets in high-density environments.
/**
 * Custom fetch wrapper with exponential backoff for resilience against transient errors.
 *
 * @param url The resource to fetch.
 * @param options Standard RequestInit options.
 * @param retries Maximum number of retries before giving up.
 * @param backoff Initial backoff delay in milliseconds.
 * @returns A Promise that resolves to the Response on success.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = 3,
    backoff = 1000
): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            // If it's a 429 (Rate Limit / Duplicate), do NOT retry. That's intentional.
            if (response.status === 429) {
                return response;
            }

            // If it's a 500 error or network drop, it throws to the catch block
            if (!response.ok && response.status >= 500) {
                throw new Error(`Server Error: ${response.status}`);
            }

            return response;
        } catch (error) {
            if (i === retries - 1) throw error; // Throw on the last attempt
            // Wait exponentially longer before next try: 1s -> 2s -> 4s
            await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
        }
    }
    throw new Error("Maximum retries reached");
}