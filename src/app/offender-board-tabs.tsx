"use client";

import { useId, useState, type ReactNode } from "react";

type OffenderBoardTabsProps = {
  metricsBoard: ReactNode;
  xdpBoard: ReactNode;
};

const tabs = [
  {
    key: "metrics",
    label: "Metrics Offenders",
    activeClass:
      "bg-[#d6ff3f] text-[#17140f] shadow-[0_0_30px_rgba(214,255,63,0.22)]",
  },
  {
    key: "xdp",
    label: "XDP Offenders",
    activeClass:
      "bg-[#ff6a2a] text-[#17140f] shadow-[0_0_30px_rgba(255,106,42,0.22)]",
  },
] as const;

export default function OffenderBoardTabs({
  metricsBoard,
  xdpBoard,
}: OffenderBoardTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>(
    "metrics",
  );
  const tabPrefix = useId();

  return (
    <section className="space-y-5">
      <div
        role="tablist"
        aria-label="Mainnet offender boards"
        className="inline-flex w-full max-w-xl rounded-full border border-[#f3ead8]/15 bg-[#120f0c] p-1"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              id={`${tabPrefix}-${tab.key}-tab`}
              type="button"
              role="tab"
              aria-controls={`${tabPrefix}-${tab.key}-panel`}
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] transition ${
                isActive
                  ? tab.activeClass
                  : "text-[#918b7d] hover:text-[#f3ead8]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "metrics" ? (
        <section
          id={`${tabPrefix}-metrics-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-metrics-tab`}
        >
          {metricsBoard}
        </section>
      ) : (
        <section
          id={`${tabPrefix}-xdp-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-xdp-tab`}
        >
          {xdpBoard}
        </section>
      )}
    </section>
  );
}
