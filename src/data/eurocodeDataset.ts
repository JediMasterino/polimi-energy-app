// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING DATABASE
// Implements complete datasets from BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx
// Standard: EN 1990, EN 1991-1-1, EN 1992-1-1, EN 1993-1-1, EN 1995-1-1, EN 1996-1-1
// © Politecnico di Milano, DABC Department - Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
// ============================================================================

// ----------------------------------------------------------------------------
// 1. CONCRETE CLASSES - EN 1992-1-1 TABLE 3.1
// ----------------------------------------------------------------------------
export interface ConcreteClassData {
  class: string;
  fck: number;     // MPa - Characteristic cylinder compressive strength
  fctm: number;    // MPa - Mean axial tensile strength
  Ecm: number;     // MPa - Secant modulus of elasticity
  density: number; // kN/m³ - Normal-weight reinforced concrete
}

export const CONCRETE_CLASSES: Record<string, ConcreteClassData> = {
  'C20/25': { class: 'C20/25', fck: 20, fctm: 2.2, Ecm: 30000, density: 25 },
  'C25/30': { class: 'C25/30', fck: 25, fctm: 2.6, Ecm: 31000, density: 25 },
  'C30/37': { class: 'C30/37', fck: 30, fctm: 2.9, Ecm: 33000, density: 25 },
  'C35/45': { class: 'C35/45', fck: 35, fctm: 3.2, Ecm: 34000, density: 25 },
  'C40/50': { class: 'C40/50', fck: 40, fctm: 3.5, Ecm: 35000, density: 25 },
  'C45/55': { class: 'C45/55', fck: 45, fctm: 3.8, Ecm: 36000, density: 25 },
  'C50/60': { class: 'C50/60', fck: 50, fctm: 4.1, Ecm: 37000, density: 25 }
};

// ----------------------------------------------------------------------------
// 2. TIMBER & GLULAM STRENGTH CLASSES - EN 338:2016 / EN 14080:2013
// ----------------------------------------------------------------------------
export interface TimberClassData {
  class: string;
  type: 'Solid' | 'Glulam';
  fmk: number;    // MPa - Characteristic bending strength
  fc0k: number;   // MPa - Compression parallel to grain
  fvk: number;    // MPa - Shear strength
  fc90k: number;  // MPa - Compression perpendicular to grain
  Emean: number;  // MPa - Mean modulus of elasticity parallel
  E05: number;    // MPa - 5th percentile modulus of elasticity parallel
  Gmean: number;  // MPa - Mean shear modulus
  density: number;// kN/m³ - Adopted design unit weight
}

export const TIMBER_CLASSES: Record<string, TimberClassData> = {
  'C18': { class: 'C18', type: 'Solid', fmk: 18, fc0k: 18, fvk: 3.4, fc90k: 2.2, Emean: 9000, E05: 6000, Gmean: 560, density: 4.5 },
  'C24': { class: 'C24', type: 'Solid', fmk: 24, fc0k: 21, fvk: 4.0, fc90k: 2.5, Emean: 11000, E05: 7400, Gmean: 690, density: 5.0 },
  'C30': { class: 'C30', type: 'Solid', fmk: 30, fc0k: 24, fvk: 4.0, fc90k: 2.7, Emean: 12000, E05: 8000, Gmean: 750, density: 5.0 },
  'GL24h': { class: 'GL24h', type: 'Glulam', fmk: 24, fc0k: 24, fvk: 3.5, fc90k: 2.5, Emean: 11500, E05: 9600, Gmean: 650, density: 5.0 },
  'GL28h': { class: 'GL28h', type: 'Glulam', fmk: 28, fc0k: 28, fvk: 3.5, fc90k: 2.5, Emean: 12600, E05: 10500, Gmean: 650, density: 5.0 },
  'GL32h': { class: 'GL32h', type: 'Glulam', fmk: 32, fc0k: 32, fvk: 3.5, fc90k: 2.5, Emean: 14200, E05: 11800, Gmean: 650, density: 5.5 }
};

// EN 1995-1-1 Table 3.1: Modification factor kmod
export type TimberLoadDuration = 'Permanent' | 'Long-term' | 'Medium-term' | 'Short-term' | 'Instantaneous';

