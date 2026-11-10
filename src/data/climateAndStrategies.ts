import { ClimateDataset, synthesizeHourlyFromPreset } from '../utils/epwEngine';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// 1. MACRO-CLIMATE PRESETS (Milan/Mantova Cfa, Rome Csa, Stockholm Dfb, Cairo BWh, etc.)
// ============================================================================
const RAW_CLIMATE_PRESETS = {
  milan: {
    id: 'milan',
    name: 'Milano / Mantova, IT (Po Valley)',
    koppen: 'Cfa',
    koppenDesc: 'Humid Subtropical — Cold foggy winters, hot humid summers',
    hdd: 2454,
    cdd: 1771,
    lat: 45.43,
    lon: 9.28,
    elev: 103,
    runningMeanTemp: 23.1,
    monthlyTemp: [0.6, 2.9, 8.5, 12.8, 16.8, 19.9, 23.1, 22.0, 19.0, 13.0, 7.5, 2.4],
    solarHoriz: [25, 36, 74, 112, 150, 162, 172, 139, 96, 58, 26, 20],
    solarSouth: [58, 72, 104, 102, 108, 106, 112, 110, 108, 88, 56, 48],
    solarEast: [18, 26, 52, 76, 100, 106, 112, 94, 66, 40, 18, 14],
    solarWest: [18, 26, 52, 76, 100, 106, 112, 94, 66, 40, 18, 14],
    solarNorth: [10, 14, 26, 38, 56, 64, 66, 48, 30, 18, 10, 8]
  },
  vevey: {
    id: 'vevey',
    name: 'Vevey / Lausanne, CH (Lake Geneva)',
    koppen: 'Cfb',
    koppenDesc: 'Temperate Oceanic / Alpine Foothills — Cool winters, mild temperate summers',
    hdd: 2965,
    cdd: 1182,
    lat: 46.25,
    lon: 6.13,
    elev: 416,
    runningMeanTemp: 20.3,
    monthlyTemp: [1.8, 2.4, 5.9, 10.1, 13.4, 16.7, 20.3, 19.9, 15.7, 10.6, 4.7, 2.8],
    solarHoriz: [27, 46, 92, 122, 161, 166, 181, 157, 111, 65, 33, 23],
    solarSouth: [64, 86, 114, 108, 106, 102, 108, 114, 118, 92, 64, 56],
    solarEast: [20, 32, 62, 84, 106, 112, 120, 102, 74, 44, 22, 16],
    solarWest: [20, 32, 62, 84, 106, 112, 120, 102, 74, 44, 22, 16],
    solarNorth: [11, 16, 28, 40, 58, 68, 70, 52, 34, 20, 12, 9]
  },
  rome: {
    id: 'rome',
    name: 'Roma / Central Italy, IT',
    koppen: 'Csa',
    koppenDesc: 'Hot-Summer Mediterranean — Mild winters, sunny warm summers',
    hdd: 1514,
    cdd: 2174,
    lat: 41.80,
    lon: 12.23,
    elev: 3,
    runningMeanTemp: 23.4,
    monthlyTemp: [7.0, 8.3, 10.4, 13.1, 16.9, 20.5, 23.4, 23.2, 20.7, 16.8, 13.3, 9.0],
    solarHoriz: [38, 51, 92, 129, 171, 184, 190, 160, 114, 75, 43, 32],
    solarSouth: [88, 96, 118, 108, 100, 96, 102, 114, 124, 108, 86, 76],
    solarEast: [26, 36, 62, 86, 112, 120, 124, 104, 76, 50, 30, 22],
    solarWest: [26, 36, 62, 86, 112, 120, 124, 104, 76, 50, 30, 22],
    solarNorth: [14, 18, 28, 42, 60, 70, 72, 54, 36, 22, 14, 11]
  },
  stockholm: {
    id: 'stockholm',
    name: 'Stockholm, SE (Nordic)',
    koppen: 'Dfb',
    koppenDesc: 'Warm-Summer Hemiboreal — Long cold winters, mild bright summers',
    hdd: 4239,
    cdd: 683,
    lat: 59.65,
    lon: 17.95,
    elev: 61,
    runningMeanTemp: 17.0,
    monthlyTemp: [-3.6, -0.8, 0.3, 4.4, 11.7, 14.5, 17.0, 16.0, 11.3, 6.7, 1.6, -1.9],
    solarHoriz: [8, 21, 55, 112, 164, 161, 157, 118, 70, 37, 13, 6],
    solarSouth: [30, 60, 98, 118, 122, 116, 114, 106, 92, 64, 30, 18],
    solarEast: [6, 16, 40, 78, 114, 120, 116, 84, 50, 22, 8, 4],
    solarWest: [6, 16, 40, 78, 114, 120, 116, 84, 50, 22, 8, 4],
    solarNorth: [3, 8, 18, 38, 64, 76, 72, 46, 22, 10, 4, 2]
  },
  cairo: {
    id: 'cairo',
    name: 'Cairo, EG (Hot Arid)',
    koppen: 'BWh',
    koppenDesc: 'Hot Desert Climate — Extremely high solar load & cooling demand',
    hdd: 390,
    cdd: 4276,
    lat: 30.13,
    lon: 31.40,
    elev: 74,
    runningMeanTemp: 28.2,
    monthlyTemp: [14.0, 14.5, 16.6, 21.8, 24.7, 28.0, 28.2, 27.9, 26.5, 23.8, 19.0, 15.3],
    solarHoriz: [91, 111, 152, 183, 217, 228, 231, 208, 180, 130, 99, 89],
    solarSouth: [148, 140, 134, 106, 82, 72, 76, 96, 128, 146, 148, 148],
    solarEast: [62, 74, 102, 120, 140, 146, 146, 134, 116, 90, 68, 60],
    solarWest: [62, 74, 102, 120, 140, 146, 146, 134, 116, 90, 68, 60],
    solarNorth: [24, 28, 38, 48, 66, 76, 74, 58, 42, 30, 24, 22]
  },
  palermo: {
    id: 'palermo',
    name: 'Palermo, IT (Southern Med)',
    koppen: 'Csa',
    koppenDesc: 'Southern Mediterranean — Very mild winters, cooling-dominated summers',
    hdd: 873,
    cdd: 2963,
    lat: 38.10,
    lon: 13.30,
    elev: 117,
    runningMeanTemp: 25.7,
    monthlyTemp: [11.2, 13.2, 12.6, 15.2, 19.7, 22.0, 25.1, 25.7, 23.3, 19.1, 16.7, 12.4],
    solarHoriz: [49, 65, 109, 145, 188, 197, 208, 185, 131, 87, 54, 41],
    solarSouth: [98, 106, 122, 108, 98, 92, 98, 112, 124, 118, 96, 88],
    solarEast: [34, 46, 74, 98, 124, 130, 136, 122, 88, 58, 38, 28],
    solarWest: [34, 46, 74, 98, 124, 130, 136, 122, 88, 58, 38, 28],
    solarNorth: [16, 22, 34, 46, 64, 74, 76, 58, 38, 24, 16, 14]
  },
  bormio: {
    id: 'bormio',
    name: 'Bormio, IT (Alpine Zone F)',
    koppen: 'Dfb',
    koppenDesc: 'Alpine Continental — High heating load, strong winter solar potential',
    hdd: 2913,
    cdd: 1444,
    lat: 46.47,
    lon: 11.33,
    elev: 241,
    runningMeanTemp: 21.0,
    monthlyTemp: [-1.1, 2.0, 7.2, 11.8, 16.2, 18.9, 21.0, 19.9, 17.2, 10.6, 4.6, -0.1],
    solarHoriz: [29, 40, 80, 109, 145, 159, 158, 132, 98, 59, 29, 25],
    solarSouth: [68, 86, 116, 108, 100, 96, 100, 108, 114, 94, 68, 60],
    solarEast: [22, 30, 56, 76, 98, 106, 110, 92, 68, 42, 22, 18],
    solarWest: [22, 30, 56, 76, 98, 106, 110, 92, 68, 42, 22, 18],
    solarNorth: [12, 16, 26, 38, 54, 64, 64, 48, 30, 18, 12, 10]
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

