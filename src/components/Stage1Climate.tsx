import React, { useState } from 'react';
import {
  Sun,
  Thermometer,
  Compass,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Eye
} from 'lucide-react';
import { useDesignProject } from '../context/DesignProjectContext';
import {
  CLIMATE_SCOUT_STRATEGIES,
  scoreStrategyRelevance,
  MONTHS
} from '../data/climateAndStrategies';
import { calcHumidityRatio } from '../utils/epwEngine';
import { CbeClimaExplorerTab } from './ClimaAndAdvancedPanels';

export const Stage1Climate: React.FC = () => {
  const {
    climate,
    comfortTempLower,
    setComfortTempLower,
    comfortTempUpper,
    setComfortTempUpper,
    activeStrategies,
    toggleStrategy,
    sim,
    setActiveStage,
    urbanAzimuth,
    uWin,
    shgc,
    visTrans
  } = useDesignProject();

  const [showAdvancedClima, setShowAdvancedClima] = useState(false);

  // Rank ClimateScout strategies by relevance to the active climate
  const rankedStrategies = [...CLIMATE_SCOUT_STRATEGIES]
    .map((s) => ({
      ...s,
      relevance: scoreStrategyRelevance(s, climate)
    }))
    .sort((a, b) => b.relevance - a.relevance);

  return (
    <div className="space-y-5">
      {/* Top Banner: Macro-Climate Boundary & Statutory Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 1 • Macro-Climate & Bioclimatic Program
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {climate.lat.toFixed(2)}°N, {climate.lon.toFixed(2)}°E • Elev {climate.elev}m
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1 flex items-center gap-2">
            {climate.name}
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-semibold">
              Köppen {climate.koppen}
            </span>
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">{climate.koppenDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block">HDD / CDD</span>
            <span className="font-bold text-white">
              {climate.hdd} / {climate.cdd} K·d
            </span>
          </div>
          <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block">DPR 412/93 Zone</span>
            <span className="font-bold text-teal-300">
              Zone {climate.dpr412Zone} ({climate.dpr412Schedule.split('(')[0].trim()})
            </span>
          </div>
          <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block">Design 99.6% / 0.4%</span>
            <span className="font-bold text-amber-300">
              {climate.designHeat996}°C / {climate.designCool004}°C
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveStage(2)}
            className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
          >
            Downscale to Stage 2 Urban
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 1: ClimaPlus Monthly Outdoor Temperature Range + Directional Facade Solar Radiation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Chart 1A: Monthly Outdoor Temperature Range Chart with Comfort Threshold Sliders */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-rose-500" />
                ClimaPlus Monthly Outdoor Temperature Range (°C)
              </h3>
              <p className="text-[11px] text-slate-500">
                Monthly diurnal Min–Max bars & mean curve vs. configurable comfort band ({comfortTempLower}°C–{comfortTempUpper}°C)
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <label className="flex items-center gap-1 text-sky-700 font-semibold">
                Lower: {comfortTempLower}°C
                <input
                  type="range"
                  min={14}
                  max={22}
                  step={1}
                  value={comfortTempLower}
                  onChange={(e) => setComfortTempLower(Number(e.target.value))}
                  className="w-14 accent-sky-600"
                />
              </label>
              <label className="flex items-center gap-1 text-rose-700 font-semibold">
                Upper: {comfortTempUpper}°C
                <input
                  type="range"
                  min={23}
                  max={30}
                  step={1}
                  value={comfortTempUpper}
                  onChange={(e) => setComfortTempUpper(Number(e.target.value))}
                  className="w-14 accent-rose-600"
                />
              </label>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            {(() => {
              const W = 540;
              const H = 225;
              const padL = 38;
              const padR = 18;
              const padT = 16;
              const padB = 28;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const tMin = -10;
              const tMax = 42;
              const yForT = (t: number) =>
                padT + plotH - ((Math.max(tMin, Math.min(tMax, t)) - tMin) / (tMax - tMin)) * plotH;
              const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

              const yUpper = yForT(comfortTempUpper);
              const yLower = yForT(comfortTempLower);
              const meanPts = climate.monthlyTemp.map((t, i) => `${xForM(i)},${yForT(t)}`).join(' ');

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {/* Horizontal Grid Lines */}
                  {[-5, 0, 10, 20, 30, 40].map((val) => {
                    const y = yForT(val);
                    return (
                      <g key={val}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                          {val}°C
                        </text>
                      </g>
                    );
                  })}

                  {/* Shaded Comfort Band */}
                  <rect
                    x={padL}
                    y={yUpper}
                    width={plotW}
                    height={Math.max(2, yLower - yUpper)}
                    fill="#10b981"
                    fillOpacity={0.13}
                  />
                  <line
                    x1={padL}
                    y1={yUpper}
                    x2={W - padR}
                    y2={yUpper}
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <line
                    x1={padL}
                    y1={yLower}
                    x2={W - padR}
                    y2={yLower}
                    stroke="#0284c7"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <text x={W - padR - 4} y={yUpper - 4} textAnchor="end" fontSize="9" fill="#e11d48" fontWeight="bold">
                    Upper Comfort ({comfortTempUpper}°C)
                  </text>
                  <text x={W - padR - 4} y={yLower + 10} textAnchor="end" fontSize="9" fill="#0369a1" fontWeight="bold">
                    Lower Comfort ({comfortTempLower}°C)
                  </text>

                  {/* Monthly Min-Max Bars */}
                  {MONTHS.map((m, i) => {
                    const cx = xForM(i);
                    const minVal = climate.monthlyTempMin?.[i] ?? climate.monthlyTemp[i] - 5;
                    const maxVal = climate.monthlyTempMax?.[i] ?? climate.monthlyTemp[i] + 5;
                    const yTop = yForT(maxVal);
                    const yBot = yForT(minVal);
                    return (
                      <g key={m}>
                        <rect
                          x={cx - 8}
                          y={yTop}
                          width={16}
                          height={Math.max(4, yBot - yTop)}
                          rx={4}
                          fill="#cbd5e1"
                          fillOpacity={0.65}
                          stroke="#94a3b8"
                          strokeWidth={1}
                        />
                        <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">
                          {m}
                        </text>
                      </g>
                    );
                  })}

                  {/* Monthly Mean Temperature Line */}
                  <polyline fill="none" stroke="#0f172a" strokeWidth={2.2} points={meanPts} />
                  {climate.monthlyTemp.map((t, i) => (
                    <g key={i}>
                      <circle cx={xForM(i)} cy={yForT(t)} r={3.5} fill="#f97316" stroke="#fff" strokeWidth={1.2} />
                      <text x={xForM(i)} y={yForT(t) - 6} textAnchor="middle" fontSize="8.5" fill="#1e293b" fontWeight="700">
                        {t.toFixed(1)}°
                      </text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Chart 1B: Monthly Facade Radiation Line Chart (Horizontal, S, E, W, N) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                Monthly Directional Surface Solar Radiation (kWh/m²)
              </h3>
              <p className="text-[11px] text-slate-500">
                Incident solar irradiation on Horizontal Roof vs. South, East, West, and North vertical facades
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Horiz
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> South
              </span>
              <span className="flex items-center gap-1 text-teal-600">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> East/West
              </span>
              <span className="flex items-center gap-1 text-sky-600">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> North
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            {(() => {
              const W = 540;
              const H = 225;
              const padL = 38;
              const padR = 18;
              const padT = 16;
              const padB = 28;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const sMax = 270;
              const yForS = (v: number) => padT + plotH - (Math.min(sMax, Math.max(0, v)) / sMax) * plotH;
              const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

              const makePath = (arr: number[]) => arr.map((v, i) => `${xForM(i)},${yForS(v)}`).join(' ');

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[0, 50, 100, 150, 200, 250].map((val) => {
                    const y = yForS(val);
                    return (
                      <g key={val}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {MONTHS.map((m, i) => (
                    <text key={m} x={xForM(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">
                      {m}
                    </text>
                  ))}

                  {/* Horizontal */}
                  <polyline fill="none" stroke="#f59e0b" strokeWidth={2.4} points={makePath(climate.solarHoriz)} />
                  {/* South */}
                  <polyline fill="none" stroke="#e11d48" strokeWidth={2.4} points={makePath(climate.solarSouth)} />
                  {/* East */}
                  <polyline fill="none" stroke="#0d9488" strokeWidth={2.0} points={makePath(climate.solarEast)} />
                  {/* West (dashed overlap check) */}
                  <polyline
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth={1.6}
                    strokeDasharray="3 3"
                    points={makePath(climate.solarWest)}
                  />
                  {/* North */}
                  <polyline fill="none" stroke="#0284c7" strokeWidth={1.8} points={makePath(climate.solarNorth)} />

                  {climate.solarSouth.map((v, i) => (
                    <circle key={`s_${i}`} cx={xForM(i)} cy={yForS(v)} r={2.8} fill="#e11d48" />
                  ))}
                  {climate.solarHoriz.map((v, i) => (
                    <circle key={`h_${i}`} cx={xForM(i)} cy={yForS(v)} r={2.8} fill="#f59e0b" />
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Row 2: Psychrometric / Bioclimatic Chart + ClimateScout Strategy Selector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Chart 1C: Psychrometric / Bioclimatic Chart (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-teal-600" />
                Bioclimatic Psychrometric Chart (8,760h + Monthly)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                Givoni / ASHRAE 55
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dry-Bulb Temp (°C) vs. Humidity Ratio (g/kg) with Passive Comfort, NatVent & Thermal Mass envelopes
            </p>
          </div>

          <div className="w-full">
            {(() => {
              const W = 440;
              const H = 250;
              const padL = 32;
              const padR = 34;
              const padT = 14;
              const padB = 28;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const xForT = (t: number) => padL + ((t + 5) / 45) * plotW; // -5°C to 40°C
              const yForW = (w: number) => padT + plotH - (Math.min(24, Math.max(0, w)) / 24) * plotH;

              // Saturation curve (100% RH) & 50% RH curve
              const buildRhCurve = (rh: number) => {
                const pts: string[] = [];
                for (let t = -5; t <= 40; t += 2) {
                  const w = calcHumidityRatio(t, rh);
                  if (w <= 24) pts.push(`${xForT(t).toFixed(1)},${yForW(w).toFixed(1)}`);
                }
                return pts.join(' ');
              };

              // Sample hourly cloud (every 8th hour = ~1,095 points)
              const sampledHourly = (climate.hourly || []).filter((_, idx) => idx % 8 === 0);

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-50/60 rounded-xl border border-slate-100">
                  {/* Grid */}
                  {[0, 10, 20, 30, 40].map((t) => (
                    <g key={t}>
                      <line x1={xForT(t)} y1={padT} x2={xForT(t)} y2={H - padB} stroke="#e2e8f0" strokeWidth={1} />
                      <text x={xForT(t)} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
                        {t}°C
                      </text>
                    </g>
                  ))}
                  {[0, 6, 12, 18, 24].map((w) => (
                    <g key={w}>
                      <line x1={padL} y1={yForW(w)} x2={W - padR} y2={yForW(w)} stroke="#e2e8f0" strokeWidth={1} />
                      <text x={W - padR + 4} y={yForW(w) + 3} fontSize="8.5" fill="#64748b">
                        {w}g
                      </text>
                    </g>
                  ))}

                  {/* RH Curves */}
                  <polyline fill="none" stroke="#0284c7" strokeWidth={1.5} points={buildRhCurve(100)} />
                  <polyline fill="none" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" points={buildRhCurve(50)} />

                  {/* Givoni Passive Solar Heating Zone (10°C-20°C) */}
                  <rect
                    x={xForT(10)}
                    y={yForW(11)}
                    width={xForT(20) - xForT(10)}
                    height={yForW(2) - yForW(11)}
                    fill="#f59e0b"
                    fillOpacity={0.12}
                    stroke="#f59e0b"
                    strokeDasharray="3 2"
                  />

                  {/* ASHRAE Comfort Zone (20°C-26°C) */}
                  <rect
                    x={xForT(comfortTempLower)}
                    y={yForW(12)}
                    width={Math.max(8, xForT(comfortTempUpper) - xForT(comfortTempLower))}
                    height={yForW(3) - yForW(12)}
                    fill="#10b981"
                    fillOpacity={0.22}
                    stroke="#059669"
                    strokeWidth={1.5}
                  />

                  {/* Natural Ventilation + High Thermal Mass Zone (26°C-33°C) */}
                  <rect
                    x={xForT(comfortTempUpper)}
                    y={yForW(15)}
                    width={xForT(33) - xForT(comfortTempUpper)}
                    height={yForW(3) - yForW(15)}
                    fill="#0ea5e9"
                    fillOpacity={0.14}
                    stroke="#0284c7"
                    strokeDasharray="3 2"
                  />

                  {/* 8,760h Hourly Cloud */}
                  {sampledHourly.map((h, i) => (
                    <circle
                      key={i}
                      cx={xForT(h.dryBulb)}
                      cy={yForW(h.humRatio)}
                      r={1.6}
                      fill={
                        h.dryBulb >= comfortTempLower && h.dryBulb <= comfortTempUpper
                          ? '#10b981'
                          : h.dryBulb > comfortTempUpper
                          ? '#f43f5e'
                          : '#3b82f6'
                      }
                      fillOpacity={0.35}
                    />
                  ))}

                  {/* 12 Monthly Mean Points */}
                  {climate.monthlyTemp.map((t, m) => {
                    const rh = climate.monthlyRh?.[m] ?? 65;
                    const w = calcHumidityRatio(t, rh);
                    return (
                      <g key={m}>
                        <circle cx={xForT(t)} cy={yForW(w)} r={4} fill="#0f172a" stroke="#fff" strokeWidth={1.2} />
                        <text x={xForT(t)} y={yForW(w) - 5} textAnchor="middle" fontSize="8" fill="#0f172a" fontWeight="700">
                          {MONTHS[m]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <span>
              NatVent Potential: <strong className="text-teal-700">{climate.natVentHoursPct}% of year</strong>
            </span>
            <span>
              UTCI No-Stress: <strong className="text-emerald-700">{climate.utciNoStressPct}% of year</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowAdvancedClima(!showAdvancedClima)}
              className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 underline"
            >
              <Eye className="w-3.5 h-3.5" />
              {showAdvancedClima ? 'Hide 8,760h Sun/Wind' : 'Sun Path & 8,760h Carpet'}
            </button>
          </div>
        </div>

        {/* Interactive ClimateScout Passive Design Strategy Selector (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                ClimateScout Passive Design Strategy Selector
              </h3>
              <p className="text-[11px] text-slate-500">
                Ranked by bioclimatic relevance to <strong>{climate.name} ({climate.koppen})</strong>. Toggle cards to propagate modifiers to Stages 2–6.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg font-semibold">
              <Sliders className="w-3.5 h-3.5 text-teal-600" />
              Active Modifiers: Heat ×{sim.strategyMods.heatingMult} • Cool ×{sim.strategyMods.coolingMult} • +
              {sim.strategyMods.tauBonusHours}h τ
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {rankedStrategies.map((st) => {
              const isSelected = activeStrategies.includes(st.id);
              return (
                <div
                  key={st.id}
                  onClick={() => toggleStrategy(st.id)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-500 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                        {st.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            st.relevance >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : st.relevance >= 65
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {st.relevance}% Climate Match
                        </span>
                        <CheckCircle2
                          className={`w-4 h-4 ${isSelected ? 'text-teal-600 fill-teal-100' : 'text-slate-300'}`}
                        />
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mt-1.5">{st.title}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{st.shortDesc}</p>
                  </div>

                  <div className="text-[10px] font-semibold text-teal-800 bg-white/80 px-2 py-1 rounded border border-teal-200/60">
                    Impact: {st.engineeringImpact}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expandable CBE Clima Sun Path, Wind Rose & 8,760h Carpet Heatmap */}
      {showAdvancedClima && (
        <CbeClimaExplorerTab
          climate={climate}
          orientation={urbanAzimuth}
          uWall={sim.uWall}
          uWin={uWin}
          shgc={shgc}
          wwrAvg={sim.wwrAvg}
          tauHours={sim.tauHours}
          visTrans={visTrans}
        />
      )}
    </div>
  );
};

