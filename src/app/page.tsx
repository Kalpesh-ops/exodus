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

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // NEW: State to control our Hackathon Judge Intercept Modal
  const [successModal, setSuccessModal] = useState<{ link: string, reward: string } | null>(null);

  const { theme, setTheme } = useTheme();
  const prevGatesRef = useRef<Gate[]>([]);

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
        // FIX: Instead of redirecting blindly, open our Intercept Modal
        setSuccessModal({ link: json.link, reward });

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

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatLog(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass the live gates array to give the AI real-world context
        body: JSON.stringify({ message: userMsg, gatesContext: gates }),
      });

      const json = await res.json();
      if (json.success) {
        setChatLog(prev => [...prev, { role: 'ai', text: json.reply }]);
      } else {
        setChatLog(prev => [...prev, { role: 'ai', text: "Sorry, my circuits are a bit congested right now!" }]);
      }
    } catch (error) {
      setChatLog(prev => [...prev, { role: 'ai', text: "Connection error. Please check the live dashboard." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen selection:bg-blue-200 dark:selection:bg-blue-900 relative">
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
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

            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle Dark Mode"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          <section className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-colors duration-300"></div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 relative z-10 transition-colors duration-300">
              Beat the rush. <span className="text-blue-600 dark:text-blue-400">Get rewarded.</span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl relative z-10 transition-colors duration-300" aria-live="polite">
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
                    className={`bg-white dark:bg-slate-900 rounded-3xl shadow-sm border p-6 flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-blue-500/30 ${isCritical ? 'border-red-300 ring-4 ring-red-50 dark:ring-red-950/50' :
                      isCongested ? 'border-orange-200 dark:border-orange-800/50' : 'border-slate-200 dark:border-slate-800'
                      } ${isOffline ? 'opacity-80 grayscale-[30%]' : ''}`}
                    style={{ animation: `fadeInUp 0.5s ease-out ${index * 0.15}s both` }}
                    role="listitem"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight transition-colors duration-300">{gate.name}</h2>
                        {isCritical && !isOffline && (
                          <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider transition-colors duration-300">High Traffic</span>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2 font-semibold text-slate-600 dark:text-slate-400 transition-colors duration-300">
                          <span>{gate.currentLoad} / {gate.capacity} Users</span>
                          <span className={`${isCritical && !isOffline ? 'text-red-600 dark:text-red-400' : ''} transition-colors duration-300`}>
                            {Math.round(gate.congestionPercentage)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden transition-colors duration-300" aria-hidden="true">
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

                    <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col justify-end min-h-[110px] transition-colors duration-300">
                      {gate.incentive ? (
                        <div className="space-y-3">
                          {!hasClaimed && (
                            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
                              <span className="text-red-500 mt-0.5 text-sm">⚠️</span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors duration-300">
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
                        <div className="h-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50 transition-colors duration-300">
                          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2 transition-colors duration-300">
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
              <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 transition-colors duration-300">How It Works</h3>
              <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-300 transition-colors duration-300">
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

            <div className="bg-slate-800 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-700 shadow-md text-slate-300 transition-colors duration-300">
              <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Fair Use Policy</h3>
              <div className="space-y-3 text-xs leading-relaxed">
                <p><strong className="text-slate-100">One Reward Per User:</strong> Strictly limited to claiming one reward per category.</p>
                <p><strong className="text-slate-100">Fraud Prevention:</strong> Dynamic Google Wallet passes are cryptographically signed. Screenshots will not scan.</p>
              </div>
            </div>
          </div>

          {/* SMART DYNAMIC ASSISTANT WIDGET */}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {chatOpen && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-80 mb-4 overflow-hidden flex flex-col h-96 animate-in slide-in-from-bottom-5">
                <div className="bg-blue-600 text-white p-4 font-bold text-sm flex justify-between items-center">
                  <span>Exodus AI Assistant</span>
                  <button onClick={() => setChatOpen(false)} aria-label="Close chat" className="hover:text-blue-200">✖</button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-950 text-sm">
                  <div className="bg-slate-200 dark:bg-slate-800 p-3 rounded-lg rounded-tl-none text-slate-800 dark:text-slate-200 max-w-[85%]">
                    Hi! I can see the live gate data. Where are you seated, or what do you need help with?
                  </div>
                  {chatLog.map((msg, idx) => (
                    <div key={idx} className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto rounded-tr-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  ))}
                  {isTyping && <div className="text-slate-400 text-xs animate-pulse">Exodus is thinking...</div>}
                </div>

                <form onSubmit={handleChatSubmit} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about gates or routes..."
                    className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" disabled={isTyping} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50">Send</button>
                </form>
              </div>
            )}

            <button
              onClick={() => setChatOpen(!chatOpen)}
              aria-label="Open AI Assistant"
              className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 hover:scale-105 transition-all flex items-center justify-center text-2xl"
            >
              🤖
            </button>
          </div>

        </aside>
      </main>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 mt-12 py-8 text-center text-slate-500 dark:text-slate-400 text-sm transition-colors duration-300">
        <p>© 2026 Exodus Systems. Hackathon Test Environment.</p>
        <div className="mt-4 flex justify-center flex-wrap gap-2 sm:gap-4 px-4">
          <Link href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
          <span className="hidden sm:inline-flex items-center min-h-[44px]">&middot;</span>
          <Link href="/terms" className="inline-flex items-center min-h-[44px] px-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</Link>
          <span className="hidden sm:inline-flex items-center min-h-[44px]">&middot;</span>
          <Link href="/accessibility" className="inline-flex items-center min-h-[44px] px-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Accessibility</Link>
        </div>
      </footer>

      {/* HACKATHON JUDGE INTERCEPT MODAL */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-800 transform animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">Secure Pass Generated!</h2>
            <p className="text-center text-slate-600 dark:text-slate-400 text-sm mb-6">
              You successfully claimed the <strong>{successModal.reward}</strong>.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
              <h3 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wide mb-2">Hackathon Evaluation Note:</h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                The Google Wallet API is operating in <strong>Developer Test Mode</strong>. To prevent fraud, Google blocks non-whitelisted emails from saving test passes to physical devices.<br /><br />
                However, you can verify the backend securely signed the RS256 JWT by clicking the link below!
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={successModal.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSuccessModal(null)}
                className="flex items-center justify-center w-full min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Inspect Signed JWT URL
              </a>
              <button
                onClick={() => setSuccessModal(null)}
                className="flex items-center justify-center w-full min-h-[44px] bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 dark:shadow-none"
              >
                Close & Continue Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}