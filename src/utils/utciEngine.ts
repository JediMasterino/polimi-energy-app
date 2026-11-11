// Universal Thermal Climate Index (UTCI) Engine
// Exact implementation of Bröde et al. (2012) & pythermalcomfort / CBE Clima
import type { HourlyWeatherRecord } from './epwEngine';

export type UtciScenarioId = 'sun_wind' | 'nosun_wind' | 'sun_nowind' | 'nosun_nowind';

export interface UtciScenarioMeta {
  id: UtciScenarioId;
  cbeName: string;
  label: string;
  shortLabel: string;
  description: string;
  sunExposed: boolean;
  windExposed: boolean;
  tag: string;
}

export const UTCI_SCENARIOS: UtciScenarioMeta[] = [
  {
    id: 'sun_wind',
    cbeName: 'utci_Sun_Wind',
    label: 'Sun & Wind',
    shortLabel: 'Sun & Wind',
    description: 'Open Plaza / Exposed Field (Direct Sun + Ambient Wind)',
    sunExposed: true,
    windExposed: true,
    tag: 'Open Plaza'
  },
  {
    id: 'nosun_wind',
    cbeName: 'utci_noSun_Wind',
    label: 'No Sun & Wind',
    shortLabel: 'No Sun & Wind',
    description: 'Tree Canopy / Fabric Pergola / Porous Screen (Shaded Sun + Ambient Wind)',
    sunExposed: false,
    windExposed: true,
    tag: 'Tree Canopy'
  },
  {
    id: 'sun_nowind',
    cbeName: 'utci_Sun_noWind',
    label: 'Sun & No Wind',
    shortLabel: 'Sun & Calm',
    description: 'Sunlit Courtyard / Glazed Windbreak (Direct Sun + Calm 0.5 m/s)',
    sunExposed: true,
    windExposed: false,
    tag: 'Sheltered Courtyard'
  },
  {
    id: 'nosun_nowind',
    cbeName: 'utci_noSun_noWind',
    label: 'No Sun & No Wind',
    shortLabel: 'Shaded & Calm',
    description: 'Shaded Deep Loggia / Colonnade / Arcade (Shaded + Calm 0.5 m/s)',
    sunExposed: false,
    windExposed: false,
    tag: 'Shaded Loggia'
  }
];

export interface UtciCategoryDef {
  id: string;
  code: number; // -5 to 4 (matches CBE Clima UTCI_LABELS)
  label: string;
  shortLabel: string;
  minC: number;
  maxC: number;
  color: string;
}

// 10 Official UTCI Thermal Stress Categories matching CBE Clima exactly
// Edges: [-Infinity, -40, -27, -13, 0, 9, 26, 32, 38, 46, Infinity]
// Right-closed intervals: e.g. (9, 26] = no thermal stress
export const UTCI_STRESS_CATEGORIES: UtciCategoryDef[] = [
  {
    id: 'extreme_cold_stress',
    code: -5,
    label: 'Extreme cold stress',
    shortLabel: 'Ext. Cold (≤-40°C)',
    minC: -Infinity,
    maxC: -40,
    color: '#2A2B72'
  },
  {
    id: 'very_strong_cold_stress',
    code: -4,
    label: 'Very strong cold stress',
    shortLabel: 'V.Strong Cold (-40 to -27°C)',
    minC: -40,
    maxC: -27,
    color: '#394396'
  },
  {
    id: 'strong_cold_stress',
    code: -3,
    label: 'Strong cold stress',
    shortLabel: 'Strong Cold (-27 to -13°C)',
    minC: -27,
    maxC: -13,
    color: '#44549F'
  },
  {
    id: 'moderate_cold_stress',
    code: -2,
    label: 'Moderate cold stress',
    shortLabel: 'Mod. Cold (-13 to 0°C)',
    minC: -13,
    maxC: 0,
    color: '#4F63A8'
  },
  {
    id: 'slight_cold_stress',
    code: -1,
    label: 'Slight cold stress',
    shortLabel: 'Slight Cold (0 to +9°C)',
    minC: 0,
    maxC: 9,
    color: '#7AB7E2'
  },
  {
    id: 'no_thermal_stress',
    code: 0,
    label: 'No thermal stress',
    shortLabel: 'Comfort (+9 to +26°C)',
    minC: 9,
    maxC: 26,
    color: '#6EB557'
  },
  {
    id: 'moderate_heat_stress',
    code: 1,
    label: 'Moderate heat stress',
    shortLabel: 'Mod. Heat (+26 to +32°C)',
    minC: 26,
    maxC: 32,
    color: '#E0893D'
  },
  {
    id: 'strong_heat_stress',
    code: 2,
    label: 'Strong heat stress',
    shortLabel: 'Strong Heat (+32 to +38°C)',
    minC: 32,
    maxC: 38,
    color: '#D84032'
  },
  {
    id: 'very_strong_heat_stress',
    code: 3,
    label: 'Very strong heat stress',
    shortLabel: 'V.Strong Heat (+38 to +46°C)',
    minC: 38,
    maxC: 46,
    color: '#A3302B'
  },
  {
    id: 'extreme_heat_stress',
    code: 4,
    label: 'Extreme heat stress',
    shortLabel: 'Ext. Heat (>+46°C)',
    minC: 46,
    maxC: Infinity,
    color: '#6B1F18'
  }
];

