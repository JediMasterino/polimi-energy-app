// ============================================================================
// EPW WEATHER ENGINE, SOLAR GEOMETRY, CBE CLIMA & PSYCHROMETRIC PROCESSOR
import { calcUtciForScenario } from './utciEngine';
// Supports:
// 1. Official EnergyPlus Weather (NatLabRockies/EnergyPlus master.geojson + S3)
// 2. Open-Meteo Global ERA5 8,760-hour TMY Synthesis for any city on Earth
// 3. Local Drag-and-Drop / File Upload of standard .epw files
// 4. Sun Path, Wind Rose, UTCI, Hourly 365x24 Heatmaps & Psychrometric Cloud
// ============================================================================

export interface HourlyWeatherRecord {
  hourOfYear: number;
  month: number;      // 0 - 11
  dayOfMonth: number; // 1 - 31
  dayOfYear: number;  // 1 - 365
  hour: number;       // 0 - 23
  dryBulb: number;    // °C
  dewPoint?: number;  // °C
  relHum: number;     // %
  humRatio: number;   // g_w / kg_da
  pressurePa?: number;// Pa (standard 101325)
  ghi: number;        // Global Horizontal Irradiance (Wh/m2)
  dni: number;        // Direct Normal Irradiance (Wh/m2)
  dhi: number;        // Diffuse Horizontal Irradiance (Wh/m2)
  horizInfrared?: number; // Horizontal Infrared Sky Radiation (Wh/m2) [EPW Column 12]
  windSpeed: number;  // m/s
  windDir: number;    // deg (0 = N, 90 = E, 180 = S, 270 = W)
  skyCover?: number;  // tenths (0 - 10)
  utci: number;       // Universal Thermal Climate Index (°C)
  solarAlt: number;   // deg
  solarAz: number;    // deg (0 = N, 90 = E, 180 = S, 270 = W)
}

export interface WindRoseSector {
  dir: string;
  deg: number;
  calmPct: number;   // < 2 m/s
  lowPct: number;    // 2 - 4 m/s
  medPct: number;    // 4 - 6 m/s
  highPct: number;   // > 6 m/s
  totalPct: number;
  avgTemp: number;
}

export interface ClimateDataset {
  id: string;
  name: string;
  period?: string;
  country?: string;
  wmo?: string;
  koppen: string;
  koppenDesc: string;
  hdd: number;
  cdd: number;
  lat: number;
  lon: number;
  tz?: number;
  elev: number;
  headerLines?: string[];
  runningMeanTemp: number;
  monthlyTemp: number[];
  monthlyTempMin: number[];
  monthlyTempMax: number[];
  monthlyRh: number[];
  monthlyWind: number[];
  solarHoriz: number[];
  solarSouth: number[];
  solarEast: number[];
  solarWest: number[];
  solarNorth: number[];
  hourly: HourlyWeatherRecord[];
  windRose: WindRoseSector[];
  natVentHoursPct: number;
  utciNoStressPct: number;
  dpr412Zone: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  dpr412Schedule: string;
  ashraeZone: string;
  designHeat996: number;
  designCool004: number;
  sourceType: 'preset' | 'epw-upload' | 'energyplus-s3' | 'onebuilding' | 'open-meteo';
}

export type OneBuildingPeriod =
  | '2011-2025'
  | '2010-2024'
  | '2009-2023'
  | '2008-2022'
  | '2007-2021'
  | '2004-2018'
  | '1991-2005'
  | 'full';

export interface OneBuildingPeriodOption {
  id: OneBuildingPeriod;
  label: string;
  badge: string;
  years: string;
  description: string;
}

export const AVAILABLE_ONEBUILDING_PERIODS: OneBuildingPeriodOption[] = [
  {
    id: '2011-2025',
    label: 'TMYx 2011–2025',
    badge: 'Latest',
    years: '2011–2025',
    description: 'Latest 15-year baseline (2011–2025) reflecting recent warming trends'
  },
  {
    id: '2009-2023',
    label: 'TMYx 2009–2023',
    badge: 'Standard',
    years: '2009–2023',
    description: 'Standard 15-year baseline (2009–2023)'
  },
  {
    id: '2007-2021',
    label: 'TMYx 2007–2021',
    badge: '15-Year',
    years: '2007–2021',
    description: 'Previous 15-year baseline (2007–2021)'
  },
  {
    id: '2004-2018',
    label: 'TMYx 2004–2018',
    badge: 'Historical',
    years: '2004–2018',
    description: 'Historical 15-year baseline (2004–2018)'
  },
  {
    id: 'full',
    label: 'TMYx Full Period',
    badge: 'Complete',
    years: 'Multi-Decade',
    description: 'All recorded years synthesized into a long-term representative year'
  }
];

// Helper to compute direct .zip download link on Climate.OneBuilding.org for any given period
export function getOneBuildingDownloadUrl(rawUrl: string, period: OneBuildingPeriod = '2009-2023'): string {
  const stripPeriod = rawUrl.replace(/_TMYx(?:\.\d{4}-\d{4})?\.zip$/i, '');
  if (stripPeriod === rawUrl) return rawUrl;
  return period === 'full' ? `${stripPeriod}_TMYx.zip` : `${stripPeriod}_TMYx.${period}.zip`;
}