export const TIMBER_KMOD: Record<TimberLoadDuration, Record<1 | 2 | 3, number>> = {
  'Permanent':     { 1: 0.60, 2: 0.60, 3: 0.50 },
  'Long-term':     { 1: 0.70, 2: 0.70, 3: 0.55 },
  'Medium-term':   { 1: 0.80, 2: 0.80, 3: 0.65 },
  'Short-term':    { 1: 0.90, 2: 0.90, 3: 0.70 },
  'Instantaneous': { 1: 1.10, 2: 1.10, 3: 0.90 }
};

// EN 1995-1-1 Table 3.2: Deformation factor kdef
export const TIMBER_KDEF: Record<'Solid' | 'Glulam', Record<1 | 2 | 3, number>> = {
  'Solid':  { 1: 0.60, 2: 0.80, 3: 2.00 },
  'Glulam': { 1: 0.60, 2: 0.80, 3: 2.00 }
};

// ----------------------------------------------------------------------------
// 3. STEEL PROFILES (52 Profiles exact from Workbook EC Dataset)
// IPE, HEA, HEB, SHS (HF/CF), CHS (HF/CF)
// ----------------------------------------------------------------------------
export type SteelProfileFamily = 'IPE' | 'HEA' | 'HEB' | 'SHS_HF' | 'SHS_CF' | 'CHS_HF' | 'CHS_CF';

export interface SteelProfileData {
  profile: string;
  family: SteelProfileFamily;
  type: 'I_H' | 'SHS' | 'CHS';
  manufacturing: 'Hot-Finished' | 'Cold-Formed';
  h: number;      // mm - depth or outer diameter
  b: number;      // mm - width or outer diameter
  tw: number;     // mm - web or wall thickness
  tf: number;     // mm - flange or wall thickness
  root: number | null; // mm - root radius for I/H (null for tubes)
  A: number;      // cm² - Gross area
  Iy: number;     // cm⁴ - Second moment about y-y (strong)
  Iz: number;     // cm⁴ - Second moment about z-z (weak)
  Wy: number;     // cm³ - Elastic modulus about y-y
  Wz: number;     // cm³ - Elastic modulus about z-z
  mass: number;   // kg/m - Mass per metre
  It: number;     // cm⁴ - St Venant torsion constant
  Iw: number;     // dm⁶ - Warping constant (0 for tubes)
}