// Projected area factor table (standing posture) from ASHRAE 55 / pythermalcomfort
const ALT_RANGE = [0.0, 15.0, 30.0, 45.0, 60.0, 75.0, 90.0];
const AZ_RANGE = [0.0, 15.0, 30.0, 45.0, 60.0, 75.0, 90.0, 105.0, 120.0, 135.0, 150.0, 165.0, 180.0];

const FP_TABLE_STANDING = [
  [0.35, 0.35, 0.314, 0.258, 0.206, 0.144, 0.082],
  [0.342, 0.342, 0.31, 0.252, 0.2, 0.14, 0.082],
  [0.33, 0.33, 0.3, 0.244, 0.19, 0.132, 0.082],
  [0.31, 0.31, 0.275, 0.228, 0.175, 0.124, 0.082],
  [0.283, 0.283, 0.251, 0.208, 0.16, 0.114, 0.082],
  [0.252, 0.252, 0.228, 0.188, 0.15, 0.108, 0.082],
  [0.23, 0.23, 0.214, 0.18, 0.148, 0.108, 0.082],
  [0.242, 0.242, 0.222, 0.18, 0.153, 0.112, 0.082],
  [0.274, 0.274, 0.245, 0.203, 0.165, 0.116, 0.082],
  [0.304, 0.304, 0.27, 0.22, 0.174, 0.121, 0.082],
  [0.328, 0.328, 0.29, 0.234, 0.183, 0.125, 0.082],
  [0.344, 0.344, 0.304, 0.244, 0.19, 0.128, 0.082],
  [0.347, 0.347, 0.308, 0.246, 0.191, 0.128, 0.082]
];

function findSpan(arr: number[], x: number): number {
  for (let i = 0; i < arr.length - 1; i++) {
    if (x >= arr[i] && x <= arr[i + 1]) {
      return i;
    }
  }
  return -1;
}

function getProjectedAreaFactorStanding(solAltitude: number, sharp = 45): number {
  const alt = Math.max(0, Math.min(90, solAltitude));
  const az = Math.max(0, Math.min(180, sharp));
  const altI = findSpan(ALT_RANGE, alt);
  const azI = findSpan(AZ_RANGE, az);
  if (altI === -1 || azI === -1) return 0.2;

  const fp11 = FP_TABLE_STANDING[azI][altI];
  const fp12 = FP_TABLE_STANDING[azI][altI + 1];
  const fp21 = FP_TABLE_STANDING[azI + 1][altI];
  const fp22 = FP_TABLE_STANDING[azI + 1][altI + 1];
  const az1 = AZ_RANGE[azI];
  const az2 = AZ_RANGE[azI + 1];
  const alt1 = ALT_RANGE[altI];
  const alt2 = ALT_RANGE[altI + 1];

  let fp = fp11 * (az2 - az) * (alt2 - alt);
  fp += fp21 * (az - az1) * (alt2 - alt);
  fp += fp12 * (az2 - az) * (alt - alt1);
  fp += fp22 * (az - az1) * (alt - alt1);
  return fp / ((az2 - az1) * (alt2 - alt1));
}

/**
 * SolarCal Effective Radiant Field (ERF) and Delta Mean Radiant Temperature (ΔMRT)
 * Matches pythermalcomfort.models.solar_gain standing posture exactly as used by CBE Clima.
 */
export function calcSolarGainMrtDelta(
  solAltitude: number,
  solRadiationDir: number, // DNI (W/m2)
  sharp = 45,
  solTransmittance = 1.0,
  fSvv = 1.0,
  fBes = 1.0,
  asw = 0.7,
  floorReflectance = 0.6
): number {
  const alt = Math.max(0, solAltitude);
  const dni = Math.max(0, solRadiationDir);
  if (dni <= 0 || alt <= 0) return 0;

  const degToRad = Math.PI / 180;
  const hr = 6.0;
  const iDiff = 0.2 * dni;
  const fp = getProjectedAreaFactorStanding(alt, sharp);
  const fEff = 0.725; // standing posture
  const swAbs = asw; // 0.7
  const lwAbs = 0.95;

  const eDiff = fEff * fSvv * 0.5 * solTransmittance * iDiff;
  const eDirect = fEff * fp * solTransmittance * fBes * dni;
  const eReflected =
    fEff *
    fSvv *
    0.5 *
    solTransmittance *
    (dni * Math.sin(alt * degToRad) + iDiff) *
    floorReflectance;

  const eSolar = eDiff + eDirect + eReflected;
  const erf = eSolar * (swAbs / lwAbs);
  const dMrt = erf / (hr * fEff);

  // Clamped at 70°C as in CBE Clima: mrt_df.mask(>= 70, 70)
  return Math.min(70, Math.round(dMrt * 10) / 10);
}

