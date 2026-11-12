import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ClimateDataset, parseEpwText } from '../utils/epwEngine';
import { morphClimateDataset } from '../utils/epwParser';
import { computeStructuralBoQ, StructuralBoQResult } from '../utils/eurocodeCalculators';
import {
  DEFAULT_CLIMATE_DATASET,
  CLIMATE_SCOUT_STRATEGIES,
  ENVELOPE_MATERIALS,
  MONTHS
} from '../data/climateAndStrategies';

export type ScaleStageId = 1 | 2 | 3 | 4 | 5 | 6;
export type BuildingProgramType = 'office' | 'residential' | 'educational' | 'hospitality';
export type LegislativeTargetType = 'nZEB_Italy_DM2015' | 'EU_EPBD_2030_ZEB' | 'Passivhaus' | 'LEED_Platinum';
export type UrbanMorphologyType = 'compact_canyon' | 'open_superblock' | 'courtyard_perimeter' | 'highrise_towers';
export type BuildingTypologyType = 'shallow_linear' | 'deep_plan' | 'courtyard' | 'l_shape';
export type ThermalZoneName = 'South' | 'North' | 'East' | 'West' | 'Core';
export type HvacSystemType = 'ashp' | 'gshp' | 'district_network' | 'gas_chiller';
export type StructureSystemType = 'rc_standard' | 'clt_hybrid' | 'steel_composite' | 'low_carbon_rc';

// ============================================================================
// ISO 13786 EXACT COMPLEX TRANSMISSION MATRIX SOLVER
// ============================================================================
interface ComplexNumber {
  re: number;
  im: number;
}

type ComplexMatrix2x2 = [
  [ComplexNumber, ComplexNumber],
  [ComplexNumber, ComplexNumber]
];

function cMul(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re + b.re, im: a.im + b.im };
}

function mat2x2Mul(A: ComplexMatrix2x2, B: ComplexMatrix2x2): ComplexMatrix2x2 {
  return [
    [
      cAdd(cMul(A[0][0], B[0][0]), cMul(A[0][1], B[1][0])),
      cAdd(cMul(A[0][0], B[0][1]), cMul(A[0][1], B[1][1]))
    ],
    [
      cAdd(cMul(A[1][0], B[0][0]), cMul(A[1][1], B[1][0])),
      cAdd(cMul(A[1][0], B[0][1]), cMul(A[1][1], B[1][1]))
    ]
  ];
}

export interface Iso13786Result {
  uWall: number;             // Thermal transmittance U (W/m²K)
  yIe: number;               // Periodic thermal transmittance Y_ie (W/m²K)
  decrementFactor: number;   // f = Y_ie / U (dimensionless, 0..1)
  timeShiftHours: number;    // Time shift Delta t (hours, 0..24)
  kappaI: number;            // Internal areal heat capacity kappa_i (kJ/m²K)
  kappaE: number;            // External areal heat capacity kappa_e (kJ/m²K)
}

/**
 * Solves the exact ISO 13786 transmission matrix for multi-layer building envelopes.
 * Layers are passed from Exterior (index 0) to Interior (index N-1),
 * with boundary surface resistances R_si and R_se.
 */
export function solveIso13786Matrix(
  layers: Array<{ thicknessMm: number; lambda: number; rho: number; cp: number }>,
  R_si: number = 0.13,
  R_se: number = 0.04
): Iso13786Result {
  const T0 = 86400; // 24-hour period (seconds)
  const omega = (2 * Math.PI) / T0;

  // Internal boundary matrix: M_Rsi = [[1, -R_si], [0, 1]]
  let totalMatrix: ComplexMatrix2x2 = [
    [{ re: 1, im: 0 }, { re: -R_si, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }]
  ];

  let totalR = R_si + R_se;

  // Traverse from Interior (last element) to Exterior (first element) per ISO 13786 Annex C
  for (let j = layers.length - 1; j >= 0; j--) {
    const layer = layers[j];
    const d = Math.max(0.0001, layer.thicknessMm / 1000); // m
    const lambda = Math.max(0.005, layer.lambda); // W/mK
    const rho = Math.max(10, layer.rho); // kg/m³
    const cp = Math.max(200, layer.cp); // J/kgK

    const rLayer = d / lambda;
    totalR += rLayer;

    // Periodic penetration depth delta_j = sqrt((2 * lambda) / (omega * rho * cp))
    const delta = Math.sqrt((2 * lambda) / (omega * rho * cp));
    const xi = d / delta;

    const ch = Math.cosh(xi);
    const sh = Math.sinh(xi);
    const co = Math.cos(xi);
    const si = Math.sin(xi);

    const Z11: ComplexNumber = {
      re: ch * co,
      im: sh * si
    };

    const Z22: ComplexNumber = {
      re: ch * co,
      im: sh * si
    };

    const factor12 = -delta / (2 * lambda);
    const Z12: ComplexNumber = {
      re: factor12 * (sh * co + ch * si),
      im: factor12 * (ch * si - sh * co)
    };

    const factor21 = -lambda / delta;
    const Z21: ComplexNumber = {
      re: factor21 * (sh * co - ch * si),
      im: factor21 * (sh * co + ch * si)
    };

    const layerMatrix: ComplexMatrix2x2 = [
      [Z11, Z12],
      [Z21, Z22]
    ];

    totalMatrix = mat2x2Mul(totalMatrix, layerMatrix);
  }

  // Multiply by exterior boundary layer R_se
  const RseMatrix: ComplexMatrix2x2 = [
    [{ re: 1, im: 0 }, { re: -R_se, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }]
  ];
  totalMatrix = mat2x2Mul(totalMatrix, RseMatrix);

  // Steady-state thermal transmittance U
  const uWall = +(1 / Math.max(0.1, totalR)).toFixed(3);

  // Periodic thermal transmittance Y_ie = 1 / |Z12|
  const z12 = totalMatrix[0][1];
  const absZ12 = Math.sqrt(z12.re * z12.re + z12.im * z12.im);
  const yIe = +(1 / Math.max(0.001, absZ12)).toFixed(3);

  // Decrement factor f = Y_ie / U
  const decrementFactor = Math.min(1.0, +(yIe / Math.max(0.01, uWall)).toFixed(3));

  // Time shift Delta t = -(12 / pi) * arg(- 1 / Z12) per ISO 13786 (phase lag of Y12)
  const phiRad = Math.atan2(z12.im, -z12.re);
  let timeShiftHours = +(-(12 / Math.PI) * phiRad).toFixed(1);
  while (timeShiftHours < 0) timeShiftHours += 24;
  while (timeShiftHours >= 24) timeShiftHours -= 24;

  // Internal areal heat capacity kappa_i (kJ/m²K)
  // Per ISO 13786: internal admittance is Y11 = Z22 / Z12, so kappa1 = (T0 / 2pi) * |Z22 - 1| / |Z12|
  const z22 = totalMatrix[1][1];
  const z22Minus1: ComplexNumber = { re: z22.re - 1, im: z22.im };
  const absZ22Minus1 = Math.sqrt(z22Minus1.re * z22Minus1.re + z22Minus1.im * z22Minus1.im);
  const kappaI = +((T0 / (2 * Math.PI * 1000)) * (absZ22Minus1 / Math.max(0.001, absZ12))).toFixed(1);

  // External areal heat capacity kappa_e (kJ/m²K)
  // Per ISO 13786: external admittance is Y22 = Z11 / Z12, so kappa2 = (T0 / 2pi) * |Z11 - 1| / |Z12|
  const z11 = totalMatrix[0][0];
  const z11Minus1: ComplexNumber = { re: z11.re - 1, im: z11.im };
  const absZ11Minus1 = Math.sqrt(z11Minus1.re * z11Minus1.re + z11Minus1.im * z11Minus1.im);
  const kappaE = +((T0 / (2 * Math.PI * 1000)) * (absZ11Minus1 / Math.max(0.001, absZ12))).toFixed(1);

  return {
    uWall,
    yIe,
    decrementFactor,
    timeShiftHours,
    kappaI,
    kappaE
  };
}

export interface WallLayerItem {
  id: string;
  materialId: string;
  thicknessMm: number;
}

export interface ThermalZoneSummary {
  name: ThermalZoneName;
  floorAreaM2: number;
  sharePct: number;
  facadeAreaM2: number;
  wwrPct: number;
  urbanShadingFactor: number;
  daylightFactorPct: number;
  daylightAutonomyPct: number;
  annualSolarGainKwhM2: number;
  heatingLoadKwhM2: number;
  coolingLoadKwhM2: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  badge: string;
  heatingNeed: number;
  coolingNeed: number;
  lightingElec: number;
  deliveredEui: number;
  pvGen: number;
  netSiteEui: number;
  operationalCostEurM2: number;
  operationalCo2KgM2: number;
  discomfortHours: number;
}

