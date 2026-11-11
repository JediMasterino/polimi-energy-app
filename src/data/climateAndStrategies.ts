import { ClimateDataset, synthesizeHourlyFromPreset } from '../utils/epwEngine';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// OFFICIAL KÖPPEN-GEIGER CLIMATE CLASSIFICATION DESCRIPTIONS (CBE CLIMA STANDARD)
// ============================================================================
export const KOPPEN_DESCRIPTIONS: Record<string, string> = {
  Af: 'Tropical rainforest',
  Am: 'Tropical monsoon',
  Aw: 'Tropical savanna, dry winter',
  As: 'Tropical savanna, dry summer',
  BWh: 'Hot desert',
  BWk: 'Cold desert',
  BSh: 'Hot semi-arid steppe',
  BSk: 'Cold semi-arid steppe',
  Csa: 'Hot-summer Mediterranean',
  Csb: 'Warm-summer Mediterranean',
  Csc: 'Cold-summer Mediterranean',
  Cwa: 'Monsoon-influenced humid subtropical',
  Cwb: 'Subtropical highland',
  Cwc: 'Cold subtropical highland',
  Cfa: 'Humid subtropical',
  Cfb: 'Temperate oceanic',
  Cfc: 'Subpolar oceanic',
  Dsa: 'Hot-summer continental',
  Dsb: 'Warm-summer continental',
  Dsc: 'Subarctic',
  Dsd: 'Extremely cold subarctic',
  Dwa: 'Monsoon-influenced hot-summer continental',
  Dwb: 'Monsoon-influenced warm-summer continental',
  Dwc: 'Monsoon-influenced subarctic',
  Dwd: 'Monsoon-influenced extremely cold subarctic',
  Dfa: 'Hot-summer humid continental',
  Dfb: 'Warm-summer humid continental',
  Dfc: 'Subarctic boreal',
  Dfd: 'Extremely cold subarctic boreal',
  ET: 'Tundra',
  EF: 'Ice cap'
};

export function getKoppenDescription(code: string): string {
  const clean = (code || '').trim();
  if (KOPPEN_DESCRIPTIONS[clean]) return KOPPEN_DESCRIPTIONS[clean];
  const upper = clean.toUpperCase();
  for (const [k, v] of Object.entries(KOPPEN_DESCRIPTIONS)) {
    if (k.toUpperCase() === upper) return v;
  }
  return 'Temperate oceanic';
}

export function formatKoppen(code: string, customDesc?: string): string {
  const desc = customDesc || getKoppenDescription(code);
  return `${code} — ${desc}`;
}

