// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING STUDIO
// Professional A4 Calculation Dossier & Engineering Report Modal
// Standard: EN 1990, EN 1991-1-1, EN 1992-1-1, EN 1993-1-1, EN 1995-1-1, EN 1996-1-1
// Supports: @media print A4 Export, CSV/JSON Data Export, Academic / Practice Title Block
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  SharedDesignBasis,
  StructuralBayConfig,
  CalculationRow,
  SystemOptionComparison,
  EurocodeStatus
} from '../utils/eurocodeCalculators';

export interface ProjectMetadata {
  projectTitle: string;
  jobCode: string;
  location: string;
  client: string;
  authorName: string;
  architect: string;
  year: string;
  studentName: string;
  studentLastName: string;
  studentMatricula: string;
  designStage: 'Concept' | 'Schematic' | 'Technical';
  revision: string;
  date: string;
  isAcademicHeader: boolean;
}

interface StructuralReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ProjectMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<ProjectMetadata>>;
  basis: SharedDesignBasis;
  config: StructuralBayConfig;
  memberResults: Record<string, { eta_max: number; status: EurocodeStatus; rows: CalculationRow[] }>;
  optioneeringMatrix: SystemOptionComparison[];
}

export const StructuralReportModal: React.FC<StructuralReportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  setMetadata,
  basis,
  config,
  memberResults,
  optioneeringMatrix
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'summary' | 'members'>('all');

  if (!isOpen) return null;

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCsv = () => {
    let csv = `EUROCODE STRUCTURAL PRE-DIMENSIONING DOSSIER\n`;
    csv += `Project,${metadata.projectTitle},Job Code,${metadata.jobCode}\n`;
    csv += `Location,${metadata.location},Author,${metadata.authorName}\n`;
    csv += `Standard,EN 1990-1996,National Annex,${basis.nationalAnnex}\n\n`;

    csv += `MEMBER,PARAMETER,SYMBOL,UNITS,VALUE,FORMULA\n`;
    Object.entries(memberResults).forEach(([mId, res]) => {
      res.rows.forEach((r) => {
        csv += `"${mId}","${r.parameter}","${r.symbol}","${r.units}","${r.value}","${r.formulaText.replace(/"/g, '""')}"\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Structural_Eurocode_Dossier.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON Export
  const handleExportJson = () => {
    const data = {
      metadata,
      basis,
      config,
      optioneeringMatrix,
      memberResults
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Eurocode_Calculation.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none print:bg-white print:text-black">
        {/* Modal Header Bar (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Structural Eurocode Calculation Dossier
              </h2>
              <p className="text-xs text-slate-400">
                Industry-Grade A4 Calculation Report • Politecnico di Milano EN 1990–1996 Standards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Academic vs Practice Toggle */}
            <label className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs cursor-pointer hover:bg-slate-700 transition">
              <input
                type="checkbox"
                checked={metadata.isAcademicHeader}
                onChange={(e) => setMetadata({ ...metadata, isAcademicHeader: e.target.checked })}
                className="rounded border-slate-600 text-teal-500 focus:ring-teal-400"
              />
              <span className="font-semibold text-slate-200">PoliMi Academic Title Block</span>
            </label>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              title="Export numerical calculation table to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              CSV
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
              title="Export complete model to JSON"
            >
              <Download className="w-4 h-4 text-sky-400" />
              JSON
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
              title="Print A4 Calculation Dossier or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="overflow-y-auto p-8 space-y-8 bg-slate-900 print:bg-white print:text-slate-900 print:p-0">
          {/* =================================================================
              1. TITLE BLOCK / CARTOUCHE
             ================================================================= */}
          <div className="border-2 border-slate-700 print:border-slate-800 rounded-xl p-5 space-y-4 bg-slate-950/40 print:bg-slate-50">
            {metadata.isAcademicHeader ? (
              // Academic Title Block
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="font-extrabold text-sm text-teal-400 uppercase tracking-widest print:text-teal-800">
                    POLITECNICO DI MILANO • DIPARTIMENTO ABC
                  </div>
                  <div className="text-xs font-bold text-slate-400 print:text-slate-600">
                    LIFE CYCLE HOUSING A.Y. 2026–27
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Course:</span>
                    <span className="font-semibold text-slate-200 print:text-slate-800">
                      Building Technology & Environmental Control
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Instructors:</span>
                    <span className="font-semibold text-slate-200 print:text-slate-800">
                      Prof. Salvatore Viscuso, Prof. Massimiliano Manfren
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Student Name & Matricula:</span>
                    <span className="font-semibold text-slate-200 print:text-slate-800">
                      {metadata.studentName || metadata.authorName} {metadata.studentLastName || ''} (Matr. {metadata.studentMatricula || '------'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Project, Architect & Year:</span>
                    <span className="font-semibold text-slate-200 print:text-slate-800">
                      {metadata.projectTitle} • {metadata.architect || 'Studio'} ({metadata.year || '2026'})
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Professional Practice Title Block
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Project Title:</span>
                  <span className="font-extrabold text-white print:text-black">{metadata.projectTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Location & Year:</span>
                  <span className="font-semibold text-slate-300 print:text-slate-800">{metadata.location} • {metadata.year || '2026'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Architect / Practice:</span>
                  <span className="font-semibold text-slate-300 print:text-slate-800">{metadata.architect || metadata.authorName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Client & Ref:</span>
                  <span className="font-semibold text-slate-300 print:text-slate-800">{metadata.client} • {metadata.jobCode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Design Stage / Rev:</span>
                  <span className="font-semibold text-slate-300 print:text-slate-800">{metadata.designStage} • Rev {metadata.revision}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">National Annex:</span>
                  <span className="font-semibold text-teal-400 print:text-teal-700">{basis.nationalAnnex}</span>
                </div>
              </div>
            )}
          </div>

          {/* =================================================================
              2. EXECUTIVE SUMMARY & MULTI-SYSTEM OPTIONEERING MATRIX
             ================================================================= */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-400 print:text-teal-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              1. Executive Summary & Multi-System Optioneering Matrix
            </h3>
            <p className="text-xs text-slate-400 print:text-slate-600">
              Comparative preliminary sizing for a {config.spanL}m × {config.tributaryWidthBtr}m bay ({config.numberOfStoreys} storeys) under EN 1991-1-1 imposed load qk = {basis.qk} kN/m² and permanent finishes gk,add = {basis.gk_add} kN/m².
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-700 print:border-slate-400">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800/80 print:bg-slate-100 text-slate-300 print:text-slate-900 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-3">Structural System</th>
                    <th className="p-3">Total Depth</th>
                    <th className="p-3">Slab / Beam</th>
                    <th className="p-3">Column / Wall</th>
                    <th className="p-3">Self-Weight</th>
                    <th className="p-3">Governing ηmax</th>
                    <th className="p-3">Embodied Carbon</th>
                    <th className="p-3">Eurocode Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                  {optioneeringMatrix.map((opt) => (
                    <tr key={opt.system} className={opt.system === config.materialSystem ? 'bg-teal-950/30 print:bg-teal-50' : ''}>
                      <td className="p-3 font-extrabold text-white print:text-black">
                        {opt.displayName}
                        {opt.system === config.materialSystem && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/40">Active</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-200 print:text-slate-800">{opt.structuralDepth} mm</td>
                      <td className="p-3 text-slate-300 print:text-slate-700">{opt.slabDepth} mm / {opt.beamDepth} mm</td>
                      <td className="p-3 text-slate-300 print:text-slate-700">{opt.columnSize}</td>
                      <td className="p-3 font-mono text-slate-300 print:text-slate-700">{opt.selfWeightWm2.toFixed(1)} kN/m²</td>
                      <td className="p-3 font-mono font-bold">
                        <span className={opt.eta_max <= 0.8 ? 'text-emerald-400' : opt.eta_max <= 1.0 ? 'text-amber-400' : 'text-rose-400'}>
                          {opt.eta_max.toFixed(3)} ({opt.governingMember})
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300 print:text-slate-700">{opt.embodiedCarbonA1A3} kgCO₂e/m²</td>
                      <td className="p-3 text-[10px] font-bold text-slate-400 print:text-slate-600">{opt.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* =================================================================
              3. DETAILED MEMBER VERIFICATION SHEETS (TRANSPARENT 5-COLUMN TABLES)
             ================================================================= */}
          <div className="space-y-6">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-teal-400 print:text-teal-800 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              2. Detailed Member Calculations & Plain-Text Mathematical Expressions
            </h3>

            {Object.entries(memberResults).map(([mId, res]) => {
              const memberTitle = mId.replace(/_/g, ' ').toUpperCase();
              return (
                <div key={mId} className="space-y-2 border border-slate-800 print:border-slate-300 rounded-xl p-4 bg-slate-950/30 print:bg-white">
                  <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-2">
                    <span className="font-extrabold text-xs text-white print:text-black">{memberTitle}</span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      res.eta_max <= 0.8 ? 'bg-emerald-500/20 text-emerald-300' : res.eta_max <= 1.0 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      ηmax = {res.eta_max.toFixed(3)} • {res.status}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] font-bold text-slate-400 uppercase bg-slate-900/60 print:bg-slate-100">
                        <tr>
                          <th className="p-2">Parameter</th>
                          <th className="p-2">Symbol</th>
                          <th className="p-2">Units</th>
                          <th className="p-2">Value</th>
                          <th className="p-2">Mathematical Formula (Plain Text)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                        {res.rows.map((row, idx) => (
                          <tr key={idx} className={row.isRatio && row.isExceeded ? 'bg-rose-950/30 text-rose-300' : ''}>
                            <td className="p-2 font-medium text-slate-300 print:text-slate-800">{row.parameter}</td>
                            <td className="p-2 font-mono text-sky-400 print:text-sky-800">{row.symbol}</td>
                            <td className="p-2 text-slate-400 print:text-slate-600">{row.units}</td>
                            <td className="p-2 font-mono font-bold text-white print:text-black">{row.value}</td>
                            <td className="p-2 font-mono text-[11px] text-teal-300 print:text-teal-900">{row.formulaText}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* =================================================================
              4. EXCLUDED CHECKS & PROFESSIONAL HANDOVER CHECKLIST
             ================================================================= */}
          <div className="border border-amber-500/40 bg-amber-950/20 print:bg-amber-50 rounded-xl p-4 text-xs space-y-2">
            <div className="font-extrabold text-amber-300 print:text-amber-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Professional Pre-Dimensioning Scope & Handover Checklist
            </div>
            <p className="text-slate-300 print:text-slate-700 leading-relaxed">
              These calculations provide preliminary sizing screens in accordance with EN 1990 to EN 1996 for architectural design and scheme planning. A result with &eta; &le; 1.00 confirms viability within the stated scope but does not replace a comprehensive structural engineering model. The following checks are excluded and must be verified in detailed technical design:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-400 print:text-slate-600 list-disc list-inside">
              <li>Connections, splices, baseplates, and anchorage details</li>
              <li>Structural fire resistance (EN 199x-1-2 / REI requirements)</li>
              <li>Global seismic stability, response spectrum & box action (EN 1998)</li>
              <li>Foundation bearing, settlements, and geotechnical capacity (EN 1997)</li>
              <li>Dynamic floor vibrations and human comfort screens (walking excitation)</li>
              <li>Wind suction, uplift combinations, and construction-phase stability</li>
            </ul>
          </div>

          {/* Signature Block (Print-Only) */}
          <div className="hidden print:grid grid-cols-3 gap-8 pt-8 border-t border-slate-300 text-xs text-slate-600">
            <div>
              <span className="font-bold block">Prepared by:</span>
              <div className="h-12 border-b border-slate-400" />
              <span>Architect / Computational Designer</span>
            </div>
            <div>
              <span className="font-bold block">Structural Verification:</span>
              <div className="h-12 border-b border-slate-400" />
              <span>Chartered Structural Engineer</span>
            </div>
            <div>
              <span className="font-bold block">Approval Date & Stamp:</span>
              <div className="h-12 border-b border-slate-400" />
              <span>Date: {metadata.date}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

