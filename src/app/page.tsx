// src/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { fetchWithRetry } from "@/lib/retry"; // Import our new utility

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
  const [isOffline, setIsOffline] = useState(false); // NEW: Track network state

  const prevGatesRef = useRef<Gate[]>([]);

  useEffect(() => {
    const savedClaims = localStorage.getItem("exodus_claims");
    if (savedClaims) {
      setClaimedRewards(JSON.parse(savedClaims));
    }
  }, []);

  // FIX: Empty dependency array [] prevents the infinite re-render loop
  useEffect(() => {
    async function fetchGates() {
      try {
        const res = await fetch("/api/gates");
        if (!res.ok) throw new Error("Network response was not ok");

        const json = await res.json();
        if (json.success) {
          // Safely update previous state reference without triggering a loop
          setGates(prevGates => {
            prevGatesRef.current = prevGates;
            return json.data;
          });
          setIsOffline(false);
        }
      } catch (error) {
        console.warn("Polling failed. Operating on stale data.");
        setIsOffline(true);
      } finally {
        setLoading(false);
      }
    }

    fetchGates();
    // Strictly poll every 3 seconds
    const intervalId = setInterval(fetchGates, 3000);
    return () => clearInterval(intervalId);
  }, []); // <-- THE FIX: No longer depends on [gates]

  const handleClaim = async (gateId: string, reward: string, delayMinutes: number) => {
    if (claimingId !== null) return;
    setClaimingId(gateId);

    try {
      // RELIABILITY: Use the robust fetch wrapper for critical transactions
      const res = await fetchWithRetry("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reward, delayMinutes }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "An error occurred.");
        return;
      }

      if (json.success && json.link) {
        window.open(json.link, "_blank");
        const updatedClaims = [...claimedRewards, reward];
        setClaimedRewards(updatedClaims);
        localStorage.setItem("exodus_claims", JSON.stringify(updatedClaims));
      }
    } catch (error) {
      console.error("Claim error:", error);
      alert("Network is highly unstable right now. Please try again in a moment.");
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

          {/* Dynamic Network Status Indicator */}
          {!loading && (
            <div className={`mt-4 md:mt-0 flex items-center px-4 py-2 rounded-full border ${isOffline ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-100'
              }`}>
              <span className={`flex w-3 h-3 me-2 rounded-full ${isOffline ? 'bg-orange-500' : 'bg-red-500 animate-pulse'
                }`}></span>
              <span className={`text-sm font-semibold ${isOffline ? 'text-orange-700' : 'text-red-700'
                }`}>
                {isOffline ? 'CONNECTION LOST (Stale)' : 'LIVE DATA'}
              </span>
            </div>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="list">
          {gates.map((gate) => {
            const isCongested = gate.congestionPercentage > 70;
            const isCritical = gate.congestionPercentage > 85;
            const hasClaimed = gate.incentive ? claimedRewards.includes(gate.incentive.reward) : false;

            // Disable button if offline OR if another is processing
            const isButtonDisabled = claimingId !== null || hasClaimed || isOffline;

            return (
              <article
                key={gate.id}
                className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between transition-all duration-500 ${isCongested ? 'border-red-200 shadow-red-50' : 'border-green-200'
                  } ${isOffline ? 'opacity-75 grayscale-[20%]' : ''}`} // Visual cue for stale data
                role="listitem"
              >
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{gate.name}</h2>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1 font-medium text-gray-600">
                      <span>{gate.currentLoad} / {gate.capacity}</span>
                      <span className={`font-bold ${isCritical && !isOffline ? 'text-red-600' : ''}`}>
                        {Math.round(gate.congestionPercentage)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden" aria-hidden="true">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ease-in-out ${isOffline ? 'bg-gray-400' : // Gray out bars if offline
                          isCritical ? 'bg-red-500 animate-pulse' :
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
                        disabled={isButtonDisabled}
                        aria-label={`Claim ${gate.incentive.reward}`}
                        className={`w-full text-white font-bold py-2.5 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${hasClaimed ? 'bg-gray-400' :
                          isOffline ? 'bg-gray-500' :
                            isCritical ? 'bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-300 shadow-lg shadow-red-200' :
                              'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300'
                          }`}
                      >
                        {isOffline ? "Network Offline" :
                          hasClaimed ? "✓ Already Claimed" :
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