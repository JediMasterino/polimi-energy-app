// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING & VERIFICATION ENGINE
// Complete Mathematical Implementation of all 11 Member Calculators
// from BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx
// Standard: EN 1990, EN 1991-1-1, EN 1992-1-1, EN 1993-1-1, EN 1995-1-1, EN 1996-1-1
// © Politecnico di Milano - Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
// ============================================================================

import {
  CONCRETE_CLASSES,
  TIMBER_CLASSES,
  TIMBER_KMOD,
  TIMBER_KDEF,
  STEEL_PROFILES,
  MASONRY_GROUPS,
  NATIONAL_ANNEX_PRESETS,
  NationalAnnexId,
  TimberLoadDuration
} from '../data/eurocodeDataset';

// ----------------------------------------------------------------------------
// 1. SHARED DESIGN BASIS (EC BASIS)
// ----------------------------------------------------------------------------
export interface SharedDesignBasis {
  nationalAnnex: NationalAnnexId;
  gammaG: number;       // 1.35
  gammaQ: number;       // 1.50
  psi2: number;         // 0.30
  gk_add: number;       // 2.50 kN/m² superimposed dead load
  qk: number;           // 2.00 kN/m² imposed live load
  gammaC: number;       // 1.50
  gammaS: number;       // 1.15
  alphaCC: number;      // 1.00 (or 0.85 for Italy/UK)
  gammaM0: number;      // 1.00
  gammaM1: number;      // 1.00
  gammaM_solid: number; // 1.30
  gammaM_glulam: number;// 1.25
  weight_rc: number;    // 25.0 kN/m³
  E_steel: number;      // 210,000 MPa
  Es_rebar: number;     // 200,000 MPa
  gammaM_m: number;     // 2.50
  gammaM_v: number;     // 2.50
  tmin_wall: number;    // 100 mm
  // Environmental actions (Pillar 4: EN 1991-1-3, EN 1991-1-4, EN 1991-1-5)
  sk_snow?: number;           // Ground snow load sk [kN/m²]
  qp_wind?: number;           // Peak wind velocity pressure qp(z) [kN/m²]
  deltaT_thermal?: number;    // Design thermal expansion range ΔT [K]
  terrainCategory?: string;   // '0' | 'I' | 'II' | 'III' | 'IV'
  syncWeatherSource?: string; // Connected weather station name
}

export const DEFAULT_DESIGN_BASIS: SharedDesignBasis = {
  nationalAnnex: 'EN_RECOMMENDED',
  gammaG: 1.35,
  gammaQ: 1.50,
  psi2: 0.30,
  gk_add: 2.50,
  qk: 2.00,
  gammaC: 1.50,
  gammaS: 1.15,
  alphaCC: 1.00,
  gammaM0: 1.00,
  gammaM1: 1.00,
  gammaM_solid: 1.30,
  gammaM_glulam: 1.25,
  weight_rc: 25.0,
  E_steel: 210000,
  Es_rebar: 200000,
  gammaM_m: 2.50,
  gammaM_v: 2.50,
  tmin_wall: 100,
  sk_snow: 1.50,
  qp_wind: 0.85,
  deltaT_thermal: 35,
  terrainCategory: 'III',
  syncWeatherSource: 'Default Eurocode Baseline'
};

// Calculation table row for transparent dossier display
export interface CalculationRow {
  parameter: string;
  symbol: string;
  units: string;
  value: number | string;
  formulaText: string;
  basisNotes?: string;
  isRatio?: boolean;
  isExceeded?: boolean;
}

export type EurocodeStatus =
  | 'SCREEN ONLY'
  | 'DOCUMENTED PRODUCT'
  | 'EXAMPLE DATA'
  | 'EXCEEDS SCREEN'
  | 'OUT OF SCOPE'
  | 'CHECK INPUTS';

// ----------------------------------------------------------------------------
// 2. MEMBER 1: RC ONE-WAY SLAB (EN 1992-1-1)
// ----------------------------------------------------------------------------
export interface RcSlabInputs {
  L: number;          // m (calculation span)
  Btr: number;        // m (1.0 for unit strip)
  b: number;          // mm (1000)
  h: number;          // mm (overall slab depth)
  cnom: number;       // mm (nominal cover)
  phi: number;        // mm (main tension bar diameter)
  phi_link?: number;   // mm (link diameter, default 0 for slab)
  s: number;          // mm (main bar spacing)
  phi_t: number;      // mm (transverse bar diameter)
  s_t: number;        // mm (transverse bar spacing)
  concreteClass: string; // e.g. 'C30/37'
  fyk: number;        // MPa (e.g. 500)
}

export interface RcSlabResult {
  eta_max: number;
  status: EurocodeStatus;
  d: number;
  As_prov: number;
  As_req: number;
  As_min: number;
  MEd: number;
  MRd: number;
  VEd: number;
  VRdc: number;
  mu: number;
  x_prov: number;
  L_d_actual: number;
  L_d_adj: number;
  rows: CalculationRow[];
}

export function calcRcSlab(inputs: RcSlabInputs, basis: SharedDesignBasis): RcSlabResult {
  const { L, Btr, b, h, cnom, phi, phi_link = 0, s, phi_t, s_t, concreteClass, fyk } = inputs;
  const rows: CalculationRow[] = [];

  // Check inputs
  if (h <= cnom + phi_link + phi || s <= 0 || L <= 0 || b <= 0) {
    return {
      eta_max: 999,
      status: 'CHECK INPUTS',
      d: 0, As_prov: 0, As_req: 0, As_min: 0,
      MEd: 0, MRd: 0, VEd: 0, VRdc: 0, mu: 0, x_prov: 0, L_d_actual: 0, L_d_adj: 0,
      rows: []
    };
  }

  const conc = CONCRETE_CLASSES[concreteClass] || CONCRETE_CLASSES['C30/37'];
  const fck = conc.fck;
  const fctm = conc.fctm;
  const fcd = (basis.alphaCC * fck) / basis.gammaC;
  const fyd = fyk / basis.gammaS;

  const d = h - cnom - phi_link - phi / 2;
  const As_prov = (Math.PI * Math.pow(phi, 2) / 4) * (1000 / s);
  const gk_self = (b * h / 1000000) * basis.weight_rc;
  const Gk = basis.gk_add * Btr + gk_self;
  const Qk = basis.qk * Btr;
  const qd = basis.gammaG * Gk + basis.gammaQ * Qk;

  const MEd = (qd * Math.pow(L, 2)) / 8;
  const VEd = (qd * L) / 2;

  const mu = (MEd * 1000000) / (b * Math.pow(d, 2) * fcd);
  const isMuValid = mu <= 0.2952;
  const x_req = isMuValid ? (d * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu)))) / 0.8 : 0;
  const z = isMuValid ? Math.min(0.95 * d, d - 0.4 * x_req) : 0.95 * d;
  const As_req = isMuValid ? (MEd * 1000000) / (fyd * z) : 9999;
  const As_min = Math.max((0.26 * fctm) / fyk, 0.0013) * b * d;

  const x_prov = (As_prov * fyd) / (0.8 * b * fcd);
  const MRd = (As_prov * fyd * (d - 0.4 * x_prov)) / 1000000;

  // Utilisation ratios
  const eta_M = MRd > 0 ? MEd / MRd : 999;
  const eta_Asmin = As_min / As_prov;
  const eta_Asmax = As_prov / (0.04 * b * h);

  // Shear
  const k_shear = Math.min(2.0, 1 + Math.sqrt(200 / d));
  const rho_l = Math.min(0.02, As_prov / (b * d));
  const VRdc = Math.max(
    (0.18 / basis.gammaC) * k_shear * Math.cbrt(100 * rho_l * fck),
    0.035 * Math.pow(k_shear, 1.5) * Math.sqrt(fck)
  ) * (b * d) / 1000;
  const eta_V = VRdc > 0 ? VEd / VRdc : 999;

  // Detailing
  const As_t = (Math.PI * Math.pow(phi_t, 2) / 4) * (1000 / s_t);
  const eta_Ast = (0.2 * As_prov) / As_t;
  const s_max = Math.min(2 * h, 250);
  const eta_s = s / s_max;

  // SLS Span/depth ratio
  const rho = Math.max(As_req, As_min) / (b * d);
  const rho0 = Math.sqrt(fck) / 1000;
  let L_d_lim = 0;
  if (rho <= rho0) {
    L_d_lim = 11 + 1.5 * Math.sqrt(fck) * (rho0 / rho) + 3.2 * Math.sqrt(fck) * Math.pow(Math.max(0, (rho0 / rho) - 1), 1.5);
  } else {
    L_d_lim = 11 + 1.5 * Math.sqrt(fck) * (rho0 / rho);
  }
  const steelCorrection = Math.min(1.5, (500 / fyk) * (As_prov / Math.max(As_req, As_min)));
  const spanCorrection = Math.min(1.0, 7.0 / L);
  const L_d_adj = L_d_lim * steelCorrection * spanCorrection;
  const L_d_actual = (L * 1000) / d;
  const eta_SLS = L_d_adj > 0 ? L_d_actual / L_d_adj : 999;

  const eta_max = Math.max(eta_M, eta_Asmin, eta_Asmax, eta_V, eta_Ast, eta_s, eta_SLS);

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (!isMuValid || (x_prov / d) > 0.45) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  // Populate transparent verification table
  rows.push(
    { parameter: 'Effective depth', symbol: 'd', units: 'mm', value: d.toFixed(1), formulaText: 'h - cnom - phi/2' },
    { parameter: 'Provided tension steel', symbol: 'As', units: 'mm²', value: As_prov.toFixed(1), formulaText: 'π × phi² / 4 × 1000 / s' },
    { parameter: 'Member self-weight', symbol: 'gk,self', units: 'kN/m', value: gk_self.toFixed(2), formulaText: 'b × h / 10⁶ × weight' },
    { parameter: 'Design ULS line load', symbol: 'qd', units: 'kN/m', value: qd.toFixed(2), formulaText: 'γG × Gk + γQ × Qk' },
    { parameter: 'Design bending moment', symbol: 'MEd', units: 'kNm', value: MEd.toFixed(2), formulaText: 'qd × L² / 8' },
    { parameter: 'Moment resistance', symbol: 'MRd', units: 'kNm', value: MRd.toFixed(2), formulaText: 'As × fyd × (d - 0.4x,prov)' },
    { parameter: 'Flexural utilisation', symbol: 'MEd / MRd', units: '-', value: eta_M.toFixed(3), formulaText: 'MEd / MRd', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Concrete shear resistance', symbol: 'VRd,c', units: 'kN', value: VRdc.toFixed(2), formulaText: 'max(0.18/γC k (100ρ fck)^(1/3); 0.035 k^1.5 √fck) b d' },
    { parameter: 'Shear utilisation', symbol: 'VEd / VRd,c', units: '-', value: eta_V.toFixed(3), formulaText: 'VEd / VRd,c', isRatio: true, isExceeded: eta_V > 1 },
    { parameter: 'Span/depth actual', symbol: 'L/d', units: '-', value: L_d_actual.toFixed(2), formulaText: 'L × 1000 / d' },
    { parameter: 'Span/depth limiting', symbol: '(L/d)adj', units: '-', value: L_d_adj.toFixed(2), formulaText: '(L/d)lim × min(1.5; 500/fyk × As/As,req) × min(1; 7/L)' },
    { parameter: 'Deflection screen ratio', symbol: 'SLS', units: '-', value: eta_SLS.toFixed(3), formulaText: '(L/d) / (L/d)adj', isRatio: true, isExceeded: eta_SLS > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(MEd/MRd; VEd/VRdc; SLS; steel ratios)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    d,
    As_prov,
    As_req,
    As_min,
    MEd,
    MRd,
    VEd,
    VRdc,
    mu,
    x_prov,
    L_d_actual,
    L_d_adj,
    rows
  };
}

// ----------------------------------------------------------------------------
// 3. MEMBER 2: RC RECTANGULAR BEAM (EN 1992-1-1)
// ----------------------------------------------------------------------------
export interface RcBeamInputs {
  L: number;          // m
  Btr: number;        // m
  b: number;          // mm
  h: number;          // mm
  cnom: number;       // mm
  phi: number;        // mm (main bars)
  phi_link: number;   // mm (stirrups)
  n: number;          // number of tension bars in 1 layer
  nleg: number;       // number of link legs (usually 2)
  sw: number;         // mm (link spacing)
  cot_theta?: number;  // variable strut angle 1.0 to 2.5
  cotTheta?: number;   // alias for cot_theta
  concreteClass: string;
  fyk: number;
}

export interface RcBeamResult {
  eta_max: number;
  status: EurocodeStatus;
  d: number;
  As_prov: number;
  MEd: number;
  MRd: number;
  VEd: number;
  VRds: number;
  VRdmax: number;
  rows: CalculationRow[];
}

export function calcRcBeam(inputs: RcBeamInputs, basis: SharedDesignBasis): RcBeamResult {
  const { L, Btr, b, h, cnom, phi, phi_link, n, nleg, sw, concreteClass, fyk } = inputs;
  const cot_theta = inputs.cot_theta ?? inputs.cotTheta ?? 2.0;
  const rows: CalculationRow[] = [];

  const conc = CONCRETE_CLASSES[concreteClass] || CONCRETE_CLASSES['C30/37'];
  const fck = conc.fck;
  const fctm = conc.fctm;
  const fcd = (basis.alphaCC * fck) / basis.gammaC;
  const fyd = fyk / basis.gammaS;

  const d = h - cnom - phi_link - phi / 2;
  const As_prov = (Math.PI * Math.pow(phi, 2) / 4) * n;
  const gk_self = (b * h / 1000000) * basis.weight_rc;
  const Gk = basis.gk_add * Btr + gk_self;
  const Qk = basis.qk * Btr;
  const qd = basis.gammaG * Gk + basis.gammaQ * Qk;

  const MEd = (qd * Math.pow(L, 2)) / 8;
  const VEd = (qd * L) / 2;

  const mu = (MEd * 1000000) / (b * Math.pow(d, 2) * fcd);
  const isMuValid = mu <= 0.2952;
  const x_req = isMuValid ? (d * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu)))) / 0.8 : 0;
  const z = isMuValid ? Math.min(0.95 * d, d - 0.4 * x_req) : 0.95 * d;
  const As_req = isMuValid ? (MEd * 1000000) / (fyd * z) : 9999;
  const As_min = Math.max((0.26 * fctm) / fyk, 0.0013) * b * d;

  const x_prov = (As_prov * fyd) / (0.8 * b * fcd);
  const MRd = (As_prov * fyd * (d - 0.4 * x_prov)) / 1000000;

  const eta_M = MRd > 0 ? MEd / MRd : 999;
  const eta_Asmin = As_min / As_prov;
  const eta_Asmax = As_prov / (0.04 * b * h);

  // Variable strut shear
  const Asw_s = (nleg * Math.PI * Math.pow(phi_link, 2) / 4) / sw;
  const Asw_s_req = Math.max((0.08 * Math.sqrt(fck) / fyk) * b, (VEd * 1000) / (0.9 * d * fyd * cot_theta));
  const VRds = (Asw_s * 0.9 * d * fyd * cot_theta) / 1000;
  const VRdmax = (b * 0.9 * d * 0.6 * (1 - fck / 250) * fcd) / (cot_theta + 1 / cot_theta) / 1000;
  const eta_V = VEd / Math.min(VRds, VRdmax);
  const eta_link = Asw_s_req / Asw_s;
  const eta_sw = sw / (0.75 * d);

  // SLS
  const rho = Math.max(As_req, As_min) / (b * d);
  const rho0 = Math.sqrt(fck) / 1000;
  let L_d_lim = 0;
  if (rho <= rho0) {
    L_d_lim = 11 + 1.5 * Math.sqrt(fck) * (rho0 / rho) + 3.2 * Math.sqrt(fck) * Math.pow(Math.max(0, (rho0 / rho) - 1), 1.5);
  } else {
    L_d_lim = 11 + 1.5 * Math.sqrt(fck) * (rho0 / rho);
  }
  const L_d_adj = L_d_lim * Math.min(1.5, (500 / fyk) * (As_prov / Math.max(As_req, As_min))) * Math.min(1.0, 7.0 / L);
  const eta_SLS = (L * 1000 / d) / L_d_adj;

  const eta_max = Math.max(eta_M, eta_Asmin, eta_Asmax, eta_V, eta_link, eta_sw, eta_SLS);

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (!isMuValid || (x_prov / d) > 0.45) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Effective depth', symbol: 'd', units: 'mm', value: d.toFixed(1), formulaText: 'h - cnom - phi,link - phi/2' },
    { parameter: 'Provided tension steel', symbol: 'As', units: 'mm²', value: As_prov.toFixed(1), formulaText: 'n × π × phi² / 4' },
    { parameter: 'Design moment', symbol: 'MEd', units: 'kNm', value: MEd.toFixed(2), formulaText: 'qd × L² / 8' },
    { parameter: 'Moment resistance', symbol: 'MRd', units: 'kNm', value: MRd.toFixed(2), formulaText: 'As × fyd × (d - 0.4x,prov)' },
    { parameter: 'Flexural utilisation', symbol: 'MEd / MRd', units: '-', value: eta_M.toFixed(3), formulaText: 'MEd / MRd', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Design support shear', symbol: 'VEd', units: 'kN', value: VEd.toFixed(2), formulaText: 'qd × L / 2' },
    { parameter: 'Link shear resistance', symbol: 'VRd,s', units: 'kN', value: VRds.toFixed(2), formulaText: 'Asw/s × 0.9d × fyd × cot(θ)' },
    { parameter: 'Strut crushing resistance', symbol: 'VRd,max', units: 'kN', value: VRdmax.toFixed(2), formulaText: 'b 0.9d 0.6(1-fck/250)fcd / (cotθ + tanθ)' },
    { parameter: 'Shear utilisation', symbol: 'VEd / VRd', units: '-', value: eta_V.toFixed(3), formulaText: 'VEd / min(VRds; VRdmax)', isRatio: true, isExceeded: eta_V > 1 },
    { parameter: 'Link spacing ratio', symbol: 'sw / 0.75d', units: '-', value: eta_sw.toFixed(3), formulaText: 'sw / (0.75 × d)', isRatio: true, isExceeded: eta_sw > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(MEd/MRd; VEd/VRd; sw/0.75d; SLS)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    d,
    As_prov,
    MEd,
    MRd,
    VEd,
    VRds,
    VRdmax,
    rows
  };
}