// ============================================================================
// 1. MACRO-CLIMATE PRESETS (Milan/Mantova Cfa, Rome Csa, Stockholm Dfb, Cairo BWh, etc.)
// ============================================================================
const RAW_CLIMATE_PRESETS = {
  milan: {
    id: 'milan',
    name: 'Milano / Mantova, IT (Po Valley)',
    koppen: 'Cfa',
    koppenDesc: 'Humid subtropical',
    hdd: 1966,
    cdd: 732,
    lat: 45.45,
    lon: 9.28,
    elev: 103,
    runningMeanTemp: 25.5,
    monthlyTemp: [3.4, 5.6, 10.2, 14.9, 18.0, 23.3, 25.4, 25.5, 20.1, 15.3, 9.1, 4.3],
    solarHoriz: [44, 63, 116, 147, 175, 198, 199, 170, 123, 78, 44, 37],
    solarSouth: [74, 87, 113, 100, 88, 88, 92, 100, 101, 91, 71, 73],
    solarEast: [24, 42, 80, 96, 109, 101, 105, 104, 67, 51, 26, 21],
    solarWest: [32, 37, 64, 78, 87, 111, 112, 85, 76, 45, 30, 29],
    solarNorth: [14, 19, 31, 41, 54, 61, 58, 45, 32, 22, 13, 11]
  },
  vevey: {
    id: 'vevey',
    name: 'Vevey / Lausanne, CH (Lake Geneva)',
    koppen: 'Cfb',
    koppenDesc: 'Temperate oceanic',
    hdd: 2808,
    cdd: 259,
    lat: 46.25,
    lon: 6.13,
    elev: 430,
    runningMeanTemp: 21.1,
    monthlyTemp: [1.0, 3.1, 6.5, 10.5, 14.3, 18.7, 21.1, 20.6, 16.2, 11.2, 6.0, 2.6],
    solarHoriz: [43, 65, 107, 154, 168, 191, 179, 157, 120, 76, 47, 34],
    solarSouth: [72, 93, 108, 106, 88, 87, 86, 96, 103, 92, 78, 72],
    solarEast: [32, 47, 76, 100, 105, 117, 108, 98, 74, 52, 35, 27],
    solarWest: [25, 38, 58, 84, 88, 95, 92, 82, 67, 44, 28, 20],
    solarNorth: [15, 19, 30, 41, 56, 64, 58, 44, 33, 23, 14, 10]
  },
  rome: {
    id: 'rome',
    name: 'Roma / Central Italy, IT',
    koppen: 'Csa',
    koppenDesc: 'Hot-summer Mediterranean',
    hdd: 1075,
    cdd: 722,
    lat: 41.80,
    lon: 12.24,
    elev: 3,
    runningMeanTemp: 25.3,
    monthlyTemp: [10.5, 9.7, 11.9, 14.9, 17.9, 22.2, 24.8, 25.3, 21.9, 18.3, 14.9, 11.5],
    solarHoriz: [60, 85, 123, 164, 200, 214, 223, 196, 140, 100, 62, 53],
    solarSouth: [97, 111, 111, 103, 92, 84, 91, 105, 111, 110, 91, 97],
    solarEast: [35, 48, 67, 86, 99, 106, 111, 101, 76, 55, 35, 32],
    solarWest: [41, 53, 77, 96, 115, 115, 123, 113, 80, 64, 40, 36],
    solarNorth: [17, 22, 31, 42, 55, 60, 58, 46, 34, 27, 18, 15]
  },
  stockholm: {
    id: 'stockholm',
    name: 'Stockholm, SE (Nordic)',
    koppen: 'Dfb',
    koppenDesc: 'Warm-summer humid continental',
    hdd: 3905,
    cdd: 45,
    lat: 59.63,
    lon: 17.95,
    elev: 42,
    runningMeanTemp: 17.9,
    monthlyTemp: [-2.2, -1.2, 0.8, 6.3, 11.6, 15.3, 17.9, 16.6, 12.1, 6.7, 4.2, 0.5],
    solarHoriz: [9, 27, 69, 127, 169, 172, 161, 123, 78, 36, 13, 5],
    solarSouth: [22, 50, 87, 117, 114, 103, 100, 94, 90, 56, 30, 13],
    solarEast: [6, 18, 46, 81, 105, 106, 105, 82, 51, 22, 9, 3],
    solarWest: [7, 22, 50, 86, 112, 108, 100, 84, 58, 29, 10, 4],
    solarNorth: [4, 10, 23, 35, 57, 62, 60, 42, 24, 13, 5, 2]
  },
  cairo: {
    id: 'cairo',
    name: 'Cairo, EG (Hot Arid)',
    koppen: 'BWh',
    koppenDesc: 'Hot desert',
    hdd: 244,
    cdd: 2138,
    lat: 30.12,
    lon: 31.41,
    elev: 116,
    runningMeanTemp: 30.0,
    monthlyTemp: [14.6, 16.1, 19.2, 22.3, 26.8, 28.8, 29.9, 30.0, 28.1, 25.7, 20.0, 16.4],
    solarHoriz: [117, 127, 184, 212, 237, 241, 242, 226, 190, 156, 117, 104],
    solarSouth: [149, 123, 127, 95, 72, 60, 66, 85, 110, 133, 133, 137],
    solarEast: [60, 63, 87, 102, 112, 108, 107, 101, 87, 71, 60, 55],
    solarWest: [72, 73, 104, 116, 124, 124, 126, 125, 108, 95, 66, 59],
    solarNorth: [26, 30, 41, 47, 59, 64, 61, 50, 40, 34, 27, 24]
  },
  palermo: {
    id: 'palermo',
    name: 'Palermo, IT (Southern Med)',
    koppen: 'Csa',
    koppenDesc: 'Hot-summer Mediterranean',
    hdd: 650,
    cdd: 1038,
    lat: 38.18,
    lon: 13.10,
    elev: 34,
    runningMeanTemp: 26.9,
    monthlyTemp: [13.4, 13.0, 13.7, 16.2, 19.1, 23.3, 26.2, 26.9, 24.8, 21.0, 17.0, 13.8],
    solarHoriz: [73, 93, 143, 180, 209, 224, 234, 204, 152, 105, 76, 65],
    solarSouth: [104, 105, 119, 105, 85, 78, 84, 98, 110, 107, 102, 101],
    solarEast: [39, 49, 73, 90, 102, 107, 113, 101, 78, 56, 41, 36],
    solarWest: [47, 56, 88, 103, 118, 122, 129, 115, 90, 66, 46, 41],
    solarNorth: [21, 25, 36, 41, 57, 63, 59, 47, 36, 29, 21, 18]
  },
  bormio: {
    id: 'bormio',
    name: 'Bormio, IT (Alpine Zone F)',
    koppen: 'Cfb',
    koppenDesc: 'Temperate oceanic',
    hdd: 3214,
    cdd: 162,
    lat: 46.46,
    lon: 11.33,
    elev: 241,
    runningMeanTemp: 20.0,
    monthlyTemp: [0.7, 3.4, 4.7, 8.6, 12.9, 16.6, 20.0, 18.8, 14.9, 8.4, 5.0, 1.3],
    solarHoriz: [50, 72, 116, 156, 168, 175, 182, 162, 113, 89, 48, 44],
    solarSouth: [94, 109, 115, 109, 90, 83, 90, 99, 96, 109, 83, 93],
    solarEast: [28, 41, 67, 90, 91, 93, 107, 89, 62, 49, 28, 26],
    solarWest: [36, 50, 74, 91, 96, 97, 92, 92, 72, 61, 34, 34],
    solarNorth: [14, 19, 32, 43, 54, 59, 58, 46, 31, 25, 14, 13]
  }
};

