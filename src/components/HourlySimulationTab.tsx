// ============================================================================
// POLIMI BEM STUDIO - 8,760-HOUR DYNAMIC THERMAL SIMULATION & CARPET HEATMAP
// Lumped-parameter 2R1C dynamic building physics solver across all 8,760 hours.
// Generates indoor operative temperatures, peak kW loads, discomfort hours,
// and an interactive 365×24 annual carpet heatmap.
// ============================================================================

import React, { useMemo, useState, useRef } from 'react';
import {
  Activity,
  Flame,
  Snowflake,
  Sun,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Download,
  Info
} from 'lucide-react';
import { useDesignProject } from '../context/DesignProjectContext';
import { HourlyWeatherRecord } from '../utils/epwEngine';

export interface HourlySimResult {
  hourOfYear: number;
  month: number;
  dayOfMonth: number;
  dayOfYear: number;
  hour: number;
  tExt: number;        // Outdoor °C
  tIn: number;         // Indoor Operative °C
  heatingKw: number;   // Heating kW
  coolingKw: number;   // Cooling kW
  solarGainKw: number; // Solar heat through windows kW
  isComfortable: boolean;
  isOverheating: boolean;
  isUnderheating: boolean;
}

export const HourlySimulationTab: React.FC = () => {
  const {
    climate,
    buildingProgram,
    lengthX,
    widthY,
    floors,
    floorHeight,
    uWin,
    shgc,
    visTrans,
    overhangDepth,
    shadingMode,
    heatingCop,
    coolingEer,
    internalLoadsWm2,
    sim
  } = useDesignProject();

  const [hoveredHour, setHoveredHour] = useState<HourlySimResult | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<'annual' | 'summer' | 'winter'>('annual');
  const [heatingSetpoint, setHeatingSetpoint] = useState<number>(20.0);
  const [coolingSetpoint, setCoolingSetpoint] = useState<number>(26.0);

  // Run dynamic 8,760-hour lumped-capacitance simulation
  const simulationResults = useMemo(() => {
    const hourly = climate.hourly || [];
    if (hourly.length === 0) return [];

    const totalGfa = sim.gfa;
    const totalVolume = sim.volume;
    const totalFacade = sim.facadeAreas.total;
    const wwrAvg = sim.wwrAvg;
    const glazedArea = totalFacade * wwrAvg;
    const opaqueArea = totalFacade * (1 - wwrAvg);

    // Envelope conductance H_tr (W/K)
    const H_tr = opaqueArea * sim.uWall + glazedArea * uWin + sim.footprintArea * 0.25;
    // Ventilation conductance H_ve (W/K) with ~0.5 ACH
    const ach = Math.max(0.3, sim.strategyMods.natVentBonusAch + 0.4);
    const H_ve = (totalVolume * ach * 1200) / 3600; // air heat capacity ~1200 J/m3K
    const H_total = H_tr + H_ve;

    // Thermal mass capacity C_m (J/K)
    // internal areal capacity ~50-120 kJ/m2K
    const C_m = totalGfa * (sim.kappaI * 1000 + 45000); // J/K
    const timeStepSec = 3600; // 1 hour

    // Internal heat gains baseline schedule (W)
    const occBase = buildingProgram === 'residential' ? 0.04 : 0.07;
    const baseInternalW = totalGfa * (occBase * 80 + internalLoadsWm2);

    // Shading multiplier from Stage 2 + dynamic louvers
    const urbanShadeAvg = sim.urbanShading.avg;
    const louverMult = shadingMode === 'dynamic_louvers' ? 0.55 : shadingMode === 'fixed_overhang' ? 0.75 : 1.0;

    let tPrev = 21.0; // initial indoor temp
    const results: HourlySimResult[] = [];

    for (let i = 0; i < hourly.length; i++) {
      const rec = hourly[i];

      // Schedule factor by hour of day (occupied 08:00 to 19:00 for commercial)
      const isOccupied = buildingProgram === 'residential' ? (rec.hour < 8 || rec.hour > 17) : (rec.hour >= 8 && rec.hour <= 19);
      const internalGainW = baseInternalW * (isOccupied ? 1.0 : 0.25);

      // Solar gain (W) through windows
      const solarW = (glazedArea * rec.ghi * shgc * urbanShadeAvg * louverMult * 0.45);

      // Free-floating equilibrium temperature T_free
      // C_m * (T_in - T_prev)/dt = H_total * (T_ext - T_in) + Q_int + Q_sol
      // T_in * (C_m/dt + H_total) = (C_m/dt) * T_prev + H_total * T_ext + Q_int + Q_sol
      const denom = C_m / timeStepSec + H_total;
      const tFree = ((C_m / timeStepSec) * tPrev + H_total * rec.dryBulb + internalGainW + solarW) / denom;

      let tIn = tFree;
      let heatingKw = 0;
      let coolingKw = 0;

      // Active HVAC control
      if (tFree < heatingSetpoint) {
        // Heating kicks in
        heatingKw = Math.max(0, ((H_total * (heatingSetpoint - rec.dryBulb) - internalGainW - solarW) / 1000));
        tIn = heatingSetpoint;
      } else if (tFree > coolingSetpoint) {
        // Cooling kicks in
        coolingKw = Math.max(0, ((internalGainW + solarW - H_total * (coolingSetpoint - rec.dryBulb)) / 1000));
        tIn = coolingSetpoint;
      }

      tPrev = tIn;

      const isComfortable = tIn >= 20.0 && tIn <= 26.0;
      const isOverheating = tIn > 26.5;
      const isUnderheating = tIn < 19.5;

      results.push({
        hourOfYear: rec.hourOfYear,
        month: rec.month,
        dayOfMonth: rec.dayOfMonth,
        dayOfYear: rec.dayOfYear,
        hour: rec.hour,
        tExt: rec.dryBulb,
        tIn: Number(tIn.toFixed(1)),
        heatingKw: Number(heatingKw.toFixed(1)),
        coolingKw: Number(coolingKw.toFixed(1)),
        solarGainKw: Number((solarW / 1000).toFixed(1)),
        isComfortable,
        isOverheating,
        isUnderheating
      });
    }

    return results;
  }, [climate, buildingProgram, lengthX, widthY, floors, floorHeight, uWin, shgc, visTrans, overhangDepth, shadingMode, heatingSetpoint, coolingSetpoint, sim]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (simulationResults.length === 0) {
      return { peakHeatingKw: 0, peakCoolingKw: 0, overheatingHours: 0, underheatingHours: 0, naturalComfortHours: 0 };
    }

    let peakHeat = 0;
    let peakCool = 0;
    let overHeatH = 0;
    let underHeatH = 0;
    let comfortH = 0;

    for (const r of simulationResults) {
      if (r.heatingKw > peakHeat) peakHeat = r.heatingKw;
      if (r.coolingKw > peakCool) peakCool = r.coolingKw;
      if (r.isOverheating) overHeatH++;
      if (r.isUnderheating) underHeatH++;
      if (r.heatingKw === 0 && r.coolingKw === 0 && r.isComfortable) comfortH++;
    }

    return {
      peakHeatingKw: Number(peakHeat.toFixed(1)),
      peakCoolingKw: Number(peakCool.toFixed(1)),
      overheatingHours: overHeatH,
      underheatingHours: underHeatH,
      naturalComfortHours: comfortH
    };
  }, [simulationResults]);

  // Helper color gradient for operative temperature (Blue 15°C -> Green 21-24°C -> Red 30°C)
  const getTempColor = (t: number) => {
    if (t < 18) return '#38bdf8'; // cold blue
    if (t < 20) return '#7dd3fc'; // light sky
    if (t <= 24) return '#34d399'; // comfort green
    if (t <= 26) return '#fbbf24'; // warm amber
    if (t <= 28) return '#f97316'; // orange
    return '#ef4444'; // hot red
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Tab Header & Quick Sizing KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 border border-teal-200 text-[10px] font-bold uppercase tracking-wider">
              Dynamic 2R1C Lumped Simulation • 8,760 Hours
            </span>
            <span className="text-xs text-slate-500">
              Weather: {climate.name} ({climate.koppen} — {climate.koppenDesc})
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            Annual 365×24 Indoor Operative Temperature Carpet Heatmap
          </h3>
        </div>

        {/* Setpoints Controls */}
        <div className="flex items-center gap-3 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
          <label className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-slate-600">Heat Setpoint:</span>
            <strong className="text-slate-900">{heatingSetpoint}°C</strong>
            <input
              type="range"
              min={18}
              max={22}
              step={0.5}
              value={heatingSetpoint}
              onChange={(e) => setHeatingSetpoint(Number(e.target.value))}
              className="w-16 accent-rose-500"
            />
          </label>

          <span className="w-px h-4 bg-slate-300" />

          <label className="flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-slate-600">Cool Setpoint:</span>
            <strong className="text-slate-900">{coolingSetpoint}°C</strong>
            <input
              type="range"
              min={24}
              max={28}
              step={0.5}
              value={coolingSetpoint}
              onChange={(e) => setCoolingSetpoint(Number(e.target.value))}
              className="w-16 accent-sky-500"
            />
          </label>
        </div>
      </div>

      {/* 4 Peak Sizing & Comfort Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Peak Heating Load</span>
          <strong className="text-lg font-extrabold text-rose-600">{stats.peakHeatingKw} kW</strong>
          <span className="text-[10px] text-slate-500 block">
            {((stats.peakHeatingKw * 1000) / sim.gfa).toFixed(1)} W/m² design capacity
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Peak Cooling Load</span>
          <strong className="text-lg font-extrabold text-sky-600">{stats.peakCoolingKw} kW</strong>
          <span className="text-[10px] text-slate-500 block">
            {((stats.peakCoolingKw * 1000) / sim.gfa).toFixed(1)} W/m² chiller peak
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Overheating Risk</span>
          <strong className="text-lg font-extrabold text-amber-600">{stats.overheatingHours} h/yr</strong>
          <span className="text-[10px] text-slate-500 block">
            {((stats.overheatingHours / 8760) * 100).toFixed(1)}% of year above comfort
          </span>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <span className="text-[10px] uppercase font-bold text-emerald-800 block">Passive Comfort Hours</span>
          <strong className="text-lg font-extrabold text-emerald-700">{stats.naturalComfortHours} h/yr</strong>
          <span className="text-[10px] text-emerald-800 block">
            No active HVAC energy required!
          </span>
        </div>
      </div>

      {/* Annual 365 Days × 24 Hours Carpet Heatmap SVG Canvas */}
      <div className="relative bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-inner">
        <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-400" />
            365 Days (Horizontal Axis) × 24 Hours of the Day (Vertical Axis)
          </span>

          {/* Color Scale Legend */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-400">&lt;18°C</span>
            <span className="w-4 h-2.5 rounded bg-sky-400 inline-block" />
            <span className="w-4 h-2.5 rounded bg-emerald-400 inline-block" />
            <span className="w-4 h-2.5 rounded bg-amber-400 inline-block" />
            <span className="w-4 h-2.5 rounded bg-rose-500 inline-block" />
            <span className="text-slate-400">&gt;28°C</span>
          </div>
        </div>

        {/* SVG Carpet Render */}
        <div className="overflow-x-auto">
          <svg viewBox="0 0 760 180" className="w-full h-56 select-none">
            {/* 365 Days × 24 Hours Grid */}
            {/* Rendering days as column vertical slices */}
            {Array.from({ length: 365 }, (_, dayIdx) => {
              const x = 30 + (dayIdx / 365) * 710;
              const w = 710 / 365;

              return Array.from({ length: 24 }, (_, hourIdx) => {
                const recIdx = dayIdx * 24 + hourIdx;
                const rec = simulationResults[recIdx];
                if (!rec) return null;

                const y = 15 + ((23 - hourIdx) / 24) * 140; // 00:00 at bottom, 23:00 at top
                const h = 140 / 24;
                const fillColor = getTempColor(rec.tIn);

                return (
                  <rect
                    key={`${dayIdx}_${hourIdx}`}
                    x={x}
                    y={y}
                    width={Math.max(1.8, w)}
                    height={Math.max(1, h)}
                    fill={fillColor}
                    onMouseEnter={() => setHoveredHour(rec)}
                    className="cursor-crosshair transition-opacity hover:opacity-100 hover:stroke-white hover:stroke-[1px]"
                  />
                );
              });
            })}

            {/* Y-axis hour labels */}
            {[0, 6, 12, 18, 23].map((hr) => (
              <text
                key={hr}
                x="22"
                y={15 + ((23 - hr) / 24) * 140 + 4}
                fontSize="8"
                textAnchor="end"
                fill="#94a3b8"
                fontFamily="sans-serif"
              >
                {hr.toString().padStart(2, '0')}:00
              </text>
            ))}

            {/* X-axis Month labels */}
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, mIdx) => (
              <text
                key={m}
                x={30 + (mIdx / 12) * 710 + 25}
                y="170"
                fontSize="9"
                textAnchor="middle"
                fill="#cbd5e1"
                fontWeight="600"
                fontFamily="sans-serif"
              >
                {m}
              </text>
            ))}
          </svg>
        </div>

        {/* Hovered Cell Live Diagnostic Pill */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-slate-300">
          {hoveredHour ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-bold text-white">
                Day {hoveredHour.dayOfYear} • Hour {hoveredHour.hour.toString().padStart(2, '0')}:00
              </span>
              <span>
                Outdoor T_ext: <strong className="text-sky-300">{hoveredHour.tExt}°C</strong>
              </span>
              <span>
                Indoor T_op: <strong className="text-amber-300">{hoveredHour.tIn}°C</strong>
              </span>
              {hoveredHour.heatingKw > 0 && (
                <span className="text-rose-400 font-semibold">
                  Heating: {hoveredHour.heatingKw} kW
                </span>
              )}
              {hoveredHour.coolingKw > 0 && (
                <span className="text-sky-400 font-semibold">
                  Cooling: {hoveredHour.coolingKw} kW
                </span>
              )}
              {hoveredHour.heatingKw === 0 && hoveredHour.coolingKw === 0 && (
                <span className="text-emerald-400 font-semibold">
                  Free Floating (Natural Comfort)
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic">
              Hover over any point on the 365×24 heatmap to inspect exact hourly operative temperature and HVAC power.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