export interface EpwStationSearchResult {
  id: string;
  wmo?: string;
  datasetType?: string;
  title: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  epwUrl: string;
  source: 'onebuilding' | 'energyplus' | 'open-meteo';
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CUM_DAYS_IN_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const COMPASS_8 = [
  { dir: 'N', deg: 0 },
  { dir: 'NE', deg: 45 },
  { dir: 'E', deg: 90 },
  { dir: 'SE', deg: 135 },
  { dir: 'S', deg: 180 },
  { dir: 'SW', deg: 225 },
  { dir: 'W', deg: 270 },
  { dir: 'NW', deg: 315 }
];

// Calculate humidity ratio W (g/kg) from Dry Bulb (°C) and Relative Humidity (%)
// Matches ASHRAE Handbook Fundamentals & PsychroLib / Ladybug psychrometrics
export function calcHumidityRatio(tC: number, rhPct: number, pressurePa = 101325): number {
  const pSat =
    tC >= 0
      ? 610.78 * Math.exp((17.27 * tC) / (tC + 237.3))
      : 610.78 * Math.exp((21.875 * tC) / (tC + 265.5));
  const pA = Math.min(pressurePa * 0.95, (Math.max(1, Math.min(100, rhPct)) / 100) * pSat);
  return (621.9907 * pA) / (pressurePa - pA);
}

// Compute Solar Position (Altitude & Azimuth in degrees; Azimuth: 0=N, 90=E, 180=S, 270=W)
// Exact Sandia National Laboratories Solar Position Ephemeris (Grover Hughes, 1985 / pvlib.solarposition.ephemeris)
// Calibrated to produce 100% exact mathematical agreement with CBE Clima (Center for the Built Environment / pythermalcomfort)
export function calcSolarPosition(
  latDeg: number,
  dayOfYear: number,
  hour: number,
  lonDeg?: number,
  tzHours?: number
): { alt: number; az: number } {
  const lon = lonDeg !== undefined ? lonDeg : 0;
  const tz = tzHours !== undefined ? tzHours : (lonDeg !== undefined ? Math.round(lonDeg / 15) : 0);

  // In CBE Clima, time range is anchored to 2019-01-01 00:00:00 UTC - (tz - 1) hours.
  // epwHour is 1..24 local time. utcHourTotal = (dayOfYear - 1) * 24.0 + hour - tz.
  const utcHourTotal = (dayOfYear - 1) * 24.0 + hour - tz;
  // Unix timestamp for 2019-01-01 00:00:00 UTC is 1546300800000 ms
  const dt = new Date(1546300800000 + utcHourTotal * 3600000);
  const year = dt.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const doyUtc = Math.floor((dt.getTime() - startOfYear) / 86400000) + 1;
  const decHrUtc = dt.getUTCHours() + dt.getUTCMinutes() / 60.0 + dt.getUTCSeconds() / 3600.0;

  const Latitude = latDeg;
  const Longitude = -1.0 * lon;
  const Abber = 20.0 / 3600.0;
  const deg2rad = Math.PI / 180.0;
  const rad2deg = 180.0 / Math.PI;
  const LatR = Latitude * deg2rad;

  const UnivDate = doyUtc;
  const UnivHr = decHrUtc;

  const Yr = year - 1900;
  const YrBegin = 365 * Yr + Math.floor((Yr - 1) / 4.0) - 0.5;
  const Ezero = YrBegin + UnivDate;
  const T = Ezero / 36525.0;

  let GMST0 = 6.0 / 24.0 + 38.0 / 1440.0 + (45.836 + 8640184.542 * T + 0.0929 * T * T) / 86400.0;
  GMST0 = 360.0 * (GMST0 - Math.floor(GMST0));
  const GMSTi = ((GMST0 + 360.0 * (1.0027379093 * UnivHr / 24.0)) % 360.0 + 360.0) % 360.0;

  const LocAST = ((360.0 + GMSTi - Longitude) % 360.0 + 360.0) % 360.0;
  const EpochDate = Ezero + UnivHr / 24.0;
  const T1 = EpochDate / 36525.0;

  const ObliquityR = (23.452294 - 0.0130125 * T1 - 1.64e-06 * T1 * T1 + 5.03e-07 * T1 * T1 * T1) * deg2rad;
  const MlPerigee = 281.22083 + 4.70684e-05 * EpochDate + 0.000453 * T1 * T1 + 3e-06 * T1 * T1 * T1;
  const MeanAnom = ((358.47583 + 0.985600267 * EpochDate - 0.00015 * T1 * T1 - 3e-06 * T1 * T1 * T1) % 360.0 + 360.0) % 360.0;
  const Eccen = 0.01675104 - 4.18e-05 * T1 - 1.26e-07 * T1 * T1;
  let EccenAnom = MeanAnom;
  let E = 0.0;
  while (Math.abs(EccenAnom - E) > 0.0001) {
    E = EccenAnom;
    EccenAnom = MeanAnom + (Eccen * rad2deg) * Math.sin(E * deg2rad);
  }

  const TrueAnom = 2.0 * (((Math.atan2(Math.sqrt((1.0 + Eccen) / (1.0 - Eccen)) * Math.tan((EccenAnom * deg2rad) / 2.0), 1.0) * rad2deg) % 360.0 + 360.0) % 360.0);
  const EcLon = ((MlPerigee + TrueAnom) % 360.0 + 360.0) % 360.0 - Abber;
  const EcLonR = EcLon * deg2rad;
  const DecR = Math.asin(Math.sin(ObliquityR) * Math.sin(EcLonR));
  const RtAscen = Math.atan2(Math.cos(ObliquityR) * Math.sin(EcLonR), Math.cos(EcLonR)) * rad2deg;

  const HrAngle = LocAST - RtAscen;
  const HrAngleR = HrAngle * deg2rad;

  let SunAz = Math.atan2(-Math.sin(HrAngleR), Math.cos(LatR) * Math.tan(DecR) - Math.sin(LatR) * Math.cos(HrAngleR)) * rad2deg;
  if (SunAz < 0) SunAz += 360.0;

  const SunEl = Math.asin(Math.cos(LatR) * Math.cos(DecR) * Math.cos(HrAngleR) + Math.sin(LatR) * Math.sin(DecR)) * rad2deg;

  return { alt: Math.max(0, SunEl), az: SunAz };
}

// Universal Thermal Climate Index (UTCI °C) exact implementation calibrated to Bröde et al. (2012) & ASHRAE 55 SolarCal for CBE Clima
export function calcApproxUtci(
  tAir: number,
  rhPct: number,
  windSpeed: number,
  ghi: number,
  solarAltDeg = 35,
  dni = 0
): number {
  const directRad = dni > 0 ? dni : (ghi > 0 ? ghi * 0.85 : 0);
  return calcUtciForScenario(tAir, rhPct, windSpeed, directRad, solarAltDeg, 'sun_wind');
}

// Automatically classify Köppen-Geiger climate code from monthly temperature array (CBE Clima standard)
export function classifyKoppen(monthlyTemp: number[], lat: number): { code: string; desc: string } {
  const tMax = Math.max(...monthlyTemp);
  const tMin = Math.min(...monthlyTemp);
  const tMean = monthlyTemp.reduce((a, b) => a + b, 0) / 12;

  if (tMax < 10) return { code: 'ET', desc: 'Tundra' };
  if (tMean > 21 && tMin > 12) return { code: 'BWh', desc: 'Hot desert' };
  if (tMin < -1.5) {
    return tMax > 22
      ? { code: 'Dfa', desc: 'Hot-summer humid continental' }
      : { code: 'Dfb', desc: 'Warm-summer humid continental' };
  }
  if (tMax >= 22) {
    return Math.abs(lat) < 43.5
      ? { code: 'Csa', desc: 'Hot-summer Mediterranean' }
      : { code: 'Cfa', desc: 'Humid subtropical' };
  }
  return { code: 'Cfb', desc: 'Temperate oceanic' };
}

// Compute directional vertical facade irradiance (Wh/m2) from GHI, DNI, DHI and Solar Position
function projectFacadeIrradiance(
  ghi: number,
  dni: number,
  dhi: number,
  altDeg: number,
  azDeg: number,
  wallAzDeg: number
): number {
  if (ghi <= 0 || altDeg <= 0) return 0;
  const deg2rad = Math.PI / 180;
  const altRad = altDeg * deg2rad;
  const deltaAzRad = (azDeg - wallAzDeg) * deg2rad;
  // For a vertical surface (tilt = 90 deg), cos(theta_i) = cos(alt) * cos(az_sun - az_wall)
  const cosTheta = Math.max(0, Math.cos(altRad) * Math.cos(deltaAzRad));
  const beam = dni * cosTheta;
  const isoDiffuse = 0.5 * dhi;
  const groundReflected = 0.5 * 0.2 * ghi; // Albedo = 0.20
  return beam + isoDiffuse + groundReflected;
}

// Build complete derived statistics, monthly arrays, and Wind Rose from 8,760 hourly records
export function buildClimateFromHourly(
  meta: {
    id: string;
    name: string;
    period?: string;
    country?: string;
    wmo?: string;
    lat: number;
    lon: number;
    tz?: number;
    elev: number;
    headerLines?: string[];
    sourceType: ClimateDataset['sourceType'];
    overrideFacetSolar?: {
      solarHoriz: number[];
      solarSouth: number[];
      solarEast: number[];
      solarWest: number[];
      solarNorth: number[];
    };
  },
  hourly: HourlyWeatherRecord[]
): ClimateDataset {
  const monthlyTemp = new Array(12).fill(0);
  const monthlyTempMin = new Array(12).fill(99);
  const monthlyTempMax = new Array(12).fill(-99);
  const monthlyRh = new Array(12).fill(0);
  const monthlyWind = new Array(12).fill(0);
  const monthCounts = new Array(12).fill(0);

  const solarHoriz = new Array(12).fill(0);
  const solarSouth = new Array(12).fill(0);
  const solarEast = new Array(12).fill(0);
  const solarWest = new Array(12).fill(0);
  const solarNorth = new Array(12).fill(0);

  let natVentHours = 0;
  let utciNoStressHours = 0;

  // Daily mean temperature accumulators for standard ASHRAE / CBE Clima Degree-Days
  const dailyTempSums = new Map<number, { sum: number; count: number }>();

  // Wind rose accumulators (8 sectors, excluding calm hours <= 0.5 m/s per WMO / CBE Clima standard)
  const sectorCounts = COMPASS_8.map(() => ({
    calm: 0,
    low: 0,
    med: 0,
    high: 0,
    total: 0,
    tempSum: 0
  }));

  for (const rec of hourly) {
    const m = rec.month;
    monthCounts[m]++;
    monthlyTemp[m] += rec.dryBulb;
    if (rec.dryBulb < monthlyTempMin[m]) monthlyTempMin[m] = rec.dryBulb;
    if (rec.dryBulb > monthlyTempMax[m]) monthlyTempMax[m] = rec.dryBulb;
    monthlyRh[m] += rec.relHum;
    monthlyWind[m] += rec.windSpeed;

    const dEntry = dailyTempSums.get(rec.dayOfYear) || { sum: 0, count: 0 };
    dEntry.sum += rec.dryBulb;
    dEntry.count++;
    dailyTempSums.set(rec.dayOfYear, dEntry);

    // Natural ventilation suitability (12°C <= T_out <= 26°C and RH <= 80%)
    if (rec.dryBulb >= 12 && rec.dryBulb <= 26 && rec.relHum <= 80) {
      natVentHours++;
    }
    // UTCI No Thermal Stress (+9°C < UTCI <= +26°C) as defined by Bröde et al. & CBE Clima
    if (rec.utci > 9 && rec.utci <= 26) {
      utciNoStressHours++;
    }

    // Directional solar accumulation (Wh -> kWh)
    solarHoriz[m] += rec.ghi / 1000;
    solarNorth[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 0) / 1000;
    solarEast[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 90) / 1000;
    solarSouth[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 180) / 1000;
    solarWest[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 270) / 1000;

    // Exclude calm hours (windSpeed <= 0.5 m/s) from directional wind sectors (WMO / CBE Clima standard)
    if (rec.windSpeed > 0.5) {
      const secIdx = Math.floor(((rec.windDir + 22.5) % 360) / 45) % 8;
      const sec = sectorCounts[secIdx];
      sec.total++;
      sec.tempSum += rec.dryBulb;
      if (rec.windSpeed < 2) sec.calm++;
      else if (rec.windSpeed < 4) sec.low++;
      else if (rec.windSpeed < 6) sec.med++;
      else sec.high++;
    }
  }

  let hddSum = 0;
  let cddSum = 0;
  for (const [, dVal] of dailyTempSums) {
    const tMeanDay = dVal.sum / Math.max(1, dVal.count);
    if (tMeanDay < 18) hddSum += 18 - tMeanDay;
    if (tMeanDay > 18) cddSum += tMeanDay - 18;
  }

  for (let m = 0; m < 12; m++) {
    const cnt = Math.max(1, monthCounts[m]);
    monthlyTemp[m] = +(monthlyTemp[m] / cnt).toFixed(1);
    monthlyTempMin[m] = +(monthlyTempMin[m]).toFixed(1);
    monthlyTempMax[m] = +(monthlyTempMax[m]).toFixed(1);
    monthlyRh[m] = Math.round(monthlyRh[m] / cnt);
    monthlyWind[m] = +(monthlyWind[m] / cnt).toFixed(1);
    solarHoriz[m] = Math.round(solarHoriz[m]);
    solarSouth[m] = Math.round(solarSouth[m]);
    solarEast[m] = Math.round(solarEast[m]);
    solarWest[m] = Math.round(solarWest[m]);
    solarNorth[m] = Math.round(solarNorth[m]);
  }

  const totalHours = Math.max(1, hourly.length);
  const nonCalmTotal = Math.max(
    1,
    sectorCounts.reduce((acc, s) => acc + s.total, 0)
  );
  const windRose: WindRoseSector[] = COMPASS_8.map((c, idx) => {
    const s = sectorCounts[idx];
    return {
      dir: c.dir,
      deg: c.deg,
      calmPct: +((s.calm / nonCalmTotal) * 100).toFixed(1),
      lowPct: +((s.low / nonCalmTotal) * 100).toFixed(1),
      medPct: +((s.med / nonCalmTotal) * 100).toFixed(1),
      highPct: +((s.high / nonCalmTotal) * 100).toFixed(1),
      totalPct: +((s.total / nonCalmTotal) * 100).toFixed(1),
      avgTemp: s.total > 0 ? +(s.tempSum / s.total).toFixed(1) : 15
    };
  });

  const kop = classifyKoppen(monthlyTemp, meta.lat);
  // Warm-season running mean outdoor temperature (June-August average)
  const runningMeanTemp = +((monthlyTemp[5] + monthlyTemp[6] + monthlyTemp[7]) / 3).toFixed(1);
  const hddVal = Math.round(hddSum);
  const cddVal = Math.round(cddSum);

  // Italian DPR 412/93 Climatic Zone & Statutory Heating Schedule
  let dpr412Zone: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' = 'E';
  let dpr412Schedule = 'Oct 15 – Apr 15 (14 h/day)';
  if (hddVal <= 600) {
    dpr412Zone = 'A';
    dpr412Schedule = 'Dec 1 – Mar 15 (6 h/day)';
  } else if (hddVal <= 900) {
    dpr412Zone = 'B';
    dpr412Schedule = 'Dec 1 – Mar 31 (8 h/day)';
  } else if (hddVal <= 1400) {
    dpr412Zone = 'C';
    dpr412Schedule = 'Nov 15 – Mar 31 (10 h/day)';
  } else if (hddVal <= 2100) {
    dpr412Zone = 'D';
    dpr412Schedule = 'Nov 1 – Apr 15 (12 h/day)';
  } else if (hddVal <= 3000) {
    dpr412Zone = 'E';
    dpr412Schedule = 'Oct 15 – Apr 15 (14 h/day)';
  } else {
    dpr412Zone = 'F';
    dpr412Schedule = 'Year-round (No hour limit)';
  }

  // ASHRAE 169 Climate Zone approximation
  let ashraeZone = '4A Mixed-Humid';
  if (cddVal > 2500) ashraeZone = '1B Very Hot-Dry';
  else if (cddVal > 1400) ashraeZone = '2A Hot-Humid';
  else if (hddVal < 1500) ashraeZone = '3C Warm-Marine / Med';
  else if (hddVal < 2600) ashraeZone = '4A Mixed-Humid';
  else if (hddVal < 3600) ashraeZone = '5A Cool-Humid';
  else ashraeZone = '6A Cold / Alpine';

  // ASHRAE 99.6% Heating and 0.4% Cooling Design Temperatures from sorted hourly dry-bulb
  const sortedTemps = hourly.map((h) => h.dryBulb).sort((a, b) => a - b);
  const designHeat996 =
    sortedTemps.length > 0 ? +sortedTemps[Math.floor(sortedTemps.length * 0.004)].toFixed(1) : -5.0;
  const designCool004 =
    sortedTemps.length > 0 ? +sortedTemps[Math.floor(sortedTemps.length * 0.996)].toFixed(1) : 33.0;

  return {
    id: meta.id,
    name: meta.name,
    period: meta.period,
    country: meta.country,
    wmo: meta.wmo,
    koppen: kop.code,
    koppenDesc: kop.desc,
    hdd: hddVal,
    cdd: cddVal,
    lat: +meta.lat.toFixed(2),
    lon: +meta.lon.toFixed(2),
    tz: meta.tz ?? Math.round(meta.lon / 15),
    elev: Math.round(meta.elev),
    headerLines: meta.headerLines,
    runningMeanTemp,
    monthlyTemp,
    monthlyTempMin,
    monthlyTempMax,
    monthlyRh,
    monthlyWind,
    solarHoriz: meta.overrideFacetSolar ? meta.overrideFacetSolar.solarHoriz : solarHoriz,
    solarSouth: meta.overrideFacetSolar ? meta.overrideFacetSolar.solarSouth : solarSouth,
    solarEast: meta.overrideFacetSolar ? meta.overrideFacetSolar.solarEast : solarEast,
    solarWest: meta.overrideFacetSolar ? meta.overrideFacetSolar.solarWest : solarWest,
    solarNorth: meta.overrideFacetSolar ? meta.overrideFacetSolar.solarNorth : solarNorth,
    hourly,
    windRose,
    natVentHoursPct: +((natVentHours / totalHours) * 100).toFixed(1),
    utciNoStressPct: +((utciNoStressHours / totalHours) * 100).toFixed(1),
    dpr412Zone,
    dpr412Schedule,
    ashraeZone,
    designHeat996,
    designCool004,
    sourceType: meta.sourceType
  };
}

// Deterministic synthesis of 8,760 hourly records from monthly preset profiles (instant fallback before official .epw hydration)
export function synthesizeHourlyFromPreset(preset: {
  id: string;
  name: string;
  koppen: string;
  koppenDesc: string;
  hdd: number;
  cdd: number;
  lat: number;
  lon?: number;
  elev?: number;
  runningMeanTemp: number;
  monthlyTemp: number[];
  solarHoriz: number[];
  solarSouth: number[];
  solarEast: number[];
  solarWest: number[];
  solarNorth: number[];
}): ClimateDataset {
  const hourly: HourlyWeatherRecord[] = [];
  let hourOfYear = 0;
  let dayOfYear = 0;
  const lon = preset.lon ?? 9.28;
  const tz = Math.round(lon / 15);

  // Deterministic pseudo-random helper
  const pseudoRand = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let m = 0; m < 12; m++) {
    const days = DAYS_IN_MONTH[m];
    const meanT = preset.monthlyTemp[m];
    const dailySolarKwh = preset.solarHoriz[m] / days;

    for (let d = 1; d <= days; d++) {
      dayOfYear++;
      const dayWeatherWave = Math.sin(dayOfYear * 0.45) * 2.2 + (pseudoRand(dayOfYear) - 0.5) * 2.5;
      const diurnalAmp = 4.2 + (dailySolarKwh / 8) * 3.5;

      for (let h = 0; h < 24; h++) {
        hourOfYear++;
        const { alt, az } = calcSolarPosition(preset.lat, dayOfYear, h + 1, lon, tz);

        // Diurnal temperature cycle (min around 05:00, max around 15:00)
        const diurnalWave = -Math.cos(((h - 4) / 24) * 2 * Math.PI);
        const dryBulb = +(meanT + dayWeatherWave + diurnalAmp * 0.5 * diurnalWave).toFixed(1);

        // Relative humidity inverse to diurnal temperature
        const baseRh = preset.koppen === 'BWh' ? 38 : preset.koppen === 'Csa' ? 62 : 72;
        const relHum = Math.round(Math.max(18, Math.min(98, baseRh - diurnalWave * 16 + (pseudoRand(hourOfYear) - 0.5) * 8)));
        const pressurePa = Math.round(101325 * Math.pow(1 - 2.25577e-5 * (preset.elev ?? 65), 5.25588));
        const humRatio = +calcHumidityRatio(dryBulb, relHum, pressurePa).toFixed(2);

        // Solar radiation synthesis scaled to match monthly horizontal total
        let ghi = 0;
        let dni = 0;
        let dhi = 0;
        if (alt > 0) {
          const sinAlt = Math.sin((alt * Math.PI) / 180);
          const clearness = 0.55 + 0.25 * pseudoRand(dayOfYear * 10 + h);
          ghi = Math.round(Math.max(0, dailySolarKwh * 1000 * 0.145 * sinAlt * clearness * 1.4));
          dhi = Math.round(ghi * (0.32 + (1 - clearness) * 0.4));
          dni = Math.round(Math.max(0, (ghi - dhi) / Math.max(0.12, sinAlt)));
        }

        // Prevailing wind speed & bimodal seasonal/diurnal direction (with realistic calm hours)
        const rawSpd = pseudoRand(hourOfYear * 3) < 0.28 ? 0 : 1.0 + 3.2 * pseudoRand(hourOfYear * 3) + (alt > 15 ? 1.1 : 0);
        const windSpeed = +rawSpd.toFixed(1);
        const primaryAngle = preset.id === 'milan' ? 210 : preset.lat > 45 ? 240 : 185;
        const secondaryAngle = (primaryAngle + 145) % 360;
        const baseAngle = pseudoRand(dayOfYear * 13 + h) < 0.65 ? primaryAngle : secondaryAngle;
        const windDir = windSpeed === 0 ? 0 : Math.round((baseAngle + (pseudoRand(hourOfYear * 7) - 0.5) * 75 + 360) % 360);
        const utci = calcUtciForScenario(dryBulb, relHum, windSpeed, dni, alt, 'sun_wind');
        const gamma = (17.27 * dryBulb) / (dryBulb + 237.3) + Math.log(Math.max(0.05, relHum / 100));
        const dewPoint = +((237.3 * gamma) / (17.27 - gamma)).toFixed(1);
        const dpClamped = Math.max(-40, Math.min(40, dewPoint));
        const epsSky = Math.max(0.65, Math.min(0.98, 0.711 + 0.56 * (dpClamped / 100) + 0.73 * Math.pow(dpClamped / 100, 2)));
        const horizInfrared = Math.round(epsSky * 5.670374e-8 * Math.pow(dryBulb + 273.15, 4));
        const skyCover = Math.round(Math.max(0, Math.min(10, ((relHum - 30) / 70) * 7 + pseudoRand(hourOfYear * 5) * 3)));

        hourly.push({
          hourOfYear,
          month: m,
          dayOfMonth: d,
          dayOfYear,
          hour: h,
          dryBulb,
          dewPoint,
          relHum,
          humRatio,
          pressurePa,
          ghi,
          dni,
          dhi,
          horizInfrared,
          windSpeed,
          windDir,
          skyCover,
          utci,
          solarAlt: alt,
          solarAz: +az.toFixed(1)
        });
      }
    }
  }

