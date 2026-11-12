import React, { useMemo } from 'react';
import {
  Recycle,
  Layers,
  TrendingDown,
  Award,
  Sparkles,
  CheckCircle2,
  Database,
  Building2,
  Box
} from 'lucide-react';
import {
  useDesignProject,
  StructureSystemType
} from '../context/DesignProjectContext';
import { computeStructuralBoQ } from '../utils/eurocodeCalculators';

export const Stage6LCA: React.FC = () => {
  const {
    structureSystem,
    setStructureSystem,
    circularityIndex,
    setCircularityIndex,
    gridDecarbonizationRate,
    setGridDecarbonizationRate,
    studyPeriodYears,
    setStudyPeriodYears,
    applyOptimizationPreset,
    lengthX,
    widthY,
    floors,
    floorHeight,
    sim
  } = useDesignProject();

  const { lca } = sim;

  const previewBoQ = useMemo(() => {
    const footprintArea = sim.footprintArea;
    const structBaySpan = Math.max(3.0, +(lengthX / Math.max(1, Math.round(lengthX / 6))).toFixed(2));
    const structBayTrib = Math.max(2.5, +(widthY / Math.max(1, Math.round(widthY / 6))).toFixed(2));

    return {
      rc_standard: computeStructuralBoQ({
        footprintArea,
        floors,
        floorHeight,
        spanL: structBaySpan,
        tributaryWidthBtr: structBayTrib,
        materialSystem: 'RC',
        lowCarbonConcrete: false
      }).gwpStructureA1A3,
      low_carbon_rc: computeStructuralBoQ({
        footprintArea,
        floors,
        floorHeight,
        spanL: structBaySpan,
        tributaryWidthBtr: structBayTrib,
        materialSystem: 'RC',
        lowCarbonConcrete: true
      }).gwpStructureA1A3,
      clt_hybrid: computeStructuralBoQ({
        footprintArea,
        floors,
        floorHeight,
        spanL: structBaySpan,
        tributaryWidthBtr: structBayTrib,
        materialSystem: 'Timber',
        biogenicTimber: true
      }).gwpStructureA1A3,
      steel_composite: computeStructuralBoQ({
        footprintArea,
        floors,
        floorHeight,
        spanL: structBaySpan,
        tributaryWidthBtr: structBayTrib,
        materialSystem: 'Steel',
        recycledSteel: true
      }).gwpStructureA1A3
    };
  }, [sim.footprintArea, floors, floorHeight, lengthX, widthY]);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 6 • EN 15978 / Level(s) Whole-Life Cycle Assessment ({studyPeriodYears}-Year RSP)
            </span>
            <span className="text-xs text-slate-300">
              Embodied Share: <strong className="text-amber-300">{lca.embodiedSharePct}%</strong> of Gross WLC
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1">
            Whole-Life Carbon (Modules A1–A3, B4, B6, C1–C4) & Module D Circularity (5Rs)
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Couples Stage 4 envelope embodied carbon + structural frame with Stage 5 operational emissions over {studyPeriodYears} years.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700 text-right">
            <span className="text-[10px] text-slate-400 block uppercase">Net Whole-Life Carbon (A–D)</span>
            <span className="text-lg font-extrabold text-emerald-400">
              {lca.wholeLifeCarbonNet} <span className="text-xs font-normal text-slate-300">kgCO₂e/m²</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top KPI Ribbon: Modules A1-A3, B4, B6, C1-C4, Module D */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            A1–A3 Product & Build
          </span>
          <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">
            {lca.a1a3Total} <span className="text-xs font-normal text-slate-500">kgCO₂e/m²</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Struct {lca.a1a3Structure} + Env {lca.a1a3Envelope} + MEP {lca.a1a3MepPv}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            B4 Replacement Cycles
          </span>
          <span className="text-xl font-extrabold text-amber-600 mt-0.5 block">
            {lca.b4Replacement} <span className="text-xs font-normal text-slate-500">kgCO₂e/m²</span>
          </span>
          <span className="text-[10px] text-slate-500">Facade & HVAC renewal ({studyPeriodYears} yr)</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            B6 Operational ({studyPeriodYears} yr)
          </span>
          <span className="text-xl font-extrabold text-rose-600 mt-0.5 block">
            {lca.b6Operational50Yr} <span className="text-xs font-normal text-slate-500">kgCO₂e/m²</span>
          </span>
          <span className="text-[10px] text-slate-500">
            {sim.operationalCo2KgM2Yr} kg/m²yr (−{gridDecarbonizationRate}%/yr grid)
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            C1–C4 End-of-Life
          </span>
          <span className="text-xl font-extrabold text-slate-700 mt-0.5 block">
            {lca.c1c4EndOfLife} <span className="text-xs font-normal text-slate-500">kgCO₂e/m²</span>
          </span>
          <span className="text-[10px] text-slate-500">Deconstruction, transport & processing</span>
        </div>

        <div className="bg-emerald-50/80 rounded-2xl border border-emerald-200 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-emerald-700 block">
            Module D Circular Credit
          </span>
          <span className="text-xl font-extrabold text-emerald-700 mt-0.5 block">
            {lca.moduleDCredit} <span className="text-xs font-normal text-emerald-600">kgCO₂e/m²</span>
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold">
            5Rs Disassembly & Reuse ({circularityIndex}%)
          </span>
        </div>
      </div>

      {/* Main Charts Row: EN 15978 Module Waterfall + 50-Year Cumulative Carbon Trajectory */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Chart 6A: EN 15978 Module Breakdown Bar / Waterfall Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              EN 15978 Life-Cycle Stage Carbon Breakdown (kgCO₂e/m²)
            </h3>
            <p className="text-[11px] text-slate-500">
              Comparison of Upfront Embodied (A1–A3), In-Use Replacement (B4), Operational (B6), End-of-Life (C1–C4), and Circularity (D)
            </p>
          </div>

          <div className="w-full">
            {(() => {
              const W = 520;
              const H = 225;
              const padL = 44;
              const padR = 20;
              const padT = 22;
              const padB = 34;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;

              const items = [
                { label: 'A1–A3 Structure', val: lca.a1a3Structure, color: '#475569' },
                { label: 'A1–A3 Envelope', val: lca.a1a3Envelope, color: '#0284c7' },
                { label: 'A1–A3 MEP/PV', val: lca.a1a3MepPv, color: '#0d9488' },
                { label: 'B4 Replace', val: lca.b4Replacement, color: '#f59e0b' },
                { label: `B6 Oper (${studyPeriodYears}y)`, val: lca.b6Operational50Yr, color: '#e11d48' },
                { label: 'C1–C4 EoL', val: lca.c1c4EndOfLife, color: '#64748b' },
                { label: 'Mod D (5Rs)', val: Math.abs(lca.moduleDCredit), color: '#10b981', isCredit: true }
              ];

              const maxVal = Math.max(300, ...items.map((i) => i.val));
              const yForV = (v: number) => padT + plotH - (Math.min(maxVal, v) / maxVal) * plotH;

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                    const v = Math.round(maxVal * f);
                    const y = yForV(v);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                          {v}
                        </text>
                      </g>
                    );
                  })}

                  {items.map((it, idx) => {
                    const cx = padL + (idx + 0.5) * (plotW / items.length);
                    const yTop = yForV(it.val);
                    const bh = Math.max(4, padT + plotH - yTop);
                    return (
                      <g key={it.label}>
                        <rect
                          x={cx - 18}
                          y={yTop}
                          width={36}
                          height={bh}
                          rx={5}
                          fill={it.color}
                          fillOpacity={it.isCredit ? 0.25 : 0.88}
                          stroke={it.color}
                          strokeWidth={1.5}
                          strokeDasharray={it.isCredit ? '4 2' : undefined}
                        />
                        <text
                          x={cx}
                          y={yTop - 5}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="800"
                          fill={it.isCredit ? '#047857' : '#1e293b'}
                        >
                          {it.isCredit ? `-${it.val}` : it.val}
                        </text>
                        <text x={cx} y={H - 12} textAnchor="middle" fontSize="8.5" fill="#334155" fontWeight="600">
                          {it.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Chart 6B: 50-Year Cumulative Carbon Trajectory */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                {studyPeriodYears}-Year Cumulative Carbon Trajectory (kgCO₂e/m²)
              </h3>
              <p className="text-[11px] text-slate-500">
                Upfront embodied spike at Year 0 + annual operational slope + Year 25/40 B4 replacements + Year {studyPeriodYears} Module D recovery
              </p>
            </div>
          </div>

          <div className="w-full">
            {(() => {
              const W = 520;
              const H = 225;
              const padL = 44;
              const padR = 20;
              const padT = 18;
              const padB = 30;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;

              const traj = lca.yearlyTrajectory;
              const maxY = Math.max(
                900,
                ...traj.map((p) => Math.max(p.cumulativeBaseline, p.cumulativeCurrent))
              );
              const xForYr = (yr: number) => padL + (yr / Math.max(1, studyPeriodYears)) * plotW;
              const yForC = (c: number) => padT + plotH - (Math.min(maxY, Math.max(0, c)) / maxY) * plotH;

              const basePts = traj.map((p) => `${xForYr(p.year)},${yForC(p.cumulativeBaseline)}`).join(' ');
              const currPts = traj.map((p) => `${xForYr(p.year)},${yForC(p.cumulativeCurrent)}`).join(' ');
              const circPts = traj.map((p) => `${xForYr(p.year)},${yForC(p.cumulativeNetCircular)}`).join(' ');

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                    const v = Math.round(maxY * f);
                    const y = yForC(v);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                          {v}
                        </text>
                      </g>
                    );
                  })}

                  {traj.map((p) => (
                    <text
                      key={p.year}
                      x={xForYr(p.year)}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#475569"
                    >
                      Yr {p.year}
                    </text>
                  ))}

                  {/* Baseline Trajectory */}
                  <polyline fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" points={basePts} />
                  {/* Current Design Gross Trajectory */}
                  <polyline fill="none" stroke="#0284c7" strokeWidth={2.5} points={currPts} />
                  {/* Net Circular Trajectory */}
                  <polyline fill="none" stroke="#10b981" strokeWidth={2.5} points={circPts} />

                  {traj.map((p) => (
                    <circle
                      key={`c_${p.year}`}
                      cx={xForYr(p.year)}
                      cy={yForC(p.cumulativeNetCircular)}
                      r={3}
                      fill="#10b981"
                    />
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Row 3: Structural System, Circularity 5Rs & Grid Decarbonization Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Recycle className="w-4 h-4 text-emerald-600" />
              Structural Frame Selection, 5R Circularity (Module D) & Grid Decarbonization
            </h3>
            <p className="text-[11px] text-slate-500">
              Select structural material system and Design-for-Disassembly (5Rs: Refuse, Reduce, Reuse, Repurpose, Recycle) index
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyOptimizationPreset('nzeb_district')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Apply Bio-Based Net-Zero Circular Optimum
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {(
            [
              {
                id: 'rc_standard',
                title: 'Standard Reinforced Concrete',
                gwp: '245 kgCO₂e/m²',
                desc: 'Conventional C25/30 cast-in-place frame'
              },
              {
                id: 'low_carbon_rc',
                title: 'Low-Carbon Geopolymer / CEM III',
                gwp: '175 kgCO₂e/m²',
                desc: '40% recycled aggregate + slag binder'
              },
              {
                id: 'clt_hybrid',
                title: 'Mass Timber (CLT / Glulam Hybrid)',
                gwp: '115 kgCO₂e/m²',
                desc: 'Biogenic carbon storage + dry reversible joints'
              },
              {
                id: 'steel_composite',
                title: 'Recycled EAF Steel Frame',
                gwp: '265 kgCO₂e/m²',
                desc: 'High Module D bolt-disassembly recovery'
              }
            ] as Array<{ id: StructureSystemType; title: string; gwp: string; desc: string }>
          ).map((item) => {
            const active = structureSystem === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setStructureSystem(item.id)}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  active
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{item.title}</span>
                  <CheckCircle2
                    className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-300'}`}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-700 block mt-1">
                  A1–A3: {active ? `${sim.structuralBoQ.gwpStructureA1A3} kgCO₂e/m² (Live BoQ)` : `${previewBoQ[item.id]} kgCO₂e/m² (BoQ)`}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Dynamic Structural Bill of Quantities (BoQ) Takeoff Card */}
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-teal-500/20 text-teal-400">
                <Database className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                Dynamic Structural Bill of Quantities (BoQ) &amp; Live Material Takeoff
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="text-slate-400">Sized Scope:</span>
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                GFA {sim.structuralBoQ.gfa} m² • Upfront GWP {sim.structuralBoQ.gwpStructureA1A3} kgCO₂e/m² ({sim.structuralBoQ.totalStructureCo2Tonnes} tCO₂e)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Concrete Volume (V_conc)</span>
              <span className="text-base font-extrabold font-mono text-white block">
                {sim.structuralBoQ.concreteVolumeM3} <span className="text-xs font-normal text-slate-400">m³</span>
              </span>
              <div className="text-[10px] text-slate-400">
                Slab: {sim.structuralBoQ.materialTakeoff.slabConcreteM3}m³ • Col: {sim.structuralBoQ.materialTakeoff.columnConcreteM3}m³ • Fnd: {sim.structuralBoQ.materialTakeoff.footingConcreteM3}m³
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Reinforcing Steel (M_rebar)</span>
              <span className="text-base font-extrabold font-mono text-sky-400 block">
                {sim.structuralBoQ.rebarMassTonnes} <span className="text-xs font-normal text-slate-400">tonnes</span>
              </span>
              <div className="text-[10px] text-slate-400">
                Mass: {sim.structuralBoQ.rebarMassKg.toLocaleString()} kg (slab, beam, column, footing links)
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Structural Steel (M_steel)</span>
              <span className="text-base font-extrabold font-mono text-amber-400 block">
                {sim.structuralBoQ.steelMassTonnes} <span className="text-xs font-normal text-slate-400">tonnes</span>
              </span>
              <div className="text-[10px] text-slate-400">
                Profiles: {sim.structuralBoQ.steelMassKg.toLocaleString()} kg (beams &amp; column profiles)
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Mass Timber Volume (V_timber)</span>
              <span className="text-base font-extrabold font-mono text-emerald-400 block">
                {sim.structuralBoQ.timberVolumeM3} <span className="text-xs font-normal text-slate-400">m³</span>
              </span>
              <div className="text-[10px] text-slate-400">
                Biogenic Storage: {sim.structuralBoQ.timberBiogenicCarbonKgCo2e.toLocaleString()} kgCO₂e
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 border-t border-slate-800 text-slate-400 gap-2">
            <span>Element Carbon:</span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="text-slate-300">Slabs: <strong className="text-white">{sim.structuralBoQ.breakdown.slabsCo2KgM2}</strong> kg/m²</span>
              <span className="text-slate-300">Beams: <strong className="text-white">{sim.structuralBoQ.breakdown.beamsCo2KgM2}</strong> kg/m²</span>
              <span className="text-slate-300">Columns: <strong className="text-white">{sim.structuralBoQ.breakdown.columnsCo2KgM2}</strong> kg/m²</span>
              <span className="text-slate-300">Foundations: <strong className="text-white">{sim.structuralBoQ.breakdown.foundationsCo2KgM2}</strong> kg/m²</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <label>
            <div className="flex justify-between text-[11px] text-slate-700 font-semibold">
              <span>5R Circularity & Disassembly Index (Module D)</span>
              <span className="font-bold text-emerald-700">{circularityIndex}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              step={5}
              value={circularityIndex}
              onChange={(e) => setCircularityIndex(Number(e.target.value))}
              className="w-full accent-emerald-600 mt-1"
            />
          </label>

          <label>
            <div className="flex justify-between text-[11px] text-slate-700 font-semibold">
              <span>Annual Grid Decarbonization Rate</span>
              <span className="font-bold text-teal-700">{gridDecarbonizationRate.toFixed(1)}%/yr</span>
            </div>
            <input
              type="range"
              min={0}
              max={6.0}
              step={0.5}
              value={gridDecarbonizationRate}
              onChange={(e) => setGridDecarbonizationRate(Number(e.target.value))}
              className="w-full accent-teal-600 mt-1"
            />
          </label>

          <label>
            <div className="flex justify-between text-[11px] text-slate-700 font-semibold">
              <span>Reference Study Period (RSP)</span>
              <span className="font-bold text-indigo-700">{studyPeriodYears} years</span>
            </div>
            <input
              type="range"
              min={30}
              max={60}
              step={10}
              value={studyPeriodYears}
              onChange={(e) => setStudyPeriodYears(Number(e.target.value))}
              className="w-full accent-indigo-600 mt-1"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

