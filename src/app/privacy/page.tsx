import Link from "next/link";

export default function Privacy() {
    return (
        <main className="max-w-3xl mx-auto p-8 md:p-16 prose dark:prose-invert">
            <Link href="/" className="text-blue-600 no-underline hover:underline">&larr; Back to Home</Link>
            <h1>Privacy Policy</h1>
            <p>Last updated: April 20, 2026</p>
            <p>Exodus operates in a strictly Test Mode environment for hackathon evaluation. We do not store or track persistent physical location data beyond the lifecycle of the immediate event. Google Wallet pass generation utilizes anonymized internal IDs to protect user identity.</p>
        </main>
    );
}