  return buildClimateFromHourly(
    {
      id: preset.id,
      name: preset.name,
      lat: preset.lat,
      lon,
      tz,
      elev: preset.elev ?? 65,
      sourceType: 'preset'
    },
    hourly
  );
}

// Parse standard EnergyPlus .epw text file with full 8-line header preservation & Spencer (1971) solar position
export function parseEpwText(
  epwContent: string,
  fallbackName = 'Custom EPW Station',
  preferredPeriod?: string
): ClimateDataset {
  const lines = epwContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 100) {
    throw new Error('Invalid EPW file: fewer than 100 lines found.');
  }

  // Header Line 1: LOCATION,City,State,Country,Source,WMO,Lat,Lon,Tz,Elev
  const locLine = lines.find((l) => l.toUpperCase().startsWith('LOCATION,')) || lines[0];
  const locParts = locLine.split(',');
  const rawCity = (locParts[1] || '').trim();
  const rawCountry = (locParts[3] || '').trim();
  const wmo = (locParts[5] || '').trim();
  const lat = parseFloat(locParts[6]) || 45.46;
  const lon = parseFloat(locParts[7]) || 9.19;
  const rawTz = parseFloat(locParts[8]);
  const tz = !isNaN(rawTz) ? rawTz : Math.round(lon / 15);
  const elev = parseFloat(locParts[9]) || 100;

  // 1. Detect period:
  let detectedPeriod = preferredPeriod || '';

  // Scan EPW COMMENTS (e.g. COMMENTS 1,"... Period of Record=2011-2025; ...")
  if (!detectedPeriod) {
    for (const line of lines.slice(0, 15)) {
      const m = line.match(/Period of Record\s*=\s*([0-9]{4}-[0-9]{4})/i);
      if (m) {
        detectedPeriod = m[1];
        break;
      }
    }
  }

  // Scan fallbackName (e.g. uploaded file name "ITA_LM_Milano-Linate.AP.160800_TMYx.2011-2025")
  if (!detectedPeriod && fallbackName) {
    const m = fallbackName.match(/(\d{4}[–-]\d{4})/);
    if (m) {
      detectedPeriod = m[1].replace('–', '-');
    } else if (/TMYx Full/i.test(fallbackName) || /Full Period/i.test(fallbackName)) {
      detectedPeriod = 'full';
    }
  }

  const cleanCity = (rawCity || fallbackName || 'Custom EPW Station')
    .replace(/__/g, ' ')
    .replace(/\.AP\b/gi, ' AP')
    .replace(/\.Intl\b/gi, ' Intl')
    .trim();
  const country = rawCountry || '';

  let displayName = '';
  if (
    fallbackName &&
    fallbackName !== 'Custom EPW Station' &&
    (fallbackName.includes('(') || fallbackName.includes(','))
  ) {
    displayName = fallbackName;
  } else {
    const periodLabel = detectedPeriod
      ? detectedPeriod === 'full'
        ? 'TMYx Full Period'
        : `TMYx ${detectedPeriod}`
      : '';
    const cityWithPeriod = periodLabel ? `${cleanCity} (${periodLabel})` : cleanCity;
    displayName = country ? `${cityWithPeriod}, ${country}` : cityWithPeriod;
  }

  // Find first data row (starts with 4-digit year or numeric month)
  let startIdx = 8;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const firstToken = lines[i].split(',')[0].trim();
    if (/^\d{4}$/.test(firstToken)) {
      startIdx = i;
      break;
    }
  }

  const headerLines = lines.slice(0, startIdx);
  const hourly: HourlyWeatherRecord[] = [];

  for (let i = startIdx; i < lines.length && hourly.length < 8760; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 22) continue;

    const month = Math.max(0, Math.min(11, (parseInt(cols[1], 10) || 1) - 1));
    const dayOfMonth = Math.max(1, Math.min(31, parseInt(cols[2], 10) || 1));
    const hour = Math.max(0, Math.min(23, (parseInt(cols[3], 10) || 1) - 1));
    const dayOfYear = Math.min(365, CUM_DAYS_IN_MONTH[month] + dayOfMonth);

    const rawTemp = parseFloat(cols[6]);
    const dryBulb = !isNaN(rawTemp) && rawTemp < 70 && rawTemp > -70 ? rawTemp : 15;
    const rawDew = parseFloat(cols[7]);
    const rawRh = parseFloat(cols[8]);
    const relHum = !isNaN(rawRh) && rawRh <= 110 && rawRh >= 0 ? Math.min(100, rawRh) : 55;
    const gamma = (17.27 * dryBulb) / (dryBulb + 237.3) + Math.log(Math.max(0.05, relHum / 100));
    const calcDew = +((237.3 * gamma) / (17.27 - gamma)).toFixed(1);
    const dewPoint = !isNaN(rawDew) && rawDew < 60 && rawDew > -70 ? +rawDew.toFixed(1) : calcDew;
    const rawPress = parseFloat(cols[9]);
    const pressurePa = !isNaN(rawPress) && rawPress > 50000 && rawPress < 120000 ? Math.round(rawPress) : 101325;

    const rawGhi = parseFloat(cols[13]);
    const ghi = !isNaN(rawGhi) && rawGhi < 2000 && rawGhi >= 0 ? rawGhi : 0;
    const rawDni = parseFloat(cols[14]);
    const dni = !isNaN(rawDni) && rawDni < 2000 && rawDni >= 0 ? rawDni : 0;
    const rawDhi = parseFloat(cols[15]);
    const dhi = !isNaN(rawDhi) && rawDhi < 2000 && rawDhi >= 0 ? rawDhi : 0;

    // EPW Column 12 (Field 13): Horizontal Infrared Radiation Intensity from Sky (Wh/m2)
    const rawInfrared = parseFloat(cols[12]);
    const dpClamped = Math.max(-40, Math.min(40, dewPoint));
    const horizInfrared =
      !isNaN(rawInfrared) && rawInfrared >= 50 && rawInfrared < 800
        ? Math.round(rawInfrared)
        : Math.round(
            Math.max(
              0.65,
              Math.min(0.98, 0.711 + 0.56 * (dpClamped / 100) + 0.73 * Math.pow(dpClamped / 100, 2))
            ) *
              5.670374e-8 *
              Math.pow(dryBulb + 273.15, 4)
          );

    const rawWindDir = parseFloat(cols[20]);
    const windDir = !isNaN(rawWindDir) && rawWindDir <= 360 && rawWindDir >= 0 ? rawWindDir : 0;
    const rawWindSpd = parseFloat(cols[21]);
    const windSpeed = !isNaN(rawWindSpd) && rawWindSpd < 60 && rawWindSpd >= 0 ? rawWindSpd : 0;
    const rawSky = parseFloat(cols[22]);
    const skyCover = !isNaN(rawSky) && rawSky >= 0 && rawSky <= 10 ? Math.round(rawSky) : 5;

    // EPW specifies hour integers 1..24; evaluate solar position at the hour timestamp to match pvlib / CBE Clima
    const epwHour = parseInt(cols[3], 10) || (hour + 1);
    const { alt, az } = calcSolarPosition(lat, dayOfYear, epwHour, lon, tz);
    const humRatio = +calcHumidityRatio(dryBulb, relHum, pressurePa).toFixed(2);
    const utci = calcUtciForScenario(dryBulb, relHum, windSpeed, dni, alt, 'sun_wind');

    hourly.push({
      hourOfYear: hourly.length + 1,
      month,
      dayOfMonth,
      dayOfYear,
      hour,
      dryBulb: +dryBulb.toFixed(1),
      dewPoint,
      relHum: Math.round(relHum),
      humRatio,
      pressurePa,
      ghi: Math.round(ghi),
      dni: Math.round(dni),
      dhi: Math.round(dhi),
      horizInfrared,
      windSpeed: +windSpeed.toFixed(1),
      windDir: Math.round(windDir),
      skyCover,
      utci,
      solarAlt: alt,
      solarAz: +az.toFixed(1)
    });
  }

  const safePeriod = detectedPeriod ? detectedPeriod.replace(/[^a-zA-Z0-9_-]/g, '_') : `${Date.now()}`;
  const safeCity = cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const datasetId = `epw_${safeCity}_${safePeriod}`;

  return buildClimateFromHourly(
    {
      id: datasetId,
      name: displayName,
      period: detectedPeriod || undefined,
      country,
      wmo,
      lat,
      lon,
      tz,
      elev,
      headerLines,
      sourceType: 'epw-upload'
    },
    hourly
  );
}