export interface DesignProjectContextValue {
  // Navigation
  activeStage: ScaleStageId;
  setActiveStage: (stage: ScaleStageId) => void;

  // Stage 1: Climate & Program
  climateId: string;
  setClimateId: (id: string) => void;
  customClimates: Record<string, ClimateDataset>;
  addAndSelectClimate: (ds: ClimateDataset) => void;
  climate: ClimateDataset;
  comfortTempLower: number;
  setComfortTempLower: (v: number) => void;
  comfortTempUpper: number;
  setComfortTempUpper: (v: number) => void;
  buildingProgram: BuildingProgramType;
  setBuildingProgram: (p: BuildingProgramType) => void;
  targetOccupancyDensity: number;
  setTargetOccupancyDensity: (v: number) => void;
  internalLoadsWm2: number;
  setInternalLoadsWm2: (v: number) => void;
  legislativeTarget: LegislativeTargetType;
  setLegislativeTarget: (t: LegislativeTargetType) => void;
  activeStrategies: string[];
  toggleStrategy: (id: string) => void;
  setActiveStrategiesList: (ids: string[]) => void;
  morphTempOffsetC: number;
  setMorphTempOffsetC: (v: number) => void;
  morphWindMult: number;
  setMorphWindMult: (v: number) => void;
  morphRhOffsetPct: number;
  setMorphRhOffsetPct: (v: number) => void;
  globalValueRanges: boolean;
  setGlobalValueRanges: (b: boolean) => void;

  // Stage 2: Urban 2.5D District
  neighborHeightN: number;
  setNeighborHeightN: (v: number) => void;
  neighborHeightS: number;
  setNeighborHeightS: (v: number) => void;
  neighborHeightE: number;
  setNeighborHeightE: (v: number) => void;
  neighborHeightW: number;
  setNeighborHeightW: (v: number) => void;
  streetWidthN: number;
  setStreetWidthN: (v: number) => void;
  streetWidthS: number;
  setStreetWidthS: (v: number) => void;
  streetWidthE: number;
  setStreetWidthE: (v: number) => void;
  streetWidthW: number;
  setStreetWidthW: (v: number) => void;
  urbanAzimuth: number;
  setUrbanAzimuth: (v: number) => void;
  urbanMorphology: UrbanMorphologyType;
  applyUrbanMorphologyPreset: (m: UrbanMorphologyType) => void;
  urbanGreenRatio: number;
  setUrbanGreenRatio: (v: number) => void;
  urbanAlbedo: number;
  setUrbanAlbedo: (v: number) => void;
  districtSharedRenewableKw: number;
  setDistrictSharedRenewableKw: (v: number) => void;

  // Stage 3: Building Form & Zoning
  typology: BuildingTypologyType;
  applyBuildingTypologyPreset: (t: BuildingTypologyType) => void;
  lengthX: number;
  setLengthX: (v: number) => void;
  widthY: number;
  setWidthY: (v: number) => void;
  floors: number;
  setFloors: (v: number) => void;
  floorHeight: number;
  setFloorHeight: (v: number) => void;
  perimeterDepth: number;
  setPerimeterDepth: (v: number) => void;

  // Stage 4: Facade & Fabric (Shoebox)
  selectedZone: ThermalZoneName;
  setSelectedZone: (z: ThermalZoneName) => void;
  wwrN: number;
  setWwrN: (v: number) => void;
  wwrS: number;
  setWwrS: (v: number) => void;
  wwrE: number;
  setWwrE: (v: number) => void;
  wwrW: number;
  setWwrW: (v: number) => void;
  uWin: number;
  setUWin: (v: number) => void;
  shgc: number;
  setShgc: (v: number) => void;
  visTrans: number;
  setVisTrans: (v: number) => void;
  overhangDepth: number;
  setOverhangDepth: (v: number) => void;
  shadingMode: 'none' | 'fixed_overhang' | 'dynamic_louvers';
  setShadingMode: (m: 'none' | 'fixed_overhang' | 'dynamic_louvers') => void;
  daylightDimming: boolean;
  setDaylightDimming: (b: boolean) => void;
  natVentOpeningRatio: number;
  setNatVentOpeningRatio: (v: number) => void;
  wallLayers: WallLayerItem[];
  setWallLayers: React.Dispatch<React.SetStateAction<WallLayerItem[]>>;
  uRoof: number;
  setURoof: (v: number) => void;
  uGround: number;
  setUGround: (v: number) => void;

  // Stage 5: Energy, HVAC & Comfort
  achInf: number;
  setAchInf: (v: number) => void;
  achVent: number;
  setAchVent: (v: number) => void;
  hrvEff: number;
  setHrvEff: (v: number) => void;
  nightFlush: boolean;
  setNightFlush: (b: boolean) => void;
  hvacSystem: HvacSystemType;
  applyHvacPreset: (sys: HvacSystemType) => void;
  heatingCop: number;
  setHeatingCop: (v: number) => void;
  coolingEer: number;
  setCoolingEer: (v: number) => void;
  roofPvRatio: number;
  setRoofPvRatio: (v: number) => void;
  facadeBipvRatio: number;
  setFacadeBipvRatio: (v: number) => void;
  savedScenarios: SavedScenario[];
  saveCurrentToScenarioSlot: (slotIndex: number) => void;
  applyOptimizationPreset: (preset: 'baseline' | 'passive' | 'nzeb_district') => void;

  // Stage 6: Whole-Life Carbon LCA & Structural Bridge
  structureSystem: StructureSystemType;
  setStructureSystem: (s: StructureSystemType) => void;
  circularityIndex: number;
  setCircularityIndex: (v: number) => void;
  gridDecarbonizationRate: number;
  setGridDecarbonizationRate: (v: number) => void;
  studyPeriodYears: number;
  setStudyPeriodYears: (v: number) => void;
  structuralBoQOverride: StructuralBoQResult | null;
  setStructuralBoQOverride: (boq: StructuralBoQResult | null) => void;
  syncMassingToStructure: () => {
    lengthX: number;
    widthY: number;
    floors: number;
    floorHeight: number;
    buildingProgram: BuildingProgramType;
    structureSystem: StructureSystemType;
  };
  syncStructureToMassing: (params: {
    floors?: number;
    floorHeight?: number;
    structureSystem?: StructureSystemType;
    lengthX?: number;
    widthY?: number;
  }) => void;

  // Coupled Multi-Scale Derived Simulation Results
  sim: {
    // Stage 1 Strategy Modifiers
    strategyMods: {
      heatingMult: number;
      coolingMult: number;
      shgcMult: number;
      natVentBonusAch: number;
      tauBonusHours: number;
    };
    // Stage 2 Urban Downscaling
    urbanShading: {
      N: number;
      S: number;
      E: number;
      W: number;
      avg: number;
    };
    canyonAnglesDeg: {
      N: number;
      S: number;
      E: number;
      W: number;
    };
    skyViewFactor: number;
    uhiTempDeltaC: number;
    districtStats: {
      plotGfaM2: number;
      districtTotalGfaM2: number;
      districtEnergyDensityKwhM2: number;
      sharedRenewableOffsetKwhM2: number;
      mutualShadingReductionPct: number;
    };
    // Stage 3 Building Geometry & 5 Thermal Zones
    footprintArea: number;
    gfa: number;
    buildingHeight: number;
    volume: number;
    svRatio: number;
    facadeAreas: { N: number; S: number; E: number; W: number; total: number };
    solarExposedFacadeM2: number;
    zones: Record<ThermalZoneName, ThermalZoneSummary>;
    // Stage 4 Opaque Envelope ISO 13786 & Glazing
    wallThicknessMm: number;
    uWall: number;
    yIe: number;
    kappaI: number;
    timeShiftHours: number;
    attenuationFactor: number;
    wallEmbodiedCo2PerM2Facade: number;
    wwrAvg: number;
    avgDaylightFactorPct: number;
    avgDaylightAutonomyPct: number;
    compliance: {
      uWallPass: boolean;
      uWinPass: boolean;
      yIePass: boolean;
      kappaPass: boolean;
      daylightPass: boolean;
      nzebPass: boolean;
    };
    // Stage 5 Monthly & Annual ISO 52000-1 Energy Balance + Sankey + Comfort
    tauHours: number;
    monthlyResults: Array<{
      month: string;
      tOut: number;
      qTr: number;
      qVent: number;
      qSol: number;
      qInt: number;
      etaH: number;
      heatingNeed: number;
      coolingNeed: number;
      pvGen: number;
      tOperativeFree: number;
      comfortOptimal: number;
      comfortCatIIUpper: number;
      comfortCatIILower: number;
    }>;
    annualHeatingNeed: number;
    annualCoolingNeed: number;
    annualLightingElec: number;
    annualEquipmentElec: number;
    deliveredHeating: number;
    deliveredCooling: number;
    totalDeliveredEui: number;
    roofPvGeneration: number;
    bipvGeneration: number;
    districtSharedPvContribution: number;
    totalRenewableGen: number;
    netSiteEui: number;
    primaryEnergyTotal: number;
    primaryEnergyNonRen: number;
    renewableSharePct: number;
    operationalCostEurM2: number;
    operationalCo2KgM2Yr: number;
    discomfortHours: number;
    comfortHoursPct: number;
    // Stage 6 Whole-Life Carbon EN 15978 (50-year) & BoQ
    structuralBoQ: StructuralBoQResult;
    lca: {
      a1a3Structure: number;
      a1a3Envelope: number;
      a1a3MepPv: number;
      a1a3Total: number;
      b4Replacement: number;
      b6Operational50Yr: number;
      c1c4EndOfLife: number;
      moduleDCredit: number;
      wholeLifeCarbonGross: number;
      wholeLifeCarbonNet: number;
      embodiedSharePct: number;
      yearlyTrajectory: Array<{
        year: number;
        cumulativeBaseline: number;
        cumulativeCurrent: number;
        cumulativeNetCircular: number;
      }>;
    };
  };
}