/**
 * Hyland-Wexler / Goff-Gratch saturation vapor pressure calculation
 * Matches pythermalcomfort.models.utci exactly.
 */
export function calcVaporPressureKpa(dryBulbC: number, rhPct: number): number {
  const g = [
    -2836.5744,
    -6028.076559,
    19.54263612,
    -0.02737830188,
    0.000016261698,
    7.0229056e-10,
    -1.8680009e-13
  ];
  const tk = dryBulbC + 273.15;
  let es = 2.7150305 * Math.log(tk);
  for (let count = 0; count < g.length; count++) {
    es += g[count] * Math.pow(tk, count - 2);
  }
  const esHpa = Math.exp(es) * 0.01;
  const ehPa = esHpa * (Math.max(0, Math.min(100, rhPct)) / 100.0);
  return ehPa / 10.0;
}

/**
 * 210-coefficient polynomial from Bröde et al. (2012)
 * Matches pythermalcomfort.models.utci._utci_optimized exactly.
 */
export function calcUtciPolynomial(
  tdb: number,
  v: number,
  delta_t_tr: number,
  pa: number
): number {
  return (
    tdb
        + 0.607562052
        + (-0.0227712343) * tdb
        + (8.06470249 * 1e-4) * tdb * tdb
        + (-1.54271372 * 1e-4) * tdb * tdb * tdb
        + (-3.24651735 * 1e-6) * tdb * tdb * tdb * tdb
        + (7.32602852 * 1e-8) * tdb * tdb * tdb * tdb * tdb
        + (1.35959073 * 1e-9) * tdb * tdb * tdb * tdb * tdb * tdb
        + (-2.25836520) * v
        + 0.0880326035 * tdb * v
        + 0.00216844454 * tdb * tdb * v
        + (-1.53347087 * 1e-5) * tdb * tdb * tdb * v
        + (-5.72983704 * 1e-7) * tdb * tdb * tdb * tdb * v
        + (-2.55090145 * 1e-9) * tdb * tdb * tdb * tdb * tdb * v
        + (-0.751269505) * v * v
        + (-0.00408350271) * tdb * v * v
        + (-5.21670675 * 1e-5) * tdb * tdb * v * v
        + (1.94544667 * 1e-6) * tdb * tdb * tdb * v * v
        + (1.14099531 * 1e-8) * tdb * tdb * tdb * tdb * v * v
        + 0.158137256 * v * v * v
        + (-6.57263143 * 1e-5) * tdb * v * v * v
        + (2.22697524 * 1e-7) * tdb * tdb * v * v * v
        + (-4.16117031 * 1e-8) * tdb * tdb * tdb * v * v * v
        + (-0.0127762753) * v * v * v * v
        + (9.66891875 * 1e-6) * tdb * v * v * v * v
        + (2.52785852 * 1e-9) * tdb * tdb * v * v * v * v
        + (4.56306672 * 1e-4) * v * v * v * v * v
        + (-1.74202546 * 1e-7) * tdb * v * v * v * v * v
        + (-5.91491269 * 1e-6) * v * v * v * v * v * v
        + 0.398374029 * delta_t_tr
        + (1.83945314 * 1e-4) * tdb * delta_t_tr
        + (-1.73754510 * 1e-4) * tdb * tdb * delta_t_tr
        + (-7.60781159 * 1e-7) * tdb * tdb * tdb * delta_t_tr
        + (3.77830287 * 1e-8) * tdb * tdb * tdb * tdb * delta_t_tr
        + (5.43079673 * 1e-10) * tdb * tdb * tdb * tdb * tdb * delta_t_tr
        + (-0.0200518269) * v * delta_t_tr
        + (8.92859837 * 1e-4) * tdb * v * delta_t_tr
        + (3.45433048 * 1e-6) * tdb * tdb * v * delta_t_tr
        + (-3.77925774 * 1e-7) * tdb * tdb * tdb * v * delta_t_tr
        + (-1.69699377 * 1e-9) * tdb * tdb * tdb * tdb * v * delta_t_tr
        + (1.69992415 * 1e-4) * v * v * delta_t_tr
        + (-4.99204314 * 1e-5) * tdb * v * v * delta_t_tr
        + (2.47417178 * 1e-7) * tdb * tdb * v * v * delta_t_tr
        + (1.07596466 * 1e-8) * tdb * tdb * tdb * v * v * delta_t_tr
        + (8.49242932 * 1e-5) * v * v * v * delta_t_tr
        + (1.35191328 * 1e-6) * tdb * v * v * v * delta_t_tr
        + (-6.21531254 * 1e-9) * tdb * tdb * v * v * v * delta_t_tr
        + (-4.99410301 * 1e-6) * v * v * v * v * delta_t_tr
        + (-1.89489258 * 1e-8) * tdb * v * v * v * v * delta_t_tr
        + (8.15300114 * 1e-8) * v * v * v * v * v * delta_t_tr
        + (7.55043090 * 1e-4) * delta_t_tr * delta_t_tr
        + (-5.65095215 * 1e-5) * tdb * delta_t_tr * delta_t_tr
        + (-4.52166564 * 1e-7) * tdb * tdb * delta_t_tr * delta_t_tr
        + (2.46688878 * 1e-8) * tdb * tdb * tdb * delta_t_tr * delta_t_tr
        + (2.42674348 * 1e-10) * tdb * tdb * tdb * tdb * delta_t_tr * delta_t_tr
        + (1.54547250 * 1e-4) * v * delta_t_tr * delta_t_tr
        + (5.24110970 * 1e-6) * tdb * v * delta_t_tr * delta_t_tr
        + (-8.75874982 * 1e-8) * tdb * tdb * v * delta_t_tr * delta_t_tr
        + (-1.50743064 * 1e-9) * tdb * tdb * tdb * v * delta_t_tr * delta_t_tr
        + (-1.56236307 * 1e-5) * v * v * delta_t_tr * delta_t_tr
        + (-1.33895614 * 1e-7) * tdb * v * v * delta_t_tr * delta_t_tr
        + (2.49709824 * 1e-9) * tdb * tdb * v * v * delta_t_tr * delta_t_tr
        + (6.51711721 * 1e-7) * v * v * v * delta_t_tr * delta_t_tr
        + (1.94960053 * 1e-9) * tdb * v * v * v * delta_t_tr * delta_t_tr
        + (-1.00361113 * 1e-8) * v * v * v * v * delta_t_tr * delta_t_tr
        + (-1.21206673 * 1e-5) * delta_t_tr * delta_t_tr * delta_t_tr
        + (-2.18203660 * 1e-7) * tdb * delta_t_tr * delta_t_tr * delta_t_tr
        + (7.51269482 * 1e-9) * tdb * tdb * delta_t_tr * delta_t_tr * delta_t_tr
        + (9.79063848 * 1e-11)
        * tdb
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (1.25006734 * 1e-6) * v * delta_t_tr * delta_t_tr * delta_t_tr
        + (-1.81584736 * 1e-9) * tdb * v * delta_t_tr * delta_t_tr * delta_t_tr
        + (-3.52197671 * 1e-10)
        * tdb
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (-3.36514630 * 1e-8) * v * v * delta_t_tr * delta_t_tr * delta_t_tr
        + (1.35908359 * 1e-10)
        * tdb
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (4.17032620 * 1e-10)
        * v
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (-1.30369025 * 1e-9)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (4.13908461 * 1e-10)
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (9.22652254 * 1e-12)
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (-5.08220384 * 1e-9)
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (-2.24730961 * 1e-11)
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (1.17139133 * 1e-10)
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (6.62154879 * 1e-10)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (4.03863260 * 1e-13)
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (1.95087203 * 1e-12)
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + (-4.73602469 * 1e-12)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        + 5.12733497 * pa
        + (-0.312788561) * tdb * pa
        + (-0.0196701861) * tdb * tdb * pa
        + (9.99690870 * 1e-4) * tdb * tdb * tdb * pa
        + (9.51738512 * 1e-6) * tdb * tdb * tdb * tdb * pa
        + (-4.66426341 * 1e-7) * tdb * tdb * tdb * tdb * tdb * pa
        + 0.548050612 * v * pa
        + (-0.00330552823) * tdb * v * pa
        + (-0.00164119440) * tdb * tdb * v * pa
        + (-5.16670694 * 1e-6) * tdb * tdb * tdb * v * pa
        + (9.52692432 * 1e-7) * tdb * tdb * tdb * tdb * v * pa
        + (-0.0429223622) * v * v * pa
        + 0.00500845667 * tdb * v * v * pa
        + (1.00601257 * 1e-6) * tdb * tdb * v * v * pa
        + (-1.81748644 * 1e-6) * tdb * tdb * tdb * v * v * pa
        + (-1.25813502 * 1e-3) * v * v * v * pa
        + (-1.79330391 * 1e-4) * tdb * v * v * v * pa
        + (2.34994441 * 1e-6) * tdb * tdb * v * v * v * pa
        + (1.29735808 * 1e-4) * v * v * v * v * pa
        + (1.29064870 * 1e-6) * tdb * v * v * v * v * pa
        + (-2.28558686 * 1e-6) * v * v * v * v * v * pa
        + (-0.0369476348) * delta_t_tr * pa
        + 0.00162325322 * tdb * delta_t_tr * pa
        + (-3.14279680 * 1e-5) * tdb * tdb * delta_t_tr * pa
        + (2.59835559 * 1e-6) * tdb * tdb * tdb * delta_t_tr * pa
        + (-4.77136523 * 1e-8) * tdb * tdb * tdb * tdb * delta_t_tr * pa
        + (8.64203390 * 1e-3) * v * delta_t_tr * pa
        + (-6.87405181 * 1e-4) * tdb * v * delta_t_tr * pa
        + (-9.13863872 * 1e-6) * tdb * tdb * v * delta_t_tr * pa
        + (5.15916806 * 1e-7) * tdb * tdb * tdb * v * delta_t_tr * pa
        + (-3.59217476 * 1e-5) * v * v * delta_t_tr * pa
        + (3.28696511 * 1e-5) * tdb * v * v * delta_t_tr * pa
        + (-7.10542454 * 1e-7) * tdb * tdb * v * v * delta_t_tr * pa
        + (-1.24382300 * 1e-5) * v * v * v * delta_t_tr * pa
        + (-7.38584400 * 1e-9) * tdb * v * v * v * delta_t_tr * pa
        + (2.20609296 * 1e-7) * v * v * v * v * delta_t_tr * pa
        + (-7.32469180 * 1e-4) * delta_t_tr * delta_t_tr * pa
        + (-1.87381964 * 1e-5) * tdb * delta_t_tr * delta_t_tr * pa
        + (4.80925239 * 1e-6) * tdb * tdb * delta_t_tr * delta_t_tr * pa
        + (-8.75492040 * 1e-8) * tdb * tdb * tdb * delta_t_tr * delta_t_tr * pa
        + (2.77862930 * 1e-5) * v * delta_t_tr * delta_t_tr * pa
        + (-5.06004592 * 1e-6) * tdb * v * delta_t_tr * delta_t_tr * pa
        + (1.14325367 * 1e-7) * tdb * tdb * v * delta_t_tr * delta_t_tr * pa
        + (2.53016723 * 1e-6) * v * v * delta_t_tr * delta_t_tr * pa
        + (-1.72857035 * 1e-8) * tdb * v * v * delta_t_tr * delta_t_tr * pa
        + (-3.95079398 * 1e-8) * v * v * v * delta_t_tr * delta_t_tr * pa
        + (-3.59413173 * 1e-7) * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + (7.04388046 * 1e-7) * tdb * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + (-1.89309167 * 1e-8)
        * tdb
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (-4.79768731 * 1e-7) * v * delta_t_tr * delta_t_tr * delta_t_tr * pa
        + (7.96079978 * 1e-9)
        * tdb
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (1.62897058 * 1e-9)
        * v
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (3.94367674 * 1e-8)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (-1.18566247 * 1e-9)
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (3.34678041 * 1e-10)
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (-1.15606447 * 1e-10)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        + (-2.80626406) * pa * pa
        + 0.548712484 * tdb * pa * pa
        + (-0.00399428410) * tdb * tdb * pa * pa
        + (-9.54009191 * 1e-4) * tdb * tdb * tdb * pa * pa
        + (1.93090978 * 1e-5) * tdb * tdb * tdb * tdb * pa * pa
        + (-0.308806365) * v * pa * pa
        + 0.0116952364 * tdb * v * pa * pa
        + (4.95271903 * 1e-4) * tdb * tdb * v * pa * pa
        + (-1.90710882 * 1e-5) * tdb * tdb * tdb * v * pa * pa
        + 0.00210787756 * v * v * pa * pa
        + (-6.98445738 * 1e-4) * tdb * v * v * pa * pa
        + (2.30109073 * 1e-5) * tdb * tdb * v * v * pa * pa
        + (4.17856590 * 1e-4) * v * v * v * pa * pa
        + (-1.27043871 * 1e-5) * tdb * v * v * v * pa * pa
        + (-3.04620472 * 1e-6) * v * v * v * v * pa * pa
        + 0.0514507424 * delta_t_tr * pa * pa
        + (-0.00432510997) * tdb * delta_t_tr * pa * pa
        + (8.99281156 * 1e-5) * tdb * tdb * delta_t_tr * pa * pa
        + (-7.14663943 * 1e-7) * tdb * tdb * tdb * delta_t_tr * pa * pa
        + (-2.66016305 * 1e-4) * v * delta_t_tr * pa * pa
        + (2.63789586 * 1e-4) * tdb * v * delta_t_tr * pa * pa
        + (-7.01199003 * 1e-6) * tdb * tdb * v * delta_t_tr * pa * pa
        + (-1.06823306 * 1e-4) * v * v * delta_t_tr * pa * pa
        + (3.61341136 * 1e-6) * tdb * v * v * delta_t_tr * pa * pa
        + (2.29748967 * 1e-7) * v * v * v * delta_t_tr * pa * pa
        + (3.04788893 * 1e-4) * delta_t_tr * delta_t_tr * pa * pa
        + (-6.42070836 * 1e-5) * tdb * delta_t_tr * delta_t_tr * pa * pa
        + (1.16257971 * 1e-6) * tdb * tdb * delta_t_tr * delta_t_tr * pa * pa
        + (7.68023384 * 1e-6) * v * delta_t_tr * delta_t_tr * pa * pa
        + (-5.47446896 * 1e-7) * tdb * v * delta_t_tr * delta_t_tr * pa * pa
        + (-3.59937910 * 1e-8) * v * v * delta_t_tr * delta_t_tr * pa * pa
        + (-4.36497725 * 1e-6) * delta_t_tr * delta_t_tr * delta_t_tr * pa * pa
        + (1.68737969 * 1e-7)
        * tdb
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + (2.67489271 * 1e-8)
        * v
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + (3.23926897 * 1e-9)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        + (-0.0353874123) * pa * pa * pa
        + (-0.221201190) * tdb * pa * pa * pa
        + 0.0155126038 * tdb * tdb * pa * pa * pa
        + (-2.63917279 * 1e-4) * tdb * tdb * tdb * pa * pa * pa
        + 0.0453433455 * v * pa * pa * pa
        + (-0.00432943862) * tdb * v * pa * pa * pa
        + (1.45389826 * 1e-4) * tdb * tdb * v * pa * pa * pa
        + (2.17508610 * 1e-4) * v * v * pa * pa * pa
        + (-6.66724702 * 1e-5) * tdb * v * v * pa * pa * pa
        + (3.33217140 * 1e-5) * v * v * v * pa * pa * pa
        + (-0.00226921615) * delta_t_tr * pa * pa * pa
        + (3.80261982 * 1e-4) * tdb * delta_t_tr * pa * pa * pa
        + (-5.45314314 * 1e-9) * tdb * tdb * delta_t_tr * pa * pa * pa
        + (-7.96355448 * 1e-4) * v * delta_t_tr * pa * pa * pa
        + (2.53458034 * 1e-5) * tdb * v * delta_t_tr * pa * pa * pa
        + (-6.31223658 * 1e-6) * v * v * delta_t_tr * pa * pa * pa
        + (3.02122035 * 1e-4) * delta_t_tr * delta_t_tr * pa * pa * pa
        + (-4.77403547 * 1e-6) * tdb * delta_t_tr * delta_t_tr * pa * pa * pa
        + (1.73825715 * 1e-6) * v * delta_t_tr * delta_t_tr * pa * pa * pa
        + (-4.09087898 * 1e-7)
        * delta_t_tr
        * delta_t_tr
        * delta_t_tr
        * pa
        * pa
        * pa
        + 0.614155345 * pa * pa * pa * pa
        + (-0.0616755931) * tdb * pa * pa * pa * pa
        + 0.00133374846 * tdb * tdb * pa * pa * pa * pa
        + 0.00355375387 * v * pa * pa * pa * pa
        + (-5.13027851 * 1e-4) * tdb * v * pa * pa * pa * pa
        + (1.02449757 * 1e-4) * v * v * pa * pa * pa * pa
        + (-0.00148526421) * delta_t_tr * pa * pa * pa * pa
        + (-4.11469183 * 1e-5) * tdb * delta_t_tr * pa * pa * pa * pa
        + (-6.80434415 * 1e-6) * v * delta_t_tr * pa * pa * pa * pa
        + (-9.77675906 * 1e-6) * delta_t_tr * delta_t_tr * pa * pa * pa * pa
        + 0.0882773108 * pa * pa * pa * pa * pa
        + (-0.00301859306) * tdb * pa * pa * pa * pa * pa
        + 0.00104452989 * v * pa * pa * pa * pa * pa
        + (2.47090539 * 1e-4) * delta_t_tr * pa * pa * pa * pa * pa
        + 0.00148348065 * pa * pa * pa * pa * pa * pa
  );
}