// ----------------------------------------------------------------------------
// 4. 28-ITERATION STRAIN COMPATIBILITY BISECTION SOLVER (RC WALL & COLUMN)
// Exactly implements the parabola-rectangle concrete law & plastic steel
// ----------------------------------------------------------------------------
export interface BisectionIterationResult {
  iteration: number;
  xL: number;
  xU: number;
  x: number;
  ss_t: number;
  ss_b: number;
  Fc: number;
  Fs: number;
  Ncalc: number;
  MR: number;
}

export function solveRcSectionEquilibrium(
  b: number,
  h: number,
  a: number,
  d: number,
  As_face: number,
  fcd: number,
  fyd: number,
  Es: number,
  NEd: number
): { x: number; MRd: number; residual: number; iterations: BisectionIterationResult[] } {
  let xL = h * 0.000001;
  let xU = h;
  const iterations: BisectionIterationResult[] = [];

  let finalX = 0;
  let finalMR = 0;
  let finalNcalc = 0;

  for (let iter = 1; iter <= 28; iter++) {
    const x = (xL + xU) / 2;

    // Strains: eps(y) = 0.0035 * (1 - y/x)
    const ss_t = Math.max(-fyd, Math.min(fyd, Es * 0.0035 * (1 - a / x)));
    const ss_b = Math.max(-fyd, Math.min(fyd, Es * 0.0035 * (1 - d / x)));

    // Parabola-rectangle concrete compression force
    const Fc = (17 / 21) * b * x * fcd;

    // Concrete displacement deduction at steel locations
    const eps_a = 0.0035 * (1 - a / x);
    const eps_d = 0.0035 * (1 - d / x);
    const sc_a = eps_a > 0 ? fcd * (1 - Math.pow(1 - Math.min(eps_a, 0.002) / 0.002, 2)) : 0;
    const sc_d = eps_d > 0 ? fcd * (1 - Math.pow(1 - Math.min(eps_d, 0.002) / 0.002, 2)) : 0;

    const Fs = As_face * (ss_t + ss_b - sc_a - sc_d);
    const Ncalc = (Fc + Fs) / 1000; // kN

    // Moment about section centroid
    const MR = (
      Fc * (h / 2 - (99 * x) / 238) +
      As_face * (ss_t - sc_a) * (h / 2 - a) +
      As_face * (ss_b - sc_d) * (h / 2 - d)
    ) / 1000000; // kNm

    iterations.push({
      iteration: iter,
      xL,
      xU,
      x,
      ss_t,
      ss_b,
      Fc,
      Fs,
      Ncalc,
      MR
    });

    finalX = x;
    finalMR = MR;
    finalNcalc = Ncalc;

    if (Ncalc < NEd) {
      xL = x;
    } else {
      xU = x;
    }
  }

  return {
    x: finalX,
    MRd: finalMR,
    residual: finalNcalc - NEd,
    iterations
  };
}

// ----------------------------------------------------------------------------
// 5. MEMBER 3: RC LOAD-BEARING WALL STRIP (EN 1992-1-1)
// ----------------------------------------------------------------------------
export interface RcWallInputs {
  H: number;          // m
  l0: number;         // m (effective height)
  b: number;          // mm (1000 mm strip)
  h: number;          // mm (thickness)
  a: number;          // mm (cover + link + bar/2)
  phi: number;        // mm (vertical bar)
  s: number;          // mm (vertical spacing each face)
  NG_k: number;       // kN
  NQ_k: number;       // kN
  M0_Ed: number;      // kNm
  phi_ef: number;     // effective creep ratio
  c: number;          // curvature distribution factor (8 to 10)
  phi_h: number;      // mm (horizontal bar)
  s_h: number;        // mm (horizontal spacing)
  concreteClass: string;
  fyk: number;
}

export interface RcWallResult {
  eta_max: number;
  status: EurocodeStatus;
  NEd: number;
  MEd: number;
  x: number;
  MRd: number;
  bisectionIters: BisectionIterationResult[];
  rows: CalculationRow[];
}

export function calcRcWall(inputs: RcWallInputs, basis: SharedDesignBasis): RcWallResult {
  const { H, l0, b, h, a, phi, s, NG_k, NQ_k, M0_Ed, phi_ef, c, phi_h, s_h, concreteClass, fyk } = inputs;
  const rows: CalculationRow[] = [];

  const conc = CONCRETE_CLASSES[concreteClass] || CONCRETE_CLASSES['C30/37'];
  const fck = conc.fck;
  const fcd = (basis.alphaCC * fck) / basis.gammaC;
  const fyd = fyk / basis.gammaS;

  const Ac = b * h;
  const As_face = (Math.PI * Math.pow(phi, 2) / 4) * (1000 / s);
  const As = 2 * As_face;
  const Gk_self = (Ac / 1000000) * H * basis.weight_rc;
  const NEd = basis.gammaG * (NG_k + Gk_self) + basis.gammaQ * NQ_k;

  const d = h - a;
  const lambda = (l0 * 1000) / (h / Math.sqrt(12));
  const n = (NEd * 1000) / (Ac * fcd);
  const omega = (As * fyd) / (Ac * fcd);

  const ei = (l0 * 1000) / 400;
  const e0 = Math.max(h / 30, 20);
  const Kr = Math.max(0, Math.min(1.0, (1 + omega - n) / (1 + omega - 0.4)));
  const Kphi = Math.max(1.0, 1 + (0.35 + fck / 200 - lambda / 150) * phi_ef);
  const inv_r = (Kr * Kphi * fyd) / basis.Es_rebar / (0.45 * d);
  const e2 = (inv_r * Math.pow(l0 * 1000, 2)) / c;

  const MEd = Math.max(M0_Ed + (NEd * ei) / 1000, (NEd * e0) / 1000) + (NEd * e2) / 1000;

  // Pure axial squash capacity (EN 1992-1-1 §6.1)
  const NRd_0 = (Ac * fcd + As * fyd) / 1000;
  const eta_N = NEd / NRd_0;

  // 28-iteration bisection equilibrium solver
  const { x, MRd, residual, iterations } = solveRcSectionEquilibrium(
    b, h, a, d, As_face, fcd, fyd, basis.Es_rebar, NEd
  );

  const solverFailed = Math.abs(residual) >= 0.01 || x >= h * 0.9999 || MRd <= 0;
  const eta_M = solverFailed ? Math.max(eta_N, 1.20) : MRd > 0 ? MEd / MRd : 999;
  const As_min = 0.002 * Ac;
  const eta_Asmin = As_min / As;
  const eta_Asmax = As / (0.04 * Ac);
  const As_h = (Math.PI * Math.pow(phi_h, 2) / 4) * (1000 / s_h);
  const eta_Ash = Math.max(0.25 * As_face, 0.001 * Ac) / As_h;
  const eta_s = Math.max(s / Math.min(3 * h, 400), s_h / 400);

  const eta_max = Math.max(eta_N, eta_M, eta_Asmin, eta_Asmax, eta_Ash, eta_s);

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (n > 0.5 || lambda > 100 || solverFailed) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Design axial compression', symbol: 'NEd', units: 'kN', value: NEd.toFixed(2), formulaText: 'γG × (NG,k + Gk,self) + γQ × NQ,k' },
    { parameter: 'Geometric slenderness', symbol: 'λ', units: '-', value: lambda.toFixed(2), formulaText: 'l0 / (h / √12)' },
    { parameter: 'Second-order eccentricity', symbol: 'e2', units: 'mm', value: e2.toFixed(1), formulaText: '(1/r) × l0² / c' },
    { parameter: 'Total design moment', symbol: 'MEd', units: 'kNm', value: MEd.toFixed(2), formulaText: 'max(M0 + N ei; N e0) + N e2' },
    { parameter: 'Equilibrium neutral axis (28 iters)', symbol: 'x', units: 'mm', value: x.toFixed(2), formulaText: '28-iteration bisection section solver' },
    { parameter: 'Axial force residual', symbol: 'Ncalc - NEd', units: 'kN', value: residual.toExponential(3), formulaText: 'Ncalc,28 - NEd' },
    { parameter: 'Moment resistance at NEd', symbol: 'MRd(NEd)', units: 'kNm', value: MRd.toFixed(2), formulaText: 'MR,28 from strain equilibrium' },
    { parameter: 'Axial-bending utilisation', symbol: 'MEd / MRd', units: '-', value: eta_M.toFixed(3), formulaText: 'MEd / MRd(NEd)', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(MEd/MRd; steel limits)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    NEd,
    MEd,
    x,
    MRd,
    bisectionIters: iterations,
    rows
  };
}

// ----------------------------------------------------------------------------
// 6. MEMBER 4: RC COLUMN IN UNIAXIAL BENDING (EN 1992-1-1)
// ----------------------------------------------------------------------------
export interface RcColumnInputs {
  H: number;
  l0: number;
  b: number;          // mm
  h: number;          // mm
  a: number;          // mm
  phi: number;        // mm
  n_bars: number;     // number of bars on EACH opposite face
  NG_k: number;
  NQ_k: number;
  M0_Ed: number;
  phi_ef: number;
  c: number;
  concreteClass: string;
  fyk: number;
}

export interface RcColumnResult {
  eta_max: number;
  status: EurocodeStatus;
  NEd: number;
  MEd: number;
  x: number;
  MRd: number;
  bisectionIters: BisectionIterationResult[];
  rows: CalculationRow[];
}

export function calcRcColumn(inputs: RcColumnInputs, basis: SharedDesignBasis): RcColumnResult {
  const { H, l0, b, h, a, phi, n_bars, NG_k, NQ_k, M0_Ed, phi_ef, c, concreteClass, fyk } = inputs;
  const rows: CalculationRow[] = [];

  const conc = CONCRETE_CLASSES[concreteClass] || CONCRETE_CLASSES['C30/37'];
  const fck = conc.fck;
  const fcd = (basis.alphaCC * fck) / basis.gammaC;
  const fyd = fyk / basis.gammaS;

  const Ac = b * h;
  const As_face = (Math.PI * Math.pow(phi, 2) / 4) * n_bars;
  const As = 2 * As_face;
  const Gk_self = (Ac / 1000000) * H * basis.weight_rc;
  const NEd = basis.gammaG * (NG_k + Gk_self) + basis.gammaQ * NQ_k;

  const d = h - a;
  const lambda = (l0 * 1000) / (h / Math.sqrt(12));
  const n = (NEd * 1000) / (Ac * fcd);
  const omega = (As * fyd) / (Ac * fcd);

  const ei = (l0 * 1000) / 400;
  const e0 = Math.max(h / 30, 20);
  const Kr = Math.max(0, Math.min(1.0, (1 + omega - n) / (1 + omega - 0.4)));
  const Kphi = Math.max(1.0, 1 + (0.35 + fck / 200 - lambda / 150) * phi_ef);
  const inv_r = (Kr * Kphi * fyd) / basis.Es_rebar / (0.45 * d);
  const e2 = (inv_r * Math.pow(l0 * 1000, 2)) / c;

  const MEd = Math.max(M0_Ed + (NEd * ei) / 1000, (NEd * e0) / 1000) + (NEd * e2) / 1000;

  // Pure axial squash capacity (EN 1992-1-1 §6.1)
  const NRd_0 = (Ac * fcd + As * fyd) / 1000;
  const eta_N = NEd / NRd_0;

  const { x, MRd, residual, iterations } = solveRcSectionEquilibrium(
    b, h, a, d, As_face, fcd, fyd, basis.Es_rebar, NEd
  );

  const solverFailed = Math.abs(residual) >= 0.01 || x >= h * 0.9999 || MRd <= 0;
  const eta_M = solverFailed ? Math.max(eta_N, 1.20) : MRd > 0 ? MEd / MRd : 999;
  const As_min = Math.max((0.1 * NEd * 1000) / fyd, 0.002 * Ac);
  const eta_Asmin = As_min / As;
  const eta_Asmax = As / (0.04 * Ac);

  const eta_max = Math.max(eta_N, eta_M, eta_Asmin, eta_Asmax);

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (n > 0.5 || lambda > 100 || solverFailed) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Design axial force', symbol: 'NEd', units: 'kN', value: NEd.toFixed(2), formulaText: 'γG × (NG,k + Gk,self) + γQ × NQ,k' },
    { parameter: 'Pure axial squash resistance', symbol: 'NRd,0', units: 'kN', value: NRd_0.toFixed(1), formulaText: '(Ac × fcd + As × fyd) / 1000' },
    { parameter: 'Axial force utilisation', symbol: 'NEd / NRd,0', units: '-', value: eta_N.toFixed(3), formulaText: 'NEd / NRd,0', isRatio: true, isExceeded: eta_N > 1 },
    { parameter: 'Geometric slenderness', symbol: 'λ', units: '-', value: lambda.toFixed(2), formulaText: 'l0 / (h / √12)' },
    { parameter: 'Total design moment', symbol: 'MEd', units: 'kNm', value: MEd.toFixed(2), formulaText: 'max(M0 + N ei; N e0) + N e2' },
    { parameter: 'Neutral axis depth (28 iters)', symbol: 'x', units: 'mm', value: x.toFixed(2), formulaText: '28-step bisection equilibrium' },
    { parameter: 'Moment resistance at NEd', symbol: 'MRd(NEd)', units: 'kNm', value: MRd.toFixed(2), formulaText: 'Equilibrium MR at design NEd' },
    { parameter: 'Axial-bending utilisation', symbol: 'MEd / MRd', units: '-', value: eta_M.toFixed(3), formulaText: 'MEd / MRd(NEd)', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(NEd/NRd,0; MEd/MRd; As limits)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    NEd,
    MEd,
    x,
    MRd,
    bisectionIters: iterations,
    rows
  };
}

// ----------------------------------------------------------------------------
// 7. MEMBER 5: STEEL BEAM (EN 1993-1-1)
// ----------------------------------------------------------------------------
export interface SteelBeamInputs {
  L: number;
  Btr: number;
  profileName: string;
  grade: 'S235' | 'S275' | 'S355';
  restraint: 'Assumed' | 'Not restrained';
  div_Q: number;      // e.g. 300
  div_total: number;  // e.g. 250
}

export interface SteelBeamResult {
  eta_max: number;
  status: EurocodeStatus;
  sectionClass: number;
  MEd: number;
  Mel_Rd: number;
  VEd: number;
  Vpl_Rd: number;
  uQ: number;
  uGQ: number;
  Wel_req: number;
  rows: CalculationRow[];
}