export const STEEL_PROFILES: Record<string, SteelProfileData> = {
  // IPE Sections (EN 10034)
  'IPE 200': { profile: 'IPE 200', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 200, b: 100, tw: 5.6, tf: 8.5, root: 12, A: 28.5, Iy: 1940, Iz: 142, Wy: 194, Wz: 29, mass: 22.4, It: 6.92, Iw: 0.013 },
  'IPE 240': { profile: 'IPE 240', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 240, b: 120, tw: 6.2, tf: 9.8, root: 15, A: 39.1, Iy: 3890, Iz: 284, Wy: 324, Wz: 47, mass: 30.7, It: 13.0, Iw: 0.0374 },
  'IPE 270': { profile: 'IPE 270', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 270, b: 135, tw: 6.6, tf: 10.2, root: 15, A: 45.9, Iy: 5790, Iz: 420, Wy: 429, Wz: 62, mass: 36.1, It: 15.9, Iw: 0.0706 },
  'IPE 300': { profile: 'IPE 300', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 300, b: 150, tw: 7.1, tf: 10.7, root: 15, A: 53.8, Iy: 8360, Iz: 604, Wy: 557, Wz: 81, mass: 42.2, It: 19.9, Iw: 0.126 },
  'IPE 360': { profile: 'IPE 360', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 360, b: 170, tw: 8.0, tf: 12.7, root: 18, A: 72.7, Iy: 16300, Iz: 1040, Wy: 904, Wz: 123, mass: 57.1, It: 37.4, Iw: 0.314 },
  'IPE 400': { profile: 'IPE 400', family: 'IPE', type: 'I_H', manufacturing: 'Hot-Finished', h: 400, b: 180, tw: 8.6, tf: 13.5, root: 21, A: 84.5, Iy: 23100, Iz: 1320, Wy: 1160, Wz: 146, mass: 66.3, It: 51.3, Iw: 0.490 },

  // HEA Sections (EN 10034)
  'HE 200 A': { profile: 'HE 200 A', family: 'HEA', type: 'I_H', manufacturing: 'Hot-Finished', h: 190, b: 200, tw: 6.5, tf: 10.0, root: 18, A: 53.8, Iy: 3690, Iz: 1340, Wy: 389, Wz: 134, mass: 42.3, It: 21.0, Iw: 0.108 },
  'HE 240 A': { profile: 'HE 240 A', family: 'HEA', type: 'I_H', manufacturing: 'Hot-Finished', h: 230, b: 240, tw: 7.5, tf: 12.0, root: 21, A: 76.8, Iy: 7760, Iz: 2770, Wy: 675, Wz: 231, mass: 60.3, It: 42.1, Iw: 0.328 },
  'HE 300 A': { profile: 'HE 300 A', family: 'HEA', type: 'I_H', manufacturing: 'Hot-Finished', h: 290, b: 300, tw: 8.5, tf: 14.0, root: 27, A: 112.0, Iy: 18300, Iz: 6310, Wy: 1260, Wz: 421, mass: 88.3, It: 87.8, Iw: 1.200 },

  // HEB Sections (EN 10034)
  'HE 200 B': { profile: 'HE 200 B', family: 'HEB', type: 'I_H', manufacturing: 'Hot-Finished', h: 200, b: 200, tw: 9.0, tf: 15.0, root: 18, A: 78.1, Iy: 5700, Iz: 2000, Wy: 570, Wz: 200, mass: 61.3, It: 59.7, Iw: 0.171 },
  'HE 240 B': { profile: 'HE 240 B', family: 'HEB', type: 'I_H', manufacturing: 'Hot-Finished', h: 240, b: 240, tw: 10.0, tf: 17.0, root: 21, A: 106.0, Iy: 11300, Iz: 3920, Wy: 938, Wz: 327, mass: 83.2, It: 104.0, Iw: 0.487 },
  'HE 300 B': { profile: 'HE 300 B', family: 'HEB', type: 'I_H', manufacturing: 'Hot-Finished', h: 300, b: 300, tw: 11.0, tf: 19.0, root: 27, A: 149.0, Iy: 25200, Iz: 8560, Wy: 1680, Wz: 571, mass: 117.0, It: 189.0, Iw: 1.690 },

  // Square Hollow Sections - Hot-Finished EN 10210
  'SHS HF 100x100x4':   { profile: 'SHS HF 100x100x4', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 100, b: 100, tw: 4.0, tf: 4.0, root: null, A: 15.2, Iy: 232, Iz: 232, Wy: 46.4, Wz: 46.4, mass: 11.9, It: 361, Iw: 0 },
  'SHS HF 100x100x6.3': { profile: 'SHS HF 100x100x6.3', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 100, b: 100, tw: 6.3, tf: 6.3, root: null, A: 23.2, Iy: 336, Iz: 336, Wy: 67.1, Wz: 67.1, mass: 18.2, It: 534, Iw: 0 },
  'SHS HF 120x120x6.3': { profile: 'SHS HF 120x120x6.3', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 120, b: 120, tw: 6.3, tf: 6.3, root: null, A: 28.2, Iy: 603, Iz: 603, Wy: 100.0, Wz: 100.0, mass: 22.2, It: 950, Iw: 0 },
  'SHS HF 150x150x5':   { profile: 'SHS HF 150x150x5', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 150, b: 150, tw: 5.0, tf: 5.0, root: null, A: 28.7, Iy: 1000, Iz: 1000, Wy: 134.0, Wz: 134.0, mass: 22.6, It: 1550, Iw: 0 },
  'SHS HF 150x150x8':   { profile: 'SHS HF 150x150x8', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 150, b: 150, tw: 8.0, tf: 8.0, root: null, A: 44.8, Iy: 1490, Iz: 1490, Wy: 199.0, Wz: 199.0, mass: 35.1, It: 2350, Iw: 0 },
  'SHS HF 200x200x5':   { profile: 'SHS HF 200x200x5', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 200, b: 200, tw: 5.0, tf: 5.0, root: null, A: 38.7, Iy: 2450, Iz: 2450, Wy: 245.0, Wz: 245.0, mass: 30.4, It: 3760, Iw: 0 },
  'SHS HF 200x200x8':   { profile: 'SHS HF 200x200x8', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 200, b: 200, tw: 8.0, tf: 8.0, root: null, A: 60.8, Iy: 3710, Iz: 3710, Wy: 371.0, Wz: 371.0, mass: 47.7, It: 5780, Iw: 0 },
  'SHS HF 250x250x6.3': { profile: 'SHS HF 250x250x6.3', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 250, b: 250, tw: 6.3, tf: 6.3, root: null, A: 61.0, Iy: 6010, Iz: 6010, Wy: 481.0, Wz: 481.0, mass: 47.9, It: 9240, Iw: 0 },
  'SHS HF 250x250x8':   { profile: 'SHS HF 250x250x8', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 250, b: 250, tw: 8.0, tf: 8.0, root: null, A: 76.8, Iy: 7460, Iz: 7460, Wy: 596.0, Wz: 596.0, mass: 60.3, It: 11500, Iw: 0 },
  'SHS HF 300x300x8':   { profile: 'SHS HF 300x300x8', family: 'SHS_HF', type: 'SHS', manufacturing: 'Hot-Finished', h: 300, b: 300, tw: 8.0, tf: 8.0, root: null, A: 92.8, Iy: 13100, Iz: 13100, Wy: 875.0, Wz: 875.0, mass: 72.8, It: 20200, Iw: 0 },

  // Square Hollow Sections - Cold-Formed EN 10219
  'SHS CF 100x100x4': { profile: 'SHS CF 100x100x4', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 100, b: 100, tw: 4.0, tf: 4.0, root: null, A: 14.9, Iy: 226, Iz: 226, Wy: 45.3, Wz: 45.3, mass: 11.7, It: 362, Iw: 0 },
  'SHS CF 100x100x6': { profile: 'SHS CF 100x100x6', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 100, b: 100, tw: 6.0, tf: 6.0, root: null, A: 21.6, Iy: 311, Iz: 311, Wy: 62.3, Wz: 62.3, mass: 17.0, It: 514, Iw: 0 },
  'SHS CF 120x120x6': { profile: 'SHS CF 120x120x6', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 120, b: 120, tw: 6.0, tf: 6.0, root: null, A: 26.4, Iy: 562, Iz: 562, Wy: 93.7, Wz: 93.7, mass: 20.7, It: 913, Iw: 0 },
  'SHS CF 150x150x5': { profile: 'SHS CF 150x150x5', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 150, b: 150, tw: 5.0, tf: 5.0, root: null, A: 28.4, Iy: 982, Iz: 982, Wy: 131.0, Wz: 131.0, mass: 22.3, It: 1550, Iw: 0 },
  'SHS CF 150x150x8': { profile: 'SHS CF 150x150x8', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 150, b: 150, tw: 8.0, tf: 8.0, root: null, A: 43.2, Iy: 1410, Iz: 1410, Wy: 188.0, Wz: 188.0, mass: 33.9, It: 2360, Iw: 0 },
  'SHS CF 200x200x5': { profile: 'SHS CF 200x200x5', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 200, b: 200, tw: 5.0, tf: 5.0, root: null, A: 38.4, Iy: 2410, Iz: 2410, Wy: 241.0, Wz: 241.0, mass: 30.1, It: 3760, Iw: 0 },
  'SHS CF 200x200x8': { profile: 'SHS CF 200x200x8', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 200, b: 200, tw: 8.0, tf: 8.0, root: null, A: 59.2, Iy: 3570, Iz: 3570, Wy: 357.0, Wz: 357.0, mass: 46.5, It: 5820, Iw: 0 },
  'SHS CF 250x250x6': { profile: 'SHS CF 250x250x6', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 250, b: 250, tw: 6.0, tf: 6.0, root: null, A: 57.6, Iy: 5670, Iz: 5670, Wy: 454.0, Wz: 454.0, mass: 45.2, It: 8840, Iw: 0 },
  'SHS CF 250x250x8': { profile: 'SHS CF 250x250x8', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 250, b: 250, tw: 8.0, tf: 8.0, root: null, A: 75.2, Iy: 7230, Iz: 7230, Wy: 578.0, Wz: 578.0, mass: 59.1, It: 11600, Iw: 0 },
  'SHS CF 300x300x8': { profile: 'SHS CF 300x300x8', family: 'SHS_CF', type: 'SHS', manufacturing: 'Cold-Formed', h: 300, b: 300, tw: 8.0, tf: 8.0, root: null, A: 91.2, Iy: 12800, Iz: 12800, Wy: 853.0, Wz: 853.0, mass: 71.6, It: 20300, Iw: 0 },

  // Circular Hollow Sections - Hot-Finished EN 10210
  'CHS HF 114.3x5':   { profile: 'CHS HF 114.3x5', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 114.3, b: 114.3, tw: 5.0, tf: 5.0, root: null, A: 17.2, Iy: 257, Iz: 257, Wy: 45.0, Wz: 45.0, mass: 13.5, It: 514, Iw: 0 },
  'CHS HF 139.7x5':   { profile: 'CHS HF 139.7x5', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 139.7, b: 139.7, tw: 5.0, tf: 5.0, root: null, A: 21.2, Iy: 481, Iz: 481, Wy: 68.8, Wz: 68.8, mass: 16.6, It: 961, Iw: 0 },
  'CHS HF 168.3x5':   { profile: 'CHS HF 168.3x5', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 168.3, b: 168.3, tw: 5.0, tf: 5.0, root: null, A: 25.7, Iy: 856, Iz: 856, Wy: 102.0, Wz: 102.0, mass: 20.1, It: 1710, Iw: 0 },
  'CHS HF 168.3x8':   { profile: 'CHS HF 168.3x8', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 168.3, b: 168.3, tw: 8.0, tf: 8.0, root: null, A: 40.3, Iy: 1300, Iz: 1300, Wy: 154.0, Wz: 154.0, mass: 31.6, It: 2600, Iw: 0 },
  'CHS HF 193.7x6.3': { profile: 'CHS HF 193.7x6.3', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 193.7, b: 193.7, tw: 6.3, tf: 6.3, root: null, A: 37.1, Iy: 1630, Iz: 1630, Wy: 168.0, Wz: 168.0, mass: 29.1, It: 3260, Iw: 0 },
  'CHS HF 219.1x6.3': { profile: 'CHS HF 219.1x6.3', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 219.1, b: 219.1, tw: 6.3, tf: 6.3, root: null, A: 42.1, Iy: 2390, Iz: 2390, Wy: 218.0, Wz: 218.0, mass: 33.1, It: 4770, Iw: 0 },
  'CHS HF 219.1x8':   { profile: 'CHS HF 219.1x8', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 219.1, b: 219.1, tw: 8.0, tf: 8.0, root: null, A: 53.1, Iy: 2960, Iz: 2960, Wy: 270.0, Wz: 270.0, mass: 41.6, It: 5920, Iw: 0 },
  'CHS HF 219.1x10':  { profile: 'CHS HF 219.1x10', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 219.1, b: 219.1, tw: 10.0, tf: 10.0, root: null, A: 65.7, Iy: 3600, Iz: 3600, Wy: 328.0, Wz: 328.0, mass: 51.6, It: 7200, Iw: 0 },
  'CHS HF 273x10':    { profile: 'CHS HF 273x10', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 273.0, b: 273.0, tw: 10.0, tf: 10.0, root: null, A: 82.6, Iy: 7150, Iz: 7150, Wy: 524.0, Wz: 524.0, mass: 64.9, It: 14300, Iw: 0 },
  'CHS HF 323.9x10':  { profile: 'CHS HF 323.9x10', family: 'CHS_HF', type: 'CHS', manufacturing: 'Hot-Finished', h: 323.9, b: 323.9, tw: 10.0, tf: 10.0, root: null, A: 98.6, Iy: 12200, Iz: 12200, Wy: 751.0, Wz: 751.0, mass: 77.4, It: 24300, Iw: 0 },

  // Circular Hollow Sections - Cold-Formed EN 10219
  'CHS CF 114.3x5':   { profile: 'CHS CF 114.3x5', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 114.3, b: 114.3, tw: 5.0, tf: 5.0, root: null, A: 17.2, Iy: 257, Iz: 257, Wy: 45.0, Wz: 45.0, mass: 13.5, It: 514, Iw: 0 },
  'CHS CF 139.7x5':   { profile: 'CHS CF 139.7x5', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 139.7, b: 139.7, tw: 5.0, tf: 5.0, root: null, A: 21.2, Iy: 481, Iz: 481, Wy: 68.8, Wz: 68.8, mass: 16.6, It: 961, Iw: 0 },
  'CHS CF 168.3x5':   { profile: 'CHS CF 168.3x5', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 168.3, b: 168.3, tw: 5.0, tf: 5.0, root: null, A: 25.7, Iy: 856, Iz: 856, Wy: 102.0, Wz: 102.0, mass: 20.1, It: 1710, Iw: 0 },
  'CHS CF 168.3x8':   { profile: 'CHS CF 168.3x8', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 168.3, b: 168.3, tw: 8.0, tf: 8.0, root: null, A: 40.3, Iy: 1300, Iz: 1300, Wy: 154.0, Wz: 154.0, mass: 31.6, It: 2600, Iw: 0 },
  'CHS CF 193.7x6.3': { profile: 'CHS CF 193.7x6.3', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 193.7, b: 193.7, tw: 6.3, tf: 6.3, root: null, A: 37.1, Iy: 1630, Iz: 1630, Wy: 168.0, Wz: 168.0, mass: 29.1, It: 3260, Iw: 0 },
  'CHS CF 219.1x6.3': { profile: 'CHS CF 219.1x6.3', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 219.1, b: 219.1, tw: 6.3, tf: 6.3, root: null, A: 42.1, Iy: 2390, Iz: 2390, Wy: 218.0, Wz: 218.0, mass: 33.1, It: 4770, Iw: 0 },
  'CHS CF 219.1x8':   { profile: 'CHS CF 219.1x8', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 219.1, b: 219.1, tw: 8.0, tf: 8.0, root: null, A: 53.1, Iy: 2960, Iz: 2960, Wy: 270.0, Wz: 270.0, mass: 41.6, It: 5920, Iw: 0 },
  'CHS CF 219.1x10':  { profile: 'CHS CF 219.1x10', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 219.1, b: 219.1, tw: 10.0, tf: 10.0, root: null, A: 65.7, Iy: 3600, Iz: 3600, Wy: 328.0, Wz: 328.0, mass: 51.6, It: 7200, Iw: 0 },
  'CHS CF 273x10':    { profile: 'CHS CF 273x10', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 273.0, b: 273.0, tw: 10.0, tf: 10.0, root: null, A: 82.6, Iy: 7150, Iz: 7150, Wy: 524.0, Wz: 524.0, mass: 64.9, It: 14300, Iw: 0 },
  'CHS CF 323.9x10':  { profile: 'CHS CF 323.9x10', family: 'CHS_CF', type: 'CHS', manufacturing: 'Cold-Formed', h: 323.9, b: 323.9, tw: 10.0, tf: 10.0, root: null, A: 98.6, Iy: 12200, Iz: 12200, Wy: 751.0, Wz: 751.0, mass: 77.4, It: 24300, Iw: 0 }
};