export const INITIAL_CLIMATE_PRESETS: Record<string, ClimateDataset> = Object.fromEntries(
  Object.entries(RAW_CLIMATE_PRESETS).map(([k, v]) => [k, synthesizeHourlyFromPreset(v)])
);

// ============================================================================
// 2. CLIMATESCOUT PASSIVE DESIGN STRATEGY CARDS
// ============================================================================
export interface ClimateScoutStrategy {
  id: string;
  title: string;
  category: 'Morphology' | 'Envelope' | 'Solar & Shading' | 'Ventilation' | 'Thermal Mass';
  shortDesc: string;
  engineeringImpact: string;
  recommendedKoppen: string[];
  // Modifiers applied to downstream Building / Shoebox / Energy stages when active
  heatingNeedMultiplier: number;
  coolingNeedMultiplier: number;
  effectiveShgcMultiplier: number;
  natVentBonusAch: number;
  tauBonusHours: number;
}

export const CLIMATE_SCOUT_STRATEGIES: ClimateScoutStrategy[] = [
  {
    id: 'form_heating',
    title: 'Compact Form for Heating (Low S/V)',
    category: 'Morphology',
    shortDesc: 'Minimize surface-to-volume ratio (S/V < 0.35 m⁻¹) and envelope conductive heat loss.',
    engineeringImpact: '-12% transmission heat loss in HDD-dominated climates (Zones E & F).',
    recommendedKoppen: ['Dfb', 'Dfc', 'Cfa', 'Cfb'],
    heatingNeedMultiplier: 0.88,
    coolingNeedMultiplier: 1.02,
    effectiveShgcMultiplier: 1.0,
    natVentBonusAch: 0,
    tauBonusHours: 4
  },
  {
    id: 'form_cooling',
    title: 'Porous / Courtyard Form for Cooling',
    category: 'Morphology',
    shortDesc: 'Articulate massing with self-shaded courtyards and shallow floorplates for breeze.',
    engineeringImpact: '-14% cooling demand and +18% natural ventilation & daylighting reach.',
    recommendedKoppen: ['BWh', 'Csa', 'Cfa'],
    heatingNeedMultiplier: 1.03,
    coolingNeedMultiplier: 0.86,
    effectiveShgcMultiplier: 0.92,
    natVentBonusAch: 0.6,
    tauBonusHours: 0
  },
  {
    id: 'cross_stack_vent',
    title: 'Cross / Stack Ventilation & Night Flush',
    category: 'Ventilation',
    shortDesc: 'Use wind-driven cross ventilation and nocturnal convective cooling of structural slabs.',
    engineeringImpact: '+1.8 ACH night-flush cooling; cuts summer mechanical cooling by up to 22%.',
    recommendedKoppen: ['Csa', 'Cfa', 'BWh', 'Cfb'],
    heatingNeedMultiplier: 1.0,
    coolingNeedMultiplier: 0.78,
    effectiveShgcMultiplier: 1.0,
    natVentBonusAch: 1.8,
    tauBonusHours: 6
  },
  {
    id: 'east_west_shading',
    title: 'Dynamic East/West & South Solar Shading',
    category: 'Solar & Shading',
    shortDesc: 'Deploy external louvers/blinds and horizontal overhangs to block low-angle summer sun.',
    engineeringImpact: '-35% effective summer solar heat gain coefficient (g_eff) during peak irradiation.',
    recommendedKoppen: ['BWh', 'Csa', 'Cfa'],
    heatingNeedMultiplier: 1.02,
    coolingNeedMultiplier: 0.74,
    effectiveShgcMultiplier: 0.65,
    natVentBonusAch: 0,
    tauBonusHours: 0
  },
  {
    id: 'cool_green_roof',
    title: 'Cool / Biosolar Green Roof (High Albedo)',
    category: 'Envelope',
    shortDesc: 'Combine high solar reflectance (SRI > 78) or extensive green roof evapotranspiration.',
    engineeringImpact: '-10% summer roof sol-air heat gain and +6% PV conversion efficiency.',
    recommendedKoppen: ['BWh', 'Csa', 'Cfa'],
    heatingNeedMultiplier: 0.98,
    coolingNeedMultiplier: 0.88,
    effectiveShgcMultiplier: 0.95,
    natVentBonusAch: 0,
    tauBonusHours: 5
  },
  {
    id: 'direct_solar_gain',
    title: 'Direct South Passive Solar Gain',
    category: 'Solar & Shading',
    shortDesc: 'Optimize South glazing orientation and winter solar admission with high-SHGC low-e glass.',
    engineeringImpact: '-15% winter heating energy demand via passive solar collection.',
    recommendedKoppen: ['Dfb', 'Cfa', 'Cfb'],
    heatingNeedMultiplier: 0.85,
    coolingNeedMultiplier: 1.05,
    effectiveShgcMultiplier: 1.08,
    natVentBonusAch: 0,
    tauBonusHours: 2
  },
  {
    id: 'thermal_mass',
    title: 'High Internal Thermal Mass (κ_i > 60 kJ/m²K)',
    category: 'Thermal Mass',
    shortDesc: 'Expose high-capacity concrete/masonry/CLT thermal mass to attenuate diurnal peaks.',
    engineeringImpact: '+12h thermal time constant (τ) and -16% peak operative temperature swing.',
    recommendedKoppen: ['Csa', 'BWh', 'Cfa', 'Dfb'],
    heatingNeedMultiplier: 0.93,
    coolingNeedMultiplier: 0.85,
    effectiveShgcMultiplier: 1.0,
    natVentBonusAch: 0,
    tauBonusHours: 14
  }
];