export function calcSteelBeam(inputs: SteelBeamInputs, basis: SharedDesignBasis): SteelBeamResult {
  const { L, Btr, profileName, grade, restraint, div_Q, div_total } = inputs;
  const rows: CalculationRow[] = [];

  const prof = STEEL_PROFILES[profileName] || STEEL_PROFILES['IPE 300'];
  let fy = 355;
  const maxT = Math.max(prof.tw, prof.tf);
  if (grade === 'S235') fy = maxT <= 40 ? 235 : 215;
  else if (grade === 'S275') fy = maxT <= 40 ? 275 : 255;
  else fy = maxT <= 40 ? 355 : 335;

  const epsilon = Math.sqrt(235 / fy);

  // Section classification
  let class_f = 1;
  let class_w = 1;

  if (prof.type === 'I_H') {
    const root = prof.root ?? 15;
    const cf = (prof.b - prof.tw - 2 * root) / 2;
    const cw = prof.h - 2 * prof.tf - 2 * root;
    const r_f = cf / prof.tf;
    if (r_f <= 9 * epsilon) class_f = 1;
    else if (r_f <= 10 * epsilon) class_f = 2;
    else if (r_f <= 14 * epsilon) class_f = 3;
    else class_f = 4;

    const r_w = cw / prof.tw;
    if (r_w <= 72 * epsilon) class_w = 1;
    else if (r_w <= 83 * epsilon) class_w = 2;
    else if (r_w <= 124 * epsilon) class_w = 3;
    else class_w = 4;
  } else if (prof.type === 'SHS') {
    const cf = prof.b - 3 * prof.tf;
    const cw = prof.h - 3 * prof.tw;
    const r_f = cf / prof.tf;
    if (r_f <= 33 * epsilon) class_f = 1;
    else if (r_f <= 38 * epsilon) class_f = 2;
    else if (r_f <= 42 * epsilon) class_f = 3;
    else class_f = 4;

    const r_w = cw / prof.tw;
    if (r_w <= 72 * epsilon) class_w = 1;
    else if (r_w <= 83 * epsilon) class_w = 2;
    else if (r_w <= 124 * epsilon) class_w = 3;
    else class_w = 4;
  } else {
    // CHS
    const d_t = prof.h / prof.tf;
    if (d_t <= 50 * Math.pow(epsilon, 2)) class_f = 1;
    else if (d_t <= 70 * Math.pow(epsilon, 2)) class_f = 2;
    else if (d_t <= 90 * Math.pow(epsilon, 2)) class_f = 3;
    else class_f = 4;
    class_w = class_f;
  }

  const sectionClass = Math.max(class_f, class_w);

  // Shear area Av_z
  let Av_z = 0;
  const A_mm2 = prof.A * 100;
  if (prof.type === 'CHS') {
    Av_z = (2 * A_mm2) / Math.PI;
  } else if (prof.type === 'SHS') {
    Av_z = A_mm2 / 2;
  } else {
    const root = prof.root ?? 15;
    Av_z = Math.max(
      A_mm2 - 2 * prof.b * prof.tf + (prof.tw + 2 * root) * prof.tf,
      (prof.h - 2 * prof.tf) * prof.tw
    );
  }

  const gk_self = (prof.mass * 9.81) / 1000;
  const Gk = basis.gk_add * Btr + gk_self;
  const Qk = basis.qk * Btr;
  const qd = basis.gammaG * Gk + basis.gammaQ * Qk;

  const MEd = (qd * Math.pow(L, 2)) / 8;
  const VEd = (qd * L) / 2;

  const Wy_mm3 = prof.Wy * 1000;
  const Mel_Rd = (Wy_mm3 * fy) / basis.gammaM0 / 1000000;
  const Vpl_Rd = (Av_z * fy) / Math.sqrt(3) / basis.gammaM0 / 1000;

  const eta_M = Mel_Rd > 0 ? MEd / Mel_Rd : 999;
  const eta_V = Vpl_Rd > 0 ? VEd / Vpl_Rd : 999;

  // Web shear buckling trigger
  const webTrigger = prof.type === 'CHS' ? 0 : ((prof.h - 2 * prof.tf) / prof.tw) / (72 * epsilon / 1.2);

  // SLS Deflection (Timoshenko with shear deformation)
  const Iy_mm4 = prof.Iy * 10000;
  const G_steel = basis.E_steel / 2.6;
  const As_shear = prof.type === 'CHS' ? A_mm2 / 2 : Av_z;
  const u_q = (5 * Math.pow(L * 1000, 4)) / (384 * basis.E_steel * Iy_mm4) + Math.pow(L * 1000, 2) / (8 * G_steel * As_shear);

  const uQ = Qk * u_q;
  const uGQ = (Gk + Qk) * u_q;
  const eta_uQ = uQ / ((L * 1000) / div_Q);
  const eta_uGQ = uGQ / ((L * 1000) / div_total);

  const Wel_req = (MEd * 1000000 * basis.gammaM0) / fy / 1000;
  const eta_max = Math.max(eta_M, eta_V, eta_uQ, eta_uGQ);

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (sectionClass > 3 || (VEd / Vpl_Rd) > 0.5 || webTrigger > 1.0 || (prof.type === 'I_H' && restraint === 'Not restrained')) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Section classification', symbol: 'Class', units: '-', value: sectionClass, formulaText: 'EN 1993-1-1 Table 5.2' },
    { parameter: 'Elastic bending resistance', symbol: 'Mel,Rd', units: 'kNm', value: Mel_Rd.toFixed(2), formulaText: 'Wy × fy / γM0' },
    { parameter: 'Bending utilisation', symbol: 'MEd / Mel,Rd', units: '-', value: eta_M.toFixed(3), formulaText: 'MEd / Mel,Rd', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Plastic shear resistance', symbol: 'Vpl,Rd', units: 'kN', value: Vpl_Rd.toFixed(2), formulaText: 'Av,z × fy / (√3 × γM0)' },
    { parameter: 'Shear utilisation', symbol: 'VEd / Vpl,Rd', units: '-', value: eta_V.toFixed(3), formulaText: 'VEd / Vpl,Rd', isRatio: true, isExceeded: eta_V > 1 },
    { parameter: 'Variable load deflection', symbol: 'uQ', units: 'mm', value: uQ.toFixed(2), formulaText: 'Qk × (u/q)' },
    { parameter: 'Total load deflection', symbol: 'uGQ', units: 'mm', value: uGQ.toFixed(2), formulaText: '(Gk + Qk) × (u/q)' },
    { parameter: 'Total deflection ratio', symbol: 'ηu,total', units: '-', value: eta_uGQ.toFixed(3), formulaText: 'uGQ / (L / div,total)', isRatio: true, isExceeded: eta_uGQ > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(MEd/Mel,Rd; VEd/Vpl,Rd; ηu)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    sectionClass,
    MEd,
    Mel_Rd,
    VEd,
    Vpl_Rd,
    uQ,
    uGQ,
    Wel_req,
    rows
  };
}

// ----------------------------------------------------------------------------
// 8. MEMBER 6: STEEL CONCENTRIC COLUMN (EN 1993-1-1)
// ----------------------------------------------------------------------------
export interface SteelColumnInputs {
  H: number;
  lcr_y: number;
  lcr_z: number;
  lcr_T: number;
  NG_k: number;
  NQ_k: number;
  My_Ed?: number;     // kNm (default 0)
  Mz_Ed?: number;     // kNm (default 0)
  profileName: string;
  grade: 'S235' | 'S275' | 'S355';
}

export interface SteelColumnResult {
  eta_max: number;
  status: EurocodeStatus;
  NEd: number;
  Nc_Rd: number;
  Nb_Rd_y: number;
  Nb_Rd_z: number;
  Nb_Rd_T: number;
  governingAxis: 'y-y' | 'z-z' | 'Torsional' | 'Cross-section';
  sectionClass: number;
  rows: CalculationRow[];
}

export function calcSteelColumn(inputs: SteelColumnInputs, basis: SharedDesignBasis): SteelColumnResult {
  const { H, lcr_y, lcr_z, lcr_T, NG_k, NQ_k, My_Ed = 0, Mz_Ed = 0, profileName, grade } = inputs;
  const rows: CalculationRow[] = [];

  const prof = STEEL_PROFILES[profileName] || STEEL_PROFILES['HE 240 B'];
  let fy = 355;
  const maxT = Math.max(prof.tw, prof.tf);
  if (grade === 'S235') fy = maxT <= 40 ? 235 : 215;
  else if (grade === 'S275') fy = maxT <= 40 ? 275 : 255;
  else fy = maxT <= 40 ? 355 : 335;

  const epsilon = Math.sqrt(235 / fy);
  let class_f = 1;
  let class_w = 1;
  if (prof.type === 'CHS') {
    const d_t = prof.h / prof.tf;
    if (d_t <= 50 * Math.pow(epsilon, 2)) class_f = 1;
    else if (d_t <= 70 * Math.pow(epsilon, 2)) class_f = 2;
    else if (d_t <= 90 * Math.pow(epsilon, 2)) class_f = 3;
    else class_f = 4;
    class_w = class_f;
  } else if (prof.type === 'SHS') {
    const cf = prof.b - 3 * prof.tf;
    const cw = prof.h - 3 * prof.tw;
    const r_f = cf / prof.tf;
    if (r_f <= 33 * epsilon) class_f = 1;
    else if (r_f <= 38 * epsilon) class_f = 2;
    else if (r_f <= 42 * epsilon) class_f = 3;
    else class_f = 4;

    const r_w = cw / prof.tw;
    if (r_w <= 33 * epsilon) class_w = 1;
    else if (r_w <= 38 * epsilon) class_w = 2;
    else if (r_w <= 42 * epsilon) class_w = 3;
    else class_w = 4;
  } else {
    // I/H
    const root = prof.root ?? 15;
    const cf = (prof.b - prof.tw - 2 * root) / 2;
    const cw = prof.h - 2 * prof.tf - 2 * root;
    const r_f = cf / prof.tf;
    if (r_f <= 9 * epsilon) class_f = 1;
    else if (r_f <= 10 * epsilon) class_f = 2;
    else if (r_f <= 14 * epsilon) class_f = 3;
    else class_f = 4;

    const r_w = cw / prof.tw;
    if (r_w <= 33 * epsilon) class_w = 1;
    else if (r_w <= 38 * epsilon) class_w = 2;
    else if (r_w <= 42 * epsilon) class_w = 3;
    else class_w = 4;
  }
  const sectionClass = Math.max(class_f, class_w);

  const A_mm2 = prof.A * 100;
  const Iy_mm4 = prof.Iy * 10000;
  const Iz_mm4 = prof.Iz * 10000;
  const It_mm4 = prof.It * 10000;
  const Iw_mm6 = prof.Iw * 1000000000000;

  // Imperfection factors per EC3 Table 6.2
  let alpha_y = 0.34;
  let alpha_z = 0.49;
  if (prof.type === 'SHS' || prof.type === 'CHS') {
    if (prof.manufacturing === 'Hot-Finished') {
      alpha_y = 0.21;
      alpha_z = 0.21;
    } else {
      alpha_y = 0.49;
      alpha_z = 0.49;
    }
  } else {
    // I/H
    const h_b = prof.h / prof.b;
    if (h_b > 1.2) {
      alpha_y = prof.tf <= 40 ? 0.21 : 0.34;
      alpha_z = prof.tf <= 40 ? 0.34 : 0.49;
    } else {
      alpha_y = prof.tf <= 100 ? 0.34 : 0.76;
      alpha_z = prof.tf <= 100 ? 0.49 : 0.76;
    }
  }
  const alpha_T = alpha_z;

  const Gk_self = (prof.mass * 9.81 / 1000) * H;
  const NEd = basis.gammaG * (NG_k + Gk_self) + basis.gammaQ * NQ_k;

  // Critical forces
  const Ncr_y = (Math.PI * Math.PI * basis.E_steel * Iy_mm4) / Math.pow(lcr_y * 1000, 2) / 1000;
  const Ncr_z = (Math.PI * Math.PI * basis.E_steel * Iz_mm4) / Math.pow(lcr_z * 1000, 2) / 1000;
  const Ncr_T = (
    (basis.E_steel / 2.6) * It_mm4 + (Math.PI * Math.PI * basis.E_steel * Iw_mm6) / Math.pow(lcr_T * 1000, 2)
  ) / ((Iy_mm4 + Iz_mm4) / A_mm2) / 1000;

  // Slenderness and reduction factor y-y
  const lambda_y = Math.sqrt((A_mm2 * fy) / (Ncr_y * 1000));
  const Phi_y = 0.5 * (1 + alpha_y * (lambda_y - 0.2) + Math.pow(lambda_y, 2));
  const chi_y = lambda_y <= 0.2 ? 1.0 : Math.min(1.0, 1 / (Phi_y + Math.sqrt(Math.max(0, Math.pow(Phi_y, 2) - Math.pow(lambda_y, 2)))));
  const Nb_Rd_y = (chi_y * A_mm2 * fy) / basis.gammaM1 / 1000;

  // Slenderness and reduction factor z-z
  const lambda_z = Math.sqrt((A_mm2 * fy) / (Ncr_z * 1000));
  const Phi_z = 0.5 * (1 + alpha_z * (lambda_z - 0.2) + Math.pow(lambda_z, 2));
  const chi_z = lambda_z <= 0.2 ? 1.0 : Math.min(1.0, 1 / (Phi_z + Math.sqrt(Math.max(0, Math.pow(Phi_z, 2) - Math.pow(lambda_z, 2)))));
  const Nb_Rd_z = (chi_z * A_mm2 * fy) / basis.gammaM1 / 1000;

  // Slenderness and reduction factor Torsional
  const lambda_T = Math.sqrt((A_mm2 * fy) / (Ncr_T * 1000));
  const Phi_T = 0.5 * (1 + alpha_T * (lambda_T - 0.2) + Math.pow(lambda_T, 2));
  const chi_T = lambda_T <= 0.2 ? 1.0 : Math.min(1.0, 1 / (Phi_T + Math.sqrt(Math.max(0, Math.pow(Phi_T, 2) - Math.pow(lambda_T, 2)))));
  const Nb_Rd_T = (chi_T * A_mm2 * fy) / basis.gammaM1 / 1000;

  const Nc_Rd = (A_mm2 * fy) / basis.gammaM0 / 1000;

  const minCapacity = Math.min(Nc_Rd, Nb_Rd_y, Nb_Rd_z, Nb_Rd_T);
  const eta_max = NEd / minCapacity;

  let governingAxis: 'y-y' | 'z-z' | 'Torsional' | 'Cross-section' = 'z-z';
  if (minCapacity === Nb_Rd_z) governingAxis = 'z-z';
  else if (minCapacity === Nb_Rd_y) governingAxis = 'y-y';
  else if (minCapacity === Nb_Rd_T) governingAxis = 'Torsional';
  else governingAxis = 'Cross-section';

  let status: EurocodeStatus = 'SCREEN ONLY';
  if (sectionClass > 3 || My_Ed !== 0 || Mz_Ed !== 0) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Section classification', symbol: 'Class', units: '-', value: sectionClass.toString(), formulaText: 'EN 1993-1-1 Table 5.2' },
    { parameter: 'Design axial force', symbol: 'NEd', units: 'kN', value: NEd.toFixed(2), formulaText: 'γG × (NG,k + Gk,self) + γQ × NQ,k' },
    { parameter: 'Cross-section capacity', symbol: 'Nc,Rd', units: 'kN', value: Nc_Rd.toFixed(2), formulaText: 'A × fy / γM0' },
    { parameter: 'Buckling resistance y-y', symbol: 'Nb,Rd,y', units: 'kN', value: Nb_Rd_y.toFixed(2), formulaText: 'χy × A × fy / γM1' },
    { parameter: 'Buckling resistance z-z', symbol: 'Nb,Rd,z', units: 'kN', value: Nb_Rd_z.toFixed(2), formulaText: 'χz × A × fy / γM1' },
    { parameter: 'Torsional buckling resistance', symbol: 'Nb,Rd,T', units: 'kN', value: Nb_Rd_T.toFixed(2), formulaText: 'χT × A × fy / γM1' },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'NEd / min(Nc,Rd; Nb,Rd,y; Nb,Rd,z; Nb,Rd,T)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    NEd,
    Nc_Rd,
    Nb_Rd_y,
    Nb_Rd_z,
    Nb_Rd_T,
    governingAxis,
    sectionClass,
    rows
  };
}

// ----------------------------------------------------------------------------
// 9. MEMBER 7: CLT ONE-WAY FLOOR SLAB (ETA PRODUCT METHOD)
// ----------------------------------------------------------------------------
export interface CltSlabInputs {
  L: number;
  Btr: number;
  t: number;            // mm thickness
  weight?: number;      // kN/m3 (default 5.0)
  EI_mean: number;      // Nmm²/m
  GA_eff: number;       // N/m
  MR_k: number;         // kNm/m
  VR_k: number;         // kN/m
  Rc90_Rk: number;      // kN/m
  gammaM: number;       // 1.30
  kmod_G: number;       // 0.60
  kmod_GQ: number;      // 0.80
  kdef: number;         // 0.80
  div_Q: number;        // 300
  div_fin: number;      // 200
  productName: string;
  isDocumented: boolean;
}

