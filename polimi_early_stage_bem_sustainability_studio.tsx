/// <reference lib="es2020" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Building2,
  Sun,
  Wind,
  Thermometer,
  Layers,
  Recycle,
  BarChart3,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookmarkPlus,
  RotateCcw,
  FileText,
  Zap,
  Flame,
  Snowflake,
  Sliders,
  Maximize2,
  ShieldCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';

// ============================================================================
// REFERENCE DATASETS (CLIMATE ZONES, ARCHETYPES, HVAC & LCA MATERIALS)
// ============================================================================

const CLIMATE_PRESETS = {
  mantova: {
    id: 'mantova',
    name: 'Mantova / Milan, IT',
    koppen: 'Cfa',
    koppenDesc: 'Humid Subtropical (Po Valley)',
    hdd: 2410,
    cdd: 490,
    lat: 45.16,
    runningMeanTemp: 23.5,
    // Monthly mean outdoor temp (°C) Jan-Dec
    monthlyTemp: [2.4, 4.8, 9.5, 13.6, 18.4, 22.8, 25.1, 24.4, 19.6, 13.9, 7.8, 3.3],
    // Monthly solar irradiance (kWh/m2/month) by surface orientation
    solarHoriz: [38, 58, 102, 138, 176, 192, 204, 172, 122, 74, 42, 32],
    solarSouth: [68, 86, 108, 98, 92, 88, 96, 108, 114, 96, 66, 58],
    solarEast: [26, 42, 72, 92, 112, 118, 124, 106, 78, 48, 28, 22],
    solarWest: [26, 42, 70, 90, 110, 116, 122, 108, 80, 50, 28, 22],
    solarNorth: [14, 22, 36, 52, 72, 84, 82, 62, 42, 26, 16, 12]
  },
  rome: {
    id: 'rome',
    name: 'Rome, IT',
    koppen: 'Csa',
    koppenDesc: 'Mediterranean Hot Summer',
    hdd: 1415,
    cdd: 820,
    lat: 41.90,
    runningMeanTemp: 26.2,
    monthlyTemp: [7.8, 8.7, 11.4, 14.2, 18.8, 22.9, 25.8, 26.1, 21.8, 17.2, 12.3, 8.9],
    solarHoriz: [58, 78, 124, 158, 198, 214, 226, 196, 144, 98, 64, 50],
    solarSouth: [98, 112, 126, 108, 96, 88, 96, 116, 132, 124, 98, 88],
    solarEast: [38, 54, 84, 104, 126, 132, 138, 122, 94, 66, 42, 34],
    solarWest: [38, 54, 84, 104, 124, 130, 136, 124, 96, 68, 42, 34],
    solarNorth: [18, 26, 42, 56, 76, 88, 86, 66, 46, 30, 20, 16]
  },
  stockholm: {
    id: 'stockholm',
    name: 'Stockholm, SE',
    koppen: 'Dfb',
    koppenDesc: 'Warm-Summer Humid Continental',
    hdd: 3980,
    cdd: 85,
    lat: 59.33,
    runningMeanTemp: 18.0,
    monthlyTemp: [-2.8, -3.1, 0.4, 5.5, 11.2, 15.8, 18.4, 17.2, 12.4, 7.1, 2.1, -1.4],
    solarHoriz: [10, 28, 68, 116, 164, 178, 172, 132, 78, 36, 12, 6],
    solarSouth: [34, 66, 108, 118, 116, 108, 110, 108, 96, 64, 32, 22],
    solarEast: [8, 22, 54, 86, 114, 120, 116, 92, 56, 26, 10, 5],
    solarWest: [8, 22, 54, 86, 112, 118, 116, 94, 58, 26, 10, 5],
    solarNorth: [4, 10, 24, 44, 68, 84, 78, 52, 28, 12, 5, 3]
  },
  cairo: {
    id: 'cairo',
    name: 'Cairo, EG',
    koppen: 'BWh',
    koppenDesc: 'Hot Arid Desert',
    hdd: 310,
    cdd: 2180,
    lat: 30.04,
    runningMeanTemp: 29.5,
    monthlyTemp: [14.1, 15.6, 18.5, 22.4, 26.3, 28.9, 29.6, 29.4, 27.5, 24.3, 19.6, 15.4],
    solarHoriz: [112, 134, 178, 206, 234, 246, 244, 224, 190, 156, 120, 104],
    solarSouth: [154, 148, 136, 102, 78, 68, 72, 94, 128, 152, 154, 152],
    solarEast: [68, 84, 112, 128, 142, 148, 146, 136, 118, 98, 74, 64],
    solarWest: [68, 84, 112, 128, 142, 148, 146, 136, 118, 98, 74, 64],
    solarNorth: [26, 34, 48, 64, 84, 96, 92, 72, 52, 38, 28, 24]
  },
  zurich: {
    id: 'zurich',
    name: 'Zurich, CH',
    koppen: 'Cfb',
    koppenDesc: 'Temperate Oceanic / Alpine Foothills',
    hdd: 3120,
    cdd: 210,
    lat: 47.37,
    runningMeanTemp: 20.5,
    monthlyTemp: [0.3, 1.5, 5.8, 9.6, 14.1, 17.6, 19.5, 19.1, 14.8, 10.1, 4.6, 1.4],
    solarHoriz: [28, 48, 88, 126, 158, 172, 180, 152, 104, 58, 30, 22],
    solarSouth: [52, 74, 102, 98, 92, 86, 92, 102, 104, 80, 52, 42],
    solarEast: [18, 34, 62, 84, 104, 110, 114, 96, 68, 38, 20, 15],
    solarWest: [18, 34, 62, 84, 102, 108, 112, 98, 70, 38, 20, 15],
    solarNorth: [10, 18, 32, 48, 68, 78, 76, 56, 36, 20, 12, 9]
  }
};

const PROGRAM_ARCHETYPES = {
  residential: {
    id: 'residential',
    name: 'Residential (Multi-Family)',
    occGain: 2.8,      // W/m2
    lightGain: 3.5,    // W/m2
    equipGain: 4.2,    // W/m2
    heatSetpoint: 20,  // °C
    coolSetpoint: 26,  // °C
    scheduleFactor: 0.75,
    desc: 'Continuous occupancy profile, moderate internal gains (ISO 18523 / UNI/TS 11300)'
  },
  office: {
    id: 'office',
    name: 'Office / Administrative',
    occGain: 6.0,
    lightGain: 8.0,
    equipGain: 12.0,
    heatSetpoint: 20,
    coolSetpoint: 26,
    scheduleFactor: 0.55,
    desc: 'Daytime weekday profile, high equipment & lighting density (ASHRAE 90.1 / SIA 2024)'
  },
  commercial: {
    id: 'commercial',
    name: 'Commercial / Retail',
    occGain: 8.5,
    lightGain: 14.0,
    equipGain: 8.0,
    heatSetpoint: 19,
    coolSetpoint: 25,
    scheduleFactor: 0.65,
    desc: 'High lighting & visitor sensible loads, extended daytime operation'
  },
  hotel: {
    id: 'hotel',
    name: 'Hotel / Hospitality',
    occGain: 4.0,
    lightGain: 6.0,
    equipGain: 6.5,
    heatSetpoint: 21,
    coolSetpoint: 25,
    scheduleFactor: 0.80,
    desc: '24/7 operation with peak evening/morning thermal and DHW demand'
  },
  service: {
    id: 'service',
    name: 'Educational / University',
    occGain: 11.0,
    lightGain: 9.0,
    equipGain: 7.5,
    heatSetpoint: 20,
    coolSetpoint: 26,
    scheduleFactor: 0.50,
    desc: 'High occupancy density during academic hours, high ventilation needs'
  }
};

const HVAC_SYSTEMS = {
  heatpump: {
    id: 'heatpump',
    name: 'Air-to-Water Heat Pump (All-Electric)',
    heatEff: 3.4, // SCOP
    coolEff: 4.0, // SEER
    fuelType: 'electricity',
    primaryFactorHeat: 1.95, // Italian / EU grid non-renewable + renewable factor approx
    primaryFactorCool: 1.95,
    co2FactorHeat: 0.25,     // kgCO2e/kWh electricity
    co2FactorCool: 0.25,
    costFactorHeat: 0.24,    // €/kWh
    costFactorCool: 0.24
  },
  boiler_chiller: {
    id: 'boiler_chiller',
    name: 'Condensing Gas Boiler + Electric Chiller',
    heatEff: 0.94, // η_th
    coolEff: 3.2,  // SEER
    fuelType: 'mixed',
    primaryFactorHeat: 1.05,
    primaryFactorCool: 1.95,
    co2FactorHeat: 0.202,    // kgCO2e/kWh natural gas
    co2FactorCool: 0.25,
    costFactorHeat: 0.11,    // €/kWh gas
    costFactorCool: 0.24
  },
  district: {
    id: 'district',
    name: 'District Heating (CHP) + High-Eff Chiller',
    heatEff: 0.96,
    coolEff: 4.2,
    fuelType: 'district',
    primaryFactorHeat: 0.80,
    primaryFactorCool: 1.95,
    co2FactorHeat: 0.14,
    co2FactorCool: 0.25,
    costFactorHeat: 0.13,
    costFactorCool: 0.24
  },
  gshp: {
    id: 'gshp',
    name: 'Ground-Source Heat Pump (Geothermal)',
    heatEff: 4.5, // SCOP
    coolEff: 5.2, // SEER
    fuelType: 'electricity',
    primaryFactorHeat: 1.95,
    primaryFactorCool: 1.95,
    co2FactorHeat: 0.25,
    co2FactorCool: 0.25,
    costFactorHeat: 0.24,
    costFactorCool: 0.24
  }
};

const STRUCTURAL_SYSTEMS = {
  timber: {
    id: 'timber',
    name: 'Mass Timber (CLT + Glulam Frame)',
    a1a3: 115,      // kgCO2e/m2 GFA upfront product stage
    biogenic: -140, // Biogenic carbon storage credit (sequestered)
    a4a5: 18,
    c1c4: 22,
    reversibilityBase: 85,
    thermalMassCap: 110, // kJ/m2K internal areal heat capacity
    desc: 'Renewable bio-based structure, high dry-assembly speed & carbon sequestration'
  },
  steel: {
    id: 'steel',
    name: 'Structural Steel Frame + Composite Deck',
    a1a3: 245,
    biogenic: 0,
    a4a5: 24,
    c1c4: 18,
    reversibilityBase: 78,
    thermalMassCap: 95,
    desc: 'High strength-to-weight ratio, bolted dry connections ideal for deconstruction'
  },
  concrete: {
    id: 'concrete',
    name: 'Reinforced Concrete Frame (Cast In-Situ)',
    a1a3: 320,
    biogenic: 0,
    a4a5: 38,
    c1c4: 42,
    reversibilityBase: 25,
    thermalMassCap: 175,
    desc: 'High thermal inertia (time shift), high upfront clinker embodied carbon & wet joints'
  },
  brick: {
    id: 'brick',
    name: 'Load-Bearing Clay Brick Masonry + RC Slabs',
    a1a3: 275,
    biogenic: 0,
    a4a5: 32,
    c1c4: 36,
    reversibilityBase: 30,
    thermalMassCap: 160,
    desc: 'Traditional masonry envelope, good thermal lag, limited structural adaptability'
  }
};

const ENVELOPE_SYSTEMS = {
  offsite: {
    id: 'offsite',
    name: 'Off-Site Prefabricated Modular Unitized Facade',
    embodiedAdd: 58, // kgCO2e/m2 GFA
    replacementCycle: 30,
    wasteReduction: 0.85,
    reversibilityBonus: 20,
    desc: 'Dry mechanical brackets (like Course Slide 15), low site waste, easy panel swap'
  },
  onsite: {
    id: 'onsite',
    name: 'On-Site Traditional Wet-Applied ETICS & Infills',
    embodiedAdd: 82,
    replacementCycle: 25,
    wasteReduction: 1.0,
    reversibilityBonus: 0,
    desc: 'Mortar & adhesive layers, higher construction waste, difficult end-of-life separation'
  }
};

