"use client";

import { motion } from "framer-motion";
import Image from "next/image";

/** GRABO brand bar with the studio's ON AIR light */
export function StudioHeader({ live }: { live: boolean }) {
  return (
    <header dir="rtl" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Image
          src="/logo-gold.png"
          alt="GRABO"
          width={1280}
          height={318}
          preload
          className="h-10 w-auto drop-shadow-[0_0_14px_rgba(232,200,114,0.35)] sm:h-12"
        />
        <div className="border-r border-gold/30 pr-4">
          <p className="text-base font-semibold text-gold-pale sm:text-lg">ניהול יצירתי של עושר ואושר</p>
          <p className="text-xs text-mist-dim">אולפן הסוכנים · מרכז ההפקה</p>
        </div>
      </div>
      <OnAirLight live={live} />
    </header>
  );
}

function OnAirLight({ live }: { live: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 self-start rounded-lg border px-3 py-2 transition-colors sm:self-auto ${
        live ? "border-on-air/60 bg-on-air/10" : "border-white/10 bg-charcoal/70"
      }`}
    >
      <motion.span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          background: live ? "#e5484d" : "#d4af37",
          boxShadow: live ? "0 0 12px #e5484d" : "0 0 6px rgba(212,175,55,0.5)",
        }}
        animate={live ? { opacity: [1, 0.35, 1] } : { opacity: 0.6 }}
        transition={live ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <div className="leading-tight">
        <p
          className={`font-mono text-sm font-bold tracking-[0.25em] ${live ? "text-[#ff8a8d]" : "text-gold-light/70"}`}
          dir="ltr"
        >
          {live ? "ON AIR" : "STANDBY"}
        </p>
        <p className="text-[11px] text-mist">{live ? "שידור חי מאולפן הסוכנים" : "האולפן מוכן לצילום"}</p>
      </div>
    </div>
  );
}
