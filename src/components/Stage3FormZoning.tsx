import React, { useState } from 'react';
import {
  Box,
  Layers,
  Maximize2,
  Sun,
  ArrowRight,
  CheckCircle2,
  Compass
} from 'lucide-react';
import {
  useDesignProject,
  BuildingTypologyType,
  ThermalZoneName
} from '../context/DesignProjectContext';
import { Urban3DViewer } from './Urban3DViewer';

export const Stage3FormZoning: React.FC = () => {
  const {
    typology,
    applyBuildingTypologyPreset,
    lengthX,
    setLengthX,
    widthY,
    setWidthY,
    floors,
    setFloors,
    floorHeight,
    setFloorHeight,
    perimeterDepth,
    setPerimeterDepth,
    selectedZone,
    setSelectedZone,
    sim,
    setActiveStage,
    climate,
    neighborHeightN,
    neighborHeightS,
    neighborHeightE,
    neighborHeightW,
    streetWidthN,
    streetWidthS,
    streetWidthE,
    streetWidthW,
    urbanAzimuth
  } = useDesignProject();

  const [massingViewMode, setMassingViewMode] = useState<'2d_plan' | '3d_webgl'>('2d_plan');

  const zoneOrder: ThermalZoneName[] = ['South', 'North', 'East', 'West', 'Core'];

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 3 • ASHRAE 209 Cycles #1 & #2 (Simple Box & Conceptual Massing)
            </span>
            <span className="text-xs text-slate-300">
              Inherited Urban Shading: S ×{sim.urbanShading.S} • N ×{sim.urbanShading.N} • E ×{sim.urbanShading.E} • W ×{sim.urbanShading.W}
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1">
            Building Form Typology & 5-Zone Perimeter/Core Thermal Subdivision
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Subdivide the floorplate into 4 orientation-specific perimeter daylight zones (depth {perimeterDepth}m) plus an internal core zone.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveStage(4)}
          className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
        >
          Inspect Selected Zone ({selectedZone}) in Stage 4 Shoebox
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Geometric KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Compactness Ratio (S/V)
          </span>
          <div className="text-xl font-extrabold text-slate-800 mt-0.5">
            {sim.svRatio} <span className="text-xs font-semibold text-slate-500">m⁻¹</span>
          </div>
          <span className="text-[11px] text-teal-700 font-semibold">
            {sim.svRatio < 0.35 ? 'High Compactness (Low Heat Loss)' : 'Articulated / High Daylight Reach'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Gross Floor Area (GFA)
          </span>
          <div className="text-xl font-extrabold text-slate-800 mt-0.5">
            {sim.gfa.toLocaleString()} <span className="text-xs font-semibold text-slate-500">m²</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Footprint {sim.footprintArea} m² × {floors} floors
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Conditioned Volume (V)
          </span>
          <div className="text-xl font-extrabold text-slate-800 mt-0.5">
            {sim.volume.toLocaleString()} <span className="text-xs font-semibold text-slate-500">m³</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Building Height {sim.buildingHeight} m ({floorHeight}m/fl)
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Solar-Exposed Facade Area
          </span>
          <div className="text-xl font-extrabold text-amber-600 mt-0.5">
            {sim.solarExposedFacadeM2.toLocaleString()} <span className="text-xs font-semibold text-slate-500">m² eq</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Out of {sim.facadeAreas.total.toLocaleString()} m² total vertical facade
          </span>
        </div>
      </div>

      {/* Typology Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Box className="w-4 h-4 text-teal-600" />
          Building Massing Typology (ASHRAE 209 Cycle #2):
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'shallow_linear', label: 'Shallow Linear Slab (Daylight/NatVent)' },
              { id: 'deep_plan', label: 'Deep Compact Plan (Low S/V)' },
              { id: 'courtyard', label: 'Courtyard Block (Self-Shaded)' },
              { id: 'l_shape', label: 'L-Shape Corner Block' }
            ] as Array<{ id: BuildingTypologyType; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyBuildingTypologyPreset(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                typology === item.id
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Interactive 2D Floorplate Thermal Zoning SVG + 5-Zone Breakdown Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Interactive 2D Floorplate Thermal Zoning Diagram (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                Floorplate Thermal Subdivision & 3D Massing
              </h3>
              <p className="text-[11px] text-slate-500">
                Inspect 2D thermal zones (N, S, E, W Perimeter & Core) or switch to 3D WebGL with live solar shadows
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMassingViewMode('2d_plan')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    massingViewMode === '2d_plan'
                      ? 'bg-teal-700 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  2D Thermal Plan
                </button>
                <button
                  type="button"
                  onClick={() => setMassingViewMode('3d_webgl')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    massingViewMode === '3d_webgl'
                      ? 'bg-teal-700 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  3D Massing & Shadows
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-semibold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                <span>Perimeter:</span>
                <strong className="text-teal-700">{perimeterDepth.toFixed(1)}m</strong>
                <input
                  type="range"
                  min={3.0}
                  max={5.0}
                  step={0.5}
                  value={perimeterDepth}
                  onChange={(e) => setPerimeterDepth(Number(e.target.value))}
                  className="w-16 accent-teal-600"
                />
              </label>
            </div>
          </div>

          {massingViewMode === '3d_webgl' ? (
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
            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3">
              {(() => {
              const svgW = 560;
              const svgH = 320;
              const cx = svgW / 2;
              const cy = svgH / 2;

              // Scale lengthX and widthY to fit cleanly inside SVG
              const scale = Math.min(380 / Math.max(12, lengthX), 210 / Math.max(10, widthY));
              const rectW = lengthX * scale;
              const rectH = widthY * scale;
              const x0 = cx - rectW / 2;
              const y0 = cy - rectH / 2;
              const x1 = cx + rectW / 2;
              const y1 = cy + rectH / 2;

              const pPx = Math.min(perimeterDepth * scale, Math.min(rectW, rectH) * 0.42);

              // Trapezoid vertices for North, South, East, West perimeter zones + inner Core rectangle
              const northPoly = `${x0},${y0} ${x1},${y0} ${x1 - pPx},${y0 + pPx} ${x0 + pPx},${y0 + pPx}`;
              const southPoly = `${x0},${y1} ${x1},${y1} ${x1 - pPx},${y1 - pPx} ${x0 + pPx},${y1 - pPx}`;
              const westPoly = `${x0},${y0} ${x0 + pPx},${y0 + pPx} ${x0 + pPx},${y1 - pPx} ${x0},${y1}`;
              const eastPoly = `${x1},${y0} ${x1 - pPx},${y0 + pPx} ${x1 - pPx},${y1 - pPx} ${x1},${y1}`;

              const zoneStyle = (z: ThermalZoneName, baseColor: string, activeColor: string) => ({
                fill: selectedZone === z ? activeColor : baseColor,
                stroke: selectedZone === z ? '#0f172a' : '#475569',
                strokeWidth: selectedZone === z ? 2.5 : 1.2,
                cursor: 'pointer'
              });

              return (
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto">
                  {/* Compass Orientation Rose */}
                  <g transform="translate(45, 45)">
                    <circle cx={0} cy={0} r={22} fill="#fff" stroke="#cbd5e1" strokeWidth={1.2} />
                    <text x={0} y={-8} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0f766e">
                      N
                    </text>
                    <polygon points="0,-6 -4,6 0,3 4,6" fill="#0f766e" />
                  </g>

                  {/* Neighbor Obstruction Bars on N, S, E, W */}
                  <text x={cx} y={20} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0369a1">
                    NORTH FACADE ({lengthX}m) • Urban Multiplier ×{sim.urbanShading.N} • Area {sim.zones.North.floorAreaM2} m²
                  </text>
                  <text x={cx} y={svgH - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#d97706">
                    SOUTH FACADE ({lengthX}m) • Urban Multiplier ×{sim.urbanShading.S} • Area {sim.zones.South.floorAreaM2} m²
                  </text>

                  {/* North Perimeter Trapezoid */}
                  <polygon
                    points={northPoly}
                    {...zoneStyle('North', '#bae6fd', '#38bdf8')}
                    onClick={() => setSelectedZone('North')}
                  />
                  <text
                    x={cx}
                    y={y0 + pPx / 2 + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#0f172a"
                    pointerEvents="none"
                  >
                    North Zone ({sim.zones.North.sharePct}% • DF {sim.zones.North.daylightFactorPct}%)
                  </text>

                  {/* South Perimeter Trapezoid */}
                  <polygon
                    points={southPoly}
                    {...zoneStyle('South', '#fde68a', '#fbbf24')}
                    onClick={() => setSelectedZone('South')}
                  />
                  <text
                    x={cx}
                    y={y1 - pPx / 2 + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#0f172a"
                    pointerEvents="none"
                  >
                    South Zone ({sim.zones.South.sharePct}% • DF {sim.zones.South.daylightFactorPct}%)
                  </text>

                  {/* West Perimeter Trapezoid */}
                  <polygon
                    points={westPoly}
                    {...zoneStyle('West', '#ddd6fe', '#a78bfa')}
                    onClick={() => setSelectedZone('West')}
                  />
                  <text
                    x={x0 + pPx / 2}
                    y={cy}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#0f172a"
                    transform={`rotate(-90, ${x0 + pPx / 2}, ${cy})`}
                    pointerEvents="none"
                  >
                    West ({sim.zones.West.sharePct}%)
                  </text>

                  {/* East Perimeter Trapezoid */}
                  <polygon
                    points={eastPoly}
                    {...zoneStyle('East', '#99f6e4', '#2dd4bf')}
                    onClick={() => setSelectedZone('East')}
                  />
                  <text
                    x={x1 - pPx / 2}
                    y={cy}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="700"
                    fill="#0f172a"
                    transform={`rotate(90, ${x1 - pPx / 2}, ${cy})`}
                    pointerEvents="none"
                  >
                    East ({sim.zones.East.sharePct}%)
                  </text>

                  {/* Core Zone Rectangle */}
                  <rect
                    x={x0 + pPx}
                    y={y0 + pPx}
                    width={Math.max(10, rectW - 2 * pPx)}
                    height={Math.max(10, rectH - 2 * pPx)}
                    {...zoneStyle('Core', '#e2e8f0', '#94a3b8')}
                    onClick={() => setSelectedZone('Core')}
                  />
                  {typology === 'courtyard' && (
                    <rect
                      x={cx - (rectW - 2 * pPx) * 0.28}
                      y={cy - (rectH - 2 * pPx) * 0.28}
                      width={(rectW - 2 * pPx) * 0.56}
                      height={(rectH - 2 * pPx) * 0.56}
                      fill="#ecfdf5"
                      stroke="#059669"
                      strokeDasharray="3 2"
                      pointerEvents="none"
                    />
                  )}
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#1e293b"
                    pointerEvents="none"
                  >
                    Core Zone ({sim.zones.Core.sharePct}% • {sim.zones.Core.floorAreaM2} m²)
                  </text>
                </svg>
              );
            })()}
          </div>
          )}

          {/* Footprint Dimension Sliders */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>E–W Length L</span>
                <span className="font-bold text-slate-900">{lengthX} m</span>
              </div>
              <input
                type="range"
                min={16}
                max={80}
                step={2}
                value={lengthX}
                onChange={(e) => setLengthX(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>N–S Depth W</span>
                <span className="font-bold text-slate-900">{widthY} m</span>
              </div>
              <input
                type="range"
                min={10}
                max={50}
                step={2}
                value={widthY}
                onChange={(e) => setWidthY(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Storeys</span>
                <span className="font-bold text-slate-900">{floors} fl</span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={floors}
                onChange={(e) => setFloors(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Floor-to-Floor</span>
                <span className="font-bold text-slate-900">{floorHeight.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={2.8}
                max={4.5}
                step={0.1}
                value={floorHeight}
                onChange={(e) => setFloorHeight(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </label>
          </div>
        </div>

        {/* Right: 5 Thermal Zones Detailed Table & Shoebox Downscaling Selector (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-600" />
              5-Zone Thermal & Daylighting Breakdown
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select any zone to inspect its single-aspect shoebox facade and thermal fabric in Stage 4
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                    <th className="py-2 px-2">Zone</th>
                    <th className="py-2 px-2">Area (m²)</th>
                    <th className="py-2 px-2">Urban Shade</th>
                    <th className="py-2 px-2">DF / sDA</th>
                    <th className="py-2 px-2">Heat / Cool</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zoneOrder.map((zName) => {
                    const z = sim.zones[zName];
                    const isSel = selectedZone === zName;
                    return (
                      <tr
                        key={zName}
                        onClick={() => setSelectedZone(zName)}
                        className={`cursor-pointer transition ${
                          isSel ? 'bg-teal-50/90 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-2 flex items-center gap-1.5">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${isSel ? 'text-teal-600' : 'text-slate-300'}`}
                          />
                          <span className="font-bold text-slate-800">{z.name}</span>
                        </td>
                        <td className="py-2.5 px-2">
                          {z.floorAreaM2} m² <span className="text-[10px] text-slate-400">({z.sharePct}%)</span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-amber-700">
                          {zName === 'Core' ? '—' : `×${z.urbanShadingFactor}`}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-emerald-700 font-semibold">{z.daylightFactorPct}%</span> /{' '}
                          <span className="text-slate-600">{z.daylightAutonomyPct}%</span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px]">
                          <span className="text-rose-600">{z.heatingLoadKwhM2}</span> /{' '}
                          <span className="text-sky-600">{z.coolingLoadKwhM2}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-teal-300">
                Active Focus: {selectedZone} Thermal Zone ({sim.zones[selectedZone].floorAreaM2} m²)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                Solar Gain: {sim.zones[selectedZone].annualSolarGainKwhM2} kWh/m²yr
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Proceed to Stage 4 to tune {selectedZone} glazing WWR, SHGC, dynamic overhangs, and multi-layer opaque envelope thermal inertia (U, Y_ie, κ_i).
            </p>
            <button
              type="button"
              onClick={() => setActiveStage(4)}
              className="w-full py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              Open {selectedZone} Zone in Stage 4 Shoebox & Fabric Builder
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

