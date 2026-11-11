import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Globe,
  Sun,
  Thermometer,
  Wind,
  Compass,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Upload,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Layers,
  Activity,
  BarChart3,
  LayoutGrid,
  Maximize2,
  Calendar
} from 'lucide-react';
import { useDesignProject } from '../context/DesignProjectContext';
import { INITIAL_CLIMATE_PRESETS, MONTHS } from '../data/climateAndStrategies';
import { calcSolarPosition, extractEpwFromZipBuffer } from '../utils/epwEngine';
import {
  ClimaSubTabId,
  EpwQualityReport,
  validateEpwDataset,
  parseEpwFileWithQuality,
  calcCustomDegreeDays,
  calcDistributionHistogram,
  calcDailyTempAndRunningMean,
  calcMonthlyDiurnalProfiles,
  calcSolarBoxplotsAndFacadeRose,
  generateBoardReadyCommentary
} from '../utils/epwParser';
import { EpwSearchAndUploadWidget } from './ClimaAndAdvancedPanels';
import {
  ClimaChartCard,
  CarpetHeatmap24x365,
  colorForTempC,
  colorForRhPct,
  SubTab5Wind,
  SubTab6Psychrometric,
  SubTab7NatVent,
  SubTab8Utci,
  SubTab9DataExplorer
} from './ClimaStudioSubTabs';

const CLIMA_SUB_TABS: Array<{
  id: ClimaSubTabId;
  shortLabel: string;
  subtitle: string;
}> = [
  { id: 'station_map', shortLabel: '1. Station & Map', subtitle: '23,227 EPW Map & Upload' },
  { id: 'summary', shortLabel: '2. Climate Summary', subtitle: 'HDD/CDD & Distributions' },
  { id: 'temp_rh', shortLabel: '3. Temp & Humidity', subtitle: 'Adaptive Bands & Diurnal' },
  { id: 'sun_clouds', shortLabel: '4. Sun & Shading Mask', subtitle: 'Protractor & Urban Skyline' },
  { id: 'wind', shortLabel: '5. Wind', subtitle: 'Seasonal/Diurnal Rose' },
  { id: 'psychrometric', shortLabel: '6. Psychrometric', subtitle: '6 Bioclimatic Polygons' },
  { id: 'nat_vent', shortLabel: '7. Nat. Ventilation', subtitle: 'Dew-Point & Window Hours' },
  { id: 'utci', shortLabel: '8. Outdoor UTCI', subtitle: '4 Microclimate Scenarios' },
  { id: 'explorer', shortLabel: '9. Data Explorer', subtitle: 'X/Y/Z Joint Correlation' }
];

export interface Stage1ClimateProps {
  stage1WideMode?: boolean;
  setStage1WideMode?: (v: boolean) => void;
}

