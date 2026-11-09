// ============================================================================
// POLIMI BEM STUDIO - HIGH PERFORMANCE GLAZING & COMPONENT LIBRARY
// Real-world envelope specs with thermal transmittance, SHGC, daylight VT,
// acoustic rating, embodied carbon, and cost indices.
// ============================================================================

export interface GlazingSystemPreset {
  id: string;
  name: string;
  description: string;
  panes: 'double' | 'triple' | 'vacuum' | 'dynamic';
  uValue: number;      // W/m2K
  shgc: number;        // Solar Heat Gain Coefficient (g-value)
  visTrans: number;    // Visible Light Transmittance (VT)
  embodiedCarbonKgM2: number; // kgCO2e/m2
  costEurM2: number;   // €/m2
  acousticRwDb: number; // Sound reduction index dB
  bestFor: string;
}

export const GLAZING_LIBRARY: GlazingSystemPreset[] = [
  {
    id: 'standard_double_clear',
    name: 'Standard Double Glazed (Air 12mm)',
    description: '4mm Float + 12mm Air + 4mm Float. Baseline code-minimum glass for mild climates.',
    panes: 'double',
    uValue: 2.70,
    shgc: 0.72,
    visTrans: 0.78,
    embodiedCarbonKgM2: 24,
    costEurM2: 110,
    acousticRwDb: 31,
    bestFor: 'Baseline / Renovation Benchmark'
  },
  {
    id: 'low_e_double_argon',
    name: 'Low-E Double Glazed (Argon 16mm)',
    description: '6mm Low-E (soft coat) + 16mm 90% Argon + 6mm Float. Italian DM 2015 standard.',
    panes: 'double',
    uValue: 1.25,
    shgc: 0.52,
    visTrans: 0.71,
    embodiedCarbonKgM2: 32,
    costEurM2: 175,
    acousticRwDb: 35,
    bestFor: 'nZEB Italian Zone E (Milan, Turin, Bologna)'
  },
  {
    id: 'solar_control_double',
    name: 'Selective Solar Control Double (Argon)',
    description: 'High selectivity soft-coat: blocks IR heat while preserving high visible light transmission.',
    panes: 'double',
    uValue: 1.15,
    shgc: 0.36,
    visTrans: 0.65,
    embodiedCarbonKgM2: 35,
    costEurM2: 210,
    acousticRwDb: 36,
    bestFor: 'Commercial Offices & Mediterranean Zone B/C (Rome, Naples)'
  },
  {
    id: 'triple_low_e_argon',
    name: 'Triple Glazed Low-E (2× Argon 16mm)',
    description: 'High performance triple glazing: 2 soft low-e coatings with warm-edge composite spacers.',
    panes: 'triple',
    uValue: 0.65,
    shgc: 0.48,
    visTrans: 0.62,
    embodiedCarbonKgM2: 52,
    costEurM2: 290,
    acousticRwDb: 40,
    bestFor: 'Passivhaus Standard & Alpine Zone F (Bormio, Trento)'
  },
  {
    id: 'triple_solar_control',
    name: 'Triple Glazed Solar Control (Argon/Krypton)',
    description: 'Ultra-low heat loss with intense solar rejection for all-glass curtain walls.',
    panes: 'triple',
    uValue: 0.55,
    shgc: 0.28,
    visTrans: 0.52,
    embodiedCarbonKgM2: 58,
    costEurM2: 340,
    acousticRwDb: 42,
    bestFor: 'Fully Glazed Facades & Severe Solar Exposure'
  },
  {
    id: 'vacuum_insulated_vig',
    name: 'Vacuum Insulated Glazing (VIG Ultra-Thin)',
    description: '0.2mm high-vacuum gap with micro-pillars. Delivers triple glazing performance in double thickness.',
    panes: 'vacuum',
    uValue: 0.48,
    shgc: 0.42,
    visTrans: 0.68,
    embodiedCarbonKgM2: 44,
    costEurM2: 480,
    acousticRwDb: 39,
    bestFor: 'Historic Retrofit & Heritage Slim Frames'
  },
  {
    id: 'electrochromic_smart_glass',
    name: 'Electrochromic Dynamic Smart Glass',
    description: 'Electronically tintable glass that dynamically modulates g-value between 0.41 (clear) and 0.09 (tinted).',
    panes: 'dynamic',
    uValue: 0.95,
    shgc: 0.22, // average operational SHGC
    visTrans: 0.58,
    embodiedCarbonKgM2: 65,
    costEurM2: 650,
    acousticRwDb: 38,
    bestFor: 'High-Tech Automated Solar Shading without Mechanical Blinds'
  }
];

export interface ShadingSystemPreset {
  id: string;
  name: string;
  shadingFactor: number; // fraction of solar radiation transmitted through shading
  costEurM2: number;
  embodiedCo2KgM2: number;
  description: string;
}

export const SHADING_LIBRARY: ShadingSystemPreset[] = [
  {
    id: 'none',
    name: 'No External Shading',
    shadingFactor: 1.0,
    costEurM2: 0,
    embodiedCo2KgM2: 0,
    description: 'Bare glass with no external obstruction.'
  },
  {
    id: 'fixed_concrete_overhang',
    name: 'Architectural Horizontal Overhang (Depth 0.8m)',
    shadingFactor: 0.72,
    costEurM2: 85,
    embodiedCo2KgM2: 18,
    description: 'Rigid concrete / steel horizontal canopy optimized for high summer sun.'
  },
  {
    id: 'deep_brise_soleil',
    name: 'Deep Engineered Brise-Soleil (Depth 1.4m)',
    shadingFactor: 0.55,
    costEurM2: 160,
    embodiedCo2KgM2: 32,
    description: 'Multi-blade horizontal louvers blocking up to 45% of summer solar gains.'
  },
  {
    id: 'automated_motorized_louvers',
    name: 'Motorized Solar-Tracking Venetian Blinds',
    shadingFactor: 0.28,
    costEurM2: 240,
    embodiedCo2KgM2: 22,
    description: 'External motorized aluminum slats tracked to sun azimuth and altitude.'
  },
  {
    id: 'timber_solar_screen',
    name: 'Bio-based Timber Vertical Screen (Larch/Oak)',
    shadingFactor: 0.62,
    costEurM2: 130,
    embodiedCo2KgM2: -12, // carbon negative sequestering
    description: 'Sustainable vertical wooden fins providing low-carbon diffuse daylighting.'
  }
];