/**
 * Exact Universal Thermal Climate Index (UTCI, °C)
 * Matches pythermalcomfort.models.utci
 */
export function calcUtci(
  tdb: number,
  tr: number,
  v: number,
  rh: number,
  roundOutput = true
): number {
  // Wind speed domain in UTCI
  const vClamped = Math.max(0.5, Math.min(17.0, v));
  const pa = calcVaporPressureKpa(tdb, rh);
  const deltaTTr = tr - tdb;

  const raw = calcUtciPolynomial(tdb, vClamped, deltaTTr, pa);
  return roundOutput ? Math.round(raw * 10) / 10 : raw;
}

/**
 * Classify a UTCI value into one of 10 thermal stress categories
 * Interval closure: right=True (e.g. (9, 26] = no thermal stress)
 */
export function getUtciStressCategory(utciC: number): UtciCategoryDef {
  if (utciC <= -40) return UTCI_STRESS_CATEGORIES[0];
  if (utciC <= -27) return UTCI_STRESS_CATEGORIES[1];
  if (utciC <= -13) return UTCI_STRESS_CATEGORIES[2];
  if (utciC <= 0) return UTCI_STRESS_CATEGORIES[3];
  if (utciC <= 9) return UTCI_STRESS_CATEGORIES[4];
  if (utciC <= 26) return UTCI_STRESS_CATEGORIES[5];
  if (utciC <= 32) return UTCI_STRESS_CATEGORIES[6];
  if (utciC <= 38) return UTCI_STRESS_CATEGORIES[7];
  if (utciC <= 46) return UTCI_STRESS_CATEGORIES[8];
  return UTCI_STRESS_CATEGORIES[9];
}

