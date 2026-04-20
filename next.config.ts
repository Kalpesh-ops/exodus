// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // SECURITY: Injecting strict HTTP headers for production hardening
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }, // Prevents clickjacking
          // SECURITY: Deprecated header set to 0 per OWASP recommendation.
          // Modern XSS prevention is handled entirely by Content-Security-Policy.
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // Forces HTTPS
          // SECURITY: CSP is the primary defense against XSS and data injection.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== 'production' ? "'unsafe-eval'" : ""}`,        // Next.js requires unsafe-inline for hydration scripts
              "style-src 'self' 'unsafe-inline'",          // Tailwind injects inline styles
              "img-src 'self' https://fonts.gstatic.com data:",
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",                    // CSP-level framing prevention (mirrors X-Frame-Options)
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // SECURITY: Restrict browser feature access
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;