// ----------------------------------------------------------------------------
// 4. MASONRY GROUPS & K VALUES - EN 1996-1-1 TABLE 3.3
// ----------------------------------------------------------------------------
export interface MasonryGroupData {
  name: string;
  KEN: number;       // Reference constant K per EN 1996-1-1 Table 3.3
  family: string;    // Material family
  standard: string;  // Product standard
}

export const MASONRY_GROUPS: Record<string, MasonryGroupData> = {
  'Clay / G1': { name: 'Clay / G1', KEN: 0.55, family: 'Fired clay (laterizio)', standard: 'EN 771-1' },
  'Clay / G2': { name: 'Clay / G2', KEN: 0.45, family: 'Fired clay (laterizio)', standard: 'EN 771-1' },
  'Clay / G3': { name: 'Clay / G3', KEN: 0.35, family: 'Fired clay (laterizio)', standard: 'EN 771-1' },
  'Clay / G4': { name: 'Clay / G4', KEN: 0.35, family: 'Fired clay (laterizio)', standard: 'EN 771-1' },
  'Calcium silicate / G1': { name: 'Calcium silicate / G1', KEN: 0.55, family: 'Calcium silicate', standard: 'EN 771-2' },
  'Calcium silicate / G2': { name: 'Calcium silicate / G2', KEN: 0.45, family: 'Calcium silicate', standard: 'EN 771-2' },
  'Concrete / G1': { name: 'Concrete / G1', KEN: 0.55, family: 'Dense/lightweight aggregate concrete', standard: 'EN 771-3' },
  'Concrete / G2': { name: 'Concrete / G2', KEN: 0.45, family: 'Dense/lightweight aggregate concrete', standard: 'EN 771-3' },
  'Concrete / G3': { name: 'Concrete / G3', KEN: 0.40, family: 'Dense/lightweight aggregate concrete', standard: 'EN 771-3' },
  'Concrete / G4': { name: 'Concrete / G4', KEN: 0.35, family: 'Dense/lightweight aggregate concrete', standard: 'EN 771-3' },
  'AAC / G1': { name: 'AAC / G1', KEN: 0.55, family: 'Autoclaved aerated concrete', standard: 'EN 771-4' },
  'Manufactured stone / G1': { name: 'Manufactured stone / G1', KEN: 0.45, family: 'Manufactured stone', standard: 'EN 771-5' },
  'Natural stone / G1': { name: 'Natural stone / G1', KEN: 0.45, family: 'Dimensioned natural stone', standard: 'EN 771-6' }
};