export type SimulationKPIs = DesignProjectContextValue['sim'];

const DesignProjectContext = createContext<DesignProjectContextValue | null>(null);

export const DesignProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStage, setActiveStage] = useState<ScaleStageId>(1);

  // Stage 1: Climate & Program
  const [climateId, setClimateId] = useState<string>('milan');
  const [customClimates, setCustomClimates] = useState<Record<string, ClimateDataset>>({});
  const [comfortTempLower, setComfortTempLower] = useState<number>(18);
  const [comfortTempUpper, setComfortTempUpper] = useState<number>(26);
  const [buildingProgram, setBuildingProgram] = useState<BuildingProgramType>('office');
  const [targetOccupancyDensity, setTargetOccupancyDensity] = useState<number>(0.07);
  const [internalLoadsWm2, setInternalLoadsWm2] = useState<number>(14);
  const [legislativeTarget, setLegislativeTarget] = useState<LegislativeTargetType>('nZEB_Italy_DM2015');
  const [activeStrategies, setActiveStrategies] = useState<string[]>([
    'east_west_shading',
    'cross_stack_vent',
    'thermal_mass'
  ]);
  const [morphTempOffsetC, setMorphTempOffsetC] = useState<number>(0);
  const [morphWindMult, setMorphWindMult] = useState<number>(1.0);
  const [morphRhOffsetPct, setMorphRhOffsetPct] = useState<number>(0);
  const [globalValueRanges, setGlobalValueRanges] = useState<boolean>(false);

  const addAndSelectClimate = (ds: ClimateDataset) => {
    setCustomClimates((prev) => ({ ...prev, [ds.id]: ds }));
    setClimateId(ds.id);
  };

  // Pre-load default initial 8,760h weather station on startup
  useEffect(() => {
    let cancelled = false;
    if (Object.keys(customClimates).length === 0) {
      fetch('/weather/milan.epw')
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => {
          if (!cancelled && text.includes('LOCATION,')) {
            const ds = parseEpwText(text, 'Milano Linate WMO 160800');
            setCustomClimates({ [ds.id]: ds });
            setClimateId(ds.id);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [customClimates]);

  const toggleStrategy = (id: string) => {
    setActiveStrategies((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const setActiveStrategiesList = (ids: string[]) => {
    setActiveStrategies(Array.from(new Set(ids)));
  };

  const baseClimate: ClimateDataset =
    customClimates[climateId] || DEFAULT_CLIMATE_DATASET;

  const climate: ClimateDataset = useMemo(
    () => morphClimateDataset(baseClimate, morphTempOffsetC, morphWindMult, morphRhOffsetPct),
    [baseClimate, morphTempOffsetC, morphWindMult, morphRhOffsetPct]
  );

  // Stage 2: Urban 2.5D District
  const [neighborHeightN, setNeighborHeightN] = useState<number>(18);
  const [neighborHeightS, setNeighborHeightS] = useState<number>(20);
  const [neighborHeightE, setNeighborHeightE] = useState<number>(16);
  const [neighborHeightW, setNeighborHeightW] = useState<number>(16);
  const [streetWidthN, setStreetWidthN] = useState<number>(14);
  const [streetWidthS, setStreetWidthS] = useState<number>(14);
  const [streetWidthE, setStreetWidthE] = useState<number>(12);
  const [streetWidthW, setStreetWidthW] = useState<number>(12);
  const [urbanAzimuth, setUrbanAzimuth] = useState<number>(0);
  const [urbanMorphology, setUrbanMorphology] = useState<UrbanMorphologyType>('compact_canyon');
  const [urbanGreenRatio, setUrbanGreenRatio] = useState<number>(25);
  const [urbanAlbedo, setUrbanAlbedo] = useState<number>(0.28);
  const [districtSharedRenewableKw, setDistrictSharedRenewableKw] = useState<number>(120);

  const applyUrbanMorphologyPreset = (m: UrbanMorphologyType) => {
    setUrbanMorphology(m);
    if (m === 'compact_canyon') {
      setNeighborHeightN(21);
      setNeighborHeightS(22);
      setNeighborHeightE(18);
      setNeighborHeightW(18);
      setStreetWidthN(11);
      setStreetWidthS(11);
      setStreetWidthE(10);
      setStreetWidthW(10);
      setUrbanGreenRatio(15);
    } else if (m === 'open_superblock') {
      setNeighborHeightN(14);
      setNeighborHeightS(14);
      setNeighborHeightE(12);
      setNeighborHeightW(12);
      setStreetWidthN(24);
      setStreetWidthS(26);
      setStreetWidthE(22);
      setStreetWidthW(22);
      setUrbanGreenRatio(45);
    } else if (m === 'courtyard_perimeter') {
      setNeighborHeightN(18);
      setNeighborHeightS(18);
      setNeighborHeightE(18);
      setNeighborHeightW(18);
      setStreetWidthN(16);
      setStreetWidthS(16);
      setStreetWidthE(16);
      setStreetWidthW(16);
      setUrbanGreenRatio(30);
    } else if (m === 'highrise_towers') {
      setNeighborHeightN(36);
      setNeighborHeightS(38);
      setNeighborHeightE(32);
      setNeighborHeightW(30);
      setStreetWidthN(20);
      setStreetWidthS(22);
      setStreetWidthE(18);
      setStreetWidthW(18);
      setUrbanGreenRatio(25);
    }
  };

  // Stage 3: Building Form & Floorplate Zoning
  const [typology, setTypology] = useState<BuildingTypologyType>('shallow_linear');
  const [lengthX, setLengthX] = useState<number>(44);
  const [widthY, setWidthY] = useState<number>(16);
  const [floors, setFloors] = useState<number>(5);
  const [floorHeight, setFloorHeight] = useState<number>(3.4);
  const [perimeterDepth, setPerimeterDepth] = useState<number>(4.5);

  const applyBuildingTypologyPreset = (t: BuildingTypologyType) => {
    setTypology(t);
    if (t === 'shallow_linear') {
      setLengthX(46);
      setWidthY(15);
      setFloors(5);
    } else if (t === 'deep_plan') {
      setLengthX(34);
      setWidthY(28);
      setFloors(5);
    } else if (t === 'courtyard') {
      setLengthX(42);
      setWidthY(36);
      setFloors(4);
    } else if (t === 'l_shape') {
      setLengthX(40);
      setWidthY(30);
      setFloors(5);
    }
  };

  // Stage 4: Facade & Fabric (Shoebox)
  const [selectedZone, setSelectedZone] = useState<ThermalZoneName>('South');
  const [wwrN, setWwrN] = useState<number>(24);
  const [wwrS, setWwrS] = useState<number>(45);
  const [wwrE, setWwrE] = useState<number>(30);
  const [wwrW, setWwrW] = useState<number>(30);
  const [uWin, setUWin] = useState<number>(1.1);
  const [shgc, setShgc] = useState<number>(0.38);
  const [visTrans, setVisTrans] = useState<number>(0.68);
  const [overhangDepth, setOverhangDepth] = useState<number>(0.8);
  const [shadingMode, setShadingMode] = useState<'none' | 'fixed_overhang' | 'dynamic_louvers'>('dynamic_louvers');
  const [daylightDimming, setDaylightDimming] = useState<boolean>(true);
  const [natVentOpeningRatio, setNatVentOpeningRatio] = useState<number>(22);
  const [wallLayers, setWallLayers] = useState<WallLayerItem[]>([
    { id: 'l1', materialId: 'ventilated_cladding', thicknessMm: 20 },
    { id: 'l2', materialId: 'wood_fiber', thicknessMm: 140 },
    { id: 'l3', materialId: 'rc_concrete', thicknessMm: 180 },
    { id: 'l4', materialId: 'gypsum_plaster', thicknessMm: 20 }
  ]);
  const [uRoof, setURoof] = useState<number>(0.18);
  const [uGround, setUGround] = useState<number>(0.24);

  // Stage 5: Energy, HVAC & Comfort
  const [achInf, setAchInf] = useState<number>(0.2);
  const [achVent, setAchVent] = useState<number>(0.8);
  const [hrvEff, setHrvEff] = useState<number>(0.78);
  const [nightFlush, setNightFlush] = useState<boolean>(true);
  const [hvacSystem, setHvacSystem] = useState<HvacSystemType>('ashp');
  const [heatingCop, setHeatingCop] = useState<number>(3.8);
  const [coolingEer, setCoolingEer] = useState<number>(4.2);
  const [roofPvRatio, setRoofPvRatio] = useState<number>(60);
  const [facadeBipvRatio, setFacadeBipvRatio] = useState<number>(15);

  const applyHvacPreset = (sys: HvacSystemType) => {
    setHvacSystem(sys);
    if (sys === 'ashp') {
      setHeatingCop(3.8);
      setCoolingEer(4.2);
    } else if (sys === 'gshp') {
      setHeatingCop(4.8);
      setCoolingEer(5.4);
    } else if (sys === 'district_network') {
      setHeatingCop(4.2);
      setCoolingEer(4.8);
    } else if (sys === 'gas_chiller') {
      setHeatingCop(0.92);
      setCoolingEer(3.0);
    }
  };

  // Stage 6: Whole-Life Carbon LCA & Structural Studio Synchronizer
  const [structureSystem, setStructureSystem] = useState<StructureSystemType>('clt_hybrid');
  const [circularityIndex, setCircularityIndex] = useState<number>(35);
  const [gridDecarbonizationRate, setGridDecarbonizationRate] = useState<number>(2.5);
  const [studyPeriodYears, setStudyPeriodYears] = useState<number>(50);
  const [structuralBoQOverride, setStructuralBoQOverride] = useState<StructuralBoQResult | null>(null);

  const syncMassingToStructure = () => {
    return {
      lengthX,
      widthY,
      floors,
      floorHeight,
      buildingProgram,
      structureSystem
    };
  };

  const syncStructureToMassing = (params: {
    floors?: number;
    floorHeight?: number;
    structureSystem?: StructureSystemType;
    lengthX?: number;
    widthY?: number;
  }) => {
    if (params.floors !== undefined && params.floors > 0) {
      setFloors(params.floors);
    }
    if (params.floorHeight !== undefined && params.floorHeight > 0) {
      setFloorHeight(params.floorHeight);
    }
    if (params.lengthX !== undefined && params.lengthX > 0) {
      setLengthX(params.lengthX);
    }
    if (params.widthY !== undefined && params.widthY > 0) {
      setWidthY(params.widthY);
    }
    if (params.structureSystem) {
      setStructureSystem(params.structureSystem);
    }
  };

  // ==========================================================================
  // COUPLED MULTI-SCALE PHYSICS & DOWNSCALING ENGINE
  // ==========================================================================
  const sim = useMemo(() => {
    // 1. Stage 1 ClimateScout Strategy Modifiers
    let heatingMult = 1.0;
    let coolingMult = 1.0;
    let shgcMult = 1.0;
    let natVentBonusAch = 0;
    let tauBonusHours = 0;

    for (const st of CLIMATE_SCOUT_STRATEGIES) {
      if (activeStrategies.includes(st.id)) {
        heatingMult *= st.heatingNeedMultiplier;
        coolingMult *= st.coolingNeedMultiplier;
        shgcMult *= st.effectiveShgcMultiplier;
        natVentBonusAch += st.natVentBonusAch;
        tauBonusHours += st.tauBonusHours;
      }
    }

    // 2. Stage 3 Building Geometry & Typology Form Factor
    const buildingHeight = +(floors * floorHeight).toFixed(1);
    const rawFootprint = lengthX * widthY;
    // Typology form multipliers (courtyard & L-shape have internal/re-entrant perimeters)
    const footprintFactor =
      typology === 'courtyard' ? 0.78 : typology === 'l_shape' ? 0.72 : 1.0;
    const perimeterFactor =
      typology === 'courtyard' ? 1.38 : typology === 'l_shape' ? 1.18 : 1.0;

    const footprintArea = Math.round(rawFootprint * footprintFactor);
    const gfa = Math.round(footprintArea * floors);
    const volume = Math.round(gfa * floorHeight);

    const areaN = Math.round(lengthX * buildingHeight * (perimeterFactor * 0.5 + 0.5));
    const areaS = Math.round(lengthX * buildingHeight * (perimeterFactor * 0.5 + 0.5));
    const areaE = Math.round(widthY * buildingHeight * (perimeterFactor * 0.5 + 0.5));
    const areaW = Math.round(widthY * buildingHeight * (perimeterFactor * 0.5 + 0.5));
    const totalFacadeArea = areaN + areaS + areaE + areaW;
    const totalEnvelopeArea = totalFacadeArea + footprintArea * 2;
    const svRatio = +(totalEnvelopeArea / Math.max(1, volume)).toFixed(3);

    // 3. Stage 2 Urban 2.5D Canyon Obstruction & Sky View Factor (SVF)
    // Mid-height of target building sees neighbor height relative to street canyon width
    const midH = buildingHeight * 0.5;
    const calcObstructionAngle = (hNeighbor: number, wStreet: number) => {
      const dh = Math.max(0, hNeighbor - midH * 0.65);
      return +((Math.atan2(dh, Math.max(4, wStreet)) * 180) / Math.PI).toFixed(1);
    };

    const angleN = calcObstructionAngle(neighborHeightN, streetWidthN);
    const angleS = calcObstructionAngle(neighborHeightS, streetWidthS);
    const angleE = calcObstructionAngle(neighborHeightE, streetWidthE);
    const angleW = calcObstructionAngle(neighborHeightW, streetWidthW);

    // Solar shading multiplier (0.40 to 1.00) per facade orientation
    const calcShadingMult = (angleDeg: number) =>
      +Math.max(0.4, Math.min(1.0, 1 - 0.68 * Math.sin((angleDeg * Math.PI) / 180))).toFixed(2);

    const shadeN = calcShadingMult(angleN);
    const shadeS = calcShadingMult(angleS);
    const shadeE = calcShadingMult(angleE);
    const shadeW = calcShadingMult(angleW);
    const shadeAvg = +((shadeN + shadeS + shadeE + shadeW) / 4).toFixed(2);

    const avgAngleRad = (((angleN + angleS + angleE + angleW) / 4) * Math.PI) / 180;
    const skyViewFactor = +Math.max(0.25, Math.min(0.96, Math.cos(avgAngleRad))).toFixed(2);

    // Urban Heat Island (UHI) microclimate delta (°C): canyon trapping minus vegetation/albedo cooling
    const uhiTempDeltaC = +(
      (1 - skyViewFactor) * 2.4 -
      (urbanGreenRatio / 100) * 1.8 -
      (urbanAlbedo - 0.2) * 2.0
    ).toFixed(2);

    const solarExposedFacadeM2 = Math.round(
      areaN * shadeN + areaS * shadeS + areaE * shadeE + areaW * shadeW
    );

    // 4. Stage 4 Opaque Multi-Layer Envelope Physics (Exact ISO 13786 & UNI EN ISO 6946)
    const R_si = 0.13;
    const R_se = 0.04;
    let totalThickMm = 0;
    let wallEmbodiedCo2PerM2Facade = 0;

    const layerPhysics = wallLayers.map((layer) => {
      const mat = ENVELOPE_MATERIALS.find((m) => m.id === layer.materialId) || ENVELOPE_MATERIALS[0];
      const dMeters = layer.thicknessMm / 1000;
      totalThickMm += layer.thicknessMm;
      wallEmbodiedCo2PerM2Facade += dMeters * mat.rho * mat.gwpPerKg;
      return {
        thicknessMm: layer.thicknessMm,
        lambda: mat.lambda,
        rho: mat.rho,
        cp: mat.cp
      };
    });

    // Exact ISO 13786 Complex Transmission Matrix Solution
    const iso13786 = solveIso13786Matrix(layerPhysics, R_si, R_se);
    const uWall = iso13786.uWall;
    const kappaI = iso13786.kappaI;
    const timeShiftHours = iso13786.timeShiftHours;
    const attenuationFactor = iso13786.decrementFactor;
    const yIe = iso13786.yIe;

    const wwrAvg = +(
      (wwrN * areaN + wwrS * areaS + wwrE * areaE + wwrW * areaW) /
      Math.max(1, totalFacadeArea)
    ).toFixed(1);

    // 5. Stage 3 & Stage 4: 5 Representative Thermal Zones (North, South, East, West, Core)
    const dPerim = Math.min(perimeterDepth, Math.min(lengthX, widthY) * 0.42);
    const perimSouthM2 = Math.round((lengthX - dPerim) * dPerim * floors * footprintFactor);
    const perimNorthM2 = Math.round((lengthX - dPerim) * dPerim * floors * footprintFactor);
    const perimEastM2 = Math.round((widthY - dPerim) * dPerim * floors * footprintFactor);
    const perimWestM2 = Math.round((widthY - dPerim) * dPerim * floors * footprintFactor);
    const totalPerimM2 = Math.min(
      Math.round(gfa * 0.88),
      perimSouthM2 + perimNorthM2 + perimEastM2 + perimWestM2
    );
    const coreM2 = Math.max(Math.round(gfa * 0.12), gfa - totalPerimM2);

    // Azimuth-rotated annual facade solar totals (kWh/m²yr)
    const rotRad = (Math.abs(urbanAzimuth) * Math.PI) / 180;
    const annualSolS =
      climate.solarSouth.reduce((a, b) => a + b, 0) * Math.cos(rotRad * 0.5) +
      climate.solarEast.reduce((a, b) => a + b, 0) * Math.sin(rotRad * 0.5);
    const annualSolN = climate.solarNorth.reduce((a, b) => a + b, 0);
    const annualSolE = climate.solarEast.reduce((a, b) => a + b, 0);
    const annualSolW = climate.solarWest.reduce((a, b) => a + b, 0);

    // Overhang + Dynamic shading factor
    const overhangFactor = Math.max(0.58, 1 - overhangDepth * 0.24);
    const modeShadeFactor =
      shadingMode === 'dynamic_louvers' ? 0.58 : shadingMode === 'fixed_overhang' ? overhangFactor : 1.0;

    const buildZoneSummary = (
      name: ThermalZoneName,
      zArea: number,
      zFacadeArea: number,
      zWwr: number,
      zUrbanShade: number,
      zAnnualIncidentSol: number
    ): ThermalZoneSummary => {
      const sharePct = +((zArea / Math.max(1, gfa)) * 100).toFixed(1);
      if (name === 'Core') {
        return {
          name,
          floorAreaM2: zArea,
          sharePct,
          facadeAreaM2: 0,
          wwrPct: 0,
          urbanShadingFactor: 0,
          daylightFactorPct: 0.4,
          daylightAutonomyPct: 12,
          annualSolarGainKwhM2: 0,
          heatingLoadKwhM2: +(Math.max(4, (climate.hdd * 0.004) / heatingMult)).toFixed(1),
          coolingLoadKwhM2: +(18 + internalLoadsWm2 * 0.95).toFixed(1)
        };
      }

      // Daylight Factor (%) in perimeter zone (CIBSE / EN 17037 empirical formula)
      const winArea = zFacadeArea * (zWwr / 100);
      const df = +(
        Math.min(
          8.5,
          ((winArea * visTrans * zUrbanShade * 0.48) / Math.max(1, zArea * 0.68)) * 100
        )
      ).toFixed(2);
      const da = Math.round(Math.min(96, Math.max(15, df * 24 + (zAnnualIncidentSol / 1200) * 18)));
      const solarGain = +(
        (winArea * zAnnualIncidentSol * shgc * zUrbanShade * modeShadeFactor * shgcMult) /
        Math.max(1, zArea)
      ).toFixed(1);

      const hLoad = +(
        Math.max(
          5,
          ((zFacadeArea * ((1 - zWwr / 100) * uWall + (zWwr / 100) * uWin) * climate.hdd * 0.024) /
            Math.max(1, zArea) -
            solarGain * 0.35) *
            heatingMult
        )
      ).toFixed(1);

      const cLoad = +(
        Math.max(
          4,
          (solarGain * 0.55 + internalLoadsWm2 * 0.9 + (climate.cdd * 0.018)) * coolingMult
        )
      ).toFixed(1);

      return {
        name,
        floorAreaM2: zArea,
        sharePct,
        facadeAreaM2: zFacadeArea,
        wwrPct: zWwr,
        urbanShadingFactor: zUrbanShade,
        daylightFactorPct: df,
        daylightAutonomyPct: da,
        annualSolarGainKwhM2: solarGain,
        heatingLoadKwhM2: hLoad,
        coolingLoadKwhM2: cLoad
      };
    };

    const zones: Record<ThermalZoneName, ThermalZoneSummary> = {
      South: buildZoneSummary('South', perimSouthM2, areaS, wwrS, shadeS, annualSolS),
      North: buildZoneSummary('North', perimNorthM2, areaN, wwrN, shadeN, annualSolN),
      East: buildZoneSummary('East', perimEastM2, areaE, wwrE, shadeE, annualSolE),
      West: buildZoneSummary('West', perimWestM2, areaW, wwrW, shadeW, annualSolW),
      Core: buildZoneSummary('Core', coreM2, 0, 0, 0, 0)
    };

    const avgDaylightFactorPct = +(
      (zones.South.daylightFactorPct +
        zones.North.daylightFactorPct +
        zones.East.daylightFactorPct +
        zones.West.daylightFactorPct) /
      4
    ).toFixed(2);

    const avgDaylightAutonomyPct = Math.round(
      (zones.South.daylightAutonomyPct +
        zones.North.daylightAutonomyPct +
        zones.East.daylightAutonomyPct +
        zones.West.daylightAutonomyPct) /
        4
    );

    // 6. Stage 5 Monthly ISO 52000-1 / EN ISO 13790 Quasi-Steady-State Energy Balance
    const winAreaTotal =
      (areaN * wwrN + areaS * wwrS + areaE * wwrE + areaW * wwrW) / 100;
    const opaqueWallAreaTotal = Math.max(0, totalFacadeArea - winAreaTotal);

    const H_tr =
      opaqueWallAreaTotal * uWall +
      winAreaTotal * uWin +
      footprintArea * uRoof +
      footprintArea * uGround * 0.6;

    const effectiveVentAch = achVent * (1 - hrvEff);
    const H_ve_heat = 0.34 * volume * (achInf + effectiveVentAch);
    const nightFlushAch =
      nightFlush ? 0.6 + (natVentOpeningRatio / 100) * 3.5 + natVentBonusAch : natVentBonusAch;
    const H_ve_cool = 0.34 * volume * (achInf + achVent + nightFlushAch * 0.45);

    const tauHours = Math.round(
      Math.max(
        18,
        Math.min(
          160,
          (kappaI * gfa * 0.42) / Math.max(50, H_tr + H_ve_heat) + tauBonusHours
        )
      )
    );
    const a_H = 1.0 + tauHours / 15.0;

    const monthlyResults = MONTHS.map((mName, idx) => {
      const hoursInMonth = 730;
      const tOut = +(climate.monthlyTemp[idx] + uhiTempDeltaC * 0.5).toFixed(1);

      // Heating & Cooling setpoints
      const tHeatSet = 20.0;
      const tCoolSet = 26.0;

      // Conductive & Ventilation Heat Transfer (kWh/m²)
      const deltaTHeat = Math.max(0, tHeatSet - tOut);
      const qTr = +(((H_tr * deltaTHeat * hoursInMonth) / 1000) / gfa).toFixed(2);
      const qVent = +(((H_ve_heat * deltaTHeat * hoursInMonth) / 1000) / gfa).toFixed(2);
      const qLossHeat = qTr + qVent;

      // Directional Solar Gains adjusted by Stage 2 Urban Shading Multipliers!
      const isSummer = idx >= 4 && idx <= 8;
      const seasonalShadeMult = isSummer ? modeShadeFactor * shgcMult : Math.min(1.0, modeShadeFactor * 1.15);

      const solGainKwh =
        ((areaS * (wwrS / 100) * climate.solarSouth[idx] * shadeS +
          areaN * (wwrN / 100) * climate.solarNorth[idx] * shadeN +
          areaE * (wwrE / 100) * climate.solarEast[idx] * shadeE +
          areaW * (wwrW / 100) * climate.solarWest[idx] * shadeW) *
          shgc *
          0.9 *
          seasonalShadeMult) /
        gfa;

      const qSol = +solGainKwh.toFixed(2);
      const qInt = +(((internalLoadsWm2 * hoursInMonth) / 1000) * 0.85).toFixed(2);
      const qGains = qSol + qInt;

      // ISO 13790 Gain Utilization Factor (eta_H,gn)
      const gammaH = qLossHeat > 0.01 ? qGains / qLossHeat : 10;
      const etaH =
        gammaH > 0 && Math.abs(gammaH - 1) > 1e-4
          ? (1 - Math.pow(gammaH, a_H)) / (1 - Math.pow(gammaH, a_H + 1))
          : 1 / (1 + a_H);

      const rawHeatNeed = Math.max(0, qLossHeat - etaH * qGains) * heatingMult;
      const heatingNeed = +rawHeatNeed.toFixed(2);

      // Cooling balance
      const deltaTCool = tCoolSet - tOut;
      const qHeatSinkCool =
        deltaTCool > 0
          ? (((H_tr + H_ve_cool) * deltaTCool * hoursInMonth) / 1000) / gfa
          : 0;
      const extraConductionGain =
        deltaTCool < 0
          ? (((H_tr + H_ve_cool * 0.35) * Math.abs(deltaTCool) * hoursInMonth) / 1000) / gfa
          : 0;

      const totalCoolGain = qGains + extraConductionGain;
      const gammaC = totalCoolGain > 0.01 ? qHeatSinkCool / totalCoolGain : 10;
      const etaC =
        gammaC > 0 && Math.abs(gammaC - 1) > 1e-4
          ? (1 - Math.pow(gammaC, a_H)) / (1 - Math.pow(gammaC, a_H + 1))
          : 1 / (1 + a_H);

      const rawCoolNeed = Math.max(0, totalCoolGain - etaC * qHeatSinkCool) * coolingMult;
      const coolingNeed = +rawCoolNeed.toFixed(2);

      // On-site Roof PV + South/East/West Spandrel BIPV generation (kWh/m² GFA)
      const roofPvKwh =
        (footprintArea * (roofPvRatio / 100) * climate.solarHoriz[idx] * 0.205 * 0.84) / gfa;
      const bipvSurfaceM2 =
        (areaS * (1 - wwrS / 100) + (areaE * (1 - wwrE / 100) + areaW * (1 - wwrW / 100)) * 0.5) *
        (facadeBipvRatio / 100);
      const bipvKwh =
        (bipvSurfaceM2 *
          ((climate.solarSouth[idx] * shadeS + climate.solarEast[idx] * shadeE) * 0.5) *
          0.165 *
          0.82) /
        gfa;
      const pvGen = +(roofPvKwh + bipvKwh).toFixed(2);

      // EN 16798-1 Free-running Indoor Operative Temperature & Adaptive Comfort Bands
      const tRm = Math.max(10, Math.min(30, climate.monthlyTemp[idx]));
      const comfortOptimal = +(0.33 * tRm + 18.8).toFixed(1);
      const comfortCatIIUpper = +(comfortOptimal + 3.0).toFixed(1);
      const comfortCatIILower = +(comfortOptimal - 4.0).toFixed(1);

      const solarSwing = (qSol / 25) * (1.2 - attenuationFactor * 0.5);
      const ventCoolingOffset = nightFlush ? 1.8 : 0.4;
      const tOperativeFree = +(
        Math.max(
          16.5,
          tOut + 2.8 + solarSwing - (tOut > 22 ? ventCoolingOffset : 0)
        )
      ).toFixed(1);

      return {
        month: mName,
        tOut,
        qTr,
        qVent,
        qSol,
        qInt,
        etaH: +etaH.toFixed(2),
        heatingNeed,
        coolingNeed,
        pvGen,
        tOperativeFree,
        comfortOptimal,
        comfortCatIIUpper,
        comfortCatIILower
      };
    });

    const annualHeatingNeed = +monthlyResults.reduce((s, m) => s + m.heatingNeed, 0).toFixed(1);
    const annualCoolingNeed = +monthlyResults.reduce((s, m) => s + m.coolingNeed, 0).toFixed(1);

    // DALEC Coupled Artificial Lighting Demand (kWh/m²yr)
    const baseLightingPower =
      buildingProgram === 'office'
        ? 11.5
        : buildingProgram === 'educational'
        ? 10.2
        : buildingProgram === 'hospitality'
        ? 12.8
        : 7.5;
    const dimmingSavingFactor = daylightDimming
      ? Math.max(0.28, 1 - (avgDaylightAutonomyPct / 100) * 0.68)
      : 1.0;
    const annualLightingElec = +(baseLightingPower * dimmingSavingFactor).toFixed(1);
    const annualEquipmentElec = +(internalLoadsWm2 * 1.15).toFixed(1);

    const deliveredHeating = +(annualHeatingNeed / Math.max(0.8, heatingCop)).toFixed(1);
    const deliveredCooling = +(annualCoolingNeed / Math.max(1.0, coolingEer)).toFixed(1);
    const totalDeliveredEui = +(
      deliveredHeating +
      deliveredCooling +
      annualLightingElec +
      annualEquipmentElec
    ).toFixed(1);

    const roofPvGeneration = +monthlyResults
      .reduce(
        (s, _, idx) =>
          s + (footprintArea * (roofPvRatio / 100) * climate.solarHoriz[idx] * 0.205 * 0.84) / gfa,
        0
      )
      .toFixed(1);
    const totalOnSitePv = +monthlyResults.reduce((s, m) => s + m.pvGen, 0).toFixed(1);
    const bipvGeneration = +Math.max(0, totalOnSitePv - roofPvGeneration).toFixed(1);
    const districtSharedPvContribution = +(
      (districtSharedRenewableKw * (climate.solarHoriz.reduce((a, b) => a + b, 0) * 0.22)) /
      Math.max(1000, gfa * 4)
    ).toFixed(1);

    const totalRenewableGen = +(totalOnSitePv + districtSharedPvContribution).toFixed(1);
    const netSiteEui = +Math.max(0, totalDeliveredEui - totalRenewableGen).toFixed(1);

    // Primary Energy Factors (UNI/TS 11300 / Italian DM 26/06/2015: f_P,nren = 1.95 for grid electricity, 1.05 for gas)
    const fP_nren = hvacSystem === 'gas_chiller' ? 1.35 : hvacSystem === 'district_network' ? 1.15 : 1.95;
    const primaryEnergyNonRen = +(netSiteEui * fP_nren).toFixed(1);
    const primaryEnergyTotal = +(primaryEnergyNonRen + totalRenewableGen).toFixed(1);
    const renewableSharePct = +Math.min(
      100,
      ((totalRenewableGen + (annualHeatingNeed - deliveredHeating) + (annualCoolingNeed - deliveredCooling)) /
        Math.max(1, annualHeatingNeed + annualCoolingNeed + annualLightingElec + annualEquipmentElec)) *
        100
    ).toFixed(1);

    // Operational Cost (€/m²yr) & Operational Carbon (kgCO2e/m²yr)
    const energyTariffEurKwh = hvacSystem === 'gas_chiller' ? 0.19 : 0.26;
    const operationalCostEurM2 = +(netSiteEui * energyTariffEurKwh).toFixed(2);
    const gridCo2Factor = hvacSystem === 'gas_chiller' ? 0.24 : hvacSystem === 'district_network' ? 0.16 : 0.255;
    const operationalCo2KgM2Yr = +(netSiteEui * gridCo2Factor).toFixed(2);

    // Adaptive Discomfort Hours counter (out of 8,760h)
    let discomfortHours = 0;
    monthlyResults.forEach((m) => {
      if (m.tOperativeFree > m.comfortCatIIUpper) {
        discomfortHours += Math.round((m.tOperativeFree - m.comfortCatIIUpper) * 85);
      } else if (m.tOperativeFree < m.comfortCatIILower) {
        discomfortHours += Math.round((m.comfortCatIILower - m.tOperativeFree) * 45);
      }
    });
    discomfortHours = Math.min(3200, Math.max(20, discomfortHours));
    const comfortHoursPct = +(((8760 - discomfortHours) / 8760) * 100).toFixed(1);

    // Legislative Compliance Checks (Italian DM 26/06/2015 Zone E / EU EPBD)
    const uWallLimit = climate.dpr412Zone === 'E' || climate.dpr412Zone === 'F' ? 0.26 : 0.32;
    const uWinLimit = climate.dpr412Zone === 'E' || climate.dpr412Zone === 'F' ? 1.4 : 1.8;
    const compliance = {
      uWallPass: uWall <= uWallLimit,
      uWinPass: uWin <= uWinLimit,
      yIePass: yIe <= 0.10,
      kappaPass: kappaI >= 40,
      daylightPass: avgDaylightFactorPct >= 2.0,
      nzebPass: renewableSharePct >= 60 && netSiteEui <= 35
    };

    // 7. Stage 2 Zero Energy District Summary Stats
    const districtTotalGfaM2 = gfa * 5;
    const districtStats = {
      plotGfaM2: gfa,
      districtTotalGfaM2,
      districtEnergyDensityKwhM2: totalDeliveredEui,
      sharedRenewableOffsetKwhM2: districtSharedPvContribution,
      mutualShadingReductionPct: Math.round((1 - shadeAvg) * 100)
    };

    // 8. Stage 6 Whole-Life Carbon LCA (EN 15978 Modules A1–A3, B4, B6, C1–C4, Module D)
    // Dynamic Bill of Quantities (BoQ) calculation or structural studio override
    const structBaySpan = Math.max(3.0, +(lengthX / Math.max(1, Math.round(lengthX / 6))).toFixed(2));
    const structBayTrib = Math.max(2.5, +(widthY / Math.max(1, Math.round(widthY / 6))).toFixed(2));
    const structMatSystem: 'RC' | 'Steel' | 'Timber' | 'Masonry' =
      structureSystem === 'clt_hybrid' ? 'Timber' : structureSystem === 'steel_composite' ? 'Steel' : 'RC';

    const isOverrideMatching =
      structuralBoQOverride &&
      (!structuralBoQOverride.materialSystem || structuralBoQOverride.materialSystem === structMatSystem);

    const structuralBoQ: StructuralBoQResult = isOverrideMatching
      ? structuralBoQOverride!
      : computeStructuralBoQ({
          footprintArea,
          floors,
          floorHeight,
          spanL: structBaySpan,
          tributaryWidthBtr: structBayTrib,
          materialSystem: structMatSystem,
          lowCarbonConcrete: structureSystem === 'low_carbon_rc',
          recycledSteel: true,
          biogenicTimber: true
        });

    const a1a3Structure = structuralBoQ.gwpStructureA1A3;
    const a1a3Envelope = Math.round(
      ((opaqueWallAreaTotal * wallEmbodiedCo2PerM2Facade + winAreaTotal * 95 + footprintArea * 48) /
        Math.max(1, gfa))
    );
    const a1a3MepPv = Math.round(
      42 + (footprintArea * (roofPvRatio / 100) * 185) / Math.max(1, gfa)
    );
    const a1a3Total = a1a3Structure + a1a3Envelope + a1a3MepPv;

    // Module B4: Facade/glazing & HVAC replacement over studyPeriodYears
    const replacementCycles = Math.max(1, Math.floor(studyPeriodYears / 25));
    const b4Replacement = Math.round((a1a3Envelope * 0.38 + a1a3MepPv * 0.75) * replacementCycles);

    // Module B6: Cumulative Operational Carbon with progressive grid decarbonization
    let b6Operational50Yr = 0;
    const yearlyTrajectory: Array<{
      year: number;
      cumulativeBaseline: number;
      cumulativeCurrent: number;
      cumulativeNetCircular: number;
    }> = [];

    const baselineUpfront = 460;
    const baselineAnnualOpCo2 = 22.5;
    const c1c4EndOfLife = Math.round(a1a3Total * 0.08);
    const moduleDCredit = -Math.round((a1a3Structure + a1a3Envelope) * (circularityIndex / 100) * 0.55);

    let cumBase = baselineUpfront;
    let cumCurr = a1a3Total;

    for (let yr = 0; yr <= studyPeriodYears; yr += 5) {
      if (yr > 0) {
        for (let step = yr - 4; step <= yr; step++) {
          const decarbMult = Math.pow(1 - gridDecarbonizationRate / 100, step);
          b6Operational50Yr += operationalCo2KgM2Yr * decarbMult;
          cumCurr += operationalCo2KgM2Yr * decarbMult;
          cumBase += baselineAnnualOpCo2 * Math.pow(0.99, step);
          if (step === 25) {
            cumCurr += Math.round(b4Replacement * 0.6);
            cumBase += 95;
          }
          if (step === 40) {
            cumCurr += Math.round(b4Replacement * 0.4);
            cumBase += 65;
          }
        }
      }
      yearlyTrajectory.push({
        year: yr,
        cumulativeBaseline: Math.round(cumBase),
        cumulativeCurrent: Math.round(cumCurr),
        cumulativeNetCircular: Math.round(cumCurr + (yr === studyPeriodYears ? c1c4EndOfLife + moduleDCredit : 0))
      });
    }

    b6Operational50Yr = Math.round(b6Operational50Yr);
    const wholeLifeCarbonGross = a1a3Total + b4Replacement + b6Operational50Yr + c1c4EndOfLife;
    const wholeLifeCarbonNet = wholeLifeCarbonGross + moduleDCredit;
    const embodiedSharePct = Math.round(
      ((a1a3Total + b4Replacement + c1c4EndOfLife) / Math.max(1, wholeLifeCarbonGross)) * 100
    );

    return {
      strategyMods: {
        heatingMult: +heatingMult.toFixed(2),
        coolingMult: +coolingMult.toFixed(2),
        shgcMult: +shgcMult.toFixed(2),
        natVentBonusAch: +natVentBonusAch.toFixed(1),
        tauBonusHours
      },
      urbanShading: { N: shadeN, S: shadeS, E: shadeE, W: shadeW, avg: shadeAvg },
      canyonAnglesDeg: { N: angleN, S: angleS, E: angleE, W: angleW },
      skyViewFactor,
      uhiTempDeltaC,
      districtStats,
      footprintArea,
      gfa,
      buildingHeight,
      volume,
      svRatio,
      facadeAreas: { N: areaN, S: areaS, E: areaE, W: areaW, total: totalFacadeArea },
      solarExposedFacadeM2,
      zones,
      wallThicknessMm: totalThickMm,
      uWall,
      yIe,
      kappaI,
      timeShiftHours,
      attenuationFactor,
      wallEmbodiedCo2PerM2Facade: +wallEmbodiedCo2PerM2Facade.toFixed(1),
      wwrAvg,
      avgDaylightFactorPct,
      avgDaylightAutonomyPct,
      compliance,
      tauHours,
      monthlyResults,
      annualHeatingNeed,
      annualCoolingNeed,
      annualLightingElec,
      annualEquipmentElec,
      deliveredHeating,
      deliveredCooling,
      totalDeliveredEui,
      roofPvGeneration,
      bipvGeneration,
      districtSharedPvContribution,
      totalRenewableGen,
      netSiteEui,
      primaryEnergyTotal,
      primaryEnergyNonRen,
      renewableSharePct,
      operationalCostEurM2,
      operationalCo2KgM2Yr,
      discomfortHours,
      comfortHoursPct,
      structuralBoQ,
      lca: {
        a1a3Structure,
        a1a3Envelope,
        a1a3MepPv,
        a1a3Total,
        b4Replacement,
        b6Operational50Yr,
        c1c4EndOfLife,
        moduleDCredit,
        wholeLifeCarbonGross,
        wholeLifeCarbonNet,
        embodiedSharePct,
        yearlyTrajectory
      }
    };
  }, [
    climate,
    activeStrategies,
    buildingProgram,
    structuralBoQOverride,
    internalLoadsWm2,
    neighborHeightN,
    neighborHeightS,
    neighborHeightE,
    neighborHeightW,
    streetWidthN,
    streetWidthS,
    streetWidthE,
    streetWidthW,
    urbanAzimuth,
    urbanGreenRatio,
    urbanAlbedo,
    districtSharedRenewableKw,
    typology,
    lengthX,
    widthY,
    floors,
    floorHeight,
    perimeterDepth,
    wwrN,
    wwrS,
    wwrE,
    wwrW,
    uWin,
    shgc,
    visTrans,
    overhangDepth,
    shadingMode,
    daylightDimming,
    natVentOpeningRatio,
    wallLayers,
    uRoof,
    uGround,
    achInf,
    achVent,
    hrvEff,
    nightFlush,
    hvacSystem,
    heatingCop,
    coolingEer,
    roofPvRatio,
    facadeBipvRatio,
    structureSystem,
    circularityIndex,
    gridDecarbonizationRate,
    studyPeriodYears
  ]);

  // 3 Saved Scenarios for Stage 5 Side-by-Side Comparison
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([
    {
      id: 'slot_0',
      name: '1. Baseline Reference',
      badge: 'Code Minimum (DM 2015)',
      heatingNeed: 48.2,
      coolingNeed: 36.4,
      lightingElec: 11.2,
      deliveredEui: 68.5,
      pvGen: 14.0,
      netSiteEui: 54.5,
      operationalCostEurM2: 14.17,
      operationalCo2KgM2: 13.9,
      discomfortHours: 940
    },
    {
      id: 'slot_1',
      name: '2. Passive Optimized',
      badge: 'Envelope + Shading + Mass',
      heatingNeed: 22.4,
      coolingNeed: 19.8,
      lightingElec: 6.4,
      deliveredEui: 35.8,
      pvGen: 21.5,
      netSiteEui: 14.3,
      operationalCostEurM2: 3.72,
      operationalCo2KgM2: 3.65,
      discomfortHours: 240
    },
    {
      id: 'slot_2',
      name: '3. Net-Zero District Ready',
      badge: 'GSHP + BIPV + Microgrid',
      heatingNeed: 16.8,
      coolingNeed: 15.2,
      lightingElec: 5.8,
      deliveredEui: 28.4,
      pvGen: 31.2,
      netSiteEui: 0.0,
      operationalCostEurM2: 0.0,
      operationalCo2KgM2: 0.0,
      discomfortHours: 110
    }
  ]);

  const saveCurrentToScenarioSlot = (slotIndex: number) => {
    const defaultTitles = ['1. Baseline Reference', '2. Passive Optimized', '3. Net-Zero District Ready'];
    setSavedScenarios((prev) =>
      prev.map((item, idx) =>
        idx === slotIndex
          ? {
              id: `slot_${slotIndex}`,
              name: defaultTitles[slotIndex] || item.name,
              badge: `${climate.name.split(',')[0]} • S/V ${sim.svRatio} • U=${sim.uWall}`,
              heatingNeed: sim.annualHeatingNeed,
              coolingNeed: sim.annualCoolingNeed,
              lightingElec: sim.annualLightingElec,
              deliveredEui: sim.totalDeliveredEui,
              pvGen: sim.totalRenewableGen,
              netSiteEui: sim.netSiteEui,
              operationalCostEurM2: sim.operationalCostEurM2,
              operationalCo2KgM2: sim.operationalCo2KgM2Yr,
              discomfortHours: sim.discomfortHours
            }
          : item
      )
    );
  };

  const applyOptimizationPreset = (preset: 'baseline' | 'passive' | 'nzeb_district') => {
    if (preset === 'baseline') {
      setWallLayers([
        { id: 'l1', materialId: 'gypsum_plaster', thicknessMm: 20 },
        { id: 'l2', materialId: 'eps_graphite', thicknessMm: 60 },
        { id: 'l3', materialId: 'hollow_brick', thicknessMm: 250 },
        { id: 'l4', materialId: 'gypsum_plaster', thicknessMm: 20 }
      ]);
      setUWin(1.7);
      setShgc(0.58);
      setShadingMode('none');
      setDaylightDimming(false);
      setHrvEff(0.0);
      setNightFlush(false);
      applyHvacPreset('gas_chiller');
      setRoofPvRatio(20);
      setFacadeBipvRatio(0);
      setStructureSystem('rc_standard');
    } else if (preset === 'passive') {
      setWallLayers([
        { id: 'l1', materialId: 'ventilated_cladding', thicknessMm: 20 },
        { id: 'l2', materialId: 'wood_fiber', thicknessMm: 160 },
        { id: 'l3', materialId: 'rc_concrete', thicknessMm: 200 },
        { id: 'l4', materialId: 'gypsum_plaster', thicknessMm: 20 }
      ]);
      setUWin(1.0);
      setShgc(0.35);
      setShadingMode('dynamic_louvers');
      setDaylightDimming(true);
      setHrvEff(0.82);
      setNightFlush(true);
      applyHvacPreset('ashp');
      setRoofPvRatio(65);
      setFacadeBipvRatio(15);
      setStructureSystem('low_carbon_rc');
    } else if (preset === 'nzeb_district') {
      setWallLayers([
        { id: 'l1', materialId: 'ventilated_cladding', thicknessMm: 20 },
        { id: 'l2', materialId: 'wood_fiber', thicknessMm: 180 },
        { id: 'l3', materialId: 'clt_timber', thicknessMm: 180 },
        { id: 'l4', materialId: 'gypsum_plaster', thicknessMm: 25 }
      ]);
      setUWin(0.8);
      setShgc(0.32);
      setShadingMode('dynamic_louvers');
      setDaylightDimming(true);
      setHrvEff(0.86);
      setNightFlush(true);
      applyHvacPreset('gshp');
      setRoofPvRatio(85);
      setFacadeBipvRatio(30);
      setDistrictSharedRenewableKw(200);
      setStructureSystem('clt_hybrid');
      setCircularityIndex(65);
    }
  };

  return (
    <DesignProjectContext.Provider
      value={{
        activeStage,
        setActiveStage,
        climateId,
        setClimateId,
        customClimates,
        addAndSelectClimate,
        climate,
        comfortTempLower,
        setComfortTempLower,
        comfortTempUpper,
        setComfortTempUpper,
        buildingProgram,
        setBuildingProgram,
        targetOccupancyDensity,
        setTargetOccupancyDensity,
        internalLoadsWm2,
        setInternalLoadsWm2,
        legislativeTarget,
        setLegislativeTarget,
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
        neighborHeightN,
        setNeighborHeightN,
        neighborHeightS,
        setNeighborHeightS,
        neighborHeightE,
        setNeighborHeightE,
        neighborHeightW,
        setNeighborHeightW,
        streetWidthN,
        setStreetWidthN,
        streetWidthS,
        setStreetWidthS,
        streetWidthE,
        setStreetWidthE,
        streetWidthW,
        setStreetWidthW,
        urbanAzimuth,
        setUrbanAzimuth,
        urbanMorphology,
        applyUrbanMorphologyPreset,
        urbanGreenRatio,
        setUrbanGreenRatio,
        urbanAlbedo,
        setUrbanAlbedo,
        districtSharedRenewableKw,
        setDistrictSharedRenewableKw,
        typology,
        applyBuildingTypologyPreset,
        lengthX,
        setLengthX,
        widthY,
        setWidthY,
        floors,
        setFloors,
        floorHeight,
        setFloorHeight,
        perimeterDepth,
        setPerimeterDepth,
        selectedZone,
        setSelectedZone,
        wwrN,
        setWwrN,
        wwrS,
        setWwrS,
        wwrE,
        setWwrE,
        wwrW,
        setWwrW,
        uWin,
        setUWin,
        shgc,
        setShgc,
        visTrans,
        setVisTrans,
        overhangDepth,
        setOverhangDepth,
        shadingMode,
        setShadingMode,
        daylightDimming,
        setDaylightDimming,
        natVentOpeningRatio,
        setNatVentOpeningRatio,
        wallLayers,
        setWallLayers,
        uRoof,
        setURoof,
        uGround,
        setUGround,
        achInf,
        setAchInf,
        achVent,
        setAchVent,
        hrvEff,
        setHrvEff,
        nightFlush,
        setNightFlush,
        hvacSystem,
        applyHvacPreset,
        heatingCop,
        setHeatingCop,
        coolingEer,
        setCoolingEer,
        roofPvRatio,
        setRoofPvRatio,
        facadeBipvRatio,
        setFacadeBipvRatio,
        savedScenarios,
        saveCurrentToScenarioSlot,
        applyOptimizationPreset,
        structureSystem,
        setStructureSystem,
        circularityIndex,
        setCircularityIndex,
        gridDecarbonizationRate,
        setGridDecarbonizationRate,
        studyPeriodYears,
        setStudyPeriodYears,
        structuralBoQOverride,
        setStructuralBoQOverride,
        syncMassingToStructure,
        syncStructureToMassing,
        sim
      }}
    >
      {children}
    </DesignProjectContext.Provider>
  );
};

export function useDesignProject(): DesignProjectContextValue {
  const ctx = useContext(DesignProjectContext);
  if (!ctx) {
    throw new Error('useDesignProject must be used within a DesignProjectProvider');
  }
  return ctx;
}