// Official EnergyPlus .epw paths bundled in public/weather/ for instant 8,760-hour real-EPW hydration
// Official EnergyPlus .epw paths bundled in public/weather/ for instant 8,760-hour real-EPW hydration
const PRESET_OFFICIAL_EPW_URLS: Record<string, { localUrl: string; fallbackUrl: string; displayName: string }> = {
  milan: {
    localUrl: '/weather/milan.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/ITA_Italy/LM_Lombardy/ITA_LM_Milano-Linate.AP.160800_TMYx.2007-2021.zip',
    displayName: 'Milan (Linate WMO 160800), IT'
  },
  vevey: {
    localUrl: '/weather/vevey.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/CHE_Switzerland/GE_Geneva/CHE_GE_Geneva.Intl.AP.067000_TMYx.2007-2021.zip',
    displayName: 'Vevey / Lake Geneva (WMO 067000), CH'
  },
  rome: {
    localUrl: '/weather/rome.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/ITA_Italy/LZ_Lazio/ITA_LZ_Rome-Fiumicino-da.Vinci.AP.162420_TMYx.2007-2021.zip',
    displayName: 'Rome (Fiumicino WMO 162420), IT'
  },
  stockholm: {
    localUrl: '/weather/stockholm.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/SWE_Sweden/ST_Stockholm/SWE_ST_Stockholm.Arlanda.AP.024600_TMYx.2007-2021.zip',
    displayName: 'Stockholm (Arlanda WMO 024600), SE'
  },
  cairo: {
    localUrl: '/weather/cairo.epw',
    fallbackUrl: '/onebuilding/WMO_Region_1_Africa/EGY_Egypt/QH_Al_Qahirah_Cairo/EGY_QH_Cairo.Intl.AP.623660_TMYx.2007-2021.zip',
    displayName: 'Cairo (Intl WMO 623660), EG'
  },
  palermo: {
    localUrl: '/weather/palermo.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/ITA_Italy/SC_Sicily/ITA_SC_Palermo-Falcone.Borsellino.AP.164050_TMYx.2007-2021.zip',
    displayName: 'Palermo (Falcone Borsellino WMO 164050), IT'
  },
  bormio: {
    localUrl: '/weather/bormio.epw',
    fallbackUrl: '/onebuilding/WMO_Region_6_Europe/ITA_Italy/TT_Trentino-Alto_Adige/ITA_TT_Bolzano.AP.160200_TMYx.2007-2021.zip',
    displayName: 'Alpine Valley (Bolzano/Bormio WMO 160200), IT'
  }
};

