// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING & INTEGRATED DESIGN STUDIO
// Component: src/components/StructuralEurocodeStudio.tsx
// Complete implementation of datasets, equations, and verification rules from
// BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx (EN 1990 - EN 1996)
// © Politecnico di Milano - Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
// ============================================================================

import React, { useState, useMemo } from 'react';
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
  Info,
  ChevronRight,
  Database,
  ArrowRight,
  Check,
  ShieldCheck,
  Maximize2,
  X,
  BookOpen
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
  CalculationRow
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

export const StructuralEurocodeStudio: React.FC = () => {
  // --------------------------------------------------------------------------
  // WORKFLOW STEPS (1: Project Basis, 2: 3D Bay & Loads, 3: Members & Solver, 4: Comparison & Report)
  // --------------------------------------------------------------------------
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(2);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEtaModal, setShowEtaModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showScopeBanner, setShowScopeBanner] = useState(true);

  // --------------------------------------------------------------------------
  // PROJECT METADATA
  // --------------------------------------------------------------------------
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    projectTitle: 'PoliMi Life Cycle Housing Pilot',
    jobCode: 'POLIMI-LCH-2026',
    location: 'Milan / Bovisa, Italy',
    client: 'Politecnico di Milano (DABC)',
    authorName: 'Building Technology Team',
    studentMatricula: '10987654',
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
      setActiveMember('steel_beam');
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
      setActiveMember('rc_slab');
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
      setActiveMember('clt_slab');
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
      setActiveMember('masonry_wall');
    }
  };

  // --------------------------------------------------------------------------
  // ACTIVE MEMBER & MEMBER INPUT PARAMETERS (11 SHEETS)
  // --------------------------------------------------------------------------
  const [activeMember, setActiveMember] = useState<SelectedMemberType>('rc_slab');

  // Tributary Load Takedown derivation
  const takedown = useMemo(
    () => computeTributaryLoadTakedown(bayConfig, basis),
    [bayConfig, basis]
  );

  // 1. RC Slab
  const [rcSlabInputs, setRcSlabInputs] = useState<RcSlabInputs>({
    L: 4.5, Btr: 1.0, b: 1000, h: 220, cnom: 30, phi: 12, s: 150, phi_t: 8, s_t: 200,
    concreteClass: 'C30/37', fyk: 500
  });

  // 2. RC Beam
  const [rcBeamInputs, setRcBeamInputs] = useState<RcBeamInputs>({
    L: 6.0, Btr: 3.0, b: 300, h: 550, cnom: 30, phi: 20, phi_link: 8, n: 4, nleg: 2,
    sw: 200, cot_theta: 2.0, concreteClass: 'C30/37', fyk: 500
  });

  // 3. RC Wall
  const [rcWallInputs, setRcWallInputs] = useState<RcWallInputs>({
    H: 3.0, l0: 3.0, b: 1000, h: 200, a: 40, phi: 12, s: 200,
    NG_k: 200, NQ_k: 70, M0_Ed: 4.0, phi_ef: 2.0, c: 8, phi_h: 8, s_h: 200,
    concreteClass: 'C30/37', fyk: 500
  });

  // 4. RC Column
  const [rcColInputs, setRcColInputs] = useState<RcColumnInputs>({
    H: 3.0, l0: 3.0, b: 400, h: 400, a: 50, phi: 20, n_bars: 3,
    NG_k: 550, NQ_k: 150, M0_Ed: 35.0, phi_ef: 2.0, c: 8,
    concreteClass: 'C30/37', fyk: 500
  });

  // 5. Steel Beam
  const [steelBeamInputs, setSteelBeamInputs] = useState<SteelBeamInputs>({
    L: 6.0, Btr: 3.0, profileName: 'IPE 300', grade: 'S355', restraint: 'Assumed',
    div_Q: 300, div_total: 250
  });

  // 6. Steel Column
  const [steelColInputs, setSteelColInputs] = useState<SteelColumnInputs>({
    H: 3.0, lcr_y: 3.0, lcr_z: 3.0, lcr_T: 3.0, NG_k: 400, NQ_k: 150,
    profileName: 'HE 240 B', grade: 'S355'
  });

  // 7. CLT Slab
  const [cltSlabInputs, setCltSlabInputs] = useState<CltSlabInputs>({
    L: 5.0, Btr: 1.0, t: 160, EI_mean: 3.0e12, GA_eff: 8.0e6, MR_k: 60, VR_k: 45, Rc90_Rk: 150,
    gammaM: 1.30, kmod_G: 0.60, kmod_GQ: 0.80, kdef: 0.80, div_Q: 300, div_fin: 200,
    productName: 'EXAMPLE 160 mm 5-layer', isDocumented: false
  });

  // 8. CLT Wall
  const [cltWallInputs, setCltWallInputs] = useState<CltWallInputs>({
    H: 3.0, l0: 3.0, NG_k: 120, NQ_k: 50, e: 10, pk: 0.5, t: 160,
    Nc_Rk: 2000, EI_05: 2.0e12, GA_05: 5.0e6, MR_k: 60, VR_k: 45, gammaM: 1.30,
    kmod_G: 0.60, kmod_GQ: 0.80, beta_c: 0.2, productName: 'EXAMPLE 160 mm 5-layer',
    isDocumented: false, isMethodConfirmed: false
  });

  // 9. Wood Beam
  const [woodBeamInputs, setWoodBeamInputs] = useState<WoodBeamInputs>({
    L: 6.0, Btr: 0.6, b: 120, h: 320, a: 120, timberClass: 'GL24h', serviceClass: 1,
    duration: 'Medium-term', div_Q: 300, div_fin: 200, restraint: 'Assumed'
  });

  // 10. Wood Column
  const [woodColInputs, setWoodColInputs] = useState<WoodColumnInputs>({
    H: 3.0, b: 200, h: 240, l0_y: 3.0, l0_z: 3.0, NG_k: 100, NQ_k: 40,
    MGy_k: 2.0, MQy_k: 1.0, MGz_k: 1.0, MQz_k: 0.5, timberClass: 'GL24h',
    serviceClass: 1, duration: 'Medium-term', restraint: 'Assumed'
  });

  // 11. Masonry Wall
  const [masonryInputs, setMasonryInputs] = useState<MasonryWallInputs>({
    l: 1.0, H: 3.0, t: 250, hef: 3.0, NG_k: 150, NQ_k: 50,
    MEd_t: 2.0, MEd_m: 3.0, MEd_b: 2.0, unitGroup: 'Clay / G1', fkRoute: 'From fb and fm',
    fb: 10, fm: 5, fk_test: 4.5, K_NA: 0, KE: 1000, phi_inf: 1.0, weight: 18,
    isExampleData: true, VEd: 20, NEd_v: 180, lc: 1.0, fvk0: 0.2, capRule: '0.065 fb', fvlt: 0.65
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
            onClick={() => setActiveStep(3)}
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
          STEP 1: PROJECT BASIS & LOAD CONFIGURATOR
         ===================================================================== */}
      {activeStep === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-white">Step 1: Shared Project Design Basis (EC Basis)</h2>
              <p className="text-xs text-slate-400">
                Configure National Annex partial factors, occupancy gravity loads, and structural material properties.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 transition shadow"
            >
              Continue to Step 2: 3D Bay
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Project Metadata & National Annex */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-400">Project Identification & National Annex</h3>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-400 block font-semibold">National Annex Preset:</label>
                  <select
                    value={basis.nationalAnnex}
                    onChange={(e) => handleNationalAnnexChange(e.target.value as NationalAnnexId)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-teal-400"
                  >
                    {Object.values(NATIONAL_ANNEX_PRESETS).map((na) => (
                      <option key={na.id} value={na.id}>
                        {na.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {NATIONAL_ANNEX_PRESETS[basis.nationalAnnex]?.description}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-slate-400 block font-semibold">Project Title:</label>
                    <input
                      type="text"
                      value={metadata.projectTitle}
                      onChange={(e) => setMetadata({ ...metadata, projectTitle: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block font-semibold">Job / Reference Code:</label>
                    <input
                      type="text"
                      value={metadata.jobCode}
                      onChange={(e) => setMetadata({ ...metadata, jobCode: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block font-semibold">Location (City, Country):</label>
                    <input
                      type="text"
                      value={metadata.location}
                      onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block font-semibold">Author / Practice Name:</label>
                    <input
                      type="text"
                      value={metadata.authorName}
                      onChange={(e) => setMetadata({ ...metadata, authorName: e.target.value })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Partial Safety Factors */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Partial Safety Factors (EN 1990)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">γG (Dead):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={basis.gammaG}
                      onChange={(e) => setBasis({ ...basis, gammaG: parseFloat(e.target.value) || 1.35 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">γQ (Live):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={basis.gammaQ}
                      onChange={(e) => setBasis({ ...basis, gammaQ: parseFloat(e.target.value) || 1.5 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ψ2 (Quasi-perm):</span>
                    <input
                      type="number"
                      step="0.05"
                      value={basis.psi2}
                      onChange={(e) => setBasis({ ...basis, psi2: parseFloat(e.target.value) || 0.3 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: EN 1991-1-1 Occupancy Gravity Loads */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-teal-400">EN 1991-1-1 Floor Gravity Loads</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block font-semibold">Occupancy Category Preset:</label>
                  <select
                    value={bayConfig.occupancyCategory}
                    onChange={(e) => {
                      setBayConfig({ ...bayConfig, occupancyCategory: e.target.value });
                      handleOccupancyPresetChange(e.target.value);
                    }}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-semibold focus:outline-none focus:border-teal-400"
                  >
                    {Object.entries(OCCUPANCY_LOAD_PRESETS).map(([k, occ]) => (
                      <option key={k} value={k}>
                        {occ.category}: {occ.name} (qk = {occ.qk} kN/m²)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block font-semibold">Imposed Variable Load qk (kN/m²):</label>
                    <input
                      type="number"
                      step="0.25"
                      value={basis.qk}
                      onChange={(e) => setBasis({ ...basis, qk: parseFloat(e.target.value) || 2.0 })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block font-semibold">Superimposed Permanent gk,add (kN/m²):</label>
                    <input
                      type="number"
                      step="0.25"
                      value={basis.gk_add}
                      onChange={(e) => setBasis({ ...basis, gk_add: parseFloat(e.target.value) || 2.5 })}
                      className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Screed, finishes, ceiling & services</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Material Density & Default Factors</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-400">
                    <div>Reinforced Concrete: <span className="font-mono text-white font-bold">{basis.weight_rc} kN/m³</span></div>
                    <div>Structural Steel E: <span className="font-mono text-white font-bold">{basis.E_steel} MPa</span></div>
                    <div>Reinforcing Rebar Es: <span className="font-mono text-white font-bold">{basis.Es_rebar} MPa</span></div>
                    <div>Concrete γC / Rebar γS: <span className="font-mono text-white font-bold">{basis.gammaC} / {basis.gammaS}</span></div>
                  </div>
                </div>
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
          {/* Top Bay Controller Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-300">Material Scheme:</span>
                {(['RC', 'Steel', 'Timber', 'Masonry'] as const).map((mat) => (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => {
                      setBayConfig({ ...bayConfig, materialSystem: mat });
                      if (mat === 'RC') setActiveMember('rc_slab');
                      else if (mat === 'Steel') setActiveMember('steel_beam');
                      else if (mat === 'Timber') setActiveMember('clt_slab');
                      else setActiveMember('masonry_wall');
                    }}
                    className={`px-3 py-1 rounded-xl font-bold transition ${
                      bayConfig.materialSystem === mat
                        ? 'bg-sky-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mat === 'RC' ? 'Reinforced Concrete' : mat === 'Steel' ? 'Structural Steel' : mat === 'Timber' ? 'Mass Timber / CLT' : 'Masonry'}
                  </button>
                ))}
              </div>

              {/* Auto Takedown Toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bayConfig.autoLoadTakedown}
                    onChange={(e) => setBayConfig({ ...bayConfig, autoLoadTakedown: e.target.checked })}
                    className="rounded border-slate-600 text-teal-500 focus:ring-teal-400"
                  />
                  <span className="font-semibold text-slate-200">Auto Tributary Load Takedown</span>
                </label>
              </div>
            </div>

            {/* Dimensional Sliders for the 3D Bay */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-slate-300 mb-1">
                  <span>Bay Span (L):</span>
                  <span className="font-mono text-sky-400 font-bold">{bayConfig.spanL.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="12.0"
                  step="0.5"
                  value={bayConfig.spanL}
                  onChange={(e) => setBayConfig({ ...bayConfig, spanL: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300 mb-1">
                  <span>Tributary Width (Btr):</span>
                  <span className="font-mono text-sky-400 font-bold">{bayConfig.tributaryWidthBtr.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="8.0"
                  step="0.5"
                  value={bayConfig.tributaryWidthBtr}
                  onChange={(e) => setBayConfig({ ...bayConfig, tributaryWidthBtr: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300 mb-1">
                  <span>Storey Height (H):</span>
                  <span className="font-mono text-sky-400 font-bold">{bayConfig.storeyHeightH.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="5.0"
                  step="0.25"
                  value={bayConfig.storeyHeightH}
                  onChange={(e) => setBayConfig({ ...bayConfig, storeyHeightH: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300 mb-1">
                  <span>Supported Storeys (N):</span>
                  <span className="font-mono text-sky-400 font-bold">{bayConfig.numberOfStoreys} Floors</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={bayConfig.numberOfStoreys}
                  onChange={(e) => setBayConfig({ ...bayConfig, numberOfStoreys: parseInt(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>
          </div>

          {/* 3D WebGL Structural Bay Viewer */}
          <StructuralBay3DViewer
            config={bayConfig}
            memberUtilisations={allMemberResults}
            activeMember={activeMember}
            onSelectMember={(m) => {
              setActiveMember(m);
              setActiveStep(3);
            }}
          />

          {/* Tributary Cascade Summary Cards */}
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

              {/* Dynamic Inputs depending on member type */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs max-h-[520px] overflow-y-auto pr-1">
                {/* =========================================================
                    1. RC SLAB INPUTS
                   ========================================================= */}
                {activeMember === 'rc_slab' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. Slab Geometry & Materials
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
                      <label className="text-slate-400 block font-semibold">Width b (mm):</label>
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
                    2. RC BEAM INPUTS
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
                    3. RC WALL STRIP INPUTS
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
                  </>
                )}

                {/* =========================================================
                    4. RC COLUMN IN UNIAXIAL BENDING INPUTS (EXPLICIT USER REQUEST)
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
                    5. STEEL BEAM INPUTS
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
                    6. STEEL COLUMN INPUTS
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

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Concentric Axial Compression
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
                  </>
                )}

                {/* =========================================================
                    7. CLT SLAB INPUTS
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
                    <div className="col-span-2">
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
                  </>
                )}

                {/* =========================================================
                    8. CLT WALL STRIP INPUTS
                   ========================================================= */}
                {activeMember === 'clt_wall' && (
                  <>
                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-1">
                      1. CLT Wall Geometry & Loading
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
                      <label className="text-slate-400 block font-semibold">Eccentricity e (mm):</label>
                      <input
                        type="number"
                        value={cltWallInputs.e}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, e: parseFloat(e.target.value) || 10 })}
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
                    <div>
                      <label className="text-slate-400 block font-semibold">Compression Nc,Rk (kN/m):</label>
                      <input
                        type="number"
                        value={cltWallInputs.Nc_Rk}
                        onChange={(e) => setCltWallInputs({ ...cltWallInputs, Nc_Rk: parseFloat(e.target.value) || 2000 })}
                        className="w-full mt-1 bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono"
                      />
                    </div>
                  </>
                )}

                {/* =========================================================
                    9. WOOD BEAM INPUTS
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
                  </>
                )}

                {/* =========================================================
                    10. WOOD COLUMN INPUTS
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

                    <div className="col-span-2 sm:col-span-3 text-[11px] font-bold text-sky-400 uppercase tracking-wider border-b border-slate-800 pb-1 mt-2">
                      3. Axial Compression & Moments
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
                  </>
                )}

                {/* =========================================================
                    11. MASONRY WALL STRIP INPUTS
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
                      <label className="text-slate-400 block font-semibold">Mid-Height Moment MEd,m (kNm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={masonryInputs.MEd_m}
                        onChange={(e) => setMasonryInputs({ ...masonryInputs, MEd_m: parseFloat(e.target.value) || 0 })}
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
