"use client";

import React, { useEffect, useRef } from "react";
import { useLegal } from "@/context/LegalContext";

const LEGAL_VERSION = "1.0";

const PRIVACY_CONTENT = `
# Privacy Policy

**Gangster Barber — Gweru, Zimbabwe**
*Effective: April 2026 · Version ${LEGAL_VERSION}*

---

## 1. Who We Are

Gangster Barber operates at Senga, Nehosho, Gweru, Zimbabwe. We run an online booking platform at gangsterbarber.com. This policy explains what data we collect, why, and how we protect it.

---

## 2. Data We Collect

**When you create an account:**
- Your name (or chosen nickname)
- Email address (via Clerk authentication)
- Phone number (optional, for booking reminders)

**When you make a booking:**
- Selected service and time slot
- Payment method and transaction reference (not card numbers — we never store card data)
- Device type and approximate location (for fraud prevention only)

**Automatically:**
- Session data (login/logout times)
- Page visits via Google Analytics (anonymised)

---

## 3. Why We Store Barber & Staff Data

Our barbers have schedules stored in the system to manage availability. This includes:
- Working hours and days off
- Service specialisations
- Booking performance (to improve service quality — never shared publicly)

Staff data is only accessible to the shop owner and IT admin roles.

---

## 4. Location-Based Booking

Gangster Barber operates a single location in Gweru. Location data is used solely to:
- Show accurate directions and maps
- Verify you are booking at the correct branch
- No GPS tracking is performed on customers

---

## 5. Customer Contact & Reminders

If you provide a phone number or email:
- You will receive booking confirmations and reminders **only**
- We do not send unsolicited marketing messages
- You can opt out at any time by contacting us on WhatsApp: +263 773 772 047

---

## 6. Payment Data

Payments via EcoCash, OneMoney, InnBucks and Paynow are processed by those providers. We store only the transaction reference number. We **never** see, store, or transmit your PIN or card details.

---

## 7. Your Rights

You can request:
- A copy of all data we hold about you
- Deletion of your account and booking history
- Correction of any inaccurate information

Contact: Gangsterbarbermobilebarber@gmail.com

---

## 8. Cookie Policy

We use cookies for:
- Session management (required — cannot be disabled)
- Google Analytics (optional — can be declined in the cookie banner)
- Marketing (optional — only if you consent)

---

## 9. Data Retention

Booking records are retained for 24 months for accounting purposes. Account data is deleted within 30 days of an account deletion request.

---

## 10. Changes

We will notify you of material changes via email or an in-app notice. Continued use after notification constitutes acceptance.
`;

const TERMS_CONTENT = `
# Terms of Service

**Gangster Barber — House Rules**
*Effective: April 2026 · Version ${LEGAL_VERSION}*

---

## 1. The Agreement

By booking an appointment or creating an account on gangsterbarber.com, you agree to these terms. If you don't agree, do not use the platform.

---

## 2. Bookings & Cancellations

**Booking confirmation:** Your slot is only confirmed after the booking fee (if applicable) is processed.

**Cancellations:** Cancel at least **2 hours** before your appointment to avoid a no-show mark.

**No-shows:** Three or more no-shows may result in a temporary booking suspension.

**Lateness:** If you are more than 15 minutes late, your slot may be forfeited and given to a walk-in.

---

## 3. Payments

All prices are in USD. We accept:
- EcoCash
- OneMoney
- InnBucks
- O'Mari
- Cash on arrival

Online booking fees, where charged, are non-refundable once the appointment slot is confirmed.

---

## 4. Service Quality

We take pride in our work. If you are unsatisfied with a service, raise it with us on the day. We will make it right at no additional cost where the issue is on our side.

---

## 5. Your Nickname

The nickname you choose during signup:
- Must not impersonate another person
- Must not contain offensive language
- Can be changed by contacting us

We reserve the right to rename offensive nicknames without notice.

---

## 6. Prohibited Conduct

You agree not to:
- Submit false bookings
- Abuse or threaten staff
- Attempt to reverse-engineer or exploit the booking platform
- Create multiple accounts to circumvent suspensions

Violations may result in permanent account removal.

---

## 7. Intellectual Property

The Gangster Barber name, logo, and website design are proprietary. You may not reproduce them without written permission.

---

## 8. Limitation of Liability

Gangster Barber is not liable for:
- Delays caused by circumstances outside our control
- Third-party payment processing failures
- Device or connectivity issues when booking online

---

## 9. Governing Law

These terms are governed by the laws of Zimbabwe. Disputes shall be resolved under Zimbabwean jurisdiction.

---

## 10. Contact

Questions? Reach us:
- WhatsApp: +263 773 772 047
- Email: Gangsterbarbermobilebarber@gmail.com
- In person: Senga, Nehosho, Gweru
`;

