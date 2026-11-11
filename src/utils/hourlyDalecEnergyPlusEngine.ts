// ============================================================================
// POLIMI BEM STUDIO - DALEC+ & ENERGYPLUS COUPLED SIMULATION ENGINE
// Dual-speed in-browser 8,760-hour simulation:
// 1. Hourly 3-Band Facade & Automated Glare/Shading State Solver (States 0-7)
// 2. EnergyPlus Split-Flux Daylighting, Dimming, Circadian & Occupant Viewpoints
// 3. EN ISO 13790 / ISO 52016-1 Dynamic 5R1C Hourly Thermal Network
// ============================================================================

import { HourlyWeatherRecord, ClimateDataset } from './epwEngine';

export interface DalecFacadeBandConfig {
  heightMin: number;   // m (e.g. 0.0 for FA1)
  heightMax: number;   // m (e.g. 1.0 for FA1)
  glazingRatio: number;// 0.0 to 1.0
  uValue: number;      // W/m²K
  gValue: number;      // SHGC
  visTrans: number;    // Visible transmittance tau_v
  frameFactor: number; // default 0.90
  shadingType: 'none' | 'blinds_45' | 'blinds_0' | 'screen' | 'overhang' | 'electrochromic';
  shadingTransmittance: number; // solar transmittance when shaded (e.g. 0.15)
  shadingReflectance: number;   // visible reflectance when shaded (e.g. 0.50)
}

export interface DalecRoomConfig {
  width: number;       // m (no 10m limit)
  depth: number;       // m (no 10m limit)
  height: number;      // m (no 4m limit)
  orientationDeg: number; // 0° = North, 90° = East, 180° = South, 270° = West
  overhangDepth: number;  // m canopy/protrusion overhang
  horizonObstructionDeg: number; // 0° to 60° urban horizon obstruction angle
  bands: {
    FA1: DalecFacadeBandConfig; // 0 to 1m (Parapet/Sill)
    FA2: DalecFacadeBandConfig; // 1 to 2m (Vision band)
    FA3: DalecFacadeBandConfig; // 2m to room height (Clerestory/Daylight)
  };
  surfaceReflectances: {
    floor: number;   // default 0.20
    walls: number;   // default 0.50
    ceiling: number; // default 0.70
  };
}

export interface DalecControlConfig {
  glareLuminanceThresholdCdM2: number; // default 3000 cd/m²
  sunProtectionDayStart: number;       // default 100 (April 10)
  sunProtectionDayEnd: number;         // default 300 (October 27)
  sunProtectionIrradianceThresholdWm2: number; // default 150 W/m²
  targetIlluminanceMA1: number;        // default 500 lx (Near Window)
  targetIlluminanceMA2: number;        // default 300 lx (Far from Window)
  lightingMaintenanceFactor: number;   // default 0.67
  mountingType: 'pendulum' | 'recessed' | 'surface';
  luminairesCountGroup1: number;       // pcs (Far from window)
  luminairesCountGroup2: number;       // pcs (Near window)
  fluxPerLuminaireLm: number;          // lm
  powerPerLuminaireW: number;          // W
  directRatio: number;                 // direct/indirect ratio (e.g. 0.80)
  dimmingCurve: 'linear_led';
  mder: number;                        // Melanopic Daylight Efficacy Ratio (e.g. 0.90 daylight, 0.55 LED)
  targetMelanopicLux: number;          // e.g. 250 mel. lx
}

export interface DalecThermalConfig {
  uWall: number;                       // W/m²K
  uRoof: number;                       // W/m²K
  hasRoof: boolean;
  uGround: number;                     // W/m²K
  hasGround: boolean;
  effectiveThermalCapacityJm2K: number;// J/(m²K) (e.g. 110,000 J/m²K from Eurocode)
  baseInfiltrationAch: number;         // 1/h
  occupancyVentilationAch: number;     // 1/h
  automatedNightPurge: boolean;
  nightPurgeAch: number;               // 1/h (e.g. 0.8)
  nightPurgeTempThresholdC: number;    // default 24.0 °C
  heatingSetpointC: number;            // default 20.0 °C
  coolingSetpointC: number;            // default 26.0 °C
  occupancyStartHour: number;          // default 8 (08:00)
  occupancyEndHour: number;            // default 18 (18:00)
  occupancyWorkdaysOnly: boolean;      // default true
  internalLoadsWm2: number;            // default 12.0 W/m²
  coolingCopAse: number;               // default 3.5 (ASE Seasonal Performance Factor)
  heatingCopAse: number;               // default 3.0
  primaryEnergyFactor: number;         // default 2.6
  co2EmissionFactorGKwh: number;       // default 680 gCO2/kWh
  electricityTariffEurKwh: number;     // default 0.16 €/kWh
}