// Compute relevance score (0-100%) of a ClimateScout strategy for a given ClimateDataset
export function scoreStrategyRelevance(strategy: ClimateScoutStrategy, climate: ClimateDataset): number {
  let score = 50;
  if (strategy.recommendedKoppen.includes(climate.koppen)) score += 25;

  if (strategy.id === 'form_heating' || strategy.id === 'direct_solar_gain') {
    score += Math.min(25, Math.round((climate.hdd - 1200) / 100));
  }
  if (strategy.id === 'form_cooling' || strategy.id === 'east_west_shading' || strategy.id === 'cool_green_roof') {
    score += Math.min(25, Math.round(climate.cdd / 60));
  }
  if (strategy.id === 'cross_stack_vent') {
    score += Math.min(25, Math.round(climate.natVentHoursPct * 0.8));
  }
  if (strategy.id === 'thermal_mass') {
    score += 18;
  }
  return Math.max(20, Math.min(99, score));
}

// ============================================================================
// 3. OPAQUE ENVELOPE LAYER MATERIALS CATALOG (ISO 13786 / UNI EN ISO 6946)
// ============================================================================
export interface EnvelopeMaterialSpec {
  id: string;
  name: string;
  category: 'Structure' | 'Insulation' | 'Finish';
  lambda: number;      // Thermal conductivity W/(m·K)
  rho: number;         // Density kg/m³
  cp: number;          // Specific heat J/(kg·K)
  gwpPerKg: number;    // Embodied Carbon A1-A3 (kgCO2e/kg)
  defaultThickMm: number;
}

