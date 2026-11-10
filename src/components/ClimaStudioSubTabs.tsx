import React, { useState, useMemo, useRef } from 'react';
import {
  Download,
  FileSpreadsheet,
  Wind,
  Compass,
  Thermometer,
  Sun,
  Sparkles,
  CheckCircle2,
  Sliders,
  Filter
} from 'lucide-react';
import { ClimateDataset, HourlyWeatherRecord, calcHumidityRatio } from '../utils/epwEngine';
import {
  WindFilterMode,
  calcFilteredWindRose,
  BioclimaticPolygonId,
  getBioclimaticPolygons,
  evaluatePsychrometricPolygons,
  calcNaturalVentilationPotential,
  UtciScenarioId,
  UTCI_STRESS_BANDS,
  calcUtciScenarioDataset,
  calcDistributionHistogram,
  exportSvgNodeToFile,
  exportDataToCsvFile,
  calcDewPointC
} from '../utils/epwParser';
import { MONTHS, CLIMATE_SCOUT_STRATEGIES, scoreStrategyRelevance } from '../data/climateAndStrategies';

// ============================================================================
// REUSABLE CHART CARD WITH ONE-CLICK "EXPORT SVG", "EXPORT DERIVED CSV" & INTERACTIVE TOOLTIP
// ============================================================================
export interface ClimaTooltipLine {
  label: string;
  value: string | number;
  color?: string;
}

export interface ClimaTooltipData {
  title: string;
  lines: ClimaTooltipLine[];
}

export interface ClimaTooltipCtx {
  show: (e: React.MouseEvent<SVGElement | HTMLElement>, title: string, lines: ClimaTooltipLine[]) => void;
  move: (e: React.MouseEvent<SVGElement | HTMLElement>) => void;
  hide: () => void;
}

interface ClimaChartCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  controls?: React.ReactNode;
  svgFilename: string;
  csvFilename: string;
  onBuildCsv: () => { headers: string[]; rows: Array<Array<string | number>> };
  children: (
    svgRef: React.RefObject<SVGSVGElement | null>,
    tooltipCtx: ClimaTooltipCtx
  ) => React.ReactNode;
  footer?: React.ReactNode;
}