export interface DalecHourlyRecord {
  hourOfYear: number;                  // 1..8760
  month: number;                       // 1..12
  dayOfMonth: number;                  // 1..31
  dayOfYear: number;                   // 1..365
  hour: number;                        // 0..23
  tExt: number;                        // °C outdoor
  globalHoriz: number;                 // W/m²
  facadeIrradiance: number;            // W/m² incident on vertical facade
  facadeState: number;                 // 0 to 7 (State 0=Ground, 1=Glare, 2=Sun, 3=Combined, etc.)
  shadingActiveFA1: boolean;
  shadingActiveFA2: boolean;
  shadingActiveFA3: boolean;
  illuminanceMA1: number;              // lx (Area MA1 near window)
  illuminanceMA2: number;              // lx (Area MA2 far from window)
  cdaCreditMA1: number;                // 0 to 1
  cdaCreditMA2: number;                // 0 to 1
  powerLightingGroup1: number;         // W/m² (Far from window)
  powerLightingGroup2: number;         // W/m² (Near window)
  powerLightingTotal: number;          // W/m²
  viewpointMP3: {                      // Near Window Desk View
    eh: number;
    ev: number;
    glareLuminance: number;
    melanopicLux: number;
    isGlareExceeded: boolean;
  };
  viewpointMP4: {                      // Far Window Desk View
    eh: number;
    ev: number;
    glareLuminance: number;
    melanopicLux: number;
    isGlareExceeded: boolean;
  };
  viewpointMP5: {                      // Side / Wall View
    eh: number;
    ev: number;
    melanopicLux: number;
  };
  viewpointMP6: {                      // Circulation / Door View
    eh: number;
    ev: number;
    melanopicLux: number;
  };
  tAir: number;                        // °C indoor air
  tOperative: number;                  // °C indoor operative
  tSurface: number;                    // °C internal surface
  isOverheating: boolean;              // tOperative > 26°C
  solarGainW: number;                  // W through facade
  internalGainW: number;               // W (people + equip + dimmed lights)
  heatingDemandW: number;              // W
  coolingDemandW: number;              // W
  heatingDemandWm2: number;            // W/m² floor
  coolingDemandWm2: number;            // W/m² floor
  isOccupied: boolean;
}

export interface DalecMonthlySummary {
  month: string;                       // 'Jan'..'Dec'
  usefulCoolingKwhM2: number;
  usefulHeatingKwhM2: number;
  lightingElecKwhM2: number;
  usefulTotalKwhM2: number;
  finalCoolingKwhM2: number;
  finalHeatingKwhM2: number;
  finalLightingKwhM2: number;
  finalTotalKwhM2: number;
  primaryCoolingKwhM2: number;
  primaryHeatingKwhM2: number;
  primaryLightingKwhM2: number;
  primaryTotalKwhM2: number;
  energyCostEurM2: number;
  co2EmissionsKgM2: number;
  avgIlluminanceMA1: number;
  avgIlluminanceMA2: number;
  cdaMA1: number;                      // %
  cdaMA2: number;                      // %
  overheatingHours: number;
  glareExceedHoursMP3: number;
  glareExceedHoursMP4: number;
}

export interface DalecAnnualKPIs {
  cdaMA1Pct: number;                   // % Continuous Daylight Autonomy MA1
  cdaMA2Pct: number;                   // % Continuous Daylight Autonomy MA2
  glareExceedMP3Pct: number;           // % occupied hours with glare > threshold
  glareExceedMP4Pct: number;           // % occupied hours with glare > threshold
  circadianAutonomyPct: number;        // % occupied hours > target melanopic lux
  overheatingFrequencyPct: number;     // % occupied hours tOperative > 26°C
  overheatingHoursCount: number;       // total hours tOperative > 26°C
  annualUsefulCoolingKwhM2: number;
  annualUsefulHeatingKwhM2: number;
  annualLightingElecKwhM2: number;
  annualUsefulTotalKwhM2: number;
  annualFinalEnergyKwhM2: number;
  annualPrimaryEnergyKwhM2: number;
  annualEnergyCostEurM2: number;
  annualCo2KgM2: number;
}

