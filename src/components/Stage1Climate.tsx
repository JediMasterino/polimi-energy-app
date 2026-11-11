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
  Calendar,
  Clock,
  Filter,
  Info,
  Eye,
  Download
} from 'lucide-react';
import { useDesignProject } from '../context/DesignProjectContext';
import { MONTHS } from '../data/climateAndStrategies';
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
  calcDewPointC,
  generateBoardReadyCommentary,
  colorForUtciContinuous,
  CBE_UTCI_BLUE_RED_YELLOW_GRADIENT_CSS,
  exportDataToCsvFile,
  calcFacadeShadingRadiationBreakdown,
  calcMonthlyClimateSummaryTable
} from '../utils/epwParser';
import { EpwSearchAndUploadWidget } from './ClimaAndAdvancedPanels';
import {
  ClimaChartCard,
  CarpetHeatmap24x365,
  colorForTempC,
  colorForRhPct,
  CBE_RDYLBU_R_GRADIENT_CSS,
  CBE_YLGNBU_GRADIENT_CSS,
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
  const [activeShadingMonthHover, setActiveShadingMonthHover] = useState<number | null>(null);

  // Sub-Tab 4: Sun Path & Shading Protractor controls (Improvement #2 - Advanced Solar & Shading Mask Studio)
  const [sunProjection, setSunProjection] = useState<'polar' | 'cartesian'>('polar');
  const [sunColorMode, setSunColorMode] = useState<'temp' | 'ghi' | 'dni' | 'utci' | 'relHum'>('temp');
  const [facadeAzimuthDeg, setFacadeAzimuthDeg] = useState<number>(180); // 180° = South, 90° = East, 270° = West, 0° = North
  const [overhangAngleDeg, setOverhangAngleDeg] = useState<number>(58);
  const [finAngleDeg, setFinAngleDeg] = useState<number>(35);
  const [leftFinAngleDeg, setLeftFinAngleDeg] = useState<number>(35);
  const [rightFinAngleDeg, setRightFinAngleDeg] = useState<number>(35);
  const [finsSymmetric, setFinsSymmetric] = useState<boolean>(true);
  const [showAnalemmas, setShowAnalemmas] = useState<boolean>(true);
  const [showDeclinationArcs, setShowDeclinationArcs] = useState<boolean>(true);
  const [showAnnualScatter, setShowAnnualScatter] = useState<boolean>(false);
  const [showProtractor, setShowProtractor] = useState<boolean>(true);
  const [showUrbanSkylineMask, setShowUrbanSkylineMask] = useState<boolean>(true);
  const [selectedDayOfYear, setSelectedDayOfYear] = useState<number>(172); // Default: Summer Solstice (Jun 21)
  const [selectedSunHour, setSelectedSunHour] = useState<number>(12); // Default: Solar Noon (12:00)
  const [shadingFilter, setShadingFilter] = useState<'all' | 'overheated' | 'underheated'>('all');

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

  const monthlySummaryTable = useMemo(
    () => calcMonthlyClimateSummaryTable(climate.hourly),
    [climate.hourly]
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

  // Sub-Tab 4: Facade Shading Radiation Breakdown (Unshaded vs Shaded kWh/m²)
  const facadeShadingAnalysis = useMemo(
    () =>
      calcFacadeShadingRadiationBreakdown(
        climate.hourly,
        facadeAzimuthDeg,
        overhangAngleDeg,
        leftFinAngleDeg,
        rightFinAngleDeg,
        sim.canyonAnglesDeg,
        showProtractor,
        showUrbanSkylineMask
      ),
    [
      climate.hourly,
      facadeAzimuthDeg,
      overhangAngleDeg,
      leftFinAngleDeg,
      rightFinAngleDeg,
      sim.canyonAnglesDeg,
      showProtractor,
      showUrbanSkylineMask
    ]
  );

  // Sub-Tab 4: True Astronomical Analemmas (Equation-of-Time figure-8 loops 6:00 - 18:00)
  const analemmaLoops = useMemo(() => {
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    return hours.map((hr) => {
      const pts: Array<{ alt: number; az: number; d: number }> = [];
      for (let d = 1; d <= 365; d += 2) {
        const pos = calcSolarPosition(climate.lat, d, hr, climate.lon, climate.tz);
        if (pos.alt > 0) {
          pts.push({ ...pos, d });
        }
      }
      if (pts.length > 8) {
        const p1 = calcSolarPosition(climate.lat, 1, hr, climate.lon, climate.tz);
        if (p1.alt > 0) {
          pts.push({ ...p1, d: 366 });
        }
      }
      return { hour: hr, pts };
    }).filter((loop) => loop.pts.length > 0);
  }, [climate.lat, climate.lon, climate.tz]);

  // Sub-Tab 4: 7 Key Declination Arcs across the year (21st of each month)
  const declinationTracks = useMemo(() => {
    const tracks = [
      { day: 172, label: '21 Jun (Solstice)', shortLabel: '21 Jun', color: '#e11d48', bold: true },
      { day: 141, label: '21 May / Jul', shortLabel: 'May / Jul', color: '#ea580c', bold: false },
      { day: 111, label: '21 Apr / Aug', shortLabel: 'Apr / Aug', color: '#d97706', bold: false },
      { day: 80, label: '21 Mar / Sep (Equinox)', shortLabel: '21 Mar/Sep', color: '#059669', bold: true },
      { day: 52, label: '21 Feb / Oct', shortLabel: 'Feb / Oct', color: '#0891b2', bold: false },
      { day: 21, label: '21 Jan / Nov', shortLabel: 'Jan / Nov', color: '#2563eb', bold: false },
      { day: 355, label: '21 Dec (Solstice)', shortLabel: '21 Dec', color: '#4f46e5', bold: true }
    ];
    return tracks.map((t) => {
      const pts: Array<{ alt: number; az: number; hr: number }> = [];
      for (let hr = 3.5; hr <= 20.5; hr += 0.1) {
        const pos = calcSolarPosition(climate.lat, t.day, hr, climate.lon, climate.tz);
        if (pos.alt > 0) {
          pts.push({ ...pos, hr });
        }
      }
      return { ...t, pts };
    });
  }, [climate.lat, climate.lon, climate.tz]);

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
        <div className={`pt-2.5 border-t border-slate-700/80 grid grid-cols-1 ${stage1WideMode ? 'lg:grid-cols-12' : ''} gap-3 items-center text-xs`}>
          {/* Global vs Local Y-Axis Toggle */}
          <div className={`${stage1WideMode ? 'lg:col-span-3' : 'w-full'} flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-700`}>
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

          {/* Weather Morphing Sliders */}
          <div className={`${stage1WideMode ? 'lg:col-span-9' : 'w-full'} bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-3`}>
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

            <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
              <label className="flex-1 min-w-[105px] max-w-[150px]">
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

              <label className="flex-1 min-w-[95px] max-w-[140px]">
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

              <label className="flex-1 min-w-[95px] max-w-[140px]">
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
          {/* 1. Primary Global Weather Station Map & Live Search (Displayed First) */}
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

          {/* 2. Client-Side .EPW / .ZIP Drag-and-Drop Parser & Validator (No Duplicated Cards) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-teal-600" />
                  Client-Side .EPW / .ZIP Drag-and-Drop Parser & Validator
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Reads all 8 EPW header lines (Location, Design Conditions, Ground Temps) & 8,760 hourly rows with automatic quality validation
                </p>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                100% Client-Side In-Browser Processing
              </span>
            </div>

            <div className={`grid grid-cols-1 ${stage1WideMode ? 'lg:grid-cols-12' : ''} gap-5 items-stretch`}>
              {/* Drag-and-Drop Dropzone */}
              <div className={`${stage1WideMode ? 'lg:col-span-8' : 'w-full'} flex flex-col justify-between`}>
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
                  className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
                    isDraggingFile
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-slate-300 bg-slate-50/70 hover:border-teal-500 hover:bg-teal-50/30'
                  }`}
                >
                  <Upload className="w-9 h-9 text-teal-600 mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    Drop any EnergyPlus <code className="text-teal-700">.epw</code> or OneBuilding <code className="text-teal-700">.zip</code> file here
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    or click to browse local files from your computer (instant client-side parsing)
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
                  <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    {uploadStatusMsg}
                  </div>
                )}
                {uploadErrorMsg && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {uploadErrorMsg}
                  </div>
                )}
              </div>

              {/* Direct External Repositories Card */}
              <div className={`${stage1WideMode ? 'lg:col-span-4' : 'w-full'} bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between space-y-3 text-xs`}>
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                    Direct Climate Repositories
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Download official TMYx / IWEC2 weather files for thousands of international cities:
                  </p>
                </div>

                <div className="space-y-2">
                  <a
                    href="https://climate.onebuilding.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-white hover:bg-teal-50 text-teal-900 border border-slate-200 font-bold flex items-center justify-between gap-1 transition shadow-2xs hover:border-teal-300"
                  >
                    <div>
                      <div className="text-xs">Climate.OneBuilding.org</div>
                      <div className="text-[10px] text-slate-400 font-normal">20,200+ global TMYx stations</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  </a>
                  <a
                    href="https://www.ladybug.tools/epwmap/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-white hover:bg-teal-50 text-teal-900 border border-slate-200 font-bold flex items-center justify-between gap-1 transition shadow-2xs hover:border-teal-300"
                  >
                    <div>
                      <div className="text-xs">Ladybug Tools EPWMap</div>
                      <div className="text-[10px] text-slate-400 font-normal">Interactive global catalog viewer</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  </a>
                  <a
                    href="https://power.larc.nasa.gov/data-access-viewer/"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-white hover:bg-teal-50 text-teal-900 border border-slate-200 font-bold flex items-center justify-between gap-1 transition shadow-2xs hover:border-teal-300"
                  >
                    <div>
                      <div className="text-xs">NASA POWER Viewer</div>
                      <div className="text-[10px] text-slate-400 font-normal">Solar & meteorological satellite data</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
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

            <div className={`grid grid-cols-2 sm:grid-cols-4 ${stage1WideMode ? 'xl:grid-cols-8' : ''} gap-2.5 text-xs`}>
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

            {/* Monthly & Annual TMY Meteorological Summary Table (CBE Clima & ASHRAE 169 Benchmark) */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
                  Monthly & Annual Meteorological Normals (TMY Benchmark Table)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    exportDataToCsvFile(
                      ['Month', 'Mean_T_C', 'DailyMax_T_C', 'DailyMin_T_C', 'DiurnalRange_C', 'ExtremeMax_C', 'ExtremeMin_C', 'HDD18_Kd', 'CDD10_Kd', 'Mean_RH_%', 'Mean_DewPoint_C', 'GHI_kWh/m2', 'DNI_kWh/m2', 'Wind_m/s', 'PrevailingWind', 'CloudCover_%'],
                      [
                        ...monthlySummaryTable.monthly.map((m) => [
                          m.month, m.meanTempC, m.dailyMaxTempC, m.dailyMinTempC, m.diurnalRangeC, m.extremeMaxC, m.extremeMinC, m.hdd18, m.cdd10, m.meanRhPct, m.meanDewPointC, m.ghiKwhM2, m.dniKwhM2, m.meanWindSpeedMs, m.prevailingWindDir, m.meanCloudCoverPct
                        ]),
                        [
                          monthlySummaryTable.annual.month, monthlySummaryTable.annual.meanTempC, monthlySummaryTable.annual.dailyMaxTempC, monthlySummaryTable.annual.dailyMinTempC, monthlySummaryTable.annual.diurnalRangeC, monthlySummaryTable.annual.extremeMaxC, monthlySummaryTable.annual.extremeMinC, monthlySummaryTable.annual.hdd18, monthlySummaryTable.annual.cdd10, monthlySummaryTable.annual.meanRhPct, monthlySummaryTable.annual.meanDewPointC, monthlySummaryTable.annual.ghiKwhM2, monthlySummaryTable.annual.dniKwhM2, monthlySummaryTable.annual.meanWindSpeedMs, monthlySummaryTable.annual.prevailingWindDir, monthlySummaryTable.annual.meanCloudCoverPct
                        ]
                      ],
                      `${climate.id}_monthly_climate_summary.csv`
                    );
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10.5px] flex items-center gap-1 border border-slate-300 transition cursor-pointer"
                  title="Export complete 12-month TMY summary table to CSV"
                >
                  <Download className="w-3 h-3 text-teal-600" />
                  Export Table CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-[10.5px] border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2 text-left">Month</th>
                      <th className="p-2 text-center" title="Mean Dry-Bulb Temperature">Mean T (°C)</th>
                      <th className="p-2 text-center" title="Mean Daily Maximum Temperature">Daily Max (°C)</th>
                      <th className="p-2 text-center" title="Mean Daily Minimum Temperature">Daily Min (°C)</th>
                      <th className="p-2 text-center" title="Mean Daily Diurnal Temperature Swing">Diurnal ΔT (°C)</th>
                      <th className="p-2 text-center" title="Extreme Peak / Lowest Recorded Hourly Temperature">Extreme Max/Min (°C)</th>
                      <th className="p-2 text-center" title="Heating Degree Days Base 18°C">HDD₁₈ (K·d)</th>
                      <th className="p-2 text-center" title="Cooling Degree Days Base 10°C">CDD₁₀ (K·d)</th>
                      <th className="p-2 text-center" title="Mean Relative Humidity">RH (%)</th>
                      <th className="p-2 text-center" title="Mean Dew-Point Temperature">T_dp (°C)</th>
                      <th className="p-2 text-center" title="Global Horizontal Solar Irradiance">GHI (kWh/m²)</th>
                      <th className="p-2 text-center" title="Direct Normal Solar Irradiance">DNI (kWh/m²)</th>
                      <th className="p-2 text-center" title="Mean Wind Speed and Prevailing Direction">Wind (m/s & Dir)</th>
                      <th className="p-2 text-center" title="Mean Sky Cloud Cover">Cloud (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummaryTable.monthly.map((row, i) => (
                      <tr key={row.month} className={i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-50'}>
                        <td className="p-2 font-bold text-slate-800">{row.month}</td>
                        <td className="p-2 text-center font-mono font-bold text-slate-800">{row.meanTempC}°</td>
                        <td className="p-2 text-center font-mono text-rose-700 font-semibold">{row.dailyMaxTempC}°</td>
                        <td className="p-2 text-center font-mono text-sky-700 font-semibold">{row.dailyMinTempC}°</td>
                        <td className="p-2 text-center font-mono text-slate-600">{row.diurnalRangeC}°</td>
                        <td className="p-2 text-center font-mono text-[10px] text-slate-600">
                          <span className="text-rose-600 font-bold">{row.extremeMaxC}°</span> / <span className="text-sky-600 font-bold">{row.extremeMinC}°</span>
                        </td>
                        <td className="p-2 text-center font-mono text-sky-800 font-bold">{row.hdd18}</td>
                        <td className="p-2 text-center font-mono text-rose-800 font-bold">{row.cdd10}</td>
                        <td className="p-2 text-center font-mono text-teal-800">{row.meanRhPct}%</td>
                        <td className="p-2 text-center font-mono text-slate-600">{row.meanDewPointC}°</td>
                        <td className="p-2 text-center font-mono text-amber-700 font-bold">{row.ghiKwhM2}</td>
                        <td className="p-2 text-center font-mono text-amber-800">{row.dniKwhM2}</td>
                        <td className="p-2 text-center font-mono text-slate-700">
                          {row.meanWindSpeedMs} <span className="text-[9px] font-bold text-teal-700">{row.prevailingWindDir}</span>
                        </td>
                        <td className="p-2 text-center font-mono text-slate-600">{row.meanCloudCoverPct}%</td>
                      </tr>
                    ))}
                    {/* Annual Summary Row */}
                    <tr className="bg-teal-50/80 font-bold text-teal-950 border-t-2 border-teal-300">
                      <td className="p-2 font-extrabold uppercase">Annual Total / Mean</td>
                      <td className="p-2 text-center font-mono font-extrabold">{monthlySummaryTable.annual.meanTempC}°C</td>
                      <td className="p-2 text-center font-mono text-rose-800">{monthlySummaryTable.annual.dailyMaxTempC}°C</td>
                      <td className="p-2 text-center font-mono text-sky-800">{monthlySummaryTable.annual.dailyMinTempC}°C</td>
                      <td className="p-2 text-center font-mono">{monthlySummaryTable.annual.diurnalRangeC}°C</td>
                      <td className="p-2 text-center font-mono text-[10px]">
                        <span className="text-rose-700 font-bold">{monthlySummaryTable.annual.extremeMaxC}°</span> / <span className="text-sky-700 font-bold">{monthlySummaryTable.annual.extremeMinC}°</span>
                      </td>
                      <td className="p-2 text-center font-mono text-sky-900 font-extrabold">{monthlySummaryTable.annual.hdd18}</td>
                      <td className="p-2 text-center font-mono text-rose-900 font-extrabold">{monthlySummaryTable.annual.cdd10}</td>
                      <td className="p-2 text-center font-mono">{monthlySummaryTable.annual.meanRhPct}%</td>
                      <td className="p-2 text-center font-mono">{monthlySummaryTable.annual.meanDewPointC}°C</td>
                      <td className="p-2 text-center font-mono text-amber-900 font-extrabold">{monthlySummaryTable.annual.ghiKwhM2}</td>
                      <td className="p-2 text-center font-mono text-amber-900">{monthlySummaryTable.annual.dniKwhM2}</td>
                      <td className="p-2 text-center font-mono">
                        {monthlySummaryTable.annual.meanWindSpeedMs} m/s <span className="text-[9px]">{monthlySummaryTable.annual.prevailingWindDir}</span>
                      </td>
                      <td className="p-2 text-center font-mono">{monthlySummaryTable.annual.meanCloudCoverPct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
          <div className={`grid grid-cols-1 ${stage1WideMode && chartDensity !== 'spacious' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
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
          <div className={`grid grid-cols-1 ${stage1WideMode && chartDensity !== 'spacious' ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
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
          <div className={`grid grid-cols-1 ${stage1WideMode && chartDensity !== 'spacious' ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
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
              {(svgRef, tooltipCtx) => {
                const tdbMin = Math.min(...climate.hourly.map((h) => h.dryBulb));
                const tdbMax = Math.max(...climate.hourly.map((h) => h.dryBulb));
                const tempRangeMin = globalValueRanges ? -20 : Math.floor(tdbMin);
                const tempRangeMax = globalValueRanges ? 45 : Math.ceil(tdbMax);

                return (
                  <CarpetHeatmap24x365
                    svgRef={svgRef}
                    tooltipCtx={tooltipCtx}
                    hourly={climate.hourly}
                    getValue={(h) => h.dryBulb}
                    getColor={(v) => colorForTempC(v, globalValueRanges, tempRangeMin, tempRangeMax)}
                    unitLabel="°C"
                    continuousLegend={{
                      min: tempRangeMin,
                      max: tempRangeMax,
                      unit: '°C',
                      gradientCss: CBE_RDYLBU_R_GRADIENT_CSS,
                      description: `CBE Clima Continuous Gradient (${globalValueRanges ? 'Global Range [-20, +45]°C' : `Local Range [${tempRangeMin.toFixed(0)}, ${tempRangeMax.toFixed(0)}]°C`})`
                    }}
                    customTooltipRows={(val, rec) => [
                      { label: 'Dry-Bulb Temp', value: `${val.toFixed(1)}°C`, color: colorForTempC(val, globalValueRanges, tempRangeMin, tempRangeMax) },
                      { label: 'Relative Humidity', value: `${rec.relHum}%` },
                      { label: 'Dew-Point Temp', value: `${(rec.dewPoint ?? calcDewPointC(rec.dryBulb, rec.relHum)).toFixed(1)}°C` },
                      { label: 'Wind Speed', value: `${rec.windSpeed} m/s` },
                      { label: 'Direct Normal Solar (DNI)', value: `${rec.dni ?? 0} Wh/m²` }
                    ]}
                  />
                );
              }}
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
              {(svgRef, tooltipCtx) => {
                const rhMin = Math.min(...climate.hourly.map((h) => h.relHum));
                const rhMax = Math.max(...climate.hourly.map((h) => h.relHum));
                const rhRangeMin = globalValueRanges ? 0 : Math.floor(rhMin);
                const rhRangeMax = globalValueRanges ? 100 : Math.ceil(rhMax);

                return (
                  <CarpetHeatmap24x365
                    svgRef={svgRef}
                    tooltipCtx={tooltipCtx}
                    hourly={climate.hourly}
                    getValue={(h) => h.relHum}
                    getColor={(rh) => colorForRhPct(rh, rhRangeMin, rhRangeMax)}
                    unitLabel="% RH"
                    continuousLegend={{
                      min: rhRangeMin,
                      max: rhRangeMax,
                      unit: '%',
                      gradientCss: CBE_YLGNBU_GRADIENT_CSS,
                      description: `CBE Clima Continuous Gradient (${globalValueRanges ? 'Global Range [0, 100]%' : `Local Range [${rhRangeMin.toFixed(0)}, ${rhRangeMax.toFixed(0)}]%`})`
                    }}
                    customTooltipRows={(val, rec) => [
                      { label: 'Relative Humidity', value: `${val.toFixed(1)}%`, color: colorForRhPct(val, rhRangeMin, rhRangeMax) },
                      { label: 'Dry-Bulb Temp', value: `${rec.dryBulb}°C` },
                      { label: 'Dew-Point Temp', value: `${(rec.dewPoint ?? calcDewPointC(rec.dryBulb, rec.relHum)).toFixed(1)}°C` },
                      { label: 'Air Moisture Regime', value: val < 30 ? 'Dry / Arid (<30%)' : val > 70 ? 'Humid / Muggy (>70%)' : 'Comfortable (30–70%)' }
                    ]}
                  />
                );
              }}
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
          <div className={`grid grid-cols-1 ${stage1WideMode && chartDensity !== 'spacious' ? 'xl:grid-cols-12 gap-5' : 'gap-6'}`}>
            {/* Toggleable Polar / Cartesian Sun-Path + Overhang Protractor + Stage 2 Urban Skyline Mask */}
            <div className={stage1WideMode && chartDensity !== 'spacious' ? 'xl:col-span-8' : 'w-full'}>
              <ClimaChartCard
                title="Interactive Sun-Path & Architectural Shading Mask Studio"
                subtitle={`Solar trajectory & shading mask for ${facadeAzimuthDeg}° orientation • Overhang θ_v = ${overhangAngleDeg}° (D/H = ${(1 / Math.tan((overhangAngleDeg * Math.PI) / 180)).toFixed(2)}) • Fins: ${finsSymmetric ? `±${finAngleDeg}°` : `L:${leftFinAngleDeg}° / R:${rightFinAngleDeg}°`} • Net Selectivity = ${facadeShadingAnalysis.netSelectivityScore.toFixed(2)}x`}
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
                  <div className="space-y-2.5 text-xs">
                    {/* Row 1: Projection, Color Mode & Shading Period Filter */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-semibold">View:</span>
                        <button
                          type="button"
                          onClick={() => setSunProjection('polar')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                            sunProjection === 'polar'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Polar Stereographic
                        </button>
                        <button
                          type="button"
                          onClick={() => setSunProjection('cartesian')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                            sunProjection === 'cartesian'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Cartesian (Az × Alt)
                        </button>
                      </div>

                      {/* Color By selector */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-semibold">Color:</span>
                        {(
                          [
                            { id: 'temp', label: 'T_db (°C)' },
                            { id: 'ghi', label: 'GHI (W/m²)' },
                            { id: 'dni', label: 'DNI (W/m²)' },
                            { id: 'utci', label: 'UTCI (°C)' },
                            { id: 'relHum', label: 'RH (%)' }
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSunColorMode(opt.id)}
                            className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] border transition cursor-pointer ${
                              sunColorMode === opt.id
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Shading Filter */}
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10.5px]">
                        <span className="text-[10px] text-slate-500 font-bold px-1.5 uppercase">Filter:</span>
                        {(
                          [
                            { id: 'all', label: 'All Hours' },
                            { id: 'overheated', label: 'Overheated (≥24°C)' },
                            { id: 'underheated', label: 'Underheated (<18°C)' }
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setShadingFilter(f.id)}
                            className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                              shadingFilter === f.id
                                ? 'bg-white text-slate-900 shadow-xs font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Row 2: Facade Orientation & Shading Mask Geometry Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 text-[11px]">
                      {/* Facade Azimuth */}
                      <div>
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <span className="flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5 text-amber-700" />
                            Facade Azimuth
                          </span>
                          <span className="font-bold text-amber-900 font-mono tabular-nums">
                            {facadeAzimuthDeg}° ({facadeAzimuthDeg === 180 ? 'S' : facadeAzimuthDeg === 90 ? 'E' : facadeAzimuthDeg === 270 ? 'W' : facadeAzimuthDeg === 0 ? 'N' : `${facadeAzimuthDeg}°`})
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={5}
                          value={facadeAzimuthDeg}
                          onChange={(e) => setFacadeAzimuthDeg(Number(e.target.value))}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 font-bold pt-0.5">
                          {[
                            { az: 180, lbl: 'S' },
                            { az: 135, lbl: 'SE' },
                            { az: 90, lbl: 'E' },
                            { az: 45, lbl: 'NE' },
                            { az: 0, lbl: 'N' },
                            { az: 315, lbl: 'NW' },
                            { az: 270, lbl: 'W' },
                            { az: 225, lbl: 'SW' }
                          ].map((p) => (
                            <button
                              key={p.az}
                              type="button"
                              onClick={() => setFacadeAzimuthDeg(p.az)}
                              className={`px-1 py-0.2 rounded hover:bg-amber-200/60 ${facadeAzimuthDeg === p.az ? 'text-amber-900 font-black underline' : ''}`}
                            >
                              {p.lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Overhang Profile Cutoff Angle */}
                      <div>
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <span>Overhang Cutoff θ_v</span>
                          <span className="font-bold text-amber-800 font-mono tabular-nums">
                            {overhangAngleDeg}° (D/H={(1 / Math.tan((overhangAngleDeg * Math.PI) / 180)).toFixed(2)})
                          </span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={80}
                          value={overhangAngleDeg}
                          onChange={(e) => {
                            const deg = Number(e.target.value);
                            setOverhangAngleDeg(deg);
                            const depthM = +(1.5 / Math.tan((deg * Math.PI) / 180)).toFixed(2);
                            setOverhangDepth(Math.max(0.1, Math.min(2.0, depthM)));
                            setShadingMode('fixed_overhang');
                          }}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>20° (Deep 4.1m)</span>
                          <span>58° (Med 0.9m)</span>
                          <span>80° (Shallow 0.26m)</span>
                        </div>
                      </div>

                      {/* Vertical Fins Cutoff Angle (Symmetric / Asymmetric) */}
                      <div>
                        <div className="flex justify-between items-center font-semibold text-slate-700">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={finsSymmetric}
                              onChange={(e) => {
                                const sym = e.target.checked;
                                setFinsSymmetric(sym);
                                if (sym) {
                                  setRightFinAngleDeg(leftFinAngleDeg);
                                  setFinAngleDeg(leftFinAngleDeg);
                                }
                              }}
                              className="accent-indigo-600 w-3 h-3"
                            />
                            <span>{finsSymmetric ? 'Fins ±θ_h (Sym)' : 'Fins (Asym)'}</span>
                          </label>
                          <span className="font-bold text-indigo-800 font-mono tabular-nums">
                            {finsSymmetric
                              ? `±${finAngleDeg}°`
                              : `L:${leftFinAngleDeg}° / R:${rightFinAngleDeg}°`}
                          </span>
                        </div>
                        {finsSymmetric ? (
                          <>
                            <input
                              type="range"
                              min={15}
                              max={80}
                              value={finAngleDeg}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setFinAngleDeg(v);
                                setLeftFinAngleDeg(v);
                                setRightFinAngleDeg(v);
                              }}
                              className="w-full accent-indigo-600 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-slate-500">
                              <span>±15° (Deep Louvers)</span>
                              <span>±80° (Open)</span>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-1 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9.5px] font-bold text-slate-500 w-6">Left:</span>
                              <input
                                type="range"
                                min={15}
                                max={80}
                                value={leftFinAngleDeg}
                                onChange={(e) => setLeftFinAngleDeg(Number(e.target.value))}
                                className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                              />
                              <span className="font-mono text-[9.5px] font-bold text-indigo-900 w-6 text-right">
                                {leftFinAngleDeg}°
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9.5px] font-bold text-slate-500 w-6">Right:</span>
                              <input
                                type="range"
                                min={15}
                                max={80}
                                value={rightFinAngleDeg}
                                onChange={(e) => setRightFinAngleDeg(Number(e.target.value))}
                                className="flex-1 accent-indigo-600 cursor-pointer h-1.5"
                              />
                              <span className="font-mono text-[9.5px] font-bold text-indigo-900 w-6 text-right">
                                {rightFinAngleDeg}°
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Studio Layer Toggles */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <label className="flex items-center gap-1 font-semibold text-slate-800 text-[10.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showProtractor}
                            onChange={(e) => setShowProtractor(e.target.checked)}
                            className="accent-amber-600 w-3 h-3"
                          />
                          <span>Overhang & Fins</span>
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-800 text-[10.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showUrbanSkylineMask}
                            onChange={(e) => setShowUrbanSkylineMask(e.target.checked)}
                            className="accent-teal-600 w-3 h-3"
                          />
                          <span>Urban Skyline</span>
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-800 text-[10.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showDeclinationArcs}
                            onChange={(e) => setShowDeclinationArcs(e.target.checked)}
                            className="accent-rose-600 w-3 h-3"
                          />
                          <span>7 Declinations</span>
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-800 text-[10.5px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showAnalemmas}
                            onChange={(e) => setShowAnalemmas(e.target.checked)}
                            className="accent-sky-600 w-3 h-3"
                          />
                          <span>Analemmas (6–18h)</span>
                        </label>
                        <label className="flex items-center gap-1 font-semibold text-slate-800 text-[10.5px] cursor-pointer col-span-2">
                          <input
                            type="checkbox"
                            checked={showAnnualScatter}
                            onChange={(e) => setShowAnnualScatter(e.target.checked)}
                            className="accent-slate-700 w-3 h-3"
                          />
                          <span className="text-slate-600">Annual EPW Scatter (4,380h)</span>
                        </label>
                      </div>
                    </div>

                    {/* Row 3: Day of Year Trajectory & Time Inspector (CBE Clima parity) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/90 p-2 rounded-xl border border-slate-200 text-[11px]">
                      {/* Day of Year slider */}
                      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <span className="font-semibold text-slate-700 shrink-0 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-rose-500" />
                          Track Date:
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={365}
                          value={selectedDayOfYear}
                          onChange={(e) => setSelectedDayOfYear(Number(e.target.value))}
                          className="flex-1 accent-rose-600 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800 font-mono text-[11px] shrink-0 min-w-[145px]">
                          {(() => {
                            const dt = new Date(Date.UTC(2023, 0, selectedDayOfYear));
                            const m = MONTHS[dt.getUTCMonth()];
                            const d = dt.getUTCDate();
                            if (selectedDayOfYear === 172) return `${m} ${d} (Summer Solstice)`;
                            if (selectedDayOfYear === 355) return `${m} ${d} (Winter Solstice)`;
                            if (selectedDayOfYear === 80) return `${m} ${d} (Spring Equinox)`;
                            if (selectedDayOfYear === 264) return `${m} ${d} (Autumn Equinox)`;
                            return `${m} ${d} (Day ${selectedDayOfYear})`;
                          })()}
                        </span>
                      </div>

                      {/* Quick Day Presets */}
                      <div className="flex items-center gap-1 text-[10px]">
                        {[
                          { doy: 172, label: 'Jun 21 ☀️' },
                          { doy: 80, label: 'Mar 21 🌿' },
                          { doy: 355, label: 'Dec 21 ❄️' }
                        ].map((btn) => (
                          <button
                            key={btn.doy}
                            type="button"
                            onClick={() => setSelectedDayOfYear(btn.doy)}
                            className={`px-2 py-0.5 rounded font-bold border transition cursor-pointer ${
                              selectedDayOfYear === btn.doy
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      {/* Solar Time Inspector Slider */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Hour:
                        </span>
                        <input
                          type="range"
                          min={5}
                          max={20}
                          step={0.5}
                          value={selectedSunHour}
                          onChange={(e) => setSelectedSunHour(Number(e.target.value))}
                          className="w-24 accent-amber-500 cursor-pointer"
                        />
                        <span className="font-bold text-amber-900 font-mono text-[11px] w-12 text-right">
                          {Math.floor(selectedSunHour).toString().padStart(2, '0')}:
                          {selectedSunHour % 1 === 0 ? '00' : '30'}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              >
                {(svgRef, tooltipCtx) => {
                  const sunHours = climate.hourly.filter((h) => h.solarAlt > 0.5);
                  const canyonS = sim.canyonAnglesDeg.S;
                  const canyonE = sim.canyonAnglesDeg.E;
                  const canyonW = sim.canyonAnglesDeg.W;

                  const effLeftFin = finsSymmetric ? finAngleDeg : leftFinAngleDeg;
                  const effRightFin = finsSymmetric ? finAngleDeg : rightFinAngleDeg;

                  // Helper for shading evaluation on any solar vector
                  const evalShading = (alt: number, az: number) => {
                    let dAz = az - facadeAzimuthDeg;
                    while (dAz > 180) dAz -= 360;
                    while (dAz < -180) dAz += 360;
                    const inFront = Math.abs(dAz) < 90;
                    const cosDelta = Math.cos((dAz * Math.PI) / 180);
                    const radAlt = (alt * Math.PI) / 180;
                    const profileAngle =
                      inFront && cosDelta > 0.001
                        ? Math.atan(Math.tan(radAlt) / cosDelta) * (180 / Math.PI)
                        : 90;

                    let canyonAlt = 0;
                    if (az >= 135 && az <= 225) canyonAlt = canyonS;
                    else if (az >= 45 && az < 135) canyonAlt = canyonE;
                    else if (az > 225 && az <= 315) canyonAlt = canyonW;
                    else canyonAlt = Math.max(canyonE, canyonW) * 0.5;

                    const canyonBlocked = showUrbanSkylineMask && alt <= canyonAlt;
                    const overhangBlocked = showProtractor && inFront && profileAngle >= overhangAngleDeg;
                    const finBlocked =
                      showProtractor &&
                      inFront &&
                      ((dAz < 0 && Math.abs(dAz) >= effLeftFin) || (dAz > 0 && dAz >= effRightFin));
                    const selfShaded = !inFront;

                    return {
                      inFront,
                      profileAngle,
                      canyonBlocked,
                      overhangBlocked,
                      finBlocked,
                      selfShaded,
                      isBlocked: canyonBlocked || overhangBlocked || finBlocked || selfShaded
                    };
                  };

                  // Active Day Trajectory Continuous Points & Sunrise/Sunset (step 0.1h = 6 min for smooth curves)
                  const dayTrajectoryPts: Array<{ hr: number; alt: number; az: number }> = [];
                  let peakSolarAlt = 0;
                  for (let hr = 3.5; hr <= 21.0; hr += 0.1) {
                    const pos = calcSolarPosition(climate.lat, selectedDayOfYear, hr, climate.lon, climate.tz);
                    if (pos.alt > 0) {
                      if (pos.alt > peakSolarAlt) peakSolarAlt = pos.alt;
                      dayTrajectoryPts.push({ hr, alt: pos.alt, az: pos.az });
                    }
                  }

                  // Discrete hourly data points for the currently selected day (8–15 non-overlapping daylight hours)
                  const selectedDaySunHours = climate.hourly.filter(
                    (h) => h.dayOfYear === selectedDayOfYear && h.solarAlt > 0.5
                  );

                  // Active hour position
                  const activeSunPos = calcSolarPosition(climate.lat, selectedDayOfYear, selectedSunHour, climate.lon, climate.tz);

                  // Continuous Colormap Legend Config
                  const legendConfig = (() => {
                    if (sunColorMode === 'temp') {
                      const tMin = globalValueRanges ? -20 : -5;
                      const tMax = globalValueRanges ? 45 : 38;
                      return {
                        min: tMin,
                        max: tMax,
                        unit: '°C',
                        gradient: CBE_RDYLBU_R_GRADIENT_CSS,
                        description: `Dry-Bulb Air Temperature (${globalValueRanges ? 'Global' : 'Local'} RdYlBu_r)`
                      };
                    }
                    if (sunColorMode === 'ghi') {
                      return {
                        min: 0,
                        max: 1000,
                        unit: ' Wh/m²',
                        gradient: 'linear-gradient(to right, #0f172a 0%, #1e3a8a 20%, #0284c7 40%, #eab308 65%, #f97316 85%, #ef4444 100%)',
                        description: 'Global Horizontal Solar Irradiance (GHI)'
                      };
                    }
                    if (sunColorMode === 'dni') {
                      return {
                        min: 0,
                        max: 950,
                        unit: ' Wh/m²',
                        gradient: 'linear-gradient(to right, #1e293b 0%, #0369a1 25%, #f59e0b 60%, #dc2626 100%)',
                        description: 'Direct Normal Solar Irradiance (DNI)'
                      };
                    }
                    if (sunColorMode === 'utci') {
                      return {
                        min: -10,
                        max: 45,
                        unit: '°C',
                        gradient: CBE_UTCI_BLUE_RED_YELLOW_GRADIENT_CSS,
                        description: 'Universal Thermal Climate Index (UTCI Equivalent Temp)'
                      };
                    }
                    return {
                      min: 0,
                      max: 100,
                      unit: '%',
                      gradient: CBE_YLGNBU_GRADIENT_CSS,
                      description: 'Continuous Relative Humidity (YlGnBu)'
                    };
                  })();

                  // Helper point color mapper
                  const getSunColor = (h: (typeof climate.hourly)[0]) => {
                    if (sunColorMode === 'temp') return colorForTempC(h.dryBulb, globalValueRanges);
                    if (sunColorMode === 'ghi') {
                      const norm = Math.max(0, Math.min(1, h.ghi / 1000));
                      if (norm < 0.15) return '#1e3a8a';
                      if (norm < 0.4) return '#0284c7';
                      if (norm < 0.65) return '#eab308';
                      if (norm < 0.85) return '#f97316';
                      return '#ef4444';
                    }
                    if (sunColorMode === 'dni') {
                      const norm = Math.max(0, Math.min(1, (h.dni ?? 0) / 950));
                      if (norm < 0.2) return '#334155';
                      if (norm < 0.5) return '#0369a1';
                      if (norm < 0.8) return '#f59e0b';
                      return '#dc2626';
                    }
                    if (sunColorMode === 'utci') {
                      return colorForUtciContinuous(h.utci);
                    }
                    return colorForRhPct(h.relHum);
                  };

                  // Filtered sun hours
                  const visibleSunHours = sunHours.filter((h) => {
                    if (shadingFilter === 'overheated') return h.dryBulb >= 24;
                    if (shadingFilter === 'underheated') return h.dryBulb < 18;
                    return true;
                  });

                  // -------------------------------------------------------------
                  // 1. CARTESIAN PROJECTION VIEW
                  // -------------------------------------------------------------
                  if (sunProjection === 'cartesian') {
                    const W = 900;
                    const H = 440;
                    const padL = 52;
                    const padR = 24;
                    const padT = 24;
                    const padB = 40;
                    const plotW = W - padL - padR;
                    const plotH = H - padT - padB;
                    const xForAz = (az: number) => padL + (az / 360) * plotW;
                    const yForAlt = (alt: number) => padT + plotH - (Math.max(0, Math.min(90, alt)) / 90) * plotH;

                    // Overhang shading mask curve across the hemisphere facing the facade
                    const overhangMaskPoints: string[] = [];
                    if (showProtractor) {
                      for (let d = -88; d <= 88; d += 2) {
                        const az = (facadeAzimuthDeg + d + 360) % 360;
                        const radD = (d * Math.PI) / 180;
                        const cutAlt = Math.atan(Math.tan((overhangAngleDeg * Math.PI) / 180) * Math.cos(radD)) * (180 / Math.PI);
                        if (cutAlt < 90) {
                          overhangMaskPoints.push(`${xForAz(az).toFixed(1)},${yForAlt(cutAlt).toFixed(1)}`);
                        }
                      }
                    }

                    // Rear hemisphere self-shaded zones on cartesian plane
                    const rearCartRects: Array<{ x: number; w: number }> = [];
                    if (showProtractor) {
                      const azMin = facadeAzimuthDeg - 90;
                      const azMax = facadeAzimuthDeg + 90;
                      if (azMin < 0) {
                        const x1 = xForAz(azMax);
                        const x2 = xForAz(azMin + 360);
                        rearCartRects.push({ x: x1, w: Math.max(0, x2 - x1) });
                      } else if (azMax > 360) {
                        const x1 = xForAz(azMax - 360);
                        const x2 = xForAz(azMin);
                        rearCartRects.push({ x: x1, w: Math.max(0, x2 - x1) });
                      } else {
                        rearCartRects.push({ x: xForAz(0), w: Math.max(0, xForAz(azMin) - xForAz(0)) });
                        rearCartRects.push({ x: xForAz(azMax), w: Math.max(0, xForAz(360) - xForAz(azMax)) });
                      }
                    }

                    return (
                      <div className="space-y-3">
                        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
                          {/* Inner Plot Area Background */}
                          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} rx={4} />
                          {/* Altitude gridlines */}
                          {[0, 15, 30, 45, 60, 75, 90].map((alt) => (
                            <g key={alt}>
                              <line x1={padL} y1={yForAlt(alt)} x2={W - padR} y2={yForAlt(alt)} stroke="#e2e8f0" strokeDasharray="3 3" />
                              <text x={padL - 8} y={yForAlt(alt) + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                                {alt}°
                              </text>
                            </g>
                          ))}

                          {/* Azimuth gridlines */}
                          {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((az) => (
                            <g key={az}>
                              <line x1={xForAz(az)} y1={padT} x2={xForAz(az)} y2={H - padB} stroke="#e2e8f0" />
                              <text x={xForAz(az)} y={H - 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">
                                {az === 0 || az === 360
                                  ? 'N'
                                  : az === 90
                                  ? 'E 90°'
                                  : az === 180
                                  ? 'S 180°'
                                  : az === 270
                                  ? 'W 270°'
                                  : `${az}°`}
                              </text>
                            </g>
                          ))}

                          {/* Rear Envelope Self-Shaded Rectangular Bands */}
                          {rearCartRects.map((r, idx) => (
                            <rect
                              key={`rear-cart-${idx}`}
                              x={r.x}
                              y={padT}
                              width={r.w}
                              height={plotH}
                              fill="rgba(100, 116, 139, 0.12)"
                              stroke="#94a3b8"
                              strokeDasharray="3 3"
                            />
                          ))}

                          {/* Facade Normal Orientation Line */}
                          <line
                            x1={xForAz(facadeAzimuthDeg)}
                            y1={padT}
                            x2={xForAz(facadeAzimuthDeg)}
                            y2={H - padB}
                            stroke="#d97706"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                          />
                          <text
                            x={xForAz(facadeAzimuthDeg)}
                            y={padT - 8}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="800"
                            fill="#b45309"
                          >
                            ▲ Facade Normal ({facadeAzimuthDeg}°)
                          </text>

                          {/* Stage 2 Urban Canyon Obstruction Skyline along Horizon */}
                          {showUrbanSkylineMask && (
                            <polygon
                              points={`${xForAz(0)},${yForAlt(0)} ${xForAz(45)},${yForAlt(canyonE * 0.7)} ${xForAz(90)},${yForAlt(canyonE)} ${xForAz(135)},${yForAlt((canyonE + canyonS) / 2)} ${xForAz(180)},${yForAlt(canyonS)} ${xForAz(225)},${yForAlt((canyonS + canyonW) / 2)} ${xForAz(270)},${yForAlt(canyonW)} ${xForAz(315)},${yForAlt(canyonW * 0.7)} ${xForAz(360)},${yForAlt(canyonE * 0.7)} ${xForAz(360)},${yForAlt(0)}`}
                              fill="rgba(148, 163, 184, 0.35)"
                              stroke="#64748b"
                              strokeWidth={1.5}
                            />
                          )}

                          {/* Vertical Fins Boundary Lines */}
                          {showProtractor && (
                            <>
                              <line
                                x1={xForAz((facadeAzimuthDeg - effLeftFin + 360) % 360)}
                                y1={padT}
                                x2={xForAz((facadeAzimuthDeg - effLeftFin + 360) % 360)}
                                y2={H - padB}
                                stroke="#6366f1"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                              />
                              <line
                                x1={xForAz((facadeAzimuthDeg + effRightFin) % 360)}
                                y1={padT}
                                x2={xForAz((facadeAzimuthDeg + effRightFin) % 360)}
                                y2={H - padB}
                                stroke="#6366f1"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                              />
                            </>
                          )}

                          {/* Overhang Profile Shading Curve */}
                          {showProtractor && overhangMaskPoints.length > 1 && (
                            <polyline
                              fill="none"
                              stroke="#d97706"
                              strokeWidth={2}
                              strokeDasharray="4 2"
                              points={overhangMaskPoints.join(' ')}
                            />
                          )}

                          {/* 7 Annual Declination Tracks (Continuous Solid Curves) */}
                          {showDeclinationArcs &&
                            declinationTracks.map((t) => {
                              const pts = t.pts
                                .map((p) => `${xForAz(p.az).toFixed(1)},${yForAlt(p.alt).toFixed(1)}`)
                                .join(' ');
                              const peak = t.pts.reduce((prev, cur) => (cur.alt > prev.alt ? cur : prev), t.pts[0]);
                              return (
                                <g key={t.day}>
                                  <polyline
                                    fill="none"
                                    stroke={t.color}
                                    strokeWidth={t.bold ? 2.4 : 1.6}
                                    strokeOpacity={t.bold ? 0.95 : 0.8}
                                    points={pts}
                                  />
                                  {peak && (
                                    <text
                                      x={xForAz(peak.az) + 8}
                                      y={yForAlt(peak.alt) + (t.day === 172 ? -5 : 3)}
                                      fontSize="9"
                                      fontWeight={t.bold ? '800' : '600'}
                                      fill={t.color}
                                      className="select-none pointer-events-none font-mono"
                                    >
                                      {t.shortLabel}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                          {/* Hourly Analemmas (Continuous Solid Curves) */}
                          {showAnalemmas &&
                            analemmaLoops.map((loop) => {
                              if (loop.pts.length < 3) return null;
                              const pts = loop.pts
                                .map((p) => `${xForAz(p.az).toFixed(1)},${yForAlt(p.alt).toFixed(1)}`)
                                .join(' ');
                              const peak = loop.pts.reduce((prev, cur) => (cur.alt > prev.alt ? cur : prev), loop.pts[0]);
                              return (
                                <g key={loop.hour}>
                                  <polyline
                                    fill="none"
                                    stroke="#64748b"
                                    strokeWidth={1.4}
                                    strokeOpacity={0.75}
                                    points={pts}
                                  />
                                  <text
                                    x={xForAz(peak.az)}
                                    y={yForAlt(peak.alt) - 4}
                                    fontSize="8.5"
                                    fontWeight="700"
                                    fill="#334155"
                                    textAnchor="middle"
                                    className="font-mono pointer-events-none select-none"
                                  >
                                    {loop.hour}h
                                  </text>
                                </g>
                              );
                            })}

                          {/* Selected Day of Year Trajectory Curve (Continuous Warm Amber/Gold) */}
                          {dayTrajectoryPts.length > 1 && (
                            <polyline
                              fill="none"
                              stroke="#d97706"
                              strokeWidth={3.2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={dayTrajectoryPts.map((p) => `${xForAz(p.az).toFixed(1)},${yForAlt(p.alt).toFixed(1)}`).join(' ')}
                            />
                          )}

                          {/* Discrete Non-Overlapping Hourly Solar Nodes on Selected Day */}
                          {selectedDaySunHours.map((h) => {
                            const sh = evalShading(h.solarAlt, h.solarAz);
                            const fill = getSunColor(h);
                            return (
                              <circle
                                key={h.hour}
                                cx={xForAz(h.solarAz)}
                                cy={yForAlt(h.solarAlt)}
                                r={sh.isBlocked ? 3.5 : 4.5}
                                fillOpacity={0.95}
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                fill={fill}
                                className="cursor-pointer transition hover:scale-150 hover:stroke-amber-400 hover:stroke-[2.5px] shadow-sm"
                                onMouseEnter={(e) => {
                                  let dAz = h.solarAz - facadeAzimuthDeg;
                                  while (dAz > 180) dAz -= 360;
                                  while (dAz < -180) dAz += 360;
                                  const shReason = sh.selfShaded
                                    ? 'Behind Facade (Self-Shaded by Envelope)'
                                    : sh.canyonBlocked
                                    ? 'Blocked by Urban Skyline Canyon'
                                    : sh.overhangBlocked
                                    ? `Blocked by Overhang (Profile θ_v=${sh.profileAngle.toFixed(1)}°)`
                                    : sh.finBlocked
                                    ? (dAz < 0 ? `Blocked by Left Vertical Fin (θ_h,L=${effLeftFin}°)` : `Blocked by Right Vertical Fin (θ_h,R=${effRightFin}°)`)
                                    : 'Direct Sun (Unobstructed)';
                                  tooltipCtx.show(e, `${MONTHS[h.month]} ${h.dayOfMonth} • ${h.hour}:00`, [
                                    { label: 'Solar Altitude', value: `${h.solarAlt.toFixed(1)}°`, color: '#f59e0b' },
                                    { label: 'Solar Azimuth', value: `${h.solarAz.toFixed(1)}°` },
                                    { label: 'Profile Angle on Facade', value: `${sh.profileAngle.toFixed(1)}°` },
                                    { label: 'Dry-Bulb Temp', value: `${h.dryBulb}°C`, color: '#e11d48' },
                                    { label: 'Solar GHI', value: `${h.ghi} Wh/m²` },
                                    { label: 'Direct Normal (DNI)', value: `${h.dni ?? 0} Wh/m²` },
                                    { label: 'UTCI Comfort', value: `${h.utci.toFixed(1)}°C` },
                                    { label: 'Shading Status', value: shReason, color: sh.isBlocked ? '#f59e0b' : '#10b981' }
                                  ]);
                                }}
                                onMouseMove={(e) => tooltipCtx.move(e)}
                                onMouseLeave={() => tooltipCtx.hide()}
                              />
                            );
                          })}

                          {/* Optional Annual EPW Data Scatter (Subtle & Non-Obtrusive when enabled) */}
                          {showAnnualScatter &&
                            visibleSunHours.map((h, i) => {
                              const fill = getSunColor(h);
                              return (
                                <circle
                                  key={i}
                                  cx={xForAz(h.solarAz)}
                                  cy={yForAlt(h.solarAlt)}
                                  r={1.8}
                                  fillOpacity={0.4}
                                  stroke="none"
                                  fill={fill}
                                  className="pointer-events-none"
                                />
                              );
                            })}

                          {/* Active Golden Sun Marker for Selected Day & Hour */}
                          {activeSunPos.alt > 0 && (
                            <g className="pointer-events-none">
                              <circle
                                cx={xForAz(activeSunPos.az)}
                                cy={yForAlt(activeSunPos.alt)}
                                r={12}
                                fill="none"
                                stroke="#d97706"
                                strokeWidth={2}
                                strokeDasharray="3 2"
                                className="animate-spin"
                                style={{ transformOrigin: `${xForAz(activeSunPos.az)}px ${yForAlt(activeSunPos.alt)}px`, animationDuration: '8s' }}
                              />
                              <circle
                                cx={xForAz(activeSunPos.az)}
                                cy={yForAlt(activeSunPos.alt)}
                                r={6}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={2}
                                className="shadow-lg"
                              />
                            </g>
                          )}
                        </svg>

                        {/* Continuous Legend Matching UTCI Heatmap Format */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1 font-medium pt-1">
                          <span className="font-semibold text-slate-700">
                            {showAnnualScatter
                              ? `Solar Vectors (${visibleSunHours.length.toLocaleString()} Daylight Hours • ${legendConfig.description})`
                              : `Continuous Sun Path (${declinationTracks.length} Declination Arcs • ${analemmaLoops.length} Analemmas • Day ${selectedDayOfYear})`}
                          </span>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-medium">{legendConfig.description}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-800 font-mono">
                                {legendConfig.min}{legendConfig.unit}
                              </span>
                              <div
                                className="w-44 sm:w-60 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                                style={{ background: legendConfig.gradient }}
                              />
                              <span className="text-[11px] font-bold text-slate-800 font-mono">
                                {legendConfig.max}{legendConfig.unit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // -------------------------------------------------------------
                  // 2. POLAR STEREOGRAPHIC PROJECTION VIEW (True Stereographic)
                  // -------------------------------------------------------------
                  const size = 620;
                  const cx = size / 2;
                  const cy = size / 2;
                  const R = 250;
                  const stereoR = (alt: number) => R * Math.tan(((90 - Math.max(0, alt)) * Math.PI) / 360);
                  const polarPt = (alt: number, az: number) => {
                    const r = stereoR(alt);
                    const rad = ((az - 90) * Math.PI) / 180;
                    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
                  };

                  // Rear hemisphere self-shading mask
                  const rearSemicirclePts: string[] = [];
                  if (showProtractor) {
                    rearSemicirclePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                    for (let d = 90; d <= 270; d += 3) {
                      const az = (facadeAzimuthDeg + d) % 360;
                      const p = polarPt(0, az);
                      rearSemicirclePts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                    }
                    rearSemicirclePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                  }

                  // Overhang Stereographic Cutoff Mask
                  const overhangStereoPts: string[] = [];
                  if (showProtractor) {
                    overhangStereoPts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                    for (let d = -86; d <= 86; d += 3) {
                      const az = (facadeAzimuthDeg + d + 360) % 360;
                      const radD = (d * Math.PI) / 180;
                      const cutAlt = Math.atan(Math.tan((overhangAngleDeg * Math.PI) / 180) * Math.cos(radD)) * (180 / Math.PI);
                      const p = polarPt(Math.max(0, cutAlt), az);
                      overhangStereoPts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                    }
                    overhangStereoPts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                  }

                  // Left fin shading wedge
                  const leftFinWedgePts: string[] = [];
                  if (showProtractor && effLeftFin < 89) {
                    leftFinWedgePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                    for (let d = -90; d <= -effLeftFin; d += 2) {
                      const az = (facadeAzimuthDeg + d + 360) % 360;
                      const p = polarPt(0, az);
                      leftFinWedgePts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                    }
                    leftFinWedgePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                  }

                  // Right fin shading wedge
                  const rightFinWedgePts: string[] = [];
                  if (showProtractor && effRightFin < 89) {
                    rightFinWedgePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                    for (let d = effRightFin; d <= 90; d += 2) {
                      const az = (facadeAzimuthDeg + d + 360) % 360;
                      const p = polarPt(0, az);
                      rightFinWedgePts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                    }
                    rightFinWedgePts.push(`${cx.toFixed(1)},${cy.toFixed(1)}`);
                  }

                  return (
                    <div className="flex flex-col items-center space-y-3">
                      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[620px] h-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
                        {/* Sky Dome Background Circle */}
                        <circle cx={cx} cy={cy} r={R} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1.5} />

                        {/* Concentric Altitude Rings */}
                        {[0, 15, 30, 45, 60, 75, 90].map((alt) => (
                          <g key={alt}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={stereoR(alt)}
                              fill="none"
                              stroke={alt === 0 ? '#64748b' : '#e2e8f0'}
                              strokeWidth={alt === 0 ? 1.5 : 1}
                              strokeDasharray={alt === 0 ? undefined : '3 3'}
                            />
                            {alt > 0 && alt < 90 && (
                              <text x={cx + 3} y={cy - stereoR(alt) - 2} fontSize="9" fontWeight="600" fill="#64748b">
                                {alt}°
                              </text>
                            )}
                          </g>
                        ))}

                        {/* Radial Azimuth Spokes */}
                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((az) => {
                          const rad = ((az - 90) * Math.PI) / 180;
                          const x2 = cx + R * Math.cos(rad);
                          const y2 = cy + R * Math.sin(rad);
                          return (
                            <line
                              key={az}
                              x1={cx}
                              y1={cy}
                              x2={x2}
                              y2={y2}
                              stroke="#e2e8f0"
                              strokeWidth={0.8}
                            />
                          );
                        })}

                        {/* Cardinal Direction Markers */}
                        <text x={cx} y={24} textAnchor="middle" fontSize="13" fontWeight="900" fill="#334155">N</text>
                        <text x={cx} y={size - 12} textAnchor="middle" fontSize="13" fontWeight="900" fill="#e11d48">S</text>
                        <text x={size - 18} y={cy + 4.5} textAnchor="middle" fontSize="13" fontWeight="900" fill="#334155">E</text>
                        <text x={18} y={cy + 4.5} textAnchor="middle" fontSize="13" fontWeight="900" fill="#334155">W</text>
                        <text x={cx + (R + 18) * Math.cos(Math.PI / 4)} y={cy + (R + 18) * Math.sin(Math.PI / 4) + 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#64748b">SE</text>
                        <text x={cx - (R + 18) * Math.cos(Math.PI / 4)} y={cy + (R + 18) * Math.sin(Math.PI / 4) + 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#64748b">SW</text>
                        <text x={cx + (R + 18) * Math.cos(Math.PI / 4)} y={cy - (R + 18) * Math.sin(Math.PI / 4) + 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#64748b">NE</text>
                        <text x={cx - (R + 18) * Math.cos(Math.PI / 4)} y={cy - (R + 18) * Math.sin(Math.PI / 4) + 4} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#64748b">NW</text>

                        {/* Rear Building Envelope Self-Shaded Semicircle Mask */}
                        {showProtractor && rearSemicirclePts.length > 2 && (
                          <g>
                            <polygon
                              points={rearSemicirclePts.join(' ')}
                              fill="rgba(100, 116, 139, 0.16)"
                              stroke="#94a3b8"
                              strokeWidth={1.2}
                            />
                            {(() => {
                              const rearRad = ((facadeAzimuthDeg + 90) * Math.PI) / 180;
                              return (
                                <text
                                  x={cx + (R * 0.52) * Math.cos(rearRad)}
                                  y={cy + (R * 0.52) * Math.sin(rearRad) + 3}
                                  fontSize="8.5"
                                  fontWeight="700"
                                  fill="#64748b"
                                  textAnchor="middle"
                                  className="pointer-events-none select-none"
                                >
                                  Rear Envelope
                                </text>
                              );
                            })()}
                          </g>
                        )}

                        {/* Stage 2 Urban Canyon Skyline Obstruction Mask */}
                        {showUrbanSkylineMask && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={R}
                            fill="none"
                            stroke="rgba(148, 163, 184, 0.35)"
                            strokeWidth={(Math.max(canyonS, canyonE, canyonW) / 90) * R * 2}
                          />
                        )}

                        {/* Left Fin Shading Wedge */}
                        {showProtractor && leftFinWedgePts.length > 2 && (
                          <polygon
                            points={leftFinWedgePts.join(' ')}
                            fill="rgba(99, 102, 241, 0.18)"
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Right Fin Shading Wedge */}
                        {showProtractor && rightFinWedgePts.length > 2 && (
                          <polygon
                            points={rightFinWedgePts.join(' ')}
                            fill="rgba(99, 102, 241, 0.18)"
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Overhang Stereographic Shading Mask Geometry */}
                        {showProtractor && overhangStereoPts.length > 2 && (
                          <polygon
                            points={overhangStereoPts.join(' ')}
                            fill="rgba(245, 158, 11, 0.20)"
                            stroke="#d97706"
                            strokeWidth={1.8}
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Facade Orientation Vector Pointer */}
                        {(() => {
                          const rad = ((facadeAzimuthDeg - 90) * Math.PI) / 180;
                          const arrowX = cx + (R + 2) * Math.cos(rad);
                          const arrowY = cy + (R + 2) * Math.sin(rad);
                          return (
                            <g>
                              <line x1={cx} y1={cy} x2={arrowX} y2={arrowY} stroke="#d97706" strokeWidth={2.4} strokeDasharray="5 3" />
                              <circle cx={arrowX} cy={arrowY} r={5} fill="#d97706" />
                              <text
                                x={cx + (R + 24) * Math.cos(rad)}
                                y={cy + (R + 24) * Math.sin(rad) + 4}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="800"
                                fill="#b45309"
                              >
                                Facade Normal ({facadeAzimuthDeg}°)
                              </text>
                            </g>
                          );
                        })()}

                        {/* 7 Annual Declination Tracks (Continuous Solid Curves) */}
                        {showDeclinationArcs &&
                          declinationTracks.map((t) => {
                            const pts = t.pts.map((p) => {
                              const pt = polarPt(p.alt, p.az);
                              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                            }).join(' ');
                            const firstPt = polarPt(t.pts[0].alt, t.pts[0].az);
                            return (
                              <g key={t.day}>
                                <polyline
                                  fill="none"
                                  stroke={t.color}
                                  strokeWidth={t.bold ? 2.4 : 1.6}
                                  strokeOpacity={t.bold ? 0.95 : 0.8}
                                  points={pts}
                                />
                                <text
                                  x={firstPt.x}
                                  y={firstPt.y + (firstPt.y < cy ? -4 : 10)}
                                  fontSize="8.5"
                                  fontWeight="700"
                                  fill={t.color}
                                  textAnchor={firstPt.x < cx ? 'end' : 'start'}
                                  className="select-none pointer-events-none"
                                >
                                  {t.label.split(' ')[1]} {t.label.split(' ')[0]}
                                </text>
                              </g>
                            );
                          })}

                        {/* Hourly Analemmas (Continuous Solid Curves) */}
                        {showAnalemmas &&
                          analemmaLoops.map((loop) => {
                            if (loop.pts.length < 3) return null;
                            const pts = loop.pts.map((p) => {
                              const pt = polarPt(p.alt, p.az);
                              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                            }).join(' ');
                            const peak = loop.pts.reduce((prev, cur) => (cur.alt > prev.alt ? cur : prev), loop.pts[0]);
                            const peakPt = polarPt(peak.alt, peak.az);
                            return (
                              <g key={loop.hour}>
                                <polyline
                                  fill="none"
                                  stroke="#64748b"
                                  strokeWidth={1.4}
                                  strokeOpacity={0.75}
                                  points={pts}
                                />
                                <text
                                  x={peakPt.x}
                                  y={peakPt.y - 4}
                                  fontSize="8.5"
                                  fontWeight="800"
                                  fill="#334155"
                                  textAnchor="middle"
                                  className="select-none pointer-events-none font-mono"
                                >
                                  {loop.hour}h
                                </text>
                              </g>
                            );
                          })}

                        {/* Selected Day of Year Trajectory Curve (Continuous Warm Amber/Gold) */}
                        {dayTrajectoryPts.length > 1 && (
                          <polyline
                            fill="none"
                            stroke="#d97706"
                            strokeWidth={3.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={dayTrajectoryPts.map((p) => {
                              const pt = polarPt(p.alt, p.az);
                              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                            }).join(' ')}
                          />
                        )}

                        {/* Discrete Non-Overlapping Hourly Solar Nodes on Selected Day */}
                        {selectedDaySunHours.map((h) => {
                          const p = polarPt(h.solarAlt, h.solarAz);
                          const sh = evalShading(h.solarAlt, h.solarAz);
                          const fill = getSunColor(h);
                          return (
                            <circle
                              key={h.hour}
                              cx={p.x}
                              cy={p.y}
                              r={sh.isBlocked ? 3.5 : 4.5}
                              fillOpacity={0.95}
                              stroke="#ffffff"
                              strokeWidth={1.5}
                              fill={fill}
                              className="cursor-pointer transition hover:scale-150 hover:stroke-amber-400 hover:stroke-[2.5px] shadow-sm"
                              onMouseEnter={(e) => {
                                let dAz = h.solarAz - facadeAzimuthDeg;
                                while (dAz > 180) dAz -= 360;
                                while (dAz < -180) dAz += 360;
                                const shReason = sh.selfShaded
                                  ? 'Behind Facade (Self-Shaded by Envelope)'
                                  : sh.canyonBlocked
                                  ? 'Blocked by Urban Skyline Canyon'
                                  : sh.overhangBlocked
                                  ? `Blocked by Overhang (Profile θ_v=${sh.profileAngle.toFixed(1)}°)`
                                  : sh.finBlocked
                                  ? (dAz < 0 ? `Blocked by Left Vertical Fin (θ_h,L=${effLeftFin}°)` : `Blocked by Right Vertical Fin (θ_h,R=${effRightFin}°)`)
                                  : 'Direct Sun (Unobstructed)';
                                tooltipCtx.show(e, `${MONTHS[h.month]} ${h.dayOfMonth} • ${h.hour}:00`, [
                                  { label: 'Solar Altitude', value: `${h.solarAlt.toFixed(1)}°`, color: '#f59e0b' },
                                  { label: 'Solar Azimuth', value: `${h.solarAz.toFixed(1)}°` },
                                  { label: 'Profile Angle on Facade', value: `${sh.profileAngle.toFixed(1)}°` },
                                  { label: 'Dry-Bulb Temp', value: `${h.dryBulb}°C`, color: '#e11d48' },
                                  { label: 'Solar GHI', value: `${h.ghi} Wh/m²` },
                                  { label: 'Direct Normal (DNI)', value: `${h.dni ?? 0} Wh/m²` },
                                  { label: 'UTCI Comfort', value: `${h.utci.toFixed(1)}°C` },
                                  { label: 'Shading Status', value: shReason, color: sh.isBlocked ? '#f59e0b' : '#10b981' }
                                ]);
                              }}
                              onMouseMove={(e) => tooltipCtx.move(e)}
                              onMouseLeave={() => tooltipCtx.hide()}
                            />
                          );
                        })}

                        {/* Optional Annual EPW Data Scatter (Subtle & Non-Obtrusive when enabled) */}
                        {showAnnualScatter &&
                          visibleSunHours.map((h, i) => {
                            const p = polarPt(h.solarAlt, h.solarAz);
                            const fill = getSunColor(h);
                            return (
                              <circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r={1.8}
                                fillOpacity={0.4}
                                stroke="none"
                                fill={fill}
                                className="pointer-events-none"
                              />
                            );
                          })}

                        {/* Active Golden Sun Marker on Selected Day */}
                        {activeSunPos.alt > 0 && (
                          <g className="pointer-events-none">
                            {(() => {
                              const p = polarPt(activeSunPos.alt, activeSunPos.az);
                              return (
                                <>
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={13}
                                    fill="none"
                                    stroke="#d97706"
                                    strokeWidth={2}
                                    strokeDasharray="3 2"
                                    className="animate-spin"
                                    style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDuration: '8s' }}
                                  />
                                  <circle
                                    cx={p.x}
                                    cy={p.y}
                                    r={6.5}
                                    fill="#f59e0b"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    className="shadow-lg"
                                  />
                                </>
                              );
                            })()}
                          </g>
                        )}
                      </svg>

                      {/* Continuous Legend Matching UTCI Heatmap Format */}
                      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1 font-medium pt-1">
                        <span className="font-semibold text-slate-700">
                          {showAnnualScatter
                            ? `Stereographic Sun Path (${visibleSunHours.length.toLocaleString()} Hours • ${legendConfig.description})`
                            : `Stereographic Sun Path (${declinationTracks.length} Declination Arcs • ${analemmaLoops.length} Analemmas • Day ${selectedDayOfYear})`}
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-medium">{legendConfig.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-800 font-mono">
                              {legendConfig.min}{legendConfig.unit}
                            </span>
                            <div
                              className="w-44 sm:w-60 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                              style={{ background: legendConfig.gradient }}
                            />
                            <span className="text-[11px] font-bold text-slate-800 font-mono">
                              {legendConfig.max}{legendConfig.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </ClimaChartCard>

              {/* Architectural Solar & Shading Diagnostic KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 mt-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    1. Summer Overheating Protection
                  </span>
                  <div className="text-xl font-extrabold text-amber-700">
                    {facadeShadingAnalysis.summerOverheatingRadiationBlockedPct}% Blocked
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {facadeShadingAnalysis.summerOverheatingBlockedHours} of {facadeShadingAnalysis.summerOverheatingHours} daylight hours (T_db ≥ 24°C) successfully shaded.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    2. Winter Passive Solar Gains
                  </span>
                  <div className="text-xl font-extrabold text-teal-700">
                    {facadeShadingAnalysis.winterColdRadiationAdmittedPct}% Admitted
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {facadeShadingAnalysis.winterColdAdmittedHours} of {facadeShadingAnalysis.winterColdHours} cold hours (T_db &lt; 18°C) admitted for natural heating.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    3. Seasonal Selectivity Ratio
                  </span>
                  <div className="text-xl font-extrabold text-indigo-700">
                    {facadeShadingAnalysis.netSelectivityScore.toFixed(2)}x
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {facadeShadingAnalysis.netSelectivityScore >= 1.0
                      ? 'Selective (Blocks summer heat while admitting winter sun)'
                      : 'Suboptimal (Low summer rejection or excessive winter blockage)'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    4. Live Vector Inspector
                  </span>
                  {(() => {
                    const pos = calcSolarPosition(climate.lat, selectedDayOfYear, selectedSunHour, climate.lon, climate.tz);
                    let dAz = pos.az - facadeAzimuthDeg;
                    while (dAz > 180) dAz -= 360;
                    while (dAz < -180) dAz += 360;
                    const inFront = Math.abs(dAz) < 90;
                    const cosDelta = Math.cos((dAz * Math.PI) / 180);
                    const prof = inFront && cosDelta > 0.001 ? Math.atan(Math.tan((pos.alt * Math.PI) / 180) / cosDelta) * (180 / Math.PI) : 90;
                    const effL = finsSymmetric ? finAngleDeg : leftFinAngleDeg;
                    const effR = finsSymmetric ? finAngleDeg : rightFinAngleDeg;
                    const isOverhang = showProtractor && inFront && prof >= overhangAngleDeg;
                    const isFin = showProtractor && inFront && ((dAz < 0 && Math.abs(dAz) >= effL) || (dAz > 0 && dAz >= effR));
                    const isShaded = isOverhang || isFin || !inFront;

                    return (
                      <div className="space-y-0.5 font-mono text-[10.5px]">
                        <div className="font-bold text-slate-800">
                          Alt: <span className="text-amber-600">{pos.alt.toFixed(1)}°</span> • Az: <span className="text-indigo-600">{pos.az.toFixed(1)}°</span>
                        </div>
                        <div className="text-slate-600">
                          Profile α_p: <strong className="text-slate-800">{inFront ? `${prof.toFixed(1)}°` : 'Behind'}</strong>
                        </div>
                        <div className="font-extrabold text-[11px] pt-0.5 truncate">
                          Status: <span className={isShaded ? 'text-amber-700' : 'text-emerald-600'}>{isShaded ? (isOverhang ? 'Overhang Shaded' : isFin ? 'Fin Shaded' : 'Rear Envelope') : 'Direct Sun'}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* 8-Orientation Vertical Facade Radiation Rose */}
            <div className={stage1WideMode && chartDensity !== 'spacious' ? 'xl:col-span-4' : 'w-full'}>
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
                            className="pointer-events-none"
                          />
                        ))}

                        <polygon points={makePoly((r) => r.annualKwhM2)} fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth={2.4} className="pointer-events-none" />
                        <polygon points={makePoly((r) => r.summerKwhM2)} fill="rgba(225, 29, 72, 0.22)" stroke="#e11d48" strokeWidth={1.8} className="pointer-events-none" />
                        <polygon points={makePoly((r) => r.winterKwhM2)} fill="rgba(2, 132, 199, 0.25)" stroke="#0284c7" strokeWidth={1.8} className="pointer-events-none" />

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
                              <circle cx={px} cy={py} r={18} fill="#000000" fillOpacity={0} pointerEvents="all" />
                              {/* Stable visible point that highlights smoothly without moving */}
                              <circle
                                cx={px}
                                cy={py}
                                r={6}
                                fill="#f59e0b"
                                stroke="#ffffff"
                                strokeWidth={2}
                                className="transition-colors group-hover:fill-amber-400 group-hover:stroke-amber-200 pointer-events-none"
                              />
                              <text
                                x={lx}
                                y={ly + 3.5}
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="700"
                                className="fill-slate-800 transition-colors group-hover:fill-amber-600 pointer-events-none select-none"
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

          {/* Monthly Incident Solar Radiation on Facade (Unshaded vs. Shaded Transmitted kWh/m²) */}
          <ClimaChartCard
            title="Monthly Incident Solar Radiation on Facade — Unshaded vs. Shaded Transmitted (kWh/m²)"
            subtitle={`Monthly radiation breakdown for ${facadeAzimuthDeg}° facade • Overhang θ_v = ${overhangAngleDeg}° • Fins: ${finsSymmetric ? `±${finAngleDeg}°` : `L:${leftFinAngleDeg}° / R:${rightFinAngleDeg}°`} • Net Selectivity = ${facadeShadingAnalysis.netSelectivityScore.toFixed(2)}x`}
            icon={<Layers className="w-4 h-4 text-amber-500" />}
            svgFilename={`${climate.id}_facade_shading_monthly.svg`}
            csvFilename={`${climate.id}_facade_shading_monthly.csv`}
            onBuildCsv={() => ({
              headers: [
                'Month',
                'Unshaded_kWh/m2',
                'Shaded_Transmitted_kWh/m2',
                'Blocked_kWh/m2',
                'Shading_Fraction_%',
                'Beam_Transmitted_kWh/m2',
                'Diffuse_Transmitted_kWh/m2'
              ],
              rows: facadeShadingAnalysis.monthly.map((m) => {
                const shFrac = m.unshadedKwhM2 > 0 ? Math.round((m.blockedKwhM2 / m.unshadedKwhM2) * 100) : 0;
                return [
                  m.month,
                  m.unshadedKwhM2,
                  m.shadedKwhM2,
                  m.blockedKwhM2,
                  shFrac,
                  m.beamShadedKwhM2,
                  m.diffuseShadedKwhM2
                ];
              })
            })}
          >
            {(svgRef, tooltipCtx) => {
              const W = 880;
              const H = 280;
              const padL = 48;
              const padR = 24;
              const padT = 24;
              const padB = 34;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const colWidth = plotW / 12;
              const xForM = (i: number) => padL + (i + 0.5) * colWidth;

              const maxVal = Math.max(
                40,
                ...facadeShadingAnalysis.monthly.map((m) => Math.max(m.unshadedKwhM2, m.shadedKwhM2 + m.blockedKwhM2))
              );

              return (
                <div className="space-y-2">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                      const y = padT + plotH - f * plotH;
                      return (
                        <g key={i}>
                          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" />
                          <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="600" fill="#64748b">
                            {Math.round(maxVal * f)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Month Hover Highlight */}
                    {activeShadingMonthHover !== null && (
                      <rect
                        x={padL + activeShadingMonthHover * colWidth + 2}
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

                    {/* Grouped Bars for 12 months */}
                    {facadeShadingAnalysis.monthly.map((m, i) => {
                      const cx = xForM(i);
                      const isHovered = activeShadingMonthHover === i;
                      const barW = Math.min(14, (colWidth - 10) / 3);

                      // Bar 1: Unshaded (Amber)
                      const hUnshaded = (m.unshadedKwhM2 / maxVal) * plotH;
                      const yUnshaded = padT + plotH - hUnshaded;

                      // Bar 2: Shaded Transmitted (Emerald)
                      const hTransmitted = (m.shadedKwhM2 / maxVal) * plotH;
                      const yTransmitted = padT + plotH - hTransmitted;

                      // Bar 3: Blocked (Slate)
                      const hBlocked = (m.blockedKwhM2 / maxVal) * plotH;
                      const yBlocked = padT + plotH - hBlocked;

                      return (
                        <g key={m.month}>
                          {/* Unshaded bar */}
                          <rect
                            x={cx - barW * 1.6}
                            y={yUnshaded}
                            width={barW}
                            height={Math.max(0, hUnshaded)}
                            fill="#f59e0b"
                            fillOpacity={isHovered ? 1 : 0.85}
                            rx={2}
                          />
                          {/* Transmitted bar */}
                          <rect
                            x={cx - barW * 0.5}
                            y={yTransmitted}
                            width={barW}
                            height={Math.max(0, hTransmitted)}
                            fill="#10b981"
                            fillOpacity={isHovered ? 1 : 0.85}
                            rx={2}
                          />
                          {/* Blocked bar */}
                          <rect
                            x={cx + barW * 0.6}
                            y={yBlocked}
                            width={barW}
                            height={Math.max(0, hBlocked)}
                            fill="#64748b"
                            fillOpacity={isHovered ? 1 : 0.75}
                            rx={2}
                          />

                          {/* Month label */}
                          <text
                            x={cx}
                            y={H - 10}
                            textAnchor="middle"
                            fontSize={isHovered ? '11' : '10'}
                            fontWeight={isHovered ? '800' : '600'}
                            fill={isHovered ? '#0f172a' : '#475569'}
                          >
                            {m.month}
                          </text>
                        </g>
                      );
                    })}

                    {/* Interactive Mouse Hover Overlay */}
                    {facadeShadingAnalysis.monthly.map((m, i) => {
                      const shFrac = m.unshadedKwhM2 > 0 ? Math.round((m.blockedKwhM2 / m.unshadedKwhM2) * 100) : 0;
                      return (
                        <rect
                          key={`shading-hover-${m.month}`}
                          x={padL + i * colWidth}
                          y={padT}
                          width={colWidth}
                          height={plotH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={(e) => {
                            setActiveShadingMonthHover(i);
                            tooltipCtx.show(e, `${m.month} Facade Incident Radiation (${facadeAzimuthDeg}° Facade)`, [
                              { label: 'Unshaded Incident', value: `${m.unshadedKwhM2} kWh/m²`, color: '#f59e0b' },
                              { label: 'Shaded Transmitted', value: `${m.shadedKwhM2} kWh/m²`, color: '#10b981' },
                              { label: '  • Direct Beam Transmitted', value: `${m.beamShadedKwhM2} kWh/m²` },
                              { label: '  • Diffuse Sky Transmitted', value: `${m.diffuseShadedKwhM2} kWh/m²` },
                              { label: 'Blocked by Shading Mask', value: `${m.blockedKwhM2} kWh/m²`, color: '#64748b' },
                              { label: 'Shading Fraction', value: `${shFrac}% Blocked`, color: shFrac > 50 ? '#f59e0b' : '#3b82f6' }
                            ]);
                          }}
                          onMouseMove={(e) => tooltipCtx.move(e)}
                          onMouseLeave={() => {
                            setActiveShadingMonthHover(null);
                            tooltipCtx.hide();
                          }}
                        />
                      );
                    })}
                  </svg>

                  {/* Legend & Annual Summary Badges */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 pt-1 gap-2">
                    <div className="flex items-center gap-4 font-bold">
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Unshaded Incident
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Shaded Transmitted
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-3 h-3 rounded-sm bg-slate-500 inline-block" /> Shaded Blocked
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                      <span className="bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                        Unshaded: {facadeShadingAnalysis.annualUnshadedKwhM2} kWh/m²yr
                      </span>
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                        Transmitted: {facadeShadingAnalysis.annualShadedKwhM2} kWh/m²yr
                      </span>
                      <span className="bg-slate-100 border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                        Blocked: {facadeShadingAnalysis.annualBlockedKwhM2} kWh/m²yr
                      </span>
                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md font-bold">
                        Selectivity: {facadeShadingAnalysis.netSelectivityScore.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          </ClimaChartCard>
          {/* Monthly Global, Direct Normal & Diffuse Solar Boxplots + Cloud Cover Regime Distribution */}
          <div className={`grid grid-cols-1 ${stage1WideMode && chartDensity !== 'spacious' ? 'xl:grid-cols-2 gap-5' : 'gap-6'}`}>
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
        <SubTab5Wind climate={climate} globalValueRanges={globalValueRanges} stage1WideMode={stage1WideMode} />
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
          stage1WideMode={stage1WideMode}
        />
      )}

      {activeSubTab === 'nat_vent' && <SubTab7NatVent climate={climate} stage1WideMode={stage1WideMode} />}

      {activeSubTab === 'utci' && <SubTab8Utci climate={climate} stage1WideMode={stage1WideMode} />}

      {activeSubTab === 'explorer' && <SubTab9DataExplorer climate={climate} stage1WideMode={stage1WideMode} />}

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

        <div className={`grid grid-cols-1 ${stage1WideMode ? 'md:grid-cols-3' : ''} gap-3 text-xs text-slate-200 pt-1`}>
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
