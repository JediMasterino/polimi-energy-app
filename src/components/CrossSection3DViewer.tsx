// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING STUDIO
// 3D / 2D Scaled Cross-Section Cutaway & Neutral Axis Visualizer
// Shows concrete rebar cages, steel profile geometry, CLT layups, and masonry ecc.
// ============================================================================

import React from 'react';
import {
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { STEEL_PROFILES } from '../data/eurocodeDataset';
import { SelectedMemberType } from './StructuralBay3DViewer';
import { EurocodeStatus } from '../utils/eurocodeCalculators';

interface CrossSection3DViewerProps {
  memberType: SelectedMemberType;
  params: any;
  result: any;
}

export const CrossSection3DViewer: React.FC<CrossSection3DViewerProps> = ({
  memberType,
  params,
  result
}) => {
  const eta = result?.eta_max || 0;
  const status: EurocodeStatus = result?.status || 'SCREEN ONLY';

  // Status color formatting
  const getStatusBadge = () => {
    switch (status) {
      case 'SCREEN ONLY':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            SCREEN ONLY (EC Compliant Screen)
          </span>
        );
      case 'DOCUMENTED PRODUCT':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-sky-400" />
            DOCUMENTED PRODUCT (ETA Verified)
          </span>
        );
      case 'EXAMPLE DATA':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            EXAMPLE DATA (Verification Required)
          </span>
        );
      case 'EXCEEDS SCREEN':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" />
            EXCEEDS SCREEN (ηmax &gt; 1.00)
          </span>
        );
      case 'OUT OF SCOPE':
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-purple-400" />
            OUT OF SCOPE (Design Boundary Exceeded)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-700 text-slate-300 border border-slate-600">
            {status}
          </span>
        );
    }
  };

  // Render SVG Cutaway based on memberType
  const renderCutaway = () => {
    // 1. REINFORCED CONCRETE SLAB
    if (memberType === 'rc_slab') {
      const h = params.h || 220;
      const cnom = params.cnom || 30;
      const phi = params.phi || 12;
      const x_prov = result?.x_prov || 20;

      const scale = 240 / Math.max(h, 200);
      const drawH = h * scale;
      const drawW = 320;
      const drawCnom = cnom * scale;
      const drawPhi = Math.max(6, phi * scale * 0.8);
      const drawX = x_prov * scale;

      return (
        <svg viewBox="0 0 360 260" className="w-full h-56 select-none">
          {/* Concrete Body */}
          <rect x="20" y="20" width={drawW} height={drawH} rx="3" fill="#334155" stroke="#64748b" strokeWidth="2" />
          {/* Concrete Compression Zone above Neutral Axis x */}
          <rect x="20" y="20" width={drawW} height={Math.min(drawH, drawX)} fill="#38bdf8" fillOpacity="0.25" />
          {/* Neutral Axis Dashed Line */}
          <line x1="15" y1={20 + drawX} x2={drawW + 25} y2={20 + drawX} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={drawW + 30} y={24 + drawX} fill="#38bdf8" fontSize="10" fontWeight="bold">x={x_prov.toFixed(1)}mm</text>

          {/* Rebar bars in bottom tension zone */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((pct, idx) => {
            const rx = 20 + drawW * pct - 20;
            const ry = 20 + drawH - drawCnom - drawPhi / 2;
            return (
              <g key={idx}>
                <circle cx={rx} cy={ry} r={drawPhi / 2} fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
                <circle cx={rx} cy={ry} r={drawPhi / 4} fill="#fecaca" />
              </g>
            );
          })}

          {/* Dimension Annotations */}
          <line x1="10" y1="20" x2="10" y2={20 + drawH} stroke="#94a3b8" strokeWidth="1" />
          <text x="5" y={20 + drawH / 2} fill="#94a3b8" fontSize="11" textAnchor="end">h={h}mm</text>
          <text x={drawW / 2} y={20 + drawH + 18} fill="#94a3b8" fontSize="11" textAnchor="middle">1.0 m Unit Slab Strip (b=1000mm)</text>
        </svg>
      );
    }

    // 2. REINFORCED CONCRETE BEAM
    if (memberType === 'rc_beam') {
      const b = params.b || 300;
      const h = params.h || 550;
      const cnom = params.cnom || 30;
      const phi = params.phi || 20;
      const phi_link = params.phi_link || 8;
      const n = params.n || 4;
      const x_prov = result?.x_prov || 113;

      const scale = 200 / Math.max(h, 500);
      const drawW = b * scale;
      const drawH = h * scale;
      const startX = (360 - drawW) / 2;
      const startY = 20;
      const drawCnom = cnom * scale;
      const drawX = x_prov * scale;

      return (
        <svg viewBox="0 0 360 260" className="w-full h-56 select-none">
          {/* Concrete Beam Section */}
          <rect x={startX} y={startY} width={drawW} height={drawH} rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
          {/* Compression Block */}
          <rect x={startX} y={startY} width={drawW} height={Math.min(drawH, drawX)} fill="#38bdf8" fillOpacity="0.25" />
          <line x1={startX - 15} y1={startY + drawX} x2={startX + drawW + 15} y2={startY + drawX} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={startX + drawW + 18} y={startY + drawX + 3} fill="#38bdf8" fontSize="10" fontWeight="bold">x={x_prov.toFixed(0)}mm</text>

          {/* Stirrup Link */}
          <rect
            x={startX + drawCnom}
            y={startY + drawCnom}
            width={drawW - 2 * drawCnom}
            height={drawH - 2 * drawCnom}
            rx="6"
            fill="none"
            stroke="#fbbf24"
            strokeWidth={Math.max(2, phi_link * scale * 0.7)}
          />

          {/* Bottom Tension Bars */}
          {Array.from({ length: n }).map((_, idx) => {
            const spacing = (drawW - 2 * drawCnom - 16) / Math.max(1, n - 1);
            const cx = startX + drawCnom + 8 + idx * spacing;
            const cy = startY + drawH - drawCnom - 8;
            return (
              <circle key={idx} cx={cx} cy={cy} r={Math.max(4, phi * scale * 0.4)} fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
            );
          })}

          {/* Top Hanger Bars */}
          <circle cx={startX + drawCnom + 8} cy={startY + drawCnom + 8} r={3} fill="#94a3b8" />
          <circle cx={startX + drawW - drawCnom - 8} cy={startY + drawCnom + 8} r={3} fill="#94a3b8" />

          {/* Dimensions */}
          <text x={startX + drawW / 2} y={startY + drawH + 18} fill="#94a3b8" fontSize="11" textAnchor="middle">b = {b}mm</text>
          <text x={startX - 10} y={startY + drawH / 2} fill="#94a3b8" fontSize="11" textAnchor="end">h = {h}mm</text>
        </svg>
      );
    }

    // 3. REINFORCED CONCRETE COLUMN OR WALL STRIP
    if (memberType === 'rc_column' || memberType === 'rc_wall') {
      const b = params.b || 400;
      const h = params.h || 400;
      const x = result?.x || 150;
      const scale = 180 / Math.max(b, h);
      const drawW = b * scale;
      const drawH = h * scale;
      const startX = (360 - drawW) / 2;
      const startY = 30;
      const drawX = x * scale;

      return (
        <svg viewBox="0 0 360 260" className="w-full h-56 select-none">
          <rect x={startX} y={startY} width={drawW} height={drawH} rx="4" fill="#334155" stroke="#64748b" strokeWidth="2" />
          {/* Compression zone */}
          <rect x={startX} y={startY} width={drawW} height={Math.min(drawH, drawX)} fill="#38bdf8" fillOpacity="0.25" />
          <line x1={startX - 15} y1={startY + drawX} x2={startX + drawW + 15} y2={startY + drawX} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={startX + drawW + 18} y={startY + drawX + 3} fill="#38bdf8" fontSize="10" fontWeight="bold">x={x.toFixed(1)}mm</text>

          {/* Symmetric Rebar Layers on Opposite Faces */}
          {[0.2, 0.5, 0.8].map((pct, idx) => (
            <React.Fragment key={idx}>
              <circle cx={startX + drawW * pct} cy={startY + 15} r="5" fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
              <circle cx={startX + drawW * pct} cy={startY + drawH - 15} r="5" fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
            </React.Fragment>
          ))}

          <text x={startX + drawW / 2} y={startY + drawH + 18} fill="#94a3b8" fontSize="11" textAnchor="middle">{b} × {h} mm</text>
        </svg>
      );
    }

    // 4. STEEL I / H SECTION (IPE / HEA / HEB)
    if (memberType === 'steel_beam' || memberType === 'steel_column') {
      const profName = params.profileName || 'IPE 300';
      const prof = STEEL_PROFILES[profName] || STEEL_PROFILES['IPE 300'];

      const maxDim = Math.max(prof.h, prof.b);
      const scale = 180 / maxDim;
      const drawH = prof.h * scale;
      const drawB = prof.b * scale;
      const drawTf = Math.max(3, prof.tf * scale);
      const drawTw = Math.max(2.5, prof.tw * scale);

      const startX = (360 - drawB) / 2;
      const startY = (240 - drawH) / 2;

      if (prof.type === 'CHS') {
        const radius = (prof.h / 2) * scale;
        const cx = 180;
        const cy = 120;
        return (
          <svg viewBox="0 0 360 240" className="w-full h-56 select-none">
            {/* Outer Circle */}
            <circle cx={cx} cy={cy} r={radius} fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            {/* Inner Circle (Hollow) */}
            <circle cx={cx} cy={cy} r={Math.max(1, radius - drawTf)} fill="#090d16" stroke="#38bdf8" strokeWidth="1" />
            {/* Principal Axes */}
            <line x1={cx - radius - 15} y1={cy} x2={cx + radius + 15} y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={cx} y1={cy - radius - 15} x2={cx} y2={cy + radius + 15} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <text x={cx + radius + 20} y={cy + 4} fill="#64748b" fontSize="10">y-y</text>
            <text x={cx + 4} y={cy - radius - 8} fill="#64748b" fontSize="10">z-z</text>
            <text x={cx} y={cy + radius + 22} fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
              {prof.profile} (OD={prof.h}mm, t={prof.tf}mm)
            </text>
          </svg>
        );
      }

      if (prof.type === 'SHS') {
        const cx = 180;
        const cy = 120;
        return (
          <svg viewBox="0 0 360 240" className="w-full h-56 select-none">
            {/* Outer Box */}
            <rect x={startX} y={startY} width={drawB} height={drawH} rx="5" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
            {/* Inner Hollow Box */}
            <rect
              x={startX + drawTf}
              y={startY + drawTf}
              width={drawB - 2 * drawTf}
              height={drawH - 2 * drawTf}
              rx="3"
              fill="#090d16"
              stroke="#38bdf8"
              strokeWidth="1"
            />
            {/* Axes */}
            <line x1="70" y1={cy} x2="290" y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={cx} y1="20" x2={cx} y2="220" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <text x={cx} y={startY + drawH + 20} fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
              {prof.profile}
            </text>
          </svg>
        );
      }

      // I / H Section
      return (
        <svg viewBox="0 0 360 240" className="w-full h-56 select-none">
          {/* Top Flange */}
          <rect x={startX} y={startY} width={drawB} height={drawTf} rx="2" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          {/* Web */}
          <rect x={startX + (drawB - drawTw) / 2} y={startY + drawTf} width={drawTw} height={drawH - 2 * drawTf} fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          {/* Bottom Flange */}
          <rect x={startX} y={startY + drawH - drawTf} width={drawB} height={drawTf} rx="2" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />

          {/* Strong Axis y-y */}
          <line x1="60" y1={startY + drawH / 2} x2="300" y2={startY + drawH / 2} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="305" y={startY + drawH / 2 + 4} fill="#f59e0b" fontSize="10" fontWeight="bold">y-y (Strong)</text>

          {/* Weak Axis z-z */}
          <line x1={startX + drawB / 2} y1="15" x2={startX + drawB / 2} y2="225" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={startX + drawB / 2 + 5} y="22" fill="#ec4899" fontSize="10" fontWeight="bold">z-z (Weak)</text>

          {/* Profile Name */}
          <text x="180" y={startY + drawH + 22} fill="#e2e8f0" fontSize="12" textAnchor="middle" fontWeight="bold">
            {prof.profile} (h={prof.h}mm, b={prof.b}mm, tw={prof.tw}mm, tf={prof.tf}mm)
          </text>
        </svg>
      );
    }

    // 5. CLT SLAB OR WALL
    if (memberType === 'clt_slab' || memberType === 'clt_wall') {
      const t = params.t || 160;
      const layers = 5; // 5-layer CLT standard
      const layerH = (200 / layers);

      return (
        <svg viewBox="0 0 360 250" className="w-full h-56 select-none">
          {Array.from({ length: layers }).map((_, idx) => {
            const isLongitudinal = idx % 2 === 0;
            const y = 25 + idx * layerH;
            return (
              <g key={idx}>
                <rect
                  x="30"
                  y={y}
                  width="280"
                  height={layerH}
                  fill={isLongitudinal ? '#d97706' : '#b45309'}
                  stroke="#78350f"
                  strokeWidth="1.5"
                />
                {/* Grain lines or dots */}
                {isLongitudinal ? (
                  Array.from({ length: 6 }).map((_, lineIdx) => (
                    <line
                      key={lineIdx}
                      x1="35"
                      y1={y + (lineIdx + 1) * (layerH / 7)}
                      x2="305"
                      y2={y + (lineIdx + 1) * (layerH / 7)}
                      stroke="#fde68a"
                      strokeWidth="0.8"
                      strokeOpacity="0.4"
                    />
                  ))
                ) : (
                  Array.from({ length: 14 }).map((_, dotIdx) => (
                    <circle
                      key={dotIdx}
                      cx={45 + dotIdx * 19}
                      cy={y + layerH / 2}
                      r="2"
                      fill="#fde68a"
                      fillOpacity="0.5"
                    />
                  ))
                )}
                <text x="315" y={y + layerH / 2 + 4} fill="#fde68a" fontSize="9" fontWeight="bold">
                  {isLongitudinal ? '0° (Long)' : '90° (Cross)'}
                </text>
              </g>
            );
          })}
          <text x="170" y="245" fill="#fde68a" fontSize="11" textAnchor="middle" fontWeight="bold">
            CLT {t} mm ({layers}-Layer Cross-Laminated Timber)
          </text>
        </svg>
      );
    }

    // 6. GLULAM / SOLID TIMBER BEAM OR COLUMN
    if (memberType === 'wood_beam' || memberType === 'wood_column') {
      const b = params.b || 120;
      const h = params.h || 320;
      const laminations = 8;
      const lamH = 180 / laminations;

      return (
        <svg viewBox="0 0 360 240" className="w-full h-56 select-none">
          {Array.from({ length: laminations }).map((_, idx) => {
            const y = 20 + idx * lamH;
            return (
              <g key={idx}>
                <rect x="110" y={y} width="140" height={lamH} fill="#d97706" stroke="#92400e" strokeWidth="1" />
                <line x1="110" y1={y + lamH} x2="250" y2={y + lamH} stroke="#451a03" strokeWidth="1.5" />
              </g>
            );
          })}
          <text x="180" y="225" fill="#fde68a" fontSize="11" textAnchor="middle" fontWeight="bold">
            Glulam {b} × {h} mm (Homogeneous GL24h)
          </text>
        </svg>
      );
    }

    // 7. MASONRY WALL
    if (memberType === 'masonry_wall') {
      const t = params.t || 250;
      return (
        <svg viewBox="0 0 360 240" className="w-full h-56 select-none">
          {/* Brick masonry courses */}
          {Array.from({ length: 6 }).map((_, courseIdx) => {
            const y = 25 + courseIdx * 30;
            const isOffset = courseIdx % 2 === 1;
            return (
              <g key={courseIdx}>
                <rect x="50" y={y} width="240" height="26" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
                {/* Mortar Joint lines */}
                {Array.from({ length: 4 }).map((_, jointIdx) => {
                  const x = 50 + (jointIdx + (isOffset ? 0.5 : 1)) * 60;
                  if (x >= 50 && x <= 290) {
                    return <line key={jointIdx} x1={x} y1={y} x2={x} y2={y + 26} stroke="#fde047" strokeWidth="2" />;
                  }
                  return null;
                })}
              </g>
            );
          })}
          <text x="170" y="225" fill="#fed7aa" fontSize="11" textAnchor="middle" fontWeight="bold">
            Masonry Wall Strip t = {t} mm (General-Purpose Mortar)
          </text>
        </svg>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          3D Scaled Cross-Section & Stress Distribution
        </span>
        {getStatusBadge()}
      </div>

      {/* Cross-section graphic container */}
      <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800/80 flex items-center justify-center">
        {renderCutaway()}
      </div>

      {/* Real-time Utilization Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Governing Utilisation (ηmax):</span>
          <span className={`font-mono font-extrabold ${eta <= 0.8 ? 'text-emerald-400' : eta <= 1.0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {eta.toFixed(3)} ({Math.round(eta * 100)}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              eta <= 0.8 ? 'bg-emerald-500' : eta <= 1.0 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(3, eta * 100))}%` }}
          />
          {/* 100% capacity threshold mark */}
          <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-rose-400 opacity-70" />
        </div>
      </div>
    </div>
  );
};

