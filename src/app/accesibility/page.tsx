import Link from "next/link";

export default function Accessibility() {
    return (
        <main className="max-w-3xl mx-auto p-8 md:p-16 prose dark:prose-invert">
            <Link href="/" className="text-blue-600 no-underline hover:underline">&larr; Back to Home</Link>
            <h1>Accessibility Statement</h1>
            <p>Exodus is committed to ensuring digital accessibility for people with disabilities. We have designed this application to align with WCAG 2.1 Level AA standards, prioritizing semantic HTML, screen-reader compatibility (ARIA live regions), and high-contrast dynamic status indicators.</p>
        </main>
    );
}