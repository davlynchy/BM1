"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Clock3, DollarSign } from "lucide-react";

const tradeValues = {
  Electrical: {
    missedVariation: "$12,000",
    annualRevenue: "$144,000",
    manualTime: "3-4 hrs",
    bidmetricTime: "10 min",
  },
  "Mechanical / HVAC": {
    missedVariation: "$18,500",
    annualRevenue: "$222,000",
    manualTime: "4-5 hrs",
    bidmetricTime: "14 min",
  },
  "Fire Protection": {
    missedVariation: "$14,200",
    annualRevenue: "$170,400",
    manualTime: "3 hrs",
    bidmetricTime: "11 min",
  },
  "Plumbing & Hydraulics": {
    missedVariation: "$15,800",
    annualRevenue: "$189,600",
    manualTime: "3-4 hrs",
    bidmetricTime: "12 min",
  },
  "Structural Steel": {
    missedVariation: "$26,000",
    annualRevenue: "$312,000",
    manualTime: "5 hrs",
    bidmetricTime: "18 min",
  },
  "Concrete & Formwork": {
    missedVariation: "$21,500",
    annualRevenue: "$258,000",
    manualTime: "4 hrs",
    bidmetricTime: "16 min",
  },
  "Fitout & Interiors": {
    missedVariation: "$11,400",
    annualRevenue: "$136,800",
    manualTime: "3 hrs",
    bidmetricTime: "9 min",
  },
  "Facades & Cladding": {
    missedVariation: "$19,700",
    annualRevenue: "$236,400",
    manualTime: "4-5 hrs",
    bidmetricTime: "15 min",
  },
  Roofing: {
    missedVariation: "$9,800",
    annualRevenue: "$117,600",
    manualTime: "2-3 hrs",
    bidmetricTime: "8 min",
  },
  "Painting & Coatings": {
    missedVariation: "$7,600",
    annualRevenue: "$91,200",
    manualTime: "2 hrs",
    bidmetricTime: "7 min",
  },
  Flooring: {
    missedVariation: "$6,900",
    annualRevenue: "$82,800",
    manualTime: "2 hrs",
    bidmetricTime: "7 min",
  },
} as const satisfies Record<
  string,
  {
    missedVariation: string;
    annualRevenue: string;
    manualTime: string;
    bidmetricTime: string;
  }
>;

type Trade = keyof typeof tradeValues;

const tradeOptions = Object.keys(tradeValues) as Trade[];

export function TradeImpactCalculator() {
  const [trade, setTrade] = useState<Trade>("Electrical");
  const values = tradeValues[trade];

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <label className="sr-only" htmlFor="trade-select">
          Select trade
        </label>
        <div className="relative w-full max-w-[360px]">
          <select
            className="w-full appearance-none rounded-[20px] border border-white/14 bg-white/10 px-5 py-4 text-lg text-white outline-none transition focus:border-brand2"
            id="trade-select"
            onChange={(event) => setTrade(event.target.value as Trade)}
            value={trade}
          >
            {tradeOptions.map((option) => (
              <option className="text-text" key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<DollarSign className="h-6 w-6" />}
          label="1 missed variation"
          value={values.missedVariation}
          caption={`avg. for ${trade}`}
        />
        <MetricCard
          icon={<ArrowUpRight className="h-5 w-5" />}
          label="Potential annual gain"
          value={values.annualRevenue}
          caption="based on 12 recovered claims"
        />
        <TimeMetricCard
          bidmetricTime={values.bidmetricTime}
          manualTime={values.manualTime}
          icon={<Clock3 className="h-6 w-6" />}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/8 p-6 text-left text-white shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
      <div className="mb-4 inline-flex rounded-full bg-[#315846] p-2 text-brand2">{icon}</div>
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-2 font-heading text-4xl leading-none text-brand2">{value}</p>
      <p className="mt-2 text-sm text-white/60">{caption}</p>
    </div>
  );
}

function TimeMetricCard({
  bidmetricTime,
  manualTime,
  icon,
}: {
  bidmetricTime: string;
  manualTime: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-white/8 bg-white/8 p-6 text-left text-white shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
      <div className="mb-4 inline-flex rounded-full bg-[#315846] p-2 text-brand2">{icon}</div>
      <p className="text-sm text-white/60">Time to compile a claim</p>
      <div className="mt-3 flex items-end gap-3">
        <div>
          <p className="text-3xl font-semibold leading-none text-white/45 line-through">{manualTime}</p>
          <p className="mt-1 text-sm text-white/45">manually</p>
        </div>
        <p className="pb-1 text-2xl text-brand2">→</p>
        <div>
          <p className="font-heading text-4xl leading-none text-brand2">{bidmetricTime}</p>
          <p className="mt-1 text-sm text-brand2/80">with Bidmetric</p>
        </div>
      </div>
    </div>
  );
}
