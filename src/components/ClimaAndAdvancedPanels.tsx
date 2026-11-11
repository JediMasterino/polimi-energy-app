import React, { useState, useRef } from 'react';
import {
  Search,
  Upload,
  Download,
  Compass,
  Wind,
  Sun,
  Thermometer,
  Sparkles,
  CheckCircle2,
  Loader2,
  Globe,
  MapPin,
  Eye,
  Building2,
  Zap
} from 'lucide-react';
import {
  ClimateDataset,
  EpwStationSearchResult,
  OneBuildingPeriod,
  AVAILABLE_ONEBUILDING_PERIODS,
  getOneBuildingDownloadUrl,
  extractEpwFromZipBuffer,
  searchGlobalEpwStations,
  fetchStationClimateDataset,
  parseEpwText,
  exportDatasetToEpw,
  calcSolarPosition
} from '../utils/epwEngine';
import { EpwInteractiveMap } from './EpwInteractiveMap';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// 1. LIVE EPW SEARCH, UPLOAD & EXPORT WIDGET (Ladybug epwmap + OneBuilding + DOE)
// ============================================================================
interface EpwWidgetProps {
  currentClimate: ClimateDataset;
  customClimates: Record<string, ClimateDataset>;
  onSelectClimate: (climate: ClimateDataset) => void;
}

