import React from "react";
import { t } from "../i18n";
import type { Lang } from "../types";
import { AlertTriangleIcon } from "./Icons";

interface DemoBannerProps {
  lang: Lang;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ lang }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-ochre-bg border-b border-ochre-border text-ochre px-4 py-2.5 text-sm font-semibold"
    >
      <div className="max-w-3xl mx-auto flex items-center gap-2.5">
        <AlertTriangleIcon className="w-5 h-5 shrink-0 text-ochre" />
        <span>{t(lang, "demoBanner")}</span>
      </div>
    </div>
  );
};
