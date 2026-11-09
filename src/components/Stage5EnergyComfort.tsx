import React, { useState } from 'react';
import {
  Zap,
  Thermometer,
  Wind,
  BookmarkCheck,
  ArrowRight,
  Sparkles,
  Activity,
  Sliders
} from 'lucide-react';
import {
  useDesignProject,
  HvacSystemType
} from '../context/DesignProjectContext';
import { AdvancedHvacRenewableModal } from './AdvancedHvacRenewableModal';

export const Stage5EnergyComfort: React.FC = () => {
  const {
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
    sim,
    setActiveStage
  } = useDesignProject();

  const [showHvacModal, setShowHvacModal] = useState(false);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-indigo-950 text-white rounded-2xl p-4 border border-slate-700 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 text-[10px] font-bold uppercase tracking-wider">
              Stage 5 • ISO 52000-1 / CIBSE TM54 Energy Balance & ASHRAE 209 Cycle #4
            </span>
            <span className="text-xs text-slate-300">
              Time Constant τ = <strong className="text-amber-300">{sim.tauHours} h</strong> • Net Site EUI ={' '}
              <strong className="text-teal-300">{sim.netSiteEui} kWh/m²yr</strong>
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1">
            Quasi-Steady-State Monthly Energy Balance, ISO 52000-1 Boundaries & Adaptive Comfort
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Q_need = (Q_tr + Q_vent/inf) − η · (Q_sol × UrbanShading + Q_int) → HVAC Plant COP/EER → On-Site PV/BIPV & Grid Primary Energy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHvacModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 font-bold text-xs flex items-center gap-1.5 shadow transition"
          >
            <Sliders className="w-4 h-4 text-teal-400" />
            HVAC & Renewables Sizing Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveStage(6)}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
          >
            Stage 6 LCA
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 1: ISO 52000-1 Sankey / Energy Boundary Flow Diagram + HVAC & Ventilation Controls */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* ISO 52000-1 Sankey & Boundary Diagram (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-teal-600" />
                ISO 52000-1 Energy Assessment Boundaries & Sankey Flow (kWh/m²yr)
              </h3>
              <p className="text-[11px] text-slate-500">
                1. Heated/Cooled Zone (Energy Need) → 2. Technical Building Systems (COP/EER) → 3. Assessment Boundary (PV vs. Grid)
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Renewable Ratio: {sim.renewableSharePct}%
            </span>
          </div>

          <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3">
            {(() => {
              const W = 560;
              const H = 250;
              const ambHeat = +(sim.annualHeatingNeed - sim.deliveredHeating).toFixed(1);
              const ambCool = +(sim.annualCoolingNeed - sim.deliveredCooling).toFixed(1);

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {/* 3 Dashed ISO 52000-1 Boundary Columns */}
                  <rect
                    x={12}
                    y={12}
                    width={168}
                    height={H - 24}
                    rx={10}
                    fill="#f8fafc"
                    stroke="#94a3b8"
                    strokeDasharray="4 3"
                  />
                  <text x={96} y={28} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#334155">
                    1. ASSESSMENT BOUNDARY
                  </text>

                  <rect
                    x={196}
                    y={12}
                    width={168}
                    height={H - 24}
                    rx={10}
                    fill="#f8fafc"
                    stroke="#94a3b8"
                    strokeDasharray="4 3"
                  />
                  <text x={280} y={28} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#334155">
                    2. HVAC PLANT BOUNDARY
                  </text>

                  <rect
                    x={380}
                    y={12}
                    width={168}
                    height={H - 24}
                    rx={10}
                    fill="#f8fafc"
                    stroke="#94a3b8"
                    strokeDasharray="4 3"
                  />
                  <text x={464} y={28} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#334155">
                    3. CONDITIONED ZONE NEED
                  </text>

                  {/* Left Column Nodes: Grid Delivered + On-Site PV/BIPV + Ambient Heat Pump Source */}
                  <rect x={24} y={42} width={144} height={44} rx={8} fill="#fee2e2" stroke="#f43f5e" strokeWidth={1.5} />
                  <text x={96} y={60} textAnchor="middle" fontSize="10" fontWeight="700" fill="#9f1239">
                    Net Grid Import
                  </text>
                  <text x={96} y={76} textAnchor="middle" fontSize="11" fontWeight="800" fill="#be123c">
                    {sim.netSiteEui} kWh/m²yr
                  </text>

                  <rect x={24} y={98} width={144} height={52} rx={8} fill="#d1fae5" stroke="#10b981" strokeWidth={1.5} />
                  <text x={96} y={116} textAnchor="middle" fontSize="10" fontWeight="700" fill="#065f46">
                    On-Site PV + BIPV + District
                  </text>
                  <text x={96} y={131} textAnchor="middle" fontSize="11" fontWeight="800" fill="#047857">
                    {sim.totalRenewableGen} kWh/m²yr
                  </text>
                  <text x={96} y={143} textAnchor="middle" fontSize="8.5" fill="#065f46">
                    (Roof {sim.roofPvGeneration} + BIPV {sim.bipvGeneration} + Dist {sim.districtSharedPvContribution})
                  </text>

                  <rect x={24} y={162} width={144} height={58} rx={8} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1.5} />
                  <text x={96} y={180} textAnchor="middle" fontSize="10" fontWeight="700" fill="#075985">
                    Aerothermal / Geo Free Heat
                  </text>
                  <text x={96} y={196} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0369a1">
                    +{(Math.max(0, ambHeat) + Math.max(0, ambCool)).toFixed(1)} kWh/m²yr
                  </text>
                  <text x={96} y={210} textAnchor="middle" fontSize="8.5" fill="#0369a1">
                    COP {heatingCop} / EER {coolingEer}
                  </text>

                  {/* Middle Column Nodes: Delivered Heating, Cooling, Lighting & Equipment */}
                  <rect x={208} y={44} width={144} height={54} rx={8} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
                  <text x={280} y={64} textAnchor="middle" fontSize="10" fontWeight="700" fill="#9a3412">
                    Delivered Heating Input
                  </text>
                  <text x={280} y={82} textAnchor="middle" fontSize="11" fontWeight="800" fill="#c2410c">
                    {sim.deliveredHeating} kWh/m²yr
                  </text>

                  <rect x={208} y={110} width={144} height={54} rx={8} fill="#e0e7ff" stroke="#6366f1" strokeWidth={1.5} />
                  <text x={280} y={130} textAnchor="middle" fontSize="10" fontWeight="700" fill="#3730a3">
                    Delivered Cooling Input
                  </text>
                  <text x={280} y={148} textAnchor="middle" fontSize="11" fontWeight="800" fill="#4338ca">
                    {sim.deliveredCooling} kWh/m²yr
                  </text>

                  <rect x={208} y={176} width={144} height={46} rx={8} fill="#fef9c3" stroke="#eab308" strokeWidth={1.5} />
                  <text x={280} y={194} textAnchor="middle" fontSize="10" fontWeight="700" fill="#854d0e">
                    Lighting + Appliances
                  </text>
                  <text x={280} y={210} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#a16207">
                    {sim.annualLightingElec} + {sim.annualEquipmentElec} kWh/m²
                  </text>

                  {/* Right Column Nodes: Zone Thermal Energy Needs */}
                  <rect x={392} y={44} width={144} height={54} rx={8} fill="#ffe4e6" stroke="#e11d48" strokeWidth={1.5} />
                  <text x={464} y={64} textAnchor="middle" fontSize="10" fontWeight="700" fill="#881337">
                    Zone Heating Need (Q_H,nd)
                  </text>
                  <text x={464} y={82} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#be123c">
                    {sim.annualHeatingNeed} kWh/m²yr
                  </text>

                  <rect x={392} y={110} width={144} height={54} rx={8} fill="#dbeafe" stroke="#2563eb" strokeWidth={1.5} />
                  <text x={464} y={130} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e3a8a">
                    Zone Cooling Need (Q_C,nd)
                  </text>
                  <text x={464} y={148} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#1d4ed8">
                    {sim.annualCoolingNeed} kWh/m²yr
                  </text>

                  <rect x={392} y={176} width={144} height={46} rx={8} fill="#f1f5f9" stroke="#64748b" strokeWidth={1.5} />
                  <text x={464} y={194} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#334155">
                    Urban Solar Multiplier: ×{sim.urbanShading.avg}
                  </text>
                  <text x={464} y={210} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0f766e">
                    HRV Efficiency: {Math.round(hrvEff * 100)}%
                  </text>

                  {/* Connecting Sankey Flow Curves */}
                  <path d="M 168 64 C 188 64, 188 70, 208 70" fill="none" stroke="#f43f5e" strokeWidth={3} />
                  <path d="M 168 124 C 188 124, 188 136, 208 136" fill="none" stroke="#10b981" strokeWidth={3.5} />
                  <path d="M 168 190 C 188 190, 188 75, 208 75" fill="none" stroke="#0284c7" strokeWidth={2.5} strokeDasharray="3 2" />
                  <path d="M 352 70 L 392 70" fill="none" stroke="#e11d48" strokeWidth={4} />
                  <path d="M 352 136 L 392 136" fill="none" stroke="#2563eb" strokeWidth={4} />
                </svg>
              );
            })()}
          </div>
        </div>

        {/* HVAC Selection, Ventilation & On-Site Renewables Controls (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Wind className="w-4 h-4 text-teal-600" />
            ASHRAE 209 Cycle #4: HVAC Plant, Ventilation & Solar PV
          </h3>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {(
              [
                { id: 'ashp', label: 'Air-Source Heat Pump' },
                { id: 'gshp', label: 'Geothermal GSHP' },
                { id: 'district_network', label: '5GDHC District Loop' },
                { id: 'gas_chiller', label: 'Gas Boiler + Chiller' }
              ] as Array<{ id: HvacSystemType; label: string }>
            ).map((sys) => (
              <button
                key={sys.id}
                type="button"
                onClick={() => applyHvacPreset(sys.id)}
                className={`px-2.5 py-1.5 rounded-xl font-bold border text-[11px] transition ${
                  hvacSystem === sys.id
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {sys.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Heating COP / η</span>
                <span className="font-bold text-slate-900">{heatingCop.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.85}
                max={5.5}
                step={0.1}
                value={heatingCop}
                onChange={(e) => setHeatingCop(Number(e.target.value))}
                className="w-full accent-rose-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Cooling EER</span>
                <span className="font-bold text-slate-900">{coolingEer.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={2.2}
                max={6.0}
                step={0.1}
                value={coolingEer}
                onChange={(e) => setCoolingEer(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>HRV Heat Recovery</span>
                <span className="font-bold text-teal-700">{Math.round(hrvEff * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={hrvEff}
                onChange={(e) => setHrvEff(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Infiltration ACH</span>
                <span className="font-bold text-slate-900">{achInf.toFixed(2)} h⁻¹</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.05}
                value={achInf}
                onChange={(e) => setAchInf(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Roof PV Coverage</span>
                <span className="font-bold text-emerald-700">{roofPvRatio}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={roofPvRatio}
                onChange={(e) => setRoofPvRatio(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </label>
            <label>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Spandrel BIPV</span>
                <span className="font-bold text-amber-700">{facadeBipvRatio}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={facadeBipvRatio}
                onChange={(e) => setFacadeBipvRatio(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </label>
          </div>

          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={nightFlush}
                onChange={(e) => setNightFlush(e.target.checked)}
                className="accent-teal-600"
              />
              Enable Summer Night-Flush Ventilative Cooling
            </label>
            <span className="text-[11px] font-mono text-teal-700">Vent {achVent} ACH</span>
          </div>
        </div>
      </div>

      {/* Row 2: Monthly Heating/Cooling/PV Bar Chart + EN 16798-1 Adaptive Thermal Comfort Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Monthly Energy Balance Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-rose-500" />
                Monthly Heating, Cooling & On-Site PV Balance (kWh/m²)
              </h3>
              <p className="text-[11px] text-slate-500">
                ISO 52000-1 monthly heating need (red), cooling need (blue), and PV/BIPV generation (green)
              </p>
            </div>
          </div>

          <div className="w-full">
            {(() => {
              const W = 520;
              const H = 215;
              const padL = 36;
              const padR = 16;
              const padT = 16;
              const padB = 26;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const maxVal = Math.max(
                12,
                ...sim.monthlyResults.map((m) => Math.max(m.heatingNeed, m.coolingNeed, m.pvGen))
              );
              const yForV = (v: number) => padT + plotH - (Math.min(maxVal, v) / maxVal) * plotH;

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                    const v = +(maxVal * f).toFixed(1);
                    const y = yForV(v);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="8.5" fill="#64748b">
                          {v}
                        </text>
                      </g>
                    );
                  })}

                  {sim.monthlyResults.map((m, idx) => {
                    const groupX = padL + idx * (plotW / 12) + 5;
                    const bw = 8;
                    return (
                      <g key={m.month}>
                        {/* Heating Bar */}
                        <rect
                          x={groupX}
                          y={yForV(m.heatingNeed)}
                          width={bw}
                          height={Math.max(1, padT + plotH - yForV(m.heatingNeed))}
                          fill="#f43f5e"
                          rx={2}
                        />
                        {/* Cooling Bar */}
                        <rect
                          x={groupX + bw + 2}
                          y={yForV(m.coolingNeed)}
                          width={bw}
                          height={Math.max(1, padT + plotH - yForV(m.coolingNeed))}
                          fill="#3b82f6"
                          rx={2}
                        />
                        {/* PV Bar */}
                        <rect
                          x={groupX + (bw + 2) * 2}
                          y={yForV(m.pvGen)}
                          width={bw}
                          height={Math.max(1, padT + plotH - yForV(m.pvGen))}
                          fill="#10b981"
                          rx={2}
                        />
                        <text
                          x={groupX + 13}
                          y={H - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#475569"
                          fontWeight="600"
                        >
                          {m.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* CBE / EN 16798-1 Adaptive Thermal Comfort Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-emerald-600" />
                CBE / EN 16798-1 Adaptive Thermal Comfort (Classes I, II, III)
              </h3>
              <p className="text-[11px] text-slate-500">
                Indoor Operative Temp T_op (°C) vs. Outdoor Running Mean Temp with Cat I (±2K), Cat II (+3/-4K), Cat III (+4/-5K)
              </p>
            </div>
            <div className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
              Discomfort: {sim.discomfortHours} h/yr ({sim.comfortHoursPct}% Comf)
            </div>
          </div>

          <div className="w-full">
            {(() => {
              const W = 520;
              const H = 215;
              const padL = 36;
              const padR = 18;
              const padT = 14;
              const padB = 26;
              const plotW = W - padL - padR;
              const plotH = H - padT - padB;
              const yForT = (t: number) => padT + plotH - ((t - 15) / 20) * plotH; // 15°C to 35°C
              const xForM = (i: number) => padL + (i + 0.5) * (plotW / 12);

              const optPts = sim.monthlyResults.map((m, i) => `${xForM(i)},${yForT(m.comfortOptimal)}`).join(' ');
              const catIIUp = sim.monthlyResults.map((m, i) => `${xForM(i)},${yForT(m.comfortCatIIUpper)}`).join(' ');
              const catIILow = sim.monthlyResults.map((m, i) => `${xForM(i)},${yForT(m.comfortCatIILower)}`).join(' ');
              const opPts = sim.monthlyResults.map((m, i) => `${xForM(i)},${yForT(m.tOperativeFree)}`).join(' ');

              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                  {[16, 20, 24, 28, 32].map((t) => (
                    <g key={t}>
                      <line x1={padL} y1={yForT(t)} x2={W - padR} y2={yForT(t)} stroke="#f1f5f9" strokeWidth={1} />
                      <text x={padL - 5} y={yForT(t) + 3} textAnchor="end" fontSize="8.5" fill="#64748b">
                        {t}°C
                      </text>
                    </g>
                  ))}

                  {/* Category II Upper & Lower Bounds */}
                  <polyline fill="none" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" points={catIIUp} />
                  <polyline fill="none" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" points={catIILow} />
                  {/* Optimal Comfort Neutrality Line */}
                  <polyline fill="none" stroke="#059669" strokeWidth={1.8} points={optPts} />
                  {/* Free-Running Operative Temperature */}
                  <polyline fill="none" stroke="#e11d48" strokeWidth={2.5} points={opPts} />

                  {sim.monthlyResults.map((m, i) => (
                    <g key={m.month}>
                      <circle
                        cx={xForM(i)}
                        cy={yForT(m.tOperativeFree)}
                        r={3.5}
                        fill={m.tOperativeFree > m.comfortCatIIUpper ? '#e11d48' : '#10b981'}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                      <text x={xForM(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="600">
                        {m.month}
                      </text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Row 3: 3-Scenario Side-by-Side Comparison Matrix ("Baseline", "Passive Optimized", "Net-Zero District Ready") */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
              3-Scenario Design Comparison Matrix (EUI, Operational Cost & Carbon)
            </h3>
            <p className="text-[11px] text-slate-500">
              Load a reference design archetype or overwrite any of the 3 scenario slots with your live building state
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Apply Preset Config:</span>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('baseline')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            >
              Load Baseline
            </button>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('passive')}
              className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold"
            >
              Load Passive Optimized
            </button>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('nzeb_district')}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Load Net-Zero District Ready
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savedScenarios.map((sc, idx) => (
            <div
              key={sc.id}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{sc.name}</h4>
                    <span className="text-[10px] text-slate-500">{sc.badge}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveCurrentToScenarioSlot(idx)}
                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-700 text-white text-[10px] font-bold shrink-0"
                  >
                    Save Current Here
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-400 font-bold block">Net EUI</span>
                    <span className="text-sm font-extrabold text-teal-700">{sc.netSiteEui}</span>
                    <span className="text-[9px] text-slate-400 block">kWh/m²yr</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-400 font-bold block">Op. Cost</span>
                    <span className="text-sm font-extrabold text-slate-800">€{sc.operationalCostEurM2}</span>
                    <span className="text-[9px] text-slate-400 block">€/m²yr</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-400 font-bold block">Op. Carbon</span>
                    <span className="text-sm font-extrabold text-rose-600">{sc.operationalCo2KgM2}</span>
                    <span className="text-[9px] text-slate-400 block">kgCO₂e/m²</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-600 flex items-center justify-between border-t border-slate-200 pt-2">
                <span>
                  Heat {sc.heatingNeed} • Cool {sc.coolingNeed} • PV {sc.pvGen} kWh/m²
                </span>
                <span className="font-semibold text-amber-700">{sc.discomfortHours}h discomf</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advanced HVAC & Renewables Sizing Modal */}
      <AdvancedHvacRenewableModal
        isOpen={showHvacModal}
        onClose={() => setShowHvacModal(false)}
      />
    </div>
  );
};