const INSULATION_MATERIALS = {
  woodfiber: { id: 'woodfiber', name: 'Wood Fiber / Hemp (Bio-based)', embodied: 12, lambda: 0.038, bioBonus: -18 },
  mineralwool: { id: 'mineralwool', name: 'Rock / Mineral Wool', embodied: 28, lambda: 0.035, bioBonus: 0 },
  cellulose: { id: 'cellulose', name: 'Recycled Cellulose Fiber', embodied: 10, lambda: 0.039, bioBonus: -12 },
  eps: { id: 'eps', name: 'EPS / XPS Petrochemical Foam', embodied: 54, lambda: 0.032, bioBonus: 0 }
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function SustainabilityStudioApp() {
  const [activeTab, setActiveTab] = useState('box');
  const [savedScenario, setSavedScenario] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // --- TAB 1 STATE: SIMPLE BOX & ZONING ---
  const [climateId, setClimateId] = useState('mantova');
  const [programId, setProgramId] = useState('office');
  const [length, setLength] = useState(36);          // m (East-West axis at 0° rot)
  const [width, setWidth] = useState(20);            // m (North-South axis at 0° rot)
  const [floors, setFloors] = useState(4);
  const [floorHeight, setFloorHeight] = useState(3.5); // m
  const [orientation, setOrientation] = useState(0);   // deg from North
  const [perimeterDepth, setPerimeterDepth] = useState(4.5); // ASHRAE 90.1 offset (3m-5m)
  const [wwrNorth, setWwrNorth] = useState(25);
  const [wwrSouth, setWwrSouth] = useState(50);
  const [wwrEast, setWwrEast] = useState(30);
  const [wwrWest, setWwrWest] = useState(30);

  // --- TAB 2 STATE: STATIONARY ENERGY BALANCE ---
  const [uWall, setUWall] = useState(0.24);          // W/m2K
  const [uRoof, setURoof] = useState(0.20);          // W/m2K
  const [uFloor, setUFloor] = useState(0.26);        // W/m2K
  const [uWin, setUWin] = useState(1.30);            // W/m2K
  const [shgc, setShgc] = useState(0.45);            // g-value
  const [shadingFactor, setShadingFactor] = useState(0.65); // 1 = no shade, 0.3 = heavy louvers
  const [ach, setAch] = useState(0.6);               // Air changes per hour (h^-1)
  const [mvhrEff, setMvhrEff] = useState(75);        // % Heat recovery efficiency
  const [hvacId, setHvacId] = useState('heatpump');
  const [pvRoofPct, setPvRoofPct] = useState(35);    // % of roof covered by PV

  // --- TAB 3 STATE: INDOOR COMFORT (EN 16798 / FANGER PMV) ---
  const [comfortMode, setComfortMode] = useState('pmv'); // 'pmv' or 'adaptive'
  const [airTemp, setAirTemp] = useState(23.5);      // °C
  const [radTemp, setRadTemp] = useState(23.0);      // °C
  const [airSpeed, setAirSpeed] = useState(0.12);    // m/s
  const [relHumidity, setRelHumidity] = useState(50);// %
  const [metRate, setMetRate] = useState(1.2);       // met
  const [cloValue, setCloValue] = useState(0.7);     // clo
  const [runningMeanOutdoor, setRunningMeanOutdoor] = useState(23.5); // °C

  // --- TAB 4 STATE: WHOLE-LIFE CARBON LCA & 5Rs ---
  const [structId, setStructId] = useState('timber');
  const [envTypeId, setEnvTypeId] = useState('offsite');
  const [insulId, setInsulId] = useState('woodfiber');
  const [studyPeriod, setStudyPeriod] = useState(50); // years
  const [fiveRs, setFiveRs] = useState({
    refuse: true,     // Expose structure / eliminate suspended ceilings & redundant finishes
    reduce: true,     // Structural grid & slab thickness optimization (-12% material mass)
    reuse: true,      // Reversible bolted joints for facade/structure reuse (DfD)
    repurpose: false, // Flexible core & floor-to-floor height for future function change
    recycle: true     // High secondary raw material content & end-of-life sorting protocol
  });

  // ==========================================================================
  // CORE PHYSICS & ENGINEERING ENGINE (REAL-TIME CALCULATIONS)
  // ==========================================================================

  const climate = CLIMATE_PRESETS[climateId];
  const program = PROGRAM_ARCHETYPES[programId];
  const hvac = HVAC_SYSTEMS[hvacId];
  const structure = STRUCTURAL_SYSTEMS[structId];
  const envelopeSys = ENVELOPE_SYSTEMS[envTypeId];
  const insulation = INSULATION_MATERIALS[insulId];

  // 1. GEOMETRY & THERMAL ZONING (ASHRAE 209 / 90.1 Appendix G)
  const geometry = useMemo(() => {
    const footprintArea = length * width;
    const gfa = footprintArea * floors;
    const totalHeight = floors * floorHeight;
    const volume = gfa * floorHeight;

    // Facade gross areas
    const areaNorthGross = length * totalHeight;
    const areaSouthGross = length * totalHeight;
    const areaEastGross = width * totalHeight;
    const areaWestGross = width * totalHeight;
    const totalWallGross = areaNorthGross + areaSouthGross + areaEastGross + areaWestGross;

    // Window areas per facade
    const winNorth = areaNorthGross * (wwrNorth / 100);
    const winSouth = areaSouthGross * (wwrSouth / 100);
    const winEast = areaEastGross * (wwrEast / 100);
    const winWest = areaWestGross * (wwrWest / 100);
    const totalWinArea = winNorth + winSouth + winEast + winWest;
    const opaqueWallArea = totalWallGross - totalWinArea;
    const avgWwr = (totalWinArea / totalWallGross) * 100;

    // Total Thermal Envelope Area (Walls + Roof + Ground Floor)
    const totalEnvelopeArea = totalWallGross + 2 * footprintArea;
    const svRatio = totalEnvelopeArea / volume; // m^-1 Compactness indicator

    // Perimeter vs Core Zoning (Autozoner trapezoid logic per floor)
    const effPerim = Math.min(perimeterDepth, Math.min(length, width) / 2 - 0.5);
    const coreLength = Math.max(0, length - 2 * effPerim);
    const coreWidth = Math.max(0, width - 2 * effPerim);
    const coreAreaFloor = coreLength * coreWidth;
    const perimAreaFloor = footprintArea - coreAreaFloor;

    // Trapezoid perimeter zones areas per floor
    const zoneNorthSouthFloor = ((length + coreLength) / 2) * effPerim;
    const zoneEastWestFloor = ((width + coreWidth) / 2) * effPerim;

    return {
      footprintArea,
      gfa,
      totalHeight,
      volume,
      totalWallGross,
      winNorth,
      winSouth,
      winEast,
      winWest,
      totalWinArea,
      opaqueWallArea,
      avgWwr,
      totalEnvelopeArea,
      svRatio,
      effPerim,
      coreLength,
      coreWidth,
      coreAreaFloor,
      perimAreaFloor,
      coreSharePct: (coreAreaFloor / footprintArea) * 100,
      zoneNorthSouthFloor,
      zoneEastWestFloor
    };
  }, [length, width, floors, floorHeight, perimeterDepth, wwrNorth, wwrSouth, wwrEast, wwrWest]);

  // 2. QUASI-STEADY-STATE MONTHLY ENERGY BALANCE (ISO 52000-1 / UNI/TS 11300 / CIBSE TM54)
  const energyBalance = useMemo(() => {
    // Heat transfer coefficients H_tr and H_ve (W/K)
    // Include minor thermal bridging surcharge (+8%)
    const tbFactor = 1.08;
    const H_wall = geometry.opaqueWallArea * uWall * tbFactor;
    const H_roof = geometry.footprintArea * uRoof * tbFactor;
    const H_floor = geometry.footprintArea * uFloor * 0.7; // Ground temperature reduction factor b_tr,g ~ 0.7
    const H_win = geometry.totalWinArea * uWin;
    const H_tr = H_wall + H_roof + H_floor + H_win; // Total Transmission (W/K)

    // Ventilation heat transfer coefficient H_ve (W/K)
    // rho_a * c_a ≈ 0.34 Wh/(m3K)
    const effectiveAch = ach * (1 - (mvhrEff / 100) * 0.85); // Accounting for infiltration bypass
    const H_ve = 0.34 * geometry.volume * effectiveAch;

    // Building time constant tau (hours) = C_m / (H_tr + H_ve)
    // Internal heat capacity C_m (Wh/K) from structural system
    const C_m_WhK = (structure.thermalMassCap * 1000 / 3600) * geometry.gfa;
    const tau = C_m_WhK / (H_tr + H_ve);
    const a_H = 1 + tau / 15; // ISO 13790 numerical parameter

    // Orientation rotation adjustment for solar radiation on facades
    // Interpolate solar irradiance based on orientation angle (0, 90, 180, 270)
    const radAngle = ((orientation % 360) + 360) % 360;
    const getRotatedSolar = (mIdx, baseDirDeg) => {
      const actualDeg = (baseDirDeg + radAngle) % 360;
      const dirs = [
        { deg: 0, val: climate.solarNorth[mIdx] },
        { deg: 90, val: climate.solarEast[mIdx] },
        { deg: 180, val: climate.solarSouth[mIdx] },
        { deg: 270, val: climate.solarWest[mIdx] },
        { deg: 360, val: climate.solarNorth[mIdx] }
      ];
      for (let i = 0; i < dirs.length - 1; i++) {
        if (actualDeg >= dirs[i].deg && actualDeg <= dirs[i + 1].deg) {
          const t = (actualDeg - dirs[i].deg) / 90;
          return dirs[i].val * (1 - t) + dirs[i + 1].val * t;
        }
      }
      return climate.solarSouth[mIdx];
    };

    // Internal gains power density (W/m2)
    const qIntTotalWm2 = (program.occGain + program.lightGain + program.equipGain) * program.scheduleFactor;

    const monthlyData = MONTHS.map((mName, idx) => {
      const hoursInMonth = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744][idx];
      const kwhToHours = hoursInMonth / 1000;
      const T_ext = climate.monthlyTemp[idx];

      // Heating Delta T & Cooling Delta T
      const dT_heat = Math.max(0, program.heatSetpoint - T_ext);
      const dT_cool = Math.max(0, T_ext - (program.coolSetpoint - 3)); // Daytime solar-driven cooling threshold

      // Monthly Heat Losses (kWh)
      const Q_tr_heat = H_tr * dT_heat * kwhToHours;
      const Q_ve_heat = H_ve * dT_heat * kwhToHours;
      const Q_ht_loss = Q_tr_heat + Q_ve_heat;

      // Solar Gains (kWh) = Sum(I_sol,k * A_win,k) * g_gl * 0.9 (frame factor) * shading
      const effG = shgc * 0.85 * shadingFactor;
      const solN = getRotatedSolar(idx, 0) * geometry.winNorth * effG;
      const solE = getRotatedSolar(idx, 90) * geometry.winEast * effG;
      const solS = getRotatedSolar(idx, 180) * geometry.winSouth * effG;
      const solW = getRotatedSolar(idx, 270) * geometry.winWest * effG;
      const Q_sol = solN + solE + solS + solW;

      // Internal Gains (kWh)
      const Q_int = qIntTotalWm2 * geometry.gfa * kwhToHours;
      const Q_gn = Q_sol + Q_int;

      // Gain-to-loss ratio gamma_H & Utilization factor eta_H,gn (ISO 13790)
      const gamma_H = Q_ht_loss > 1 ? Q_gn / Q_ht_loss : 10;
      let eta_H = 1.0;
      if (gamma_H > 0 && Math.abs(gamma_H - 1) > 1e-4) {
        eta_H = (1 - Math.pow(gamma_H, a_H)) / (1 - Math.pow(gamma_H, a_H + 1));
      } else if (Math.abs(gamma_H - 1) <= 1e-4) {
        eta_H = a_H / (a_H + 1);
      }

      // Monthly Net Heating Need (kWh)
      const Q_H_nd = Math.max(0, Q_ht_loss - eta_H * Q_gn);

      // Cooling balance: heat rejection during warm months
      const dT_reject = Math.max(0, program.coolSetpoint - T_ext);
      const Q_ht_reject = (H_tr + H_ve) * dT_reject * kwhToHours;
      const lambda_C = Q_gn > 1 ? Q_ht_reject / Q_gn : 10;
      let eta_C = 1.0;
      if (lambda_C > 0 && Math.abs(lambda_C - 1) > 1e-4) {
        eta_C = (1 - Math.pow(lambda_C, a_H)) / (1 - Math.pow(lambda_C, a_H + 1));
      } else if (Math.abs(lambda_C - 1) <= 1e-4) {
        eta_C = a_H / (a_H + 1);
      }
      const Q_C_nd = T_ext > 13.5 ? Math.max(0, Q_gn - eta_C * Q_ht_reject + (H_tr + H_ve) * dT_cool * kwhToHours * 0.35) : 0;

      // Rooftop PV Generation (kWh)
      // Assume 20% module efficiency & 0.80 system performance ratio
      const pvArea = geometry.footprintArea * (pvRoofPct / 100);
      const pvGen = climate.solarHoriz[idx] * pvArea * 0.20 * 0.82;

      return {
        month: mName,
        T_ext,
        Q_tr_heat: Q_tr_heat / geometry.gfa,
        Q_ve_heat: Q_ve_heat / geometry.gfa,
        Q_ht_loss: Q_ht_loss / geometry.gfa,
        Q_sol: Q_sol / geometry.gfa,
        Q_int: Q_int / geometry.gfa,
        eta_H,
        Q_H_nd: Q_H_nd / geometry.gfa,
        Q_C_nd: Q_C_nd / geometry.gfa,
        pvGen: pvGen / geometry.gfa
      };
    });

    // Annual specific totals (kWh/m2.yr)
    const sum = (key) => monthlyData.reduce((acc, m) => acc + m[key], 0);
    const annualTrLoss = sum('Q_tr_heat');
    const annualVeLoss = sum('Q_ve_heat');
    const annualSolGain = sum('Q_sol');
    const annualIntGain = sum('Q_int');
    const annualHeatNeed = sum('Q_H_nd');
    const annualCoolNeed = sum('Q_C_nd');
    const annualPvGen = sum('pvGen');

    // Component breakdown of transmission losses
    const wallShare = H_wall / H_tr;
    const winShare = H_win / H_tr;
    const roofFloorShare = (H_roof + H_floor) / H_tr;

    // Delivered Energy (kWh/m2.yr)
    const delivHeat = annualHeatNeed / hvac.heatEff;
    const delivCool = annualCoolNeed / hvac.coolEff;
    const delivLight = (program.lightGain * program.scheduleFactor * 8760) / 1000;
    const delivEquip = (program.equipGain * program.scheduleFactor * 8760) / 1000;

    // Total EUI (Site Energy Use Intensity before PV, and Net after PV)
    const totalSiteEui = delivHeat + delivCool + delivLight + delivEquip;
    const usablePv = Math.min(annualPvGen, totalSiteEui * 0.75); // Self-consumption + grid credit cap
    const netSiteEui = Math.max(0, totalSiteEui - usablePv);

    // Primary Energy (kWh_p/m2.yr)
    const primaryEnergy = Math.max(
      0,
      delivHeat * hvac.primaryFactorHeat +
      (delivCool + delivLight + delivEquip - usablePv) * hvac.primaryFactorCool
    );

    // Operational Carbon (kgCO2e/m2.yr) & Operational Cost (€/m2.yr)
    const opCarbonHeat = delivHeat * hvac.co2FactorHeat;
    const opCarbonElec = Math.max(0, delivCool + delivLight + delivEquip - usablePv) * hvac.co2FactorCool;
    const totalOpCarbon = opCarbonHeat + opCarbonElec;

    const opCostHeat = delivHeat * hvac.costFactorHeat;
    const opCostElec = Math.max(0, delivCool + delivLight + delivEquip - usablePv) * hvac.costFactorCool;
    const totalOpCost = opCostHeat + opCostElec;

    // Periodic thermal transmittance Y_ie & Time Shift check (Italian DM 26/06/2015)
    // Heavy thermal mass + low U-wall yields low Y_ie (< 0.10 W/m2K limit)
    const yIe = +(uWall * (180 / structure.thermalMassCap) * 0.28).toFixed(3);
    const timeShiftHours = +(structure.thermalMassCap / 13.5 + (0.3 / uWall) * 1.4).toFixed(1);

    return {
      H_tr,
      H_ve,
      tau,
      monthlyData,
      annualTrLoss,
      annualVeLoss,
      annualSolGain,
      annualIntGain,
      annualHeatNeed,
      annualCoolNeed,
      annualPvGen,
      usablePv,
      wallShare,
      winShare,
      roofFloorShare,
      delivHeat,
      delivCool,
      delivLight,
      delivEquip,
      totalSiteEui,
      netSiteEui,
      primaryEnergy,
      opCarbonHeat,
      opCarbonElec,
      totalOpCarbon,
      opCostHeat,
      opCostElec,
      totalOpCost,
      yIe,
      timeShiftHours
    };
  }, [
    geometry,
    uWall,
    uRoof,
    uFloor,
    uWin,
    shgc,
    shadingFactor,
    ach,
    mvhrEff,
    hvac,
    pvRoofPct,
    orientation,
    climate,
    program,
    structure
  ]);

  // 3. THERMAL COMFORT ENGINE (ISO 7730 FANGER PMV/PPD & EN 16798-1 ADAPTIVE)
  const comfortCalc = useMemo(() => {
    // Operative temperature T_op
    const tOp = 0.5 * airTemp + 0.5 * radTemp;

    // Saturation vapor pressure p_sat (Pa) & partial vapor pressure p_a (Pa)
    const pSat = 610.78 * Math.exp((17.27 * airTemp) / (airTemp + 237.3));
    const pA = (relHumidity / 100) * pSat;

    // Humidity ratio W (g_water / kg_dry_air) at standard 101325 Pa
    const humRatio = (622 * pA) / (101325 - pA);

    // Fanger PMV Calculation (ISO 7730)
    const M = metRate * 58.15; // W/m2
    const W = 0; // External mechanical work
    const MW = M - W;
    const Icl = cloValue * 0.155; // m2K/W
    const fcl = Icl <= 0.078 ? 1.0 + 1.29 * Icl : 1.05 + 0.645 * Icl;
    const hcf = 12.1 * Math.sqrt(Math.max(0.05, airSpeed));

    // Iterative calculation of clothing surface temperature Tcl (°C)
    let tcl = airTemp + (35.5 - airTemp) / (3.5 * Icl + 0.1);
    for (let i = 0; i < 40; i++) {
      const hcn = 2.38 * Math.pow(Math.abs(tcl - airTemp), 0.25);
      const hc = Math.max(hcf, hcn);
      const radTerm = 3.96e-8 * fcl * (Math.pow(tcl + 273, 4) - Math.pow(radTemp + 273, 4));
      const convTerm = fcl * hc * (tcl - airTemp);
      const tclNext = 35.7 - 0.028 * MW - Icl * (radTerm + convTerm);
      tcl = 0.5 * tcl + 0.5 * tclNext;
    }

    const hcnFinal = 2.38 * Math.pow(Math.abs(tcl - airTemp), 0.25);
    const hcFinal = Math.max(hcf, hcnFinal);

    // Heat loss components
    const hl1 = 3.05e-3 * (5733 - 6.99 * MW - pA); // Diffusion through skin
    const hl2 = MW > 58.15 ? 0.42 * (MW - 58.15) : 0; // Sweating
    const hl3 = 1.7e-5 * M * (5867 - pA); // Latent respiration
    const hl4 = 0.0014 * M * (34 - airTemp); // Dry respiration
    const hl5 = 3.96e-8 * fcl * (Math.pow(tcl + 273, 4) - Math.pow(radTemp + 273, 4)); // Radiation
    const hl6 = fcl * hcFinal * (tcl - airTemp); // Convection

    const ts = 0.303 * Math.exp(-0.036 * M) + 0.028;
    const pmv = ts * (MW - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
    const clampedPmv = Math.max(-3.0, Math.min(3.0, pmv));

    // PPD (%)
    const ppd = 100 - 95 * Math.exp(-0.03353 * Math.pow(clampedPmv, 4) - 0.2179 * Math.pow(clampedPmv, 2));

    // EN 16798-1 PMV Category
    const absPmv = Math.abs(clampedPmv);
    let category = 'Out of Range (IV)';
    let catColor = 'text-rose-600 bg-rose-50 border-rose-200';
    if (absPmv <= 0.2) {
      category = 'Category I (High Expectancy)';
      catColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (absPmv <= 0.5) {
      category = 'Category II (Normal Design)';
      catColor = 'text-teal-700 bg-teal-50 border-teal-200';
    } else if (absPmv <= 0.7) {
      category = 'Category III (Moderate Acceptability)';
      catColor = 'text-amber-700 bg-amber-50 border-amber-200';
    }

    // EN 16798-1 Adaptive Comfort Neutral Temperature: T_c = 0.33 * T_rm + 18.8
    const adaptiveNeutral = 0.33 * runningMeanOutdoor + 18.8;
    const adaptiveDiff = tOp - adaptiveNeutral;
    let adaptiveCat = 'Out of Range';
    if (adaptiveDiff >= -2.0 && adaptiveDiff <= 2.0) adaptiveCat = 'Class I (High)';
    else if (adaptiveDiff >= -3.0 && adaptiveDiff <= 3.0) adaptiveCat = 'Class II (Normal)';
    else if (adaptiveDiff >= -4.0 && adaptiveDiff <= 4.0) adaptiveCat = 'Class III (Moderate)';

    return {
      tOp,
      humRatio,
      pmv: clampedPmv,
      ppd,
      category,
      catColor,
      adaptiveNeutral,
      adaptiveCat
    };
  }, [airTemp, radTemp, airSpeed, relHumidity, metRate, cloValue, runningMeanOutdoor]);

  // 4. WHOLE-LIFE CARBON LCA & 5Rs CIRCULARITY ENGINE (EN 15978)
  const lcaCalc = useMemo(() => {
    // 5Rs Reduction multipliers
    const refuseFactor = fiveRs.refuse ? 0.90 : 1.0; // -10% finishes & ceilings
    const reduceFactor = fiveRs.reduce ? 0.88 : 1.0; // -12% structural material optimization
    const recycleFactor = fiveRs.recycle ? 0.86 : 1.0; // -14% upfront via recycled content

    // Upfront Embodied Carbon (A1-A3 Product + A4-A5 Construction) kgCO2e/m2
    const rawUpfront =
      (structure.a1a3 + structure.a4a5) * reduceFactor * recycleFactor +
      (envelopeSys.embodiedAdd + insulation.embodied) * refuseFactor * envelopeSys.wasteReduction;

    // Biogenic carbon storage (Module A1-A3 sequestered CO2 in timber & bio-insulation)
    const biogenicStorage = Math.abs(structure.biogenic + insulation.bioBonus);

    // In-use Replacement Embodied Carbon (Module B4) over Reference Study Period
    const numReplacements = Math.floor(studyPeriod / envelopeSys.replacementCycle);
    const repurposeFactor = fiveRs.repurpose ? 0.70 : 1.0; // Open-grid reduces fit-out churn
    const b4Replacement = numReplacements * (envelopeSys.embodiedAdd * 0.65 + 25) * repurposeFactor;

    // End-of-Life (C1-C4) & Module D Circularity Credit (Reuse + Recycle)
    const c1c4EndOfLife = structure.c1c4 * (fiveRs.reuse ? 0.65 : 1.0);
    const moduleDCredit =
      (fiveRs.reuse ? 55 : 15) +
      (fiveRs.recycle ? 35 : 10) +
      (envTypeId === 'offsite' ? 25 : 0);

    // Total Gross & Net Embodied Carbon (kgCO2e/m2)
    const grossEmbodied = rawUpfront + b4Replacement + c1c4EndOfLife;
    const netEmbodied = Math.max(40, grossEmbodied - moduleDCredit - biogenicStorage * 0.5);

    // Operational Carbon over Reference Study Period (Module B6)
    // Account for gradual grid decarbonization over study period (0.82 average multiplier)
    const cumulativeOpCarbon = energyBalance.totalOpCarbon * studyPeriod * 0.85;

    // Total Whole-Life Carbon (kgCO2e/m2 and total metric tons CO2e)
    const wholeLifeCarbonPerM2 = netEmbodied + cumulativeOpCarbon;
    const totalBuildingTonnes = (wholeLifeCarbonPerM2 * geometry.gfa) / 1000;

    // Circularity & Reversibility Index (0 - 100%)
    const activeRsCount = Object.values(fiveRs).filter(Boolean).length;
    const circularityScore = Math.min(
      100,
      Math.round(
        structure.reversibilityBase * 0.45 +
        envelopeSys.reversibilityBonus +
        activeRsCount * 9 +
        (insulId === 'woodfiber' || insulId === 'cellulose' ? 8 : 0)
      )
    );

    return {
      rawUpfront,
      biogenicStorage,
      b4Replacement,
      c1c4EndOfLife,
      moduleDCredit,
      grossEmbodied,
      netEmbodied,
      cumulativeOpCarbon,
      wholeLifeCarbonPerM2,
      totalBuildingTonnes,
      circularityScore,
      embodiedSharePct: (netEmbodied / wholeLifeCarbonPerM2) * 100,
      operationalSharePct: (cumulativeOpCarbon / wholeLifeCarbonPerM2) * 100
    };
  }, [structure, envelopeSys, insulation, studyPeriod, fiveRs, energyBalance.totalOpCarbon, geometry.gfa, envTypeId, insulId]);

  // Save current state as Baseline Scenario (ClimaPlus style)
  const handleSaveScenario = () => {
    setSavedScenario({
      name: `${climate.name.split(',')[0]} - ${program.name.split(' ')[0]}`,
      svRatio: geometry.svRatio,
      heatNeed: energyBalance.annualHeatNeed,
      coolNeed: energyBalance.annualCoolNeed,
      netSiteEui: energyBalance.netSiteEui,
      primaryEnergy: energyBalance.primaryEnergy,
      totalOpCarbon: energyBalance.totalOpCarbon,
      wholeLifeCarbon: lcaCalc.wholeLifeCarbonPerM2,
      circularityScore: lcaCalc.circularityScore
    });
  };

  // Reset to baseline defaults
  const handleResetDefaults = () => {
    setClimateId('mantova');
    setProgramId('office');
    setLength(36);
    setWidth(20);
    setFloors(4);
    setFloorHeight(3.5);
    setOrientation(0);
    setPerimeterDepth(4.5);
    setWwrNorth(25);
    setWwrSouth(50);
    setWwrEast(30);
    setWwrWest(30);
    setUWall(0.24);
    setURoof(0.20);
    setUFloor(0.26);
    setUWin(1.30);
    setShgc(0.45);
    setShadingFactor(0.65);
    setAch(0.6);
    setMvhrEff(75);
    setHvacId('heatpump');
    setPvRoofPct(35);
    setStructId('timber');
    setEnvTypeId('offsite');
    setInsulId('woodfiber');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* =================================================================== */}
      {/* TOP ACADEMIC HEADER & GLOBAL KPI RIBBON                             */}
      {/* =================================================================== */}
      <header className="bg-slate-900 text-white border-b border-slate-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold text-lg">
              PM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                  Politecnico di Milano 1863 • D.ABC
                </span>
                <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  ASHRAE 209 • CIBSE TM54 • EN 16798 • EN 15978
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Sustainability & Built Environment — Early-Stage Design Studio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveScenario}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition shadow-sm"
              title="Save current configuration as Baseline Scenario to compare design iterations"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              {savedScenario ? 'Update Baseline' : 'Save Baseline'}
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition"
            >
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              WeBeep Summary
            </button>
            <button
              onClick={handleResetDefaults}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
              title="Reset all inputs to default values"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-Time Cross-Module KPI Ribbon */}
        <div className="bg-slate-800/90 border-t border-slate-700/80">
          <div className="max-w-7xl mx-auto px-4 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-slate-400">Climate & Program</span>
              <span className="font-semibold text-white truncate">
                {climate.koppen} ({climate.name.split(',')[0]}) • {program.name.split(' ')[0]}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">GFA & Compactness (S/V)</span>
              <span className="font-semibold text-teal-300">
                {geometry.gfa.toLocaleString()} m² • {geometry.svRatio.toFixed(2)} m⁻¹
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Heating / Cooling Need</span>
              <span className="font-semibold text-amber-300">
                {energyBalance.annualHeatNeed.toFixed(1)} / {energyBalance.annualCoolNeed.toFixed(1)} kWh/m²y
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Net EUI & Primary Energy</span>
              <span className="font-semibold text-sky-300">
                {energyBalance.netSiteEui.toFixed(1)} EUI • {energyBalance.primaryEnergy.toFixed(1)} kWh_p
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">EN 16798 Comfort</span>
              <span className="font-semibold text-emerald-300">
                PMV {comfortCalc.pmv >= 0 ? `+${comfortCalc.pmv.toFixed(2)}` : comfortCalc.pmv.toFixed(2)} (PPD {comfortCalc.ppd.toFixed(0)}%)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400">Whole-Life Carbon ({studyPeriod}y)</span>
              <span className="font-semibold text-purple-300">
                {lcaCalc.wholeLifeCarbonPerM2.toFixed(0)} kgCO₂e/m² • {lcaCalc.circularityScore}% Circ.
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* NAVIGATION TABS (4 INTEGRATED COURSE MODULES)                       */}
      {/* =================================================================== */}
      <div className="max-w-7xl mx-auto px-4 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <button
            onClick={() => setActiveTab('box')}
            className={`flex items-center gap-3 p-3 rounded-lg text-left transition ${
              activeTab === 'box'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'box' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-100 text-slate-600'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                1. ASHRAE 209 / UBEM
              </div>
              <div className="font-bold text-sm">Simple Box & Zoning</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('energy')}
            className={`flex items-center gap-3 p-3 rounded-lg text-left transition ${
              activeTab === 'energy'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'energy' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-100 text-slate-600'}`}>
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                2. CIBSE TM54 / ISO 52000
              </div>
              <div className="font-bold text-sm">Stationary Energy Balance</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('comfort')}
            className={`flex items-center gap-3 p-3 rounded-lg text-left transition ${
              activeTab === 'comfort'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'comfort' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-100 text-slate-600'}`}>
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                3. CBE Tool / EN 16798-1
              </div>
              <div className="font-bold text-sm">Indoor Comfort (PMV/PPD)</div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('lca')}
            className={`flex items-center gap-3 p-3 rounded-lg text-left transition ${
              activeTab === 'lca'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className={`p-2 rounded-lg ${activeTab === 'lca' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-100 text-slate-600'}`}>
              <Recycle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                4. EN 15978 / 5Rs Module
              </div>
              <div className="font-bold text-sm">Whole-Life Carbon & 5Rs</div>
            </div>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MAIN CONTENT CONTAINER                                              */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ================================================================= */}
        {/* TAB 1: SIMPLE BOX & ZONING (ASHRAE 209 / UBEM)                    */}
        {/* ================================================================= */}
        {activeTab === 'box' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT CONTROLS (5 COLS) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Climate & Archetype Selection */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    Climate Context & Building End-Use
                  </h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Köppen: {climate.koppen}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Reference Weather Station (EPW / Köppen-Geiger)
                  </label>
                  <select
                    value={climateId}
                    onChange={(e) => {
                      setClimateId(e.target.value);
                      setRunningMeanOutdoor(CLIMATE_PRESETS[e.target.value].runningMeanTemp);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Object.values(CLIMATE_PRESETS).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — [{c.koppen}] (HDD: {c.hdd}, CDD: {c.cdd})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {climate.koppenDesc} • Latitude {climate.lat}°N • Annual South Irrad.:{' '}
                    {climate.solarSouth.reduce((a, b) => a + b, 0)} kWh/m²
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Architectural Program / End-Use Archetype (SIA 2024 / ISO 18523)
                  </label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Object.values(PROGRAM_ARCHETYPES).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Occupancy</span>
                      <span className="font-bold text-slate-700">{program.occGain} W/m²</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Lighting</span>
                      <span className="font-bold text-slate-700">{program.lightGain} W/m²</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Equipment</span>
                      <span className="font-bold text-slate-700">{program.equipGain} W/m²</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footprint Dimensions & Orientation */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-teal-600" />
                    Morphology, Massing & Zoning Offset
                  </h2>
                  <span className="text-xs text-slate-500">ASHRAE 209 Cycle #1</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Length (L)</span>
                      <span className="font-bold text-slate-900">{length} m</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="80"
                      step="2"
                      value={length}
                      onChange={(e) => setLength(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Width (W)</span>
                      <span className="font-bold text-slate-900">{width} m</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      step="2"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Floors</span>
                      <span className="font-bold text-slate-900">{floors} storeys</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={floors}
                      onChange={(e) => setFloors(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Floor-to-Floor Ht</span>
                      <span className="font-bold text-slate-900">{floorHeight.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min="2.8"
                      max="5.0"
                      step="0.1"
                      value={floorHeight}
                      onChange={(e) => setFloorHeight(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Orientation Azimuth</span>
                      <span className="font-bold text-teal-700">{orientation}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="355"
                      step="5"
                      value={orientation}
                      onChange={(e) => setOrientation(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Perimeter Zone Depth</span>
                      <span className="font-bold text-teal-700">{perimeterDepth.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="5.0"
                      step="0.5"
                      value={perimeterDepth}
                      onChange={(e) => setPerimeterDepth(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Facade Window-to-Wall Ratio (WWR %) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h2 className="font-bold text-slate-800 text-sm">
                    Window-to-Wall Ratio (WWR %) per Facade
                  </h2>
                  <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                    Avg WWR: {geometry.avgWwr.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'South Facade', val: wwrSouth, set: setWwrSouth, area: geometry.winSouth },
                    { label: 'North Facade', val: wwrNorth, set: setWwrNorth, area: geometry.winNorth },
                    { label: 'East Facade', val: wwrEast, set: setWwrEast, area: geometry.winEast },
                    { label: 'West Facade', val: wwrWest, set: setWwrWest, area: geometry.winWest }
                  ].map((f) => (
                    <div key={f.label} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>{f.label}</span>
                        <span className="text-sky-700">{f.val}% ({f.area.toFixed(0)} m²)</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="85"
                        step="5"
                        value={f.val}
                        onChange={(e) => f.set(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT VISUALS (7 COLS) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Geometric KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Gross Floor Area</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {geometry.gfa.toLocaleString()} m²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Footprint: {geometry.footprintArea} m² × {floors}F
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Shape Factor (S/V)</div>
                  <div className="text-xl font-bold text-teal-600 mt-0.5">
                    {geometry.svRatio.toFixed(3)} m⁻¹
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {geometry.svRatio < 0.35 ? 'High Compactness' : geometry.svRatio < 0.55 ? 'Moderate Compactness' : 'Exposed Form'}
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Total Glazed Area</div>
                  <div className="text-xl font-bold text-sky-600 mt-0.5">
                    {geometry.totalWinArea.toFixed(0)} m²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Opaque Wall: {geometry.opaqueWallArea.toFixed(0)} m²
                  </div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Core vs. Perimeter</div>
                  <div className="text-xl font-bold text-indigo-600 mt-0.5">
                    {geometry.coreSharePct.toFixed(0)}% / {(100 - geometry.coreSharePct).toFixed(0)}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Daylit Perim: {geometry.perimAreaFloor.toFixed(0)} m²/fl
                  </div>
                </div>
              </div>

              {/* Interactive 2D Floorplate Thermal Zoning Diagram */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Compass className="w-4 h-4 text-teal-600" />
                      Interactive 2D Floorplate — ASHRAE 90.1 / Autozoner Thermal Zoning
                    </h3>
                    <p className="text-xs text-slate-500">
                      Automatic 5-zone subdivision (4 Perimeter Daylit/Exposed Zones + 1 Internal Core Zone) with WWR glazing bars
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-400 inline-block"></span>
                      South Zone
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-sky-100 border border-sky-400 inline-block"></span>
                      North/East/West
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-400 inline-block"></span>
                      Core Zone
                    </span>
                  </div>
                </div>

                {/* SVG Floorplate Canvas */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-center">
                  {(() => {
                    const svgW = 540;
                    const svgH = 310;
                    const cx = svgW / 2;
                    const cy = svgH / 2;
                    // Scale meters to pixels
                    const scale = Math.min(280 / length, 180 / width);
                    const bW = length * scale;
                    const bH = width * scale;
                    const pPx = geometry.effPerim * scale;

                    const x0 = -bW / 2;
                    const y0 = -bH / 2;
                    const x1 = bW / 2;
                    const y1 = bH / 2;

                    const cx0 = x0 + pPx;
                    const cy0 = y0 + pPx;
                    const cx1 = x1 - pPx;
                    const cy1 = y1 - pPx;

                    return (
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[320px]">
                        {/* Subtle grid */}
                        <defs>
                          <pattern id="floorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.7" />
                          </pattern>
                        </defs>
                        <rect width={svgW} height={svgH} fill="url(#floorGrid)" rx="8" />

                        {/* Compass North Indicator (Fixed Top-Right) */}
                        <g transform="translate(490, 45)">
                          <circle cx="0" cy="0" r="22" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
                          <polygon points="0,-16 -5,4 0,0 5,4" fill="#0f766e" />
                          <text x="0" y="-25" textAnchor="middle" className="text-[10px] font-bold fill-slate-700">
                            N (0°)
                          </text>
                        </g>

                        {/* Rotatable Building Footprint Group */}
                        <g transform={`translate(${cx}, ${cy}) rotate(${orientation})`}>
                          {/* North Perimeter Trapezoid */}
                          <polygon
                            points={`${x0},${y0} ${x1},${y0} ${cx1},${cy0} ${cx0},${cy0}`}
                            fill="#e0f2fe"
                            stroke="#0284c7"
                            strokeWidth="1.5"
                          />
                          {/* South Perimeter Trapezoid */}
                          <polygon
                            points={`${cx0},${cy1} ${cx1},${cy1} ${x1},${y1} ${x0},${y1}`}
                            fill="#fef3c7"
                            stroke="#d97706"
                            strokeWidth="1.5"
                          />
                          {/* West Perimeter Trapezoid */}
                          <polygon
                            points={`${x0},${y0} ${cx0},${cy0} ${cx0},${cy1} ${x0},${y1}`}
                            fill="#f0fdf4"
                            stroke="#16a34a"
                            strokeWidth="1.5"
                          />
                          {/* East Perimeter Trapezoid */}
                          <polygon
                            points={`${cx1},${cy0} ${x1},${y0} ${x1},${y1} ${cx1},${cy1}`}
                            fill="#f0fdf4"
                            stroke="#16a34a"
                            strokeWidth="1.5"
                          />

                          {/* Internal Core Zone Rectangle */}
                          {geometry.coreAreaFloor > 0 && (
                            <rect
                              x={cx0}
                              y={cy0}
                              width={Math.max(0, cx1 - cx0)}
                              height={Math.max(0, cy1 - cy0)}
                              fill="#e2e8f0"
                              stroke="#475569"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Window-to-Wall Ratio Glazing Bars on Facades */}
                          {/* North Glazing */}
                          <line
                            x1={-(bW * (wwrNorth / 100)) / 2}
                            y1={y0}
                            x2={(bW * (wwrNorth / 100)) / 2}
                            y2={y0}
                            stroke="#0284c7"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          {/* South Glazing */}
                          <line
                            x1={-(bW * (wwrSouth / 100)) / 2}
                            y1={y1}
                            x2={(bW * (wwrSouth / 100)) / 2}
                            y2={y1}
                            stroke="#ea580c"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          {/* West Glazing */}
                          <line
                            x1={x0}
                            y1={-(bH * (wwrWest / 100)) / 2}
                            x2={x0}
                            y2={(bH * (wwrWest / 100)) / 2}
                            stroke="#0284c7"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />
                          {/* East Glazing */}
                          <line
                            x1={x1}
                            y1={-(bH * (wwrEast / 100)) / 2}
                            x2={x1}
                            y2={(bH * (wwrEast / 100)) / 2}
                            stroke="#0284c7"
                            strokeWidth="6"
                            strokeLinecap="round"
                          />

                          {/* Labels inside zones */}
                          <text x="0" y={y0 + pPx / 2 + 4} textAnchor="middle" className="text-[10px] font-bold fill-sky-900">
                            NORTH ({geometry.zoneNorthSouthFloor.toFixed(0)} m²)
                          </text>
                          <text x="0" y={y1 - pPx / 2 + 4} textAnchor="middle" className="text-[10px] font-bold fill-amber-900">
                            SOUTH ({geometry.zoneNorthSouthFloor.toFixed(0)} m²)
                          </text>
                          {geometry.coreAreaFloor > 15 && (
                            <text x="0" y="4" textAnchor="middle" className="text-[11px] font-bold fill-slate-800">
                              CORE ({geometry.coreAreaFloor.toFixed(0)} m²)
                            </text>
                          )}

                          {/* Dimension Annotations */}
                          <text x="0" y={y0 - 12} textAnchor="middle" className="text-[11px] font-semibold fill-slate-600">
                            L = {length}m (WWR N: {wwrNorth}%)
                          </text>
                          <text x="0" y={y1 + 20} textAnchor="middle" className="text-[11px] font-semibold fill-amber-700">
                            South WWR: {wwrSouth}%
                          </text>
                        </g>
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* ClimaPlus-Style Monthly Climate & Solar Radiation Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Climate Analysis: Monthly Facade Solar Radiation & Outdoor Temperature ({climate.name})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Inspired by ClimaPlus & CBE Clima Tool (Course Lecture 2 & 3) — Incident radiation in kWh/m²·month
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
                    <span className="flex items-center gap-1 text-amber-500">● Horizontal</span>
                    <span className="flex items-center gap-1 text-slate-900">● South</span>
                    <span className="flex items-center gap-1 text-rose-600">● East/West</span>
                    <span className="flex items-center gap-1 text-sky-600">● North</span>
                    <span className="flex items-center gap-1 text-emerald-600">-- Mean Temp (°C)</span>
                  </div>
                </div>

                {/* SVG Line Chart for Solar Radiation & Temp */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  {(() => {
                    const cW = 560;
                    const cH = 190;
                    const padL = 38;
                    const padR = 36;
                    const padT = 16;
                    const padB = 26;
                    const plotW = cW - padL - padR;
                    const plotH = cH - padT - padB;

                    const xStep = plotW / 11;
                    const yRad = (val) => padT + plotH - (val / 260) * plotH;
                    const yTemp = (t) => padT + plotH - ((t + 10) / 45) * plotH;

                    const makePath = (arr, mapY) =>
                      arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${mapY(v)}`).join(' ');

                    return (
                      <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-48">
                        {/* Horizontal grid lines */}
                        {[0, 60, 120, 180, 240].map((v) => (
                          <g key={v}>
                            <line
                              x1={padL}
                              y1={yRad(v)}
                              x2={cW - padR}
                              y2={yRad(v)}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                            />
                            <text x={padL - 6} y={yRad(v) + 3} textAnchor="end" className="text-[9px] fill-slate-500">
                              {v}
                            </text>
                          </g>
                        ))}

                        {/* Lines for Solar Orientations */}
                        <path d={makePath(climate.solarHoriz, yRad)} fill="none" stroke="#f59e0b" strokeWidth="2.2" />
                        <path d={makePath(climate.solarSouth, yRad)} fill="none" stroke="#0f172a" strokeWidth="2.2" />
                        <path d={makePath(climate.solarEast, yRad)} fill="none" stroke="#e11d48" strokeWidth="1.8" />
                        <path d={makePath(climate.solarNorth, yRad)} fill="none" stroke="#0284c7" strokeWidth="1.8" />

                        {/* Dashed Line for Outdoor Temperature */}
                        <path
                          d={makePath(climate.monthlyTemp, yTemp)}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />

                        {/* Month Labels */}
                        {MONTHS.map((m, i) => (
                          <text
                            key={m}
                            x={padL + i * xStep}
                            y={cH - 8}
                            textAnchor="middle"
                            className="text-[10px] font-medium fill-slate-600"
                          >
                            {m}
                          </text>
                        ))}
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: STATIONARY ENERGY BALANCE (CIBSE TM54 / ISO 52000-1)       */}
        {/* ================================================================= */}
        {activeTab === 'energy' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT CONTROLS (5 COLS) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Opaque & Transparent Envelope U-Values */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-teal-600" />
                    Envelope Thermal Transmittance (U-Values & SHGC)
                  </h2>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    H_tr: {energyBalance.H_tr.toFixed(0)} W/K
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Exterior Opaque Wall (U_wall)</span>
                      <span className="font-bold text-slate-900">{uWall.toFixed(2)} W/m²K</span>
                    </div>
                    <input
                      type="range"
                      min="0.12"
                      max="1.20"
                      step="0.02"
                      value={uWall}
                      onChange={(e) => setUWall(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Roof (U_roof)</span>
                        <span className="font-bold text-slate-900">{uRoof.toFixed(2)} W/m²K</span>
                      </div>
                      <input
                        type="range"
                        min="0.10"
                        max="1.00"
                        step="0.02"
                        value={uRoof}
                        onChange={(e) => setURoof(Number(e.target.value))}
                        className="w-full accent-teal-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Ground Floor (U_fl)</span>
                        <span className="font-bold text-slate-900">{uFloor.toFixed(2)} W/m²K</span>
                      </div>
                      <input
                        type="range"
                        min="0.12"
                        max="1.00"
                        step="0.02"
                        value={uFloor}
                        onChange={(e) => setUFloor(Number(e.target.value))}
                        className="w-full accent-teal-600"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Window Glazing (U_win)</span>
                        <span className="font-bold text-sky-700">{uWin.toFixed(2)} W/m²K</span>
                      </div>
                      <input
                        type="range"
                        min="0.70"
                        max="3.20"
                        step="0.10"
                        value={uWin}
                        onChange={(e) => setUWin(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Solar Factor (SHGC / g)</span>
                        <span className="font-bold text-amber-600">{shgc.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.20"
                        max="0.75"
                        step="0.05"
                        value={shgc}
                        onChange={(e) => setShgc(Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Solar Shading Transmission Multiplier (f_sh)</span>
                      <span className="font-bold text-amber-700">
                        {shadingFactor.toFixed(2)} ({shadingFactor <= 0.5 ? 'External Louvers' : shadingFactor <= 0.75 ? 'Medium Blinds' : 'Unshaded'})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="1.00"
                      step="0.05"
                      value={shadingFactor}
                      onChange={(e) => setShadingFactor(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>

                {/* Dynamic Envelope Parameter Check (Assignment 3 compliance) */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500 block">Periodic Transmittance (Y_ie) & Time Shift</span>
                    <span className="font-bold text-slate-800">
                      Y_ie = {energyBalance.yIe} W/m²K • Δt = {energyBalance.timeShiftHours} h
                    </span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded font-semibold ${
                      energyBalance.yIe <= 0.10
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {energyBalance.yIe <= 0.10 ? 'DM 26/06/15 Compliant' : 'Check Summer Inertia'}
                  </span>
                </div>
              </div>

              {/* Ventilation & HVAC Plant Template */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Wind className="w-4 h-4 text-sky-600" />
                    Ventilation, Heat Recovery & HVAC Plant
                  </h2>
                  <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    H_ve: {energyBalance.H_ve.toFixed(0)} W/K
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Air Changes (ACH)</span>
                      <span className="font-bold text-slate-900">{ach.toFixed(1)} h⁻¹</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.1"
                      value={ach}
                      onChange={(e) => setAch(Number(e.target.value))}
                      className="w-full accent-sky-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">MVHR Heat Recovery</span>
                      <span className="font-bold text-emerald-700">{mvhrEff}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="5"
                      value={mvhrEff}
                      onChange={(e) => setMvhrEff(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    HVAC System Template (CIBSE TM54 / ISO 52000-1 Boundary)
                  </label>
                  <select
                    value={hvacId}
                    onChange={(e) => setHvacId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Object.values(HVAC_SYSTEMS).map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.name} (η_H/COP: {sys.heatEff}, SEER: {sys.coolEff})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-600">On-Site Rooftop Solar PV Coverage (% of Footprint)</span>
                    <span className="font-bold text-emerald-700">
                      {pvRoofPct}% ({energyBalance.annualPvGen.toFixed(1)} kWh/m²y)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="85"
                    step="5"
                    value={pvRoofPct}
                    onChange={(e) => setPvRoofPct(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT VISUALS & CHARTS (7 COLS) */}
            <div className="lg:col-span-7 space-y-5">
              {/* AZEB / ISO 52000-1 Stationary Energy Balance Diagram */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Stationary Building Energy Balance & Assessment Boundaries (AZEB / ISO 52000-1)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Energy need for heating = (Transmission + Ventilation losses) − η_H,gn × (Solar + Internal gains)
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    τ = {energyBalance.tau.toFixed(0)} hrs
                  </span>
                </div>

                {/* Visual Balance Box Flow */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {/* Column 1: Heat Losses */}
                  <div className="bg-white p-3.5 rounded-lg border border-rose-200 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">
                      Thermal Losses (Out)
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Opaque Walls ({Math.round(energyBalance.wallShare * 100)}%)</span>
                        <span className="font-semibold">{(energyBalance.annualTrLoss * energyBalance.wallShare).toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Windows ({Math.round(energyBalance.winShare * 100)}%)</span>
                        <span className="font-semibold">{(energyBalance.annualTrLoss * energyBalance.winShare).toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Roof & Ground ({Math.round(energyBalance.roofFloorShare * 100)}%)</span>
                        <span className="font-semibold">{(energyBalance.annualTrLoss * energyBalance.roofFloorShare).toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-600">Ventilation & Infilt.</span>
                        <span className="font-semibold text-sky-700">{energyBalance.annualVeLoss.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-rose-100 font-bold text-rose-700">
                        <span>Total Heat Loss</span>
                        <span>{(energyBalance.annualTrLoss + energyBalance.annualVeLoss).toFixed(1)} kWh/m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Useful Gains */}
                  <div className="bg-white p-3.5 rounded-lg border border-amber-200 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">
                      Heat Gains (In)
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Solar Gains (Q_sol)</span>
                        <span className="font-semibold">{energyBalance.annualSolGain.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Internal Gains (Q_int)</span>
                        <span className="font-semibold">{energyBalance.annualIntGain.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-600">Total Raw Gains</span>
                        <span className="font-semibold">{(energyBalance.annualSolGain + energyBalance.annualIntGain).toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-amber-100 font-bold text-emerald-700">
                        <span>On-Site PV Output</span>
                        <span>{energyBalance.annualPvGen.toFixed(1)} kWh/m²</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Net Demands & Plant Boundary */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-lg shadow-sm flex flex-col justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">
                      Zone & Plant Demand
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Heating Need (Q_H,nd)</span>
                        <span className="font-bold text-amber-400">{energyBalance.annualHeatNeed.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Cooling Need (Q_C,nd)</span>
                        <span className="font-bold text-sky-400">{energyBalance.annualCoolNeed.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-700">
                        <span className="text-slate-300">Net Delivered EUI</span>
                        <span className="font-bold text-white">{energyBalance.netSiteEui.toFixed(1)} kWh/m²</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-700 font-bold text-teal-300">
                        <span>Primary Energy (E_P)</span>
                        <span>{energyBalance.primaryEnergy.toFixed(1)} kWh_p/m²</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Quasi-Steady-State Energy Balance Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Monthly Quasi-Steady State Thermal Balance (kWh/m² per month)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Left bar: Transmission + Ventilation Losses | Right bar: Solar + Internal Gains | Line: Net Heating/Cooling
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] font-medium">
                    <span className="flex items-center gap-1 text-rose-500">■ Transm. Loss</span>
                    <span className="flex items-center gap-1 text-sky-500">■ Vent. Loss</span>
                    <span className="flex items-center gap-1 text-amber-400">■ Solar Gain</span>
                    <span className="flex items-center gap-1 text-emerald-500">■ Internal Gain</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  {(() => {
                    const cW = 560;
                    const cH = 200;
                    const padL = 36;
                    const padR = 16;
                    const padT = 16;
                    const padB = 26;
                    const plotW = cW - padL - padR;
                    const plotH = cH - padT - padB;

                    const maxVal = Math.max(
                      25,
                      ...energyBalance.monthlyData.map((m) => Math.max(m.Q_ht_loss, m.Q_sol + m.Q_int))
                    );

                    const yPos = (v) => padT + plotH - (v / maxVal) * plotH;
                    const hScale = (v) => (v / maxVal) * plotH;
                    const colW = plotW / 12;

                    return (
                      <svg viewBox={`0 0 ${cW} ${cH}`} className="w-full h-52">
                        {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
                          const val = Math.round(maxVal * f);
                          return (
                            <g key={idx}>
                              <line
                                x1={padL}
                                y1={yPos(val)}
                                x2={cW - padR}
                                y2={yPos(val)}
                                stroke="#e2e8f0"
                                strokeWidth="1"
                              />
                              <text x={padL - 5} y={yPos(val) + 3} textAnchor="end" className="text-[9px] fill-slate-500">
                                {val}
                              </text>
                            </g>
                          );
                        })}

                        {energyBalance.monthlyData.map((m, i) => {
                          const xBase = padL + i * colW + 6;
                          const bw = (colW - 14) / 2;
                          const hTr = hScale(m.Q_tr_heat);
                          const hVe = hScale(m.Q_ve_heat);
                          const hSol = hScale(m.Q_sol);
                          const hInt = hScale(m.Q_int);

                          return (
                            <g key={m.month}>
                              {/* Bar 1: Losses (Transmission + Ventilation) */}
                              <rect
                                x={xBase}
                                y={padT + plotH - hTr}
                                width={bw}
                                height={hTr}
                                fill="#f43f5e"
                                rx="1"
                              />
                              <rect
                                x={xBase}
                                y={padT + plotH - hTr - hVe}
                                width={bw}
                                height={hVe}
                                fill="#0ea5e9"
                                rx="1"
                              />

                              {/* Bar 2: Gains (Internal + Solar) */}
                              <rect
                                x={xBase + bw + 2}
                                y={padT + plotH - hInt}
                                width={bw}
                                height={hInt}
                                fill="#10b981"
                                rx="1"
                              />
                              <rect
                                x={xBase + bw + 2}
                                y={padT + plotH - hInt - hSol}
                                width={bw}
                                height={hSol}
                                fill="#fbbf24"
                                rx="1"
                              />

                              <text
                                x={xBase + bw}
                                y={cH - 8}
                                textAnchor="middle"
                                className="text-[10px] font-medium fill-slate-600"
                              >
                                {m.month}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* ClimaPlus-Style EUI, Emissions, and Operational Cost Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm mb-3">
                  Operational Performance Summary (ClimaPlus / CIBSE TM54 Benchmarks)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: EUI Breakdown */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">Delivered EUI Breakdown</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {energyBalance.totalSiteEui.toFixed(1)} kWh/m²·yr
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex my-2">
                      <div
                        style={{ width: `${(energyBalance.delivHeat / Math.max(1, energyBalance.totalSiteEui)) * 100}%` }}
                        className="bg-orange-500"
                        title="Heating"
                      />
                      <div
                        style={{ width: `${(energyBalance.delivCool / Math.max(1, energyBalance.totalSiteEui)) * 100}%` }}
                        className="bg-sky-500"
                        title="Cooling"
                      />
                      <div
                        style={{ width: `${(energyBalance.delivLight / Math.max(1, energyBalance.totalSiteEui)) * 100}%` }}
                        className="bg-yellow-400"
                        title="Lighting"
                      />
                      <div
                        style={{ width: `${(energyBalance.delivEquip / Math.max(1, energyBalance.totalSiteEui)) * 100}%` }}
                        className="bg-slate-700"
                        title="Equipment"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                      <span>● Heat: {energyBalance.delivHeat.toFixed(0)}</span>
                      <span>● Cool: {energyBalance.delivCool.toFixed(0)}</span>
                      <span>● Light: {energyBalance.delivLight.toFixed(0)}</span>
                      <span>● Equip: {energyBalance.delivEquip.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Card 2: Operational Emissions */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">Operational Emissions</div>
                    <div className="text-lg font-bold text-teal-700 mt-0.5">
                      {energyBalance.totalOpCarbon.toFixed(1)} kgCO₂e/m²·yr
                    </div>
                    <div className="text-xs text-slate-600 mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Thermal Fuel / HP:</span>
                        <span className="font-semibold">{energyBalance.opCarbonHeat.toFixed(1)} kgCO₂e</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net Grid Electricity:</span>
                        <span className="font-semibold">{energyBalance.opCarbonElec.toFixed(1)} kgCO₂e</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Operational Energy Cost */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500">Annual Energy Cost</div>
                    <div className="text-lg font-bold text-indigo-700 mt-0.5">
                      €{energyBalance.totalOpCost.toFixed(2)} /m²·yr
                    </div>
                    <div className="text-xs text-slate-600 mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Building Total / yr:</span>
                        <span className="font-semibold">
                          €{Math.round(energyBalance.totalOpCost * geometry.gfa).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>PV Self-Used:</span>
                        <span className="font-semibold">-{energyBalance.usablePv.toFixed(1)} kWh/m²</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: INDOOR COMFORT (PMV / PPD & ADAPTIVE - EN 16798-1)         */}
        {/* ================================================================= */}
        {activeTab === 'comfort' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT CONTROLS (5 COLS) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Thermometer className="w-4 h-4 text-emerald-600" />
                    CBE / EN 16798-1 Thermal Comfort Parameters
                  </h2>
                  <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                    <button
                      onClick={() => setComfortMode('pmv')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        comfortMode === 'pmv' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      PMV / PPD
                    </button>
                    <button
                      onClick={() => setComfortMode('adaptive')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        comfortMode === 'adaptive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Adaptive
                    </button>
                  </div>
                </div>

                {/* Quick Seasonal Presets */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAirTemp(21.0);
                      setRadTemp(20.5);
                      setAirSpeed(0.10);
                      setRelHumidity(45);
                      setMetRate(1.2);
                      setCloValue(1.0);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold transition"
                  >
                    ❄️ Winter Heating Preset (1.0 clo)
                  </button>
                  <button
                    onClick={() => {
                      setAirTemp(25.5);
                      setRadTemp(25.0);
                      setAirSpeed(0.18);
                      setRelHumidity(55);
                      setMetRate(1.1);
                      setCloValue(0.5);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition"
                  >
                    ☀️ Summer Cooling Preset (0.5 clo)
                  </button>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Indoor Air Temperature (T_a)</span>
                      <span className="font-bold text-slate-900">{airTemp.toFixed(1)} °C</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="34"
                      step="0.5"
                      value={airTemp}
                      onChange={(e) => setAirTemp(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-slate-600">Mean Radiant Temperature (T_r)</span>
                      <span className="font-bold text-slate-900">{radTemp.toFixed(1)} °C</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="34"
                      step="0.5"
                      value={radTemp}
                      onChange={(e) => setRadTemp(Number(e.target.value))}
                      className="w-full accent-teal-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Air Speed (v_a)</span>
                        <span className="font-bold text-slate-900">{airSpeed.toFixed(2)} m/s</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="1.20"
                        step="0.05"
                        value={airSpeed}
                        onChange={(e) => setAirSpeed(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Relative Humidity</span>
                        <span className="font-bold text-slate-900">{relHumidity}%</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="90"
                        step="5"
                        value={relHumidity}
                        onChange={(e) => setRelHumidity(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Metabolic Rate (M)</span>
                        <span className="font-bold text-emerald-700">{metRate.toFixed(1)} met</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="2.0"
                        step="0.1"
                        value={metRate}
                        onChange={(e) => setMetRate(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <span className="text-[10px] text-slate-400">1.0 = Seated, 1.2 = Office, 1.6 = Standing</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Clothing (I_cl)</span>
                        <span className="font-bold text-emerald-700">{cloValue.toFixed(2)} clo</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="1.5"
                        step="0.05"
                        value={cloValue}
                        onChange={(e) => setCloValue(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <span className="text-[10px] text-slate-400">0.5 = Summer light, 1.0 = Winter suit</span>
                    </div>
                  </div>

                  {comfortMode === 'adaptive' && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className="text-slate-600">Outdoor Running Mean Temp (T_rm)</span>
                        <span className="font-bold text-amber-700">{runningMeanOutdoor.toFixed(1)} °C</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="30"
                        step="0.5"
                        value={runningMeanOutdoor}
                        onChange={(e) => setRunningMeanOutdoor(Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT VISUALS (7 COLS) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Top Comfort KPI Status Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Predicted Mean Vote</div>
                  <div className="text-2xl font-bold text-slate-900 mt-0.5">
                    {comfortCalc.pmv >= 0 ? `+${comfortCalc.pmv.toFixed(2)}` : comfortCalc.pmv.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-400">Scale: -3 (Cold) to +3 (Hot)</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Dissatisfied (PPD)</div>
                  <div className="text-2xl font-bold text-teal-600 mt-0.5">
                    {comfortCalc.ppd.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400">Theoretical min: 5%</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Operative Temp (T_op)</div>
                  <div className="text-2xl font-bold text-amber-600 mt-0.5">
                    {comfortCalc.tOp.toFixed(1)} °C
                  </div>
                  <div className="text-[11px] text-slate-400">Humidity: {comfortCalc.humRatio.toFixed(1)} g/kg</div>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-sm flex flex-col justify-between ${comfortCalc.catColor}`}>
                  <div className="text-xs font-semibold opacity-80">EN 16798-1 Status</div>
                  <div className="text-sm font-bold leading-tight">{comfortCalc.category}</div>
                  <div className="text-[11px] opacity-80">Adaptive: {comfortCalc.adaptiveCat}</div>
                </div>
              </div>

              {/* Interactive Psychrometric OR Adaptive Comfort Chart */}
              {comfortMode === 'pmv' ? (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        Interactive Psychrometric Comfort Chart (Operative Temperature vs. Humidity Ratio)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Green polygon indicates EN 16798-1 Category II comfort zone ({cloValue} clo, {metRate} met) • Red target shows current operating point
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    {(() => {
                      const svgW = 560;
                      const svgH = 290;
                      const padL = 40;
                      const padR = 45;
                      const padT = 18;
                      const padB = 34;
                      const plotW = svgW - padL - padR;
                      const plotH = svgH - padT - padB;

                      // Temperature X axis: 10°C to 36°C
                      const xTemp = (t) => padL + ((t - 10) / 26) * plotW;
                      // Humidity Ratio Y axis: 0 to 26 g/kg
                      const yHum = (w) => padT + plotH - (Math.min(26, w) / 26) * plotH;

                      // Dynamic comfort zone center based on clothing & met
                      const tCenter = 25.2 - (cloValue - 0.5) * 4.8 - (metRate - 1.0) * 2.5 + (airSpeed - 0.1) * 1.8;
                      const czLeft = tCenter - 2.2;
                      const czRight = tCenter + 2.2;

                      // Helper for RH curves
                      const makeRhPath = (rhPct) => {
                        const pts = [];
                        for (let t = 10; t <= 36; t += 1) {
                          const pS = 610.78 * Math.exp((17.27 * t) / (t + 237.3));
                          const pV = (rhPct / 100) * pS;
                          const w = (622 * pV) / (101325 - pV);
                          if (w <= 26) {
                            pts.push(`${pts.length === 0 ? 'M' : 'L'} ${xTemp(t)} ${yHum(w)}`);
                          }
                        }
                        return pts.join(' ');
                      };

                      const curX = xTemp(comfortCalc.tOp);
                      const curY = yHum(comfortCalc.humRatio);

                      return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[300px]">
                          {/* Grid lines */}
                          {[10, 15, 20, 25, 30, 35].map((t) => (
                            <g key={t}>
                              <line x1={xTemp(t)} y1={padT} x2={xTemp(t)} y2={padT + plotH} stroke="#e2e8f0" />
                              <text x={xTemp(t)} y={svgH - 10} textAnchor="middle" className="text-[10px] fill-slate-600">
                                {t}°C
                              </text>
                            </g>
                          ))}
                          {[0, 5, 10, 15, 20, 25].map((w) => (
                            <g key={w}>
                              <line x1={padL} y1={yHum(w)} x2={padL + plotW} y2={yHum(w)} stroke="#e2e8f0" />
                              <text x={padL + plotW + 6} y={yHum(w) + 3} className="text-[10px] fill-slate-500">
                                {w} g/kg
                              </text>
                            </g>
                          ))}

                          {/* Relative Humidity Curves (20%, 40%, 60%, 80%, 100%) */}
                          {[20, 40, 60, 80, 100].map((rh) => (
                            <path
                              key={rh}
                              d={makeRhPath(rh)}
                              fill="none"
                              stroke={rh === 100 ? '#64748b' : '#cbd5e1'}
                              strokeWidth={rh === 100 ? '1.8' : '1.2'}
                              strokeDasharray={rh === 100 ? 'none' : '3 2'}
                            />
                          ))}

                          {/* Dynamic Comfort Zone Polygon */}
                          <polygon
                            points={`
                              ${xTemp(czLeft)},${yHum(3)}
                              ${xTemp(czRight)},${yHum(3)}
                              ${xTemp(czRight - 0.6)},${yHum(12)}
                              ${xTemp(czLeft - 0.5)},${yHum(12)}
                            `}
                            fill="rgba(16, 185, 129, 0.25)"
                            stroke="#059669"
                            strokeWidth="2"
                          />

                          {/* Operating Point Crosshair & Marker */}
                          <line x1={curX} y1={padT} x2={curX} y2={padT + plotH} stroke="#ef4444" strokeDasharray="3 3" />
                          <line x1={padL} y1={curY} x2={padL + plotW} y2={curY} stroke="#ef4444" strokeDasharray="3 3" />
                          <circle cx={curX} cy={curY} r="9" fill="rgba(239, 68, 68, 0.2)" stroke="#dc2626" strokeWidth="1.5" />
                          <circle cx={curX} cy={curY} r="4" fill="#dc2626" />
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* EN 16798-1 Adaptive Comfort Chart (Matching CBE Screenshot in Course Slides) */
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-800 text-sm">
                      EN 16798-1 Adaptive Thermal Comfort Chart (Free-Running Naturally Ventilated Mode)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Operative Temperature vs. Outdoor Running Mean Temperature (Class I ±2°C, Class II ±3°C, Class III ±4°C)
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    {(() => {
                      const svgW = 560;
                      const svgH = 290;
                      const padL = 44;
                      const padR = 24;
                      const padT = 18;
                      const padB = 34;
                      const plotW = svgW - padL - padR;
                      const plotH = svgH - padT - padB;

                      // X: Outdoor running mean temp 10 to 30 °C
                      const xRm = (t) => padL + ((t - 10) / 20) * plotW;
                      // Y: Operative temp 14 to 36 °C
                      const yOp = (t) => padT + plotH - ((t - 14) / 22) * plotH;

                      const tNeutral10 = 0.33 * 10 + 18.8; // 22.1
                      const tNeutral30 = 0.33 * 30 + 18.8; // 28.7

                      const bandPoly = (delta) => `
                        ${xRm(10)},${yOp(tNeutral10 - delta)}
                        ${xRm(30)},${yOp(tNeutral30 - delta)}
                        ${xRm(30)},${yOp(tNeutral30 + delta)}
                        ${xRm(10)},${yOp(tNeutral10 + delta)}
                      `;

                      const ptX = xRm(runningMeanOutdoor);
                      const ptY = yOp(comfortCalc.tOp);

                      return (
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-h-[300px]">
                          {/* Grid */}
                          {[10, 14, 18, 22, 26, 30].map((t) => (
                            <g key={t}>
                              <line x1={xRm(t)} y1={padT} x2={xRm(t)} y2={padT + plotH} stroke="#e2e8f0" />
                              <text x={xRm(t)} y={svgH - 10} textAnchor="middle" className="text-[10px] fill-slate-600">
                                {t}°C
                              </text>
                            </g>
                          ))}
                          {[16, 20, 24, 28, 32, 36].map((t) => (
                            <g key={t}>
                              <line x1={padL} y1={yOp(t)} x2={padL + plotW} y2={yOp(t)} stroke="#e2e8f0" />
                              <text x={padL - 6} y={yOp(t) + 3} textAnchor="end" className="text-[10px] fill-slate-500">
                                {t}°C
                              </text>
                            </g>
                          ))}

                          {/* Class III, II, I green acceptability bands (like CBE screenshot) */}
                          <polygon points={bandPoly(4)} fill="rgba(22, 163, 74, 0.22)" stroke="#15803d" strokeWidth="1" />
                          <polygon points={bandPoly(3)} fill="rgba(22, 163, 74, 0.35)" stroke="#15803d" strokeWidth="1" />
                          <polygon points={bandPoly(2)} fill="rgba(21, 128, 61, 0.55)" stroke="#14532d" strokeWidth="1.2" />

                          {/* Red Operating Point */}
                          <circle cx={ptX} cy={ptY} r="9" fill="none" stroke="#dc2626" strokeWidth="2" />
                          <circle cx={ptX} cy={ptY} r="3.5" fill="#dc2626" />
                        </svg>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: WHOLE-LIFE CARBON LCA & 5Rs CIRCULARITY                    */}
        {/* ================================================================= */}
        {activeTab === 'lca' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT CONTROLS (5 COLS) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Construction Technologies Selection */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Building Technology & Material Systems (Weeks 4–10)
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Primary Structural System (Timber vs. Steel vs. Concrete vs. Brick)
                  </label>
                  <select
                    value={structId}
                    onChange={(e) => setStructId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.values(STRUCTURAL_SYSTEMS).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (A1-A3: {s.a1a3} kgCO₂e/m²)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">{structure.desc}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Envelope Construction Method (Off-Site Modular vs. On-Site Traditional)
                  </label>
                  <select
                    value={envTypeId}
                    onChange={(e) => setEnvTypeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.values(ENVELOPE_SYSTEMS).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} (+{e.embodiedAdd} kgCO₂e/m²)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">{envelopeSys.desc}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Insulation Material
                    </label>
                    <select
                      value={insulId}
                      onChange={(e) => setInsulId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium bg-slate-50"
                    >
                      {Object.values(INSULATION_MATERIALS).map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          {ins.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Study Period (RSP)</span>
                      <span className="text-purple-700 font-bold">{studyPeriod} yrs</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      step="10"
                      value={studyPeriod}
                      onChange={(e) => setStudyPeriod(Number(e.target.value))}
                      className="w-full accent-purple-600 mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* 5Rs Circularity Toggles (Refuse, Reduce, Reuse, Repurpose, Recycle) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <Recycle className="w-4 h-4 text-emerald-600" />
                    5Rs Circularity & Deconstruction Strategies
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Reversibility: {lcaCalc.circularityScore}%
                  </span>
                </div>

                {[
                  {
                    key: 'refuse',
                    title: '1. REFUSE (Eliminate Redundant Layers)',
                    desc: 'Expose structural timber/concrete soffits & omit suspended ceilings (-10% envelope/finish carbon)'
                  },
                  {
                    key: 'reduce',
                    title: '2. REDUCE (Structural Topology Optimization)',
                    desc: 'Optimize structural grid & slab spans to reduce raw material mass (-12% A1-A3 structural carbon)'
                  },
                  {
                    key: 'reuse',
                    title: '3. REUSE (Design for Disassembly / Reversible Joints)',
                    desc: 'Dry bolted steel/timber connectors & clip-on facade panels for direct component reuse (Module D credit)'
                  },
                  {
                    key: 'repurpose',
                    title: '4. REPURPOSE (Open-Plan Functional Adaptability)',
                    desc: 'Generous floor height & non-load-bearing dry partitions to avoid demolition during future use change'
                  },
                  {
                    key: 'recycle',
                    title: '5. RECYCLE (High Secondary Content & Sorting)',
                    desc: 'Specify recycled steel/aggregate & mono-material separation at End-of-Life (-14% upfront + Module D)'
                  }
                ].map((r) => (
                  <label
                    key={r.key}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                      fiveRs[r.key]
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={fiveRs[r.key]}
                      onChange={() => setFiveRs((prev) => ({ ...prev, [r.key]: !prev[r.key] }))}
                      className="mt-1 accent-emerald-600 w-4 h-4 rounded"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">{r.title}</div>
                      <div className="text-slate-500 text-[11px]">{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* RIGHT VISUALS & LCA CHARTS (7 COLS) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Top LCA Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Net Embodied Carbon</div>
                  <div className="text-xl font-bold text-purple-700 mt-0.5">
                    {lcaCalc.netEmbodied.toFixed(0)} kgCO₂e/m²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lcaCalc.embodiedSharePct.toFixed(0)}% of whole-life impact
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Operational ({studyPeriod} yrs)</div>
                  <div className="text-xl font-bold text-teal-600 mt-0.5">
                    {lcaCalc.cumulativeOpCarbon.toFixed(0)} kgCO₂e/m²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lcaCalc.operationalSharePct.toFixed(0)}% of whole-life impact
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-500">Whole-Life Carbon</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    {lcaCalc.wholeLifeCarbonPerM2.toFixed(0)} kgCO₂e/m²
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Total: {lcaCalc.totalBuildingTonnes.toFixed(0)} tCO₂e
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/40">
                  <div className="text-xs text-emerald-800 font-medium">5Rs Circularity Score</div>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5">
                    {lcaCalc.circularityScore} / 100
                  </div>
                  <div className="text-[11px] text-emerald-600">
                    Mod. D Credit: -{lcaCalc.moduleDCredit} kgCO₂e/m²
                  </div>
                </div>
              </div>

              {/* Embodied vs Operational Carbon Lifecycle Stage Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      EN 15978 Whole-Life Carbon Stage Breakdown (kgCO₂e/m² over {studyPeriod} years)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Integrates Tab 2 Operational Carbon (B6) with Upfront (A1-A5), Replacement (B4), End-of-Life (C1-C4) & Module D Circularity Credits
                    </p>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {[
                    {
                      stage: 'A1–A5 Upfront Product & Construction',
                      val: lcaCalc.rawUpfront,
                      color: 'bg-purple-600',
                      sign: '+'
                    },
                    {
                      stage: 'B4 Envelope & Tech Replacement Cycles',
                      val: lcaCalc.b4Replacement,
                      color: 'bg-indigo-500',
                      sign: '+'
                    },
                    {
                      stage: 'C1–C4 Deconstruction & End-of-Life',
                      val: lcaCalc.c1c4EndOfLife,
                      color: 'bg-slate-600',
                      sign: '+'
                    },
                    {
                      stage: 'Module D Circular Reuse/Recycle & Biogenic Credit',
                      val: lcaCalc.moduleDCredit + lcaCalc.biogenicStorage * 0.5,
                      color: 'bg-emerald-500',
                      sign: '-'
                    },
                    {
                      stage: `B6 Operational Energy Carbon (${studyPeriod} Years)`,
                      val: lcaCalc.cumulativeOpCarbon,
                      color: 'bg-teal-600',
                      sign: '+'
                    }
                  ].map((item) => {
                    const maxBar = Math.max(600, lcaCalc.wholeLifeCarbonPerM2);
                    const pct = Math.min(100, (item.val / maxBar) * 100);
                    return (
                      <div key={item.stage}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="text-slate-700">{item.stage}</span>
                          <span className={`font-bold ${item.sign === '-' ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {item.sign}{item.val.toFixed(0)} kgCO₂e/m²
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div style={{ width: `${pct}%` }} className={`h-full ${item.color} rounded-full transition-all duration-300`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cumulative Whole-Life Carbon Timeline Trajectory Chart */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="mb-3">
                  <h3 className="font-bold text-slate-800 text-sm">
                    Cumulative Carbon Trajectory (Year 0 Construction to Year {studyPeriod} End-of-Life)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Shows initial Embodied Carbon spike at Year 0, annual Operational Carbon slope, facade replacements, and End-of-Life 5Rs credit
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  {(() => {
                    const svgW = 560;
                    const svgH = 195;
                    const padL = 44;
                    const padR = 24;
                    const padT = 18;
                    const padB = 28;
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;

                    // Generate yearly cumulative carbon points
                    const points = [];
                    const netUpfront = Math.max(40, lcaCalc.rawUpfront - lcaCalc.biogenicStorage * 0.5);
                    for (let y = 0; y <= studyPeriod; y += 5) {
                      const opSoFar = (lcaCalc.cumulativeOpCarbon / studyPeriod) * y;
                      const repSoFar = y >= envelopeSys.replacementCycle ? lcaCalc.b4Replacement * 0.6 : 0;
                      const repSoFar2 = y >= envelopeSys.replacementCycle * 2 ? lcaCalc.b4Replacement * 0.4 : 0;
                      const eolAdj = y === studyPeriod ? lcaCalc.c1c4EndOfLife - lcaCalc.moduleDCredit : 0;
                      points.push({
                        year: y,
                        embodied: netUpfront + repSoFar + repSoFar2 + eolAdj,
                        total: netUpfront + repSoFar + repSoFar2 + opSoFar + eolAdj
                      });
                    }

                    const maxY = Math.max(800, ...points.map((p) => p.total)) * 1.1;
                    const xYr = (y) => padL + (y / studyPeriod) * plotW;
                    const yVal = (v) => padT + plotH - (v / maxY) * plotH;

                    const totalPath = points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xYr(p.year)} ${yVal(p.total)}`)
                      .join(' ');
                    const embPath = points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xYr(p.year)} ${yVal(p.embodied)}`)
                      .join(' ');

                    return (
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-48">
                        {[0, 0.5, 1].map((f, idx) => {
                          const v = Math.round(maxY * f);
                          return (
                            <g key={idx}>
                              <line x1={padL} y1={yVal(v)} x2={padL + plotW} y2={yVal(v)} stroke="#e2e8f0" />
                              <text x={padL - 6} y={yVal(v) + 3} textAnchor="end" className="text-[9px] fill-slate-500">
                                {v}
                              </text>
                            </g>
                          );
                        })}

                        {/* Embodied Carbon Step Line */}
                        <path d={embPath} fill="none" stroke="#9333ea" strokeWidth="2" strokeDasharray="4 3" />
                        {/* Total Whole-Life Carbon Line */}
                        <path d={totalPath} fill="none" stroke="#0f766e" strokeWidth="2.5" />

                        {points.map((p) => (
                          <g key={p.year}>
                            <circle cx={xYr(p.year)} cy={yVal(p.total)} r="3" fill="#0f766e" />
                            {p.year % 10 === 0 && (
                              <text x={xYr(p.year)} y={svgH - 8} textAnchor="middle" className="text-[10px] fill-slate-600">
                                Yr {p.year}
                              </text>
                            )}
                          </g>
                        ))}
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* BASELINE SCENARIO COMPARISON DRAWER (IF SAVED)                    */}
        {/* ================================================================= */}
        {savedScenario && (
          <div className="mt-6 bg-slate-900 text-white p-4 rounded-xl border border-slate-700 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-sm">
                  Design Iteration Comparison vs. Saved Baseline ({savedScenario.name})
                </span>
              </div>
              <button
                onClick={() => setSavedScenario(null)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Clear Baseline
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {[
                {
                  label: 'Heating Need',
                  curr: energyBalance.annualHeatNeed,
                  base: savedScenario.heatNeed,
                  unit: 'kWh/m²',
                  invertGood: true
                },
                {
                  label: 'Cooling Need',
                  curr: energyBalance.annualCoolNeed,
                  base: savedScenario.coolNeed,
                  unit: 'kWh/m²',
                  invertGood: true
                },
                {
                  label: 'Primary Energy',
                  curr: energyBalance.primaryEnergy,
                  base: savedScenario.primaryEnergy,
                  unit: 'kWh_p/m²',
                  invertGood: true
                },
                {
                  label: 'Whole-Life CO₂',
                  curr: lcaCalc.wholeLifeCarbonPerM2,
                  base: savedScenario.wholeLifeCarbon,
                  unit: 'kgCO₂e/m²',
                  invertGood: true
                },
                {
                  label: '5Rs Circularity',
                  curr: lcaCalc.circularityScore,
                  base: savedScenario.circularityScore,
                  unit: '%',
                  invertGood: false
                }
              ].map((m) => {
                const diff = m.curr - m.base;
                const isBetter = m.invertGood ? diff <= 0 : diff >= 0;
                return (
                  <div key={m.label} className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-slate-400">{m.label}</div>
                    <div className="font-bold text-sm mt-0.5">
                      {m.curr.toFixed(1)} {m.unit}
                    </div>
                    <div className={`text-[11px] font-semibold ${isBetter ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} vs. Baseline
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* WEBEEP COURSE SUBMISSION REPORT MODAL (WEEK 9 & WEEK 15)            */}
      {/* =================================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                  Politecnico di Milano • WeBeep Mid-Term & Final Submission Summary
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Integrated Environmental Control & LCA Technical Dossier
                </h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  1. Week 9 Deliverable: Climatic & Morphological Analysis (Simple Box & Zoning)
                </h4>
                <p>
                  • <strong>Location & Köppen Classification:</strong> {climate.name} ({climate.koppen} — {climate.koppenDesc}), HDD {climate.hdd}, CDD {climate.cdd}.<br />
                  • <strong>Building Typology & Geometry:</strong> {program.name}, Gross Floor Area {geometry.gfa} m² ({length}m × {width}m × {floors} floors), Conditioned Volume {geometry.volume.toFixed(0)} m³, Compactness Ratio S/V = {geometry.svRatio.toFixed(3)} m⁻¹.<br />
                  • <strong>Thermal Zoning & Fenestration:</strong> 5 Representative Zones (Perimeter offset {geometry.effPerim}m, Core share {geometry.coreSharePct.toFixed(0)}%). Average WWR {geometry.avgWwr.toFixed(1)}% (S: {wwrSouth}%, N: {wwrNorth}%, E: {wwrEast}%, W: {wwrWest}%).
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  2. Week 15 Deliverable: Envelope Verification, Stationary Energy Balance & Comfort
                </h4>
                <p>
                  • <strong>Envelope Thermophysical Properties:</strong> U_wall = {uWall} W/m²K, U_roof = {uRoof} W/m²K, U_win = {uWin} W/m²K (g = {shgc}), Periodic Thermal Transmittance Y_ie = {energyBalance.yIe} W/m²K, Time Shift Δt = {energyBalance.timeShiftHours} h.<br />
                  • <strong>Annual Energy Balance:</strong> Net Heating Need = {energyBalance.annualHeatNeed.toFixed(1)} kWh/m²y, Net Cooling Need = {energyBalance.annualCoolNeed.toFixed(1)} kWh/m²y. Delivered Net EUI = {energyBalance.netSiteEui.toFixed(1)} kWh/m²y, Primary Energy = {energyBalance.primaryEnergy.toFixed(1)} kWh_p/m²y.<br />
                  • <strong>Indoor Thermal Comfort (EN 16798-1):</strong> Operative Temp {comfortCalc.tOp.toFixed(1)}°C, PMV = {comfortCalc.pmv.toFixed(2)}, PPD = {comfortCalc.ppd.toFixed(1)}% ({comfortCalc.category}).
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1">
                  3. Week 15 Deliverable: Whole-Life Carbon LCA & 5Rs Circularity Assessment
                </h4>
                <p>
                  • <strong>Construction Systems:</strong> {structure.name} + {envelopeSys.name} + {insulation.name}.<br />
                  • <strong>Carbon Balance ({studyPeriod}y RSP):</strong> Net Embodied Carbon = {lcaCalc.netEmbodied.toFixed(0)} kgCO₂e/m² ({lcaCalc.embodiedSharePct.toFixed(0)}%), Operational Carbon = {lcaCalc.cumulativeOpCarbon.toFixed(0)} kgCO₂e/m² ({lcaCalc.operationalSharePct.toFixed(0)}%), Total Whole-Life Carbon = {lcaCalc.wholeLifeCarbonPerM2.toFixed(0)} kgCO₂e/m² ({lcaCalc.totalBuildingTonnes.toFixed(0)} tCO₂e total).<br />
                  • <strong>5Rs Circularity Score:</strong> {lcaCalc.circularityScore}/100 (Module D recovery credit: -{lcaCalc.moduleDCredit} kgCO₂e/m²).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}