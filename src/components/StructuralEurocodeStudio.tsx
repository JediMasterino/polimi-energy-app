// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING & INTEGRATED DESIGN STUDIO
// Component: src/components/StructuralEurocodeStudio.tsx
// Complete implementation of datasets, equations, and verification rules from
// BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx (EN 1990 - EN 1996)
// © Politecnico di Milano - Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
// ============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Layers,
  Box,
  FileText,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Upload,
  Info,
  ChevronRight,
  Database,
  ArrowRight,
  Check,
  ShieldCheck,
  Maximize2,
  X,
  BookOpen,
  Wind,
  CloudRain,
  Leaf,
  RefreshCw,
  Zap,
  TrendingDown,
  Activity
} from 'lucide-react';

import {
  CONCRETE_CLASSES,
  TIMBER_CLASSES,
  STEEL_PROFILES,
  MASONRY_GROUPS,
  NATIONAL_ANNEX_PRESETS,
  OCCUPANCY_LOAD_PRESETS,
  NationalAnnexId,
  TimberLoadDuration
} from '../data/eurocodeDataset';

import {
  useDesignProject,
  StructureSystemType
} from '../context/DesignProjectContext';

import {
  SharedDesignBasis,
  DEFAULT_DESIGN_BASIS,
  StructuralBayConfig,
  computeTributaryLoadTakedown,
  generateOptioneeringMatrix,
  calcRcSlab,
  RcSlabInputs,
  calcRcBeam,
  RcBeamInputs,
  calcRcWall,
  RcWallInputs,
  calcRcColumn,
  RcColumnInputs,
  calcSteelBeam,
  SteelBeamInputs,
  calcSteelColumn,
  SteelColumnInputs,
  calcCltSlab,
  CltSlabInputs,
  calcCltWall,
  CltWallInputs,
  calcWoodBeam,
  WoodBeamInputs,
  calcWoodColumn,
  WoodColumnInputs,
  calcMasonryWall,
  MasonryWallInputs,
  EurocodeStatus,
  CalculationRow,
  deriveEnvironmentalLoadsFromClimate,
  optimizeMemberSection,
  OptimizationResult,
  computeEurocode8SeismicActions,
  Eurocode8SeismicParams,
  Eurocode8SeismicResults,
  SeismicGroundType,
  BuildingImportanceClass,
  DuctilityClass,
  GROUND_TYPE_TABLE,
  IMPORTANCE_FACTORS,
  computeStructuralBoQ,
  StructuralBoQResult
} from '../utils/eurocodeCalculators';

import { StructuralBay3DViewer, SelectedMemberType } from './StructuralBay3DViewer';
import { CrossSection3DViewer } from './CrossSection3DViewer';
import { StructuralReportModal, ProjectMetadata } from './StructuralReportModal';
import { EurocodeGuideModal } from './EurocodeGuideModal';

const MEMBER_SCOPE_NOTES: Record<SelectedMemberType, {
  standard: string;
  scope: string;
  domain: string;
  excluded: string;
}> = {
  none: {
    standard: 'EN 1990 Basis of Structural Design',
    scope: 'Multi-storey 3D structural bay framing, load path tributary cascade, and building geometry.',
    domain: 'Building multi-storey structural systems.',
    excluded: 'Select an individual structural member for code compliance checks.'
  },
  rc_slab: {
    standard: 'EN 1992-1-1 §6.1, §6.2, §7.4, §9.2',
    scope: 'Singly reinforced one-way flexure, concrete shear resistance without shear rebar VRd,c, minimum & maximum longitudinal steel, and span-to-depth deflection screen (L/d)adj.',
    domain: 'C20/25 to C50/60 concrete, fyk = 500 MPa rebar, singly reinforced section (μ ≤ 0.2952, x/d ≤ 0.45).',
    excluded: 'Two-way bidirectional slab action, punching shear at column heads, crack width calculation, fire resistance, long-term creep deflection.'
  },
  rc_beam: {
    standard: 'EN 1992-1-1 §6.1, §6.2.3, §7.4, §9.2',
    scope: 'Singly reinforced rectangular beam flexure, variable strut angle shear (1.0 ≤ cotθ ≤ 2.5), link spacing sw ≤ 0.75d, stirrup minimums, and span/depth deflection screen.',
    domain: 'C20/25 to C50/60, fyk = 500 MPa, single layer tension steel, rectangular web section.',
    excluded: 'Compression reinforcement, torsion, lateral-torsional buckling of slender unrestrained beams, anchorage detailing, fire resistance.'
  },
  rc_wall: {
    standard: 'EN 1992-1-1 §5.8.8, §9.6',
    scope: 'Uniaxial compression and out-of-plane bending on unit strip (b = 1000 mm), nominal curvature second-order eccentricity e2, and 28-iteration strain-compatible bisection equilibrium.',
    domain: 'fck ≤ 50 MPa, normalised axial force n ≤ 0.50, slenderness λ ≤ 100, symmetric reinforcement, neutral axis x within section (x < h).',
    excluded: 'In-plane horizontal shear, boundary element rebar cages, ties/transverse links, orthogonal bending plane, foundation rotation.'
  },
  rc_column: {
    standard: 'EN 1992-1-1 §5.8.8, §9.5',
    scope: 'Uniaxial compression-bending of isolated braced column, nominal curvature second-order moment e2, and 28-iteration strain-compatible bisection section equilibrium (parabola-rectangle concrete law).',
    domain: 'fck ≤ 50 MPa, normalised axial force n ≤ 0.50, geometric slenderness λ ≤ 100, symmetric two-face rebar, neutral axis x within section depth h.',
    excluded: 'Biaxial bending (repeat checks separately for orthogonal axis), shear, column-beam joints, links/transverse ties, bar restraint, lap splice zones, crack control, axial shortening.'
  },
  steel_beam: {
    standard: 'EN 1993-1-1 §6.2.5, §6.2.6, §7.2',
    scope: 'IPE, HEA, HEB and hollow SHS/CHS in elastic bending and shear, plus imposed and total SLS deflection limits.',
    domain: 'Hot-finished (EN 10210) or cold-formed (EN 10219) sections. I/H requires assumed lateral restraint; SHS/CHS is inherently exempt from LTB.',
    excluded: 'Unrestrained lateral-torsional buckling for I/H, Class 4 slender sections, web crippling at concentrated loads, connection design.'
  },
  steel_column: {
    standard: 'EN 1993-1-1 §6.3.1',
    scope: 'Concentric axial compression with two-axis flexural buckling (y-y and z-z) and torsional buckling using Eurocode buckling curves (HF curve a, CF curve c).',
    domain: 'Concentric compression only, Class 1-3 cross-sections.',
    excluded: 'Applied first-order bending moments, Class 4 cross-sections, base plates, connection details, thermal elongation.'
  },
  clt_slab: {
    standard: 'EN 1995-1-1 / ETA Shear Analogy',
    scope: 'One-way cross-laminated timber panel in flexure, rolling shear, support bearing Rc90,Rk, instantaneous deflection, and final creep deflection with kdef.',
    domain: 'One-way spanning panel with manufacturer certified or ETA documented properties.',
    excluded: 'Two-way plate action, concentrated wheel/point loads, vibration serviceability (Eurocode 5 Annex), openings/cutouts, inter-panel joints.'
  },
  clt_wall: {
    standard: 'EN 1995-1-1 / ETA Equivalent Column',
    scope: 'One-way CLT wall strip in combined axial compression and out-of-plane lateral wind pressure, equivalent column method buckling with EI05/GA05 and imperfection βc.',
    domain: 'Single-storey height with documented ETA cross-section properties.',
    excluded: 'Diaphragm action, lintels, hold-down bracket tie-downs, acoustic flanking transmission, fire resistance.'
  },
  wood_beam: {
    standard: 'EN 1995-1-1 §6.1, §6.1.5, §7.2',
    scope: 'Solid timber and glulam (C18–GL32h) in bending, shear with crack factor kcr, support bearing compression perp-to-grain fc,90, instantaneous and final creep deflections.',
    domain: 'Service Classes 1–3, five Eurocode load duration classes (kmod), rectangular solid or glued laminated section.',
    excluded: 'Slender beam lateral-torsional buckling if unrestrained, notched supports, hole cuts, timber connections.'
  },
  wood_column: {
    standard: 'EN 1995-1-1 §6.3.2',
    scope: 'Solid timber and glulam in combined axial compression and two-axis bending (My and Mz) with column instability reduction factors kc,y and kc,z.',
    domain: 'Rectangular solid or glulam section, Service Classes 1–3, five load duration classes.',
    excluded: 'Column-to-beam moment connections, column base shoes, cyclic seismic loading.'
  },
  masonry_wall: {
    standard: 'EN 1996-1-1 §6.1, §6.2',
    scope: 'Single-leaf unreinforced masonry in compression at top, mid-height, and bottom with load eccentricities, slenderness reduction factor Φ, and separate bed-joint in-plane shear.',
    domain: 'Clay G1–G4, Calcium Silicate, Concrete, AAC, or Natural Stone units with general purpose mortar.',
    excluded: '3D building box-action, shear wall coupling lintels, soil-structure interaction, reinforced masonry.'
  }
};

export interface StructuralEurocodeStudioProps {
  climate?: any;
}

