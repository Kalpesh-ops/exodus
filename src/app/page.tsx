// src/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";

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
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);

  const prevGatesRef = useRef<Gate[]>([]);

  // Load previously claimed rewards from local browser storage on mount
  useEffect(() => {
    const savedClaims = localStorage.getItem("exodus_claims");
    if (savedClaims) {
      setClaimedRewards(JSON.parse(savedClaims));
    }
  }, []);

  useEffect(() => {
    async function fetchGates() {
      try {
        const res = await fetch("/api/gates");
        const json = await res.json();
        if (json.success) {
          prevGatesRef.current = gates;
          setGates(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch gates", error);
      } finally {
        setLoading(false);
      }
    }

    fetchGates();
    const intervalId = setInterval(fetchGates, 3000);
    return () => clearInterval(intervalId);
  }, [gates]);

  const handleClaim = async (gateId: string, reward: string, delayMinutes: number) => {
    // Prevent double execution
    if (claimingId !== null) return;

    setClaimingId(gateId);

    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reward, delayMinutes }),
      });

      const json = await res.json();

      if (!res.ok) {
        // Displays proper error messages (like the 429 duplicate claim error)
        alert(json.error || "An error occurred.");
        return;
      }

      if (json.success && json.link) {
        // FIX: Open in new tab to prevent React unmount and "white screen" bug
        window.open(json.link, "_blank");

        // Save claim locally so UI updates instantly
        const updatedClaims = [...claimedRewards, reward];
        setClaimedRewards(updatedClaims);
        localStorage.setItem("exodus_claims", JSON.stringify(updatedClaims));
      }
    } catch (error) {
      console.error("Claim error:", error);
      alert("Network error while generating pass.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
              Stadium Exit Routing
            </h1>
            <p className="mt-2 text-lg text-gray-600" aria-live="polite">
              {loading ? "Calculating optimal exit routes..." : "AI Load Balancer Active."}
            </p>
          </div>
          {!loading && (
            <div className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-red-50 rounded-full border border-red-100">
              <span className="flex w-3 h-3 me-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-semibold text-red-700">LIVE DATA</span>
            </div>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="list">
          {gates.map((gate) => {
            const isCongested = gate.congestionPercentage > 70;
            const isCritical = gate.congestionPercentage > 85;
            // Check if user has already claimed this specific reward
            const hasClaimed = gate.incentive ? claimedRewards.includes(gate.incentive.reward) : false;
            // Lock all buttons if ANY button is currently processing
            const isAnyProcessing = claimingId !== null;

            return (
              <article
                key={gate.id}
                className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-all duration-500 ${isCongested ? 'border-red-200 shadow-red-50' : 'border-green-200'
                  }`}
                role="listitem"
              >
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{gate.name}</h2>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1 font-medium text-gray-600">
                      <span>{gate.currentLoad} / {gate.capacity}</span>
                      <span className={`font-bold ${isCritical ? 'text-red-600' : ''}`}>
                        {Math.round(gate.congestionPercentage)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden" aria-hidden="true">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ease-in-out ${isCritical ? 'bg-red-500 animate-pulse' :
                            isCongested ? 'bg-orange-400' : 'bg-green-500'
                          }`}
                        style={{ width: `${gate.congestionPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 min-h-[100px] flex flex-col justify-end">
                  {gate.incentive ? (
                    <div>
                      {!hasClaimed && (
                        <p className="text-sm text-red-600 font-semibold mb-3 flex items-start gap-1">
                          <span className="mt-0.5">⚠️</span>
                          <span>Wait {gate.incentive.delayMinutes} mins to receive:</span>
                        </p>
                      )}
                      <button
                        onClick={() => handleClaim(gate.id, gate.incentive!.reward, gate.incentive!.delayMinutes)}
                        disabled={isAnyProcessing || hasClaimed}
                        aria-label={`Claim ${gate.incentive.reward}`}
                        className={`w-full text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${hasClaimed ? 'bg-gray-400' :
                            isCritical ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-300 shadow-lg shadow-red-200' :
                              'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300'
                          }`}
                      >
                        {hasClaimed ? "✓ Already Claimed" :
                          claimingId === gate.id ? "Generating Pass..." :
                            `Claim ${gate.incentive.reward}`}
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