export const ENVELOPE_MATERIALS: EnvelopeMaterialSpec[] = [
  {
    id: 'rc_concrete',
    name: 'Reinforced Concrete (C25/30)',
    category: 'Structure',
    lambda: 1.65,
    rho: 2300,
    cp: 1000,
    gwpPerKg: 0.13,
    defaultThickMm: 200
  },
  {
    id: 'clt_timber',
    name: 'Cross-Laminated Timber (CLT)',
    category: 'Structure',
    lambda: 0.13,
    rho: 480,
    cp: 1600,
    gwpPerKg: 0.06,
    defaultThickMm: 160
  },
  {
    id: 'hollow_brick',
    name: 'Poroton Clay Hollow Brick Block',
    category: 'Structure',
    lambda: 0.28,
    rho: 850,
    cp: 1000,
    gwpPerKg: 0.21,
    defaultThickMm: 250
  },
  {
    id: 'hempcrete',
    name: 'Bio-Based Hemp-Lime Block',
    category: 'Structure',
    lambda: 0.075,
    rho: 330,
    cp: 1500,
    gwpPerKg: 0.04,
    defaultThickMm: 240
  },
  {
    id: 'wood_fiber',
    name: 'Wood Fiber Insulation Board',
    category: 'Insulation',
    lambda: 0.038,
    rho: 160,
    cp: 2100,
    gwpPerKg: 0.09,
    defaultThickMm: 140
  },
  {
    id: 'rockwool',
    name: 'Mineral Rockwool Acoustic/Thermal',
    category: 'Insulation',
    lambda: 0.035,
    rho: 100,
    cp: 1030,
    gwpPerKg: 1.05,
    defaultThickMm: 140
  },
  {
    id: 'eps_graphite',
    name: 'Expanded Polystyrene (EPS Graphite)',
    category: 'Insulation',
    lambda: 0.031,
    rho: 25,
    cp: 1450,
    gwpPerKg: 3.1,
    defaultThickMm: 120
  },
  {
    id: 'cork_board',
    name: 'Expanded Natural Cork (ICB)',
    category: 'Insulation',
    lambda: 0.04,
    rho: 120,
    cp: 1800,
    gwpPerKg: 0.07,
    defaultThickMm: 120
  },
  {
    id: 'gypsum_plaster',
    name: 'Internal Lime-Gypsum Plaster',
    category: 'Finish',
    lambda: 0.5,
    rho: 1300,
    cp: 1000,
    gwpPerKg: 0.14,
    defaultThickMm: 20
  },
  {
    id: 'ventilated_cladding',
    name: 'External Fiber-Cement / Terracotta Rain-Screen',
    category: 'Finish',
    lambda: 0.85,
    rho: 1800,
    cp: 900,
    gwpPerKg: 0.45,
    defaultThickMm: 20
  }
];

