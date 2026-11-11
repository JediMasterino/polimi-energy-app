import React, { useState } from 'react';
import {
  Layers,
  Sun,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRight,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  useDesignProject,
  ThermalZoneName
} from '../context/DesignProjectContext';
import { ENVELOPE_MATERIALS } from '../data/climateAndStrategies';
import { GLAZING_LIBRARY, SHADING_LIBRARY } from '../data/componentLibraries';
import { StageDalecPlusStudio } from './StageDalecPlusStudio';

export const Stage4FacadeFabric: React.FC = () => {
  const {
    climate,
    selectedZone,
    setSelectedZone,
    wwrN,
    setWwrN,
    wwrS,
    setWwrS,
    wwrE,
    setWwrE,
    wwrW,
    setWwrW,
    uWin,
    setUWin,
    shgc,
    setShgc,
    visTrans,
    setVisTrans,
    overhangDepth,
    setOverhangDepth,
    shadingMode,
    setShadingMode,
    daylightDimming,
    setDaylightDimming,
    natVentOpeningRatio,
    setNatVentOpeningRatio,
    wallLayers,
    setWallLayers,
    perimeterDepth,
    floorHeight,
    sim,
    setActiveStage
  } = useDesignProject();

  const activeZoneData = sim.zones[selectedZone];
  const zoneOrder: ThermalZoneName[] = ['South', 'North', 'East', 'West', 'Core'];
  const [facadeViewMode, setFacadeViewMode] = useState<'dalec_plus' | 'iso_shoebox'>('dalec_plus');

  const handleLayerChange = (id: string, field: 'materialId' | 'thicknessMm', value: string | number) => {
    setWallLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleAddLayer = () => {
    setWallLayers((prev) => [
      ...prev,
      {
        id: `layer_${Date.now()}`,
        materialId: 'cork_board',
        thicknessMm: 80
      }
    ]);
  };

  const handleRemoveLayer = (id: string) => {
    if (wallLayers.length <= 2) return;
    setWallLayers((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/80 to-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 4 • ASHRAE 209 Cycle #3 (Load Reduction) & DALEC Shoebox
            </span>
            <span className="text-xs text-slate-300">
              Active Zone: <strong className="text-teal-300">{selectedZone}</strong> ({activeZoneData.floorAreaM2} m² • Urban Shade ×{activeZoneData.urbanShadingFactor})
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1">
            Single-Aspect Shoebox Daylighting & Multi-Layer Opaque Fabric Builder (ISO 13786)
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Balance perimeter daylight autonomy against solar heat gain and verify Italian DM 26/06/2015 / EU nZEB envelope compliance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveStage(5)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
        >
          Proceed to Stage 5 Energy & Comfort
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Studio Sub-Navigation Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFacadeViewMode('dalec_plus')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              facadeViewMode === 'dalec_plus'
                ? 'bg-gradient-to-r from-teal-600 via-indigo-600 to-sky-600 text-white shadow-md'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            DALEC+ 3D Studio & 8,760h Coupled Engine
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold">
              NEW
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFacadeViewMode('iso_shoebox')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              facadeViewMode === 'iso_shoebox'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-teal-400" />
            Single-Aspect Shoebox & ISO 13786 Stratigraphy
          </button>
        </div>
      </div>

      {facadeViewMode === 'dalec_plus' ? (
        <StageDalecPlusStudio />
      ) : (
        <>
      {/* Zone Selector Bar + Legislative Compliance Badges */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 mr-1">Inspect Thermal Zone:</span>
          {zoneOrder.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setSelectedZone(z)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                selectedZone === z
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {z} ({sim.zones[z].sharePct}%)
            </button>
          ))}
        </div>

        {/* Compliance Badges (Italian DM 26/06/2015 Zone {climate.dpr412Zone}) */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {[
            { label: `U_wall ${sim.uWall} W/m²K`, pass: sim.compliance.uWallPass },
            { label: `U_win ${uWin} W/m²K`, pass: sim.compliance.uWinPass },
            { label: `Y_ie ${sim.yIe} W/m²K`, pass: sim.compliance.yIePass },
            { label: `κ_i ${sim.kappaI} kJ/m²K`, pass: sim.compliance.kappaPass },
            { label: `DF ${sim.avgDaylightFactorPct}%`, pass: sim.compliance.daylightPass }
          ].map((badge) => (
            <span
              key={badge.label}
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                badge.pass
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {badge.pass ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              )}
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* Row 1: Single-Aspect Shoebox Cross-Section SVG + Glazing/Shading Controls */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* DALEC-Style Shoebox Cross-Section & Daylight Curve (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-teal-600" />
                DALEC Single-Aspect Shoebox Cross-Section ({selectedZone} Zone)
              </h3>
              <p className="text-[11px] text-slate-500">
                Workplane Daylight Factor (%) decay curve across {perimeterDepth}m depth vs. solar shading overhang & natural ventilation
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                Zone DF: {activeZoneData.daylightFactorPct}%
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                sDA₃₀₀/₅₀%: {activeZoneData.daylightAutonomyPct}%
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3">
            {(() => {
              const W = 540;
              const H = 240;
              const roomX = 95;
              const roomY = 38;
              const roomW = 390;
              const roomH = 155;

              const wwrCurrent = activeZoneData.wwrPct;
              const winH = Math.max(18, (wwrCurrent / 100) * (roomH - 20));
              const winY = roomY + (roomH - winH) / 2;
              const overhangPx = overhangDepth * 42;

              // Daylight Factor curve across room depth (from x = roomX to x = roomX + roomW)
              const dfPoints: string[] = [];
              for (let s = 0; s <= 20; s++) {
                const frac = s / 20;
                const px = roomX + 10 + frac * (roomW - 20);
                // Exponential decay of daylight factor from window inward
                const localDf = activeZoneData.daylightFactorPct * 2.1 * Math.exp(-2.1 * frac);
                const py = roomY + roomH - 12 - Math.min(roomH - 30, localDf * 16);
                dfPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
              }

              // 2% DF target threshold line
              const yDf2 = roomY + roomH - 12 - 2.0 * 16;

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {/* Exterior Sun & Sky Dome on Left */}
                  <circle cx={38} cy={46} r={16} fill="#fbbf24" fillOpacity={0.35} />
                  <circle cx={38} cy={46} r={9} fill="#f59e0b" />
                  <line
                    x1={48}
                    y1={54}
                    x2={roomX + 120}
                    y2={roomY + roomH - 12}
                    stroke="#f59e0b"
                    strokeWidth={1.8}
                    strokeDasharray="5 3"
                  />

                  {/* Room Floor, Ceiling & Rear Core Partition */}
                  <rect
                    x={roomX}
                    y={roomY}
                    width={roomW}
                    height={roomH}
                    fill="#ffffff"
                    stroke="#334155"
                    strokeWidth={4}
                  />

                  {/* Exterior Facade Wall & Window Opening on Left Wall (x = roomX) */}
                  <line
                    x1={roomX}
                    y1={winY}
                    x2={roomX}
                    y2={winY + winH}
                    stroke="#38bdf8"
                    strokeWidth={7}
                  />

                  {/* External Overhang / Dynamic Louvers */}
                  {overhangDepth > 0 && (
                    <line
                      x1={roomX - overhangPx}
                      y1={winY}
                      x2={roomX + 4}
                      y2={winY}
                      stroke="#0f172a"
                      strokeWidth={5}
                    />
                  )}
                  {shadingMode === 'dynamic_louvers' &&
                    [0.2, 0.4, 0.6, 0.8].map((f, i) => (
                      <line
                        key={i}
                        x1={roomX - 10}
                        y1={winY + winH * f - 3}
                        x2={roomX - 2}
                        y2={winY + winH * f + 2}
                        stroke="#d97706"
                        strokeWidth={2.2}
                      />
                    ))}

                  {/* 2.0% Minimum Daylight Factor Threshold Line (EN 17037) */}
                  <line
                    x1={roomX + 8}
                    y1={yDf2}
                    x2={roomX + roomW - 8}
                    y2={yDf2}
                    stroke="#10b981"
                    strokeWidth={1.3}
                    strokeDasharray="4 3"
                  />
                  <text x={roomX + roomW - 12} y={yDf2 - 5} textAnchor="end" fontSize="9" fill="#059669" fontWeight="700">
                    EN 17037 Target DF = 2.0%
                  </text>

                  {/* Daylight Factor Curve across Workplane (0.85m height) */}
                  <polyline fill="none" stroke="#0284c7" strokeWidth={2.8} points={dfPoints.join(' ')} />

                  {/* Natural Ventilation Airflow Arrows */}
                  <path
                    d={`M ${roomX - 18} ${winY + winH * 0.7} Q ${roomX + 80} ${winY + winH * 0.55}, ${roomX + 190} ${winY + winH * 0.72}`}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />

                  {/* Labels */}
                  <text x={roomX + 12} y={roomY + 18} fontSize="10" fontWeight="700" fill="#0f172a">
                    {selectedZone} Perimeter Shoebox (Depth {perimeterDepth}m × Height {floorHeight}m)
                  </text>
                  <text x={roomX + 12} y={roomY + 32} fontSize="9.5" fill="#475569">
                    WWR {wwrCurrent}% • g={shgc} • τ_v={visTrans} • Overhang {overhangDepth}m ({shadingMode.replace('_', ' ')})
                  </text>
                  <text x={roomX + roomW / 2} y={H - 14} textAnchor="middle" fontSize="9.5" fill="#475569" fontWeight="600">
                    Distance from Facade Window (0.0 m → {perimeterDepth.toFixed(1)} m Core Boundary)
                  </text>
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Right: Per-Orientation WWR, Glazing & Shading Controls (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-amber-500" />
            Fenestration, Shading & Daylighting Controls
          </h3>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            {[
              { label: 'South WWR (%)', val: wwrS, set: setWwrS },
              { label: 'North WWR (%)', val: wwrN, set: setWwrN },
              { label: 'East WWR (%)', val: wwrE, set: setWwrE },
              { label: 'West WWR (%)', val: wwrW, set: setWwrW }
            ].map((item) => (
              <label key={item.label}>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>{item.label}</span>
                  <span className="font-bold text-slate-900">{item.val}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={2}
                  value={item.val}
                  onChange={(e) => item.set(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </label>
            ))}
          </div>

          {/* Glazing Specification Library Selector */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                Glazing System Specification
              </span>
              <span className="text-[10px] text-slate-500">
                Pick a certified spec or adjust sliders below
              </span>
            </div>

            <select
              onChange={(e) => {
                const found = GLAZING_LIBRARY.find((g) => g.id === e.target.value);
                if (found) {
                  setUWin(found.uValue);
                  setShgc(found.shgc);
                  setVisTrans(found.visTrans);
                }
              }}
              defaultValue="low_e_double_argon"
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500"
            >
              {GLAZING_LIBRARY.map((gz) => (
                <option key={gz.id} value={gz.id}>
                  {gz.name} — U={gz.uValue} | g={gz.shgc} | VT={gz.visTrans} ({gz.bestFor})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <label>
              <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                <span>Glazing U_win</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums inline-block text-right w-20">{uWin.toFixed(2)} W/m²K</span>
              </div>
              <input
                type="range"
                min={0.6}
                max={2.4}
                step={0.1}
                value={uWin}
                onChange={(e) => setUWin(Number(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </label>
            <label>
              <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                <span>Solar Factor (SHGC g)</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums inline-block text-right w-12">{shgc.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={0.75}
                step={0.02}
                value={shgc}
                onChange={(e) => setShgc(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </label>
            <label>
              <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                <span>Visible Transmittance τ_v</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums inline-block text-right w-12">{visTrans.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.35}
                max={0.82}
                step={0.02}
                value={visTrans}
                onChange={(e) => setVisTrans(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </label>
            <label>
              <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                <span>Overhang Depth (m)</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums inline-block text-right w-14">{overhangDepth.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.0}
                step={0.1}
                value={overhangDepth}
                onChange={(e) => setOverhangDepth(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-700">Shading:</span>
              {(['none', 'fixed_overhang', 'dynamic_louvers'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setShadingMode(m)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize border ${
                    shadingMode === m
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={daylightDimming}
                onChange={(e) => setDaylightDimming(e.target.checked)}
                className="accent-teal-600"
              />
              DALEC Auto-Dimming
            </label>
          </div>

          <label className="block bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Operable Window Natural Ventilation Opening Ratio</span>
              <span className="font-bold text-teal-700">{natVentOpeningRatio}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={natVentOpeningRatio}
              onChange={(e) => setNatVentOpeningRatio(Number(e.target.value))}
              className="w-full accent-teal-600 mt-1"
            />
          </label>
        </div>
      </div>

      {/* Row 2: Opaque Envelope Multi-Layer Builder (ISO 13786 Dynamic Thermal Metrics) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Opaque Envelope Stratigraphy Builder (UNI EN ISO 6946 & ISO 13786 Dynamic Thermal Inertia)
            </h3>
            <p className="text-[11px] text-slate-500">
              Configure exterior-to-interior wall layers to compute stationary transmittance U, periodic transmittance Y_ie, internal heat capacity κ_i, and phase shift Δt
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddLayer}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Envelope Layer
          </button>
        </div>

        {/* Dynamic ISO 13786 KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Stationary U-Value</span>
            <span className="text-lg font-extrabold text-slate-800">{sim.uWall} W/m²K</span>
            <span className={`text-[10px] block font-semibold ${sim.compliance.uWallPass ? 'text-emerald-600' : 'text-rose-600'}`}>
              {sim.compliance.uWallPass ? '✓ DM 2015 Compliant' : '✗ Exceeds Zone Limit'}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Periodic Y_ie (ISO 13786)</span>
            <span className="text-lg font-extrabold text-slate-800">{sim.yIe} W/m²K</span>
            <span className={`text-[10px] block font-semibold ${sim.compliance.yIePass ? 'text-emerald-600' : 'text-rose-600'}`}>
              {sim.compliance.yIePass ? '✓ ≤ 0.10 W/m²K Summer Limit' : '✗ > 0.10 W/m²K Limit'}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Internal Capacity κ_i</span>
            <span className="text-lg font-extrabold text-teal-700">{sim.kappaI} kJ/m²K</span>
            <span className="text-[10px] text-slate-500 block">Decrement f_a = {sim.attenuationFactor}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Time Shift Δt (Phase)</span>
            <span className="text-lg font-extrabold text-indigo-700">{sim.timeShiftHours} hours</span>
            <span className="text-[10px] text-slate-500 block">Total Thickness: {sim.wallThicknessMm} mm</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Wall Embodied A1–A3</span>
            <span className="text-lg font-extrabold text-amber-700">{sim.wallEmbodiedCo2PerM2Facade} kgCO₂e/m²</span>
            <span className="text-[10px] text-slate-500 block">Propagates to Stage 6 LCA</span>
          </div>
        </div>

        {/* Layer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                <th className="py-2 px-2">Layer (Ext → Int)</th>
                <th className="py-2 px-2">Material Specification</th>
                <th className="py-2 px-2">Thickness (mm)</th>
                <th className="py-2 px-2">λ (W/mK)</th>
                <th className="py-2 px-2">ρ (kg/m³)</th>
                <th className="py-2 px-2">R_layer (m²K/W)</th>
                <th className="py-2 px-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wallLayers.map((layer, idx) => {
                const mat =
                  ENVELOPE_MATERIALS.find((m) => m.id === layer.materialId) || ENVELOPE_MATERIALS[0];
                const rLayer = (layer.thicknessMm / 1000 / mat.lambda).toFixed(2);
                return (
                  <tr key={layer.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-bold text-slate-700">
                      {idx === 0
                        ? `1. Exterior`
                        : idx === wallLayers.length - 1
                        ? `${idx + 1}. Interior`
                        : `${idx + 1}. Core`}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={layer.materialId}
                        onChange={(e) => handleLayerChange(layer.id, 'materialId', e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                      >
                        {ENVELOPE_MATERIALS.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.category}] {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={10}
                          max={350}
                          step={5}
                          value={layer.thicknessMm}
                          onChange={(e) =>
                            handleLayerChange(layer.id, 'thicknessMm', Number(e.target.value))
                          }
                          className="w-24 accent-indigo-600"
                        />
                        <span className="font-mono font-bold w-14">{layer.thicknessMm} mm</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-slate-600">{mat.lambda}</td>
                    <td className="py-2 px-2 font-mono text-slate-600">{mat.rho}</td>
                    <td className="py-2 px-2 font-mono font-bold text-teal-700">{rLayer}</td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        disabled={wallLayers.length <= 2}
                        onClick={() => handleRemoveLayer(layer.id)}
                        className="p-1 rounded hover:bg-rose-50 text-rose-500 disabled:opacity-30"
                        title="Remove layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

