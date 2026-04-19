// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";

// Mirroring our backend types
type Gate = {
  id: string;
  name: string;
  capacity: number;
  currentLoad: number;
  congestionPercentage: number;
  incentive: { delayMinutes: number; reward: string } | null;
};

export default function Home() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Fetch real-time gate congestion data
  useEffect(() => {
    async function fetchGates() {
      try {
        const res = await fetch("/api/gates");
        const json = await res.json();
        if (json.success) setGates(json.data);
      } catch (error) {
        console.error("Failed to fetch gates", error);
      } finally {
        setLoading(false);
      }
    }
    fetchGates();
  }, []);

  // Handle claiming the incentive and generating the Google Wallet pass
  const handleClaim = async (gateId: string, reward: string, delayMinutes: number) => {
    setClaimingId(gateId);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reward, delayMinutes }),
      });
      const json = await res.json();

      if (json.success && json.link) {
        // Redirect user to the Google Wallet save page
        window.location.href = json.link;
      } else {
        alert("Wallet pass generation simulated! (Add real ISSUER_ID to test live)");
      }
    } catch (error) {
      console.error("Claim error:", error);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    // ACCESSIBILITY: Using semantic <main> tag and a readable color contrast
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Stadium Exit Routing
          </h1>
          <p className="mt-2 text-lg text-gray-600" aria-live="polite">
            {loading ? "Calculating optimal exit routes..." : "Live congestion data updated."}
          </p>
        </header>

        {/* ACCESSIBILITY: ARIA role 'list' for screen readers */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="list">
          {gates.map((gate) => {
            const isCongested = gate.congestionPercentage > 70;

            return (
              // ACCESSIBILITY: Semantic <article> element for each card
              <article
                key={gate.id}
                className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-all ${isCongested ? 'border-red-200' : 'border-green-200'
                  }`}
                role="listitem"
              >
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{gate.name}</h2>

                  {/* EFFICIENCY & QUALITY: Visualizing data clearly */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1 font-medium text-gray-600">
                      <span>Capacity: {gate.currentLoad} / {gate.capacity}</span>
                      <span>{Math.round(gate.congestionPercentage)}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden" aria-hidden="true">
                      <div
                        className={`h-2.5 rounded-full ${isCongested ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${gate.congestionPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* INCENTIVE CTA */}
                <div className="mt-6 pt-4 border-t border-gray-100 min-h-[100px] flex flex-col justify-end">
                  {gate.incentive ? (
                    <div>
                      <p className="text-sm text-red-600 font-semibold mb-3">
                        ⚠️ High Congestion. Wait {gate.incentive.delayMinutes} mins to receive:
                      </p>
                      {/* ACCESSIBILITY: Keyboard focusable button with clear aria-label */}
                      <button
                        onClick={() => handleClaim(gate.id, gate.incentive!.reward, gate.incentive!.delayMinutes)}
                        disabled={claimingId === gate.id}
                        aria-label={`Claim ${gate.incentive.reward} by waiting ${gate.incentive.delayMinutes} minutes at ${gate.name}`}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-50"
                      >
                        {claimingId === gate.id ? "Generating Pass..." : `Claim ${gate.incentive.reward}`}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 font-medium flex items-center h-full">
                      ✓ Clear route. Safe to exit.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}