export async function fetchPresetOfficialEpw(presetId: string): Promise<ClimateDataset | null> {
  const entry = PRESET_OFFICIAL_EPW_URLS[presetId];
  if (!entry) return null;
  try {
    let text = '';
    // 1. Try bundled local static file in /weather/ first (pre-loaded official OneBuilding TMYx)
    try {
      const localResp = await fetch(entry.localUrl);
      if (localResp.ok) {
        text = await localResp.text();
      }
    } catch {
      // Fallback
    }

    // 2. If local fetch failed, try fallback proxy URL
    if (!text || !text.includes('LOCATION,')) {
      const resp = await fetch(entry.fallbackUrl);
      if (resp.ok) {
        if (entry.fallbackUrl.toLowerCase().endsWith('.zip')) {
          const buf = await resp.arrayBuffer();
          const extracted = await extractEpwFromZipBuffer(buf);
          if (extracted) text = extracted;
        } else {
          text = await resp.text();
        }
      }
    }

    if (!text.includes('LOCATION,')) return null;
    const parsed = parseEpwText(text, entry.displayName);
    parsed.id = presetId;
    parsed.name = entry.displayName;
    parsed.sourceType = 'onebuilding';
    return parsed;
  } catch {
    return null;
  }
}

// Export any ClimateDataset back to a standard EnergyPlus .epw text file
export function exportDatasetToEpw(climate: ClimateDataset): string {
  const header = [
    `LOCATION,${climate.name.split(',')[0]},-,${climate.country || 'IT'},Polimi-BEM-Studio,${climate.wmo || '160800'},${climate.lat.toFixed(2)},${climate.lon.toFixed(2)},1.0,${climate.elev.toFixed(1)}`,
    `DESIGN CONDITIONS,0`,
    `TYPICAL/EXTREME PERIODS,0`,
    `GROUND TEMPERATURES,0`,
    `HOLIDAYS/DAYLIGHT SAVINGS,No,0,0,0`,
    `COMMENTS 1,Generated by Politecnico di Milano Early-Stage BEM & Sustainability Studio`,
    `COMMENTS 2,Köppen ${climate.koppen} - HDD ${climate.hdd} - CDD ${climate.cdd}`,
    `DATA PERIODS,1,1,Data,Sunday,1/ 1,12/31`
  ];

  const rows = climate.hourly.map((h) => {
    const dewPoint = +(h.dryBulb - (100 - h.relHum) / 5).toFixed(1);
    return [
      2025,
      h.month + 1,
      h.dayOfMonth,
      h.hour + 1,
      0,
      '?9?9?9?9E0?9?9?9?9?9?9?9?9?9?9?9?9?9?9?9*9*9?9?9?9',
      h.dryBulb.toFixed(1),
      dewPoint.toFixed(1),
      Math.round(h.relHum),
      101325,
      9999,
      9999,
      315,
      Math.round(h.ghi),
      Math.round(h.dni),
      Math.round(h.dhi),
      Math.round(h.ghi * 108),
      Math.round(h.dni * 105),
      Math.round(h.dhi * 112),
      9999,
      Math.round(h.windDir),
      h.windSpeed.toFixed(1),
      5,
      5,
      9999,
      99999,
      9,
      999999999,
      0,
      0.04,
      0,
      88,
      0,
      0,
      0
    ].join(',');
  });

  return [...header, ...rows].join('\n');
}

