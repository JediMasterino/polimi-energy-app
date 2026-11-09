import React, { useState } from 'react';
import {
  Globe,
  Building2,
  Box,
  Layers,
  Zap,
  Recycle,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import {
  DesignProjectProvider,
  useDesignProject,
  ScaleStageId,
  BuildingProgramType,
  LegislativeTargetType
} from './context/DesignProjectContext';
import { INITIAL_CLIMATE_PRESETS } from './data/climateAndStrategies';
import { EpwSearchAndUploadWidget } from './components/ClimaAndAdvancedPanels';
import { Stage1Climate } from './components/Stage1Climate';
import { Stage2Urban } from './components/Stage2Urban';
import { Stage3FormZoning } from './components/Stage3FormZoning';
import { Stage4FacadeFabric } from './components/Stage4FacadeFabric';
import { Stage5EnergyComfort } from './components/Stage5EnergyComfort';
import { Stage6LCA } from './components/Stage6LCA';

const SCALE_STAGES: Array<{
  id: ScaleStageId;
  shortTitle: string;
  subTitle: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 1, shortTitle: '1. Climate & Program', subTitle: 'Macro-Climate & Brief', icon: Globe },
  { id: 2, shortTitle: '2. Urban 2.5D District', subTitle: 'SVF & Shading Mask', icon: Building2 },
  { id: 3, shortTitle: '3. Massing & Zoning', subTitle: 'ASHRAE 209 #1–2', icon: Box },
  { id: 4, shortTitle: '4. Facade & Fabric', subTitle: 'Shoebox & ISO 13786', icon: Layers },
  { id: 5, shortTitle: '5. Energy & Comfort', subTitle: 'ISO 52000-1 & HVAC', icon: Zap },
  { id: 6, shortTitle: '6. Whole-Life LCA', subTitle: 'EN 15978 A–D & 5Rs', icon: Recycle }
];

