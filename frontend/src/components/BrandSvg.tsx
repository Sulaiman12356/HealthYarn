import React, { useEffect, useState } from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { MicIcon, PlayIcon } from "./Icons";

export type BrandVariant = "brand" | "onGreen" | "ink";

export const BrandMark: React.FC<{ variant?: BrandVariant; className?: string }> = ({
  variant = "brand",
  className = "w-9 h-9"
}) => {
  const bubbleFill =
    variant === "brand" ? "#0F5C4A" : variant === "onGreen" ? "#FFF8EC" : "#1B1F1D";
  const barColor = variant === "brand" ? "#FFF8EC" : variant === "onGreen" ? "#0F5C4A" : "#FFF8EC";
  const centerColor = variant === "ink" ? "#FFF8EC" : "#F5A623";

  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 10.5C5 6.91 7.91 4 11.5 4h17C32.09 4 35 6.91 35 10.5v13c0 3.59-2.91 6.5-6.5 6.5H16.5L9.5 36v-6H11.5C7.91 30 5 27.09 5 23.5v-13Z"
        fill={bubbleFill}
      />
      <rect x="10.5" y="14.5" width="2.6" height="7" rx="1.3" fill={barColor} />
      <rect x="14.6" y="11.5" width="2.6" height="13" rx="1.3" fill={barColor} />
      {/* Taller center bar with soft heart-like top notch */}
      <path
        d="M18.7 10.2c0-.95.95-1.5 1.3-.72.35-.78 1.3-.23 1.3.72V24.7c0 .72-.58 1.3-1.3 1.3s-1.3-.58-1.3-1.3V10.2Z"
        fill={centerColor}
      />
      <rect x="22.8" y="11.5" width="2.6" height="13" rx="1.3" fill={barColor} />
      <rect x="26.9" y="14.5" width="2.6" height="7" rx="1.3" fill={barColor} />
    </svg>
  );
};

export const BrandWordmark: React.FC<{ variant?: BrandVariant; className?: string }> = ({
  variant = "brand",
  className = "text-xl"
}) => {
  const leftColor =
    variant === "onGreen" ? "text-white" : variant === "ink" ? "text-hy-ink" : "text-hy-green";
  const rightColor = variant === "onGreen" ? "text-hy-cream" : "text-hy-ink";

  return (
    <span className={`font-extrabold tracking-tight leading-none ${className}`}>
      <span className={leftColor}>Health</span>
      <span className={rightColor}>Yarn</span>
    </span>
  );
};

export const BrandLogo: React.FC<{
  variant?: BrandVariant;
  markSize?: string;
  textSize?: string;
}> = ({ variant = "brand", markSize = "w-9 h-9", textSize = "text-xl" }) => (
  <span className="inline-flex items-center gap-2">
    <BrandMark variant={variant} className={markSize} />
    <BrandWordmark variant={variant} className={textSize} />
  </span>
);

export const SoundWaveMotif: React.FC<{
  active?: boolean;
  color?: string;
  className?: string;
}> = ({ active = false, color = "#F5A623", className = "w-full h-24" }) => {
  const heights = [28, 52, 76, 44, 88, 62, 92, 50, 74, 38, 64, 34];
  return (
    <svg
      viewBox="0 0 280 96"
      className={className}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {heights.map((h, i) => {
        const y = (96 - h) / 2;
        const x = 10 + i * 22;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width="10"
            height={h}
            rx="5"
            fill={color}
            fillOpacity={active ? 0.95 : 0.72}
            className={active ? "hy-wave-bar-active" : "hy-wave-bar"}
            style={{ animationDelay: `${i * 0.11}s` }}
          />
        );
      })}
    </svg>
  );
};

