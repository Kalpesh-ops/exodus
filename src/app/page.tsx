// src/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { fetchWithRetry } from "@/lib/retry";

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
  const [isOffline, setIsOffline] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();
  const prevGatesRef = useRef<Gate[]>([]);

  // Prevent hydration mismatch on theme toggle
  useEffect(() => setMounted(true), []);

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
        if (!res.ok) throw new Error("Network response was not ok");

        const json = await res.json();
        if (json.success) {
          setGates(prev => {
            prevGatesRef.current = prev;
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
    const intervalId = setInterval(fetchGates, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const handleClaim = async (gateId: string, reward: string, delayMinutes: number) => {
    if (claimingId !== null) return;
    setClaimingId(gateId);

    try {
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
    <div className="min-h-screen selection:bg-blue-200 dark:selection:bg-blue-900">
      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🏟️</span>
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400">
              Exodus
            </span>
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <div className={`hidden sm:flex items-center px-3 py-1.5 rounded-full border text-xs font-bold tracking-wide shadow-sm transition-colors ${isOffline ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400'
                }`}>
                <span className={`flex w-2 h-2 me-2 rounded-full ${isOffline ? 'bg-orange-500' : 'bg-emerald-500 animate-pulse'
                  }`}></span>
                {isOffline ? 'OFFLINE (STALE)' : 'LIVE SYSTEM'}
              </div>
            )}

            {/* Dark Mode Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle Dark Mode"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          <section className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 relative z-10">
              Beat the rush. <span className="text-blue-600 dark:text-blue-400">Get rewarded.</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl relative z-10" aria-live="polite">
              {loading
                ? "Connecting to stadium turnstiles..."
                : "Tens of thousands of fans are leaving the venue right now. Help us ensure a safe exit by volunteering to wait. If a gate is critically congested, we'll buy your next drink."}
            </p>
          </section>

          <section aria-label="Live Gate Status">
            <div className="grid gap-6 sm:grid-cols-2" role="list">
              {gates.map((gate, index) => {
                const isCongested = gate.congestionPercentage > 70;
                const isCritical = gate.congestionPercentage > 85;
                const hasClaimed = gate.incentive ? claimedRewards.includes(gate.incentive.reward) : false;
                const isButtonDisabled = claimingId !== null || hasClaimed || isOffline;

                return (
                  <article
                    key={gate.id}
                    className={`animate-fade-in-up bg-white dark:bg-slate-900 rounded-2xl shadow-sm border p-6 flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:ring-2 hover:ring-blue-500/30 active:scale-[0.98] ${isCritical ? 'border-red-300 ring-4 ring-red-50 dark:ring-red-950/50' :
                        isCongested ? 'border-orange-200 dark:border-orange-800/50' : 'border-slate-200 dark:border-slate-800'
                      } ${isOffline ? 'opacity-80 grayscale-[30%]' : ''}`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    role="listitem"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{gate.name}</h2>
                        {isCritical && !isOffline && (
                          <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">High Traffic</span>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2 font-semibold text-slate-600 dark:text-slate-400">
                          <span>{gate.currentLoad} / {gate.capacity} Users</span>
                          <span className={`${isCritical && !isOffline ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {Math.round(gate.congestionPercentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ease-in-out ${isOffline ? 'bg-slate-400 dark:bg-slate-600' :
                                isCritical ? 'bg-red-500 animate-pulse' :
                                  isCongested ? 'bg-orange-400' : 'bg-emerald-500'
                              }`}
                            style={{ width: `${gate.congestionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col justify-end min-h-[110px]">
                      {gate.incentive ? (
                        <div className="space-y-3">
                          {!hasClaimed && (
                            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                              <span className="text-red-500 mt-0.5 text-sm">⚠️</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                Wait <strong className="text-slate-900 dark:text-white">{gate.incentive.delayMinutes} mins</strong> to claim this reward.
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => handleClaim(gate.id, gate.incentive!.reward, gate.incentive!.delayMinutes)}
                            disabled={isButtonDisabled}
                            aria-label={`Claim ${gate.incentive.reward}`}
                            className={`w-full min-h-[44px] font-bold py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] ${hasClaimed ? 'bg-slate-400 text-white dark:bg-slate-700 dark:text-slate-300' :
                                isOffline ? 'bg-slate-500 text-white' :
                                  isCritical ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/50' :
                                    'bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white'
                              }`}
                          >
                            {isOffline ? "Network Offline" :
                              hasClaimed ? "✓ Reward Claimed" :
                                claimingId === gate.id ? "Generating Secure Pass..." :
                                  `Claim ${gate.incentive.reward}`}
                          </button>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
                            <span>✓</span> Clear route. Safe to exit.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">How It Works</h3>
              <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
                  <span>Monitor live gate congestion data in real-time.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
                  <span>If a gate is overcrowded, an exclusive incentive will appear.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
                  <span>Tap to claim the reward and save it instantly to your <strong>Google Wallet</strong>.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-800 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-700 shadow-md text-slate-300">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Fair Use Policy</h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <p><strong className="text-slate-100">One Reward Per User:</strong> Strictly limited to claiming one reward per category.</p>
                <p><strong className="text-slate-100">Fraud Prevention:</strong> Dynamic Google Wallet passes are cryptographically signed. Screenshots will not scan.</p>
              </div>
            </div>
          </div>
        </aside>

      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-12 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
        <p>© 2026 Exodus Systems. Hackathon Test Environment.</p>
        <div className="mt-4 flex justify-center items-center flex-wrap gap-2 sm:gap-4 px-4">
          <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2 px-3 min-h-[44px] inline-flex items-center justify-center">Privacy Policy</Link>
          <span className="hidden sm:flex items-center justify-center min-h-[44px]">&middot;</span>
          <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2 px-3 min-h-[44px] inline-flex items-center justify-center">Terms of Service</Link>
          <span className="hidden sm:flex items-center justify-center min-h-[44px]">&middot;</span>
          <Link href="/accessibility" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2 px-3 min-h-[44px] inline-flex items-center justify-center">Accessibility</Link>
        </div>
      </footer>
    </div>
  );
}