// ----------------------------------------------------------------------------
// 5. NATIONAL ANNEX PRESETS & EN 1991-1-1 OCCUPANCY LOADS
// ----------------------------------------------------------------------------
export type NationalAnnexId = 'EN_RECOMMENDED' | 'IT_NTC' | 'UK_BS' | 'DE_DIN' | 'FR_NF' | 'CUSTOM';

export interface NationalAnnexData {
  id: NationalAnnexId;
  name: string;
  country: string;
  gammaG: number;
  gammaQ: number;
  gammaC: number;
  gammaS: number;
  alphaCC: number;
  gammaM0: number;
  gammaM1: number;
  gammaM_solid: number;
  gammaM_glulam: number;
  gammaM_m: number;
  gammaM_v: number;
  description: string;
}

export const NATIONAL_ANNEX_PRESETS: Record<NationalAnnexId, NationalAnnexData> = {
  EN_RECOMMENDED: {
    id: 'EN_RECOMMENDED',
    name: 'EN Recommended Defaults',
    country: 'CEN / Eurocodes',
    gammaG: 1.35,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 1.00,
    gammaM0: 1.00,
    gammaM1: 1.00,
    gammaM_solid: 1.30,
    gammaM_glulam: 1.25,
    gammaM_m: 2.50,
    gammaM_v: 2.50,
    description: 'First-generation EN 1990 recommended partial factors'
  },
  IT_NTC: {
    id: 'IT_NTC',
    name: 'Italy (NTC 2018 / Circolare 2019)',
    country: 'Italy',
    gammaG: 1.30,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 0.85,
    gammaM0: 1.05,
    gammaM1: 1.05,
    gammaM_solid: 1.45,
    gammaM_glulam: 1.45,
    gammaM_m: 2.50,
    gammaM_v: 2.50,
    description: 'Italian Norme Tecniche per le Costruzioni (NTC 2018, alphaCC=0.85)'
  },
  UK_BS: {
    id: 'UK_BS',
    name: 'United Kingdom (BS EN NA)',
    country: 'United Kingdom',
    gammaG: 1.35,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 0.85,
    gammaM0: 1.00,
    gammaM1: 1.00,
    gammaM_solid: 1.30,
    gammaM_glulam: 1.25,
    gammaM_m: 2.70,
    gammaM_v: 2.50,
    description: 'UK National Annex to Eurocodes (alphaCC=0.85, gammaM,m=2.7)'
  },
  DE_DIN: {
    id: 'DE_DIN',
    name: 'Germany (DIN EN NA)',
    country: 'Germany',
    gammaG: 1.35,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 0.85,
    gammaM0: 1.00,
    gammaM1: 1.10,
    gammaM_solid: 1.30,
    gammaM_glulam: 1.25,
    gammaM_m: 2.00,
    gammaM_v: 2.00,
    description: 'German DIN National Annex (gammaM1=1.10 for instability)'
  },
  FR_NF: {
    id: 'FR_NF',
    name: 'France (NF EN NA)',
    country: 'France',
    gammaG: 1.35,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 1.00,
    gammaM0: 1.00,
    gammaM1: 1.00,
    gammaM_solid: 1.30,
    gammaM_glulam: 1.25,
    gammaM_m: 2.50,
    gammaM_v: 2.50,
    description: 'French NF National Annex to Eurocodes'
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Project Specification',
    country: 'Custom',
    gammaG: 1.35,
    gammaQ: 1.50,
    gammaC: 1.50,
    gammaS: 1.15,
    alphaCC: 1.00,
    gammaM0: 1.00,
    gammaM1: 1.00,
    gammaM_solid: 1.30,
    gammaM_glulam: 1.25,
    gammaM_m: 2.50,
    gammaM_v: 2.50,
    description: 'Fully user-editable partial safety factors'
  }
};

