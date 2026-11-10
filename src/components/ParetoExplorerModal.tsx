// ============================================================================
// POLIMI BEM STUDIO - MULTI-OBJECTIVE PARETO OPTIMIZATION EXPLORER
// Evaluates 48 combinatorial design configurations across Embodied Carbon,
// Operational EUI, Capital Cost, and Daylight Autonomy.
// Highlights non-dominated Pareto frontier points with one-click application.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  TrendingDown,
  Layers,
  Zap,
  DollarSign,
  Sun,
  ShieldCheck,
  CheckCircle2,
  X,
  Sliders,
  Filter,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { useDesignProject, HvacSystemType } from '../context/DesignProjectContext';
import { GLAZING_LIBRARY, SHADING_LIBRARY } from '../data/componentLibraries';

interface ParetoExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface DesignVariantCandidate {
  id: string;
  name: string;
  wwr: number;             // %
  insulationMm: number;    // mm
  wallU: number;           // W/m2K
  glazingId: string;
  glazingName: string;
  glazingU: number;
  shgc: number;
  visTrans: number;
  shadingId: string;
  shadingName: string;
  hvacType: HvacSystemType;
  hvacName: string;
  // Computed KPIs
  embodiedCarbonKgM2: number; // kgCO2e/m2 (A1-A3)
  netSiteEuiKwhM2: number;    // kWh/m2yr
  wholeLifeCarbon50Yr: number; // kgCO2e/m2
  capitalCostEurM2: number;   // €/m2
  daylightAutonomyPct: number;// %
  discomfortHours: number;    // h
  isParetoOptimal: boolean;
}

