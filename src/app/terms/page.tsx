import Link from "next/link";

export default function Terms() {
    return (
        <main className="max-w-3xl mx-auto p-8 md:p-16 prose dark:prose-invert">
            <Link href="/" className="text-blue-600 no-underline hover:underline">&larr; Back to Home</Link>
            <h1>Terms of Service</h1>
            <p>Last updated: April 20, 2026</p>
            <p>By using the Exodus load balancing system, attendees agree to follow the directions of physical stadium staff in the event of an emergency. Digital incentives provided in this test environment hold no real-world monetary value and are generated exclusively for demonstration purposes.</p>
        </main>
    );
}