export const Stage1Climate: React.FC<Stage1ClimateProps> = ({
  stage1WideMode = true,
  setStage1WideMode
}) => {
  const {
    climateId,
    setClimateId,
    customClimates,
    addAndSelectClimate,
    climate,
    comfortTempLower,
    comfortTempUpper,
    activeStrategies,
    toggleStrategy,
    setActiveStrategiesList,
    morphTempOffsetC,
    setMorphTempOffsetC,
    morphWindMult,
    setMorphWindMult,
    morphRhOffsetPct,
    setMorphRhOffsetPct,
    globalValueRanges,
    setGlobalValueRanges,
    overhangDepth,
    setOverhangDepth,
    setShadingMode,
    sim,
    setActiveStage
  } = useDesignProject();

  const [activeSubTab, setActiveSubTab] = useState<ClimaSubTabId>('summary');
  const [uploadedQuality, setUploadedQuality] = useState<EpwQualityReport | null>(null);

  useEffect(() => {
    const handler = () => setActiveSubTab('station_map');
    window.addEventListener('polimi:open-station-map', handler);
    return () => window.removeEventListener('polimi:open-station-map', handler);
  }, []);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [copiedAnnotation, setCopiedAnnotation] = useState(false);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  // Sub-Tab 2: Degree Days Base Temp controls (CBE Clima defaults: Heating 18°C, Cooling 10°C)
  const [hddBaseC, setHddBaseC] = useState<number>(18);
  const [cddBaseC, setCddBaseC] = useState<number>(10);

  // Chart Layout Density: Spacious (Full-Width, High Resolution) vs Compact (2-Col Comparison)
  const [chartDensity, setChartDensity] = useState<'spacious' | 'compact'>('spacious');

  // Sub-Tab 3: Diurnal Facet / Zoom / Seasons View Mode
  const [diurnalMetric, setDiurnalMetric] = useState<'temp' | 'rh' | 'both'>('both');
  const [diurnalViewMode, setDiurnalViewMode] = useState<'facets' | 'zoom' | 'seasons'>('facets');
  const [diurnalZoomMonth, setDiurnalZoomMonth] = useState<number>(6); // July default (0-indexed)

  // Interactive Hover Trackers for 60fps non-flicker charts
  const [activeTempDayHover, setActiveTempDayHover] = useState<number | null>(null);
  const [activeRhDayHover, setActiveRhDayHover] = useState<number | null>(null);
  const [activeHddMonthHover, setActiveHddMonthHover] = useState<number | null>(null);
  const [activeDiurnalHourHover, setActiveDiurnalHourHover] = useState<number | null>(null);
  const [activeSolarMonthHover, setActiveSolarMonthHover] = useState<number | null>(null);
  const [activeCloudMonthHover, setActiveCloudMonthHover] = useState<number | null>(null);

  // Sub-Tab 4: Sun Path & Shading Protractor controls (Improvement #2)
  const [sunProjection, setSunProjection] = useState<'polar' | 'cartesian'>('polar');
  const [sunColorMode, setSunColorMode] = useState<'temp' | 'ghi'>('temp');
  const [overhangAngleDeg, setOverhangAngleDeg] = useState<number>(58);
  const [finAngleDeg, setFinAngleDeg] = useState<number>(35);
  const [showProtractor, setShowProtractor] = useState<boolean>(true);
  const [showUrbanSkylineMask, setShowUrbanSkylineMask] = useState<boolean>(true);

  // Compute Data Quality Report for active climate
  const qualityReport = useMemo<EpwQualityReport>(() => {
    if (uploadedQuality && climate.sourceType === 'epw-upload') {
      return uploadedQuality;
    }
    return validateEpwDataset(climate);
  }, [climate, uploadedQuality]);

  // Sub-Tab 2: Custom HDD/CDD & 4 Distribution Histograms
  const customDd = useMemo(
    () => calcCustomDegreeDays(climate.hourly, hddBaseC, cddBaseC),
    [climate.hourly, hddBaseC, cddBaseC]
  );

  const summaryDistributions = useMemo(() => {
    const temps = climate.hourly.map((h) => h.dryBulb);
    const rhs = climate.hourly.map((h) => h.relHum);
    const dayGhis = climate.hourly.filter((h) => h.ghi > 5).map((h) => h.ghi);
    const winds = climate.hourly.map((h) => h.windSpeed);

    return {
      temp: calcDistributionHistogram(temps, globalValueRanges ? -20 : undefined, globalValueRanges ? 45 : undefined, 16),
      rh: calcDistributionHistogram(rhs, 0, 100, 16),
      ghi: calcDistributionHistogram(dayGhis, 0, globalValueRanges ? 1100 : undefined, 16),
      wind: calcDistributionHistogram(winds, 0, globalValueRanges ? 18 : undefined, 16)
    };
  }, [climate.hourly, globalValueRanges]);

  // Sub-Tab 3: Daily Running Mean Adaptive Comfort + 12 Monthly Diurnal Profiles
  const dailyAdaptive = useMemo(
    () => calcDailyTempAndRunningMean(climate.hourly),
    [climate.hourly]
  );

  const monthlyDiurnals = useMemo(
    () => calcMonthlyDiurnalProfiles(climate.hourly),
    [climate.hourly]
  );

  // Sub-Tab 4: Solar Boxplots & 8-Direction Facade Rose
  const solarAnalytics = useMemo(
    () => calcSolarBoxplotsAndFacadeRose(climate.hourly),
    [climate.hourly]
  );

  // Improvement #5: Board-Ready Commentary for Active Sub-Tab
  const boardCommentary = useMemo(
    () => generateBoardReadyCommentary(activeSubTab, climate, qualityReport),
    [activeSubTab, climate, qualityReport]
  );

  // Drag-and-drop .epw or .zip handler
  const handleEpwOrZipFile = async (file: File) => {
    setUploadErrorMsg(null);
    setUploadStatusMsg(`Validating & parsing ${file.name}...`);
    try {
      let epwText = '';
      if (file.name.toLowerCase().endsWith('.zip')) {
        const buf = await file.arrayBuffer();
        const extracted = await extractEpwFromZipBuffer(buf);
        if (!extracted) throw new Error('No .epw file found inside the uploaded .zip archive.');
        epwText = extracted;
      } else {
        epwText = await file.text();
      }
      const { dataset, quality } = parseEpwFileWithQuality(
        epwText,
        file.name.replace(/\.(epw|zip)$/i, '')
      );
      setUploadedQuality(quality);
      addAndSelectClimate(dataset);
      setUploadStatusMsg(
        `Loaded ${dataset.name} (${quality.totalHours.toLocaleString()} hrs • Quality ${quality.qualityScorePct}%)`
      );
    } catch (err: any) {
      setUploadErrorMsg(err?.message || 'Failed to parse .epw file');
      setUploadStatusMsg(null);
    }
  };

  const isMorphed =
    Math.abs(morphTempOffsetC) > 0.01 ||
    Math.abs(morphWindMult - 1.0) > 0.01 ||
    Math.abs(morphRhOffsetPct) > 0.1;

  return (
    <div className="space-y-4">
      {/* =====================================================================
          PERSISTENT TOP BAR: STATION METADATA + QUALITY BADGE + WEATHER MORPHING
         ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white rounded-2xl p-4 border border-slate-700 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[10px] font-bold uppercase tracking-wider">
                Stage 1 • CBE Clima+ Bioclimatic Studio
              </span>
              <span className="text-xs text-slate-300 font-mono">
                {climate.lat.toFixed(2)}°N, {climate.lon.toFixed(2)}°E • Elev {climate.elev}m • WMO {qualityReport.wmoStation}
              </span>
              {/* Improvement #1: Data Quality Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 border ${
                  qualityReport.status === 'VERIFIED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : qualityReport.status === 'REPAIRED'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                }`}
                title={qualityReport.notes.join(' ')}
              >
                {qualityReport.status === 'REPAIRED' ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <ShieldCheck className="w-3 h-3" />
                )}
                EPW Quality: {qualityReport.qualityScorePct}% ({qualityReport.status})
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 min-h-[30px] flex-wrap">
              <h2 className="text-lg font-bold text-white truncate max-w-sm xl:max-w-md" title={climate.name}>
                {climate.name}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-semibold shrink-0" title={climate.koppenDesc}>
                Köppen {climate.koppen} — {climate.koppenDesc}
              </span>
              {climate.period && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-200 border border-sky-400/50 font-bold shrink-0">
                  {climate.period === 'full' ? 'TMYx Full Period' : `TMYx ${climate.period}`}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/50 font-bold shrink-0 transition-opacity duration-150 ${
                  isMorphed ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                Morphed ({morphTempOffsetC >= 0 ? `+${morphTempOffsetC.toFixed(1)}` : morphTempOffsetC.toFixed(1)}°C, ×{morphWindMult.toFixed(1)} Wind)
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Classification: {climate.koppen} ({climate.koppenDesc}) • Italian Statutory Zone {climate.dpr412Zone} ({climate.dpr412Schedule})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 block">HDD₁₈ / CDD₁₈</span>
              <span className="font-bold text-white">
                {climate.hdd} / {climate.cdd} K·d
              </span>
            </div>
            <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Design 99.6% / 0.4%</span>
              <span className="font-bold text-amber-300">
                {qualityReport.designHeat996}°C / {qualityReport.designCool004}°C
              </span>
            </div>
            <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 block">Coupled Net Site EUI</span>
              <span className="font-bold text-teal-300">{sim.netSiteEui} kWh/m²yr</span>
            </div>
            {setStage1WideMode && (
              <button
                type="button"
                onClick={() => setStage1WideMode(!stage1WideMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow transition ${
                  stage1WideMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                }`}
                title="Toggle between wide studio canvas and split 50/50 sidebar view"
              >
                <Layers className="w-3.5 h-3.5" />
                {stage1WideMode ? 'Canvas: Wide (100%)' : 'Canvas: Split (50%)'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setChartDensity(chartDensity === 'spacious' ? 'compact' : 'spacious')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow transition ${
                chartDensity === 'spacious'
                  ? 'bg-teal-400 text-slate-950 border-teal-300'
                  : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
              }`}
              title="Toggle between Spacious (Full-Width, High Resolution) and Compact (2-Column Grid) chart representation"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {chartDensity === 'spacious' ? 'Charts: Spacious (1-Col)' : 'Charts: Compact (2-Col)'}
            </button>
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

        {/* Improvement #1 Bar: Global vs Local Value Ranges + Elements-Style Weather Morphing */}
        <div className="pt-2.5 border-t border-slate-700/80 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center text-xs">
          {/* Global vs Local Y-Axis Toggle (3 cols) */}
          <div className="lg:col-span-3 flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-700">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-teal-300 font-bold block">
                Chart Axis Scaling
              </span>
              <span className="text-[11px] text-slate-300">
                {globalValueRanges ? 'Global Earth Extremes' : 'Auto-Fit Local EPW'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalValueRanges(!globalValueRanges)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                globalValueRanges
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-800 text-slate-200 border border-slate-600'
              }`}
            >
              {globalValueRanges ? 'Global Locked' : 'Local Fit'}
            </button>
          </div>

          {/* Weather Morphing Sliders (9 cols) */}
          <div className="lg:col-span-9 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-700 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
                  Elements Weather Morphing (UHI / IPCC 2050)
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {[
                    { label: '+0°C Base', dt: 0 },
                    { label: '+1.5°C UHI', dt: 1.5 },
                    { label: '+2.5°C 2050', dt: 2.5 },
                    { label: '+3.5°C 2080', dt: 3.5 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setMorphTempOffsetC(p.dt)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                        Math.abs(morphTempOffsetC - p.dt) < 0.05
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="w-32 xl:w-36 shrink-0">
                <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                  <span>Temp Offset ΔT</span>
                  <span className="font-bold text-amber-300 font-mono tabular-nums inline-block text-right w-14">
                    {morphTempOffsetC >= 0 ? `+${morphTempOffsetC.toFixed(1)}` : morphTempOffsetC.toFixed(1)}°C
                  </span>
                </div>
                <input
                  type="range"
                  min={-2.0}
                  max={4.0}
                  step={0.5}
                  value={morphTempOffsetC}
                  onChange={(e) => setMorphTempOffsetC(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </label>

              <label className="w-28 xl:w-32 shrink-0">
                <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                  <span>Wind Speed ×</span>
                  <span className="font-bold text-sky-300 font-mono tabular-nums inline-block text-right w-12">
                    ×{morphWindMult.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.8}
                  step={0.1}
                  value={morphWindMult}
                  onChange={(e) => setMorphWindMult(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </label>

              <label className="w-28 xl:w-32 shrink-0">
                <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                  <span>Humidity Shift</span>
                  <span className="font-bold text-teal-300 font-mono tabular-nums inline-block text-right w-12">
                    {morphRhOffsetPct >= 0 ? `+${morphRhOffsetPct}` : morphRhOffsetPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={-20}
                  max={20}
                  step={5}
                  value={morphRhOffsetPct}
                  onChange={(e) => setMorphRhOffsetPct(Number(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />
              </label>

              {/* Reset button: ALWAYS present in DOM to prevent layout shift */}
              <div className="w-16 shrink-0 flex items-center justify-center">
                <button
                  type="button"
                  disabled={!isMorphed}
                  onClick={() => {
                    setMorphTempOffsetC(0);
                    setMorphWindMult(1.0);
                    setMorphRhOffsetPct(0);
                  }}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
                    isMorphed
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 opacity-100 cursor-pointer shadow-sm'
                      : 'opacity-0 pointer-events-none border-transparent'
                  }`}
                  title="Reset morphing offsets"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          9 ARTICULATED SUB-TABS NAVIGATION BAR
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex items-center gap-1 overflow-x-auto">
        {CLIMA_SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 py-2 rounded-xl text-left transition shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-extrabold whitespace-nowrap">{tab.shortLabel}</div>
              <div className={`text-[10px] whitespace-nowrap ${isActive ? 'text-teal-300' : 'text-slate-400'}`}>
                {tab.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          SUB-TAB 1: SELECT WEATHER STATION & MAP
         ===================================================================== */}
      {activeSubTab === 'station_map' && (
        <div className="space-y-5">
          {/* Row 1: Drag-and-Drop .EPW Upload Zone + Built-in High-Resolution 8,760h Presets */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Drag-and-Drop .EPW Upload & Validator Card (5 cols) */}
            <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-teal-600" />
                  Client-Side .EPW / .ZIP Drag-and-Drop Parser & Validator
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Reads all 8 EPW header lines (Location, Design Conditions, Ground Temps) & 8,760 hourly rows with automatic spike/radiation quality checks
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleEpwOrZipFile(f);
                  }}
                  onClick={() => dropInputRef.current?.click()}
                  className={`mt-3 border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition ${
                    isDraggingFile
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-teal-50/30'
                  }`}
                >
                  <Upload className="w-7 h-7 text-teal-600 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-800">
                    Drop any EnergyPlus <code className="text-teal-700">.epw</code> or OneBuilding <code className="text-teal-700">.zip</code> file here
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    or click to browse local weather files (100% client-side parsing)
                  </p>
                  <input
                    ref={dropInputRef}
                    type="file"
                    accept=".epw,.zip"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleEpwOrZipFile(f);
                    }}
                  />
                </div>

                {uploadStatusMsg && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    {uploadStatusMsg}
                  </div>
                )}
                {uploadErrorMsg && (
                  <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {uploadErrorMsg}
                  </div>
                )}
              </div>

              {/* Quick Links to Climate.OneBuilding.org, Ladybug EPWMap & NASA POWER */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-[11px]">
                <span className="font-bold text-slate-700 block">
                  External Repositories & Satellite TMY Generators:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://climate.onebuilding.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 font-bold flex items-center gap-1"
                  >
                    Climate.OneBuilding.org <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://www.ladybug.tools/epwmap/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 font-bold flex items-center gap-1"
                  >
                    Ladybug EPWMap <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://power.larc.nasa.gov/data-access-viewer/"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 font-bold flex items-center gap-1"
                  >
                    NASA POWER Viewer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Built-In 8,760h Benchmark Climate Presets (7 cols) */}
            <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Built-In 8,760-Hour Reference Climate Presets (Instant Switching)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Includes Milan/Mantova (Cfa), Vevey/Lausanne (Cfb), Rome (Csa), Stockholm (Dfb), Cairo (BWh), Palermo (Csa), and Bormio (Dfb)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {Object.values(INITIAL_CLIMATE_PRESETS).map((preset) => {
                  const selected = climateId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setClimateId(preset.id)}
                      className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                        selected
                          ? 'bg-teal-50/80 border-teal-600 shadow-sm'
                          : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {preset.lat.toFixed(2)}°N, {preset.lon.toFixed(2)}°E • Elev {preset.elev}m • HDD {preset.hdd} / CDD {preset.cdd}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-900 text-teal-300">
                          {preset.koppen}
                        </span>
                        <span className="block text-[9.5px] font-semibold text-slate-500 mt-0.5 max-w-[150px] truncate" title={preset.koppenDesc}>
                          {preset.koppenDesc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive 23,227-Station World Map & Live OneBuilding/DOE/Open-Meteo Loader */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <EpwSearchAndUploadWidget
              currentClimate={climate}
              customClimates={customClimates}
              onSelectClimate={(ds) => {
                setUploadedQuality(validateEpwDataset(ds));
                addAndSelectClimate(ds);
              }}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: CLIMATE SUMMARY (METADATA + INTERACTIVE HDD/CDD + 4 VIOLIN/HISTOGRAMS)
         ===================================================================== */}
      {activeSubTab === 'summary' && (
        <div className="space-y-5">
          {/* Metadata Header Table & Ground Temperatures */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-teal-600" />
                EPW Header Metadata, ASHRAE Design Conditions & Ground Temperatures
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {qualityReport.notes[0]}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Coordinates</span>
                <span className="font-extrabold text-slate-800 text-xs block leading-tight my-1">
                  {climate.lat.toFixed(2)}°N, {climate.lon.toFixed(2)}°E
                </span>
                <span className="text-[9.5px] text-slate-400 block font-mono">Lat/Lon</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Elevation / WMO</span>
                <span className="font-extrabold text-slate-800 text-xs block leading-tight my-1">
                  {climate.elev} m
                </span>
                <span className="text-[9.5px] text-slate-500 block font-mono">
                  WMO #{qualityReport.wmoStation}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Köppen Class</span>
                <div className="my-0.5">
                  <div className="font-extrabold text-teal-800 text-sm leading-none flex items-center gap-1">
                    {climate.koppen}
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-mono">
                      Zone {climate.ashraeZone.split(' ')[0]}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-semibold text-teal-700 block leading-tight mt-1" title={climate.koppenDesc}>
                    {climate.koppenDesc}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Mean Annual T_db</span>
                <span className="font-extrabold text-slate-800 text-xs block leading-tight my-1">
                  {qualityReport.meanAnnualTemp}°C
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  {qualityReport.meanAnnualRh}% Mean RH
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">99% / 99.6% Heat</span>
                <span className="font-extrabold text-sky-700 text-xs block leading-tight my-1">
                  {qualityReport.designHeat996}°C
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  99%: {qualityReport.designHeat99}°C
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">1% / 0.4% Cool</span>
                <span className="font-extrabold text-rose-600 text-xs block leading-tight my-1">
                  {qualityReport.designCool004}°C
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  1%: {qualityReport.designCool01}°C
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Annual Horiz Solar</span>
                <span className="font-extrabold text-amber-600 text-xs block leading-tight my-1">
                  {qualityReport.annualGhiKwhM2}
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  kWh/m²yr GHI
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Diffuse Sky Share</span>
                <span className="font-extrabold text-indigo-700 text-xs block leading-tight my-1">
                  {qualityReport.diffuseFractionPct}%
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  {qualityReport.annualDhiKwhM2} kWh/m² DHI
                </span>
              </div>
            </div>

            {/* Ground Temperatures Row (0.5m, 2.0m, 4.0m) */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-1.5 text-left rounded-l-lg">Ground Temp Depth (EPW Line 4)</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="p-1.5 text-center">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qualityReport.groundTemps.map((gt) => (
                    <tr key={gt.depthMeters} className="border-b border-slate-100">
                      <td className="p-1.5 font-bold text-slate-700">Depth {gt.depthMeters.toFixed(1)} m (°C)</td>
                      {gt.monthlyTemps.map((t, idx) => (
                        <td key={idx} className="p-1.5 text-center font-mono text-slate-600">
                          {t.toFixed(1)}°
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Monthly HDD / CDD Grouped Bar Chart (CBE Clima Standard) */}
          <ClimaChartCard
            title={`Interactive Monthly Heating & Cooling Degree Days (HDD_${hddBaseC} = ${customDd.annualHdd} • CDD_${cddBaseC} = ${customDd.annualCdd} K·d)`}
            subtitle="Computed from daily mean dry-bulb temperatures across 365 days (CBE Clima default: Heating Base 18°C, Cooling Base 10°C)"
            icon={<BarChart3 className="w-4 h-4 text-rose-500" />}
            svgFilename={`${climate.id}_hdd_cdd.svg`}
            csvFilename={`${climate.id}_hdd_cdd.csv`}
            onBuildCsv={() => ({
              headers: ['Month', `HDD_base_${hddBaseC}C`, `CDD_base_${cddBaseC}C`],
              rows: MONTHS.map((m, i) => [m, customDd.monthlyHdd[i], customDd.monthlyCdd[i]])
            })}
            controls={
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex items-center gap-2 font-semibold text-sky-800">
                    <span className="w-36 flex justify-between items-center">
                      <span>Heating Base:</span>
                      <strong className="font-mono tabular-nums w-10 text-right inline-block">{hddBaseC}°C</strong>
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={22}
                      step={1}
                      value={hddBaseC}
                      onChange={(e) => setHddBaseC(Number(e.target.value))}
                      className="w-28 accent-sky-600 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-rose-800">
                    <span className="w-36 flex justify-between items-center">
                      <span>Cooling Base:</span>
                      <strong className="font-mono tabular-nums w-10 text-right inline-block">{cddBaseC}°C</strong>
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={26}
                      step={1}
                      value={cddBaseC}
                      onChange={(e) => setCddBaseC(Number(e.target.value))}
                      className="w-28 accent-rose-600 cursor-pointer"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setHddBaseC(18);
                      setCddBaseC(10);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition ${
                      hddBaseC === 18 && cddBaseC === 10
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    CBE Clima (18°C / 10°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHddBaseC(18);
                      setCddBaseC(18);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition ${
                      hddBaseC === 18 && cddBaseC === 18
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ASHRAE (18°C / 18°C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHddBaseC(16);
                      setCddBaseC(18);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition ${
                      hddBaseC === 16 && cddBaseC === 18
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Passivhaus (16°C / 18°C)
                  </button>
                </div>
              </div>
            }
          >
            {(svgRef, tooltipCtx) => {
              const W = 880;
              const H = 280;
              const padL = 50;
              const padR = 24;
              const padT = 26;
              const padB = 34;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const maxVal = Math.max(
                200,
                ...MONTHS.map((_, i) => Math.max(customDd.monthlyHdd[i], customDd.monthlyCdd[i]))
              );
              const colW = plotW / 12;
              const xForM = (i: number) => padL + (i + 0.5) * colW;

              return (
                <div className="space-y-2">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
                      const v = Math.round(maxVal * f);
                      const y = padT + plotH - f * plotH;
                      return (
                        <g key={idx}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                          <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                            {v}
                          </text>
                        </g>
                      );
                    })}

                    {MONTHS.map((m, i) => {
                      const hdd = customDd.monthlyHdd[i];
                      const cdd = customDd.monthlyCdd[i];
                      const hHdd = (hdd / maxVal) * plotH;
                      const hCdd = (cdd / maxVal) * plotH;
                      const x = xForM(i);
                      const isHovered = activeHddMonthHover === i;
                      const barW = Math.min(22, (colW - 10) / 2);

                      return (
                        <g key={m}>
                          {/* Column Highlight Backdrop */}
                          {isHovered && (
                            <rect
                              x={x - colW / 2 + 2}
                              y={padT}
                              width={colW - 4}
                              height={plotH}
                              fill="rgba(56, 189, 248, 0.08)"
                              rx={6}
                              pointerEvents="none"
                            />
                          )}

                          {/* Grouped HDD Bar (Left, Blue) */}
                          <rect
                            x={x - barW - 1}
                            y={padT + plotH - hHdd}
                            width={barW}
                            height={Math.max(1, hHdd)}
                            fill={isHovered ? '#0284c7' : '#0369a1'}
                            rx={3}
                            className="transition-colors"
                          />
                          {hdd > 0 && (
                            <text
                              x={x - barW / 2 - 1}
                              y={Math.max(padT + 11, padT + plotH - hHdd - 4)}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="700"
                              fill="#0369a1"
                            >
                              {hdd}
                            </text>
                          )}

                          {/* Grouped CDD Bar (Right, Red) */}
                          <rect
                            x={x + 1}
                            y={padT + plotH - hCdd}
                            width={barW}
                            height={Math.max(1, hCdd)}
                            fill={isHovered ? '#e11d48' : '#be123c'}
                            rx={3}
                            className="transition-colors"
                          />
                          {cdd > 0 && (
                            <text
                              x={x + barW / 2 + 1}
                              y={Math.max(padT + 11, padT + plotH - hCdd - 4)}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="700"
                              fill="#be123c"
                            >
                              {cdd}
                            </text>
                          )}

                          {/* Month Label */}
                          <text
                            x={x}
                            y={H - 10}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight={isHovered ? '800' : '600'}
                            fill={isHovered ? '#0f172a' : '#475569'}
                          >
                            {m}
                          </text>

                          {/* Single Month Column Unified Hover Area */}
                          <rect
                            x={x - colW / 2}
                            y={padT}
                            width={colW}
                            height={plotH + 20}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={(e) => {
                              setActiveHddMonthHover(i);
                              tooltipCtx.show(e, `${m} Degree Days (CBE Clima)`, [
                                { label: `Heating Demand (HDD_${hddBaseC})`, value: `${hdd} K·d`, color: '#0284c7' },
                                { label: `Cooling Demand (CDD_${cddBaseC})`, value: `${cdd} K·d`, color: '#e11d48' },
                                { label: 'Combined Total Demand', value: `${hdd + cdd} K·d` },
                                { label: 'Annual Heating Share', value: `${customDd.annualHdd > 0 ? Math.round((hdd / customDd.annualHdd) * 100) : 0}%` },
                                { label: 'Annual Cooling Share', value: `${customDd.annualCdd > 0 ? Math.round((cdd / customDd.annualCdd) * 100) : 0}%` },
                                { label: 'Active Baseline Setting', value: `HDD Base ${hddBaseC}°C • CDD Base ${cddBaseC}°C` }
                              ]);
                            }}
                            onMouseMove={(e) => tooltipCtx.move(e)}
                            onMouseLeave={() => {
                              setActiveHddMonthHover(null);
                              tooltipCtx.hide();
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold pt-1">
                    <span className="flex items-center gap-1.5 text-sky-700">
                      <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" />
                      Heating Degree Days (HDD_{hddBaseC}°C = {customDd.annualHdd} K·d)
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <span className="w-3 h-3 rounded-sm bg-rose-600 inline-block" />
                      Cooling Degree Days (CDD_{cddBaseC}°C = {customDd.annualCdd} K·d)
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      Total Annual Climate Conditioning Demand: <strong>{customDd.annualHdd + customDd.annualCdd} K·d</strong>
                    </span>
                  </div>
                </div>
              );
            }}
          </ClimaChartCard>

          {/* 4 Distribution Histograms / Density Plots (T_db, RH, GHI, Wind Speed) */}
          <div className={`grid grid-cols-1 ${chartDensity === 'spacious' ? 'md:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'} gap-4`}>
            {[
              {
                key: 'temp',
                title: 'Dry-Bulb Temp Distribution (°C)',
                unit: '°C',
                color: '#f97316',
                stats: summaryDistributions.temp
              },
              {
                key: 'rh',
                title: 'Relative Humidity Distribution (%)',
                unit: '%',
                color: '#0284c7',
                stats: summaryDistributions.rh
              },
              {
                key: 'ghi',
                title: 'Daytime Solar GHI Distribution (Wh/m²)',
                unit: 'Wh/m²',
                color: '#eab308',
                stats: summaryDistributions.ghi
              },
              {
                key: 'wind',
                title: 'Wind Velocity Distribution (m/s)',
                unit: 'm/s',
                color: '#0d9488',
                stats: summaryDistributions.wind
              }
            ].map((item) => (
              <ClimaChartCard
                key={item.key}
                title={item.title}
                subtitle={`Min ${item.stats.min} • Med ${item.stats.median} • Mean ${item.stats.mean} • Max ${item.stats.max} ${item.unit}`}
                svgFilename={`${climate.id}_dist_${item.key}.svg`}
                csvFilename={`${climate.id}_dist_${item.key}.csv`}
                onBuildCsv={() => ({
                  headers: ['BinStart', 'BinEnd', 'HoursCount', 'Share_%'],
                  rows: item.stats.bins.map((b) => [b.x0, b.x1, b.count, b.pct])
                })}
              >
                {(svgRef, tooltipCtx) => {
                  const W = 440;
                  const H = 230;
                  const padL = 36;
                  const padR = 16;
                  const padT = 18;
                  const padB = 30;
                  const plotW = W - padL - padR;
                  const plotH = H - padT - padB;
                  const maxPct = Math.max(5, ...item.stats.bins.map((b) => b.pct));

                  return (
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      {[0, 0.5, 1].map((f, idx) => {
                        const v = Math.round(maxPct * f);
                        const y = padT + plotH - f * plotH;
                        return (
                          <g key={idx}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="9.5" fontWeight="600" fill="#94a3b8">
                              {v}%
                            </text>
                          </g>
                        );
                      })}
                      {item.stats.bins.map((b, i) => {
                        const bw = plotW / item.stats.bins.length - 2;
                        const x = padL + i * (plotW / item.stats.bins.length);
                        const bh = (b.pct / maxPct) * plotH;
                        const y = padT + plotH - bh;
                        return (
                          <rect
                            key={i}
                            x={x}
                            y={y}
                            width={Math.max(3, bw)}
                            height={Math.max(1, bh)}
                            fill={item.color}
                            fillOpacity={0.85}
                            rx={2.5}
                            className="cursor-pointer hover:opacity-100 hover:brightness-110 transition"
                            onMouseEnter={(e) => {
                              tooltipCtx.show(e, `${item.title.split(' (')[0]}`, [
                                { label: 'Bin Interval', value: `${b.x0} – ${b.x1} ${item.unit}`, color: item.color },
                                { label: 'Annual Hours in Range', value: `${b.count.toLocaleString()} hrs` },
                                { label: 'Percentage of Year', value: `${b.pct}%` },
                                { label: 'Median Baseline', value: `${item.stats.median} ${item.unit}` }
                              ]);
                            }}
                            onMouseMove={(e) => tooltipCtx.move(e)}
                            onMouseLeave={() => tooltipCtx.hide()}
                          />
                        );
                      })}
                      {/* IQR Box & Extremes */}
                      <text x={padL} y={H - 8} fontSize="9.5" fontWeight="600" fill="#64748b">
                        {item.stats.min}{item.unit}
                      </text>
                      <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e293b">
                        IQR: {item.stats.q25}–{item.stats.q75}{item.unit} (Med: {item.stats.median})
                      </text>
                      <text x={W - padR} y={H - 8} textAnchor="end" fontSize="9.5" fontWeight="600" fill="#64748b">
                        {item.stats.max}{item.unit}
                      </text>
                    </svg>
                  );
                }}
              </ClimaChartCard>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: TEMPERATURE & HUMIDITY (365d ADAPTIVE BANDS + 365d RH + 12 DIURNALS + HEATMAPS + STATS TABLE)
         ===================================================================== */}
      {activeSubTab === 'temp_rh' && (
        <div className="space-y-5">
          {/* 1. Yearly Dry-Bulb Temp & Yearly Relative Humidity Charts (365 Days) */}
          <div className={`grid grid-cols-1 ${chartDensity === 'spacious' ? 'gap-6' : 'xl:grid-cols-2 gap-5'}`}>
            <ClimaChartCard
              title="Yearly Dry-Bulb Temperature (365d) & ASHRAE 55 Adaptive Bands"
              subtitle="Daily Min–Max bars, daily mean curve, and 7-day running mean (α = 0.9) 80% (±3.5K) & 90% (±2.5K) bands"
              icon={<Thermometer className="w-4 h-4 text-rose-500" />}
              svgFilename={`${climate.id}_yearly_temp_adaptive.svg`}
              csvFilename={`${climate.id}_daily_adaptive_365.csv`}
              onBuildCsv={() => ({
                headers: ['DayOfYear', 'Month', 'Day', 'T_min', 'T_mean', 'T_max', 'T_runningMean', 'ASHRAE_Neutral', 'ASHRAE_80_Upper', 'ASHRAE_80_Lower', 'ASHRAE_90_Upper', 'ASHRAE_90_Lower'],
                rows: dailyAdaptive.map((d) => [
                  d.dayOfYear,
                  d.month + 1,
                  d.dayOfMonth,
                  d.tMin,
                  d.tMean,
                  d.tMax,
                  d.tRunningMean,
                  d.ashraeNeutral,
                  d.ashrae80Upper,
                  d.ashrae80Lower,
                  d.ashrae90Upper,
                  d.ashrae90Lower
                ])
              })}
            >
              {(svgRef, tooltipCtx) => {
                const W = 880;
                const H = chartDensity === 'spacious' ? 340 : 290;
                const padL = 46;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const tMin = globalValueRanges ? -25 : Math.min(-5, ...dailyAdaptive.map((d) => d.tMin));
                const tMax = globalValueRanges ? 48 : Math.max(38, ...dailyAdaptive.map((d) => d.tMax));
                const xForD = (d: number) => padL + ((d - 1) / 364) * plotW;
                const yForT = (t: number) => padT + plotH - ((t - tMin) / Math.max(1, tMax - tMin)) * plotH;

                const poly80Points = [
                  ...dailyAdaptive.map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForT(d.ashrae80Upper).toFixed(1)}`),
                  ...[...dailyAdaptive]
                    .reverse()
                    .map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForT(d.ashrae80Lower).toFixed(1)}`)
                ].join(' ');

                const poly90Points = [
                  ...dailyAdaptive.map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForT(d.ashrae90Upper).toFixed(1)}`),
                  ...[...dailyAdaptive]
                    .reverse()
                    .map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForT(d.ashrae90Lower).toFixed(1)}`)
                ].join(' ');

                const meanPoints = dailyAdaptive
                  .map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForT(d.tMean).toFixed(1)}`)
                  .join(' ');

                const hoveredD = activeTempDayHover ? dailyAdaptive[activeTempDayHover - 1] : null;

                return (
                  <div className="space-y-1.5">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      {[-10, 0, 10, 20, 30, 40].map((val) => {
                        if (val < tMin || val > tMax) return null;
                        const y = yForT(val);
                        return (
                          <g key={val}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                              {val}°C
                            </text>
                          </g>
                        );
                      })}

                      {/* ASHRAE 80% & 90% Adaptive Comfort Bands */}
                      <polygon points={poly80Points} fill="#10b981" fillOpacity={0.16} />
                      <polygon points={poly90Points} fill="#059669" fillOpacity={0.25} />

                      {/* Daily Min-Max Range Bars */}
                      {dailyAdaptive.map((d) => {
                        const x = xForD(d.dayOfYear);
                        const y1 = yForT(d.tMax);
                        const y2 = yForT(d.tMin);
                        const isHovered = activeTempDayHover === d.dayOfYear;
                        return (
                          <line
                            key={d.dayOfYear}
                            x1={x}
                            y1={y1}
                            x2={x}
                            y2={y2}
                            stroke={isHovered ? '#0284c7' : '#94a3b8'}
                            strokeWidth={isHovered ? 2.5 : 1.2}
                            strokeOpacity={isHovered ? 1 : 0.7}
                          />
                        );
                      })}

                      {/* Daily Mean Curve */}
                      <polyline fill="none" stroke="#e11d48" strokeWidth={1.8} points={meanPoints} />

                      {/* Interactive Guideline and Marker Dots */}
                      {hoveredD && (
                        <g pointerEvents="none">
                          <line
                            x1={xForD(hoveredD.dayOfYear)}
                            y1={padT}
                            x2={xForD(hoveredD.dayOfYear)}
                            y2={padT + plotH}
                            stroke="#0284c7"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForT(hoveredD.tMax)} r={3.5} fill="#e11d48" stroke="#ffffff" strokeWidth={1.5} />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForT(hoveredD.tMean)} r={5} fill="#ea580c" stroke="#ffffff" strokeWidth={2} />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForT(hoveredD.tMin)} r={3.5} fill="#0284c7" stroke="#ffffff" strokeWidth={1.5} />
                        </g>
                      )}

                      {MONTHS.map((m, i) => (
                        <text
                          key={m}
                          x={padL + (i + 0.5) * (plotW / 12)}
                          y={H - 10}
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="700"
                          fill="#475569"
                        >
                          {m}
                        </text>
                      ))}

                      {/* Single Unified Crosshair Pointer Overlay */}
                      <rect
                        x={padL}
                        y={padT}
                        width={plotW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseMove={(e) => {
                          const svg = svgRef.current;
                          if (!svg) return;
                          const pt = svg.createSVGPoint();
                          pt.x = e.clientX;
                          pt.y = e.clientY;
                          const c = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                          const dayIdx = Math.min(364, Math.max(0, Math.round(((c.x - padL) / plotW) * 364)));
                          const d = dailyAdaptive[dayIdx];
                          if (d) {
                            setActiveTempDayHover(d.dayOfYear);
                            tooltipCtx.show(e, `${MONTHS[d.month]} ${d.dayOfMonth} (Day ${d.dayOfYear})`, [
                              { label: 'Max Outdoor (T_max)', value: `${d.tMax}°C`, color: '#e11d48' },
                              { label: 'Daily Mean (T_mean)', value: `${d.tMean}°C`, color: '#ea580c' },
                              { label: 'Min Outdoor (T_min)', value: `${d.tMin}°C`, color: '#0284c7' },
                              { label: 'Diurnal Swing ΔT', value: `${(d.tMax - d.tMin).toFixed(1)} K` },
                              { label: '7-Day Running Mean', value: `${d.tRunningMean}°C`, color: '#059669' },
                              { label: 'ASHRAE 80% Band', value: `${d.ashrae80Lower}°C – ${d.ashrae80Upper}°C`, color: '#10b981' },
                              { label: 'ASHRAE 90% Band', value: `${d.ashrae90Lower}°C – ${d.ashrae90Upper}°C`, color: '#047857' }
                            ]);
                          }
                        }}
                        onMouseLeave={() => {
                          setActiveTempDayHover(null);
                          tooltipCtx.hide();
                        }}
                      />
                    </svg>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                        ASHRAE 55 Adaptive Comfort Bands (80% & 90% acceptability)
                      </span>
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-3 h-0.5 bg-rose-600 inline-block" /> Daily Mean Temperature • Blue/Red Range = Diurnal Swing
                      </span>
                    </div>
                  </div>
                );
              }}
            </ClimaChartCard>

            {/* Yearly Relative Humidity Chart (365 Days) - CBE Clima Standard */}
            <ClimaChartCard
              title="Yearly Relative Humidity Range (365d) & 30%–70% Comfort Band"
              subtitle="Daily Min–Max relative humidity range bars, daily mean curve (blue), and indoor/outdoor RH comfort band"
              icon={<Wind className="w-4 h-4 text-sky-500" />}
              svgFilename={`${climate.id}_yearly_rh_365.svg`}
              csvFilename={`${climate.id}_daily_rh_365.csv`}
              onBuildCsv={() => ({
                headers: ['DayOfYear', 'Month', 'Day', 'RH_min_%', 'RH_mean_%', 'RH_max_%'],
                rows: dailyAdaptive.map((d) => [d.dayOfYear, d.month + 1, d.dayOfMonth, d.rhMin, d.rhMean, d.rhMax])
              })}
            >
              {(svgRef, tooltipCtx) => {
                const W = 880;
                const H = chartDensity === 'spacious' ? 340 : 290;
                const padL = 46;
                const padR = 20;
                const padT = 20;
                const padB = 30;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const xForD = (d: number) => padL + ((d - 1) / 364) * plotW;
                const yForRh = (rh: number) => padT + plotH - (Math.max(0, Math.min(100, rh)) / 100) * plotH;

                const rhMeanPts = dailyAdaptive
                  .map((d) => `${xForD(d.dayOfYear).toFixed(1)},${yForRh(d.rhMean).toFixed(1)}`)
                  .join(' ');

                const hoveredD = activeRhDayHover ? dailyAdaptive[activeRhDayHover - 1] : null;

                return (
                  <div className="space-y-1.5">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      {[0, 20, 40, 60, 80, 100].map((val) => {
                        const y = yForRh(val);
                        return (
                          <g key={val}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                              {val}%
                            </text>
                          </g>
                        );
                      })}

                      {/* 30% - 70% Relative Humidity Comfort Band */}
                      <rect
                        x={padL}
                        y={yForRh(70)}
                        width={plotW}
                        height={yForRh(30) - yForRh(70)}
                        fill="#10b981"
                        fillOpacity={0.15}
                      />

                      {/* Daily RH Min-Max Range Bars */}
                      {dailyAdaptive.map((d) => {
                        const x = xForD(d.dayOfYear);
                        const y1 = yForRh(d.rhMax);
                        const y2 = yForRh(d.rhMin);
                        const isHovered = activeRhDayHover === d.dayOfYear;
                        return (
                          <line
                            key={d.dayOfYear}
                            x1={x}
                            y1={y1}
                            x2={x}
                            y2={y2}
                            stroke={isHovered ? '#0284c7' : '#93c5fd'}
                            strokeWidth={isHovered ? 2.5 : 1.2}
                            strokeOpacity={isHovered ? 1 : 0.75}
                          />
                        );
                      })}

                      {/* Daily Mean RH Curve */}
                      <polyline fill="none" stroke="#0284c7" strokeWidth={1.8} points={rhMeanPts} />

                      {/* Interactive Guideline and Marker Dots for RH */}
                      {hoveredD && (
                        <g pointerEvents="none">
                          <line
                            x1={xForD(hoveredD.dayOfYear)}
                            y1={padT}
                            x2={xForD(hoveredD.dayOfYear)}
                            y2={padT + plotH}
                            stroke="#0284c7"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForRh(hoveredD.rhMax)} r={3.5} fill="#0284c7" stroke="#ffffff" strokeWidth={1.5} />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForRh(hoveredD.rhMean)} r={5} fill="#0369a1" stroke="#ffffff" strokeWidth={2} />
                          <circle cx={xForD(hoveredD.dayOfYear)} cy={yForRh(hoveredD.rhMin)} r={3.5} fill="#38bdf8" stroke="#ffffff" strokeWidth={1.5} />
                        </g>
                      )}

                      {MONTHS.map((m, i) => (
                        <text
                          key={m}
                          x={padL + (i + 0.5) * (plotW / 12)}
                          y={H - 10}
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="700"
                          fill="#475569"
                        >
                          {m}
                        </text>
                      ))}

                      {/* Single Unified Crosshair Pointer Overlay for RH */}
                      <rect
                        x={padL}
                        y={padT}
                        width={plotW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseMove={(e) => {
                          const svg = svgRef.current;
                          if (!svg) return;
                          const pt = svg.createSVGPoint();
                          pt.x = e.clientX;
                          pt.y = e.clientY;
                          const c = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                          const dayIdx = Math.min(364, Math.max(0, Math.round(((c.x - padL) / plotW) * 364)));
                          const d = dailyAdaptive[dayIdx];
                          if (d) {
                            setActiveRhDayHover(d.dayOfYear);
                            const isComfort = d.rhMean >= 30 && d.rhMean <= 70;
                            tooltipCtx.show(e, `${MONTHS[d.month]} ${d.dayOfMonth} (Day ${d.dayOfYear})`, [
                              { label: 'Max Humidity (RH_max)', value: `${d.rhMax}%`, color: '#0284c7' },
                              { label: 'Daily Mean (RH_mean)', value: `${d.rhMean}%`, color: '#0369a1' },
                              { label: 'Min Humidity (RH_min)', value: `${d.rhMin}%`, color: '#38bdf8' },
                              { label: 'Diurnal RH Swing', value: `${(d.rhMax - d.rhMin).toFixed(0)}%` },
                              { label: 'Comfort Status (30–70%)', value: isComfort ? 'In Comfort Range' : d.rhMean > 70 ? 'Humid (>70%)' : 'Arid (<30%)', color: isComfort ? '#10b981' : '#f59e0b' }
                            ]);
                          }
                        }}
                        onMouseLeave={() => {
                          setActiveRhDayHover(null);
                          tooltipCtx.hide();
                        }}
                      />
                    </svg>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 font-medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                        Recommended Comfort Target: 30% to 70% Relative Humidity
                      </span>
                      <span className="flex items-center gap-2 font-bold">
                        <span className="w-3 h-0.5 bg-sky-600 inline-block" /> Daily Mean Humidity Curve
                      </span>
                    </div>
                  </div>
                );
              }}
            </ClimaChartCard>
          </div>

          {/* 2. Diurnal Hourly Profiles: Multi-Mode (12 Months Facets / Single Month Zoom / 4 Seasons) */}
          <ClimaChartCard
            title={`Diurnal Hourly Profiles (${diurnalViewMode === 'zoom' ? `${MONTHS[diurnalZoomMonth]} 24h Detail` : diurnalViewMode === 'seasons' ? '4 Seasonal Diurnals' : '12 Monthly Facets'})`}
            subtitle="Mean + 10th/90th percentile bands, night flushing ΔT potential, and interactive hourly inspection"
            icon={<Activity className="w-4 h-4 text-amber-500" />}
            svgFilename={`${climate.id}_diurnal_${diurnalViewMode}_${diurnalMetric}.svg`}
            csvFilename={`${climate.id}_diurnal_${diurnalViewMode}.csv`}
            onBuildCsv={() => ({
              headers: ['Month', 'Hour', 'T_db_P10', 'T_db_Mean', 'T_db_P90', 'RH_P10_%', 'RH_Mean_%', 'RH_P90_%', 'DiurnalSwing_K'],
              rows: monthlyDiurnals.flatMap((md) =>
                Array.from({ length: 24 }, (_, hr) => [
                  md.monthName,
                  hr,
                  md.hourlyTempP10[hr],
                  md.hourlyTempMean[hr],
                  md.hourlyTempP90[hr],
                  md.hourlyRhP10[hr],
                  md.hourlyRhMean[hr],
                  md.hourlyRhP90[hr],
                  md.diurnalSwingK
                ])
              )
            })}
            controls={
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* View Mode: Facets vs Zoom vs Seasons */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold">View Mode:</span>
                    {(
                      [
                        { id: 'facets', label: '12-Month Grid' },
                        { id: 'zoom', label: 'Single Month Zoom' },
                        { id: 'seasons', label: '4 Seasons' }
                      ] as const
                    ).map((vm) => (
                      <button
                        key={vm.id}
                        type="button"
                        onClick={() => setDiurnalViewMode(vm.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${
                          diurnalViewMode === vm.id
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {vm.label}
                      </button>
                    ))}
                  </div>

                  {/* Metric: Temp vs RH vs Both */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Variables:</span>
                    {(
                      [
                        { id: 'both', label: 'Combined (T_db + RH)' },
                        { id: 'temp', label: 'Dry-Bulb Temp (°C)' },
                        { id: 'rh', label: 'Relative Humidity (%)' }
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDiurnalMetric(m.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${
                          diurnalMetric === m.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* If Single Month Zoom Mode is active, render month pills */}
                {diurnalViewMode === 'zoom' && (
                  <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold pr-1">Target Month:</span>
                    {MONTHS.map((m, idx) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDiurnalZoomMonth(idx)}
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border transition ${
                          diurnalZoomMonth === idx
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          >
            {(svgRef, tooltipCtx) => {
              const tMin = globalValueRanges ? -15 : -5;
              const tMax = globalValueRanges ? 42 : 38;

              // CASE 1: Single Month Detailed Zoom (CBE Clima style 24h curve)
              if (diurnalViewMode === 'zoom') {
                const W = 880;
                const H = 340;
                const padL = 48;
                const padR = 48;
                const padT = 24;
                const padB = 34;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const md = monthlyDiurnals[diurnalZoomMonth];

                const xForHr = (hr: number) => padL + (hr / 23) * plotW;
                const yForT = (t: number) => padT + plotH - ((t - tMin) / (tMax - tMin)) * plotH;
                const yForRh = (rh: number) => padT + plotH - (rh / 100) * plotH;

                const tBandPts = [
                  ...md.hourlyTempP90.map((t, hr) => `${xForHr(hr).toFixed(1)},${yForT(t).toFixed(1)}`),
                  ...[...md.hourlyTempP10].reverse().map((t, idx) => `${xForHr(23 - idx).toFixed(1)},${yForT(t).toFixed(1)}`)
                ].join(' ');

                const rhBandPts = [
                  ...md.hourlyRhP90.map((rh, hr) => `${xForHr(hr).toFixed(1)},${yForRh(rh).toFixed(1)}`),
                  ...[...md.hourlyRhP10].reverse().map((rh, idx) => `${xForHr(23 - idx).toFixed(1)},${yForRh(rh).toFixed(1)}`)
                ].join(' ');

                const tMeanPts = md.hourlyTempMean.map((t, hr) => `${xForHr(hr).toFixed(1)},${yForT(t).toFixed(1)}`).join(' ');
                const rhMeanPts = md.hourlyRhMean.map((rh, hr) => `${xForHr(hr).toFixed(1)},${yForRh(rh).toFixed(1)}`).join(' ');

                return (
                  <div className="space-y-2">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-50/50 rounded-2xl border border-slate-200">
                      {/* Left Y Axis: Temperature (°C) */}
                      {[-10, 0, 10, 20, 30, 40].map((t) => {
                        if (t < tMin || t > tMax) return null;
                        const y = yForT(t);
                        return (
                          <g key={t}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth={0.8} />
                            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#ea580c">
                              {t}°C
                            </text>
                          </g>
                        );
                      })}

                      {/* Right Y Axis: Relative Humidity (%) */}
                      {(diurnalMetric === 'rh' || diurnalMetric === 'both') &&
                        [0, 20, 40, 60, 80, 100].map((rh) => {
                          const y = yForRh(rh);
                          return (
                            <text key={rh} x={W - padR + 6} y={y + 3.5} fontSize="10" fontWeight="600" fill="#0284c7">
                              {rh}%
                            </text>
                          );
                        })}

                      {/* X Axis Hours */}
                      {Array.from({ length: 24 }, (_, hr) => hr).map((hr) => {
                        const x = xForHr(hr);
                        const isMain = hr % 3 === 0;
                        return (
                          <g key={hr}>
                            <line x1={x} y1={padT + plotH} x2={x} y2={padT + plotH + (isMain ? 6 : 3)} stroke="#cbd5e1" />
                            {isMain && (
                              <text x={x} y={H - 12} textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569">
                                {String(hr).padStart(2, '0')}:00
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Bands */}
                      {(diurnalMetric === 'temp' || diurnalMetric === 'both') && (
                        <polygon points={tBandPts} fill="#f97316" fillOpacity={0.2} />
                      )}
                      {(diurnalMetric === 'rh' || diurnalMetric === 'both') && (
                        <polygon points={rhBandPts} fill="#0284c7" fillOpacity={0.16} />
                      )}

                      {/* Lines */}
                      {(diurnalMetric === 'rh' || diurnalMetric === 'both') && (
                        <polyline fill="none" stroke="#0284c7" strokeWidth={2} strokeDasharray={diurnalMetric === 'both' ? '4 3' : undefined} points={rhMeanPts} />
                      )}
                      {(diurnalMetric === 'temp' || diurnalMetric === 'both') && (
                        <polyline fill="none" stroke="#ea580c" strokeWidth={2.4} points={tMeanPts} />
                      )}

                      {/* Hourly Marker Crosshair */}
                      {activeDiurnalHourHover !== null && (
                        <g pointerEvents="none">
                          <line
                            x1={xForHr(activeDiurnalHourHover)}
                            y1={padT}
                            x2={xForHr(activeDiurnalHourHover)}
                            y2={padT + plotH}
                            stroke="#0f766e"
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                          {(diurnalMetric === 'temp' || diurnalMetric === 'both') && (
                            <circle
                              cx={xForHr(activeDiurnalHourHover)}
                              cy={yForT(md.hourlyTempMean[activeDiurnalHourHover])}
                              r={5}
                              fill="#ea580c"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )}
                          {(diurnalMetric === 'rh' || diurnalMetric === 'both') && (
                            <circle
                              cx={xForHr(activeDiurnalHourHover)}
                              cy={yForRh(md.hourlyRhMean[activeDiurnalHourHover])}
                              r={5}
                              fill="#0284c7"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )}
                        </g>
                      )}

                      {/* Interactive Pointer Overlay */}
                      <rect
                        x={padL}
                        y={padT}
                        width={plotW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-crosshair"
                        onMouseMove={(e) => {
                          const svg = svgRef.current;
                          if (!svg) return;
                          const pt = svg.createSVGPoint();
                          pt.x = e.clientX;
                          pt.y = e.clientY;
                          const c = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                          const hr = Math.min(23, Math.max(0, Math.round(((c.x - padL) / plotW) * 23)));
                          setActiveDiurnalHourHover(hr);
                          tooltipCtx.show(e, `${md.monthName} at ${String(hr).padStart(2, '0')}:00`, [
                            { label: 'Mean Dry-Bulb Temp', value: `${md.hourlyTempMean[hr].toFixed(1)}°C`, color: '#ea580c' },
                            { label: '10th–90th Temp Band', value: `${md.hourlyTempP10[hr].toFixed(1)}°C – ${md.hourlyTempP90[hr].toFixed(1)}°C` },
                            { label: 'Mean Relative Humidity', value: `${md.hourlyRhMean[hr].toFixed(1)}%`, color: '#0284c7' },
                            { label: '10th–90th RH Band', value: `${md.hourlyRhP10[hr].toFixed(0)}% – ${md.hourlyRhP90[hr].toFixed(0)}%` },
                            { label: 'Monthly Diurnal Swing', value: `${md.diurnalSwingK} K` },
                            { label: 'Passive Night Flush', value: md.diurnalSwingK >= 10 ? 'Highly Effective (ΔT ≥ 10K)' : 'Moderate' }
                          ]);
                        }}
                        onMouseLeave={() => {
                          setActiveDiurnalHourHover(null);
                          tooltipCtx.hide();
                        }}
                      />
                    </svg>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 font-medium">
                      <span>
                        Detailed 24-Hour Profile for <strong>{md.monthName}</strong> • Diurnal Swing ΔT: <strong className="text-amber-700">{md.diurnalSwingK} K</strong>
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 font-bold text-orange-700">
                          <span className="w-3 h-0.5 bg-orange-600 inline-block" /> Dry-Bulb Temp (10th–90th Shaded Band)
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-sky-700">
                          <span className="w-3 h-0.5 bg-sky-600 inline-block border-b border-dashed" /> Relative Humidity
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // CASE 2: 12-Month Facet Grid (Spacious 4 cols × 3 rows or 6 cols × 2 rows)
              const W = 880;
              const H = 400;
              const cols = 4;
              const rows = 3;
              const cellW = W / cols;
              const cellH = H / rows;

              return (
                <div className="space-y-1.5">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    {monthlyDiurnals.map((md, mIdx) => {
                      const col = mIdx % cols;
                      const row = Math.floor(mIdx / cols);
                      const x0 = col * cellW + 6;
                      const y0 = row * cellH + 6;
                      const pw = cellW - 12;
                      const ph = cellH - 32;

                      const xForH = (hr: number) => x0 + (hr / 23) * pw;
                      const yForT = (t: number) => y0 + 20 + ph - ((t - tMin) / (tMax - tMin)) * ph;
                      const yForRh = (rh: number) => y0 + 20 + ph - (rh / 100) * ph;

                      const tBandPts = [
                        ...md.hourlyTempP90.map((t, hr) => `${xForH(hr).toFixed(1)},${yForT(t).toFixed(1)}`),
                        ...[...md.hourlyTempP10].reverse().map((t, idx) => `${xForH(23 - idx).toFixed(1)},${yForT(t).toFixed(1)}`)
                      ].join(' ');

                      const rhBandPts = [
                        ...md.hourlyRhP90.map((rh, hr) => `${xForH(hr).toFixed(1)},${yForRh(rh).toFixed(1)}`),
                        ...[...md.hourlyRhP10].reverse().map((rh, idx) => `${xForH(23 - idx).toFixed(1)},${yForRh(rh).toFixed(1)}`)
                      ].join(' ');

                      const tMeanPts = md.hourlyTempMean.map((t, hr) => `${xForH(hr).toFixed(1)},${yForT(t).toFixed(1)}`).join(' ');
                      const rhMeanPts = md.hourlyRhMean.map((rh, hr) => `${xForH(hr).toFixed(1)},${yForRh(rh).toFixed(1)}`).join(' ');

                      return (
                        <g
                          key={md.monthName}
                          className="cursor-pointer"
                          onClick={() => {
                            setDiurnalZoomMonth(mIdx);
                            setDiurnalViewMode('zoom');
                          }}
                          onMouseEnter={(e) => {
                            tooltipCtx.show(e, `${md.monthName} Diurnal Profile (Click to zoom)`, [
                              { label: 'Diurnal Swing ΔT', value: `${md.diurnalSwingK} K`, color: '#f59e0b' },
                              { label: 'Mean Dry-Bulb', value: `${md.tempStats.mean}°C`, color: '#ea580c' },
                              { label: 'T_db 5th–95th', value: `${md.tempStats.p05}°C – ${md.tempStats.p95}°C` },
                              { label: 'Mean Relative Humidity', value: `${md.rhStats.mean}%`, color: '#0284c7' },
                              { label: 'Night Flush Potential', value: md.diurnalSwingK >= 10 ? 'High (ΔT ≥ 10K)' : 'Moderate' }
                            ]);
                          }}
                          onMouseMove={(e) => tooltipCtx.move(e)}
                          onMouseLeave={() => tooltipCtx.hide()}
                        >
                          <rect
                            x={x0}
                            y={y0}
                            width={pw}
                            height={ph + 26}
                            rx={10}
                            fill="#f8fafc"
                            stroke="#e2e8f0"
                            strokeWidth={1}
                            className="hover:stroke-teal-500 hover:fill-teal-50/20 transition"
                          />
                          <text x={x0 + 10} y={y0 + 15} fontSize="11" fontWeight="800" fill="#1e293b">
                            {md.monthName}
                          </text>
                          <text x={x0 + pw - 10} y={y0 + 15} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#0d9488">
                            {diurnalMetric === 'rh' ? `RH ${md.rhStats.mean}%` : `ΔT ${md.diurnalSwingK} K`}
                          </text>

                          {(diurnalMetric === 'temp' || diurnalMetric === 'both') && (
                            <polygon points={tBandPts} fill="#f97316" fillOpacity={0.22} />
                          )}
                          {diurnalMetric === 'rh' && (
                            <polygon points={rhBandPts} fill="#0284c7" fillOpacity={0.22} />
                          )}
                          {(diurnalMetric === 'rh' || diurnalMetric === 'both') && (
                            <polyline
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth={diurnalMetric === 'rh' ? 1.8 : 1.1}
                              strokeDasharray={diurnalMetric === 'both' ? '3 2' : undefined}
                              points={rhMeanPts}
                            />
                          )}
                          {(diurnalMetric === 'temp' || diurnalMetric === 'both') && (
                            <polyline fill="none" stroke="#ea580c" strokeWidth={1.8} points={tMeanPts} />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <p className="text-[10.5px] text-slate-500 text-center font-medium">
                    Click any month card to view its high-resolution 24-hour diurnal profile and inspect hourly values
                  </p>
                </div>
              );
            }}
          </ClimaChartCard>

          {/* 3. 24h x 365d Timetable Heatmaps for T_db and RH */}
          <div className={`grid grid-cols-1 ${chartDensity === 'spacious' ? 'gap-6' : 'xl:grid-cols-2 gap-5'}`}>
            <ClimaChartCard
              title="24h × 365d Dry-Bulb Temperature Timetable Heatmap (°C)"
              subtitle="Continuous RdYlBu_r annual hourly temperature matrix showing seasonal & diurnal thermal waves"
              icon={<Thermometer className="w-4 h-4 text-rose-500" />}
              svgFilename={`${climate.id}_tdb_carpet.svg`}
              csvFilename={`${climate.id}_tdb_8760.csv`}
              onBuildCsv={() => ({
                headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'T_db_C'],
                rows: climate.hourly.map((h) => [h.hourOfYear, h.month + 1, h.dayOfMonth, h.hour, h.dryBulb])
              })}
            >
              {(svgRef, tooltipCtx) => (
                <CarpetHeatmap24x365
                  svgRef={svgRef}
                  tooltipCtx={tooltipCtx}
                  hourly={climate.hourly}
                  getValue={(h) => h.dryBulb}
                  getColor={(v) => colorForTempC(v, globalValueRanges)}
                  unitLabel="°C"
                  legendItems={[
                    { label: '<0°C', color: '#313695' },
                    { label: '10°C', color: '#74add1' },
                    { label: '20°C', color: '#ffffbf' },
                    { label: '28°C', color: '#f46d43' },
                    { label: '>35°C', color: '#a50026' }
                  ]}
                />
              )}
            </ClimaChartCard>

            <ClimaChartCard
              title="24h × 365d Relative Humidity Timetable Heatmap (%)"
              subtitle="Continuous YlGnBu annual hourly relative humidity matrix"
              icon={<Wind className="w-4 h-4 text-sky-500" />}
              svgFilename={`${climate.id}_rh_carpet.svg`}
              csvFilename={`${climate.id}_rh_8760.csv`}
              onBuildCsv={() => ({
                headers: ['HourOfYear', 'Month', 'Day', 'Hour', 'RH_%'],
                rows: climate.hourly.map((h) => [h.hourOfYear, h.month + 1, h.dayOfMonth, h.hour, h.relHum])
              })}
            >
              {(svgRef, tooltipCtx) => (
                <CarpetHeatmap24x365
                  svgRef={svgRef}
                  tooltipCtx={tooltipCtx}
                  hourly={climate.hourly}
                  getValue={(h) => h.relHum}
                  getColor={(rh) => colorForRhPct(rh)}
                  unitLabel="% RH"
                  legendItems={[
                    { label: '<25% Arid', color: '#ffffd9' },
                    { label: '45%', color: '#c7e9b4' },
                    { label: '65%', color: '#41b6c4' },
                    { label: '80%', color: '#225ea8' },
                    { label: '>90% Humid', color: '#081d58' }
                  ]}
                />
              )}
            </ClimaChartCard>
          </div>

          {/* 4. Monthly Descriptive Statistics Table (Min, 5th, Mean, Median, 95th, Max, Diurnal ΔT) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-800">
              Monthly Descriptive Statistics Table — Dry-Bulb Temp (°C), Relative Humidity (%), and Diurnal Swing (K)
            </h3>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-2 text-left rounded-l-lg">Metric</th>
                  {MONTHS.map((m) => (
                    <th key={m} className="p-2 text-center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'T_db Min (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.min },
                  { label: 'T_db 5th % (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.p05 },
                  { label: 'T_db Mean (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.mean },
                  { label: 'T_db Median (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.median },
                  { label: 'T_db 95th % (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.p95 },
                  { label: 'T_db Max (°C)', pick: (d: typeof monthlyDiurnals[0]) => d.tempStats.max },
                  { label: 'Diurnal Swing ΔT (K)', pick: (d: typeof monthlyDiurnals[0]) => d.diurnalSwingK },
                  { label: 'RH Mean (%)', pick: (d: typeof monthlyDiurnals[0]) => d.rhStats.mean }
                ].map((row) => (
                  <tr key={row.label} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-1.5 font-bold text-slate-700">{row.label}</td>
                    {monthlyDiurnals.map((md) => (
                      <td key={md.monthName} className="p-1.5 text-center font-mono text-slate-600">
                        {row.pick(md)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: SUN, CLOUDS & SHADING MASK (IMPROVEMENT #2)
         ===================================================================== */}
      {activeSubTab === 'sun_clouds' && (
        <div className="space-y-5">
          <div className={`grid grid-cols-1 ${chartDensity === 'spacious' ? 'gap-6' : 'xl:grid-cols-12 gap-5'}`}>
            {/* Toggleable Polar / Cartesian Sun-Path + Overhang Protractor + Stage 2 Urban Skyline Mask */}
            <div className={chartDensity === 'spacious' ? 'w-full' : 'xl:col-span-7'}>
              <ClimaChartCard
                title="Interactive Sun-Path Diagram with Overhang Protractor & Stage 2 Urban Canyon Skyline Mask"
                subtitle="Improvement #2: Inspect summer/winter solar vectors blocked by South overhangs, vertical fins, and neighboring urban buildings"
                icon={<Sun className="w-4 h-4 text-amber-500" />}
                svgFilename={`${climate.id}_sunpath_${sunProjection}.svg`}
                csvFilename={`${climate.id}_solar_monthly.csv`}
                onBuildCsv={() => ({
                  headers: ['Month', 'GHI_kWh/m2', 'DNI_kWh/m2', 'DHI_kWh/m2', 'SkyCover_%'],
                  rows: solarAnalytics.monthlySolar.map((s) => [
                    s.month,
                    s.ghiMonthlyKwh,
                    s.dniMonthlyKwh,
                    s.dhiMonthlyKwh,
                    s.skyCoverMeanPct
                  ])
                })}
                controls={
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSunProjection('polar')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                            sunProjection === 'polar'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          Polar Stereographic
                        </button>
                        <button
                          type="button"
                          onClick={() => setSunProjection('cartesian')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                            sunProjection === 'cartesian'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          Cartesian (Az × Alt)
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-semibold">Color Analemma By:</span>
                        <button
                          type="button"
                          onClick={() => setSunColorMode('temp')}
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] border ${
                            sunColorMode === 'temp'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          T_db (°C)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSunColorMode('ghi')}
                          className={`px-2 py-1 rounded-lg font-bold text-[11px] border ${
                            sunColorMode === 'ghi'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          GHI (Wh/m²)
                        </button>
                      </div>
                    </div>

                    {/* Overhang & Fin Protractor + Urban Skyline Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 text-[11px]">
                      <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showProtractor}
                          onChange={(e) => setShowProtractor(e.target.checked)}
                          className="accent-amber-600"
                        />
                        Overhang Protractor
                      </label>
                      <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showUrbanSkylineMask}
                          onChange={(e) => setShowUrbanSkylineMask(e.target.checked)}
                          className="accent-teal-600"
                        />
                        Stage 2 Urban Mask
                      </label>
                      <label>
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <span>Overhang Angle θ_v</span>
                          <span className="font-bold text-amber-800 font-mono tabular-nums inline-block w-10 text-right">{overhangAngleDeg}°</span>
                        </div>
                        <input
                          type="range"
                          min={25}
                          max={80}
                          value={overhangAngleDeg}
                          onChange={(e) => {
                            const deg = Number(e.target.value);
                            setOverhangAngleDeg(deg);
                            // Sync overhang depth (for 1.5m window height) to Stage 4
                            const depthM = +(1.5 / Math.tan((deg * Math.PI) / 180)).toFixed(2);
                            setOverhangDepth(Math.max(0.1, Math.min(2.0, depthM)));
                            setShadingMode('fixed_overhang');
                          }}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                      </label>
                      <label>
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <span>Fin Cutoff ±θ_h</span>
                          <span className="font-bold text-indigo-800 font-mono tabular-nums inline-block w-12 text-right">±{finAngleDeg}°</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={75}
                          value={finAngleDeg}
                          onChange={(e) => setFinAngleDeg(Number(e.target.value))}
                          className="w-full accent-indigo-600 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                }
              >
                {(svgRef, tooltipCtx) => {
                  const sunHours = climate.hourly.filter((h) => h.solarAlt > 0.5);
                  const canyonS = sim.canyonAnglesDeg.S;
                  const canyonE = sim.canyonAnglesDeg.E;
                  const canyonW = sim.canyonAnglesDeg.W;

                  // Compute summer overheated hours shaded vs winter passive solar admitted
                  const warmSunHours = climate.hourly.filter((h) => h.solarAlt > 2 && h.dryBulb >= 24);
                  const shadedWarmCount = warmSunHours.filter(
                    (h) =>
                      (showProtractor && h.solarAlt >= overhangAngleDeg && Math.abs(h.solarAz - 180) <= finAngleDeg + 25) ||
                      (showUrbanSkylineMask && h.solarAlt <= canyonS)
                  ).length;
                  const shadedSummerPct = warmSunHours.length > 0 ? Math.round((shadedWarmCount / warmSunHours.length) * 100) : 0;

                  if (sunProjection === 'cartesian') {
                    const W = 900;
                    const H = 420;
                    const padL = 50;
                    const padR = 24;
                    const padT = 24;
                    const padB = 36;
                    const plotW = W - padL - padR;
                    const plotH = H - padT - padB;
                    const xForAz = (az: number) => padL + (az / 360) * plotW;
                    const yForAlt = (alt: number) => padT + plotH - (alt / 90) * plotH;

                    const makeCartArc = (dayOfYear: number) => {
                      const pts: string[] = [];
                      for (let hr = 3.5; hr <= 20.5; hr += 0.25) {
                        const pos = calcSolarPosition(climate.lat, dayOfYear, hr, climate.lon, climate.tz);
                        if (pos.alt > 0) {
                          pts.push(`${xForAz(pos.az).toFixed(1)},${yForAlt(pos.alt).toFixed(1)}`);
                        }
                      }
                      return pts.join(' ');
                    };

                    return (
                      <div className="space-y-2">
                        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-50 rounded-2xl border border-slate-200">
                          {[0, 15, 30, 45, 60, 75, 90].map((alt) => (
                            <g key={alt}>
                              <line x1={padL} y1={yForAlt(alt)} x2={W - padR} y2={yForAlt(alt)} stroke="#e2e8f0" />
                              <text x={padL - 8} y={yForAlt(alt) + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                                {alt}°
                              </text>
                            </g>
                          ))}
                          {[0, 90, 180, 270, 360].map((az) => (
                            <g key={az}>
                              <line x1={xForAz(az)} y1={padT} x2={xForAz(az)} y2={H - padB} stroke="#e2e8f0" />
                              <text x={xForAz(az)} y={H - 12} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#475569">
                                {az === 90 ? '90° (E)' : az === 180 ? '180° (S)' : az === 270 ? '270° (W)' : `${az}° (N)`}
                              </text>
                            </g>
                          ))}

                          {/* Stage 2 Urban Canyon Skyline Obstruction Mask along Horizon */}
                          {showUrbanSkylineMask && (
                            <polygon
                              points={`${xForAz(45)},${yForAlt(0)} ${xForAz(45)},${yForAlt(canyonE)} ${xForAz(135)},${yForAlt(canyonS)} ${xForAz(225)},${yForAlt(canyonS)} ${xForAz(315)},${yForAlt(canyonW)} ${xForAz(315)},${yForAlt(0)}`}
                              fill="rgba(15, 23, 42, 0.35)"
                              stroke="#334155"
                              strokeDasharray="3 2"
                            />
                          )}

                          {/* Overhang & Fin Shading Protractor Mask */}
                          {showProtractor && (
                            <rect
                              x={xForAz(180 - finAngleDeg)}
                              y={padT}
                              width={xForAz(180 + finAngleDeg) - xForAz(180 - finAngleDeg)}
                              height={yForAlt(overhangAngleDeg) - padT}
                              fill="rgba(245, 158, 11, 0.25)"
                              stroke="#d97706"
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Solstice & Equinox Reference Curves */}
                          <polyline fill="none" stroke="#e11d48" strokeWidth={1.8} strokeOpacity={0.8} points={makeCartArc(172)} />
                          <polyline fill="none" stroke="#10b981" strokeWidth={1.5} strokeOpacity={0.8} points={makeCartArc(80)} />
                          <polyline fill="none" stroke="#0284c7" strokeWidth={1.8} strokeOpacity={0.8} points={makeCartArc(355)} />

                          {/* 365-Day Analemma Points (All Daytime Hours with Spencer 1971 EoT) */}
                          {sunHours.map((h, i) => {
                            const isShaded = (showProtractor && h.solarAlt >= overhangAngleDeg && Math.abs(h.solarAz - 180) <= finAngleDeg + 25) ||
                              (showUrbanSkylineMask && h.solarAlt <= canyonS);
                            return (
                              <circle
                                key={i}
                                cx={xForAz(h.solarAz)}
                                cy={yForAlt(h.solarAlt)}
                                r={3.2}
                                fillOpacity={0.9}
                                stroke="#ffffff"
                                strokeWidth={0.8}
                                fill={
                                  sunColorMode === 'temp'
                                    ? colorForTempC(h.dryBulb, globalValueRanges)
                                    : h.ghi > 550
                                    ? '#e11d48'
                                    : h.ghi > 250
                                    ? '#f59e0b'
                                    : '#0ea5e9'
                                }
                                className="cursor-pointer transition-colors hover:stroke-amber-300 hover:stroke-[2px]"
                                onMouseEnter={(e) => {
                                  tooltipCtx.show(e, `${MONTHS[h.month]} ${h.dayOfMonth} • ${h.hour}:00`, [
                                    { label: 'Solar Altitude', value: `${h.solarAlt.toFixed(1)}°`, color: '#f59e0b' },
                                    { label: 'Solar Azimuth', value: `${h.solarAz.toFixed(1)}°` },
                                    { label: 'Dry-Bulb Temp', value: `${h.dryBulb}°C`, color: '#e11d48' },
                                    { label: 'Solar GHI', value: `${h.ghi} Wh/m²` },
                                    { label: 'Direct Normal (DNI)', value: `${h.dni} Wh/m²` },
                                    { label: 'Shading Status', value: isShaded ? 'Overhang/Canyon Blocked' : 'Direct Sun', color: isShaded ? '#f59e0b' : '#10b981' }
                                  ]);
                                }}
                                onMouseMove={(e) => tooltipCtx.move(e)}
                                onMouseLeave={() => tooltipCtx.hide()}
                              />
                            );
                          })}
                        </svg>
                        <div className="text-[11px] text-slate-600 flex justify-between px-1 font-medium">
                          <span>
                            Shaded Overheated Hours (T_db ≥ 24°C): <strong className="text-amber-700">{shadedSummerPct}% Blocked</strong>
                          </span>
                          <span>
                            Coupled Stage 4 Overhang Depth: <strong className="text-teal-700">{overhangDepth} m</strong>
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Polar Stereographic Projection (True Stereographic tan((90 - alt)/2))
                  const size = 520;
                  const cx = size / 2;
                  const cy = size / 2;
                  const R = 205;
                  const stereoR = (alt: number) => R * Math.tan(((90 - Math.max(0, alt)) * Math.PI) / 360);
                  const polarPt = (alt: number, az: number) => {
                    const r = stereoR(alt);
                    const rad = ((az - 90) * Math.PI) / 180;
                    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
                  };

                  const makeDayArc = (dayOfYear: number) => {
                    const pts: string[] = [];
                    for (let hr = 3.5; hr <= 20.5; hr += 0.25) {
                      const pos = calcSolarPosition(climate.lat, dayOfYear, hr, climate.lon, climate.tz);
                      if (pos.alt > 0) {
                        const p = polarPt(pos.alt, pos.az);
                        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                      }
                    }
                    return pts.join(' ');
                  };

                  return (
                    <div className="flex flex-col items-center space-y-2">
                      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[520px] h-auto">
                        {[0, 15, 30, 45, 60, 75, 90].map((alt) => (
                          <circle
                            key={alt}
                            cx={cx}
                            cy={cy}
                            r={stereoR(alt)}
                            fill="none"
                            stroke={alt === 0 ? '#94a3b8' : '#e2e8f0'}
                            strokeWidth={alt === 0 ? 1.5 : 1}
                            strokeDasharray={alt === 0 ? undefined : '3 3'}
                          />
                        ))}

                        {/* Stage 2 Urban Canyon Skyline Ring */}
                        {showUrbanSkylineMask && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={R}
                            fill="none"
                            stroke="rgba(15, 23, 42, 0.35)"
                            strokeWidth={(canyonS / 90) * R * 2}
                          />
                        )}

                        {/* Solstice & Equinox Arcs */}
                        <polyline fill="none" stroke="#e11d48" strokeWidth={1.8} points={makeDayArc(172)} />
                        <polyline fill="none" stroke="#10b981" strokeWidth={1.5} points={makeDayArc(80)} />
                        <polyline fill="none" stroke="#0284c7" strokeWidth={1.8} points={makeDayArc(355)} />

                        {/* 365-Day Analemma Sun Points (Figure-8 Loops via Equation of Time) */}
                        {sunHours.map((h, i) => {
                          const p = polarPt(h.solarAlt, h.solarAz);
                          const isShaded = (showProtractor && h.solarAlt >= overhangAngleDeg && Math.abs(h.solarAz - 180) <= finAngleDeg + 25) ||
                            (showUrbanSkylineMask && h.solarAlt <= canyonS);
                          return (
                            <circle
                              key={i}
                              cx={p.x}
                              cy={p.y}
                              r={3.2}
                              fillOpacity={0.9}
                              stroke="#ffffff"
                              strokeWidth={0.8}
                              fill={
                                sunColorMode === 'temp'
                                  ? colorForTempC(h.dryBulb, globalValueRanges)
                                  : h.ghi > 550
                                  ? '#e11d48'
                                  : h.ghi > 250
                                  ? '#f59e0b'
                                  : '#0ea5e9'
                              }
                              className="cursor-pointer transition-colors hover:stroke-amber-300 hover:stroke-[2px]"
                              onMouseEnter={(e) => {
                                tooltipCtx.show(e, `${MONTHS[h.month]} ${h.dayOfMonth} • ${h.hour}:00`, [
                                  { label: 'Solar Altitude', value: `${h.solarAlt.toFixed(1)}°`, color: '#f59e0b' },
                                  { label: 'Solar Azimuth', value: `${h.solarAz.toFixed(1)}°` },
                                  { label: 'Dry-Bulb Temp', value: `${h.dryBulb}°C`, color: '#e11d48' },
                                  { label: 'Solar GHI', value: `${h.ghi} Wh/m²` },
                                  { label: 'Shading Status', value: isShaded ? 'Overhang/Canyon Blocked' : 'Direct Sun', color: isShaded ? '#f59e0b' : '#10b981' }
                                ]);
                              }}
                              onMouseMove={(e) => tooltipCtx.move(e)}
                              onMouseLeave={() => tooltipCtx.hide()}
                            />
                          );
                        })}

                        {/* Overhang Protractor Wedge on South Facade */}
                        {showProtractor && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={stereoR(overhangAngleDeg)}
                            fill="rgba(245, 158, 11, 0.25)"
                            stroke="#d97706"
                            strokeWidth={1.8}
                            strokeDasharray="4 2"
                          />
                        )}

                        <text x={cx} y={18} textAnchor="middle" fontSize="12" fontWeight="800" fill="#334155">N</text>
                        <text x={cx} y={size - 10} textAnchor="middle" fontSize="12" fontWeight="800" fill="#e11d48">S</text>
                        <text x={size - 14} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#334155">E</text>
                        <text x={14} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#334155">W</text>
                      </svg>
                      <div className="w-full text-[11px] text-slate-600 flex justify-between px-2 font-medium">
                        <span>
                          Shaded Warm Hours (≥24°C): <strong className="text-amber-700">{shadedSummerPct}% Blocked</strong>
                        </span>
                        <span>
                          Stage 4 Overhang synced: <strong className="text-teal-700">{overhangDepth} m</strong>
                        </span>
                      </div>
                    </div>
                  );
                }}
              </ClimaChartCard>
            </div>

            {/* 8-Orientation Vertical Facade Radiation Rose */}
            <div className={chartDensity === 'spacious' ? 'w-full' : 'xl:col-span-5'}>
              <ClimaChartCard
                title="Directional Vertical Facade Radiation Rose (kWh/m²yr)"
                subtitle="Annual, Summer (Jun–Aug), and Winter (Dec–Feb) incident solar radiation on 8 vertical orientations"
                icon={<Compass className="w-4 h-4 text-rose-500" />}
                svgFilename={`${climate.id}_facade_radiation_rose.svg`}
                csvFilename={`${climate.id}_facade_radiation_8dir.csv`}
                onBuildCsv={() => ({
                  headers: ['Orientation', 'Azimuth_deg', 'Annual_kWh/m2', 'Summer_kWh/m2', 'Winter_kWh/m2'],
                  rows: solarAnalytics.facadeRose8.map((r) => [
                    r.dir,
                    r.azDeg,
                    r.annualKwhM2,
                    r.summerKwhM2,
                    r.winterKwhM2
                  ])
                })}
              >
                {(svgRef, tooltipCtx) => {
                  const size = 460;
                  const cx = size / 2;
                  const cy = size / 2;
                  const R = 175;
                  const maxVal = Math.max(600, ...solarAnalytics.facadeRose8.map((r) => r.annualKwhM2));

                  const makePoly = (pick: (r: typeof solarAnalytics.facadeRose8[0]) => number) =>
                    solarAnalytics.facadeRose8
                      .map((r) => {
                        const rad = ((r.azDeg - 90) * Math.PI) / 180;
                        const dist = (pick(r) / maxVal) * R;
                        return `${(cx + dist * Math.cos(rad)).toFixed(1)},${(cy + dist * Math.sin(rad)).toFixed(1)}`;
                      })
                      .join(' ');

                  return (
                    <div className="flex flex-col items-center space-y-2">
                      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[460px] h-auto">
                        {[0.25, 0.5, 0.75, 1].map((f, i) => (
                          <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={R * f}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeDasharray="3 3"
                          />
                        ))}

                        <polygon points={makePoly((r) => r.annualKwhM2)} fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth={2.4} />
                        <polygon points={makePoly((r) => r.summerKwhM2)} fill="rgba(225, 29, 72, 0.22)" stroke="#e11d48" strokeWidth={1.8} />
                        <polygon points={makePoly((r) => r.winterKwhM2)} fill="rgba(2, 132, 199, 0.25)" stroke="#0284c7" strokeWidth={1.8} />

                        {solarAnalytics.facadeRose8.map((r) => {
                          const rad = ((r.azDeg - 90) * Math.PI) / 180;
                          const lx = cx + (R + 28) * Math.cos(rad);
                          const ly = cy + (R + 28) * Math.sin(rad);
                          const px = cx + (r.annualKwhM2 / maxVal) * R * Math.cos(rad);
                          const py = cy + (r.annualKwhM2 / maxVal) * R * Math.sin(rad);
                          return (
                            <g
                              key={r.dir}
                              className="cursor-pointer group"
                              onMouseEnter={(e) => {
                                tooltipCtx.show(e, `${r.dir} Facade (${r.azDeg}°)`, [
                                  { label: 'Annual Solar Radiation', value: `${r.annualKwhM2} kWh/m²yr`, color: '#f59e0b' },
                                  { label: 'Summer (Jun–Aug)', value: `${r.summerKwhM2} kWh/m²`, color: '#e11d48' },
                                  { label: 'Winter (Dec–Feb)', value: `${r.winterKwhM2} kWh/m²`, color: '#0284c7' },
                                  { label: 'Winter/Summer Ratio', value: (r.winterKwhM2 / Math.max(1, r.summerKwhM2)).toFixed(2) }
                                ]);
                              }}
                              onMouseMove={(e) => tooltipCtx.move(e)}
                              onMouseLeave={() => tooltipCtx.hide()}
                            >
                              {/* Stable invisible hit target to prevent mouseleave thrashing */}
                              <circle cx={px} cy={py} r={16} fill="transparent" />
                              {/* Stable visible point that highlights smoothly without moving */}
                              <circle
                                cx={px}
                                cy={py}
                                r={6}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={2}
                                className="transition-colors group-hover:fill-amber-400 group-hover:stroke-amber-200"
                              />
                              <text
                                x={lx}
                                y={ly + 3.5}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="700"
                                className="fill-slate-800 transition-colors group-hover:fill-amber-600"
                              >
                                {r.dir} ({r.annualKwhM2})
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      <div className="flex items-center gap-4 text-[10.5px]">
                        <span className="flex items-center gap-1.5 font-bold text-amber-600">
                          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Annual kWh/m²
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-rose-600">
                          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Summer (Jun–Aug)
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-sky-600">
                          <span className="w-2.5 h-2.5 rounded-sm bg-sky-600 inline-block" /> Winter (Dec–Feb)
                        </span>
                      </div>
                    </div>
                  );
                }}
              </ClimaChartCard>
            </div>
          </div>
          {/* Monthly Global, Direct Normal & Diffuse Solar Boxplots + Cloud Cover Regime Distribution */}
          <div className={`grid grid-cols-1 ${chartDensity === 'spacious' ? 'gap-6' : 'xl:grid-cols-2 gap-5'}`}>
            <ClimaChartCard
              title="Monthly Solar Radiation (kWh/m²) & Daytime Irradiance Boxplots (Wh/m²)"
              subtitle="Cumulative GHI, DNI, DHI bars (top) and daytime hourly Q25–Median–Q75–Max boxplots (bottom)"
              icon={<Layers className="w-4 h-4 text-amber-500" />}
              svgFilename={`${climate.id}_monthly_solar_boxplots.svg`}
              csvFilename={`${climate.id}_monthly_solar_boxplots.csv`}
              onBuildCsv={() => ({
                headers: [
                  'Month',
                  'GHI_kWh/m2',
                  'DNI_kWh/m2',
                  'DHI_kWh/m2',
                  'DaytimeGHI_Q25_W/m2',
                  'DaytimeGHI_Median_W/m2',
                  'DaytimeGHI_Q75_W/m2',
                  'DaytimeGHI_Max_W/m2',
                  'DaytimeDNI_Median_W/m2',
                  'DaytimeDHI_Median_W/m2'
                ],
                rows: solarAnalytics.monthlySolar.map((s) => [
                  s.month,
                  s.ghiMonthlyKwh,
                  s.dniMonthlyKwh,
                  s.dhiMonthlyKwh,
                  s.ghiQ25,
                  s.ghiMedian,
                  s.ghiQ75,
                  s.ghiMax,
                  s.dniMedian,
                  s.dhiMedian
                ])
              })}
            >
              {(svgRef, tooltipCtx) => {
                const W = 880;
                const H = 300;
                const padL = 48;
                const padR = 28;
                const padT = 24;
                const padB = 34;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const maxW = Math.max(950, ...solarAnalytics.monthlySolar.map((s) => Math.max(s.ghiMax, s.dniMax)));
                const colWidth = plotW / 12;
                const xForM = (i: number) => padL + (i + 0.5) * colWidth;
                const yForW = (v: number) => padT + plotH - (Math.min(maxW, Math.max(0, v)) / maxW) * plotH;

                return (
                  <div className="space-y-2">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                        const y = padT + plotH - f * plotH;
                        return (
                          <g key={i}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                              {Math.round(maxW * f)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Month column highlight bar */}
                      {activeSolarMonthHover !== null && (
                        <rect
                          x={padL + activeSolarMonthHover * colWidth + 2}
                          y={padT}
                          width={colWidth - 4}
                          height={plotH}
                          fill="rgba(245, 158, 11, 0.08)"
                          stroke="rgba(245, 158, 11, 0.3)"
                          strokeWidth={1}
                          rx={4}
                          pointerEvents="none"
                        />
                      )}

                      {solarAnalytics.monthlySolar.map((s, i) => {
                        const cx = xForM(i);
                        const isHovered = activeSolarMonthHover === i;
                        const drawBox = (offset: number, q25: number, med: number, q75: number, maxVal: number, color: string) => {
                          const x = cx + offset;
                          const yMax = yForW(maxVal);
                          const y75 = yForW(q75);
                          const yMed = yForW(med);
                          const y25 = yForW(q25);
                          const y0 = yForW(0);
                          return (
                            <g>
                              <line x1={x} y1={yMax} x2={x} y2={y0} stroke={color} strokeWidth={isHovered ? 1.5 : 1.1} strokeDasharray="2 1" />
                              <line x1={x - 4} y1={yMax} x2={x + 4} y2={yMax} stroke={color} strokeWidth={isHovered ? 1.8 : 1.3} />
                              <rect
                                x={x - 4.5}
                                y={y75}
                                width={9}
                                height={Math.max(2, y25 - y75)}
                                fill={color}
                                fillOpacity={isHovered ? 0.45 : 0.28}
                                stroke={color}
                                strokeWidth={isHovered ? 1.6 : 1.2}
                                rx={1.5}
                              />
                              <line x1={x - 4.5} y1={yMed} x2={x + 4.5} y2={yMed} stroke="#0f172a" strokeWidth={isHovered ? 2.2 : 1.8} />
                            </g>
                          );
                        };

                        return (
                          <g key={s.month}>
                            {drawBox(-12, s.ghiQ25, s.ghiMedian, s.ghiQ75, s.ghiMax, '#f59e0b')}
                            {drawBox(0, s.dniQ25, s.dniMedian, s.dniQ75, s.dniMax, '#e11d48')}
                            {drawBox(12, s.dhiQ25, s.dhiMedian, s.dhiQ75, s.dhiMax, '#0284c7')}
                            <text
                              x={cx}
                              y={H - 10}
                              textAnchor="middle"
                              fontSize={isHovered ? '11' : '10'}
                              fontWeight={isHovered ? '800' : '600'}
                              fill={isHovered ? '#0f172a' : '#475569'}
                            >
                              {s.month}
                            </text>
                          </g>
                        );
                      })}

                      {/* Interactive Month Hover Columns */}
                      {solarAnalytics.monthlySolar.map((s, i) => (
                        <rect
                          key={`solar-hover-${s.month}`}
                          x={padL + i * colWidth}
                          y={padT}
                          width={colWidth}
                          height={plotH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={(e) => {
                            setActiveSolarMonthHover(i);
                            tooltipCtx.show(e, `${s.month} Solar Radiation & Irradiance (CBE Clima)`, [
                              { label: 'Monthly Total GHI', value: `${s.ghiMonthlyKwh} kWh/m²`, color: '#f59e0b' },
                              { label: 'Monthly Total DNI', value: `${s.dniMonthlyKwh} kWh/m²`, color: '#e11d48' },
                              { label: 'Monthly Total DHI', value: `${s.dhiMonthlyKwh} kWh/m²`, color: '#0284c7' },
                              { label: 'Daytime GHI Median', value: `${s.ghiMedian} Wh/m² (IQR: ${s.ghiQ25}–${s.ghiQ75})` },
                              { label: 'Daytime GHI Peak Max', value: `${s.ghiMax} Wh/m²` },
                              { label: 'Daytime DNI Median', value: `${s.dniMedian} Wh/m²` },
                              { label: 'Daytime DHI Median', value: `${s.dhiMedian} Wh/m²` }
                            ]);
                          }}
                          onMouseMove={(e) => tooltipCtx.move(e)}
                          onMouseLeave={() => {
                            setActiveSolarMonthHover(null);
                            tooltipCtx.hide();
                          }}
                        />
                      ))}
                    </svg>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 pt-1">
                      <span className="font-semibold text-slate-500">Daytime Hourly Irradiance Boxplots (Q25 – Median – Q75 + Max Whisker, Wh/m²)</span>
                      <div className="flex items-center gap-4 font-bold">
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Global (GHI)
                        </span>
                        <span className="flex items-center gap-1.5 text-rose-600">
                          <span className="w-3 h-3 rounded-sm bg-rose-600 inline-block" /> Direct Normal (DNI)
                        </span>
                        <span className="flex items-center gap-1.5 text-sky-600">
                          <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" /> Diffuse (DHI)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            </ClimaChartCard>

            <ClimaChartCard
              title="Monthly Cloud Cover Distribution & Cumulative Solar Irradiation"
              subtitle="CBE Clima sky cover regimes (Clear ≤30%, Partly Cloudy 40–70%, Overcast ≥80%) + Mean Cloud Cover %"
              icon={<Sun className="w-4 h-4 text-sky-500" />}
              svgFilename={`${climate.id}_monthly_cloud_cover.svg`}
              csvFilename={`${climate.id}_monthly_cloud_cover.csv`}
              onBuildCsv={() => ({
                headers: ['Month', 'ClearSky_%', 'PartlyCloudy_%', 'Overcast_%', 'MeanSkyCover_%', 'GHI_kWh/m2', 'DNI_kWh/m2', 'DHI_kWh/m2'],
                rows: solarAnalytics.monthlySolar.map((s) => [
                  s.month,
                  s.clearSkyPct,
                  s.partlyCloudyPct,
                  s.overcastPct,
                  s.skyCoverMeanPct,
                  s.ghiMonthlyKwh,
                  s.dniMonthlyKwh,
                  s.dhiMonthlyKwh
                ])
              })}
            >
              {(svgRef, tooltipCtx) => {
                const W = 880;
                const H = 300;
                const padL = 48;
                const padR = 28;
                const padT = 24;
                const padB = 34;
                const plotW = W - padL - padR;
                const plotH = H - padT - padB;
                const colWidth = plotW / 12;
                const xForM = (i: number) => padL + (i + 0.5) * colWidth;
                const yForPct = (pct: number) => padT + plotH - (Math.min(100, Math.max(0, pct)) / 100) * plotH;

                const cloudPts = solarAnalytics.monthlySolar
                  .map((s, i) => `${xForM(i)},${yForPct(s.skyCoverMeanPct)}`)
                  .join(' ');

                return (
                  <div className="space-y-2">
                    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                      {[0, 25, 50, 75, 100].map((pct) => {
                        const y = yForPct(pct);
                        return (
                          <g key={pct}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                              {pct}%
                            </text>
                          </g>
                        );
                      })}

                      {/* Month column highlight bar */}
                      {activeCloudMonthHover !== null && (
                        <rect
                          x={padL + activeCloudMonthHover * colWidth + 2}
                          y={padT}
                          width={colWidth - 4}
                          height={plotH}
                          fill="rgba(56, 189, 248, 0.08)"
                          stroke="rgba(56, 189, 248, 0.3)"
                          strokeWidth={1}
                          rx={4}
                          pointerEvents="none"
                        />
                      )}

                      {solarAnalytics.monthlySolar.map((s, i) => {
                        const bw = Math.min(36, colWidth - 12);
                        const x = xForM(i) - bw / 2;
                        const hClear = (s.clearSkyPct / 100) * plotH;
                        const hPartly = (s.partlyCloudyPct / 100) * plotH;
                        const hOver = (s.overcastPct / 100) * plotH;
                        const yClear = padT + plotH - hClear;
                        const yPartly = yClear - hPartly;
                        const yOver = yPartly - hOver;
                        const isHovered = activeCloudMonthHover === i;

                        return (
                          <g key={s.month}>
                            <rect x={x} y={yClear} width={bw} height={Math.max(0, hClear)} fill="#38bdf8" rx={1} opacity={isHovered ? 1 : 0.9} />
                            <rect x={x} y={yPartly} width={bw} height={Math.max(0, hPartly)} fill="#94a3b8" rx={1} opacity={isHovered ? 1 : 0.85} />
                            <rect x={x} y={yOver} width={bw} height={Math.max(0, hOver)} fill="#475569" rx={1} opacity={isHovered ? 1 : 0.85} />
                            <text
                              x={xForM(i)}
                              y={H - 10}
                              textAnchor="middle"
                              fontSize={isHovered ? '11' : '10'}
                              fontWeight={isHovered ? '800' : '600'}
                              fill={isHovered ? '#0f172a' : '#475569'}
                            >
                              {s.month}
                            </text>
                          </g>
                        );
                      })}

                      {/* Continuous Mean Sky Cover Curve */}
                      <polyline fill="none" stroke="#f59e0b" strokeWidth={2.6} points={cloudPts} />
                      {solarAnalytics.monthlySolar.map((s, i) => (
                        <circle
                          key={i}
                          cx={xForM(i)}
                          cy={yForPct(s.skyCoverMeanPct)}
                          r={activeCloudMonthHover === i ? 5.5 : 4}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}

                      {/* Interactive Month Hover Columns */}
                      {solarAnalytics.monthlySolar.map((s, i) => (
                        <rect
                          key={`cloud-hover-${s.month}`}
                          x={padL + i * colWidth}
                          y={padT}
                          width={colWidth}
                          height={plotH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={(e) => {
                            setActiveCloudMonthHover(i);
                            tooltipCtx.show(e, `${s.month} Sky Cover & Solar Regime (CBE Clima)`, [
                              { label: 'Mean Sky Cover', value: `${s.skyCoverMeanPct}%`, color: '#f59e0b' },
                              { label: 'Clear Sky Share (≤30%)', value: `${s.clearSkyPct}% of Month`, color: '#38bdf8' },
                              { label: 'Partly Cloudy (40–70%)', value: `${s.partlyCloudyPct}% of Month`, color: '#94a3b8' },
                              { label: 'Overcast Share (≥80%)', value: `${s.overcastPct}% of Month`, color: '#475569' },
                              { label: 'Monthly Total GHI', value: `${s.ghiMonthlyKwh} kWh/m²` },
                              { label: 'Monthly Total DNI', value: `${s.dniMonthlyKwh} kWh/m²` }
                            ]);
                          }}
                          onMouseMove={(e) => tooltipCtx.move(e)}
                          onMouseLeave={() => {
                            setActiveCloudMonthHover(null);
                            tooltipCtx.hide();
                          }}
                        />
                      ))}
                    </svg>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 pt-1">
                      <span className="font-semibold text-slate-500">Monthly Sky Cover Regime Share (%)</span>
                      <div className="flex items-center gap-4 font-bold">
                        <span className="flex items-center gap-1.5 text-sky-600">
                          <span className="w-3 h-3 rounded-sm bg-sky-400 inline-block" /> Clear (≤30%)
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" /> Partly (40–70%)
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-3 h-3 rounded-sm bg-slate-600 inline-block" /> Overcast (≥80%)
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Mean Cloud %
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            </ClimaChartCard>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TABS 5, 6, 7, 8, 9
         ===================================================================== */}
      {activeSubTab === 'wind' && (
        <SubTab5Wind climate={climate} globalValueRanges={globalValueRanges} />
      )}

      {activeSubTab === 'psychrometric' && (
        <SubTab6Psychrometric
          climate={climate}
          comfortLower={comfortTempLower}
          comfortUpper={comfortTempUpper}
          activeStrategies={activeStrategies}
          toggleStrategy={toggleStrategy}
          setActiveStrategiesList={setActiveStrategiesList}
          strategyMods={sim.strategyMods}
        />
      )}

      {activeSubTab === 'nat_vent' && <SubTab7NatVent climate={climate} />}

      {activeSubTab === 'utci' && <SubTab8Utci climate={climate} />}

      {activeSubTab === 'explorer' && <SubTab9DataExplorer climate={climate} />}

      {/* =====================================================================
          IMPROVEMENT #5: AUTO-GENERATED ARCHITECTURAL DESIGN TAKEAWAY CARD
         ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-indigo-500/40 shadow-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 block">
              Improvement #5 • Architectural Design Takeaway (Board-Ready Quantitative Annotation)
            </span>
            <h4 className="text-sm font-bold text-white mt-0.5">{boardCommentary.headline}</h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(boardCommentary.sentences.join(' '));
                setCopiedAnnotation(true);
                setTimeout(() => setCopiedAnnotation(false), 2000);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-1.5 transition"
            >
              {copiedAnnotation ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedAnnotation ? 'Copied Board Text!' : 'Copy Board Text'}
            </button>
            <button
              type="button"
              onClick={() => setActiveStrategiesList(boardCommentary.recommendedStrategyIds)}
              className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Sync Recommended Strategies to Stages 3 & 4
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-200 pt-1">
          {boardCommentary.sentences.map((sent, idx) => (
            <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
              <span className="text-teal-400 font-extrabold mr-1.5">0{idx + 1}.</span>
              {sent}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
