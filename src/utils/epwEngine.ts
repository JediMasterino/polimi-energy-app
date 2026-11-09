// ============================================================================
// EPW WEATHER ENGINE, SOLAR GEOMETRY, CBE CLIMA & PSYCHROMETRIC PROCESSOR
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
  relHum: number;     // %
  humRatio: number;   // g_w / kg_da
  ghi: number;        // Global Horizontal Irradiance (Wh/m2)
  dni: number;        // Direct Normal Irradiance (Wh/m2)
  dhi: number;        // Diffuse Horizontal Irradiance (Wh/m2)
  windSpeed: number;  // m/s
  windDir: number;    // deg (0 = N, 90 = E, 180 = S, 270 = W)
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
  country?: string;
  wmo?: string;
  koppen: string;
  koppenDesc: string;
  hdd: number;
  cdd: number;
  lat: number;
  lon: number;
  elev: number;
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

export type OneBuildingPeriod = '2009-2023' | '2007-2021' | '2004-2018' | 'full';

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
export function calcHumidityRatio(tC: number, rhPct: number, pressurePa = 101325): number {
  const pSat = 610.78 * Math.exp((17.27 * tC) / (tC + 237.3));
  const pA = Math.min(pressurePa * 0.95, (Math.max(1, Math.min(100, rhPct)) / 100) * pSat);
  return (622 * pA) / (pressurePa - pA);
}

// Compute Solar Position (Altitude & Azimuth in degrees; Azimuth: 0=N, 90=E, 180=S, 270=W)
export function calcSolarPosition(latDeg: number, dayOfYear: number, hour: number): { alt: number; az: number } {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const phi = latDeg * deg2rad;

  // Cooper's equation for solar declination
  const decl = 23.45 * Math.sin(deg2rad * ((360 / 365) * (284 + dayOfYear))) * deg2rad;
  const omega = (hour - 12.0) * 15 * deg2rad;

  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(omega);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altDeg = altRad * rad2deg;

  if (altDeg <= 0) {
    return { alt: 0, az: 180 };
  }

  const cosAz =
    (Math.sin(decl) * Math.cos(phi) - Math.cos(decl) * Math.sin(phi) * Math.cos(omega)) /
    Math.max(1e-5, Math.cos(altRad));
  let azDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) * rad2deg;
  if (omega > 0) {
    azDeg = 360 - azDeg;
  }
  return { alt: altDeg, az: azDeg };
}

// Approximate Universal Thermal Climate Index (UTCI °C) for CBE Clima analysis
export function calcApproxUtci(tAir: number, rhPct: number, windSpeed: number, ghi: number): number {
  const v = Math.max(0.5, Math.min(17, windSpeed));
  // Mean radiant temperature increment from shortwave solar radiation
  const deltaTmrt = (ghi / 1000) * 18.5;
  // Wind chill / convective cooling offset & humidity offset
  const windOffset = -1.85 * Math.pow(v, 0.55) * Math.max(0, (28 - tAir) / 18);
  const humidOffset = tAir > 22 ? ((rhPct - 50) / 50) * 2.6 * ((tAir - 22) / 10) : 0;
  return +(tAir + 0.32 * deltaTmrt + windOffset + humidOffset).toFixed(1);
}

