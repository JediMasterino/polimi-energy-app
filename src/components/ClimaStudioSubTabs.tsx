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
  Filter,
  Maximize2,
  Minimize2,
  X
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
  UTCI_STRESS_CATEGORIES,
  UTCI_SCENARIOS,
  getUtciStressCategory,
  calcUtciScenarioDataset,
  calcAllUtciScenariosSummary,
  calcDistributionHistogram,
  exportSvgNodeToFile,
  exportDataToCsvFile,
  calcDewPointC,
  colorForUtciContinuous,
  CBE_UTCI_BLUE_RED_YELLOW_GRADIENT_CSS
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
  const [isMaximized, setIsMaximized] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    clientX: number;
    clientY: number;
    data: ClimaTooltipData | null;
  }>({
    visible: false,
    clientX: 0,
    clientY: 0,
    data: null
  });

  const tooltipCtx = useMemo<ClimaTooltipCtx>(
    () => ({
      show: (e, title, lines) => {
        setTooltip({
          visible: true,
          clientX: e.clientX,
          clientY: e.clientY,
          data: { title, lines }
        });
      },
      move: (e) => {
        setTooltip((prev) => ({
          ...prev,
          clientX: e.clientX,
          clientY: e.clientY
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

  // Smart non-clipped floating tooltip rendered with fixed viewport coordinates
  const renderTooltip = () => {
    if (!tooltip.visible || !tooltip.data) return null;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const isNearTop = tooltip.clientY < 180;
    const isNearRight = tooltip.clientX > windowWidth - 280;
    const isNearLeft = tooltip.clientX < 180;

    const leftPos = isNearRight ? tooltip.clientX - 16 : isNearLeft ? tooltip.clientX + 16 : tooltip.clientX;
    const topPos = isNearTop ? tooltip.clientY + 22 : tooltip.clientY - 14;
    const transformX = isNearRight ? 'translateX(-100%)' : isNearLeft ? 'translateX(0)' : 'translateX(-50%)';
    const transformY = isNearTop ? 'translateY(0)' : 'translateY(-100%)';

    return (
      <div
        className="pointer-events-none fixed z-[999999] px-3.5 py-2.5 rounded-xl bg-slate-950/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md max-w-sm select-none"
        style={{
          left: leftPos,
          top: topPos,
          transform: `${transformX} ${transformY}`
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
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: ln.color }} />
                )}
                {ln.label}:
              </span>
              <span className="font-mono font-bold text-slate-100">{ln.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
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
                onClick={() => setIsMaximized(true)}
                title="Expand chart (CBE Clima High-Resolution presentation view)"
                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10.5px] font-bold flex items-center gap-1 transition"
              >
                <Maximize2 className="w-3.5 h-3.5 text-teal-700" />
                Expand
              </button>
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

        <div className="w-full relative min-h-[160px]">
          {children(svgRef, tooltipCtx)}
        </div>

        {footer && <div className="pt-1">{footer}</div>}
      </div>

      {/* High-Resolution Presentation Modal when Maximized */}
      {isMaximized && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-300 w-full max-w-7xl max-h-[94vh] flex flex-col p-6 space-y-4 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                    {icon}
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
                </div>
                {subtitle && <p className="text-xs text-slate-500 pl-8">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {badge}
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600" />
                  Export SVG
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsMaximized(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200 transition"
                  title="Close Fullscreen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {controls && <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">{controls}</div>}
            <div className="flex-1 w-full min-h-[480px] flex items-center justify-center">
              {children(svgRef, tooltipCtx)}
            </div>
            {footer && <div className="pt-2 border-t border-slate-200">{footer}</div>}
          </div>
        </div>
      )}

      {renderTooltip()}
    </>
  );
};

// ============================================================================
// REUSABLE 24h x 365d TIMETABLE CARPET HEATMAP SVG RENDERER (INTERACTIVE HOVER)
// ============================================================================
export interface ContinuousLegendConfig {
  min: number;
  max: number;
  unit: string;
  gradientCss: string;
  description?: string;
  formatValue?: (val: number) => string;
}

interface CarpetHeatmapProps {
  svgRef?: React.RefObject<SVGSVGElement | null>;
  tooltipCtx?: ClimaTooltipCtx;
  hourly: HourlyWeatherRecord[];
  getValue: (h: HourlyWeatherRecord, idx: number) => number;
  getColor: (val: number) => string;
  unitLabel: string;
  legendItems?: Array<{ label: string; color: string }>;
  continuousLegend?: ContinuousLegendConfig;
  customTooltipRows?: (val: number, rec: HourlyWeatherRecord, idx: number) => Array<{ label: string; value: string; color?: string }>;
}

export const CarpetHeatmap24x365: React.FC<CarpetHeatmapProps> = ({
  svgRef,
  tooltipCtx,
  hourly,
  getValue,
  getColor,
  unitLabel,
  legendItems,
  continuousLegend,
  customTooltipRows
}) => {
  const W = 920;
  const H = 280;
  const padL = 48;
  const padR = 20;
  const padT = 18;
  const padB = 34;
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
      if (customTooltipRows) {
        tooltipCtx.show(
          e,
          `${mName} ${rec.dayOfMonth} • ${String(hour).padStart(2, '0')}:00 (DOY ${dayOfYear})`,
          customTooltipRows(val, rec, idx)
        );
      } else {
        tooltipCtx.show(e, `${mName} ${rec.dayOfMonth} • ${String(hour).padStart(2, '0')}:00 (DOY ${dayOfYear})`, [
          { label: unitLabel, value: typeof val === 'number' ? val.toFixed(1) : String(val), color: getColor(val) },
          { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` },
          { label: 'Relative Humidity', value: `${rec.relHum}%` },
          { label: 'Wind Speed', value: `${rec.windSpeed} m/s` },
          { label: 'GHI Solar', value: `${rec.ghi} W/m²` }
        ]);
      }
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
        className="w-full h-auto bg-slate-950 rounded-2xl p-1.5 cursor-crosshair shadow-lg border border-slate-800"
      >
        {[0, 4, 8, 12, 16, 20, 23].map((hr) => {
          const y = padT + (23 - hr) * cellH + cellH * 0.5;
          return (
            <text key={hr} x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#94a3b8">
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
              width={cellW + 0.5}
              height={cellH + 0.5}
              fill={getColor(val)}
            />
          );
        })}

        {/* Crosshair Guideline & Cell Highlight */}
        {activeCell && (
          <g pointerEvents="none">
            <line
              x1={padL + (activeCell.dayOfYear - 0.5) * cellW}
              y1={padT}
              x2={padL + (activeCell.dayOfYear - 0.5) * cellW}
              y2={padT + plotH}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <line
              x1={padL}
              y1={padT + (23 - activeCell.hour + 0.5) * cellH}
              x2={padL + plotW}
              y2={padT + (23 - activeCell.hour + 0.5) * cellH}
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <rect
              x={padL + (activeCell.dayOfYear - 1) * cellW - 0.5}
              y={padT + (23 - activeCell.hour) * cellH - 0.5}
              width={cellW + 1}
              height={cellH + 1}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
            />
          </g>
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
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={0.8}
              />
              <text x={x} y={H - 10} textAnchor="middle" fontSize="11" fill="#f1f5f9" fontWeight="700">
                {m}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1 font-medium">
        <span className="font-semibold text-slate-700">
          365 Days × 24 Hours (8,760h Annual Matrix • {unitLabel} • Crosshair active)
        </span>
        {continuousLegend ? (
          <div className="flex flex-wrap items-center gap-3">
            {continuousLegend.description && (
              <span className="text-[10px] text-slate-500 font-medium">{continuousLegend.description}</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 font-mono">
                {continuousLegend.formatValue
                  ? continuousLegend.formatValue(continuousLegend.min)
                  : Number.isInteger(continuousLegend.min)
                  ? continuousLegend.min
                  : continuousLegend.min.toFixed(1)}
                {continuousLegend.unit}
              </span>
              <div
                className="w-44 sm:w-60 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                style={{ background: continuousLegend.gradientCss }}
              />
              <span className="text-[11px] font-bold text-slate-800 font-mono">
                {continuousLegend.formatValue
                  ? continuousLegend.formatValue(continuousLegend.max)
                  : Number.isInteger(continuousLegend.max)
                  ? continuousLegend.max
                  : continuousLegend.max.toFixed(1)}
                {continuousLegend.unit}
              </span>
            </div>
          </div>
        ) : legendItems && legendItems.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {legendItems.map((it, idx) => (
              <span key={idx} className="flex items-center gap-1.5 font-bold text-slate-700">
                <span
                  className="w-3.5 h-3.5 rounded-sm inline-block shadow-sm border border-black/10 shrink-0"
                  style={{ backgroundColor: it.color }}
                />
                <span>{it.label}</span>
              </span>
            ))}
          </div>
        ) : null}
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

export const RDYLBU_R_STOPS: Array<[number, number, number]> = [
  [49, 54, 149],
  [69, 117, 180],
  [116, 173, 209],
  [224, 243, 248],
  [254, 224, 144],
  [244, 109, 67],
  [215, 48, 39],
  [165, 0, 38]
];

export const YLGNBU_STOPS: Array<[number, number, number]> = [
  [255, 255, 204],
  [199, 233, 180],
  [127, 205, 187],
  [65, 182, 196],
  [29, 145, 192],
  [34, 94, 168],
  [12, 44, 132]
];

export const YLORRD_WIND_STOPS: Array<[number, number, number]> = [
  [15, 23, 42],
  [3, 105, 161],
  [13, 148, 136],
  [245, 158, 11],
  [225, 29, 72]
];

export const CBE_RDYLBU_R_GRADIENT_CSS =
  'linear-gradient(to right, rgb(49,54,149), rgb(69,117,180), rgb(116,173,209), rgb(224,243,248), rgb(254,224,144), rgb(244,109,67), rgb(215,48,39), rgb(165,0,38))';

export const CBE_YLGNBU_GRADIENT_CSS =
  'linear-gradient(to right, rgb(255,255,204), rgb(199,233,180), rgb(127,205,187), rgb(65,182,196), rgb(29,145,192), rgb(34,94,168), rgb(12,44,132))';

export const CBE_WIND_SPEED_GRADIENT_CSS =
  'linear-gradient(to right, rgb(15,23,42), rgb(3,105,161), rgb(13,148,136), rgb(245,158,11), rgb(225,29,72))';

export const CBE_WIND_DIR_GRADIENT_CSS =
  'linear-gradient(to right, #38bdf8 0%, #38bdf8 12.5%, #a78bfa 12.5%, #a78bfa 37.5%, #f59e0b 37.5%, #f59e0b 62.5%, #10b981 62.5%, #10b981 87.5%, #38bdf8 87.5%, #38bdf8 100%)';

export const CBE_UTCI_10BAND_GRADIENT_CSS =
  'linear-gradient(to right, #001433 0% 10%, #002b66 10% 20%, #0059b3 20% 30%, #1a8cff 30% 40%, #66b3ff 40% 50%, #22c55e 50% 60%, #ffcc00 60% 70%, #ff9900 70% 80%, #ff3300 80% 90%, #751613 90% 100%)';

export const CBE_NATVENT_GRADIENT_CSS =
  'linear-gradient(to right, #0284c7 0% 20%, #10b981 20% 40%, #8b5cf6 40% 60%, #f59e0b 60% 80%, #e11d48 80% 100%)';

export function colorForTempC(t: number, globalRange: boolean, customMin?: number, customMax?: number): string {
  const min = customMin !== undefined ? customMin : (globalRange ? -20 : -5);
  const max = customMax !== undefined ? customMax : (globalRange ? 45 : 38);
  const range = max - min;
  const norm = range > 0 ? (t - min) / range : 0.5;
  return interpolatePalette(RDYLBU_R_STOPS, Math.max(0, Math.min(1, norm)));
}

export function colorForRhPct(rh: number, customMin = 0, customMax = 100): string {
  const range = customMax - customMin;
  const norm = range > 0 ? (rh - customMin) / range : rh / 100;
  return interpolatePalette(YLGNBU_STOPS, Math.max(0, Math.min(1, norm)));
}

export function colorForWindSpeed(v: number, globalRange: boolean, customMin = 0, customMax?: number): string {
  const min = customMin;
  const max = customMax !== undefined ? customMax : (globalRange ? 18 : 10);
  const range = max - min;
  const norm = range > 0 ? (v - min) / range : 0;
  return interpolatePalette(YLORRD_WIND_STOPS, Math.max(0, Math.min(1, norm)));
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
  stage1WideMode?: boolean;
}> = ({ climate, globalValueRanges, stage1WideMode = true }) => {
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
      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-12 gap-5' : 'gap-6'}`}>
        {/* Polar Wind Rose */}
        <div className={stage1WideMode ? 'xl:col-span-6' : 'w-full'}>
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
                      <g key={i} className="pointer-events-none">
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
                          <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#1e293b" className="pointer-events-none select-none">
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

        {/* Monthly Wind Speed Profile & Directional Summary Table */}
        <div className={stage1WideMode ? 'xl:col-span-6' : 'w-full'}>
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
      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
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
          {(svgRef, tooltipCtx) => {
            const maxWind = Math.max(...climate.hourly.map((h) => h.windSpeed));
            const windRangeMin = 0;
            const windRangeMax = globalValueRanges ? 18 : Math.max(8, Math.ceil(maxWind));

            return (
              <CarpetHeatmap24x365
                svgRef={svgRef}
                tooltipCtx={tooltipCtx}
                hourly={climate.hourly}
                getValue={(h) => h.windSpeed}
                getColor={(v) => colorForWindSpeed(v, globalValueRanges, windRangeMin, windRangeMax)}
                unitLabel="m/s"
                continuousLegend={{
                  min: windRangeMin,
                  max: windRangeMax,
                  unit: ' m/s',
                  gradientCss: CBE_WIND_SPEED_GRADIENT_CSS,
                  description: `CBE Clima Continuous Gradient (${globalValueRanges ? 'Global Range [0, 18] m/s' : `Local Range [0, ${windRangeMax.toFixed(1)}] m/s`})`
                }}
                customTooltipRows={(val, rec) => {
                  const dirName =
                    rec.windDir >= 315 || rec.windDir < 45
                      ? 'North (N)'
                      : rec.windDir < 135
                      ? 'East (E)'
                      : rec.windDir < 225
                      ? 'South (S)'
                      : 'West (W)';
                  return [
                    { label: 'Wind Speed', value: `${val.toFixed(1)} m/s`, color: colorForWindSpeed(val, globalValueRanges, windRangeMin, windRangeMax) },
                    { label: 'Wind Direction', value: `${rec.windDir}° • ${dirName}` },
                    { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` },
                    { label: 'Relative Humidity', value: `${rec.relHum}%` }
                  ];
                }}
              />
            );
          }}
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
              continuousLegend={{
                min: 0,
                max: 360,
                unit: '°',
                gradientCss: CBE_WIND_DIR_GRADIENT_CSS,
                description: 'Cardinal Wind Azimuths (N: 315°–45° • E: 45°–135° • S: 135°–225° • W: 225°–315°)'
              }}
              customTooltipRows={(val, rec) => {
                const dirName =
                  val >= 315 || val < 45
                    ? 'North (N)'
                    : val < 135
                    ? 'East (E)'
                    : val < 225
                    ? 'South (S)'
                    : 'West (W)';
                return [
                  { label: 'Wind Direction', value: `${val.toFixed(0)}° • ${dirName}`, color: colorForWindDir(val) },
                  { label: 'Wind Speed', value: `${rec.windSpeed.toFixed(1)} m/s` },
                  { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` }
                ];
              }}
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
  stage1WideMode?: boolean;
}> = ({
  climate,
  comfortLower,
  comfortUpper,
  activeStrategies,
  toggleStrategy,
  setActiveStrategiesList,
  strategyMods,
  stage1WideMode = true
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

      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-12 gap-5' : 'gap-6'}`}>
        {/* Interactive Psychrometric Chart */}
        <div className={stage1WideMode ? 'xl:col-span-7' : 'w-full'}>
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

        {/* 6 Bioclimatic Polygons Checkboxes */}
        <div className={`${stage1WideMode ? 'xl:col-span-5' : 'w-full'} bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5`}>
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
              Ranked by bioclimatic relevance to <strong>{climate.name} ({climate.koppen} — {climate.koppenDesc})</strong>. Toggling updates downstream BEM modifiers.
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
  stage1WideMode?: boolean;
}> = ({ climate, stage1WideMode = true }) => {
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
      <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-1 ${stage1WideMode ? 'md:grid-cols-5' : 'sm:grid-cols-2 md:grid-cols-3'} gap-4 items-center`}>
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

      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-12 gap-5' : 'gap-6'}`}>
        {/* Monthly NatVent Stacked Bar Chart */}
        <div className={stage1WideMode ? 'xl:col-span-5' : 'w-full'}>
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

        {/* 24h x 365d Natural Ventilation Carpet Heatmap */}
        <div className={stage1WideMode ? 'xl:col-span-7' : 'w-full'}>
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
                customTooltipRows={(_, rec, idx) => {
                  const st = nvStats.hourlyStates[idx];
                  const stLabel =
                    st === 'suitable'
                      ? `Suitable (${minTempC}–${maxTempC}°C, T_dp ≤ ${maxDewPointC}°C)`
                      : st === 'too_cold'
                      ? `Too Cold (< ${minTempC}°C)`
                      : st === 'too_humid'
                      ? `Too Humid / Muggy (T_dp > ${maxDewPointC}°C)`
                      : st === 'too_windy'
                      ? `Too Windy (> ${maxWindMs} m/s)`
                      : `Too Hot (> ${maxTempC}°C)`;
                  const col =
                    st === 'suitable' ? '#10b981' : st === 'too_cold' ? '#0284c7' : st === 'too_humid' ? '#8b5cf6' : st === 'too_windy' ? '#f59e0b' : '#e11d48';
                  return [
                    { label: 'Ventilation Status', value: stLabel, color: col },
                    { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` },
                    { label: 'Dew-Point Temp', value: `${(rec.dewPoint ?? calcDewPointC(rec.dryBulb, rec.relHum)).toFixed(1)}°C` },
                    { label: 'Wind Speed', value: `${rec.windSpeed} m/s` },
                    { label: 'Relative Humidity', value: `${rec.relHum}%` }
                  ];
                }}
              />
            )}
          </ClimaChartCard>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-TAB 8: OUTDOOR COMFORT (UTCI 4-SCENARIO SWITCHER + 10-BAND STRESS + MONTHLY TABLE)
// Calibrated to CBE Clima & pythermalcomfort (Bröde et al. 2012 + ASHRAE 55 SolarCal)
// ============================================================================
export const SubTab8Utci: React.FC<{
  climate: ClimateDataset;
  stage1WideMode?: boolean;
}> = ({ climate, stage1WideMode = true }) => {
  const [scenario, setScenario] = useState<UtciScenarioId>('sun_wind');
  const [tableMode, setTableMode] = useState<'pct' | 'hours'>('pct');
  const [barNormalize, setBarNormalize] = useState<boolean>(true);
  const [utciRangeMode, setUtciRangeMode] = useState<'local' | 'global'>('local');

  const utciData = useMemo(
    () => calcUtciScenarioDataset(climate.hourly, scenario),
    [climate.hourly, scenario]
  );

  const { minUtci, maxUtci } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < utciData.hourlyUtci.length; i++) {
      const v = utciData.hourlyUtci[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      minUtci: min === Infinity ? -10 : min,
      maxUtci: max === -Infinity ? 50 : max
    };
  }, [utciData.hourlyUtci]);

  const continuousRangeMin = utciRangeMode === 'local' ? minUtci : -70;
  const continuousRangeMax = utciRangeMode === 'local' ? maxUtci : 70;

  const allScenariosSummary = useMemo(
    () => calcAllUtciScenariosSummary(climate.hourly),
    [climate.hourly]
  );

  // Group totals for table
  const tableSummary = useMemo(() => {
    // Categories 0..4 = Cold Stress (-5 to -1)
    // Category 5 = No Stress (0)
    // Categories 6..9 = Heat Stress (1 to 4)
    const monthlyColdCounts = new Array(12).fill(0);
    const monthlyComfCounts = new Array(12).fill(0);
    const monthlyHeatCounts = new Array(12).fill(0);

    for (let m = 0; m < 12; m++) {
      for (let c = 0; c < 5; c++) monthlyColdCounts[m] += utciData.monthlyCategoryCounts[m][c];
      monthlyComfCounts[m] = utciData.monthlyCategoryCounts[m][5];
      for (let c = 6; c < 10; c++) monthlyHeatCounts[m] += utciData.monthlyCategoryCounts[m][c];
    }

    const monthlyColdPct = monthlyColdCounts.map((v, m) => +((v / Math.max(1, utciData.monthlyTotalHours[m])) * 100).toFixed(1));
    const monthlyComfPct = monthlyComfCounts.map((v, m) => +((v / Math.max(1, utciData.monthlyTotalHours[m])) * 100).toFixed(1));
    const monthlyHeatPct = monthlyHeatCounts.map((v, m) => +((v / Math.max(1, utciData.monthlyTotalHours[m])) * 100).toFixed(1));

    let annualCold = 0;
    const annualComf = utciData.annualCategoryCounts[5];
    let annualHeat = 0;
    for (let c = 0; c < 5; c++) annualCold += utciData.annualCategoryCounts[c];
    for (let c = 6; c < 10; c++) annualHeat += utciData.annualCategoryCounts[c];

    const totH = Math.max(1, utciData.totalHours);

    return {
      monthlyColdCounts,
      monthlyComfCounts,
      monthlyHeatCounts,
      monthlyColdPct,
      monthlyComfPct,
      monthlyHeatPct,
      annualColdCounts: annualCold,
      annualComfCounts: annualComf,
      annualHeatCounts: annualHeat,
      annualColdPct: +((annualCold / totH) * 100).toFixed(1),
      annualComfPct: +((annualComf / totH) * 100).toFixed(1),
      annualHeatPct: +((annualHeat / totH) * 100).toFixed(1)
    };
  }, [utciData]);

  // Export table to CSV
  const handleExportTableCsv = () => {
    const isPct = tableMode === 'pct';
    const unitSuffix = isPct ? '%' : 'h';
    const headers = [
      'Stress Category ID',
      'CBE Category Label',
      'UTCI Range (°C)',
      ...MONTHS.map((m) => `${m} (${unitSuffix})`),
      `Annual Total (${unitSuffix})`
    ];

    const rows: Array<Array<string | number>> = UTCI_STRESS_CATEGORIES.map((cat, c) => [
      cat.id,
      cat.label,
      `${cat.minC === -Infinity ? '<= -40' : cat.maxC === Infinity ? '> +46' : cat.minC + ' to ' + cat.maxC}`,
      ...MONTHS.map((_, m) => (isPct ? utciData.monthlyCategoryPct[m][c] : utciData.monthlyCategoryCounts[m][c])),
      isPct ? utciData.annualCategoryPct[c] : utciData.annualCategoryCounts[c]
    ]);

    // Summary rows
    rows.push([
      'total_cold_stress',
      'TOTAL COLD STRESS (< +9°C)',
      '<= +9',
      ...MONTHS.map((_, m) => (isPct ? tableSummary.monthlyColdPct[m] : tableSummary.monthlyColdCounts[m])),
      isPct ? tableSummary.annualColdPct : tableSummary.annualColdCounts
    ]);
    rows.push([
      'total_comfort_no_stress',
      'TOTAL NO THERMAL STRESS (+9 to +26°C)',
      '+9 to +26',
      ...MONTHS.map((_, m) => (isPct ? tableSummary.monthlyComfPct[m] : tableSummary.monthlyComfCounts[m])),
      isPct ? tableSummary.annualComfPct : tableSummary.annualComfCounts
    ]);
    rows.push([
      'total_heat_stress',
      'TOTAL HEAT STRESS (> +26°C)',
      '> +26',
      ...MONTHS.map((_, m) => (isPct ? tableSummary.monthlyHeatPct[m] : tableSummary.monthlyHeatCounts[m])),
      isPct ? tableSummary.annualHeatPct : tableSummary.annualHeatCounts
    ]);
    rows.push([
      'total_hours',
      'TOTAL HOURS / SHARE',
      'ALL',
      ...MONTHS.map((_, m) => (isPct ? 100.0 : utciData.monthlyTotalHours[m])),
      isPct ? 100.0 : utciData.totalHours
    ]);

    exportDataToCsvFile(headers, rows, `${climate.id}_utci_breakdown_${scenario}_${tableMode}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* 1. CBE Clima Best Condition Recommendation Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  CBE Clima Optimal Condition
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Outdoor UTCI Physiological Comfort Neutrality (+9°C to +26°C)
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {allScenariosSummary.cbeBestHeadline}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {UTCI_SCENARIOS.map((sc) => {
              const res = allScenariosSummary.results[sc.id];
              const isBest = sc.id === allScenariosSummary.bestScenario;
              const isCurrent = sc.id === scenario;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setScenario(sc.id)}
                  className={`px-3 py-1.5 rounded-xl text-left border transition ${
                    isCurrent
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-bold'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{sc.label}</span>
                    {isBest && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        isCurrent ? 'bg-white text-teal-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Best
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] ${isCurrent ? 'text-teal-100' : 'text-slate-500'}`}>
                    {res.annualComfortPct}% ({res.annualComfortHours.toLocaleString()}h)
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Microclimate Sheltering Scenario Selector Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${stage1WideMode ? 'lg:grid-cols-4' : ''} gap-3`}>
        {UTCI_SCENARIOS.map((sc) => {
          const res = allScenariosSummary.results[sc.id];
          const isSelected = scenario === sc.id;
          const isBest = sc.id === allScenariosSummary.bestScenario;

          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => setScenario(sc.id)}
              className={`p-3.5 rounded-2xl border text-left transition relative ${
                isSelected
                  ? 'bg-teal-50/60 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {isBest && (
                <span className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  Optimal
                </span>
              )}
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>{sc.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                {sc.description}
              </p>

              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-center">
                <div className="bg-slate-50/80 rounded-lg p-1">
                  <div className="text-[9px] text-slate-400 font-medium">Comfort</div>
                  <div className="text-xs font-bold text-emerald-600">{res.annualComfortPct}%</div>
                </div>
                <div className="bg-slate-50/80 rounded-lg p-1">
                  <div className="text-[9px] text-slate-400 font-medium">Cold</div>
                  <div className="text-xs font-bold text-blue-600">{res.annualColdStressPct}%</div>
                </div>
                <div className="bg-slate-50/80 rounded-lg p-1">
                  <div className="text-[9px] text-slate-400 font-medium">Heat</div>
                  <div className="text-xs font-bold text-amber-600">{res.annualHeatStressPct}%</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Row 1: Continuous Heatmap + Discrete 10-Band Stress Heatmap */}
      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
        <ClimaChartCard
          title="UTCI Heatmap Chart (°C)"
          subtitle={`Scenario: ${scenario.toUpperCase()} (${utciData.meta.tag}) • Range: [${continuousRangeMin.toFixed(1)}°C, ${continuousRangeMax.toFixed(1)}°C] • Comfort Neutrality (+9°C to +26°C): ${utciData.annualComfortPct}% (${utciData.annualComfortHours.toLocaleString()} h)`}
          icon={<Thermometer className="w-4 h-4 text-rose-500" />}
          svgFilename={`${climate.id}_utci_temp_${scenario}.svg`}
          csvFilename={`${climate.id}_utci_hourly_${scenario}.csv`}
          controls={
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setUtciRangeMode('local')}
                className={`px-2.5 py-1 rounded-md transition ${
                  utciRangeMode === 'local' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Local ({minUtci.toFixed(0)} to {maxUtci.toFixed(0)}°C)
              </button>
              <button
                type="button"
                onClick={() => setUtciRangeMode('global')}
                className={`px-2.5 py-1 rounded-md transition ${
                  utciRangeMode === 'global' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Global (-70 to +70°C)
              </button>
            </div>
          }
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
              getColor={(v) => colorForUtciContinuous(v, continuousRangeMin, continuousRangeMax)}
              unitLabel="UTCI Equivalent Temp"
              continuousLegend={{
                min: continuousRangeMin,
                max: continuousRangeMax,
                unit: '°C',
                gradientCss: CBE_UTCI_BLUE_RED_YELLOW_GRADIENT_CSS,
                description: `CBE Clima Continuous Gradient (${utciRangeMode === 'local' ? 'Local Range' : 'Global Range [-70, +70]°C'})`
              }}
              customTooltipRows={(val, rec) => {
                const cat = getUtciStressCategory(val);
                return [
                  { label: 'UTCI Equivalent Temp', value: `${val.toFixed(1)}°C`, color: colorForUtciContinuous(val, continuousRangeMin, continuousRangeMax) },
                  { label: 'Thermal Stress Band', value: cat.label, color: cat.color },
                  { label: 'Dry-Bulb Air Temp', value: `${rec.dryBulb}°C` },
                  { label: 'Relative Humidity', value: `${rec.relHum}%` },
                  { label: 'Wind Speed', value: `${rec.windSpeed} m/s` },
                  { label: 'Solar Altitude', value: `${rec.solarAlt}°` },
                  { label: 'Microclimate Condition', value: utciData.meta.label }
                ];
              }}
            />
          )}
        </ClimaChartCard>

        <ClimaChartCard
          title="UTCI Thermal Stress Chart (10 Categories)"
          subtitle={`Scenario: ${scenario.toUpperCase()} (${utciData.meta.tag}) • Cold Stress: ${utciData.annualColdStressPct}% • Comfort: ${utciData.annualComfortPct}% • Heat Stress: ${utciData.annualHeatStressPct}%`}
          icon={<Sun className="w-4 h-4 text-amber-500" />}
          svgFilename={`${climate.id}_utci_10band_${scenario}.svg`}
          csvFilename={`${climate.id}_utci_10band_${scenario}.csv`}
          onBuildCsv={() => ({
            headers: ['Month', ...UTCI_STRESS_CATEGORIES.map((b) => b.label)],
            rows: MONTHS.map((m, i) => [
              m,
              ...UTCI_STRESS_CATEGORIES.map((b) => utciData.monthlyBandShares[i][b.id])
            ])
          })}
        >
          {(svgRef, tooltipCtx) => (
            <CarpetHeatmap24x365
              svgRef={svgRef}
              tooltipCtx={tooltipCtx}
              hourly={climate.hourly}
              getValue={(_, idx) => utciData.hourlyUtci[idx]}
              getColor={(val) => getUtciStressCategory(val).color}
              unitLabel="UTCI Thermal Stress"
              continuousLegend={{
                min: -40,
                max: 46,
                unit: '°C',
                gradientCss: CBE_UTCI_10BAND_GRADIENT_CSS,
                description: '10 Physiological Thermal Stress Categories (Extreme Cold ≤ -40°C to Extreme Heat > +46°C)'
              }}
              legendItems={UTCI_STRESS_CATEGORIES.map((b) => ({
                label: b.label,
                color: b.color
              }))}
              customTooltipRows={(val) => {
                const cat = getUtciStressCategory(val);
                return [
                  { label: 'UTCI Equivalent Temp', value: `${val.toFixed(1)}°C`, color: cat.color },
                  { label: 'Thermal Stress Category', value: cat.label, color: cat.color },
                  { label: 'CBE Category Code', value: String(cat.code) },
                  { label: 'Physiological Bounds', value: `${cat.minC === -Infinity ? '≤ -40' : cat.maxC === Infinity ? '> +46' : cat.minC + ' to ' + cat.maxC}°C` },
                  { label: 'Microclimate Condition', value: utciData.meta.label }
                ];
              }}
            />
          )}
        </ClimaChartCard>
      </div>

      {/* 4. Row 2: Monthly Stacked Bar Distribution (Normalized % vs Absolute Hours) */}
      <ClimaChartCard
        title="UTCI Thermal Stress Distribution (Monthly)"
        subtitle={
          barNormalize
            ? 'Normalized monthly percentage of hours (%) in each physiological thermal stress band'
            : 'Total monthly hours (h) in each physiological thermal stress band'
        }
        icon={<Sparkles className="w-4 h-4 text-teal-600" />}
        svgFilename={`${climate.id}_utci_monthly_bars_${scenario}.svg`}
        csvFilename={`${climate.id}_utci_monthly_bars_${scenario}.csv`}
        controls={
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setBarNormalize(true)}
              className={`px-2.5 py-1 rounded-md transition ${
                barNormalize ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Normalize (%)
            </button>
            <button
              type="button"
              onClick={() => setBarNormalize(false)}
              className={`px-2.5 py-1 rounded-md transition ${
                !barNormalize ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hours (h)
            </button>
          </div>
        }
        onBuildCsv={() => ({
          headers: ['Month', ...UTCI_STRESS_CATEGORIES.map((b) => b.label)],
          rows: MONTHS.map((m, i) => [
            m,
            ...UTCI_STRESS_CATEGORIES.map((b) =>
              barNormalize ? utciData.monthlyCategoryPct[i][b.code + 5] : utciData.monthlyCategoryCounts[i][b.code + 5]
            )
          ])
        })}
      >
        {(svgRef, tooltipCtx) => {
          const W = 860;
          const H = 270;
          const padL = 48;
          const padR = 20;
          const padT = 20;
          const padB = 34;
          const plotW = W - padL - padR;
          const plotH = H - padT - padB;
          const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);
          const maxMonthH = 750; // Max hours scaling in a month

          const yTicks = barNormalize
            ? [0, 20, 40, 60, 80, 100]
            : [0, 150, 300, 450, 600, 750];

          return (
            <div className="space-y-3">
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                {yTicks.map((tick) => {
                  const frac = barNormalize ? tick / 100 : tick / maxMonthH;
                  const y = padT + plotH - frac * plotH;
                  return (
                    <g key={tick}>
                      <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                      <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                        {tick}{barNormalize ? '%' : 'h'}
                      </text>
                    </g>
                  );
                })}

                {MONTHS.map((m, i) => {
                  const mTot = Math.max(1, utciData.monthlyTotalHours[i]);
                  const mScale = barNormalize ? 100 : maxMonthH;
                  let cumVal = 0;
                  const x = xForM(i);

                  return (
                    <g key={m}>
                      {UTCI_STRESS_CATEGORIES.map((band, catIdx) => {
                        const count = utciData.monthlyCategoryCounts[i][catIdx];
                        const pct = utciData.monthlyCategoryPct[i][catIdx];
                        const val = barNormalize ? pct : count;
                        if (val <= 0) return null;

                        const hBar = (val / mScale) * plotH;
                        const y = padT + plotH - ((cumVal + val) / mScale) * plotH;
                        cumVal += val;

                        return (
                          <rect
                            key={band.id}
                            x={x - 18}
                            y={y}
                            width={36}
                            height={Math.max(0.6, hBar)}
                            fill={band.color}
                            className="cursor-pointer hover:opacity-90 transition"
                            onMouseEnter={(e) => {
                              tooltipCtx.show(e, `${m} — ${band.label}`, [
                                { label: 'Category', value: band.label, color: band.color },
                                { label: barNormalize ? 'Proportion' : 'Count', value: barNormalize ? `${pct.toFixed(1)}%` : `${count} h`, color: band.color },
                                { label: 'Monthly Hours', value: `${count} h / ${mTot} h` },
                                { label: 'Monthly Share', value: `${pct.toFixed(1)}%` },
                                { label: 'Temperature Range', value: `${band.minC === -Infinity ? '≤ -40' : band.maxC === Infinity ? '> +46' : band.minC + ' to ' + band.maxC}°C` },
                                { label: 'Microclimate Condition', value: utciData.meta.label }
                              ]);
                            }}
                            onMouseMove={(e) => tooltipCtx.move(e)}
                            onMouseLeave={() => tooltipCtx.hide()}
                          />
                        );
                      })}
                      <text x={x} y={H - 10} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569">
                        {m}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] pt-1 border-t border-slate-100">
                {UTCI_STRESS_CATEGORIES.map((b) => (
                  <span key={b.id} className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-xs inline-block shrink-0 shadow-2xs" style={{ backgroundColor: b.color }} />
                    <span className="font-medium">{b.label}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        }}
      </ClimaChartCard>

      {/* 5. Row 3: THE MONTHLY & ANNUAL UTCI THERMAL STRESS BREAKDOWN TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-teal-50 text-teal-600">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-800">
                Monthly & Annual UTCI Thermal Stress Breakdown Table
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Exact physiological stress category distribution matching CBE Clima table outputs across all 12 months + Annual total
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setTableMode('pct')}
                className={`px-3 py-1 rounded-md transition ${
                  tableMode === 'pct' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setTableMode('hours')}
                className={`px-3 py-1 rounded-md transition ${
                  tableMode === 'hours' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hours (h)
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportTableCsv}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export Table CSV
            </button>
          </div>
        </div>

        {/* The Scrollable Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                <th className="py-2.5 px-3 sticky left-0 bg-slate-50 z-10 w-56">
                  UTCI Stress Category
                </th>
                <th className="py-2.5 px-2 text-center w-24">
                  Range (°C)
                </th>
                {MONTHS.map((m) => (
                  <th key={m} className="py-2.5 px-1.5 text-center font-semibold">
                    {m}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right bg-slate-100/90 font-bold text-slate-900">
                  Annual Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {UTCI_STRESS_CATEGORIES.map((cat, c) => {
                const isComf = cat.code === 0;
                const annualVal = tableMode === 'pct' ? utciData.annualCategoryPct[c] : utciData.annualCategoryCounts[c];

                return (
                  <tr
                    key={cat.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isComf ? 'bg-emerald-50/40 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2 px-3 sticky left-0 bg-white font-sans text-slate-800 z-10">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-xs shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className={isComf ? 'font-bold text-emerald-900' : ''}>
                          {cat.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 font-sans text-[10px]">
                      {cat.minC === -Infinity ? '≤ -40' : cat.maxC === Infinity ? '> +46' : `${cat.minC} to ${cat.maxC}`}
                    </td>
                    {MONTHS.map((_, m) => {
                      const val = tableMode === 'pct' ? utciData.monthlyCategoryPct[m][c] : utciData.monthlyCategoryCounts[m][c];
                      const hasVal = val > 0;
                      return (
                        <td
                          key={m}
                          className={`py-2 px-1.5 text-center ${
                            hasVal ? (isComf ? 'text-emerald-700 font-bold' : 'text-slate-700') : 'text-slate-300'
                          }`}
                        >
                          {hasVal ? (tableMode === 'pct' ? `${val}%` : val) : '—'}
                        </td>
                      );
                    })}
                    <td className={`py-2 px-3 text-right bg-slate-50/70 font-bold ${
                      isComf ? 'text-emerald-700 font-extrabold bg-emerald-50/60' : 'text-slate-800'
                    }`}>
                      {tableMode === 'pct' ? `${annualVal}%` : annualVal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}

              {/* Group Summary: Total Cold Stress (< +9°C) */}
              <tr className="bg-blue-50/50 border-t-2 border-slate-200 font-sans font-bold text-slate-800">
                <td className="py-2 px-3 sticky left-0 bg-blue-50/90 text-blue-900 z-10">
                  Total Cold Stress (&lt; +9°C)
                </td>
                <td className="py-2 px-2 text-center text-blue-700 text-[10px]">
                  &le; +9
                </td>
                {MONTHS.map((_, m) => {
                  const val = tableMode === 'pct' ? tableSummary.monthlyColdPct[m] : tableSummary.monthlyColdCounts[m];
                  return (
                    <td key={m} className="py-2 px-1.5 text-center text-blue-800 font-mono">
                      {val > 0 ? (tableMode === 'pct' ? `${val}%` : val) : '—'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-right text-blue-900 font-mono font-bold bg-blue-100/60">
                  {tableMode === 'pct' ? `${tableSummary.annualColdPct}%` : tableSummary.annualColdCounts.toLocaleString()}
                </td>
              </tr>

              {/* Group Summary: Total Comfort / No Thermal Stress (+9 to +26°C) */}
              <tr className="bg-emerald-100/60 border-t border-b border-emerald-300 font-sans font-bold text-emerald-950">
                <td className="py-2.5 px-3 sticky left-0 bg-emerald-100/90 text-emerald-900 z-10">
                  Total No Thermal Stress (+9°C to +26°C)
                </td>
                <td className="py-2.5 px-2 text-center text-emerald-800 text-[10px]">
                  +9 to +26
                </td>
                {MONTHS.map((_, m) => {
                  const val = tableMode === 'pct' ? tableSummary.monthlyComfPct[m] : tableSummary.monthlyComfCounts[m];
                  return (
                    <td key={m} className="py-2.5 px-1.5 text-center text-emerald-900 font-mono font-bold">
                      {val > 0 ? (tableMode === 'pct' ? `${val}%` : val) : '—'}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right text-emerald-900 font-mono font-extrabold bg-emerald-200/60">
                  {tableMode === 'pct' ? `${tableSummary.annualComfPct}%` : tableSummary.annualComfCounts.toLocaleString()}
                </td>
              </tr>

              {/* Group Summary: Total Heat Stress (> +26°C) */}
              <tr className="bg-amber-50/50 font-sans font-bold text-slate-800">
                <td className="py-2 px-3 sticky left-0 bg-amber-50/90 text-amber-900 z-10">
                  Total Heat Stress (&gt; +26°C)
                </td>
                <td className="py-2 px-2 text-center text-amber-700 text-[10px]">
                  &gt; +26
                </td>
                {MONTHS.map((_, m) => {
                  const val = tableMode === 'pct' ? tableSummary.monthlyHeatPct[m] : tableSummary.monthlyHeatCounts[m];
                  return (
                    <td key={m} className="py-2 px-1.5 text-center text-amber-800 font-mono">
                      {val > 0 ? (tableMode === 'pct' ? `${val}%` : val) : '—'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-right text-amber-900 font-mono font-bold bg-amber-100/60">
                  {tableMode === 'pct' ? `${tableSummary.annualHeatPct}%` : tableSummary.annualHeatCounts.toLocaleString()}
                </td>
              </tr>

              {/* Grand Total Row */}
              <tr className="bg-slate-100 font-sans font-bold text-slate-700 border-t border-slate-300">
                <td className="py-2 px-3 sticky left-0 bg-slate-100 z-10">
                  Total Hours / Share
                </td>
                <td className="py-2 px-2 text-center text-slate-500 text-[10px]">
                  ALL
                </td>
                {MONTHS.map((_, m) => (
                  <td key={m} className="py-2 px-1.5 text-center text-slate-600 font-mono">
                    {tableMode === 'pct' ? '100%' : utciData.monthlyTotalHours[m]}
                  </td>
                ))}
                <td className="py-2 px-3 text-right text-slate-900 font-mono font-bold bg-slate-200/80">
                  {tableMode === 'pct' ? '100.0%' : utciData.totalHours.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Row 4: 4-Scenario Microclimate Cross-Comparison & Architectural Takeaway */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Microclimate Sheltering Cross-Scenario Comparison
          </h3>
          <p className="text-[11px] text-slate-500">
            Side-by-side performance comparison of all 4 CBE Clima outdoor microclimate configurations
          </p>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${stage1WideMode ? 'xl:grid-cols-4' : ''} gap-4`}>
          {UTCI_SCENARIOS.map((sc) => {
            const res = allScenariosSummary.results[sc.id];
            const isBest = sc.id === allScenariosSummary.bestScenario;
            const isCurrent = sc.id === scenario;

            let architecturalAction = '';
            if (sc.id === 'sun_wind') {
              architecturalAction = 'Baseline open field: maximizes wind dilution in humid summers, but suffers high winter wind chill.';
            } else if (sc.id === 'nosun_wind') {
              architecturalAction = 'Deciduous tree canopy / pergola: lowers peak summer operative temp by up to 8.5°C while maintaining breeze.';
            } else if (sc.id === 'sun_nowind') {
              architecturalAction = 'Sheltered South courtyard: traps passive solar warmth and shields from cold winter gusts.';
            } else {
              architecturalAction = 'Deep loggia / arcade: ideal for hot-dry summer conditions, providing total radiative and convective shelter.';
            }

            return (
              <div
                key={sc.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                  isCurrent
                    ? 'bg-teal-50/50 border-teal-500 shadow-sm ring-1 ring-teal-500/20'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{sc.label}</span>
                    {isBest && (
                      <span className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Best Choice
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">{sc.tag}</div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">No Thermal Stress:</span>
                      <span className="font-bold text-emerald-700">
                        {res.annualComfortPct}% ({res.annualComfortHours.toLocaleString()} h)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Cold Stress (&lt;9°C):</span>
                      <span className="font-semibold text-blue-600">
                        {res.annualColdStressPct}% ({res.annualColdStressHours.toLocaleString()} h)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Heat Stress (&gt;26°C):</span>
                      <span className="font-semibold text-amber-600">
                        {res.annualHeatStressPct}% ({res.annualHeatStressHours.toLocaleString()} h)
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded-lg border border-slate-200/60 mt-3">
                    {architecturalAction}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setScenario(sc.id)}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition text-center ${
                      isCurrent
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isCurrent ? 'Active View' : 'Inspect Scenario'}
                  </button>
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
  stage1WideMode?: boolean;
}> = ({ climate, stage1WideMode = true }) => {
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

        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${stage1WideMode ? 'xl:grid-cols-6' : ''} gap-3 text-xs`}>
          <label>
            <span className="text-[11px] font-bold text-slate-600 block">X-Axis Variable</span>
            <select
              value={xVar}
              onChange={(e) => setXVar(e.target.value as ExplorerVarId)}
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id} className="text-slate-900 bg-white">
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
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id} className="text-slate-900 bg-white">
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
              className="w-full mt-1 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-teal-500"
            >
              {EXPLORER_VARS.map((v) => (
                <option key={v.id} value={v.id} className="text-slate-900 bg-white">
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
      <div className={`grid grid-cols-1 ${stage1WideMode ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
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
                      r={2.8}
                      fill={color}
                      fillOpacity={0.7}
                      stroke="#ffffff"
                      strokeWidth={0.6}
                      className="cursor-pointer transition-colors hover:stroke-slate-900 hover:stroke-[1.5px] hover:fill-opacity-100"
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
          {(svgRef, tooltipCtx) => {
            const W = 560;
            const H = 340;
            const padL = 48;
            const padR = 24;
            const padT = 20;
            const padB = 38;
            const plotW = W - padL - padR;
            const plotH = H - padT - padB;
            const N = 12;
            const cw = plotW / N;
            const ch = plotH / N;

            return (
              <div>
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
                    const x0 = stats.xHist.min + (gx / N) * (stats.xHist.max - stats.xHist.min);
                    const x1 = stats.xHist.min + ((gx + 1) / N) * (stats.xHist.max - stats.xHist.min);
                    const y0 = stats.yHist.min + (gy / N) * (stats.yHist.max - stats.yHist.min);
                    const y1 = stats.yHist.min + ((gy + 1) / N) * (stats.yHist.max - stats.yHist.min);

                    return (
                      <g
                        key={`${gx}_${gy}`}
                        className="cursor-pointer"
                        onMouseEnter={(e) => {
                          tooltipCtx.show(e, `Joint 2D Frequency Bin`, [
                            { label: `${xMeta.label} Bin`, value: `${x0.toFixed(1)} to ${x1.toFixed(1)} ${xMeta.unit}`, color: '#0d9488' },
                            { label: `${yMeta.label} Bin`, value: `${y0.toFixed(1)} to ${y1.toFixed(1)} ${yMeta.unit}`, color: '#6366f1' },
                            { label: 'Sampled Hours', value: `${cnt} hrs (${((cnt / Math.max(1, filtered.length)) * 100).toFixed(1)}%)`, color: '#38bdf8' }
                          ]);
                        }}
                        onMouseMove={(e) => tooltipCtx.move(e)}
                        onMouseLeave={() => tooltipCtx.hide()}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={cw - 1}
                          height={ch - 1}
                          fill={fill}
                          rx={2}
                          className="hover:opacity-90 transition"
                        />
                        {cnt > 0 && (
                          <text
                            x={x + cw / 2}
                            y={y + ch / 2 + 3}
                            textAnchor="middle"
                            fontSize="8"
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

                <text x={padL + plotW / 2} y={H - 12} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#cbd5e1">
                  {xMeta.label} ({stats.xHist.min} → {stats.xHist.max} {xMeta.unit})
                </text>
                <text
                  x={16}
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="700"
                  fill="#cbd5e1"
                  transform={`rotate(-90, 16, ${padT + plotH / 2})`}
                >
                  {yMeta.label} ({stats.yHist.min} → {stats.yHist.max} {yMeta.unit})
                </text>
              </svg>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1 font-medium pt-2 border-t border-slate-200 mt-2">
                <span className="font-semibold text-slate-700">
                  2D Frequency Density (12 × 12 Bins • Total {filtered.length.toLocaleString()} h Filtered)
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-medium">Binned Frequency Heatmap</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-800 font-mono">0h</span>
                    <div
                      className="w-44 sm:w-60 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                      style={{ background: 'linear-gradient(to right, #0f172a 0%, #1e3a8a 25%, #0284c7 50%, #10b981 75%, #f59e0b 100%)' }}
                    />
                    <span className="text-[11px] font-bold text-slate-800 font-mono">{stats.maxBinCount}h</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      </ClimaChartCard>
      </div>
    </div>
  );
};