export const EpwSearchAndUploadWidget: React.FC<EpwWidgetProps> = ({
  currentClimate,
  onSelectClimate
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EpwStationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingStationId, setLoadingStationId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [focusedStation, setFocusedStation] = useState<EpwStationSearchResult | null>(null);
  const [oneBuildingPeriod, setOneBuildingPeriod] = useState<OneBuildingPeriod>('2009-2023');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'onebuilding' | 'energyplus'>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setErrorMsg(null);
    try {
      const res = await searchGlobalEpwStations(query, sourceFilter);
      setResults(res);
      if (res.length > 0) {
        setFocusedStation(res[0]);
      } else {
        setErrorMsg('No matching stations found. Try a city, WMO code, or country code (e.g., Milano, Como, 160800, ITA).');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleLoadRemoteStation = async (st: EpwStationSearchResult, period?: OneBuildingPeriod) => {
    setLoadingStationId(st.id);
    setErrorMsg(null);
    const activePeriod = period || oneBuildingPeriod;
    const srcLabel =
      st.source === 'onebuilding'
        ? `Climate.OneBuilding.org (${activePeriod})`
        : st.source === 'energyplus'
        ? 'DOE EnergyPlus S3'
        : 'Open-Meteo ERA5';
    setStatusMsg(`Downloading & extracting 8,760h EPW for ${st.city} from ${srcLabel}...`);
    try {
      const ds = await fetchStationClimateDataset(st, activePeriod);
      onSelectClimate(ds);
      setStatusMsg(`Loaded ${ds.name} (${ds.koppen} — ${ds.koppenDesc}, HDD ${ds.hdd}, CDD ${ds.cdd}) — 8,760h active!`);
      setResults([]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load remote weather station');
    } finally {
      setLoadingStationId(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setStatusMsg(`Reading ${file.name}...`);
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.zip')) {
        const buf = await file.arrayBuffer();
        const extracted = await extractEpwFromZipBuffer(buf);
        if (!extracted) {
          throw new Error('No .epw file found inside the uploaded .zip archive.');
        }
        text = extracted;
      } else {
        text = await file.text();
      }
      const ds = parseEpwText(text, file.name.replace(/\.(epw|zip|txt)$/i, ''));
      onSelectClimate(ds);
      setStatusMsg(`Parsed ${file.name}: ${ds.name} (${ds.hourly.length} hourly records)`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not parse .epw / .zip file');
      setStatusMsg(null);
    }
  };

  const handleExportEpw = () => {
    const content = exportDatasetToEpw(currentClimate);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentClimate.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Polimi_TMY.epw`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-700 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          Live EPW Station Search & Upload (EnergyPlus / CBE Clima)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold transition ${showMap
                ? 'bg-teal-600/30 border-teal-500 text-teal-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
              }`}
            title="Toggle interactive EPW weather station map"
          >
            <MapPin className="w-3 h-3" />
            {showMap ? 'Hide Map' : 'Station Map'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-600 text-[11px] font-semibold transition"
            title="Upload a local EnergyPlus .epw file or Climate.OneBuilding.org .zip archive"
          >
            <Upload className="w-3 h-3" />
            Import .epw / .zip
          </button>
          <button
            type="button"
            onClick={handleExportEpw}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 text-[11px] font-semibold transition"
            title="Export active 8,760h climate to EnergyPlus .epw format"
          >
            <Download className="w-3 h-3" />
            .epw
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epw,.zip,.txt,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileUpload(f);
            }}
          />
        </div>
      </div>

      {/* Interactive EPW Station Map */}
      {showMap && (
        <EpwInteractiveMap
          currentClimate={currentClimate}
          onSelectStation={handleLoadRemoteStation}
          loadingStationId={loadingStationId}
          focusedStation={focusedStation}
          oneBuildingPeriod={oneBuildingPeriod}
          onChangeOneBuildingPeriod={setOneBuildingPeriod}
          sourceFilter={sourceFilter}
          onChangeSourceFilter={setSourceFilter}
        />
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 23,227+ OneBuilding & EnergyPlus stations (e.g. Milano, Como, 160800, London)..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-400"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1"
        >
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Search Results Dropdown List */}
      {results.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-lg bg-slate-800 border border-slate-700 divide-y divide-slate-700/70">
          {results.map((st) => (
            <div
              key={st.id}
              onClick={() => {
                setShowMap(true);
                setFocusedStation(st);
              }}
              className="p-2 flex items-center justify-between gap-2 hover:bg-slate-700/70 transition text-xs cursor-pointer"
            >
              <div className="truncate">
                <div className="font-semibold text-white truncate">{st.title}</div>
                <div className="text-[10px] text-slate-400">
                  Lat {st.lat.toFixed(2)}°, Lon {st.lon.toFixed(2)}° •{' '}
                  <span
                    className={
                      st.source === 'onebuilding'
                        ? 'text-sky-300 font-semibold'
                        : st.source === 'energyplus'
                        ? 'text-amber-300 font-semibold'
                        : 'text-pink-300'
                    }
                  >
                    {st.source === 'onebuilding'
                      ? `Climate.OneBuilding.org (${oneBuildingPeriod})`
                      : st.source === 'energyplus'
                      ? 'Official DOE / NREL EnergyPlus EPW'
                      : 'Open-Meteo ERA5 8760h TMY'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {st.source === 'onebuilding' && st.epwUrl && (
                  <a
                    href={getOneBuildingDownloadUrl(st.epwUrl, oneBuildingPeriod)}
                    target="_blank"
                    rel="noreferrer"
                    download
                    onClick={(ev) => ev.stopPropagation()}
                    className="px-2 py-1 rounded bg-slate-700/80 hover:bg-slate-600 text-sky-300 text-[10px] font-semibold flex items-center gap-1 transition"
                    title={`Direct download ${oneBuildingPeriod} .ZIP archive`}
                  >
                    <Download className="w-3 h-3" />
                    .zip
                  </a>
                )}
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setShowMap(true);
                    setFocusedStation(st);
                  }}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-teal-300 text-[10px] font-semibold flex items-center gap-1"
                  title="Locate station on map"
                >
                  <MapPin className="w-3 h-3" />
                  Map
                </button>
                <button
                  type="button"
                  disabled={loadingStationId === st.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleLoadRemoteStation(st, oneBuildingPeriod);
                  }}
                  className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold shrink-0 flex items-center gap-1"
                >
                  {loadingStationId === st.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading
                    </>
                  ) : st.source === 'onebuilding' ? (
                    `Load ${oneBuildingPeriod}`
                  ) : (
                    'Load EPW'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {statusMsg && (
        <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1 rounded">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="text-[11px] text-rose-200 bg-rose-950/70 border border-rose-800/80 p-2.5 rounded-lg space-y-1.5">
          <div className="font-semibold">{errorMsg}</div>
          {focusedStation && focusedStation.epwUrl && focusedStation.source === 'onebuilding' && (
            <div className="space-y-1.5 pt-1.5 border-t border-rose-900/60">
              <div className="text-[10px] text-slate-300 font-semibold">
                Direct Download from Climate.OneBuilding.org (drag-and-drop into Import .epw / .zip above):
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {AVAILABLE_ONEBUILDING_PERIODS.map((p) => (
                  <a
                    key={p.id}
                    href={getOneBuildingDownloadUrl(focusedStation.epwUrl, p.id)}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="px-2 py-1 rounded bg-sky-900/70 hover:bg-sky-800 text-sky-200 text-[10px] font-semibold flex items-center gap-1 border border-sky-700/60 transition"
                    title={`Download ${p.label} for ${focusedStation.city}`}
                  >
                    <Download className="w-2.5 h-2.5" />
                    {p.badge} ({p.years}) .zip ↗
                  </a>
                ))}
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleLoadRemoteStation(
                      {
                        ...focusedStation,
                        source: 'open-meteo'
                      },
                      oneBuildingPeriod
                    );
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[10px] border border-slate-600 transition"
                >
                  Or synthesize Open-Meteo ERA5 2023 hourly dataset instead
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. CBE CLIMA TOOL & 8,760-HOUR EXPLORER TAB (Sun Path, Wind Rose, Heatmaps)
// ============================================================================
interface ClimaTabProps {
  climate: ClimateDataset;
  orientation: number;
  uWall: number;
  uWin: number;
  shgc: number;
  wwrAvg: number;
  tauHours: number;
  visTrans: number;
}

export const CbeClimaExplorerTab: React.FC<ClimaTabProps> = ({
  climate,
  orientation,
  shgc,
  wwrAvg,
  tauHours,
  visTrans
}) => {
  const [heatmapVar, setHeatmapVar] = useState<'dryBulb' | 'ghi' | 'utci' | 'daylight' | 'indoorFree'>('dryBulb');
  const [windSeason, setWindSeason] = useState<'annual' | 'winter' | 'summer'>('annual');

  // Compute seasonal wind rose if filtered
  const activeWindRose = React.useMemo(() => {
    if (windSeason === 'annual') return climate.windRose;
    const targetMonths = windSeason === 'winter' ? [11, 0, 1, 2] : [5, 6, 7, 8];
    const filtered = climate.hourly.filter((h) => targetMonths.includes(h.month));
    const total = Math.max(1, filtered.length);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs.map((d, idx) => {
      const inSec = filtered.filter((h) => Math.floor(((h.windDir + 22.5) % 360) / 45) % 8 === idx);
      const calm = inSec.filter((h) => h.windSpeed < 2).length;
      const low = inSec.filter((h) => h.windSpeed >= 2 && h.windSpeed < 4).length;
      const med = inSec.filter((h) => h.windSpeed >= 4 && h.windSpeed < 6).length;
      const high = inSec.filter((h) => h.windSpeed >= 6).length;
      const avgTemp =
        inSec.length > 0 ? +(inSec.reduce((a, b) => a + b.dryBulb, 0) / inSec.length).toFixed(1) : 15;
      return {
        dir: d,
        deg: idx * 45,
        calmPct: +((calm / total) * 100).toFixed(1),
        lowPct: +((low / total) * 100).toFixed(1),
        medPct: +((med / total) * 100).toFixed(1),
        highPct: +((high / total) * 100).toFixed(1),
        totalPct: +((inSec.length / total) * 100).toFixed(1),
        avgTemp
      };
    });
  }, [climate, windSeason]);

  // Color mapper for 365 x 24 Carpet Plot
  const getCellColor = (rec: ClimateDataset['hourly'][0]): string => {
    if (heatmapVar === 'dryBulb') {
      // -5°C (blue) -> 15°C (emerald) -> 25°C (amber) -> 36°C (crimson)
      const t = Math.max(-5, Math.min(38, rec.dryBulb));
      if (t < 8) return '#0284c7';
      if (t < 16) return '#38bdf8';
      if (t < 22) return '#10b981';
      if (t < 26) return '#fbbf24';
      if (t < 30) return '#f97316';
      return '#e11d48';
    }
    if (heatmapVar === 'ghi') {
      const g = rec.ghi;
      if (g <= 5) return '#0f172a';
      if (g < 150) return '#1e3a8a';
      if (g < 350) return '#0284c7';
      if (g < 550) return '#eab308';
      if (g < 750) return '#f97316';
      return '#fef08a';
    }
    if (heatmapVar === 'utci') {
      const u = rec.utci;
      if (u < 0) return '#1d4ed8';
      if (u < 9) return '#38bdf8';
      if (u <= 26) return '#10b981'; // No thermal stress
      if (u <= 32) return '#f59e0b'; // Moderate heat stress
      if (u <= 38) return '#ea580c'; // Strong heat stress
      return '#be123c'; // Extreme heat stress
    }
    if (heatmapVar === 'daylight') {
      // Workplane illuminance lux = exterior horizontal lux (ghi * 108) * Daylight Factor
      const df = (wwrAvg / 100) * visTrans * 0.14;
      const lux = rec.ghi * 108 * df;
      if (lux <= 10) return '#0f172a';
      if (lux < 100) return '#3b82f6'; // Insufficient (<100 lx)
      if (lux <= 2000) return '#10b981'; // UDI Autonomous (100-2000 lx)
      return '#f43f5e'; // Glare / Oversupply (>2000 lx)
    }
    // indoorFree: damped free-running operative temperature (5R1C lag approximation)
    const meanMonthT = climate.monthlyTemp[rec.month];
    const damping = Math.min(0.85, tauHours / 65);
    const solarBoost = (rec.ghi / 1000) * shgc * (wwrAvg / 30) * 3.8 + 2.2;
    const tFree = meanMonthT * damping + rec.dryBulb * (1 - damping) + solarBoost;
    if (tFree < 18) return '#38bdf8';
    if (tFree <= 26) return '#10b981';
    if (tFree <= 28) return '#fbbf24';
    return '#e11d48';
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards (CBE Clima Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500">Station & Coordinates</div>
          <div className="text-base font-bold text-slate-900 mt-0.5 truncate">{climate.name}</div>
          <div className="text-[11px] text-teal-700 font-medium">
            {climate.lat.toFixed(2)}°N, {climate.lon.toFixed(2)}°E • Elev {climate.elev}m
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500">Degree Days (Base 18°C)</div>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            HDD {climate.hdd} • CDD {climate.cdd}
          </div>
          <div className="text-[11px] text-slate-400">
            Köppen {climate.koppen} ({climate.koppenDesc})
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500">Natural Ventilation Potential</div>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {climate.natVentHoursPct}% <span className="text-xs font-normal text-slate-500">of year</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {Math.round((climate.natVentHoursPct / 100) * 8760)} hrs (18–26°C, RH ≤ 75%)
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500">Outdoor UTCI Comfort</div>
          <div className="text-xl font-bold text-amber-600 mt-0.5">
            {climate.utciNoStressPct}% <span className="text-xs font-normal text-slate-500">no stress</span>
          </div>
          <div className="text-[11px] text-slate-400">
            UTCI 9°C to 26°C thermal neutrality
          </div>
        </div>
      </div>

      {/* Row 2: Polar Sun Path Diagram + Polar Wind Rose (CBE Clima Signatures) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Stereographic / Polar Sun Path Diagram */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                Spherical Sun Path & Building Orientation ({climate.lat.toFixed(1)}°N)
              </h3>
              <p className="text-xs text-slate-500">
                CBE Clima stereographic solar altitude/azimuth tracks for Solstices & Equinox
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Azimuth: {orientation}°
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center justify-center">
            {(() => {
              const size = 300;
              const cx = size / 2;
              const cy = size / 2;
              const R = 118;

              // Map (alt, az) to polar (x, y) where r = R * (90 - alt) / 90
              const toXY = (alt: number, az: number) => {
                const r = R * (1 - Math.max(0, alt) / 90);
                const rad = ((az - 90) * Math.PI) / 180;
                return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
              };

              // Build sun path polyline for a given dayOfYear
              const makeDayTrack = (dayOfYear: number) => {
                const pts: string[] = [];
                for (let h = 4; h <= 20; h += 0.25) {
                  const { alt, az } = calcSolarPosition(climate.lat, dayOfYear, h);
                  if (alt > 0) {
                    const { x, y } = toXY(alt, az);
                    pts.push(`${pts.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
                  }
                }
                return pts.join(' ');
              };

              return (
                <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[310px]">
                  {/* Altitude concentric circles: 0°, 30°, 60° */}
                  {[0, 30, 60].map((alt) => (
                    <g key={alt}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={R * (1 - alt / 90)}
                        fill={alt === 0 ? '#ffffff' : 'none'}
                        stroke="#cbd5e1"
                        strokeWidth={alt === 0 ? '1.5' : '1'}
                        strokeDasharray={alt === 0 ? 'none' : '3 3'}
                      />
                      {alt > 0 && (
                        <text
                          x={cx + 4}
                          y={cy - R * (1 - alt / 90) + 10}
                          className="text-[8px] fill-slate-400"
                        >
                          {alt}°
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Cardinal & Intercardinal axes */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const p = toXY(0, deg);
                    return <line key={deg} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1" />;
                  })}

                  {/* Analemma / Hour loops (9h, 12h, 15h) */}
                  {[9, 12, 15].map((h) => {
                    const pts: string[] = [];
                    for (let d = 1; d <= 365; d += 10) {
                      const { alt, az } = calcSolarPosition(climate.lat, d, h);
                      if (alt > 0) {
                        const p = toXY(alt, az);
                        pts.push(`${pts.length === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
                      }
                    }
                    return <path key={h} d={pts.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />;
                  })}

                  {/* 3 Key Solar Tracks: Jun 21 (day 172), Equinox Mar 21 (day 80), Dec 21 (day 355) */}
                  <path d={makeDayTrack(172)} fill="none" stroke="#ea580c" strokeWidth="2.5" />
                  <path d={makeDayTrack(80)} fill="none" stroke="#10b981" strokeWidth="2" />
                  <path d={makeDayTrack(355)} fill="none" stroke="#0284c7" strokeWidth="2" />

                  {/* Rotated Building Massing Footprint in Center */}
                  <g transform={`translate(${cx}, ${cy}) rotate(${orientation})`}>
                    <rect x="-22" y="-12" width="44" height="24" fill="rgba(15, 118, 110, 0.18)" stroke="#0f766e" strokeWidth="2" rx="2" />
                    <line x1="-16" y1="12" x2="16" y2="12" stroke="#ea580c" strokeWidth="3.5" />
                  </g>

                  {/* Cardinal Labels */}
                  <text x={cx} y={cy - R - 8} textAnchor="middle" className="text-[11px] font-bold fill-slate-700">N</text>
                  <text x={cx + R + 12} y={cy + 4} textAnchor="middle" className="text-[11px] font-bold fill-slate-700">E</text>
                  <text x={cx} y={cy + R + 16} textAnchor="middle" className="text-[11px] font-bold fill-amber-700">S</text>
                  <text x={cx - R - 12} y={cy + 4} textAnchor="middle" className="text-[11px] font-bold fill-slate-700">W</text>
                </svg>
              );
            })()}
          </div>

          <div className="flex justify-center gap-4 mt-2 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-orange-600">● Jun 21 (Summer Solstice)</span>
            <span className="flex items-center gap-1 text-emerald-600">● Mar/Sep 21 (Equinox)</span>
            <span className="flex items-center gap-1 text-sky-600">● Dec 21 (Winter Solstice)</span>
          </div>
        </div>

        {/* 2. Interactive Polar Wind Rose (CBE Clima Style) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-600" />
                Polar Wind Rose & Speed Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Directional frequency (%) & wind speed tiers from 8,760h records
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
              {(['annual', 'winter', 'summer'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setWindSeason(s)}
                  className={`px-2 py-0.5 rounded capitalize ${windSeason === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex items-center justify-center">
            {(() => {
              const size = 300;
              const cx = size / 2;
              const cy = size / 2;
              const R = 115;
              const maxPct = Math.max(18, ...activeWindRose.map((s) => s.totalPct));

              // Helper to draw a wedge from r0 to r1 around angle deg
              const makeWedge = (deg: number, pct0: number, pct1: number) => {
                const r0 = (pct0 / maxPct) * R;
                const r1 = (pct1 / maxPct) * R;
                const a1 = ((deg - 16 - 90) * Math.PI) / 180;
                const a2 = ((deg + 16 - 90) * Math.PI) / 180;
                const x01 = cx + r0 * Math.cos(a1);
                const y01 = cy + r0 * Math.sin(a1);
                const x02 = cx + r0 * Math.cos(a2);
                const y02 = cy + r0 * Math.sin(a2);
                const x11 = cx + r1 * Math.cos(a1);
                const y11 = cy + r1 * Math.sin(a1);
                const x12 = cx + r1 * Math.cos(a2);
                const y12 = cy + r1 * Math.sin(a2);
                return `M ${x01} ${y01} L ${x11} ${y11} A ${r1} ${r1} 0 0 1 ${x12} ${y12} L ${x02} ${y02} Z`;
              };

              return (
                <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[310px]">
                  {[0.25, 0.5, 0.75, 1].map((f, i) => (
                    <g key={i}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={R * f}
                        fill={f === 1 ? 'none' : 'none'}
                        stroke="#cbd5e1"
                        strokeDasharray="3 3"
                      />
                      <text x={cx + 3} y={cy - R * f + 9} className="text-[8px] fill-slate-400">
                        {Math.round(maxPct * f)}%
                      </text>
                    </g>
                  ))}

                  {activeWindRose.map((sec) => {
                    const p1 = sec.calmPct;
                    const p2 = p1 + sec.lowPct;
                    const p3 = p2 + sec.medPct;
                    const p4 = p3 + sec.highPct;
                    const rad = ((sec.deg - 90) * Math.PI) / 180;
                    const lx = cx + (R + 14) * Math.cos(rad);
                    const ly = cy + (R + 14) * Math.sin(rad);

                    return (
                      <g key={sec.dir}>
                        <line x1={cx} y1={cy} x2={cx + R * Math.cos(rad)} y2={cy + R * Math.sin(rad)} stroke="#e2e8f0" />
                        {p1 > 0 && <path d={makeWedge(sec.deg, 0, p1)} fill="#bae6fd" stroke="#fff" strokeWidth="0.5" />}
                        {sec.lowPct > 0 && <path d={makeWedge(sec.deg, p1, p2)} fill="#38bdf8" stroke="#fff" strokeWidth="0.5" />}
                        {sec.medPct > 0 && <path d={makeWedge(sec.deg, p2, p3)} fill="#0284c7" stroke="#fff" strokeWidth="0.5" />}
                        {sec.highPct > 0 && <path d={makeWedge(sec.deg, p3, p4)} fill="#1e3a8a" stroke="#fff" strokeWidth="0.5" />}
                        <text x={lx} y={ly + 3} textAnchor="middle" className="text-[10px] font-bold fill-slate-700">
                          {sec.dir}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-2 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-sky-300">■ &lt;2 m/s</span>
            <span className="flex items-center gap-1 text-sky-500">■ 2–4 m/s</span>
            <span className="flex items-center gap-1 text-sky-700">■ 4–6 m/s</span>
            <span className="flex items-center gap-1 text-blue-950">■ &gt;6 m/s</span>
          </div>
        </div>
      </div>

      {/* Row 3: 8,760-Hour (365 Days × 24 Hours) Annual Carpet Heatmap (CBE Clima + DALEC) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-teal-600" />
              8,760-Hour Annual Carpet Plot (365 Days × 24 Hours — CBE Clima & DALEC View)
            </h3>
            <p className="text-xs text-slate-500">
              Inspect diurnal and seasonal patterns across every hour of the year
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {[
              { id: 'dryBulb', label: 'Outdoor Temp (°C)' },
              { id: 'ghi', label: 'Solar GHI (W/m²)' },
              { id: 'utci', label: 'UTCI Stress (°C)' },
              { id: 'daylight', label: 'Daylight UDI (lx)' },
              { id: 'indoorFree', label: 'Free-Running T_op' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHeatmapVar(tab.id as any)}
                className={`px-2.5 py-1 rounded-md transition ${heatmapVar === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Carpet Plot (73 columns of 5-day averages × 24 hours for crisp 60fps rendering) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          {(() => {
            const cols = 73; // 365 / 5
            const rows = 24;
            const cellW = 7.2;
            const cellH = 6.2;
            const padL = 34;
            const padB = 22;
            const svgW = padL + cols * cellW + 10;
            const svgH = rows * cellH + padB + 8;

            return (
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48">
                {/* Y-axis hours */}
                {[0, 6, 12, 18, 23].map((h) => (
                  <text
                    key={h}
                    x={padL - 5}
                    y={4 + (23 - h) * cellH + 5}
                    textAnchor="end"
                    className="text-[9px] fill-slate-500"
                  >
                    {String(h).padStart(2, '0')}:00
                  </text>
                ))}

                {/* 73 x 24 cells */}
                {Array.from({ length: cols }).map((_, cIdx) => {
                  const dayOfYear = cIdx * 5 + 2;
                  const baseHourIdx = (dayOfYear - 1) * 24;
                  return Array.from({ length: rows }).map((__, hIdx) => {
                    const rec = climate.hourly[Math.min(climate.hourly.length - 1, baseHourIdx + hIdx)];
                    if (!rec) return null;
                    return (
                      <rect
                        key={`${cIdx}-${hIdx}`}
                        x={padL + cIdx * cellW}
                        y={4 + (23 - hIdx) * cellH}
                        width={cellW + 0.3}
                        height={cellH + 0.3}
                        fill={getCellColor(rec)}
                      />
                    );
                  });
                })}

                {/* Month Labels along bottom */}
                {MONTHS.map((m, mIdx) => (
                  <text
                    key={m}
                    x={padL + (mIdx + 0.5) * (cols / 12) * cellW}
                    y={svgH - 5}
                    textAnchor="middle"
                    className="text-[10px] font-medium fill-slate-600"
                  >
                    {m}
                  </text>
                ))}
              </svg>
            );
          })()}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-200 mt-1">
            <span className="font-semibold">
              {heatmapVar === 'dryBulb' && 'Legend: <8°C (Cold Blue) • 16–22°C (Comfort Green) • 22–26°C (Warm Amber) • >30°C (Hot Rose)'}
              {heatmapVar === 'ghi' && 'Legend: Night (Dark) • <350 W/m² (Diffuse Sky Blue) • 350–750 W/m² (Direct Gold) • >750 W/m² (Peak Solar)'}
              {heatmapVar === 'utci' && 'Legend: <9°C (Cold Stress) • 9–26°C (No Thermal Stress Green) • 26–32°C (Moderate Heat) • >32°C (Strong Heat Stress)'}
              {heatmapVar === 'daylight' && 'Legend: Night (Dark) • <100 lx (Electric Light Needed) • 100–2000 lx (Useful Daylight UDI Green) • >2000 lx (Glare Risk Rose)'}
              {heatmapVar === 'indoorFree' && 'Legend: <18°C (Underheated Blue) • 18–26°C (Passive Comfort Zone Green) • 26–28°C (Warm) • >28°C (Overheating Risk)'}
            </span>
            <span className="text-slate-400">8,760 hourly records active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. MULTI-SCENARIO PORTFOLIO & CEA PARETO FRONT OPTIMIZATION PANEL
// ============================================================================
export interface SavedScenarioItem {
  id: string;
  name: string;
  svRatio: number;
  heatNeed: number;
  coolNeed: number;
  netSiteEui: number;
  primaryEnergy: number;
  totalOpCarbon: number;
  wholeLifeCarbon: number;
  circularityScore: number;
  opCost: number;
}

interface ParetoPanelProps {
  scenarios: SavedScenarioItem[];
  currentScenario: SavedScenarioItem;
  onAddPresetPortfolios: () => void;
  onRemoveScenario: (id: string) => void;
}

export const CeaParetoPortfolioPanel: React.FC<ParetoPanelProps> = ({
  scenarios,
  currentScenario,
  onAddPresetPortfolios,
  onRemoveScenario
}) => {
  const allPts = [currentScenario, ...scenarios];

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            CEA & DALEC Multi-Concept Trade-Off — Pareto Front (Whole-Life Carbon vs. Net Site EUI)
          </h3>
          <p className="text-xs text-slate-500">
            Compare saved design concepts on a 2D multi-objective optimization chart (closer to bottom-left = Pareto optimal)
          </p>
        </div>
        <button
          type="button"
          onClick={onAddPresetPortfolios}
          className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition"
        >
          + Load 3 Reference Concepts (RC / DALEC / NZEB)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Scatter Plot (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50 rounded-xl border border-slate-200 p-3">
          {(() => {
            const svgW = 440;
            const svgH = 220;
            const padL = 44;
            const padR = 24;
            const padT = 20;
            const padB = 32;
            const plotW = svgW - padL - padR;
            const plotH = svgH - padT - padB;

            const maxEui = Math.max(90, ...allPts.map((p) => p.netSiteEui)) * 1.15;
            const maxWlc = Math.max(900, ...allPts.map((p) => p.wholeLifeCarbon)) * 1.15;

            const xEui = (v: number) => padL + (v / maxEui) * plotW;
            const yWlc = (v: number) => padT + plotH - (v / maxWlc) * plotH;

            return (
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-52">
                {/* Target NZEB Sweet-spot Zone */}
                <rect
                  x={padL}
                  y={yWlc(550)}
                  width={xEui(45) - padL}
                  height={padT + plotH - yWlc(550)}
                  fill="rgba(16, 185, 129, 0.12)"
                  stroke="#10b981"
                  strokeDasharray="3 3"
                />
                <text x={padL + 6} y={padT + plotH - 6} className="text-[9px] font-bold fill-emerald-700">
                  2030 NZEB + Low-Carbon Target Zone
                </text>

                {/* Grid */}
                {[0, 0.5, 1].map((f, i) => {
                  const eVal = Math.round(maxEui * f);
                  const cVal = Math.round(maxWlc * f);
                  return (
                    <g key={i}>
                      <line x1={xEui(eVal)} y1={padT} x2={xEui(eVal)} y2={padT + plotH} stroke="#e2e8f0" />
                      <text x={xEui(eVal)} y={svgH - 8} textAnchor="middle" className="text-[9px] fill-slate-500">
                        {eVal} kWh/m²
                      </text>
                      <line x1={padL} y1={yWlc(cVal)} x2={padL + plotW} y2={yWlc(cVal)} stroke="#e2e8f0" />
                      <text x={padL - 5} y={yWlc(cVal) + 3} textAnchor="end" className="text-[9px] fill-slate-500">
                        {cVal}
                      </text>
                    </g>
                  );
                })}

                {/* Plot Saved Scenarios */}
                {scenarios.map((s, idx) => (
                  <g key={s.id}>
                    <circle
                      cx={xEui(s.netSiteEui)}
                      cy={yWlc(s.wholeLifeCarbon)}
                      r="6"
                      fill="#7c3aed"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={xEui(s.netSiteEui) + 8}
                      y={yWlc(s.wholeLifeCarbon) + 3}
                      className="text-[9px] font-semibold fill-purple-800"
                    >
                      #{idx + 1} {s.name.slice(0, 18)}
                    </text>
                  </g>
                ))}

                {/* Current Active Design Point */}
                <g>
                  <circle
                    cx={xEui(currentScenario.netSiteEui)}
                    cy={yWlc(currentScenario.wholeLifeCarbon)}
                    r="8"
                    fill="rgba(13, 148, 136, 0.25)"
                    stroke="#0f766e"
                    strokeWidth="2"
                  />
                  <circle
                    cx={xEui(currentScenario.netSiteEui)}
                    cy={yWlc(currentScenario.wholeLifeCarbon)}
                    r="4"
                    fill="#0f766e"
                  />
                  <text
                    x={xEui(currentScenario.netSiteEui) + 10}
                    y={yWlc(currentScenario.wholeLifeCarbon) - 5}
                    className="text-[10px] font-bold fill-teal-900"
                  >
                    ★ Active Design ({currentScenario.netSiteEui.toFixed(0)} EUI, {currentScenario.wholeLifeCarbon.toFixed(0)} CO₂)
                  </text>
                </g>
              </svg>
            );
          })()}
        </div>

        {/* Scenario Table (5 cols) */}
        <div className="lg:col-span-5 space-y-2 max-h-56 overflow-y-auto">
          <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-300 text-xs flex justify-between items-center">
            <div>
              <div className="font-bold text-teal-900">★ Active Studio Design</div>
              <div className="text-[11px] text-teal-700">
                EUI: {currentScenario.netSiteEui.toFixed(1)} kWh/m² • WLC: {currentScenario.wholeLifeCarbon.toFixed(0)} kgCO₂e/m² • Circ: {currentScenario.circularityScore}%
              </div>
            </div>
          </div>

          {scenarios.map((s, idx) => (
            <div
              key={s.id}
              className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between items-center"
            >
              <div className="truncate">
                <div className="font-bold text-slate-800 truncate">
                  #{idx + 1} {s.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  EUI: {s.netSiteEui.toFixed(1)} • WLC: {s.wholeLifeCarbon.toFixed(0)} kgCO₂e • Circ: {s.circularityScore}%
                </div>
              </div>
              <button
                onClick={() => onRemoveScenario(s.id)}
                className="text-[11px] text-rose-500 hover:underline ml-2 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