// Automatically classify Köppen-Geiger climate code from monthly temperature array
export function classifyKoppen(monthlyTemp: number[], lat: number): { code: string; desc: string } {
  const tMax = Math.max(...monthlyTemp);
  const tMin = Math.min(...monthlyTemp);
  const tMean = monthlyTemp.reduce((a, b) => a + b, 0) / 12;

  if (tMax < 10) return { code: 'ET', desc: 'Alpine / Polar Tundra' };
  if (tMean > 21 && tMin > 12) return { code: 'BWh', desc: 'Hot Arid / Subtropical Desert' };
  if (tMin < -1.5) {
    return tMax > 22
      ? { code: 'Dfa', desc: 'Hot-Summer Humid Continental' }
      : { code: 'Dfb', desc: 'Warm-Summer Humid Continental' };
  }
  if (tMax >= 22) {
    return Math.abs(lat) < 43.5
      ? { code: 'Csa', desc: 'Mediterranean Hot Summer' }
      : { code: 'Cfa', desc: 'Humid Subtropical' };
  }
  return { code: 'Cfb', desc: 'Temperate Oceanic / Continental Foothills' };
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
    country?: string;
    wmo?: string;
    lat: number;
    lon: number;
    elev: number;
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

  let hddSum = 0;
  let cddSum = 0;
  let natVentHours = 0;
  let utciNoStressHours = 0;

  // Wind rose accumulators (8 sectors)
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

    // Degree-hours / 24 -> Degree-days (base 18°C)
    if (rec.dryBulb < 18) hddSum += (18 - rec.dryBulb) / 24;
    if (rec.dryBulb > 18) cddSum += (rec.dryBulb - 18) / 24;

    // Natural ventilation suitability (18°C <= T_out <= 26°C and RH < 75%)
    if (rec.dryBulb >= 18 && rec.dryBulb <= 26 && rec.relHum <= 75) {
      natVentHours++;
    }
    // UTCI No Thermal Stress (9°C <= UTCI <= 26°C)
    if (rec.utci >= 9 && rec.utci <= 26) {
      utciNoStressHours++;
    }

    // Directional solar accumulation (Wh -> kWh)
    solarHoriz[m] += rec.ghi / 1000;
    solarNorth[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 0) / 1000;
    solarEast[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 90) / 1000;
    solarSouth[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 180) / 1000;
    solarWest[m] += projectFacadeIrradiance(rec.ghi, rec.dni, rec.dhi, rec.solarAlt, rec.solarAz, 270) / 1000;

    // Wind rose sector index (0..7)
    const secIdx = Math.floor(((rec.windDir + 22.5) % 360) / 45) % 8;
    const sec = sectorCounts[secIdx];
    sec.total++;
    sec.tempSum += rec.dryBulb;
    if (rec.windSpeed < 2) sec.calm++;
    else if (rec.windSpeed < 4) sec.low++;
    else if (rec.windSpeed < 6) sec.med++;
    else sec.high++;
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
  const windRose: WindRoseSector[] = COMPASS_8.map((c, idx) => {
    const s = sectorCounts[idx];
    return {
      dir: c.dir,
      deg: c.deg,
      calmPct: +((s.calm / totalHours) * 100).toFixed(1),
      lowPct: +((s.low / totalHours) * 100).toFixed(1),
      medPct: +((s.med / totalHours) * 100).toFixed(1),
      highPct: +((s.high / totalHours) * 100).toFixed(1),
      totalPct: +((s.total / totalHours) * 100).toFixed(1),
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
    country: meta.country,
    wmo: meta.wmo,
    koppen: kop.code,
    koppenDesc: kop.desc,
    hdd: hddVal,
    cdd: cddVal,
    lat: +meta.lat.toFixed(2),
    lon: +meta.lon.toFixed(2),
    elev: Math.round(meta.elev),
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

// Deterministic synthesis of 8,760 hourly records from monthly preset profiles
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
        const { alt, az } = calcSolarPosition(preset.lat, dayOfYear, h + 0.5);

        // Diurnal temperature cycle (min around 05:00, max around 15:00)
        const diurnalWave = -Math.cos(((h - 4) / 24) * 2 * Math.PI);
        const dryBulb = +(meanT + dayWeatherWave + diurnalAmp * 0.5 * diurnalWave).toFixed(1);

        // Relative humidity inverse to diurnal temperature
        const baseRh = preset.koppen === 'BWh' ? 38 : preset.koppen === 'Csa' ? 62 : 70;
        const relHum = Math.round(Math.max(18, Math.min(96, baseRh - diurnalWave * 16 + (pseudoRand(hourOfYear) - 0.5) * 8)));
        const humRatio = +calcHumidityRatio(dryBulb, relHum).toFixed(2);

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

        // Prevailing wind speed & direction
        const windSpeed = +(1.2 + 2.8 * pseudoRand(hourOfYear * 3) + (alt > 15 ? 1.1 : 0)).toFixed(1);
        const prevailingAngle = preset.lat > 45 ? 240 : 95;
        const windDir = Math.round((prevailingAngle + (pseudoRand(hourOfYear * 7) - 0.5) * 160 + 360) % 360);
        const utci = calcApproxUtci(dryBulb, relHum, windSpeed, ghi);

        hourly.push({
          hourOfYear,
          month: m,
          dayOfMonth: d,
          dayOfYear,
          hour: h,
          dryBulb,
          relHum,
          humRatio,
          ghi,
          dni,
          dhi,
          windSpeed,
          windDir,
          utci,
          solarAlt: +alt.toFixed(1),
          solarAz: +az.toFixed(1)
        });
      }
    }
  }

  const built = buildClimateFromHourly(
    {
      id: preset.id,
      name: preset.name,
      lat: preset.lat,
      lon: preset.lon ?? 10.79,
      elev: preset.elev ?? 65,
      sourceType: 'preset',
      overrideFacetSolar: {
        solarHoriz: preset.solarHoriz,
        solarSouth: preset.solarSouth,
        solarEast: preset.solarEast,
        solarWest: preset.solarWest,
        solarNorth: preset.solarNorth
      }
    },
    hourly
  );

  // Preserve exact preset labels & HDD/CDD for academic consistency
  built.koppen = preset.koppen;
  built.koppenDesc = preset.koppenDesc;
  built.hdd = preset.hdd;
  built.cdd = preset.cdd;
  built.runningMeanTemp = preset.runningMeanTemp;
  built.monthlyTemp = preset.monthlyTemp;
  return built;
}

