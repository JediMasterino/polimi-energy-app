// ============================================================================
// POLIMI BEM STUDIO - STAGE DALEC+ STUDIO COMPONENT
// 3D Shoebox & Multi-Zone Configurator (DALEC+ Geometry, 3-Band Facade & Sensors)
// Coupled with 8,760-Hour 5R1C Dynamic Thermal Network, Split-Flux Daylighting,
// EnergyPlus .IDF Bridge, 8,760h Carpet Heatmaps & Multi-Zone Building Aggregator
// ============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import {
  Sun,
  Eye,
  Sliders,
  Layers,
  Thermometer,
  Zap,
  Activity,
  Download,
  FileCode,
  Calendar,
  Clock,
  Sparkles,
  Info,
  Maximize2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Plus,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useDesignProject } from '../context/DesignProjectContext';
import {
  DalecRoomConfig,
  DalecControlConfig,
  DalecThermalConfig,
  DalecSimulationResult,
  getDefaultDalecRoomConfig,
  getDefaultDalecControlConfig,
  getDefaultDalecThermalConfig,
  runDalecSimulation,
  MONTH_NAMES
} from '../utils/hourlyDalecEnergyPlusEngine';
import {
  generateDalecEnergyPlusIdf,
  generateEnergyPlusLocalRunnerScript
} from '../utils/energyPlusIdfGenerator';
import { downloadTextFile } from '../utils/bldExportEngine';

export interface SavedDalecZone {
  id: string;
  name: string;
  orientation: number;
  floorAreaM2: number;
  result: DalecSimulationResult;
}

export type CarpetMetricId =
  | 'cooling'
  | 'heating'
  | 'lighting'
  | 'daylight_ma'
  | 'cda'
  | 'facade_state'
  | 'glare_mp'
  | 'melanopic_ev'
  | 'temperature';