export const SoundWaveDivider: React.FC<{ className?: string }> = ({
  className = "w-full max-w-md mx-auto h-7 text-hy-amber/55"
}) => (
  <svg viewBox="0 0 360 28" className={className} fill="none" aria-hidden="true">
    <path
      d="M4 14h82c12 0 18-9 26-9s14 18 22 18 14-18 22-18 14 18 22 18 14-18 22-18 14 18 22 18 14-18 22-18 14 9 26 9h86"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const HeroPhoneMockup: React.FC<{
  lang: Lang;
  isPlayingSample: boolean;
}> = ({ lang, isPlayingSample }) => {
  const [phase, setPhase] = useState<0 | 1>(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setPhase((p) => (p === 0 ? 1 : 0));
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const chipLabel = lang === "yo" ? "YO" : lang === "pcm" ? "PIDGIN" : "EN";

  return (
    <div className="relative mx-auto w-full max-w-[330px] sm:max-w-[360px] py-3">
      {/* Leaf Green rounded backdrop block */}
      <div
        className="relative hero-green-wash rounded-[28px] px-5 pt-7 pb-6 shadow-lift overflow-hidden"
        aria-hidden="true"
      >
        {/* Sunrise Amber sound wave behind phone */}
        <div className="pointer-events-none absolute inset-x-0 top-10 px-2 opacity-90 z-0">
          <SoundWaveMotif active={isPlayingSample} color="#F5A623" className="w-full h-36" />
        </div>

        {/* Tilted phone frame */}
        <div className="relative z-10 mx-auto w-[248px] sm:w-[264px] rounded-[26px] border-[5px] border-[#1B1F1D] bg-[#FFF8EC] p-3.5 shadow-xl lg:rotate-[-4deg] transition-transform">
          {/* Speaker bar & mini app rail */}
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-seam" />
          <div className="flex items-center justify-between rounded-xl bg-hy-green px-2.5 py-1.5 text-white mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold">
              <BrandMark variant="onGreen" className="w-4 h-4" />
              HealthYarn
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-hy-green">
              {chipLabel}
            </span>
          </div>

          {/* Chat-style looping waveform bubbles above mic */}
          <div className="space-y-2 mb-3.5">
            <div
              className={`rounded-xl border px-2.5 py-2 transition-opacity duration-300 ${
                phase === 0
                  ? "bg-white border-hy-amber opacity-100"
                  : "bg-white/90 border-seam opacity-85"
              }`}
            >
              <p className="text-[10px] font-semibold text-hy-ink truncate mb-1">
                {t(lang, "mockupQuestion")}
              </p>
              <div className="flex items-center gap-1">
                {[8, 13, 10, 15, 9, 12, 7].map((h, idx) => (
                  <span
                    key={idx}
                    className="w-1 rounded-full bg-hy-green"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>

            <div
              className={`rounded-xl bg-viridian-soft border border-hy-green/25 px-2.5 py-2 transition-opacity duration-300 ${
                phase === 1 || isPlayingSample ? "opacity-100" : "opacity-80"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-hy-amber text-hy-ink shrink-0">
                  <PlayIcon className="w-2.5 h-2.5" />
                </span>
                <p className="text-[10px] font-bold text-hy-green truncate">
                  {t(lang, "mockupAnswerLabel")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[10, 16, 12, 18, 14, 11, 16, 9, 13].map((h, idx) => (
                  <span
                    key={idx}
                    className={`w-1 rounded-full bg-hy-amber ${
                      isPlayingSample ? "hy-wave-bar-active" : ""
                    }`}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Large Amber Microphone Hero inside Phone */}
          <div className="flex flex-col items-center mb-3.5">
            <div className="w-20 h-20 rounded-full bg-hy-amber text-hy-ink flex flex-col items-center justify-center shadow-md border-2 border-hy-ink/10">
              <MicIcon className="w-6 h-6" />
              <span className="text-[9px] font-extrabold leading-tight mt-0.5 text-center px-1">
                {t(lang, "mockupHoldToAsk")}
              </span>
            </div>
          </div>

          {/* Three mini topic tiles */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              t(lang, "topicMalaria"),
              t(lang, "topicBp"),
              t(lang, "topicOrsShort")
            ].map((lbl, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-hy-sand border border-seam px-1 py-1.5 text-[9px] font-bold text-hy-ink leading-tight truncate"
              >
                {lbl}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const StepIllustration: React.FC<{ step: 1 | 2 | 3 }> = ({ step }) => {
  if (step === 1) {
    return (
      <svg viewBox="0 0 220 130" className="w-full h-32" fill="none" aria-hidden="true">
        <rect width="220" height="130" rx="14" fill="#F1E6D2" />
        {/* Warm phone body */}
        <rect x="64" y="14" width="92" height="104" rx="16" fill="#0F5C4A" />
        <rect x="70" y="22" width="80" height="88" rx="10" fill="#FFF8EC" />
        {/* Three pill language chips */}
        <rect x="80" y="34" width="60" height="16" rx="8" fill="#F5A623" />
        <rect x="88" y="40" width="26" height="4" rx="2" fill="#1B1F1D" />
        <rect x="80" y="56" width="60" height="16" rx="8" fill="#F1E6D2" stroke="#0F5C4A" strokeWidth="1.5" />
        <rect x="88" y="62" width="32" height="4" rx="2" fill="#1B1F1D" />
        <rect x="80" y="78" width="60" height="16" rx="8" fill="#F1E6D2" stroke="#0F5C4A" strokeWidth="1.5" />
        <rect x="88" y="84" width="24" height="4" rx="2" fill="#1B1F1D" />
        {/* Simple hand tapping */}
        <path
          d="M150 62c-10-4-18-10-24-12-5-2-9 2-6 7l10 14c-8 10-8 24 2 34l32-12-14-31Z"
          fill="#844E32"
        />
      </svg>
    );
  }

  if (step === 2) {
    return (
      <svg viewBox="0 0 220 130" className="w-full h-32" fill="none" aria-hidden="true">
        <rect width="220" height="130" rx="14" fill="#F1E6D2" />
        {/* Grandmother figure with head-tie holding phone to mouth */}
        <path d="M40 130c2-24 18-38 38-38s36 14 38 38H40Z" fill="#0F5C4A" />
        <circle cx="78" cy="64" r="21" fill="#6B3F28" />
        {/* Traditional head-tie (gele) in Leaf Green + Amber band */}
        <path d="M55 58c4-18 22-26 42-20 8 2 12 10 8 18-14-6-36-6-50 2Z" fill="#0A3F33" />
        <path d="M58 55c14-5 32-5 44 0" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
        {/* Arm & hand holding phone near mouth */}
        <path d="M104 98c10-6 18-16 20-26" stroke="#6B3F28" strokeWidth="11" strokeLinecap="round" />
        <rect x="118" y="52" width="22" height="36" rx="6" fill="#1B1F1D" />
        <rect x="122" y="57" width="14" height="24" rx="3" fill="#FFF8EC" />
        {/* Voice wave ripples */}
        <path d="M150 62c6 4 6 14 0 18" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M161 55c9 8 9 24 0 32" stroke="#0F5C4A" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M172 48c12 12 12 34 0 46" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 220 130" className="w-full h-32" fill="none" aria-hidden="true">
      <rect width="220" height="130" rx="14" fill="#F1E6D2" />
      {/* Market stall canopy hint / shade */}
      <path d="M18 20h184l-8 14H26l-8-14Z" fill="#0F5C4A" />
      {/* Person seated/resting listening calmly */}
      <path d="M46 130c2-22 16-36 36-36s34 14 36 36H46Z" fill="#0A3F33" />
      <circle cx="82" cy="68" r="19" fill="#844E32" />
      {/* Hand & phone */}
      <rect x="116" y="66" width="24" height="40" rx="6" fill="#1B1F1D" />
      <rect x="120" y="71" width="16" height="28" rx="3" fill="#FFF8EC" />
      {/* Speech bubble with sound bars coming from phone */}
      <rect x="148" y="42" width="54" height="34" rx="10" fill="#0F5C4A" />
      <rect x="159" y="54" width="4" height="10" rx="2" fill="#FFF8EC" />
      <rect x="167" y="49" width="4" height="20" rx="2" fill="#F5A623" />
      <rect x="175" y="46" width="4" height="26" rx="2" fill="#FFF8EC" />
      <rect x="183" y="51" width="4" height="16" rx="2" fill="#F5A623" />
      <rect x="191" y="55" width="4" height="8" rx="2" fill="#FFF8EC" />
    </svg>
  );
};