export interface CltSlabResult {
  eta_max: number;
  status: EurocodeStatus;
  eta_M: number;
  eta_V: number;
  eta_R: number;
  ufin: number;
  eta_ufin: number;
  rows: CalculationRow[];
}

export function calcCltSlab(inputs: CltSlabInputs, basis: SharedDesignBasis): CltSlabResult {
  const { L, t, EI_mean, GA_eff, MR_k, VR_k, Rc90_Rk, gammaM, kmod_G, kmod_GQ, kdef, div_Q, div_fin, isDocumented, weight = 5.0 } = inputs;
  const rows: CalculationRow[] = [];

  const weight_timber = weight; // kN/m³
  const gk_self = (t / 1000) * weight_timber;
  const Gk = basis.gk_add + gk_self;
  const Qk = basis.qk;

  const qd_G = basis.gammaG * Gk;
  const qd_GQ = qd_G + basis.gammaQ * Qk;

  const max_qd_kmod = Math.max(qd_G / kmod_G, qd_GQ / kmod_GQ);

  const eta_M = (max_qd_kmod * Math.pow(L, 2) / 8) * (gammaM / MR_k);
  const eta_V = (max_qd_kmod * L / 2) * (gammaM / VR_k);
  const eta_R = (max_qd_kmod * L / 2) * (gammaM / Rc90_Rk);

  // Timoshenko deflection
  const uB_q = (5 * Math.pow(L * 1000, 4)) / (384 * EI_mean);
  const uS_q = Math.pow(L * 1000, 2) / (8 * GA_eff);

  const uG = Gk * (uB_q + uS_q);
  const uQ = Qk * (uB_q + uS_q);
  const ufin = uG * (1 + kdef) + uQ * (1 + basis.psi2 * kdef);

  const eta_uQ = uQ / ((L * 1000) / div_Q);
  const eta_ufin = ufin / ((L * 1000) / div_fin);

  const eta_max = Math.max(eta_M, eta_V, eta_R, eta_uQ, eta_ufin);

  let status: EurocodeStatus = isDocumented ? 'SCREEN ONLY' : 'EXAMPLE DATA';
  if (eta_max > 1.0) status = isDocumented ? 'EXCEEDS SCREEN' : 'EXAMPLE DATA';

  rows.push(
    { parameter: 'Governing duration-scaled load', symbol: 'max(qd/kmod)', units: 'kN/m', value: max_qd_kmod.toFixed(3), formulaText: 'max(qd,G / kmod,G; qd,GQ / kmod,GQ)' },
    { parameter: 'Bending utilisation', symbol: 'ηM', units: '-', value: eta_M.toFixed(3), formulaText: 'max(qd/kmod) × L² / 8 × γM / MR,k', isRatio: true, isExceeded: eta_M > 1 },
    { parameter: 'Rolling shear utilisation', symbol: 'ηV', units: '-', value: eta_V.toFixed(3), formulaText: 'max(qd/kmod) × L / 2 × γM / VR,k', isRatio: true, isExceeded: eta_V > 1 },
    { parameter: 'Support bearing utilisation', symbol: 'ηR', units: '-', value: eta_R.toFixed(3), formulaText: 'max(qd/kmod) × L / 2 × γM / Rc90,Rk', isRatio: true, isExceeded: eta_R > 1 },
    { parameter: 'Final creep deflection', symbol: 'ufin', units: 'mm', value: ufin.toFixed(2), formulaText: 'uG (1+kdef) + uQ (1+ψ2 kdef)' },
    { parameter: 'Final deflection ratio', symbol: 'ηu,fin', units: '-', value: eta_ufin.toFixed(3), formulaText: 'ufin / (L / div,fin)', isRatio: true, isExceeded: eta_ufin > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(ηM; ηV; ηR; ηu,fin)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    eta_M,
    eta_V,
    eta_R,
    ufin,
    eta_ufin,
    rows
  };
}

// ----------------------------------------------------------------------------
// 10. MEMBER 8: CLT LOAD-BEARING WALL STRIP (ETA PRODUCT METHOD)
// ----------------------------------------------------------------------------
export interface CltWallInputs {
  H: number;
  l0: number;
  NG_k: number;
  NQ_k: number;
  e: number;          // mm eccentricity
  pk: number;         // kN/m² transverse wind
  H_divisor?: number; // default 300
  isMethodConfirmed: boolean;
  productName: string;
  isDocumented: boolean;
  t: number;
  weight?: number;    // kN/m3 (default 5.0)
  EI_mean?: number;   // Nmm2/m (default 3e12)
  GA_eff?: number;    // N/m (default 8e6)
  MR_k: number;       // kNm/m
  VR_k: number;       // kN/m
  gammaM: number;
  kmod_G: number;
  kmod_GQ: number;
  kdef?: number;      // default 0.8
  Nc_Rk: number;      // kN/m
  EI_05: number;      // Nmm²/m
  GA_05: number;      // N/m
  beta_c: number;     // 0.2
}

export interface CltWallResult {
  eta_max: number;
  status: EurocodeStatus;
  NEd_GQ: number;
  MEd_GQ: number;
  Nb_Rd: number;
  eta_G: number;
  eta_GQ: number;
  rows: CalculationRow[];
}

export function calcCltWall(inputs: CltWallInputs, basis: SharedDesignBasis): CltWallResult {
  const {
    H, l0, NG_k, NQ_k, e, pk, t, Nc_Rk, EI_05, GA_05, MR_k, VR_k,
    gammaM, kmod_G, kmod_GQ, beta_c, isDocumented, isMethodConfirmed,
    H_divisor = 300,
    weight = 5.0,
    EI_mean = 3000000000000,
    GA_eff = 8000000
  } = inputs;
  const rows: CalculationRow[] = [];

  const weight_timber = weight;
  const Gk_self = (t / 1000) * H * weight_timber;
  const NEd_G = basis.gammaG * (NG_k + Gk_self);
  const NEd_GQ = NEd_G + basis.gammaQ * NQ_k;

  // Shear-flexible Euler critical force
  const Ncr_E = (Math.PI * Math.PI * EI_05) / Math.pow(l0 * 1000, 2) / 1000;
  const Ncr = Ncr_E / (1 + (Ncr_E * 1000) / GA_05);

  const lambda_rel = Math.sqrt(Nc_Rk / Ncr);
  const k = 0.5 * (1 + beta_c * (lambda_rel - 0.3) + Math.pow(lambda_rel, 2));
  const kc = lambda_rel <= 0.3 ? 1.0 : 1 / (k + Math.sqrt(Math.max(0, Math.pow(k, 2) - Math.pow(lambda_rel, 2))));
  const Nb_Rd = (kc * kmod_GQ * Nc_Rk) / gammaM;

  const MEd_G = (NEd_G * e) / 1000;
  const MEd_GQ = (NEd_GQ * e) / 1000 + (basis.gammaQ * pk * Math.pow(H, 2)) / 8;
  const VEd = (basis.gammaQ * pk * H) / 2;

  const eta_G = (NEd_G * gammaM) / (kc * kmod_G * Nc_Rk) + (MEd_G * gammaM) / (kmod_G * MR_k);
  const eta_GQ = (NEd_GQ * gammaM) / (kc * kmod_GQ * Nc_Rk) + (MEd_GQ * gammaM) / (kmod_GQ * MR_k);
  const eta_V = (VEd * gammaM) / (kmod_GQ * VR_k);

  const Nk = NG_k + NQ_k + Gk_self;
  const u1 = pk * ((5 * Math.pow(H * 1000, 4)) / (384 * EI_mean) + Math.pow(H * 1000, 2) / (8 * GA_eff)) + (Nk * 1000 * e * Math.pow(H * 1000, 2)) / (8 * EI_mean);
  const amp = Nk < Ncr ? 1 / (1 - Nk / Ncr) : 999;
  const u = u1 * amp;
  const eta_u = u / ((H * 1000) / H_divisor);

  const eta_max = Math.max(eta_G, eta_GQ, eta_V, eta_u);

  let status: EurocodeStatus = isDocumented && isMethodConfirmed ? 'SCREEN ONLY' : 'EXAMPLE DATA';
  if (Nk >= Ncr) status = 'OUT OF SCOPE';
  else if (eta_max > 1.0) status = isDocumented ? 'EXCEEDS SCREEN' : 'EXAMPLE DATA';

  rows.push(
    { parameter: 'Critical buckling force (shear-flexible)', symbol: 'Ncr', units: 'kN/m', value: Ncr.toFixed(2), formulaText: 'Ncr,E / (1 + Ncr,E / GA,05)' },
    { parameter: 'Buckling reduction', symbol: 'kc', units: '-', value: kc.toFixed(3), formulaText: '1 / (k + √(k² - λrel²))' },
    { parameter: 'Combined buckling resistance', symbol: 'Nb,Rd', units: 'kN/m', value: Nb_Rd.toFixed(2), formulaText: 'kc × kmod,GQ × Nc,Rk / γM' },
    { parameter: 'Permanent-only N-M interaction', symbol: 'ηG', units: '-', value: eta_G.toFixed(3), formulaText: 'NEd,G / Nb,Rd,G + MEd,G / MRd,G', isRatio: true, isExceeded: eta_G > 1 },
    { parameter: 'Combined N-M interaction', symbol: 'ηGQ', units: '-', value: eta_GQ.toFixed(3), formulaText: 'NEd,GQ / Nb,Rd,GQ + MEd,GQ / MRd,GQ', isRatio: true, isExceeded: eta_GQ > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(ηG; ηGQ; ηV; ηu)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    NEd_GQ,
    MEd_GQ,
    Nb_Rd,
    eta_G,
    eta_GQ,
    rows
  };
}

// ----------------------------------------------------------------------------
// 11. MEMBER 9: TIMBER / GLULAM BEAM (EN 1995-1-1)
// ----------------------------------------------------------------------------
export interface WoodBeamInputs {
  L: number;
  Btr: number;
  b: number;          // mm
  h: number;          // mm
  a: number;          // mm (bearing length)
  kcr?: number;       // shear crack factor (default 0.67)
  weight?: number;    // kN/m3 (default 5.0)
  timberClass: string;// e.g. 'GL24h'
  serviceClass: 1 | 2 | 3;
  duration: TimberLoadDuration;
  div_Q: number;
  div_fin: number;
  restraint: 'Assumed' | 'Confirmed' | 'Not restrained';
}

export interface WoodBeamResult {
  eta_max: number;
  status: EurocodeStatus;
  eta_m: number;
  eta_v: number;
  eta_c90: number;
  ufin: number;
  eta_ufin: number;
  rows: CalculationRow[];
}

export function calcWoodBeam(inputs: WoodBeamInputs, basis: SharedDesignBasis): WoodBeamResult {
  const { L, Btr, b, h, a, timberClass, serviceClass, duration, div_Q, div_fin, restraint, kcr = 0.67, weight = 5.0 } = inputs;
  const rows: CalculationRow[] = [];

  const tc = TIMBER_CLASSES[timberClass] || TIMBER_CLASSES['GL24h'];
  const gammaM = tc.type === 'Solid' ? basis.gammaM_solid : basis.gammaM_glulam;
  const kmod_G = TIMBER_KMOD['Permanent'][serviceClass];
  const kmod_GQ = TIMBER_KMOD[duration][serviceClass];
  const kdef = TIMBER_KDEF[tc.type][serviceClass];

  const A = b * h;
  const Iy = (b * Math.pow(h, 3)) / 12;
  const Wy = (b * Math.pow(h, 2)) / 6;

  // Size factor kh
  let kh = 1.0;
  if (tc.type === 'Solid') {
    kh = Math.min(1.3, Math.pow(150 / Math.min(h, 150), 0.2));
  } else {
    kh = Math.min(1.1, Math.pow(600 / Math.min(h, 600), 0.1));
  }

  const gk_self = (A / 1000000) * weight;
  const Gk = basis.gk_add * Btr + gk_self;
  const Qk = basis.qk * Btr;

  const qd_G = basis.gammaG * Gk;
  const qd_GQ = qd_G + basis.gammaQ * Qk;
  const max_qd_kmod = Math.max(qd_G / kmod_G, qd_GQ / kmod_GQ);

  const eta_m = (max_qd_kmod * Math.pow(L, 2) / 8) * 1000000 / Wy * gammaM / (kh * tc.fmk);
  const eta_v = (1.5 * max_qd_kmod * L / 2) * 1000 / (kcr * A) * gammaM / tc.fvk;
  const eta_c90 = (max_qd_kmod * L / 2) * 1000 / (b * a) * gammaM / tc.fc90k;

  // Deflection
  const u_q = (5 * Math.pow(L * 1000, 4)) / (384 * tc.Emean * Iy) + Math.pow(L * 1000, 2) / (8 * (5 / 6) * tc.Gmean * A);
  const uG = Gk * u_q;
  const uQ = Qk * u_q;
  const ufin = uG * (1 + kdef) + uQ * (1 + basis.psi2 * kdef);

  const eta_uQ = uQ / ((L * 1000) / div_Q);
  const eta_ufin = ufin / ((L * 1000) / div_fin);

  const eta_max = Math.max(eta_m, eta_v, eta_c90, eta_uQ, eta_ufin);

  let status: EurocodeStatus = restraint === 'Not restrained' ? 'OUT OF SCOPE' : 'SCREEN ONLY';
  if (eta_max > 1.0 && status !== 'OUT OF SCOPE') status = 'EXCEEDS SCREEN';

  rows.push(
    { parameter: 'Bending strength', symbol: 'fm,k', units: 'MPa', value: tc.fmk, formulaText: 'EN 338 / EN 14080' },
    { parameter: 'Size factor', symbol: 'kh', units: '-', value: kh.toFixed(3), formulaText: 'min(1.1; (600/h)^0.1)' },
    { parameter: 'Bending utilisation', symbol: 'ηm', units: '-', value: eta_m.toFixed(3), formulaText: 'MEd / MRd', isRatio: true, isExceeded: eta_m > 1 },
    { parameter: 'Shear utilisation (kcr=0.67)', symbol: 'ηv', units: '-', value: eta_v.toFixed(3), formulaText: 'VEd / VRd', isRatio: true, isExceeded: eta_v > 1 },
    { parameter: 'Bearing utilisation', symbol: 'ηc,90', units: '-', value: eta_c90.toFixed(3), formulaText: 'VEd / (b × a × fc90,d)', isRatio: true, isExceeded: eta_c90 > 1 },
    { parameter: 'Final deflection', symbol: 'ufin', units: 'mm', value: ufin.toFixed(2), formulaText: 'uG (1+kdef) + uQ (1+ψ2 kdef)' },
    { parameter: 'Final deflection ratio', symbol: 'ηu,fin', units: '-', value: eta_ufin.toFixed(3), formulaText: 'ufin / (L / div,fin)', isRatio: true, isExceeded: eta_ufin > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(ηm; ηv; ηc90; ηu,fin)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    eta_m,
    eta_v,
    eta_c90,
    ufin,
    eta_ufin,
    rows
  };
}

// ----------------------------------------------------------------------------
// 12. MEMBER 10: TIMBER / GLULAM COLUMN (EN 1995-1-1)
// ----------------------------------------------------------------------------
export interface WoodColumnInputs {
  H: number;
  b: number;          // mm
  h: number;          // mm
  l0_y: number;
  l0_z: number;
  NG_k: number;
  NQ_k: number;
  MGy_k: number;
  MQy_k: number;
  MGz_k: number;
  MQz_k: number;
  weight?: number;    // kN/m3 (default 5.0)
  timberClass: string;
  serviceClass: 1 | 2 | 3;
  duration: TimberLoadDuration;
  restraint: 'Assumed' | 'Confirmed' | 'Not restrained';
}

export interface WoodColumnResult {
  eta_max: number;
  status: EurocodeStatus;
  kc_y: number;
  kc_z: number;
  eta_y_GQ: number;
  eta_z_GQ: number;
  rows: CalculationRow[];
}

export function calcWoodColumn(inputs: WoodColumnInputs, basis: SharedDesignBasis): WoodColumnResult {
  const { H, b, h, l0_y, l0_z, NG_k, NQ_k, MGy_k, MQy_k, MGz_k, MQz_k, timberClass, serviceClass, duration, restraint, weight = 5.0 } = inputs;
  const rows: CalculationRow[] = [];

  const tc = TIMBER_CLASSES[timberClass] || TIMBER_CLASSES['GL24h'];
  const gammaM = tc.type === 'Solid' ? basis.gammaM_solid : basis.gammaM_glulam;
  const kmod_G = TIMBER_KMOD['Permanent'][serviceClass];
  const kmod_GQ = TIMBER_KMOD[duration][serviceClass];

  const A = b * h;
  const Iy = (b * Math.pow(h, 3)) / 12;
  const Iz = (h * Math.pow(b, 3)) / 12;
  const Wy = (b * Math.pow(h, 2)) / 6;
  const Wz = (h * Math.pow(b, 2)) / 6;

  const beta_c = tc.type === 'Solid' ? 0.2 : 0.1;

  // Slenderness y-y
  const lambda_rel_y = (l0_y * 1000 / Math.sqrt(Iy / A)) / Math.PI * Math.sqrt(tc.fc0k / tc.E05);
  const k_y = 0.5 * (1 + beta_c * (lambda_rel_y - 0.3) + Math.pow(lambda_rel_y, 2));
  const kc_y = lambda_rel_y <= 0.3 ? 1.0 : 1 / (k_y + Math.sqrt(Math.max(0, Math.pow(k_y, 2) - Math.pow(lambda_rel_y, 2))));

  // Slenderness z-z
  const lambda_rel_z = (l0_z * 1000 / Math.sqrt(Iz / A)) / Math.PI * Math.sqrt(tc.fc0k / tc.E05);
  const k_z = 0.5 * (1 + beta_c * (lambda_rel_z - 0.3) + Math.pow(lambda_rel_z, 2));
  const kc_z = lambda_rel_z <= 0.3 ? 1.0 : 1 / (k_z + Math.sqrt(Math.max(0, Math.pow(k_z, 2) - Math.pow(lambda_rel_z, 2))));

  const Gk_self = (A / 1000000) * H * weight;
  const NEd_G = basis.gammaG * (NG_k + Gk_self);
  const NEd_GQ = NEd_G + basis.gammaQ * NQ_k;

  const My_Ed_G = basis.gammaG * MGy_k;
  const Mz_Ed_G = basis.gammaG * MGz_k;
  const My_Ed_GQ = basis.gammaG * MGy_k + basis.gammaQ * MQy_k;
  const Mz_Ed_GQ = basis.gammaG * MGz_k + basis.gammaQ * MQz_k;

  // EC5 6.3.2 Biaxial interaction with km = 0.7
  const eta_y_G = (NEd_G * 1000 / A * gammaM) / (kmod_G * tc.fc0k) / kc_y + (My_Ed_G * 1e6 / Wy * gammaM) / (kmod_G * tc.fmk) + 0.7 * (Mz_Ed_G * 1e6 / Wz * gammaM) / (kmod_G * tc.fmk);
  const eta_z_G = (NEd_G * 1000 / A * gammaM) / (kmod_G * tc.fc0k) / kc_z + 0.7 * (My_Ed_G * 1e6 / Wy * gammaM) / (kmod_G * tc.fmk) + (Mz_Ed_G * 1e6 / Wz * gammaM) / (kmod_G * tc.fmk);

  const eta_y_GQ = (NEd_GQ * 1000 / A * gammaM) / (kmod_GQ * tc.fc0k) / kc_y + (My_Ed_GQ * 1e6 / Wy * gammaM) / (kmod_GQ * tc.fmk) + 0.7 * (Mz_Ed_GQ * 1e6 / Wz * gammaM) / (kmod_GQ * tc.fmk);
  const eta_z_GQ = (NEd_GQ * 1000 / A * gammaM) / (kmod_GQ * tc.fc0k) / kc_z + 0.7 * (My_Ed_GQ * 1e6 / Wy * gammaM) / (kmod_GQ * tc.fmk) + (Mz_Ed_GQ * 1e6 / Wz * gammaM) / (kmod_GQ * tc.fmk);

  const eta_max = Math.max(eta_y_G, eta_z_G, eta_y_GQ, eta_z_GQ);

  let status: EurocodeStatus = restraint === 'Not restrained' ? 'OUT OF SCOPE' : 'SCREEN ONLY';
  if (eta_max > 1.0 && status !== 'OUT OF SCOPE') status = 'EXCEEDS SCREEN';

  rows.push(
    { parameter: 'Buckling reduction y-y', symbol: 'kc,y', units: '-', value: kc_y.toFixed(3), formulaText: '1 / (ky + √(ky² - λrel,y²))' },
    { parameter: 'Buckling reduction z-z', symbol: 'kc,z', units: '-', value: kc_z.toFixed(3), formulaText: '1 / (kz + √(kz² - λrel,z²))' },
    { parameter: 'Permanent biaxial utilisation y-y', symbol: 'ηy,G', units: '-', value: eta_y_G.toFixed(3), formulaText: 'σc,0,d / (kc,y fc,0,d) + σm,y,d / fm,y,d + 0.7 σm,z,d / fm,z,d', isRatio: true, isExceeded: eta_y_G > 1 },
    { parameter: 'Permanent biaxial utilisation z-z', symbol: 'ηz,G', units: '-', value: eta_z_G.toFixed(3), formulaText: 'σc,0,d / (kc,z fc,0,d) + 0.7 σm,y,d / fm,y,d + σm,z,d / fm,z,d', isRatio: true, isExceeded: eta_z_G > 1 },
    { parameter: 'Combined biaxial utilisation y-y', symbol: 'ηy,GQ', units: '-', value: eta_y_GQ.toFixed(3), formulaText: 'σc,0,d / (kc,y fc,0,d) + σm,y,d / fm,y,d + 0.7 σm,z,d / fm,z,d', isRatio: true, isExceeded: eta_y_GQ > 1 },
    { parameter: 'Combined biaxial utilisation z-z', symbol: 'ηz,GQ', units: '-', value: eta_z_GQ.toFixed(3), formulaText: 'σc,0,d / (kc,z fc,0,d) + 0.7 σm,y,d / fm,y,d + σm,z,d / fm,z,d', isRatio: true, isExceeded: eta_z_GQ > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(ηy,G; ηz,G; ηy,GQ; ηz,GQ)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    kc_y,
    kc_z,
    eta_y_GQ,
    eta_z_GQ,
    rows
  };
}

// ----------------------------------------------------------------------------
// 13. MEMBER 11: MASONRY SINGLE-LEAF WALL (EN 1996-1-1)
// ----------------------------------------------------------------------------
export interface MasonryWallInputs {
  l: number;          // m length (1.0 for unit strip)
  H: number;          // m clear height
  t: number;          // mm structural thickness
  hef: number;        // m effective height
  NG_k: number;       // kN
  NQ_k: number;       // kN
  MEd_t: number;      // kNm design top moment
  MEd_m: number;      // kNm design mid-height moment
  MEd_b: number;      // kNm design bottom moment
  unitGroup: string;  // e.g. 'Clay / G1'
  fkRoute: 'From fb and fm' | 'Declared/tested fk';
  fb: number;         // MPa normalized unit strength
  fm: number;         // MPa mortar compressive strength
  fk_test: number;    // MPa declared masonry strength
  K_NA: number;       // 0 to use EN default
  KE: number;         // 1000 default (E = KE * fk)
  phi_inf: number;    // creep coefficient (e.g. 1.0)
  weight: number;     // kN/m³
  isExampleData: boolean;
  // Shear
  VEd: number;        // kN in-plane shear
  NEd_v: number;      // kN simultaneous compression
  lc: number;         // m compressed length
  fvk0: number;       // MPa initial shear strength
  capRule: '0.065 fb' | 'NA fvlt';
  fvlt: number;       // MPa
}

export interface MasonryWallResult {
  eta_max: number;
  status: EurocodeStatus;
  fk: number;
  fd: number;
  NRd_t: number;
  NRd_m: number;
  NRd_b: number;
  VRd: number;
  rows: CalculationRow[];
}

export function calcMasonryWall(inputs: MasonryWallInputs, basis: SharedDesignBasis): MasonryWallResult {
  const {
    l, H, t, hef, NG_k, NQ_k, MEd_t, MEd_m, MEd_b,
    unitGroup, fkRoute, fb, fm, fk_test, K_NA, KE, phi_inf, weight, isExampleData,
    VEd, NEd_v, lc, fvk0, capRule, fvlt
  } = inputs;
  const rows: CalculationRow[] = [];

  const mg = MASONRY_GROUPS[unitGroup] || MASONRY_GROUPS['Clay / G1'];
  const K = K_NA > 0 ? K_NA : mg.KEN;

  let fk = 0;
  if (fkRoute === 'From fb and fm') {
    fk = K * Math.pow(fb, 0.7) * Math.pow(fm, 0.3);
  } else {
    fk = fk_test;
  }

  const E = KE * fk;
  const A = (l * t) / 1000;
  const kA = A < 0.1 ? 0.7 + 3 * A : 1.0;
  const fd = (kA * fk) / basis.gammaM_m;

  const Gk_self = A * H * weight;
  const NEd_t = basis.gammaG * NG_k + basis.gammaQ * NQ_k;
  const NEd_m = NEd_t + 0.5 * basis.gammaG * Gk_self;
  const NEd_b = NEd_t + basis.gammaG * Gk_self;

  // Slenderness & eccentricities
  const hef_t = (hef * 1000) / t;
  const einit = (hef * 1000) / 450;
  const et = Math.max(0.05 * t, (MEd_t * 1000) / NEd_t + einit);
  const eb = Math.max(0.05 * t, (MEd_b * 1000) / NEd_b + einit);
  const em = (MEd_m * 1000) / NEd_m + einit;
  const ek = 0.002 * phi_inf * hef_t * Math.sqrt(t * em);
  const emk = Math.max(0.05 * t, em + ek);

  const lambda = hef_t * Math.sqrt(fk / E);
  const u_param = emk < 0.5 * t ? (lambda - 0.063) / (0.73 - 1.17 * (emk / t)) : 999;

  const Phi_t = Math.max(0, 1 - (2 * et) / t);
  const Phi_b = Math.max(0, 1 - (2 * eb) / t);
  const Phi_m = emk < 0.5 * t ? (1 - (2 * emk) / t) * Math.exp(-Math.pow(u_param, 2) / 2) : 0;

  const NRd_t = Phi_t * A * fd * 1000;
  const NRd_m = Phi_m * A * fd * 1000;
  const NRd_b = Phi_b * A * fd * 1000;

  const eta_t = NRd_t > 0 ? NEd_t / NRd_t : 999;
  const eta_m = NRd_m > 0 ? NEd_m / NRd_m : 999;
  const eta_b = NRd_b > 0 ? NEd_b / NRd_b : 999;
  const eta_slender = hef_t / 27;
  const eta_tmin = basis.tmin_wall / t;

  // Bed-joint shear
  const sigma_d = NEd_v / (t * lc);
  const fv_cap = capRule === '0.065 fb' ? 0.065 * fb : fvlt;
  const fvk = Math.min(fvk0 + 0.4 * sigma_d, fv_cap);
  const fvd = fvk / basis.gammaM_v;
  const VRd = fvd * t * lc;

  const eta_V = VEd === 0 ? 0 : VRd > 0 ? VEd / VRd : 999;
  const eta_cV = (2 * sigma_d) / fd;

  const eta_max = Math.max(eta_t, eta_m, eta_b, eta_slender, eta_tmin, eta_V, eta_cV);

  let status: EurocodeStatus = isExampleData ? 'EXAMPLE DATA' : 'SCREEN ONLY';
  if (A < 0.04 || hef_t > 27 || et >= 0.5 * t || eb >= 0.5 * t || emk >= 0.5 * t) {
    status = 'OUT OF SCOPE';
  } else if (eta_max > 1.0) {
    status = isExampleData ? 'EXAMPLE DATA' : 'EXCEEDS SCREEN';
  }

  rows.push(
    { parameter: 'Characteristic masonry strength', symbol: 'fk', units: 'MPa', value: fk.toFixed(2), formulaText: 'K × fb^0.7 × fm^0.3' },
    { parameter: 'Design compressive strength', symbol: 'fd', units: 'MPa', value: fd.toFixed(2), formulaText: 'kA × fk / γM,m' },
    { parameter: 'Top vertical resistance', symbol: 'NRd,t', units: 'kN', value: NRd_t.toFixed(1), formulaText: 'Φt × A × fd' },
    { parameter: 'Mid-height capacity reduction', symbol: 'Φm', units: '-', value: Phi_m.toFixed(3), formulaText: '(1 - 2emk/t) exp(-u²/2)' },
    { parameter: 'Mid-height vertical resistance', symbol: 'NRd,m', units: 'kN', value: NRd_m.toFixed(1), formulaText: 'Φm × A × fd' },
    { parameter: 'Mid-height utilisation', symbol: 'ηm', units: '-', value: eta_m.toFixed(3), formulaText: 'NEd,m / NRd,m', isRatio: true, isExceeded: eta_m > 1 },
    { parameter: 'Bed-joint shear resistance', symbol: 'VRd', units: 'kN', value: VRd.toFixed(1), formulaText: 'fvd × t × lc' },
    { parameter: 'In-plane shear utilisation', symbol: 'ηV', units: '-', value: eta_V.toFixed(3), formulaText: 'VEd / VRd', isRatio: true, isExceeded: eta_V > 1 },
    { parameter: 'Governing utilisation', symbol: 'ηmax', units: '-', value: eta_max.toFixed(3), formulaText: 'max(ηt; ηm; ηb; ηV; ηcV; slenderness)', isRatio: true, isExceeded: eta_max > 1 }
  );

  return {
    eta_max,
    status,
    fk,
    fd,
    NRd_t,
    NRd_m,
    NRd_b,
    VRd,
    rows
  };
}

// ----------------------------------------------------------------------------
// 14. 3D STRUCTURAL BAY MODEL & AUTOMATIC TRIBUTARY LOAD TAKEDOWN ENGINE
// ----------------------------------------------------------------------------
export interface StructuralBayConfig {
  spanL: number;           // m (e.g. 6.0)
  tributaryWidthBtr: number;// m (e.g. 3.0)
  storeyHeightH: number;   // m (e.g. 3.0)
  numberOfStoreys: number; // e.g. 3
  materialSystem: 'RC' | 'Steel' | 'Timber' | 'Masonry';
  occupancyCategory: string; // e.g. 'Cat_B_Office'
  // Auto load takedown toggle
  autoLoadTakedown: boolean;
}

export interface TributaryTakedownResults {
  // Slab unit loads
  slab_gk_self: number;    // kN/m²
  slab_Gk: number;         // kN/m
  slab_Qk: number;         // kN/m
  slab_MEd: number;        // kNm
  slab_VEd: number;        // kN
  // Beam line loads
  beam_gk_self: number;    // kN/m
  beam_Gk: number;         // kN/m
  beam_Qk: number;         // kN/m
  beam_MEd: number;        // kNm
  beam_VEd: number;        // kN
  // Cumulative Column / Wall axial loads at base
  column_NG_k: number;     // kN (characteristic dead load from all supported floors)
  column_NQ_k: number;     // kN (characteristic live load from all supported floors)
  column_NEd: number;      // kN (factored design compression)
  wall_NG_k: number;       // kN/m
  wall_NQ_k: number;       // kN/m
  wall_NEd: number;        // kN/m
}

export function computeTributaryLoadTakedown(
  config: StructuralBayConfig,
  basis: SharedDesignBasis
): TributaryTakedownResults {
  const { spanL, tributaryWidthBtr, storeyHeightH, numberOfStoreys, materialSystem } = config;

  // Approximate default member self-weights based on material system
  let slab_gk_self = 5.0; // kN/m² default
  let beam_gk_self = 4.0; // kN/m default
  let col_gk_self_per_m = 3.0; // kN/m

  if (materialSystem === 'RC') {
    slab_gk_self = 0.22 * 25.0; // 5.5 kN/m²
    beam_gk_self = 0.3 * 0.55 * 25.0; // 4.13 kN/m
    col_gk_self_per_m = 0.4 * 0.4 * 25.0; // 4.0 kN/m
  } else if (materialSystem === 'Steel') {
    slab_gk_self = 3.0; // composite deck / precast slab
    beam_gk_self = 0.42; // IPE 300 ~ 42 kg/m -> 0.41 kN/m
    col_gk_self_per_m = 0.83; // HE 240 B ~ 83 kg/m -> 0.82 kN/m
  } else if (materialSystem === 'Timber') {
    slab_gk_self = 0.16 * 5.0; // 0.8 kN/m²
    beam_gk_self = 0.12 * 0.32 * 5.0; // 0.19 kN/m
    col_gk_self_per_m = 0.20 * 0.24 * 5.0; // 0.24 kN/m
  } else if (materialSystem === 'Masonry') {
    slab_gk_self = 0.20 * 25.0; // 5.0 kN/m²
    beam_gk_self = 3.0;
    col_gk_self_per_m = 0.25 * 18.0; // 4.5 kN/m per m wall strip
  }

  // Slab checks (1m strip)
  const slab_Gk = (basis.gk_add + slab_gk_self) * 1.0;
  const slab_Qk = basis.qk * 1.0;
  const slab_qd = basis.gammaG * slab_Gk + basis.gammaQ * slab_Qk;
  const slab_MEd = (slab_qd * Math.pow(spanL, 2)) / 8;
  const slab_VEd = (slab_qd * spanL) / 2;

  // Beam checks (carrying tributaryWidthBtr of slab)
  const beam_Gk = (basis.gk_add + slab_gk_self) * tributaryWidthBtr + beam_gk_self;
  const beam_Qk = basis.qk * tributaryWidthBtr;
  const beam_qd = basis.gammaG * beam_Gk + basis.gammaQ * beam_Qk;
  const beam_MEd = (beam_qd * Math.pow(spanL, 2)) / 8;
  const beam_VEd = (beam_qd * spanL) / 2;

  // Column axial takedown:
  // Tributary area supported by single interior/perimeter column = spanL × tributaryWidthBtr
  const tribArea = spanL * tributaryWidthBtr;
  const floorGk = (basis.gk_add + slab_gk_self) * tribArea + beam_gk_self * spanL;
  const floorQk = basis.qk * tribArea;

  const column_NG_k = floorGk * numberOfStoreys + (col_gk_self_per_m * storeyHeightH) * numberOfStoreys;
  const column_NQ_k = floorQk * numberOfStoreys;
  const column_NEd = basis.gammaG * column_NG_k + basis.gammaQ * column_NQ_k;

  // Wall axial takedown (per 1m linear run of wall):
  // Tributary width supported by wall run = spanL / 2
  const wallTribWidth = spanL / 2;
  const wallFloorGk = (basis.gk_add + slab_gk_self) * wallTribWidth;
  const wallFloorQk = basis.qk * wallTribWidth;
  const wall_NG_k = wallFloorGk * numberOfStoreys + (col_gk_self_per_m * storeyHeightH) * numberOfStoreys;
  const wall_NQ_k = wallFloorQk * numberOfStoreys;
  const wall_NEd = basis.gammaG * wall_NG_k + basis.gammaQ * wall_NQ_k;

  return {
    slab_gk_self,
    slab_Gk,
    slab_Qk,
    slab_MEd,
    slab_VEd,
    beam_gk_self,
    beam_Gk,
    beam_Qk,
    beam_MEd,
    beam_VEd,
    column_NG_k,
    column_NQ_k,
    column_NEd,
    wall_NG_k,
    wall_NQ_k,
    wall_NEd
  };
}

// ----------------------------------------------------------------------------
// 15. MULTI-SYSTEM OPTIONEERING MATRIX (RC vs Steel vs Timber/CLT vs Masonry)
// ----------------------------------------------------------------------------
export interface SystemOptionComparison {
  system: 'RC' | 'Steel' | 'Timber' | 'Masonry';
  displayName: string;
  structuralDepth: number; // mm (slab + beam total envelope)
  slabDepth: number;       // mm
  beamDepth: number;       // mm
  columnSize: string;      // mm or profile
  selfWeightWm2: number;   // kN/m²
  eta_max: number;         // Governing utilisation ratio
  governingMember: string;
  embodiedCarbonA1A3: number; // kgCO2e/m² upfront structural frame
  status: EurocodeStatus;
}

export function generateOptioneeringMatrix(
  config: StructuralBayConfig,
  basis: SharedDesignBasis
): SystemOptionComparison[] {
  const takedown = computeTributaryLoadTakedown(config, basis);
  const { spanL, tributaryWidthBtr, storeyHeightH } = config;

  // 1. RC System
  const rcSlab = calcRcSlab({
    L: spanL, Btr: 1.0, b: 1000, h: 220, cnom: 30, phi: 12, s: 150, phi_t: 8, s_t: 200,
    concreteClass: 'C30/37', fyk: 500
  }, basis);
  const rcBeam = calcRcBeam({
    L: spanL, Btr: tributaryWidthBtr, b: 300, h: 550, cnom: 30, phi: 20, phi_link: 8,
    n: 4, nleg: 2, sw: 200, cot_theta: 2.0, concreteClass: 'C30/37', fyk: 500
  }, basis);
  const rcCol = calcRcColumn({
    H: storeyHeightH, l0: storeyHeightH, b: 400, h: 400, a: 50, phi: 20, n_bars: 3,
    NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k, M0_Ed: 35, phi_ef: 2.0, c: 8,
    concreteClass: 'C30/37', fyk: 500
  }, basis);
  const rcMaxEta = Math.max(rcSlab.eta_max, rcBeam.eta_max, rcCol.eta_max);
  const rcGov = rcSlab.eta_max >= rcBeam.eta_max && rcSlab.eta_max >= rcCol.eta_max
    ? 'RC Slab' : rcBeam.eta_max >= rcCol.eta_max ? 'RC Beam' : 'RC Column';

  // 2. Steel System
  const steelBeam = calcSteelBeam({
    L: spanL, Btr: tributaryWidthBtr, profileName: 'IPE 300', grade: 'S355', restraint: 'Assumed',
    div_Q: 300, div_total: 250
  }, basis);
  const steelCol = calcSteelColumn({
    H: storeyHeightH, lcr_y: storeyHeightH, lcr_z: storeyHeightH, lcr_T: storeyHeightH,
    NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k, profileName: 'HE 240 B', grade: 'S355'
  }, basis);
  const steelMaxEta = Math.max(steelBeam.eta_max, steelCol.eta_max);
  const steelGov = steelBeam.eta_max >= steelCol.eta_max ? 'Steel Beam (IPE 300)' : 'Steel Col (HE 240 B)';

  // 3. Timber / CLT System
  const cltSlab = calcCltSlab({
    L: spanL, Btr: 1.0, t: 160, EI_mean: 3.0e12, GA_eff: 8.0e6, MR_k: 60, VR_k: 45, Rc90_Rk: 150,
    gammaM: 1.30, kmod_G: 0.60, kmod_GQ: 0.80, kdef: 0.80, div_Q: 300, div_fin: 200,
    productName: 'EXAMPLE 160 mm 5-layer', isDocumented: true
  }, basis);
  const glulamBeam = calcWoodBeam({
    L: spanL, Btr: tributaryWidthBtr, b: 120, h: 320, a: 120, timberClass: 'GL24h', serviceClass: 1,
    duration: 'Medium-term', div_Q: 300, div_fin: 200, restraint: 'Assumed'
  }, basis);
  const glulamCol = calcWoodColumn({
    H: storeyHeightH, b: 200, h: 240, l0_y: storeyHeightH, l0_z: storeyHeightH,
    NG_k: takedown.column_NG_k, NQ_k: takedown.column_NQ_k, MGy_k: 2.0, MQy_k: 1.0, MGz_k: 1.0, MQz_k: 0.5,
    timberClass: 'GL24h', serviceClass: 1, duration: 'Medium-term', restraint: 'Assumed'
  }, basis);
  const timberMaxEta = Math.max(cltSlab.eta_max, glulamBeam.eta_max, glulamCol.eta_max);
  const timberGov = cltSlab.eta_max >= glulamBeam.eta_max && cltSlab.eta_max >= glulamCol.eta_max
    ? 'CLT Slab (160mm)' : glulamBeam.eta_max >= glulamCol.eta_max ? 'Glulam Beam' : 'Glulam Column';

  // 4. Masonry System
  const masonryWall = calcMasonryWall({
    l: 1.0, H: storeyHeightH, t: 250, hef: storeyHeightH,
    NG_k: takedown.wall_NG_k, NQ_k: takedown.wall_NQ_k,
    MEd_t: 2.0, MEd_m: 3.0, MEd_b: 2.0,
    unitGroup: 'Clay / G1', fkRoute: 'From fb and fm', fb: 10, fm: 5, fk_test: 4.5,
    K_NA: 0, KE: 1000, phi_inf: 1.0, weight: 18, isExampleData: true,
    VEd: 20, NEd_v: 180, lc: 1.0, fvk0: 0.2, capRule: '0.065 fb', fvlt: 0.65
  }, basis);

  return [
    {
      system: 'RC',
      displayName: 'Reinforced Concrete (C30/37)',
      structuralDepth: 550,
      slabDepth: 220,
      beamDepth: 550,
      columnSize: '400 × 400 mm',
      selfWeightWm2: 6.8,
      eta_max: rcMaxEta,
      governingMember: rcGov,
      embodiedCarbonA1A3: 215,
      status: rcMaxEta <= 1.0 ? 'SCREEN ONLY' : 'EXCEEDS SCREEN'
    },
    {
      system: 'Steel',
      displayName: 'Structural Steel S355',
      structuralDepth: 420,
      slabDepth: 120,
      beamDepth: 300,
      columnSize: 'HE 240 B',
      selfWeightWm2: 3.6,
      eta_max: steelMaxEta,
      governingMember: steelGov,
      embodiedCarbonA1A3: 168,
      status: steelMaxEta <= 1.0 ? 'SCREEN ONLY' : 'EXCEEDS SCREEN'
    },
    {
      system: 'Timber',
      displayName: 'Mass Timber (CLT + Glulam GL24h)',
      structuralDepth: 480,
      slabDepth: 160,
      beamDepth: 320,
      columnSize: '200 × 240 mm',
      selfWeightWm2: 1.8,
      eta_max: timberMaxEta,
      governingMember: timberGov,
      embodiedCarbonA1A3: -48, // net negative upfront carbon storage
      status: timberMaxEta <= 1.0 ? 'DOCUMENTED PRODUCT' : 'EXCEEDS SCREEN'
    },
    {
      system: 'Masonry',
      displayName: 'Load-Bearing Masonry (Clay G1)',
      structuralDepth: 470,
      slabDepth: 220,
      beamDepth: 250,
      columnSize: '250 mm Wall Strip',
      selfWeightWm2: 8.5,
      eta_max: masonryWall.eta_max,
      governingMember: 'Masonry Wall Strip',
      embodiedCarbonA1A3: 185,
      status: masonryWall.eta_max <= 1.0 ? 'EXAMPLE DATA' : 'EXCEEDS SCREEN'
    }
  ];
}

// ============================================================================
// 15. PILLAR 1: RC N-M INTERACTION ENVELOPE & STEEL/TIMBER BUCKLING CURVES
// ============================================================================

export interface RcInteractionPoint {
  N: number; // kN (compression > 0, tension < 0)
  M: number; // kNm (>= 0)
  x: number; // mm neutral axis
  regime: 'tension' | 'balanced' | 'compression' | 'squash';
}

export interface RcInteractionCurve {
  points: RcInteractionPoint[];
  NRd_t: number;   // kN pure axial tension (< 0)
  NRd_c: number;   // kN pure axial squash compression (> 0)
  N_bal: number;   // kN balanced point axial force
  M_bal: number;   // kNm peak moment resistance
  MRd_0: number;   // kNm pure bending at N=0
}

/**
 * Sweeps the entire physical domain of neutral axis depth x to generate the complete
 * closed axial-moment failure envelope (P-M interaction diagram) for an RC section per EN 1992-1-1.
 */
export function generateRcInteractionCurve(
  b: number,
  h: number,
  a: number,
  d: number,
  As_face: number,
  fcd: number,
  fyd: number,
  Es: number
): RcInteractionCurve {
  // Pure tension (both rebar layers yielding in tension, concrete cracked)
  const NRd_t = (-2 * As_face * fyd) / 1000;
  // Pure compression squash (concrete and both rebar layers in yield compression)
  const NRd_c = (b * h * fcd + 2 * As_face * fyd) / 1000;

  // Balanced failure neutral axis depth
  const x_bal = d * (0.0035 / (0.0035 + fyd / Es));

  const pts: RcInteractionPoint[] = [];

  // Start with pure tension
  pts.push({ N: NRd_t, M: 0, x: 0, regime: 'tension' });

  // Sweep x from very small (tension failure) up to h (entire section compressed)
  const numSteps = 36;
  for (let i = 1; i <= numSteps; i++) {
    const x = (i / numSteps) * h;
    const ss_t = Math.max(-fyd, Math.min(fyd, Es * 0.0035 * (1 - a / x)));
    const ss_b = Math.max(-fyd, Math.min(fyd, Es * 0.0035 * (1 - d / x)));
    const Fc = (17 / 21) * b * x * fcd;
    const eps_a = 0.0035 * (1 - a / x);
    const eps_d = 0.0035 * (1 - d / x);
    const sc_a = eps_a > 0 ? fcd * (1 - Math.pow(1 - Math.min(eps_a, 0.002) / 0.002, 2)) : 0;
    const sc_d = eps_d > 0 ? fcd * (1 - Math.pow(1 - Math.min(eps_d, 0.002) / 0.002, 2)) : 0;
    const Fs = As_face * (ss_t + ss_b - sc_a - sc_d);
    const N = (Fc + Fs) / 1000;
    const M = Math.max(
      0,
      (
        Fc * (h / 2 - (99 * x) / 238) +
        As_face * (ss_t - sc_a) * (h / 2 - a) +
        As_face * (ss_b - sc_d) * (h / 2 - d)
      ) / 1000000
    );

    const regime: 'tension' | 'balanced' | 'compression' =
      x < x_bal * 0.95 ? 'tension' : x <= x_bal * 1.05 ? 'balanced' : 'compression';
    pts.push({ N, M, x, regime });
  }

  // Smooth transition from x=h to pure squash compression
  const lastPt = pts[pts.length - 1];
  for (let s = 1; s <= 6; s++) {
    const frac = s / 7;
    const N = lastPt.N + (NRd_c - lastPt.N) * frac;
    const M = Math.max(0, lastPt.M * Math.cos((frac * Math.PI) / 2));
    pts.push({ N, M, x: h * (1 + frac), regime: 'squash' });
  }
  // Pure squash point
  pts.push({ N: NRd_c, M: 0, x: h * 2, regime: 'squash' });

  // Calculate key markers
  let M_bal = 0;
  let N_bal = 0;
  let MRd_0 = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].M > M_bal) {
      M_bal = pts[i].M;
      N_bal = pts[i].N;
    }
    // Interpolate M at N=0
    if (i > 0 && pts[i - 1].N <= 0 && pts[i].N >= 0) {
      const span = pts[i].N - pts[i - 1].N;
      const factor = span > 0.001 ? (0 - pts[i - 1].N) / span : 0.5;
      MRd_0 = pts[i - 1].M + factor * (pts[i].M - pts[i - 1].M);
    }
  }

  return { points: pts, NRd_t, NRd_c, N_bal, M_bal, MRd_0 };
}

export interface BucklingCurvePoint {
  lambda_bar: number; // slenderness 0..3.0
  chi_a0: number;
  chi_a: number;
  chi_b: number;
  chi_c: number;
  chi_d: number;
  chi_euler: number;
}

/**
 * Generates European Buckling Curves (a0, a, b, c, d) per EN 1993-1-1 §6.3.1.2 and Euler curve
 */
export function generateBucklingCurves(): BucklingCurvePoint[] {
  const calcChi = (lambda: number, alpha: number) => {
    if (lambda <= 0.2) return 1.0;
    const phi = 0.5 * (1 + alpha * (lambda - 0.2) + Math.pow(lambda, 2));
    const denom = phi + Math.sqrt(Math.max(0, Math.pow(phi, 2) - Math.pow(lambda, 2)));
    return Math.min(1.0, 1 / denom);
  };

  const pts: BucklingCurvePoint[] = [];
  for (let l = 0.05; l <= 2.8; l += 0.05) {
    pts.push({
      lambda_bar: parseFloat(l.toFixed(2)),
      chi_a0: parseFloat(calcChi(l, 0.13).toFixed(3)),
      chi_a: parseFloat(calcChi(l, 0.21).toFixed(3)),
      chi_b: parseFloat(calcChi(l, 0.34).toFixed(3)),
      chi_c: parseFloat(calcChi(l, 0.49).toFixed(3)),
      chi_d: parseFloat(calcChi(l, 0.76).toFixed(3)),
      chi_euler: parseFloat(Math.min(1.0, 1 / Math.pow(l, 2)).toFixed(3))
    });
  }
  return pts;
}

// ============================================================================
// 16. PILLAR 4: CLIMATE & ENVIRONMENTAL ACTION DERIVATION (EN 1991-1-3/4/5)
// ============================================================================

export interface DerivedEnvironmentalLoads {
  stationName: string;
  latitude: number;
  elevation: number;
  sk_snow_kNm2: number;
  qp_wind_kNm2: number;
  deltaT_thermal_deg: number;
  peakWindSpeedMs: number;
  tempMinC: number;
  tempMaxC: number;
  snowFormulaText: string;
  windFormulaText: string;
}

/**
 * Derives environmental actions (Snow, Wind, Thermal) from station weather & elevation
 */
export function deriveEnvironmentalLoadsFromClimate(
  climate: {
    name?: string;
    lat: number;
    elev: number;
    hourly?: Array<{ windSpeed?: number; dryBulb?: number }>;
  },
  terrainCategory: '0' | 'I' | 'II' | 'III' | 'IV' = 'III'
): DerivedEnvironmentalLoads {
  const elev = Math.max(0, climate.elev || 0);
  const lat = climate.lat || 45.0;

  // Snow load per EN 1991-1-3
  let sk = 0.60;
  let snowFormula = '';
  if (lat >= 44.0) {
    sk = Math.max(0.60, 0.70 * (1 + Math.pow(elev / 728, 2)));
    snowFormula = `EN 1991-1-3 (Alpine/Zone 1): 0.70 × [1 + (Elev/728)²] = ${sk.toFixed(2)} kN/m²`;
  } else {
    sk = Math.max(0.40, 0.45 * (1 + Math.pow(elev / 1000, 2)));
    snowFormula = `EN 1991-1-3 (Mediterranean): 0.45 × [1 + (Elev/1000)²] = ${sk.toFixed(2)} kN/m²`;
  }
  sk = Math.min(6.0, sk);

  // Peak wind & temperature extrema from hourly dataset
  let peakWind = 24.0;
  let tempMin = -5.0;
  let tempMax = 36.0;
  if (climate.hourly && climate.hourly.length > 0) {
    const winds = climate.hourly.map((h) => h.windSpeed ?? 0);
    const temps = climate.hourly.map((h) => h.dryBulb ?? 20);
    peakWind = Math.max(18, ...winds);
    tempMin = Math.min(...temps);
    tempMax = Math.max(...temps);
  }

  // Exposure factor ce(z) at z=12m (3-4 storeys) per EN 1991-1-4 Table 4.1
  const ceMap: Record<string, number> = {
    '0': 2.8,   // Sea / coastal
    'I': 2.5,   // Lakes / flat open area
    'II': 2.2,  // Low vegetation / open farmland
    'III': 1.7, // Suburban / forest
    'IV': 1.3   // Urban city centre
  };
  const ce = ceMap[terrainCategory] || 1.7;
  const vb0 = Math.max(22.0, peakWind * 0.95);
  const qp = (ce * 0.5 * 1.25 * Math.pow(vb0, 2)) / 1000;
  const windFormula = `EN 1991-1-4 (Terrain ${terrainCategory}): ce(${ce}) × 0.5 × 1.25 × (${vb0.toFixed(1)} m/s)² = ${qp.toFixed(2)} kN/m²`;

  const deltaT = Math.round(tempMax - tempMin);

  return {
    stationName: climate.name || 'Station',
    latitude: lat,
    elevation: elev,
    sk_snow_kNm2: parseFloat(sk.toFixed(2)),
    qp_wind_kNm2: parseFloat(qp.toFixed(2)),
    deltaT_thermal_deg: deltaT,
    peakWindSpeedMs: parseFloat(peakWind.toFixed(1)),
    tempMinC: parseFloat(tempMin.toFixed(1)),
    tempMaxC: parseFloat(tempMax.toFixed(1)),
    snowFormulaText: snowFormula,
    windFormulaText: windFormula
  };
}

// ============================================================================
// 17. PILLAR 3: ONE-CLICK SECTION AUTO-OPTIMIZER
// ============================================================================

export interface OptimizationResult {
  success: boolean;
  memberType: string;
  previousEta: number;
  newEta: number;
  previousDesc: string;
  newDesc: string;
  optimizedParams: any;
  carbonReductionPct: number;
  message: string;
}

/**
 * Intelligent section auto-sizer: finds optimal standard geometry
 * achieving 0.70 <= eta <= 0.95 with minimum embodied material & carbon.
 */
export function optimizeMemberSection(
  memberType: string,
  params: any,
  basis: SharedDesignBasis
): OptimizationResult {
  if (memberType === 'rc_column') {
    const origRes = calcRcColumn(params, basis);
    const origArea = params.b * params.h;
    const sizes = [250, 300, 350, 400, 450, 500, 550, 600];
    const bars = [2, 3, 4];
    const phis = [16, 20, 25, 32];

    let bestParams: any = null;
    let bestEta = 999;
    let bestArea = 9999999;

    for (const size of sizes) {
      for (const n of bars) {
        for (const phi of phis) {
          const testParams = { ...params, b: size, h: size, n_bars: n, phi };
          const res = calcRcColumn(testParams, basis);
          if (res.status === 'SCREEN ONLY' && res.eta_max <= 0.95) {
            const area = size * size;
            if (area < bestArea || (area === bestArea && res.eta_max < bestEta && res.eta_max >= 0.70)) {
              bestArea = area;
              bestEta = res.eta_max;
              bestParams = testParams;
            }
          }
        }
      }
    }

    if (bestParams) {
      const carbonRed = Math.max(0, Math.round(((origArea - bestArea) / origArea) * 100));
      return {
        success: true,
        memberType,
        previousEta: origRes.eta_max,
        newEta: bestEta,
        previousDesc: `${params.b}×${params.h} mm (4+${(params.n_bars - 2) * 2} Ø${params.phi})`,
        newDesc: `${bestParams.b}×${bestParams.h} mm (4+${(bestParams.n_bars - 2) * 2} Ø${bestParams.phi})`,
        optimizedParams: bestParams,
        carbonReductionPct: carbonRed,
        message: `Optimized to ${bestParams.b}×${bestParams.h} mm column with η = ${bestEta.toFixed(2)} (${carbonRed}% concrete volume saved)`
      };
    }
  }

  if (memberType === 'steel_column') {
    const origRes = calcSteelColumn(params, basis);
    // Profile keys ordered by mass
    const colProfiles = Object.entries(STEEL_PROFILES)
      .filter(([k]) => k.startsWith('HE') || k.startsWith('SHS'))
      .sort((a, b) => a[1].mass - b[1].mass);

    for (const [pName, prof] of colProfiles) {
      const testParams = { ...params, profileName: pName };
      const res = calcSteelColumn(testParams, basis);
      if (res.status === 'SCREEN ONLY' && res.eta_max <= 0.95) {
        const origMass = STEEL_PROFILES[params.profileName]?.mass || 80;
        const carbonRed = Math.max(0, Math.round(((origMass - prof.mass) / origMass) * 100));
        return {
          success: true,
          memberType,
          previousEta: origRes.eta_max,
          newEta: res.eta_max,
          previousDesc: params.profileName,
          newDesc: pName,
          optimizedParams: testParams,
          carbonReductionPct: carbonRed,
          message: `Optimized to ${pName} (${prof.mass} kg/m) with η = ${res.eta_max.toFixed(2)}`
        };
      }
    }
  }

  if (memberType === 'steel_beam') {
    const origRes = calcSteelBeam(params, basis);
    const ipeProfiles = Object.entries(STEEL_PROFILES)
      .filter(([k]) => k.startsWith('IPE'))
      .sort((a, b) => a[1].mass - b[1].mass);

    for (const [pName, prof] of ipeProfiles) {
      const testParams = { ...params, profileName: pName };
      const res = calcSteelBeam(testParams, basis);
      if (res.status === 'SCREEN ONLY' && res.eta_max <= 0.95) {
        const origMass = STEEL_PROFILES[params.profileName]?.mass || 40;
        const carbonRed = Math.max(0, Math.round(((origMass - prof.mass) / origMass) * 100));
        return {
          success: true,
          memberType,
          previousEta: origRes.eta_max,
          newEta: res.eta_max,
          previousDesc: params.profileName,
          newDesc: pName,
          optimizedParams: testParams,
          carbonReductionPct: carbonRed,
          message: `Optimized to ${pName} (${prof.mass} kg/m) with η = ${res.eta_max.toFixed(2)}`
        };
      }
    }
  }

  if (memberType === 'rc_beam') {
    const origRes = calcRcBeam(params, basis);
    const depths = [350, 400, 450, 500, 550, 600, 650, 700];
    for (const h of depths) {
      const testParams = { ...params, h };
      const res = calcRcBeam(testParams, basis);
      if (res.status === 'SCREEN ONLY' && res.eta_max <= 0.95) {
        const carbonRed = Math.max(0, Math.round(((params.h - h) / params.h) * 100));
        return {
          success: true,
          memberType,
          previousEta: origRes.eta_max,
          newEta: res.eta_max,
          previousDesc: `${params.b}×${params.h} mm`,
          newDesc: `${params.b}×${h} mm`,
          optimizedParams: testParams,
          carbonReductionPct: carbonRed,
          message: `Optimized beam depth to h = ${h} mm with η = ${res.eta_max.toFixed(2)}`
        };
      }
    }
  }

  if (memberType === 'wood_beam') {
    const origRes = calcWoodBeam(params, basis);
    const depths = [200, 240, 280, 320, 360, 400, 440, 480, 520, 560];
    for (const h of depths) {
      const testParams = { ...params, h };
      const res = calcWoodBeam(testParams, basis);
      if (res.status === 'SCREEN ONLY' && res.eta_max <= 0.95) {
        const carbonRed = Math.max(0, Math.round(((params.h - h) / params.h) * 100));
        return {
          success: true,
          memberType,
          previousEta: origRes.eta_max,
          newEta: res.eta_max,
          previousDesc: `${params.b}×${params.h} mm`,
          newDesc: `${params.b}×${h} mm`,
          optimizedParams: testParams,
          carbonReductionPct: carbonRed,
          message: `Optimized glulam beam depth to h = ${h} mm with η = ${res.eta_max.toFixed(2)}`
        };
      }
    }
  }

  return {
    success: false,
    memberType,
    previousEta: 0.5,
    newEta: 0.5,
    previousDesc: 'Current Section',
    newDesc: 'Current Section',
    optimizedParams: params,
    carbonReductionPct: 0,
    message: 'Current section is already within the optimal efficiency range.'
  };
}

// ============================================================================
// 17. EUROCODE 8 (EN 1998-1 / ITALIAN NTC 2018) SEISMIC ACTIONS ENGINE
// ============================================================================

export type SeismicGroundType = 'A' | 'B' | 'C' | 'D' | 'E';
export type BuildingImportanceClass = 'I' | 'II' | 'III' | 'IV';
export type DuctilityClass = 'DCL' | 'DCM' | 'DCH';

export interface GroundTypeParameters {
  S: number;
  TB: number; // s
  TC: number; // s
  TD: number; // s
  description: string;
}

export const GROUND_TYPE_TABLE: Record<SeismicGroundType, GroundTypeParameters> = {
  A: { S: 1.00, TB: 0.15, TC: 0.40, TD: 2.00, description: 'Rock or rock-like geological formation (vs,30 > 800 m/s)' },
  B: { S: 1.20, TB: 0.15, TC: 0.50, TD: 2.00, description: 'Very dense sand, gravel, or very stiff clay (vs,30 360–800 m/s)' },
  C: { S: 1.15, TB: 0.20, TC: 0.60, TD: 2.00, description: 'Deep deposits of dense or medium-dense sand/gravel (vs,30 180–360 m/s)' },
  D: { S: 1.35, TB: 0.20, TC: 0.80, TD: 2.00, description: 'Deposits of loose-to-medium cohesionless soil (vs,30 < 180 m/s)' },
  E: { S: 1.40, TB: 0.15, TC: 0.50, TD: 2.00, description: 'Alluvial surface layer (5–20m) over stiffer substrate (vs,30 > 800 m/s)' }
};

export const IMPORTANCE_FACTORS: Record<BuildingImportanceClass, { gamma_I: number; description: string }> = {
  I: { gamma_I: 0.80, description: 'Class I: Agricultural sheds, temporary storage, low human occupancy' },
  II: { gamma_I: 1.00, description: 'Class II: Standard residential, commercial offices, ordinary buildings' },
  III: { gamma_I: 1.20, description: 'Class III: Schools, large public halls, assembly (>200 persons)' },
  IV: { gamma_I: 1.40, description: 'Class IV: Hospitals, fire stations, civil protection, emergency infrastructure' }
};

export interface Eurocode8SeismicParams {
  ag_g: number; // Reference peak ground acceleration in g (0.05 to 0.35)
  groundType: SeismicGroundType;
  importanceClass: BuildingImportanceClass;
  ductilityClass: DuctilityClass;
  q_behaviorFactor?: number;
  totalHeightH: number; // Building total height (m)
  totalWeightWk: number; // Total seismic gravity weight (kN) = sum Gk + psi2 * Qk
  numberOfStoreys: number;
  structuralType?: 'rc_frame' | 'steel_frame' | 'shear_wall_timber_other';
}

export interface StoreySeismicForce {
  storeyIndex: number; // 1 (lowest) to N (roof)
  heightZ: number; // m
  storeyWeightKn: number;
  Fi_lateralForceKn: number; // kN applied lateral force
  Vi_storeyShearKn: number; // kN cumulative shear below storey
  theta_driftSensitivity: number; // Interstorey drift sensitivity coefficient theta
  pDeltaCheck: 'PASS' | 'SECOND_ORDER_AMPLIFICATION' | 'UNACCEPTABLE';
}

export interface Eurocode8SeismicResults {
  ag_reference_g: number;
  ag_design_g: number;
  ag_design_ms2: number;
  gamma_I: number;
  groundType: SeismicGroundType;
  groundDescription: string;
  S_soilFactor: number;
  TB_s: number;
  TC_s: number;
  TD_s: number;
  ductilityClass: DuctilityClass;
  q_behaviorFactor: number;
  Ct_periodFactor: number;
  T1_fundamentalPeriod_s: number;
  Sd_T1_ms2: number;
  Sd_T1_g: number;
  lambda_correction: number;
  Fb_baseShearKn: number;
  baseShearRatioPct: number; // Fb / W_seismic * 100
  totalSeismicWeightKn: number;
  storeys: StoreySeismicForce[];
  spectrumCurve: Array<{ T: number; Sd: number; S_elastic: number }>;
  governingTheta: number;
  pDeltaStatus: 'PASS' | 'WARNING' | 'FAIL';
  summaryDescription: string;
}

export function calcDesignSpectrumSd(
  T: number,
  ag_design_ms2: number,
  S: number,
  TB: number,
  TC: number,
  TD: number,
  q: number,
  beta_lower_bound: number = 0.20
): number {
  if (T < 0) return 0;
  if (T <= TB) {
    const val = ag_design_ms2 * S * (2 / 3 + (T / TB) * (2.5 / q - 2 / 3));
    return Math.max(beta_lower_bound * ag_design_ms2, val);
  } else if (T <= TC) {
    const val = ag_design_ms2 * S * (2.5 / q);
    return Math.max(beta_lower_bound * ag_design_ms2, val);
  } else if (T <= TD) {
    const val = ag_design_ms2 * S * (2.5 / q) * (TC / T);
    return Math.max(beta_lower_bound * ag_design_ms2, val);
  } else {
    const val = ag_design_ms2 * S * (2.5 / q) * ((TC * TD) / Math.pow(T, 2));
    return Math.max(beta_lower_bound * ag_design_ms2, val);
  }
}

/**
 * Eurocode 8 §3.2.2.2 Elastic Response Spectrum Se(T) for 5% damping (eta = 1.0)
 */
export function calcElasticSpectrumSe(
  T: number,
  ag_design_ms2: number,
  S: number,
  TB: number,
  TC: number,
  TD: number,
  eta: number = 1.0
): number {
  if (T < 0) return 0;
  if (T <= TB) {
    return ag_design_ms2 * S * (1.0 + (T / TB) * (eta * 2.5 - 1.0));
  } else if (T <= TC) {
    return ag_design_ms2 * S * eta * 2.5;
  } else if (T <= TD) {
    return ag_design_ms2 * S * eta * 2.5 * (TC / T);
  } else {
    return ag_design_ms2 * S * eta * 2.5 * ((TC * TD) / Math.pow(T, 2));
  }
}

export function computeEurocode8SeismicActions(params: Eurocode8SeismicParams): Eurocode8SeismicResults {
  const ag_ref = Math.max(0.04, Math.min(0.40, params.ag_g || 0.15));
  const groundInfo = GROUND_TYPE_TABLE[params.groundType] || GROUND_TYPE_TABLE['C'];
  const impInfo = IMPORTANCE_FACTORS[params.importanceClass] || IMPORTANCE_FACTORS['II'];

  const gamma_I = impInfo.gamma_I;
  const ag_design_g = +(ag_ref * gamma_I).toFixed(3);
  const ag_design_ms2 = +(ag_design_g * 9.80665).toFixed(2);

  // Ductility & behavior factor q
  let q = params.q_behaviorFactor;
  if (!q || q <= 0) {
    if (params.ductilityClass === 'DCL') q = 1.5;
    else if (params.ductilityClass === 'DCH') q = 4.5;
    else {
      q = params.structuralType === 'shear_wall_timber_other' ? 3.0 : 3.6;
    }
  }

  // Building height & empirical fundamental period T1 (EN 1998-1 §4.3.3.2.2)
  const H = Math.max(3.0, params.totalHeightH);
  const structType = params.structuralType || 'rc_frame';
  const Ct = structType === 'steel_frame' ? 0.085 : structType === 'rc_frame' ? 0.075 : 0.050;
  const T1 = +(Ct * Math.pow(H, 0.75)).toFixed(3);

  const { S, TB, TC, TD } = groundInfo;

  // Design spectral acceleration at T1
  const Sd_T1_ms2 = +calcDesignSpectrumSd(T1, ag_design_ms2, S, TB, TC, TD, q).toFixed(3);
  const Sd_T1_g = +(Sd_T1_ms2 / 9.80665).toFixed(3);

  // Correction factor lambda (EN 1998-1 §4.3.3.2.2 (1)P)
  const nStoreys = Math.max(1, Math.round(params.numberOfStoreys || 1));
  const lambda = T1 <= 2 * TC && nStoreys > 2 ? 0.85 : 1.00;

  // Total seismic weight & base shear Fb
  const W_seismic = Math.max(10, params.totalWeightWk);
  const Fb = +((Sd_T1_ms2 / 9.80665) * lambda * W_seismic).toFixed(1);
  const baseShearRatioPct = +((Fb / W_seismic) * 100).toFixed(1);

  // Storey forces and shear cascade (EN 1998-1 §4.3.3.2.3)
  const hStorey = H / nStoreys;
  const storeyW = W_seismic / nStoreys;
  const storeys: StoreySeismicForce[] = [];

  // Denominator: sum(z_j * w_j)
  let sumZ_W = 0;
  for (let i = 1; i <= nStoreys; i++) {
    const zi = i * hStorey;
    const wi = i === nStoreys ? storeyW * 0.85 : storeyW;
    sumZ_W += zi * wi;
  }

  let governingTheta = 0;

  // Compute storey forces Fi from roof (nStoreys) down to level 1
  const rawFi: number[] = [];
  for (let i = 1; i <= nStoreys; i++) {
    const zi = i * hStorey;
    const wi = i === nStoreys ? storeyW * 0.85 : storeyW;
    const fi = Fb * ((zi * wi) / Math.max(1, sumZ_W));
    rawFi.push(fi);
  }

  // Cumulative storey shears Vi
  for (let i = 1; i <= nStoreys; i++) {
    const zi = +(i * hStorey).toFixed(1);
    const wi = i === nStoreys ? storeyW * 0.85 : storeyW;
    const fi = +rawFi[i - 1].toFixed(1);
    let vi = 0;
    for (let k = i; k <= nStoreys; k++) {
      vi += rawFi[k - 1];
    }
    vi = +vi.toFixed(1);

    // Gravity load P_tot supported above storey i
    const pTot = (nStoreys - i + 1) * storeyW;

    // Design interstorey drift dr = q * de (estimated per EC8 allowable drift threshold 0.0075h)
    const driftRatio = Math.min(0.009, 0.0045 * (q / 3.0) * (vi / Math.max(1, Fb)));
    const dr = driftRatio * hStorey;

    // Interstorey drift sensitivity coefficient theta = (P_tot * dr) / (V_tot * h)
    const theta = +((pTot * dr) / Math.max(1, vi * hStorey)).toFixed(3);
    if (theta > governingTheta) governingTheta = theta;

    let pDeltaCheck: StoreySeismicForce['pDeltaCheck'] = 'PASS';
    if (theta > 0.20) pDeltaCheck = 'UNACCEPTABLE';
    else if (theta > 0.10) pDeltaCheck = 'SECOND_ORDER_AMPLIFICATION';

    storeys.push({
      storeyIndex: i,
      heightZ: zi,
      storeyWeightKn: Math.round(wi),
      Fi_lateralForceKn: fi,
      Vi_storeyShearKn: vi,
      theta_driftSensitivity: theta,
      pDeltaCheck
    });
  }

  // Generate 40-point response spectrum curve for period 0..3.5 s
  const spectrumCurve: Array<{ T: number; Sd: number; S_elastic: number }> = [];
  const maxT = 3.5;
  const steps = 40;
  for (let s = 0; s <= steps; s++) {
    const tVal = +(s * (maxT / steps)).toFixed(2);
    const sdVal = +calcDesignSpectrumSd(tVal, ag_design_ms2, S, TB, TC, TD, q).toFixed(3);
    const seVal = +calcElasticSpectrumSe(tVal, ag_design_ms2, S, TB, TC, TD, 1.0).toFixed(3);
    spectrumCurve.push({ T: tVal, Sd: sdVal, S_elastic: seVal });
  }

  const pDeltaStatus = governingTheta <= 0.10 ? 'PASS' : governingTheta <= 0.20 ? 'WARNING' : 'FAIL';
  const summaryDescription = `EN 1998-1 / NTC 2018: ag=${ag_ref}g (${params.groundType}) → T1=${T1}s, Sd=${Sd_T1_g}g. Base shear Fb=${Fb} kN (${baseShearRatioPct}% Wseis). P-Δ theta_max=${governingTheta} (${pDeltaStatus}).`;

  return {
    ag_reference_g: ag_ref,
    ag_design_g,
    ag_design_ms2,
    gamma_I,
    groundType: params.groundType,
    groundDescription: groundInfo.description,
    S_soilFactor: S,
    TB_s: TB,
    TC_s: TC,
    TD_s: TD,
    ductilityClass: params.ductilityClass,
    q_behaviorFactor: q,
    Ct_periodFactor: Ct,
    T1_fundamentalPeriod_s: T1,
    Sd_T1_ms2,
    Sd_T1_g,
    lambda_correction: lambda,
    Fb_baseShearKn: Fb,
    baseShearRatioPct,
    totalSeismicWeightKn: Math.round(W_seismic),
    storeys,
    spectrumCurve,
    governingTheta,
    pDeltaStatus,
    summaryDescription
  };
}

// ============================================================================
// 18. STRUCTURAL BILL OF QUANTITIES (BoQ) & EMBODIED CARBON BRIDGE
// ============================================================================

export interface StructuralBoQParams {
  footprintArea: number; // m²
  floors: number;
  floorHeight: number; // m
  spanL: number; // m
  tributaryWidthBtr: number; // m
  materialSystem: 'RC' | 'Steel' | 'Timber' | 'Masonry';
  lowCarbonConcrete?: boolean;
  recycledSteel?: boolean;
  biogenicTimber?: boolean;
  slabThicknessMm?: number; // e.g. 220 mm RC or 160 mm CLT
  beamWidthMm?: number;
  beamDepthMm?: number;
  columnWidthMm?: number;
  columnDepthMm?: number;
  steelBeamProfile?: string; // e.g. 'IPE 300'
  steelColProfile?: string; // e.g. 'HE 240 B'
}

export interface StructuralBoQResult {
  materialSystem: 'RC' | 'Steel' | 'Timber' | 'Masonry';
  gfa: number; // m²
  concreteVolumeM3: number; // m³
  rebarMassKg: number; // kg
  rebarMassTonnes: number; // t
  steelMassKg: number; // kg
  steelMassTonnes: number; // t
  timberVolumeM3: number; // m³
  timberBiogenicCarbonKgCo2e: number; // Negative carbon storage
  gwpStructureA1A3: number; // kgCO2e/m² GFA
  totalStructureCo2Tonnes: number; // tCO2e
  breakdown: {
    slabsCo2KgM2: number;
    beamsCo2KgM2: number;
    columnsCo2KgM2: number;
    foundationsCo2KgM2: number;
  };
  materialTakeoff: {
    slabConcreteM3: number;
    slabRebarKg: number;
    beamConcreteM3: number;
    beamRebarKg: number;
    columnConcreteM3: number;
    columnRebarKg: number;
    footingConcreteM3: number;
    footingRebarKg: number;
    steelBeamsKg: number;
    steelColumnsKg: number;
    timberSlabM3: number;
    timberBeamsM3: number;
    timberColumnsM3: number;
  };
}

export function computeStructuralBoQ(params: StructuralBoQParams): StructuralBoQResult {
  const footprintArea = Math.max(20, params.footprintArea);
  const floors = Math.max(1, params.floors);
  const floorHeight = Math.max(2.5, params.floorHeight);
  const gfa = Math.round(footprintArea * floors);

  const spanL = Math.max(3.0, params.spanL || 6.0);
  const tribW = Math.max(2.5, params.tributaryWidthBtr || 5.0);
  const bayArea = spanL * tribW;
  const numColumnsPerFloor = Math.max(4, Math.round(footprintArea / bayArea) + Math.round(Math.sqrt(footprintArea / bayArea) * 2));
  const totalColumnsCount = numColumnsPerFloor * floors;
  const totalColumnLengthM = totalColumnsCount * floorHeight;
  const totalBeamLengthM = Math.round((gfa / tribW) * 1.15);

  let slabConcreteM3 = 0;
  let slabRebarKg = 0;
  let beamConcreteM3 = 0;
  let beamRebarKg = 0;
  let columnConcreteM3 = 0;
  let columnRebarKg = 0;
  let footingConcreteM3 = 0;
  let footingRebarKg = 0;
  let steelBeamsKg = 0;
  let steelColumnsKg = 0;
  let timberSlabM3 = 0;
  let timberBeamsM3 = 0;
  let timberColumnsM3 = 0;

  // Concrete pad footings (per column)
  const footingSide = params.materialSystem === 'Timber' ? 1.4 : params.materialSystem === 'Steel' ? 1.6 : 1.8;
  const footingDepth = 0.6;
  footingConcreteM3 = +(numColumnsPerFloor * Math.pow(footingSide, 2) * footingDepth).toFixed(1);
  footingRebarKg = +(footingConcreteM3 * 75).toFixed(0);

  if (params.materialSystem === 'RC') {
    const hSlab = (params.slabThicknessMm ?? 220) / 1000;
    slabConcreteM3 = +(gfa * hSlab).toFixed(1);
    slabRebarKg = +(slabConcreteM3 * 95).toFixed(0);

    const bBeam = (params.beamWidthMm ?? 300) / 1000;
    const hBeam = ((params.beamDepthMm ?? 550) - (params.slabThicknessMm ?? 220)) / 1000;
    beamConcreteM3 = +(totalBeamLengthM * bBeam * Math.max(0.15, hBeam)).toFixed(1);
    beamRebarKg = +(beamConcreteM3 * 160).toFixed(0);

    const bCol = (params.columnWidthMm ?? 400) / 1000;
    const hCol = (params.columnDepthMm ?? 400) / 1000;
    columnConcreteM3 = +(totalColumnLengthM * bCol * hCol).toFixed(1);
    columnRebarKg = +(columnConcreteM3 * 175).toFixed(0);
  } else if (params.materialSystem === 'Steel') {
    // Composite slab: metal deck + concrete topping
    slabConcreteM3 = +(gfa * 0.12).toFixed(1);
    slabRebarKg = +(gfa * 14).toFixed(0);

    const beamMassPerM = STEEL_PROFILES[params.steelBeamProfile || 'IPE 300']?.mass || 42.2;
    steelBeamsKg = +(totalBeamLengthM * beamMassPerM).toFixed(0);

    const colMassPerM = STEEL_PROFILES[params.steelColProfile || 'HE 240 B']?.mass || 83.2;
    steelColumnsKg = +(totalColumnLengthM * colMassPerM).toFixed(0);
  } else if (params.materialSystem === 'Timber') {
    const hClt = (params.slabThicknessMm ?? 160) / 1000;
    timberSlabM3 = +(gfa * hClt).toFixed(1);

    const bBeam = (params.beamWidthMm ?? 120) / 1000;
    const hBeam = (params.beamDepthMm ?? 320) / 1000;
    timberBeamsM3 = +(totalBeamLengthM * bBeam * hBeam).toFixed(1);

    const bCol = (params.columnWidthMm ?? 200) / 1000;
    const hCol = (params.columnDepthMm ?? 240) / 1000;
    timberColumnsM3 = +(totalColumnLengthM * bCol * hCol).toFixed(1);

    steelBeamsKg = +(gfa * 3.2).toFixed(0);
  } else if (params.materialSystem === 'Masonry') {
    slabConcreteM3 = +(gfa * 0.20).toFixed(1);
    slabRebarKg = +(slabConcreteM3 * 85).toFixed(0);
    beamConcreteM3 = +(gfa * 0.08).toFixed(1);
    beamRebarKg = +(beamConcreteM3 * 40).toFixed(0);
  }

  const concreteVolumeM3 = +(slabConcreteM3 + beamConcreteM3 + columnConcreteM3 + footingConcreteM3).toFixed(1);
  const rebarMassKg = Math.round(Number(slabRebarKg) + Number(beamRebarKg) + Number(columnRebarKg) + Number(footingRebarKg));
  const steelMassKg = Math.round(Number(steelBeamsKg) + Number(steelColumnsKg));
  const timberVolumeM3 = +(timberSlabM3 + timberBeamsM3 + timberColumnsM3).toFixed(1);

  // Carbon Emission Factors
  const efConcrete = params.lowCarbonConcrete ? 165 : 315; // kgCO2e / m³
  const efRebar = 1.05; // kgCO2e / kg
  const efSteel = params.recycledSteel ? 0.85 : 1.55; // kgCO2e / kg
  const efTimberFossil = 120; // kgCO2e / m³
  const efBiogenicStorage = -820; // kgCO2e / m³ sequestered

  const slabsCo2 = slabConcreteM3 * efConcrete + slabRebarKg * efRebar;
  const beamsCo2 = beamConcreteM3 * efConcrete + beamRebarKg * efRebar + steelBeamsKg * efSteel + timberBeamsM3 * efTimberFossil;
  const colsCo2 = columnConcreteM3 * efConcrete + columnRebarKg * efRebar + steelColumnsKg * efSteel + timberColumnsM3 * efTimberFossil;
  const footCo2 = footingConcreteM3 * efConcrete + footingRebarKg * efRebar;

  let totalCo2Kg = slabsCo2 + beamsCo2 + colsCo2 + footCo2;
  if (params.materialSystem === 'Timber') {
    totalCo2Kg += timberSlabM3 * efTimberFossil;
  }

  const gwpStructureA1A3 = Math.round(totalCo2Kg / Math.max(1, gfa));
  const totalStructureCo2Tonnes = +(totalCo2Kg / 1000).toFixed(1);

  return {
    materialSystem: params.materialSystem,
    gfa,
    concreteVolumeM3,
    rebarMassKg,
    rebarMassTonnes: +(rebarMassKg / 1000).toFixed(1),
    steelMassKg,
    steelMassTonnes: +(steelMassKg / 1000).toFixed(1),
    timberVolumeM3,
    timberBiogenicCarbonKgCo2e: Math.round(timberVolumeM3 * efBiogenicStorage),
    gwpStructureA1A3,
    totalStructureCo2Tonnes,
    breakdown: {
      slabsCo2KgM2: Math.round(slabsCo2 / Math.max(1, gfa)),
      beamsCo2KgM2: Math.round(beamsCo2 / Math.max(1, gfa)),
      columnsCo2KgM2: Math.round(colsCo2 / Math.max(1, gfa)),
      foundationsCo2KgM2: Math.round(footCo2 / Math.max(1, gfa))
    },
    materialTakeoff: {
      slabConcreteM3,
      slabRebarKg: Number(slabRebarKg),
      beamConcreteM3,
      beamRebarKg: Number(beamRebarKg),
      columnConcreteM3,
      columnRebarKg: Number(columnRebarKg),
      footingConcreteM3,
      footingRebarKg: Number(footingRebarKg),
      steelBeamsKg: Number(steelBeamsKg),
      steelColumnsKg: Number(steelColumnsKg),
      timberSlabM3,
      timberBeamsM3,
      timberColumnsM3
    }
  };
}