/**
 * Calculate UTCI for one of the 4 CBE Clima microclimate scenarios:
 *  - sun_wind (utci_Sun_Wind): DBT, MRT (SolarCal), wind clamped [0.6, 16.9]
 *  - nosun_wind (utci_noSun_Wind): DBT, DBT, wind clamped [0.6, 16.9]
 *  - sun_nowind (utci_Sun_noWind): DBT, MRT (SolarCal), wind = 0.5 m/s
 *  - nosun_nowind (utci_noSun_noWind): DBT, DBT, wind = 0.5 m/s
 */
export function calcUtciForScenario(
  dryBulb: number,
  relHum: number,
  windSpeed: number,
  dni: number,
  solarAltDeg: number,
  scenario: UtciScenarioId
): number {
  // Wind speed handling as in CBE Clima extract_df.py
  // wind_speed_utci: >= 17 -> 16.9, <= 0.5 -> 0.6
  let v = 0.5;
  if (scenario === 'sun_wind' || scenario === 'nosun_wind') {
    if (windSpeed >= 17) v = 16.9;
    else if (windSpeed <= 0.5) v = 0.6;
    else v = windSpeed;
  }

  // MRT handling as in CBE Clima extract_df.py
  let tr = dryBulb;
  if (scenario === 'sun_wind' || scenario === 'sun_nowind') {
    const deltaMrt = calcSolarGainMrtDelta(solarAltDeg, dni);
    tr = dryBulb + deltaMrt;
  }

  return calcUtci(dryBulb, tr, v, relHum, true);
}