export const ClimaChartCard: React.FC<ClimaChartCardProps> = ({
  title,
  subtitle,
  icon,
  badge,
  controls,
  svgFilename,
  csvFilename,
  onBuildCsv,
  children,
  footer
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: ClimaTooltipData | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    data: null
  });

  const tooltipCtx = useMemo<ClimaTooltipCtx>(
    () => ({
      show: (e, title, lines) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip({
          visible: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          data: { title, lines }
        });
      },
      move: (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip((prev) => ({
          ...prev,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }));
      },
      hide: () => {
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    }),
    []
  );

  const handleExportSvg = () => {
    exportSvgNodeToFile(svgRef.current, svgFilename);
  };

  const handleExportCsv = () => {
    const { headers, rows } = onBuildCsv();
    exportDataToCsvFile(headers, rows, csvFilename);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col justify-between relative transition hover:shadow-md">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              {icon}
              {title}
            </h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {badge}
            <button
              type="button"
              onClick={handleExportSvg}
              title="Download publication-grade vector SVG chart"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10.5px] font-bold flex items-center gap-1 transition"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              Export SVG
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              title="Download derived numerical table as CSV"
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10.5px] font-bold flex items-center gap-1 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              Export CSV
            </button>
          </div>
        </div>

        {controls && <div className="pt-1">{controls}</div>}
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto relative min-h-[160px]">
        {children(svgRef, tooltipCtx)}

        {/* Global Floating Glassmorphism Tooltip */}
        {tooltip.visible && tooltip.data && (
          <div
            className="pointer-events-none absolute z-50 px-3.5 py-2.5 rounded-xl bg-slate-950/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md max-w-xs -translate-x-1/2 -translate-y-full transition-all duration-75"
            style={{
              left: Math.max(100, Math.min(800, tooltip.x)),
              top: Math.max(15, tooltip.y - 10)
            }}
          >
            <div className="font-extrabold text-[11px] text-teal-300 pb-1 border-b border-slate-800 flex items-center justify-between gap-3">
              <span>{tooltip.data.title}</span>
            </div>
            <div className="space-y-1 pt-1.5 text-[10.5px]">
              {tooltip.data.lines.map((ln, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 font-medium">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    {ln.color && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ln.color }} />
                    )}
                    {ln.label}:
                  </span>
                  <span className="font-mono font-bold text-slate-100">{ln.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {footer && <div className="pt-1">{footer}</div>}
    </div>
  );
};

// ============================================================================
// REUSABLE 24h x 365d TIMETABLE CARPET HEATMAP SVG RENDERER (INTERACTIVE HOVER)
// ============================================================================
interface CarpetHeatmapProps {
  svgRef?: React.RefObject<SVGSVGElement | null>;
  tooltipCtx?: ClimaTooltipCtx;
  hourly: HourlyWeatherRecord[];
  getValue: (h: HourlyWeatherRecord, idx: number) => number;
  getColor: (val: number) => string;
  unitLabel: string;
  legendItems: Array<{ label: string; color: string }>;
}

export const CarpetHeatmap24x365: React.FC<CarpetHeatmapProps> = ({
  svgRef,
  tooltipCtx,
  hourly,
  getValue,
  getColor,
  unitLabel,
  legendItems
}) => {
  const W = 860;
  const H = 240;
  const padL = 42;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const cellW = plotW / 365;
  const cellH = plotH / 24;

  const [activeCell, setActiveCell] = useState<{ dayOfYear: number; hour: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef?.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursor = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    if (cursor.x < padL || cursor.x > W - padR || cursor.y < padT || cursor.y > H - padB) {
      setActiveCell(null);
      tooltipCtx?.hide();
      return;
    }
    const day0 = Math.floor((cursor.x - padL) / cellW);
    const dayOfYear = Math.max(1, Math.min(365, day0 + 1));
    const hrInv = Math.floor((cursor.y - padT) / cellH);
    const hour = Math.max(0, Math.min(23, 23 - hrInv));

    setActiveCell({ dayOfYear, hour });
    const idx = (dayOfYear - 1) * 24 + hour;
    const rec = hourly[idx];
    if (rec && tooltipCtx) {
      const val = getValue(rec, idx);
      const mName = MONTHS[rec.month];
      tooltipCtx.show(e, `${mName} ${rec.dayOfMonth} • ${String(hour).padStart(2, '0')}:00`, [
        { label: unitLabel, value: typeof val === 'number' ? val.toFixed(1) : String(val), color: getColor(val) },
        { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` },
        { label: 'Relative Humidity', value: `${rec.relHum}%` },
        { label: 'Wind Speed', value: `${rec.windSpeed} m/s` },
        { label: 'GHI', value: `${rec.ghi} W/m²` }
      ]);
      tooltipCtx.move(e);
    }
  };

  const handleMouseLeave = () => {
    setActiveCell(null);
    tooltipCtx?.hide();
  };

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-auto bg-slate-950 rounded-xl p-1 cursor-crosshair shadow-inner"
      >
        {[0, 6, 12, 18, 23].map((hr) => {
          const y = padT + (23 - hr) * cellH + cellH * 0.5;
          return (
            <text key={hr} x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fontWeight="600" fill="#94a3b8">
              {String(hr).padStart(2, '0')}:00
            </text>
          );
        })}

        {hourly.map((rec, idx) => {
          const val = getValue(rec, idx);
          const x = padL + (rec.dayOfYear - 1) * cellW;
          const y = padT + (23 - rec.hour) * cellH;
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={cellW + 0.45}
              height={cellH + 0.45}
              fill={getColor(val)}
            />
          );
        })}

        {/* Highlight Active Cell Border */}
        {activeCell && (
          <rect
            x={padL + (activeCell.dayOfYear - 1) * cellW}
            y={padT + (23 - activeCell.hour) * cellH}
            width={cellW + 1}
            height={cellH + 1}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1.8}
            className="animate-pulse"
          />
        )}

        {MONTHS.map((m, i) => {
          const x = padL + (i + 0.5) * (plotW / 12);
          return (
            <g key={m}>
              <line
                x1={padL + i * (plotW / 12)}
                y1={padT}
                x2={padL + i * (plotW / 12)}
                y2={padT + plotH}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={0.8}
              />
              <text x={x} y={H - 9} textAnchor="middle" fontSize="10" fill="#e2e8f0" fontWeight="700">
                {m}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-600 px-1">
        <span className="font-semibold text-slate-500">
          365 Days × 24 Hours (8,760h Annual Matrix • {unitLabel} • Hover to inspect any hour)
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {legendItems.map((it, idx) => (
            <span key={idx} className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-3 rounded-sm inline-block shadow-sm" style={{ backgroundColor: it.color }} />
              {it.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Smooth continuous RGB colormap interpolation helpers (matching CBE Clima Plotly palettes)
function interpolatePalette(stops: Array<[number, number, number]>, tNorm: number): string {
  const f = Math.max(0, Math.min(1, tNorm)) * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(f));
  const frac = f - idx;
  const c0 = stops[idx];
  const c1 = stops[idx + 1];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  return `rgb(${r},${g},${b})`;
}

const RDYLBU_R_STOPS: Array<[number, number, number]> = [
  [49, 54, 149],
  [69, 117, 180],
  [116, 173, 209],
  [224, 243, 248],
  [254, 224, 144],
  [244, 109, 67],
  [215, 48, 39],
  [165, 0, 38]
];

const YLGNBU_STOPS: Array<[number, number, number]> = [
  [255, 255, 204],
  [199, 233, 180],
  [127, 205, 187],
  [65, 182, 196],
  [29, 145, 192],
  [34, 94, 168],
  [12, 44, 132]
];

const YLORRD_WIND_STOPS: Array<[number, number, number]> = [
  [15, 23, 42],
  [3, 105, 161],
  [13, 148, 136],
  [245, 158, 11],
  [225, 29, 72]
];

export function colorForTempC(t: number, globalRange: boolean): string {
  const min = globalRange ? -20 : -5;
  const max = globalRange ? 45 : 38;
  return interpolatePalette(RDYLBU_R_STOPS, (t - min) / (max - min));
}

export function colorForRhPct(rh: number): string {
  return interpolatePalette(YLGNBU_STOPS, rh / 100);
}

export function colorForWindSpeed(v: number, globalRange: boolean): string {
  const max = globalRange ? 18 : 10;
  return interpolatePalette(YLORRD_WIND_STOPS, v / max);
}

export function colorForWindDir(deg: number): string {
  if (deg >= 315 || deg < 45) return '#38bdf8'; // North
  if (deg >= 45 && deg < 135) return '#a78bfa'; // East
  if (deg >= 135 && deg < 225) return '#f59e0b'; // South
  return '#10b981'; // West
}

// ============================================================================
// SUB-TAB 5: WIND (MULTI-MODE ROSE + CUSTOM SLIDERS + 24x365 HEATMAPS)
// ============================================================================
export const SubTab5Wind: React.FC<{
  climate: ClimateDataset;
  globalValueRanges: boolean;
}> = ({ climate, globalValueRanges }) => {
  const [windMode, setWindMode] = useState<WindFilterMode>('annual');
  const [monthStart, setMonthStart] = useState(5);
  const [monthEnd, setMonthEnd] = useState(9);
  const [hourStart, setHourStart] = useState(9);
  const [hourEnd, setHourEnd] = useState(19);

  const windStats = useMemo(
    () => calcFilteredWindRose(climate.hourly, windMode, monthStart, monthEnd, hourStart, hourEnd),
    [climate.hourly, windMode, monthStart, monthEnd, hourStart, hourEnd]
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Polar Wind Rose (6 cols) */}
        <div className="xl:col-span-6">
          <ClimaChartCard
            title="Multi-Mode 16-Sector Polar Wind Rose (Frequency % & Velocity Bins)"
            subtitle="Calm hours (≤0.5 m/s) excluded from directional sectors per CBE Clima WMO standard"
            icon={<Wind className="w-4 h-4 text-sky-600" />}
            svgFilename={`${climate.id}_wind_rose_${windMode}.svg`}
            csvFilename={`${climate.id}_wind_rose_${windMode}.csv`}
            onBuildCsv={() => ({
              headers: ['Sector', 'Azimuth_deg', '<2m/s_%', '2-4m/s_%', '4-6m/s_%', '6-9m/s_%', '>9m/s_%', 'Total_%', 'AvgSpeed_m/s', 'AvgTemp_C'],
              rows: windStats.sectors.map((s) => [
                s.dir,
                s.deg,
                s.b0_2Pct,
                s.b2_4Pct,
                s.b4_6Pct,
                s.b6_9Pct,
                s.b9PlusPct,
                s.totalPct,
                s.avgSpeed,
                s.avgTemp
              ])
            })}
            controls={
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {(
                    [
                      { id: 'annual', label: 'Annual (8,760h)' },
                      { id: 'winter', label: 'Winter (Dec–Feb)' },
                      { id: 'spring', label: 'Spring (Mar–May)' },
                      { id: 'summer', label: 'Summer (Jun–Aug)' },
                      { id: 'autumn', label: 'Autumn (Sep–Nov)' },
                      { id: 'morning', label: 'Morning (06–13h)' },
                      { id: 'afternoon', label: 'Afternoon (14–21h)' },
                      { id: 'night', label: 'Night (22–05h)' },
                      { id: 'custom', label: 'Custom Slice' }
                    ] as Array<{ id: WindFilterMode; label: string }>
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setWindMode(m.id)}
                      className={`px-2 py-1 rounded-lg font-bold border transition ${
                        windMode === m.id
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {windMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 bg-sky-50/70 p-2.5 rounded-xl border border-sky-200 text-[11px]">
                    <div>
                      <span className="font-bold text-slate-700 block">
                        Months: {MONTHS[monthStart - 1]} ({monthStart}) – {MONTHS[monthEnd - 1]} ({monthEnd})
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={monthStart}
                          onChange={(e) => setMonthStart(Number(e.target.value))}
                          className="w-full accent-sky-600"
                        />
                        <input
                          type="range"
                          min={1}
                          max={12}
                          value={monthEnd}
                          onChange={(e) => setMonthEnd(Number(e.target.value))}
                          className="w-full accent-sky-600"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block">
                        Hours: {String(hourStart).padStart(2, '0')}:00 – {String(hourEnd).padStart(2, '0')}:00
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="range"
                          min={0}
                          max={23}
                          value={hourStart}
                          onChange={(e) => setHourStart(Number(e.target.value))}
                          className="w-full accent-sky-600"
                        />
                        <input
                          type="range"
                          min={0}
                          max={23}
                          value={hourEnd}
                          onChange={(e) => setHourEnd(Number(e.target.value))}
                          className="w-full accent-sky-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }
            footer={
              <div className="flex flex-wrap items-center justify-between text-[11px] bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span>
                  Sampled Hours: <strong>{windStats.filteredCount.toLocaleString()} h</strong>
                </span>
                <span>
                  Mean Speed: <strong className="text-sky-700">{windStats.meanSpeed} m/s</strong>
                </span>
                <span>
                  Prevailing: <strong className="text-teal-700">{windStats.prevailingDir}</strong>
                </span>
                <span>
                  Calm (≤0.5 m/s): <strong>{windStats.calmHoursPct}%</strong>
                </span>
              </div>
            }
          >
            {(svgRef, tooltipCtx) => {
              const size = 440;
              const cx = size / 2;
              const cy = size / 2;
              const R = 170;
              const maxPct = Math.max(12, ...windStats.sectors.map((s) => s.totalPct));

              const wedgePath = (deg: number, rInner: number, rOuter: number) => {
                const halfSpan = 9.5;
                const a1 = ((deg - halfSpan - 90) * Math.PI) / 180;
                const a2 = ((deg + halfSpan - 90) * Math.PI) / 180;
                const x1 = cx + rInner * Math.cos(a1);
                const y1 = cy + rInner * Math.sin(a1);
                const x2 = cx + rOuter * Math.cos(a1);
                const y2 = cy + rOuter * Math.sin(a1);
                const x3 = cx + rOuter * Math.cos(a2);
                const y3 = cy + rOuter * Math.sin(a2);
                const x4 = cx + rInner * Math.cos(a2);
                const y4 = cy + rInner * Math.sin(a2);
                return `M ${x1} ${y1} L ${x2} ${y2} A ${rOuter} ${rOuter} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${rInner} ${rInner} 0 0 0 ${x1} ${y1} Z`;
              };

              return (
                <div className="flex flex-col items-center">
                  <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[460px] h-auto cursor-pointer">
                    {[0.25, 0.5, 0.75, 1].map((f, i) => (
                      <g key={i}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={R * f}
                          fill="none"
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                        />
                        <text x={cx + 4} y={cy - R * f + 9} fontSize="9" fontWeight="600" fill="#64748b">
                          {+(maxPct * f).toFixed(1)}%
                        </text>
                      </g>
                    ))}

                    {windStats.sectors.map((s) => {
                      const r1 = (s.b0_2Pct / maxPct) * R;
                      const r2 = ((s.b0_2Pct + s.b2_4Pct) / maxPct) * R;
                      const r3 = ((s.b0_2Pct + s.b2_4Pct + s.b4_6Pct) / maxPct) * R;
                      const r4 = ((s.b0_2Pct + s.b2_4Pct + s.b4_6Pct + s.b6_9Pct) / maxPct) * R;
                      const r5 = (s.totalPct / maxPct) * R;

                      const labelRad = ((s.deg - 90) * Math.PI) / 180;
                      const lx = cx + (R + 24) * Math.cos(labelRad);
                      const ly = cy + (R + 24) * Math.sin(labelRad);

                      const onSectorEnter = (e: React.MouseEvent<SVGElement>) => {
                        tooltipCtx.show(e, `Wind Sector: ${s.dir} (${s.deg}°)`, [
                          { label: 'Total Frequency', value: `${s.totalPct}% (${Math.round((s.totalPct / 100) * windStats.filteredCount)} hrs)` },
                          { label: '0.5–2 m/s', value: `${s.b0_2Pct}%`, color: '#bae6fd' },
                          { label: '2–4 m/s', value: `${s.b2_4Pct}%`, color: '#38bdf8' },
                          { label: '4–6 m/s', value: `${s.b4_6Pct}%`, color: '#0284c7' },
                          { label: '6–9 m/s', value: `${s.b6_9Pct}%`, color: '#f59e0b' },
                          { label: '>9 m/s', value: `${s.b9PlusPct}%`, color: '#e11d48' },
                          { label: 'Mean Velocity', value: `${s.avgSpeed} m/s` },
                          { label: 'Sector Mean Temp', value: `${s.avgTemp}°C` }
                        ]);
                      };

                      return (
                        <g
                          key={s.dir}
                          onMouseEnter={onSectorEnter}
                          onMouseMove={tooltipCtx.move}
                          onMouseLeave={tooltipCtx.hide}
                          className="transition hover:opacity-90"
                        >
                          {r1 > 0 && <path d={wedgePath(s.deg, 0, r1)} fill="#bae6fd" />}
                          {r2 > r1 && <path d={wedgePath(s.deg, r1, r2)} fill="#38bdf8" />}
                          {r3 > r2 && <path d={wedgePath(s.deg, r2, r3)} fill="#0284c7" />}
                          {r4 > r3 && <path d={wedgePath(s.deg, r3, r4)} fill="#f59e0b" />}
                          {r5 > r4 && <path d={wedgePath(s.deg, r4, r5)} fill="#e11d48" />}
                          <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#1e293b">
                            {s.dir}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className="flex flex-wrap items-center justify-center gap-3.5 text-[10.5px] mt-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-sky-200 inline-block shadow-sm" /> 0.5–2 m/s
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-sky-400 inline-block shadow-sm" /> 2–4 m/s
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block shadow-sm" /> 4–6 m/s
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block shadow-sm" /> 6–9 m/s
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-rose-600 inline-block shadow-sm" /> &gt;9 m/s
                    </span>
                  </div>
                </div>
              );
            }}
          </ClimaChartCard>
        </div>

        {/* Monthly Wind Speed Profile & Directional Summary Table (6 cols) */}
        <div className="xl:col-span-6">
          <ClimaChartCard
            title="Monthly Wind Speed Profile & 16-Sector Breakdown"
            subtitle="Monthly average wind velocity (m/s) and directional sector temperature averages"
            icon={<Compass className="w-4 h-4 text-teal-600" />}
            svgFilename={`${climate.id}_monthly_wind.svg`}
            csvFilename={`${climate.id}_monthly_wind.csv`}
            onBuildCsv={() => ({
              headers: ['Month', 'MeanWindSpeed_m/s'],
              rows: MONTHS.map((m, i) => [m, climate.monthlyWind[i]])
            })}
          >
            {(svgRef, tooltipCtx) => {
              const W = 520;
              const H = 200;
              const padL = 38;
              const padR = 16;
              const padT = 16;
              const padB = 28;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const vMax = globalValueRanges ? 12 : Math.max(6, ...climate.monthlyWind) * 1.25;
              const yForV = (v: number) => padT + plotH - (Math.min(vMax, Math.max(0, v)) / vMax) * plotH;
              const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

              return (
                <div className="space-y-3">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
                      const val = +(vMax * f).toFixed(1);
                      const y = yForV(val);
                      return (
                        <g key={idx}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                          <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {climate.monthlyWind.map((v, i) => {
                      const x = xForM(i);
                      const y = yForV(v);
                      return (
                        <g
                          key={MONTHS[i]}
                          className="cursor-pointer transition hover:opacity-85"
                          onMouseEnter={(e) => {
                            tooltipCtx.show(e, `${MONTHS[i]} Mean Wind Speed`, [
                              { label: 'Mean Velocity', value: `${v} m/s`, color: '#0284c7' }
                            ]);
                          }}
                          onMouseMove={tooltipCtx.move}
                          onMouseLeave={tooltipCtx.hide}
                        >
                          <rect
                            x={x - 12}
                            y={y}
                            width={24}
                            height={Math.max(2, padT + plotH - y)}
                            rx={4}
                            fill="#0284c7"
                            fillOpacity={0.85}
                          />
                          <text x={x} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0369a1">
                            {v}
                          </text>
                          <text x={x} y={H - 8} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569">
                            {MONTHS[i]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    {windStats.sectors.map((s) => (
                      <div
                        key={s.dir}
                        className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition"
                      >
                        <span className="font-bold text-slate-800">{s.dir}: {s.totalPct}%</span>
                        <span className="text-slate-500 text-[9.5px]">{s.avgSpeed}m/s • {s.avgTemp}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }}
          </ClimaChartCard>
        </div>
      </div>

      {/* 24h x 365d Wind Speed & Wind Direction Heatmaps */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ClimaChartCard
          title="24h × 365d Wind Speed Timetable Heatmap (m/s)"
          subtitle="Hourly wind velocity carpet plot revealing diurnal sea/mountain breeze cycles"
          icon={<Wind className="w-4 h-4 text-teal-600" />}
          svgFilename={`${climate.id}_wind_speed_carpet.svg`}
          csvFilename={`${climate.id}_wind_speed_8760.csv`}
          onBuildCsv={() => ({
            headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'WindSpeed_m/s', 'WindDir_deg'],
            rows: climate.hourly.map((h) => [h.hourOfYear, h.month + 1, h.dayOfMonth, h.hour, h.windSpeed, h.windDir])
          })}
        >
          {(svgRef, tooltipCtx) => (
            <CarpetHeatmap24x365
              svgRef={svgRef}
              tooltipCtx={tooltipCtx}
              hourly={climate.hourly}
              getValue={(h) => h.windSpeed}
              getColor={(v) => colorForWindSpeed(v, globalValueRanges)}
              unitLabel="m/s"
              legendItems={[
                { label: '<2 m/s', color: '#0f172a' },
                { label: '2–4 m/s', color: '#0369a1' },
                { label: '4–6 m/s', color: '#0d9488' },
                { label: '6–8 m/s', color: '#f59e0b' },
                { label: '>8 m/s', color: '#f43f5e' }
              ]}
            />
          )}
        </ClimaChartCard>

        <ClimaChartCard
          title="24h × 365d Wind Direction Timetable Heatmap (deg)"
          subtitle="Hourly cardinal wind origin (North, East, South, West)"
          icon={<Compass className="w-4 h-4 text-indigo-600" />}
          svgFilename={`${climate.id}_wind_dir_carpet.svg`}
          csvFilename={`${climate.id}_wind_dir_8760.csv`}
          onBuildCsv={() => ({
            headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'WindDir_deg'],
            rows: climate.hourly.map((h) => [h.hourOfYear, h.month + 1, h.dayOfMonth, h.hour, h.windDir])
          })}
        >
          {(svgRef, tooltipCtx) => (
            <CarpetHeatmap24x365
              svgRef={svgRef}
              tooltipCtx={tooltipCtx}
              hourly={climate.hourly}
              getValue={(h) => h.windDir}
              getColor={(deg) => colorForWindDir(deg)}
              unitLabel="Azimuth°"
              legendItems={[
                { label: 'North (315°–45°)', color: '#38bdf8' },
                { label: 'East (45°–135°)', color: '#a78bfa' },
                { label: 'South (135°–225°)', color: '#f59e0b' },
                { label: 'West (225°–315°)', color: '#10b981' }
              ]}
            />
          )}
        </ClimaChartCard>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-TAB 6: PSYCHROMETRIC CHART & CLIMATE CONSULTANT 6 POLYGONS (IMPROVEMENT #3)
// ============================================================================
export const SubTab6Psychrometric: React.FC<{
  climate: ClimateDataset;
  comfortLower: number;
  comfortUpper: number;
  activeStrategies: string[];
  toggleStrategy: (id: string) => void;
  setActiveStrategiesList: (ids: string[]) => void;
  strategyMods: { heatingMult: number; coolingMult: number; tauBonusHours: number };
}> = ({
  climate,
  comfortLower,
  comfortUpper,
  activeStrategies,
  toggleStrategy,
  setActiveStrategiesList,
  strategyMods
}) => {
  const [colorBy, setColorBy] = useState<'frequency' | 'ghi' | 'utci'>('frequency');
  const [enabledPolygons, setEnabledPolygons] = useState<Record<BioclimaticPolygonId, boolean>>({
    comfort: true,
    passive_solar: true,
    natural_vent: true,
    thermal_mass_night_purge: true,
    evaporative_cooling: false,
    active_hvac: false
  });

  const polygons = useMemo(
    () => getBioclimaticPolygons(comfortLower, comfortUpper),
    [comfortLower, comfortUpper]
  );

  const evalStats = useMemo(
    () => evaluatePsychrometricPolygons(climate.hourly, comfortLower, comfortUpper, enabledPolygons),
    [climate.hourly, comfortLower, comfortUpper, enabledPolygons]
  );

  const togglePolygon = (id: BioclimaticPolygonId) => {
    setEnabledPolygons((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const syncPolygonsToStages = () => {
    const ids: string[] = [];
    for (const p of polygons) {
      if (enabledPolygons[p.id]) {
        ids.push(...p.linkedStrategyIds);
      }
    }
    if (ids.length > 0) {
      setActiveStrategiesList(ids);
    }
  };

  const rankedStrategies = useMemo(
    () =>
      [...CLIMATE_SCOUT_STRATEGIES]
        .map((s) => ({ ...s, relevance: scoreStrategyRelevance(s, climate) }))
        .sort((a, b) => b.relevance - a.relevance),
    [climate]
  );

  return (
    <div className="space-y-5">
      {/* Live KPI Bar showing % of annual comfortable hours achieved */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-2xl p-4 border border-teal-700/60 shadow flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-teal-300 block">
            Improvement #3 • Climate Consultant 6.0 Bioclimatic Envelope KPI
          </span>
          <h4 className="text-base font-bold mt-0.5">
            Passive Comfort Coverage: <span className="text-emerald-300">{evalStats.totalPassiveComfortPct}% of Year</span> ({evalStats.totalPassiveComfortHours.toLocaleString()} / 8,760 hrs)
          </h4>
          <p className="text-xs text-slate-300">
            Base Comfort Only: {evalStats.polygonSharesPct.comfort}% → Expanded by Passive Polygons to {evalStats.totalPassiveComfortPct}% (Remaining Active HVAC Required: {evalStats.activeHvacRequiredPct}%)
          </p>
        </div>

        <button
          type="button"
          onClick={syncPolygonsToStages}
          className="px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow transition"
        >
          <Sparkles className="w-4 h-4" />
          Sync Active Polygons to Stages 3–5
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Interactive Psychrometric Chart (7 cols) */}
        <div className="xl:col-span-7">
          <ClimaChartCard
            title="Interactive Psychrometric Chart (Dry-Bulb °C vs. Humidity Ratio g_w/kg_da)"
            subtitle="8,760h 2D frequency binning (ΔT = 1°C × ΔW = 0.5 g/kg), curved constant-RH lines & saturation-clipped polygons"
            icon={<Compass className="w-4 h-4 text-teal-600" />}
            svgFilename={`${climate.id}_psychrometric_chart.svg`}
            csvFilename={`${climate.id}_psychrometric_summary.csv`}
            onBuildCsv={() => ({
              headers: ['BioclimaticZone', 'Enabled', 'AnnualHoursShare_%'],
              rows: polygons.map((p) => [p.name, enabledPolygons[p.id] ? 'YES' : 'NO', evalStats.polygonSharesPct[p.id]])
            })}
            controls={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Color 8,760h Points By:</span>
                  {(
                    [
                      { id: 'frequency', label: '2D Frequency Bin (hrs)' },
                      { id: 'ghi', label: 'Global Solar (GHI Wh/m²)' },
                      { id: 'utci', label: 'UTCI Thermal Stress (°C)' }
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setColorBy(mode.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${
                        colorBy === mode.id
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {(svgRef, tooltipCtx) => {
              const W = 800;
              const H = 440;
              const padL = 42;
              const padR = 48;
              const padT = 20;
              const padB = 34;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;

              const tMin = -10;
              const tMax = 45;
              const wMax = 26;
              const meanPressurePa = climate.hourly[0]?.pressurePa ?? 101325;
              const xForT = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * plotW;
              const yForW = (w: number) => padT + plotH - (Math.min(wMax, Math.max(0, w)) / wMax) * plotH;

              const buildRhCurve = (rh: number) => {
                const pts: string[] = [];
                for (let t = tMin; t <= tMax; t += 1.0) {
                  const w = calcHumidityRatio(t, rh, meanPressurePa);
                  if (w <= wMax) {
                    pts.push(`${xForT(t).toFixed(1)},${yForW(w).toFixed(1)}`);
                  }
                }
                return pts.join(' ');
              };

              // Build 2D frequency bins (ΔT = 1°C, ΔW = 0.5 g/kg) matching CBE Clima Psychrometric histogram2d
              const freqBins: Array<{ tBin: number; wBin: number; count: number }> = [];
              let maxBinCount = 1;
              if (colorBy === 'frequency') {
                const binMap = new Map<string, { tBin: number; wBin: number; count: number }>();
                for (const h of climate.hourly) {
                  const tBin = Math.floor(Math.max(tMin, Math.min(tMax - 1, h.dryBulb)));
                  const wBin = Math.floor(Math.max(0, Math.min(wMax - 0.5, h.humRatio)) * 2) / 2;
                  const key = `${tBin}_${wBin}`;
                  const existing = binMap.get(key);
                  if (existing) {
                    existing.count++;
                    if (existing.count > maxBinCount) maxBinCount = existing.count;
                  } else {
                    binMap.set(key, { tBin, wBin, count: 1 });
                  }
                }
                freqBins.push(...binMap.values());
              }

              // Sample every 2nd hour (4,380 points) when coloring by GHI or UTCI
              const sampled = colorBy === 'frequency' ? [] : climate.hourly.filter((_, idx) => idx % 2 === 0);

              return (
                <div className="space-y-1.5">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
                    {/* Vertical Dry-Bulb Grid */}
                    {[-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45].map((t) => (
                      <g key={t}>
                        <line x1={xForT(t)} y1={padT} x2={xForT(t)} y2={H - padB} stroke="#e2e8f0" strokeWidth={0.8} />
                        <text x={xForT(t)} y={H - 12} textAnchor="middle" fontSize="9.5" fill="#475569" fontWeight="600">
                          {t}°C
                        </text>
                      </g>
                    ))}

                    {/* Horizontal Humidity Ratio Grid (Right Y-Axis) */}
                    {[0, 4, 8, 12, 16, 20, 24].map((w) => (
                      <g key={w}>
                        <line x1={padL} y1={yForW(w)} x2={W - padR} y2={yForW(w)} stroke="#e2e8f0" strokeWidth={0.8} />
                        <text x={W - padR + 6} y={yForW(w) + 3.5} fontSize="9.5" fill="#475569" fontWeight="600">
                          {w} g/kg
                        </text>
                      </g>
                    ))}

                    {/* Constant Relative Humidity Curves (20%, 40%, 60%, 80%, 100%) */}
                    {[20, 40, 60, 80, 100].map((rh) => (
                      <polyline
                        key={rh}
                        fill="none"
                        stroke={rh === 100 ? '#0284c7' : '#94a3b8'}
                        strokeWidth={rh === 100 ? 2 : 1}
                        strokeDasharray={rh === 100 ? undefined : '3 3'}
                        points={buildRhCurve(rh)}
                      />
                    ))}

                    {/* 2D Frequency Bin Heatmap (CBE Clima Default Mode) */}
                    {colorBy === 'frequency' &&
                      freqBins.map((b, idx) => {
                        const cellW = plotW / (tMax - tMin);
                        const cellH = (0.5 / wMax) * plotH;
                        const x = xForT(b.tBin);
                        const y = yForW(b.wBin + 0.5);
                        const norm = Math.sqrt(b.count / maxBinCount);
                        const fill = interpolatePalette(YLORRD_WIND_STOPS, norm);
                        return (
                          <rect
                            key={idx}
                            x={x}
                            y={y}
                            width={cellW + 0.45}
                            height={cellH + 0.45}
                            fill={fill}
                            fillOpacity={0.85}
                            className="cursor-pointer transition hover:opacity-100"
                            onMouseEnter={(e) => {
                              tooltipCtx.show(e, `Psychrometric Density Bin`, [
                                { label: 'Dry-Bulb Temp', value: `${b.tBin}°C to ${b.tBin + 1}°C` },
                                { label: 'Humidity Ratio', value: `${b.wBin.toFixed(1)} to ${(b.wBin + 0.5).toFixed(1)} g/kg` },
                                { label: 'Annual Hours in Bin', value: `${b.count} hrs (${((b.count / 8760) * 100).toFixed(1)}%)`, color: fill }
                              ]);
                            }}
                            onMouseMove={tooltipCtx.move}
                            onMouseLeave={tooltipCtx.hide}
                          />
                        );
                      })}

                    {/* Hourly Cloud Points (GHI / UTCI Mode) */}
                    {sampled.map((h, i) => {
                      let fill = '#3b82f6';
                      if (colorBy === 'ghi') {
                        fill =
                          h.ghi > 600
                            ? '#e11d48'
                            : h.ghi > 300
                            ? '#f59e0b'
                            : h.ghi > 50
                            ? '#10b981'
                            : '#3b82f6';
                      } else if (colorBy === 'utci') {
                        fill =
                          h.utci > 32
                            ? '#e11d48'
                            : h.utci > 26
                            ? '#f59e0b'
                            : h.utci >= 9
                            ? '#10b981'
                            : '#0284c7';
                      }
                      return (
                        <circle
                          key={i}
                          cx={xForT(h.dryBulb)}
                          cy={yForW(h.humRatio)}
                          r={2.2}
                          fill={fill}
                          fillOpacity={0.55}
                          className="cursor-pointer"
                          onMouseEnter={(e) => {
                            tooltipCtx.show(e, `Hour ${h.hour}:00 (Day ${h.dayOfYear})`, [
                              { label: 'Dry-Bulb Temp', value: `${h.dryBulb}°C` },
                              { label: 'Relative Humidity', value: `${h.relHum}%` },
                              { label: 'Humidity Ratio', value: `${h.humRatio} g/kg` },
                              { label: 'GHI', value: `${h.ghi} W/m²` },
                              { label: 'UTCI', value: `${h.utci}°C` }
                            ]);
                          }}
                          onMouseMove={tooltipCtx.move}
                          onMouseLeave={tooltipCtx.hide}
                        />
                      );
                    })}

                    {/* Overlay Enabled Bioclimatic Strategy Polygons (Clipped to 100% RH Saturation Curve) */}
                    {polygons.map((poly) => {
                      if (!enabledPolygons[poly.id]) return null;
                      const clippedPts = poly.points.map(([t, w]) => {
                        const wSat = calcHumidityRatio(t, 100, meanPressurePa);
                        return [t, Math.min(w, wSat)] as [number, number];
                      });
                      const pts = clippedPts.map(([t, w]) => `${xForT(t).toFixed(1)},${yForW(w).toFixed(1)}`).join(' ');
                      const cx = clippedPts.reduce((s, p) => s + xForT(p[0]), 0) / clippedPts.length;
                      const cy = clippedPts.reduce((s, p) => s + yForW(p[1]), 0) / clippedPts.length;
                      const pct = evalStats.polygonSharesPct[poly.id];
                      return (
                        <g
                          key={poly.id}
                          className="cursor-pointer transition hover:opacity-90"
                          onMouseEnter={(e) => {
                            tooltipCtx.show(e, `Strategy Envelope: ${poly.name}`, [
                              { label: 'Annual Comfort Share', value: `${pct}% of year`, color: poly.color },
                              { label: 'Bioclimatic Zone', value: poly.shortName },
                              { label: 'Scope', value: poly.description }
                            ]);
                          }}
                          onMouseMove={tooltipCtx.move}
                          onMouseLeave={tooltipCtx.hide}
                        >
                          <polygon
                            points={pts}
                            fill={poly.fillColor}
                            stroke={poly.color}
                            strokeWidth={2.4}
                          />
                          <text
                            x={cx}
                            y={cy}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="800"
                            fill={poly.color}
                          >
                            {poly.shortName}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="flex flex-wrap items-center justify-between text-[10.5px] text-slate-600 px-1">
                    <span>
                      Station Pressure: <strong>{Math.round(meanPressurePa)} Pa</strong> • Saturation Curve: <strong className="text-sky-600">100% RH</strong>
                    </span>
                    {colorBy === 'frequency' && (
                      <span>
                        Max Bin Density: <strong className="text-rose-600">{maxBinCount} hrs / bin</strong> (ΔT=1°C × ΔW=0.5 g/kg • Hover to inspect)
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          </ClimaChartCard>
        </div>

        {/* 6 Bioclimatic Polygons Checkboxes (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-teal-600" />
            Climate Consultant 6.0 Strategy Polygons
          </h3>
          <p className="text-[11px] text-slate-500">
            Toggle bioclimatic zones to inspect their psychrometric boundaries and annual hour capture
          </p>

          <div className="space-y-2">
            {polygons.map((poly) => {
              const checked = enabledPolygons[poly.id];
              const pct = evalStats.polygonSharesPct[poly.id];
              return (
                <label
                  key={poly.id}
                  onClick={() => togglePolygon(poly.id)}
                  className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 cursor-pointer transition ${
                    checked ? 'bg-slate-50 border-slate-300 shadow-sm' : 'bg-white border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 accent-teal-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: poly.color }} />
                        {poly.name}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{poly.description}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 shrink-0">
                    {pct}%
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* ClimateScout Strategy Selector Cards Coupled to Stages 2-6 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600" />
              ClimateScout Passive Design Strategy Cards (Coupled to Stages 2–6)
            </h3>
            <p className="text-[11px] text-slate-500">
              Ranked by bioclimatic relevance to <strong>{climate.name} ({climate.koppen})</strong>. Toggling updates downstream BEM modifiers.
            </p>
          </div>
          <div className="text-[11px] bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg font-semibold">
            Active Modifiers: Heat ×{strategyMods.heatingMult} • Cool ×{strategyMods.coolingMult} • +{strategyMods.tauBonusHours}h τ
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {rankedStrategies.map((st) => {
            const isSelected = activeStrategies.includes(st.id);
            return (
              <div
                key={st.id}
                onClick={() => toggleStrategy(st.id)}
                className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected ? 'bg-teal-50/70 border-teal-500 shadow-sm' : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                      {st.category}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {st.relevance}% Match
                      </span>
                      <CheckCircle2 className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-slate-300'}`} />
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 mt-1.5">{st.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{st.shortDesc}</p>
                </div>
                <div className="text-[10px] font-semibold text-teal-800 bg-white px-2 py-1 rounded border border-teal-200/60">
                  {st.engineeringImpact}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-TAB 7: NATURAL VENTILATION POTENTIAL
// ============================================================================
export const SubTab7NatVent: React.FC<{
  climate: ClimateDataset;
}> = ({ climate }) => {
  const [minTempC, setMinTempC] = useState(12);
  const [maxTempC, setMaxTempC] = useState(26);
  const [maxDewPointC, setMaxDewPointC] = useState(17);
  const [maxWindMs, setMaxWindMs] = useState(8);

  const nvStats = useMemo(
    () => calcNaturalVentilationPotential(climate.hourly, minTempC, maxTempC, maxDewPointC, maxWindMs),
    [climate.hourly, minTempC, maxTempC, maxDewPointC, maxWindMs]
  );

  return (
    <div className="space-y-5">
      {/* Filter Controls Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        <div>
          <span className="text-[10px] font-bold uppercase text-teal-700 block">Annual NatVent Potential</span>
          <span className="text-2xl font-extrabold text-slate-900">{nvStats.annualSuitablePct}%</span>
          <span className="text-[11px] text-slate-500 block">
            {nvStats.annualSuitableHours.toLocaleString()} / 8,760 hrs suitable
          </span>
        </div>

        <label className="text-xs">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Min Outdoor T_db</span>
            <span className="text-sky-700 font-bold">{minTempC}°C</span>
          </div>
          <input
            type="range"
            min={8}
            max={18}
            step={1}
            value={minTempC}
            onChange={(e) => setMinTempC(Number(e.target.value))}
            className="w-full accent-sky-600 mt-1"
          />
        </label>

        <label className="text-xs">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Max Outdoor T_db</span>
            <span className="text-rose-700 font-bold">{maxTempC}°C</span>
          </div>
          <input
            type="range"
            min={22}
            max={30}
            step={1}
            value={maxTempC}
            onChange={(e) => setMaxTempC(Number(e.target.value))}
            className="w-full accent-rose-600 mt-1"
          />
        </label>

        <label className="text-xs">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Max Dew-Point T_dp</span>
            <span className="text-teal-700 font-bold">{maxDewPointC}°C</span>
          </div>
          <input
            type="range"
            min={13}
            max={22}
            step={1}
            value={maxDewPointC}
            onChange={(e) => setMaxDewPointC(Number(e.target.value))}
            className="w-full accent-teal-600 mt-1"
          />
        </label>

        <label className="text-xs">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Max Wind Threshold</span>
            <span className="text-indigo-700 font-bold">{maxWindMs} m/s</span>
          </div>
          <input
            type="range"
            min={4}
            max={15}
            step={1}
            value={maxWindMs}
            onChange={(e) => setMaxWindMs(Number(e.target.value))}
            className="w-full accent-indigo-600 mt-1"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Monthly NatVent Stacked Bar Chart (5 cols) */}
        <div className="xl:col-span-5">
          <ClimaChartCard
            title="Monthly Natural Ventilation Suitability (%)"
            subtitle="Share of monthly hours suitable for window / night-flush cooling vs. too cold, too humid, or too hot"
            icon={<Wind className="w-4 h-4 text-emerald-600" />}
            svgFilename={`${climate.id}_monthly_natvent.svg`}
            csvFilename={`${climate.id}_monthly_natvent.csv`}
            onBuildCsv={() => ({
              headers: ['Month', 'Suitable_%', 'TooCold_%', 'TooHumid_%', 'TooHot_%'],
              rows: MONTHS.map((m, i) => [
                m,
                nvStats.monthlySuitablePct[i],
                nvStats.monthlyTooColdPct[i],
                nvStats.monthlyTooHumidPct[i],
                nvStats.monthlyTooHotPct[i]
              ])
            })}
          >
            {(svgRef, tooltipCtx) => {
              const W = 620;
              const H = 260;
              const padL = 40;
              const padR = 18;
              const padT = 20;
              const padB = 30;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

              return (
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = padT + plotH - (pct / 100) * plotH;
                    return (
                      <g key={pct}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {MONTHS.map((m, i) => {
                    const suit = nvStats.monthlySuitablePct[i];
                    const hSuit = (suit / 100) * plotH;
                    const x = xForM(i);
                    return (
                      <g
                        key={m}
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          tooltipCtx.show(e, `${m} Natural Ventilation`, [
                            { label: 'Suitable Window Hours', value: `${suit}%`, color: '#10b981' },
                            { label: 'Too Cold (<' + minTempC + '°C)', value: `${nvStats.monthlyTooColdPct[i]}%`, color: '#0284c7' },
                            { label: 'Too Humid (T_dp >' + maxDewPointC + '°C)', value: `${nvStats.monthlyTooHumidPct[i]}%`, color: '#8b5cf6' },
                            { label: 'Too Hot (>' + maxTempC + '°C)', value: `${nvStats.monthlyTooHotPct[i]}%`, color: '#e11d48' }
                          ]);
                        }}
                        onMouseMove={(e) => tooltipCtx.move(e)}
                        onMouseLeave={() => tooltipCtx.hide()}
                      >
                        <rect
                          x={x - 14}
                          y={padT + plotH - hSuit}
                          width={28}
                          height={Math.max(2, hSuit)}
                          rx={4}
                          fill="#10b981"
                          className="hover:opacity-90 transition"
                        />
                        <text
                          x={x}
                          y={padT + plotH - hSuit - 5}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#047857"
                        >
                          {suit}%
                        </text>
                        <text x={x} y={H - 8} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569">
                          {m}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            }}
          </ClimaChartCard>
        </div>

        {/* 24h x 365d Natural Ventilation Carpet Heatmap (7 cols) */}
        <div className="xl:col-span-7">
          <ClimaChartCard
            title="24h × 365d Natural Ventilation Regime Carpet Heatmap"
            subtitle={`Green = Suitable (${minTempC}–${maxTempC}°C, T_dp ≤ ${maxDewPointC}°C) • Blue = Too Cold • Purple = Muggy/Dew-Point > ${maxDewPointC}°C • Red = Too Hot`}
            icon={<Wind className="w-4 h-4 text-teal-600" />}
            svgFilename={`${climate.id}_natvent_carpet.svg`}
            csvFilename={`${climate.id}_natvent_8760.csv`}
            onBuildCsv={() => ({
              headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'T_db', 'T_dp', 'Wind_m/s', 'Status'],
              rows: climate.hourly.map((h, i) => [
                h.hourOfYear,
                h.month + 1,
                h.dayOfMonth,
                h.hour,
                h.dryBulb,
                h.dewPoint ?? calcDewPointC(h.dryBulb, h.relHum),
                h.windSpeed,
                nvStats.hourlyStates[i]
              ])
            })}
          >
            {(svgRef, tooltipCtx) => (
              <CarpetHeatmap24x365
                svgRef={svgRef}
                tooltipCtx={tooltipCtx}
                hourly={climate.hourly}
                getValue={(_, idx) => {
                  const st = nvStats.hourlyStates[idx];
                  if (st === 'suitable') return 1;
                  if (st === 'too_cold') return 0;
                  if (st === 'too_humid') return 2;
                  if (st === 'too_windy') return 3;
                  return 4;
                }}
                getColor={(code) => {
                  if (code === 1) return '#10b981';
                  if (code === 0) return '#0284c7';
                  if (code === 2) return '#8b5cf6';
                  if (code === 3) return '#f59e0b';
                  return '#e11d48';
                }}
                unitLabel="NatVent Regime"
                legendItems={[
                  { label: `Suitable (${nvStats.annualSuitablePct}%)`, color: '#10b981' },
                  { label: `Too Cold (${nvStats.tooColdPct}%)`, color: '#0284c7' },
                  { label: `Dew-Point >${maxDewPointC}°C (${nvStats.tooHumidPct}%)`, color: '#8b5cf6' },
                  { label: `Too Windy (${nvStats.tooWindyPct}%)`, color: '#f59e0b' },
                  { label: `Too Hot (${nvStats.tooHotPct}%)`, color: '#e11d48' }
                ]}
              />
            )}
          </ClimaChartCard>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-TAB 8: OUTDOOR COMFORT (UTCI 4-SCENARIO SWITCHER + 10-BAND STRESS)
// ============================================================================
export const SubTab8Utci: React.FC<{
  climate: ClimateDataset;
}> = ({ climate }) => {
  const [scenario, setScenario] = useState<UtciScenarioId>('sun_wind');

  const utciData = useMemo(
    () => calcUtciScenarioDataset(climate.hourly, scenario),
    [climate.hourly, scenario]
  );

  return (
    <div className="space-y-5">
      {/* 4-Scenario Switcher Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Universal Thermal Climate Index (UTCI) Microclimate Sheltering Switcher
          </h3>
          <p className="text-[11px] text-slate-500">
            Compare open plazas vs. shaded tree canopies, wind-sheltered courtyards, and semi-outdoor loggias
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              { id: 'sun_wind', label: '(a) Sun & Wind (Open Plaza)' },
              { id: 'nosun_wind', label: '(b) No Sun & Wind (Tree Canopy / Pergola)' },
              { id: 'sun_nowind', label: '(c) Sun & No Wind (Sunlit Courtyard)' },
              { id: 'nosun_nowind', label: '(d) No Sun & No Wind (Shaded Loggia)' }
            ] as Array<{ id: UtciScenarioId; label: string }>
          ).map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setScenario(sc.id)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition ${
                scenario === sc.id
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Continuous UTCI Temperature Heatmap + Discrete 10-Band UTCI Stress Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ClimaChartCard
          title="24h × 365d Continuous UTCI Equivalent Temperature Heatmap (°C)"
          subtitle={`Scenario: ${scenario.toUpperCase()} — No Thermal Stress (+9°C to +26°C): ${utciData.annualComfortPct}% of year`}
          icon={<Thermometer className="w-4 h-4 text-rose-500" />}
          svgFilename={`${climate.id}_utci_temp_${scenario}.svg`}
          csvFilename={`${climate.id}_utci_hourly_${scenario}.csv`}
          onBuildCsv={() => ({
            headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'UTCI_C'],
            rows: climate.hourly.map((h, i) => [h.hourOfYear, h.month + 1, h.dayOfMonth, h.hour, utciData.hourlyUtci[i]])
          })}
        >
          {(svgRef, tooltipCtx) => (
            <CarpetHeatmap24x365
              svgRef={svgRef}
              tooltipCtx={tooltipCtx}
              hourly={climate.hourly}
              getValue={(_, idx) => utciData.hourlyUtci[idx]}
              getColor={(v) => colorForTempC(v, false)}
              unitLabel="UTCI °C"
              legendItems={[
                { label: '<0°C Cold', color: '#1d4ed8' },
                { label: '0–9°C Cool', color: '#0ea5e9' },
                { label: '9–26°C Comfort', color: '#10b981' },
                { label: '26–32°C Warm', color: '#f59e0b' },
                { label: '>32°C Hot', color: '#e11d48' }
              ]}
            />
          )}
        </ClimaChartCard>

        <ClimaChartCard
          title="Discrete 10-Band UTCI Thermal Stress Classification Carpet"
          subtitle={`Cold Stress: ${utciData.annualColdStressPct}% • No Stress: ${utciData.annualComfortPct}% • Heat Stress: ${utciData.annualHeatStressPct}%`}
          icon={<Sun className="w-4 h-4 text-amber-500" />}
          svgFilename={`${climate.id}_utci_10band_${scenario}.svg`}
          csvFilename={`${climate.id}_utci_10band_${scenario}.csv`}
          onBuildCsv={() => ({
            headers: ['Month', ...UTCI_STRESS_BANDS.map((b) => b.shortLabel)],
            rows: MONTHS.map((m, i) => [
              m,
              ...UTCI_STRESS_BANDS.map((b) => utciData.monthlyBandShares[i][b.id])
            ])
          })}
        >
          {(svgRef, tooltipCtx) => (
            <CarpetHeatmap24x365
              svgRef={svgRef}
              tooltipCtx={tooltipCtx}
              hourly={climate.hourly}
              getValue={(_, idx) => utciData.hourlyUtci[idx]}
              getColor={(val) => {
                for (const b of UTCI_STRESS_BANDS) {
                  if (val >= b.minC && val < b.maxC) return b.color;
                }
                return '#10b981';
              }}
              unitLabel="10-Band UTCI"
              legendItems={UTCI_STRESS_BANDS.filter((_, i) => i >= 2 && i <= 8).map((b) => ({
                label: b.shortLabel,
                color: b.color
              }))}
            />
          )}
        </ClimaChartCard>
      </div>

      {/* Row 2: Monthly Stacked Bar Percentages of 10 UTCI Stress Categories */}
      <ClimaChartCard
        title="Monthly Stacked Distribution of 10 UTCI Thermal Stress Categories (%)"
        subtitle="Percentage of hours per month in each physiological thermal stress band"
        icon={<Sparkles className="w-4 h-4 text-teal-600" />}
        svgFilename={`${climate.id}_utci_monthly_bars_${scenario}.svg`}
        csvFilename={`${climate.id}_utci_monthly_bars_${scenario}.csv`}
        onBuildCsv={() => ({
          headers: ['Month', ...UTCI_STRESS_BANDS.map((b) => b.label)],
          rows: MONTHS.map((m, i) => [
            m,
            ...UTCI_STRESS_BANDS.map((b) => utciData.monthlyBandShares[i][b.id])
          ])
        })}
      >
        {(svgRef, tooltipCtx) => {
          const W = 860;
          const H = 260;
          const padL = 44;
          const padR = 20;
          const padT = 18;
          const padB = 30;
          const plotW = W - padL - padR;
          const plotH = H - padT - padB;
          const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

          return (
            <div className="space-y-2">
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                {[0, 25, 50, 75, 100].map((pct) => {
                  const y = padT + plotH - (pct / 100) * plotH;
                  return (
                    <g key={pct}>
                      <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                      <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {MONTHS.map((m, i) => {
                  const shares = utciData.monthlyBandShares[i];
                  let cumPct = 0;
                  const x = xForM(i);
                  return (
                    <g key={m}>
                      {UTCI_STRESS_BANDS.map((band) => {
                        const val = shares[band.id] || 0;
                        if (val <= 0) return null;
                        const hBar = (val / 100) * plotH;
                        const y = padT + plotH - ((cumPct + val) / 100) * plotH;
                        cumPct += val;
                        return (
                          <rect
                            key={band.id}
                            x={x - 18}
                            y={y}
                            width={36}
                            height={Math.max(0.5, hBar)}
                            fill={band.color}
                            className="cursor-pointer hover:opacity-90 transition"
                            onMouseEnter={(e) => {
                              tooltipCtx.show(e, `${m} — ${band.label}`, [
                                { label: 'Stress Category', value: band.label, color: band.color },
                                { label: 'Monthly Share', value: `${val}%`, color: band.color },
                                { label: 'Equivalent Temp Range', value: `${band.minC}°C to ${band.maxC}°C` },
                                { label: 'Shelter Scenario', value: scenario.toUpperCase() }
                              ]);
                            }}
                            onMouseMove={(e) => tooltipCtx.move(e)}
                            onMouseLeave={() => tooltipCtx.hide()}
                          />
                        );
                      })}
                      <text x={x} y={H - 8} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569">
                        {m}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px]">
                {UTCI_STRESS_BANDS.map((b) => (
                  <span key={b.id} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: b.color }} />
                    {b.shortLabel}
                  </span>
                ))}
              </div>
            </div>
          );
        }}
      </ClimaChartCard>
    </div>
  );
};

// ============================================================================
// SUB-TAB 9: DATA EXPLORER (CUSTOM X/Y/Z CORRELATION + MARGINAL HISTOGRAMS + 2D BIN HEATMAP)
// ============================================================================
type ExplorerVarId =
  | 'dryBulb'
  | 'dewPoint'
  | 'relHum'
  | 'humRatio'
  | 'ghi'
  | 'dni'
  | 'dhi'
  | 'windSpeed'
  | 'skyCover'
  | 'utci';

const EXPLORER_VARS: Array<{ id: ExplorerVarId; label: string; unit: string }> = [
  { id: 'dryBulb', label: 'Dry-Bulb Temp', unit: '°C' },
  { id: 'dewPoint', label: 'Dew-Point Temp', unit: '°C' },
  { id: 'relHum', label: 'Relative Humidity', unit: '%' },
  { id: 'humRatio', label: 'Humidity Ratio', unit: 'g/kg' },
  { id: 'ghi', label: 'Global Horiz. Solar (GHI)', unit: 'Wh/m²' },
  { id: 'dni', label: 'Direct Normal Solar (DNI)', unit: 'Wh/m²' },
  { id: 'dhi', label: 'Diffuse Horiz. Solar (DHI)', unit: 'Wh/m²' },
  { id: 'windSpeed', label: 'Wind Speed', unit: 'm/s' },
  { id: 'skyCover', label: 'Total Sky Cover', unit: 'tenths' },
  { id: 'utci', label: 'UTCI Outdoor Temp', unit: '°C' }
];

function extractVar(h: HourlyWeatherRecord, id: ExplorerVarId): number {
  if (id === 'dewPoint') return h.dewPoint ?? calcDewPointC(h.dryBulb, h.relHum);
  if (id === 'skyCover') return h.skyCover ?? 5;
  return Number(h[id] ?? 0);
}

export const SubTab9DataExplorer: React.FC<{
  climate: ClimateDataset;
}> = ({ climate }) => {
  const [xVar, setXVar] = useState<ExplorerVarId>('dryBulb');
  const [yVar, setYVar] = useState<ExplorerVarId>('relHum');
  const [zVar, setZVar] = useState<ExplorerVarId>('ghi');
  const [mStart, setMStart] = useState(1);
  const [mEnd, setMEnd] = useState(12);
  const [hStart, setHStart] = useState(0);
  const [hEnd, setHEnd] = useState(23);
  const [invertFilter, setInvertFilter] = useState(false);

  const filtered = useMemo(() => {
    return climate.hourly.filter((h) => {
      const m1 = h.month + 1;
      const inM = mStart <= mEnd ? m1 >= mStart && m1 <= mEnd : m1 >= mStart || m1 <= mEnd;
      const inH = hStart <= hEnd ? h.hour >= hStart && h.hour <= hEnd : h.hour >= hStart || h.hour <= hEnd;
      const match = inM && inH;
      return invertFilter ? !match : match;
    });
  }, [climate.hourly, mStart, mEnd, hStart, hEnd, invertFilter]);

  const xMeta = EXPLORER_VARS.find((v) => v.id === xVar)!;
  const yMeta = EXPLORER_VARS.find((v) => v.id === yVar)!;
  const zMeta = EXPLORER_VARS.find((v) => v.id === zVar)!;

  const stats = useMemo(() => {
    const xs = filtered.map((h) => extractVar(h, xVar));
    const ys = filtered.map((h) => extractVar(h, yVar));
    const zs = filtered.map((h) => extractVar(h, zVar));
    const xHist = calcDistributionHistogram(xs, undefined, undefined, 14);
    const yHist = calcDistributionHistogram(ys, undefined, undefined, 14);
    const zMin = Math.min(...(zs.length ? zs : [0]));
    const zMax = Math.max(zMin + 1, ...(zs.length ? zs : [1]));

    // Pearson correlation r
    const n = Math.max(1, xs.length);
    const mx = xHist.mean;
    const my = yHist.mean;
    let num = 0;
    let dx2 = 0;
    let dy2 = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const r = dx2 > 0 && dy2 > 0 ? +(num / Math.sqrt(dx2 * dy2)).toFixed(2) : 0;

    // 12x12 Joint Frequency Matrix
    const gridN = 12;
    const grid = Array.from({ length: gridN }, () => new Array(gridN).fill(0));
    const xSpan = Math.max(1e-3, xHist.max - xHist.min);
    const ySpan = Math.max(1e-3, yHist.max - yHist.min);
    let maxBinCount = 1;
    for (let i = 0; i < xs.length; i++) {
      const gx = Math.min(gridN - 1, Math.max(0, Math.floor(((xs[i] - xHist.min) / xSpan) * gridN)));
      const gy = Math.min(gridN - 1, Math.max(0, Math.floor(((ys[i] - yHist.min) / ySpan) * gridN)));
      grid[gy][gx]++;
      if (grid[gy][gx] > maxBinCount) maxBinCount = grid[gy][gx];
    }

    return { xHist, yHist, zMin, zMax, r, grid, maxBinCount, count: n };
  }, [filtered, xVar, yVar, zVar]);

  return (
    <div className="space-y-5">
      {/* Variable & Time Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-indigo-600" />
            Custom Multivariate Query Studio (X / Y / Z Selectors + Temporal Filter)
          </h3>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
            Active Sample: {filtered.length.toLocaleString()} hrs • Pearson r = {stats.r}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
          <label>
            <span className="text-[11px] font-bold text-slate-600 block">X-Axis Variable</span>
            <select
              value={xVar}
              onChange={(e) => setXVar(e.target.value as ExplorerVarId)}
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.unit})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[11px] font-bold text-slate-600 block">Y-Axis Variable</span>
            <select
              value={yVar}
              onChange={(e) => setYVar(e.target.value as ExplorerVarId)}
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.unit})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[11px] font-bold text-slate-600 block">Color-By Z Variable</span>
            <select
              value={zVar}
              onChange={(e) => setZVar(e.target.value as ExplorerVarId)}
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.unit})
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-[11px] font-bold text-slate-600 block">
              Months: {MONTHS[mStart - 1]}–{MONTHS[mEnd - 1]}
            </span>
            <div className="flex items-center gap-1 mt-1.5">
              <input
                type="range"
                min={1}
                max={12}
                value={mStart}
                onChange={(e) => setMStart(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <input
                type="range"
                min={1}
                max={12}
                value={mEnd}
                onChange={(e) => setMEnd(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-600 block">
              Hours: {hStart}:00–{hEnd}:00
            </span>
            <div className="flex items-center gap-1 mt-1.5">
              <input
                type="range"
                min={0}
                max={23}
                value={hStart}
                onChange={(e) => setHStart(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <input
                type="range"
                min={0}
                max={23}
                value={hEnd}
                onChange={(e) => setHEnd(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-4 font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={invertFilter}
              onChange={(e) => setInvertFilter(e.target.checked)}
              className="accent-indigo-600"
            />
            Invert Time Filter
          </label>
        </div>
      </div>

      {/* Marginal Histogram Scatter Plot + 2D Simultaneous Frequency Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ClimaChartCard
          title={`Marginal Histogram Scatter Plot: ${xMeta.label} vs. ${yMeta.label}`}
          subtitle={`Colored by ${zMeta.label} (${zMeta.unit}) with Top X-Distribution & Right Y-Distribution`}
          icon={<Sparkles className="w-4 h-4 text-teal-600" />}
          svgFilename={`${climate.id}_explorer_scatter_${xVar}_${yVar}.svg`}
          csvFilename={`${climate.id}_explorer_${xVar}_${yVar}_${zVar}.csv`}
          onBuildCsv={() => ({
            headers: ['HourOfYear', 'Month', 'Day', 'Hour', xMeta.label, yMeta.label, zMeta.label],
            rows: filtered.map((h) => [
              h.hourOfYear,
              h.month + 1,
              h.dayOfMonth,
              h.hour,
              extractVar(h, xVar),
              extractVar(h, yVar),
              extractVar(h, zVar)
            ])
          })}
        >
          {(svgRef, tooltipCtx) => {
            const W = 620;
            const H = 380;
            const padL = 46;
            const padB = 38;
            const histTopH = 50;
            const histRightW = 54;
            const plotW = W - padL - histRightW - 18;
            const plotH = H - histTopH - padB - 14;
            const plotX0 = padL;
            const plotY0 = histTopH + 10;

            const xMin = stats.xHist.min;
            const xMax = Math.max(xMin + 1, stats.xHist.max);
            const yMin = stats.yHist.min;
            const yMax = Math.max(yMin + 1, stats.yHist.max);

            const xFor = (v: number) => plotX0 + ((v - xMin) / (xMax - xMin)) * plotW;
            const yFor = (v: number) => plotY0 + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

            const maxXBin = Math.max(1, ...stats.xHist.bins.map((b) => b.count));
            const maxYBin = Math.max(1, ...stats.yHist.bins.map((b) => b.count));

            const sampled = filtered.filter((_, idx) => idx % 2 === 0);

            return (
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
                {/* Top Marginal X Histogram */}
                {stats.xHist.bins.map((b, i) => {
                  const bx = plotX0 + (i / stats.xHist.bins.length) * plotW;
                  const bw = plotW / stats.xHist.bins.length - 2;
                  const bh = (b.count / maxXBin) * (histTopH - 6);
                  return (
                    <rect
                      key={i}
                      x={bx}
                      y={histTopH - bh}
                      width={Math.max(2, bw)}
                      height={bh}
                      fill="#0d9488"
                      fillOpacity={0.7}
                      rx={1.5}
                    />
                  );
                })}

                {/* Right Marginal Y Histogram */}
                {stats.yHist.bins.map((b, i) => {
                  const by = plotY0 + plotH - ((i + 1) / stats.yHist.bins.length) * plotH;
                  const bh = plotH / stats.yHist.bins.length - 2;
                  const bw = (b.count / maxYBin) * (histRightW - 8);
                  return (
                    <rect
                      key={i}
                      x={plotX0 + plotW + 6}
                      y={by}
                      width={bw}
                      height={Math.max(2, bh)}
                      fill="#6366f1"
                      fillOpacity={0.7}
                      rx={1.5}
                    />
                  );
                })}

                {/* Main Scatter Frame */}
                <rect x={plotX0} y={plotY0} width={plotW} height={plotH} fill="#ffffff" stroke="#cbd5e1" />

                {sampled.map((h, i) => {
                  const xv = extractVar(h, xVar);
                  const yv = extractVar(h, yVar);
                  const zv = extractVar(h, zVar);
                  const zNorm = (zv - stats.zMin) / Math.max(1e-3, stats.zMax - stats.zMin);
                  const color =
                    zNorm > 0.75
                      ? '#e11d48'
                      : zNorm > 0.5
                      ? '#f59e0b'
                      : zNorm > 0.25
                      ? '#10b981'
                      : '#0284c7';
                  return (
                    <circle
                      key={i}
                      cx={xFor(xv)}
                      cy={yFor(yv)}
                      r={2.4}
                      fill={color}
                      fillOpacity={0.65}
                      className="cursor-pointer hover:r-[5] transition-all"
                      onMouseEnter={(e) => {
                        tooltipCtx.show(e, `${MONTHS[h.month]} ${h.dayOfMonth} • ${h.hour}:00`, [
                          { label: xMeta.label, value: `${xv} ${xMeta.unit}`, color: '#0d9488' },
                          { label: yMeta.label, value: `${yv} ${yMeta.unit}`, color: '#6366f1' },
                          { label: zMeta.label, value: `${zv} ${zMeta.unit}`, color: color }
                        ]);
                      }}
                      onMouseMove={(e) => tooltipCtx.move(e)}
                      onMouseLeave={() => tooltipCtx.hide()}
                    />
                  );
                })}

                {/* Axis Labels */}
                <text x={plotX0 + plotW / 2} y={H - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">
                  {xMeta.label} ({xMeta.unit}) [Min {xMin} • Mean {stats.xHist.mean} • Max {xMax}]
                </text>
                <text
                  x={14}
                  y={plotY0 + plotH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#334155"
                  transform={`rotate(-90, 14, ${plotY0 + plotH / 2})`}
                >
                  {yMeta.label} ({yMeta.unit})
                </text>
              </svg>
            );
          }}
        </ClimaChartCard>

        <ClimaChartCard
          title={`2D Simultaneous Frequency Heatmap (${xMeta.label} × ${yMeta.label})`}
          subtitle="Joint hourly occurrence density matrix (hours per bin across filtered period)"
          icon={<Compass className="w-4 h-4 text-indigo-600" />}
          svgFilename={`${climate.id}_explorer_2d_heatmap_${xVar}_${yVar}.svg`}
          csvFilename={`${climate.id}_explorer_2d_bins_${xVar}_${yVar}.csv`}
          onBuildCsv={() => ({
            headers: ['Y_Bin_Index', ...Array.from({ length: 12 }, (_, i) => `X_Bin_${i + 1}`)],
            rows: stats.grid.map((row, rIdx) => [rIdx + 1, ...row])
          })}
        >
          {(svgRef) => {
            const W = 500;
            const H = 310;
            const padL = 46;
            const padR = 20;
            const padT = 18;
            const padB = 34;
            const plotW = W - padL - padR;
            const plotH = H - padT - padB;
            const N = 12;
            const cw = plotW / N;
            const ch = plotH / N;

            return (
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-950 rounded-xl">
                {stats.grid.map((row, gy) =>
                  row.map((cnt, gx) => {
                    const x = padL + gx * cw;
                    const y = padT + (N - 1 - gy) * ch;
                    const frac = cnt / stats.maxBinCount;
                    const fill =
                      cnt === 0
                        ? '#0f172a'
                        : frac < 0.25
                        ? '#1e3a8a'
                        : frac < 0.5
                        ? '#0284c7'
                        : frac < 0.75
                        ? '#10b981'
                        : '#f59e0b';
                    return (
                      <g key={`${gx}_${gy}`}>
                        <rect
                          x={x}
                          y={y}
                          width={cw - 1}
                          height={ch - 1}
                          fill={fill}
                          rx={2}
                        />
                        {cnt > 0 && (
                          <text
                            x={x + cw / 2}
                            y={y + ch / 2 + 3}
                            textAnchor="middle"
                            fontSize="7.5"
                            fontWeight="700"
                            fill="#f8fafc"
                          >
                            {cnt}h
                          </text>
                        )}
                      </g>
                    );
                  })
                )}

                <text x={padL + plotW / 2} y={H - 9} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#cbd5e1">
                  {xMeta.label} ({stats.xHist.min} → {stats.xHist.max} {xMeta.unit})
                </text>
                <text
                  x={14}
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#cbd5e1"
                  transform={`rotate(-90, 14, ${padT + plotH / 2})`}
                >
                  {yMeta.label} ({stats.yHist.min} → {stats.yHist.max} {yMeta.unit})
                </text>
              </svg>
            );
          }}
        </ClimaChartCard>
      </div>
    </div>
  );
};