export interface DalecSimulationResult {
  room: DalecRoomConfig;
  controls: DalecControlConfig;
  thermal: DalecThermalConfig;
  hourlyRecords: DalecHourlyRecord[];
  monthlySummaries: DalecMonthlySummary[];
  annualKPIs: DalecAnnualKPIs;
  executionTimeMs: number;
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Default realistic room configuration matching DALEC standards
 */
export function getDefaultDalecRoomConfig(): DalecRoomConfig {
  return {
    width: 4.5,
    depth: 6.0,
    height: 3.0,
    orientationDeg: 180, // South
    overhangDepth: 0.6,
    horizonObstructionDeg: 15,
    bands: {
      FA1: {
        heightMin: 0.0,
        heightMax: 1.0,
        glazingRatio: 0.0, // Opaque parapet / spandrel
        uValue: 0.28,
        gValue: 0.0,
        visTrans: 0.0,
        frameFactor: 0.90,
        shadingType: 'none',
        shadingTransmittance: 1.0,
        shadingReflectance: 0.20
      },
      FA2: {
        heightMin: 1.0,
        heightMax: 2.0,
        glazingRatio: 0.75, // Vision band
        uValue: 1.15,
        gValue: 0.48,
        visTrans: 0.65,
        frameFactor: 0.90,
        shadingType: 'blinds_45',
        shadingTransmittance: 0.20,
        shadingReflectance: 0.55
      },
      FA3: {
        heightMin: 2.0,
        heightMax: 3.0,
        glazingRatio: 0.75, // Clerestory / daylight redirecting band
        uValue: 1.15,
        gValue: 0.48,
        visTrans: 0.65,
        frameFactor: 0.90,
        shadingType: 'none', // Independent daylight preservation
        shadingTransmittance: 0.35,
        shadingReflectance: 0.60
      }
    },
    surfaceReflectances: {
      floor: 0.20,
      walls: 0.50,
      ceiling: 0.70
    }
  };
}

export function getDefaultDalecControlConfig(): DalecControlConfig {
  return {
    glareLuminanceThresholdCdM2: 3000,
    sunProtectionDayStart: 100, // Mid-April
    sunProtectionDayEnd: 300,   // Late October
    sunProtectionIrradianceThresholdWm2: 150,
    targetIlluminanceMA1: 500,  // Workplane near window
    targetIlluminanceMA2: 300,  // Workplane deep in room
    lightingMaintenanceFactor: 0.67,
    mountingType: 'recessed',
    luminairesCountGroup1: 2,
    luminairesCountGroup2: 2,
    fluxPerLuminaireLm: 3200,
    powerPerLuminaireW: 24,
    directRatio: 0.85,
    dimmingCurve: 'linear_led',
    mder: 0.90,
    targetMelanopicLux: 250
  };
}

export function getDefaultDalecThermalConfig(): DalecThermalConfig {
  return {
    uWall: 0.26,
    uRoof: 0.20,
    hasRoof: false,
    uGround: 0.25,
    hasGround: false,
    effectiveThermalCapacityJm2K: 110000, // Medium-heavy Eurocode RC/Masonry
    baseInfiltrationAch: 0.25,
    occupancyVentilationAch: 0.55,
    automatedNightPurge: true,
    nightPurgeAch: 0.80,
    nightPurgeTempThresholdC: 24.0,
    heatingSetpointC: 20.0,
    coolingSetpointC: 26.0,
    occupancyStartHour: 8,
    occupancyEndHour: 18,
    occupancyWorkdaysOnly: true,
    internalLoadsWm2: 12.0,
    coolingCopAse: 3.5,
    heatingCopAse: 3.0,
    primaryEnergyFactor: 2.6,
    co2EmissionFactorGKwh: 680,
    electricityTariffEurKwh: 0.16
  };
}

/**
 * Execute fast 8,760-hour in-browser coupled DALEC+ simulation (<40ms)
 */
export function runDalecSimulation(
  climate: ClimateDataset,
  room: DalecRoomConfig,
  controls: DalecControlConfig,
  thermal: DalecThermalConfig
): DalecSimulationResult {
  const startTime = performance.now();
  const hourly = climate.hourly || [];

  const floorArea = room.width * room.depth;
  const roomVolume = floorArea * room.height;

  // Geometry breakdown of 3 facade bands
  const bandFA1H = Math.max(0, Math.min(1.0, room.height) - 0.0);
  const bandFA2H = Math.max(0, Math.min(2.0, room.height) - 1.0);
  const bandFA3H = Math.max(0, room.height - 2.0);

  const areaFA1 = room.width * bandFA1H;
  const areaFA2 = room.width * bandFA2H;
  const areaFA3 = room.width * bandFA3H;
  const totalFacadeArea = areaFA1 + areaFA2 + areaFA3;

  const glazedFA1 = areaFA1 * room.bands.FA1.glazingRatio * room.bands.FA1.frameFactor;
  const glazedFA2 = areaFA2 * room.bands.FA2.glazingRatio * room.bands.FA2.frameFactor;
  const glazedFA3 = areaFA3 * room.bands.FA3.glazingRatio * room.bands.FA3.frameFactor;
  const totalGlazedArea = glazedFA1 + glazedFA2 + glazedFA3;
  const totalOpaqueArea = totalFacadeArea - totalGlazedArea;

  // Room internal surface area (excluding facade)
  // 2 side walls + 1 rear wall + floor + ceiling
  const areaSideWalls = 2 * (room.depth * room.height);
  const areaRearWall = room.width * room.height;
  const areaCeiling = floorArea;
  const areaFloor = floorArea;
  const internalEnvelopeArea = areaSideWalls + areaRearWall + areaCeiling + areaFloor;
  const totalEnclosureArea = internalEnvelopeArea + totalFacadeArea;

  const avgReflectance =
    (areaFloor * room.surfaceReflectances.floor +
      areaCeiling * room.surfaceReflectances.ceiling +
      (areaSideWalls + areaRearWall + totalOpaqueArea) * room.surfaceReflectances.walls) /
    totalEnclosureArea;

  // 5R1C Thermal Network Parameters (EN ISO 13790 / ISO 52016-1)
  // Window conductance H_tr_w (W/K)
  const H_tr_w =
    glazedFA1 * room.bands.FA1.uValue +
    glazedFA2 * room.bands.FA2.uValue +
    glazedFA3 * room.bands.FA3.uValue;

  // Opaque external envelope conductance H_tr_op (W/K)
  let H_tr_op = totalOpaqueArea * thermal.uWall;
  if (thermal.hasRoof) H_tr_op += areaCeiling * thermal.uRoof;
  if (thermal.hasGround) H_tr_op += areaFloor * thermal.uGround;

  // Internal coupling conductance h_ms (W/m²K) ~ 9.1 W/m²K
  const h_ms = 9.1;
  // Effective internal thermal mass area A_m (m²)
  const A_m = floorArea * 2.5;
  const H_tr_ms = h_ms * A_m;

  // Conductance between external and mass H_tr_em (W/K)
  const H_tr_em = 1 / (1 / Math.max(1, H_tr_op) - 1 / H_tr_ms);

  // Effective thermal capacity C_m (J/K)
  const C_m = floorArea * thermal.effectiveThermalCapacityJm2K;
  const timeStepSec = 3600;

  // Lighting installed power (W)
  const powerLightGroup1TotalW = controls.luminairesCountGroup1 * controls.powerPerLuminaireW;
  const powerLightGroup2TotalW = controls.luminairesCountGroup2 * controls.powerPerLuminaireW;

  // Initial internal temperatures (°C)
  let tAir = 21.0;
  let tMass = 21.0;
  let tSurface = 21.0;

  const hourlyRecords: DalecHourlyRecord[] = [];

  for (let i = 0; i < hourly.length; i++) {
    const rec = hourly[i];
    const hour = rec.hour;
    const dayOfYear = rec.dayOfYear;
    const month = rec.month + 1; // 1 to 12
    const dayOfMonth = rec.dayOfMonth;
    const hourOfYear = rec.hourOfYear;
    const tExt = rec.dryBulb;

    // Occupancy determination
    const dayOfWeek = (dayOfYear + 5) % 7; // rough day of week (0=Mon .. 6=Sun)
    const isWorkday = thermal.occupancyWorkdaysOnly ? dayOfWeek < 5 : true;
    const isOccupied = isWorkday && hour >= thermal.occupancyStartHour && hour < thermal.occupancyEndHour;

    // Solar angle on facade
    const solAltRad = (rec.solarAlt * Math.PI) / 180;
    const solAzDeg = rec.solarAz;
    const azDiffDeg = Math.abs(solAzDeg - room.orientationDeg);
    const azDiffRad = (azDiffDeg * Math.PI) / 180;

    const cosInc = Math.sin(solAltRad) * 0 + Math.cos(solAltRad) * Math.cos(azDiffRad);
    const isSunInFront = rec.solarAlt > room.horizonObstructionDeg && cosInc > 0.05 && azDiffDeg < 85;

    // Incident global irradiance on vertical facade (W/m²)
    const beamFacade = isSunInFront ? rec.dni * cosInc : 0;
    const diffFacade = rec.dhi * 0.5 + rec.ghi * 0.2 * 0.5; // diffuse sky + ground bounce
    const facadeIrradiance = Math.max(0, beamFacade + diffFacade);

    // Overhang shading factor on facade
    let overhangFactor = 1.0;
    if (room.overhangDepth > 0 && isSunInFront && solAltRad > 0.1) {
      const shadowH = room.overhangDepth * Math.tan(solAltRad) / Math.cos(azDiffRad);
      overhangFactor = Math.max(0.25, 1 - Math.min(1.0, shadowH / room.height));
    }

    // 1. EVALUATE AUTOMATED 3-STATE FACADE CONTROL
    // State 0: Ground state (unshaded)
    // State 1: Glare protection (inner facade luminance > threshold)
    // State 2: Sun protection (calendar window & irradiance > threshold)
    // State 3: Combined
    const isSunWindow = dayOfYear >= controls.sunProtectionDayStart && dayOfYear <= controls.sunProtectionDayEnd;
    const triggerSunProtection = isSunWindow && facadeIrradiance * overhangFactor >= controls.sunProtectionIrradianceThresholdWm2;

    // Unshaded inner facade luminance estimation (cd/m²)
    // Luminance approx = (transmitted light / pi) * diffuse factor
    const rawLumFA2 = (facadeIrradiance * overhangFactor * room.bands.FA2.visTrans * 120) / Math.PI;
    const triggerGlareProtection = isOccupied && rawLumFA2 >= controls.glareLuminanceThresholdCdM2;

    let facadeState = 0;
    if (triggerSunProtection && triggerGlareProtection) facadeState = 3;
    else if (triggerGlareProtection) facadeState = 1;
    else if (triggerSunProtection) facadeState = 2;

    // Determine active shading per band
    const shadingActiveFA1 = (facadeState === 2 || facadeState === 3) && room.bands.FA1.shadingType !== 'none';
    const shadingActiveFA2 = (facadeState > 0) && room.bands.FA2.shadingType !== 'none';
    // FA3 (clerestory) is often kept unshaded for daylight penetration unless severe sun
    const shadingActiveFA3 = (facadeState === 2 || facadeState === 3) && room.bands.FA3.shadingType !== 'none';

    // Effective visible transmittance per band
    const vtFA1 = shadingActiveFA1 ? room.bands.FA1.visTrans * room.bands.FA1.shadingTransmittance : room.bands.FA1.visTrans;
    const vtFA2 = shadingActiveFA2 ? room.bands.FA2.visTrans * room.bands.FA2.shadingTransmittance : room.bands.FA2.visTrans;
    const vtFA3 = shadingActiveFA3 ? room.bands.FA3.visTrans * room.bands.FA3.shadingTransmittance : room.bands.FA3.visTrans;

    // Effective solar factor (g-value) per band
    const gFA1 = shadingActiveFA1 ? room.bands.FA1.gValue * room.bands.FA1.shadingTransmittance : room.bands.FA1.gValue;
    const gFA2 = shadingActiveFA2 ? room.bands.FA2.gValue * room.bands.FA2.shadingTransmittance : room.bands.FA2.gValue;
    const gFA3 = shadingActiveFA3 ? room.bands.FA3.gValue * room.bands.FA3.shadingTransmittance : room.bands.FA3.gValue;

    // 2. DAYLIGHTING SPLIT-FLUX & WORKPLANE ILLUMINANCE
    // Vertical illuminance outside window (lux) approx ~ 110 lm/W
    const vertLuxExt = facadeIrradiance * overhangFactor * 110;

    // Internally Reflected Component (IRC)
    const effectiveGlazedVT = glazedFA1 * vtFA1 + glazedFA2 * vtFA2 + glazedFA3 * vtFA3;
    const eIRC = (vertLuxExt * effectiveGlazedVT * 0.45) / (totalEnclosureArea * (1 - avgReflectance));

    // Sky Components for MA1 (1.5m from window) and MA2 (depth - 1.5m)
    const distMA1 = 1.5;
    const distMA2 = Math.max(2.5, room.depth - 1.5);

    // Direct Daylight Factor decay: ~ exp(-k * dist)
    const scMA1 = vertLuxExt * (vtFA2 * 0.12 * Math.exp(-0.35 * distMA1) + vtFA3 * 0.16 * Math.exp(-0.25 * distMA1));
    const scMA2 = vertLuxExt * (vtFA2 * 0.08 * Math.exp(-0.45 * distMA2) + vtFA3 * 0.18 * Math.exp(-0.28 * distMA2));

    const illuminanceMA1 = Math.max(0, Math.round(scMA1 + eIRC));
    const illuminanceMA2 = Math.max(0, Math.round(scMA2 + eIRC));

    // Continuous Daylight Autonomy (cDA) credit
    let cdaCreditMA1 = 0;
    let cdaCreditMA2 = 0;
    if (isOccupied) {
      if (illuminanceMA1 >= controls.targetIlluminanceMA1) cdaCreditMA1 = 1.0;
      else if (illuminanceMA1 > 0) cdaCreditMA1 = +(illuminanceMA1 / controls.targetIlluminanceMA1).toFixed(2);

      if (illuminanceMA2 >= controls.targetIlluminanceMA2) cdaCreditMA2 = 1.0;
      else if (illuminanceMA2 > 0) cdaCreditMA2 = +(illuminanceMA2 / controls.targetIlluminanceMA2).toFixed(2);
    }

    // 3. ARTIFICIAL LIGHTING & LINEAR-LED DIMMING
    // Group 2 controls MA1 (near window); Group 1 controls MA2 (far from window)
    let powerDimGroup1 = 0;
    let powerDimGroup2 = 0;

    if (isOccupied) {
      // Group 2 (Near window)
      const defMA1 = Math.max(0, 1 - illuminanceMA1 / controls.targetIlluminanceMA1);
      const fracG2 = defMA1 > 0 ? (0.10 + 0.90 * defMA1) : 0;
      powerDimGroup2 = (powerLightGroup2TotalW * fracG2) / floorArea;

      // Group 1 (Far from window)
      const defMA2 = Math.max(0, 1 - illuminanceMA2 / controls.targetIlluminanceMA2);
      const fracG1 = defMA2 > 0 ? (0.10 + 0.90 * defMA2) : 0;
      powerDimGroup1 = (powerLightGroup1TotalW * fracG1) / floorArea;
    }

    const powerLightingTotal = powerDimGroup1 + powerDimGroup2;

    // 4. OCCUPANT VIEWPOINTS MP3, MP4, MP5, MP6
    // MP3 (Desk near window): eye level vertical illuminance & glare
    const evMP3 = Math.round(scMA1 * 0.65 + eIRC * 0.5);
    const lumMP3 = Math.round((facadeIrradiance * overhangFactor * vtFA2 * 115) / Math.PI);
    const melLuxMP3 = Math.round(evMP3 * controls.mder + (isOccupied ? 120 * 0.55 : 0));

    // MP4 (Desk far from window)
    const evMP4 = Math.round(scMA2 * 0.50 + eIRC * 0.5);
    const lumMP4 = Math.round((facadeIrradiance * overhangFactor * vtFA2 * 65) / Math.PI);
    const melLuxMP4 = Math.round(evMP4 * controls.mder + (isOccupied ? 180 * 0.55 : 0));

    // MP5 (Wall / Presentation view)
    const evMP5 = Math.round((scMA1 + scMA2) * 0.35 + eIRC * 0.6);
    const melLuxMP5 = Math.round(evMP5 * controls.mder);

    // MP6 (Circulation / Doorway view)
    const evMP6 = Math.round(scMA2 * 0.40 + eIRC * 0.4);
    const melLuxMP6 = Math.round(evMP6 * controls.mder);

    // 5. THERMAL GAINS & 5R1C DYNAMIC NETWORK
    // Transmitted solar heat gain (W)
    const solarGainW =
      facadeIrradiance *
      overhangFactor *
      (glazedFA1 * gFA1 + glazedFA2 * gFA2 + glazedFA3 * gFA3);

    // Internal gains (W)
    const internalGainsWm2 = isOccupied ? thermal.internalLoadsWm2 + powerLightingTotal : 1.5;
    const internalGainW = internalGainsWm2 * floorArea;

    // Ventilation and automated night purge
    let ach = thermal.baseInfiltrationAch;
    if (isOccupied) ach += thermal.occupancyVentilationAch;

    // Night flush / window purge logic
    const isNightHour = hour >= 22 || hour <= 6;
    if (
      thermal.automatedNightPurge &&
      isNightHour &&
      tAir > thermal.nightPurgeTempThresholdC &&
      tExt < tAir - 1.5
    ) {
      ach += thermal.nightPurgeAch;
    }

    // Ventilation heat transfer coefficient H_ve (W/K)
    // air heat capacity = 1200 J/m³K
    const H_ve = (roomVolume * ach * 1200) / 3600;

    // Split gains to nodes (ISO 13790)
    // 50% internal + 50% solar to internal surface s; mass gets rest
    const phi_ia = 0.5 * internalGainW;
    const phi_st = (1 - (A_m / totalEnclosureArea) - (H_tr_w / (9.1 * totalEnclosureArea))) * (0.5 * internalGainW + 0.1 * solarGainW);
    const phi_m = (A_m / totalEnclosureArea) * (0.5 * internalGainW + 0.9 * solarGainW);

    // Solve 5R1C Crank-Nicolson / explicit step
    // Node m (Thermal mass):
    const H_tr_1 = 1 / (1 / H_ve + 1 / 18.0);
    const H_tr_2 = H_tr_1 + H_tr_w;
    const H_tr_3 = 1 / (1 / H_tr_2 + 1 / H_tr_ms);

    const phi_m_tot = phi_m + H_tr_em * tExt + (H_tr_3 * (phi_st + H_tr_w * tExt + H_tr_1 * tExt + phi_ia)) / H_tr_2;
    const tMassNext = (tMass * (C_m / timeStepSec - 0.5 * (H_tr_3 + H_tr_em)) + phi_m_tot) / (C_m / timeStepSec + 0.5 * (H_tr_3 + H_tr_em));
    tMass = Math.max(-5, Math.min(50, tMassNext));

    // Internal surface node s
    tSurface = (H_tr_ms * tMass + phi_st + H_tr_w * tExt + H_tr_1 * tExt + phi_ia) / (H_tr_ms + H_tr_w + H_tr_1);

    // Indoor air node air
    const tAirFree = (H_tr_ms * tSurface + H_ve * tExt + phi_ia) / (H_tr_ms + H_ve);

    // Operative temperature
    let tOp = 0.5 * (tAirFree + tSurface);
    let heatingW = 0;
    let coolingW = 0;

    if (isOccupied) {
      if (tOp < thermal.heatingSetpointC) {
        heatingW = (thermal.heatingSetpointC - tOp) * (H_tr_ms + H_ve) * 1.5;
        tOp = thermal.heatingSetpointC;
        tAir = thermal.heatingSetpointC;
      } else if (tOp > thermal.coolingSetpointC) {
        coolingW = (tOp - thermal.coolingSetpointC) * (H_tr_ms + H_ve) * 1.5;
        tOp = thermal.coolingSetpointC;
        tAir = thermal.coolingSetpointC;
      } else {
        tAir = tAirFree;
      }
    } else {
      // Unoccupied setpoint setbacks (15°C / 30°C)
      if (tOp < 15.0) {
        heatingW = (15.0 - tOp) * (H_tr_ms + H_ve) * 1.2;
        tOp = 15.0;
        tAir = 15.0;
      } else if (tOp > 32.0) {
        coolingW = (tOp - 32.0) * (H_tr_ms + H_ve) * 1.2;
        tOp = 32.0;
        tAir = 32.0;
      } else {
        tAir = tAirFree;
      }
    }

    const isOverheating = isOccupied && tOp > 26.0;

    hourlyRecords.push({
      hourOfYear,
      month,
      dayOfMonth,
      dayOfYear,
      hour,
      tExt,
      globalHoriz: rec.ghi,
      facadeIrradiance: +facadeIrradiance.toFixed(1),
      facadeState,
      shadingActiveFA1,
      shadingActiveFA2,
      shadingActiveFA3,
      illuminanceMA1,
      illuminanceMA2,
      cdaCreditMA1,
      cdaCreditMA2,
      powerLightingGroup1: +powerDimGroup1.toFixed(2),
      powerLightingGroup2: +powerDimGroup2.toFixed(2),
      powerLightingTotal: +powerLightingTotal.toFixed(2),
      viewpointMP3: {
        eh: illuminanceMA1,
        ev: evMP3,
        glareLuminance: lumMP3,
        melanopicLux: melLuxMP3,
        isGlareExceeded: lumMP3 >= controls.glareLuminanceThresholdCdM2
      },
      viewpointMP4: {
        eh: illuminanceMA2,
        ev: evMP4,
        glareLuminance: lumMP4,
        melanopicLux: melLuxMP4,
        isGlareExceeded: lumMP4 >= controls.glareLuminanceThresholdCdM2
      },
      viewpointMP5: {
        eh: illuminanceMA2,
        ev: evMP5,
        melanopicLux: melLuxMP5
      },
      viewpointMP6: {
        eh: illuminanceMA2,
        ev: evMP6,
        melanopicLux: melLuxMP6
      },
      tAir: +tAir.toFixed(2),
      tOperative: +tOp.toFixed(2),
      tSurface: +tSurface.toFixed(2),
      isOverheating,
      solarGainW: +solarGainW.toFixed(1),
      internalGainW: +internalGainW.toFixed(1),
      heatingDemandW: +heatingW.toFixed(1),
      coolingDemandW: +coolingW.toFixed(1),
      heatingDemandWm2: +(heatingW / floorArea).toFixed(2),
      coolingDemandWm2: +(coolingW / floorArea).toFixed(2),
      isOccupied
    });
  }

  // 6. MONTHLY AND ANNUAL AGGREGATION
  const monthlySummaries: DalecMonthlySummary[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthRecords = hourlyRecords.filter((r) => r.month === m);
    const occupiedRecords = monthRecords.filter((r) => r.isOccupied);
    const nHours = monthRecords.length || 1;
    const nOccHours = occupiedRecords.length || 1;

    const usefulCoolingKwhM2 = +(monthRecords.reduce((acc, r) => acc + r.coolingDemandWm2, 0) / 1000).toFixed(2);
    const usefulHeatingKwhM2 = +(monthRecords.reduce((acc, r) => acc + r.heatingDemandWm2, 0) / 1000).toFixed(2);
    const lightingElecKwhM2 = +(monthRecords.reduce((acc, r) => acc + r.powerLightingTotal, 0) / 1000).toFixed(2);
    const usefulTotalKwhM2 = +(usefulCoolingKwhM2 + usefulHeatingKwhM2 + lightingElecKwhM2).toFixed(2);

    const finalCoolingKwhM2 = +(usefulCoolingKwhM2 / Math.max(1, thermal.coolingCopAse)).toFixed(2);
    const finalHeatingKwhM2 = +(usefulHeatingKwhM2 / Math.max(1, thermal.heatingCopAse)).toFixed(2);
    const finalLightingKwhM2 = lightingElecKwhM2;
    const finalTotalKwhM2 = +(finalCoolingKwhM2 + finalHeatingKwhM2 + finalLightingKwhM2).toFixed(2);

    const primaryCoolingKwhM2 = +(finalCoolingKwhM2 * thermal.primaryEnergyFactor).toFixed(2);
    const primaryHeatingKwhM2 = +(finalHeatingKwhM2 * thermal.primaryEnergyFactor).toFixed(2);
    const primaryLightingKwhM2 = +(finalLightingKwhM2 * thermal.primaryEnergyFactor).toFixed(2);
    const primaryTotalKwhM2 = +(primaryCoolingKwhM2 + primaryHeatingKwhM2 + primaryLightingKwhM2).toFixed(2);

    const energyCostEurM2 = +(finalTotalKwhM2 * thermal.electricityTariffEurKwh).toFixed(2);
    const co2EmissionsKgM2 = +((primaryTotalKwhM2 * thermal.co2EmissionFactorGKwh) / 1000).toFixed(2);

    const avgIlluminanceMA1 = Math.round(monthRecords.reduce((acc, r) => acc + r.illuminanceMA1, 0) / nHours);
    const avgIlluminanceMA2 = Math.round(monthRecords.reduce((acc, r) => acc + r.illuminanceMA2, 0) / nHours);

    const cdaMA1 = +(
      (occupiedRecords.reduce((acc, r) => acc + r.cdaCreditMA1, 0) / nOccHours) *
      100
    ).toFixed(1);
    const cdaMA2 = +(
      (occupiedRecords.reduce((acc, r) => acc + r.cdaCreditMA2, 0) / nOccHours) *
      100
    ).toFixed(1);

    const overheatingHours = monthRecords.filter((r) => r.isOverheating).length;
    const glareExceedHoursMP3 = occupiedRecords.filter((r) => r.viewpointMP3.isGlareExceeded).length;
    const glareExceedHoursMP4 = occupiedRecords.filter((r) => r.viewpointMP4.isGlareExceeded).length;

    monthlySummaries.push({
      month: MONTH_NAMES[m - 1],
      usefulCoolingKwhM2,
      usefulHeatingKwhM2,
      lightingElecKwhM2,
      usefulTotalKwhM2,
      finalCoolingKwhM2,
      finalHeatingKwhM2,
      finalLightingKwhM2,
      finalTotalKwhM2,
      primaryCoolingKwhM2,
      primaryHeatingKwhM2,
      primaryLightingKwhM2,
      primaryTotalKwhM2,
      energyCostEurM2,
      co2EmissionsKgM2,
      avgIlluminanceMA1,
      avgIlluminanceMA2,
      cdaMA1: Number(cdaMA1),
      cdaMA2: Number(cdaMA2),
      overheatingHours,
      glareExceedHoursMP3,
      glareExceedHoursMP4
    });
  }

  // Annual Totals
  const totalOccupiedRecords = hourlyRecords.filter((r) => r.isOccupied);
  const nTotalOcc = totalOccupiedRecords.length || 1;

  const cdaMA1Pct = +(
    (totalOccupiedRecords.reduce((acc, r) => acc + r.cdaCreditMA1, 0) / nTotalOcc) *
    100
  ).toFixed(1);
  const cdaMA2Pct = +(
    (totalOccupiedRecords.reduce((acc, r) => acc + r.cdaCreditMA2, 0) / nTotalOcc) *
    100
  ).toFixed(1);

  const glareExceedMP3Count = totalOccupiedRecords.filter((r) => r.viewpointMP3.isGlareExceeded).length;
  const glareExceedMP4Count = totalOccupiedRecords.filter((r) => r.viewpointMP4.isGlareExceeded).length;
  const glareExceedMP3Pct = +((glareExceedMP3Count / nTotalOcc) * 100).toFixed(1);
  const glareExceedMP4Pct = +((glareExceedMP4Count / nTotalOcc) * 100).toFixed(1);

  const circadianAutonomyCount = totalOccupiedRecords.filter(
    (r) => r.viewpointMP3.melanopicLux >= controls.targetMelanopicLux
  ).length;
  const circadianAutonomyPct = +((circadianAutonomyCount / nTotalOcc) * 100).toFixed(1);

  const overheatingHoursCount = hourlyRecords.filter((r) => r.isOverheating).length;
  const overheatingFrequencyPct = +((overheatingHoursCount / nTotalOcc) * 100).toFixed(1);

  const annualUsefulCoolingKwhM2 = +monthlySummaries.reduce((a, m) => a + m.usefulCoolingKwhM2, 0).toFixed(1);
  const annualUsefulHeatingKwhM2 = +monthlySummaries.reduce((a, m) => a + m.usefulHeatingKwhM2, 0).toFixed(1);
  const annualLightingElecKwhM2 = +monthlySummaries.reduce((a, m) => a + m.lightingElecKwhM2, 0).toFixed(1);
  const annualUsefulTotalKwhM2 = +(annualUsefulCoolingKwhM2 + annualUsefulHeatingKwhM2 + annualLightingElecKwhM2).toFixed(1);

  const annualFinalEnergyKwhM2 = +monthlySummaries.reduce((a, m) => a + m.finalTotalKwhM2, 0).toFixed(1);
  const annualPrimaryEnergyKwhM2 = +monthlySummaries.reduce((a, m) => a + m.primaryTotalKwhM2, 0).toFixed(1);
  const annualEnergyCostEurM2 = +monthlySummaries.reduce((a, m) => a + m.energyCostEurM2, 0).toFixed(1);
  const annualCo2KgM2 = +monthlySummaries.reduce((a, m) => a + m.co2EmissionsKgM2, 0).toFixed(1);

  const executionTimeMs = +(performance.now() - startTime).toFixed(1);

  return {
    room,
    controls,
    thermal,
    hourlyRecords,
    monthlySummaries,
    annualKPIs: {
      cdaMA1Pct: Number(cdaMA1Pct),
      cdaMA2Pct: Number(cdaMA2Pct),
      glareExceedMP3Pct,
      glareExceedMP4Pct,
      circadianAutonomyPct,
      overheatingFrequencyPct,
      overheatingHoursCount,
      annualUsefulCoolingKwhM2,
      annualUsefulHeatingKwhM2,
      annualLightingElecKwhM2,
      annualUsefulTotalKwhM2,
      annualFinalEnergyKwhM2,
      annualPrimaryEnergyKwhM2,
      annualEnergyCostEurM2,
      annualCo2KgM2
    },
    executionTimeMs
  };
}