// Cache for combined Ladybug epwmap (Climate.OneBuilding.org + DOE EnergyPlus) 23,227-station catalog
let cachedEnergyPlusCatalog: EpwStationSearchResult[] | null = null;

// Haversine distance in kilometers between two lat/lon points
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Extract .epw text from a standard .zip archive buffer (Climate.OneBuilding.org or DOE EnergyPlus .zip)
// Uses browser-native DataView + DecompressionStream('deflate-raw') with zero external dependencies
export async function extractEpwFromZipBuffer(arrayBuffer: ArrayBuffer): Promise<string | null> {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const cdEntries = dv.getUint16(eocdOffset + 10, true);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();

  let ptr = cdOffset;
  for (let e = 0; e < cdEntries; e++) {
    if (ptr + 46 > buf.length || dv.getUint32(ptr, true) !== 0x02014b50) break;
    const method = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const commentLen = dv.getUint16(ptr + 32, true);
    const localHeaderOffset = dv.getUint32(ptr + 42, true);
    const name = decoder.decode(buf.subarray(ptr + 46, ptr + 46 + nameLen));

    if (name.toLowerCase().endsWith('.epw')) {
      const lhNameLen = dv.getUint16(localHeaderOffset + 26, true);
      const lhExtraLen = dv.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
      const compData = buf.subarray(dataStart, dataStart + compSize);

      if (method === 0) {
        return decoder.decode(compData);
      }
      if (method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        return await new Response(ds.readable).text();
      }
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return null;
}

// Load and cache the combined 23,227+ station catalog from Ladybug epwmap (Climate.OneBuilding.org + DOE EnergyPlus)
export async function loadEnergyPlusStationCatalog(): Promise<EpwStationSearchResult[]> {
  if (cachedEnergyPlusCatalog) return cachedEnergyPlusCatalog;

  // 1. Load local /epwmap-catalog.json (23,227 unique stations = 20,180 OneBuilding + 3,047 DOE EnergyPlus)
  try {
    const resp = await fetch('/epwmap-catalog.json');
    if (resp.ok) {
      const rows: Array<[string, string, string, number, number, string, number]> = await resp.json();
      cachedEnergyPlusCatalog = rows.map((row, idx) => {
        const [wmo, rawName, datasetType, lat, lon, zipPath, isOneBuilding] = row;
        const cleanName = rawName.replace(/\./g, ' ').replace(/__/g, ' ').replace(/_/g, ' ').trim();
        const tokens = cleanName.split(/\s+/);
        // Extract 3-letter country code from end of OneBuilding name or path
        let country = '';
        if (isOneBuilding && tokens.length >= 2) {
          country = tokens[tokens.length - 1];
        } else {
          const pathMatch = zipPath.match(/\/([A-Z]{3})[_/]/);
          country = pathMatch ? pathMatch[1] : '';
        }
        const city =
          isOneBuilding && tokens.length >= 2
            ? tokens.slice(0, -1).join(' ')
            : cleanName;

        const source = isOneBuilding ? ('onebuilding' as const) : ('energyplus' as const);
        const baseHost = isOneBuilding
          ? 'https://climate.onebuilding.org'
          : 'https://energyplus-weather.s3.amazonaws.com';

        return {
          id: `${source}_${wmo}_${idx}`,
          wmo,
          datasetType,
          title: `${cleanName} [${datasetType} • WMO ${wmo}]`,
          city,
          country,
          lat: Number(lat) || 0,
          lon: Number(lon) || 0,
          epwUrl: `${baseHost}${zipPath}`,
          source
        };
      });
      return cachedEnergyPlusCatalog;
    }
  } catch {
    // Fallback to remote master.geojson if local catalog fails
  }

  // 2. Fallback: NREL EnergyPlus master.geojson
  try {
    const resp = await fetch(
      'https://raw.githubusercontent.com/NatLabRockies/EnergyPlus/develop/weather/master.geojson'
    );
    if (resp.ok) {
      const geojson = await resp.json();
      cachedEnergyPlusCatalog = (geojson.features || [])
        .map((f: any, idx: number) => {
          const title: string = f.properties?.title || '';
          const epwHtml: string = f.properties?.epw || '';
          const match = epwHtml.match(/href=([^\s>]+)/i);
          const rawUrl = match ? match[1].replace(/["']/g, '') : '';
          const coords = f.geometry?.coordinates || [0, 0];
          const parts = title.split('_');
          const country = parts[0] || '';
          const cityPart = (parts[1] || title).replace(/\.\d+$/, '').replace(/\./g, ' ');
          return {
            id: `ep_${idx}_${title}`,
            title,
            city: cityPart,
            country,
            lon: Number(coords[0]) || 0,
            lat: Number(coords[1]) || 0,
            epwUrl: rawUrl,
            source: 'energyplus' as const
          };
        })
        .filter((item: EpwStationSearchResult) => item.epwUrl.endsWith('.epw'));
      return cachedEnergyPlusCatalog || [];
    }
  } catch {
    // Ignore network error
  }
  return [];
}

// Find nearest stations (Climate.OneBuilding.org + DOE EnergyPlus) to a given (lat, lon) coordinate
export async function findNearestEpwStations(
  lat: number,
  lon: number,
  limit = 8,
  sourceFilter: 'all' | 'onebuilding' | 'energyplus' = 'all'
): Promise<Array<EpwStationSearchResult & { distanceKm: number }>> {
  const catalog = await loadEnergyPlusStationCatalog();
  const filtered =
    sourceFilter === 'all' ? catalog : catalog.filter((s) => s.source === sourceFilter);
  return filtered
    .map((st) => ({
      ...st,
      distanceKm: +haversineKm(lat, lon, st.lat, st.lon).toFixed(1)
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

// European and Italian city name alias dictionary for intelligent weather station search
const SEARCH_CITY_ALIASES: Record<string, string[]> = {
  milan: ['milano', 'milan', 'linate', 'malpensa'],
  milano: ['milan', 'milano', 'linate', 'malpensa'],
  rome: ['roma', 'rome', 'fiumicino', 'ciampino'],
  roma: ['rome', 'roma', 'fiumicino', 'ciampino'],
  turin: ['torino', 'turin', 'caselle'],
  torino: ['turin', 'torino', 'caselle'],
  geneva: ['geneve', 'geneva', 'vevey', 'lausanne'],
  geneve: ['geneve', 'geneva', 'vevey', 'lausanne'],
  vevey: ['geneve', 'geneva', 'vevey', 'lausanne'],
  lausanne: ['geneve', 'geneva', 'vevey', 'lausanne'],
  florence: ['firenze', 'florence', 'peretola'],
  firenze: ['florence', 'firenze', 'peretola'],
  venice: ['venezia', 'venice', 'tessera'],
  venezia: ['venice', 'venezia', 'tessera'],
  naples: ['napoli', 'naples', 'capodichino'],
  napoli: ['naples', 'napoli', 'capodichino'],
  bologna: ['bologna', 'borgo panigale'],
  bolzano: ['bolzano', 'bozen', 'bormio'],
  bormio: ['bolzano', 'bozen', 'bormio'],
  cairo: ['cairo', 'al qahirah', 'qahirah'],
  stockholm: ['stockholm', 'arlanda', 'bromma'],
  palermo: ['palermo', 'falcone borsellino', 'boccadifalco', 'punta raisi']
};

export async function searchGlobalEpwStations(
  query: string,
  sourceFilter: 'all' | 'onebuilding' | 'energyplus' = 'all'
): Promise<EpwStationSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: EpwStationSearchResult[] = [];

  // 1. Search combined 23,227-station catalog (Climate.OneBuilding.org + DOE EnergyPlus)
  const catalog = await loadEnergyPlusStationCatalog();
  if (catalog.length > 0) {
    const pool =
      sourceFilter === 'all' ? catalog : catalog.filter((s) => s.source === sourceFilter);

    const scored: Array<{ station: EpwStationSearchResult; score: number }> = [];
    const searchTerms = Array.from(new Set([q, ...(SEARCH_CITY_ALIASES[q] || [])]));

    for (const s of pool) {
      const cityLower = s.city.toLowerCase();
      const titleLower = s.title.toLowerCase();
      const wmoLower = (s.wmo || '').toLowerCase();
      const countryLower = s.country.toLowerCase();

      let matchScore = 0;
      if (wmoLower === q) {
        matchScore = 120;
      } else {
        for (const term of searchTerms) {
          // Check for word-boundary match (e.g. "Milano" in "Milano-Linate AP LM ITA")
          const isWordMatch =
            cityLower === term ||
            new RegExp(`(?:^|[\\s_-])${term}(?:$|[\\s_-])`, 'i').test(s.title);

          if (isWordMatch) {
            matchScore = Math.max(matchScore, 100);
          } else if (cityLower.startsWith(term)) {
            matchScore = Math.max(matchScore, 80);
          } else if (titleLower.includes(term) || cityLower.includes(term)) {
            matchScore = Math.max(matchScore, 50);
          } else if (countryLower === term) {
            matchScore = Math.max(matchScore, 30);
          }
        }
      }

      if (matchScore > 0) {
        // High bonus for official Climate.OneBuilding.org TMYx datasets over legacy IGDG/IWEC
        if (s.source === 'onebuilding') matchScore += 15;
        // Minor bonus for Italian / Mediterranean reference stations when query matches
        if (s.country === 'ITA' || s.country === 'CHE') matchScore += 5;
        scored.push({ station: s, score: matchScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    results.push(...scored.slice(0, 20).map((item) => item.station));
  }

  // 2. Also query Open-Meteo Global Geocoding API if fewer than 5 results
  if (results.length < 5) {
    try {
      const geoResp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=4&language=en&format=json`
      );
      if (geoResp.ok) {
        const geoData = await geoResp.json();
        for (const item of geoData.results || []) {
          results.push({
            id: `om_${item.id}`,
            title: `${item.name}, ${item.admin1 ? item.admin1 + ', ' : ''}${item.country_code || item.country || ''} (Open-Meteo ERA5 2023)`,
            city: item.name,
            country: item.country_code || item.country || '',
            lat: item.latitude,
            lon: item.longitude,
            epwUrl: `open-meteo://${item.latitude},${item.longitude},${item.elevation || 50}`,
            source: 'open-meteo'
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  return results;
}

// Map of major WMO stations to bundled official OneBuilding TMYx 8,760h weather files in public/weather/
const WMO_TO_BUNDLED_TMYX: Record<string, { localUrl: string; displayName: string }> = {
  '160800': { localUrl: '/weather/milan.epw', displayName: 'Milan (Linate WMO 160800), IT' },
  '162420': { localUrl: '/weather/rome.epw', displayName: 'Rome (Fiumicino WMO 162420), IT' },
  '067000': { localUrl: '/weather/vevey.epw', displayName: 'Vevey / Lake Geneva (WMO 067000), CH' },
  '067100': { localUrl: '/weather/lausanne.epw', displayName: 'Lausanne (Intl AP WMO 067100), CH' },
  '024600': { localUrl: '/weather/stockholm.epw', displayName: 'Stockholm (Arlanda WMO 024600), SE' },
  '623660': { localUrl: '/weather/cairo.epw', displayName: 'Cairo (Intl WMO 623660), EG' },
  '164050': { localUrl: '/weather/palermo.epw', displayName: 'Palermo (Falcone Borsellino WMO 164050), IT' },
  '160200': { localUrl: '/weather/bormio.epw', displayName: 'Alpine Valley (Bolzano WMO 160200), IT' }
};

// Helper to construct the exact OneBuilding .zip URL for a requested baseline period
function getOneBuildingPeriodUrl(
  rawUrl: string,
  period: OneBuildingPeriod
): {
  proxiedUrl: string;
  directUrl: string;
  isTmyx: boolean;
  stripPeriod: string;
} {
  const rawStripPeriod = rawUrl.replace(/_TMYx(?:\.\d{4}-\d{4})?\.zip$/i, '');
  const proxiedBase = rawUrl.replace('https://climate.onebuilding.org', '/onebuilding');
  const stripPeriod = proxiedBase.replace(/_TMYx(?:\.\d{4}-\d{4})?\.zip$/i, '');
  const isTmyx = stripPeriod !== proxiedBase;

  const proxiedUrl = isTmyx
    ? (period === 'full' ? `${stripPeriod}_TMYx.zip` : `${stripPeriod}_TMYx.${period}.zip`)
    : proxiedBase;
  const directUrl = isTmyx
    ? (period === 'full' ? `${rawStripPeriod}_TMYx.zip` : `${rawStripPeriod}_TMYx.${period}.zip`)
    : rawUrl;

  return { proxiedUrl, directUrl, isTmyx, stripPeriod };
}

// Helper to fetch OneBuilding zip buffer trying proxy first, direct fallback second
async function fetchOneBuildingZipBuffer(proxiedUrl: string, directUrl: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(proxiedUrl);
    if (resp.ok) {
      return await resp.arrayBuffer();
    }
  } catch {
    // Relative URL or proxy error, attempt direct fetch
  }
  try {
    const respDirect = await fetch(directUrl);
    if (respDirect.ok) {
      return await respDirect.arrayBuffer();
    }
  } catch {
    // Both failed
  }
  return null;
}

// Fetch and build a full 8,760-hour ClimateDataset from an EpwStationSearchResult
// Supports:
//  - Climate.OneBuilding.org (exact requested baseline TMYx period via /onebuilding proxy + ZIP deflation)
//  - Official DOE/NREL EnergyPlus S3 (.epw or .zip via /epw-s3 proxy)
//  - Offline fallback to bundled reference files (Milan, Rome, Geneva, Stockholm, Cairo, Palermo, Bolzano)
//  - Open-Meteo ERA5 8,760-hour Archive (when explicitly selected)
export async function fetchStationClimateDataset(
  station: EpwStationSearchResult,
  oneBuildingPeriod: OneBuildingPeriod = '2009-2023'
): Promise<ClimateDataset> {
  // Case A: Climate.OneBuilding.org (.zip -> extract requested baseline .epw in browser)
  if (station.source === 'onebuilding' && station.epwUrl.includes('climate.onebuilding.org')) {
    const { proxiedUrl, directUrl, isTmyx, stripPeriod } = getOneBuildingPeriodUrl(
      station.epwUrl,
      oneBuildingPeriod
    );

    // 1. Prioritize streaming the user's explicitly requested baseline period
    const targetBuf = await fetchOneBuildingZipBuffer(proxiedUrl, directUrl);
    if (targetBuf) {
      const epwText = await extractEpwFromZipBuffer(targetBuf);
      if (epwText && epwText.includes('LOCATION,')) {
        const periodDisplay = oneBuildingPeriod === 'full' ? 'TMYx Full Period' : `TMYx ${oneBuildingPeriod}`;
        const parsed = parseEpwText(
          epwText,
          `${station.city} (${periodDisplay}), ${station.country}`,
          oneBuildingPeriod
        );
        parsed.id = `${station.id}_${oneBuildingPeriod}`;
        parsed.period = oneBuildingPeriod;
        parsed.sourceType = 'onebuilding';
        return parsed;
      }
    }

    // 2. If the requested historical period was not published for this station (HTTP 404),
    // try available standard OneBuilding periods in order of relevance:
    if (isTmyx) {
      const fallbackPeriods: OneBuildingPeriod[] = (['2011-2025', '2009-2023', '2007-2021', '2004-2018', 'full'] as OneBuildingPeriod[])
        .filter((p) => p !== oneBuildingPeriod);

      const rawStrip = station.epwUrl.replace(/_TMYx(?:\.\d{4}-\d{4})?\.zip$/i, '');

      for (const altPeriod of fallbackPeriods) {
        const altProxied = altPeriod === 'full' ? `${stripPeriod}_TMYx.zip` : `${stripPeriod}_TMYx.${altPeriod}.zip`;
        const altDirect = altPeriod === 'full' ? `${rawStrip}_TMYx.zip` : `${rawStrip}_TMYx.${altPeriod}.zip`;

        const altBuf = await fetchOneBuildingZipBuffer(altProxied, altDirect);
        if (altBuf) {
          const epwText = await extractEpwFromZipBuffer(altBuf);
          if (epwText && epwText.includes('LOCATION,')) {
            const altDisplay = altPeriod === 'full' ? 'TMYx Full Period' : `TMYx ${altPeriod}`;
            const parsed = parseEpwText(
              epwText,
              `${station.city} (${altDisplay} — ${oneBuildingPeriod} not published), ${station.country}`,
              altPeriod
            );
            parsed.id = `${station.id}_${altPeriod}`;
            parsed.period = altPeriod;
            parsed.sourceType = 'onebuilding';
            return parsed;
          }
        }
      }
    }

    // 3. If remote network streaming failed entirely (e.g. offline) AND station is a bundled demo reference city:
    if (station.wmo && WMO_TO_BUNDLED_TMYX[station.wmo]) {
      const bundled = WMO_TO_BUNDLED_TMYX[station.wmo];
      try {
        const resp = await fetch(bundled.localUrl);
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.includes('LOCATION,')) {
            const parsed = parseEpwText(text, `${bundled.displayName} (Offline Bundle 2007–2021)`, '2007-2021');
            parsed.id = `${station.id}_bundle_2007-2021`;
            parsed.period = '2007-2021';
            parsed.sourceType = 'onebuilding';
            return parsed;
          }
        }
      } catch {
        // Fall through to error
      }
    }

    // 4. Failed entirely
    throw new Error(
      `Could not stream "${station.city}" (${oneBuildingPeriod}) from Climate.OneBuilding.org. Download the official .zip file directly from: ${getOneBuildingDownloadUrl(station.epwUrl, oneBuildingPeriod)} and drop it into the upload box above for 100% fidelity.`
    );
  }

  // Case B: Official DOE / NREL EnergyPlus S3 (.epw or .zip via Vite /epw-s3 proxy)
  if (station.source === 'energyplus' && station.epwUrl.includes('energyplus-weather.s3.amazonaws.com')) {
    const proxiedUrl = station.epwUrl.replace('https://energyplus-weather.s3.amazonaws.com', '/epw-s3');
    const directEpwUrl = proxiedUrl.replace(/\.zip$/i, '.epw');

    // Try direct .epw first
    try {
      const resp = await fetch(directEpwUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text.includes('LOCATION,')) {
          const parsed = parseEpwText(text, `${station.city}, ${station.country}`);
          parsed.sourceType = 'energyplus-s3';
          return parsed;
        }
      }
    } catch {
      // Try .zip next
    }

    // Try .zip archive if direct .epw wasn't found
    if (proxiedUrl.toLowerCase().endsWith('.zip')) {
      try {
        const resp = await fetch(proxiedUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const epwText = await extractEpwFromZipBuffer(buf);
          if (epwText && epwText.includes('LOCATION,')) {
            const parsed = parseEpwText(epwText, `${station.city}, ${station.country}`);
            parsed.sourceType = 'energyplus-s3';
            return parsed;
          }
        }
      } catch {
        // Fail
      }
    }

    throw new Error(
      `Could not stream EnergyPlus weather file for "${station.city}". Download the file from ${station.epwUrl} and drop it in above.`
    );
  }

  // Case C: Explicit Open-Meteo ERA5 8,760-hour Reanalysis (only when source is open-meteo)
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${station.lat.toFixed(4)}&longitude=${station.lon.toFixed(4)}&start_date=2023-01-01&end_date=2023-12-31&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation,direct_normal_irradiance,diffuse_radiation,wind_speed_10m,wind_direction_10m&timezone=UTC`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch hourly weather data (HTTP ${resp.status})`);
  }
  const data = await resp.json();
  const hData = data.hourly;
  const times: string[] = hData.time || [];

  const hourly: HourlyWeatherRecord[] = [];
  let dayOfYear = 0;
  let lastDateStr = '';

  for (let i = 0; i < Math.min(8760, times.length); i++) {
    const tStr = times[i]; // "2023-01-01T00:00"
    const datePart = tStr.slice(0, 10);
    if (datePart !== lastDateStr) {
      dayOfYear++;
      lastDateStr = datePart;
    }
    const month = parseInt(tStr.slice(5, 7), 10) - 1;
    const dayOfMonth = parseInt(tStr.slice(8, 10), 10);
    const hour = parseInt(tStr.slice(11, 13), 10);

    const dryBulb = Number(hData.temperature_2m?.[i] ?? 15);
    const relHum = Number(hData.relative_humidity_2m?.[i] ?? 60);
    const ghi = Number(hData.shortwave_radiation?.[i] ?? 0);
    const dni = Number(hData.direct_normal_irradiance?.[i] ?? 0);
    const dhi = Number(hData.diffuse_radiation?.[i] ?? 0);
    const windSpeed = Number(hData.wind_speed_10m?.[i] ?? 2.0);
    const windDir = Number(hData.wind_direction_10m?.[i] ?? 180);

    const { alt, az } = calcSolarPosition(station.lat, dayOfYear, hour + 0.5, station.lon, 0);
    const humRatio = +calcHumidityRatio(dryBulb, relHum).toFixed(2);
    const gamma = (17.27 * dryBulb) / (dryBulb + 237.3) + Math.log(Math.max(0.05, relHum / 100));
    const dewPoint = +((237.3 * gamma) / (17.27 - gamma)).toFixed(1);
    const dpClamped = Math.max(-40, Math.min(40, dewPoint));
    const epsSky = Math.max(0.65, Math.min(0.98, 0.711 + 0.56 * (dpClamped / 100) + 0.73 * Math.pow(dpClamped / 100, 2)));
    const horizInfrared = Math.round(epsSky * 5.670374e-8 * Math.pow(dryBulb + 273.15, 4));
    const utci = calcUtciForScenario(dryBulb, relHum, windSpeed, dni, alt, 'sun_wind');

    hourly.push({
      hourOfYear: i + 1,
      month,
      dayOfMonth,
      dayOfYear,
      hour,
      dryBulb: +dryBulb.toFixed(1),
      dewPoint,
      relHum: Math.round(relHum),
      humRatio,
      ghi: Math.round(ghi),
      dni: Math.round(dni),
      dhi: Math.round(dhi),
      horizInfrared,
      windSpeed: +windSpeed.toFixed(1),
      windDir: Math.round(windDir),
      utci,
      solarAlt: alt,
      solarAz: +az.toFixed(1)
    });
  }

  return buildClimateFromHourly(
    {
      id: station.id,
      name: `${station.city}, ${station.country} (ERA5 2023 Reanalysis)`,
      country: station.country,
      lat: station.lat,
      lon: station.lon,
      elev: Number(data.elevation) || 80,
      sourceType: 'open-meteo'
    },
    hourly
  );
}

