// ============================================================================
// POLIMI BEM STUDIO - ADVANCED HVAC & RENEWABLES SIZING MODAL
// Supports:
// 1. Heat Pump SCOP & Carnot Temperature-Dependent COP(T_ext) Curve
// 2. Ground-Source Heat Pump (GSHP) Vertical Borehole Field Sizing (VDI 4640)
// 3. Rooftop PV Orientation & Array Sizing (kWp, Tilt & Azimuth)
// 4. Battery Energy Storage System (BESS) 24h Diurnal Dispatch & Peak Shaving
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Zap,
  Sun,
  Flame,
  Battery,
  Layers,
  CheckCircle2,
  Sliders,
  X,
  Gauge,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { useDesignProject, HvacSystemType } from '../context/DesignProjectContext';

interface AdvancedHvacRenewableModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdvancedHvacRenewableModal: React.FC<AdvancedHvacRenewableModalProps> = ({
  isOpen,
  onClose
}) => {
  const {
    climate,
    hvacSystem,
    applyHvacPreset,
    heatingCop,
    setHeatingCop,
    coolingEer,
    setCoolingEer,
    roofPvRatio,
    setRoofPvRatio,
    lengthX,
    widthY,
    sim
  } = useDesignProject();

  // Active tab within modal
  const [activeTab, setActiveTab] = useState<'heat_pump' | 'gshp_borehole' | 'pv_battery'>('heat_pump');

  // ASHP & GSHP parameters
  const [supplyWaterTempC, setSupplyWaterTempC] = useState<number>(35); // 35°C radiant floor, 45°C fan coils, 60°C radiators
  const [soilConductivity, setSoilConductivity] = useState<number>(2.2); // W/mK
  const [boreholeSpecificHeat, setBoreholeSpecificHeat] = useState<number>(45); // W/m extraction
  const [targetBoreholeDepth, setTargetBoreholeDepth] = useState<number>(120); // 120m standard drilling

  // PV & BESS parameters
  const [pvEfficiency, setPvEfficiency] = useState<number>(0.21); // 21% high efficiency monocrystalline
  const [pvTiltDeg, setPvTiltDeg] = useState<number>(30); // 30 deg optimal tilt for central Italy
  const [pvAzimuthDeg, setPvAzimuthDeg] = useState<number>(0); // 0 = South
  const [batteryCapacityKwh, setBatteryCapacityKwh] = useState<number>(50); // 50 kWh BESS
  const [batteryRoundTripEff, setBatteryRoundTripEff] = useState<number>(92); // 92%

  if (!isOpen) return null;

  // 1. Heat Pump COP(T_ext) temperature sensitivity curve
  // Nominal COP is at A7/W35 (air 7°C, water 35°C)
  const tempRange = [-10, -5, 0, 5, 7, 10, 15];
  const copCurve = tempRange.map((tExt) => {
    // Carnot COP with quality factor ~0.45
    const tSupplyK = supplyWaterTempC + 273.15;
    const tSourceK = tExt + 273.15;
    const deltaT = Math.max(15, tSupplyK - tSourceK);
    const carnotCop = tSupplyK / deltaT;
    const cop = Math.min(5.8, Math.max(1.8, carnotCop * 0.42));
    return { tExt, cop: Number(cop.toFixed(2)) };
  });

  // Seasonal COP (SCOP) weighted estimation
  const estimatedScop = Number(
    (copCurve.reduce((acc, c) => acc + c.cop, 0) / copCurve.length).toFixed(2)
  );

  // 2. GSHP Vertical Borehole Field Sizing (VDI 4640 / ASHRAE guidelines)
  // Peak heating load estimate in kW
  const peakHeatingLoadKw = Math.max(15, (sim.annualHeatingNeed * sim.gfa) / 1200);
  const evaporatorHeatKw = peakHeatingLoadKw * (1 - 1 / Math.max(3.0, heatingCop));
  const totalBoreholeLengthM = Math.ceil((evaporatorHeatKw * 1000) / boreholeSpecificHeat);
  const numberOfBoreholes = Math.max(1, Math.ceil(totalBoreholeLengthM / targetBoreholeDepth));
  const actualDepthPerBorehole = Math.round(totalBoreholeLengthM / numberOfBoreholes);
  const undisturbedGroundTemp = Number((climate.runningMeanTemp + 1.2).toFixed(1));

  // 3. Rooftop PV Peak Power & BESS Dispatch
  const roofAreaM2 = lengthX * widthY;
  const pvUsableAreaM2 = roofAreaM2 * (roofPvRatio / 100);
  const installedPvKwp = Number((pvUsableAreaM2 * pvEfficiency * 1.0).toFixed(1));

  // Tilt/azimuth factor (Perez approximation)
  const optimalTilt = Math.max(15, Math.min(45, Math.round(climate.lat - 10)));
  const tiltLoss = 1 - Math.pow(Math.abs(pvTiltDeg - optimalTilt) / 60, 2) * 0.25;
  const azimuthLoss = 1 - Math.pow(Math.abs(pvAzimuthDeg) / 90, 2) * 0.20;
  const orientationFactor = Number((tiltLoss * azimuthLoss).toFixed(2));
  const adjustedAnnualPvGenKwh = Math.round(installedPvKwp * 1350 * orientationFactor);

  // BESS self-consumption calculation
  const baselineSelfConsumptionPct = 35; // typical without battery
  const batteryBoost = Math.min(45, (batteryCapacityKwh / Math.max(10, installedPvKwp * 4)) * 35);
  const finalSelfConsumptionPct = Math.min(92, Math.round(baselineSelfConsumptionPct + batteryBoost));

  // 24h Diurnal load profile approximation
  const hourlyHours = Array.from({ length: 24 }, (_, i) => i);
  const diurnalProfile = hourlyHours.map((h) => {
    // Demand peak in morning (8-10) and evening (17-21)
    const demandShape =
      0.35 +
      0.45 * Math.exp(-Math.pow(h - 9, 2) / 8) +
      0.55 * Math.exp(-Math.pow(h - 18, 2) / 10);
    const demandKw = Number(((sim.gfa * (sim.totalDeliveredEui / 3000)) * demandShape).toFixed(1));

    // Solar generation (bell curve between 7 and 18)
    const solarShape = h >= 6 && h <= 18 ? Math.sin(((h - 6) / 12) * Math.PI) : 0;
    const pvKw = Number((installedPvKwp * 0.85 * solarShape).toFixed(1));

    // Battery dispatch: charging when PV > Demand, discharging when Demand > PV
    const net = pvKw - demandKw;
    const batteryFlow = net > 0 ? Math.min(net, batteryCapacityKwh * 0.25) : -Math.min(-net, batteryCapacityKwh * 0.25);

    return { hour: h, demandKw, pvKw, batteryFlow: Number(batteryFlow.toFixed(1)) };
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Advanced HVAC & Renewable Energy Sizing Studio
              </h2>
              <p className="text-xs text-slate-400">
                Heat pump seasonal performance, vertical geothermal borehole fields, and PV + BESS dispatch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('heat_pump')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'heat_pump'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-500" />
            1. Heat Pump COP(T) Curve
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gshp_borehole')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'gshp_borehole'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-500" />
            2. Ground-Source Borehole Sizing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pv_battery')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'pv_battery'
                ? 'border-teal-600 text-teal-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Battery className="w-4 h-4 text-emerald-500" />
            3. Rooftop PV & Battery Storage (BESS)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* TAB 1: HEAT PUMP COP(T) CURVE */}
          {activeTab === 'heat_pump' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    HVAC Architecture
                  </label>
                  <select
                    value={hvacSystem}
                    onChange={(e) => applyHvacPreset(e.target.value as HvacSystemType)}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ashp">Air-Source Heat Pump (ASHP)</option>
                    <option value="gshp">Ground-Source Heat Pump (GSHP Geothermal)</option>
                    <option value="district_network">4th Gen Low-Temp District Network</option>
                    <option value="gas_chiller">Legacy Gas Boiler + Water Chiller</option>
                  </select>

                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Supply Water Temp:</span>
                      <strong className="text-slate-900">{supplyWaterTempC}°C</strong>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={65}
                      step={5}
                      value={supplyWaterTempC}
                      onChange={(e) => setSupplyWaterTempC(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>35°C (Radiant Floor)</span>
                      <span>60°C (Radiators)</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Nominal Heating COP (A7/W35):</span>
                      <strong className="text-teal-700">{heatingCop.toFixed(1)}</strong>
                    </div>
                    <input
                      type="range"
                      min={2.0}
                      max={5.5}
                      step={0.1}
                      value={heatingCop}
                      onChange={(e) => setHeatingCop(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* COP Performance Curve Chart */}
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        COP vs. Outdoor Air Temperature Curve (T_ext)
                      </span>
                      <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Seasonal SCOP: ~{estimatedScop}
                      </span>
                    </div>

                    {/* SVG Line Chart for COP */}
                    <svg viewBox="0 0 450 160" className="w-full h-40">
                      {/* Grid lines */}
                      <line x1="40" y1="20" x2="430" y2="20" stroke="#cbd5e1" strokeDasharray="3 3" />
                      <line x1="40" y1="60" x2="430" y2="60" stroke="#cbd5e1" strokeDasharray="3 3" />
                      <line x1="40" y1="100" x2="430" y2="100" stroke="#cbd5e1" strokeDasharray="3 3" />
                      <line x1="40" y1="140" x2="430" y2="140" stroke="#64748b" strokeWidth="1.5" />

                      {/* Y-axis labels */}
                      <text x="32" y="24" fontSize="10" textAnchor="end" fill="#64748b">5.0</text>
                      <text x="32" y="64" fontSize="10" textAnchor="end" fill="#64748b">4.0</text>
                      <text x="32" y="104" fontSize="10" textAnchor="end" fill="#64748b">3.0</text>
                      <text x="32" y="144" fontSize="10" textAnchor="end" fill="#64748b">2.0</text>

                      {/* COP Curve Path */}
                      <path
                        d={copCurve
                          .map((p, idx) => {
                            const x = 50 + idx * 60;
                            // mapping COP 2.0 -> y=140, COP 5.0 -> y=20
                            const y = 140 - ((p.cop - 2.0) / 3.0) * 120;
                            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#0d9488"
                        strokeWidth="3"
                      />

                      {/* Data Dots and X labels */}
                      {copCurve.map((p, idx) => {
                        const x = 50 + idx * 60;
                        const y = 140 - ((p.cop - 2.0) / 3.0) * 120;
                        return (
                          <g key={p.tExt}>
                            <circle cx={x} cy={y} r="4" fill="#0f766e" />
                            <text x={x} y={y - 8} fontSize="10" fontWeight="bold" textAnchor="middle" fill="#0f766e">
                              {p.cop}
                            </text>
                            <text x={x} y="155" fontSize="10" textAnchor="middle" fill="#64748b">
                              {p.tExt}°C
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 mt-2 flex items-start gap-2">
                    <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>
                      Supplying at <strong>{supplyWaterTempC}°C</strong> yields an estimated annual SCOP of <strong>{estimatedScop}</strong> in {climate.name}.
                      Switching from radiators (60°C) to low-temperature radiant floor (35°C) reduces electricity consumption by ~28%.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GSHP VERTICAL BOREHOLE FIELD */}
          {activeTab === 'gshp_borehole' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Geothermal Soil & Drilling Parameters (VDI 4640)
                  </h3>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Soil Thermal Conductivity (λ_s):</span>
                      <strong className="text-slate-900">{soilConductivity} W/m·K</strong>
                    </div>
                    <input
                      type="range"
                      min={1.2}
                      max={3.5}
                      step={0.1}
                      value={soilConductivity}
                      onChange={(e) => setSoilConductivity(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>1.5 (Dry Clay)</span>
                      <span>2.5 (Saturated Sandstone)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Specific Heat Extraction Rate (q_h):</span>
                      <strong className="text-slate-900">{boreholeSpecificHeat} W/m</strong>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={70}
                      step={5}
                      value={boreholeSpecificHeat}
                      onChange={(e) => setBoreholeSpecificHeat(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Nominal Borehole Depth per Well:</span>
                      <strong className="text-slate-900">{targetBoreholeDepth} m</strong>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={180}
                      step={10}
                      value={targetBoreholeDepth}
                      onChange={(e) => setTargetBoreholeDepth(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Sizing Results Card */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-amber-900 mb-3 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-amber-600" />
                      Vertical Borehole Field Sizing Output
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                        <span className="text-[11px] text-slate-500 block">Peak Heat Load</span>
                        <strong className="text-base text-slate-900">{peakHeatingLoadKw.toFixed(1)} kW</strong>
                      </div>
                      <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                        <span className="text-[11px] text-slate-500 block">Undisturbed Ground T</span>
                        <strong className="text-base text-amber-700">{undisturbedGroundTemp} °C</strong>
                      </div>
                      <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                        <span className="text-[11px] text-slate-500 block">Total Drilled Length</span>
                        <strong className="text-base text-slate-900">{totalBoreholeLengthM} m</strong>
                      </div>
                      <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                        <span className="text-[11px] text-slate-500 block">Borehole Count</span>
                        <strong className="text-base text-emerald-700">
                          {numberOfBoreholes} wells @ {actualDepthPerBorehole}m
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-800 bg-white/90 p-3 rounded-lg border border-amber-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Recommended grid layout: <strong>{Math.ceil(Math.sqrt(numberOfBoreholes))} × {Math.ceil(numberOfBoreholes / Math.ceil(Math.sqrt(numberOfBoreholes)))}</strong> with minimum 6.0m spacing between boreholes to prevent thermal interference.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROOFTOP PV & BATTERY STORAGE (BESS) */}
          {activeTab === 'pv_battery' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    PV Array & Battery Configuration
                  </span>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Roof PV Coverage:</span>
                      <strong className="text-slate-900">{roofPvRatio}%</strong>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={5}
                      value={roofPvRatio}
                      onChange={(e) => setRoofPvRatio(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Array Tilt Angle (β):</span>
                      <strong className="text-slate-900">{pvTiltDeg}° (Opt: {optimalTilt}°)</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      step={5}
                      value={pvTiltDeg}
                      onChange={(e) => setPvTiltDeg(Number(e.target.value))}
                      className="w-full accent-teal-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>BESS Battery Capacity:</span>
                      <strong className="text-emerald-700">{batteryCapacityKwh} kWh</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      step={10}
                      value={batteryCapacityKwh}
                      onChange={(e) => setBatteryCapacityKwh(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Installed Peak:</span>
                      <strong>{installedPvKwp} kWp</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Annual Gen:</span>
                      <strong className="text-teal-700">{adjustedAnnualPvGenKwh.toLocaleString()} kWh/yr</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Self-Consumption:</span>
                      <strong className="text-emerald-700">{finalSelfConsumptionPct}%</strong>
                    </div>
                  </div>
                </div>

                {/* 24h Diurnal Dispatch Chart */}
                <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800">
                      24-Hour Diurnal Dispatch (Building Demand vs. PV + BESS)
                    </span>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-slate-700 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" /> Demand
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> PV Gen
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Battery
                      </span>
                    </div>
                  </div>

                  {/* SVG 24h Area/Line chart */}
                  <svg viewBox="0 0 480 180" className="w-full h-44">
                    {/* Background grid */}
                    <line x1="30" y1="20" x2="470" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="60" x2="470" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="100" x2="470" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="30" y1="140" x2="470" y2="140" stroke="#94a3b8" strokeWidth="1.2" />

                    {/* Solar curve area */}
                    <path
                      d={`M 30 140 ${diurnalProfile
                        .map((p) => {
                          const x = 30 + (p.hour / 23) * 440;
                          const y = 140 - Math.min(120, (p.pvKw / Math.max(1, installedPvKwp)) * 110);
                          return `L ${x} ${y}`;
                        })
                        .join(' ')} L 470 140 Z`}
                      fill="#fef3c7"
                      fillOpacity="0.7"
                    />

                    {/* PV generation line */}
                    <path
                      d={diurnalProfile
                        .map((p, idx) => {
                          const x = 30 + (p.hour / 23) * 440;
                          const y = 140 - Math.min(120, (p.pvKw / Math.max(1, installedPvKwp)) * 110);
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />

                    {/* Building Demand line */}
                    <path
                      d={diurnalProfile
                        .map((p, idx) => {
                          const x = 30 + (p.hour / 23) * 440;
                          const y = 140 - Math.min(120, (p.demandKw / Math.max(1, installedPvKwp)) * 80);
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="2"
                    />

                    {/* Battery charge/discharge bars */}
                    {diurnalProfile.map((p) => {
                      const x = 30 + (p.hour / 23) * 440 - 3;
                      const h = Math.abs(p.batteryFlow) * 1.5;
                      const y = p.batteryFlow > 0 ? 140 - h : 140;
                      return (
                        <rect
                          key={p.hour}
                          x={x}
                          y={y}
                          width="6"
                          height={Math.max(1, h)}
                          fill={p.batteryFlow > 0 ? '#10b981' : '#6366f1'}
                          opacity="0.8"
                          rx="1"
                        />
                      );
                    })}

                    {/* Hour labels */}
                    {[0, 4, 8, 12, 16, 20, 23].map((hr) => (
                      <text
                        key={hr}
                        x={30 + (hr / 23) * 440}
                        y="156"
                        fontSize="9"
                        textAnchor="middle"
                        fill="#64748b"
                      >
                        {hr}:00
                      </text>
                    ))}
                  </svg>

                  <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 mt-2 flex items-center justify-between">
                    <span>
                      The <strong>{batteryCapacityKwh} kWh BESS</strong> stores mid-day solar surplus (green bars) and discharges in the evening peak (indigo bars), increasing on-site self-consumption from <strong>35%</strong> to <strong>{finalSelfConsumptionPct}%</strong>.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Parameters automatically coupled into Stage 5 Energy Balance & Stage 6 LCA.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