function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      nodes.push(<h1 key={key++} className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h2 key={key++} className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mt-10 mb-3">{line.slice(3)}</h2>);
    } else if (line.startsWith("**") && line.endsWith("**")) {
      nodes.push(<p key={key++} className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1 mt-4">{line.replace(/\*\*/g, "")}</p>);
    } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      nodes.push(<p key={key++} className="text-[9px] font-bold text-white/30 tracking-widest uppercase mb-4">{line.replace(/\*/g, "")}</p>);
    } else if (line.startsWith("- ")) {
      nodes.push(
        <div key={key++} className="flex gap-3 mb-2 items-start">
          <div className="w-1 h-1 rounded-full bg-red-600 mt-2 shrink-0" />
          <p className="text-[11px] text-white/60 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90">$1</strong>') }} />
        </div>
      );
    } else if (line === "---") {
      nodes.push(<div key={key++} className="h-px bg-white/[0.05] my-6" />);
    } else if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-2" />);
    } else {
      const html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-black">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em class="text-white/50">$1</em>');
      nodes.push(
        <p key={key++} className="text-[11px] text-white/60 leading-relaxed font-medium mb-1" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
  }
  return nodes;
}

export function PolicyVault() {
  const { vaultOpen, closeVault } = useLegal();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (vaultOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    // Lock body scroll when vault is open
    if (vaultOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [vaultOpen]);

  const isOpen = !!vaultOpen;
  const content = vaultOpen === "privacy" ? PRIVACY_CONTENT : TERMS_CONTENT;
  const title = vaultOpen === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <>
      {/* ── Background tilt layer ─────────────────────────── */}
      <div
        className="fixed inset-0 z-[200] pointer-events-none"
        style={{
          opacity: isOpen ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        {/* Dark overlay behind panel */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

        {/* Tilted page silhouette (decorative depth) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            perspective: "1200px",
          }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#111] via-[#050505] to-black origin-left"
            style={{
              transform: isOpen ? "rotateY(15deg) scale(0.92) translateX(-4%)" : "rotateY(0deg) scale(1)",
              transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)",
              borderRadius: "0 2rem 2rem 0",
              boxShadow: isOpen ? "8px 0 40px rgba(0,0,0,0.8)" : "none",
            }}
          >
            {/* Faint grid lines to suggest page content depth */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 40px), repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(255,255,255,0.03) 80px)"
            }} />
          </div>
        </div>
      </div>

      {/* ── Slide-out Panel ──────────────────────────────── */}
      <div
        className="fixed top-0 right-0 bottom-0 z-[210] w-full max-w-2xl flex flex-col"
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* Panel surface */}
        <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/[0.06] shadow-[-40px_0_80px_rgba(0,0,0,0.8)]">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.05] shrink-0">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-red-600 mb-1">Gangster Barber</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">{title}</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20 border border-white/10 px-3 py-1.5 rounded-full">
                v{LEGAL_VERSION}
              </span>
              <button
                onClick={closeVault}
                className="group flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/40 group-hover:text-white transition-colors">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Back</span>
              </button>
            </div>
          </div>

          {/* ── Scrollable Content ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#dc2626 transparent" }}
          >
            {/* Top scroll curvature hint */}
            <div className="sticky top-0 h-8 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

            <div className="px-8 pb-16">
              {/* Vertical curvature container */}
              <div
                style={{
                  perspective: "800px",
                  perspectiveOrigin: "50% 50%",
                }}
              >
                <div
                  className="space-y-1"
                  style={{
                    transformStyle: "preserve-3d",
                  }}
                >
                  {renderMarkdown(content)}
                </div>
              </div>
            </div>

            {/* Bottom fade */}
            <div className="sticky bottom-0 h-16 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
          </div>

          {/* ── Footer CTA ── */}
          <div className="px-8 py-6 border-t border-white/[0.05] shrink-0">
            <button
              onClick={closeVault}
              className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-xl"
            >
              Back to Booking ↗
            </button>
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[205] cursor-pointer"
          style={{ right: "min(100vw, 672px)" }}
          onClick={closeVault}
        />
      )}
    </>
  );
}

export { LEGAL_VERSION };