export const StructuralEurocodeStudio: React.FC<StructuralEurocodeStudioProps> = ({ climate }) => {
  // Connect to PoliMi Design Project Context (Stage 1 - Stage 6)
  const projectCtx = useDesignProject();

  // --------------------------------------------------------------------------
  // WORKFLOW STEPS (1: Project Basis, 2: 3D Bay & Loads, 3: Members & Solver, 4: Comparison & Report)
  // --------------------------------------------------------------------------
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(2);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEtaModal, setShowEtaModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showScopeBanner, setShowScopeBanner] = useState(true);

  // Stage 3 Massing Synchronizer Feedback
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Eurocode 8 (EN 1998-1 / Italian NTC 2018) Seismic Actions State
  const [seismicPga, setSeismicPga] = useState<number>(0.15); // reference ag (0.05g to 0.35g)
  const [seismicGroundType, setSeismicGroundType] = useState<SeismicGroundType>('C');
  const [seismicImportanceClass, setSeismicImportanceClass] = useState<BuildingImportanceClass>('II');
  const [seismicDuctilityClass, setSeismicDuctilityClass] = useState<DuctilityClass>('DCM');
  const [seismicQOverride, setSeismicQOverride] = useState<number | undefined>(undefined);

  // Pillar 4: Climate & Environmental Actions
  const [terrainCategory, setTerrainCategory] = useState<'0' | 'I' | 'II' | 'III' | 'IV'>('III');
  const [syncedClimateInfo, setSyncedClimateInfo] = useState<{
    stationName: string;
    sk: number;
    qp: number;
    deltaT: number;
    peakWind: number;
    tempMin: number;
    tempMax: number;
    snowFormula: string;
    windFormula: string;
  } | null>(null);

  // Pillar 3: Auto-Optimizer
  const [optToast, setOptToast] = useState<OptimizationResult | null>(null);

  // Pillar 5: LCA Sensitivity & Radar
  const [lowCarbonConcrete, setLowCarbonConcrete] = useState(false);
  const [recycledSteel, setRecycledSteel] = useState(false);
  const [biogenicTimber, setBiogenicTimber] = useState(true);
  const [radarFilter, setRadarFilter] = useState<Record<string, boolean>>({
    RC: true,
    Steel: true,
    Timber: true,
    Masonry: true
  });

  // --------------------------------------------------------------------------
  // PROJECT METADATA (7 Parameters per Project Info Sheet)
  // --------------------------------------------------------------------------
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    projectTitle: 'Structural Predimensioning Report',
    jobCode: 'POLIMI-LCH-2026',
    location: 'Milano, Italy',
    architect: 'Politecnico di Milano',
    year: '2026',
    studentName: 'Anxhelo',
    studentLastName: 'Golloberda',
    studentMatricula: '108924',
    client: 'Politecnico di Milano (DABC)',
    authorName: 'Anxhelo Golloberda',
    designStage: 'Schematic',
    revision: 'A.01',
    date: new Date().toISOString().split('T')[0],
    isAcademicHeader: true
  });

  // --------------------------------------------------------------------------
  // SHARED DESIGN BASIS (EC BASIS)
  // --------------------------------------------------------------------------
  const [basis, setBasis] = useState<SharedDesignBasis>({
    ...DEFAULT_DESIGN_BASIS,
    nationalAnnex: 'IT_NTC'
  });

  const handleNationalAnnexChange = (naId: NationalAnnexId) => {
    const preset = NATIONAL_ANNEX_PRESETS[naId];
    setBasis((prev) => ({
      ...prev,
      nationalAnnex: naId,
      gammaG: preset.gammaG,
      gammaQ: preset.gammaQ,
      gammaC: preset.gammaC,
      gammaS: preset.gammaS,
      alphaCC: preset.alphaCC,
      gammaM0: preset.gammaM0,
      gammaM1: preset.gammaM1,
      gammaM_solid: preset.gammaM_solid,
      gammaM_glulam: preset.gammaM_glulam,
      gammaM_m: preset.gammaM_m,
      gammaM_v: preset.gammaM_v
    }));
  };

  const handleOccupancyPresetChange = (presetKey: string) => {
    const occ = OCCUPANCY_LOAD_PRESETS[presetKey];
    if (occ) {
      setBasis((prev) => ({
        ...prev,
        qk: occ.qk,
        gk_add: occ.gk_add,
        psi2: occ.psi2
      }));
    }
  };

  // --------------------------------------------------------------------------
  // 3D STRUCTURAL BAY CONFIGURATION
  // --------------------------------------------------------------------------
  const [bayConfig, setBayConfig] = useState<StructuralBayConfig>({
    spanL: 6.0,
    tributaryWidthBtr: 3.0,
    storeyHeightH: 3.0,
    numberOfStoreys: 3,
    materialSystem: 'RC',
    occupancyCategory: 'Cat_B_Office',
    autoLoadTakedown: true
  });

  // REFERENCE BAY PRESETS
  const applyReferenceBayPreset = (preset: 'office' | 'residential' | 'timber' | 'masonry') => {
    if (preset === 'office') {
      setBayConfig({
        spanL: 6.0,
        tributaryWidthBtr: 6.0,
        storeyHeightH: 3.5,
        numberOfStoreys: 4,
        materialSystem: 'Steel',
        occupancyCategory: 'Cat_B_Office',
        autoLoadTakedown: true
      });
      handleOccupancyPresetChange('Cat_B_Office');
      setActiveMember((prev) => (prev === 'none' ? 'none' : 'steel_beam'));
    } else if (preset === 'residential') {
      setBayConfig({
        spanL: 5.0,
        tributaryWidthBtr: 4.5,
        storeyHeightH: 3.0,
        numberOfStoreys: 3,
        materialSystem: 'RC',
        occupancyCategory: 'Cat_A_Residential',
        autoLoadTakedown: true
      });
      handleOccupancyPresetChange('Cat_A_Residential');
      setActiveMember((prev) => (prev === 'none' ? 'none' : 'rc_slab'));
    } else if (preset === 'timber') {
      setBayConfig({
        spanL: 8.0,
        tributaryWidthBtr: 4.0,
        storeyHeightH: 3.5,
        numberOfStoreys: 2,
        materialSystem: 'Timber',
        occupancyCategory: 'Cat_C_Assembly',
        autoLoadTakedown: true
      });
      handleOccupancyPresetChange('Cat_C_Assembly');
      setActiveMember((prev) => (prev === 'none' ? 'none' : 'clt_slab'));
    } else if (preset === 'masonry') {
      setBayConfig({
        spanL: 4.5,
        tributaryWidthBtr: 3.0,
        storeyHeightH: 3.0,
        numberOfStoreys: 2,
        materialSystem: 'Masonry',
        occupancyCategory: 'Cat_A_Residential',
        autoLoadTakedown: true
      });
      handleOccupancyPresetChange('Cat_A_Residential');
      setActiveMember((prev) => (prev === 'none' ? 'none' : 'masonry_wall'));
    }
  };

  // --------------------------------------------------------------------------
  // ACTIVE MEMBER & MEMBER INPUT PARAMETERS (11 SHEETS)
  // --------------------------------------------------------------------------
  const [activeMember, setActiveMember] = useState<SelectedMemberType>('none');

  // Tributary Load Takedown derivation
  const takedown = useMemo(
    () => computeTributaryLoadTakedown(bayConfig, basis),
    [bayConfig, basis]
  );

  // 1. RC Slab (12 parameters per RC Slab sheet)
  const [rcSlabInputs, setRcSlabInputs] = useState<RcSlabInputs>({
    L: 4.5, Btr: 1.0, b: 1000, h: 220, cnom: 30, phi: 12, phi_link: 0, s: 150, phi_t: 8, s_t: 200,
    concreteClass: 'C30/37', fyk: 500
  });

  // 2. RC Beam (13 parameters per RC Beam sheet)
  const [rcBeamInputs, setRcBeamInputs] = useState<RcBeamInputs>({
    L: 6.0, Btr: 3.0, b: 300, h: 550, cnom: 30, phi: 20, phi_link: 8, n: 4, nleg: 2,
    sw: 200, cot_theta: 2.0, concreteClass: 'C30/37', fyk: 500
  });

  // 3. RC Wall (16 parameters per RC Wall sheet)
  const [rcWallInputs, setRcWallInputs] = useState<RcWallInputs>({
    H: 3.0, l0: 3.0, b: 1000, h: 200, a: 40, phi: 12, s: 200,
    NG_k: 200, NQ_k: 70, M0_Ed: 4.0, phi_ef: 2.0, c: 8, phi_h: 8, s_h: 200,
    concreteClass: 'C30/37', fyk: 500
  });

  // 4. RC Column (14 parameters per RC Column sheet)
  const [rcColInputs, setRcColInputs] = useState<RcColumnInputs>({
    H: 3.0, l0: 3.0, b: 400, h: 400, a: 50, phi: 20, n_bars: 3,
    NG_k: 550, NQ_k: 150, M0_Ed: 35.0, phi_ef: 2.0, c: 8,
    concreteClass: 'C30/37', fyk: 500
  });

  // 5. Steel Beam (7 parameters per Steel Beam sheet)
  const [steelBeamInputs, setSteelBeamInputs] = useState<SteelBeamInputs>({
    L: 6.0, Btr: 3.0, profileName: 'IPE 300', grade: 'S355', restraint: 'Assumed',
    div_Q: 300, div_total: 250
  });

  // 6. Steel Column (10 parameters per Steel Column sheet)
  const [steelColInputs, setSteelColInputs] = useState<SteelColumnInputs>({
    H: 3.0, lcr_y: 3.0, lcr_z: 3.0, lcr_T: 3.0, NG_k: 400, NQ_k: 150, My_Ed: 0, Mz_Ed: 0,
    profileName: 'HE 240 B', grade: 'S355'
  });

  // 7. CLT Slab (17 parameters per CLT Slab sheet)
  const [cltSlabInputs, setCltSlabInputs] = useState<CltSlabInputs>({
    L: 5.0, Btr: 1.0, t: 160, weight: 5.0, EI_mean: 3.0e12, GA_eff: 8.0e6, MR_k: 60, VR_k: 45, Rc90_Rk: 150,
    gammaM: 1.30, kmod_G: 0.60, kmod_GQ: 0.80, kdef: 0.80, div_Q: 300, div_fin: 200,
    productName: 'EXAMPLE 160 mm 5-layer', isDocumented: false
  });

  // 8. CLT Wall (24 parameters per CLT Wall sheet)
  const [cltWallInputs, setCltWallInputs] = useState<CltWallInputs>({
    H: 3.0, l0: 3.0, NG_k: 120, NQ_k: 50, e: 10, pk: 0.5, H_divisor: 300,
    isMethodConfirmed: false, productName: 'EXAMPLE 160 mm 5-layer', isDocumented: false,
    t: 160, weight: 5.0, EI_mean: 3.0e12, GA_eff: 8.0e6, MR_k: 60, VR_k: 45, gammaM: 1.30,
    kmod_G: 0.60, kmod_GQ: 0.80, kdef: 0.80, Nc_Rk: 2000, EI_05: 2.0e12, GA_05: 5.0e6, beta_c: 0.20
  });

  // 9. Wood Beam (13 parameters per Wood Beam sheet)
  const [woodBeamInputs, setWoodBeamInputs] = useState<WoodBeamInputs>({
    L: 6.0, Btr: 0.6, b: 120, h: 320, a: 120, restraint: 'Assumed', kcr: 0.67,
    div_Q: 300, div_fin: 200, timberClass: 'GL24h', serviceClass: 1,
    duration: 'Medium-term', weight: 5.0
  });

  // 10. Wood Column (16 parameters per Wood Column sheet)
  const [woodColInputs, setWoodColInputs] = useState<WoodColumnInputs>({
    H: 3.0, b: 200, h: 240, l0_y: 3.0, l0_z: 3.0, NG_k: 100, NQ_k: 40,
    MGy_k: 2.0, MQy_k: 1.0, MGz_k: 1.0, MQz_k: 0.5, restraint: 'Assumed',
    timberClass: 'GL24h', serviceClass: 1, duration: 'Medium-term', weight: 5.0
  });

  // 11. Masonry Wall (25 parameters per Masonry Wall sheet)
  const [masonryInputs, setMasonryInputs] = useState<MasonryWallInputs>({
    l: 1.0, H: 3.0, t: 250, hef: 3.0, NG_k: 150, NQ_k: 50,
    MEd_t: 2.0, MEd_m: 3.0, MEd_b: 2.0, unitGroup: 'Clay / G1', fkRoute: 'From fb and fm',
    fb: 10, fm: 5, fk_test: 4.5, K_NA: 0, KE: 1000, phi_inf: 1.0, weight: 18,
    isExampleData: true, VEd: 20, NEd_v: 180, lc: 1.0, fvk0: 0.20, capRule: '0.065 fb', fvlt: 0.65
  });

  // --------------------------------------------------------------------------
  // CALCULATIONS FOR ALL 11 MEMBERS
  // --------------------------------------------------------------------------
  const rcSlabRes = useMemo(
    () => calcRcSlab(bayConfig.autoLoadTakedown ? { ...rcSlabInputs, L: bayConfig.spanL } : rcSlabInputs, basis),
    [rcSlabInputs, bayConfig, basis]
  );
  const rcBeamRes = useMemo(
    () => calcRcBeam(bayConfig.autoLoadTakedown ? { ...rcBeamInputs, L: bayConfig.spanL, Btr: bayConfig.tributaryWidthBtr } : rcBeamInputs, basis),
    [rcBeamInputs, bayConfig, basis]
  );
  const rcWallRes = useMemo(
    () => calcRcWall(bayConfig.autoLoadTakedown ? { ...rcWallInputs, H: bayConfig.storeyHeightH, l0: bayConfig.storeyHeightH, NG_k: takedown.wall_NG_k, NQ_k: takedown.wall_NQ_k } : rcWallInputs, basis),
    [rcWallInputs, bayConfig, takedown, basis]
  );
  const rcColRes = useMemo(
    () => calcRcColumn(bayConfig.autoLoadTakedown ? { ...rcColInputs, H: bayConfig.storeyHeightH, l0: bayConfig.storeyHeightH, NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k } : rcColInputs, basis),
    [rcColInputs, bayConfig, takedown, basis]
  );

  const steelBeamRes = useMemo(
    () => calcSteelBeam(bayConfig.autoLoadTakedown ? { ...steelBeamInputs, L: bayConfig.spanL, Btr: bayConfig.tributaryWidthBtr } : steelBeamInputs, basis),
    [steelBeamInputs, bayConfig, basis]
  );
  const steelColRes = useMemo(
    () => calcSteelColumn(bayConfig.autoLoadTakedown ? { ...steelColInputs, H: bayConfig.storeyHeightH, lcr_y: bayConfig.storeyHeightH, lcr_z: bayConfig.storeyHeightH, lcr_T: bayConfig.storeyHeightH, NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k } : steelColInputs, basis),
    [steelColInputs, bayConfig, takedown, basis]
  );

  const cltSlabRes = useMemo(
    () => calcCltSlab(bayConfig.autoLoadTakedown ? { ...cltSlabInputs, L: bayConfig.spanL } : cltSlabInputs, basis),
    [cltSlabInputs, bayConfig, basis]
  );
  const cltWallRes = useMemo(
    () => calcCltWall(bayConfig.autoLoadTakedown ? { ...cltWallInputs, H: bayConfig.storeyHeightH, l0: bayConfig.storeyHeightH, NG_k: takedown.wall_NG_k, NQ_k: takedown.wall_NQ_k } : cltWallInputs, basis),
    [cltWallInputs, bayConfig, takedown, basis]
  );

  const woodBeamRes = useMemo(
    () => calcWoodBeam(bayConfig.autoLoadTakedown ? { ...woodBeamInputs, L: bayConfig.spanL, Btr: bayConfig.tributaryWidthBtr } : woodBeamInputs, basis),
    [woodBeamInputs, bayConfig, basis]
  );
  const woodColRes = useMemo(
    () => calcWoodColumn(bayConfig.autoLoadTakedown ? { ...woodColInputs, H: bayConfig.storeyHeightH, l0_y: bayConfig.storeyHeightH, l0_z: bayConfig.storeyHeightH, NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k } : woodColInputs, basis),
    [woodColInputs, bayConfig, takedown, basis]
  );

  const masonryRes = useMemo(
    () => calcMasonryWall(bayConfig.autoLoadTakedown ? { ...masonryInputs, H: bayConfig.storeyHeightH, hef: bayConfig.storeyHeightH, NG_k: takedown.wall_NG_k, NQ_k: takedown.wall_NQ_k } : masonryInputs, basis),
    [masonryInputs, bayConfig, takedown, basis]
  );

  // Map of all member results for 3D coloring & report
  const allMemberResults: Record<string, { eta_max: number; status: EurocodeStatus; rows: CalculationRow[] }> = {
    rc_slab: rcSlabRes,
    rc_beam: rcBeamRes,
    rc_wall: rcWallRes,
    rc_column: rcColRes,
    steel_beam: steelBeamRes,
    steel_column: steelColRes,
    clt_slab: cltSlabRes,
    clt_wall: cltWallRes,
    wood_beam: woodBeamRes,
    wood_column: woodColRes,
    masonry_wall: masonryRes
  };

  // Optioneering matrix for multi-system comparison
  const optioneeringMatrix = useMemo(
    () => generateOptioneeringMatrix(bayConfig, basis),
    [bayConfig, basis]
  );

  // Active Member Calculation details
  const activeDetails = useMemo(() => {
    switch (activeMember) {
      case 'rc_slab':
        return { name: 'RC Slab (One-Way)', params: rcSlabInputs, setParams: setRcSlabInputs, result: rcSlabRes };
      case 'rc_beam':
        return { name: 'RC Beam (Rectangular)', params: rcBeamInputs, setParams: setRcBeamInputs, result: rcBeamRes };
      case 'rc_wall':
        return { name: 'RC Wall Strip', params: rcWallInputs, setParams: setRcWallInputs, result: rcWallRes };
      case 'rc_column':
        return { name: 'RC Column (Uniaxial)', params: rcColInputs, setParams: setRcColInputs, result: rcColRes };
      case 'steel_beam':
        return { name: 'Steel Beam (I/H, SHS, CHS)', params: steelBeamInputs, setParams: setSteelBeamInputs, result: steelBeamRes };
      case 'steel_column':
        return { name: 'Steel Column (Two-Axis Buckling)', params: steelColInputs, setParams: setSteelColInputs, result: steelColRes };
      case 'clt_slab':
        return { name: 'CLT Slab (One-Way)', params: cltSlabInputs, setParams: setCltSlabInputs, result: cltSlabRes };
      case 'clt_wall':
        return { name: 'CLT Wall Strip', params: cltWallInputs, setParams: setCltWallInputs, result: cltWallRes };
      case 'wood_beam':
        return { name: 'Wood Beam (Glulam / Solid)', params: woodBeamInputs, setParams: setWoodBeamInputs, result: woodBeamRes };
      case 'wood_column':
        return { name: 'Wood Column (Glulam / Solid)', params: woodColInputs, setParams: setWoodColInputs, result: woodColRes };
      case 'masonry_wall':
        return { name: 'Masonry Wall Strip', params: masonryInputs, setParams: setMasonryInputs, result: masonryRes };
      default:
        return { name: 'RC Slab', params: rcSlabInputs, setParams: setRcSlabInputs, result: rcSlabRes };
    }
  }, [
    activeMember,
    rcSlabInputs, rcSlabRes,
    rcBeamInputs, rcBeamRes,
    rcWallInputs, rcWallRes,
    rcColInputs, rcColRes,
    steelBeamInputs, steelBeamRes,
    steelColInputs, steelColRes,
    cltSlabInputs, cltSlabRes,
    cltWallInputs, cltWallRes,
    woodBeamInputs, woodBeamRes,
    woodColInputs, woodColRes,
    masonryInputs, masonryRes
  ]);

  // Overall Governing Member in current system
  const currentSystemSummary = useMemo(() => {
    const activeSys = optioneeringMatrix.find((s) => s.system === bayConfig.materialSystem) || optioneeringMatrix[0];
    return activeSys;
  }, [optioneeringMatrix, bayConfig.materialSystem]);

  // --------------------------------------------------------------------------
  // ITEM 1.2: DYNAMIC BILL OF QUANTITIES (BoQ) & EMBODIED CARBON BRIDGE
  // --------------------------------------------------------------------------
  const liveBoQ: StructuralBoQResult = useMemo(() => {
    const footprint = projectCtx?.sim?.footprintArea || 512;
    return computeStructuralBoQ({
      footprintArea: footprint,
      floors: bayConfig.numberOfStoreys,
      floorHeight: bayConfig.storeyHeightH,
      spanL: bayConfig.spanL,
      tributaryWidthBtr: bayConfig.tributaryWidthBtr,
      materialSystem: bayConfig.materialSystem,
      lowCarbonConcrete,
      recycledSteel,
      biogenicTimber,
      slabThicknessMm: bayConfig.materialSystem === 'RC' ? rcSlabInputs.h : bayConfig.materialSystem === 'Timber' ? cltSlabInputs.t : 120,
      beamWidthMm: bayConfig.materialSystem === 'RC' ? rcBeamInputs.b : bayConfig.materialSystem === 'Timber' ? woodBeamInputs.b : undefined,
      beamDepthMm: bayConfig.materialSystem === 'RC' ? rcBeamInputs.h : bayConfig.materialSystem === 'Timber' ? woodBeamInputs.h : undefined,
      columnWidthMm: bayConfig.materialSystem === 'RC' ? rcColInputs.b : bayConfig.materialSystem === 'Timber' ? woodColInputs.b : undefined,
      columnDepthMm: bayConfig.materialSystem === 'RC' ? rcColInputs.h : bayConfig.materialSystem === 'Timber' ? woodColInputs.h : undefined,
      steelBeamProfile: steelBeamInputs.profileName,
      steelColProfile: steelColInputs.profileName
    });
  }, [
    bayConfig,
    projectCtx?.sim?.footprintArea,
    lowCarbonConcrete,
    recycledSteel,
    biogenicTimber,
    rcSlabInputs.h,
    rcBeamInputs.b,
    rcBeamInputs.h,
    rcColInputs.b,
    rcColInputs.h,
    cltSlabInputs.t,
    woodBeamInputs.b,
    woodBeamInputs.h,
    woodColInputs.b,
    woodColInputs.h,
    steelBeamInputs.profileName,
    steelColInputs.profileName
  ]);

  // Synchronize dynamic BoQ into Project Context for Stage 6 LCA
  useEffect(() => {
    if (projectCtx?.setStructuralBoQOverride) {
      projectCtx.setStructuralBoQOverride(liveBoQ);
    }
  }, [liveBoQ, projectCtx]);

  // --------------------------------------------------------------------------
  // ITEM 1.3: EUROCODE 8 / NTC 2018 SEISMIC ACTIONS CALCULATION
  // --------------------------------------------------------------------------
  const seismicResults: Eurocode8SeismicResults = useMemo(() => {
    const totalFootprintArea = projectCtx?.sim?.footprintArea || 500;
    const bayArea = Math.max(9, bayConfig.spanL * bayConfig.tributaryWidthBtr);
    const bayCount = Math.max(4, Math.round(totalFootprintArea / bayArea));

    // Seismic weight combination: W_seismic = sum Gk + psi2 * sum Qk
    const deadWeightPerFloorKn = (basis.gk_add + takedown.slab_gk_self) * totalFootprintArea + (takedown.beam_gk_self * bayCount * bayConfig.spanL);
    const liveWeightPerFloorKn = basis.qk * totalFootprintArea;
    const psi2 = basis.psi2 ?? 0.30;
    const totalSeismicWeightKn = (deadWeightPerFloorKn + psi2 * liveWeightPerFloorKn) * bayConfig.numberOfStoreys;

    const structType =
      bayConfig.materialSystem === 'Steel'
        ? 'steel_frame'
        : bayConfig.materialSystem === 'RC'
        ? 'rc_frame'
        : 'shear_wall_timber_other';

    return computeEurocode8SeismicActions({
      ag_g: seismicPga,
      groundType: seismicGroundType,
      importanceClass: seismicImportanceClass,
      ductilityClass: seismicDuctilityClass,
      q_behaviorFactor: seismicQOverride,
      totalHeightH: bayConfig.numberOfStoreys * bayConfig.storeyHeightH,
      totalWeightWk: totalSeismicWeightKn,
      numberOfStoreys: bayConfig.numberOfStoreys,
      structuralType: structType
    });
  }, [
    seismicPga,
    seismicGroundType,
    seismicImportanceClass,
    seismicDuctilityClass,
    seismicQOverride,
    bayConfig.spanL,
    bayConfig.tributaryWidthBtr,
    bayConfig.numberOfStoreys,
    bayConfig.storeyHeightH,
    bayConfig.materialSystem,
    basis.gk_add,
    basis.qk,
    basis.psi2,
    takedown.slab_gk_self,
    takedown.beam_gk_self,
    projectCtx?.sim?.footprintArea
  ]);

  // --------------------------------------------------------------------------
  // ITEM 1.1: TWO-WAY MASSING & STRUCTURAL BAY SYNCHRONIZER
  // --------------------------------------------------------------------------
  const massingData = {
    lengthX: projectCtx?.lengthX ?? 32,
    widthY: projectCtx?.widthY ?? 16,
    floors: projectCtx?.floors ?? 5,
    floorHeight: projectCtx?.floorHeight ?? 3.4,
    footprintArea: projectCtx?.sim?.footprintArea ?? 512,
    buildingHeight: projectCtx?.sim?.buildingHeight ?? 17.0,
    buildingProgram: projectCtx?.buildingProgram ?? 'office',
    structureSystem: projectCtx?.structureSystem ?? 'rc_standard'
  };

  let mappedCurrentSystem: StructureSystemType = 'rc_standard';
  if (bayConfig.materialSystem === 'Steel') mappedCurrentSystem = 'steel_composite';
  else if (bayConfig.materialSystem === 'Timber') mappedCurrentSystem = 'clt_hybrid';
  else if (bayConfig.materialSystem === 'RC') mappedCurrentSystem = lowCarbonConcrete ? 'low_carbon_rc' : 'rc_standard';

  const isMaterialSynced = massingData.structureSystem === mappedCurrentSystem;
  const isGeometrySynced =
    massingData.floors === bayConfig.numberOfStoreys &&
    Math.abs(massingData.floorHeight - bayConfig.storeyHeightH) < 0.05;
  const isSynced = isMaterialSynced && isGeometrySynced;

  const handleSyncMassingToStructure = () => {
    if (!projectCtx) return;
    const { lengthX, widthY, floors, floorHeight, buildingProgram, structureSystem } = projectCtx;

    // Subdivide footprint into modular structural bays (typically 5-7 m)
    const baysX = Math.max(1, Math.round(lengthX / 6));
    const spanL = +(lengthX / baysX).toFixed(2);
    const baysY = Math.max(1, Math.round(widthY / 6));
    const tribW = +(widthY / baysY).toFixed(2);

    let matSys: 'RC' | 'Steel' | 'Timber' | 'Masonry' = 'RC';
    if (structureSystem === 'steel_composite') matSys = 'Steel';
    else if (structureSystem === 'clt_hybrid') matSys = 'Timber';
    else if (structureSystem === 'low_carbon_rc') {
      matSys = 'RC';
      setLowCarbonConcrete(true);
    } else {
      matSys = 'RC';
      setLowCarbonConcrete(false);
    }

    let occCat = 'Cat_B_Office';
    if (buildingProgram === 'residential' || buildingProgram === 'hospitality') occCat = 'Cat_A_Residential';
    else if (buildingProgram === 'educational') occCat = 'Cat_C_Assembly';
    else if (buildingProgram === 'office') occCat = 'Cat_B_Office';

    setBayConfig((prev) => ({
      ...prev,
      spanL,
      tributaryWidthBtr: tribW,
      storeyHeightH: floorHeight,
      numberOfStoreys: floors,
      materialSystem: matSys,
      occupancyCategory: occCat,
      autoLoadTakedown: true
    }));

    handleOccupancyPresetChange(occCat);

    setSyncNotification(
      `Synced from Stage 3 Massing: Footprint ${lengthX}×${widthY}m → Bay ${spanL}×${tribW}m, ${floors} storeys @ ${floorHeight}m, Program ${buildingProgram} → ${occCat}, System → ${matSys}.`
    );
  };

  const handleSyncStructureToMassing = () => {
    if (!projectCtx) return;

    let mappedSystem: StructureSystemType = 'rc_standard';
    if (bayConfig.materialSystem === 'Steel') mappedSystem = 'steel_composite';
    else if (bayConfig.materialSystem === 'Timber') mappedSystem = 'clt_hybrid';
    else if (bayConfig.materialSystem === 'RC') mappedSystem = lowCarbonConcrete ? 'low_carbon_rc' : 'rc_standard';
    else mappedSystem = 'rc_standard';

    projectCtx.syncStructureToMassing({
      floors: bayConfig.numberOfStoreys,
      floorHeight: bayConfig.storeyHeightH,
      structureSystem: mappedSystem
    });

    if (projectCtx.setStructuralBoQOverride) {
      projectCtx.setStructuralBoQOverride(liveBoQ);
    }

    setSyncNotification(
      `Pushed to Stage 3 & Stage 6: ${bayConfig.numberOfStoreys} storeys @ ${bayConfig.storeyHeightH}m, Material ${mappedSystem}, BoQ GWP = ${liveBoQ.gwpStructureA1A3} kgCO₂e/m² (${liveBoQ.totalStructureCo2Tonnes} tCO₂e).`
    );
  };

  // Pillar 4: Handle Weather Station Climate Sync
  const handleSyncClimate = () => {
    const sourceClimate = climate || {
      name: 'Milano Linate (EPW Boundary)',
      lat: 45.46,
      elevation: 103,
      hourly: []
    };
    const derived = deriveEnvironmentalLoadsFromClimate(sourceClimate, terrainCategory);
    setBasis((prev) => ({
      ...prev,
      sk_snow: derived.sk_snow_kNm2,
      qp_wind: derived.qp_wind_kNm2,
      deltaT_thermal: derived.deltaT_thermal_deg,
      terrainCategory: terrainCategory as any,
      syncWeatherSource: derived.stationName
    }));
    setCltWallInputs((prev) => ({ ...prev, pk: derived.qp_wind_kNm2 }));
    if (sourceClimate.name && !metadata.location.includes(sourceClimate.name)) {
      setMetadata((prev) => ({ ...prev, location: `${sourceClimate.name} (${derived.elevation}m a.s.l.)` }));
    }
    setSyncedClimateInfo({
      stationName: derived.stationName,
      sk: derived.sk_snow_kNm2,
      qp: derived.qp_wind_kNm2,
      deltaT: derived.deltaT_thermal_deg,
      peakWind: derived.peakWindSpeedMs,
      tempMin: derived.tempMinC,
      tempMax: derived.tempMaxC,
      snowFormula: derived.snowFormulaText,
      windFormula: derived.windFormulaText
    });
  };

  // Pillar 3: Handle Auto-Optimizer for the currently active member
  const handleAutoOptimize = () => {
    const res = optimizeMemberSection(activeMember, activeDetails.params, basis);
    setOptToast(res);
    if (res.success) {
      if (activeMember === 'rc_column') setRcColInputs(res.optimizedParams);
      else if (activeMember === 'rc_beam') setRcBeamInputs(res.optimizedParams);
      else if (activeMember === 'steel_column') setSteelColInputs(res.optimizedParams);
      else if (activeMember === 'steel_beam') setSteelBeamInputs(res.optimizedParams);
      else if (activeMember === 'wood_beam') setWoodBeamInputs(res.optimizedParams);
      else if (activeMember === 'wood_column') setWoodColInputs(res.optimizedParams);
      else if (activeMember === 'rc_slab') setRcSlabInputs(res.optimizedParams);
    }
  };

  return (
    <div className="space-y-4">
      {/* =====================================================================
          PERSISTENT TOP STUDIO HEADER & 4-STEP WORKFLOW BAR
         ===================================================================== */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  3D Eurocode Structural Pre-Dimensioning Studio
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  EN 1990–1996 • AY 2026–27
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PoliMi DABC • Integrated Architectural & Structural Sizing Engine
              </p>
            </div>
          </div>

          {/* Quick Actions & A4 Report Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
              title="Eurocodes Essential Preliminary Sizing Guide: 7-Rule Workflow & Sheet Scope"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Eurocode Guide: Workflow & Scope
            </button>
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
              title="Open Printable A4 Calculation Dossier"
            >
              <FileText className="w-3.5 h-3.5" />
              A4 Calculation Dossier
            </button>
          </div>
        </div>

        {/* 4-Step Interactive Workflow Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
              activeStep === 1
                ? 'bg-sky-950/60 border-sky-500/80 text-sky-200'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="p-1 rounded-md bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 1</div>
              <div className="text-xs font-extrabold text-white">EC Basis & Loads</div>
              <div className="text-[10px] text-slate-400">EN 1990 / 1991 Occupancy</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
              activeStep === 2
                ? 'bg-sky-950/60 border-sky-500/80 text-sky-200'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="p-1 rounded-md bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
              <Box className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 2</div>
              <div className="text-xs font-extrabold text-white">3D Bay & Load Path</div>
              <div className="text-[10px] text-slate-400">Interactive WebGL & Takedown</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeMember === 'none') {
                const defaultMember =
                  bayConfig.materialSystem === 'RC'
                    ? 'rc_slab'
                    : bayConfig.materialSystem === 'Steel'
                    ? 'steel_beam'
                    : bayConfig.materialSystem === 'Timber'
                    ? 'clt_slab'
                    : 'masonry_wall';
                setActiveMember(defaultMember);
              }
              setActiveStep(3);
            }}
            className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
              activeStep === 3
                ? 'bg-sky-950/60 border-sky-500/80 text-sky-200'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="p-1 rounded-md bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 3</div>
              <div className="text-xs font-extrabold text-white">Cross-Sections & Solver</div>
              <div className="text-[10px] text-slate-400">11 Eurocode Member Sheets</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(4)}
            className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
              activeStep === 4
                ? 'bg-sky-950/60 border-sky-500/80 text-sky-200'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="p-1 rounded-md bg-sky-500/20 text-sky-400 shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 4</div>
              <div className="text-xs font-extrabold text-white">Optioneering & Dossier</div>
              <div className="text-[10px] text-slate-400">Depth, Weight & Carbon LCA</div>
            </div>
          </button>
        </div>

        {/* Quick Reference Bay Preset Switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">Reference Presets:</span>
          <button
            type="button"
            onClick={() => applyReferenceBayPreset('office')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold transition"
          >
            Office 6×6m Grid (Steel)
          </button>
          <button
            type="button"
            onClick={() => applyReferenceBayPreset('residential')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 font-semibold transition"
          >
            Residential 5×4.5m Grid (RC)
          </button>
          <button
            type="button"
            onClick={() => applyReferenceBayPreset('timber')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold transition"
          >
            Timber Pavilion 8×4m (Glulam+CLT)
          </button>
          <button
            type="button"
            onClick={() => applyReferenceBayPreset('masonry')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 font-semibold transition"
          >
            Masonry Housing 4.5×3m
          </button>
        </div>
      </div>

      {/* =====================================================================
          ITEM 1.1 & 1.2: TWO-WAY MASSING & STRUCTURAL BAY SYNCHRONIZER BANNER
         ===================================================================== */}
      <div className="bg-slate-950/80 border border-indigo-900/60 rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <RefreshCw className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                  Two-Way Massing & Structural Bay Synchronizer
                </span>
                {isSynced ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    In Sync with Stage 3
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Parameters Differ from Stage 3
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Manual bidirectional bridge linking Stage 3 Massing footprint, storeys, and floor height with Eurocode Structural Framing and Stage 6 LCA BoQ.
              </p>
            </div>
          </div>

          {/* Sync Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMassingToStructure}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
              title="Import footprint length, width, floor height, storey count, and occupancy category from Stage 3 Massing"
            >
              <Download className="w-3.5 h-3.5" />
              Sync Massing to Structure
            </button>

            <button
              type="button"
              onClick={handleSyncStructureToMassing}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
              title="Export structural storey height, storey count, material system, and BoQ to Stage 3 and Stage 6 LCA"
            >
              <Upload className="w-3.5 h-3.5" />
              Sync Structure to Massing
            </button>
          </div>
        </div>

        {/* 4 Parameter Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Stage 3 Massing Geometry */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Box className="w-3 h-3 text-teal-400" />
              Stage 3 Massing
            </div>
            <div className="space-y-0.5 text-slate-200">
              <div>Footprint: <span className="font-mono font-bold text-white">{massingData.lengthX}m × {massingData.widthY}m</span> ({massingData.footprintArea} m²)</div>
              <div>Storeys: <span className="font-mono font-bold text-white">{massingData.floors} fl</span> @ {massingData.floorHeight}m (H={massingData.buildingHeight}m)</div>
              <div>Program: <span className="font-semibold text-teal-300 capitalize">{massingData.buildingProgram}</span></div>
            </div>
          </div>

          {/* Card 2: Structural Bay Configuration */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-sky-400" />
              Structural Bay Framing
            </div>
            <div className="space-y-0.5 text-slate-200">
              <div>Bay Span: <span className="font-mono font-bold text-white">{bayConfig.spanL}m × {bayConfig.tributaryWidthBtr}m</span></div>
              <div>Framing: <span className="font-mono font-bold text-white">{bayConfig.numberOfStoreys} fl</span> @ {bayConfig.storeyHeightH}m (H={(bayConfig.numberOfStoreys * bayConfig.storeyHeightH).toFixed(1)}m)</div>
              <div>System: <span className="font-semibold text-sky-300">{bayConfig.materialSystem}</span> • {bayConfig.occupancyCategory}</div>
            </div>
          </div>

          {/* Card 3: Dynamic Structural BoQ */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-400" />
              Live Material Takeoff (BoQ)
            </div>
            <div className="space-y-0.5 text-slate-200">
              <div>Concrete: <span className="font-mono font-bold text-white">{liveBoQ.concreteVolumeM3} m³</span></div>
              <div>Rebar: <span className="font-mono font-bold text-white">{liveBoQ.rebarMassTonnes} t</span> • Steel: <span className="font-mono font-bold text-white">{liveBoQ.steelMassTonnes} t</span></div>
              <div>Timber: <span className="font-mono font-bold text-white">{liveBoQ.timberVolumeM3} m³</span></div>
            </div>
          </div>

          {/* Card 4: Upfront Embodied Carbon Feedback */}
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Leaf className="w-3 h-3 text-emerald-400" />
              Live GWP (Structure A1–A3)
            </div>
            <div className="space-y-0.5 text-slate-200">
              <div className="text-base font-extrabold text-white font-mono">
                {liveBoQ.gwpStructureA1A3} <span className="text-xs font-normal text-slate-400">kgCO₂e/m²</span>
              </div>
              <div className="text-[10.5px] text-slate-400">
                Total: <span className="font-mono font-bold text-emerald-300">{liveBoQ.totalStructureCo2Tonnes} tCO₂e</span> ({liveBoQ.gfa} m² GFA)
              </div>
              <div className="text-[10px] text-slate-500">
                Auto-linked to Stage 6 Whole-Life LCA
              </div>
            </div>
          </div>
        </div>

        {/* Sync Notification Banner */}
        {syncNotification && (
          <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-700/80 text-indigo-200 text-xs flex items-center justify-between shadow">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncNotification(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          LIVE KPI BANNER: GOVERNING MEMBER, DEPTH, WEIGHT & EMBODIED CARBON
         ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Structural System</div>
          <div className="font-extrabold text-white text-sm">{currentSystemSummary.displayName}</div>
          <div className="text-[10px] text-teal-400">Depth: {currentSystemSummary.structuralDepth} mm</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Governing Utilisation (ηmax)</div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-extrabold font-mono ${
              currentSystemSummary.eta_max <= 0.8 ? 'text-emerald-400' : currentSystemSummary.eta_max <= 1.0 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {currentSystemSummary.eta_max.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-400">({currentSystemSummary.governingMember})</span>
          </div>
          <div className="text-[10px] text-slate-400">Status: {currentSystemSummary.status}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Structural Frame Self-Weight</div>
          <div className="font-extrabold text-white text-sm font-mono">{currentSystemSummary.selfWeightWm2.toFixed(1)} kN/m²</div>
          <div className="text-[10px] text-slate-400">Total permanent Gk: {(currentSystemSummary.selfWeightWm2 + basis.gk_add).toFixed(1)} kN/m²</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Upfront Embodied Carbon (A1-A3)</div>
          <div className="font-extrabold text-white text-sm font-mono flex items-center gap-1">
            <span className={currentSystemSummary.embodiedCarbonA1A3 < 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {currentSystemSummary.embodiedCarbonA1A3}
            </span>
            <span className="text-[10px] font-normal text-slate-400">kgCO₂e/m²</span>
          </div>
          <div className="text-[10px] text-slate-400">Synced with Stage 6 LCA module</div>
        </div>
      </div>

      {/* =====================================================================
          STEP 1: PROJECT BASIS & LOAD CONFIGURATOR (EC BASIS & PROJECT INFO)
         ===================================================================== */}
      {activeStep === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                Step 1: Project Information & Eurocode Design Basis (193 Total Parameters)
              </h2>
              <p className="text-xs text-slate-400">
                All fields directly map to the 13 reference workbook sheets: 7 Project Info + 19 EC Basis + 167 Member parameters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 transition shadow"
            >
              Continue to Step 2: 3D Bay
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Project Info Tab (7 Parameters) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Project Information Sheet (7 Parameters)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Workbook Tab: &apos;Project Info&apos; (Cells C1, R2C1–R4C5)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block font-semibold">1. Project Name (C1):</label>
                <input
                  type="text"
                  value={metadata.projectTitle}
                  onChange={(e) => setMetadata({ ...metadata, projectTitle: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">2. Location (City/Country) (R2C1):</label>
                <input
                  type="text"
                  value={metadata.location}
                  onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">3. Architect (Studio) (R3C1):</label>
                <input
                  type="text"
                  value={metadata.architect}
                  onChange={(e) => setMetadata({ ...metadata, architect: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">4. Year Completion (R4C1):</label>
                <input
                  type="text"
                  value={metadata.year}
                  onChange={(e) => setMetadata({ ...metadata, year: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">5. Student Name (R2C5):</label>
                <input
                  type="text"
                  value={metadata.studentName}
                  onChange={(e) => setMetadata({ ...metadata, studentName: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">6. Student Last Name (R3C5):</label>
                <input
                  type="text"
                  value={metadata.studentLastName}
                  onChange={(e) => setMetadata({ ...metadata, studentLastName: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-medium"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">7. Matricula (R4C5):</label>
                <input
                  type="text"
                  value={metadata.studentMatricula}
                  onChange={(e) => setMetadata({ ...metadata, studentMatricula: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block font-semibold">Job Reference & Stage:</label>
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="text"
                    value={metadata.jobCode}
                    onChange={(e) => setMetadata({ ...metadata, jobCode: e.target.value })}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                    placeholder="Job Code"
                  />
                  <select
                    value={metadata.designStage}
                    onChange={(e) => setMetadata({ ...metadata, designStage: e.target.value as any })}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                  >
                    <option value="Concept">Concept</option>
                    <option value="Schematic">Schematic</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shared Design Basis (EC Basis - All 19 Parameters) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Eurocode Design Basis (19 Editable Parameters - EN 1990/1991/1992/1993/1995/1996)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Workbook Tab: &apos;EC Basis&apos; (Cells D6 to D25)</span>
            </div>

            {/* Row 1: Actions & Partial Factors (D6 - D11) */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                1. National Annex & Gravity Actions (Cells D6–D11)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-slate-400 block font-semibold">1. NA (Annex):</label>
                  <select
                    value={basis.nationalAnnex}
                    onChange={(e) => handleNationalAnnexChange(e.target.value as NationalAnnexId)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                  >
                    {Object.values(NATIONAL_ANNEX_PRESETS).map((na) => (
                      <option key={na.id} value={na.id}>{na.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">2. γG (Permanent) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaG}
                    onChange={(e) => setBasis({ ...basis, gammaG: parseFloat(e.target.value) || 1.35 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">3. γQ (Variable) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaQ}
                    onChange={(e) => setBasis({ ...basis, gammaQ: parseFloat(e.target.value) || 1.50 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">4. ψ2 (Quasi-perm) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.psi2}
                    onChange={(e) => setBasis({ ...basis, psi2: parseFloat(e.target.value) || 0.30 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">5. gk,add [kN/m²]:</label>
                  <input
                    type="number"
                    step="0.25"
                    value={basis.gk_add}
                    onChange={(e) => setBasis({ ...basis, gk_add: parseFloat(e.target.value) || 2.50 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">6. qk (Imposed) [kN/m²]:</label>
                  <input
                    type="number"
                    step="0.25"
                    value={basis.qk}
                    onChange={(e) => setBasis({ ...basis, qk: parseFloat(e.target.value) || 2.00 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Concrete, Steel & Timber Material Factors (D13 - D22) */}
            <div className="space-y-2 text-xs pt-1">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                2. Concrete & Steel Material Safety Factors & Moduli (Cells D13–D22)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <label className="text-slate-400 block font-semibold">7. γC (Concrete) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaC}
                    onChange={(e) => setBasis({ ...basis, gammaC: parseFloat(e.target.value) || 1.50 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">8. γS (Rebar) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaS}
                    onChange={(e) => setBasis({ ...basis, gammaS: parseFloat(e.target.value) || 1.15 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">9. αcc (EN 1992) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.alphaCC}
                    onChange={(e) => setBasis({ ...basis, alphaCC: parseFloat(e.target.value) || 1.00 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">10. γM0 (Steel) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaM0}
                    onChange={(e) => setBasis({ ...basis, gammaM0: parseFloat(e.target.value) || 1.00 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">11. γM1 (Buckling) [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaM1}
                    onChange={(e) => setBasis({ ...basis, gammaM1: parseFloat(e.target.value) || 1.00 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">12. γM,solid [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaM_solid}
                    onChange={(e) => setBasis({ ...basis, gammaM_solid: parseFloat(e.target.value) || 1.30 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">13. γM,glulam [-]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.gammaM_glulam}
                    onChange={(e) => setBasis({ ...basis, gammaM_glulam: parseFloat(e.target.value) || 1.25 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Densities, Elastic Moduli & Masonry Factors (D20 - D25) */}
            <div className="space-y-2 text-xs pt-1">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                3. Material Densities, Elastic Moduli & Masonry Factors (Cells D20–D25)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-slate-400 block font-semibold">14. weight (RC) [kN/m³]:</label>
                  <input
                    type="number"
                    step="1"
                    value={basis.weight_rc}
                    onChange={(e) => setBasis({ ...basis, weight_rc: parseFloat(e.target.value) || 25 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">15. E (Steel) [MPa]:</label>
                  <input
                    type="number"
                    step="5000"
                    value={basis.E_steel}
                    onChange={(e) => setBasis({ ...basis, E_steel: parseFloat(e.target.value) || 210000 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">16. Es (Rebar) [MPa]:</label>
                  <input
                    type="number"
                    step="5000"
                    value={basis.Es_rebar}
                    onChange={(e) => setBasis({ ...basis, Es_rebar: parseFloat(e.target.value) || 200000 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">17. γM,m (Masonry) [-]:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={basis.gammaM_m}
                    onChange={(e) => setBasis({ ...basis, gammaM_m: parseFloat(e.target.value) || 2.50 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">18. γM,v (Shear) [-]:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={basis.gammaM_v}
                    onChange={(e) => setBasis({ ...basis, gammaM_v: parseFloat(e.target.value) || 2.50 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold">19. tmin (Wall) [mm]:</label>
                  <input
                    type="number"
                    step="10"
                    value={basis.tmin_wall}
                    onChange={(e) => setBasis({ ...basis, tmin_wall: parseFloat(e.target.value) || 100 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Environmental Actions Bridge (EN 1991-1-3 / EN 1991-1-4 / EN 1991-1-5) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-teal-500/20 text-teal-400">
                  <Wind className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                    Environmental Actions Bridge (EN 1991-1-3 Snow, EN 1991-1-4 Wind, EN 1991-1-5 Thermal)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Syncs climatic boundary parameters directly from Stage 1 Weather Station (EPW) into structural design basis.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncClimate}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow transition cursor-pointer active:scale-95"
                  title="Compute characteristic snow load, peak wind pressure, and thermal range from connected weather station"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Environmental Loads from Weather Station
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {/* Climate Context & Terrain */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  1. Exposure & Terrain Category
                </span>
                <div>
                  <label className="text-slate-400 block text-[11px] font-semibold">Terrain (EN 1991-1-4 Table 4.1):</label>
                  <select
                    value={terrainCategory}
                    onChange={(e) => setTerrainCategory(e.target.value as any)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold text-xs"
                  >
                    <option value="0">0: Sea / coastal open water</option>
                    <option value="I">I: Lakes / flat open area</option>
                    <option value="II">II: Low vegetation / open farmland</option>
                    <option value="III">III: Suburban / industrial / forest</option>
                    <option value="IV">IV: Urban city centre (&gt;15m height)</option>
                  </select>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Source Station:</span>
                    <span className="font-semibold text-teal-300 truncate max-w-[120px]">
                      {climate?.name || basis.syncWeatherSource || 'Milano Linate'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latitude / Elevation:</span>
                    <span className="font-mono text-slate-300">
                      {climate?.lat?.toFixed(1) || '45.5'}°N • {climate?.elevation || 103}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Snow Load Card */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5" />
                    2. Ground Snow sk (EN 1991-1-3)
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    {(basis.sk_snow ?? 1.50).toFixed(2)} kN/m²
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Design Ground Snow sk [kN/m²]:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={basis.sk_snow ?? 1.50}
                    onChange={(e) => setBasis({ ...basis, sk_snow: parseFloat(e.target.value) || 1.50 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  {syncedClimateInfo?.snowFormula || 'EN 1991-1-3 (Zone I Mediterranean): sk = (0.642 + 0.0092 × A) × μi × Ce × Ct'}
                </p>
              </div>

              {/* Wind Action Card */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5" />
                    3. Peak Wind qp(z) (EN 1991-1-4)
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    {(basis.qp_wind ?? 0.85).toFixed(2)} kN/m²
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Peak Velocity Pressure qp [kN/m²]:</label>
                  <input
                    type="number"
                    step="0.05"
                    value={basis.qp_wind ?? 0.85}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0.85;
                      setBasis({ ...basis, qp_wind: val });
                      setCltWallInputs({ ...cltWallInputs, pk: val });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  {syncedClimateInfo?.windFormula || `EN 1991-1-4: ce(z) × 0.5 × ρ × vb² at reference height z ≈ 12m`}
                </p>
              </div>

              {/* Thermal Action Card */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    4. Thermal Range ΔT (EN 1991-1-5)
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    {basis.deltaT_thermal ?? 35} K
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Annual Design Range ΔT [K]:</label>
                  <input
                    type="number"
                    step="1"
                    value={basis.deltaT_thermal ?? 35}
                    onChange={(e) => setBasis({ ...basis, deltaT_thermal: parseInt(e.target.value) || 35 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold"
                  />
                </div>
                <p className="text-[10.5px] text-slate-400 leading-snug">
                  {syncedClimateInfo ? `Tmin = ${syncedClimateInfo.tempMin}°C, Tmax = ${syncedClimateInfo.tempMax}°C (ΔT = ${syncedClimateInfo.deltaT} K)` : 'EN 1991-1-5: Tmax - Tmin used for structural expansion joints and shrinkage checks.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Eurocode 8 (EN 1998-1 / Italian NTC 2018) Seismic Actions Engine */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-rose-500/20 text-rose-400">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                    Eurocode 8 / Italian NTC 2018 Seismic Actions Engine (EN 1998-1 §3 &amp; §4)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Calculates lateral base shear Fb, design response spectrum Sd(T), storey force cascade, and interstorey drift sensitivity θ ≤ 0.10.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Seismic Standard:</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                  EN 1998-1 Type 1 / NTC 2018
                </span>
              </div>
            </div>

            {/* Seismic Hazard & Ductility Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* PGA ag */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    1. Reference PGA (ag)
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    {seismicPga.toFixed(2)} g
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Peak Ground Acceleration ag [g]:</label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.35"
                    step="0.01"
                    value={seismicPga}
                    onChange={(e) => setSeismicPga(parseFloat(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0.05g (Low)</span>
                    <span>0.15g (Milan)</span>
                    <span>0.35g (High)</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Design ground acceleration: <span className="font-mono font-bold text-white">{seismicResults.ag_design_g}g</span> ({seismicResults.ag_design_ms2} m/s²) with γI = {seismicResults.gamma_I}.
                </p>
              </div>

              {/* Ground Type (A to E) */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    2. Ground Type (EN 1998-1)
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    Type {seismicGroundType} (S={seismicResults.S_soilFactor})
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Stratigraphic Soil Class:</label>
                  <select
                    value={seismicGroundType}
                    onChange={(e) => setSeismicGroundType(e.target.value as SeismicGroundType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold text-xs"
                  >
                    <option value="A">Ground A: Rock / Stiff (vs,30 &gt; 800 m/s, S=1.0)</option>
                    <option value="B">Ground B: Very dense sand/gravel (vs,30 360–800, S=1.20)</option>
                    <option value="C">Ground C: Deep dense sand/gravel (vs,30 180–360, S=1.15)</option>
                    <option value="D">Ground D: Loose cohesionless soil (vs,30 &lt; 180, S=1.35)</option>
                    <option value="E">Ground E: Alluvial surface 5–20m (S=1.40)</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Periods: TB={seismicResults.TB_s}s, TC={seismicResults.TC_s}s, TD={seismicResults.TD_s}s.
                </p>
              </div>

              {/* Building Importance Class */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    3. Importance Class
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    Class {seismicImportanceClass} (γI={seismicResults.gamma_I})
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block text-[11px] font-semibold">Consequence / Building Use:</label>
                  <select
                    value={seismicImportanceClass}
                    onChange={(e) => setSeismicImportanceClass(e.target.value as BuildingImportanceClass)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold text-xs"
                  >
                    <option value="I">Class I: Agricultural / Low Occupancy (γI=0.8)</option>
                    <option value="II">Class II: Standard Residential &amp; Office (γI=1.0)</option>
                    <option value="III">Class III: Schools &amp; Assembly Halls (γI=1.2)</option>
                    <option value="IV">Class IV: Hospitals &amp; Emergency Hubs (γI=1.4)</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  EN 1998-1 §4.2.5: Multiplier on reference ground acceleration ag.
                </p>
              </div>

              {/* Ductility Class & q */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    4. Ductility Class &amp; q
                  </span>
                  <span className="font-mono font-extrabold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                    {seismicDuctilityClass} (q={seismicResults.q_behaviorFactor.toFixed(1)})
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="text-slate-400 font-semibold">Energy Dissipation Capacity:</label>
                    <span className="font-mono text-rose-300 text-[10px]">q = {seismicResults.q_behaviorFactor.toFixed(1)}</span>
                  </div>
                  <select
                    value={seismicDuctilityClass}
                    onChange={(e) => {
                      const dc = e.target.value as DuctilityClass;
                      setSeismicDuctilityClass(dc);
                      setSeismicQOverride(dc === 'DCL' ? 1.5 : dc === 'DCH' ? 4.5 : 3.6);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold text-xs"
                  >
                    <option value="DCL">DCL: Ductility Class Low (q = 1.5, Elastic Sizing)</option>
                    <option value="DCM">DCM: Ductility Class Medium (q = 3.0–3.9, Standard)</option>
                    <option value="DCH">DCH: Ductility Class High (q ≥ 4.5, Capacity Design)</option>
                  </select>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Fundamental Period: <span className="font-mono font-bold text-rose-300">T1 = {seismicResults.T1_fundamentalPeriod_s} s</span> (Ct={seismicResults.Ct_periodFactor}).
                </p>
              </div>
            </div>

            {/* Response Spectrum Graph & Base Shear Results */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* SVG Design Response Spectrum Chart */}
              <div className="lg:col-span-7 bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    EN 1998-1 Elastic Se(T) vs Design Spectrum Sd(T)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    T1 = {seismicResults.T1_fundamentalPeriod_s}s • Sd = {seismicResults.Sd_T1_g}g ({seismicResults.Sd_T1_ms2} m/s²)
                  </span>
                </div>

                <div className="relative w-full h-[150px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-2">
                  <svg viewBox="0 0 380 140" className="w-full h-full">
                    {/* Grid lines */}
                    <line x1="35" y1="120" x2="365" y2="120" stroke="#334155" strokeWidth="1" />
                    <line x1="35" y1="20" x2="35" y2="120" stroke="#334155" strokeWidth="1" />
                    <line x1="35" y1="70" x2="365" y2="70" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="35" y1="20" x2="365" y2="20" stroke="#1e293b" strokeDasharray="3 3" />

                    {/* Corner periods markers */}
                    {(() => {
                      const maxT = 3.5;
                      const maxSd = Math.max(
                        0.01,
                        ...seismicResults.spectrumCurve.map((p) => p.S_elastic)
                      );
                      const xTB = 35 + (seismicResults.TB_s / maxT) * 330;
                      const xTC = 35 + (seismicResults.TC_s / maxT) * 330;
                      const xTD = 35 + (seismicResults.TD_s / maxT) * 330;

                      // Curves
                      const ptsElastic = seismicResults.spectrumCurve
                        .map((p) => {
                          const x = 35 + (p.T / maxT) * 330;
                          const y = 120 - (p.S_elastic / maxSd) * 98;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');

                      const ptsDesign = seismicResults.spectrumCurve
                        .map((p) => {
                          const x = 35 + (p.T / maxT) * 330;
                          const y = 120 - (p.Sd / maxSd) * 98;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');

                      const xT1 = 35 + (Math.min(maxT, seismicResults.T1_fundamentalPeriod_s) / maxT) * 330;
                      const yT1 = 120 - (seismicResults.Sd_T1_ms2 / maxSd) * 98;

                      return (
                        <>
                          {/* Corner periods vertical lines */}
                          <line x1={xTB} y1="20" x2={xTB} y2="120" stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                          <text x={xTB} y="132" fontSize="8" fill="#64748b" textAnchor="middle">TB</text>

                          <line x1={xTC} y1="20" x2={xTC} y2="120" stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                          <text x={xTC} y="132" fontSize="8" fill="#64748b" textAnchor="middle">TC</text>

                          <line x1={xTD} y1="20" x2={xTD} y2="120" stroke="#64748b" strokeDasharray="2 2" strokeWidth="0.8" />
                          <text x={xTD} y="132" fontSize="8" fill="#64748b" textAnchor="middle">TD</text>

                          {/* Elastic spectrum (dashed) */}
                          <polyline fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" points={ptsElastic} />

                          {/* Design spectrum (rose) */}
                          <polyline fill="none" stroke="#f43f5e" strokeWidth="2.2" points={ptsDesign} />

                          {/* Operating Fundamental Period T1 Marker */}
                          <line x1={xT1} y1={yT1} x2={xT1} y2="120" stroke="#f43f5e" strokeDasharray="2 2" strokeWidth="1" />
                          <circle cx={xT1} cy={yT1} r="5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                          <text x={xT1 + 6} y={Math.max(25, yT1 - 5)} fontSize="9" fontWeight="bold" fill="#f43f5e">
                            T1={seismicResults.T1_fundamentalPeriod_s}s ({seismicResults.Sd_T1_g}g)
                          </text>

                          {/* Y-axis labels */}
                          <text x="30" y="24" fontSize="8" fill="#94a3b8" textAnchor="end">
                            {(maxSd / 9.80665).toFixed(2)}g
                          </text>
                          <text x="30" y="73" fontSize="8" fill="#94a3b8" textAnchor="end">
                            {(maxSd / (2 * 9.80665)).toFixed(2)}g
                          </text>
                          <text x="30" y="122" fontSize="8" fill="#94a3b8" textAnchor="end">
                            0g
                          </text>
                          <text x="365" y="132" fontSize="8" fill="#94a3b8" textAnchor="end">
                            T (s)
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-rose-500 inline-block" /> Design Spectrum Sd(T) [q={seismicResults.q_behaviorFactor.toFixed(1)}]
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" /> Elastic Spectrum Se(T) [q=1.0]
                  </span>
                </div>
              </div>

              {/* Seismic Base Shear & Drift Summary Cards */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lateral Base Shear (Fb)</div>
                  <div className="text-base font-extrabold text-white font-mono mt-0.5">
                    {seismicResults.Fb_baseShearKn.toLocaleString()} <span className="text-xs font-normal text-slate-400">kN</span>
                  </div>
                  <div className="text-[10.5px] text-rose-300 font-semibold">
                    {seismicResults.baseShearRatioPct}% of Seismic Weight
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seismic Gravity (Wseis)</div>
                  <div className="text-base font-extrabold text-white font-mono mt-0.5">
                    {seismicResults.totalSeismicWeightKn.toLocaleString()} <span className="text-xs font-normal text-slate-400">kN</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400">
                    λ = {seismicResults.lambda_correction} • ψ2 = {basis.psi2}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spectral Accel. Sd(T1)</div>
                  <div className="text-base font-extrabold text-rose-400 font-mono mt-0.5">
                    {seismicResults.Sd_T1_g} g
                  </div>
                  <div className="text-[10.5px] text-slate-400">
                    {seismicResults.Sd_T1_ms2} m/s² @ T1={seismicResults.T1_fundamentalPeriod_s}s
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">P-Δ Drift Sensitivity</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-base font-extrabold font-mono ${
                      seismicResults.pDeltaStatus === 'PASS' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      θ = {seismicResults.governingTheta}
                    </span>
                  </div>
                  <div className="text-[10.5px]">
                    <span className={`font-bold ${
                      seismicResults.pDeltaStatus === 'PASS' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {seismicResults.pDeltaStatus === 'PASS' ? 'θ ≤ 0.10 (PASS)' : 'θ > 0.10 (WARNING)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storey Force Distribution & Cumulative Shear Cascade */}
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  Storey Lateral Force Distribution Fi &amp; Cumulative Shear Vi (EN 1998-1 §4.3.3.2.3)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  seismicResults.pDeltaStatus === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {seismicResults.pDeltaStatus === 'PASS' ? 'θ ≤ 0.10: 2nd Order Effects Negligible' : 'θ > 0.10: Amplification Required'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800 font-bold">
                    <tr>
                      <th className="py-1">Storey Level</th>
                      <th className="py-1">Height (z)</th>
                      <th className="py-1">Storey Weight W</th>
                      <th className="py-1">Lateral Force Fi</th>
                      <th className="py-1">Storey Shear Vi</th>
                      <th className="py-1">Drift Sens. θ</th>
                      <th className="py-1">EC8 Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {seismicResults.storeys.slice().reverse().map((st) => (
                      <tr key={st.storeyIndex} className="hover:bg-slate-800/40">
                        <td className="py-1 text-slate-300 font-sans font-semibold">Storey {st.storeyIndex}</td>
                        <td className="py-1 text-slate-400">{st.heightZ} m</td>
                        <td className="py-1 text-slate-300">{st.storeyWeightKn} kN</td>
                        <td className="py-1 text-rose-300 font-bold">{st.Fi_lateralForceKn} kN</td>
                        <td className="py-1 text-sky-300 font-bold">{st.Vi_storeyShearKn} kN</td>
                        <td className="py-1 text-slate-200">{st.theta_driftSensitivity}</td>
                        <td className="py-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            st.pDeltaCheck === 'PASS' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          }`}>
                            {st.pDeltaCheck}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: INTERACTIVE 3D STRUCTURAL BAY & LOAD PATH MANIPULATOR
         ===================================================================== */}
      {activeStep === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: 3D View (Enlarged viewport with more space on the left) */}
            <div className="xl:col-span-8 space-y-3">
              <StructuralBay3DViewer
                config={bayConfig}
                memberUtilisations={allMemberResults}
                activeMember={activeMember}
                onSelectMember={(m) => {
                  setActiveMember(m);
                }}
                onNavigateToStep3={(m) => {
                  if (m !== 'none') {
                    setActiveMember(m);
                    setActiveStep(3);
                  }
                }}
                className="h-[560px] md:h-[620px] xl:h-[680px]"
              />

              {/* Tributary Cascade Summary Cards below the 3D viewport */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">1. Floor Slab Action</span>
                  <div className="font-mono text-slate-200">
                    Gk: <span className="font-bold text-white">{takedown.slab_Gk.toFixed(1)} kN/m</span> • Qk:{' '}
                    <span className="font-bold text-white">{takedown.slab_Qk.toFixed(1)} kN/m</span>
                  </div>
                  <div className="text-[11px] text-teal-400 font-mono">
                    MEd = {takedown.slab_MEd.toFixed(1)} kNm • VEd = {takedown.slab_VEd.toFixed(1)} kN
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">2. Primary Beam Load</span>
                  <div className="font-mono text-slate-200">
                    Gk: <span className="font-bold text-white">{takedown.beam_Gk.toFixed(1)} kN/m</span> • Qk:{' '}
                    <span className="font-bold text-white">{takedown.beam_Qk.toFixed(1)} kN/m</span>
                  </div>
                  <div className="text-[11px] text-teal-400 font-mono">
                    MEd = {takedown.beam_MEd.toFixed(1)} kNm • VEd = {takedown.beam_VEd.toFixed(1)} kN
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[10px] block">3. Column Base Takedown ({bayConfig.numberOfStoreys} Floors)</span>
                  <div className="font-mono text-slate-200">
                    NG,k: <span className="font-bold text-white">{takedown.column_NG_k.toFixed(0)} kN</span> • NQ,k:{' '}
                    <span className="font-bold text-white">{takedown.column_NQ_k.toFixed(0)} kN</span>
                  </div>
                  <div className="text-[11px] font-mono font-extrabold text-sky-400">
                    Factored NEd = {takedown.column_NEd.toFixed(0)} kN
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Controls (Dimensional Sliders, Framing Material, Auto Takedown, Quick Member Details) */}
            <div className="xl:col-span-4 space-y-4">
              {/* Framing Material System */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                  <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Material Scheme</span>
                  <label className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] cursor-pointer hover:bg-slate-750 transition">
                    <input
                      type="checkbox"
                      checked={bayConfig.autoLoadTakedown}
                      onChange={(e) => setBayConfig({ ...bayConfig, autoLoadTakedown: e.target.checked })}
                      className="rounded border-slate-600 text-teal-500 focus:ring-teal-400"
                    />
                    <span className="font-semibold text-slate-300">Auto Takedown</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(['RC', 'Steel', 'Timber', 'Masonry'] as const).map((mat) => (
                    <button
                      key={mat}
                      type="button"
                      onClick={() => {
                        setBayConfig({ ...bayConfig, materialSystem: mat });
                        setActiveMember((prev) => {
                          if (prev === 'none') return 'none';
                          if (mat === 'RC') return 'rc_slab';
                          if (mat === 'Steel') return 'steel_beam';
                          if (mat === 'Timber') return 'clt_slab';
                          return 'masonry_wall';
                        });
                      }}
                      className={`px-3 py-2 rounded-xl font-bold transition text-left flex flex-col ${
                        bayConfig.materialSystem === mat
                          ? 'bg-sky-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                      }`}
                    >
                      <span className="text-xs">{mat === 'RC' ? 'Reinforced Concrete' : mat === 'Steel' ? 'Structural Steel' : mat === 'Timber' ? 'Mass Timber / CLT' : 'Masonry'}</span>
                      <span className="text-[10px] opacity-75 font-mono">{mat === 'RC' ? 'EN 1992' : mat === 'Steel' ? 'EN 1993' : mat === 'Timber' ? 'EN 1995' : 'EN 1996'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensional Sliders for the 3D Bay */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5 text-xs">
                <span className="font-bold text-slate-200 text-xs uppercase tracking-wider block border-b border-slate-800 pb-2">
                  Bay Dimensions: {bayConfig.spanL}m × {bayConfig.tributaryWidthBtr}m
                </span>

                <div>
                  <div className="flex justify-between items-center font-semibold text-slate-300 mb-1">
                    <span>Bay Span (L):</span>
                    <span className="font-mono text-sky-400 font-bold tabular-nums inline-block text-right w-16">{bayConfig.spanL.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="3.0"
                    max="12.0"
                    step="0.5"
                    value={bayConfig.spanL}
                    onChange={(e) => setBayConfig({ ...bayConfig, spanL: parseFloat(e.target.value) })}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center font-semibold text-slate-300 mb-1">
                    <span>Tributary Width (Btr):</span>
                    <span className="font-mono text-sky-400 font-bold tabular-nums inline-block text-right w-16">{bayConfig.tributaryWidthBtr.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="8.0"
                    step="0.5"
                    value={bayConfig.tributaryWidthBtr}
                    onChange={(e) => setBayConfig({ ...bayConfig, tributaryWidthBtr: parseFloat(e.target.value) })}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center font-semibold text-slate-300 mb-1">
                    <span>Storey Height (H):</span>
                    <span className="font-mono text-sky-400 font-bold tabular-nums inline-block text-right w-16">{bayConfig.storeyHeightH.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="2.5"
                    max="5.0"
                    step="0.25"
                    value={bayConfig.storeyHeightH}
                    onChange={(e) => setBayConfig({ ...bayConfig, storeyHeightH: parseFloat(e.target.value) })}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center font-semibold text-slate-300 mb-1">
                    <span>Supported Storeys (N):</span>
                    <span className="font-mono text-sky-400 font-bold tabular-nums inline-block text-right w-20">{bayConfig.numberOfStoreys} Floors</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={bayConfig.numberOfStoreys}
                    onChange={(e) => setBayConfig({ ...bayConfig, numberOfStoreys: parseInt(e.target.value) })}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Selected Member Quick Inspector & Action */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">Active Member</span>
                  <span className="text-[10px] font-mono font-bold text-teal-400">
                    {activeMember === 'none' ? 'Overview' : activeMember.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white">
                    {MEMBER_SCOPE_NOTES[activeMember]?.standard || 'EN 1990 Basis of Design'}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {MEMBER_SCOPE_NOTES[activeMember]?.scope || 'Multi-storey 3D structural bay framing and tributary load path.'}
                  </p>
                </div>
                {activeMember !== 'none' && (
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-sky-600 hover:from-teal-400 hover:to-sky-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Design & Check in Step 3</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: 3D CROSS-SECTION MANIPULATOR & LIVE EUROCODE SOLVER
         ===================================================================== */}
      {activeStep === 3 && (
        <div className="space-y-4">
          {/* Member Sub-Navigation Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-lg flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px] px-2">Member Sheet:</span>
            {[
              { id: 'rc_slab', label: 'RC Slab' },
              { id: 'rc_beam', label: 'RC Beam' },
              { id: 'rc_wall', label: 'RC Wall' },
              { id: 'rc_column', label: 'RC Column' },
              { id: 'steel_beam', label: 'Steel Beam' },
              { id: 'steel_column', label: 'Steel Column' },
              { id: 'clt_slab', label: 'CLT Slab' },
              { id: 'clt_wall', label: 'CLT Wall' },
              { id: 'wood_beam', label: 'Wood Beam' },
              { id: 'wood_column', label: 'Wood Column' },
              { id: 'masonry_wall', label: 'Masonry Wall' }
            ].map((m) => {
              const res = allMemberResults[m.id];
              const isAct = activeMember === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMember(m.id as SelectedMemberType)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 transition ${
                    isAct
                      ? 'bg-sky-600 text-white shadow'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{m.label}</span>
                  {res && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      res.eta_max <= 0.8 ? 'bg-emerald-950 text-emerald-300' : res.eta_max <= 1.0 ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'
                    }`}>
                      {res.eta_max.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Member Scope, Domain Limits & Excluded Checks Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-sky-500/20 text-sky-400">
                  <Info className="w-3.5 h-3.5" />
                </span>
                <span className="font-extrabold text-xs text-white">
                  {activeDetails.name} • Eurocode Sizing Scope & Validity
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                  {MEMBER_SCOPE_NOTES[activeMember]?.standard}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Full Eurocode Guide (7 Rules) ↗
                </button>
                <button
                  type="button"
                  onClick={() => setShowScopeBanner(!showScopeBanner)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800 transition"
                >
                  {showScopeBanner ? 'Hide Scope' : 'Show Scope'}
                </button>
              </div>
            </div>

            {showScopeBanner && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider block">1. Sizing Scope</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {MEMBER_SCOPE_NOTES[activeMember]?.scope}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-sky-400 uppercase text-[10px] tracking-wider block">2. Validity Domain</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {MEMBER_SCOPE_NOTES[activeMember]?.domain}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider block">3. Excluded Checks</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {MEMBER_SCOPE_NOTES[activeMember]?.excluded}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Split Section View: Left 3D/2D Cutaway Visualizer, Right Parameter Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <CrossSection3DViewer
                memberType={activeMember}
                params={activeDetails.params}
                result={activeDetails.result}
              />
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                <div className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  {activeDetails.name} Parameters
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoOptimize}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
                    title="Intelligent Eurocode Auto-Optimizer: selects optimal section size targeting η between 0.70 and 0.95 with lowest embodied carbon"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Optimize Section
                  </button>
                  <button
                    type="button"
                    onClick={() => setBayConfig({ ...bayConfig, autoLoadTakedown: !bayConfig.autoLoadTakedown })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
                      bayConfig.autoLoadTakedown
                        ? 'bg-sky-950 text-sky-300 border-sky-800 hover:bg-sky-900'
                        : 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900'
                    }`}
                    title="Toggle between automatic 3D structural bay tributary cascade and manual forces"
                  >
                    {bayConfig.autoLoadTakedown ? '⚡ 3D Tributary Loads: ON' : '✏️ Manual Forces: ON'}
                  </button>
                  {activeMember.startsWith('clt') && (
                    <button
                      type="button"
                      onClick={() => setShowEtaModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-800 text-[10px] font-bold hover:bg-teal-900 transition"
                    >
                      ETA Product Manager ↗
                    </button>
                  )}
                </div>
              </div>

              {/* Auto-Optimization Alert Toast */}
              {optToast && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md ${
                  optToast.success
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
                    : 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="font-extrabold flex items-center gap-1.5">
                        <span>{optToast.message}</span>
                        {optToast.success && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                            η: {optToast.previousEta.toFixed(2)} ➔ {optToast.newEta.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {optToast.previousDesc} ➔ {optToast.newDesc}
                        {optToast.carbonReductionPct > 0 && ` • Carbon reduction: ~${optToast.carbonReductionPct}%`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOptToast(null)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Dynamic Inputs depending on member type */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs max-h-[520px] overflow-y-auto pr-1">
                {/* =========================================================
                    1. RC SLAB INPUTS (12 Parameters)
                   ========================================================= */}
                {activeMember === 'rc_slab' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Geometry & Materials
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Concrete Class:</label>
                      <select
                        value={rcSlabInputs.concreteClass}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, concreteClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(CONCRETE_CLASSES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Span L (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.spanL.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={rcSlabInputs.L}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, L: parseFloat(e.target.value) || 4.5 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Tributary Width Btr (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.tributaryWidthBtr.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={rcSlabInputs.Btr}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, Btr: parseFloat(e.target.value) || 1.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Slab Depth h (mm):</label>
                      <input
                        type="number"
                        step="10"
                        value={rcSlabInputs.h}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, h: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Design Strip b (mm):</label>
                      <input
                        type="number"
                        value={rcSlabInputs.b}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, b: parseInt(e.target.value) || 1000 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Cover cnom (mm):</label>
                      <input
                        type="number"
                        step="5"
                        value={rcSlabInputs.cnom}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, cnom: parseInt(e.target.value) || 30 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Rebar Yield fyk (MPa):</label>
                      <input
                        type="number"
                        value={rcSlabInputs.fyk}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, fyk: parseInt(e.target.value) || 500 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Reinforcement Layout
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Main Bar φ (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcSlabInputs.phi}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, phi: parseInt(e.target.value) || 12 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Main Spacing s (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={rcSlabInputs.s}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, s: parseInt(e.target.value) || 150 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Link φlink (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcSlabInputs.phi_link}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, phi_link: parseInt(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Transverse Bar φt (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcSlabInputs.phi_t}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, phi_t: parseInt(e.target.value) || 8 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Transverse Spacing st (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={rcSlabInputs.s_t}
                        onChange={(e) => setRcSlabInputs({ ...rcSlabInputs, s_t: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    2. RC BEAM INPUTS (13 Parameters)
                   ========================================================= */}
                {activeMember === 'rc_beam' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Beam Geometry & Materials
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Concrete Class:</label>
                      <select
                        value={rcBeamInputs.concreteClass}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, concreteClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(CONCRETE_CLASSES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Span L (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.spanL.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={rcBeamInputs.L}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, L: parseFloat(e.target.value) || 6.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Tributary Width Btr (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.tributaryWidthBtr.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={rcBeamInputs.Btr}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, Btr: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Web Width b (mm):</label>
                      <input
                        type="number"
                        step="50"
                        value={rcBeamInputs.b}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, b: parseInt(e.target.value) || 300 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Beam Depth h (mm):</label>
                      <input
                        type="number"
                        step="50"
                        value={rcBeamInputs.h}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, h: parseInt(e.target.value) || 550 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Cover cnom (mm):</label>
                      <input
                        type="number"
                        step="5"
                        value={rcBeamInputs.cnom}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, cnom: parseInt(e.target.value) || 30 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Rebar Yield fyk (MPa):</label>
                      <input
                        type="number"
                        value={rcBeamInputs.fyk}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, fyk: parseInt(e.target.value) || 500 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Flexural & Shear Reinforcement
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Tension Bars (n):</label>
                      <input
                        type="number"
                        min="2"
                        max="8"
                        value={rcBeamInputs.n}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, n: parseInt(e.target.value) || 4 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bar Diameter φ (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcBeamInputs.phi}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, phi: parseInt(e.target.value) || 20 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Link Diameter φlink (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcBeamInputs.phi_link}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, phi_link: parseInt(e.target.value) || 8 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Link Legs nleg:</label>
                      <input
                        type="number"
                        min="2"
                        max="4"
                        value={rcBeamInputs.nleg}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, nleg: parseInt(e.target.value) || 2 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Link Spacing sw (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={rcBeamInputs.sw}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, sw: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Strut Angle cot(θ):</label>
                      <input
                        type="number"
                        min="1.0"
                        max="2.5"
                        step="0.1"
                        value={rcBeamInputs.cot_theta}
                        onChange={(e) => setRcBeamInputs({ ...rcBeamInputs, cot_theta: parseFloat(e.target.value) || 2.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    3. RC WALL STRIP INPUTS (16 Parameters)
                   ========================================================= */}
                {activeMember === 'rc_wall' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Wall Geometry & Strip Dimensions
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Clear Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={rcWallInputs.H}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Effective Height l0 (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={rcWallInputs.l0}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, l0: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Wall Strip b (mm):</label>
                      <input
                        type="number"
                        value={rcWallInputs.b}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, b: parseInt(e.target.value) || 1000 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Thickness h (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={rcWallInputs.h}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, h: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bar Axis Distance a (mm):</label>
                      <input
                        type="number"
                        step="5"
                        value={rcWallInputs.a}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, a: parseInt(e.target.value) || 40 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Concrete Class:</label>
                      <select
                        value={rcWallInputs.concreteClass}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, concreteClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(CONCRETE_CLASSES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Top Axial Loads & 1st Order Moment
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent Axial NG,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="20"
                        value={rcWallInputs.NG_k}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable Axial NQ,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={rcWallInputs.NQ_k}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">1st Order Moment M0,Ed (kNm):</label>
                      <input
                        type="number"
                        step="1"
                        value={rcWallInputs.M0_Ed}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, M0_Ed: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Wall Mesh Reinforcement
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Vertical Bar φ (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcWallInputs.phi}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, phi: parseInt(e.target.value) || 12 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Vertical Spacing s (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={rcWallInputs.s}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, s: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Horizontal Bar φh (mm):</label>
                      <input
                        type="number"
                        step="2"
                        value={rcWallInputs.phi_h}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, phi_h: parseInt(e.target.value) || 8 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Horizontal Spacing sh (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={rcWallInputs.s_h}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, s_h: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      4. Second-Order Curvature & Rebar Grade
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Effective Creep φef:</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="4.0"
                        value={rcWallInputs.phi_ef}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, phi_ef: parseFloat(e.target.value) || 2.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Curvature Factor c (8-10):</label>
                      <input
                        type="number"
                        step="1"
                        min="8"
                        max="10"
                        value={rcWallInputs.c}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, c: parseFloat(e.target.value) || 8.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Rebar Yield fyk (MPa):</label>
                      <input
                        type="number"
                        value={rcWallInputs.fyk}
                        onChange={(e) => setRcWallInputs({ ...rcWallInputs, fyk: parseInt(e.target.value) || 500 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    4. RC COLUMN IN UNIAXIAL BENDING INPUTS (14 Parameters)
                   ========================================================= */}
                {activeMember === 'rc_column' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Column Geometry & Boundary
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Clear Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="10.0"
                        value={rcColInputs.H}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling Length l0 (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="10.0"
                        value={rcColInputs.l0}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, l0: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Breadth b (mm):</label>
                      <input
                        type="number"
                        step="25"
                        min="150"
                        max="1200"
                        value={rcColInputs.b}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, b: parseInt(e.target.value) || 400 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Depth in Bending h (mm):</label>
                      <input
                        type="number"
                        step="25"
                        min="150"
                        max="1200"
                        value={rcColInputs.h}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, h: parseInt(e.target.value) || 400 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Column Loading & Design Moment
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent Axial NG,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="25"
                        value={rcColInputs.NG_k}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable Axial NQ,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="25"
                        value={rcColInputs.NQ_k}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">1st-Order Moment M0,Ed (kNm):</label>
                      <input
                        type="number"
                        step="5"
                        value={rcColInputs.M0_Ed}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, M0_Ed: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Symmetric Reinforcement & Materials
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Concrete Class:</label>
                      <select
                        value={rcColInputs.concreteClass}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, concreteClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(CONCRETE_CLASSES).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bar Diameter φ (mm):</label>
                      <input
                        type="number"
                        step="2"
                        min="12"
                        max="32"
                        value={rcColInputs.phi}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, phi: parseInt(e.target.value) || 20 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bars per Face n,bars:</label>
                      <input
                        type="number"
                        min="2"
                        max="10"
                        value={rcColInputs.n_bars}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, n_bars: parseInt(e.target.value) || 3 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bar Centre from Face a (mm):</label>
                      <input
                        type="number"
                        step="5"
                        min="25"
                        max="80"
                        value={rcColInputs.a}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, a: parseInt(e.target.value) || 50 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Rebar Yield fyk (MPa):</label>
                      <input
                        type="number"
                        value={rcColInputs.fyk}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, fyk: parseInt(e.target.value) || 500 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      4. Second-Order Curvature Parameters
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Effective Creep φef:</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="4.0"
                        value={rcColInputs.phi_ef}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, phi_ef: parseFloat(e.target.value) || 2.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Curvature Factor c (8-10):</label>
                      <input
                        type="number"
                        step="1"
                        min="8"
                        max="10"
                        value={rcColInputs.c}
                        onChange={(e) => setRcColInputs({ ...rcColInputs, c: parseFloat(e.target.value) || 8.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    5. STEEL BEAM INPUTS (7 Parameters)
                   ========================================================= */}
                {activeMember === 'steel_beam' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Steel Section Profile & Grade (52 Profiles)
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-400 block font-semibold">Steel Section Profile:</label>
                      <select
                        value={steelBeamInputs.profileName}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, profileName: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-xs font-semibold"
                      >
                        {Object.keys(STEEL_PROFILES).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Steel Grade:</label>
                      <select
                        value={steelBeamInputs.grade}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, grade: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="S235">S235 (235 MPa)</option>
                        <option value="S275">S275 (275 MPa)</option>
                        <option value="S355">S355 (355 MPa)</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Geometry & SLS Deflection Limits
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Span L (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.spanL.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={steelBeamInputs.L}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, L: parseFloat(e.target.value) || 6.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Tributary Width Btr (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.tributaryWidthBtr.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={steelBeamInputs.Btr}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, Btr: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Lateral Restraint:</label>
                      <select
                        value={steelBeamInputs.restraint}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, restraint: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="Assumed">Assumed (Continuous)</option>
                        <option value="None">None (Unrestrained)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Imposed Deflection Limit:</label>
                      <select
                        value={steelBeamInputs.div_Q}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, div_Q: parseInt(e.target.value) || 300 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={200}>L / 200</option>
                        <option value={250}>L / 250</option>
                        <option value={300}>L / 300 (Standard)</option>
                        <option value={350}>L / 350</option>
                        <option value={500}>L / 500</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Total Deflection Limit:</label>
                      <select
                        value={steelBeamInputs.div_total}
                        onChange={(e) => setSteelBeamInputs({ ...steelBeamInputs, div_total: parseInt(e.target.value) || 250 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={200}>L / 200</option>
                        <option value={250}>L / 250 (Standard)</option>
                        <option value={300}>L / 300</option>
                      </select>
                    </div>
                  </>
                )}

                {/* =========================================================
                    6. STEEL COLUMN INPUTS (10 Parameters)
                   ========================================================= */}
                {activeMember === 'steel_column' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Steel Section Profile & Grade (52 Profiles)
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-400 block font-semibold">Steel Section Profile:</label>
                      <select
                        value={steelColInputs.profileName}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, profileName: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-xs font-semibold"
                      >
                        {Object.keys(STEEL_PROFILES).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Steel Grade:</label>
                      <select
                        value={steelColInputs.grade}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, grade: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="S235">S235 (235 MPa)</option>
                        <option value="S275">S275 (275 MPa)</option>
                        <option value="S355">S355 (355 MPa)</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Geometry & Buckling Lengths
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Column Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={steelColInputs.H}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling lcr,y (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={steelColInputs.lcr_y}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, lcr_y: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling lcr,z (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={steelColInputs.lcr_z}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, lcr_z: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Torsional lcr,T (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={steelColInputs.lcr_T}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, lcr_T: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Axial Loading & Design Bending Moments
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent Axial NG,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="25"
                        value={steelColInputs.NG_k}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable Axial NQ,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        step="25"
                        value={steelColInputs.NQ_k}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment My,Ed (kNm):</label>
                      <input
                        type="number"
                        step="5"
                        value={steelColInputs.My_Ed}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, My_Ed: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment Mz,Ed (kNm):</label>
                      <input
                        type="number"
                        step="5"
                        value={steelColInputs.Mz_Ed}
                        onChange={(e) => setSteelColInputs({ ...steelColInputs, Mz_Ed: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    7. CLT SLAB INPUTS (17 Parameters)
                   ========================================================= */}
                {activeMember === 'clt_slab' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. CLT Slab Geometry & Product Status
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Span L (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.spanL.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={cltSlabInputs.L}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, L: parseFloat(e.target.value) || 5.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Tributary Width Btr (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={cltSlabInputs.Btr}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, Btr: parseFloat(e.target.value) || 1.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Panel Thickness t (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={cltSlabInputs.t}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, t: parseInt(e.target.value) || 160 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Timber Unit Weight (kN/m³):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={cltSlabInputs.weight}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, weight: parseFloat(e.target.value) || 5.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Layup / Identification:</label>
                      <input
                        type="text"
                        value={cltSlabInputs.productName}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, productName: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Data Verification:</label>
                      <button
                        type="button"
                        onClick={() => setCltSlabInputs({ ...cltSlabInputs, isDocumented: !cltSlabInputs.isDocumented })}
                        className={`w-full mt-1 p-1.5 rounded font-bold text-xs transition ${
                          cltSlabInputs.isDocumented ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {cltSlabInputs.isDocumented ? '✓ Verified ETA' : '⚠ Example Data'}
                      </button>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Rigidity & Strength Capacities (per 1m strip)
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bending Rigidity EI (Nmm²/m):</label>
                      <input
                        type="number"
                        value={cltSlabInputs.EI_mean}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, EI_mean: parseFloat(e.target.value) || 3.0e12 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Shear Rigidity GA (N/m):</label>
                      <input
                        type="number"
                        value={cltSlabInputs.GA_eff}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, GA_eff: parseFloat(e.target.value) || 8.0e6 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bending MR,k (kNm/m):</label>
                      <input
                        type="number"
                        value={cltSlabInputs.MR_k}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, MR_k: parseFloat(e.target.value) || 60 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Transverse Shear VR,k (kN/m):</label>
                      <input
                        type="number"
                        value={cltSlabInputs.VR_k}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, VR_k: parseFloat(e.target.value) || 45 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bearing Capacity Rc90,Rk (kN/m):</label>
                      <input
                        type="number"
                        value={cltSlabInputs.Rc90_Rk}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, Rc90_Rk: parseFloat(e.target.value) || 150 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Creep Factor kdef:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cltSlabInputs.kdef}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, kdef: parseFloat(e.target.value) || 0.8 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. SLS Deflection Limits & Safety Factors
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Imposed Deflection Limit:</label>
                      <select
                        value={cltSlabInputs.div_Q}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, div_Q: parseInt(e.target.value) || 300 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={200}>L / 200</option>
                        <option value={250}>L / 250</option>
                        <option value={300}>L / 300 (Standard)</option>
                        <option value={350}>L / 350</option>
                        <option value={500}>L / 500</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Final Deflection Limit:</label>
                      <select
                        value={cltSlabInputs.div_fin}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, div_fin: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={150}>L / 150</option>
                        <option value={200}>L / 200 (Standard)</option>
                        <option value={250}>L / 250</option>
                        <option value={300}>L / 300</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Partial Factor γM:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltSlabInputs.gammaM}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, gammaM: parseFloat(e.target.value) || 1.30 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Mod Factor kmod,G:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltSlabInputs.kmod_G}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, kmod_G: parseFloat(e.target.value) || 0.60 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Mod Factor kmod,GQ:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltSlabInputs.kmod_GQ}
                        onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, kmod_GQ: parseFloat(e.target.value) || 0.80 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    8. CLT WALL STRIP INPUTS (24 Parameters)
                   ========================================================= */}
                {activeMember === 'clt_wall' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Geometry & Lateral Deflection Limits
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Storey Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={cltWallInputs.H}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling Length l0 (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cltWallInputs.l0}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, l0: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Panel Thickness t (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={cltWallInputs.t}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, t: parseInt(e.target.value) || 160 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Load Eccentricity e (mm):</label>
                      <input
                        type="number"
                        step="1"
                        value={cltWallInputs.e}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, e: parseFloat(e.target.value) || 10 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Self-Weight (kN/m³):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={cltWallInputs.weight}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, weight: parseFloat(e.target.value) || 5.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Lateral Limit H/div:</label>
                      <input
                        type="number"
                        step="50"
                        value={cltWallInputs.H_divisor}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, H_divisor: parseInt(e.target.value) || 300 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Axial & Out-of-Plane Wind Actions
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent NG,k (kN/m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={cltWallInputs.NG_k}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable NQ,k (kN/m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={cltWallInputs.NQ_k}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Lateral Wind pk (kN/m²):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cltWallInputs.pk}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, pk: parseFloat(e.target.value) || 0.5 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Product Status & Design Verification
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">CLT Product Name:</label>
                      <input
                        type="text"
                        value={cltWallInputs.productName}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, productName: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Documentation Status:</label>
                      <button
                        type="button"
                        onClick={() => setCltWallInputs({ ...cltWallInputs, isDocumented: !cltWallInputs.isDocumented })}
                        className={`w-full mt-1 p-1.5 rounded font-bold text-xs transition ${
                          cltWallInputs.isDocumented ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {cltWallInputs.isDocumented ? '✓ Verified ETA' : '⚠ Example Data'}
                      </button>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Design Method Route:</label>
                      <button
                        type="button"
                        onClick={() => setCltWallInputs({ ...cltWallInputs, isMethodConfirmed: !cltWallInputs.isMethodConfirmed })}
                        className={`w-full mt-1 p-1.5 rounded font-bold text-xs transition ${
                          cltWallInputs.isMethodConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {cltWallInputs.isMethodConfirmed ? '✓ Confirmed Method' : 'Unconfirmed Route'}
                      </button>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      4. Rigidity, Resistance & Buckling Stability (per 1m strip)
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bending EI,mean (Nmm²/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.EI_mean}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, EI_mean: parseFloat(e.target.value) || 3.0e12 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Shear GA,eff (N/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.GA_eff}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, GA_eff: parseFloat(e.target.value) || 8.0e6 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bending MR,k (kNm/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.MR_k}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, MR_k: parseFloat(e.target.value) || 60 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Shear VR,k (kN/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.VR_k}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, VR_k: parseFloat(e.target.value) || 45 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Axial Nc,Rk (kN/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.Nc_Rk}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, Nc_Rk: parseFloat(e.target.value) || 2000 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Creep Factor kdef:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={cltWallInputs.kdef}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, kdef: parseFloat(e.target.value) || 0.8 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      5. Design Factors & Stability Stiffnesses
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Partial Factor γM:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltWallInputs.gammaM}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, gammaM: parseFloat(e.target.value) || 1.30 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">kmod,G (Perm):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltWallInputs.kmod_G}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, kmod_G: parseFloat(e.target.value) || 0.60 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">kmod,GQ (Var):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltWallInputs.kmod_GQ}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, kmod_GQ: parseFloat(e.target.value) || 0.80 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Stability EI,05 (Nmm²/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.EI_05}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, EI_05: parseFloat(e.target.value) || 2.0e12 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Stability GA,05 (N/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.GA_05}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, GA_05: parseFloat(e.target.value) || 5.0e6 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Straightness Factor βc:</label>
                      <input
                        type="number"
                        step="0.05"
                        value={cltWallInputs.beta_c}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, beta_c: parseFloat(e.target.value) || 0.20 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    9. WOOD BEAM INPUTS (13 Parameters)
                   ========================================================= */}
                {activeMember === 'wood_beam' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Timber Grade & Service Duration
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Timber / Glulam Grade:</label>
                      <select
                        value={woodBeamInputs.timberClass}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, timberClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(TIMBER_CLASSES).map((tc) => (
                          <option key={tc} value={tc}>{tc} ({TIMBER_CLASSES[tc].type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Service Class (SC):</label>
                      <select
                        value={woodBeamInputs.serviceClass}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, serviceClass: parseInt(e.target.value) as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value={1}>SC 1 (Heated Interior)</option>
                        <option value={2}>SC 2 (Covered Exterior)</option>
                        <option value={3}>SC 3 (Fully Exposed)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Action Duration:</label>
                      <select
                        value={woodBeamInputs.duration}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, duration: e.target.value as TimberLoadDuration })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="Permanent">Permanent</option>
                        <option value="Long-term">Long-term</option>
                        <option value="Medium-term">Medium-term</option>
                        <option value="Short-term">Short-term</option>
                        <option value="Instantaneous">Instantaneous</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Timber Unit Weight (kN/m³):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodBeamInputs.weight}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, weight: parseFloat(e.target.value) || 5.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Beam Cross-Section & Geometry
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Span L (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.spanL.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodBeamInputs.L}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, L: parseFloat(e.target.value) || 6.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Tributary Width Btr (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(bay: {bayConfig.tributaryWidthBtr.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={woodBeamInputs.Btr}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, Btr: parseFloat(e.target.value) || 0.6 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Section Width b (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={woodBeamInputs.b}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, b: parseInt(e.target.value) || 120 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Section Depth h (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={woodBeamInputs.h}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, h: parseInt(e.target.value) || 320 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bearing Length a (mm):</label>
                      <input
                        type="number"
                        step="10"
                        value={woodBeamInputs.a}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, a: parseInt(e.target.value) || 120 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Lateral Restraint:</label>
                      <select
                        value={woodBeamInputs.restraint}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, restraint: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="Assumed">Assumed (Restrained)</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Crack Factor kcr:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={woodBeamInputs.kcr}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, kcr: parseFloat(e.target.value) || 0.67 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. SLS Deflection Limits
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Imposed Deflection Limit:</label>
                      <select
                        value={woodBeamInputs.div_Q}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, div_Q: parseInt(e.target.value) || 300 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={200}>L / 200</option>
                        <option value={250}>L / 250</option>
                        <option value={300}>L / 300 (Standard)</option>
                        <option value={350}>L / 350</option>
                        <option value={500}>L / 500</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Final Deflection Limit:</label>
                      <select
                        value={woodBeamInputs.div_fin}
                        onChange={(e) => setWoodBeamInputs({ ...woodBeamInputs, div_fin: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      >
                        <option value={150}>L / 150</option>
                        <option value={200}>L / 200 (Standard)</option>
                        <option value={250}>L / 250</option>
                        <option value={300}>L / 300</option>
                      </select>
                    </div>
                  </>
                )}

                {/* =========================================================
                    10. WOOD COLUMN INPUTS (16 Parameters)
                   ========================================================= */}
                {activeMember === 'wood_column' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Timber Grade & Service Duration
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Timber / Glulam Grade:</label>
                      <select
                        value={woodColInputs.timberClass}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, timberClass: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(TIMBER_CLASSES).map((tc) => (
                          <option key={tc} value={tc}>{tc} ({TIMBER_CLASSES[tc].type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Service Class (SC):</label>
                      <select
                        value={woodColInputs.serviceClass}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, serviceClass: parseInt(e.target.value) as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value={1}>SC 1 (Heated Interior)</option>
                        <option value={2}>SC 2 (Covered Exterior)</option>
                        <option value={3}>SC 3 (Fully Exposed)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Action Duration:</label>
                      <select
                        value={woodColInputs.duration}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, duration: e.target.value as TimberLoadDuration })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="Permanent">Permanent</option>
                        <option value="Long-term">Long-term</option>
                        <option value="Medium-term">Medium-term</option>
                        <option value="Short-term">Short-term</option>
                        <option value="Instantaneous">Instantaneous</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Timber Unit Weight (kN/m³):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodColInputs.weight}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, weight: parseFloat(e.target.value) || 5.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Column Geometry & Buckling
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Column Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={woodColInputs.H}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Section Width b (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={woodColInputs.b}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, b: parseInt(e.target.value) || 200 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Section Depth h (mm):</label>
                      <input
                        type="number"
                        step="20"
                        value={woodColInputs.h}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, h: parseInt(e.target.value) || 240 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling l0,y (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={woodColInputs.l0_y}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, l0_y: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Buckling l0,z (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={woodColInputs.l0_z}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, l0_z: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Lateral Restraint:</label>
                      <select
                        value={woodColInputs.restraint}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, restraint: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="Assumed">Assumed (Restrained)</option>
                        <option value="None">None</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Axial Compression & Biaxial Moments
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent Axial NG,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={woodColInputs.NG_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable Axial NQ,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.column_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={woodColInputs.NQ_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment MGy,k (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodColInputs.MGy_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, MGy_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment MQy,k (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodColInputs.MQy_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, MQy_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment MGz,k (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodColInputs.MGz_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, MGz_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Moment MQz,k (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={woodColInputs.MQz_k}
                        onChange={(e) => setWoodColInputs({ ...woodColInputs, MQz_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    11. MASONRY WALL STRIP INPUTS (25 Parameters)
                   ========================================================= */}
                {activeMember === 'masonry_wall' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Unit Type / Group & Strength Data (EN 1996 Table 3.3)
                    </div>
                    <div className="col-span-2">
                      <label className="text-slate-400 block font-semibold">Unit Type / Group:</label>
                      <select
                        value={masonryInputs.unitGroup}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, unitGroup: e.target.value })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        {Object.keys(MASONRY_GROUPS).map((mg) => (
                          <option key={mg} value={mg}>{mg} (K = {MASONRY_GROUPS[mg].KEN})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Strength Route:</label>
                      <select
                        value={masonryInputs.fkRoute}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fkRoute: e.target.value as any })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="From fb and fm">From fb and fm</option>
                        <option value="Declared / Tested fk">Declared fk,test</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Unit Strength fb (MPa):</label>
                      <input
                        type="number"
                        value={masonryInputs.fb}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fb: parseFloat(e.target.value) || 10 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Mortar Strength fm (MPa):</label>
                      <input
                        type="number"
                        value={masonryInputs.fm}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fm: parseFloat(e.target.value) || 5 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Tested Strength fk,test (MPa):</label>
                      <input
                        type="number"
                        value={masonryInputs.fk_test}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fk_test: parseFloat(e.target.value) || 4.5 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Override Factor K,NA (0=auto):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={masonryInputs.K_NA}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, K_NA: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Modulus Factor KE:</label>
                      <input
                        type="number"
                        step="100"
                        value={masonryInputs.KE}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, KE: parseFloat(e.target.value) || 1000 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Creep Ratio φinf:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={masonryInputs.phi_inf}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, phi_inf: parseFloat(e.target.value) || 1.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Unit Weight (kN/m³):</label>
                      <input
                        type="number"
                        step="1"
                        value={masonryInputs.weight}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, weight: parseFloat(e.target.value) || 18 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Data Status:</label>
                      <button
                        type="button"
                        onClick={() => setMasonryInputs({ ...masonryInputs, isExampleData: !masonryInputs.isExampleData })}
                        className={`w-full mt-1 p-1.5 rounded font-bold text-xs transition ${
                          !masonryInputs.isExampleData ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                        }`}
                      >
                        {!masonryInputs.isExampleData ? '✓ Checked Data' : '⚠ Example Data'}
                      </button>
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      2. Geometry & Clear Height
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Wall Segment l (m):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={masonryInputs.l}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, l: parseFloat(e.target.value) || 1.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Clear Height H (m):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(storey: {bayConfig.storeyHeightH.toFixed(1)})</span>}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={masonryInputs.H}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, H: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Thickness t (mm):</label>
                      <input
                        type="number"
                        step="25"
                        value={masonryInputs.t}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, t: parseInt(e.target.value) || 250 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Effective Height hef (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={masonryInputs.hef}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, hef: parseFloat(e.target.value) || 3.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Vertical Loads & Moments
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Permanent Axial NG,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NG_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={masonryInputs.NG_k}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, NG_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">
                        Variable Axial NQ,k (kN):
                        {bayConfig.autoLoadTakedown && <span className="text-sky-400 font-mono text-[10px] ml-1">(auto: {takedown.wall_NQ_k.toFixed(0)})</span>}
                      </label>
                      <input
                        type="number"
                        value={masonryInputs.NQ_k}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, NQ_k: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Top Moment MEd,t (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={masonryInputs.MEd_t}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, MEd_t: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Mid-Height Moment MEd,m (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={masonryInputs.MEd_m}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, MEd_m: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Bottom Moment MEd,b (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={masonryInputs.MEd_b}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, MEd_b: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      4. In-Plane Shear Verification
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Shear Force VEd (kN):</label>
                      <input
                        type="number"
                        value={masonryInputs.VEd}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, VEd: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Co-existing Axial NEd,v (kN):</label>
                      <input
                        type="number"
                        value={masonryInputs.NEd_v}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, NEd_v: parseFloat(e.target.value) || 0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Compressed Length lc (m):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={masonryInputs.lc}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, lc: parseFloat(e.target.value) || 1.0 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Initial Shear Strength fvk0 (MPa):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={masonryInputs.fvk0}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fvk0: parseFloat(e.target.value) || 0.20 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Shear Cap Rule:</label>
                      <select
                        value={masonryInputs.capRule}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, capRule: e.target.value as '0.065 fb' | 'NA fvlt' })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-semibold"
                      >
                        <option value="0.065 fb">0.065 fb (Standard)</option>
                        <option value="NA fvlt">NA fvlt (National Annex)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block font-semibold">Limit Shear fvlt (MPa):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={masonryInputs.fvlt}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, fvlt: parseFloat(e.target.value) || 0.65 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 5-Column Transparent Mathematical Calculation Dossier Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" />
                Live Verification Sheet: {activeDetails.name}
              </span>
              <span className="text-[10px] text-slate-400">
                Formula text right of each result exactly matches the Eurocode workbook
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-2.5">Parameter</th>
                    <th className="p-2.5">Symbol</th>
                    <th className="p-2.5">Units</th>
                    <th className="p-2.5">Calculated Value</th>
                    <th className="p-2.5">Mathematical Formula (Plain Text)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeDetails.result?.rows.map((row: CalculationRow, idx: number) => (
                    <tr key={idx} className={row.isRatio && row.isExceeded ? 'bg-rose-950/30 text-rose-300' : 'hover:bg-slate-800/40'}>
                      <td className="p-2.5 font-medium text-slate-200">{row.parameter}</td>
                      <td className="p-2.5 font-mono text-sky-400 font-bold">{row.symbol}</td>
                      <td className="p-2.5 text-slate-400">{row.units}</td>
                      <td className="p-2.5 font-mono font-bold text-white">{row.value}</td>
                      <td className="p-2.5 font-mono text-[11px] text-teal-300">{row.formulaText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 4: MULTI-SYSTEM COMPARISON & OPTIONEERING MATRIX
         ===================================================================== */}
      {activeStep === 4 && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-white">Step 4: Structural Optioneering & Multi-System Comparison</h2>
                <p className="text-xs text-slate-400">
                  Benchmark Reinforced Concrete, Structural Steel, Mass Timber / CLT, and Masonry for the current structural bay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
              >
                <FileText className="w-4 h-4" />
                Generate A4 Calculation Report
              </button>
            </div>

            {/* Side-by-Side Optioneering Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {optioneeringMatrix.map((opt) => (
                <div
                  key={opt.system}
                  onClick={() => setBayConfig({ ...bayConfig, materialSystem: opt.system })}
                  className={`p-4 rounded-xl border transition cursor-pointer space-y-3 ${
                    opt.system === bayConfig.materialSystem
                      ? 'bg-slate-800/90 border-teal-500 shadow-xl'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-extrabold text-white text-xs">{opt.displayName}</span>
                    {opt.system === bayConfig.materialSystem && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Depth:</span>
                      <span className="font-mono font-bold text-white">{opt.structuralDepth} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Slab / Beam:</span>
                      <span>{opt.slabDepth} / {opt.beamDepth} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Column / Wall:</span>
                      <span className="text-[11px]">{opt.columnSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Self-Weight:</span>
                      <span className="font-mono font-bold">{opt.selfWeightWm2.toFixed(1)} kN/m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Embodied Carbon:</span>
                      <span className={`font-mono font-bold ${opt.embodiedCarbonA1A3 < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {opt.embodiedCarbonA1A3} kg/m²
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400">Governing ηmax:</span>
                      <span className={opt.eta_max <= 0.8 ? 'text-emerald-400' : opt.eta_max <= 1.0 ? 'text-amber-400' : 'text-rose-400'}>
                        {opt.eta_max.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full ${opt.eta_max <= 0.8 ? 'bg-emerald-500' : opt.eta_max <= 1.0 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${Math.min(100, opt.eta_max * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* =====================================================================
                PILLAR 5: 6-AXIS MULTI-CRITERIA RADAR & LCA EMBODIED CARBON SENSITIVITY
               ===================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-slate-800">
              {/* Left Column: 6-Axis Interactive Radar Chart */}
              <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      6-Axis Multi-Criteria Structural Radar
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Holistic benchmark across structural capacity, carbon, slenderness, speed, thermal mass, and cost.
                    </p>
                  </div>

                  {/* System Visibility Toggles */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {[
                      { key: 'RC', label: 'RC', color: '#06b6d4', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' },
                      { key: 'Steel', label: 'Steel', color: '#3b82f6', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
                      { key: 'Timber', label: 'Timber', color: '#f59e0b', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/50' },
                      { key: 'Masonry', label: 'Masonry', color: '#f43f5e', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/50' }
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setRadarFilter({ ...radarFilter, [s.key]: !radarFilter[s.key] })}
                        className={`px-2 py-0.5 rounded-lg border font-bold transition flex items-center gap-1 cursor-pointer ${
                          radarFilter[s.key] ? s.bg : 'bg-slate-900 text-slate-500 border-slate-800 opacity-50'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Radar Chart Visualizer */}
                <div className="flex items-center justify-center p-2">
                  <svg viewBox="0 0 520 440" className="w-full max-w-[480px] h-auto select-none">
                    {/* Concentric Hexagon Grid Levels (20%, 40%, 60%, 80%, 100%) */}
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, sIdx) => {
                      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
                        const a = k * (Math.PI / 3) - Math.PI / 2;
                        return `${(260 + 140 * scale * Math.cos(a)).toFixed(1)},${(220 + 140 * scale * Math.sin(a)).toFixed(1)}`;
                      }).join(' ');
                      return (
                        <g key={sIdx}>
                          <polygon
                            points={pts}
                            fill="none"
                            stroke="#334155"
                            strokeWidth={sIdx === 4 ? '1.5' : '1'}
                            strokeDasharray={sIdx === 4 ? undefined : '2 2'}
                            opacity={0.65}
                          />
                          <text
                            x={264}
                            y={220 - 140 * scale + 4}
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {Math.round(scale * 100)}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Radial Spokes */}
                    {[0, 1, 2, 3, 4, 5].map((k) => {
                      const a = k * (Math.PI / 3) - Math.PI / 2;
                      const x2 = 260 + 140 * Math.cos(a);
                      const y2 = 220 + 140 * Math.sin(a);
                      return (
                        <line
                          key={k}
                          x1={260}
                          y1={220}
                          x2={x2}
                          y2={y2}
                          stroke="#334155"
                          strokeWidth="1"
                          opacity={0.8}
                        />
                      );
                    })}

                    {/* Axis Labels */}
                    <text x={260} y={62} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Structural Capacity (1-η)
                    </text>
                    <text x={405} y={135} textAnchor="start" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Low Carbon (A1-A3)
                    </text>
                    <text x={405} y={305} textAnchor="start" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Clear Height (Thinness)
                    </text>
                    <text x={260} y={386} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Construction Speed
                    </text>
                    <text x={115} y={305} textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Acoustic & Thermal Mass
                    </text>
                    <text x={115} y={135} textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="bold">
                      Material Economy
                    </text>

                    {/* Structural System Polygons */}
                    {[
                      {
                        key: 'RC',
                        color: '#06b6d4',
                        scores: [
                          Math.max(0.2, Math.min(0.95, 1.15 - (optioneeringMatrix.find(o => o.system === 'RC')?.eta_max || 0.6) * 0.7)),
                          lowCarbonConcrete ? 0.72 : 0.42,
                          0.65,
                          0.52,
                          0.92,
                          0.88
                        ]
                      },
                      {
                        key: 'Steel',
                        color: '#3b82f6',
                        scores: [
                          Math.max(0.2, Math.min(0.95, 1.15 - (optioneeringMatrix.find(o => o.system === 'Steel')?.eta_max || 0.6) * 0.7)),
                          recycledSteel ? 0.85 : 0.52,
                          0.95,
                          0.92,
                          0.35,
                          0.72
                        ]
                      },
                      {
                        key: 'Timber',
                        color: '#f59e0b',
                        scores: [
                          Math.max(0.2, Math.min(0.95, 1.15 - (optioneeringMatrix.find(o => o.system === 'Timber')?.eta_max || 0.6) * 0.7)),
                          biogenicTimber ? 0.98 : 0.72,
                          0.75,
                          0.88,
                          0.45,
                          0.68
                        ]
                      },
                      {
                        key: 'Masonry',
                        color: '#f43f5e',
                        scores: [
                          Math.max(0.2, Math.min(0.95, 1.15 - (optioneeringMatrix.find(o => o.system === 'Masonry')?.eta_max || 0.8) * 0.7)),
                          0.48,
                          0.55,
                          0.40,
                          0.95,
                          0.82
                        ]
                      }
                    ].map((sys) => {
                      if (!radarFilter[sys.key]) return null;
                      const pts = sys.scores.map((sc, idx) => {
                        const a = idx * (Math.PI / 3) - Math.PI / 2;
                        const x = 260 + 140 * sc * Math.cos(a);
                        const y = 220 + 140 * sc * Math.sin(a);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ');

                      return (
                        <g key={sys.key}>
                          <polygon
                            points={pts}
                            fill={sys.color}
                            fillOpacity="0.20"
                            stroke={sys.color}
                            strokeWidth="2.5"
                          />
                          {sys.scores.map((sc, idx) => {
                            const a = idx * (Math.PI / 3) - Math.PI / 2;
                            const x = 260 + 140 * sc * Math.cos(a);
                            const y = 220 + 140 * sc * Math.sin(a);
                            return (
                              <circle
                                key={idx}
                                cx={x}
                                cy={y}
                                r={3.5}
                                fill={sys.color}
                                stroke="#090d16"
                                strokeWidth="1.5"
                              />
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Right Column: LCA Sensitivity & Circular Economy Toggles */}
              <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-inner">
                <div className="border-b border-slate-800 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Leaf className="w-3.5 h-3.5" />
                    Embodied Carbon LCA & Circular Economy Toggles (EN 15978)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evaluate low-carbon materials, recycled feedstock, and biogenic sequestration scenarios.
                  </p>
                </div>

                {/* 3 Circular Economy Toggles */}
                <div className="space-y-2.5 text-xs">
                  {/* Toggle 1: Low-Carbon Concrete */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lowCarbonConcrete}
                      onChange={(e) => setLowCarbonConcrete(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-teal-500 focus:ring-teal-400 w-4 h-4 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5 text-teal-400" />
                        Low-Carbon Concrete (CEM II/III Slag)
                      </span>
                      <p className="text-[10.5px] text-slate-400 leading-tight">
                        Reduces upfront concrete GWP by 40% (215 ➔ 129 kg CO₂e/m²) via 60% blast-furnace slag replacement.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 2: Recycled EAF Steel */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recycledSteel}
                      onChange={(e) => setRecycledSteel(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-blue-400 w-4 h-4 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                        Recycled Steel (Electric Arc Furnace)
                      </span>
                      <p className="text-[10.5px] text-slate-400 leading-tight">
                        Reduces structural steel GWP by 50% (168 ➔ 84 kg CO₂e/m²) using 90% recycled scrap steel in electric furnaces.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 3: Timber Biogenic Sequestration */}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-900 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={biogenicTimber}
                      onChange={(e) => setBiogenicTimber(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-amber-400" />
                        Include Biogenic Carbon Storage in Timber
                      </span>
                      <p className="text-[10.5px] text-slate-400 leading-tight">
                        Accounts for photosynthesis carbon sequestration in CLT/Glulam (-48 kg CO₂e/m² net storage vs +72 gross).
                      </p>
                    </div>
                  </label>
                </div>

                {/* Scenario Benchmark Summary Table */}
                <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Bay Carbon Benchmark ({bayConfig.spanL * bayConfig.tributaryWidthBtr * bayConfig.numberOfStoreys} m² Total)</span>
                    <span className="font-mono text-teal-400">{bayConfig.numberOfStoreys} Storeys</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      {
                        name: 'Reinforced Concrete',
                        sys: 'RC',
                        carbon: lowCarbonConcrete ? 129 : 215,
                        color: 'text-cyan-400',
                        barColor: 'bg-cyan-500'
                      },
                      {
                        name: 'Structural Steel',
                        sys: 'Steel',
                        carbon: recycledSteel ? 84 : 168,
                        color: 'text-blue-400',
                        barColor: 'bg-blue-500'
                      },
                      {
                        name: 'Mass Timber (CLT + Glulam)',
                        sys: 'Timber',
                        carbon: biogenicTimber ? -48 : 72,
                        color: 'text-amber-400',
                        barColor: 'bg-amber-500'
                      },
                      {
                        name: 'Load-Bearing Masonry',
                        sys: 'Masonry',
                        carbon: 185,
                        color: 'text-rose-400',
                        barColor: 'bg-rose-500'
                      }
                    ].map((row) => {
                      const totBayCarbon = ((bayConfig.spanL * bayConfig.tributaryWidthBtr * bayConfig.numberOfStoreys * row.carbon) / 1000).toFixed(1);
                      return (
                        <div key={row.name} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white text-[11px] block">{row.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Bay Total: <strong className={row.color}>{totBayCarbon} tCO₂e</strong>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`font-mono font-extrabold text-xs ${row.carbon < 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                              {row.carbon > 0 ? `+${row.carbon}` : row.carbon} kg/m²
                            </span>
                            <div className="text-[9.5px] text-slate-500">A1-A3 Upfront</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CLT ETA PRODUCT MANAGER MODAL
         ===================================================================== */}
      {showEtaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                CLT ETA Product Specification Manager
              </span>
              <button
                type="button"
                onClick={() => setShowEtaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400">
              Enter manufacturer-declared ETA properties (e.g., Stora Enso, KLH, Binderholz) to transition verification status from <span className="text-amber-400 font-bold">EXAMPLE DATA</span> to <span className="text-sky-400 font-bold">DOCUMENTED PRODUCT</span>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-slate-300 block font-semibold">Product Name / Layup ID:</label>
                <input
                  type="text"
                  value={cltSlabInputs.productName}
                  onChange={(e) => {
                    setCltSlabInputs({ ...cltSlabInputs, productName: e.target.value });
                    setCltWallInputs({ ...cltWallInputs, productName: e.target.value });
                  }}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block font-semibold">Bending Rigidity EI,mean (Nmm²/m):</label>
                  <input
                    type="number"
                    value={cltSlabInputs.EI_mean}
                    onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, EI_mean: parseFloat(e.target.value) || 3e12 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block font-semibold">Effective Shear Rigidity GA,eff (N/m):</label>
                  <input
                    type="number"
                    value={cltSlabInputs.GA_eff}
                    onChange={(e) => setCltSlabInputs({ ...cltSlabInputs, GA_eff: parseFloat(e.target.value) || 8e6 })}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="docCheck"
                  checked={cltSlabInputs.isDocumented}
                  onChange={(e) => {
                    setCltSlabInputs({ ...cltSlabInputs, isDocumented: e.target.checked });
                    setCltWallInputs({ ...cltWallInputs, isDocumented: e.target.checked, isMethodConfirmed: e.target.checked });
                  }}
                  className="rounded border-slate-600 text-sky-500 focus:ring-sky-400"
                />
                <label htmlFor="docCheck" className="text-slate-200 font-semibold cursor-pointer">
                  Confirm properties are verified from official Manufacturer ETA declaration
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEtaModal(false)}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition"
              >
                Save & Apply to Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PROFESSIONAL A4 PRINT DOSSIER MODAL
         ===================================================================== */}
      <StructuralReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        metadata={metadata}
        setMetadata={setMetadata}
        basis={basis}
        config={bayConfig}
        memberResults={allMemberResults}
        optioneeringMatrix={optioneeringMatrix}
      />

      {/* =====================================================================
          EUROCODE GUIDE: WORKFLOW, INTERPRETATION & SCOPE MODAL
         ===================================================================== */}
      <EurocodeGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        activeMember={activeMember}
        allMemberResults={allMemberResults}
        onSelectMember={(m) => setActiveMember(m as SelectedMemberType)}
      />
    </div>
  );
};
