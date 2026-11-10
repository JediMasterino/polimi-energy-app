// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING & INTEGRATED DESIGN STUDIO
// Component: src/components/EurocodeGuideModal.tsx
// Verbatim Workflow, Interpretation, and Sheet Scope from
// BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx (EN 1990 - EN 1996)
// © Politecnico di Milano - Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
// ============================================================================

import React, { useState } from 'react';
import {
  BookOpen,
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Layers,
  Building,
  Scale,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { EurocodeStatus } from '../utils/eurocodeCalculators';

interface EurocodeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember?: string;
  allMemberResults?: Record<string, { eta_max: number; status: EurocodeStatus }>;
  onSelectMember?: (m: string) => void;
}

export const EurocodeGuideModal: React.FC<EurocodeGuideModalProps> = ({
  isOpen,
  onClose,
  activeMember = 'rc_column',
  allMemberResults,
  onSelectMember
}) => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'scope' | 'legend'>('workflow');

  if (!isOpen) return null;

  const memberCatalog = [
    { id: 'masonry_wall', name: 'Masonry Wall', standard: 'EN 1996-1-1', type: 'Unreinforced Wall' },
    { id: 'rc_slab', name: 'RC Slab', standard: 'EN 1992-1-1', type: 'One-Way Slab' },
    { id: 'rc_beam', name: 'RC Beam', standard: 'EN 1992-1-1', type: 'Rectangular Beam' },
    { id: 'rc_wall', name: 'RC Wall', standard: 'EN 1992-1-1', type: 'Load-Bearing Wall Strip' },
    { id: 'rc_column', name: 'RC Column', standard: 'EN 1992-1-1', type: 'Uniaxial Column' },
    { id: 'steel_beam', name: 'Steel Beam', standard: 'EN 1993-1-1', type: 'Hot-Finished / Cold-Formed' },
    { id: 'steel_column', name: 'Steel Column', standard: 'EN 1993-1-1', type: 'Concentric Column' },
    { id: 'clt_slab', name: 'CLT Slab', standard: 'EN 1995-1-1 / ETA', type: 'One-Way Panel' },
    { id: 'clt_wall', name: 'CLT Wall', standard: 'EN 1995-1-1 / ETA', type: 'Wall Strip & Wind' },
    { id: 'wood_beam', name: 'Wood Beam', standard: 'EN 1995-1-1', type: 'Solid Timber / Glulam' },
    { id: 'wood_column', name: 'Wood Column', standard: 'EN 1995-1-1', type: 'Combined Compression-Bending' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Eurocodes Essential Preliminary Sizing Guide
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                  Workbook AY 2026–27
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PoliMi DABC • Prof. Salvatore Viscuso & Prof. Massimiliano Manfren
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'workflow'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Workflow & Interpretation (7 Rules)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scope')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'scope'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Member Sheet Scopes & Limits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('legend')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'legend'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Status Dictionary & Live Catalog
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed flex-1">
          {/* TAB 1: WORKFLOW AND INTERPRETATION */}
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-sky-200 space-y-1">
                <span className="font-extrabold uppercase text-[11px] tracking-wider block text-sky-300">
                  Workbook Operating Principles (EN 1990 – EN 1996)
                </span>
                <p className="text-slate-300 text-xs">
                  Concrete, steel, timber, CLT and masonry. Each calculated result is accompanied by its mathematical expression as plain text. Illustrative examples: select the applicable National Annex, replace project inputs, and check each sheet’s scope before using a result.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">1</span>
                    Set Shared Basis & Floor Loads in EC Basis
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    Set shared factors, National Annex and common floor loads in <code className="text-sky-300">EC Basis</code>. Each member adds its own self-weight once. Column and wall top loads (<code className="text-teal-300">NG,k</code>, <code className="text-teal-300">NQ,k</code>) are entered separately or derived automatically via 3D tributary load takedown.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">2</span>
                    Select Grade/Profile & Support Conditions
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    Choose a member sheet, select its grade or profile and enter span, dimensions, reinforcement and support conditions in the parameter editor. Calculated values are displayed in real-time alongside full intermediate verification variables.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">3</span>
                    Iterative Trial Sizing & Governing Utilisation Ratio (η ≤ 1.00)
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    Change trial depth, width, steel profile, reinforcement or CLT product data until included ratios are acceptable. A result <code className="text-emerald-400 font-bold">η ≤ 1.00</code> is meaningful only within the stated scope.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">4</span>
                    Mass Timber & CLT ETA Product Replacement
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    For CLT, replace all <code className="text-amber-300">EXAMPLE</code> properties with values from one documented product/ETA method. Wall buckling additionally requires confirmation of the equivalent-column method before detailing.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">5</span>
                    Complete Omitted Structural & Detailing Checks
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    Complete the omitted structural and detailing checks (connections, lateral bracing, fire resistance, foundation bearing, 3D seismic box-action). No sheet certifies the overall building or its compliance. All current member tabs form one unified Eurocode pre-dimensioning suite.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">6</span>
                    Masonry Wall Unit Type / Group & Strength Data
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    For Masonry Wall choose the unit type/group (EN 1996 Table 3.3) and enter product strengths (<code className="text-teal-300">fb</code>), mortar (<code className="text-teal-300">fm</code>), restraint and one consistent load combination. Confirm the material/NA data only after checking it.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[11px]">7</span>
                    Formula Transparency (Plain Text Formulas Right of Each Result)
                  </div>
                  <p className="text-slate-300 text-xs pl-7">
                    Formula text is immediately right of each result in the 5-column dossier table. It uses the exact symbols from the Eurocode sheets for transparent auditing and pedagogical validation. Red ratios exceed 1.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHEET SCOPES AND LIMITATIONS */}
          {activeTab === 'scope' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-0.5">
                  <span className="font-bold text-white">Didactic & Pre-Dimensioning Scope:</span>
                  <p>
                    Example outputs demonstrate functioning equations, not a final buildable structure. Check the detailed result column: <strong className="text-amber-300">OUT OF SCOPE</strong>, <strong className="text-amber-300">CHECK INPUTS</strong> and <strong className="text-amber-300">EXAMPLE DATA</strong> require action even when a displayed ratio is below 1.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Masonry */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                    <Layers className="w-3.5 h-3.5" />
                    Masonry Wall (EN 1996-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> EC6 top, middle, and bottom compression; eccentricity, creep, geometric slenderness and separate bed-joint shear.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> Single-leaf unreinforced masonry only. Excludes global building box-action analysis, lintels, and foundation settlement.
                  </p>
                </div>

                {/* RC Slab & Beam */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Layers className="w-3.5 h-3.5" />
                    RC Slab & RC Beam (EN 1992-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> Singly reinforced flexure, variable strut angle shear (cotθ = 1.0–2.5), link spacing, rebar minima/maxima, and span/depth ratio deflection screens.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> Doubly reinforced sections, torsion, lateral-torsional buckling of slender beams, crack width calculations, and fire endurance require separate design.
                  </p>
                </div>

                {/* RC Wall & Column */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-indigo-400 flex items-center gap-1.5 text-xs">
                    <Building className="w-3.5 h-3.5" />
                    RC Wall & RC Column (EN 1992-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> Uniaxial compression-bending with nominal curvature and 28-iteration strain-compatible section equilibrium (parabola-rectangle concrete law).
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Domain Limits:</strong> fck ≤ 50 MPa, n ≤ 0.5, λ ≤ 100, symmetric reinforcement, neutral axis within section. Orthogonal plane, ties, bar restraint, and axial shortening are excluded.
                  </p>
                </div>

                {/* Steel Beam */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                    <Scale className="w-3.5 h-3.5" />
                    Steel Beam (EN 1993-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> IPE, HEA, HEB, plus square SHS and circular CHS (HF EN 10210 / CF EN 10219). Elastic bending, shear, and SLS deflection limits.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> I/H sections require assumed lateral restraint; SHS/CHS is exempt from LTB. Unrestrained beams, Class 4 profiles, and connection details are excluded.
                  </p>
                </div>

                {/* Steel Column */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5 text-xs">
                    <Building className="w-3.5 h-3.5" />
                    Steel Column (EN 1993-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> IPE/HEA/HEB and SHS/CHS in concentric compression. Two-axis buckling using manufacturing route (HF curve a; CF curve c).
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> Concentric compression only. Applied moments and Class 4 cross-sections remain strictly outside scope.
                  </p>
                </div>

                {/* CLT Slab & Wall */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                    <Layers className="w-3.5 h-3.5" />
                    CLT Slab & CLT Wall (EN 1995-1-1 / ETA)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> One-way product-property screens (bending, rolling shear, bearing, deflection, equivalent-column buckling).
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> No generic panel grade or gross-section substitution. ETA product properties must be confirmed before specification.
                  </p>
                </div>

                {/* Wood Beam & Column */}
                <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 col-span-1 md:col-span-2 space-y-1.5">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                    <Scale className="w-3.5 h-3.5" />
                    Wood Beam & Wood Column (EN 1995-1-1)
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    <strong>Scope:</strong> Solid timber and glulam (C18–GL32h), Service Classes 1–3, five load duration classes, kmod modification, support bearing, instantaneous and final creep deflections (kdef), and two-axis column buckling/bending interaction.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Boundary:</strong> Notched supports, openings, end connections, and lateral-torsional buckling of unrestrained slender timber beams require detailed design.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STATUS DICTIONARY & LIVE CATALOG */}
          {activeTab === 'legend' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                  <span className="font-extrabold text-emerald-300 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    SCREEN ONLY
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    Pre-dimensioning check passes (η ≤ 1.00). Member dimensions and reinforcement satisfy essential Eurocode sizing rules within the stated single-member scope.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 space-y-1">
                  <span className="font-extrabold text-sky-300 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    DOCUMENTED PRODUCT
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    Passes using verified European Technical Assessment (ETA) or certified manufacturer structural properties (applicable to engineered CLT systems).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-1">
                  <span className="font-extrabold text-amber-300 flex items-center gap-1.5 text-xs">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    EXAMPLE DATA
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    Calculation passes numerically, but relies on example/placeholder product data. Must be replaced with tested manufacturer data before technical delivery.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-1">
                  <span className="font-extrabold text-rose-300 flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    EXCEEDS SCREEN
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    One or more governing utilisation ratios exceed 1.00 (η &gt; 1.00). Section depth, width, reinforcement or grade must be increased.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-1 sm:col-span-2">
                  <span className="font-extrabold text-purple-300 flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                    OUT OF SCOPE / CHECK INPUTS
                  </span>
                  <p className="text-slate-300 text-[11px]">
                    The geometry or loading exceeds the validity domain of the preliminary model (e.g. concrete n &gt; 0.5, slenderness λ &gt; 100, neutral axis outside section, or Class 4 thin-walled steel). Requires section enlargement or full 3D nonlinear finite element analysis.
                  </p>
                </div>
              </div>

              {/* Live Status Summary Table */}
              {allMemberResults && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="font-bold text-white text-xs block">
                    Live Member Utilization Summary (Current Project State):
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/90 text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Member</th>
                          <th className="p-2.5">Standard</th>
                          <th className="p-2.5">Utilisation ηmax</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {memberCatalog.map((m) => {
                          const res = allMemberResults[m.id];
                          const eta = res ? res.eta_max : 0;
                          const stat = res ? res.status : 'SCREEN ONLY';
                          const isExceeded = eta > 1.0;
                          return (
                            <tr key={m.id} className={m.id === activeMember ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'}>
                              <td className="p-2.5 font-bold font-sans text-white flex items-center gap-1.5">
                                {m.name}
                                {m.id === activeMember && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">active</span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-400 font-sans">{m.standard}</td>
                              <td className={`p-2.5 font-bold ${isExceeded ? 'text-rose-400' : eta > 0.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {eta.toFixed(3)}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                                  stat === 'SCREEN ONLY' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                  stat === 'DOCUMENTED PRODUCT' ? 'bg-sky-950 text-sky-300 border border-sky-800' :
                                  stat === 'EXAMPLE DATA' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                  'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}>
                                  {stat}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                {onSelectMember && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectMember(m.id);
                                      onClose();
                                    }}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-sans font-semibold text-[10px] transition"
                                  >
                                    Inspect →
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Politecnico di Milano Didactic Copyright Notice */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">© SALVATORE VISCUSO</span>, Politecnico di Milano, DABC Department. For didactic use only.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};