export interface UtciScenarioResult {
  scenario: UtciScenarioId;
  meta: UtciScenarioMeta;
  hourlyUtci: number[];
  hourlyCategories: number[]; // -5 to 4
  annualComfortPct: number;
  annualComfortHours: number;
  annualColdStressPct: number;
  annualColdStressHours: number;
  annualHeatStressPct: number;
  annualHeatStressHours: number;
  monthlyCategoryCounts: number[][]; // [month 0..11][category 0..9]
  monthlyCategoryPct: number[][]; // [month 0..11][category 0..9]
  annualCategoryCounts: number[]; // [category 0..9]
  annualCategoryPct: number[]; // [category 0..9]
  monthlyBandShares: Array<Record<string, number>>; // 12 x { [catId]: pct }
  monthlyBandHours: Array<Record<string, number>>; // 12 x { [catId]: hours }
  monthlyTotalHours: number[];
  totalHours: number;
}

/**
 * Calculate the complete monthly and annual thermal stress breakdown for a scenario
 */
export function calcUtciScenarioDataset(
  hourly: HourlyWeatherRecord[],
  scenario: UtciScenarioId
): UtciScenarioResult {
  const meta = UTCI_SCENARIOS.find((s) => s.id === scenario) || UTCI_SCENARIOS[0];
  const monthlyTotalHours = new Array(12).fill(0);
  const monthlyCounts: number[][] = Array.from({ length: 12 }, () => new Array(10).fill(0));
  const annualCounts = new Array(10).fill(0);

  let comfortHours = 0;
  let coldStressHours = 0;
  let heatStressHours = 0;

  const hourlyUtci: number[] = new Array(hourly.length);
  const hourlyCategories: number[] = new Array(hourly.length);

  for (let i = 0; i < hourly.length; i++) {
    const h = hourly[i];
    const val = calcUtciForScenario(h.dryBulb, h.relHum, h.windSpeed, h.dni, h.solarAlt, scenario);
    hourlyUtci[i] = val;

    const cat = getUtciStressCategory(val);
    const catIdx = cat.code + 5; // -5 -> 0, 0 -> 5, 4 -> 9
    hourlyCategories[i] = cat.code;

    const m = Math.max(0, Math.min(11, h.month));
    monthlyTotalHours[m]++;
    monthlyCounts[m][catIdx]++;
    annualCounts[catIdx]++;

    if (cat.code === 0) {
      comfortHours++;
    } else if (cat.code < 0) {
      coldStressHours++;
    } else {
      heatStressHours++;
    }
  }

  const totalHours = Math.max(1, hourly.length);
  const monthlyCategoryPct: number[][] = Array.from({ length: 12 }, () => new Array(10).fill(0));
  const monthlyBandShares: Array<Record<string, number>> = [];
  const monthlyBandHours: Array<Record<string, number>> = [];

  for (let m = 0; m < 12; m++) {
    const mTot = Math.max(1, monthlyTotalHours[m]);
    const shareObj: Record<string, number> = {};
    const hoursObj: Record<string, number> = {};
    for (let c = 0; c < 10; c++) {
      const count = monthlyCounts[m][c];
      const pct = +((count / mTot) * 100).toFixed(1);
      monthlyCategoryPct[m][c] = pct;
      const catDef = UTCI_STRESS_CATEGORIES[c];
      shareObj[catDef.id] = pct;
      hoursObj[catDef.id] = count;
    }
    monthlyBandShares.push(shareObj);
    monthlyBandHours.push(hoursObj);
  }

  const annualCategoryPct: number[] = annualCounts.map(
    (count) => +((count / totalHours) * 100).toFixed(1)
  );

  return {
    scenario,
    meta,
    hourlyUtci,
    hourlyCategories,
    annualComfortPct: +((comfortHours / totalHours) * 100).toFixed(1),
    annualComfortHours: comfortHours,
    annualColdStressPct: +((coldStressHours / totalHours) * 100).toFixed(1),
    annualColdStressHours: coldStressHours,
    annualHeatStressPct: +((heatStressHours / totalHours) * 100).toFixed(1),
    annualHeatStressHours: heatStressHours,
    monthlyCategoryCounts: monthlyCounts,
    monthlyCategoryPct,
    annualCategoryCounts: annualCounts,
    annualCategoryPct,
    monthlyBandShares,
    monthlyBandHours,
    monthlyTotalHours,
    totalHours
  };
}