// EN 1991-1-1 Table 6.1 Occupancy Categories
export interface OccupancyLoadPreset {
  category: string;
  name: string;
  description: string;
  qk: number;       // kN/m²
  gk_add: number;   // kN/m² typical finishes & partitions
  psi0: number;
  psi1: number;
  psi2: number;
}

export const OCCUPANCY_LOAD_PRESETS: Record<string, OccupancyLoadPreset> = {
  'Cat_A_Residential': {
    category: 'Category A',
    name: 'Residential (Habitable, Bedrooms, Hotel Rooms)',
    description: 'Rooms in residential buildings, hotel guestrooms, hospital bedrooms',
    qk: 2.0,
    gk_add: 2.5,
    psi0: 0.7,
    psi1: 0.5,
    psi2: 0.3
  },
  'Cat_B_Office': {
    category: 'Category B',
    name: 'Office Areas & Administration',
    description: 'Offices, conference rooms, light clerical work with movable partitions',
    qk: 3.0,
    gk_add: 2.5,
    psi0: 0.7,
    psi1: 0.5,
    psi2: 0.3
  },
  'Cat_C_Assembly': {
    category: 'Category C',
    name: 'Assembly & Public Congregations (Cat C1-C3)',
    description: 'Classrooms, dining rooms, reading rooms, theatres, museums, exhibition halls',
    qk: 4.0,
    gk_add: 3.0,
    psi0: 0.7,
    psi1: 0.7,
    psi2: 0.6
  },
  'Cat_D_Retail': {
    category: 'Category D',
    name: 'Shopping Areas & Retail Stores (Cat D1-D2)',
    description: 'General retail stores, department stores, supermarkets',
    qk: 5.0,
    gk_add: 3.0,
    psi0: 0.7,
    psi1: 0.7,
    psi2: 0.6
  },
  'Cat_Roof_Inaccessible': {
    category: 'Category H',
    name: 'Roofs (Not accessible except normal maintenance)',
    description: 'Flat or pitched roofs without regular public access',
    qk: 0.75,
    gk_add: 2.0,
    psi0: 0.0,
    psi1: 0.0,
    psi2: 0.0
  }
};

// ----------------------------------------------------------------------------
// 6. UPFRONT EMBODIED CARBON BENCHMARKS (EN 15978 Module A1-A3)
// Synced with Project LCA Module
// ----------------------------------------------------------------------------
export const EMBODIED_CARBON_FACTORS = {
  concrete_C30: 0.125,       // kg CO2e / kg concrete (~310 kgCO2e/m³)
  rebar: 1.45,               // kg CO2e / kg steel rebar
  structural_steel: 1.85,    // kg CO2e / kg fabricated structural steel
  glulam: -0.45,             // kg CO2e / kg timber (biogenic carbon storage considered, cradle-to-gate ~120 kgCO2e/m³)
  glulam_fossil_only: 0.42,  // kg CO2e / kg timber (gross upfront processing emission)
  clt: -0.42,                // kg CO2e / kg CLT net
  clt_fossil_only: 0.45,     // kg CO2e / kg CLT upfront processing
  masonry_clay: 0.22,        // kg CO2e / kg fired clay brick (~390 kgCO2e/m³)
  mortar: 0.18               // kg CO2e / kg cementitious mortar
};