export const ParetoExplorerModal: React.FC<ParetoExplorerModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    climate,
    buildingProgram,
    sim,
    setWwrS,
    setWwrN,
    setWwrE,
    setWwrW,
    setUWin,
    setShgc,
    setVisTrans,
    setOverhangDepth,
    setShadingMode,
    applyHvacPreset,
    lengthX,
    widthY,
    floors
  } = useDesignProject();

  // Filters
  const [maxEuiFilter, setMaxEuiFilter] = useState<number>(100);
  const [maxCarbonFilter, setMaxCarbonFilter] = useState<number>(380);
  const [minDaylightFilter, setMinDaylightFilter] = useState<number>(40);
  const [hvacFilter, setHvacFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<DesignVariantCandidate | null>(null);

  // Generate 48 combinatorial variants
  const candidates: DesignVariantCandidate[] = useMemo(() => {
    const wwrOptions = [25, 40, 55];
    const insulationOptions = [
      { mm: 100, u: 0.32, co2: 18, cost: 70 },
      { mm: 160, u: 0.21, co2: 28, cost: 105 },
      { mm: 220, u: 0.15, co2: 38, cost: 140 }
    ];
    const glazingOptions = [
      GLAZING_LIBRARY[0], // Double clear
      GLAZING_LIBRARY[1], // Low-E Argon
      GLAZING_LIBRARY[2], // Solar Control Double
      GLAZING_LIBRARY[3]  // Triple Low-E
    ];
    const hvacOptions: Array<{ type: HvacSystemType; name: string; cop: number; eer: number; co2Grid: number }> = [
      { type: 'ashp', name: 'Air-Source Heat Pump', cop: 3.8, eer: 3.5, co2Grid: 0.22 },
      { type: 'gshp', name: 'Ground-Source Geothermal', cop: 4.8, eer: 4.5, co2Grid: 0.18 },
      { type: 'gas_chiller', name: 'Gas Boiler + Chiller', cop: 0.92, eer: 2.8, co2Grid: 0.35 }
    ];

    const results: DesignVariantCandidate[] = [];
    let count = 0;

    const solarSouthArr = Array.isArray(climate?.solarSouth) && climate.solarSouth.length === 12
      ? climate.solarSouth
      : [74, 87, 113, 100, 88, 88, 92, 100, 101, 91, 71, 73];
    const solarEastArr = Array.isArray(climate?.solarEast) && climate.solarEast.length === 12
      ? climate.solarEast
      : [60, 75, 95, 90, 80, 75, 80, 90, 90, 80, 60, 60];
    const annualSolarIncident = (solarSouthArr.reduce((a, b) => a + b, 0) + solarEastArr.reduce((a, b) => a + b, 0)) / 2;

    const hdd = climate?.hdd ?? 2400;
    const cdd = climate?.cdd ?? 250;
    const deltaT_heat = hdd * 0.024;
    const deltaT_cool = cdd * 0.018;

    const svRatio = sim?.svRatio ?? 0.35;
    const facadeTotal = sim?.facadeAreas?.total ?? 1000;
    const gfa = Math.max(1, sim?.gfa ?? 500);

    for (const wwr of wwrOptions) {
      for (const ins of insulationOptions) {
        for (const gz of glazingOptions) {
          for (const hv of hvacOptions) {
            count++;
            const id = `variant_${count}`;

            // Shading selection logic (if WWR > 40%, add overhang)
            const shd = wwr > 40 ? SHADING_LIBRARY[1] : SHADING_LIBRARY[0];

            // 1. Estimate Heating & Cooling Need based on physics
            const uWallEff = ins.u;
            const uWinEff = gz.uValue;
            const uAvg = (1 - wwr / 100) * uWallEff + (wwr / 100) * uWinEff;

            // Solar Gains (kWh/m2)
            const usefulSolarGain = (annualSolarIncident * gz.shgc * shd.shadingFactor * (wwr / 100) * 0.38);

            const heatingNeed = Math.max(8, (svRatio * uAvg * deltaT_heat * 0.85) - usefulSolarGain * 0.45);
            const coolingNeed = Math.max(6, (usefulSolarGain * 0.75 + 14 * 0.9 + deltaT_cool * 0.5));

            // Delivered Energy
            const deliveredHeating = heatingNeed / hv.cop;
            const deliveredCooling = coolingNeed / hv.eer;
            const lightingElec = Math.max(6, 14 - (wwr / 100) * gz.visTrans * 8); // daylight dimming
            const netEui = Number((deliveredHeating + deliveredCooling + lightingElec + 12 - 25).toFixed(1));

            // 2. Embodied Carbon (Structure baseline ~220 kgCO2e/m2 + Envelope + MEP)
            const structureCo2 = 220;
            const envelopeCo2 = Math.round(
              ins.co2 * (1 - wwr / 100) * (facadeTotal / gfa) +
              gz.embodiedCarbonKgM2 * (wwr / 100) * (facadeTotal / gfa) +
              shd.embodiedCo2KgM2 * (wwr / 100)
            );
            const mepCo2 = hv.type === 'gshp' ? 45 : hv.type === 'ashp' ? 35 : 25;
            const upfrontEmbodied = structureCo2 + envelopeCo2 + mepCo2;

            // 3. Operational Carbon (50 years)
            const operCarbon50 = Math.round(netEui * hv.co2Grid * 50);
            const wholeLifeCarbon = upfrontEmbodied + operCarbon50;

            // 4. Capital Cost (€/m2 GFA)
            const capitalCost = Math.round(
              450 + // base structure & interior
              (ins.cost * (1 - wwr / 100) + gz.costEurM2 * (wwr / 100)) * (facadeTotal / gfa) +
              (hv.type === 'gshp' ? 120 : hv.type === 'ashp' ? 80 : 50)
            );

            // 5. Daylight Autonomy sDA %
            const sda = Math.min(95, Math.max(20, Math.round(wwr * gz.visTrans * 1.6)));

            // 6. Overheating Discomfort Hours
            const discomfort = Math.round(Math.max(25, coolingNeed * 6 - shd.shadingFactor * 40));

            results.push({
              id,
              name: `WWR ${wwr}% • ${ins.mm}mm Insul • ${gz.name.split(' ')[0]} • ${hv.name.split(' ')[0]}`,
              wwr,
              insulationMm: ins.mm,
              wallU: ins.u,
              glazingId: gz.id,
              glazingName: gz.name,
              glazingU: gz.uValue,
              shgc: gz.shgc,
              visTrans: gz.visTrans,
              shadingId: shd.id,
              shadingName: shd.name,
              hvacType: hv.type,
              hvacName: hv.name,
              embodiedCarbonKgM2: upfrontEmbodied,
              netSiteEuiKwhM2: netEui,
              wholeLifeCarbon50Yr: wholeLifeCarbon,
              capitalCostEurM2: capitalCost,
              daylightAutonomyPct: sda,
              discomfortHours: discomfort,
              isParetoOptimal: false
            });
          }
        }
      }
    }

    // Determine 2D Non-Dominated Pareto Frontier (minimizing Embodied Carbon & minimizing Net EUI)
    for (let i = 0; i < results.length; i++) {
      let dominated = false;
      for (let j = 0; j < results.length; j++) {
        if (i === j) continue;
        if (
          results[j].embodiedCarbonKgM2 <= results[i].embodiedCarbonKgM2 &&
          results[j].netSiteEuiKwhM2 <= results[i].netSiteEuiKwhM2 &&
          (results[j].embodiedCarbonKgM2 < results[i].embodiedCarbonKgM2 ||
           results[j].netSiteEuiKwhM2 < results[i].netSiteEuiKwhM2)
        ) {
          dominated = true;
          break;
        }
      }
      results[i].isParetoOptimal = !dominated;
    }

    return results;
  }, [climate, sim]);

  // Filtered variants
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (c.netSiteEuiKwhM2 > maxEuiFilter) return false;
      if (c.embodiedCarbonKgM2 > maxCarbonFilter) return false;
      if (c.daylightAutonomyPct < minDaylightFilter) return false;
      if (hvacFilter !== 'all' && c.hvacType !== hvacFilter) return false;
      return true;
    });
  }, [candidates, maxEuiFilter, maxCarbonFilter, minDaylightFilter, hvacFilter]);

  // Pareto optimal subset sorted by Embodied Carbon
  const paretoPoints = useMemo(() => {
    return candidates
      .filter((c) => c.isParetoOptimal)
      .sort((a, b) => a.embodiedCarbonKgM2 - b.embodiedCarbonKgM2);
  }, [candidates]);

  // Scatter plot domain
  const minX = 230;
  const maxX = 360;
  const minY = 10;
  const maxY = 90;

  const projectCurrentPoint = {
    x: sim?.lca?.a1a3Total ?? 250,
    y: sim?.netSiteEui ?? 35
  };

  const applyCandidateToProject = (c: DesignVariantCandidate) => {
    setWwrS(c.wwr);
    setWwrN(Math.max(15, c.wwr - 10));
    setWwrE(Math.max(15, c.wwr - 5));
    setWwrW(Math.max(15, c.wwr - 5));
    setUWin(c.glazingU);
    setShgc(c.shgc);
    setVisTrans(c.visTrans);
    if (c.shadingId.includes('overhang')) {
      setOverhangDepth(0.8);
      setShadingMode('fixed_overhang');
    } else {
      setOverhangDepth(0);
      setShadingMode('none');
    }
    applyHvacPreset(c.hvacType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Multi-Objective Parametric Explorer & Pareto Front
                <span className="text-[10px] bg-emerald-950 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-700">
                  {paretoPoints.length} Non-Dominated Solutions
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Explore trade-offs between Upfront Embodied Carbon (A1–A3), Operational EUI (kWh/m²yr), Capital Cost, and Daylight Autonomy
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-teal-600" />
              <span>Design Space Filters:</span>
            </div>

            <label className="flex items-center gap-2">
              <span className="text-slate-600">Max EUI:</span>
              <strong className="text-slate-900">{maxEuiFilter}</strong>
              <input
                type="range"
                min={25}
                max={90}
                value={maxEuiFilter}
                onChange={(e) => setMaxEuiFilter(Number(e.target.value))}
                className="w-20 accent-teal-600"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-slate-600">Max Embodied Carbon:</span>
              <strong className="text-slate-900">{maxCarbonFilter}</strong>
              <input
                type="range"
                min={260}
                max={380}
                value={maxCarbonFilter}
                onChange={(e) => setMaxCarbonFilter(Number(e.target.value))}
                className="w-20 accent-emerald-600"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-slate-600">Min sDA:</span>
              <strong className="text-slate-900">{minDaylightFilter}%</strong>
              <input
                type="range"
                min={20}
                max={80}
                step={5}
                value={minDaylightFilter}
                onChange={(e) => setMinDaylightFilter(Number(e.target.value))}
                className="w-16 accent-amber-600"
              />
            </label>

            <select
              value={hvacFilter}
              onChange={(e) => setHvacFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 font-semibold"
            >
              <option value="all">All HVAC Types</option>
              <option value="ashp">Air-Source Heat Pump</option>
              <option value="gshp">Ground-Source Geothermal</option>
              <option value="gas_chiller">Gas Boiler + Chiller</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-500">
            Showing <strong>{filteredCandidates.length}</strong> of {candidates.length} configurations
          </div>
        </div>

        {/* Content Body: Scatter Plot + Selected Variant Details */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scatter Plot (8 cols) */}
          <div className="lg:col-span-8 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800">
                  Embodied Carbon (A1–A3) vs. Operational EUI (Pareto Frontier)
                </span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 font-semibold text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Pareto Optimal
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Sub-Optimal
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-rose-600">
                    <span className="w-3 h-3 rounded-full border-2 border-rose-500 bg-rose-100 inline-block" /> Active Project
                  </span>
                </div>
              </div>

              {/* 2D SVG Scatter Plot */}
              <div className="relative w-full h-80 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner p-2">
                <svg viewBox="0 0 600 300" className="w-full h-full">
                  {/* Grid Lines */}
                  {[250, 280, 310, 340].map((xVal) => {
                    const x = 50 + ((xVal - minX) / (maxX - minX)) * 520;
                    return (
                      <g key={xVal}>
                        <line x1={x} y1="20" x2={x} y2="260" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <text x={x} y="278" fontSize="9" textAnchor="middle" fill="#94a3b8">
                          {xVal}
                        </text>
                      </g>
                    );
                  })}

                  {[20, 40, 60, 80].map((yVal) => {
                    const y = 260 - ((yVal - minY) / (maxY - minY)) * 240;
                    return (
                      <g key={yVal}>
                        <line x1="50" y1={y} x2="570" y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                        <text x="42" y={y + 3} fontSize="9" textAnchor="end" fill="#94a3b8">
                          {yVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Axes */}
                  <line x1="50" y1="260" x2="570" y2="260" stroke="#64748b" strokeWidth="1.2" />
                  <line x1="50" y1="20" x2="50" y2="260" stroke="#64748b" strokeWidth="1.2" />

                  <text x="310" y="295" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#475569">
                    Upfront Embodied Carbon (kgCO₂e/m²) →
                  </text>
                  <text
                    x="-140"
                    y="18"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill="#475569"
                    transform="rotate(-90)"
                  >
                    Net Site EUI (kWh/m²yr) →
                  </text>

                  {/* Pareto Frontier Curve Line */}
                  {paretoPoints.length > 1 && (
                    <path
                      d={paretoPoints
                        .map((p, idx) => {
                          const x = 50 + ((p.embodiedCarbonKgM2 - minX) / (maxX - minX)) * 520;
                          const y = 260 - ((p.netSiteEuiKwhM2 - minY) / (maxY - minY)) * 240;
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      opacity="0.8"
                    />
                  )}

                  {/* Filtered Scatter Points */}
                  {filteredCandidates.map((c) => {
                    const cx = 50 + ((c.embodiedCarbonKgM2 - minX) / (maxX - minX)) * 520;
                    const cy = 260 - ((c.netSiteEuiKwhM2 - minY) / (maxY - minY)) * 240;
                    const isSelected = selectedCandidate?.id === c.id;

                    return (
                      <circle
                        key={c.id}
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 8 : c.isParetoOptimal ? 5.5 : 3.5}
                        fill={c.isParetoOptimal ? '#10b981' : '#94a3b8'}
                        stroke={isSelected ? '#0f766e' : c.isParetoOptimal ? '#065f46' : '#64748b'}
                        strokeWidth={isSelected ? 3 : 1}
                        opacity={isSelected ? 1 : 0.8}
                        className="cursor-pointer transition hover:opacity-100 hover:scale-125"
                        onClick={() => setSelectedCandidate(c)}
                      >
                        <title>
                          {c.name} | EUI: {c.netSiteEuiKwhM2} kWh/m2 | Carbon: {c.embodiedCarbonKgM2} kgCO2e
                        </title>
                      </circle>
                    );
                  })}

                  {/* Active Project Marker */}
                  {(() => {
                    const px = 50 + ((projectCurrentPoint.x - minX) / (maxX - minX)) * 520;
                    const py = 260 - ((projectCurrentPoint.y - minY) / (maxY - minY)) * 240;
                    return (
                      <g>
                        <circle cx={px} cy={py} r="9" fill="#f43f5e" fillOpacity="0.3" stroke="#e11d48" strokeWidth="2" />
                        <circle cx={px} cy={py} r="4" fill="#e11d48" />
                        <text x={px + 8} y={py - 8} fontSize="9" fontWeight="bold" fill="#e11d48">
                          Current Project
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 mt-2 bg-white p-2.5 rounded-lg border border-slate-200">
              💡 <strong>Pareto Concept:</strong> Points along the green dashed boundary represent non-dominated optimal designs. You cannot reduce EUI without incurring higher embodied carbon (or vice versa).
            </div>
          </div>

          {/* Right: Selected Candidate Detail Card (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-teal-50/40 border border-slate-200 shadow-sm">
            {selectedCandidate ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded">
                      {selectedCandidate.isParetoOptimal ? '⭐ Pareto Optimal' : 'Candidate Design'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {selectedCandidate.name}
                    </h3>
                  </div>
                </div>

                {/* Key KPIs */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">Net Site EUI</span>
                    <strong className="text-base text-teal-700">{selectedCandidate.netSiteEuiKwhM2}</strong>
                    <span className="text-[9px] text-slate-500 block">kWh/m²yr</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">Embodied Carbon</span>
                    <strong className="text-base text-emerald-700">{selectedCandidate.embodiedCarbonKgM2}</strong>
                    <span className="text-[9px] text-slate-500 block">kgCO₂e/m² (A1-A3)</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">50y Whole-Life CO₂</span>
                    <strong className="text-base text-slate-900">{selectedCandidate.wholeLifeCarbon50Yr}</strong>
                    <span className="text-[9px] text-slate-500 block">kgCO₂e/m²</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 block font-semibold">Daylight Autonomy</span>
                    <strong className="text-base text-amber-600">{selectedCandidate.daylightAutonomyPct}%</strong>
                    <span className="text-[9px] text-slate-500 block">sDA₃₀₀/₅₀%</span>
                  </div>
                </div>

                {/* Specifications breakdown */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Glazing:</span>
                    <span className="font-semibold text-slate-800">{selectedCandidate.glazingName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Wall U-Value:</span>
                    <span className="font-semibold text-slate-800">{selectedCandidate.wallU} W/m²K ({selectedCandidate.insulationMm}mm)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">Shading:</span>
                    <span className="font-semibold text-slate-800">{selectedCandidate.shadingName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1">
                    <span className="text-slate-500">HVAC Plant:</span>
                    <span className="font-semibold text-teal-800">{selectedCandidate.hvacName}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-slate-500">Est. Capital Cost:</span>
                    <strong className="text-slate-900">€{selectedCandidate.capitalCostEurM2}/m²</strong>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => applyCandidateToProject(selectedCandidate)}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Configuration to Project
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Sliders className="w-10 h-10 mb-2 text-slate-300" />
                <h4 className="text-xs font-bold text-slate-700">Select Any Design Point</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Click any point on the scatter plot to inspect its specific envelope layers, HVAC system, cost, and apply it directly to your active project.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500">
            PoliMi Computational Pareto Optimization Engine • Generative Building Physics
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