const StudioWorkspace: React.FC = () => {
  const {
    activeStage,
    setActiveStage,
    climateId,
    setClimateId,
    customClimates,
    addAndSelectClimate,
    climate,
    buildingProgram,
    setBuildingProgram,
    targetOccupancyDensity,
    setTargetOccupancyDensity,
    internalLoadsWm2,
    setInternalLoadsWm2,
    legislativeTarget,
    setLegislativeTarget,
    activeStrategies,
    applyOptimizationPreset,
    sim
  } = useDesignProject();

  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);

  const handleProgramChange = (p: BuildingProgramType) => {
    setBuildingProgram(p);
    if (p === 'office') {
      setTargetOccupancyDensity(0.07);
      setInternalLoadsWm2(14);
    } else if (p === 'residential') {
      setTargetOccupancyDensity(0.04);
      setInternalLoadsWm2(8);
    } else if (p === 'educational') {
      setTargetOccupancyDensity(0.18);
      setInternalLoadsWm2(16);
    } else if (p === 'hospitality') {
      setTargetOccupancyDensity(0.08);
      setInternalLoadsWm2(12);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Top Academic Header */}
      <header className="bg-slate-950 text-white border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-400 border border-slate-700 transition"
              title={leftDrawerOpen ? 'Collapse Left Control Drawer' : 'Expand Left Control Drawer'}
            >
              {leftDrawerOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Politecnico di Milano • DABC
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Multi-Scale Downscaling Architecture & Building Physics Engine
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                PoliMi Urban-to-Building BEM Studio
              </h1>
            </div>
          </div>

          {/* Quick Benchmark Optimization Archetypes */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] text-slate-400 hidden md:inline">Design Benchmark:</span>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('baseline')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition"
            >
              Baseline
            </button>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('passive')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-900/60 hover:bg-teal-800/80 text-teal-200 border border-teal-700 font-semibold transition"
            >
              Passive Optimized
            </button>
            <button
              type="button"
              onClick={() => applyOptimizationPreset('nzeb_district')}
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold flex items-center gap-1 shadow transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Net-Zero District Ready
            </button>
          </div>
        </div>
      </header>

      {/* Progressive Top-Down "Scale Switcher" Workflow Bar */}
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 sticky top-0 z-30 shadow">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-1.5 overflow-x-auto">
          {SCALE_STAGES.map((st, idx) => {
            const Icon = st.icon;
            const isActive = activeStage === st.id;
            const isPast = activeStage > st.id;
            return (
              <React.Fragment key={st.id}>
                <button
                  type="button"
                  onClick={() => setActiveStage(st.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition shrink-0 ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md font-extrabold'
                      : isPast
                      ? 'bg-slate-800/90 text-teal-300 border-teal-800/70 hover:bg-slate-800 font-semibold'
                      : 'bg-slate-800/50 text-slate-300 border-slate-700/70 hover:bg-slate-800 font-semibold'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg ${
                      isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-teal-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs leading-tight">{st.shortTitle}</div>
                    <div
                      className={`text-[10px] leading-tight ${
                        isActive ? 'text-slate-900 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {st.subTitle}
                    </div>
                  </div>
                </button>
                {idx < SCALE_STAGES.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* Main 3-Column Studio Layout: Left Control Drawer + Central Canvas + Right KPI & Compliance Panel */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* PERSISTENT LEFT CONTROL DRAWER */}
        {leftDrawerOpen && (
          <aside className="lg:col-span-3 space-y-4">
            {/* Card 1: Climate & Live EPW Map Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-600" />
                  Climate & EPW Boundary
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Köppen {climate.koppen} • Zone {climate.dpr412Zone}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Reference Climate Preset (or select from EPW Map below):
                </label>
                <select
                  value={climateId}
                  onChange={(e) => setClimateId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500"
                >
                  <optgroup label="Academic Reference Presets">
                    {Object.values(INITIAL_CLIMATE_PRESETS).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} [{c.koppen} • HDD {c.hdd}]
                      </option>
                    ))}
                  </optgroup>
                  {Object.keys(customClimates).length > 0 && (
                    <optgroup label="Loaded EPW Weather Stations (8,760h)">
                      {Object.values(customClimates).map((c) => (
                        <option key={c.id} value={c.id}>
                          ★ {c.name} [{c.koppen} • HDD {c.hdd}]
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Live 23,227-Station EPW Map + Search + Local Upload/Export */}
              <EpwSearchAndUploadWidget
                currentClimate={climate}
                customClimates={customClimates}
                onSelectClimate={addAndSelectClimate}
              />
            </div>

            {/* Card 2: Site Brief, Program & Legislative Target */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3 text-xs">
              <div className="font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Program Brief & Legislation
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Building Use Program (UNI/TS 11300 / ISO 18523):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'office', label: 'Office / Tertiary' },
                      { id: 'residential', label: 'Residential' },
                      { id: 'educational', label: 'University / School' },
                      { id: 'hospitality', label: 'Hospitality / Hotel' }
                    ] as Array<{ id: BuildingProgramType; label: string }>
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProgramChange(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg font-bold border text-[11px] transition ${
                        buildingProgram === p.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Occupancy Density</span>
                  <span className="font-bold text-slate-900">{targetOccupancyDensity.toFixed(2)} pers/m²</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.01}
                  value={targetOccupancyDensity}
                  onChange={(e) => setTargetOccupancyDensity(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>

              <label className="block">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Internal Gains (People + Equip)</span>
                  <span className="font-bold text-slate-900">{internalLoadsWm2} W/m²</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={30}
                  step={1}
                  value={internalLoadsWm2}
                  onChange={(e) => setInternalLoadsWm2(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </label>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Legislative / Certification Target:
                </label>
                <select
                  value={legislativeTarget}
                  onChange={(e) => setLegislativeTarget(e.target.value as LegislativeTargetType)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="nZEB_Italy_DM2015">Italy DM 26/06/2015 nZEB (Requisiti Minimi)</option>
                  <option value="EU_EPBD_2030_ZEB">EU EPBD Recast 2030 Zero-Emission (ZEB)</option>
                  <option value="Passivhaus">PHI Passivhaus Classic (≤ 15 kWh/m²yr)</option>
                  <option value="LEED_Platinum">LEED v4.1 / Level(s) Whole-Life Carbon</option>
                </select>
              </div>
            </div>

            {/* Card 3: Multi-Scale Downscaling Chain Status */}
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 p-3.5 space-y-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-teal-400 text-[11px]">
                Active Multi-Scale Downscaling Chain
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">1. ClimateStrategies:</span>
                  <span className="font-semibold text-white">{activeStrategies.length} active cards</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">2. Urban Shading / SVF:</span>
                  <span className="font-mono text-amber-300">×{sim.urbanShading.avg} (SVF {sim.skyViewFactor})</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">3. Massing & S/V:</span>
                  <span className="font-mono text-teal-300">{sim.gfa} m² • S/V {sim.svRatio}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">4. Fabric U / Y_ie / κ_i:</span>
                  <span className="font-mono text-sky-300">
                    {sim.uWall} / {sim.yIe} / {sim.kappaI}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">5–6. Net EUI / 50y WLC:</span>
                  <span className="font-mono text-emerald-300">
                    {sim.netSiteEui} kWh • {sim.lca.wholeLifeCarbonNet} kgCO₂
                  </span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* CENTRAL INTERACTIVE 2D / 2.5D / BIOCLIMATIC STAGE CANVAS */}
        <section className={leftDrawerOpen ? 'lg:col-span-6' : 'lg:col-span-9'}>
          {activeStage === 1 && <Stage1Climate />}
          {activeStage === 2 && <Stage2Urban />}
          {activeStage === 3 && <Stage3FormZoning />}
          {activeStage === 4 && <Stage4FacadeFabric />}
          {activeStage === 5 && <Stage5EnergyComfort />}
          {activeStage === 6 && <Stage6LCA />}
        </section>

        {/* PERSISTENT RIGHT KPI & COMPLIANCE PANEL */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Card 1: Primary Energy & Net Site EUI Gauge */}
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-400">
                Real-Time Performance KPIs
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sim.compliance.nzebPass
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {sim.compliance.nzebPass ? '★ nZEB / ZEB Ready' : 'Optimization Needed'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 block">Net Site EUI</span>
                <span className="text-2xl font-extrabold text-teal-400">{sim.netSiteEui}</span>
                <span className="text-[10px] text-slate-400 block">
                  kWh/m²yr (Deliv {sim.totalDeliveredEui})
                </span>
              </div>

              <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] uppercase text-slate-400 block">Renewable Share</span>
                <span className="text-2xl font-extrabold text-emerald-400">{sim.renewableSharePct}%</span>
                <span className="text-[10px] text-slate-400 block">
                  PV+Dist: {sim.totalRenewableGen} kWh/m²
                </span>
              </div>
            </div>

            {/* Breakdown Bars */}
            <div className="space-y-2 text-xs pt-1">
              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Heating Need (Q_H,nd)</span>
                  <span className="font-mono font-bold text-rose-400">{sim.annualHeatingNeed} kWh/m²yr</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${Math.min(100, (sim.annualHeatingNeed / 80) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Cooling Need (Q_C,nd)</span>
                  <span className="font-mono font-bold text-sky-400">{sim.annualCoolingNeed} kWh/m²yr</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${Math.min(100, (sim.annualCoolingNeed / 80) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">DALEC Lighting + Equip</span>
                  <span className="font-mono font-bold text-amber-300">
                    {(sim.annualLightingElec + sim.annualEquipmentElec).toFixed(1)} kWh/m²yr
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-amber-400"
                    style={{
                      width: `${Math.min(
                        100,
                        ((sim.annualLightingElec + sim.annualEquipmentElec) / 60) * 100
                      )}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Legislative & Building Physics Compliance Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
            <div className="font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Legislative & Physics Checks</span>
              <span className="text-[10px] font-mono text-slate-500">DM 26/06/2015</span>
            </div>

            <div className="space-y-2">
              {[
                {
                  name: 'Opaque Wall U-Value',
                  val: `${sim.uWall} W/m²K`,
                  target: climate.dpr412Zone === 'E' || climate.dpr412Zone === 'F' ? '≤ 0.26' : '≤ 0.32',
                  pass: sim.compliance.uWallPass
                },
                {
                  name: 'Periodic Transmittance Y_ie',
                  val: `${sim.yIe} W/m²K`,
                  target: '≤ 0.10 W/m²K',
                  pass: sim.compliance.yIePass
                },
                {
                  name: 'Internal Heat Capacity κ_i',
                  val: `${sim.kappaI} kJ/m²K`,
                  target: '≥ 40 kJ/m²K',
                  pass: sim.compliance.kappaPass
                },
                {
                  name: 'Glazing U_win',
                  val: `${sim.zones.South.wwrPct}% WWR`,
                  target: ' Compliant',
                  pass: sim.compliance.uWinPass
                },
                {
                  name: 'EN 17037 Daylight Factor',
                  val: `${sim.avgDaylightFactorPct}% (sDA ${sim.avgDaylightAutonomyPct}%)`,
                  target: '≥ 2.0% DF',
                  pass: sim.compliance.daylightPass
                },
                {
                  name: 'EN 16798 Adaptive Comfort',
                  val: `${sim.comfortHoursPct}% (${sim.discomfortHours}h out)`,
                  target: '≥ 92% hrs',
                  pass: sim.discomfortHours <= 700
                }
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                >
                  <div>
                    <div className="font-bold text-slate-800 text-[11px]">{row.name}</div>
                    <div className="text-[10px] text-slate-500">
                      Current: <strong>{row.val}</strong> (Req {row.target})
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 ${
                      row.pass
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {row.pass ? (
                      <>
                        <ShieldCheck className="w-3 h-3" /> PASS
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" /> CHECK
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Whole-Life Carbon LCA Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold uppercase tracking-wider text-slate-700">
                50-Yr Whole-Life Carbon
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                EN 15978 A–D
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-slate-500">Net Carbon Footprint:</span>
              <span className="text-xl font-extrabold text-slate-900">
                {sim.lca.wholeLifeCarbonNet}{' '}
                <span className="text-[11px] font-normal text-slate-500">kgCO₂e/m²</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block">Upfront A1–A3</span>
                <strong className="text-slate-800 text-xs">{sim.lca.a1a3Total}</strong>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-400 block">Oper. B6 (50y)</span>
                <strong className="text-rose-600 text-xs">{sim.lca.b6Operational50Yr}</strong>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block">Mod D (5Rs)</span>
                <strong className="text-emerald-700 text-xs">{sim.lca.moduleDCredit}</strong>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <DesignProjectProvider>
      <StudioWorkspace />
    </DesignProjectProvider>
  );
}
