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
    hdd: 2404,
    cdd: 435,
    lat: 45.46,
    lon: 9.19,
    elev: 120,
    runningMeanTemp: 24.4,
    monthlyTemp: [2.8, 5.3, 9.8, 13.9, 18.7, 23.1, 25.4, 24.8, 20.1, 14.2, 8.1, 3.6],
    solarHoriz: [42, 65, 112, 145, 182, 201, 218, 186, 132, 78, 44, 35],
    solarSouth: [76, 94, 118, 108, 102, 98, 106, 116, 122, 98, 70, 66],
    solarEast: [28, 45, 76, 96, 118, 126, 136, 118, 86, 52, 29, 23],
    solarWest: [28, 45, 76, 96, 118, 126, 136, 118, 86, 52, 29, 23],
    solarNorth: [14, 21, 34, 46, 65, 76, 78, 58, 38, 24, 15, 12]
  },
  rome: {
    id: 'rome',
    name: 'Roma / Central Italy, IT',
    koppen: 'Csa',
    koppenDesc: 'Hot-Summer Mediterranean — Mild winters, sunny warm summers',
    hdd: 1415,
    cdd: 820,
    lat: 41.9,
    lon: 12.49,
    elev: 45,
    runningMeanTemp: 26.2,
    monthlyTemp: [8.1, 9.0, 11.5, 14.4, 18.9, 23.2, 26.1, 26.3, 22.1, 17.6, 12.7, 9.1],
    solarHoriz: [62, 82, 128, 162, 204, 224, 242, 212, 154, 106, 68, 54],
    solarSouth: [108, 116, 132, 116, 106, 100, 108, 124, 138, 128, 106, 98],
    solarEast: [40, 56, 86, 108, 132, 142, 152, 134, 100, 68, 44, 35],
    solarWest: [40, 56, 86, 108, 132, 142, 152, 134, 100, 68, 44, 35],
    solarNorth: [18, 25, 38, 50, 70, 82, 84, 64, 42, 28, 19, 15]
  },
  stockholm: {
    id: 'stockholm',
    name: 'Stockholm, SE (Nordic)',
    koppen: 'Dfb',
    koppenDesc: 'Warm-Summer Hemiboreal — Long cold winters, mild bright summers',
    hdd: 3980,
    cdd: 115,
    lat: 59.33,
    lon: 18.07,
    elev: 44,
    runningMeanTemp: 17.8,
    monthlyTemp: [-2.8, -2.6, 0.6, 5.8, 11.6, 16.2, 18.8, 17.6, 12.8, 7.4, 2.4, -1.2],
    solarHoriz: [10, 28, 72, 122, 172, 188, 178, 138, 84, 36, 12, 6],
    solarSouth: [34, 68, 114, 126, 128, 122, 120, 114, 104, 68, 34, 22],
    solarEast: [8, 22, 54, 88, 122, 132, 126, 96, 58, 25, 9, 5],
    solarWest: [8, 22, 54, 88, 122, 132, 126, 96, 58, 25, 9, 5],
    solarNorth: [4, 10, 24, 42, 68, 84, 78, 52, 26, 12, 5, 3]
  },
  cairo: {
    id: 'cairo',
    name: 'Cairo, EG (Hot Arid)',
    koppen: 'BWh',
    koppenDesc: 'Hot Desert Climate — Extremely high solar load & cooling demand',
    hdd: 360,
    cdd: 2480,
    lat: 30.04,
    lon: 31.24,
    elev: 74,
    runningMeanTemp: 29.8,
    monthlyTemp: [14.2, 15.6, 18.4, 22.2, 26.1, 28.9, 29.8, 29.6, 27.5, 24.4, 19.6, 15.5],
    solarHoriz: [118, 138, 184, 214, 246, 258, 256, 236, 198, 164, 126, 110],
    solarSouth: [168, 158, 148, 112, 86, 74, 78, 102, 138, 162, 166, 166],
    solarEast: [74, 88, 118, 136, 154, 160, 158, 148, 126, 104, 80, 70],
    solarWest: [74, 88, 118, 136, 154, 160, 158, 148, 126, 104, 80, 70],
    solarNorth: [28, 34, 46, 58, 76, 88, 86, 66, 48, 36, 29, 26]
  },
  palermo: {
    id: 'palermo',
    name: 'Palermo, IT (Southern Med)',
    koppen: 'Csa',
    koppenDesc: 'Southern Mediterranean — Very mild winters, cooling-dominated summers',
    hdd: 750,
    cdd: 1310,
    lat: 38.12,
    lon: 13.36,
    elev: 14,
    runningMeanTemp: 27.8,
    monthlyTemp: [12.1, 12.3, 14.0, 16.6, 20.5, 24.6, 27.5, 28.0, 24.8, 21.0, 16.8, 13.4],
    solarHoriz: [76, 96, 144, 178, 218, 236, 252, 224, 168, 122, 84, 68],
    solarSouth: [122, 126, 138, 118, 104, 96, 102, 122, 142, 138, 120, 114],
    solarEast: [48, 64, 94, 116, 140, 148, 158, 142, 108, 78, 54, 44],
    solarWest: [48, 64, 94, 116, 140, 148, 158, 142, 108, 78, 54, 44],
    solarNorth: [22, 29, 42, 54, 74, 86, 88, 68, 46, 32, 23, 19]
  },
  bormio: {
    id: 'bormio',
    name: 'Bormio, IT (Alpine Zone F)',
    koppen: 'Dfb',
    koppenDesc: 'Alpine Continental — High heating load, strong winter solar potential',
    hdd: 4120,
    cdd: 90,
    lat: 46.47,
    lon: 10.37,
    elev: 1225,
    runningMeanTemp: 17.5,
    monthlyTemp: [-2.4, -0.5, 3.4, 7.2, 11.8, 15.6, 17.8, 17.2, 13.4, 8.4, 2.6, -1.5],
    solarHoriz: [54, 78, 126, 152, 178, 192, 204, 176, 136, 92, 56, 46],
    solarSouth: [104, 118, 136, 118, 104, 98, 104, 114, 128, 116, 94, 90],
    solarEast: [36, 52, 84, 100, 116, 122, 130, 112, 88, 60, 36, 30],
    solarWest: [36, 52, 84, 100, 116, 122, 130, 112, 88, 60, 36, 30],
    solarNorth: [16, 24, 38, 48, 64, 74, 76, 56, 38, 26, 17, 14]
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