export const StageDalecPlusStudio: React.FC = () => {
  const { climate, sim, structureSystem, roofPvRatio } = useDesignProject();

  // 1. DALEC+ Configuration State
  const [room, setRoom] = useState<DalecRoomConfig>(getDefaultDalecRoomConfig());
  const [controls, setControls] = useState<DalecControlConfig>(getDefaultDalecControlConfig());
  const [thermal, setThermal] = useState<DalecThermalConfig>(getDefaultDalecThermalConfig());

  // 2. Active View Tabs & Tool States
  const [activeTab, setActiveTab] = useState<'3d_viewport' | 'monthly_matrix' | 'carpet_plot' | 'multizone_aggregator'>('3d_viewport');
  const [selectedCarpetMetric, setSelectedCarpetMetric] = useState<CarpetMetricId>('cooling');
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);
  const [monthlyMetricMode, setMonthlyMetricMode] = useState<'useful' | 'final' | 'primary' | 'cost' | 'co2'>('useful');
  const [showIdfModal, setShowIdfModal] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // 3. Multi-Zone Saved Zones List (for Whole-Building Aggregation)
  const [savedZones, setSavedZones] = useState<SavedDalecZone[]>([]);
  const [newZoneName, setNewZoneName] = useState('South Perimeter Zone');
  const [newZoneAreaM2, setNewZoneAreaM2] = useState(120);

  // Sync urban obstruction angle from Stage 2 if available
  useEffect(() => {
    if (sim?.canyonAnglesDeg?.S) {
      setRoom((prev) => ({
        ...prev,
        horizonObstructionDeg: Math.round(sim.canyonAnglesDeg.S)
      }));
    }
  }, [sim?.canyonAnglesDeg?.S]);

  // Sync thermal mass from Eurocode structural calculator
  const handleSyncEurocodeThermalMass = () => {
    let cap = 110000;
    if (structureSystem === 'rc_standard') cap = 165000;
    else if (structureSystem === 'clt_hybrid') cap = 75000;
    else if (structureSystem === 'steel_composite') cap = 95000;
    else if (structureSystem === 'low_carbon_rc') cap = 145000;

    // Couple with internal areal capacity kappaI if calculated
    if (sim?.kappaI) {
      cap = Math.round(sim.kappaI * 1000 + 45000);
    }

    setThermal((prev) => ({
      ...prev,
      effectiveThermalCapacityJm2K: cap,
      uWall: sim?.uWall || prev.uWall
    }));
  };

  // Run the in-browser 8,760-hour coupled simulation
  const simulation = useMemo<DalecSimulationResult>(() => {
    return runDalecSimulation(climate, room, controls, thermal);
  }, [climate, room, controls, thermal]);

  // --------------------------------------------------------------------------
  // THREE.JS 3D ROOM CUTAWAY VIEWPORT
  // --------------------------------------------------------------------------
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameId = useRef<number | null>(null);
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const cameraAngle = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 12 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 550;
    const height = 380;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a); // Slate-900

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.replaceChildren(renderer.domElement);

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    blueLight.position.set(-10, 8, -10);
    scene.add(blueLight);

    // Grid Floor
    const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);

    // Room Dimensions
    const W = room.width;
    const D = room.depth;
    const H = room.height;

    // Center room at origin (X from -W/2 to W/2, Z from -D/2 to D/2, Y from 0 to H)
    const roomGroup = new THREE.Group();

    // 1. FLOOR SLAB (Opaque)
    const floorGeo = new THREE.BoxGeometry(W, 0.2, D);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.1, 0);
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    // 2. CEILING SLAB (Cutaway/Translucent)
    const ceilGeo = new THREE.BoxGeometry(W, 0.15, D);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.35,
      roughness: 0.9
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.position.set(0, H + 0.075, 0);
    roomGroup.add(ceilMesh);

    // 3. REAR & SIDE WALLS (Cutaway Opaque)
    // Rear North wall (Z = -D/2)
    const rearGeo = new THREE.BoxGeometry(W, H, 0.2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const rearMesh = new THREE.Mesh(rearGeo, wallMat);
    rearMesh.position.set(0, H / 2, -D / 2);
    roomGroup.add(rearMesh);

    // West Side wall (X = -W/2)
    const westGeo = new THREE.BoxGeometry(0.2, H, D);
    const westMesh = new THREE.Mesh(westGeo, wallMat);
    westMesh.position.set(-W / 2, H / 2, 0);
    roomGroup.add(westMesh);

    // East Side wall (X = +W/2) - semi-transparent for cutaway viewing
    const eastMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.25
    });
    const eastMesh = new THREE.Mesh(westGeo, eastMat);
    eastMesh.position.set(W / 2, H / 2, 0);
    roomGroup.add(eastMesh);

    // 4. THREE FACADE BANDS ON SOUTH WALL (Z = +D/2)
    const h1 = Math.min(1.0, H);
    const h2 = Math.min(2.0, H);

    // FA1: Sill / Parapet Band (0 to 1m)
    const fa1H = h1;
    const fa1Mat =
      room.bands.FA1.glazingRatio > 0
        ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
        : new THREE.MeshStandardMaterial({ color: 0x334155 });
    const fa1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W, fa1H, 0.15), fa1Mat);
    fa1Mesh.position.set(0, fa1H / 2, D / 2);
    roomGroup.add(fa1Mesh);

    // FA2: Vision Band (1m to 2m)
    const fa2H = Math.max(0, h2 - h1);
    const fa2Mat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1
    });
    const fa2Mesh = new THREE.Mesh(new THREE.BoxGeometry(W, fa2H, 0.08), fa2Mat);
    fa2Mesh.position.set(0, h1 + fa2H / 2, D / 2);
    roomGroup.add(fa2Mesh);

    // FA3: Clerestory Daylight Band (2m to H)
    const fa3H = Math.max(0, H - h2);
    if (fa3H > 0) {
      const fa3Mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1
      });
      const fa3Mesh = new THREE.Mesh(new THREE.BoxGeometry(W, fa3H, 0.08), fa3Mat);
      fa3Mesh.position.set(0, h2 + fa3H / 2, D / 2);
      roomGroup.add(fa3Mesh);
    }

    // Overhang Protrusion Canopy
    if (room.overhangDepth > 0) {
      const overGeo = new THREE.BoxGeometry(W + 0.4, 0.1, room.overhangDepth);
      const overMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
      const overMesh = new THREE.Mesh(overGeo, overMat);
      overMesh.position.set(0, H + 0.05, D / 2 + room.overhangDepth / 2);
      roomGroup.add(overMesh);
    }

    // 5. DUAL DAYLIGHTING WORKPLANE SENSOR MESHES (MA1 & MA2) AT 0.8m HEIGHT
    const ma1Geo = new THREE.PlaneGeometry(W * 0.85, D * 0.4);
    const ma1Mat = new THREE.MeshBasicMaterial({
      color: 0x10b981, // Green
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ma1Mesh = new THREE.Mesh(ma1Geo, ma1Mat);
    ma1Mesh.rotation.x = Math.PI / 2;
    ma1Mesh.position.set(0, 0.8, D / 4); // Near window
    roomGroup.add(ma1Mesh);

    const ma2Geo = new THREE.PlaneGeometry(W * 0.85, D * 0.4);
    const ma2Mat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, // Blue
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ma2Mesh = new THREE.Mesh(ma2Geo, ma2Mat);
    ma2Mesh.rotation.x = Math.PI / 2;
    ma2Mesh.position.set(0, 0.8, -D / 4); // Far from window
    roomGroup.add(ma2Mesh);

    // 6. OVERHEAD 3D LUMINAIRE BARS (Group 2 Near Window & Group 1 Far)
    const lumGeo = new THREE.BoxGeometry(W * 0.7, 0.06, 0.15);
    const lumMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.6 });

    const lumGroup2 = new THREE.Mesh(lumGeo, lumMat);
    lumGroup2.position.set(0, H - 0.2, D / 4);
    roomGroup.add(lumGroup2);

    const lumGroup1 = new THREE.Mesh(lumGeo, lumMat);
    lumGroup1.position.set(0, H - 0.2, -D / 4);
    roomGroup.add(lumGroup1);

    // 7. OCCUPANT VIEWPOINT PINS (MP3, MP4, MP5, MP6)
    const createPin = (x: number, z: number, color: number) => {
      const pinGroup = new THREE.Group();
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      stick.position.y = 0.6;
      pinGroup.add(stick);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
      );
      head.position.y = 1.2;
      pinGroup.add(head);

      pinGroup.position.set(x, 0, z);
      return pinGroup;
    };

    roomGroup.add(createPin(0, D / 4, 0xf43f5e));   // MP3 (Desk near window)
    roomGroup.add(createPin(0, -D / 4, 0x8b5cf6));  // MP4 (Desk far)
    roomGroup.add(createPin(-W / 3, 0, 0x06b6d4));  // MP5 (Side wall)
    roomGroup.add(createPin(W / 3, -D / 3, 0x14b8a6)); // MP6 (Doorway)

    scene.add(roomGroup);

    // Update Camera Position
    const updateCamera = () => {
      const { theta, phi, radius } = cameraAngle.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, H / 2, 0);
    };
    updateCamera();

    // Mouse Interaction Handlers
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };

      cameraAngle.current.theta -= dx * 0.008;
      cameraAngle.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngle.current.phi - dy * 0.008));
      updateCamera();
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngle.current.radius = Math.max(5, Math.min(25, cameraAngle.current.radius + e.deltaY * 0.015));
      updateCamera();
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('wheel', onWheel);

    // Animation Loop
    const animate = () => {
      renderer.render(scene, camera);
      animFrameId.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [room, controls]);

  // --------------------------------------------------------------------------
  // 8,760 CARPET HEATMAP CANVAS RENDERER (24h x 365d)
  // --------------------------------------------------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simulation || simulation.hourlyRecords.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 730; // 2 pixels per day (365 * 2)
    const height = 240; // 10 pixels per hour (24 * 10)
    canvas.width = width;
    canvas.height = height;

    const records = simulation.hourlyRecords;

    for (let day = 1; day <= 365; day++) {
      for (let hr = 0; hr < 24; hr++) {
        const idx = (day - 1) * 24 + hr;
        if (idx >= records.length) continue;
        const r = records[idx];

        let val = 0;
        let color = '#0f172a';

        if (selectedCarpetMetric === 'cooling') {
          val = r.coolingDemandWm2; // 0 to 80 W/m²
          const intensity = Math.min(1.0, val / 60);
          color = intensity > 0 ? `rgba(14, 165, 233, ${0.15 + intensity * 0.85})` : '#0f172a';
        } else if (selectedCarpetMetric === 'heating') {
          val = r.heatingDemandWm2; // 0 to 80 W/m²
          const intensity = Math.min(1.0, val / 60);
          color = intensity > 0 ? `rgba(244, 63, 94, ${0.15 + intensity * 0.85})` : '#0f172a';
        } else if (selectedCarpetMetric === 'lighting') {
          val = r.powerLightingTotal; // 0 to 15 W/m²
          const intensity = Math.min(1.0, val / 12);
          color = intensity > 0 ? `rgba(234, 179, 8, ${0.2 + intensity * 0.8})` : '#0f172a';
        } else if (selectedCarpetMetric === 'daylight_ma') {
          val = r.illuminanceMA1; // 0 to 2000 lx
          const intensity = Math.min(1.0, val / 1000);
          color = intensity > 0 ? `rgba(16, 185, 129, ${0.15 + intensity * 0.85})` : '#0f172a';
        } else if (selectedCarpetMetric === 'cda') {
          val = r.cdaCreditMA1; // 0 to 1
          color = val >= 1.0 ? '#10b981' : val > 0 ? '#3b82f6' : '#1e293b';
        } else if (selectedCarpetMetric === 'facade_state') {
          // Discrete states 0 to 3
          if (r.facadeState === 0) color = '#334155'; // Ground state
          else if (r.facadeState === 1) color = '#f59e0b'; // Glare protection
          else if (r.facadeState === 2) color = '#0284c7'; // Sun protection
          else color = '#ec4899'; // Combined
        } else if (selectedCarpetMetric === 'glare_mp') {
          val = r.viewpointMP3.glareLuminance; // cd/m²
          color = r.viewpointMP3.isGlareExceeded ? '#ef4444' : val > 1500 ? '#f59e0b' : '#1e293b';
        } else if (selectedCarpetMetric === 'melanopic_ev') {
          val = r.viewpointMP3.melanopicLux; // mel. lx
          color = val >= 250 ? '#06b6d4' : val > 100 ? '#0284c7' : '#1e293b';
        } else if (selectedCarpetMetric === 'temperature') {
          val = r.tOperative; // °C
          if (val > 26.0) color = '#ef4444'; // Overheating
          else if (val < 20.0) color = '#38bdf8'; // Cold
          else color = '#10b981'; // Comfort band
        }

        ctx.fillStyle = color;
        ctx.fillRect((day - 1) * 2, hr * 10, 2, 10);
      }
    }
  }, [simulation, selectedCarpetMetric]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const day = Math.max(1, Math.min(365, Math.floor(x / (rect.width / 365)) + 1));
    const hr = Math.max(0, Math.min(23, Math.floor(y / (rect.height / 24))));
    const idx = (day - 1) * 24 + hr;
    setHoveredHourIndex(idx);
  };

  // --------------------------------------------------------------------------
  // MULTI-ZONE AGGREGATOR ACTIONS
  // --------------------------------------------------------------------------
  const handleSaveCurrentZone = () => {
    const newZone: SavedDalecZone = {
      id: `zone_${Date.now()}`,
      name: newZoneName,
      orientation: room.orientationDeg,
      floorAreaM2: newZoneAreaM2,
      result: simulation
    };
    setSavedZones((prev) => [...prev, newZone]);
  };

  const handleRemoveZone = (id: string) => {
    setSavedZones((prev) => prev.filter((z) => z.id !== id));
  };

  // Whole-Building Aggregated Metrics
  const totalSavedAreaM2 = savedZones.reduce((acc, z) => acc + z.floorAreaM2, 0);
  const weightedAnnualUsefulCooling =
    totalSavedAreaM2 > 0
      ? +(savedZones.reduce((acc, z) => acc + z.result.annualKPIs.annualUsefulCoolingKwhM2 * z.floorAreaM2, 0) / totalSavedAreaM2).toFixed(1)
      : simulation.annualKPIs.annualUsefulCoolingKwhM2;

  const weightedAnnualUsefulHeating =
    totalSavedAreaM2 > 0
      ? +(savedZones.reduce((acc, z) => acc + z.result.annualKPIs.annualUsefulHeatingKwhM2 * z.floorAreaM2, 0) / totalSavedAreaM2).toFixed(1)
      : simulation.annualKPIs.annualUsefulHeatingKwhM2;

  const weightedAnnualLighting =
    totalSavedAreaM2 > 0
      ? +(savedZones.reduce((acc, z) => acc + z.result.annualKPIs.annualLightingElecKwhM2 * z.floorAreaM2, 0) / totalSavedAreaM2).toFixed(1)
      : simulation.annualKPIs.annualLightingElecKwhM2;

  // Subtract on-site rooftop PV generation
  const buildingPvOffsetKwhM2 = (sim.totalRenewableGen || 25);
  const netAggregatedEui = Math.max(0, +(weightedAnnualUsefulCooling / 3.5 + weightedAnnualUsefulHeating / 3.0 + weightedAnnualLighting - buildingPvOffsetKwhM2).toFixed(1));

  // Export EnergyPlus IDF file handler
  const handleExportIdf = () => {
    const idfText = generateDalecEnergyPlusIdf(room, controls, thermal, climate, 'PoliMi_DALEC_Shoebox');
    downloadTextFile(`PoliMi_DALEC_${room.orientationDeg}deg_${climate.name.replace(/[^a-zA-Z0-9]/g, '_')}.idf`, idfText);
  };

  const hoveredHourData = hoveredHourIndex !== null && simulation.hourlyRecords[hoveredHourIndex]
    ? simulation.hourlyRecords[hoveredHourIndex]
    : null;

  return (
    <div className="space-y-5">
      {/* Top Banner & Mode Navigation */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-extrabold uppercase tracking-widest">
              DALEC+ Studio • Split-Flux Daylighting & 5R1C Dynamic Engine
            </span>
            <span className="text-xs text-slate-300">
              Coupled with EPW: <strong className="text-white">{climate.name}</strong> (Köppen {climate.koppen})
            </span>
          </div>
          <h2 className="text-lg font-bold mt-1 text-white flex items-center gap-2">
            3D Cutaway Shoebox & 3-Band Facade Multi-Zone Configurator
            <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              No 10×10×4m Limit
            </span>
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Simulate 3 vertical facade bands (FA1, FA2, FA3), dual workplanes (MA1, MA2), and 4 occupant viewpoints (MP3–MP6) with automated 3-state glare & solar protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportIdf}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
            title="Export complete EnergyPlus .IDF file with 3-band fenestration, daylighting controls and ideal loads"
          >
            <Download className="w-3.5 h-3.5" />
            Export EnergyPlus (.IDF)
          </button>

          <button
            type="button"
            onClick={() => setShowIdfModal(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 font-bold text-xs flex items-center gap-1.5 shadow transition"
            title="Open EnergyPlus Python Runner Bridge Script"
          >
            <FileCode className="w-3.5 h-3.5" />
            Run E+ Validation Bridge
          </button>
        </div>
      </div>

      {/* Primary Studio Sub-Tabs Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {[
            { id: '3d_viewport', label: '1. 3D Cutaway Viewport & Configurator', icon: Eye },
            { id: 'monthly_matrix', label: '2. 12-Month Matrix & Stacked Charts', icon: Calendar },
            { id: 'carpet_plot', label: '3. 8,760h Annual Carpet Explorer', icon: Activity },
            { id: 'multizone_aggregator', label: '4. Whole-Building Multi-Zone Aggregator', icon: Building2 }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                  active
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-slate-500 font-mono pr-2">
          Solved 8,760h in <strong>{simulation.executionTimeMs} ms</strong>
        </span>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daylight Autonomy MA1</span>
          <span className="text-xl font-extrabold text-teal-600">{simulation.annualKPIs.cdaMA1Pct}%</span>
          <span className="text-[10px] text-slate-500 block">Near Window (Target {controls.targetIlluminanceMA1} lx)</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Daylight Autonomy MA2</span>
          <span className="text-xl font-extrabold text-sky-600">{simulation.annualKPIs.cdaMA2Pct}%</span>
          <span className="text-[10px] text-slate-500 block">Far Workplane (Target {controls.targetIlluminanceMA2} lx)</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Glare Exceeding MP3</span>
          <span className="text-xl font-extrabold text-amber-600">{simulation.annualKPIs.glareExceedMP3Pct}%</span>
          <span className="text-[10px] text-slate-500 block">&gt; {controls.glareLuminanceThresholdCdM2} cd/m²</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Circadian Autonomy</span>
          <span className="text-xl font-extrabold text-indigo-600">{simulation.annualKPIs.circadianAutonomyPct}%</span>
          <span className="text-[10px] text-slate-500 block">&gt; 250 mel. lx at eye</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Overheating Hours</span>
          <span className="text-xl font-extrabold text-rose-600">{simulation.annualKPIs.overheatingHoursCount} h</span>
          <span className="text-[10px] text-slate-500 block">{simulation.annualKPIs.overheatingFrequencyPct}% of occupied</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Useful Demand (H/C/L)</span>
          <span className="text-xl font-extrabold text-slate-800">{simulation.annualKPIs.annualUsefulTotalKwhM2}</span>
          <span className="text-[10px] text-slate-500 block">kWh/m²a Useful</span>
        </div>
      </div>

      {/* TAB 1: 3D VIEWPORT & PARAMETRIC CONTROLS */}
      {activeTab === '3d_viewport' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* 3D Three.js Viewport (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 shadow-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs px-2 text-slate-300">
              <span className="font-bold flex items-center gap-1.5 text-teal-400">
                <Eye className="w-4 h-4" />
                3D Cutaway Shoebox Room (Orbit: Left Click Drag • Zoom: Wheel)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {room.width}m × {room.depth}m × {room.height}m • {room.orientationDeg}° Azimuth
              </span>
            </div>

            <div ref={mountRef} className="w-full h-[380px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-slate-800" />

            {/* Viewport 3D Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] pt-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                Area MA1 (Near Window 0.8m)
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
                Area MA2 (Far Window 0.8m)
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Viewpoints MP3 / MP4
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />
                Overhead Luminaire Bars
              </div>
            </div>
          </div>

          {/* Configurator Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card 1: Room Dimensions & Orientation (No Limits) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Room Geometry & Orientation</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-bold border border-teal-200">
                  Floor {(room.width * room.depth).toFixed(1)} m²
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className="text-[11px] text-slate-500 block">Width (m)</span>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    step={0.5}
                    value={room.width}
                    onChange={(e) => setRoom({ ...room, width: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold"
                  />
                </label>
                <label>
                  <span className="text-[11px] text-slate-500 block">Depth (m)</span>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    step={0.5}
                    value={room.depth}
                    onChange={(e) => setRoom({ ...room, depth: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold"
                  />
                </label>
                <label>
                  <span className="text-[11px] text-slate-500 block">Height (m)</span>
                  <input
                    type="number"
                    min={2.2}
                    max={10}
                    step={0.1}
                    value={room.height}
                    onChange={(e) => setRoom({ ...room, height: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="text-[11px] text-slate-500 block">Orientation (° from North)</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={room.orientationDeg}
                    onChange={(e) => setRoom({ ...room, orientationDeg: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>N (0°)</span>
                    <span className="font-bold text-slate-700">{room.orientationDeg}°</span>
                    <span>S (180°)</span>
                  </div>
                </label>

                <label>
                  <span className="text-[11px] text-slate-500 block">Overhang Canopy (m)</span>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={room.overhangDepth}
                    onChange={(e) => setRoom({ ...room, overhangDepth: Number(e.target.value) })}
                    className="w-full accent-amber-600"
                  />
                  <div className="text-right text-[10px] font-bold text-amber-700">{room.overhangDepth} m</div>
                </label>
              </div>
            </div>

            {/* Card 2: 3 Vertical Facade Bands (FA1, FA2, FA3) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="font-extrabold uppercase tracking-wider text-slate-700">
                3 Vertical Facade Bands (FA1, FA2, FA3)
              </div>

              {/* FA1: Sill Band */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center font-bold text-slate-800">
                  <span>FA1: Parapet / Sill Band (0–1.0m)</span>
                  <span className="text-[11px] text-teal-700">Glazing {Math.round(room.bands.FA1.glazingRatio * 100)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px]">
                    Glazing Ratio:
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={room.bands.FA1.glazingRatio}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA1: { ...room.bands.FA1, glazingRatio: Number(e.target.value) }
                          }
                        })
                      }
                      className="w-full accent-teal-600"
                    />
                  </label>
                  <label className="text-[11px]">
                    Shading Device:
                    <select
                      value={room.bands.FA1.shadingType}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA1: { ...room.bands.FA1, shadingType: e.target.value as any }
                          }
                        })
                      }
                      className="w-full rounded bg-white border border-slate-300 p-1 text-[11px]"
                    >
                      <option value="none">None (Glazing only)</option>
                      <option value="blinds_45">Venetian Blinds 45°</option>
                      <option value="screen">Interior Screen</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* FA2: Vision Band */}
              <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1.5">
                <div className="flex justify-between items-center font-bold text-sky-900">
                  <span>FA2: Vision Band (1.0–2.0m)</span>
                  <span className="text-[11px] text-sky-700">Glazing {Math.round(room.bands.FA2.glazingRatio * 100)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <label>
                    U-value:
                    <input
                      type="number"
                      step={0.05}
                      value={room.bands.FA2.uValue}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA2: { ...room.bands.FA2, uValue: Number(e.target.value) }
                          }
                        })
                      }
                      className="w-full bg-white border border-sky-300 rounded p-1 font-bold"
                    />
                  </label>
                  <label>
                    g-value (SHGC):
                    <input
                      type="number"
                      step={0.02}
                      value={room.bands.FA2.gValue}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA2: { ...room.bands.FA2, gValue: Number(e.target.value) }
                          }
                        })
                      }
                      className="w-full bg-white border border-sky-300 rounded p-1 font-bold"
                    />
                  </label>
                  <label>
                    VisTrans (tau):
                    <input
                      type="number"
                      step={0.02}
                      value={room.bands.FA2.visTrans}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA2: { ...room.bands.FA2, visTrans: Number(e.target.value) }
                          }
                        })
                      }
                      className="w-full bg-white border border-sky-300 rounded p-1 font-bold"
                    />
                  </label>
                </div>
              </div>

              {/* FA3: Clerestory Band */}
              <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                <div className="flex justify-between items-center font-bold text-indigo-900">
                  <span>FA3: Clerestory Daylight Band (2.0m–Top)</span>
                  <span className="text-[11px] text-indigo-700">Glazing {Math.round(room.bands.FA3.glazingRatio * 100)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label>
                    Glazing Ratio:
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={room.bands.FA3.glazingRatio}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA3: { ...room.bands.FA3, glazingRatio: Number(e.target.value) }
                          }
                        })
                      }
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <label>
                    Shading/Daylight System:
                    <select
                      value={room.bands.FA3.shadingType}
                      onChange={(e) =>
                        setRoom({
                          ...room,
                          bands: {
                            ...room.bands,
                            FA3: { ...room.bands.FA3, shadingType: e.target.value as any }
                          }
                        })
                      }
                      className="w-full rounded bg-white border border-indigo-300 p-1 text-[11px]"
                    >
                      <option value="none">No Shading (Preserve Daylight)</option>
                      <option value="blinds_45">Venetian Blinds 45°</option>
                      <option value="screen">Interior Daylight Screen</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Card 3: 3-State Glare & Night Purge Controls */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-extrabold uppercase tracking-wider text-slate-700">
                  Glare & Building Physics Sync
                </span>
                <button
                  type="button"
                  onClick={handleSyncEurocodeThermalMass}
                  className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 font-bold text-[10px] flex items-center gap-1 transition"
                  title="1-Click: Sync thermal mass and wall U-value directly from Eurocode structural slabs and layers"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  Sync Eurocode Mass
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <label>
                  Glare Threshold (cd/m²):
                  <input
                    type="number"
                    step={250}
                    value={controls.glareLuminanceThresholdCdM2}
                    onChange={(e) => setControls({ ...controls, glareLuminanceThresholdCdM2: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1 font-bold mt-0.5"
                  />
                </label>

                <label>
                  Sun Irradiance Threshold (W/m²):
                  <input
                    type="number"
                    step={25}
                    value={controls.sunProtectionIrradianceThresholdWm2}
                    onChange={(e) => setControls({ ...controls, sunProtectionIrradianceThresholdWm2: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1 font-bold mt-0.5"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block text-[11px]">Automated Night Flush Purge</span>
                  <span className="text-[10px] text-slate-500">+0.8 ACH when indoor &gt; 24°C &amp; outdoor cooler</span>
                </div>
                <input
                  type="checkbox"
                  checked={thermal.automatedNightPurge}
                  onChange={(e) => setThermal({ ...thermal, automatedNightPurge: e.target.checked })}
                  className="w-4 h-4 accent-teal-600"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 12-MONTH MATRIX & STACKED BARS */}
      {activeTab === 'monthly_matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                DALEC Full 12-Month Energy & Emissions Performance Table
              </h3>
              <p className="text-[11px] text-slate-500">
                Monthly breakdown of useful heating, cooling, artificial lighting, daylight autonomy, and overheating hours
              </p>
            </div>

            {/* Metric Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {[
                { id: 'useful', label: 'Useful Demand' },
                { id: 'final', label: 'Delivered (ASE)' },
                { id: 'primary', label: 'Primary (PEF)' },
                { id: 'cost', label: 'Cost (€)' },
                { id: 'co2', label: 'CO2 (kg)' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMonthlyMetricMode(m.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    monthlyMetricMode === m.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Full 12-Month Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-800 text-[11px]">
                  <th className="p-2.5 rounded-l-xl">Month</th>
                  <th className="p-2.5">Cooling ({monthlyMetricMode === 'cost' ? '€/m²' : monthlyMetricMode === 'co2' ? 'kg/m²' : 'kWh/m²'})</th>
                  <th className="p-2.5">Heating ({monthlyMetricMode === 'cost' ? '€/m²' : monthlyMetricMode === 'co2' ? 'kg/m²' : 'kWh/m²'})</th>
                  <th className="p-2.5">Lighting ({monthlyMetricMode === 'cost' ? '€/m²' : monthlyMetricMode === 'co2' ? 'kg/m²' : 'kWh/m²'})</th>
                  <th className="p-2.5">Total</th>
                  <th className="p-2.5">cDA MA1</th>
                  <th className="p-2.5">cDA MA2</th>
                  <th className="p-2.5">Avg Lux MA1</th>
                  <th className="p-2.5 rounded-r-xl">Overheating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {simulation.monthlySummaries.map((m) => {
                  let cVal = m.usefulCoolingKwhM2;
                  let hVal = m.usefulHeatingKwhM2;
                  let lVal = m.lightingElecKwhM2;
                  let tVal = m.usefulTotalKwhM2;

                  if (monthlyMetricMode === 'final') {
                    cVal = m.finalCoolingKwhM2;
                    hVal = m.finalHeatingKwhM2;
                    lVal = m.finalLightingKwhM2;
                    tVal = m.finalTotalKwhM2;
                  } else if (monthlyMetricMode === 'primary') {
                    cVal = m.primaryCoolingKwhM2;
                    hVal = m.primaryHeatingKwhM2;
                    lVal = m.primaryLightingKwhM2;
                    tVal = m.primaryTotalKwhM2;
                  } else if (monthlyMetricMode === 'cost') {
                    tVal = m.energyCostEurM2;
                    cVal = +(m.finalCoolingKwhM2 * thermal.electricityTariffEurKwh).toFixed(2);
                    hVal = +(m.finalHeatingKwhM2 * thermal.electricityTariffEurKwh).toFixed(2);
                    lVal = +(m.finalLightingKwhM2 * thermal.electricityTariffEurKwh).toFixed(2);
                  } else if (monthlyMetricMode === 'co2') {
                    tVal = m.co2EmissionsKgM2;
                    cVal = +(m.primaryCoolingKwhM2 * thermal.co2EmissionFactorGKwh / 1000).toFixed(2);
                    hVal = +(m.primaryHeatingKwhM2 * thermal.co2EmissionFactorGKwh / 1000).toFixed(2);
                    lVal = +(m.primaryLightingKwhM2 * thermal.co2EmissionFactorGKwh / 1000).toFixed(2);
                  }

                  return (
                    <tr key={m.month} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-800">{m.month}</td>
                      <td className="p-2 text-sky-700 font-mono">{cVal}</td>
                      <td className="p-2 text-rose-700 font-mono">{hVal}</td>
                      <td className="p-2 text-amber-700 font-mono">{lVal}</td>
                      <td className="p-2 font-bold text-slate-900 font-mono">{tVal}</td>
                      <td className="p-2 text-teal-700 font-mono">{m.cdaMA1}%</td>
                      <td className="p-2 text-teal-700 font-mono">{m.cdaMA2}%</td>
                      <td className="p-2 text-slate-600 font-mono">{m.avgIlluminanceMA1} lx</td>
                      <td className="p-2 font-mono">
                        {m.overheatingHours > 0 ? (
                          <span className="text-rose-600 font-bold">{m.overheatingHours} h</span>
                        ) : (
                          <span className="text-slate-400">0 h</span>
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

      {/* TAB 3: 8,760 CARPET HEATMAP EXPLORER */}
      {activeTab === 'carpet_plot' && (
        <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-400" />
                8,760-Hour Carpet Heatmap Explorer (365 Days × 24 Hours)
              </h3>
              <p className="text-[11px] text-slate-400">
                Inspect hour-by-hour dynamic loads, daylight illuminances, and automated facade states across the full year
              </p>
            </div>

            {/* Metric Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Select Metric:</span>
              <select
                value={selectedCarpetMetric}
                onChange={(e) => setSelectedCarpetMetric(e.target.value as CarpetMetricId)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-teal-300 focus:outline-none"
              >
                <option value="cooling">Effective Demand — Cooling (W/m²)</option>
                <option value="heating">Effective Demand — Heating (W/m²)</option>
                <option value="lighting">Artificial Light Power (W/m²)</option>
                <option value="daylight_ma">Daylight Illuminance Near Window MA1 (lx)</option>
                <option value="cda">Continuous Daylight Autonomy Credit (0–1)</option>
                <option value="facade_state">Automated Facade State (0=Ground, 1=Glare, 2=Sun, 3=Both)</option>
                <option value="glare_mp">Glare Luminance at MP3 Viewpoint (cd/m²)</option>
                <option value="melanopic_ev">Circadian Melanopic Lux at MP3 (mel. lx)</option>
                <option value="temperature">Internal Operative Temperature (°C)</option>
              </select>
            </div>
          </div>

          {/* HTML5 Canvas Carpet Plot */}
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 overflow-x-auto">
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasMouseMove}
              className="w-full h-[240px] rounded cursor-crosshair block"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1">
              <span>Day 1 (Jan 1)</span>
              <span>Day 90 (Apr 1)</span>
              <span>Day 180 (Jun 29)</span>
              <span>Day 270 (Sep 27)</span>
              <span>Day 365 (Dec 31)</span>
            </div>
          </div>

          {/* Hovered Hour Live Telemetry Bar */}
          {hoveredHourData ? (
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Date &amp; Time:</span>
                <span className="font-bold text-white">
                  {MONTH_NAMES[hoveredHourData.month - 1]} {hoveredHourData.dayOfMonth}, {hoveredHourData.hour}:00
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">T_ext / T_operative:</span>
                <span className="font-bold text-teal-300">
                  {hoveredHourData.tExt}°C / {hoveredHourData.tOperative}°C
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Facade Irradiance:</span>
                <span className="font-bold text-amber-400">{hoveredHourData.facadeIrradiance} W/m²</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Daylight MA1 / MA2:</span>
                <span className="font-bold text-emerald-400">
                  {hoveredHourData.illuminanceMA1} lx / {hoveredHourData.illuminanceMA2} lx
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Lighting Power:</span>
                <span className="font-bold text-yellow-400">{hoveredHourData.powerLightingTotal} W/m²</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Facade State:</span>
                <span className="font-bold text-purple-400">
                  State {hoveredHourData.facadeState}{' '}
                  {hoveredHourData.facadeState === 0
                    ? '(Ground)'
                    : hoveredHourData.facadeState === 1
                    ? '(Glare)'
                    : hoveredHourData.facadeState === 2
                    ? '(Sun)'
                    : '(Combined)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 py-1">
              Hover over any point in the 365×24 carpet plot to inspect real-time hourly building physics.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WHOLE-BUILDING MULTI-ZONE AGGREGATOR */}
      {activeTab === 'multizone_aggregator' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Whole-Building Multi-Zone &amp; PVGIS Aggregator
              </h3>
              <p className="text-[11px] text-slate-500">
                Sum representative perimeter &amp; core zones, scale by net floor areas, and subtract rooftop PV generation
              </p>
            </div>

            {/* Quick Add Current Zone Button */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Zone Name"
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
              />
              <input
                type="number"
                value={newZoneAreaM2}
                onChange={(e) => setNewZoneAreaM2(Number(e.target.value))}
                placeholder="Area m²"
                className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800"
              />
              <button
                type="button"
                onClick={handleSaveCurrentZone}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Zone
              </button>
            </div>
          </div>

          {/* Aggregated Zones Table */}
          {savedZones.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600 font-bold">No representative zones saved yet.</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Configure orientations (e.g. South, North, East/West, Core) and click &quot;Add Zone&quot; to aggregate the complete building energy balance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">Zone Name</th>
                      <th className="p-2.5">Orientation</th>
                      <th className="p-2.5">Area (m²)</th>
                      <th className="p-2.5">Useful Cooling</th>
                      <th className="p-2.5">Useful Heating</th>
                      <th className="p-2.5">Lighting</th>
                      <th className="p-2.5">cDA MA1</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savedZones.map((z) => (
                      <tr key={z.id} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-800">{z.name}</td>
                        <td className="p-2 text-slate-600 font-mono">{z.orientation}°</td>
                        <td className="p-2 text-slate-800 font-bold font-mono">{z.floorAreaM2} m²</td>
                        <td className="p-2 text-sky-700 font-mono">{z.result.annualKPIs.annualUsefulCoolingKwhM2} kWh/m²</td>
                        <td className="p-2 text-rose-700 font-mono">{z.result.annualKPIs.annualUsefulHeatingKwhM2} kWh/m²</td>
                        <td className="p-2 text-amber-700 font-mono">{z.result.annualKPIs.annualLightingElecKwhM2} kWh/m²</td>
                        <td className="p-2 text-teal-700 font-mono">{z.result.annualKPIs.cdaMA1Pct}%</td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveZone(z.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remove Zone"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Aggregated Totals Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total Net Floor Area</span>
                  <span className="text-xl font-extrabold text-white">{totalSavedAreaM2} m²</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Weighted Delivered EUI</span>
                  <span className="text-xl font-extrabold text-teal-400">
                    {+(weightedAnnualUsefulCooling / 3.5 + weightedAnnualUsefulHeating / 3.0 + weightedAnnualLighting).toFixed(1)} kWh/m²a
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Rooftop PV Offset</span>
                  <span className="text-xl font-extrabold text-emerald-400">-{buildingPvOffsetKwhM2} kWh/m²a</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Net Building Site EUI</span>
                  <span className="text-2xl font-extrabold text-amber-300">{netAggregatedEui} kWh/m²a</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ENERGYPLUS LOCAL RUNNER VALIDATION MODAL */}
      {showIdfModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 text-white border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-teal-300 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-teal-400" />
                EnergyPlus Local Validation Server (FastAPI / Python)
              </h3>
              <button
                type="button"
                onClick={() => setShowIdfModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Run this lightweight local Python server to execute the exported EnergyPlus <code>.idf</code> and <code>.epw</code> directly on your machine with 15-minute resolution:
            </p>

            <div className="relative">
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-60">
                {generateEnergyPlusLocalRunnerScript()}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generateEnergyPlusLocalRunnerScript());
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 3000);
                }}
                className="absolute top-2 right-2 px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] flex items-center gap-1 shadow"
              >
                {copiedScript ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedScript ? 'Copied!' : 'Copy Script'}
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleExportIdf}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download .IDF File
              </button>

              <button
                type="button"
                onClick={() => setShowIdfModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
