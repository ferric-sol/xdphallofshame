"use client";

import { useId, useState, type ReactNode } from "react";

type WallOfShameTabsProps = {
  mainnetTab: ReactNode;
  testnetTab: ReactNode;
};

const tabs = [
  {
    key: "mainnet",
    label: "Mainnet",
  },
  {
    key: "testnet",
    label: "Testnet",
  },
] as const;

export default function WallOfShameTabs({
  mainnetTab,
  testnetTab,
}: WallOfShameTabsProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>(
    "mainnet",
  );
  const tabPrefix = useId();

  return (
    <>
      <div className="border-t border-[#f3ead8]/15 pt-7">
        <div
          role="tablist"
          aria-label="Validator wall of shame tabs"
          className="inline-flex w-full max-w-md rounded-full border border-[#f3ead8]/15 bg-[#0f0d0a] p-1"
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
                className={`min-h-11 flex-1 rounded-full px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] transition ${
                  isActive
                    ? "bg-[#d6ff3f] text-[#17140f] shadow-[0_0_30px_rgba(214,255,63,0.25)]"
                    : "text-[#918b7d] hover:text-[#f3ead8]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "mainnet" ? (
        <section
          id={`${tabPrefix}-mainnet-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-mainnet-tab`}
          className="mt-8"
        >
          {mainnetTab}
        </section>
      ) : (
        <section
          id={`${tabPrefix}-testnet-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-testnet-tab`}
          className="mt-8"
        >
          {testnetTab}
        </section>
      )}
    </>
  );
}
