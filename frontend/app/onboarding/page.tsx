"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { syndicateFetch } from "@/utils/api";
import { SpringToggle } from "@/components/legal/SpringToggle";
import { useLegal } from "@/context/LegalContext";
import { LEGAL_VERSION } from "@/components/legal/PolicyVault";

export default function OnboardingPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  const { openVault } = useLegal();
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If already onboarded, skip straight to booking
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.replace("/sign-in"); return; }
    if ((user.unsafeMetadata as any)?.barberName) {
      router.replace("/book");
    }
  }, [isLoaded, isSignedIn, user]);

  const checkNickname = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const clean = value.trim();
    if (clean.length < 2) { setStatus("idle"); return; }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await syndicateFetch(`/api/v1/check-nickname?name=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.reason === "invalid") setStatus("invalid");
        else setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNickname(val);
    setError(null);
    checkNickname(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nickname.trim();
    if (!clean || status !== "available" || !agreed) return;

    setStatus("saving");
    setError(null);
    try {
      await user!.update({
        unsafeMetadata: {
          barberName: clean,
          legal_consent_timestamp: new Date().toISOString(),
          legal_version_accepted: LEGAL_VERSION,
        }
      });
      router.replace("/book");
    } catch (err: any) {
      setError("Failed to save. Try again.");
      setStatus("available");
    }
  };

  const borderColor =
    status === "available" ? "border-emerald-500/60 focus:border-emerald-500" :
    status === "taken" || status === "invalid" ? "border-red-600/60 focus:border-red-600" :
    "border-white/10 focus:border-red-600";

  const hint =
    status === "checking" ? "Checking..." :
    status === "available" ? "✓ That name is yours to take." :
    status === "taken" ? "✗ Already claimed. Pick another." :
    status === "invalid" ? "✗ Only letters, numbers, spaces, hyphens, dots allowed." :
    "This is what the barber and booking system will see. Make it yours.";

  const hintColor =
    status === "available" ? "text-emerald-400" :
    status === "taken" || status === "invalid" ? "text-red-500" :
    "text-white/20";

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-12">
          <h2 className="text-white font-black tracking-tighter text-3xl mb-2">
            GANGSTER<span className="text-red-600">.</span>
          </h2>
          <p className="text-white/30 text-[10px] uppercase font-bold tracking-[0.4em]">
            Claim Your Identity
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10">
          <div className="mb-8">
            <p className="text-white font-black text-lg uppercase tracking-tight leading-snug mb-3">
              What should the barber call you?
            </p>
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold leading-relaxed">
              Choose a unique nickname. It will appear on your bookings and in the system — no duplicates allowed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <input
                type="text"
                value={nickname}
                onChange={handleChange}
                maxLength={40}
                placeholder="e.g. Musa, Big G, The Don..."
                autoFocus
                className={`w-full bg-white/5 border ${borderColor} rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest outline-none transition-all placeholder:normal-case placeholder:font-medium placeholder:tracking-normal placeholder:text-white/20`}
              />
              <p className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${hintColor}`}>
                {hint}
              </p>
            </div>

            {error && (
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{error}</p>
            )}

            {/* ── Consent Gate ── */}
            <div className="pt-4 pb-2">
              <SpringToggle
                checked={agreed}
                onChange={setAgreed}
                id="onboarding-consent"
                label={
                  <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                    By joining the crew, you agree to our{" "}
                    <button
                      type="button"
                      onClick={() => openVault("terms")}
                      className="text-red-600 hover:text-red-400 underline underline-offset-2 transition-colors"
                    >
                      House Rules
                    </button>{" "}
                    and how we handle your data{" "}
                    <button
                      type="button"
                      onClick={() => openVault("privacy")}
                      className="text-red-600 hover:text-red-400 underline underline-offset-2 transition-colors"
                    >
                      (Privacy Policy)
                    </button>.
                  </p>
                }
              />
            </div>

            <button
              type="submit"
              disabled={status !== "available" || !agreed}
              className={`w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] rounded-3xl transition-all ${
                status === "available" && agreed
                  ? "bg-white text-black hover:bg-red-600 hover:text-white shadow-xl"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              }`}
            >
              {status === "saving" ? "Locking In..." : !agreed ? "Flip the Switch to Continue" : "Claim This Name"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
