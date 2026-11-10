import React, { useState } from 'react';
import {
  Building2,
  Sun,
  Compass,
  Trees,
  Zap,
  ArrowRight,
  Eye,
  Layers,
  Box
} from 'lucide-react';
import { useDesignProject, UrbanMorphologyType } from '../context/DesignProjectContext';
import { Urban3DViewer } from './Urban3DViewer';

export const Stage2Urban: React.FC = () => {
  const {
    climate,
    neighborHeightN,
    setNeighborHeightN,
    neighborHeightS,
    setNeighborHeightS,
    neighborHeightE,
    setNeighborHeightE,
    neighborHeightW,
    setNeighborHeightW,
    streetWidthN,
    setStreetWidthN,
    streetWidthS,
    setStreetWidthS,
    streetWidthE,
    setStreetWidthE,
    streetWidthW,
    setStreetWidthW,
    urbanAzimuth,
    setUrbanAzimuth,
    urbanMorphology,
    applyUrbanMorphologyPreset,
    urbanGreenRatio,
    setUrbanGreenRatio,
    urbanAlbedo,
    setUrbanAlbedo,
    districtSharedRenewableKw,
    setDistrictSharedRenewableKw,
    lengthX,
    widthY,
    floors,
    floorHeight,
    perimeterDepth,
    sim,
    setActiveStage
  } = useDesignProject();

  const [urbanViewMode, setUrbanViewMode] = useState<'2.5d_svg' | '3d_webgl'>('3d_webgl');

  // Isometric projection helper for 2.5D Urban Block Canvas
  const isoProject = (x: number, y: number, z: number, cx = 310, cy = 205) => {
    const rad = ((urbanAzimuth - 35) * Math.PI) / 180;
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    const sx = cx + (rx - ry) * 0.88;
    const sy = cy + (rx + ry) * 0.44 - z * 1.45;
    return { x: +sx.toFixed(1), y: +sy.toFixed(1) };
  };

  // Build SVG polygons (Top, Left-Front, Right-Front) for a 2.5D extruded prism
  const renderIsoBox = (
    x0: number,
    y0: number,
    w: number,
    d: number,
    h: number,
    colors: { top: string; left: string; right: string; stroke: string },
    label?: string,
    subLabel?: string
  ) => {
    const p000 = isoProject(x0, y0, 0);
    const p100 = isoProject(x0 + w, y0, 0);
    const p110 = isoProject(x0 + w, y0 + d, 0);
    const p010 = isoProject(x0, y0 + d, 0);

    const p001 = isoProject(x0, y0, h);
    const p101 = isoProject(x0 + w, y0, h);
    const p111 = isoProject(x0 + w, y0 + d, h);
    const p011 = isoProject(x0, y0 + d, h);

    const topPts = `${p001.x},${p001.y} ${p101.x},${p101.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`;
    const leftPts = `${p010.x},${p010.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p011.x},${p011.y}`;
    const rightPts = `${p100.x},${p100.y} ${p110.x},${p110.y} ${p111.x},${p111.y} ${p101.x},${p101.y}`;

    const centerTop = isoProject(x0 + w / 2, y0 + d / 2, h);

    return (
      <g key={`${x0}_${y0}_${label}`}>
        <polygon points={leftPts} fill={colors.left} stroke={colors.stroke} strokeWidth={1} />
        <polygon points={rightPts} fill={colors.right} stroke={colors.stroke} strokeWidth={1} />
        <polygon points={topPts} fill={colors.top} stroke={colors.stroke} strokeWidth={1} />
        {label && (
          <text
            x={centerTop.x}
            y={centerTop.y - 4}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#0f172a"
          >
            {label}
          </text>
        )}
        {subLabel && (
          <text
            x={centerTop.x}
            y={centerTop.y + 8}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="600"
            fill="#334155"
          >
            {subLabel}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 2 • Urban Planning & 2.5D District Downscaling
            </span>
            <span className="text-xs text-slate-300">
              Sky View Factor (SVF): <strong className="text-teal-300">{sim.skyViewFactor}</strong> • Avg Facade Solar Multiplier:{' '}
              <strong className="text-amber-300">×{sim.urbanShading.avg}</strong>
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1">
            2.5D Urban Canyon Morphology, Neighbor Shading Mask & Zero-Energy District
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Configure surrounding block heights, street canyon widths, azimuth, and green infrastructure; solar obstruction multipliers automatically propagate to Stages 3–6.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveStage(3)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
        >
          Downscale to Target Building (Stage 3)
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Urban Morphology Quick Presets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Layers className="w-4 h-4 text-indigo-600" />
          Urban District Morphology Archetype:
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'compact_canyon', label: 'Compact Historic Canyon (Milan/Rome)' },
              { id: 'open_superblock', label: 'Open Green Superblock' },
              { id: 'courtyard_perimeter', label: 'European Courtyard Perimeter' },
              { id: 'highrise_towers', label: 'High-Density Tower District' }
            ] as Array<{ id: UrbanMorphologyType; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyUrbanMorphologyPreset(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                urbanMorphology === item.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: 2.5D Isometric District Canvas + Hemispherical SVF Mask */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left/Center: Interactive 2.5D Isometric Urban Block SVG (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Urban District & Target Plot Canvas
              </h3>
              <p className="text-[11px] text-slate-500">
                Central Target Building ({sim.buildingHeight}m tall) surrounded by North, South, East, West neighbor blocks & vegetative canyon
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUrbanViewMode('3d_webgl')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    urbanViewMode === '3d_webgl'
                      ? 'bg-teal-700 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  3D WebGL (Sun Shadows)
                </button>
                <button
                  type="button"
                  onClick={() => setUrbanViewMode('2.5d_svg')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    urbanViewMode === '2.5d_svg'
                      ? 'bg-teal-700 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  2.5D SVG Axon
                </button>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Azimuth: {urbanAzimuth > 0 ? `+${urbanAzimuth}°` : `${urbanAzimuth}°`}
              </span>
            </div>
          </div>

          {urbanViewMode === '3d_webgl' ? (
            <Urban3DViewer
              footprintLength={lengthX}
              footprintWidth={widthY}
              floorsCount={floors}
              floorHeight={floorHeight}
              urbanAzimuth={urbanAzimuth}
              streetWidth={(streetWidthN + streetWidthS + streetWidthE + streetWidthW) / 4}
              neighborNorthH={neighborHeightN}
              neighborSouthH={neighborHeightS}
              neighborEastH={neighborHeightE}
              neighborWestH={neighborHeightW}
              latitude={climate.lat}
              wwrSouth={sim.zones.South?.wwrPct / 100 || 0.4}
              wwrNorth={sim.zones.North?.wwrPct / 100 || 0.25}
              wwrEast={sim.zones.East?.wwrPct / 100 || 0.3}
              wwrWest={sim.zones.West?.wwrPct / 100 || 0.3}
              perimeterDepth={perimeterDepth}
              urbanShadingSouth={sim.urbanShading.S}
              urbanShadingNorth={sim.urbanShading.N}
              urbanShadingEast={sim.urbanShading.E}
              urbanShadingWest={sim.urbanShading.W}
            />
          ) : (
            <div className="w-full bg-gradient-to-b from-sky-50/70 via-slate-50 to-emerald-50/30 rounded-xl border border-slate-200 overflow-hidden">
              {(() => {
              const tw = Math.min(56, Math.max(24, lengthX * 0.9));
              const td = Math.min(44, Math.max(18, widthY * 0.9));
              const th = sim.buildingHeight * 1.6;

              const gapN = streetWidthN * 1.3;
              const gapS = streetWidthS * 1.3;
              const gapE = streetWidthE * 1.3;
              const gapW = streetWidthW * 1.3;

              // Collect boxes and sort back-to-front by (x + y) for painter's algorithm
              const boxes = [
                {
                  id: 'North Neighbor',
                  x: -tw / 2,
                  y: -td / 2 - gapN - 28,
                  w: tw,
                  d: 28,
                  h: neighborHeightN * 1.6,
                  colors: { top: '#e2e8f0', left: '#94a3b8', right: '#cbd5e1', stroke: '#475569' },
                  label: `N Block (${neighborHeightN}m)`,
                  subLabel: `Street ${streetWidthN}m • ×${sim.urbanShading.N}`
                },
                {
                  id: 'West Neighbor',
                  x: -tw / 2 - gapW - 28,
                  y: -td / 2,
                  w: 28,
                  d: td,
                  h: neighborHeightW * 1.6,
                  colors: { top: '#e2e8f0', left: '#94a3b8', right: '#cbd5e1', stroke: '#475569' },
                  label: `W (${neighborHeightW}m)`,
                  subLabel: `×${sim.urbanShading.W}`
                },
                {
                  id: 'Target Building',
                  x: -tw / 2,
                  y: -td / 2,
                  w: tw,
                  d: td,
                  h: th,
                  colors: { top: '#2dd4bf', left: '#0d9488', right: '#14b8a6', stroke: '#0f766e' },
                  label: `TARGET PLOT (${sim.buildingHeight}m)`,
                  subLabel: `${sim.gfa.toLocaleString()} m² GFA`
                },
                {
                  id: 'East Neighbor',
                  x: tw / 2 + gapE,
                  y: -td / 2,
                  w: 28,
                  d: td,
                  h: neighborHeightE * 1.6,
                  colors: { top: '#e2e8f0', left: '#94a3b8', right: '#cbd5e1', stroke: '#475569' },
                  label: `E (${neighborHeightE}m)`,
                  subLabel: `×${sim.urbanShading.E}`
                },
                {
                  id: 'South Neighbor',
                  x: -tw / 2,
                  y: td / 2 + gapS,
                  w: tw,
                  d: 28,
                  h: neighborHeightS * 1.6,
                  colors: { top: '#fde68a', left: '#d97706', right: '#f59e0b', stroke: '#92400e' },
                  label: `S Block (${neighborHeightS}m)`,
                  subLabel: `Street ${streetWidthS}m • ×${sim.urbanShading.S}`
                }
              ].sort((a, b) => a.x + a.y - (b.x + b.y));

              // Ground plane polygon
              const g0 = isoProject(-130, -120, 0);
              const g1 = isoProject(130, -120, 0);
              const g2 = isoProject(130, 120, 0);
              const g3 = isoProject(-130, 120, 0);

              return (
                <svg viewBox="0 0 620 350" className="w-full h-auto">
                  {/* Urban Ground / Albedo + Green Cover Plane */}
                  <polygon
                    points={`${g0.x},${g0.y} ${g1.x},${g1.y} ${g2.x},${g2.y} ${g3.x},${g3.y}`}
                    fill={urbanGreenRatio > 30 ? '#d1fae5' : '#f1f5f9'}
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                  />

                  {/* Solar Ray Indicator from South-West */}
                  <g>
                    <circle cx={535} cy={48} r={18} fill="#fbbf24" fillOpacity={0.3} />
                    <circle cx={535} cy={48} r={10} fill="#f59e0b" />
                    <line
                      x1={520}
                      y1={60}
                      x2={345}
                      y2={165}
                      stroke="#f59e0b"
                      strokeWidth={1.8}
                      strokeDasharray="5 3"
                    />
                  </g>

                  {/* Render sorted 2.5D buildings */}
                  {boxes.map((b) =>
                    renderIsoBox(b.x, b.y, b.w, b.d, b.h, b.colors, b.label, b.subLabel)
                  )}

                  {/* Legend Footer inside SVG */}
                  <rect x={14} y={310} width={592} height={28} rx={6} fill="#0f172a" fillOpacity={0.85} />
                  <text x={26} y={328} fontSize="10" fill="#5eead4" fontWeight="700">
                    Target Plot: {lengthX}m × {widthY}m ({sim.buildingHeight}m)
                  </text>
                  <text x={245} y={328} fontSize="10" fill="#fde047" fontWeight="600">
                    Facade Solar Multipliers — S: ×{sim.urbanShading.S} | N: ×{sim.urbanShading.N} | E: ×{sim.urbanShading.E} | W: ×{sim.urbanShading.W}
                  </text>
                </svg>
              );
            })()}
          </div>
          )}
        </div>

        {/* Right: Urban Shading Mask & Facade Multipliers + Zero Energy District Card (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Urban Shading Mask & Sky View Factor Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-500" />
                Urban Shading Mask & Sky View Factor (SVF)
              </h3>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                SVF = {sim.skyViewFactor}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { dir: 'South', mult: sim.urbanShading.S, angle: sim.canyonAnglesDeg.S, color: 'text-amber-600' },
                  { dir: 'East', mult: sim.urbanShading.E, angle: sim.canyonAnglesDeg.E, color: 'text-teal-600' },
                  { dir: 'West', mult: sim.urbanShading.W, angle: sim.canyonAnglesDeg.W, color: 'text-indigo-600' },
                  { dir: 'North', mult: sim.urbanShading.N, angle: sim.canyonAnglesDeg.N, color: 'text-sky-600' }
                ] as const
              ).map((f) => (
                <div key={f.dir} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">{f.dir} Facade</span>
                  <span className={`text-base font-extrabold ${f.color}`}>×{f.mult}</span>
                  <span className="text-[10px] text-slate-500 block">Canyon {f.angle}°</span>
                </div>
              ))}
            </div>

            {/* Sliders for Neighbor Heights & Street Canyon Widths */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
              <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-700 text-[11px]">Neighbor Heights h₁–h₄ (m)</div>
                {[
                  { label: 'South Neighbor h_S', val: neighborHeightS, set: setNeighborHeightS },
                  { label: 'North Neighbor h_N', val: neighborHeightN, set: setNeighborHeightN },
                  { label: 'East Neighbor h_E', val: neighborHeightE, set: setNeighborHeightE },
                  { label: 'West Neighbor h_W', val: neighborHeightW, set: setNeighborHeightW }
                ].map((item) => (
                  <label key={item.label} className="block">
                    <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                      <span>{item.label}</span>
                      <span className="font-bold text-slate-800 font-mono tabular-nums inline-block text-right w-12">{item.val} m</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={45}
                      step={1}
                      value={item.val}
                      onChange={(e) => item.set(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-700 text-[11px]">Canyon Widths W & Microclimate</div>
                {[
                  { label: 'South Street W_S (m)', val: streetWidthS, set: setStreetWidthS, min: 6, max: 36, step: 1 },
                  { label: 'East/West Street W (m)', val: streetWidthE, set: (v: number) => { setStreetWidthE(v); setStreetWidthW(v); }, min: 6, max: 36, step: 1 },
                  { label: 'Urban Azimuth (°)', val: urbanAzimuth, set: setUrbanAzimuth, min: -45, max: 45, step: 5 },
                  { label: 'Green Canopy (%)', val: urbanGreenRatio, set: setUrbanGreenRatio, min: 0, max: 60, step: 5 }
                ].map((item) => (
                  <label key={item.label} className="block">
                    <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
                      <span>{item.label}</span>
                      <span className="font-bold text-slate-800 font-mono tabular-nums inline-block text-right w-12">{item.val}</span>
                    </div>
                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={item.val}
                      onChange={(e) => item.set(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Zero Energy District Summary Card */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                Zero Energy District & Microgrid Summary
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
                UHI ΔT: {sim.uhiTempDeltaC > 0 ? `+${sim.uhiTempDeltaC}°C` : `${sim.uhiTempDeltaC}°C`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block">District GFA (5 Plots)</span>
                <span className="font-bold text-white text-sm">
                  {sim.districtStats.districtTotalGfaM2.toLocaleString()} m²
                </span>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Mutual Solar Loss</span>
                <span className="font-bold text-amber-300 text-sm">
                  -{sim.districtStats.mutualShadingReductionPct}%
                </span>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Shared PV Credit</span>
                <span className="font-bold text-teal-300 text-sm">
                  {sim.districtSharedPvContribution} kWh/m²
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex-1 text-[11px] text-slate-300">
                Shared District PV / Seasonal Storage Capacity: <strong>{districtSharedRenewableKw} kWp</strong>
                <input
                  type="range"
                  min={0}
                  max={400}
                  step={20}
                  value={districtSharedRenewableKw}
                  onChange={(e) => setDistrictSharedRenewableKw(Number(e.target.value))}
                  className="w-full accent-teal-400 mt-1"
                />
              </label>
              <button
                type="button"
                onClick={() => setActiveStage(3)}
                className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1 transition"
              >
                Downscale to Target Building
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