// Parse standard EnergyPlus .epw text file
export function parseEpwText(epwContent: string, fallbackName = 'Custom EPW Station'): ClimateDataset {
  const lines = epwContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 100) {
    throw new Error('Invalid EPW file: fewer than 100 lines found.');
  }

  // Header Line 1: LOCATION,City,State,Country,Source,WMO,Lat,Lon,Tz,Elev
  const locLine = lines.find((l) => l.toUpperCase().startsWith('LOCATION,')) || lines[0];
  const locParts = locLine.split(',');
  const city = (locParts[1] || fallbackName).trim();
  const country = (locParts[3] || '').trim();
  const wmo = (locParts[5] || '').trim();
  const lat = parseFloat(locParts[6]) || 45.46;
  const lon = parseFloat(locParts[7]) || 9.19;
  const elev = parseFloat(locParts[9]) || 100;

  // Find first data row (starts with 4-digit year or numeric month)
  let startIdx = 8;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const firstToken = lines[i].split(',')[0].trim();
    if (/^\d{4}$/.test(firstToken)) {
      startIdx = i;
      break;
    }
  }

  const hourly: HourlyWeatherRecord[] = [];
  let dayOfYear = 0;
  let lastDayKey = '';

  for (let i = startIdx; i < lines.length && hourly.length < 8760; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 22) continue;

    const month = Math.max(0, Math.min(11, (parseInt(cols[1], 10) || 1) - 1));
    const dayOfMonth = parseInt(cols[2], 10) || 1;
    const hour = Math.max(0, Math.min(23, (parseInt(cols[3], 10) || 1) - 1));

    const dayKey = `${month}-${dayOfMonth}`;
    if (dayKey !== lastDayKey) {
      dayOfYear++;
      lastDayKey = dayKey;
    }

    const rawTemp = parseFloat(cols[6]);
    const dryBulb = !isNaN(rawTemp) && rawTemp < 70 && rawTemp > -70 ? rawTemp : 15;
    const rawRh = parseFloat(cols[8]);
    const relHum = !isNaN(rawRh) && rawRh <= 110 && rawRh >= 0 ? Math.min(100, rawRh) : 55;

    const rawGhi = parseFloat(cols[13]);
    const ghi = !isNaN(rawGhi) && rawGhi < 2000 && rawGhi >= 0 ? rawGhi : 0;
    const rawDni = parseFloat(cols[14]);
    const dni = !isNaN(rawDni) && rawDni < 2000 && rawDni >= 0 ? rawDni : 0;
    const rawDhi = parseFloat(cols[15]);
    const dhi = !isNaN(rawDhi) && rawDhi < 2000 && rawDhi >= 0 ? rawDhi : 0;

    const rawWindDir = parseFloat(cols[20]);
    const windDir = !isNaN(rawWindDir) && rawWindDir <= 360 && rawWindDir >= 0 ? rawWindDir : 180;
    const rawWindSpd = parseFloat(cols[21]);
    const windSpeed = !isNaN(rawWindSpd) && rawWindSpd < 60 && rawWindSpd >= 0 ? rawWindSpd : 2.0;

    const { alt, az } = calcSolarPosition(lat, dayOfYear, hour + 0.5);
    const humRatio = +calcHumidityRatio(dryBulb, relHum).toFixed(2);
    const utci = calcApproxUtci(dryBulb, relHum, windSpeed, ghi);

    hourly.push({
      hourOfYear: hourly.length + 1,
      month,
      dayOfMonth,
      dayOfYear,
      hour,
      dryBulb: +dryBulb.toFixed(1),
      relHum: Math.round(relHum),
      humRatio,
      ghi: Math.round(ghi),
      dni: Math.round(dni),
      dhi: Math.round(dhi),
      windSpeed: +windSpeed.toFixed(1),
      windDir: Math.round(windDir),
      utci,
      solarAlt: +alt.toFixed(1),
      solarAz: +az.toFixed(1)
    });
  }

  const displayName = country ? `${city}, ${country}` : city;
  return buildClimateFromHourly(
    {
      id: `epw_${city.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
      name: displayName,
      country,
      wmo,
      lat,
      lon,
      elev,
      sourceType: 'epw-upload'
    },
    hourly
  );
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

    const exactOrPrefix: EpwStationSearchResult[] = [];
    const substringMatches: EpwStationSearchResult[] = [];

    for (const s of pool) {
      const cityLower = s.city.toLowerCase();
      const titleLower = s.title.toLowerCase();
      const wmoLower = (s.wmo || '').toLowerCase();
      if (cityLower.startsWith(q) || wmoLower === q) {
        exactOrPrefix.push(s);
        if (exactOrPrefix.length >= 16) break;
      } else if (
        substringMatches.length < 16 &&
        (titleLower.includes(q) || cityLower.includes(q) || s.country.toLowerCase() === q)
      ) {
        substringMatches.push(s);
      }
    }

    results.push(...exactOrPrefix, ...substringMatches.slice(0, Math.max(0, 20 - exactOrPrefix.length)));
  }

  // 2. Also query Open-Meteo Global Geocoding API for any town/city worldwide
  try {
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=4&language=en&format=json`
    );
    if (geoResp.ok) {
      const geoData = await geoResp.json();
      for (const item of geoData.results || []) {
        results.push({
          id: `om_${item.id}`,
          title: `${item.name}, ${item.admin1 ? item.admin1 + ', ' : ''}${item.country_code || item.country || ''} (ERA5 TMY)`,
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

  return results;
}

// Helper to build candidate OneBuilding .zip URLs for a chosen TMYx period with automatic fallback
function buildOneBuildingCandidateUrls(rawUrl: string, period: OneBuildingPeriod): string[] {
  const proxiedBase = rawUrl.replace('https://climate.onebuilding.org', '/onebuilding');
  const stripPeriod = proxiedBase.replace(/_TMYx(?:\.\d{4}-\d{4})?\.zip$/i, '');
  if (stripPeriod === proxiedBase) {
    return [proxiedBase];
  }
  const periodUrl =
    period === 'full' ? `${stripPeriod}_TMYx.zip` : `${stripPeriod}_TMYx.${period}.zip`;
  const candidates = [
    periodUrl,
    `${stripPeriod}_TMYx.2009-2023.zip`,
    `${stripPeriod}_TMYx.2007-2021.zip`,
    proxiedBase,
    `${stripPeriod}_TMYx.zip`
  ];
  return Array.from(new Set(candidates));
}

// Fetch and build a full 8,760-hour ClimateDataset from an EpwStationSearchResult
// Supports:
//  - Climate.OneBuilding.org (.zip containing .epw via /onebuilding proxy + native ZIP deflate extractor)
//  - Official DOE/NREL EnergyPlus S3 (.epw or .zip via /epw-s3 proxy)
//  - Open-Meteo ERA5 8,760-hour Archive fallback
export async function fetchStationClimateDataset(
  station: EpwStationSearchResult,
  oneBuildingPeriod: OneBuildingPeriod = '2009-2023'
): Promise<ClimateDataset> {
  // Case A: Climate.OneBuilding.org (.zip -> extract .epw in browser)
  if (station.source === 'onebuilding' && station.epwUrl.includes('climate.onebuilding.org')) {
    const candidateUrls = buildOneBuildingCandidateUrls(station.epwUrl, oneBuildingPeriod);
    for (const url of candidateUrls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const epwText = await extractEpwFromZipBuffer(buf);
          if (epwText && epwText.includes('LOCATION,')) {
            const periodTag = url.match(/(\d{4}-\d{4})/)?.[1] || 'TMYx';
            const parsed = parseEpwText(epwText, `${station.city} (${periodTag}), ${station.country}`);
            parsed.sourceType = 'onebuilding';
            return parsed;
          }
        }
      } catch {
        // Try next candidate URL
      }
    }
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
        // Fall through to Open-Meteo ERA5 hourly fetch
      }
    }
  }

  // Case C: Fetch full 8,760-hour ERA5 Reanalysis Year from Open-Meteo Archive API (CORS-enabled globally)
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

    const { alt, az } = calcSolarPosition(station.lat, dayOfYear, hour + 0.5);
    const humRatio = +calcHumidityRatio(dryBulb, relHum).toFixed(2);
    const utci = calcApproxUtci(dryBulb, relHum, windSpeed, ghi);

    hourly.push({
      hourOfYear: i + 1,
      month,
      dayOfMonth,
      dayOfYear,
      hour,
      dryBulb: +dryBulb.toFixed(1),
      relHum: Math.round(relHum),
      humRatio,
      ghi: Math.round(ghi),
      dni: Math.round(dni),
      dhi: Math.round(dhi),
      windSpeed: +windSpeed.toFixed(1),
      windDir: Math.round(windDir),
      utci,
      solarAlt: +alt.toFixed(1),
      solarAz: +az.toFixed(1)
    });
  }

  return buildClimateFromHourly(
    {
      id: station.id,
      name: `${station.city}, ${station.country}`,
      country: station.country,
      lat: station.lat,
      lon: station.lon,
      elev: Number(data.elevation) || 80,
      sourceType: 'open-meteo'
    },
    hourly
  );
}