export interface AllUtciScenariosSummary {
  results: Record<UtciScenarioId, UtciScenarioResult>;
  bestScenario: UtciScenarioId;
  bestMeta: UtciScenarioMeta;
  cbeBestHeadline: string;
}

/**
 * Run all 4 microclimate scenarios and find the optimal scenario matching CBE Clima
 */
export function calcAllUtciScenariosSummary(hourly: HourlyWeatherRecord[]): AllUtciScenariosSummary {
  const results = {
    sun_wind: calcUtciScenarioDataset(hourly, 'sun_wind'),
    nosun_wind: calcUtciScenarioDataset(hourly, 'nosun_wind'),
    sun_nowind: calcUtciScenarioDataset(hourly, 'sun_nowind'),
    nosun_nowind: calcUtciScenarioDataset(hourly, 'nosun_nowind')
  };

  let bestScenario: UtciScenarioId = 'sun_wind';
  let maxComfortHours = -1;

  for (const sc of UTCI_SCENARIOS) {
    const r = results[sc.id];
    if (r.annualComfortHours > maxComfortHours) {
      maxComfortHours = r.annualComfortHours;
      bestScenario = sc.id;
    }
  }

  const bestMeta = UTCI_SCENARIOS.find((s) => s.id === bestScenario) || UTCI_SCENARIOS[0];
  const bestResult = results[bestScenario];

  // CBE Clima format: The Best Weather Condition is: UTCI Sun Wind
  const formattedName = bestMeta.cbeName.replace('utci_', 'UTCI ').replace(/_/g, ' ');
  const cbeBestHeadline = `The Best Weather Condition is: ${formattedName} (${bestMeta.tag}) with ${bestResult.annualComfortHours.toLocaleString()} hrs (${bestResult.annualComfortPct}%) of No Thermal Stress`;

  return {
    results,
    bestScenario,
    bestMeta,
    cbeBestHeadline
  };
}
